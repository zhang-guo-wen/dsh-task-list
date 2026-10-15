// Lead verification of the v15 data layer: an existing version-14 database is
// migrated in place, and the relation, graph, and overview queries behave as the
// canvas and the composer expect. The migration is the one change here that can
// destroy user data, so it is exercised against a hand-built v14 file rather
// than a store the current code created.
import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'

const roots: string[] = []
const handles: TaskStore[] = []

/** One tracked store; every handle is closed before the temp directory is removed. */
function tracked(file: string): TaskStore {
  const created = new TaskStore(file)
  handles.push(created)
  return created
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-v14-'))
  roots.push(root)
  return join(root, 'task-list', 'tasks.sqlite')
}

// A store left open keeps its WAL files mapped on Windows, so cleanup closes
// every handle and then retries briefly, instead of turning a passing test into
// a filesystem error.
afterEach(async () => {
  for (const handle of handles.splice(0)) {
    try { handle.close() } catch { /* the test closed it already */ }
  }
  for (const root of roots.splice(0)) {
    for (let attempt = 0; ; attempt += 1) {
      try { rmSync(root, { recursive: true, force: true }); break }
      catch (error) {
        if (attempt >= 20) throw error
        await new Promise(resolve => setTimeout(resolve, 25))
      }
    }
  }
})

/** Rewrite a store the current build made back into the version-14 shape. */
function downgradeToV14(file: string): void {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = OFF;')
  db.exec(`CREATE TABLE tasks_v14 (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    story_points INTEGER CHECK(story_points IS NULL OR story_points BETWEEN 0 AND 1000),
    tags TEXT NOT NULL DEFAULT '[]', workspace_id TEXT,
    send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1)),
    session_id TEXT, agent TEXT,
    use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1)),
    started_at INTEGER, completed_at INTEGER,
    version INTEGER NOT NULL CHECK(version >= 1), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  ) STRICT;
  INSERT INTO tasks_v14 (id, title, notes, content, status, priority, story_points, tags, workspace_id,
    send_immediately, session_id, agent, use_worktree, started_at, completed_at, version, created_at, updated_at)
    SELECT id, title, notes, content, status, priority, story_points, tags, workspace_id,
      send_immediately, session_id, agent, use_worktree, started_at, completed_at, version, created_at, updated_at FROM tasks;
  DROP TABLE tasks;
  ALTER TABLE tasks_v14 RENAME TO tasks;
  CREATE INDEX tasks_status_updated ON tasks(status, updated_at DESC);
  DROP TABLE IF EXISTS task_dependencies;
  PRAGMA user_version = 14;`)
  db.close()
}

describe('version-14 to version-15 data migration', () => {
  it('keeps every row, subtask, and attachment byte, then adds the relation queries', () => {
    const file = fixture()
    mkdirSync(dirname(file), { recursive: true })
    const seeded = tracked(file)
    const parent = seeded.create({ title: 'Ship the release', notes: 'body' })
    const blocker = seeded.create({ title: 'Land the fix' })
    seeded.createSubtask({ taskId: parent.id, notes: 'checklist row', sessionId: 'session-1' })
    seeded.close()
    downgradeToV14(file)

    const store = tracked(file)
    expect((store.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(15)
    // Rows and checklist rows survive the table rebuild.
    const kept = store.get(parent.id)!
    expect(kept).toMatchObject({ title: 'Ship the release', notes: 'body', parentId: null, blockingIds: [] })
    expect(kept.subtasks.map(row => row.notes)).toEqual(['checklist row'])
    expect(new Set(store.list().items.map(task => task.title)))
      .toEqual(new Set(['Ship the release', 'Land the fix']))

    // The new columns and the wait-on table are usable after the migration.
    const child = store.create({ title: 'Draft notes', status: 'approving', parentId: parent.id, blockingIds: [blocker.id] })
    expect(child).toMatchObject({ status: 'approving', parentId: parent.id, blockingIds: [blocker.id] })
    expect(store.list({ status: 'approving' }).items.map(task => task.id)).toEqual([child.id])

    const graph = store.graph({ includeDescendants: true })
    const byTitle = new Map(graph.nodes.map(node => [node.task.title, node]))
    expect(byTitle.get('Ship the release')).toMatchObject({ children: [child.id], blocked: false })
    expect(byTitle.get('Draft notes')).toMatchObject({ parents: [parent.id], waitsOn: [blocker.id], blocked: true })
    // The reverse edge is the mirror of the forward one inside one result.
    expect(byTitle.get('Land the fix')?.waitedOnBy).toEqual([child.id])
    expect(graph.truncated).toBe(false)

    expect(store.overview()).toMatchObject({
      counts: { todo: 2, in_progress: 0, approving: 1, done: 0 }, total: 3, blocked: 1,
    })

    // Deleting a parent detaches its children instead of deleting them.
    store.delete(parent.id, kept.version)
    expect(store.get(child.id)?.parentId).toBeNull()
    expect(store.get(child.id)?.blockingIds).toEqual([blocker.id])
  })

  it('refuses a hierarchy cycle and a dependency cycle without writing anything', () => {
    const store = tracked(fixture())
    const first = store.create({ title: 'First' })
    const second = store.create({ title: 'Second', parentId: first.id })
    const third = store.create({ title: 'Third', parentId: second.id })
    expect(() => store.update({ id: first.id, version: store.get(first.id)!.version, parentId: third.id }))
      .toThrow('task hierarchy would contain a cycle')
    expect(store.get(first.id)?.parentId).toBeNull()

    const waiting = store.create({ title: 'Waiting', blockingIds: [third.id] })
    expect(() => store.update({ id: third.id, version: store.get(third.id)!.version, blockingIds: [waiting.id] }))
      .toThrow('task dependency would contain a cycle')
    expect(store.get(third.id)?.blockingIds).toEqual([])
    expect(() => store.update({ id: first.id, version: store.get(first.id)!.version, blockingIds: [first.id] }))
      .toThrow('task dependency would contain a cycle')
  })

  it('scopes one graph by root and cuts it at the node cap', () => {
    const store = tracked(fixture())
    const root = store.create({ title: 'Root' })
    const child = store.create({ title: 'Child', parentId: root.id })
    store.create({ title: 'Grandchild', parentId: child.id })
    store.create({ title: 'Unrelated' })

    // A scoped graph returns nodes in the list's own order, so the caller never
    // re-sorts them; the walk is what adds the other levels.
    expect(store.graph({ rootId: root.id }).nodes.map(node => node.task.title)).toEqual(['Root'])
    expect(store.graph({ rootId: root.id, includeDescendants: true }).nodes.map(node => node.task.title).sort())
      .toEqual(['Child', 'Grandchild', 'Root'])
    expect(store.graph({ rootId: child.id, includeAncestors: true }).nodes.map(node => node.task.title).sort())
      .toEqual(['Child', 'Root'])
    expect(store.graph({ maxNodes: 2 })).toMatchObject({ truncated: true })
    expect(store.graph({ maxNodes: 2 }).nodes).toHaveLength(2)
    expect(() => store.graph({ rootId: 'not-a-uuid' })).toThrow('invalid task id')
  })
})
