import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SYNC_LEASE_MS, SyncRunStore } from '../src/sync/run-store.ts'
import { executeItem } from '../src/sync/execute-item.ts'
import { SyncExecutor } from '../src/sync/executor.ts'
import { syncError, syncRemoteError } from '../src/sync/errors.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, SafeConnection, SafeItemResult, SyncErrorDto,
} from '../src/sync/dto.ts'
import type {
  Clock, ItemExecution, RemoteItem, RemoteKey, RunFence, SyncAdapter, SyncPatch, SyncRule, WriteEvidence, WriteIntent,
} from '../src/sync/types.ts'
import type { TaskRecord, TaskStatus } from '../src/types.ts'
import { remote } from './fixtures/sync.ts'
import { textContent } from '../src/content.ts'

const roots: string[] = []
const closable: { close(): void }[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-executor-'))
  roots.push(root)
  return join(root, 'tasks.sqlite')
}
afterEach(() => {
  for (const handle of closable.splice(0)) { try { handle.close() } catch { /* already closed */ } }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const tapdInput: CreateConnectionRequest = { platform: 'tapd', name: 'TAPD', companyId: '20000001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', enabled: false }

function ruleInput(connectionId: string, projectId = '20000001'): CreateSyncRuleRequest {
  return {
    connectionId, projectId, workspaceId: null, enabled: false,
    filters: { assignees: [], typeIds: ['story'], iterationIds: [], statusIds: [] },
    mappings: [{
      typeId: 'story', category: 'story',
      readStates: { open: 'todo', doing: 'in_progress', done: 'done' },
      writeStates: { todo: 'open', in_progress: 'doing', done: 'done' },
      optionalFields: [], fieldIds: { title: 'name', status: 'status' }, valueMaps: {},
    }],
  }
}

/** Controllable clock with real pending timers so the concurrent heartbeat loop
 * can be advanced deterministically without busy-spinning on a no-op sleep. */
interface ControllableClock extends Clock {
  now(): number
  advance(ms: number): Promise<void>
  activeSleeps(): number
}
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
  return { now: () => current, sleep: clock.sleep, advance, activeSleeps: () => pending.length }
}
function settle(): Promise<void> {
  return new Promise<void>(resolve => setImmediate(resolve))
}

interface Setup {
  store: TaskStore
  db: DatabaseSync
  clock: ControllableClock
  config: SyncConfigStore
  connection: SafeConnection
  rule: SyncRule
  links: SyncLinkStore
  runs: SyncRunStore
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
  config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
  config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })
  return { store, db, clock, config, connection: config.getConnection(connection.id)!, rule: config.getRule(rule.id)!, links, runs }
}

function fenceFor(s: Setup): RunFence {
  return s.runs.claimRun('owner-1', s.clock.now()).fence
}

// --- controllable stateful fake adapter (no network; write applies the patch) ---

interface FakeAdapter extends SyncAdapter {
  readCalls: RemoteKey[]
  writeCalls: { key: RemoteKey; patch: SyncPatch; observed: RemoteItem; rule: SyncRule }[]
  evidenceCalls: WriteIntent[]
  discoverCount: number
  setDiscover(batches: RemoteItem[][]): void
  setDiscoverError(err: Error | null): void
  setCurrent(items: RemoteItem[]): void
  setWriteError(err: Error | null): void
  setReadError(err: Error | null): void
  setEvidence(value: WriteEvidence): void
  onRead?: (key: RemoteKey) => void
}
function fakeAdapter(): FakeAdapter {
  const readCalls: RemoteKey[] = []
  const writeCalls: FakeAdapter['writeCalls'] = []
  const evidenceCalls: WriteIntent[] = []
  let discoverBatches: RemoteItem[][] = []
  let discoverError: Error | null = null
  let current = new Map<string, RemoteItem>()
  let writeError: Error | null = null
  let readError: Error | null = null
  let evidenceValue: WriteEvidence = 'unknown'
  let discoverCount = 0
  const adapter: FakeAdapter = {
    readCalls, writeCalls, evidenceCalls,
    get discoverCount() { return discoverCount },
    setDiscover(batches) { discoverBatches = batches },
    setDiscoverError(err) { discoverError = err },
    setCurrent(items) { current = new Map(items.map(item => [item.key.id, item])) },
    setWriteError(err) { writeError = err },
    setReadError(err) { readError = err },
    setEvidence(value) { evidenceValue = value },
    async metadata() { throw new Error('unused') },
    async *discover() { discoverCount += 1; if (discoverError) throw discoverError; for (const batch of discoverBatches) yield batch },
    async read(key, _rule, _signal) {
      readCalls.push(key)
      adapter.onRead?.(key)
      if (readError) throw readError
      const item = current.get(key.id)
      if (!item) throw new Error(`no item ${key.id}`)
      return item
    },
    async write(key, patch, observed, rule, _signal) {
      writeCalls.push({ key, patch, observed, rule })
      if (writeError) throw writeError
      const item = current.get(key.id)
      if (item) {
        const fields: RemoteItem['fields'] = { ...item.fields }
        let rawStatus = item.rawStatus
        for (const field of Object.keys(patch) as (keyof SyncPatch)[]) {
          const value = patch[field]
          if (value === undefined) continue
          if (field === 'status') { fields.status = { presence: 'value', value: value as TaskStatus, writable: true }; rawStatus = value as string }
          else fields[field] = { presence: 'value', value: value as never, writable: true }
        }
        current.set(key.id, { ...item, fields, rawStatus })
      }
    },
    async evidence(intent, _observed, _signal) { evidenceCalls.push(intent); return evidenceValue },
  }
  return adapter
}

