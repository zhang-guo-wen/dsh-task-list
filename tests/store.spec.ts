import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SYNC_LEASE_MS, SyncRunStore } from '../src/sync/run-store.ts'
import { serializeRemoteKey } from '../src/sync/schema.ts'
import { syncError } from '../src/sync/errors.ts'
import { remote } from './fixtures/sync.ts'
import type { CreateConnectionRequest, CreateSyncRuleRequest } from '../src/sync/dto.ts'
import type { Clock, SyncPlan } from '../src/sync/types.ts'

const roots: string[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-'))
  roots.push(root)
  return join(root, 'task-list', 'tasks.sqlite')
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

const DROP_SYNC_TABLES = `
DROP TABLE IF EXISTS sync_write_intents;
DROP TABLE IF EXISTS sync_baselines;
DROP TABLE IF EXISTS sync_run_items;
DROP TABLE IF EXISTS sync_seen_keys;
DROP TABLE IF EXISTS sync_run_lock;
DROP TABLE IF EXISTS sync_links;
DROP TABLE IF EXISTS sync_rules;
DROP TABLE IF EXISTS sync_runs;
DROP TABLE IF EXISTS sync_connections;`

describe('independent task database', () => {
  it('keeps tasks across reopen and orders todo, in-progress, then done', () => {
    const file = fixture()
    const first = new TaskStore(file)
    const todo = first.create({ title: '  Write docs  ', notes: 'English and Chinese' })
    const active = first.create({ title: 'Ship UI' })
    const done = first.create({ title: 'Review copy' })
    first.update({ id: active.id, version: active.version, status: 'in_progress' })
    first.update({ id: done.id, version: done.version, status: 'done' })
    first.close()

    const reopened = new TaskStore(file)
    expect(reopened.list().items.map(task => task.title)).toEqual(['Write docs', 'Ship UI', 'Review copy'])
    expect(reopened.get(todo.id)?.notes).toBe('English and Chinese')
    expect(reopened.list({ status: 'todo' }).items).toHaveLength(1)
    reopened.close()
  })

  it('rejects stale writes and deletes without losing the current row', () => {
    const store = new TaskStore(fixture())
    const original = store.create({ title: 'Review' })
    const updated = store.update({ id: original.id, version: original.version, notes: 'Check tests' })
    expect(() => store.update({ id: original.id, version: original.version, status: 'done' })).toThrow('task changed')
    expect(() => store.delete(original.id, original.version)).toThrow('task missing or changed')
    expect(store.get(original.id)).toEqual(updated)
    store.delete(updated.id, updated.version)
    expect(store.list().items).toEqual([])
    store.close()
  })

  it('migrates v1 tasks without inventing actual start or completion times', () => {
    const file = fixture()
    mkdirSync(dirname(file), { recursive: true })
    const old = new DatabaseSync(file)
    old.exec(`CREATE TABLE tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'done')),
      version INTEGER NOT NULL CHECK(version >= 1), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO tasks VALUES ('11111111-1111-4111-8111-111111111111', 'Existing', '', 'done', 2, 100, 200);
    PRAGMA user_version = 1;`)
    old.close()

    const migrated = new TaskStore(file)
    expect(migrated.list().items).toEqual([expect.objectContaining({
      title: 'Existing', status: 'done', version: 2, priority: 'medium',
      storyPoints: null, tags: [], workspaceId: null, startedAt: null, completedAt: null,
      sendImmediately: false, sessionId: null, agent: null, useWorktree: false, subtasks: [],
    })])
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    migrated.close()
  })

  it('migrates v2 tasks and stores launch options and the bound session', () => {
    const file = fixture()
    mkdirSync(dirname(file), { recursive: true })
    const old = new DatabaseSync(file)
    old.exec(`CREATE TABLE tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      story_points INTEGER, tags TEXT NOT NULL DEFAULT '[]', workspace_id TEXT,
      started_at INTEGER, completed_at INTEGER,
      version INTEGER NOT NULL CHECK(version >= 1), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO tasks VALUES ('11111111-1111-4111-8111-111111111111', 'Existing', '', 'todo', 'medium', NULL, '[]', NULL, NULL, NULL, 1, 100, 100);
    PRAGMA user_version = 2;`)
    old.close()
    const store = new TaskStore(file)
    const existing = store.list().items[0]!
    expect(existing).toMatchObject({ sendImmediately: false, sessionId: null, agent: null, useWorktree: false })
    const updated = store.update({ id: existing.id, version: existing.version, sendImmediately: true, sessionId: 'session-1', agent: 'coder', useWorktree: true })
    expect(updated).toMatchObject({ sendImmediately: true, sessionId: 'session-1', agent: 'coder', useWorktree: true })
    expect(store.get(existing.id)).toEqual(updated)
    expect(() => store.update({ id: updated.id, version: updated.version, sendImmediately: 1 as never })).toThrow('boolean')
    store.close()
  })

  it('migrates v3 databases by adding subtask storage and keeping the tasks', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const task = store.create({ title: 'Existing', notes: 'Keep me' })
    store.close()

    // Reopen as a version-3 database the way the previous release left it.
    const legacy = new DatabaseSync(file)
    legacy.exec(`DROP TABLE subtasks; DROP TABLE task_attachments; ALTER TABLE tasks DROP COLUMN content;${DROP_SYNC_TABLES} PRAGMA user_version = 3;`)
    legacy.close()

    const migrated = new TaskStore(file)
    expect(migrated.list().items.map(row => row.title)).toEqual(['Existing'])
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    const subtask = migrated.createSubtask({ taskId: task.id, notes: 'Added after migration' })
    expect(migrated.get(task.id)?.subtasks.map(row => row.id)).toEqual([subtask.id])
    migrated.close()
  })

  it('stores card fields and timestamps only actual state transitions', () => {
    const store = new TaskStore(fixture())
    const created = store.create({
      title: 'Build cards', priority: 'high', storyPoints: 5, tags: ['UI', 'Sprint 1'], workspaceId: 'workspace-1',
    })
    expect(created).toMatchObject({
      priority: 'high', storyPoints: 5, tags: ['UI', 'Sprint 1'], workspaceId: 'workspace-1',
      startedAt: null, completedAt: null,
    })
    const started = store.update({ id: created.id, version: created.version, status: 'in_progress' })
    expect(started.startedAt).toEqual(expect.any(Number))
    expect(started.completedAt).toBeNull()
    const edited = store.update({ id: started.id, version: started.version, notes: 'Still working' })
    expect(edited.startedAt).toBe(started.startedAt)
    const done = store.update({ id: edited.id, version: edited.version, status: 'done' })
    expect(done.completedAt).toEqual(expect.any(Number))
    const reopened = store.update({ id: done.id, version: done.version, status: 'todo' })
    expect(reopened.startedAt).toBe(started.startedAt)
    expect(reopened.completedAt).toBeNull()
    expect(store.get(created.id)?.tags).toEqual(['UI', 'Sprint 1'])
    expect(() => store.update({ id: reopened.id, version: reopened.version, storyPoints: 1001 })).toThrow('story points')
    expect(() => store.update({ id: reopened.id, version: reopened.version, tags: ['UI', 'ui'] })).toThrow('duplicate')
    store.close()
  })

  it('moves a task between any two statuses and keeps the timestamps honest', () => {
    const store = new TaskStore(fixture())
    const created = store.create({ title: 'Rework' })
    // To do → Done skips the running state and records only the completion.
    const done = store.update({ id: created.id, version: created.version, status: 'done' })
    expect(done.status).toBe('done')
    expect(done.completedAt).toEqual(expect.any(Number))
    expect(done.startedAt).toBeNull()
    // Done → In progress clears the completion and stamps the start.
    const active = store.update({ id: done.id, version: done.version, status: 'in_progress' })
    expect(active.completedAt).toBeNull()
    expect(active.startedAt).toEqual(expect.any(Number))
    // In progress → To do keeps the earlier start, as the reopen case above.
    const reopened = store.update({ id: active.id, version: active.version, status: 'todo' })
    expect(reopened).toMatchObject({ status: 'todo', completedAt: null })
    expect(reopened.startedAt).toBe(active.startedAt)
    expect(() => store.update({ id: reopened.id, version: reopened.version, status: 'blocked' as never }))
      .toThrow('invalid task status')
    store.close()
  })

  it('creates a task directly in the chosen status with its matching timestamp', () => {
    const store = new TaskStore(fixture())
    const plain = store.create({ title: 'Plain' })
    expect(plain).toMatchObject({ status: 'todo', startedAt: null, completedAt: null })
    const active = store.create({ title: 'Already running', status: 'in_progress' })
    expect(active.status).toBe('in_progress')
    expect(active.startedAt).toEqual(expect.any(Number))
    expect(active.completedAt).toBeNull()
    const done = store.create({ title: 'Already done', status: 'done' })
    expect(done.status).toBe('done')
    expect(done.startedAt).toBeNull()
    expect(done.completedAt).toEqual(expect.any(Number))
    store.close()
  })

  it('validates task input and refuses an unrelated SQLite file', () => {
    const file = fixture()
    const store = new TaskStore(file)
    expect(() => store.create({ title: '  ' })).toThrow('title')
    expect(() => store.create({ title: 'ok', notes: 'x'.repeat(20_001) })).toThrow('notes')
    expect(store.list().items).toEqual([])
    store.close()

    const other = fixture()
    mkdirSync(dirname(other), { recursive: true })
    const db = new DatabaseSync(other)
    db.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY)')
    db.close()
    expect(() => new TaskStore(other)).toThrow('unrecognized tables')
  })
})

