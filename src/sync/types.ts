import type { TaskContent, TaskRecord } from '../types.ts'
import type { TaskStore } from '../store.ts'
import type {
  MetadataScope, SafeConnection, SafeItemResult, SyncErrorDto, SyncMetadata, SyncRule,
} from './dto.ts'
import type { SyncConfigStore } from './config-store.ts'
import type { SyncLinkStore } from './link-store.ts'
import type { SyncRunStore } from './run-store.ts'

/** Business fields the sync planner compares between the local task and the remote item. */
export type SyncField = 'title' | 'description' | 'status' | 'priority' | 'tags' | 'storyPoints'

/** Canonical business values for the fields a rule enables; description is structured, never notes. */
export type SyncFields = Pick<TaskRecord, 'title' | 'status' | 'priority' | 'tags' | 'storyPoints'>
  & { description: TaskContent }

/** Fields a sync action may write on one side; empty patch means no business change. */
export type SyncPatch = Partial<SyncFields>

/** Stable identity of one remote work item; ids stay strings, never numbers. */
export type RemoteKey = { instance: string; projectId: string; typeId: string; id: string }

/** One remote field as the platform exposes it, with its presence and writability. */
export type FieldValue<T> =
  | { presence: 'value'; value: T; writable: boolean }
  | { presence: 'null'; writable: boolean }
  | { presence: 'absent' | 'unsupported'; writable: false }

/** A remote work item normalized to the shared business vocabulary. */
export type RemoteItem = {
  key: RemoteKey
  number: string
  url: string | null
  updatedToken: string
  fields: { [K in SyncField]: FieldValue<SyncFields[K]> }
  rawStatus: string
  description: { format: 'text' | 'markdown' | 'richtext'; raw: FieldValue<string>; roundTrip: boolean }
  revisionToken: string | null
}

/** Which fields a rule maps plus the mapping/normalization revisions in force. */
export type SyncProjection = { fields: SyncField[]; mappingRevision: number; normalizationVersion: 1 }

/** The compared snapshot of both sides at last sync. */
export type SyncBaseline = {
  local: SyncFields
  remote: SyncFields
  localVersion: number
  localUpdatedAt: number
  remoteUpdatedToken: string
  rawStatus: string
  projection: SyncProjection
  remotePresence: { [K in SyncField]: FieldValue<SyncFields[K]>['presence'] }
  remoteDescription: RemoteItem['description']
}

/** The task-level decision for one linked item. */
export type SyncPlan = {
  kind: 'import' | 'unchanged' | 'pull' | 'push' | 'merge'
  localPatch: SyncPatch
  remotePatch: SyncPatch
  selectedFields: SyncField[]
}

/** Platform read/write surface; adapters are constructed per connection and never hold secrets. */
export interface SyncAdapter {
  metadata(scope: MetadataScope, signal: AbortSignal): Promise<SyncMetadata>
  discover(rule: SyncRule, signal: AbortSignal): AsyncIterable<RemoteItem[]>
  read(key: RemoteKey, rule: SyncRule, signal: AbortSignal): Promise<RemoteItem>
  write(key: RemoteKey, patch: SyncPatch, observed: RemoteItem, rule: SyncRule, signal: AbortSignal): Promise<void>
  evidence(intent: WriteIntent, observed: RemoteItem, signal: AbortSignal): Promise<WriteEvidence>
}

/** Whether a remote write is proven applied, proven not applied, or still uncertain. */
export type WriteEvidence = 'applied' | 'not_applied_proven' | 'unknown'

/** Ownership fence for one run; writes are accepted only while the fence holds. */
export type RunFence = { runId: string; ownerId: string; generation: number }

// --- Supporting contracts (Task 1 types, Task 2/4/7/8 implementations) ---

export type SyncLink = {
  id: string
  key: RemoteKey
  ruleId: string
  taskId: string | null
  taskGeneration: string
  revision: number
  baseline: SyncBaseline | null
}

