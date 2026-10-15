import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import type { TaskGraph, TaskGraphNode, TaskRecord } from '../src/types.ts'

const roots: string[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-graph-'))
  roots.push(root)
  return join(root, 'task-list', 'tasks.sqlite')
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }) })

function nodeOf(graph: TaskGraph, id: string): TaskGraphNode {
  const node = graph.nodes.find(candidate => candidate.task.id === id)
  if (node === undefined) throw new Error(`graph has no node ${id}`)
  return node
}

/** Every edge of one graph as `kind:from->to`, so a whole graph reads in one assertion. */
function edgesOf(graph: TaskGraph): string[] {
  const edges: string[] = []
  for (const node of graph.nodes) {
    for (const parent of node.parents) edges.push(`parent:${parent}->${node.task.id}`)
    for (const target of node.waitsOn) edges.push(`waitsOn:${node.task.id}->${target}`)
  }
  return edges.sort()
}

/** Rewrite a current database back into the exact version-14 shape its predecessor left. */
function downgradeTasksToV14(file: string): void {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = OFF;')
  db.exec(`CREATE TABLE tasks_v14 (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    story_points INTEGER CHECK(story_points IS NULL OR story_points BETWEEN 0 AND 1000),
    tags TEXT NOT NULL DEFAULT '[]',
    workspace_id TEXT,
    send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1)),
    session_id TEXT,
    agent TEXT,
    use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1)),
    started_at INTEGER,
    completed_at INTEGER,
    version INTEGER NOT NULL CHECK(version >= 1),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
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

describe('relations and the four-state status', () => {
  it('round-trips a parent and a wait-on set through every read path', () => {
    const store = new TaskStore(fixture())
    const parent = store.create({ title: 'Parent' })
    const first = store.create({ title: 'First blocker' })
    const second = store.create({ title: 'Second blocker' })
    const child = store.create({ title: 'Child', parentId: parent.id, blockingIds: [second.id, first.id] })

    expect(child.parentId).toBe(parent.id)
    expect(child.blockingIds).toEqual([second.id, first.id])
    expect(store.get(child.id)).toEqual(child)
    expect(store.list().items.find(task => task.id === child.id)).toEqual(child)

    expect(store.relations(child.id)).toEqual({ taskId: child.id, parentId: parent.id, blockingIds: [second.id, first.id] })
    expect(store.relations(parent.id)).toEqual({ taskId: parent.id, parentId: null, blockingIds: [] })
    expect(store.listTaskRelations()).toHaveLength(4)
    expect(store.listTaskRelations().find(relation => relation.taskId === child.id)?.blockingIds).toEqual([second.id, first.id])

    // A replacement is whole-set and keeps the order it was given; duplicates collapse.
    const reseeded = store.update({ id: child.id, version: child.version, blockingIds: [first.id, first.id, second.id] })
    expect(reseeded.blockingIds).toEqual([first.id, second.id])
    const cleared = store.update({ id: reseeded.id, version: reseeded.version, blockingIds: [] })
    expect(cleared.blockingIds).toEqual([])
    // An omitted field keeps what is stored; an explicit null clears the parent.
    const reparented = store.update({ id: cleared.id, version: cleared.version, title: 'Child edited' })
    expect(reparented.parentId).toBe(parent.id)
    expect(store.update({ id: reparented.id, version: reparented.version, parentId: null }).parentId).toBeNull()
    store.close()
  })

  it('validates parent and wait-on references before storing them', () => {
    const store = new TaskStore(fixture())
    const task = store.create({ title: 'Task' })
    const other = store.create({ title: 'Other' })
    const missing = '99999999-9999-4999-8999-999999999999'

    expect(() => store.create({ title: 'Orphan', parentId: missing })).toThrow('parent task not found')
    expect(() => store.create({ title: 'Bad parent', parentId: 'nope' })).toThrow('invalid task id')
    expect(() => store.create({ title: 'Bad blocker', blockingIds: ['nope'] })).toThrow('invalid task id')
    expect(() => store.create({ title: 'Orphan blocker', blockingIds: [missing] })).toThrow('blocking task not found')
    expect(() => store.create({ title: 'Too many', blockingIds: Array.from({ length: 41 }, (_, index) => `${index}`.padStart(8, '0') + '-0000-4000-8000-000000000000') }))
      .toThrow('at most 40')
    expect(() => store.update({ id: task.id, version: task.version, parentId: task.id })).toThrow('task hierarchy would contain a cycle')
    expect(() => store.update({ id: task.id, version: task.version, blockingIds: [task.id] })).toThrow('task dependency would contain a cycle')
    // A refused create leaves no half-linked row behind.
    expect(store.list().total).toBe(2)
    expect(store.get(task.id)).toEqual(task)
    expect(other.parentId).toBeNull()
    store.close()
  })

  it('refuses a parent chain and a wait-on closure that would close a cycle', () => {
    const store = new TaskStore(fixture())
    const root = store.create({ title: 'Root' })
    const middle = store.create({ title: 'Middle', parentId: root.id })
    const leaf = store.create({ title: 'Leaf', parentId: middle.id })
    // Root under its own grandchild.
    expect(() => store.update({ id: root.id, version: root.version, parentId: leaf.id })).toThrow('task hierarchy would contain a cycle')
    expect(store.get(root.id)?.parentId).toBeNull()
    // Middle cannot be moved under the leaf either.
    expect(() => store.update({ id: middle.id, version: middle.version, parentId: leaf.id })).toThrow('task hierarchy would contain a cycle')

    const first = store.create({ title: 'First' })
    const second = store.create({ title: 'Second' })
    const third = store.create({ title: 'Third' })
    const chained = store.update({ id: first.id, version: first.version, blockingIds: [second.id] })
    const deeper = store.update({ id: second.id, version: second.version, blockingIds: [third.id] })
    // Closing the ring at any depth is refused, and the refused write changed nothing.
    expect(() => store.update({ id: third.id, version: third.version, blockingIds: [first.id] })).toThrow('task dependency would contain a cycle')
    expect(() => store.update({ id: third.id, version: third.version, title: 'Renamed', blockingIds: [first.id] })).toThrow('task dependency would contain a cycle')
    expect(store.get(third.id)).toEqual(third)
    expect(store.relations(third.id)?.blockingIds).toEqual([])
    expect(chained.blockingIds).toEqual([second.id])
    expect(deeper.blockingIds).toEqual([third.id])
    store.close()
  })

  it('stores the local review gate and keeps it out of the checklist rows', () => {
    const store = new TaskStore(fixture())
    const task = store.create({ title: 'Waiting for review', status: 'approving' })
    expect(task.status).toBe('approving')
    expect(store.list({ status: 'approving' }).items.map(row => row.id)).toEqual([task.id])
    const released = store.update({ id: task.id, version: task.version, status: 'done' })
    expect(released.status).toBe('done')
    expect(released.completedAt).toEqual(expect.any(Number))
    expect(() => store.createSubtask({ taskId: task.id, notes: 'row', status: 'approving' })).toThrow('invalid subtask status')
    expect(() => store.updateSubtask({ id: store.createSubtask({ taskId: task.id, notes: 'row' }).id, version: 1, status: 'approving' })).toThrow('invalid subtask status')
    store.close()
  })
})

describe('relationship graph', () => {
  it('carries both edge kinds and derives blocked from the stored edges', () => {
    const store = new TaskStore(fixture())
    const parent = store.create({ title: 'Parent' })
    const blocker = store.create({ title: 'Blocker' })
    const finished = store.create({ title: 'Finished', status: 'done' })
    const child = store.create({ title: 'Child', parentId: parent.id, blockingIds: [blocker.id, finished.id] })
    const released = store.create({ title: 'Released', status: 'done', blockingIds: [blocker.id] })
    const graph = store.graph()

    expect(graph.truncated).toBe(false)
    expect(graph.nodes.map(node => node.task.id)).toHaveLength(5)
    expect(edgesOf(graph)).toEqual([
      `parent:${parent.id}->${child.id}`,
      `waitsOn:${child.id}->${blocker.id}`,
      `waitsOn:${child.id}->${finished.id}`,
      `waitsOn:${released.id}->${blocker.id}`,
    ].sort())

    const childNode = nodeOf(graph, child.id)
    expect(childNode.parents).toEqual([parent.id])
    expect(childNode.waitsOn).toEqual([blocker.id, finished.id])
    // A done task is never blocked, even while it waits on an open one.
    expect(childNode.blocked).toBe(true)
    expect(nodeOf(graph, released.id).blocked).toBe(false)
    expect(nodeOf(graph, blocker.id).blocked).toBe(false)
    expect(nodeOf(graph, parent.id).children).toEqual([child.id])

    // waitsOn and waitedOnBy are each other's reverse inside one result.
    for (const target of graph.nodes) {
      for (const source of graph.nodes) {
        expect(source.waitsOn.includes(target.task.id)).toBe(target.waitedOnBy.includes(source.task.id))
      }
    }
    store.close()
  })

  it('scopes the graph to the requested edges around one root', () => {
    const store = new TaskStore(fixture())
    const root = store.create({ title: 'Root' })
    const branch = store.create({ title: 'Branch', parentId: root.id })
    const twig = store.create({ title: 'Twig', parentId: branch.id })
    const sibling = store.create({ title: 'Sibling', parentId: root.id })
    const waiting = store.create({ title: 'Waiting' })
    store.update({ id: branch.id, version: branch.version, blockingIds: [waiting.id] })
    // A blocker the scoped request leaves out: it still blocks, it is just not drawn.
    const outside = store.create({ title: 'Outside' })
    const leaf = store.update({ id: twig.id, version: twig.version, blockingIds: [outside.id] })

    // No include flag: the root alone.
    const alone = store.graph({ rootId: root.id })
    expect(alone.nodes.map(node => node.task.id)).toEqual([root.id])
    expect(edgesOf(alone)).toEqual([])
    expect(nodeOf(alone, root.id).children).toEqual([])

    const down = store.graph({ rootId: root.id, includeDescendants: true })
    expect(down.nodes.map(node => node.task.id).sort()).toEqual([root.id, branch.id, twig.id, sibling.id].sort())
    expect(nodeOf(down, branch.id).parents).toEqual([root.id])
    expect(nodeOf(down, branch.id).children).toEqual([twig.id])
    // `waitsOn` is scoped to the result while the task keeps the stored set.
    expect(nodeOf(down, branch.id).waitsOn).toEqual([])
    expect(nodeOf(down, branch.id).task.blockingIds).toEqual([waiting.id])
    expect(nodeOf(down, branch.id).blocked).toBe(true)

    const up = store.graph({ rootId: leaf.id, includeAncestors: true })
    expect(up.nodes.map(node => node.task.id).sort()).toEqual([root.id, branch.id, twig.id].sort())
    expect(nodeOf(up, twig.id).parents).toEqual([branch.id])
    expect(nodeOf(up, root.id).parents).toEqual([])

    const blockers = store.graph({ rootId: branch.id, includeBlockers: true })
    expect(blockers.nodes.map(node => node.task.id).sort()).toEqual([branch.id, waiting.id].sort())
    expect(edgesOf(blockers)).toEqual([`waitsOn:${branch.id}->${waiting.id}`])
    // The waiting task blocks nobody, so its own blocker scope is only itself.
    expect(store.graph({ rootId: waiting.id, includeBlockers: true }).nodes.map(node => node.task.id)).toEqual([waiting.id])

    expect(() => store.graph({ rootId: '99999999-9999-4999-8999-999999999999' })).toThrow('task not found')
    expect(() => store.graph({ rootId: 'nope' })).toThrow('invalid task id')
    store.close()
  })

  it('cuts the node set at the requested cap and clamps the cap', () => {
    const store = new TaskStore(fixture())
    const tasks: TaskRecord[] = []
    for (let index = 0; index < 5; index += 1) tasks.push(store.create({ title: `Task ${index}` }))

    const full = store.graph()
    const cut = store.graph({ maxNodes: 3 })
    expect(cut.truncated).toBe(true)
    expect(cut.nodes.map(node => node.task.id)).toEqual(full.nodes.slice(0, 3).map(node => node.task.id))

    expect(store.graph({ maxNodes: 5 })).toMatchObject({ truncated: false })
    expect(store.graph({ maxNodes: 99 }).nodes).toHaveLength(5)
    expect(() => store.graph({ maxNodes: 0 })).toThrow('graph node limit')

    // The shared bound wins over a larger request: one past it is already cut.
    for (let index = 5; index < 401; index += 1) store.create({ title: `Task ${index}` })
    const clamped = store.graph({ maxNodes: 5_000 })
    expect(clamped.nodes).toHaveLength(400)
    expect(clamped.truncated).toBe(true)
    expect(store.graph().truncated).toBe(true)
    expect(tasks).toHaveLength(5)
    store.close()
  })

  it('counts the overview by status, blocking, and session', () => {
    const store = new TaskStore(fixture())
    const open = store.create({ title: 'Open', sessionId: 'session-a' })
    const active = store.create({ title: 'Active', status: 'in_progress', sessionId: 'session-b' })
    const review = store.create({ title: 'Review', status: 'approving', sessionId: 'session-a' })
    const finished = store.create({ title: 'Finished', status: 'done', sessionId: 'session-c' })
    const waiting = store.create({ title: 'Waiting', blockingIds: [open.id] })
    const released = store.create({ title: 'Released', status: 'done', blockingIds: [open.id] })
    // Stamp the clock so the session order is decided by data, not by timing.
    const stamp = store.db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?')
    stamp.run(100, open.id)
    stamp.run(400, active.id)
    stamp.run(300, review.id)
    stamp.run(200, finished.id)

    expect(store.overview()).toEqual({
      counts: { todo: 2, in_progress: 1, approving: 1, done: 2 },
      total: 6,
      blocked: 1,
      sessionIds: ['session-b', 'session-a', 'session-c'],
    })
    expect(waiting.status).toBe('todo')
    expect(released.blockingIds).toEqual([open.id])
    store.close()
  })

  it('detaches children and drops the edges of a deleted task', () => {
    const store = new TaskStore(fixture())
    const parent = store.create({ title: 'Parent' })
    const child = store.create({ title: 'Child', parentId: parent.id })
    const sibling = store.create({ title: 'Sibling', blockingIds: [parent.id, child.id] })
    const subtask = store.createSubtask({ taskId: parent.id, notes: 'row' })

    store.delete(parent.id, parent.version)
    expect(store.get(parent.id)).toBeNull()
    expect(store.get(child.id)?.parentId).toBeNull()
    expect(store.get(sibling.id)?.blockingIds).toEqual([child.id])
    expect(store.listSubtasks(parent.id)).toEqual([])
    expect(store.db.prepare('SELECT COUNT(*) AS count FROM subtasks WHERE id = ?').get(subtask.id)).toEqual({ count: 0 })
    expect(store.db.prepare('SELECT COUNT(*) AS count FROM task_dependencies WHERE depends_on_id = ?').get(parent.id)).toEqual({ count: 0 })

    store.delete(child.id, child.version)
    expect(store.get(sibling.id)?.blockingIds).toEqual([])
    expect(store.relations(sibling.id)).toEqual({ taskId: sibling.id, parentId: null, blockingIds: [] })
    expect(() => store.relations(child.id)).toThrow('task not found')
    store.close()
  })
})

describe('version 15 migration from version 14', () => {
  const attachment = { type: 'attachment' as const, id: '55555555-5555-4555-8555-555555555555', name: '需求.txt', mediaType: 'text/plain', bytes: 3 }
  const rich = { version: 1 as const, blocks: [
    { type: 'heading' as const, children: [{ text: '检查需求' }] }, attachment,
  ] }

  it('upgrades a version-14 database in place without losing tasks, rows, or bytes', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const task = store.create({ title: 'Legacy', content: rich, attachments: [{ id: attachment.id, data: 'YWJj' }] })
    const done = store.create({ title: 'Legacy done', status: 'done' })
    const subtask = store.createSubtask({ taskId: task.id, notes: 'Confirm API fields' })
    const stored = store.get(task.id)!
    store.close()

    downgradeTasksToV14(file)
    const before = new DatabaseSync(file)
    expect((before.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(14)
    expect((before.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]).map(column => column.name)).not.toContain('parent_id')
    before.close()

    const migrated = new TaskStore(file)
    expect((migrated.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(15)
    // The row survives the rebuild field for field, with the new column at its default.
    expect(migrated.get(task.id)).toEqual(stored)
    expect(migrated.get(task.id)?.content).toEqual(rich)
    expect(migrated.readAttachments(task.id, task.version)).toEqual([{ id: attachment.id, data: 'YWJj' }])
    expect(migrated.get(done.id)).toMatchObject({ status: 'done', completedAt: done.completedAt })
    expect(migrated.get(task.id)?.subtasks.map(row => row.notes)).toEqual(['Confirm API fields'])
    expect(migrated.db.prepare('SELECT COUNT(*) AS count FROM subtasks WHERE id = ?').get(subtask.id)).toEqual({ count: 1 })
    expect(migrated.db.prepare('SELECT COUNT(*) AS count FROM task_attachments WHERE id = ?').get(attachment.id)).toEqual({ count: 1 })
    // The upgraded database accepts the new edges, and they survive a reopen.
    const child = migrated.create({ title: 'New child', parentId: task.id, blockingIds: [done.id] })
    expect(migrated.graph({ rootId: task.id, includeDescendants: true }).nodes.map(node => node.task.id).sort())
      .toEqual([task.id, child.id].sort())
    migrated.close()

    const reopened = new TaskStore(file)
    expect(reopened.get(child.id)).toEqual(child)
    expect(reopened.relations(child.id)).toEqual({ taskId: child.id, parentId: task.id, blockingIds: [done.id] })
    expect(reopened.get(task.id)?.parentId).toBeNull()
    reopened.close()
  })

  it('refuses an unknown tasks shape instead of rebuilding it heuristically', () => {
    const file = fixture()
    const store = new TaskStore(file)
    const task = store.create({ title: 'Keep' })
    store.close()

    const legacy = new DatabaseSync(file)
    legacy.exec('ALTER TABLE tasks ADD COLUMN invented TEXT; PRAGMA user_version = 14;')
    legacy.close()

    expect(() => new TaskStore(file)).toThrow('unrecognized tasks table')
    const check = new DatabaseSync(file)
    expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(14)
    expect((check.prepare('SELECT COUNT(*) AS count FROM tasks').get() as { count: number }).count).toBe(1)
    expect((check.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]).map(column => column.name)).toContain('invented')
    expect(check.prepare('SELECT title FROM tasks WHERE id = ?').get(task.id)).toEqual({ title: 'Keep' })
    check.close()

    // Opening the untouched current schema still works and lands on the same version.
    const untouched = fixture()
    mkdirSync(dirname(untouched), { recursive: true })
    const fresh = new TaskStore(untouched)
    expect((fresh.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(15)
    fresh.close()
  })
})
