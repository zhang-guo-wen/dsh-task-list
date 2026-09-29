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
    expect(reopened.list().map(task => task.title)).toEqual(['Write docs', 'Ship UI', 'Review copy'])
    expect(reopened.get(todo.id)?.notes).toBe('English and Chinese')
    expect(reopened.list('todo')).toHaveLength(1)
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
    expect(store.list()).toEqual([])
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
    expect(migrated.list()).toEqual([expect.objectContaining({
      title: 'Existing', status: 'done', version: 2, priority: 'medium',
      storyPoints: null, tags: [], workspaceId: null, startedAt: null, completedAt: null,
      sendImmediately: false, sessionId: null, agent: null, useWorktree: false,
    })])
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(3)
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
    const existing = store.list()[0]!
    expect(existing).toMatchObject({ sendImmediately: false, sessionId: null, agent: null, useWorktree: false })
    const updated = store.update({ id: existing.id, version: existing.version, sendImmediately: true, sessionId: 'session-1', agent: 'coder', useWorktree: true })
    expect(updated).toMatchObject({ sendImmediately: true, sessionId: 'session-1', agent: 'coder', useWorktree: true })
    expect(store.get(existing.id)).toEqual(updated)
    expect(() => store.update({ id: updated.id, version: updated.version, sendImmediately: 1 as never })).toThrow('boolean')
    store.close()
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
    expect(store.list()).toEqual([])
    store.close()

    const other = fixture()
    mkdirSync(dirname(other), { recursive: true })
    const db = new DatabaseSync(other)
    db.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY)')
    db.close()
    expect(() => new TaskStore(other)).toThrow('unrecognized tables')
  })
})
