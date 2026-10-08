import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { textContent } from '../src/content.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SyncRunStore, SYNC_LEASE_MS } from '../src/sync/run-store.ts'
import { syncError } from '../src/sync/errors.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, SafeConnection, SafeItemResult, SyncErrorCode, UpdateConnectionRequest,
} from '../src/sync/dto.ts'
import type { Clock, RemoteKey, RunFence, SyncPlan, SyncRule } from '../src/sync/types.ts'
import { remote } from './fixtures/sync.ts'

const roots: string[] = []
const closable: { close(): void }[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-sync-'))
  roots.push(root)
  return join(root, 'tasks.sqlite')
}
afterEach(() => {
  for (const handle of closable.splice(0)) { try { handle.close() } catch { /* already closed */ } }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const tapdInput: CreateConnectionRequest = { platform: 'tapd', name: 'TAPD', companyId: '20000001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', enabled: false }
const yunxiaoInput: CreateConnectionRequest = { platform: 'yunxiao', name: 'Yunxiao', mode: 'center', organizationId: 'org-1', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: false }

function fakeClock(initial = 1_700_000_000_000): Clock & { now(): number } {
  let now = initial
  return { now: () => now, sleep: async () => {} }
}

function seedRun(db: DatabaseSync, runId: string, ownerId: string, generation: number, startedAt = 1_700_000_000_000): RunFence {
  db.prepare(`INSERT INTO sync_runs (id, status, phase, started_at) VALUES (?, 'running', 'discovering', ?)`).run(runId, startedAt)
  db.prepare(`INSERT INTO sync_run_lock (id, run_id, owner_id, generation, heartbeat_at, lease_expires_at)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET run_id = excluded.run_id, owner_id = excluded.owner_id,
      generation = excluded.generation, heartbeat_at = excluded.heartbeat_at, lease_expires_at = excluded.lease_expires_at`)
    .run(runId, ownerId, generation, startedAt, startedAt + SYNC_LEASE_MS)
  return { runId, ownerId, generation }
}

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

interface Setup {
  store: TaskStore
  db: DatabaseSync
  fence: RunFence
  config: SyncConfigStore
  connection: SafeConnection
  rule: SyncRule
  links: SyncLinkStore
  runs: SyncRunStore
}

function setup(env: Record<string, string | undefined> = {}): Setup {
  const store = new TaskStore(fixture())
  closable.push(store)
  const db = store.db
  const clock = fakeClock()
  const fence = seedRun(db, 'run-1', 'owner-1', 0)
  const config = new SyncConfigStore(db, () => env)
  const connection = config.createConnection(tapdInput)!
  const rule = config.createRule(ruleInput(connection.id))!
  const links = new SyncLinkStore(db, store, clock)
  const runs = new SyncRunStore(db, clock)
  return { store, db, fence, config, connection, rule, links, runs }
}

describe('SyncConfigStore connections', () => {
  it('creates, lists and resolves a connection with computed credentials, never storing env values', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db, () => ({ TAPD_USER: 'user-value', TAPD_PASS: 'pass-value' }))
    const created = config.createConnection(tapdInput)
    expect(created).toMatchObject({ platform: 'tapd', name: 'TAPD', enabled: false, revision: 1, credentialPresent: true, instance: '20000001', companyId: '20000001' })
    expect(config.listConnections()).toHaveLength(1)
    expect(config.getConnection(created.id)).toEqual(created)

    // env values never land in the database; only the referenced variable names do
    const raw = JSON.stringify(store.db.prepare('SELECT * FROM sync_connections').all())
    expect(raw).not.toContain('user-value')
    expect(raw).not.toContain('pass-value')
    expect(raw).toContain('TAPD_USER')
    expect(raw).toContain('TAPD_PASS')

    // a store with no env reports credentialPresent false without storing anything stale
    const empty = new SyncConfigStore(store.db, () => ({}))
    expect(empty.getConnection(created.id)?.credentialPresent).toBe(false)
  })

  it('derives instance from the platform identity (org for center, region host for region, company for tapd)', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    expect(config.createConnection(yunxiaoInput).instance).toBe('org-1')
    expect(config.createConnection({ ...yunxiaoInput, name: 'Region', mode: 'region', organizationId: 'org-2', regionHost: 'region.example.com' }).instance).toBe('region.example.com')
    expect(config.createConnection(tapdInput).instance).toBe('20000001')
  })

  it('rejects other-platform update keys against the existing connection platform', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const tapd = config.createConnection(tapdInput)
    expectSyncError(() => config.updateConnection({ id: tapd.id, revision: 1, mode: 'center' }), 'InvalidConfig')
    const yunxiao = config.createConnection(yunxiaoInput)
    expectSyncError(() => config.updateConnection({ id: yunxiao.id, revision: 1, companyId: 'c' }), 'InvalidConfig')
    expect(config.updateConnection({ id: tapd.id, revision: 1, name: 'Renamed' }).revision).toBe(2)
  })

  it('rejects a region connection with a null or blank region host instead of deriving an empty instance', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    expectSyncError(() => config.createConnection({ ...yunxiaoInput, mode: 'region', regionHost: null }), 'InvalidConfig')
    expectSyncError(() => config.createConnection({ ...yunxiaoInput, mode: 'region', regionHost: '   ' }), 'InvalidConfig')

    const created = config.createConnection({ ...yunxiaoInput, mode: 'region', regionHost: 'region.example.com' })
    expect(created.instance).toBe('region.example.com')
    expectSyncError(() => config.updateConnection({ id: created.id, revision: 1, regionHost: null }), 'InvalidConfig')
    expectSyncError(() => config.updateConnection({ id: created.id, revision: 1, regionHost: '   ' }), 'InvalidConfig')
  })

  it('rejects a center connection with a null, blank or control organizationId before writing any row', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    expectSyncError(() => config.createConnection({ ...yunxiaoInput, organizationId: null as unknown as string }), 'InvalidConfig')
    expectSyncError(() => config.createConnection({ ...yunxiaoInput, organizationId: '' }), 'InvalidConfig')
    expectSyncError(() => config.createConnection({ ...yunxiaoInput, organizationId: '   ' }), 'InvalidConfig')
    expectSyncError(() => config.createConnection({ ...yunxiaoInput, organizationId: 'org\x01bad' }), 'InvalidConfig')
    expect(config.listConnections()).toHaveLength(0)
  })

  it('rejects clearing or corrupting the organizationId on update and keeps the row unchanged', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const created = config.createConnection(yunxiaoInput)
    expectSyncError(() => config.updateConnection({ id: created.id, revision: 1, organizationId: '' }), 'InvalidConfig')
    expectSyncError(() => config.updateConnection({ id: created.id, revision: 1, organizationId: '   ' }), 'InvalidConfig')
    expectSyncError(() => config.updateConnection({ id: created.id, revision: 1, organizationId: 'org\x02bad' }), 'InvalidConfig')
    expect(config.getConnection(created.id)?.organizationId).toBe('org-1')
  })

  it('enforces revision CAS across two real database handles', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const created = config.createConnection(tapdInput)
    const second = new DatabaseSync(store.file)
    closable.push(second)
    second.exec('PRAGMA busy_timeout = 5000;')
    const secondConfig = new SyncConfigStore(second)
    const updated = config.updateConnection({ id: created.id, revision: created.revision, name: 'First' })
    expect(updated.revision).toBe(2)
    expectSyncError(() => secondConfig.updateConnection({ id: created.id, revision: created.revision, name: 'Second' }), 'LocalVersionConflict')
  })

  it('rejects instance change on a referenced connection and permits disable', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const tapd = config.createConnection(tapdInput)
    config.createRule(ruleInput(tapd.id))
    expectSyncError(() => config.updateConnection({ id: tapd.id, revision: 1, companyId: 'other-company' }), 'MappingIncompatible')
    expect(config.updateConnection({ id: tapd.id, revision: 1, enabled: false }).enabled).toBe(false)
  })

  it('rejects deleting a connection referenced by a rule', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const tapd = config.createConnection(tapdInput)
    config.createRule(ruleInput(tapd.id))
    expectSyncError(() => config.deleteConnection({ id: tapd.id, revision: 1 }), 'InvalidConfig')
    expect(config.listConnections()).toHaveLength(1)
  })

  it('rejects over-long names and invalid env variable names', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    expectSyncError(() => config.createConnection({ ...tapdInput, name: 'x'.repeat(101) }), 'InvalidConfig')
    expectSyncError(() => config.createConnection({ ...tapdInput, userEnv: '1BAD_NAME' }), 'InvalidConfig')
  })
})