function itemInput(s: Setup, fence: RunFence, key: RemoteKey, adapter: SyncAdapter, overrides: Partial<ItemExecution> = {}): ItemExecution {
  return {
    fence, rule: s.rule, key, tasks: s.store, config: s.config, links: s.links, runs: s.runs,
    adapter, clock: s.clock, signal: new AbortController().signal, ...overrides,
  }
}

function executorFor(s: Setup, adapter: SyncAdapter): SyncExecutor {
  return new SyncExecutor({
    tasks: s.store, config: s.config, links: s.links, runs: s.runs,
    adapterFactory: () => adapter, clock: s.clock,
  })
}

function changedTitle(item: RemoteItem, title: string): RemoteItem {
  return { ...item, fields: { ...item.fields, title: { presence: 'value', value: title, writable: true } } }
}

describe('executeItem — five branches', () => {
  it('imports a discovered remote item into a new task, link and baseline', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    adapter.setCurrent([item])
    const result = await executeItem(itemInput(s, fenceFor(s), item.key, adapter))
    expect(result.category).toBe('imported')
    expect(result.taskId).toBeTruthy()
    expect(result.writtenBack).toBe(false)
    expect(result.outsideFilter).toBe(false)
    const link = s.links.getLink(item.key)!
    expect(link.taskId).toBe(result.taskId)
    expect(link.baseline).not.toBeNull()
    expect(s.store.get(result.taskId!)?.title).toBe('Remote task')
    expect(adapter.writeCalls).toHaveLength(0)
  })

  it('reports unchanged for a linked item whose sides match the baseline, with no write', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    adapter.setCurrent([item])
    const task = s.links.importItem(item, s.rule, fence)
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('unchanged')
    expect(result.taskId).toBe(task.id)
    expect(adapter.writeCalls).toHaveLength(0)
  })

  it('pulls a remote-only change into the local task without writing back', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    adapter.setCurrent([changedTitle(item, 'Remote edited')])
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('pulled')
    expect(result.writtenBack).toBe(false)
    expect(s.store.get(task.id)?.title).toBe('Remote edited')
    expect(adapter.writeCalls).toHaveLength(0)
  })

  it('pushes a local-only change to the remote and marks writtenBack', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    const edited = s.store.update({ id: task.id, version: task.version, title: 'Local edited' })
    adapter.setCurrent([item])
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('pushed')
    expect(result.writtenBack).toBe(true)
    expect(adapter.writeCalls).toHaveLength(1)
    expect(adapter.writeCalls[0]?.patch).toEqual({ title: 'Local edited' })
    expect(s.store.get(edited.id)?.version).toBe(edited.version)
  })

  it('merges both-side changes: remote description wins locally, local status is written back', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    const locallyEdited = s.store.update({ id: task.id, version: task.version, status: 'done' })
    adapter.setCurrent([changedTitle(item, 'Remote title edit')])
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('merged')
    expect(result.writtenBack).toBe(true)
    expect(s.store.get(locallyEdited.id)?.title).toBe('Remote title edit')
    expect(s.store.get(locallyEdited.id)?.status).toBe('done')
    expect(adapter.writeCalls).toHaveLength(1)
    expect(adapter.writeCalls[0]?.patch).toEqual({ status: 'done' })
  })
})

