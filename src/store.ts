import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SEARCH_LIMIT,
  type CreateSubtaskRequest, type CreateTaskRequest, type DeleteSubtaskRequest, type ListTasksRequest,
  type SubtaskRecord, type TaskPage, type TaskPriority, type TaskRecord, type TaskStatus,
  type UpdateSubtaskRequest, type UpdateTaskRequest,
} from './types.ts'

const statuses = new Set<TaskStatus>(['todo', 'in_progress', 'done'])
const priorities = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])
const titleLimit = 200
const notesLimit = 20_000
const subtaskNotesLimit = 2_000

/** Current schema version; the store refuses anything newer. */
const schemaVersion = 4
/** Newest rows first inside each status group, with a stable id tie-break. */
const taskOrder = "ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, updated_at DESC, id"

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

/**
 * Wrap a literal search phrase for a `LIKE … ESCAPE '\'` comparison.
 * @param query - non-empty phrase already trimmed by the caller.
 * @returns the phrase with SQL wildcards escaped and `%` around it.
 */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/gu, match => `\\${match}`)}%`
}

interface TaskRow {
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

const select = `SELECT id, title, notes, status, priority, story_points AS storyPoints,
  tags, workspace_id AS workspaceId, send_immediately AS sendImmediately,
  session_id AS sessionId, agent, use_worktree AS useWorktree,
  started_at AS startedAt, completed_at AS completedAt,
  version, created_at AS createdAt, updated_at AS updatedAt FROM tasks`

const selectSubtask = `SELECT id, task_id AS taskId, notes, status, session_id AS sessionId,
  version, created_at AS createdAt, updated_at AS updatedAt FROM subtasks`

function taskOf(row: TaskRow): TaskRecord {
  return {
    ...row, tags: tagsOf(JSON.parse(row.tags)),
    sendImmediately: row.sendImmediately === 1, useWorktree: row.useWorktree === 1,
    subtasks: [],
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
        this.db.exec(`BEGIN;
          CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
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
          CREATE INDEX tasks_status_updated ON tasks(status, updated_at DESC);
          ${subtaskSchema}
          PRAGMA user_version = ${schemaVersion};
          COMMIT;
        `)
      } else if (version.user_version === 1) {
        this.db.exec(`BEGIN;
          ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent'));
          ALTER TABLE tasks ADD COLUMN story_points INTEGER CHECK(story_points IS NULL OR story_points BETWEEN 0 AND 1000);
          ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
          ALTER TABLE tasks ADD COLUMN workspace_id TEXT;
          ALTER TABLE tasks ADD COLUMN started_at INTEGER;
          ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
          ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
          ALTER TABLE tasks ADD COLUMN session_id TEXT;
          ALTER TABLE tasks ADD COLUMN agent TEXT;
          ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
          ${subtaskSchema}
          PRAGMA user_version = ${schemaVersion};
          COMMIT;
        `)
      } else if (version.user_version === 2) {
        this.db.exec(`BEGIN;
          ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
          ALTER TABLE tasks ADD COLUMN session_id TEXT;
          ALTER TABLE tasks ADD COLUMN agent TEXT;
          ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
          ${subtaskSchema}
          PRAGMA user_version = ${schemaVersion};
          COMMIT;
        `)
      } else if (version.user_version === 3) {
        this.db.exec(`BEGIN;
          ${subtaskSchema}
          PRAGMA user_version = ${schemaVersion};
          COMMIT;
        `)
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
    return { items: this.attachSubtasks(rows.map(taskOf)), total: counted.total, page, pageSize }
  }

  get(id: string): TaskRecord | null {
    const row = this.db.prepare(`${select} WHERE id = ?`).get(idOf(id)) as unknown as TaskRow | undefined
    return row ? this.attachSubtasks([taskOf(row)])[0]! : null
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

  create(input: CreateTaskRequest): TaskRecord {
    const id = randomUUID()
    const now = Date.now()
    this.db.prepare(`INSERT INTO tasks
      (id, title, notes, status, priority, story_points, tags, workspace_id,
       send_immediately, session_id, agent, use_worktree, version, created_at, updated_at)
      VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
      id, titleOf(input?.title), notesOf(input?.notes ?? ''), priorityOf(input?.priority ?? 'medium'),
      storyPointsOf(input?.storyPoints ?? null), JSON.stringify(tagsOf(input?.tags ?? [])),
      workspaceIdOf(input?.workspaceId ?? null), booleanOf(input?.sendImmediately ?? false, 'send immediately') ? 1 : 0,
      optionalIdOf(input?.sessionId ?? null, 'session id'), optionalIdOf(input?.agent ?? null, 'agent'),
      booleanOf(input?.useWorktree ?? false, 'use worktree') ? 1 : 0, now, now,
    )
    return this.get(id)!
  }

  update(input: UpdateTaskRequest): TaskRecord {
    const id = idOf(input?.id)
    const version = versionOf(input?.version)
    const current = this.db.prepare(`${select} WHERE id = ?`).get(id) as unknown as TaskRow | undefined
    if (!current) throw new Error('task not found')
    if (current.version !== version) throw new Error('task changed; refresh and retry')
    const title = input.title === undefined ? current.title : titleOf(input.title)
    const notes = input.notes === undefined ? current.notes : notesOf(input.notes)
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
    const now = Date.now()
    const startedAt = status === 'in_progress' && current.startedAt === null ? now : current.startedAt
    const completedAt = status === current.status ? current.completedAt : status === 'done' ? now : null
    const result = this.db.prepare(`UPDATE tasks SET title = ?, notes = ?, status = ?, priority = ?, story_points = ?,
      tags = ?, workspace_id = ?, send_immediately = ?, session_id = ?, agent = ?, use_worktree = ?,
      started_at = ?, completed_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(
      title, notes, status, priority, storyPoints, JSON.stringify(tags), workspaceId,
      sendImmediately ? 1 : 0, sessionId, agent, useWorktree ? 1 : 0,
      startedAt, completedAt, now, id, version,
    )
    if (result.changes !== 1) throw new Error('task changed; refresh and retry')
    return this.get(id)!
  }

  delete(id: string, version: number): void {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ? AND version = ?').run(idOf(id), versionOf(version))
    if (result.changes !== 1) throw new Error('task missing or changed; refresh and retry')
  }

  createSubtask(input: CreateSubtaskRequest): SubtaskRecord {
    const taskId = idOf(input?.taskId)
    if (this.db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId) === undefined) throw new Error('task not found')
    const id = randomUUID()
    const now = Date.now()
    this.db.prepare(`INSERT INTO subtasks (id, task_id, notes, status, session_id, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)`).run(
      id, taskId, subtaskNotesOf(input?.notes), statusOf(input?.status ?? 'todo'),
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
    const status = input.status === undefined ? current.status : statusOf(input.status)
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