describe('SyncConfigStore rules', () => {
  it('enforces instance+project uniqueness across credential rotation', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const first = config.createConnection(tapdInput)
    const second = config.createConnection({ ...tapdInput, name: 'TAPD 2', userEnv: 'OTHER_USER', passwordEnv: 'OTHER_PASS' })
    expect(first.instance).toBe(second.instance)
    config.createRule(ruleInput(first.id, 'proj-1'))
    expectSyncError(() => config.createRule(ruleInput(second.id, 'proj-1')), 'InvalidConfig')
    config.createRule(ruleInput(second.id, 'proj-2'))
  })

  it('creates rules starting at revision 1 and rejects stale updates and deletes', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const connection = config.createConnection(tapdInput)
    const rule = config.createRule(ruleInput(connection.id))
    expect(rule.revision).toBe(1)
    expect(config.listRules(connection.id)).toHaveLength(1)
    expect(config.updateRule({ id: rule.id, revision: 1, enabled: true }).revision).toBe(2)
    expectSyncError(() => config.updateRule({ id: rule.id, revision: 1, enabled: false }), 'LocalVersionConflict')
    expectSyncError(() => config.deleteRule({ id: rule.id, revision: 1 }), 'LocalVersionConflict')
  })

  it('rejects deleting a rule referenced by a link', () => {
    const { config, rule, links, fence } = setup()
    links.importItem(remote(), rule, fence)
    expectSyncError(() => config.deleteRule({ id: rule.id, revision: rule.revision }), 'InvalidConfig')
    expect(config.updateRule({ id: rule.id, revision: rule.revision, enabled: false }).enabled).toBe(false)
  })

  it('rejects over-long rule metadata (filters and mappings)', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const config = new SyncConfigStore(store.db)
    const connection = config.createConnection(tapdInput)
    const base = ruleInput(connection.id)
    expectSyncError(() => config.createRule({ ...base, filters: { ...base.filters, assignees: Array.from({ length: 101 }, (_, i) => `a${i}`) } }), 'InvalidConfig')
    expectSyncError(() => config.createRule({ ...base, mappings: Array.from({ length: 101 }, () => base.mappings[0]!) }), 'InvalidConfig')
  })
})