describe('persistent rich text and attachments', () => {
  const attachment = { type: 'attachment' as const, id: '22222222-2222-4222-8222-222222222222', name: '需求.txt', mediaType: 'text/plain', bytes: 3 }
  const content = { version: 1 as const, blocks: [
    { type: 'heading' as const, children: [{ text: '检查需求', marks: ['bold' as const] }] }, attachment,
  ] }

  it('persists JSON and bytes across reopen without putting bytes in list pages', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const task = store.create({ title: '检查需求', notes: 'ignored', content, attachments: [{ id: attachment.id, data: 'YWJj' }] })
    expect(task.notes).toBe('检查需求\n需求.txt')
    expect(task.content).toEqual(content)
    expect(JSON.stringify(store.list())).not.toContain('YWJj')
    expect(store.list({ query: '需求.txt' }).total).toBe(1)
    store.close()
    const reopened = new TaskStore(file)
    expect(reopened.get(task.id)?.content).toEqual(content)
    expect(reopened.readAttachments(task.id, task.version)).toEqual([{ id: attachment.id, data: 'YWJj' }])
    const changed = reopened.update({ id: task.id, version: task.version, status: 'in_progress' })
    expect(changed.content).toEqual(content)
    expect(() => reopened.readAttachments(task.id, task.version)).toThrow('task changed')
    reopened.delete(changed.id, changed.version)
    expect(reopened.db.prepare('SELECT * FROM task_attachments').all()).toHaveLength(0)
    reopened.close()
  })

  it('keeps row and bytes atomic, refuses foreign attachments and cleans removed bytes', () => {
    const store = new TaskStore(fixture())
    expect(() => store.create({ title: 'Missing', content })).toThrow('bytes missing')
    expect(store.list().total).toBe(0)
    expect(() => store.create({ title: 'Wrong size', content, attachments: [{ id: attachment.id, data: 'YQ==' }] })).toThrow('size mismatch')
    const task = store.create({ title: 'Valid', content, attachments: [{ id: attachment.id, data: 'YWJj' }] })
    expect(() => store.create({ title: 'Steal', content })).toThrow('another task')
    expect(() => store.update({ id: task.id, version: task.version, content, attachments: [{ id: attachment.id, data: 'YWJj' }] })).toThrow('immutable')
    expect(store.get(task.id)?.version).toBe(1)
    const removed = store.update({ id: task.id, version: task.version, content: { version: 1, blocks: [] } })
    expect(store.readAttachments(removed.id, removed.version)).toEqual([])
    expect(store.db.prepare('SELECT * FROM task_attachments').all()).toHaveLength(0)
    store.close()
  })

  it('preserves notes written by a stale text-only Host after schema migration', () => {
    const store = new TaskStore(fixture())
    try {
      const task = store.create({ title: 'Legacy', notes: 'body\nimage.png' })
      store.db.prepare('UPDATE tasks SET content = ? WHERE id = ?').run('{"version":1,"blocks":[]}', task.id)
      expect(store.get(task.id)?.content.blocks[0]).toEqual({ type: 'paragraph', children: [{ text: 'body' }] })
      const launched = store.update({ id: task.id, version: task.version, status: 'in_progress' })
      expect(launched.notes).toBe('body\nimage.png')
      expect(launched.content.blocks).toHaveLength(2)
      expect(store.readAttachments(task.id, launched.version)).toEqual([])
    } finally { store.close() }
  })

  it('migrates v4 content literally without altering row versions or times', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const task = store.create({ title: 'Legacy', notes: '<b>literal</b>\n\n第二行' })
    store.close()
    const legacy = new DatabaseSync(file)
    legacy.exec(`DROP TABLE task_attachments; ALTER TABLE tasks DROP COLUMN content;${DROP_SYNC_TABLES} PRAGMA user_version = 4;`)
    legacy.close()
    const migrated = new TaskStore(file)
    expect(migrated.get(task.id)).toEqual(task)
    expect(migrated.get(task.id)?.content.blocks[0]).toEqual({ type: 'paragraph', children: [{ text: '<b>literal</b>' }] })
    migrated.close()
  })
})

