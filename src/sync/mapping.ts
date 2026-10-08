import type { TaskStatus } from '../types.ts'
import type { RemoteItem, SyncField, SyncProjection } from './types.ts'
import type { SyncRule, TypeMapping } from './dto.ts'
import { syncError, syncRemoteError } from './errors.ts'

/** Resolve the type mapping for a remote item's type; category is never guessed. */
export function mappingFor(rule: SyncRule, typeId: string): TypeMapping {
  const mapping = rule.mappings.find(candidate => candidate.typeId === typeId)
  if (!mapping) throw syncRemoteError(syncError('MappingIncompatible', { scope: 'rule', field: 'typeId' }))
  return mapping
}

/** Required fields plus the optional fields the mapping explicitly enables, in canonical order. */
export function projectionFor(rule: SyncRule, typeId: string): SyncProjection {
  const mapping = mappingFor(rule, typeId)
  const fields: SyncField[] = ['title', 'description', 'status']
  if (mapping.optionalFields.includes('priority')) fields.push('priority')
  if (mapping.optionalFields.includes('tags')) fields.push('tags')
  if (mapping.optionalFields.includes('storyPoints')) fields.push('storyPoints')
  return { fields, mappingRevision: rule.revision, normalizationVersion: 1 }
}

/**
 * Encode a canonical status for writing. When the observed raw status already maps
 * to the target, the finer-grained raw value is preserved instead of collapsing it
 * to the write target. An unmapped target is rejected rather than guessed.
 */
export function encodeStatus(target: TaskStatus, observed: RemoteItem, mapping: TypeMapping): string {
  const write = mapping.writeStates[target]
  if (write === undefined || mapping.readStates[write] !== target) {
    throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'status' }))
  }
  if (mapping.readStates[observed.rawStatus] === target) return observed.rawStatus
  return write
}
