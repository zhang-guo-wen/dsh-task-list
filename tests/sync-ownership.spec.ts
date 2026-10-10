import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SYNC_LEASE_MS, SyncRunStore } from '../src/sync/run-store.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, SafeConnection, SafeItemResult, SyncErrorCode,
} from '../src/sync/dto.ts'
import type { Clock, RemoteKey, RunFence, SyncPlan, SyncRule } from '../src/sync/types.ts'
import { remote } from './fixtures/sync.ts'

const roots: string[] = []
const closable: { close(): void }[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-ownership-'))
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

interface Setup {
  store: TaskStore
  db: DatabaseSync
  clock: FakeClock
  fence: RunFence
  rule: SyncRule
  connection: SafeConnection
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
  return { store, db, clock, fence, rule, connection, links, runs }
}

describe('SyncRunStore ownership', () => {
  it('claims one run across two real database handles', () => {
    const store = new TaskStore(fixture())
    closable.push(store)
    const second = new DatabaseSync(store.file)
    closable.push(second)
    second.exec('PRAGMA busy_timeout = 5000;')
    const clock = fakeClock()
    const runs1 = new SyncRunStore(store.db, clock)
    const runs2 = new SyncRunStore(second, clock)

    const first = runs1.claimRun('owner-1', clock.now())
    expect(first.existing).toBe(false)
    expect(first.fence.runId).toEqual(expect.any(String))

    const join = runs2.claimRun('owner-2', clock.now())
    expect(join.existing).toBe(true)
    expect(join.fence.runId).toBe(first.fence.runId)
    expect(join.fence.ownerId).toBe('owner-2')

    expect((store.db.prepare('SELECT COUNT(*) AS c FROM sync_runs').get() as { c: number }).c).toBe(1)
    expect((store.db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(1)
  })

  it('heartbeats refresh the lease and assertFence rejects an expired fence', () => {
    const { clock, runs } = setup()
    const claim = runs.claimRun('owner-1', clock.now())
    const fence = claim.fence

    runs.assertFence(fence)
    clock.advance(SYNC_LEASE_MS - 1)
    runs.assertFence(fence)

    expect(runs.heartbeat(fence, clock.now())).toBe(true)
    clock.advance(SYNC_LEASE_MS - 1)
    runs.assertFence(fence)

    clock.advance(2)
    expectSyncError(() => runs.assertFence(fence), 'StaleOwner')
    expect(runs.heartbeat(fence, clock.now())).toBe(false)
  })

  it('rejects an old owner dispatch and commit after the lease expires', () => {
    const { store, db, clock, fence, rule, links } = setup()
    const item = remote()
    const task = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const dispatched = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })
    links.markDispatched(dispatched.id, fence)
    const prepared = links.prepareIntent({ fence, link, task, observed: item, rule, plan: pushPlan })

    clock.advance(SYNC_LEASE_MS + 1)

    expectSyncError(() => links.markDispatched(prepared.id, fence), 'StaleOwner')
    expectSyncError(() => links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch: {}, observed: item, baseline: link.baseline!,
      intentId: dispatched.id, result: pushedResult(item.key, task.id),
    }), 'StaleOwner')
    expect(db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(prepared.id)).toEqual({ phase: 'prepared' })
    expect(store.get(task.id)?.version).toBe(1)
  })

  it('takeover marks the abandoned run interrupted and advances the generation', () => {
    const { clock, runs } = setup()
    const first = runs.claimRun('owner-1', clock.now())
    clock.advance(SYNC_LEASE_MS + 1)
    const second = runs.claimRun('owner-2', clock.now())

    expect(second.existing).toBe(false)
    expect(second.fence.runId).not.toBe(first.fence.runId)
    expect(second.fence.generation).toBe(first.fence.generation + 1)
    expect(runs.getRun(first.fence.runId)?.status).toBe('interrupted')
    expectSyncError(() => runs.assertFence(first.fence), 'StaleOwner')
    runs.assertFence(second.fence)
  })

  it('revoke releases the lock so the next claim starts a fresh run', () => {
    const { clock, runs } = setup()
    const first = runs.claimRun('owner-1', clock.now())
    runs.revoke(first.fence)
    expectSyncError(() => runs.assertFence(first.fence), 'StaleOwner')
    const second = runs.claimRun('owner-2', clock.now())
    expect(second.existing).toBe(false)
    expect(second.fence.runId).not.toBe(first.fence.runId)
  })

  it('revoke marks the owned run interrupted (terminal row, not an orphan running row)', () => {
    const { clock, runs } = setup()
    const first = runs.claimRun('owner-1', clock.now())
    runs.revoke(first.fence)
    const run = runs.getRun(first.fence.runId)!
    expect(run.status).toBe('interrupted')
    expect(run.finishedAt).not.toBeNull()
    expect(runs.getRun(first.fence.runId)?.phase).toBe('finished')
  })

  it('finishRun releases the singleton lock so the next claim is fresh', () => {
    const { db, clock, runs } = setup()
    const first = runs.claimRun('owner-1', clock.now())
    runs.finishRun(first.fence, 'completed', { discoveryComplete: true, unprocessedKnown: 0, errors: [] })
    expect((db.prepare('SELECT COUNT(*) AS c FROM sync_run_lock').get() as { c: number }).c).toBe(0)
    expectSyncError(() => runs.assertFence(first.fence), 'StaleOwner')
    const second = runs.claimRun('owner-2', clock.now())
    expect(second.existing).toBe(false)
    expect(second.fence.runId).not.toBe(first.fence.runId)
    // the completed run is never downgraded to interrupted by the follow-on claim
    expect(runs.getRun(first.fence.runId)?.status).toBe('completed')
  })

  it('rejects a read-only re-import under an expired fence (no old-owner continuation)', () => {
    const { clock, fence, rule, links } = setup()
    const item = remote()
    links.importItem(item, rule, fence)
    clock.advance(SYNC_LEASE_MS + 1)
    expectSyncError(() => links.importItem(item, rule, fence), 'StaleOwner')
  })
})
