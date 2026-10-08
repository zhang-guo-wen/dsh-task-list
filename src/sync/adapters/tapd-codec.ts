import type { TaskContent, TaskPriority, TaskStatus } from '../../types.ts'
import type { FieldValue, RemoteItem } from '../types.ts'
import type { Option, TypeMapping } from '../dto.ts'
import { decodeDescription } from '../description-codec.ts'
import { syncError, syncRemoteError } from '../errors.ts'

const ID_LIMIT = 200
const TITLE_LIMIT = 1000
const LABEL_LIMIT = 100
const CONTROL = /[\u0000-\u001f]/u

function fail(field: string): never {
  throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field }))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function idString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > ID_LIMIT || CONTROL.test(value)) fail(field)
  return value
}

function textValue(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || CONTROL.test(value)) fail(field)
  return value
}

function label(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim() && value.length <= LABEL_LIMIT && !CONTROL.test(value)) return value
  return fallback
}

/** A documented boolean flag string/number; `1` is truthy, `0` is false, anything else is malformed. */
function boolFlag(value: unknown, field: string): boolean {
  if (value === '1' || value === 1) return true
  if (value === '0' || value === 0) return false
  fail(field)
}

// --- business-status classification (host-only; info never enters a DTO) ---

// Allowlisted hint patterns used only to pick a typed error code from the
// upstream `info` string. The string itself is never echoed, logged, or stored.
const AUTH_HINT = /permission|auth|credential|token|无权|权限|认证|登录|凭证|密码|账号/i
const ENTITLEMENT_HINT = /entitlement|commercial|not\s+enabled|未开通|商业|试用|开通|模块/i

/** Read business failure: permission → AuthDenied, entitlement → EntitlementUnavailable, else InvalidRemoteResponse. */
export function classifyReadBusinessError(info: string): 'AuthDenied' | 'EntitlementUnavailable' | 'InvalidRemoteResponse' {
  if (AUTH_HINT.test(info)) return 'AuthDenied'
  if (ENTITLEMENT_HINT.test(info)) return 'EntitlementUnavailable'
  return 'InvalidRemoteResponse'
}

/** Write business failure: permission → AuthDenied, otherwise the write was rejected (WorkflowRejected). */
export function classifyWriteBusinessError(info: string): 'AuthDenied' | 'WorkflowRejected' {
  if (AUTH_HINT.test(info)) return 'AuthDenied'
  return 'WorkflowRejected'
}

// --- envelope --------------------------------------------------------------

export interface TapdEnvelope {
  status: number
  data: unknown
  /** Upstream reason; retained host-side only for classification, never exported. */
  info: string
}

/** TAPD wraps every payload as `{ status, info, data }`; status is a number and 1 means success. */
export function decodeEnvelope(raw: unknown, field = 'envelope'): TapdEnvelope {
  if (!isPlainObject(raw)) fail(field)
  const status = raw.status
  if (typeof status !== 'number' || !Number.isFinite(status)) fail(`${field}.status`)
  const data = raw.data
  if (data === null || typeof data !== 'object') fail(`${field}.data`)
  const info = typeof raw.info === 'string' ? raw.info : ''
  return { status, data, info }
}

function assertReadSuccess(status: number, info: string): void {
  if (status !== 1) {
    throw syncRemoteError(syncError(classifyReadBusinessError(info), { scope: 'connection' }))
  }
}

/**
 * Decode a read collection: `data` is an array of single-key wrappers
 * `{ Story: {...} }` (or Bug/Task/Workspace/UserWorkspace/Iteration). A business
 * status !== 1 on a read is classified (permission/entitlement/param), never
 * reported as an empty result set.
 */
export function decodeCollection(raw: unknown, type: string): unknown[] {
  const { status, data, info } = decodeEnvelope(raw, 'collection')
  assertReadSuccess(status, info)
  if (!Array.isArray(data)) fail('collection.data')
  return data.map(wrapper => {
    if (!isPlainObject(wrapper)) fail('collection.item')
    const item = wrapper[type]
    if (!isPlainObject(item)) fail(`collection.${type}`)
    return item
  })
}

