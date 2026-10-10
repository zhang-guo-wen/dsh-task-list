import type { TaskContent, TaskStatus } from '../types.ts'
import type { RemoteKey, SyncField } from './types.ts'

/** The 18 RPC methods added by the sync feature (connections4/rules4/metadata2/runs4/orgs1/query3). */
export const SYNC_METHODS = [
  'listSyncConnections', 'createSyncConnection', 'updateSyncConnection', 'deleteSyncConnection',
  'listSyncRules', 'createSyncRule', 'updateSyncRule', 'deleteSyncRule',
  'getSyncMetadata', 'testSyncConnection',
  'startSync', 'getSyncRun', 'listSyncRuns', 'listSyncItemResults',
  'listSyncOrganizations',
  'listWorkitems',
  'listWorkitemFields',
  'getWorkitemDescription',
] as const
export type SyncMethod = (typeof SYNC_METHODS)[number]

// --- Connections ---

/**
 * Which work-item data a new local task starts with. Chosen per connection (the
 * connection editor owns the checkboxes) and stored beside it, so the choice
 * travels with the configuration rather than with one browser.
 *
 * The union covers both platforms; each connection may only use its own set
 * (see {@link WORKITEM_FILL_FIELDS_BY_PLATFORM}), because the two platforms do
 * not expose the same fields.
 */
export const WORKITEM_FILL_FIELDS = [
  'title', 'description', 'number', 'status', 'assignee', 'sprint', 'priority',
  // 云效-only
  'customFields', 'source',
  // TAPD-only: 标签 and 创建人 have no 云效 equivalent in the list projection.
  'tags', 'creator',
] as const
export type WorkitemFillField = (typeof WORKITEM_FILL_FIELDS)[number]

/** Fields each platform can actually carry, in the order its editor shows them. */
export const WORKITEM_FILL_FIELDS_BY_PLATFORM: Readonly<Record<'yunxiao' | 'tapd', readonly WorkitemFillField[]>> = {
  yunxiao: ['title', 'description', 'number', 'status', 'assignee', 'sprint', 'priority', 'customFields', 'source'],
  tapd: ['title', 'description', 'number', 'status', 'assignee', 'sprint', 'priority', 'tags', 'creator'],
}

/** What a connection pre-fills before the user has chosen anything. */
export const DEFAULT_WORKITEM_FILL_FIELDS: readonly WorkitemFillField[] = ['title', 'description', 'number', 'status', 'assignee', 'priority']

export type ConnectionAuth = { mode: 'manual' } | { mode: 'oauth'; appId?: string; appSecretRef?: string; callbackUrl?: string }

/**
 * A user-typed credential value. It travels from the browser to the Host over
 * the loopback Remote and lands in the Host credential store — never in the
 * task database, a DTO result, or a log.
 */
export type ConnectionSecret =
  | { platform: 'yunxiao'; token: string }
  | { platform: 'tapd'; token: string }

export interface SafeConnectionBase {
  /** Non-secret authentication configuration; omitted legacy values mean manual. */
  authentication?: ConnectionAuth
  /** Work-item data a new task starts with, edited in the connection form. */
  fillFields: WorkitemFillField[]
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
  /** Environment variable the Host falls back to when no credential is typed. */
  tokenEnv: string
}

export type SafeConnection = YunxiaoConnection | TapdConnection

// --- Rules ---

/** Operators the platform accepts; each field's own spec narrows this further. */
export type WorkitemFilterOperator = 'EQUALS' | 'CONTAINS' | 'BETWEEN'

/**
 * One platform filter object. Groups are ORed and conditions inside one group
 * are ANDed; the `value` array is an OR set. The rule editor builds these from
 * the same field list the task list's filter bar offers, and the adapter sends
 * them to the platform so discovery never fetches the whole project.
 */
export interface WorkitemFilterCondition {
  field: string
  operator?: WorkitemFilterOperator
  value: string[]
  /** Inclusive upper bound for BETWEEN; ignored by every other operator. */
  toValue?: string
}

/** Groups are ORed; conditions inside one group are ANDed. */
export type WorkitemConditionGroups = WorkitemFilterCondition[][]

/** The three local statuses a rule maps back to the platform. */
export type StatusWriteStates = Record<TaskStatus, string>

/**
 * A sync rule is one 云效 project plus the query that selects its work items.
 * Discovery applies the query on the platform; everything a matching work item
 * carries is packed into a new local task's description, and the only field the
 * rule writes back is the task's status (mapped by {@link statusWriteStates}).
 */
