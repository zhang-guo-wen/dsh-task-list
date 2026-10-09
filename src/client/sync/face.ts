import type { BeginAuthResult, SafeAuthState } from '../../sync/oauth-types.ts'
import type { AuthRequest } from '../../sync/oauth-validation.ts'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { syncError, syncRemoteError } from '../../sync/errors.ts'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, DeleteConnectionRequest, DeleteSyncRuleRequest,
  DeleteResult, GetSyncRunRequest, ListItemResultsRequest, ListOrganizationsRequest, ListRunsRequest,
  MetadataScope, OrganizationChoice, Page, SafeConnection, SafeItemResult, SafeRun, StartSyncResult,
  SyncMetadata, SyncRule, TestConnectionResult, UpdateConnectionRequest, UpdateSyncRuleRequest,
} from '../../sync/dto.ts'

/** The mounted sync Remote methods; every method folds failures into a `RemoteResult`. */
export interface SyncRemoteService {
  getSyncAuthState(request: AuthRequest): Promise<RemoteResult<SafeAuthState>>
  beginSyncAuthorization(request: AuthRequest): Promise<RemoteResult<BeginAuthResult>>
  cancelSyncAuthorization(request: AuthRequest): Promise<RemoteResult<{ ok: true }>>
  disconnectSyncAuthorization(request: AuthRequest): Promise<RemoteResult<{ ok: true }>>
  listSyncConnections(request: Record<string, never>): Promise<RemoteResult<SafeConnection[]>>
  createSyncConnection(request: CreateConnectionRequest): Promise<RemoteResult<SafeConnection>>
  updateSyncConnection(request: UpdateConnectionRequest): Promise<RemoteResult<SafeConnection>>
  deleteSyncConnection(request: DeleteConnectionRequest): Promise<RemoteResult<DeleteResult>>
  listSyncRules(request: Record<string, never>): Promise<RemoteResult<SyncRule[]>>
  createSyncRule(request: CreateSyncRuleRequest): Promise<RemoteResult<SyncRule>>
  updateSyncRule(request: UpdateSyncRuleRequest): Promise<RemoteResult<SyncRule>>
  deleteSyncRule(request: DeleteSyncRuleRequest): Promise<RemoteResult<DeleteResult>>
  getSyncMetadata(request: MetadataScope): Promise<RemoteResult<SyncMetadata>>
  testSyncConnection(request: MetadataScope): Promise<RemoteResult<TestConnectionResult>>
  startSync(request: Record<string, never>): Promise<RemoteResult<StartSyncResult>>
  getSyncRun(request: GetSyncRunRequest): Promise<RemoteResult<SafeRun | null>>
  listSyncRuns(request: ListRunsRequest): Promise<RemoteResult<Page<SafeRun>>>
  listSyncItemResults(request: ListItemResultsRequest): Promise<RemoteResult<Page<SafeItemResult>>>
  listSyncOrganizations(request: ListOrganizationsRequest): Promise<RemoteResult<OrganizationChoice[]>>
}

/** Browser-side business values; sync methods mapped 1:1 onto the Remote service. */
export interface SyncFace {
  getSyncAuthState(request: AuthRequest): Promise<SafeAuthState>
  beginSyncAuthorization(request: AuthRequest): Promise<BeginAuthResult>
  cancelSyncAuthorization(request: AuthRequest): Promise<{ ok: true }>
  disconnectSyncAuthorization(request: AuthRequest): Promise<{ ok: true }>
  listSyncConnections(): Promise<SafeConnection[]>
  createSyncConnection(request: CreateConnectionRequest): Promise<SafeConnection>
  updateSyncConnection(request: UpdateConnectionRequest): Promise<SafeConnection>
  deleteSyncConnection(request: DeleteConnectionRequest): Promise<DeleteResult>
  listSyncRules(): Promise<SyncRule[]>
  createSyncRule(request: CreateSyncRuleRequest): Promise<SyncRule>
  updateSyncRule(request: UpdateSyncRuleRequest): Promise<SyncRule>
  deleteSyncRule(request: DeleteSyncRuleRequest): Promise<DeleteResult>
  getSyncMetadata(request: MetadataScope): Promise<SyncMetadata>
  testSyncConnection(request: MetadataScope): Promise<TestConnectionResult>
  startSync(): Promise<StartSyncResult>
  getSyncRun(request: GetSyncRunRequest): Promise<SafeRun | null>
  listSyncRuns(request: ListRunsRequest): Promise<Page<SafeRun>>
  listSyncItemResults(request: ListItemResultsRequest): Promise<Page<SafeItemResult>>
  listSyncOrganizations(request: ListOrganizationsRequest): Promise<OrganizationChoice[]>
}

/**
 * Unwrap one Remote call into its business value while preserving the
 * structured {@link RemoteError} (code + details) instead of erasing it into a
 * generic message. A sync method that rejects rather than returning a
 * `RemoteResult` is an assembly fault — the Host predates the sync methods — so
 * it surfaces as `HostRestartRequired`.
 */
export async function unwrapSync<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  try {
    const result = await call
    if (!result.ok) throw result.error
    return result.value
  } catch (error) {
    if (typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string') throw error
    throw syncRemoteError(syncError('HostRestartRequired', { scope: 'config' }))
  }
}

export function createSyncFace(remote: () => SyncRemoteService): SyncFace {
  const authCall = async <T,>(call: () => Promise<RemoteResult<T>>): Promise<T> => {
    try { return await unwrapSync(call()) } catch (error) { if (error instanceof TypeError) throw syncRemoteError(syncError('HostRestartRequired', { scope: 'connection' })); throw error }
  }
  return {
    getSyncAuthState: request => authCall(() => remote().getSyncAuthState(request)),
    beginSyncAuthorization: request => authCall(() => remote().beginSyncAuthorization(request)),
    cancelSyncAuthorization: request => authCall(() => remote().cancelSyncAuthorization(request)),
    disconnectSyncAuthorization: request => authCall(() => remote().disconnectSyncAuthorization(request)),
    listSyncConnections: () => unwrapSync(remote().listSyncConnections({})),
    createSyncConnection: request => unwrapSync(remote().createSyncConnection(request)),
    updateSyncConnection: request => unwrapSync(remote().updateSyncConnection(request)),
    deleteSyncConnection: request => unwrapSync(remote().deleteSyncConnection(request)),
    listSyncRules: () => unwrapSync(remote().listSyncRules({})),
    createSyncRule: request => unwrapSync(remote().createSyncRule(request)),
    updateSyncRule: request => unwrapSync(remote().updateSyncRule(request)),
    deleteSyncRule: request => unwrapSync(remote().deleteSyncRule(request)),
    getSyncMetadata: request => unwrapSync(remote().getSyncMetadata(request)),
    testSyncConnection: request => unwrapSync(remote().testSyncConnection(request)),
    startSync: () => unwrapSync(remote().startSync({})),
    getSyncRun: request => unwrapSync(remote().getSyncRun(request)),
    listSyncRuns: request => unwrapSync(remote().listSyncRuns(request)),
    listSyncItemResults: request => unwrapSync(remote().listSyncItemResults(request)),
    listSyncOrganizations: request => authCall(() => remote().listSyncOrganizations(request)),
  }
}