describe('executeItem — durable intent and write verification', () => {
  it('persists a durable intent before the write and finalizes atomically after write-set readback', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    s.store.update({ id: task.id, version: task.version, title: 'Local edit' })
    adapter.setCurrent([item])
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('pushed')
    const link = s.links.getLink(item.key)!
    const intent = s.db.prepare('SELECT phase FROM sync_write_intents WHERE link_id = ?').get(link.id) as { phase: string }
    expect(intent.phase).toBe('confirmed')
    expect(link.baseline?.remote.title).toBe('Local edit')
    expect(s.runs.listItemResults(fence.runId).total).toBe(1)
  })

  it('records an uncertain write as unknown/pending and does not confirm', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    s.store.update({ id: task.id, version: task.version, title: 'Local edit' })
    adapter.setCurrent([item])
    adapter.setWriteError(syncError('WriteOutcomeUnknown') as unknown as Error)
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('failed')
    expect(result.error?.code).toBe('WriteOutcomeUnknown')
    expect(s.links.getPending(item.key)?.phase).toBe('unknown')
    const run = s.runs.getRun(fence.runId)!
    expect(run.counts.failed).toBe(1)
    expect(run.counts.pending).toBe(1)
  })

  it('does not write when a concurrent local edit lands before dispatch (generation check)', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    s.store.update({ id: task.id, version: task.version, title: 'Local edit' })
    adapter.setCurrent([item])
    let reads = 0
    adapter.onRead = () => {
      if (reads === 1) {
        const t = s.store.get(task.id)!
        s.store.update({ id: t.id, version: t.version, title: 'Concurrent edit' })
      }
      reads += 1
    }
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('failed')
    expect(result.error?.code).toBe('LocalVersionConflict')
    expect(adapter.writeCalls).toHaveLength(0)
  })
})

describe('executeItem — enabled gating and storage safety', () => {
  it('returns a failed result and performs no request when the rule is disabled', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    s.config.updateRule({ id: s.rule.id, revision: s.rule.revision, enabled: false })
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('failed')
    expect(result.error?.code).toBe('InvalidConfig')
    expect(adapter.readCalls).toHaveLength(0)
    expect(adapter.writeCalls).toHaveLength(0)
    expect(s.store.get(task.id)?.title).toBe('Remote task')
  })

  it('does not send a remote write when storage fails during intent preparation', async () => {
    const s = setup()
    const fence = fenceFor(s)
    const item = remote()
    const adapter = fakeAdapter()
    const task = s.links.importItem(item, s.rule, fence)
    s.store.update({ id: task.id, version: task.version, title: 'Local edit' })
    adapter.setCurrent([item])
    s.db.exec(`CREATE TRIGGER fail_intent BEFORE INSERT ON sync_write_intents BEGIN SELECT RAISE(ABORT, 'injected'); END;`)
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('failed')
    expect(adapter.writeCalls).toHaveLength(0)
  })
})

