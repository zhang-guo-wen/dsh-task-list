import type { TaskContent, TaskPriority, TaskRecord } from '../types.ts'
import { canonicalDescription } from './description-codec.ts'
import { mappingFor, projectionFor } from './mapping.ts'
import { syncError, syncRemoteError } from './errors.ts'
import type {
  FieldValue, RemoteItem, SyncBaseline, SyncFields, SyncPatch, SyncProjection,
} from './types.ts'
import type { SyncRule } from './dto.ts'

const EMPTY: TaskContent = { version: 1, blocks: [] }

/** Tags are compared after trimming and case-insensitive dedup, matching the store's own limit semantics. */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const normalized = tag.trim()
    const key = normalized.toLocaleLowerCase()
    if (!normalized || seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

/** Essential fields must be readable; an absent/unsupported title or status is an explicit failure. */
function essential<T>(field: FieldValue<T>, name: string): T {
  if (field.presence === 'value') return field.value
  throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: name }))
}

/** Optional fields fall back to their canonical default without ever fabricating null for absent values. */
function optional<T>(field: FieldValue<T>, fallback: T): T {
  return field.presence === 'value' ? field.value : fallback
}

/** Canonical local snapshot: attachments stripped, marks canonicalized, tags normalized. */
export function projectLocal(task: TaskRecord, _projection: SyncProjection): SyncFields {
  return {
    title: task.title,
    status: task.status,
    priority: task.priority,
    tags: normalizeTags(task.tags),
    storyPoints: task.storyPoints,
    description: canonicalDescription(task.content),
  }
}

/** Canonical remote snapshot; the adapter already decoded the fields to the shared vocabulary. */
export function projectRemote(item: RemoteItem, rule: SyncRule): SyncFields {
  mappingFor(rule, item.key.typeId)
  return {
    title: essential(item.fields.title, 'title'),
    status: essential(item.fields.status, 'status'),
    priority: optional(item.fields.priority, 'medium' as TaskPriority),
    tags: normalizeTags(optional(item.fields.tags, [] as string[])),
    storyPoints: optional(item.fields.storyPoints, null),
    description: canonicalDescription(optional(item.fields.description, EMPTY)),
  }
}

export function presenceOf(item: RemoteItem): SyncBaseline['remotePresence'] {
  return {
    title: item.fields.title.presence,
    description: item.fields.description.presence,
    status: item.fields.status.presence,
    priority: item.fields.priority.presence,
    tags: item.fields.tags.presence,
    storyPoints: item.fields.storyPoints.presence,
  }
}

/** Build a baseline snapshot of both sides at one point in time. */
export function buildBaseline(task: TaskRecord, item: RemoteItem, rule: SyncRule): SyncBaseline {
  const projection = projectionFor(rule, item.key.typeId)
  return {
    local: projectLocal(task, projection),
    remote: projectRemote(item, rule),
    localVersion: task.version,
    localUpdatedAt: task.updatedAt,
    remoteUpdatedToken: item.updatedToken,
    rawStatus: item.rawStatus,
    projection,
    remotePresence: presenceOf(item),
    remoteDescription: item.description,
  }
}

function sameProjection(a: SyncProjection, b: SyncProjection): boolean {
  return a.mappingRevision === b.mappingRevision && a.normalizationVersion === b.normalizationVersion
    && a.fields.length === b.fields.length && a.fields.every((field, index) => field === b.fields[index])
}

/**
 * Rebase a stored baseline onto the rule's current projection. Only newly enabled
 * fields are initialized from the remote side; other fields keep any pending edits.
 * An unchanged projection returns the existing baseline untouched so no business
 * change is ever invented by a mapping-only configuration change.
 */
export function rebaseProjection(input: {
  task: TaskRecord; remote: RemoteItem; baseline: SyncBaseline; rule: SyncRule
}): { baseline: SyncBaseline; initializePatch: SyncPatch } {
  const { remote, baseline, rule } = input
  const projection = projectionFor(rule, remote.key.typeId)
  if (sameProjection(projection, baseline.projection)) return { baseline, initializePatch: {} }

  // A mapping change re-reads the stored raw status under the new read map; it
  // must still mean the same decoded status, otherwise the old baseline cannot
  // be safely re-interpreted and no business patch is invented.
  const mapping = mappingFor(rule, remote.key.typeId)
  if (mapping.readStates[baseline.rawStatus] !== baseline.remote.status) {
    throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'status' }))
  }

  const newRemote = projectRemote(remote, rule)
  const oldFields = new Set(baseline.projection.fields)
  const initializePatch: SyncPatch = {}
  const local: SyncFields = { ...baseline.local }
  const remoteFields: SyncFields = { ...baseline.remote }
  for (const field of projection.fields) {
    if (!oldFields.has(field)) {
      const value = newRemote[field]
      ;(initializePatch as Record<string, unknown>)[field] = value
      ;(local as Record<string, unknown>)[field] = value
      ;(remoteFields as Record<string, unknown>)[field] = value
    }
  }
  return { baseline: { ...baseline, local, remote: remoteFields, projection }, initializePatch }
}
