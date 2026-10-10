import type { TaskRecord } from '../types.ts'
import { syncError, syncRemoteError } from './errors.ts'
import type { SyncConfigStore } from './config-store.ts'
import type { SyncLinkStore } from './link-store.ts'
import type { SyncRunStore } from './run-store.ts'
import type { SyncExecutor } from './executor.ts'
import type { AdapterFactory } from './types.ts'
import type { TaskStore } from '../store.ts'
import type { ManualSecretStore } from './credential-provider.ts'
import type { YunxiaoQuery } from './adapters/yunxiao-query.ts'
import type { WorkitemFilterField } from './query/filters.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, DeleteConnectionRequest, DeleteSyncRuleRequest,
  DeleteResult, GetSyncRunRequest, ListItemResultsRequest, ListOrganizationsRequest, ListRunsRequest,
  ListWorkitemFieldsRequest, ListWorkitemsRequest, MetadataScope, OrganizationChoice, Page, SafeConnection,
  SafeItemResult, SafeRun, SafeWorkitemDescriptionResult, SafeWorkitemField, SafeWorkitemPage, StartSyncResult,
  SyncErrorDto, SyncMetadata, SyncRule, TestConnectionResult, UpdateConnectionRequest, UpdateSyncRuleRequest,
  GetWorkitemDescriptionRequest,
} from './dto.ts'

/** Lists the organizations one personal access token can see; injected so the service stays offline-testable. */
export type OrganizationLister = (token: string) => Promise<OrganizationChoice[]>

/** Builds the read-only work-item query surface for one connection. */
export type WorkitemQuery = Pick<YunxiaoQuery, 'listWorkitems' | 'getWorkitem' | 'listFields'>
export type WorkitemQueryFactory = (connection: SafeConnection) => Promise<WorkitemQuery>

/** Everything one manual sync service needs: the stores, the run owner, and the adapter builder. */
export interface SyncServiceOptions {
  tasks: TaskStore
  config: SyncConfigStore
  links: SyncLinkStore
  runs: SyncRunStore
  executor: SyncExecutor
  adapterFactory: AdapterFactory
  /** Host credential store for typed credentials; a reader, since it mounts with the Host services. */
  secrets?: () => ManualSecretStore | undefined
  /** Organization discovery for a typed token; absent when the Host has no credential store. */
  organizations?: OrganizationLister
  /** TAPD organization discovery; the same question asked of a TAPD personal access token. */
  tapdOrganizations?: OrganizationLister
  /** Live OAuth access token of one connection (云效 official authorization). */
  oauthToken?: (connectionId: string) => Promise<string | null>
  /** Read-only work-item query surface; absent on a Host built before this feature. */
  queryFactory?: WorkitemQueryFactory
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
  private readonly secrets: (() => ManualSecretStore | undefined) | undefined
  private readonly organizations: OrganizationLister | undefined
  private readonly tapdOrganizations: OrganizationLister | undefined
  private readonly oauthToken: ((connectionId: string) => Promise<string | null>) | undefined
  private readonly queryFactory: WorkitemQueryFactory | undefined

  constructor(options: SyncServiceOptions) {
    this.tasks = options.tasks
    this.config = options.config
    this.links = options.links
    this.runs = options.runs
    this.executor = options.executor
    this.adapterFactory = options.adapterFactory
    this.secrets = options.secrets
    this.organizations = options.organizations
    this.tapdOrganizations = options.tapdOrganizations
    this.oauthToken = options.oauthToken
    this.queryFactory = options.queryFactory
  }

  /** The live store, or undefined while the Host's credentials service is absent. */
  private secretStore(): ManualSecretStore | undefined { return this.secrets?.() }

  /**
   * A typed credential makes a manual connection usable exactly as an exported
   * environment variable does; OAuth connections keep the grant-based answer.
   */
  private async decorate(connection: SafeConnection): Promise<SafeConnection> {
    if (connection.authentication?.mode === 'oauth' || connection.credentialPresent) return connection
    const stored = await this.secretStore()?.read(connection.id)
    return stored === undefined || stored === null || stored.platform !== connection.platform ? connection : { ...connection, credentialPresent: true }
  }

  async listSyncConnections(): Promise<SafeConnection[]> {
    return Promise.all(this.config.listConnections().map(connection => this.decorate(connection)))
  }