/** Decode a `data` object whose keys are field names mapping to field configs. */
export function decodeFieldMap(raw: unknown): Record<string, unknown> {
  const { status, data, info } = decodeEnvelope(raw, 'fields')
  assertReadSuccess(status, info)
  if (!isPlainObject(data)) fail('fields.data')
  return data
}

// --- item ------------------------------------------------------------------

export type TapdCategory = 'story' | 'bug' | 'task'

/** The type-specific title/owner fields for the three TAPD collections, keyed by category. */
export const TAPD_CATEGORY_FIELDS: Record<TapdCategory, { title: string; owner: string }> = {
  story: { title: 'name', owner: 'owner' },
  bug: { title: 'title', owner: 'current_owner' },
  task: { title: 'name', owner: 'owner' },
}
export const TAPD_COLLECTION: Record<TapdCategory, string> = { story: 'stories', bug: 'bugs', task: 'tasks' }
export const TAPD_WRAPPER: Record<TapdCategory, string> = { story: 'Story', bug: 'Bug', task: 'Task' }
/** The workflows `system_name` for the workflow list; bugs use `bugtrace`, not `bug`. */
export const TAPD_WORKFLOW_SYSTEM_NAME: Record<TapdCategory, string | undefined> = {
  story: 'story', bug: 'bugtrace', task: undefined,
}
/** The `system` parameter for status_map and all_transitions; bugs use `bug`. */
export const TAPD_WORKFLOW_SYSTEM: Record<TapdCategory, string | undefined> = {
  story: 'story', bug: 'bug', task: undefined,
}

export interface TapdItemContext {
  instance: string
  projectId: string
  typeId: string
  category: TapdCategory
  /** Expected id for a detail read; omitted for discovery where the id comes from the payload. */
  id?: string
  mapping: TypeMapping
}

/** Classify a story entity's `workitem_type_id` against an enabled subtype. */
export function storySubtypeRelation(raw: unknown, typeId: string): 'match' | 'skip' | 'malformed' {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > ID_LIMIT || CONTROL.test(raw)) return 'malformed'
  return raw === typeId ? 'match' : 'skip'
}

const PRIORITY_VALUES = new Set<string>(['low', 'medium', 'high', 'urgent'])

/** Invert a local→remote value map; an ambiguous inverse (two locals → one remote) fails closed. */
function inverseValueMap(valueMap: Record<string, string> | undefined, field: 'priority' | 'tags'): Map<string, string> {
  const inverse = new Map<string, string>()
  if (!valueMap) return inverse
  for (const [local, remote] of Object.entries(valueMap)) {
    if (typeof remote !== 'string' || remote === '') continue
    const existing = inverse.get(remote)
    if (existing !== undefined && existing !== local) {
      throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field }))
    }
    inverse.set(remote, local)
  }
  return inverse
}

/** Decode a remote `priority_label` back to a canonical priority via the mapping's inverse. */
function decodePriorityField(raw: unknown, valueMap: Record<string, string> | undefined, enabled: boolean): FieldValue<TaskPriority> {
  if (!enabled) return { presence: 'absent', writable: false }
  if (raw === undefined) return { presence: 'absent', writable: false }
  if (raw === null) return { presence: 'null', writable: true }
  if (typeof raw !== 'string' || !raw.trim() || CONTROL.test(raw)) fail('item.priority_label')
  const local = inverseValueMap(valueMap, 'priority').get(raw)
  if (local === undefined || !PRIORITY_VALUES.has(local)) {
    throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'priority' }))
  }
  return { presence: 'value', value: local as TaskPriority, writable: true }
}