describe('SyncExecutor — orchestration', () => {
  it('imports a discovered item and finishes a completed run with exclusive counts', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    adapter.setDiscover([[item]])
    adapter.setCurrent([item])
    const executor = executorFor(s, adapter)
    const { runId, existing } = executor.start()
    expect(existing).toBe(false)
    await executor.done()
    const run = s.runs.getRun(runId)!
    expect(run.status).toBe('completed')
    expect(run.discoveryComplete).toBe(true)
    expect(run.counts).toMatchObject({ imported: 1, pulled: 0, pushed: 0, merged: 0, unchanged: 0, failed: 0, pending: 0 })
    expect(adapter.discoverCount).toBe(1)
  })

  it('returns the existing run id without starting work or heartbeating when already owned', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const executor = executorFor(s, adapter)
    const first = executor.start()
    expect(first.existing).toBe(false)
    const second = executor.start()
    expect(second.runId).toBe(first.runId)
    expect(second.existing).toBe(true)
    await executor.done()
    expect(adapter.discoverCount).toBe(1)
  })

  it('processes out-of-filter linked items with outsideFilter even when discovery is empty', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    const fence = fenceFor(s)
    s.links.importItem(item, s.rule, fence)
    adapter.setDiscover([[]])
    adapter.setCurrent([changedTitle(item, 'Remote edited')])
    await s.clock.advance(SYNC_LEASE_MS + 1)
    const executor = executorFor(s, adapter)
    const { runId } = executor.start()
    await executor.done()
    const results = s.runs.listItemResults(runId).items
    expect(results).toHaveLength(1)
    expect(results[0]?.category).toBe('pulled')
    expect(results[0]?.outsideFilter).toBe(true)
  })

  it('does not request a standalone (unlinked) local task during a sync', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    s.store.create({ title: 'Standalone task' })
    adapter.setDiscover([[]])
    const executor = executorFor(s, adapter)
    executor.start()
    await executor.done()
    expect(adapter.readCalls).toHaveLength(0)
    expect(adapter.writeCalls).toHaveLength(0)
  })

  it('reports discovery error (not zero items) and still syncs existing links', async () => {
    const s = setup()
    const item = remote()
    const fence = fenceFor(s)
    s.links.importItem(item, s.rule, fence)
    const broken = fakeAdapter()
    broken.setDiscoverError(syncError('IncompleteDiscovery') as unknown as Error)
    broken.setCurrent([changedTitle(item, 'Remote edited')])
    await s.clock.advance(SYNC_LEASE_MS + 1)
    const executor = executorFor(s, broken)
    const { runId } = executor.start()
    await executor.done()
    const run = s.runs.getRun(runId)!
    expect(run.status).toBe('partial')
    expect(run.discoveryComplete).toBe(false)
    expect(run.unprocessedKnown).toBeNull()
    expect(run.errors.some(e => e.code === 'IncompleteDiscovery')).toBe(true)
    // the existing link is still synced despite the discovery failure
    expect(s.runs.listItemResults(runId).items[0]?.category).toBe('pulled')
  })

  it('stops a connection on AuthDenied and continues other connections', async () => {
    const s = setup()
    const secondConn = s.config.createConnection({ ...tapdInput, name: 'TAPD 2', companyId: '20000002', userEnv: 'OTHER_USER', passwordEnv: 'OTHER_PASS' })
    s.config.updateConnection({ id: secondConn.id, revision: secondConn.revision, enabled: true })
    const secondRule = s.config.createRule(ruleInput(secondConn.id, '20000002'))
    s.config.updateRule({ id: secondRule.id, revision: secondRule.revision, enabled: true })

    const itemA = remote()
    const itemB = remote({ key: { ...remote().key, projectId: '20000002', id: 'item-b' } })

    const authDenied = fakeAdapter()
    authDenied.setDiscover([[itemA]])
    authDenied.setReadError(syncError('AuthDenied') as unknown as Error)

    const healthy = fakeAdapter()
    healthy.setDiscover([[itemB]])
    healthy.setCurrent([itemB])

    const adapters = new Map([['20000001', authDenied], ['20000002', healthy]])
    const executor = new SyncExecutor({
      tasks: s.store, config: s.config, links: s.links, runs: s.runs,
      adapterFactory: (conn) => adapters.get(conn.instance)!,
      clock: s.clock,
    })
    const { runId } = executor.start()
    await executor.done()
    const run = s.runs.getRun(runId)!
    expect(run.counts.imported).toBe(1)
    expect(run.errors.some(e => e.code === 'AuthDenied')).toBe(true)
    expect(healthy.readCalls).toHaveLength(1)
  })

  it('stops at the 30-minute budget and reports partial', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    adapter.setDiscover([[item]])
    adapter.setCurrent([item])
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const originalRead = adapter.read
    adapter.read = async (key, rule, signal) => {
      await gate
      return originalRead(key, rule, signal)
    }
    const executor = executorFor(s, adapter)
    const { runId } = executor.start()
    // Advance past the 30-minute budget while the concurrent heartbeat loop keeps
    // the lease valid; the run must still cut over to a partial result.
    for (let i = 0; i < 181; i += 1) {
      await s.clock.advance(10_000)
    }
    release()
    await executor.done()
    const run = s.runs.getRun(runId)!
    expect(run.status).toBe('partial')
    expect(run.discoveryComplete).toBe(false)
  })
})

