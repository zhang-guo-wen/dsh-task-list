import type { TaskStatus } from '../types.ts'
import type { RemoteKey, SyncField } from './types.ts'

/** The 14 RPC methods added by the sync feature (connections4/rules4/metadata2/runs4). */
export const SYNC_METHODS = [
  'listSyncConnections', 'createSyncConnection', 'updateSyncConnection', 'deleteSyncConnection',
  'listSyncRules', 'createSyncRule', 'updateSyncRule', 'deleteSyncRule',
  'getSyncMetadata', 'testSyncConnection',
  'startSync', 'getSyncRun', 'listSyncRuns', 'listSyncItemResults',
] as const
export type SyncMethod = (typeof SYNC_METHODS)[number]

// --- Connections ---

export type ConnectionAuth = { mode: 'manual' } | { mode: 'oauth'; appId?: string; appSecretRef?: string; callbackUrl?: string }
export interface SafeConnectionBase {
  /** Non-secret authentication configuration; omitted legacy values mean manual. */
  authentication?: ConnectionAuth
  id: string
  name: string
  enabled: boolean
  revision: number
  credentialPresent: boolean
  instance: string
}

export interface YunxiaoConnection extends SafeConnectionBase {
  platform: 'yunxiao'
  mode: 'center' | 'region'
  organizationId: string
  regionHost: string | null
  tokenEnv: string
}

export interface TapdConnection extends SafeConnectionBase {
  platform: 'tapd'
  companyId: string
  userEnv: string
  passwordEnv: string
}

export type SafeConnection = YunxiaoConnection | TapdConnection

// --- Rules ---

export interface SyncRuleFilters {
  assignees: string[]
  typeIds: string[]
  iterationIds: string[]
  statusIds: string[]
}

export interface TypeMapping {
  typeId: string
  category: string
  readStates: Record<string, TaskStatus>
  writeStates: Record<TaskStatus, string>
  optionalFields: ('priority' | 'tags' | 'storyPoints')[]
  fieldIds: Partial<Record<SyncField, string>>
  valueMaps: Partial<Record<'priority' | 'tags', Record<string, string>>>
}

export interface SyncRule {
  id: string
  revision: number
  connectionId: string
  projectId: string
  enabled: boolean
  workspaceId: string | null
  filters: SyncRuleFilters
  mappings: TypeMapping[]
}

// --- Errors ---

export type SyncErrorCode =
  | 'InvalidConfig' | 'CredentialMissing' | 'AuthDenied' | 'EntitlementUnavailable'
  | 'ReadTimeout' | 'NetworkFailure' | 'RateLimited' | 'InvalidRemoteResponse'
  | 'IncompleteDiscovery' | 'RemoteUnavailable' | 'UnsupportedRepresentation' | 'FieldLimit'
  | 'MappingIncompatible' | 'WorkflowRejected' | 'StorageFailure' | 'WriteOutcomeUnknown'
  | 'VerificationFailed' | 'LocalVersionConflict' | 'RunInterrupted' | 'StaleOwner'
  | 'RunNotFound' | 'ResultQueryFailed' | 'UnexpectedFailure' | 'HostRestartRequired'

export type SyncErrorScope = 'config' | 'connection' | 'rule' | 'item' | 'run' | 'query'

/** Troubleshooting chapter anchors shipped with the package. */
export type DocKey = 'credentials' | 'permissions' | 'mapping' | 'content' | 'network' | 'recovery' | 'host-upgrade'

/** Safe error payload; no stack, header, body, or credentials ever appear here. */
export interface SyncErrorDto {
  code: SyncErrorCode
  scope: SyncErrorScope
  field?: string
  problem: string
  cause: string
  /** True when the cause is a hypothesis, not a confirmed root cause. */
  causePossible?: boolean
  action: string
  docKey: DocKey
  retryable: boolean
  runId?: string
  requestId?: string
}

// --- Metadata ---

export interface MetadataScope {
  connectionId: string
  projectId?: string
  typeId?: string
}

export interface Option {
  id: string
  label: string
}

export interface RepresentationCapability {
  format: 'text' | 'markdown' | 'richtext'
  roundTrip: boolean
}

/** One optional field the platform exposes, with its remote id and format, as a mapping candidate. */
export interface OptionalFieldCandidate {
  field: 'priority' | 'tags' | 'storyPoints'
  remoteId: string
  format: string
  writable: boolean
}

export interface TypeCapabilities {
  typeId: string
  fields: SyncField[]
  readStates: Option[]
  writeStates: Option[]
  representation: RepresentationCapability | { unsupported: string }
  paging: { kind: 'page' } | { kind: 'cursor' } | { unsupported: string }
  workflow: { readOnly: boolean } | { unsupported: string }
  /** Optional-field mapping candidates confirmed by field metadata; empty when none are safe. */
  candidateFields: OptionalFieldCandidate[]
}

export interface SyncMetadata {
  connectionId: string
  credentialPresent: boolean
  readOnly: boolean
  projects: Option[]
  members: Option[]
  iterations: Option[]
  types: Option[]
  typeCapabilities: TypeCapabilities[]
}

// --- Runs and results ---

