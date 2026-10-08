import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentHourStart, type StatisticsEvent } from '../src/statistics.ts'
import { StatisticsCacheStore, statisticsSchema } from '../src/statistics-store.ts'
import { createStatisticsSource, type StatisticsSource, type StatisticsSourceRecord } from '../src/statistics-source.ts'
import { StatisticsService } from '../src/statistics-service.ts'

const hour = 3600_000
const now = Date.now()
const start = now - 6 * hour
const request = { start, end: now + hour, timeZone: 'Asia/Shanghai' }

function promptEvent(seq: number, time: number, id: string): StatisticsEvent {
  return { seq, time, type: 'user/message', data: { id, source: { kind: 'user' } } }
}

function logAt(time: number): { inheritedEventCount: number; events: StatisticsEvent[] } {
  return { inheritedEventCount: 0, events: [promptEvent(0, time, `m-${time}`)] }
}

interface FakeSource extends StatisticsSource {
  reads: string[]
  records: StatisticsSourceRecord[]
}

function fakeSource(records: StatisticsSourceRecord[], logs: Record<string, ReturnType<typeof logAt>>): FakeSource {
  const reads: string[] = []
  const source: FakeSource = {
    reads,
    records,
    // Read through the mutable field so a test can change the corpus mid-flight.
    list: async () => source.records,
    read: async record => {
      reads.push(record.id)
      const log = logs[record.id]
      if (log === undefined) throw new Error(`missing log ${record.id}`)
      return log
    },
  }
  return source
}

function memoryCache(): StatisticsCacheStore {
  const db = new DatabaseSync(':memory:')
  db.exec(statisticsSchema)
  return new StatisticsCacheStore(db)
}

function service(source: StatisticsSource, completions: { time: number; points: number }[] = []): StatisticsService {
  return new StatisticsService(memoryCache(), () => source, { listCompletions: () => completions })
}

const openDatabases: DatabaseSync[] = []
afterEach(() => { for (const db of openDatabases.splice(0)) { try { db.close() } catch { /* already closed */ } } })

describe('per-session statistics cache', () => {
  const created = now - 3 * hour
  const records: StatisticsSourceRecord[] = [
    { id: 'a', createdAt: created, revision: 'r1' },
    { id: 'b', createdAt: created, revision: 'r1' },
  ]

  it('reads every session once and answers later ranges from the cache', async () => {
    const source = fakeSource(records, { a: logAt(now - 2 * hour), b: logAt(now - 2 * hour) })
    const statistics = service(source)
    const first = await statistics.calculate(request)
    expect(source.reads).toEqual(['a', 'b'])
    expect(first.totals.prompts).toBe(2)

    source.reads.length = 0
    const second = await statistics.calculate(request)
    expect(source.reads).toEqual([])
    expect(second.totals).toEqual(first.totals)
  })

  it('re-reads only the session whose stored revision changed', async () => {
    const source = fakeSource(records, { a: logAt(now - 2 * hour), b: logAt(now - 2 * hour) })
    const statistics = service(source)
    await statistics.calculate(request)

    source.reads.length = 0
    source.records = [{ ...records[0]!, revision: 'r2' }, records[1]!]
    await statistics.calculate(request)
    expect(source.reads).toEqual(['a'])
  })

  it('falls back to the live flag when the backend exposes no revision', async () => {
    const live: StatisticsSourceRecord[] = [
      { id: 'a', createdAt: created, live: false },
      { id: 'b', createdAt: created, live: true },
    ]
    const source = fakeSource(live, { a: logAt(now - 2 * hour), b: logAt(now - 2 * hour) })
    const statistics = service(source)
    await statistics.calculate(request)

    source.reads.length = 0
    await statistics.calculate(request)
    // A closed session cannot have grown; a live one is refreshed every time.
    expect(source.reads).toEqual(['b'])
  })

  it('ignores a corrupt payload row and reads that session again', async () => {
    const db = new DatabaseSync(':memory:')
    openDatabases.push(db)
    db.exec(statisticsSchema)
    const cache = new StatisticsCacheStore(db)
    const source = fakeSource(records, { a: logAt(now - 2 * hour), b: logAt(now - 2 * hour) })
    const statistics = new StatisticsService(cache, () => source, { listCompletions: () => [] })
    await statistics.calculate(request)

    db.exec("UPDATE statistics_sessions SET payload = 'not json' WHERE session_id = 'a'")
    source.reads.length = 0
    await statistics.calculate(request)
    expect(source.reads).toEqual(['a'])
  })

  it('drops cached rows for sessions that left the corpus', async () => {
    const cache = memoryCache()
    const source = fakeSource(records, { a: logAt(now - 2 * hour), b: logAt(now - 2 * hour) })
    const statistics = new StatisticsService(cache, () => source, { listCompletions: () => [] })
    await statistics.calculate(request)
    expect([...cache.read().keys()].sort()).toEqual(['a', 'b'])

    source.records = [records[0]!]
    source.reads.length = 0
    await statistics.calculate(request)
    expect(source.reads).toEqual([])
    expect([...cache.read().keys()]).toEqual(['a'])
  })

  it('re-reads every session when the caller bypasses the cache', async () => {
    const source = fakeSource(records, { a: logAt(now - 2 * hour), b: logAt(now - 2 * hour) })
    const statistics = service(source)
    await statistics.calculate(request)

    source.reads.length = 0
    await statistics.calculate({ ...request, refresh: true })
    expect(source.reads).toEqual(['a', 'b'])
  })

  it('folds task completions from the task store into the same run', async () => {
    const source = fakeSource(records, { a: logAt(now - 2 * hour), b: logAt(now - 2 * hour) })
    const statistics = service(source, [{ time: now - 2 * hour, points: 5 }, { time: now - hour, points: 8 }])
    const snapshot = await statistics.calculate(request)
    expect(snapshot.totals).toMatchObject({ prompts: 2, completedTasks: 2, completedPoints: 13 })
    // Delivery rows land beside the session rows in the same hour buckets.
    expect(snapshot.hours.filter(row => row.completedTasks > 0)).toHaveLength(2)
  })
})