  /** Store a typed credential before the connection answers as usable. */
  private async storeSecret(id: string, request: { secret?: CreateConnectionRequest['secret'], platform: 'yunxiao' | 'tapd' }): Promise<void> {
    if (request.secret === undefined) return
    const store = this.secretStore()
    if (store === undefined) throw syncRemoteError(syncError('HostRestartRequired', { scope: 'connection', field: 'secret' }))
    if (request.secret.platform !== request.platform) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'secret' }))
    await store.write(id, request.secret)
  }

  async createSyncConnection(request: CreateConnectionRequest): Promise<SafeConnection> {
    const created = this.config.createConnection(request)
    await this.storeSecret(created.id, request)
    return this.decorate(created)
  }

  async updateSyncConnection(request: UpdateConnectionRequest): Promise<SafeConnection> {
    const updated = this.config.updateConnection(request)
    await this.storeSecret(updated.id, { ...(request.secret === undefined ? {} : { secret: request.secret }), platform: updated.platform })
    return this.decorate(updated)
  }

  async deleteSyncConnection(request: DeleteConnectionRequest): Promise<DeleteResult> {
    this.config.deleteConnection(request)
    await this.forgetSecret(request.id)
    return { deleted: true }
  }

  /** Drop one connection's typed credential; the OAuth path owns the grant record itself. */
  async forgetSecret(id: string): Promise<void> { await this.secretStore()?.remove(id) }

  /**
   * List the organizations a personal access token belongs to. The token is
   * either the one just typed in the editor or the connection's stored one; it
   * is never persisted by this call. A TAPD token answers with the account's
   * own organization, so its editor never has to ask for the company by hand.
   */
  async listSyncOrganizations(request: ListOrganizationsRequest): Promise<OrganizationChoice[]> {
    let token = request.token
    let platform = request.platform
    if (request.connectionId !== undefined) {
      const connection = this.config.getConnection(request.connectionId)
      platform = platform ?? connection?.platform
    }
    if (token === undefined && request.connectionId !== undefined) {
      const stored = await this.secretStore()?.read(request.connectionId)
      // A typed credential wins; an official authorization's own access token
      // answers the same question for a saved OAuth connection.
      token = stored != null && (platform === undefined || stored.platform === platform)
        ? stored.token
        : (await this.oauthToken?.(request.connectionId)) ?? undefined
    }
    if (token === undefined || !token.trim()) throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'token' }))
    const lister = platform === 'tapd' ? this.tapdOrganizations : this.organizations
    if (lister === undefined) throw syncRemoteError(syncError('HostRestartRequired', { scope: 'connection', field: 'secret' }))
    return lister(token)
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
    const connection = await this.decorate(this.requireConnection(scope.connectionId))
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

  /**
   * One page of remote work items, projected to exactly the requested fields.
   * Filtering and sorting happen on the platform (verified `conditions` and
   * `orderBy`), so nothing is fetched only to be discarded locally.
   */
  async listWorkitems(request: ListWorkitemsRequest): Promise<SafeWorkitemPage> {
    const connection = this.requireConnection(request.connectionId)
    if (this.queryFactory === undefined) throw syncRemoteError(syncError('HostRestartRequired', { scope: 'query', field: 'queryFactory' }))
    const query = await this.queryFactory(connection)
    const conditions = request.conditions?.map(group => group.map(condition => ({
      field: condition.field as WorkitemFilterField,
      ...(condition.operator === undefined ? {} : { operator: condition.operator }),
      value: condition.value,
      ...(condition.toValue === undefined || condition.toValue === null ? {} : { toValue: condition.toValue }),
    })))
    const page = await query.listWorkitems({
      projectId: request.projectId,
      categories: request.categories,
      page: request.page,
      perPage: request.perPage,
      fields: request.fields,
      customFieldIds: request.customFieldIds,
      orderBy: request.orderBy,
      sort: request.sort,
      ...(conditions === undefined ? {} : { conditions }),
    }, new AbortController().signal)
    return {
      items: page.items,
      page: page.page,
      perPage: page.perPage,
      total: page.total,
      totalPages: page.totalPages,
      fields: [...page.fields],
    }
  }

  /**
   * One work item's body, unwrapped from the platform's JSON carrier. This is
   * the single detail request the "create a task from a work item" flow needs:
   * every other field already comes from the list projection.
   */
  async getWorkitemDescription(request: GetWorkitemDescriptionRequest): Promise<SafeWorkitemDescriptionResult> {
    const connection = this.requireConnection(request.connectionId)
    if (this.queryFactory === undefined) throw syncRemoteError(syncError('HostRestartRequired', { scope: 'query', field: 'queryFactory' }))
    const query = await this.queryFactory(connection)
    const detail = await query.getWorkitem({
      projectId: request.projectId,
      id: request.id,
      include: ['description'],
      fields: ['id'],
    }, new AbortController().signal)
    return { description: detail.description }
  }

  /**
   * Every selectable field of one project category — or of a comma-joined set
   * of them — so the caller can offer the platform's own column catalog (native
   * fields and custom fields alike) while a category-free list is shown.
   */
  async listWorkitemFields(request: ListWorkitemFieldsRequest): Promise<SafeWorkitemField[]> {
    const connection = this.requireConnection(request.connectionId)
    if (this.queryFactory === undefined) throw syncRemoteError(syncError('HostRestartRequired', { scope: 'query', field: 'queryFactory' }))
    const query = await this.queryFactory(connection)
    return query.listFields(
      { projectId: request.projectId, categories: request.categories },
      new AbortController().signal,
    )
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
