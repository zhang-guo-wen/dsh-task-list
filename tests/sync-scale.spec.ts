import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SYNC_LEASE_MS, SyncRunStore } from '../src/sync/run-store.ts'
import { executeItem } from '../src/sync/execute-item.ts'
import { SyncExecutor } from '../src/sync/executor.ts'
import type { CreateConnectionRequest, CreateSyncRuleRequest } from '../src/sync/dto.ts'
import type { Clock, ItemExecution, RemoteItem, RemoteKey, SyncAdapter, SyncPatch } from '../src/sync/types.ts'
import { remote } from './fixtures/sync.ts'

const roots: string[] = []
const closable: { close(): void }[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-scale-'))
  roots.push(root)
  return join(root, 'tasks.sqlite')
}
afterEach(() => {
  for (const handle of closable.splice(0)) { try { handle.close() } catch { /* already closed */ } }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const tapdInput: CreateConnectionRequest = { platform: 'yunxiao', name: '云效', mode: 'center', organizationId: 'org-1', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: false }
function ruleInput(connectionId: string): CreateSyncRuleRequest {
  return {
    connectionId, projectId: '20000001', workspaceId: null, enabled: false,
    conditions: [[{ field: 'workitemType', operator: 'EQUALS', value: ['story'] }]], statusWriteStates: { todo: 'open', in_progress: 'doing', done: 'done' },
  }
}

interface ControllableClock extends Clock { now(): number; advance(ms: number): Promise<void> }
function controllableClock(initial = 1_700_000_000_000): ControllableClock {
  let current = initial
  const pending: { at: number; resolve: () => void; reject: (e: unknown) => void }[] = []
  const abortError = () => new DOMException('The operation was aborted', 'AbortError')
  const clock: Clock = {
    now: () => current,
    sleep(ms: number, signal: AbortSignal): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (signal.aborted) { reject(abortError()); return }
        const entry: { at: number; resolve: () => void; reject: (e: unknown) => void } = { at: current + ms, resolve: () => {}, reject: () => {} }
        const onAbort = () => {
          const i = pending.indexOf(entry)
          if (i >= 0) pending.splice(i, 1)
          entry.reject(abortError())
        }
        entry.resolve = () => { signal.removeEventListener('abort', onAbort); resolve() }
        entry.reject = (e: unknown) => { signal.removeEventListener('abort', onAbort); reject(e) }
        signal.addEventListener('abort', onAbort, { once: true })
        pending.push(entry)
      })
    },
  }
  async function advance(ms: number): Promise<void> {
    const target = current + ms
    for (;;) {
      const due = pending.filter(e => e.at <= target).sort((a, b) => a.at - b.at)
      if (due.length === 0) break
      const next = due[0]!
      current = next.at
      const i = pending.indexOf(next)
      if (i >= 0) pending.splice(i, 1)
      next.resolve()
      await settle()
    }
    current = target
    await settle()
  }
  return { now: () => current, sleep: clock.sleep, advance }
}
function settle(): Promise<void> {
  return new Promise<void>(resolve => setImmediate(resolve))
}

/** Non-degenerate scale metrics: recorded as a JSON artifact, never asserted. */
const METRICS: Record<string, unknown>[] = []
function recordMetric(name: string, data: Record<string, unknown>): void {
  METRICS.push({ name, ...data })
}
afterAll(() => {
  const dir = join(process.cwd(), '.superpowers', 'sdd', '2026-10-07-project-management-sync')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'task-8-fix-2-metrics.json'), JSON.stringify(METRICS, null, 2) + '\n')
  // Compact stdout so the named run's metrics are visible without opening the JSON.
  for (const metric of METRICS) {
    const m = metric as { name?: string; elapsedMs?: number; reads?: number; writes?: number; heapUsedBefore?: number; heapUsedAfter?: number; discoverCalls?: number }
    const heapDelta = m.heapUsedBefore !== undefined && m.heapUsedAfter !== undefined ? m.heapUsedAfter - m.heapUsedBefore : undefined
    console.log(`[sync-scale] ${m.name ?? 'metric'} elapsed=${m.elapsedMs}ms reads=${m.reads ?? '-'} writes=${m.writes ?? '-'} heapDelta=${heapDelta ?? '-'} discover=${m.discoverCalls ?? '-'}`)
  }
})

