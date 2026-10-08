import type { TaskRecord } from '../types.ts'
import { syncError, syncRemoteError } from './errors.ts'
import type { SyncConfigStore } from './config-store.ts'
import type { SyncLinkStore } from './link-store.ts'
import type { SyncRunStore } from './run-store.ts'
import type { SyncExecutor } from './executor.ts'
import type { AdapterFactory } from './types.ts'
import type { TaskStore } from '../store.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, DeleteConnectionRequest, DeleteSyncRuleRequest,
  DeleteResult, GetSyncRunRequest, ListItemResultsRequest, ListRunsRequest, MetadataScope,
  Page, SafeConnection, SafeItemResult, SafeRun, StartSyncResult, SyncErrorDto, SyncMetadata,
  SyncRule, TestConnectionResult, UpdateConnectionRequest, UpdateSyncRuleRequest,
} from './dto.ts'

/** Everything one manual sync service needs: the stores, the run owner, and the adapter builder. */
export interface SyncServiceOptions {
  tasks: TaskStore
  config: SyncConfigStore
  links: SyncLinkStore
  runs: SyncRunStore
  executor: SyncExecutor
  adapterFactory: AdapterFactory
}

/** Extract a safe DTO from a thrown value; a raw message, header or body is never echoed. */
function errorDto(error: unknown): SyncErrorDto {
  if (error !== null && typeof error === 'object') {
    const e = error as { code?: unknown; details?: SyncErrorDto }
    if (e.code === 'task-list/sync' && e.details && typeof e.details.code === 'string') return e.details
  }
  return syncError('UnexpectedFailure', { scope: 'connection' })
}

/**
 * Host-side manual sync service. The 14 public methods are the business
 * surface the TaskService delegates to, each returning a closed Safe DTO.
 * Runs are owned by the executor; metadata/test are explicit read-only actions
 * that build an adapter through the injected factory with a no-op gate — a
 * disabled connection is still an allowed read.
 */
export class SyncService {
  readonly tasks: TaskStore
  readonly config: SyncConfigStore
  readonly links: SyncLinkStore
  readonly runs: SyncRunStore
  readonly executor: SyncExecutor
  readonly adapterFactory: AdapterFactory

  constructor(options: SyncServiceOptions) {
    this.tasks = options.tasks
    this.config = options.config
    this.links = options.links
    this.runs = options.runs
    this.executor = options.executor
    this.adapterFactory = options.adapterFactory
  }

  listSyncConnections(): SafeConnection[] {
    return this.config.listConnections()
  }

  createSyncConnection(request: CreateConnectionRequest): SafeConnection {
    return this.config.createConnection(request)
  }

  updateSyncConnection(request: UpdateConnectionRequest): SafeConnection {
    return this.config.updateConnection(request)
  }

  deleteSyncConnection(request: DeleteConnectionRequest): DeleteResult {
    this.config.deleteConnection(request)
    return { deleted: true }
  }

  listSyncRules(): SyncRule[] {
    return this.config.listRules()
  }

  createSyncRule(request: CreateSyncRuleRequest): SyncRule {
    return this.config.createRule(request)
  }

  updateSyncRule(request: UpdateSyncRuleRequest): SyncRule {
    return this.config.updateRule(request)
  }

  deleteSyncRule(request: DeleteSyncRuleRequest): DeleteResult {
    this.config.deleteRule(request)
    return { deleted: true }
  }

  async getSyncMetadata(scope: MetadataScope): Promise<SyncMetadata> {
    const connection = this.requireConnection(scope.connectionId)
    const adapter = await this.adapterFactory(connection, { beforeRequest: () => {}, ...(scope.projectId ? { projectId: scope.projectId } : {}) })
    return adapter.metadata(scope, new AbortController().signal)
  }

  async testSyncConnection(scope: MetadataScope): Promise<TestConnectionResult> {
    const connection = this.requireConnection(scope.connectionId)
    const credentialPresent = connection.credentialPresent
    try {
      const metadata = await this.getSyncMetadata(scope)
      return { ok: true, credentialPresent, readOnly: metadata.readOnly }
    } catch (error) {
      return { ok: false, credentialPresent, error: errorDto(error) }
    }
  }

  startSync(): StartSyncResult {
    return this.executor.start()
  }

  getSyncRun(request: GetSyncRunRequest): SafeRun | null {
    return this.runs.getRun(request.id)
  }

  listSyncRuns(request: ListRunsRequest): Page<SafeRun> {
    return this.runs.listRuns(request.page, request.pageSize)
  }

  listSyncItemResults(request: ListItemResultsRequest): Page<SafeItemResult> {
    return this.runs.listItemResults(request.id, request.page, request.pageSize)
  }

  /** Attach the current page's sync-source badges in one batch, never a platform request. */
  attachSources(tasks: TaskRecord[]): TaskRecord[] {
    return this.links.attachSources(tasks)
  }

  private requireConnection(connectionId: string): SafeConnection {
    const connection = this.config.getConnection(connectionId)
    if (connection === null) {
      throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
    }
    return connection
  }
}
