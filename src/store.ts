import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  DEFAULT_PAGE_SIZE, MAX_GRAPH_NODES, MAX_PAGE_SIZE, SEARCH_LIMIT, TASK_STATUSES,
  type CreateSubtaskRequest, type CreateTaskRequest, type DeleteSubtaskRequest, type GetTaskGraphRequest,
  type ListTasksRequest, type SubtaskRecord, type TaskGraph, type TaskGraphNode, type TaskOverview,
  type TaskPage, type TaskPriority, type TaskRecord, type TaskRelation, type TaskStatus,
  type UpdateSubtaskRequest, type UpdateTaskRequest,
} from './types.ts'

import { ATTACHMENT_BYTE_LIMIT, contentAttachments, contentText, textContent, validateContent } from './content.ts'
import type { TaskAttachmentUpload, TaskContent } from './types.ts'
import { withSqliteTransaction } from './sqlite-transaction.ts'
import { migrateSyncSchema, SYNC_SCHEMA_VERSION } from './sync/schema.ts'
import { statisticsSchema } from './statistics-store.ts'

const statuses = new Set<TaskStatus>(TASK_STATUSES)
/** Checklist rows carry no local review gate, so their CHECK stays three-state. */
const subtaskStatuses = new Set<TaskStatus>(TASK_STATUSES.filter(status => status !== 'approving'))
const priorities = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])
const titleLimit = 200
const notesLimit = 20_000
const subtaskNotesLimit = 2_000
/** Most tasks one task may wait on. */
const blockingLimit = 40

/** Current schema version; the store refuses anything newer. This is the sync
 * migration's own version, which writes the same `user_version`, so the two can
 * never drift apart. */
const schemaVersion = SYNC_SCHEMA_VERSION
/** Newest rows first inside each status group, with a stable id tie-break. */
const taskOrder = `ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1
  WHEN 'approving' THEN 2 ELSE 3 END, updated_at DESC, id`

function titleOf(value: unknown): string {
  if (typeof value !== 'string') throw new Error('title must be text')
  const title = value.trim()
  if (!title || title.length > titleLimit) throw new Error(`title must contain 1–${titleLimit} characters`)
  return title
}

function notesOf(value: unknown): string {
  if (typeof value !== 'string' || value.length > notesLimit) throw new Error(`notes must contain at most ${notesLimit} characters`)
  return value
}

function subtaskNotesOf(value: unknown): string {
  if (typeof value !== 'string') throw new Error('subtask content must be text')
  const notes = value.trim()
  if (!notes || notes.length > subtaskNotesLimit) {
    throw new Error(`subtask content must contain 1–${subtaskNotesLimit} characters`)
  }
  return notes
}

function statusOf(value: unknown): TaskStatus {
  if (!statuses.has(value as TaskStatus)) throw new Error('invalid task status')
  return value as TaskStatus
}

function subtaskStatusOf(value: unknown): TaskStatus {
  if (!subtaskStatuses.has(value as TaskStatus)) throw new Error('invalid subtask status')
  return value as TaskStatus
}

function priorityOf(value: unknown): TaskPriority {
  if (!priorities.has(value as TaskPriority)) throw new Error('invalid task priority')
  return value as TaskPriority
}

function storyPointsOf(value: unknown): number | null {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1000) {
    throw new Error('story points must be an integer from 0 to 1000')
  }
  return value as number
}

function tagsOf(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error('tags must contain at most 12 labels')
  const tags = value.map(tag => {
    if (typeof tag !== 'string') throw new Error('invalid task tag')
    const normalized = tag.trim()
    if (!normalized || normalized.length > 40) throw new Error('task tags must contain 1–40 characters')
    return normalized
  })
  if (new Set(tags.map(tag => tag.toLocaleLowerCase())).size !== tags.length) throw new Error('duplicate task tags')
  return tags
}

function workspaceIdOf(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\u0000-\u001f]/u.test(value)) {
    throw new Error('invalid workspace id')
  }
  return value
}

function optionalIdOf(value: unknown, field: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\u0000-\u001f]/u.test(value)) {
    throw new Error(`invalid ${field}`)
  }
  return value.trim()
}

