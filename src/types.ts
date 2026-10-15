export type TaskMark = 'bold' | 'italic' | 'underline' | 'code' | 'strikethrough'
export interface TaskInline { text: string; marks?: TaskMark[]; href?: string }
export interface TaskTextBlock {
  type: 'paragraph' | 'heading' | 'bullet' | 'ordered' | 'quote' | 'code'
  children: TaskInline[]
  level?: number
  indent?: number
}
export interface TaskTableCell { blocks: TaskTextBlock[]; header?: boolean; colSpan?: number; rowSpan?: number }
export type TaskContentBlock =
  | TaskTextBlock
  | { type: 'table'; rows: TaskTableCell[][] }
  | { type: 'attachment'; id: string; name: string; mediaType: string; bytes: number }
export interface TaskContent { version: 1; blocks: TaskContentBlock[] }
/** Bytes are sent only on save/read, never in a task-list page. */
export interface TaskAttachmentUpload { id: string; data: string }
export interface ReadTaskAttachmentsRequest { id: string; version: number }

/**
 * Lifecycle of one task. `approving` is a local review gate that sync never
 * writes: a rule maps only `RULE_STATUSES`, so a task waiting for approval
 * keeps its last mappable status on the remote side.
 */
export type TaskStatus = 'todo' | 'in_progress' | 'approving' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/** Every status, in the order the list, the filter row, and the overview count them. */
export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'approving', 'done']
/** The statuses a sync rule maps to platform statuses; the local review gate is not one. */
export type MappableStatus = Exclude<TaskStatus, 'approving'>
/** Every mappable status, in the order a rule form shows them. */
export const RULE_STATUSES: readonly MappableStatus[] = ['todo', 'in_progress', 'done']

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

/** A safe error projection attached to a task source; never raw baseline or content. */
export interface TaskSourceError {
  code: string
  problem: string
  action: string
}

/** Remote identity and last-sync status shown on a task card; injected by the sync service. */
export interface TaskSource {
  platform: 'yunxiao' | 'tapd'
  projectId: string
  typeId: string
  remoteId: string
  number: string
  url: string | null
  lastSuccess: number | null
  error: TaskSourceError | null
}

export interface TaskRecord {
  id: string
  title: string
  /** Structured rich text is the source of truth; notes is a searchable text projection. */
  content: TaskContent
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
  /** Parent task in the decomposition tree, or null when the task is a root. */
  parentId: string | null
  /** Ids this task waits on; every one of them must reach `done` first. */
  blockingIds: string[]
  version: number
  createdAt: number
  updatedAt: number
  /** Rows of this task, oldest first; the list carries them with the page. */
  subtasks: SubtaskRecord[]
  /** Optional sync-source badge; attached once per result page, never persisted on the task row. */
  readonly source?: TaskSource
}

/** Parent/child and wait-on edges of one task, identified by task id. */
export interface TaskRelation {
  taskId: string
  parentId: string | null
  blockingIds: string[]
}

/** One node of a relationship graph with its derived incoming and outgoing edges. */
export interface TaskGraphNode {
  task: TaskRecord
  /** Edges from the parent task into this one; empty for a root. */
  parents: string[]
  /** Edges from this task into its direct children. */
  children: string[]
  /** Edges from this task into the tasks it waits on; the same ids as `task.blockingIds`. */
  waitsOn: string[]
  /** Edges from tasks that wait on this one. */
  waitedOnBy: string[]
  /** True when at least one task this task waits on is not `done` yet. */
  blocked: boolean
}

/** One relationship graph: the nodes plus every edge kind the canvas draws. */
export interface TaskGraph {
  nodes: TaskGraphNode[]
  /** True when `maxNodes` cut the graph; the canvas then offers to narrow the scope. */
  truncated: boolean
}

/** Which part of the task database one graph request reads. */
export interface TaskGraphRequest {
  includeDescendants?: boolean
  includeAncestors?: boolean
  includeBlockers?: boolean
  /** Nodes one request may return. The store clamps it to `MAX_GRAPH_NODES`. */
  maxNodes?: number
}

/** Upper bound the store enforces on one graph request. */
export const MAX_GRAPH_NODES = 400

/** Counts per status plus the distinct Sessions the tasks are handled in. */
export interface TaskOverview {
  counts: Record<TaskStatus, number>
  total: number
  /** Tasks whose status is not `done` and that wait on a task which is not `done`. */
  blocked: number
  /** Distinct linked Session ids across every task, most recently updated first. */
  sessionIds: string[]
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
  content?: TaskContent
  attachments?: TaskAttachmentUpload[]
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
  /** Parent task in the decomposition tree. */
  parentId?: string | null
  /** Ids the new task waits on. */
  blockingIds?: string[]
}
export interface UpdateTaskRequest {
  id: string
  version: number
  title?: string
  notes?: string
  content?: TaskContent
  attachments?: TaskAttachmentUpload[]
  status?: TaskStatus
  priority?: TaskPriority
  storyPoints?: number | null
  tags?: string[]
  workspaceId?: string | null
  sendImmediately?: boolean
  sessionId?: string | null
  agent?: string | null
  useWorktree?: boolean
  parentId?: string | null
  blockingIds?: string[]
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

export interface GetTaskGraphRequest {
  /** Scope the graph to one task's component; without it the whole graph is read. */
  rootId?: string | null
  includeDescendants?: boolean
  includeAncestors?: boolean
  includeBlockers?: boolean
  maxNodes?: number
}