interface FakeAdapter extends SyncAdapter {
  readCalls: RemoteKey[]
  writeCalls: { key: RemoteKey; patch: SyncPatch; observed: RemoteItem; rule: unknown }[]
  discoverCount: number
  setDiscover(batches: RemoteItem[][]): void
}
function fakeAdapter(items: Map<string, RemoteItem>): FakeAdapter {
  const readCalls: RemoteKey[] = []
  const writeCalls: FakeAdapter['writeCalls'] = []
  let discoverBatches: RemoteItem[][] = []
  let discoverCount = 0
  return {
    readCalls, writeCalls,
    get discoverCount() { return discoverCount },
    setDiscover(batches) { discoverBatches = batches },
    async metadata() { throw new Error('unused') },
    async *discover() { discoverCount += 1; for (const batch of discoverBatches) yield batch },
    async read(key) { readCalls.push(key); return items.get(key.id)! },
    async write(key, patch, observed, rule) {
      writeCalls.push({ key, patch, observed, rule })
      const item = items.get(key.id)
      if (item) {
        const fields: RemoteItem['fields'] = { ...item.fields }
        let rawStatus = item.rawStatus
        for (const field of Object.keys(patch) as (keyof SyncPatch)[]) {
          const value = patch[field]
          if (value === undefined) continue
          if (field === 'status') { fields.status = { presence: 'value', value: value as never, writable: true }; rawStatus = value as string }
          else fields[field] = { presence: 'value', value: value as never, writable: true }
        }
        items.set(key.id, { ...item, fields, rawStatus })
      }
    },
    async evidence() { return 'unknown' },
  }
}

function itemKey(id: string): RemoteKey {
  return { instance: 'api.tapd.cn', projectId: '20000001', typeId: 'story', id }
}

function buildRemote(id: string): RemoteItem {
  return { ...remote(), key: itemKey(id), number: id, fields: { ...remote().fields, title: { presence: 'value', value: `Task ${id}`, writable: true } } }
}

interface Setup {
  store: TaskStore
  db: DatabaseSync
  clock: ControllableClock
  config: SyncConfigStore
  rule: ReturnType<SyncConfigStore['createRule']>
  links: SyncLinkStore
  runs: SyncRunStore
  fence: { runId: string; ownerId: string; generation: number }
}

function setup(): Setup {
  const store = new TaskStore(fixture())
  closable.push(store)
  const db = store.db
  const clock = controllableClock()
  const config = new SyncConfigStore(db, () => ({}))
  const connection = config.createConnection(tapdInput)!
  const rule = config.createRule(ruleInput(connection.id))!
  const links = new SyncLinkStore(db, store, clock)
  const runs = new SyncRunStore(db, clock)
  const fence = runs.claimRun('owner-1', clock.now()).fence
  config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
  config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })
  return { store, db, clock, config, rule: config.getRule(rule.id)!, links, runs, fence }
}

function itemInput(s: Setup, key: RemoteKey, adapter: SyncAdapter): ItemExecution {
  return {
    fence: s.fence, rule: s.rule, key, tasks: s.store, config: s.config, links: s.links, runs: s.runs,
    adapter, clock: s.clock, signal: new AbortController().signal,
  }
}

