export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/** One checklist row under a task; it may point at the conversation that works on it. */
export interface SubtaskRecord {
  id: string
  taskId: string
  notes: string
  status: TaskStatus
  sessionId: string | null
  version: number
  createdAt: number
  updatedAt: number
}

export interface TaskRecord {
  id: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  storyPoints: number | null
  tags: string[]
  workspaceId: string | null
  sendImmediately: boolean
  sessionId: string | null
  agent: string | null
  useWorktree: boolean
  startedAt: number | null
  completedAt: number | null
  version: number
  createdAt: number
  updatedAt: number
  /** Rows of this task, oldest first; the list carries them with the page. */
  subtasks: SubtaskRecord[]
}

/** Rows the panel shows per page before the next request. */
export const DEFAULT_PAGE_SIZE = 20
/** Upper bound the store enforces on one page. */
export const MAX_PAGE_SIZE = 100
/** Longest accepted search phrase. */
export const SEARCH_LIMIT = 200

export interface ListTasksRequest {
  status?: TaskStatus
  /** Literal phrase matched against the content, title, ids, and subtasks. */
  query?: string
  /** Restrict to one workspace id. */
  workspaceId?: string
  /** Also match tasks that carry no workspace id (they belong to the default workspace). */
  includeUnassigned?: boolean
  page?: number
  pageSize?: number
}

/** One page of tasks plus the count the pager needs. */
export interface TaskPage {
  items: TaskRecord[]
  total: number
  page: number
  pageSize: number
}

export interface CreateTaskRequest {
  title: string
  notes?: string
  /** Status the new task starts in; the store defaults to `todo`. */
  status?: TaskStatus
  priority?: TaskPriority
  storyPoints?: number | null
  tags?: string[]
  workspaceId?: string | null
  sendImmediately?: boolean
  sessionId?: string | null
  agent?: string | null
  useWorktree?: boolean
}
export interface UpdateTaskRequest {
  id: string
  version: number
  title?: string
  notes?: string
  status?: TaskStatus
  priority?: TaskPriority
  storyPoints?: number | null
  tags?: string[]
  workspaceId?: string | null
  sendImmediately?: boolean
  sessionId?: string | null
  agent?: string | null
  useWorktree?: boolean
}
export interface DeleteTaskRequest { id: string; version: number }

export interface CreateSubtaskRequest {
  taskId: string
  notes: string
  status?: TaskStatus
  sessionId?: string | null
}
export interface UpdateSubtaskRequest {
  id: string
  version: number
  notes?: string
  status?: TaskStatus
  sessionId?: string | null
}
export interface DeleteSubtaskRequest { id: string; version: number }
