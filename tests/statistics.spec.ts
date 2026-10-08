import { describe, expect, it, vi } from 'vitest'
import { calculateStatistics, currentHourStart, type StatisticsEvent, type StatisticsQuery, type StatisticsSnapshot } from '../src/statistics.ts'
import { calendarCells, calendarWeeks, compactNumber, heatLevel, mediumTokens, periodRequest, periodValue } from '../src/client/statistics-calendar.ts'

const time = (hour: number, minute = 0) => Date.UTC(2026, 9, 8, hour - 8, minute)
const request = { start: time(0), end: time(24), timeZone: 'Asia/Shanghai' }
const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 3, cacheWriteTokens: 2, reasoningTokens: 4 }
const event = (seq: number, hour: number, type: string, data: StatisticsEvent['data']): StatisticsEvent => ({ seq, time: time(hour), type, data })
function query(events: StatisticsEvent[], createdAt = time(8)): StatisticsQuery {
  return { listSessions: vi.fn(async () => [{ header: { id: 's1', createdAt } }]), readSession: vi.fn(async () => ({ inheritedEventCount: 0, events })) }
}

describe('on-demand hourly statistics', () => {
  it('excludes the entire current hour including its start and future hours', async () => {
    const service = query([
      event(0, 10, 'user/message', { id: 'u1', source: { kind: 'user' } }),
      event(1, 11, 'user/message', { id: 'u2', source: { kind: 'user' } }),
      event(2, 11, 'assistant/message', { turn: 1, step: 1, usage }),
    ])
    const result = await calculateStatistics(service, request, time(11, 36))
    expect(result.cutoff).toBe(time(11))
    expect(result.totals).toMatchObject({ sessions: 1, prompts: 1, tokens: 0, completedTasks: 0, completedPoints: 0 })
    expect(result.hours.every(row => row.hour < time(11))).toBe(true)
    expect(service.readSession).toHaveBeenCalledOnce()
  })
  it('counts admitted human messages once, excluding injected, goal and derived messages', async () => {
    const events = [
      event(0, 9, 'user/message', { id: 'same-text-1', source: { kind: 'user', rpcId: 'send-1' } }),
      event(1, 9, 'user/message', { id: 'same-text-2', source: { kind: 'user', rpcId: 'send-2' } }),
      event(2, 9, 'user/message', { id: 'duplicate', source: { kind: 'user', rpcId: 'send-1' } }),
      event(3, 9, 'user/message', { source: { kind: 'goal' } }),
      event(4, 9, 'user/message', { source: { kind: 'tool' } }),
      { ...event(5, 9, 'user/message', { source: { kind: 'user' } }), sourceEventSeqs: [0] },
    ]
    expect((await calculateStatistics(query(events), request, time(11))).totals.prompts).toBe(2)
  })
  it('uses final usage, not all stream snapshots, and includes cache but not reasoning twice', async () => {
    const events = [event(0, 9, 'assistant/attempt', { turn: 1, step: 1, stream: [
      { chunk: { type: 'usage', usage: { ...usage, inputTokens: 1 } } }, { chunk: { type: 'usage', usage } },
    ] }), event(1, 10, 'assistant/message', { turn: 1, step: 1, usage: { ...usage, inputTokens: 20 }, stream: [{ chunk: { type: 'usage', usage } }] })]
    const result = await calculateStatistics(query(events), request, time(11))
    expect(result.totals.tokens).toBe(30)
    expect(result.hours.find(row => row.hour === time(9))?.tokens).toBe(0)
    expect(result.hours.find(row => row.hour === time(10))?.tokens).toBe(30)
  })
  it('retains the original hour for identical repeated settlement samples', async () => {
    const events = [event(0, 9, 'assistant/attempt', { turn: 1, step: 1, stream: [{ chunk: { type: 'usage', usage } }] }),
      event(1, 10, 'assistant/message', { turn: 1, step: 1, usage })]
    const result = await calculateStatistics(query(events), request, time(11))
    expect(result.hours.find(row => row.hour === time(9))?.tokens).toBe(20)
    expect(result.totals.tokens).toBe(20)
  })
  it('adds billed retry attempts only when retry-started opens a new attempt', async () => {
    const events = [
      event(0, 9, 'assistant/attempt', { turn: 1, step: 1, stream: [{ chunk: { type: 'usage', usage } }] }),
      event(1, 9, 'llm/retry', { turn: 1, step: 1 }),
      event(2, 9, 'llm/retry-started', { turn: 1, step: 1 }),
      event(3, 10, 'assistant/message', { turn: 1, step: 1, usage }),
    ]
    expect((await calculateStatistics(query(events), request, time(11))).totals.tokens).toBe(40)
  })
  it('excludes inherited fork history but includes own child tokens and explicit human child sends', async () => {
    const events = [
      event(0, 9, 'user/message', { source: { kind: 'user' } }),
      event(1, 9, 'assistant/message', { turn: 1, step: 1, usage }),
      event(2, 10, 'user/message', { source: { kind: 'user' } }),
      event(3, 10, 'user/message', { source: { kind: 'user', rpcId: 'human-child' } }),
      event(4, 10, 'assistant/message', { turn: 2, step: 1, usage }),
    ]
    const service: StatisticsQuery = { listSessions: async () => [{ header: { id: 'child', createdAt: time(10), origin: 'subagent' } }], readSession: async () => ({ inheritedEventCount: 2, events }) }
    expect((await calculateStatistics(service, request, time(11))).totals).toMatchObject({ sessions: 1, prompts: 1, tokens: 20 })
  })
  it('reads old sessions for activity, de-duplicates catalog ids and includes compaction', async () => {
    const service = query([event(0, 10, 'compaction/summary', { usage: { inputTokens: 2, outputTokens: 3, totalTokens: 10 } })], time(0) - 86400_000)
    service.listSessions = async () => [{ header: { id: 's1', createdAt: time(0) - 86400_000 } }, { header: { id: 's1', createdAt: time(0) - 86400_000 } }]
    expect((await calculateStatistics(service, request, time(11))).totals).toMatchObject({ sessions: 0, prompts: 0, tokens: 10 })
    expect(service.readSession).toHaveBeenCalledOnce()
  })
  it('shows missing usage and rejects read failures instead of inventing zero results', async () => {
    const service = query([event(0, 10, 'assistant/message', { turn: 1, step: 1 })])
    expect((await calculateStatistics(service, request, time(11))).missingUsageCalls).toBe(1)
    service.readSession = async () => { throw new Error('unreadable session') }
    await expect(calculateStatistics(service, request, time(11))).rejects.toThrow('unreadable session')
  })
  it('handles fractional-offset time zones and validates bounded requests', async () => {
    expect(currentHourStart(Date.UTC(2026, 9, 8, 5, 25), 'Asia/Kathmandu')).toBe(Date.UTC(2026, 9, 8, 5, 15))
    await expect(calculateStatistics(query([]), { ...request, end: request.start }, time(11))).rejects.toThrow('Invalid')
    await expect(calculateStatistics(query([]), { ...request, timeZone: 'invalid-zone' }, time(11))).rejects.toThrow()
  })
  it('supports valid day and leap-year ranges and rejects oversized ranges', async () => {
    expect(periodValue('day', new Date(2026, 9, 8))).toBe('2026-10-08')
    expect(periodValue('year', new Date(2026, 9, 8))).toBe('2026')
    expect(periodRequest('year', '2024').end - periodRequest('year', '2024').start).toBe(366 * 86400_000)
    expect(() => periodRequest('day', '2026-02-30')).toThrow()
    const year = periodRequest('year', '2026')
    await expect(calculateStatistics(query([]), year, year.end)).resolves.toMatchObject({ start: year.start, end: year.end })
    await expect(calculateStatistics(query([]), { ...year, end: year.start + 368 * 86400_000 })).rejects.toThrow('Invalid')
  })
  it('counts a new session only once a real user message reached it', async () => {
    // The fixture's session carries no admitted user message at all.
    const silent = await calculateStatistics(query([event(0, 9, 'assistant/message', { turn: 1, step: 1, usage })]), request, time(11))
    expect(silent.totals).toMatchObject({ sessions: 0, prompts: 0, tokens: 20 })

    // A user message makes the same record a conversation.
    const spoken = await calculateStatistics(query([event(0, 9, 'user/message', { id: 'u1', source: { kind: 'user' } })]), request, time(11))
    expect(spoken.totals).toMatchObject({ sessions: 1, prompts: 1 })

    // A subagent session only counts when a human send reached it explicitly.
    const subagentEvents = [event(0, 9, 'user/message', { id: 'u1', source: { kind: 'tool' } })]
    const silentSubagent: StatisticsQuery = {
      listSessions: async () => [{ header: { id: 'child', createdAt: time(9), origin: 'subagent' } }],
      readSession: async () => ({ inheritedEventCount: 0, events: subagentEvents }),
    }
    expect((await calculateStatistics(silentSubagent, request, time(11))).totals.sessions).toBe(0)
    const steered: StatisticsQuery = {
      listSessions: async () => [{ header: { id: 'child', createdAt: time(9), origin: 'subagent' } }],
      readSession: async () => ({ inheritedEventCount: 0, events: [event(0, 9, 'user/message', { id: 'u1', source: { kind: 'user', rpcId: 'send-1' } })] }),
    }
    expect((await calculateStatistics(steered, request, time(11))).totals.sessions).toBe(1)
  })
  it('adds task completions from the task store into the same hour buckets', async () => {
    const result = await calculateStatistics(query([]), request, time(11), [
      { time: time(9), points: 5 },
      { time: time(9), points: 3 },
      { time: time(12), points: 100 },
    ])
    expect(result.hours.find(row => row.hour === time(9))).toMatchObject({ completedTasks: 2, completedPoints: 8 })
    // The completion inside the excluded current hour contributes nothing.
    expect(result.totals).toMatchObject({ completedTasks: 2, completedPoints: 8 })
  })
  it('aggregates hours into weekday-aligned day, month and year grids', async () => {
    const start = new Date(2026, 9, 8, 0).getTime()
    const end = new Date(2026, 9, 9, 0).getTime()
    const result: StatisticsSnapshot = {
      start, end, cutoff: new Date(2026, 9, 8, 11).getTime(), calculatedAt: end,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, missingUsageCalls: 0,
      hours: [
        { hour: new Date(2026, 9, 8, 9).getTime(), sessions: 1, prompts: 2, tokens: 20, completedTasks: 1, completedPoints: 3 },
        { hour: new Date(2026, 9, 8, 10).getTime(), sessions: 2, prompts: 3, tokens: 30, completedTasks: 0, completedPoints: 0 },
      ],
      totals: { sessions: 3, prompts: 5, tokens: 50, completedTasks: 1, completedPoints: 3 },
    }
    const day = calendarCells(result, 'day')
    expect(day).toHaveLength(24)
    expect(day[9]).toMatchObject({ tokens: 20, completedTasks: 1, completedPoints: 3, excluded: false })
    expect(day[10]).toMatchObject({ sessions: 2, tokens: 30 })
    expect(day[11]?.excluded).toBe(true)

    const month = calendarCells({ ...result, ...periodRequest('month', '2026-10') }, 'month')
    // 2026-10-01 is a Thursday, so three weekday slots precede day 1.
    expect(month).toHaveLength(3 + 31)
    expect(month.slice(0, 3)).toEqual([null, null, null])
    expect(month[10]).toMatchObject({ label: '8', sessions: 3, tokens: 50, completedTasks: 1, completedPoints: 3, excluded: false })
    expect(month[11]?.excluded).toBe(true)
    expect(calendarWeeks({ ...result, ...periodRequest('month', '2026-10') })).toBe(5)
    // 2026-08 starts on a Saturday, so that month needs a sixth week.
    expect(calendarWeeks({ ...result, ...periodRequest('month', '2026-08') })).toBe(6)

    const year = calendarCells({ ...result, ...periodRequest('year', '2026') }, 'year')
    expect(year).toHaveLength(12)
    expect(year[9]).toMatchObject({ label: '10月', tokens: 50, completedTasks: 1, completedPoints: 3 })
    expect(year[10]?.excluded).toBe(true)
    expect(calendarCells({ ...result, ...periodRequest('month', '2024-02') }, 'month').filter(Boolean)).toHaveLength(29)
  })
  it('builds month ranges without calculating', () => {
    expect(periodRequest('month', '2026-02').end - periodRequest('month', '2026-02').start).toBe(28 * 86400_000)
    expect(() => periodRequest('month', '2026-13')).toThrow()
  })
  it('maps tokens onto an absolute heat scale anchored at 6e8 per day', () => {
    expect(mediumTokens('day')).toBe(6e8 / 24)
    expect(mediumTokens('month')).toBe(6e8)
    expect(mediumTokens('year')).toBe(6e8 * 30)
    expect(heatLevel(0, 'day')).toBe(0)
    expect(heatLevel(0.4e7, 'day')).toBe(1)
    expect(heatLevel(1e7, 'day')).toBe(1)
    expect(heatLevel(2.5e7, 'day')).toBe(2)
    expect(heatLevel(4e7, 'day')).toBe(3)
    expect(heatLevel(1e8, 'day')).toBe(4)
    // The same intensity reads the same colour in every view.
    expect(heatLevel(6e8, 'month')).toBe(2)
    expect(heatLevel(6e8 * 30, 'year')).toBe(2)
  })
  it('renders large counters in M and B so a heat cell never truncates', () => {
    expect(compactNumber(94)).toBe('94')
    expect(compactNumber(999_999)).toBe('999,999')
    expect(compactNumber(49_914_230)).toBe('49.9M')
    expect(compactNumber(190_479_000)).toBe('190.5M')
    expect(compactNumber(1_484_991_258)).toBe('1.48B')
    expect(compactNumber(100_000_000)).toBe('100M')
    expect(compactNumber(2_000_000_000)).toBe('2B')
    expect(compactNumber(0)).toBe('0')
  })
})