describe('SyncExecutor — pending write reconciliation', () => {
  it('probes an unknown pending intent without an ordinary write', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    const fence = fenceFor(s)
    const task = s.links.importItem(item, s.rule, fence)
    const link = s.links.getLink(item.key)!
    const plan = { kind: 'push' as const, localPatch: {} as SyncPatch, remotePatch: { title: 'Pushed' } as SyncPatch, selectedFields: ['title'] as const }
    const intent = s.links.prepareIntent({ fence, link, task, observed: item, rule: s.rule, plan })
    s.links.markDispatched(intent.id, fence)
    s.links.recordUnknown(intent.id, fence, syncError('WriteOutcomeUnknown'))
    adapter.setCurrent([changedTitle(item, 'Pushed')])
    await s.clock.advance(SYNC_LEASE_MS + 1)
    const executor = executorFor(s, adapter)
    const { runId } = executor.start()
    await executor.done()
    expect(adapter.writeCalls).toHaveLength(0)
    expect(s.links.getPending(item.key)).toBeNull()
    const run = s.runs.getRun(runId)!
    expect(run.counts.pushed).toBe(1)
  })
})

describe('executeItem — pending blocks ordinary writeback', () => {
  it('does not perform an ordinary write when a pending intent already exists', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const fence = fenceFor(s)
    const task = s.links.importItem(item, s.rule, fence)
    const link = s.links.getLink(item.key)!
    const plan = { kind: 'push' as const, localPatch: {} as SyncPatch, remotePatch: { title: 'Pushed' } as SyncPatch, selectedFields: ['title'] as const }
    const intent = s.links.prepareIntent({ fence, link, task, observed: item, rule: s.rule, plan })
    s.links.markDispatched(intent.id, fence)
    s.links.recordUnknown(intent.id, fence, syncError('WriteOutcomeUnknown'))
    adapter.setCurrent([item])
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('failed')
    expect(adapter.writeCalls).toHaveLength(0)
    expect(s.links.getPending(item.key)?.phase).toBe('unknown')
  })
})

describe('executeItem — recovery semantics', () => {
  it('recovery acknowledges only the old write-set and retains independent remote changes for both-change merging', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const oldFence = fenceFor(s)
    const task = s.links.importItem(item, s.rule, oldFence)
    const link = s.links.getLink(item.key)!
    const plan = { kind: 'push' as const, localPatch: {} as SyncPatch, remotePatch: { title: 'Old push' } as SyncPatch, selectedFields: ['title'] as const }
    const intent = s.links.prepareIntent({ fence: oldFence, link, task, observed: item, rule: s.rule, plan })
    s.links.markDispatched(intent.id, oldFence)
    s.links.recordUnknown(intent.id, oldFence, syncError('WriteOutcomeUnknown'))
    s.store.update({ id: task.id, version: task.version, title: 'New local edit' })
    const changed = changedTitle(item, 'Old push')
    adapter.setCurrent([{ ...changed, fields: { ...changed.fields, description: { presence: 'value', value: textContent('New remote description'), writable: true } }, description: { format: 'text', raw: { presence: 'value', value: 'New remote description', writable: true }, roundTrip: true } }])
    await s.clock.advance(SYNC_LEASE_MS + 1)
    const next = s.runs.claimRun('owner-2', s.clock.now()).fence
    const result = await executeItem(itemInput(s, next, item.key, adapter))
    expect(result.category).toBe('merged')
    expect(s.store.get(task.id)?.title).toBe('Old push')
    expect(s.store.get(task.id)?.notes).toBe('New remote description')
    expect(adapter.writeCalls).toHaveLength(0)
  })
  it('keeps the new local edit and full remote observation when an old write was applied before a new edit', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const oldFence = fenceFor(s)
    const task = s.links.importItem(item, s.rule, oldFence)
    const link = s.links.getLink(item.key)!
    const plan = { kind: 'push' as const, localPatch: {} as SyncPatch, remotePatch: { title: 'Old push' } as SyncPatch, selectedFields: ['title'] as const }
    const intent = s.links.prepareIntent({ fence: oldFence, link, task, observed: item, rule: s.rule, plan })
    s.links.markDispatched(intent.id, oldFence)
    s.links.recordUnknown(intent.id, oldFence, syncError('WriteOutcomeUnknown'))
    const newLocal = s.store.update({ id: task.id, version: task.version, title: 'New local edit' })
    adapter.setCurrent([changedTitle(item, 'Old push')])
    await s.clock.advance(SYNC_LEASE_MS + 1)
    const newFence = s.runs.claimRun('owner-2', s.clock.now()).fence
    const result = await executeItem(itemInput(s, newFence, item.key, adapter))
    expect(result.taskId).toBe(newLocal.id)
    expect(s.store.get(newLocal.id)?.title).toBe('New local edit')
    expect(s.links.getPending(item.key)).toBeNull()
    // exactly one write, and it is the NEW edit only — the old push is never replayed
    expect(adapter.writeCalls).toHaveLength(1)
    expect(adapter.writeCalls[0]?.patch.title).toBe('New local edit')
    expect(adapter.writeCalls.some(c => c.patch.title === 'Old push')).toBe(false)
  })
})