/** Decode a remote `label` (pipe-joined) back to canonical tags via the mapping's inverse. */
function decodeTagsField(raw: unknown, valueMap: Record<string, string> | undefined, enabled: boolean): FieldValue<string[]> {
  if (!enabled) return { presence: 'absent', writable: false }
  if (raw === undefined) return { presence: 'absent', writable: false }
  if (raw === null) return { presence: 'null', writable: true }
  if (typeof raw !== 'string' || CONTROL.test(raw)) fail('item.label')
  const inverse = inverseValueMap(valueMap, 'tags')
  const out: string[] = []
  for (const token of raw.split('|')) {
    const trimmed = token.trim()
    if (trimmed === '') continue
    const local = inverse.get(trimmed)
    if (local === undefined || local === '') {
      throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'tags' }))
    }
    out.push(local)
  }
  return { presence: 'value', value: out, writable: true }
}

/**
 * Decode one Story/Bug/Task object into the shared vocabulary. Identity fields
 * (id, workspace_id when present) are verified against the requested key, ids
 * stay strings, `modified` is kept as an opaque token, and the raw status is
 * normalized through the rule's readStates (unmapped → MappingIncompatible).
 */
export function decodeTapdItem(raw: unknown, ctx: TapdItemContext): RemoteItem {
  if (!isPlainObject(raw)) fail('item')
  const id = idString(raw.id, 'item.id')
  if (ctx.id !== undefined && id !== ctx.id) fail('item.id')

  // A present-but-wrong workspace_id (numeric/object/mismatched) is a malformed
  // identity, never silently ignored.
  const workspaceId = raw.workspace_id
  if (workspaceId !== undefined && (typeof workspaceId !== 'string' || workspaceId !== ctx.projectId)) fail('item.workspace_id')

  // For a story enabled with a concrete workitem_type id, the entity's
  // workitem_type_id is mandatory and must match; absent/malformed/mismatched
  // fails closed rather than silently widening the scope to all stories.
  if (ctx.category === 'story' && ctx.typeId !== 'story') {
    if (storySubtypeRelation(raw.workitem_type_id, ctx.typeId) !== 'match') fail('item.workitem_type_id')
  }

  const { title: titleField } = TAPD_CATEGORY_FIELDS[ctx.category]
  const title = textValue(raw[titleField], `item.${titleField}`, TITLE_LIMIT)

  if (typeof raw.status !== 'string' || !raw.status.trim() || raw.status.length > ID_LIMIT || CONTROL.test(raw.status)) fail('item.status')
  const statusId = raw.status
  const mappedStatus = ctx.mapping.readStates[statusId]
  if (mappedStatus === undefined) {
    throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'status' }))
  }

  const updatedToken = typeof raw.modified === 'string' ? raw.modified : ''

  let descriptionField: FieldValue<TaskContent>
  let descriptionRaw: FieldValue<string>
  let roundTrip: boolean
  if (raw.description === undefined) {
    descriptionField = { presence: 'absent', writable: false }
    descriptionRaw = { presence: 'absent', writable: false }
    roundTrip = false
  } else if (raw.description === null) {
    descriptionField = { presence: 'null', writable: true }
    descriptionRaw = { presence: 'null', writable: true }
    roundTrip = true
  } else if (typeof raw.description === 'string') {
    descriptionRaw = { presence: 'value', value: raw.description, writable: true }
    const decoded = decodeDescription(descriptionRaw, 'richtext')
    descriptionField = { presence: 'value', value: decoded.content, writable: true }
    roundTrip = decoded.roundTrip
  } else {
    fail('item.description')
  }

  return {
    key: { instance: ctx.instance, projectId: ctx.projectId, typeId: ctx.typeId, id },
    number: id,
    url: null,
    updatedToken,
    fields: {
      title: { presence: 'value', value: title, writable: true },
      description: descriptionField,
      status: { presence: 'value', value: mappedStatus, writable: true },
      priority: decodePriorityField(raw.priority_label, ctx.mapping.valueMaps?.priority, ctx.mapping.optionalFields.includes('priority')),
      tags: decodeTagsField(raw.label, ctx.mapping.valueMaps?.tags, ctx.mapping.optionalFields.includes('tags')),
      storyPoints: { presence: 'absent', writable: false },
    },
    rawStatus: statusId,
    description: { format: 'richtext', raw: descriptionRaw, roundTrip },
    revisionToken: null,
  }
}