describe('schema6 migration and safety', () => {
  const attachment = { type: 'attachment' as const, id: '44444444-4444-4444-8444-444444444444', name: '需求.txt', mediaType: 'text/plain', bytes: 3 }
  const rich = {
    version: 1 as const,
    blocks: [
      { type: 'heading' as const, children: [{ text: '标题', marks: ['bold' as const] }] },
      { type: 'paragraph' as const, children: [{ text: '链接', href: 'https://example.com' }] },
      { type: 'table' as const, rows: [[{ blocks: [{ type: 'paragraph' as const, children: [{ text: '单元格' }] }] }]] },
      attachment,
    ],
  }

  it('migrates a real v5 database to 6 preserving rich content and attachment bytes', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const task = store.create({ title: '富文本', content: rich, attachments: [{ id: attachment.id, data: 'YWJj' }] })
    store.close()

    const legacy = new DatabaseSync(file)
    legacy.exec(`${DROP_SYNC_TABLES} PRAGMA user_version = 5;`)
    legacy.close()

    const migrated = new TaskStore(file)
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    expect(migrated.get(task.id)).toEqual(task)
    expect(migrated.readAttachments(task.id, task.version)).toEqual([{ id: attachment.id, data: 'YWJj' }])
    migrated.close()
  })

  it('rejects a database newer than schema9 before any alteration', () => {
    const file = fixture()
    const store = new TaskStore(file)
    store.create({ title: 'Keep' })
    store.close()
    const future = new DatabaseSync(file)
    future.exec('PRAGMA user_version = 10;')
    future.close()
    expect(() => new TaskStore(file)).toThrow('unsupported task database version: 10')
    const check = new DatabaseSync(file)
    expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(10)
    expect((check.prepare('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }).c).toBe(1)
    check.close()
  })

  it('rolls back the whole migration when the schema6 DDL fails', () => {
    const file = fixture()
    const store = new TaskStore(file)
    store.create({ title: 'Keep', notes: 'body' })
    store.close()
    const legacy = new DatabaseSync(file)
    legacy.exec(`${DROP_SYNC_TABLES} PRAGMA user_version = 5; CREATE TABLE sync_connections (id TEXT PRIMARY KEY) STRICT;`)
    legacy.close()
    expect(() => new TaskStore(file)).toThrow('already exists')
    const check = new DatabaseSync(file)
    expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(5)
    expect((check.prepare('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }).c).toBe(1)
    const syncTables = check.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'sync_%'").all() as { name: string }[]
    expect(syncTables.map(row => row.name)).toEqual(['sync_connections'])
    check.close()
  })
})

describe('schema7 migration from schema6', () => {
  const attachment = { type: 'attachment' as const, id: '44444444-4444-4444-8444-444444444444', name: '需求.txt', mediaType: 'text/plain', bytes: 3 }
  const rich = { version: 1 as const, blocks: [
    { type: 'paragraph' as const, children: [{ text: '正文' }] }, attachment,
  ] }

  const tapdInput: CreateConnectionRequest = { platform: 'tapd', name: 'TAPD', companyId: '20000001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', enabled: false }
  function ruleInput(connectionId: string): CreateSyncRuleRequest {
    return {
      connectionId, projectId: '20000001', workspaceId: null, enabled: false,
      filters: { assignees: [], typeIds: ['story'], iterationIds: [], statusIds: [] },
      mappings: [{ typeId: 'story', category: 'story', readStates: { open: 'todo', doing: 'in_progress', done: 'done' }, writeStates: { todo: 'open', in_progress: 'doing', done: 'done' }, optionalFields: [], fieldIds: { title: 'name', status: 'status' }, valueMaps: {} }],
    }
  }
  function fakeClock(initial = 1_700_000_000_000): Clock {
    return { now: () => initial, sleep: async () => {} }
  }
  const pushPlan: SyncPlan = { kind: 'push', localPatch: {}, remotePatch: { title: 'Pushed title' }, selectedFields: ['title'] }

  function buildOldV6Data(file: string): { taskId: string; intentId: string; linkId: string; runId: string } {
    const store = new TaskStore(file)
    const task = store.create({ title: '富文本', content: rich, attachments: [{ id: attachment.id, data: 'YWJj' }] })
    const clock = fakeClock()
    const config = new SyncConfigStore(store.db, () => ({}))
    const connection = config.createConnection(tapdInput)!
    const rule = config.createRule(ruleInput(connection.id))!
    const links = new SyncLinkStore(store.db, store, clock)
    const runs = new SyncRunStore(store.db, clock)
    const fence = runs.claimRun('owner-1', clock.now()).fence
    const item = remote()
    const imported = links.importItem(item, rule, fence)
    const link = links.getLink(item.key)!
    const intent = links.prepareIntent({ fence, link, task: imported, observed: item, rule, plan: pushPlan })
    links.markDispatched(intent.id, fence)
    links.recordUnknown(intent.id, fence, syncError('WriteOutcomeUnknown'))
    store.close()
    return { taskId: task.id, intentId: intent.id, linkId: link.id, runId: fence.runId }
  }

  /** Rewrite the two changed tables back to the schema-6 shape and set user_version = 6. */
  function downgradeToOldV6(file: string, options: { secondRun?: boolean; renameCollision?: boolean; partialAudit?: boolean } = {}): void {
    const db = new DatabaseSync(file)
    db.exec('PRAGMA foreign_keys = OFF;')
    db.exec(`
      ALTER TABLE sync_write_intents DROP COLUMN confirmed_run_id;
      ALTER TABLE sync_write_intents DROP COLUMN confirmed_owner_id;
      ALTER TABLE sync_write_intents DROP COLUMN confirmed_generation;
      ALTER TABLE sync_run_lock RENAME TO sync_run_lock_new;
      CREATE TABLE sync_run_lock (
        run_id TEXT PRIMARY KEY REFERENCES sync_runs(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL,
        generation INTEGER NOT NULL CHECK(generation >= 0)
      ) STRICT;
      INSERT INTO sync_run_lock (run_id, owner_id, generation) SELECT run_id, owner_id, generation FROM sync_run_lock_new;
      DROP TABLE sync_run_lock_new;`)
    if (options.secondRun) {
      db.prepare(`INSERT INTO sync_runs (id, status, phase, started_at) VALUES ('run-2', 'running', 'discovering', 1700000000000)`).run()
      db.prepare(`INSERT INTO sync_run_lock (run_id, owner_id, generation) VALUES ('run-2', 'owner-2', 1)`).run()
    }
    if (options.partialAudit) db.exec('ALTER TABLE sync_write_intents ADD COLUMN confirmed_run_id TEXT')
    if (options.renameCollision) db.exec('CREATE TABLE sync_run_lock_v6 (x TEXT)')
    db.exec('PRAGMA user_version = 6;')
    db.close()
  }

  it('migrates an old v6 database to 7 preserving intents, content, bytes, and claims a fresh owner', () => {
    const file = fixture()
    const built = buildOldV6Data(file)
    downgradeToOldV6(file, { secondRun: true })

    const migrated = new TaskStore(file)
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    // rich content and attachment bytes survive unchanged
    expect(migrated.get(built.taskId)?.content).toEqual(rich)
    expect(migrated.readAttachments(built.taskId, 1)).toEqual([{ id: attachment.id, data: 'YWJj' }])
    // the unknown intent (and its link) are preserved, not dropped
    expect(migrated.db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(built.intentId)).toEqual({ phase: 'unknown' })
    expect(migrated.db.prepare('SELECT id FROM sync_links WHERE id = ?').get(built.linkId)).toEqual({ id: built.linkId })

    // the rebuilt singleton lock holds no active owner; both old running runs are interrupted
    const clock = fakeClock()
    const runs = new SyncRunStore(migrated.db, clock)
    const claim = runs.claimRun('owner-new', clock.now())
    expect(claim.existing).toBe(false)
    expect(claim.fence.runId).not.toBe(built.runId)
    expect(runs.getRun(built.runId)?.status).toBe('interrupted')
    expect(runs.getRun('run-2')?.status).toBe('interrupted')
    migrated.close()
  })

  it('treats an already-new-shape v6 database as idempotent (bump to 7 without rebuilding)', () => {
    const file = fixture()
    const store = new TaskStore(file)
    store.create({ title: 'Keep' })
    store.close()
    const legacy = new DatabaseSync(file)
    legacy.exec('PRAGMA user_version = 6;')
    legacy.close()

    const migrated = new TaskStore(file)
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    expect(migrated.list().total).toBe(1)
    migrated.close()

    const again = new TaskStore(file)
    expect((again.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    expect(again.list().total).toBe(1)
    again.close()
  })

  it('rejects an unknown sync table shape as a storage failure without altering the database', () => {
    const file = fixture()
    buildOldV6Data(file)
    downgradeToOldV6(file, { partialAudit: true })
    try {
      new TaskStore(file)
      throw new Error('expected migration to reject')
    } catch (error) {
      expect((error as { details?: { code?: string } }).details?.code).toBe('StorageFailure')
    }
    const check = new DatabaseSync(file)
    expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(6)
    check.close()
  })

  it('rolls back the whole v6-to-7 migration when a mid-migration DDL step fails', () => {
    const file = fixture()
    const built = buildOldV6Data(file)
    downgradeToOldV6(file, { renameCollision: true })

    expect(() => new TaskStore(file)).toThrow('already another table')
    const check = new DatabaseSync(file)
    expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(6)
    // the added audit columns were rolled back
    const intentColumns = (check.prepare('PRAGMA table_info(sync_write_intents)').all() as { name: string }[]).map(row => row.name)
    expect(intentColumns).not.toContain('confirmed_run_id')
    // the old lock shape is intact and the running run was not interrupted
    const lockColumns = (check.prepare('PRAGMA table_info(sync_run_lock)').all() as { name: string }[]).map(row => row.name)
    expect(lockColumns).toContain('run_id')
    expect(lockColumns).not.toContain('id')
    expect((check.prepare('SELECT status FROM sync_runs WHERE id = ?').get(built.runId) as { status: string }).status).toBe('running')
    check.close()
  })
})

describe('schema8 migration from schema7', () => {
  const tapdInput: CreateConnectionRequest = { platform: 'tapd', name: 'TAPD', companyId: '20000001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', enabled: false }
  function ruleInput(connectionId: string): CreateSyncRuleRequest {
    return {
      connectionId, projectId: '20000001', workspaceId: null, enabled: false,
      filters: { assignees: [], typeIds: ['story'], iterationIds: [], statusIds: [] },
      mappings: [{ typeId: 'story', category: 'story', readStates: { open: 'todo', doing: 'in_progress', done: 'done' }, writeStates: { todo: 'open', in_progress: 'doing', done: 'done' }, optionalFields: [], fieldIds: { title: 'name', status: 'status' }, valueMaps: {} }],
    }
  }
  function fakeClock(initial = 1_700_000_000_000): Clock {
    return { now: () => initial, sleep: async () => {} }
  }
  const pushPlan: SyncPlan = { kind: 'push', localPatch: {}, remotePatch: { title: 'Pushed title' }, selectedFields: ['title'] }

  it('adds the pending column and backfills from error codes and unresolved intents', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const clock = fakeClock()
    const config = new SyncConfigStore(store.db, () => ({}))
    const connection = config.createConnection(tapdInput)!
    const rule = config.createRule(ruleInput(connection.id))!
    const links = new SyncLinkStore(store.db, store, clock)
    const runs = new SyncRunStore(store.db, clock)
    const fence = runs.claimRun('owner-1', clock.now()).fence

    // Row A: a pending error code alone marks the item pending.
    const itemA = remote()
    runs.recordResult(fence, { key: itemA.key, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('WriteOutcomeUnknown') })

    // Row B: a StorageFailure with a still-unresolved intent marks pending via correlation.
    const itemB = remote({ key: { ...remote().key, id: 'item-b' } })
    const taskB = links.importItem(itemB, rule, fence)
    const linkB = links.getLink(itemB.key)!
    const intentB = links.prepareIntent({ fence, link: linkB, task: taskB, observed: itemB, rule, plan: pushPlan })
    links.markDispatched(intentB.id, fence)
    runs.recordResult(fence, { key: itemB.key, taskId: taskB.id, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('StorageFailure') }, true)

    // Row C: a clean imported item stays not pending.
    const itemC = remote({ key: { ...remote().key, id: 'item-c' } })
    runs.recordResult(fence, { key: itemC.key, taskId: null, category: 'imported', changedFields: ['title'], discardedFields: [], writtenBack: false, outsideFilter: false, error: null })

    store.close()

    // Downgrade the run_items table back to the schema-7 shape and reset the version.
    const legacy = new DatabaseSync(file)
    const columns = (legacy.prepare('PRAGMA table_info(sync_run_items)').all() as { name: string }[]).map(row => row.name)
    if (columns.includes('pending')) legacy.exec('ALTER TABLE sync_run_items DROP COLUMN pending')
    legacy.exec('PRAGMA user_version = 7;')
    legacy.close()

    const migrated = new TaskStore(file)
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    const migratedColumns = (migrated.db.prepare('PRAGMA table_info(sync_run_items)').all() as { name: string }[]).map(row => row.name)
    expect(migratedColumns).toContain('pending')
    const pendingByCanonical = new Map((migrated.db.prepare('SELECT canonical, pending FROM sync_run_items').all() as { canonical: string; pending: number }[]).map(row => [row.canonical, row.pending]))
    expect(pendingByCanonical.get(serializeRemoteKey(itemA.key))).toBe(1)
    expect(pendingByCanonical.get(serializeRemoteKey(itemB.key))).toBe(1)
    expect(pendingByCanonical.get(serializeRemoteKey(itemC.key))).toBe(0)
    // the unresolved intent is preserved, never dropped
    expect(migrated.db.prepare('SELECT phase FROM sync_write_intents WHERE id = ?').get(intentB.id)).toEqual({ phase: 'dispatched' })
    migrated.close()
  })

  it('scopes the error-code backfill to its own run so a later clean run is not over-marked pending', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const clock = fakeClock()
    const config = new SyncConfigStore(store.db, () => ({}))
    const connection = config.createConnection(tapdInput)!
    const rule = config.createRule(ruleInput(connection.id))!
    const runs = new SyncRunStore(store.db, clock)

    // The same remote item recurs across runs (linked items are re-scanned each run).
    const shared = remote().key

    // Run A: the item failed with a pending error code.
    const fenceA = runs.claimRun('owner-1', clock.now()).fence
    runs.recordResult(fenceA, { key: shared, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('WriteOutcomeUnknown') })
    runs.finishRun(fenceA, 'completed', { discoveryComplete: true, unprocessedKnown: null, errors: [] })

    // Run B: a later run reconciled the same item cleanly (pushed, no error).
    const fenceB = runs.claimRun('owner-2', clock.now()).fence
    runs.recordResult(fenceB, { key: shared, taskId: null, category: 'pushed', changedFields: ['title'], discardedFields: [], writtenBack: true, outsideFilter: false, error: null })
    runs.finishRun(fenceB, 'completed', { discoveryComplete: true, unprocessedKnown: null, errors: [] })

    // Run C: another run failed verification on the same item.
    const fenceC = runs.claimRun('owner-3', clock.now()).fence
    runs.recordResult(fenceC, { key: shared, taskId: null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter: false, error: syncError('VerificationFailed') })

    store.close()

    // Downgrade the run_items table back to the schema-7 shape and reset the version.
    const legacy = new DatabaseSync(file)
    const columns = (legacy.prepare('PRAGMA table_info(sync_run_items)').all() as { name: string }[]).map(row => row.name)
    if (columns.includes('pending')) legacy.exec('ALTER TABLE sync_run_items DROP COLUMN pending')
    legacy.exec('PRAGMA user_version = 7;')
    legacy.close()

    const migrated = new TaskStore(file)
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(9)
    const canonical = serializeRemoteKey(shared)
    const pendingFor = (runId: string) => (migrated.db.prepare('SELECT pending FROM sync_run_items WHERE run_id = ? AND canonical = ?').get(runId, canonical) as { pending: number }).pending
    const errorFor = (runId: string) => {
      const row = migrated.db.prepare('SELECT error FROM sync_run_items WHERE run_id = ? AND canonical = ?').get(runId, canonical) as { error: string | null }
      return row.error === null ? null : (JSON.parse(row.error) as { code: string }).code
    }
    // The failing runs are pending; the clean later run must stay not pending.
    expect(pendingFor(fenceA.runId)).toBe(1)
    expect(pendingFor(fenceB.runId)).toBe(0)
    expect(pendingFor(fenceC.runId)).toBe(1)
    // Original evidence is preserved, never rewritten.
    expect(errorFor(fenceA.runId)).toBe('WriteOutcomeUnknown')
    expect(errorFor(fenceB.runId)).toBeNull()
    expect(errorFor(fenceC.runId)).toBe('VerificationFailed')
    migrated.close()
  })
})

describe('searching and paging tasks', () => {
  it('clamps the page to the matching rows and reports the unpaged total', () => {
    const store = new TaskStore(fixture())
    for (let index = 0; index < 25; index += 1) store.create({ title: `Task ${index}`, notes: `body ${index}` })
    const first = store.list({ pageSize: 10 })
    expect(first).toMatchObject({ total: 25, page: 1, pageSize: 10 })
    expect(first.items).toHaveLength(10)
    const third = store.list({ page: 3, pageSize: 10 })
    expect(third.items).toHaveLength(5)
    expect(store.list({ page: 99, pageSize: 10 }).page).toBe(3)
    expect(store.list({ page: 1, pageSize: 10 }).items.map(row => row.id))
      .toEqual(store.list({ page: 1, pageSize: 10 }).items.map(row => row.id))
    store.close()
  })

  it('matches content, titles, session ids, and subtasks, treating wildcards literally', () => {
    const store = new TaskStore(fixture())
    const target = store.create({ title: 'Database rollout', notes: 'Check the migration plan' })
    const other = store.create({ title: 'Unrelated', notes: 'Another item' })
    store.update({ id: target.id, version: target.version, sessionId: 'session-abc' })
    store.createSubtask({ taskId: target.id, notes: 'Confirm API fields' })
    const wildcard = store.create({ title: 'Percent', notes: '100% done' })

    expect(store.list({ query: 'migration plan' }).items.map(row => row.id)).toEqual([target.id])
    expect(store.list({ query: 'Database' }).items.map(row => row.id)).toEqual([target.id])
    expect(store.list({ query: 'session-abc' }).items.map(row => row.id)).toEqual([target.id])
    expect(store.list({ query: 'Confirm API' }).items.map(row => row.id)).toEqual([target.id])
    expect(store.list({ query: 'nothing' }).items).toEqual([])
    expect(store.list({ query: '100%' }).items.map(row => row.id)).toEqual([wildcard.id])
    expect(store.list({ query: '%' }).total).toBe(1)
    expect(store.list({ query: '  ' }).total).toBe(3)
    expect(() => store.list({ query: 'x'.repeat(201) })).toThrow('search query')
    expect(other.id).not.toBe(target.id)
    store.close()
  })

  it('pages within one status and one workspace, including rows without a workspace', () => {
    const store = new TaskStore(fixture())
    const linked = store.create({ title: 'Linked', notes: 'a', workspaceId: 'ws-1' })
    const unlinked = store.create({ title: 'Unlinked', notes: 'b' })
    const other = store.create({ title: 'Other', notes: 'c', workspaceId: 'ws-2' })
    store.update({ id: linked.id, version: linked.version, status: 'in_progress' })

    expect(store.list({ status: 'in_progress' }).items.map(row => row.id)).toEqual([linked.id])
    expect(store.list({ workspaceId: 'ws-1' }).items.map(row => row.id)).toEqual([linked.id])
    expect(store.list({ workspaceId: 'ws-2' }).items.map(row => row.id)).toEqual([other.id])
    expect(store.list({ workspaceId: 'ws-1', includeUnassigned: true }).items.map(row => row.id).sort())
      .toEqual([linked.id, unlinked.id].sort())
    expect(store.list({ includeUnassigned: true }).items.map(row => row.id)).toEqual([unlinked.id])
    expect(() => store.list({ pageSize: 1_000 })).toThrow('page size')
    expect(() => store.list({ page: 0 })).toThrow('page')
    store.close()
  })
})

describe('subtasks', () => {
  it('lists completions inside a half-open range for the statistics report', () => {
    const store = new TaskStore(fixture())
    const pointful = store.create({ title: 'Ship', storyPoints: 5 })
    const plain = store.create({ title: 'Triage' })
    const untouched = store.create({ title: 'Still open' })
    expect(store.listCompletions(0, Date.now() + 1000)).toEqual([])

    store.update({ id: pointful.id, version: pointful.version, status: 'done' })
    store.update({ id: plain.id, version: plain.version, status: 'done' })
    const done = store.get(pointful.id)!.completedAt!
    const rows = store.listCompletions(done - 1000, done + 1000)
    expect(rows).toHaveLength(2)
    // A task without story points is still a completion, worth zero points.
    expect(rows.map(row => row.points).sort((a, b) => a - b)).toEqual([0, 5])
    expect(rows.every(row => row.time >= done - 1000 && row.time < done + 1000)).toBe(true)

    // The range is half-open and only a completion timestamp qualifies.
    expect(store.listCompletions(done + 60_000, done + 61_000)).toEqual([])
    expect(store.get(untouched.id)?.completedAt).toBeNull()
    store.close()
  })

  it('stores rows per task and returns them with the task', () => {
    const store = new TaskStore(fixture())
    const task = store.create({ title: 'Ship' })
    const first = store.createSubtask({ taskId: task.id, notes: 'Write tests' })
    const second = store.createSubtask({ taskId: task.id, notes: 'Tag release', status: 'in_progress', sessionId: 'session-7' })
    expect(first).toMatchObject({ taskId: task.id, status: 'todo', sessionId: null, version: 1 })
    expect(store.list().items[0]?.subtasks.map(row => row.notes)).toEqual(['Write tests', 'Tag release'])
    expect(store.get(task.id)?.subtasks.map(row => row.notes)).toEqual(['Write tests', 'Tag release'])
    expect(store.listSubtasks(task.id)).toHaveLength(2)
    expect(second.sessionId).toBe('session-7')

    const linked = store.updateSubtask({ id: first.id, version: first.version, sessionId: 'session-9', status: 'done' })
    expect(linked).toMatchObject({ sessionId: 'session-9', status: 'done', version: 2 })
    expect(store.get(task.id)?.subtasks[0]?.sessionId).toBe('session-9')
    store.close()
  })

  it('rejects stale subtask writes and removes rows with their task', () => {
    const store = new TaskStore(fixture())
    const task = store.create({ title: 'Ship' })
    const subtask = store.createSubtask({ taskId: task.id, notes: 'Write tests' })
    const updated = store.updateSubtask({ id: subtask.id, version: subtask.version, notes: 'Write more tests' })
    expect(() => store.updateSubtask({ id: subtask.id, version: subtask.version, notes: 'Stale' })).toThrow('subtask changed')
    expect(() => store.deleteSubtask(subtask.id, subtask.version)).toThrow('subtask missing or changed')
    expect(store.get(task.id)?.subtasks[0]?.notes).toBe('Write more tests')

    expect(() => store.createSubtask({ taskId: task.id, notes: '   ' })).toThrow('subtask content')
    expect(() => store.createSubtask({ taskId: '11111111-1111-4111-8111-111111111111', notes: 'Orphan' })).toThrow('task not found')

    store.delete(task.id, task.version)
    expect(store.listSubtasks(task.id)).toEqual([])
    expect(store.list().total).toBe(0)
    store.close()
  })
})
