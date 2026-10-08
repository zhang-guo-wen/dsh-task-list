import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CreateSubtaskRequest, CreateTaskRequest, DeleteSubtaskRequest, DeleteTaskRequest, ListTasksRequest,
  SubtaskRecord, TaskPage, TaskRecord, UpdateSubtaskRequest, UpdateTaskRequest,
} from './types.ts'
import type { TaskStore } from './store.ts'
import type { SyncAuthorizationService } from './sync/authorization-service.ts'
import type { AuthRequest } from './sync/oauth-validation.ts'
import type { SyncService } from './sync/service.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, DeleteConnectionRequest, DeleteSyncRuleRequest,
  DeleteResult, EmptyRequest, GetSyncRunRequest, ListItemResultsRequest, ListRunsRequest, MetadataScope,
  Page, SafeConnection, SafeItemResult, SafeRun, StartSyncResult, SyncMetadata, SyncRule,
  TestConnectionResult, UpdateConnectionRequest, UpdateSyncRuleRequest,
} from './sync/dto.ts'
import { type StatisticsRequest, type StatisticsRunState, type StatisticsSnapshot } from './statistics.ts'
import { statisticsRunRequest, type StatisticsService } from './statistics-service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { taskList: TaskService }
}

export class TaskService extends TypertRemoteService {
  constructor(ctx: Context, readonly store: TaskStore, readonly sync: SyncService, readonly statistics: StatisticsService, readonly authorization?: SyncAuthorizationService) { super(ctx, 'taskList') }

  @Remote('getSyncAuthState')
  async getSyncAuthState(request: AuthRequest) { return this.authorization!.state(request) }
  @Remote('beginSyncAuthorization')
  async beginSyncAuthorization(request: AuthRequest) { return this.authorization!.begin(request) }
  @Remote('cancelSyncAuthorization')
  async cancelSyncAuthorization(request: AuthRequest) { return this.authorization!.cancel(request) }
  @Remote('disconnectSyncAuthorization')
  async disconnectSyncAuthorization(request: AuthRequest) { return this.authorization!.disconnect(request) }

  @Remote('capabilities')
  async capabilities(request: Record<string, never>) {
    return { version: 1 as const, richText: true as const, attachments: true as const }
  }

  /** Fold the requested range to completion; the polling client uses `startStatistics` instead. */
  @Remote('calculateStatistics')
  async calculateStatistics(request: StatisticsRequest): Promise<StatisticsSnapshot> {
    return this.statistics.calculate(statisticsRunRequest(request))
  }

  /** Start one background statistics sweep the browser can poll and cancel. */
  @Remote('startStatistics')
  async startStatistics(request: StatisticsRequest): Promise<{ jobId: string }> {
    return { jobId: this.statistics.start(statisticsRunRequest(request)) }
  }

  /** Read the current progress, result, or failure of one sweep. */
  @Remote('getStatisticsRun')
  async getStatisticsRun(request: { jobId: string }): Promise<StatisticsRunState | null> {
    if (typeof request?.jobId !== 'string') throw new Error('invalid statistics job')
    return this.statistics.get(request.jobId)
  }

  /** Stop one running sweep. */
  @Remote('cancelStatistics')
  async cancelStatistics(request: { jobId: string }): Promise<{ cancelled: boolean }> {
    if (typeof request?.jobId !== 'string') throw new Error('invalid statistics job')
    return { cancelled: this.statistics.cancel(request.jobId) }
  }

  @Remote('listTasks')
  async listTasks(request: ListTasksRequest): Promise<TaskPage> {
    const page = this.store.list(request ?? {})
    return { ...page, items: this.sync.attachSources(page.items) }
  }

  @Remote('createTask')
  async createTask(request: CreateTaskRequest): Promise<TaskRecord> {
    return this.store.create(request)
  }

  @Remote('updateTask')
  async updateTask(request: UpdateTaskRequest): Promise<TaskRecord> {
    return this.store.update(request)
  }

  @Remote('readTaskAttachments')
  async readTaskAttachments(request: { id: string; version: number }) {
    return this.store.readAttachments(request?.id, request?.version)
  }

  @Remote('deleteTask')
  async deleteTask(request: DeleteTaskRequest): Promise<{ deleted: true }> {
    this.store.delete(request?.id, request?.version)
    return { deleted: true }
  }

  @Remote('createSubtask')
  async createSubtask(request: CreateSubtaskRequest): Promise<SubtaskRecord> {
    return this.store.createSubtask(request)
  }

  @Remote('updateSubtask')
  async updateSubtask(request: UpdateSubtaskRequest): Promise<SubtaskRecord> {
    return this.store.updateSubtask(request)
  }

  @Remote('deleteSubtask')
  async deleteSubtask(request: DeleteSubtaskRequest): Promise<{ deleted: true }> {
    this.store.deleteSubtask(request?.id, request?.version)
    return { deleted: true }
  }

  @Remote('listSyncConnections')
  async listSyncConnections(request: EmptyRequest): Promise<SafeConnection[]> {
    const connections = this.sync.listSyncConnections()
    return this.authorization ? Promise.all(connections.map(connection => this.authorization!.decorate(connection))) : connections
  }

  @Remote('createSyncConnection')
  async createSyncConnection(request: CreateConnectionRequest): Promise<SafeConnection> {
    return this.sync.createSyncConnection(request)
  }

  @Remote('updateSyncConnection')
  async updateSyncConnection(request: UpdateConnectionRequest): Promise<SafeConnection> {
    const connection = this.sync.updateSyncConnection(request)
    return this.authorization ? this.authorization.decorate(connection) : connection
  }

  @Remote('deleteSyncConnection')
  async deleteSyncConnection(request: DeleteConnectionRequest): Promise<DeleteResult> {
    if (this.authorization) { await this.authorization.deleteConnection(request); return { deleted: true } }
    return this.sync.deleteSyncConnection(request)
  }

  @Remote('listSyncRules')
  async listSyncRules(request: EmptyRequest): Promise<SyncRule[]> {
    return this.sync.listSyncRules()
  }

  @Remote('createSyncRule')
  async createSyncRule(request: CreateSyncRuleRequest): Promise<SyncRule> {
    return this.sync.createSyncRule(request)
  }

  @Remote('updateSyncRule')
  async updateSyncRule(request: UpdateSyncRuleRequest): Promise<SyncRule> {
    return this.sync.updateSyncRule(request)
  }

  @Remote('deleteSyncRule')
  async deleteSyncRule(request: DeleteSyncRuleRequest): Promise<DeleteResult> {
    return this.sync.deleteSyncRule(request)
  }

  @Remote('getSyncMetadata')
  async getSyncMetadata(request: MetadataScope): Promise<SyncMetadata> {
    return this.sync.getSyncMetadata(request)
  }

  @Remote('testSyncConnection')
  async testSyncConnection(request: MetadataScope): Promise<TestConnectionResult> {
    return this.sync.testSyncConnection(request)
  }

  @Remote('startSync')
  async startSync(request: EmptyRequest): Promise<StartSyncResult> {
    return this.sync.startSync()
  }

  @Remote('getSyncRun')
  async getSyncRun(request: GetSyncRunRequest): Promise<SafeRun | null> {
    return this.sync.getSyncRun(request)
  }

  @Remote('listSyncRuns')
  async listSyncRuns(request: ListRunsRequest): Promise<Page<SafeRun>> {
    return this.sync.listSyncRuns(request)
  }

  @Remote('listSyncItemResults')
  async listSyncItemResults(request: ListItemResultsRequest): Promise<Page<SafeItemResult>> {
    return this.sync.listSyncItemResults(request)
  }
}