describe('scale — bounded single-page processing', () => {
  it('syncs 1000 unchanged linked items with exactly 1000 reads and zero writes', async () => {
    const s = setup()
    const items = new Map<string, RemoteItem>()
    for (let i = 0; i < 1000; i += 1) {
      const item = buildRemote(`item-${i}`)
      items.set(item.key.id, item)
      s.links.importItem(item, s.rule, s.fence)
    }
    const adapter = fakeAdapter(items)
    await s.clock.advance(SYNC_LEASE_MS + 1)
    const executor = new SyncExecutor({
      tasks: s.store, config: s.config, links: s.links, runs: s.runs, adapterFactory: () => adapter, clock: s.clock,
    })
    const before = process.memoryUsage().heapUsed
    const started = Date.now()
    const { runId } = executor.start()
    await executor.done()
    const elapsed = Date.now() - started
    const after = process.memoryUsage().heapUsed
    const run = s.runs.getRun(runId)!
    expect(run.status).toBe('completed')
    expect(run.counts.unchanged).toBe(1000)
    expect(adapter.writeCalls).toHaveLength(0)
    expect(adapter.readCalls).toHaveLength(1000)
    expect(s.db.prepare('SELECT COUNT(*) AS c FROM sync_seen_keys').get().c).toBe(1000)
    // elapsed/heap are recorded, never asserted (no fake p99 / threshold)
    recordMetric('1k-unchanged-linked', { elapsedMs: elapsed, heapUsedBefore: before, heapUsedAfter: after, reads: adapter.readCalls.length, writes: adapter.writeCalls.length })
  }, 30_000)

  it('discovers a 10k detail stream in bounded pages and dedups via SQLite', async () => {
    const s = setup()
    const items = new Map<string, RemoteItem>()
    const batches: RemoteItem[][] = []
    const pageSize = 200
    for (let i = 0; i < 10_000; i += 1) {
      const item = buildRemote(`big-${i}`)
      items.set(item.key.id, item)
      const batchIndex = Math.floor(i / pageSize)
      if (batches[batchIndex] === undefined) batches[batchIndex] = []
      batches[batchIndex]!.push(item)
    }
    const adapter = fakeAdapter(items)
    adapter.setDiscover(batches)
    await s.clock.advance(SYNC_LEASE_MS + 1)
    const executor = new SyncExecutor({
      tasks: s.store, config: s.config, links: s.links, runs: s.runs, adapterFactory: () => adapter, clock: s.clock,
    })
    const before = process.memoryUsage().heapUsed
    const started = Date.now()
    const { runId } = executor.start()
    await executor.done()
    const elapsed = Date.now() - started
    const after = process.memoryUsage().heapUsed
    const run = s.runs.getRun(runId)!
    expect(run.status).toBe('completed')
    expect(run.counts.imported).toBe(10_000)
    expect(adapter.readCalls).toHaveLength(10_000)
    expect(adapter.writeCalls).toHaveLength(0)
    expect(adapter.discoverCount).toBe(1)
    expect(s.db.prepare('SELECT COUNT(*) AS c FROM sync_seen_keys').get().c).toBe(10_000)
    for (const batch of batches) expect(batch.length).toBeLessThanOrEqual(200)
    recordMetric('10k-detail-stream', { elapsedMs: elapsed, heapUsedBefore: before, heapUsedAfter: after, reads: adapter.readCalls.length, writes: adapter.writeCalls.length, discoverCalls: adapter.discoverCount })
  }, 180_000)

  it('performs no remote write when storage is busy during intent preparation', async () => {
    const s = setup()
    const item = buildRemote('faulty')
    const task = s.links.importItem(item, s.rule, s.fence)
    // Only a status change enters the write path; that is what this fault targets.
    s.store.update({ id: task.id, version: task.version, status: 'done' })
    const adapter = fakeAdapter(new Map([[item.key.id, buildRemote('faulty')]]))
    s.db.exec(`CREATE TRIGGER fail_intent BEFORE INSERT ON sync_write_intents BEGIN SELECT RAISE(ABORT, 'busy'); END;`)
    const result = await executeItem(itemInput(s, item.key, adapter))
    expect(result.category).toBe('failed')
    expect(adapter.writeCalls).toHaveLength(0)
  })

  it('performs no remote write when storage fails at finalize', async () => {
    const s = setup()
    const item = buildRemote('finalize-faulty')
    const task = s.links.importItem(item, s.rule, s.fence)
    s.store.update({ id: task.id, version: task.version, status: 'done' })
    const adapter = fakeAdapter(new Map([[item.key.id, buildRemote('finalize-faulty')]]))
    s.db.exec(`CREATE TRIGGER fail_baseline BEFORE INSERT ON sync_baselines BEGIN SELECT RAISE(ABORT, 'busy'); END;`)
    const result = await executeItem(itemInput(s, item.key, adapter))
    expect(result.category).toBe('failed')
    // the write landed once and is not retried; the intent stays for reconciliation
    expect(adapter.writeCalls).toHaveLength(1)
    expect(s.links.getPending(item.key)?.phase).toBe('dispatched')
    // the unresolved intent must be counted pending, not merely failed (M7)
    const run = s.runs.getRun(s.fence.runId)!
    expect(run.counts.failed).toBe(1)
    expect(run.counts.pending).toBe(1)
  })
})