export interface SyncRule {
  id: string
  revision: number
  connectionId: string
  projectId: string
  /** Display label captured when the rule was written; null means the id is shown. */
  projectName: string | null
  enabled: boolean
  workspaceId: string | null
  /** Server-side query; an empty set matches every work item in the project. */
  conditions: WorkitemFilterCondition[][]
  /** Local status -> platform status id; every local status must be mapped. */
  statusWriteStates: StatusWriteStates
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

// --- Read-only work-item queries ---

export interface ListWorkitemsRequest {
  connectionId: string
  projectId: string
  /** One category or a comma-joined set, e.g. `Req` or `Req,Bug`; spaces are refused. */
  categories: string
  page: number
  perPage: number
  /** Requested list fields; `['*']` means every supported field. */
  fields: string[]
  /** Keep only these custom-field ids; empty means all of them. */
  customFieldIds: string[]
  orderBy: 'gmtCreate' | 'subject' | 'status' | 'priority' | 'assignedTo'
  sort: 'asc' | 'desc'
  conditions?: WorkitemConditionGroups
}

/** One projected work-item row: only the requested fields, each shape-verified. */
export type SafeWorkitemRow = Record<string, unknown>

/** One selectable field of a work-item type, as the platform configures it. */
export interface SafeWorkitemField {
  id: string
  name: string
  format: string
  required: boolean
  kind: string
  options: { id: string; label: string }[]
}

export interface ListWorkitemFieldsRequest {
  connectionId: string
  projectId: string
  /** One category or a comma-joined set, e.g. `Req` or `Req,Bug,Task`; spaces are refused. */
  categories: string
}

/** One work item's body, unwrapped from the platform's JSON description carrier. */
export interface SafeWorkitemDescription {
  format: 'richtext' | 'markdown' | 'text'
  html: string | null
  plain: string
  /** The plugin's own structured form of the body; null when it cannot be decoded. */
  content: TaskContent | null
}

export interface GetWorkitemDescriptionRequest {
  connectionId: string
  projectId: string
  id: string
}

export interface SafeWorkitemDescriptionResult {
  description: SafeWorkitemDescription | null
}

export interface SafeWorkitemPage {
  items: SafeWorkitemRow[]
  page: number
  perPage: number
  total: number | null
  totalPages: number | null
  fields: string[]
}

// --- Request DTOs (normalized output of parseSyncRequest) ---

export type EmptyRequest = Record<string, never>

export type CreateConnectionRequest = ({ authentication?: ConnectionAuth; secret?: ConnectionSecret; fillFields?: WorkitemFillField[] } & (
  | { platform: 'yunxiao'; name: string; mode: 'center' | 'region'; organizationId: string; regionHost: string | null; tokenEnv: string; enabled: boolean }
  | { platform: 'tapd'; name: string; companyId: string; tokenEnv: string; enabled: boolean }

))

export interface UpdateConnectionRequest {
  authentication?: ConnectionAuth
  secret?: ConnectionSecret
  fillFields?: WorkitemFillField[]
  id: string
  revision: number
  name?: string
  enabled?: boolean
  mode?: 'center' | 'region'
  organizationId?: string
  regionHost?: string | null
  tokenEnv?: string
  companyId?: string
}

/** One organization the authorized account belongs to (id + display name only). */
export interface OrganizationChoice {
  id: string
  name: string
}

export interface ListOrganizationsRequest {
  /** A freshly typed personal access token; omitted to use the connection's stored one. */
  token?: string
  /** Saved connection whose stored credential lists the organizations. */
  connectionId?: string
  /**
   * Which platform's account the token belongs to. A new connection has no
   * saved id yet, so the editor names it explicitly.
   */
  platform?: 'yunxiao' | 'tapd'
}


export interface DeleteConnectionRequest {
  id: string
  revision: number
}

export interface CreateSyncRuleRequest {
  connectionId: string
  projectId: string
  projectName?: string | null
  workspaceId: string | null
  enabled: boolean
  conditions: WorkitemConditionGroups
  statusWriteStates: StatusWriteStates
}

export interface UpdateSyncRuleRequest {
  id: string
  revision: number
  projectId?: string
  projectName?: string | null
  workspaceId?: string | null
  enabled?: boolean
  conditions?: WorkitemConditionGroups
  statusWriteStates?: StatusWriteStates
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
  | { method: 'listSyncOrganizations'; request: ListOrganizationsRequest }
  | { method: 'listWorkitems'; request: ListWorkitemsRequest }
  | { method: 'listWorkitemFields'; request: ListWorkitemFieldsRequest }
  | { method: 'getWorkitemDescription'; request: GetWorkitemDescriptionRequest }

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
  | { method: 'listSyncOrganizations'; response: OrganizationChoice[] }
  | { method: 'listWorkitems'; response: SafeWorkitemPage }
  | { method: 'listWorkitemFields'; response: SafeWorkitemField[] }
  | { method: 'getWorkitemDescription'; response: SafeWorkitemDescriptionResult }