/** Extract and validate the id from a raw collection item for cursor tracking. */
export function decodeTapdItemId(raw: unknown): string {
  if (!isPlainObject(raw)) fail('item.id')
  return idString(raw.id, 'item.id')
}

// --- filter identity -------------------------------------------------------

export type TapdFilterPresence =
  | { kind: 'absent' }
  | { kind: 'null' }
  | { kind: 'id'; id: string }
  | { kind: 'malformed' }

/** Presence-aware scalar id. `absent` means the field was not returned, `null`
 * means the platform explicitly reported no value, and an empty/whitespace
 * string is treated as malformed (fail closed) rather than a silent zero. */
function scalarPresence(value: unknown): TapdFilterPresence {
  if (value === undefined) return { kind: 'absent' }
  if (value === null) return { kind: 'null' }
  if (typeof value !== 'string') return { kind: 'malformed' }
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > ID_LIMIT || CONTROL.test(trimmed)) return { kind: 'malformed' }
  return { kind: 'id', id: trimmed }
}

export interface TapdFilterIdentity {
  owner: TapdFilterPresence
  iteration: TapdFilterPresence
}

/** Host-only identity used to apply bounded assignee/iteration filters at
 * discovery; never a safe DTO. */
export function decodeTapdFilterIdentity(raw: unknown, ownerField: string): TapdFilterIdentity {
  if (!isPlainObject(raw)) fail('item')
  return { owner: scalarPresence(raw[ownerField]), iteration: scalarPresence(raw.iteration_id) }
}

// --- metadata helpers ------------------------------------------------------

/** Decode a bare option collection (`Workspace`/`UserWorkspace`/`Iteration`). */
export function decodeOptionCollection(raw: unknown, type: string, idKey: string, labelKey: string): Option[] {
  return decodeCollection(raw, type).map(item => {
    if (!isPlainObject(item)) fail('option')
    const id = idString(item[idKey], 'option.id')
    return { id, label: label(item[labelKey], id) }
  })
}

/** Read the status options from a fields-info map's `status.options` object. */
export function decodeStatusOptions(fieldMap: Record<string, unknown>): Option[] {
  const status = fieldMap.status
  if (!isPlainObject(status)) return []
  const options = status.options
  if (!isPlainObject(options)) return []
  const out: Option[] = []
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === 'string' && value.trim() && !CONTROL.test(value)) out.push({ id: key, label: value })
  }
  return out
}

/** Whether a fields-info map exposes a field config under `name`. */
export function hasFieldConfig(fieldMap: Record<string, unknown>, name: string): boolean {
  return isPlainObject(fieldMap[name])
}

/** Decode `GET /workflows/status_map` — `data` is a `{status_id: label}` map. */
export function decodeStatusMap(raw: unknown): Option[] {
  const { status, data, info } = decodeEnvelope(raw, 'status_map')
  assertReadSuccess(status, info)
  if (!isPlainObject(data)) fail('status_map.data')
  const out: Option[] = []
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.trim() && !CONTROL.test(value)) out.push({ id: key, label: value })
  }
  return out
}

export interface TapdWorkflow {
  id: string
  systemName: string
  isDefault: boolean
  type: 'classic' | 'bpm'
}

/** Decode `GET /workflows` — `data[{Workflow:{id,workspace_id,system_name,is_default,type}}]`. */
export function decodeWorkflows(raw: unknown): TapdWorkflow[] {
  return decodeCollection(raw, 'Workflow').map(item => {
    if (!isPlainObject(item)) fail('workflow')
    const id = idString(item.id, 'workflow.id')
    const systemName = textValue(item.system_name, 'workflow.system_name', ID_LIMIT)
    const isDefault = boolFlag(item.is_default, 'workflow.is_default')
    const type = item.type
    if (type !== 'classic' && type !== 'bpm') fail('workflow.type')
    return { id, systemName, isDefault, type }
  })
}

export interface TapdWorkitemType {
  id: string
  name: string
  entityType: string
  workflowId: string | null
}