describe('executeItem — same-run ack and per-request gate', () => {
  it('acknowledges a same-run confirmed write so the next run is unchanged (no duplicate patch)', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const fence = fenceFor(s)
    const task = s.links.importItem(item, s.rule, fence)
    const link = s.links.getLink(item.key)!
    const plan = { kind: 'push' as const, localPatch: {} as SyncPatch, remotePatch: { title: 'Pushed' } as SyncPatch, selectedFields: ['title'] as const }
    const intent = s.links.prepareIntent({ fence, link, task, observed: item, rule: s.rule, plan })
    s.links.markDispatched(intent.id, fence)
    s.links.recordUnknown(intent.id, fence, syncError('WriteOutcomeUnknown'))
    adapter.setCurrent([changedTitle(item, 'Pushed')])
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('pushed')
    expect(s.links.getPending(item.key)).toBeNull()

    await s.clock.advance(SYNC_LEASE_MS + 1)
    const newFence = s.runs.claimRun('owner-2', s.clock.now()).fence
    const adapter2 = fakeAdapter()
    adapter2.setCurrent([changedTitle(item, 'Pushed')])
    const result2 = await executeItem(itemInput(s, newFence, item.key, adapter2))
    expect(result2.category).toBe('unchanged')
    expect(adapter2.writeCalls).toHaveLength(0)
  })

  it('cancels a definitively rejected write (WorkflowRejected) out of the pending set', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const fence = fenceFor(s)
    const task = s.links.importItem(item, s.rule, fence)
    s.store.update({ id: task.id, version: task.version, title: 'Local edit' })
    adapter.setCurrent([item])
    adapter.setWriteError(syncError('WorkflowRejected') as unknown as Error)
    const result = await executeItem(itemInput(s, fence, item.key, adapter))
    expect(result.category).toBe('failed')
    expect(result.error?.code).toBe('WorkflowRejected')
    expect(adapter.writeCalls).toHaveLength(1)
    expect(s.links.getPending(item.key)).toBeNull()
    const row = s.db.prepare('SELECT phase FROM sync_write_intents WHERE link_id = ?').get(s.links.getLink(item.key)!.id) as { phase: string }
    expect(row.phase).toBe('cancelled')
  })

  it('blocks the first adapter call when the injected beforeRequest gate throws', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const fence = fenceFor(s)
    s.links.importItem(item, s.rule, fence)
    adapter.setCurrent([item])
    const beforeRequest = () => { throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'enabled' })) }
    const result = await executeItem(itemInput(s, fence, item.key, adapter, { beforeRequest }))
    expect(result.category).toBe('failed')
    expect(result.error?.code).toBe('InvalidConfig')
    expect(adapter.readCalls).toHaveLength(0)
    expect(adapter.writeCalls).toHaveLength(0)
  })
})

