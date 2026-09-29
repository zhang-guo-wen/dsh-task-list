import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CreateTaskRequest, TaskPriority, TaskRecord, TaskStatus, UpdateTaskRequest } from './types.ts'

const statuses = new Set<TaskStatus>(['todo', 'in_progress', 'done'])
const priorities = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])
const titleLimit = 200
const notesLimit = 20_000

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

const select = `SELECT id, title, notes, status, priority, story_points AS storyPoints,
  tags, workspace_id AS workspaceId, send_immediately AS sendImmediately,
  session_id AS sessionId, agent, use_worktree AS useWorktree,
  started_at AS startedAt, completed_at AS completedAt,
  version, created_at AS createdAt, updated_at AS updatedAt FROM tasks`

function taskOf(row: TaskRow): TaskRecord {
  return { ...row, tags: tagsOf(JSON.parse(row.tags)), sendImmediately: row.sendImmediately === 1, useWorktree: row.useWorktree === 1 }
}

export class TaskStore {
  readonly db: DatabaseSync

  constructor(readonly file: string) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(file)
    try {
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
      const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number }
      if (version.user_version > 3) throw new Error(`unsupported task database version: ${version.user_version}`)
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
          PRAGMA user_version = 3;
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
          PRAGMA user_version = 3;
          COMMIT;
        `)
      } else if (version.user_version === 2) {
        this.db.exec(`BEGIN;
          ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
          ALTER TABLE tasks ADD COLUMN session_id TEXT;
          ALTER TABLE tasks ADD COLUMN agent TEXT;
          ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
          PRAGMA user_version = 3;
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

  list(status?: TaskStatus): TaskRecord[] {
    if (status !== undefined) {
      return (this.db.prepare(`${select} WHERE status = ? ORDER BY updated_at DESC, id`).all(statusOf(status)) as unknown as TaskRow[]).map(taskOf)
    }
    return (this.db.prepare(`${select} ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, updated_at DESC, id`).all() as unknown as TaskRow[]).map(taskOf)
  }

  get(id: string): TaskRecord | null {
    const row = this.db.prepare(`${select} WHERE id = ?`).get(idOf(id)) as unknown as TaskRow | undefined
    return row ? taskOf(row) : null
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
    const current = this.get(id)
    if (!current) throw new Error('task not found')
    if (current.version !== version) throw new Error('task changed; refresh and retry')
    const title = input.title === undefined ? current.title : titleOf(input.title)
    const notes = input.notes === undefined ? current.notes : notesOf(input.notes)
    const status = input.status === undefined ? current.status : statusOf(input.status)
    const priority = input.priority === undefined ? current.priority : priorityOf(input.priority)
    const storyPoints = input.storyPoints === undefined ? current.storyPoints : storyPointsOf(input.storyPoints)
    const tags = input.tags === undefined ? current.tags : tagsOf(input.tags)
    const workspaceId = input.workspaceId === undefined ? current.workspaceId : workspaceIdOf(input.workspaceId)
    const sendImmediately = input.sendImmediately === undefined ? current.sendImmediately : booleanOf(input.sendImmediately, 'send immediately')
    const sessionId = input.sessionId === undefined ? current.sessionId : optionalIdOf(input.sessionId, 'session id')
    const agent = input.agent === undefined ? current.agent : optionalIdOf(input.agent, 'agent')
    const useWorktree = input.useWorktree === undefined ? current.useWorktree : booleanOf(input.useWorktree, 'use worktree')
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
}
