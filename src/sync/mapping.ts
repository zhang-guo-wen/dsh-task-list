import type { TaskStatus } from '../types.ts'
import type { StatusWriteStates } from './dto.ts'
import { syncError, syncRemoteError } from './errors.ts'

/** The local statuses a rule maps; every one must carry a platform target. */
export const RULE_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done']

/**
 * Whether a rule maps every local status to a platform status. A rule without a
 * complete mapping cannot write back, so it is refused before it is enabled
 * instead of failing item by item during a run.
 */
export function statusMappingReady(statusWriteStates: StatusWriteStates | null | undefined): boolean {
  if (statusWriteStates === null || statusWriteStates === undefined) return false
  return RULE_STATUSES.every(status => typeof statusWriteStates[status] === 'string' && statusWriteStates[status].trim() !== '')
}

/**
 * Encode a canonical status for writing. When the observed raw status already
 * maps to the target, the finer-grained raw value is preserved instead of
 * collapsing it to the write target. An unmapped target is rejected rather than
 * guessed.
 */
export function encodeStatus(target: TaskStatus, observedRaw: string, statusWriteStates: StatusWriteStates): string {
  const write = statusWriteStates[target]
  if (write === undefined || write.trim() === '') {
    throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'status' }))
  }
  // The observed status is preserved only when it is the one this target maps
  // to; an unmapped raw value simply means the write target is the right answer.
  return observedRaw === write ? observedRaw : write
}
