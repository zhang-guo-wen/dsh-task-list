export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

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
}

export interface ListTasksRequest { status?: TaskStatus }
export interface CreateTaskRequest {
  title: string
  notes?: string
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