describe('SyncLinkStore import and intents', () => {
  it('imports a remote item into a new task, link and baseline', () => {
    const { store, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    expect(task).toMatchObject({ title: 'Remote task', status: 'in_progress', priority: 'high', storyPoints: 3 })
    expect(store.get(task.id)?.content).toEqual(task.content)
    const link = links.getLink(item.key)!
    expect(link).toMatchObject({ ruleId: rule.id, taskId: task.id, revision: 1 })
    expect(link.baseline).not.toBeNull()
    expect(links.getLinkByTask(task.id)).toEqual(link)
  })

  it('blocks re-import while an intent is unconfirmed and allows it once cleared', () => {
    const { store, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)
    expect(links.getPending(item.key)?.phase).toBe('dispatched')
    expectSyncError(() => links.importItem(item, rule, fence), 'WriteOutcomeUnknown')

    // settle the intent and confirm the key can be imported again (idempotent)
    links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: link.baseline!,
      intentId: intent.id,
      result: { key: item.key, taskId: task.id, category: 'pushed', changedFields: ['title'], discardedFields: [], writtenBack: true, outsideFilter: false, error: null },
    })
    expect(links.getPending(item.key)).toBeNull()
    expect(links.importItem(item, rule, fence).id).toBe(task.id)
    expect(store.get(task.id)?.version).toBe(1)
  })

  it('cancels prepared intents and detaches dispatched/unknown evidence when the task is deleted', () => {
    const { store, db, links, rule, fence } = setup()

    const prepared = links.importItem(remote(), rule, fence)
    const preparedLink = links.getLink(remote().key)!
    const preparedIntent = links.prepareIntent({ fence, link: preparedLink, task: prepared, observed: remote(), rule, plan: pushPlan })
    store.delete(prepared.id, prepared.version)
    expect(links.getLink(remote().key)?.taskId).toBeNull()
    expect(db.prepare('SELECT phase, task_id FROM sync_write_intents WHERE id = ?').get(preparedIntent.id)).toEqual({ phase: 'cancelled', task_id: null })

    const secondItem = remote({ key: { ...remote().key, id: 'second' } })
    const dispatched = links.importItem(secondItem, rule, fence)
    const dispatchedLink = links.getLink(secondItem.key)!
    const dispatchedIntent = links.prepareIntent({ fence, link: dispatchedLink, task: dispatched, observed: secondItem, rule, plan: pushPlan })
    links.markDispatched(dispatchedIntent.id, fence)
    store.delete(dispatched.id, dispatched.version)
    expect(db.prepare('SELECT phase, task_id FROM sync_write_intents WHERE id = ?').get(dispatchedIntent.id)).toEqual({ phase: 'dispatched', task_id: null })

    const thirdItem = remote({ key: { ...remote().key, id: 'third' } })
    const unknown = links.importItem(thirdItem, rule, fence)
    const unknownLink = links.getLink(thirdItem.key)!
    const unknownIntent = links.prepareIntent({ fence, link: unknownLink, task: unknown, observed: thirdItem, rule, plan: pushPlan })
    links.markDispatched(unknownIntent.id, fence)
    links.recordUnknown(unknownIntent.id, fence, syncError('WriteOutcomeUnknown'))
    store.delete(unknown.id, unknown.version)
    expect(db.prepare('SELECT phase, task_id FROM sync_write_intents WHERE id = ?').get(unknownIntent.id)).toEqual({ phase: 'unknown', task_id: null })
  })

  it('rolls back task, baseline, intent and result together when finalize fails', () => {
    const { store, db, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: { ...pushPlan, localPatch: { title: 'Local change' } } })
    links.markDispatched(intent.id, fence)
    db.exec(`CREATE TRIGGER fail_baseline BEFORE INSERT ON sync_baselines BEGIN SELECT RAISE(ABORT, 'injected'); END;`)
    const result: SafeItemResult = { key: item.key, taskId: task.id, category: 'pushed', changedFields: ['title'], discardedFields: [], writtenBack: true, outsideFilter: false, error: null }
    expect(() => links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: { title: 'Local change' }, observed: item, baseline: link.baseline!,
      intentId: intent.id, result,
    })).toThrow('injected')
    expect(store.get(task.id)?.title).toBe('Remote task')
    expect(store.get(task.id)?.version).toBe(1)
    expect(links.getPending(item.key)?.phase).toBe('dispatched')
    expect(db.prepare('SELECT * FROM sync_run_items').all()).toHaveLength(0)
  })

  it('rejects a wrong intentId belonging to a different link and rolls back task, baseline and result', () => {
    const { store, db, links, rule, fence } = setup()
    const itemA = remote({ key: { ...remote().key, id: 'item-a' } })
    const itemB = remote({ key: { ...remote().key, id: 'item-b' } })
    const taskA = links.importItem(itemA, rule, fence)
    const linkA = links.getLink(itemA.key)!
    const taskB = links.importItem(itemB, rule, fence)
    const linkB = links.getLink(itemB.key)!
    const intentA = links.prepareIntent({ fence, link: linkA, task: taskA, observed: itemA, rule, plan: pushPlan })
    links.markDispatched(intentA.id, fence)

    expectSyncError(() => links.finalizeItem({
      fence, linkId: linkB.id, linkRevision: linkB.revision, taskGeneration: linkB.taskGeneration,
      expectedTaskVersion: taskB.version, localPatch: { title: 'Should roll back' }, observed: itemB, baseline: linkB.baseline!,
      intentId: intentA.id, result: pushedResult(itemB.key, taskB.id),
    }), 'LocalVersionConflict')

    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intentA.id)).toEqual({ phase: 'dispatched' })
    expect(store.get(taskB.id)?.title).toBe('Remote task')
    expect(store.get(taskB.id)?.version).toBe(1)
    expect(links.getLink(itemB.key)?.revision).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS c FROM sync_run_items').get().c).toBe(0)
  })

  it('rejects a stale same-link intent after the link revision advances and leaves it untouched', () => {
    const { db, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)

    // advance the link without confirming any intent (a pull that wrote nothing back)
    links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: link.baseline!,
      intentId: null, result: { key: item.key, taskId: task.id, category: 'pulled', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: null },
    })
    const advanced = links.getLink(item.key)!
    expect(advanced.revision).toBe(2)

    expectSyncError(() => links.finalizeItem({
      fence, linkId: link.id, linkRevision: advanced.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: advanced.baseline!,
      intentId: intent.id, result: pushedResult(item.key, task.id),
    }), 'LocalVersionConflict')

    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'dispatched' })
    expect(links.getLink(item.key)?.revision).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS c FROM sync_run_items').get().c).toBe(1)
  })

  it('rejects an intent owned by a different run and leaves it untouched', () => {
    const { db, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)

    // A takeover replaces the singleton lock with another run's owner.
    const otherFence = seedRun(db, 'run-2', 'owner-2', 0)

    expectSyncError(() => links.finalizeItem({
      fence: otherFence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: link.baseline!,
      intentId: intent.id, result: pushedResult(item.key, task.id),
    }), 'StaleOwner')

    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'dispatched' })
    expect(links.getLink(item.key)?.revision).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS c FROM sync_run_items').get().c).toBe(0)
  })

  it('rejects an intent whose owner/generation no longer matches the current run lock', () => {
    const { db, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)

    db.prepare("UPDATE sync_run_lock SET owner_id = 'owner-2', generation = 1 WHERE run_id = ?").run(fence.runId)
    const rotated = { runId: fence.runId, ownerId: 'owner-2', generation: 1 }

    expectSyncError(() => links.finalizeItem({
      fence: rotated, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: link.baseline!,
      intentId: intent.id, result: pushedResult(item.key, task.id),
    }), 'StaleOwner')

    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'dispatched' })
    expect(links.getLink(item.key)?.revision).toBe(1)
  })

  it('rejects confirming a prepared intent that was never dispatched', () => {
    const { db, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })

    expectSyncError(() => links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: link.baseline!,
      intentId: intent.id, result: pushedResult(item.key, task.id),
    }), 'LocalVersionConflict')

    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'prepared' })
    expect(links.getLink(item.key)?.revision).toBe(1)
  })

  it('rejects a cancelled intent and does not re-confirm an already-confirmed intent', () => {
    // cancelled intent
    const cancelled = setup()
    const itemA = remote({ key: { ...remote().key, id: 'cancelled-item' } })
    const taskA = cancelled.links.importItem(itemA, cancelled.rule, cancelled.fence)
    const linkA = cancelled.links.getLink(itemA.key)!
    const intentA = cancelled.links.prepareIntent({ fence: cancelled.fence, link: linkA, task: taskA, observed: itemA, rule: cancelled.rule, plan: pushPlan })
    cancelled.links.markDispatched(intentA.id, cancelled.fence)
    cancelled.db.prepare("UPDATE sync_write_intents SET phase = 'cancelled' WHERE id = ?").run(intentA.id)

    expectSyncError(() => cancelled.links.finalizeItem({
      fence: cancelled.fence, linkId: linkA.id, linkRevision: linkA.revision, taskGeneration: linkA.taskGeneration,
      expectedTaskVersion: taskA.version, localPatch: {}, observed: itemA, baseline: linkA.baseline!,
      intentId: intentA.id, result: pushedResult(itemA.key, taskA.id),
    }), 'LocalVersionConflict')
    expect(cancelled.db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intentA.id)).toEqual({ phase: 'cancelled' })
    expect(cancelled.links.getLink(itemA.key)?.revision).toBe(1)

    // already-confirmed intent must not be re-confirmed
    const confirmed = setup()
    const itemB = remote({ key: { ...remote().key, id: 'confirmed-item' } })
    const taskB = confirmed.links.importItem(itemB, confirmed.rule, confirmed.fence)
    const linkB = confirmed.links.getLink(itemB.key)!
    const intentB = confirmed.links.prepareIntent({ fence: confirmed.fence, link: linkB, task: taskB, observed: itemB, rule: confirmed.rule, plan: pushPlan })
    confirmed.links.markDispatched(intentB.id, confirmed.fence)
    confirmed.links.finalizeItem({
      fence: confirmed.fence, linkId: linkB.id, linkRevision: linkB.revision, taskGeneration: linkB.taskGeneration,
      expectedTaskVersion: taskB.version, localPatch: {}, observed: itemB, baseline: linkB.baseline!,
      intentId: intentB.id, result: pushedResult(itemB.key, taskB.id),
    })
    const advancedB = confirmed.links.getLink(itemB.key)!
    expect(confirmed.db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intentB.id)).toEqual({ phase: 'confirmed' })
    expect(advancedB.revision).toBe(2)

    expectSyncError(() => confirmed.links.finalizeItem({
      fence: confirmed.fence, linkId: linkB.id, linkRevision: advancedB.revision, taskGeneration: linkB.taskGeneration,
      expectedTaskVersion: taskB.version, localPatch: {}, observed: itemB, baseline: advancedB.baseline!,
      intentId: intentB.id, result: pushedResult(itemB.key, taskB.id),
    }), 'LocalVersionConflict')
    expect(confirmed.db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intentB.id)).toEqual({ phase: 'confirmed' })
    expect(confirmed.links.getLink(itemB.key)?.revision).toBe(2)
  })

  it('attaches a safe source DTO to linked tasks', () => {
    const { store, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const attached = links.attachSources([store.get(task.id)!])
    expect(attached[0]?.source).toMatchObject({ platform: 'tapd', projectId: item.key.projectId, typeId: item.key.typeId, remoteId: item.key.id, number: item.number })
  })
})