export type PrepareIntent = {
  fence: RunFence
  link: SyncLink
  task: TaskRecord
  observed: RemoteItem
  rule: SyncRule
  plan: SyncPlan
}

export type WriteIntent = {
  id: string
  linkId: string
  key: RemoteKey
  taskId: string | null
  taskGeneration: string
  linkRevision: number
  fence: RunFence
  ruleSnapshot: SyncRule
  baseline: SyncBaseline
  localBefore: SyncFields
  localVersion: number
  remoteBefore: RemoteItem
  patch: SyncPatch
  expected: SyncFields
  phase: 'prepared' | 'dispatched' | 'unknown' | 'confirmed' | 'cancelled'
}

export type FinalizeItem = {
  fence: RunFence
  linkId: string
  linkRevision: number
  taskGeneration: string
  expectedTaskVersion: number
  localPatch: SyncPatch
  observed: RemoteItem
  baseline: SyncBaseline
  intentId: string | null
  result: SafeItemResult
}

/** Host-side credentials resolved from environment variables; never exported to the browser. */
export type HostCredentials = { kind: 'yunxiao'; token: string } | { kind: 'tapd'; user: string; password: string }

/** An outbound request an adapter builds; no raw URL or auth ever enters through the RPC. */
export type HostRequest = {
  url: URL
  method: 'GET' | 'POST' | 'PUT'
  headers: Record<string, string>
  body?: string
  readOnly: boolean
}

/** Bounded HTTPS transport; retains response headers for platform pagination. */
export type SyncTransport = {
  read(request: HostRequest, signal: AbortSignal): Promise<{ value: unknown; headers: Headers; status: number }>
  write(request: HostRequest, signal: AbortSignal): Promise<{ value: unknown; headers: Headers; status: number }>
}

/** Reconciliation result for an uncertain write; proven_not_applied needs platform evidence. */
export type ReconcileResult = {
  kind: 'confirmed' | 'proven_not_applied' | 'pending'
  observed: RemoteItem
  error?: SyncErrorDto
}

/** Injectable time source so tests drive deadlines without real waits. */
export type Clock = { now(): number; sleep(ms: number, signal: AbortSignal): Promise<void> }

/**
 * Per-request preflight gate the executor injects into an adapter's transport.
 * It is invoked immediately before every HTTP attempt, so a rule disable or an
 * ownership loss that lands between two requests stops the next outbound call.
 * A throwing guard surfaces its own safe RemoteError (StaleOwner / InvalidConfig
 * / RunInterrupted) and is never re-mapped to a transient network failure.
 */
export type AdapterContext = { beforeRequest: () => void; projectId?: string }

/**
 * Builds one adapter for one connection plus a rule-scoped request gate; the
 * factory owns credential resolution. The executor constructs one adapter per
 * rule so the gate closure is bound to that rule's fence/enabled/budget.
 */
export type AdapterFactory = (connection: SafeConnection, context: AdapterContext) => SyncAdapter | Promise<SyncAdapter>

/**
 * Everything one remote item needs to run the single-item sync pipeline. The
 * executor builds one per key; the adapter performs no network on construction
 * and only ever acts through `read`/`write`/`discover`/`metadata`/`evidence`.
 */
export type ItemExecution = {
  fence: RunFence
  rule: SyncRule
  key: RemoteKey
  tasks: TaskStore
  config: SyncConfigStore
  links: SyncLinkStore
  runs: SyncRunStore
  adapter: SyncAdapter
  clock: Clock
  signal: AbortSignal
  /** True when the item is outside the current filter but still synced via its link. */
  outsideFilter?: boolean
  /**
   * Optional per-request gate; `executeItem` wraps the provided adapter so the
   * gate runs before every high-level read/write/evidence/metadata call. The
   * real-transport path also applies the factory-injected `AdapterContext`
   * gate before each HTTP attempt, so a disable lands between two fetches.
   */
  beforeRequest?: () => void
}