describe('background statistics runs', () => {
  const created = now - 3 * hour

  it('reports progress and completes with the folded snapshot', async () => {
    const records: StatisticsSourceRecord[] = [
      { id: 'a', createdAt: created, revision: 'r1' },
      { id: 'b', createdAt: created, revision: 'r1' },
    ]
    const statistics = service(fakeSource(records, { a: logAt(now - 2 * hour), b: logAt(now - 3 * hour) }))
    const jobId = statistics.start(request)
    const settled = await waitFor(statistics, jobId)
    expect(settled.status).toBe('completed')
    expect(settled.total).toBe(2)
    expect(settled.processed).toBe(2)
    expect(settled.snapshot?.totals.prompts).toBe(2)
  })

  it('stops a running sweep when it is cancelled and keeps no result', async () => {
    let release = (): void => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const records: StatisticsSourceRecord[] = [{ id: 'a', createdAt: created, revision: 'r1' }]
    const source: StatisticsSource = {
      list: async () => records,
      read: async () => { await gate; return logAt(now - 2 * hour) },
    }
    const statistics = service(source)
    const jobId = statistics.start(request)
    expect(statistics.cancel(jobId)).toBe(true)
    release()
    const settled = await waitFor(statistics, jobId)
    expect(settled.status).toBe('cancelled')
    expect(settled.snapshot).toBeUndefined()
  })

  it('rejects an invalid range instead of running', async () => {
    const statistics = service(fakeSource([], {}))
    await expect(statistics.calculate({ ...request, end: request.start })).rejects.toThrow('Invalid statistics range')
    expect(statistics.get('missing')).toBeNull()
    expect(statistics.cancel('missing')).toBe(false)
  })
})

describe('statistics read surface', () => {
  const created = now - 3 * hour
  const context = (services: Record<string, unknown>) => ({ get: (name: string) => services[name] }) as never

  it('prefers the persistence seam and reads one session without listing the corpus', async () => {
    const opened: string[] = []
    const persistence = {
      list: async () => [
        { header: { id: 'a', createdAt: created }, revision: 'r1', sizeBytes: 10 },
        { header: { id: 'b', createdAt: created }, revision: 'r1' },
      ],
      open: async (id: string) => {
        opened.push(id)
        if (id === 'b') throw Object.assign(new Error('session "b" not found'), { name: 'SessionPersistenceNotFoundError' })
        return { header: { id, createdAt: created }, inheritedEventCount: 0, read: async () => ({ events: logAt(now - 2 * hour).events }), close: async () => {} }
      },
    }
    const readSession = vi.fn(async () => logAt(now - 2 * hour))
    const source = createStatisticsSource(context({ sessionPersistence: persistence, sessionQuery: { listSessions: async () => [], readSession } }))
    const listed = await source.list()
    expect(listed.map(record => [record.id, record.stored, record.revision])).toEqual([['a', true, 'r1'], ['b', false, 'r1']])

    expect((await source.read(listed[0]!)).events).toHaveLength(1)
    expect(opened).toEqual(['a'])
    expect(readSession).not.toHaveBeenCalled()

    // A session created but not yet written has no artifact to open, so the live
    // session-query read serves it instead of failing the sweep.
    expect((await source.read(listed[1]!)).events).toHaveLength(1)
    expect(readSession).toHaveBeenCalledWith('b')
  })

  it('uses the session-query service when no persistence backend is mounted', async () => {
    const readSession = vi.fn(async () => logAt(now - 2 * hour))
    const source = createStatisticsSource(context({
      sessionQuery: { listSessions: async () => [{ header: { id: 'a', createdAt: created, origin: 'subagent' }, live: true }], readSession },
    }))
    const listed = await source.list()
    expect(listed).toEqual([{ id: 'a', createdAt: created, origin: 'subagent', live: true, stored: true }])
    expect((await source.read(listed[0]!)).events).toHaveLength(1)
    expect(readSession).toHaveBeenCalledWith('a')
  })

  it('refuses to run without any session read service', () => {
    expect(() => createStatisticsSource(context({}))).toThrow(/sessionQuery|persistence/u)
    expect(() => createStatisticsSource(context({ sessionQuery: {} }))).toThrow(/sessionQuery|persistence/u)
  })
})

describe('hour bucketing', () => {
  it('builds one formatter per zone instead of one per event', () => {
    const zone = 'Pacific/Chatham'
    // Warm the cache first, then assert that repeated calls add no formatter.
    currentHourStart(now, zone)
    const original = Intl.DateTimeFormat
    let constructed = 0
    class Counting extends original {
      constructor(...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
        super(...args)
        constructed++
      }
    }
    Intl.DateTimeFormat = Counting as unknown as typeof Intl.DateTimeFormat
    try {
      for (let index = 0; index < 500; index++) {
        expect(currentHourStart(now - index * 60_000, zone)).toBe(currentHourStart(now - index * 60_000, zone))
      }
    } finally {
      Intl.DateTimeFormat = original
    }
    expect(constructed).toBe(0)
  })
})

async function waitFor(statistics: StatisticsService, jobId: string, timeoutMs = 2_000): Promise<import('../src/statistics.ts').StatisticsRunState> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const state = statistics.get(jobId)
    if (state !== null && state.status !== 'running') return state
    if (Date.now() > deadline) throw new Error('statistics run did not settle')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