/** Decode `GET /workitem_types` — `data[{WorkitemType:{id,name,entity_type,workflow_id}}]`. */
export function decodeWorkitemTypes(raw: unknown): TapdWorkitemType[] {
  return decodeCollection(raw, 'WorkitemType').map(item => {
    if (!isPlainObject(item)) fail('workitem_type')
    const id = idString(item.id, 'workitem_type.id')
    const name = label(item.name, id)
    const entityType = textValue(item.entity_type, 'workitem_type.entity_type', ID_LIMIT)
    const rawWorkflowId = item.workflow_id
    let workflowId: string | null = null
    if (rawWorkflowId !== undefined && rawWorkflowId !== null && rawWorkflowId !== '') {
      if (typeof rawWorkflowId !== 'string' || !rawWorkflowId.trim()) fail('workitem_type.workflow_id')
      workflowId = rawWorkflowId
    }
    return { id, name, entityType, workflowId }
  })
}

export interface TapdTransition {
  source: string
  target: string
  /** Optional workflow identity echoed by the transition, for scope verification; null when absent. */
  workflowId: string | null
  /** True when the edge demands a mandatory/authorized field we cannot satisfy. */
  requiresUnsupported: boolean
}

/**
 * Whether a transition edge demands additional fields or permissions we cannot
 * prove are satisfied. A top-level `AuthorizedUser` (流转权限设置) that is
 * non-empty, or any `Appendfield` entry that is mandatory (`Notnull=yes`) or
 * writes a default (`DefaultValue` non-empty), fails closed as unsupported —
 * the simplest safe rule refuses any value/default we cannot supply from a
 * controlled patch. An absent/empty `Appendfield` means no additional fields.
 */
function transitionRequiresUnsupported(item: Record<string, unknown>): boolean {
  const authorizedUser = item.AuthorizedUser
  let unsupported = authorizedUser !== undefined && authorizedUser !== null && authorizedUser !== ''
  const appendField = item.Appendfield
  if (appendField === undefined) return unsupported
  if (!Array.isArray(appendField)) fail('transition.Appendfield')
  for (const entry of appendField) {
    if (!isPlainObject(entry)) fail('transition.Appendfield.item')
    const notNull = entry.Notnull
    if (notNull !== undefined) {
      if (notNull !== 'yes' && notNull !== 'no') fail('transition.Appendfield.Notnull')
      if (notNull === 'yes') unsupported = true
    }
    const defaultValue = entry.DefaultValue
    if (defaultValue !== undefined) {
      if (!Array.isArray(defaultValue)) fail('transition.Appendfield.DefaultValue')
      if (defaultValue.length > 0) unsupported = true
    }
  }
  return unsupported
}

/**
 * Decode `GET /workflows/all_transitions`. The documented sample `data`
 * container is malformed (a bare object sequence), so `data` is accepted only
 * as a single transition object or an array of direct transition objects.
 * A `WorkflowTransition`-style wrapper is not documented and fails closed
 * rather than being guessed-unwrapped. Fields are the documented keys
 * (`StepPrevious`/`StepNext`/`Appendfield`/`AuthorizedUser`); `Notnull` is
 * `yes`/`no` and `DefaultValue` is an array of `{Type,Value}`/`{Type,Field}`.
 */
export function decodeTransitions(raw: unknown): TapdTransition[] {
  const { status, data, info } = decodeEnvelope(raw, 'all_transitions')
  assertReadSuccess(status, info)
  const items = Array.isArray(data) ? data : [data]
  return items.map(item => {
    if (!isPlainObject(item)) fail('transition')
    const source = idString(item.StepPrevious, 'transition.StepPrevious')
    const target = idString(item.StepNext, 'transition.StepNext')
    let workflowId: string | null = null
    if (item.workflow_id !== undefined && item.workflow_id !== null && item.workflow_id !== '') {
      if (typeof item.workflow_id !== 'string' || !item.workflow_id.trim()) fail('transition.workflow_id')
      workflowId = item.workflow_id
    }
    return { source, target, workflowId, requiresUnsupported: transitionRequiresUnsupported(item) }
  })
}
