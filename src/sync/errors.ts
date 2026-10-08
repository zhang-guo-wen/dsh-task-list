import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { DocKey, SyncErrorCode, SyncErrorDto, SyncErrorScope } from './dto.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'task-list/sync': SyncErrorDto
  }
}

/** Troubleshooting chapter anchors shipped with the package. */
export const DOC_KEYS = ['credentials', 'permissions', 'mapping', 'content', 'network', 'recovery', 'host-upgrade'] as const

export interface SyncErrorDefinition {
  problem: string
  action: string
  docKey: DocKey
  retryable: boolean
}

/**
 * Fixed problem/action/docKey table for every registered error code. The
 * strings are static; no upstream text, header, body, or credential value is
 * ever concatenated into an error.
 */
export const SYNC_ERRORS: Readonly<Record<SyncErrorCode, SyncErrorDefinition>> = {
  InvalidConfig: { problem: 'The sync configuration is invalid', action: 'Fix the configuration fields and retry', docKey: 'mapping', retryable: false },
  CredentialMissing: { problem: 'A required credential is not configured', action: 'Set the referenced environment variable and restart the Host', docKey: 'credentials', retryable: false },
  AuthDenied: { problem: 'The platform rejected the credentials', action: 'Check the token or account permissions', docKey: 'permissions', retryable: false },
  EntitlementUnavailable: { problem: 'The platform API is not available for this account', action: 'Enable the required platform module or entitlement', docKey: 'permissions', retryable: false },
  ReadTimeout: { problem: 'The platform read did not finish in time', action: 'Retry or increase the read budget', docKey: 'network', retryable: true },
  NetworkFailure: { problem: 'The platform request failed on the network', action: 'Check connectivity and retry', docKey: 'network', retryable: true },
  RateLimited: { problem: 'The platform rate limit was reached', action: 'Wait for the retry window and try again', docKey: 'network', retryable: true },
  InvalidRemoteResponse: { problem: 'The platform returned an unreadable response', action: 'Report the malformed payload', docKey: 'content', retryable: false },
  IncompleteDiscovery: { problem: 'Discovery could not finish', action: 'Retry or narrow the filter scope', docKey: 'recovery', retryable: true },
  RemoteUnavailable: { problem: 'The remote item is unavailable', action: 'Keep the local task and its link', docKey: 'recovery', retryable: false },
  UnsupportedRepresentation: { problem: 'The remote content format is not supported losslessly', action: 'Choose a supported field or leave it unmapped', docKey: 'content', retryable: false },
  FieldLimit: { problem: 'A field exceeds the supported limit', action: 'Shorten the value or leave the field unmapped', docKey: 'content', retryable: false },
  MappingIncompatible: { problem: 'The status or field mapping is incompatible', action: 'Fix the mapping for the type', docKey: 'mapping', retryable: false },
  WorkflowRejected: { problem: 'The platform refused the state transition', action: 'Check required fields or the workflow rules', docKey: 'mapping', retryable: false },
  StorageFailure: { problem: 'The local database could not be written', action: 'Check the database and retry', docKey: 'recovery', retryable: false },
  WriteOutcomeUnknown: { problem: 'The remote write outcome is unknown', action: 'Reconcile the intent before retrying', docKey: 'recovery', retryable: true },
  VerificationFailed: { problem: 'The remote write did not verify', action: 'Reconcile the intended change', docKey: 'recovery', retryable: true },
  LocalVersionConflict: { problem: 'The task changed locally during sync', action: 'Refresh and retry the sync', docKey: 'recovery', retryable: true },
  RunInterrupted: { problem: 'The sync run was interrupted', action: 'Restart the run to reconcile', docKey: 'recovery', retryable: true },
  StaleOwner: { problem: 'Another process owns this sync run', action: 'Let the current owner finish', docKey: 'recovery', retryable: true },
  RunNotFound: { problem: 'The sync run was not found', action: 'Start a new run', docKey: 'recovery', retryable: false },
  ResultQueryFailed: { problem: 'The run results could not be read', action: 'Retry the query', docKey: 'recovery', retryable: true },
  UnexpectedFailure: { problem: 'An unexpected sync failure occurred', action: 'Report the problem', docKey: 'recovery', retryable: false },
  HostRestartRequired: { problem: 'The Host must be restarted to apply credentials', action: 'Restart the Host and retry', docKey: 'host-upgrade', retryable: false },
}

export interface SyncErrorOptions {
  scope?: SyncErrorScope
  field?: string
  causePossible?: boolean
  retryable?: boolean
  runId?: string
  requestId?: string
}

const SCOPES = new Set<SyncErrorScope>(['config', 'connection', 'rule', 'item', 'run', 'query'])
const CONTROL = /[\u0000-\u001f]/u
const IDENTIFIER_LIMIT = 200

/** Validate an optional bounded identifier: non-blank, ≤200 chars, no control characters. */
function boundIdentifier(name: string, value: string): string {
  if (!value.trim() || value.length > IDENTIFIER_LIMIT || CONTROL.test(value)) {
    throw new Error(`syncError ${name} must be 1-${IDENTIFIER_LIMIT} control-free characters`)
  }
  return value
}

/**
 * Build a safe {@link SyncErrorDto} from a registered code. Only typed,
 * sanitized arguments are accepted; `cause` is always the registered template
 * (never a caller string), so no arbitrary upstream message or secret value
 * can reach the output.
 */
export function syncError(code: SyncErrorCode, options: SyncErrorOptions = {}): SyncErrorDto {
  const definition = SYNC_ERRORS[code]
  if (!definition) throw new Error(`unknown sync error code: ${String(code)}`)
  const scope = options.scope ?? 'config'
  if (!SCOPES.has(scope)) throw new Error(`invalid sync error scope: ${String(scope)}`)
  if (options.retryable !== undefined && typeof options.retryable !== 'boolean') throw new Error('syncError retryable must be a boolean')
  if (options.causePossible !== undefined && typeof options.causePossible !== 'boolean') throw new Error('syncError causePossible must be a boolean')
  const field = options.field === undefined ? undefined : boundIdentifier('field', options.field)
  const runId = options.runId === undefined ? undefined : boundIdentifier('runId', options.runId)
  const requestId = options.requestId === undefined ? undefined : boundIdentifier('requestId', options.requestId)
  return {
    code,
    scope,
    problem: definition.problem,
    cause: definition.problem,
    action: definition.action,
    docKey: definition.docKey,
    retryable: options.retryable ?? definition.retryable,
    ...(options.causePossible ? { causePossible: true } : {}),
    ...(field !== undefined ? { field } : {}),
    ...(runId !== undefined ? { runId } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  }
}

/** Wrap a safe error DTO under the single outer `task-list/sync` RemoteError code. */
export function syncRemoteError(error: SyncErrorDto): RemoteError<'task-list/sync'> {
  return new RemoteError('task-list/sync', error.problem, error)
}