function booleanOf(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`)
  return value
}

function idOf(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new Error('invalid task id')
  return value
}

function versionOf(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('invalid task version')
  return value as number
}

function queryOf(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Error('search query must be text')
  const query = value.trim()
  if (query.length > SEARCH_LIMIT) throw new Error(`search query must contain at most ${SEARCH_LIMIT} characters`)
  return query
}

function pageOf(value: unknown): number {
  if (value === undefined || value === null) return 1
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('page must be a positive integer')
  return value as number
}

function pageSizeOf(value: unknown): number {
  if (value === undefined || value === null) return DEFAULT_PAGE_SIZE
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > MAX_PAGE_SIZE) {
    throw new Error(`page size must be an integer from 1 to ${MAX_PAGE_SIZE}`)
  }
  return value as number
}

/** Node cap of one graph request; anything larger than the shared bound is clamped. */
function graphLimitOf(value: unknown): number {
  if (value === undefined || value === null) return MAX_GRAPH_NODES
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('graph node limit must be a positive integer')
  return Math.min(value as number, MAX_GRAPH_NODES)
}

/** The tasks one task waits on: id-shaped, at most {@link blockingLimit}, de-duplicated in order. */
function blockingIdsOf(value: unknown, selfId: string | null): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('blocking tasks must be a list')
  if (value.length > blockingLimit) throw new Error(`a task may wait on at most ${blockingLimit} tasks`)
  const ids: string[] = []
  for (const entry of value) {
    const id = idOf(entry)
    if (id === selfId) throw new Error('task dependency would contain a cycle')
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/**
 * Wrap a literal search phrase for a `LIKE … ESCAPE '\'` comparison.
 * @param query - non-empty phrase already trimmed by the caller.
 * @returns the phrase with SQL wildcards escaped and `%` around it.
 */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/gu, match => `\\${match}`)}%`
}

/** Append one edge endpoint to its adjacency list without losing insertion order. */
function pushInto(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

interface TaskRow {
  content: string
  id: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  storyPoints: number | null
  tags: string
  workspaceId: string | null
  sendImmediately: number
  sessionId: string | null
  agent: string | null
  useWorktree: number
  startedAt: number | null
  completedAt: number | null
  parentId: string | null
  version: number
  createdAt: number
  updatedAt: number
}

interface SubtaskRow {
  id: string
  taskId: string
  notes: string
  status: TaskStatus
  sessionId: string | null
  version: number
  createdAt: number
  updatedAt: number
}

const select = `SELECT id, title, notes, content, status, priority, story_points AS storyPoints,
  tags, workspace_id AS workspaceId, send_immediately AS sendImmediately,
  session_id AS sessionId, agent, use_worktree AS useWorktree,
  started_at AS startedAt, completed_at AS completedAt, parent_id AS parentId,
  version, created_at AS createdAt, updated_at AS updatedAt FROM tasks`

/** Wait-on edges of one task, oldest insertion first so a replaced set round-trips in order. */
const selectBlocking = `SELECT task_id AS taskId, depends_on_id AS dependsOnId FROM task_dependencies`

const selectSubtask = `SELECT id, task_id AS taskId, notes, status, session_id AS sessionId,
  version, created_at AS createdAt, updated_at AS updatedAt FROM subtasks`

function storedContentOf(row: TaskRow): TaskContent {
  const content = validateContent(JSON.parse(row.content))
  // A previously running text-only Host can insert rows after the v5 migration,
  // leaving the new column at its empty default. Preserve its original notes.
  return content.blocks.length === 0 && row.notes ? textContent(row.notes) : content
}

function taskOf(row: TaskRow): TaskRecord {
  return {
    ...row, content: storedContentOf(row), tags: tagsOf(JSON.parse(row.tags)),
    sendImmediately: row.sendImmediately === 1, useWorktree: row.useWorktree === 1,
    blockingIds: [], subtasks: [],
  }
}

function subtaskOf(row: SubtaskRow): SubtaskRecord {
  return { ...row, status: statusOf(row.status) }
}

/** Schema objects added by version 4. */
const subtaskSchema = `CREATE TABLE subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
  session_id TEXT,
  version INTEGER NOT NULL CHECK(version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX subtasks_task_created ON subtasks(task_id, created_at);`

/** Every column a task row holds from version 15 on; older rows hold the same minus `parent_id`. */
const taskColumns = [
  'id', 'title', 'notes', 'content', 'status', 'priority', 'story_points', 'tags', 'workspace_id',
  'send_immediately', 'session_id', 'agent', 'use_worktree', 'started_at', 'completed_at',
  'version', 'created_at', 'updated_at',
] as const
const taskColumnSet = new Set<string>(taskColumns)
const taskColumnList = taskColumns.join(', ')

/**
 * Column list of the current `tasks` table. `parent_id` is a self-reference with
 * no delete action: a parent is detached from its children by the delete path
 * itself, so a hierarchy delete never cascades into subtask rows or links.
 */
const taskTableColumns = `(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '{"version":1,"blocks":[]}',
  status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'approving', 'done')),
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
  parent_id TEXT REFERENCES tasks(id),
  version INTEGER NOT NULL CHECK(version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT`
const taskIndexSchema = `CREATE INDEX tasks_status_updated ON tasks(status, updated_at DESC);
CREATE INDEX tasks_parent ON tasks(parent_id);`
const taskSchema = `CREATE TABLE tasks ${taskTableColumns};
${taskIndexSchema}`

/** Wait-on edges; both ends are tasks, and removing either end removes the edge. */
const taskDependencySchema = `CREATE TABLE task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
) STRICT;
CREATE INDEX task_dependencies_depends_on ON task_dependencies(depends_on_id);`
const dependencyColumns = ['task_id', 'depends_on_id'] as const

/** The stored shape of one table, or null when it does not exist yet. */
function tableShape(db: DatabaseSync, table: string): { columns: Set<string>; sql: string } | null {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string } | undefined
  if (row === undefined) return null
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]
  return { columns: new Set(columns.map(column => column.name)), sql: row.sql }
}

/**
 * Rewrite `tasks` into the version-15 shape without inventing or dropping a row.
 *
 * The rebuild follows SQLite's documented table-rebuild order and relies on the
 * caller having disabled foreign keys for it: `DROP TABLE tasks` would otherwise
 * run its implicit delete with the children's `ON DELETE CASCADE` still armed and
 * would take every subtask, attachment and link down with it. The copy names its
 * columns explicitly, so the new `parent_id` starts out NULL for every old row.
 */
function rebuildTaskTable(db: DatabaseSync): void {
  db.exec(`CREATE TABLE tasks_v15 ${taskTableColumns};
    INSERT INTO tasks_v15 (${taskColumnList}) SELECT ${taskColumnList} FROM tasks;
    DROP TABLE tasks;
    ALTER TABLE tasks_v15 RENAME TO tasks;
    ${taskIndexSchema}`)
}

/**
 * Create or check the wait-on table. A database whose `user_version` was reset by
 * hand can already carry it, and its shape must be exactly this one — an unknown
 * shape is a storage failure, never a heuristic drop.
 */
function ensureTaskDependencies(db: DatabaseSync): void {
  const shape = tableShape(db, 'task_dependencies')
  if (shape === null) {
    db.exec(taskDependencySchema)
    return
  }
  const known = dependencyColumns.every(column => shape.columns.has(column))
    && [...shape.columns].every(column => (dependencyColumns as readonly string[]).includes(column))
  if (!known) throw new Error('task database has an unrecognized task_dependencies table')
  db.exec('CREATE INDEX IF NOT EXISTS task_dependencies_depends_on ON task_dependencies(depends_on_id)')
}

/**
 * Whether `tasks` still carries the pre-15 shape. Only the exact old or the exact
 * new shape is accepted: a column list that is neither is a storage failure,
 * because a rebuild may only rewrite a shape it fully recognizes.
 */
function tasksNeedRebuild(db: DatabaseSync): boolean {
  const shape = tableShape(db, 'tasks')
  if (shape === null) return false
  const known = taskColumns.every(column => shape.columns.has(column))
    && [...shape.columns].every(column => taskColumnSet.has(column) || column === 'parent_id')
  if (!known) throw new Error('task database has an unrecognized tasks table')
  const approving = shape.sql.includes("'approving'")
  if (shape.columns.has('parent_id')) {
    if (!approving) throw new Error('task database has an unrecognized tasks table')
    return false
  }
  if (approving) throw new Error('task database has an unrecognized tasks table')
  return true
}

export class TaskStore {
  readonly db: DatabaseSync

  constructor(readonly file: string) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(file)
    try {
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
      const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number }
      if (version.user_version > schemaVersion) throw new Error(`unsupported task database version: ${version.user_version}`)
      if (version.user_version === 0) {
        const existing = this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
        if (existing.length) throw new Error('task database has unrecognized tables')
      }
      // Rebuilding `tasks` drops the table it replaces, and `DROP TABLE` runs its
      // implicit delete with the children's ON DELETE CASCADE armed unless foreign
      // keys are off first. The pragma is a no-op inside a transaction, so it is
      // decided here and restored after the commit.
      const existingTasks = tableShape(this.db, 'tasks')
      const legacyTasks = existingTasks !== null && !existingTasks.columns.has('parent_id')
      if (legacyTasks) this.db.exec('PRAGMA foreign_keys = OFF')
      // The whole 0..15 migration runs in one transaction; any stage failing rolls every stage back.
      withSqliteTransaction(this.db, () => {
        if (version.user_version === 0) {
          this.db.exec(`${taskSchema}
          ${subtaskSchema}
          ${taskDependencySchema}`)
        } else if (version.user_version === 1) {
          this.db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent'));
            ALTER TABLE tasks ADD COLUMN story_points INTEGER CHECK(story_points IS NULL OR story_points BETWEEN 0 AND 1000);
            ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
            ALTER TABLE tasks ADD COLUMN workspace_id TEXT;
            ALTER TABLE tasks ADD COLUMN started_at INTEGER;
            ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
            ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
            ALTER TABLE tasks ADD COLUMN session_id TEXT;
            ALTER TABLE tasks ADD COLUMN agent TEXT;
            ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
            ${subtaskSchema}`)
        } else if (version.user_version === 2) {
          this.db.exec(`ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
            ALTER TABLE tasks ADD COLUMN session_id TEXT;
            ALTER TABLE tasks ADD COLUMN agent TEXT;
            ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
            ${subtaskSchema}`)
        } else if (version.user_version === 3) {
          this.db.exec(subtaskSchema)
        }
        if (version.user_version < 5) {
          // A fresh version-0 database already carries `content`; an older one gains
          // it here, together with the bytes table that belongs to it.
          if (!tableShape(this.db, 'tasks')!.columns.has('content')) {
            this.db.exec(`ALTER TABLE tasks ADD COLUMN content TEXT NOT NULL DEFAULT '{"version":1,"blocks":[]}'`)
            const rows = this.db.prepare('SELECT id, notes FROM tasks').all() as unknown as { id: string; notes: string }[]
            const write = this.db.prepare('UPDATE tasks SET content = ? WHERE id = ?')
            for (const row of rows) write.run(JSON.stringify(textContent(row.notes)), row.id)
          }
          this.db.exec(`CREATE TABLE task_attachments (
              id TEXT PRIMARY KEY,
              task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
              data BLOB NOT NULL
            ) STRICT;
            CREATE INDEX task_attachments_task ON task_attachments(task_id);`)
        }
        // Version 15 adds the hierarchy link and the wait-on table. The rebuild is
        // resolved from the stored shape, never guessed: a table that is neither
        // the exact old nor the exact new form is refused.
        if (tasksNeedRebuild(this.db)) rebuildTaskTable(this.db)
        ensureTaskDependencies(this.db)
        if (version.user_version < schemaVersion) migrateSyncSchema(this.db)
        // The statistics table is a rebuildable projection cache, not task data:
        // an older build can ignore it and a newer one recreates it on demand.
        // It therefore stays outside the versioned task schema, which keeps a
        // downgrade from locking the task database out of an older build.
        this.db.exec(statisticsSchema)
      })
      if (legacyTasks) {
        // The rebuild is committed; verify the references it left behind before
        // re-arming enforcement for the rest of the connection's life.
        const violations = this.db.prepare('PRAGMA foreign_key_check').all()
        this.db.exec('PRAGMA foreign_keys = ON')
        if (violations.length > 0) throw new Error('task database failed foreign key verification')
      }
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch { /* no active transaction */ }
      this.db.close()
      throw error
    }
  }

  close(): void { this.db.close() }

  /**
   * Read one filtered, searched, ordered page of tasks.
   * @param request - optional status, literal search phrase, workspace filter, and paging.
   * @returns the page rows, the unpaged match count, and the clamped page bounds.
   */
  list(request: ListTasksRequest = {}): TaskPage {
    const conditions: string[] = []
    const parameters: (string | number)[] = []
    if (request.status !== undefined) {
      conditions.push('status = ?')
      parameters.push(statusOf(request.status))
    }
    if (request.workspaceId !== undefined) {
      const workspaceId = workspaceIdOf(request.workspaceId)!
      if (request.includeUnassigned) {
        conditions.push('(workspace_id = ? OR workspace_id IS NULL)')
      } else {
        conditions.push('workspace_id = ?')
      }
      parameters.push(workspaceId)
    } else if (request.includeUnassigned) {
      conditions.push('workspace_id IS NULL')
    }
    const query = queryOf(request.query)
    if (query) {
      // A task matches through its own fields or through any of its subtasks.
      conditions.push(`(title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\' OR session_id LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM subtasks sub WHERE sub.task_id = tasks.id
          AND (sub.notes LIKE ? ESCAPE '\\' OR sub.session_id LIKE ? ESCAPE '\\')))`)
      const pattern = likePattern(query)
      parameters.push(pattern, pattern, pattern, pattern, pattern)
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const counted = this.db.prepare(`SELECT COUNT(*) AS total FROM tasks${where}`).get(...parameters) as { total: number }
    const pageSize = pageSizeOf(request.pageSize)
    const pageCount = Math.max(1, Math.ceil(counted.total / pageSize))
    const page = Math.min(pageOf(request.page), pageCount)
    const rows = this.db.prepare(`${select}${where} ${taskOrder} LIMIT ? OFFSET ?`)
      .all(...parameters, pageSize, (page - 1) * pageSize) as unknown as TaskRow[]
    return { items: this.hydrate(rows.map(taskOf)), total: counted.total, page, pageSize }
  }

  get(id: string): TaskRecord | null {
    const row = this.db.prepare(`${select} WHERE id = ?`).get(idOf(id)) as unknown as TaskRow | undefined
    return row ? this.hydrate([taskOf(row)])[0]! : null
  }

  /**
   * Task completions inside one half-open instant range, for the statistics report.
   * @param from - inclusive lower bound on `completed_at`.
   * @param to - exclusive upper bound on `completed_at`.
   * @returns one entry per completed task, oldest first.
   */
  listCompletions(from: number, to: number): { time: number; points: number }[] {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to <= from) return []
    return this.db.prepare(`SELECT completed_at AS time, COALESCE(story_points, 0) AS points
      FROM tasks WHERE completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?
      ORDER BY completed_at`).all(from, to) as unknown as { time: number; points: number }[]
  }

  /**
   * Parent and wait-on edges of one task.
   * @param id - the task id; the task must exist.
   * @returns the same edge projection a task row carries.
   */
  relations(id: string): TaskRelation {
    const taskId = idOf(id)
    const row = this.db.prepare('SELECT parent_id AS parentId FROM tasks WHERE id = ?').get(taskId) as { parentId: string | null } | undefined
    if (row === undefined) throw new Error('task not found')
    const edges = this.db.prepare(`${selectBlocking} WHERE task_id = ? ORDER BY rowid`)
      .all(taskId) as unknown as { taskId: string; dependsOnId: string }[]
    return { taskId, parentId: row.parentId, blockingIds: edges.map(edge => edge.dependsOnId) }
  }

  /**
   * Every task's parent and wait-on edges, for a caller that needs the whole
   * relationship set without materializing the tasks.
   * @returns one entry per task, oldest row first.
   */
  listTaskRelations(): TaskRelation[] {
    const rows = this.db.prepare('SELECT id, parent_id AS parentId FROM tasks ORDER BY created_at, id')
      .all() as unknown as { id: string; parentId: string | null }[]
    const grouped = new Map<string, string[]>()
    for (const edge of this.db.prepare(`${selectBlocking} ORDER BY rowid`).all() as unknown as { taskId: string; dependsOnId: string }[]) {
      pushInto(grouped, edge.taskId, edge.dependsOnId)
    }
    return rows.map(row => ({ taskId: row.id, parentId: row.parentId, blockingIds: grouped.get(row.id) ?? [] }))
  }

  /**
   * One relationship graph.
   *
   * Without a root the whole task table is one graph. With a root the node set
   * starts at that task and follows only the requested edges: `includeDescendants`
   * down the parent chain, `includeAncestors` up it, and `includeBlockers` along
   * the wait-on edges to the tasks the root waits for. A node carries only the
   * edges whose far end is in the same result, so `waitsOn` and `waitedOnBy`
   * stay each other's reverse within one graph; `task.parentId` and
   * `task.blockingIds` keep the stored truth either way. `blocked` is derived
   * from the stored edges, never from the node set: waiting on a task the request
   * left out still blocks.
   *
   * @param request - root and edge scope, plus the node cap (clamped to `MAX_GRAPH_NODES`).
   * @returns the selected nodes in task-list order, and whether the cap cut them.
   */
  graph(request: GetTaskGraphRequest = {}): TaskGraph {
    const limit = graphLimitOf(request?.maxNodes)
    const tasks = (this.db.prepare(`${select} ${taskOrder}`).all() as unknown as TaskRow[]).map(taskOf)
    const blocking = new Map<string, string[]>()
    const waitedOnBy = new Map<string, string[]>()
    for (const edge of this.db.prepare(`${selectBlocking} ORDER BY rowid`).all() as unknown as { taskId: string; dependsOnId: string }[]) {
      pushInto(blocking, edge.taskId, edge.dependsOnId)
      pushInto(waitedOnBy, edge.dependsOnId, edge.taskId)
    }
    const byId = new Map(tasks.map(task => [task.id, task]))
    const children = new Map<string, string[]>()
    for (const task of tasks) {
      if (task.parentId !== null && byId.has(task.parentId)) pushInto(children, task.parentId, task.id)
    }
    const chosen = this.scopeGraph(request, tasks, byId, children, blocking)
    const truncated = chosen.length > limit
    const selected = this.hydrate(chosen.slice(0, limit))
    const ids = new Set(selected.map(task => task.id))
    const nodes: TaskGraphNode[] = selected.map(task => {
      const waits = task.blockingIds
      return {
        task,
        parents: task.parentId !== null && ids.has(task.parentId) ? [task.parentId] : [],
        children: (children.get(task.id) ?? []).filter(id => ids.has(id)),
        waitsOn: waits.filter(id => ids.has(id)),
        waitedOnBy: (waitedOnBy.get(task.id) ?? []).filter(id => ids.has(id)),
        blocked: task.status !== 'done' && waits.some(id => byId.get(id)?.status !== 'done'),
      }
    })
    return { nodes, truncated }
  }

  /**
   * Counts per status, the derived blocked count, and the Sessions the tasks are
   * handled in.
   * @returns four counts, the total, the blocked count, and the distinct linked
   *   session ids, most recently updated task first.
   */
  overview(): TaskOverview {
    const rows = this.db.prepare('SELECT id, status, session_id AS sessionId, updated_at AS updatedAt FROM tasks')
      .all() as unknown as { id: string; status: TaskStatus; sessionId: string | null; updatedAt: number }[]
    const blocking = new Map<string, string[]>()
    for (const edge of this.db.prepare(`${selectBlocking} ORDER BY rowid`).all() as unknown as { taskId: string; dependsOnId: string }[]) {
      pushInto(blocking, edge.taskId, edge.dependsOnId)
    }
    const statusById = new Map(rows.map(row => [row.id, row.status]))
    const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, approving: 0, done: 0 }
    const sessions = new Map<string, number>()
    let blocked = 0
    for (const row of rows) {
      counts[row.status] += 1
      if (row.sessionId !== null) sessions.set(row.sessionId, Math.max(sessions.get(row.sessionId) ?? 0, row.updatedAt))
      const waits = blocking.get(row.id) ?? []
      if (row.status !== 'done' && waits.some(id => statusById.get(id) !== 'done')) blocked += 1
    }
    const sessionIds = [...sessions.entries()]
      .sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1))
      .map(([id]) => id)
    return { counts, total: rows.length, blocked, sessionIds }
  }

  /** Nodes one graph request covers, in task-list order. */
  private scopeGraph(
    request: GetTaskGraphRequest,
    tasks: TaskRecord[],
    byId: Map<string, TaskRecord>,
    children: Map<string, string[]>,
    blocking: Map<string, string[]>,
  ): TaskRecord[] {
    const rootId = request?.rootId === undefined || request?.rootId === null ? null : idOf(request.rootId)
    if (rootId === null) return tasks
    if (!byId.has(rootId)) throw new Error('task not found')
    const chosen = new Set<string>([rootId])
    const walk = (next: (id: string) => readonly string[]): void => {
      const queue = [rootId]
      while (queue.length > 0) {
        const current = queue.pop()!
        for (const id of next(current)) {
          if (chosen.has(id)) continue
          chosen.add(id)
          queue.push(id)
        }
      }
    }
    if (request.includeDescendants) walk(id => children.get(id) ?? [])
    if (request.includeAncestors) {
      walk(id => {
        const parentId = byId.get(id)?.parentId
        return parentId === null || parentId === undefined ? [] : [parentId]
      })
    }
    if (request.includeBlockers) walk(id => blocking.get(id) ?? [])
    return tasks.filter(task => chosen.has(task.id))
  }

  /** Rows of one task, oldest first. */
  listSubtasks(taskId: string): SubtaskRecord[] {
    return (this.db.prepare(`${selectSubtask} WHERE task_id = ? ORDER BY created_at, id`)
      .all(idOf(taskId)) as unknown as SubtaskRow[]).map(subtaskOf)
  }

  getSubtask(id: string): SubtaskRecord | null {
    const row = this.db.prepare(`${selectSubtask} WHERE id = ?`).get(idOf(id)) as unknown as SubtaskRow | undefined
    return row ? subtaskOf(row) : null
  }

  /** Load every row of the given tasks with one query, preserving task order. */
  private attachSubtasks(tasks: TaskRecord[]): TaskRecord[] {
    if (tasks.length === 0) return tasks
    const ids = tasks.map(task => task.id)
    const rows = this.db.prepare(`${selectSubtask} WHERE task_id IN (${ids.map(() => '?').join(', ')}) ORDER BY created_at, id`)
      .all(...ids) as unknown as SubtaskRow[]
    const grouped = new Map<string, SubtaskRecord[]>()
    for (const row of rows) {
      const list = grouped.get(row.taskId)
      if (list) list.push(subtaskOf(row))
      else grouped.set(row.taskId, [subtaskOf(row)])
    }
    return tasks.map(task => ({ ...task, subtasks: grouped.get(task.id) ?? [] }))
  }

  /**
   * Load the wait-on edges of the given tasks with one query, preserving both task
   * order and the order inside each set, so a replaced set round-trips unchanged.
   */
  private attachBlocking(tasks: TaskRecord[]): TaskRecord[] {
    if (tasks.length === 0) return tasks
    const ids = tasks.map(task => task.id)
    const rows = this.db.prepare(`${selectBlocking} WHERE task_id IN (${ids.map(() => '?').join(', ')}) ORDER BY rowid`)
      .all(...ids) as unknown as { taskId: string; dependsOnId: string }[]
    const grouped = new Map<string, string[]>()
    for (const row of rows) {
      const list = grouped.get(row.taskId)
      if (list) list.push(row.dependsOnId)
      else grouped.set(row.taskId, [row.dependsOnId])
    }
    return tasks.map(task => ({ ...task, blockingIds: grouped.get(task.id) ?? [] }))
  }

  /** Rows, checklist rows, and wait-on edges of every given task, batched per relation. */
  private hydrate(tasks: TaskRecord[]): TaskRecord[] {
    return this.attachBlocking(this.attachSubtasks(tasks))
  }

  /** Replace one task's wait-on set; the caller decides the transaction it belongs to. */
  private replaceBlocking(taskId: string, blockingIds: readonly string[]): void {
    this.db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(taskId)
    const insert = this.db.prepare('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)')
    for (const dependsOnId of blockingIds) insert.run(taskId, dependsOnId)
  }

  /** The task must exist and its own chain must not reach `taskId` again. */
  private assertParent(parentId: string, taskId: string): void {
    const seen = new Set<string>([taskId])
    let current: string | null = parentId
    while (current !== null) {
      if (seen.has(current)) throw new Error('task hierarchy would contain a cycle')
      seen.add(current)
      const row = this.db.prepare('SELECT parent_id AS parentId FROM tasks WHERE id = ?').get(current) as { parentId: string | null } | undefined
      if (row === undefined) throw new Error('parent task not found')
      current = row.parentId
    }
  }

  /** Every wait-on target must exist, and no closure of theirs may reach back to `taskId`. */
  private assertBlocking(taskId: string, blockingIds: readonly string[]): void {
    const exists = this.db.prepare('SELECT 1 FROM tasks WHERE id = ?')
    for (const id of blockingIds) if (exists.get(id) === undefined) throw new Error('blocking task not found')
    const seen = new Set<string>()
    const queue = [...blockingIds]
    const edges = this.db.prepare('SELECT depends_on_id AS dependsOnId FROM task_dependencies WHERE task_id = ?')
    while (queue.length > 0) {
      const current = queue.pop()!
      if (current === taskId) throw new Error('task dependency would contain a cycle')
      if (seen.has(current)) continue
      seen.add(current)
      for (const row of edges.all(current) as unknown as { dependsOnId: string }[]) queue.push(row.dependsOnId)
    }
  }

  create(input: CreateTaskRequest): TaskRecord {
    const id = randomUUID()
    const now = Date.now()
    // A task may be created already running or already finished, so the
    // timestamps follow the same rule as a status change on an existing row.
    const status = statusOf(input?.status ?? 'todo')
    const parentId = input?.parentId === undefined || input?.parentId === null ? null : idOf(input.parentId)
    const blockingIds = blockingIdsOf(input?.blockingIds, id)
    const content = validateContent(input?.content ?? textContent(notesOf(input?.notes ?? '')))
    // The row, its wait-on edges, and its attachment bytes share one transaction:
    // a refused edge leaves no half-linked task behind.
    return this.writeContent(id, content, input?.attachments ?? [], () => {
    if (parentId !== null) this.assertParent(parentId, id)
    this.assertBlocking(id, blockingIds)
    this.db.prepare(`INSERT INTO tasks
      (id, title, notes, content, status, priority, story_points, tags, workspace_id,
       send_immediately, session_id, agent, use_worktree, started_at, completed_at, parent_id, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
      id, titleOf(input?.title), contentText(content), JSON.stringify(content), status, priorityOf(input?.priority ?? 'medium'),
      storyPointsOf(input?.storyPoints ?? null), JSON.stringify(tagsOf(input?.tags ?? [])),
      workspaceIdOf(input?.workspaceId ?? null), booleanOf(input?.sendImmediately ?? false, 'send immediately') ? 1 : 0,
      optionalIdOf(input?.sessionId ?? null, 'session id'), optionalIdOf(input?.agent ?? null, 'agent'),
      booleanOf(input?.useWorktree ?? false, 'use worktree') ? 1 : 0,
      status === 'in_progress' ? now : null, status === 'done' ? now : null, parentId, now, now,
    )
    this.replaceBlocking(id, blockingIds)
    return this.get(id)!
    })
  }

  update(input: UpdateTaskRequest): TaskRecord {
    const id = idOf(input?.id)
    const version = versionOf(input?.version)
    const current = this.db.prepare(`${select} WHERE id = ?`).get(id) as unknown as TaskRow | undefined
    if (!current) throw new Error('task not found')
    if (current.version !== version) throw new Error('task changed; refresh and retry')
    const title = input.title === undefined ? current.title : titleOf(input.title)
    const content = validateContent(input.content ?? (input.notes === undefined ? storedContentOf(current) : textContent(notesOf(input.notes))))
    const notes = contentText(content)
    const status = input.status === undefined ? current.status : statusOf(input.status)
    const priority = input.priority === undefined ? current.priority : priorityOf(input.priority)
    const storyPoints = input.storyPoints === undefined ? current.storyPoints : storyPointsOf(input.storyPoints)
    const tags = input.tags === undefined ? tagsOf(JSON.parse(current.tags)) : tagsOf(input.tags)
    const workspaceId = input.workspaceId === undefined ? current.workspaceId : workspaceIdOf(input.workspaceId)
    const sendImmediately = input.sendImmediately === undefined
      ? current.sendImmediately === 1 : booleanOf(input.sendImmediately, 'send immediately')
    const sessionId = input.sessionId === undefined ? current.sessionId : optionalIdOf(input.sessionId, 'session id')
    const agent = input.agent === undefined ? current.agent : optionalIdOf(input.agent, 'agent')
    const useWorktree = input.useWorktree === undefined ? current.useWorktree === 1 : booleanOf(input.useWorktree, 'use worktree')
    const parentId = input.parentId === undefined
      ? current.parentId
      : input.parentId === null ? null : idOf(input.parentId)
    // `undefined` keeps the stored set; any other value replaces it whole.
    const blockingIds = input.blockingIds === undefined ? null : blockingIdsOf(input.blockingIds, id)
    const now = Date.now()
    const startedAt = status === 'in_progress' && current.startedAt === null ? now : current.startedAt
    const completedAt = status === current.status ? current.completedAt : status === 'done' ? now : null
    return this.writeContent(id, content, input.attachments ?? [], () => {
    if (parentId !== null && parentId !== current.parentId) this.assertParent(parentId, id)
    if (blockingIds !== null) this.assertBlocking(id, blockingIds)
    const result = this.db.prepare(`UPDATE tasks SET title = ?, notes = ?, content = ?, status = ?, priority = ?, story_points = ?,
      tags = ?, workspace_id = ?, send_immediately = ?, session_id = ?, agent = ?, use_worktree = ?,
      started_at = ?, completed_at = ?, parent_id = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(
      title, notes, JSON.stringify(content), status, priority, storyPoints, JSON.stringify(tags), workspaceId,
      sendImmediately ? 1 : 0, sessionId, agent, useWorktree ? 1 : 0,
      startedAt, completedAt, parentId, now, id, version,
    )
    if (result.changes !== 1) throw new Error('task changed; refresh and retry')
    if (blockingIds !== null) this.replaceBlocking(id, blockingIds)
    return this.get(id)!
    })
  }

  /** One transaction covers the row, attachment bytes, and removal of unreferenced bytes. */
  private writeContent(id: string, content: TaskContent, uploads: TaskAttachmentUpload[], write: () => TaskRecord): TaskRecord {
    if (!Array.isArray(uploads) || uploads.length > 8) throw new Error('invalid attachment uploads')
    const referenced = contentAttachments(content)
    const pending = new Map<string, Buffer>()
    for (const upload of uploads) {
      const node = referenced.find(block => block.id === upload?.id)
      if (!node || pending.has(upload.id) || typeof upload.data !== 'string'
        || upload.data.length > Math.ceil(ATTACHMENT_BYTE_LIMIT / 3) * 4
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(upload.data)) throw new Error('invalid attachment upload')
      const data = Buffer.from(upload.data, 'base64')
      if (data.length !== node.bytes) throw new Error('attachment size mismatch')
      pending.set(upload.id, data)
    }
    return withSqliteTransaction(this.db, () => {
      for (const node of referenced) {
        const existing = this.db.prepare('SELECT task_id AS taskId, length(data) AS bytes FROM task_attachments WHERE id = ?').get(node.id) as { taskId: string; bytes: number } | undefined
        if (existing && (existing.taskId !== id || pending.has(node.id))) throw new Error('attachment belongs to another task or is immutable')
        if (!existing && !pending.has(node.id)) throw new Error('attachment bytes missing')
        if (existing && existing.bytes !== node.bytes) throw new Error('attachment size mismatch')
      }
      const result = write()
      for (const [attachmentId, data] of pending) this.db.prepare('INSERT INTO task_attachments (id, task_id, data) VALUES (?, ?, ?)').run(attachmentId, id, data)
      const keep = new Set(referenced.map(node => node.id))
      const rows = this.db.prepare('SELECT id FROM task_attachments WHERE task_id = ?').all(id) as unknown as { id: string }[]
      for (const row of rows) if (!keep.has(row.id)) this.db.prepare('DELETE FROM task_attachments WHERE id = ?').run(row.id)
      return result
    })
  }

  readAttachments(id: string, version: number): TaskAttachmentUpload[] {
    const task = this.get(idOf(id))
    if (!task) throw new Error('task not found')
    if (task.version !== versionOf(version)) throw new Error('task changed; refresh and retry')
    return contentAttachments(task.content).map(node => {
      const row = this.db.prepare('SELECT data FROM task_attachments WHERE id = ? AND task_id = ?').get(node.id, id) as { data: Uint8Array } | undefined
      if (!row) throw new Error('attachment bytes missing')
      return { id: node.id, data: Buffer.from(row.data).toString('base64') }
    })
  }

  delete(id: string, version: number): void {
    const taskId = idOf(id)
    const taskVersion = versionOf(version)
    withSqliteTransaction(this.db, () => {
      const now = Date.now()
      // Cancel any prepared (not-yet-dispatched) sync intents for this task's link, and detach
      // dispatched/unknown evidence so the link row (whose task_id is SET NULL) keeps its proof.
      const link = this.db.prepare('SELECT id FROM sync_links WHERE task_id = ?').get(taskId) as { id: string } | undefined
      if (link) {
        this.db.prepare(`UPDATE sync_write_intents SET phase = 'cancelled', task_id = NULL, updated_at = ?
          WHERE link_id = ? AND phase = 'prepared'`).run(now, link.id)
        this.db.prepare(`UPDATE sync_write_intents SET task_id = NULL, updated_at = ?
          WHERE link_id = ? AND phase IN ('dispatched', 'unknown')`).run(now, link.id)
      }
      // Children are detached, never deleted: the hierarchy is a link, not ownership.
      // Wait-on edges of this task are removed by the foreign key's cascade.
      this.db.prepare('UPDATE tasks SET parent_id = NULL WHERE parent_id = ?').run(taskId)
      const result = this.db.prepare('DELETE FROM tasks WHERE id = ? AND version = ?').run(taskId, taskVersion)
      if (result.changes !== 1) throw new Error('task missing or changed; refresh and retry')
    })
  }

  createSubtask(input: CreateSubtaskRequest): SubtaskRecord {
    const taskId = idOf(input?.taskId)
    if (this.db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId) === undefined) throw new Error('task not found')
    const id = randomUUID()
    const now = Date.now()
    this.db.prepare(`INSERT INTO subtasks (id, task_id, notes, status, session_id, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)`).run(
      id, taskId, subtaskNotesOf(input?.notes), subtaskStatusOf(input?.status ?? 'todo'),
      optionalIdOf(input?.sessionId ?? null, 'session id'), now, now,
    )
    return this.getSubtask(id)!
  }

  updateSubtask(input: UpdateSubtaskRequest): SubtaskRecord {
    const id = idOf(input?.id)
    const version = versionOf(input?.version)
    const current = this.getSubtask(id)
    if (!current) throw new Error('subtask not found')
    if (current.version !== version) throw new Error('subtask changed; refresh and retry')
    const notes = input.notes === undefined ? current.notes : subtaskNotesOf(input.notes)
    const status = input.status === undefined ? current.status : subtaskStatusOf(input.status)
    const sessionId = input.sessionId === undefined ? current.sessionId : optionalIdOf(input.sessionId, 'session id')
    const result = this.db.prepare(`UPDATE subtasks SET notes = ?, status = ?, session_id = ?,
      version = version + 1, updated_at = ? WHERE id = ? AND version = ?`)
      .run(notes, status, sessionId, Date.now(), id, version)
    if (result.changes !== 1) throw new Error('subtask changed; refresh and retry')
    return this.getSubtask(id)!
  }

  deleteSubtask(id: string, version: number): void {
    const result = this.db.prepare('DELETE FROM subtasks WHERE id = ? AND version = ?').run(idOf(id), versionOf(version))
    if (result.changes !== 1) throw new Error('subtask missing or changed; refresh and retry')
  }
}
