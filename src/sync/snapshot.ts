import type { TaskContent, TaskPriority, TaskRecord } from '../types.ts'
import { canonicalDescription } from './description-codec.ts'
import { syncError, syncRemoteError } from './errors.ts'
import type {
  FieldValue, RemoteItem, SyncBaseline, SyncFields, SyncPatch, SyncProjection,
} from './types.ts'
import type { SyncRule } from './dto.ts'

const EMPTY: TaskContent = { version: 1, blocks: [] }

/**
 * The one field a rule reconciles. Everything else a work item carries is packed
 * into the imported task's description once and never compared again, so a
 * remote edit to any other field cannot invent a local change.
 */
export const RULE_FIELDS: readonly SyncProjection['fields'][number][] = ['status']

/** The projection every rule uses: status only, tagged with the rule's revision. */
export function projectionFor(rule: SyncRule): SyncProjection {
  return { fields: [...RULE_FIELDS], mappingRevision: rule.revision, normalizationVersion: 1 }
}

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

/**
 * Canonical remote snapshot; the adapter already decoded the fields to the shared
 * vocabulary. The description here is the task's own packed body at import time,
 * not the platform's raw HTML, so a baseline always round-trips the local shape.
 */
export function projectRemote(item: RemoteItem, rule: SyncRule): SyncFields {
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
  return {
    local: projectLocal(task, projectionFor(rule)),
    remote: projectRemote(item, rule),
    localVersion: task.version,
    localUpdatedAt: task.updatedAt,
    remoteUpdatedToken: item.updatedToken,
    rawStatus: item.rawStatus,
    projection: projectionFor(rule),
    remotePresence: presenceOf(item),
    remoteDescription: item.description,
  }
}

function sameProjection(a: SyncProjection, b: SyncProjection): boolean {
  return a.mappingRevision === b.mappingRevision && a.normalizationVersion === b.normalizationVersion
    && a.fields.length === b.fields.length && a.fields.every((field, index) => field === b.fields[index])
}

/**
 * Rebase a stored baseline onto the rule's current projection. A status-map edit
 * only changes which platform status a local status targets; it never re-reads a
 * stored baseline, so the remote side is refreshed from the live item instead and
 * the local side keeps any pending edit.
 */
export function rebaseProjection(input: {
  task: TaskRecord; remote: RemoteItem; baseline: SyncBaseline; rule: SyncRule
}): { baseline: SyncBaseline; initializePatch: SyncPatch } {
  const { remote, baseline, rule } = input
  const projection = projectionFor(rule)
  if (sameProjection(projection, baseline.projection)) return { baseline, initializePatch: {} }
  return { baseline: { ...baseline, remote: projectRemote(remote, rule), projection }, initializePatch: {} }
}
