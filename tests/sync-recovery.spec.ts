import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SYNC_LEASE_MS, SyncRunStore } from '../src/sync/run-store.ts'
import { reconcileIntent } from '../src/sync/reconcile.ts'
import { syncError } from '../src/sync/errors.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, SafeConnection, SafeItemResult, SyncErrorCode,
} from '../src/sync/dto.ts'
import type {
  Clock, RemoteItem, RemoteKey, RunFence, SyncAdapter, SyncPlan, SyncRule, WriteEvidence, WriteIntent,
} from '../src/sync/types.ts'
import type { TaskStatus } from '../src/types.ts'
import { baseline, remote, rule as ruleFixture } from './fixtures/sync.ts'

const roots: string[] = []
const closable: { close(): void }[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-recovery-'))
  roots.push(root)
  return join(root, 'tasks.sqlite')
}
afterEach(() => {
  for (const handle of closable.splice(0)) { try { handle.close() } catch { /* already closed */ } }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const tapdInput: CreateConnectionRequest = { platform: 'tapd', name: 'TAPD', companyId: '20000001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', enabled: false }

function ruleInput(connectionId: string): CreateSyncRuleRequest {
  return {
    connectionId, projectId: '20000001', workspaceId: null, enabled: false,
    filters: { assignees: [], typeIds: ['story'], iterationIds: [], statusIds: [] },
    mappings: [{
      typeId: 'story', category: 'story',
      readStates: { open: 'todo', doing: 'in_progress', done: 'done' },
      writeStates: { todo: 'open', in_progress: 'doing', done: 'done' },
      optionalFields: [], fieldIds: { title: 'name', status: 'status' }, valueMaps: {},
    }],
  }
}

interface FakeClock extends Clock {
  now(): number
  advance(ms: number): void
}
function fakeClock(initial = 1_700_000_000_000): FakeClock {
  let now = initial
  return { now: () => now, sleep: async () => {}, advance: (ms) => { now += ms } }
}

const pushPlan: SyncPlan = { kind: 'push', localPatch: {}, remotePatch: { title: 'Pushed title' }, selectedFields: ['title'] }
function pushedResult(key: RemoteKey, taskId: string | null): SafeItemResult {
  return { key, taskId, category: 'pushed', changedFields: ['title'], discardedFields: [], writtenBack: true, outsideFilter: false, error: null }
}

function expectSyncError(fn: () => unknown, code: SyncErrorCode): void {
  try {
    fn()
  } catch (error) {
    expect((error as { code?: string }).code).toBe('task-list/sync')
    expect((error as { details?: { code?: string } }).details?.code).toBe(code)
    return
  }
  throw new Error(`expected sync error ${code}`)
}

async function expectSyncErrorAsync(promise: Promise<unknown>, code: SyncErrorCode): Promise<void> {
  try {
    await promise
  } catch (error) {
    expect((error as { code?: string }).code).toBe('task-list/sync')
    expect((error as { details?: { code?: string } }).details?.code).toBe(code)
    return
  }
  throw new Error(`expected sync error ${code}`)
}

interface Setup {
  store: TaskStore
  db: DatabaseSync
  clock: FakeClock
  fence: RunFence
  rule: SyncRule
  connection: SafeConnection
  config: SyncConfigStore
  links: SyncLinkStore
  runs: SyncRunStore
}

function setup(): Setup {
  const store = new TaskStore(fixture())
  closable.push(store)
  const db = store.db
  const clock = fakeClock()
  const config = new SyncConfigStore(db, () => ({}))
  const connection = config.createConnection(tapdInput)!
  const rule = config.createRule(ruleInput(connection.id))!
  const links = new SyncLinkStore(db, store, clock)
  const runs = new SyncRunStore(db, clock)
  const fence = runs.claimRun('owner-1', clock.now()).fence
  return { store, db, clock, fence, rule, connection, config, links, runs }
}

function observedStatus(status: TaskStatus, title = 'Remote task'): RemoteItem {
  const base = remote()
  return {
    ...base,
    fields: {
      ...base.fields,
      title: { presence: 'value', value: title, writable: true },
      status: { presence: 'value', value: status, writable: true },
    },
    rawStatus: status,
  }
}

function writeIntent(overrides: Partial<WriteIntent> = {}): WriteIntent {
  const before = observedStatus('todo')
  const base = baseline()
  return {
    id: 'intent-1',
    linkId: 'link-1',
    key: before.key,
    taskId: '11111111-1111-4111-8111-111111111111',
    taskGeneration: 'gen-1',
    linkRevision: 1,
    fence: { runId: 'run-1', ownerId: 'owner-1', generation: 0 },
    ruleSnapshot: ruleFixture(),
    baseline: base,
    localBefore: base.local,
    localVersion: 1,
    remoteBefore: before,
    patch: { status: 'done' },
    expected: { ...base.remote, status: 'done' },
    phase: 'unknown',
    ...overrides,
  }
}

interface FakeReconcileAdapter extends SyncAdapter {
  readCalls: { key: RemoteKey; rule: SyncRule }[]
  evidenceCalls: WriteIntent[]
}
function reconcileAdapter(readResult: RemoteItem, evidence: WriteEvidence = 'unknown'): FakeReconcileAdapter {
  const readCalls: { key: RemoteKey; rule: SyncRule }[] = []
  const evidenceCalls: WriteIntent[] = []
  return {
    readCalls,
    evidenceCalls,
    async metadata() { throw new Error('unused') },
    async *discover() {},
    async read(key, rule) { readCalls.push({ key, rule }); return readResult },
    async write() {},
    async evidence(intent) { evidenceCalls.push(intent); return evidence },
  }
}

describe('reconcileIntent', () => {
  it('confirms a write by write-set semantics even when a third party changed another field', async () => {
    const intent = writeIntent()
    const adapter = reconcileAdapter(observedStatus('done', 'Third-party title'), 'unknown')
    const result = await reconcileIntent(intent, adapter, new AbortController().signal)
    expect(result.kind).toBe('confirmed')
    expect(adapter.evidenceCalls).toHaveLength(0)
  })

  it('stays pending when the value reverted to the before-value (not proof of not-applied)', async () => {
    const intent = writeIntent()
    const adapter = reconcileAdapter(observedStatus('todo'), 'unknown')
    const result = await reconcileIntent(intent, adapter, new AbortController().signal)
    expect(result.kind).toBe('pending')
    expect(adapter.evidenceCalls).toHaveLength(1)
  })

  it('stays pending when the value matches neither the before nor the expected value', async () => {
    const intent = writeIntent()
    const adapter = reconcileAdapter(observedStatus('in_progress'), 'unknown')
    const result = await reconcileIntent(intent, adapter, new AbortController().signal)
    expect(result.kind).toBe('pending')
  })

  it('returns proven_not_applied only on platform evidence', async () => {
    const intent = writeIntent()
    const adapter = reconcileAdapter(observedStatus('todo'), 'not_applied_proven')
    const result = await reconcileIntent(intent, adapter, new AbortController().signal)
    expect(result.kind).toBe('proven_not_applied')
  })

  it('reads using the intent rule snapshot rather than the current mapping', async () => {
    const snapshot = ruleFixture({ revision: 42 })
    const intent = writeIntent({ ruleSnapshot: snapshot })
    const adapter = reconcileAdapter(observedStatus('done'))
    await reconcileIntent(intent, adapter, new AbortController().signal)
    expect(adapter.readCalls[0]?.rule).toBe(snapshot)
  })
})

describe('reconciliation adoption and finalization', () => {
  it('adopts an old run intent after reconciliation and preserves original provenance', async () => {
    const { db, clock, rule, links, runs, config, connection } = setup()
    const oldClaim = runs.claimRun('owner-1', clock.now())
    const item = remote()
    const task = links.importItem(item, rule, oldClaim.fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence: oldClaim.fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, oldClaim.fence)
    links.recordUnknown(intent.id, oldClaim.fence, syncError('WriteOutcomeUnknown'))

    clock.advance(SYNC_LEASE_MS + 1)
    const newClaim = runs.claimRun('owner-2', clock.now())
    config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
    config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })

    const adapter = reconcileAdapter(observedStatus('todo', 'Pushed title'))
    const result = await links.reconcileAndAdopt(intent.id, newClaim.fence, adapter, new AbortController().signal)
    expect(result.kind).toBe('confirmed')

    const row = db.prepare(`SELECT phase, run_id, owner_id, generation, confirmed_run_id, confirmed_owner_id, confirmed_generation
      FROM sync_write_intents WHERE id = ?`).get(intent.id) as { phase: string; run_id: string; owner_id: string; generation: number; confirmed_run_id: string; confirmed_owner_id: string; confirmed_generation: number }
    expect(row.phase).toBe('confirmed')
    expect(row.run_id).toBe(oldClaim.fence.runId)
    expect(row.owner_id).toBe('owner-1')
    expect(row.generation).toBe(oldClaim.fence.generation)
    expect(row.confirmed_run_id).toBe(newClaim.fence.runId)
    expect(row.confirmed_owner_id).toBe('owner-2')
    expect(row.confirmed_generation).toBe(newClaim.fence.generation)
    expect(links.getPending(item.key)).toBeNull()
    // baseline and link revision are left for the next full sync, not rewritten by adoption
    expect(links.getLink(item.key)?.baseline).toEqual(link.baseline)
    expect(links.getLink(item.key)?.revision).toBe(link.revision)
  })

  it('rejects reconciling an intent dispatched by the same run (no bypass of finalizeItem)', async () => {
    const { db, clock, rule, links, runs, config, connection } = setup()
    const claim = runs.claimRun('owner-1', clock.now())
    const item = remote()
    const task = links.importItem(item, rule, claim.fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence: claim.fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, claim.fence)
    config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
    config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })

    const adapter = reconcileAdapter(observedStatus('todo', 'Pushed title'))
    await expectSyncErrorAsync(links.reconcileAndAdopt(intent.id, claim.fence, adapter, new AbortController().signal), 'StaleOwner')
    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'dispatched' })
  })

  it('leaves the intent pending when the reconciled observation does not match (no write)', async () => {
    const { db, clock, rule, links, runs, config, connection } = setup()
    const oldClaim = runs.claimRun('owner-1', clock.now())
    const item = remote()
    const task = links.importItem(item, rule, oldClaim.fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence: oldClaim.fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, oldClaim.fence)
    links.recordUnknown(intent.id, oldClaim.fence, syncError('WriteOutcomeUnknown'))
    clock.advance(SYNC_LEASE_MS + 1)
    const newClaim = runs.claimRun('owner-2', clock.now())
    config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
    config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })

    const adapter = reconcileAdapter(observedStatus('todo', 'Remote task'))
    const result = await links.reconcileAndAdopt(intent.id, newClaim.fence, adapter, new AbortController().signal)
    expect(result.kind).toBe('pending')
    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'unknown' })
    expect(links.getLink(item.key)?.revision).toBe(link.revision)
    expect(db.prepare('SELECT COUNT(*) AS c FROM sync_run_items').get().c).toBe(0)
  })

  it('does not confirm on proven_not_applied evidence and leaves the intent untouched', async () => {
    const { db, clock, rule, links, runs, config, connection } = setup()
    const oldClaim = runs.claimRun('owner-1', clock.now())
    const item = remote()
    const task = links.importItem(item, rule, oldClaim.fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence: oldClaim.fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, oldClaim.fence)
    links.recordUnknown(intent.id, oldClaim.fence, syncError('WriteOutcomeUnknown'))
    clock.advance(SYNC_LEASE_MS + 1)
    const newClaim = runs.claimRun('owner-2', clock.now())
    config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
    config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })

    const adapter = reconcileAdapter(observedStatus('todo'), 'not_applied_proven')
    const result = await links.reconcileAndAdopt(intent.id, newClaim.fence, adapter, new AbortController().signal)
    expect(result.kind).toBe('proven_not_applied')
    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'unknown' })
    expect(db.prepare('SELECT COUNT(*) AS c FROM sync_run_items').get().c).toBe(0)
  })

  it('rejects a concurrent local edit during the reconciliation read and writes nothing', async () => {
    const { store, db, clock, rule, links, runs, config, connection } = setup()
    const oldClaim = runs.claimRun('owner-1', clock.now())
    const item = remote()
    const task = links.importItem(item, rule, oldClaim.fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence: oldClaim.fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, oldClaim.fence)
    links.recordUnknown(intent.id, oldClaim.fence, syncError('WriteOutcomeUnknown'))
    clock.advance(SYNC_LEASE_MS + 1)
    const newClaim = runs.claimRun('owner-2', clock.now())
    config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
    config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })

    const adapter = reconcileAdapter(observedStatus('todo', 'Pushed title'))
    adapter.read = async () => {
      store.update({ id: task.id, version: task.version, title: 'Concurrent edit' })
      return observedStatus('todo', 'Pushed title')
    }

    await expectSyncErrorAsync(links.reconcileAndAdopt(intent.id, newClaim.fence, adapter, new AbortController().signal), 'LocalVersionConflict')
    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'unknown' })
    expect(db.prepare('SELECT COUNT(*) AS c FROM sync_run_items').get().c).toBe(0)
    expect(store.get(task.id)?.title).toBe('Concurrent edit')
  })

  it('adopts a detached intent without resurrecting the deleted task and holds the generation', async () => {
    const { store, db, clock, rule, links, runs, config, connection } = setup()
    const oldClaim = runs.claimRun('owner-1', clock.now())
    const item = remote()
    const task = links.importItem(item, rule, oldClaim.fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence: oldClaim.fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, oldClaim.fence)
    links.recordUnknown(intent.id, oldClaim.fence, syncError('WriteOutcomeUnknown'))
    store.delete(task.id, task.version)
    clock.advance(SYNC_LEASE_MS + 1)
    const newClaim = runs.claimRun('owner-2', clock.now())
    config.updateConnection({ id: connection.id, revision: connection.revision, enabled: true })
    config.updateRule({ id: rule.id, revision: rule.revision, enabled: true })

    const adapter = reconcileAdapter(observedStatus('todo', 'Pushed title'))
    const result = await links.reconcileAndAdopt(intent.id, newClaim.fence, adapter, new AbortController().signal)
    expect(result.kind).toBe('confirmed')
    expect(db.prepare('SELECT phase, task_id, task_generation FROM sync_write_intents WHERE id = ?').get(intent.id))
      .toEqual({ phase: 'confirmed', task_id: null, task_generation: link.taskGeneration })
    expect(links.getLink(item.key)?.taskId).toBeNull()
    expect(links.getPending(item.key)).toBeNull()
    expect(store.get(task.id)).toBeNull()
  })

  it('removes the caller-controlled adoptIntent baseline/result API', () => {
    const { links } = setup()
    expect((links as unknown as { adoptIntent?: unknown }).adoptIntent).toBeUndefined()
    expect(typeof links.reconcileAndAdopt).toBe('function')
    expect(links.reconcileAndAdopt.length).toBe(4)
  })

  it('finalizes an unknown intent as confirmed after matching semantics', () => {
    const { store, db, fence, rule, links } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)
    links.recordUnknown(intent.id, fence, syncError('WriteOutcomeUnknown'))
    expect(links.getPending(item.key)?.phase).toBe('unknown')

    links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: link.baseline!,
      intentId: intent.id, result: pushedResult(item.key, task.id),
    })

    expect(db.prepare('SELECT phase, error FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'confirmed', error: null })
    expect(links.getPending(item.key)).toBeNull()
    expect(store.get(task.id)?.version).toBe(1)
  })

  it('finalizes a detached intent without resurrecting the deleted task and holds the task generation', () => {
    const { store, db, fence, rule, links } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)
    links.recordUnknown(intent.id, fence, syncError('WriteOutcomeUnknown'))
    store.delete(task.id, task.version)

    const detached = links.getLink(item.key)!
    expect(detached.taskId).toBeNull()

    links.finalizeItem({
      fence, linkId: detached.id, linkRevision: detached.revision, taskGeneration: detached.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: detached.baseline!,
      intentId: intent.id, result: pushedResult(item.key, null),
    })

    expect(db.prepare('SELECT phase, task_id, task_generation FROM sync_write_intents WHERE id = ?').get(intent.id))
      .toEqual({ phase: 'confirmed', task_id: null, task_generation: link.taskGeneration })
    expect(links.getLink(item.key)?.taskId).toBeNull()
    expect(links.getPending(item.key)).toBeNull()
    expect(store.get(task.id)).toBeNull()
  })
})