describe('SyncLinkStore projection and attachment preservation', () => {
  it('imports into the rule workspace and keeps the real remote title', () => {
    const { store, links, rule, fence } = setup()
    const task = links.importItem(remote(), { ...rule, workspaceId: 'ws-1' }, fence)
    expect(store.get(task.id)?.workspaceId).toBe('ws-1')
    expect(task.title).toBe('Remote task')
  })

  it('rejects an absent title or status instead of inventing a fallback', () => {
    const { links, rule, fence } = setup()
    expectSyncError(() => links.importItem(remote({ fields: { ...remote().fields, title: { presence: 'absent', writable: false } } }), rule, fence), 'InvalidRemoteResponse')
    expectSyncError(() => links.importItem(remote({ fields: { ...remote().fields, status: { presence: 'absent', writable: false } } }), rule, fence), 'InvalidRemoteResponse')
  })

  it('derives the stored baseline projection from the rule rather than a fixed six fields', () => {
    const { links, rule, fence } = setup()
    const item = remote()
    links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    expect(link.baseline?.projection.fields).toEqual(['title', 'description', 'status'])
    expect(link.baseline?.projection.mappingRevision).toBe(rule.revision)
    expect(link.baseline?.local.description.blocks).toEqual(textContent('Remote body').blocks)
  })

  it('keeps local attachment nodes when finalize applies a pulled description', () => {
    const { store, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const attachment = { type: 'attachment', id: '11111111-1111-4111-8111-111111111111', name: 'note.txt', mediaType: 'text/plain', bytes: 4 } as const
    const attached = store.update({
      id: task.id, version: task.version,
      content: { version: 1, blocks: [...task.content.blocks, attachment] },
      attachments: [{ id: attachment.id, data: Buffer.from('note').toString('base64') }],
    })
    links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: attached.version, localPatch: { description: textContent('New remote body') }, observed: item, baseline: link.baseline!,
      intentId: null, result: { key: item.key, taskId: task.id, category: 'pulled', changedFields: ['description'], discardedFields: [], writtenBack: false, outsideFilter: false, error: null },
    })
    const updated = store.get(task.id)!
    expect(updated.content.blocks.map(block => block.type)).toEqual(['paragraph', 'attachment'])
    expect(updated.content.blocks[1]).toMatchObject({ id: attachment.id, name: 'note.txt', mediaType: 'text/plain', bytes: 4 })
  })

  it('keeps the original task intact when a pulled description exceeds the content limit', () => {
    const { store, links, rule, fence } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const attachment = { type: 'attachment', id: '11111111-1111-4111-8111-111111111111', name: 'note.txt', mediaType: 'text/plain', bytes: 4 } as const
    const attached = store.update({
      id: task.id, version: task.version,
      content: { version: 1, blocks: [...task.content.blocks, attachment] },
      attachments: [{ id: attachment.id, data: Buffer.from('note').toString('base64') }],
    })
    expect(() => links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: attached.version, localPatch: { description: textContent('x'.repeat(20001)) }, observed: item, baseline: link.baseline!,
      intentId: null, result: { key: item.key, taskId: task.id, category: 'pulled', changedFields: ['description'], discardedFields: [], writtenBack: false, outsideFilter: false, error: null },
    })).toThrow()
    const unchanged = store.get(task.id)!
    expect(unchanged.version).toBe(attached.version)
    expect(unchanged.content.blocks.map(block => block.type)).toEqual(['paragraph', 'attachment'])
    expect(unchanged.content.blocks[0]).toEqual({ type: 'paragraph', children: [{ text: 'Remote body' }] })
  })
})