describe('SyncExecutor — concurrent heartbeat and stop', () => {
  it('heartbeats during a long read so a 120s wait keeps the lease valid', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    adapter.setDiscover([[item]])
    adapter.setCurrent([item])
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const originalRead = adapter.read
    adapter.read = async (key, rule, signal) => { await gate; return originalRead(key, rule, signal) }
    const executor = executorFor(s, adapter)
    const { runId } = executor.start()
    for (let i = 0; i < 12; i += 1) { await s.clock.advance(10_000) }
    release()
    await executor.done()
    const run = s.runs.getRun(runId)!
    expect(run.status).toBe('completed')
    expect(run.counts.imported).toBe(1)
  })

  it('stop() marks the owned run interrupted and releases the lock', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    adapter.setDiscover([[item]])
    adapter.setCurrent([item])
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const originalRead = adapter.read
    adapter.read = async (key, rule, signal) => { await gate; return originalRead(key, rule, signal) }
    const executor = executorFor(s, adapter)
    const { runId } = executor.start()
    await s.clock.advance(5_000)
    const stopped = executor.stop()
    release()
    await stopped
    const run = s.runs.getRun(runId)!
    expect(run.status).toBe('interrupted')
    expect(run.finishedAt).not.toBeNull()
    expect((s.db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(0)
  })

  it('an observer stop does not revoke the actual owner', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    adapter.setDiscover([[item]])
    adapter.setCurrent([item])
    const executor = executorFor(s, adapter)
    const first = executor.start()
    const observer = executorFor(s, adapter)
    const second = observer.start()
    expect(second.existing).toBe(true)
    await observer.stop()
    // the observer must not have revoked the first executor's live lock
    expect((s.db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(1)
    expect(s.runs.getRun(first.runId)?.status).toBe('running')
    await executor.done()
  })
})

describe('executeItem — abort classification', () => {
  it('maps a mid-read abort to RunInterrupted, never UnexpectedFailure', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const fence = fenceFor(s)
    s.links.importItem(item, s.rule, fence)
    adapter.setCurrent([item])
    adapter.setReadError(new DOMException('aborted', 'AbortError'))
    const err = await executeItem(itemInput(s, fence, item.key, adapter)).then(
      () => { throw new Error('expected rejection') },
      (e: unknown) => e,
    )
    expect((err as { code?: string }).code).toBe('task-list/sync')
    expect((err as { details?: { code?: string } }).details?.code).toBe('RunInterrupted')
  })

  it('leaves a dispatched intent pending (never cancelled) when the write is aborted mid-flight', async () => {
    const s = setup()
    const item = remote()
    const adapter = fakeAdapter()
    const fence = fenceFor(s)
    const task = s.links.importItem(item, s.rule, fence)
    s.store.update({ id: task.id, version: task.version, title: 'Local edit' })
    adapter.setCurrent([item])
    adapter.setWriteError(new DOMException('aborted', 'AbortError'))
    const err = await executeItem(itemInput(s, fence, item.key, adapter)).then(
      () => { throw new Error('expected rejection') },
      (e: unknown) => e,
    )
    expect((err as { code?: string }).code).toBe('task-list/sync')
    expect((err as { details?: { code?: string } }).details?.code).toBe('RunInterrupted')
    // the write may or may not have landed: the intent stays unresolved, not cancelled
    const pending = s.links.getPending(item.key)
    expect(pending).not.toBeNull()
    expect(pending?.phase).toBe('dispatched')
  })
})

describe('SyncExecutor — completion releases the lock', () => {
  it('releases the lock on normal completion and the same executor restarts and pushes a new edit', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    adapter.setDiscover([[item]])
    adapter.setCurrent([item])
    const executor = executorFor(s, adapter)
    const first = executor.start()
    expect(first.existing).toBe(false)
    await executor.done()
    expect((s.db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(0)
    expect(s.runs.getRun(first.runId)?.status).toBe('completed')

    // a new local edit made after the first run must be pushed by the next run, with no 90s wait
    const taskId = s.links.getLink(item.key)!.taskId!
    s.store.update({ id: taskId, version: s.store.get(taskId)!.version, title: 'Second edit' })
    adapter.writeCalls.length = 0

    const second = executor.start()
    expect(second.existing).toBe(false)
    expect(second.runId).not.toBe(first.runId)
    await executor.done()
    expect(adapter.writeCalls).toHaveLength(1)
    expect(adapter.writeCalls[0]?.patch).toEqual({ title: 'Second edit' })
    expect(s.runs.getRun(second.runId)?.status).toBe('completed')
    expect((s.db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(0)
  })

  it('a second executor claims a fresh run after the first completes', async () => {
    const s = setup()
    const adapter = fakeAdapter()
    const item = remote()
    adapter.setDiscover([[item]])
    adapter.setCurrent([item])
    const executor = executorFor(s, adapter)
    const first = executor.start()
    await executor.done()
    expect((s.db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(0)

    const observer = executorFor(s, adapter)
    const second = observer.start()
    expect(second.existing).toBe(false)
    expect(second.runId).not.toBe(first.runId)
    await observer.done()
    expect((s.db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(0)
  })
})
