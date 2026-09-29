import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'

const roots: string[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-'))
  roots.push(root)
  return join(root, 'task-list', 'tasks.sqlite')
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

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
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(4)
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
    legacy.exec('DROP TABLE subtasks; PRAGMA user_version = 3;')
    legacy.close()

    const migrated = new TaskStore(file)
    expect(migrated.list().items.map(row => row.title)).toEqual(['Existing'])
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(4)
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