describe('SyncRunStore runs and results', () => {
  it('sets phase, records results with consistent counters, and pages item results', () => {
    const { db, fence, runs } = setup()
    runs.setPhase(fence, 'processing')
    expect(runs.getRun(fence.runId)?.phase).toBe('processing')

    const item = remote()
    runs.recordResult(fence, { key: item.key, taskId: null, category: 'imported', changedFields: ['title'], discardedFields: [], writtenBack: false, outsideFilter: false, error: null })
    runs.recordResult(fence, { key: { ...item.key, id: 'second' }, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('WriteOutcomeUnknown') })

    const run = runs.getRun(fence.runId)!
    expect(run.counts).toMatchObject({ imported: 1, failed: 1, pending: 1 })
    expect(runs.listItemResults(fence.runId).total).toBe(2)
    expect(runs.listItemResults(fence.runId).items.map(r => r.category).sort()).toEqual(['failed', 'imported'])

    // category change keeps counters consistent
    runs.recordResult(fence, { key: item.key, taskId: null, category: 'pulled', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: null })
    expect(runs.getRun(fence.runId)?.counts).toMatchObject({ imported: 0, pulled: 1, failed: 1, pending: 1 })
  })

  it('deduplicates seen keys and finishes a run', () => {
    const { fence, runs } = setup()
    const item = remote()
    expect(runs.markSeen(fence, item.key)).toBe(true)
    expect(runs.markSeen(fence, item.key)).toBe(false)
    expect(runs.hasSeen(fence.runId, item.key)).toBe(true)
    runs.finishRun(fence, 'completed', { discoveryComplete: true, unprocessedKnown: 0, errors: [] })
    const run = runs.getRun(fence.runId)!
    expect(run.status).toBe('completed')
    expect(run.phase).toBe('finished')
    expect(run.finishedAt).toEqual(expect.any(Number))
  })

  it('rejects writes under a stale fence', () => {
    const { fence, runs } = setup()
    expectSyncError(() => runs.setPhase({ ...fence, generation: fence.generation + 1 }, 'processing'), 'StaleOwner')
  })

  it('persists the pending hint so re-recording the same item does not drift the pending counter', () => {
    const { fence, runs } = setup()
    const item = remote()
    runs.recordResult(fence, { key: item.key, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('StorageFailure') }, true)
    expect(runs.getRun(fence.runId)?.counts).toMatchObject({ failed: 1, pending: 1 })
    // Re-record the same item as resolved: the persisted hint must drop pending to 0.
    runs.recordResult(fence, { key: item.key, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('StorageFailure') }, false)
    expect(runs.getRun(fence.runId)?.counts).toMatchObject({ failed: 1, pending: 0 })
  })

  it('does not double-count pending when the same pending item is re-recorded', () => {
    const { fence, runs } = setup()
    const item = remote()
    runs.recordResult(fence, { key: item.key, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('StorageFailure') }, true)
    runs.recordResult(fence, { key: item.key, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('StorageFailure') }, true)
    expect(runs.getRun(fence.runId)?.counts).toMatchObject({ failed: 1, pending: 1 })
  })

  it('prunes completed history older than 30 days and beyond 100 runs', () => {
    const { db, runs } = setup()
    const now = 2_000_000_000_000
    const day = 24 * 60 * 60 * 1000
    for (let i = 0; i < 105; i += 1) db.prepare(`INSERT INTO sync_runs (id, status, phase, started_at, finished_at) VALUES (?, 'completed', 'finished', ?, ?)`).run(`r${i}`, now - i, now - i + 1)
    for (let i = 0; i < 5; i += 1) db.prepare(`INSERT INTO sync_runs (id, status, phase, started_at, finished_at) VALUES (?, 'completed', 'finished', ?, ?)`).run(`old${i}`, now - 40 * day, now - 40 * day + 1)
    const result = runs.pruneCompleted(now)
    expect(result.removedRows).toBe(10)
    expect(result.more).toBe(false)
    expect((db.prepare("SELECT COUNT(*) AS c FROM sync_runs WHERE status = 'completed'").get() as { c: number }).c).toBe(100)
  })

  it('bounds cleanup to maxRows and never cleans unknown intents or baselines', () => {
    const { db, fence, links, rule, runs } = setup()
    const now = 2_000_000_000_000
    const day = 24 * 60 * 60 * 1000
    for (let i = 0; i < 1500; i += 1) db.prepare(`INSERT INTO sync_runs (id, status, phase, started_at, finished_at) VALUES (?, 'completed', 'finished', ?, ?)`).run(`x${i}`, now - 40 * day, now - 40 * day + 1)

    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)
    links.recordUnknown(intent.id, fence, syncError('WriteOutcomeUnknown'))

    const first = runs.pruneCompleted(now, 1000)
    expect(first.removedRows).toBe(1000)
    expect(first.more).toBe(true)
    expect((db.prepare('SELECT COUNT(*) AS c FROM sync_baselines').get() as { c: number }).c).toBe(1)
    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intent.id)).toEqual({ phase: 'unknown' })
  }, 30_000)
})
