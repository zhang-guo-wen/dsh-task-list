import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { CreateTaskRequest, DeleteTaskRequest, ListTasksRequest, TaskRecord, UpdateTaskRequest } from './types.ts'
import type { TaskStore } from './store.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { taskList: TaskService }
}

export class TaskService extends TypertRemoteService {
  constructor(ctx: Context, readonly store: TaskStore) { super(ctx, 'taskList') }

  @Remote('listTasks')
  async listTasks(request: ListTasksRequest): Promise<TaskRecord[]> {
    return this.store.list(request?.status)
  }

  @Remote('createTask')
  async createTask(request: CreateTaskRequest): Promise<TaskRecord> {
    return this.store.create(request)
  }

  @Remote('updateTask')
  async updateTask(request: UpdateTaskRequest): Promise<TaskRecord> {
    return this.store.update(request)
  }

  @Remote('deleteTask')
  async deleteTask(request: DeleteTaskRequest): Promise<{ deleted: true }> {
    this.store.delete(request?.id, request?.version)
    return { deleted: true }
  }
}