export type SafeRunStatus = 'running' | 'completed' | 'partial' | 'failed' | 'interrupted'
export type SafeRunPhase = 'discovering' | 'processing' | 'waiting' | 'finished'

export interface SafeRunCounts {
  imported: number
  pulled: number
  pushed: number
  merged: number
  unchanged: number
  failed: number
  pending: number
}

export interface SafeRun {
  id: string
  status: SafeRunStatus
  phase: SafeRunPhase
  startedAt: number
  finishedAt: number | null
  counts: SafeRunCounts
  unprocessedKnown: number | null
  discoveryComplete: boolean
  scopeSummary: string
  errors: SyncErrorDto[]
}

export type SafeItemCategory = 'imported' | 'pulled' | 'pushed' | 'merged' | 'unchanged' | 'failed'

export interface SafeItemResult {
  key: RemoteKey
  taskId: string | null
  category: SafeItemCategory
  changedFields: SyncField[]
  discardedFields: SyncField[]
  writtenBack: boolean
  outsideFilter: boolean
  error: SyncErrorDto | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// --- Request DTOs (normalized output of parseSyncRequest) ---

export type EmptyRequest = Record<string, never>

export type CreateConnectionRequest = ({ authentication?: ConnectionAuth } & (
  | { platform: 'yunxiao'; name: string; mode: 'center' | 'region'; organizationId: string; regionHost: string | null; tokenEnv: string; enabled: boolean }
  | { platform: 'tapd'; name: string; companyId: string; userEnv: string; passwordEnv: string; enabled: boolean }

))

export interface UpdateConnectionRequest {
  authentication?: ConnectionAuth
  id: string
  revision: number
  name?: string
  enabled?: boolean
  mode?: 'center' | 'region'
  organizationId?: string
  regionHost?: string | null
  tokenEnv?: string
  companyId?: string
  userEnv?: string
  passwordEnv?: string
}

export interface DeleteConnectionRequest {
  id: string
  revision: number
}

export interface CreateSyncRuleRequest {
  connectionId: string
  projectId: string
  workspaceId: string | null
  enabled: boolean
  filters: SyncRuleFilters
  mappings: TypeMapping[]
}

export interface UpdateSyncRuleRequest {
  id: string
  revision: number
  projectId?: string
  workspaceId?: string | null
  enabled?: boolean
  filters?: SyncRuleFilters
  mappings?: TypeMapping[]
}

export interface DeleteSyncRuleRequest {
  id: string
  revision: number
}

export interface GetSyncRunRequest {
  id: string
}

export interface ListRunsRequest {
  page: number
  pageSize: number
}

export interface ListItemResultsRequest {
  id: string
  page: number
  pageSize: number
}

/** Method-discriminated union of every parsed request; no raw payload path exists. */
export type SyncRequest =
  | { method: 'listSyncConnections'; request: EmptyRequest }
  | { method: 'createSyncConnection'; request: CreateConnectionRequest }
  | { method: 'updateSyncConnection'; request: UpdateConnectionRequest }
  | { method: 'deleteSyncConnection'; request: DeleteConnectionRequest }
  | { method: 'listSyncRules'; request: EmptyRequest }
  | { method: 'createSyncRule'; request: CreateSyncRuleRequest }
  | { method: 'updateSyncRule'; request: UpdateSyncRuleRequest }
  | { method: 'deleteSyncRule'; request: DeleteSyncRuleRequest }
  | { method: 'getSyncMetadata'; request: MetadataScope }
  | { method: 'testSyncConnection'; request: MetadataScope }
  | { method: 'startSync'; request: EmptyRequest }
  | { method: 'getSyncRun'; request: GetSyncRunRequest }
  | { method: 'listSyncRuns'; request: ListRunsRequest }
  | { method: 'listSyncItemResults'; request: ListItemResultsRequest }

// --- Response DTOs (returned by services, produced by fixtures) ---

export interface DeleteResult {
  deleted: true
}

export interface StartSyncResult {
  runId: string
  existing: boolean
}

export type TestConnectionResult =
  | { ok: true; credentialPresent: boolean; readOnly: boolean }
  | { ok: false; credentialPresent: boolean; error: SyncErrorDto }

/** Method-discriminated union of every validated safe response; no raw payload path exists. */
export type SyncResponse =
  | { method: 'listSyncConnections'; response: SafeConnection[] }
  | { method: 'createSyncConnection'; response: SafeConnection }
  | { method: 'updateSyncConnection'; response: SafeConnection }
  | { method: 'deleteSyncConnection'; response: DeleteResult }
  | { method: 'listSyncRules'; response: SyncRule[] }
  | { method: 'createSyncRule'; response: SyncRule }
  | { method: 'updateSyncRule'; response: SyncRule }
  | { method: 'deleteSyncRule'; response: DeleteResult }
  | { method: 'getSyncMetadata'; response: SyncMetadata }
  | { method: 'testSyncConnection'; response: TestConnectionResult }
  | { method: 'startSync'; response: StartSyncResult }
  | { method: 'getSyncRun'; response: SafeRun }
  | { method: 'listSyncRuns'; response: Page<SafeRun> }
  | { method: 'listSyncItemResults'; response: Page<SafeItemResult> }
