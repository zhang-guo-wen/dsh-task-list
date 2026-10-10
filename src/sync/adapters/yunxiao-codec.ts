import type { TaskContent, TaskStatus } from '../../types.ts'
import type { FieldValue, RemoteItem } from '../types.ts'
import type { Option, StatusWriteStates } from '../dto.ts'
import { decodeDescription } from '../description-codec.ts'
import { packWorkitemDescription } from '../workitem-packer.ts'
import { contentText } from '../../content.ts'
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

/** Extract an id from either a plain string or an object carrying `id`; ids stay strings, never numbers. */
function extractId(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return idString(value, field)
  if (isPlainObject(value)) {
    const id = value.id
    if (typeof id === 'string') return idString(id, field)
  }
  fail(field)
}

/** Presence-aware id for a documented `{ id, name }` object. `absent` means the
 * field was not returned; `null` means the platform explicitly reported no
 * value (unassigned); `id` carries a validated id; `malformed` means the field
 * was present but not a valid object with a string id. */
export type FilterPresence =
  | { kind: 'absent' }
  | { kind: 'null' }
  | { kind: 'id'; id: string }
  | { kind: 'malformed' }

function filterPresence(value: unknown): FilterPresence {
  if (value === undefined) return { kind: 'absent' }
  if (value === null) return { kind: 'null' }
  if (!isPlainObject(value)) return { kind: 'malformed' }
  const id = value.id
  if (typeof id !== 'string' || !id.trim() || id.length > ID_LIMIT || CONTROL.test(id)) return { kind: 'malformed' }
  return { kind: 'id', id }
}

function textValue(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || CONTROL.test(value)) fail(field)
  return value
}

function label(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim() && value.length <= LABEL_LIMIT && !CONTROL.test(value)) return value
  return fallback
}

/** `formatType` is RICHTEXT or MARKDOWN; anything else falls back to richtext rather than inventing a format. */
function normalizeFormat(formatType: unknown): 'markdown' | 'richtext' {
  if (typeof formatType === 'string' && formatType.toUpperCase() === 'MARKDOWN') return 'markdown'
  return 'richtext'
}

export interface WorkitemCodecContext {
  instance: string
  projectId: string
  typeId: string
  id: string
  /** Local status -> platform status id, exactly as the rule maps it. */
  statusWriteStates: StatusWriteStates
}

/**
 * Resolve the local status of one platform status id: the rule's write mapping
 * read backwards. An id no local status maps to is a mapping incompatibility —
 * never silently cast to a `TaskStatus` or defaulted to `todo`.
 */
export function statusForRaw(raw: string, statusWriteStates: StatusWriteStates): TaskStatus {
  for (const status of ['todo', 'in_progress', 'done'] as const) {
    if (statusWriteStates[status] === raw) return status
  }
  throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'status' }))
}

/**
 * Decode one bare Yunxiao work item into the shared vocabulary. The identity
 * fields (id, space.id, workitemType.id) are verified against the requested key
 * so a malformed cross-project response is never rebound to a different item.
 * `gmtModified` is kept as an opaque string (no date parsing) and there is no
 * revision token (no documented CAS). Optional fields stay absent: only the
 * status is ever written back, so nothing else is compared.
 */
export function decodeWorkitem(raw: unknown, ctx: WorkitemCodecContext): RemoteItem {
  if (!isPlainObject(raw)) fail('item')

  const id = extractId(raw.id, 'item.id')
  if (id !== ctx.id) fail('item.id')
  const spaceId = extractId(raw.space, 'item.space')
  if (spaceId !== ctx.projectId) fail('item.space')
  const typeId = extractId(raw.workitemType, 'item.workitemType')
  if (typeId !== ctx.typeId) fail('item.workitemType')

  const number = typeof raw.serialNumber === 'string' ? raw.serialNumber
    : typeof raw.serialNumber === 'number' ? String(raw.serialNumber) : ''
  const updatedToken = typeof raw.gmtModified === 'string' ? raw.gmtModified : ''

  const title = textValue(raw.subject, 'item.subject', TITLE_LIMIT)

  const statusId = extractId(raw.status, 'item.status')
  if (statusId === undefined) fail('item.status')
  const statusField: FieldValue<TaskStatus> = {
    presence: 'value', value: statusForRaw(statusId, ctx.statusWriteStates), writable: true,
  }

  const format = normalizeFormat(raw.formatType)
  // The work item's own body, decoded into the plugin's vocabulary; it is packed
  // below with the row's labelled values so the imported task carries the whole
  // item. Only the status is ever compared or written back afterwards.
  const empty: TaskContent = { version: 1, blocks: [] }
  let decodedBody = empty
  let descriptionRaw: FieldValue<string>
  let roundTrip: boolean
  if (typeof raw.description === 'string') {
    descriptionRaw = { presence: 'value', value: raw.description, writable: true }
    const decoded = decodeDescription(descriptionRaw, format)
    decodedBody = decoded.content
    roundTrip = decoded.roundTrip
  } else if (raw.description === null) {
    descriptionRaw = { presence: 'null', writable: true }
    roundTrip = true
  } else {
    descriptionRaw = { presence: 'absent', writable: false }
    roundTrip = false
  }
  const packed = packWorkitemDescription(raw, contentText(decodedBody))

  return {
    key: { instance: ctx.instance, projectId: ctx.projectId, typeId: ctx.typeId, id: ctx.id },
    number,
    url: null,
    updatedToken,
    fields: {
      title: { presence: 'value', value: title, writable: true },
      description: { presence: 'value', value: packed, writable: true },
      status: statusField,
      priority: { presence: 'absent', writable: false },
      tags: { presence: 'absent', writable: false },
      storyPoints: { presence: 'absent', writable: false },
    },
    rawStatus: statusId,
    description: { format, raw: descriptionRaw, roundTrip },
    revisionToken: null,
  }
}

/** Decode a search summary's identity, verifying it belongs to the requested project. */
export function decodeSearchIdentity(raw: unknown, projectId: string): { id: string; typeId: string } {
  if (!isPlainObject(raw)) fail('item')
  const id = extractId(raw.id, 'item.id')
  const spaceId = extractId(raw.space, 'item.space')
  const typeId = extractId(raw.workitemType, 'item.workitemType')
  if (id === undefined || typeId === undefined || spaceId !== projectId) fail('item')
  return { id, typeId }
}

/** Host-only identity used to apply bounded assignee/sprint filters at discovery; never a safe DTO. */
export interface WorkitemFilterIdentity {
  assignee: FilterPresence
  sprint: FilterPresence
}

/** Extract assignee/sprint presence from the raw detail for bounded client-side
 * filtering. Absence, explicit null and malformed shapes are reported rather
 * than conflated, so the caller can fail closed under an active filter. */
export function decodeWorkitemFilterIdentity(raw: unknown): WorkitemFilterIdentity {
  if (!isPlainObject(raw)) fail('item')
  return { assignee: filterPresence(raw.assignedTo), sprint: filterPresence(raw.sprint) }
}

/** Decode a bare array of `{ [idKey]: string, [labelKey]: string }` into options. */
export function decodeOptionList(raw: unknown, idKey: string, labelKey: string): Option[] {
  if (!Array.isArray(raw)) fail('options')
  return raw.map(item => {
    if (!isPlainObject(item)) fail('option')
    const id = idString(item[idKey], 'option.id')
    return { id, label: label(item[labelKey], id) }
  })
}

/** Decode a workflow `{ statuses: [{ id, name }] }` into status options. */
export function decodeWorkflowStatuses(raw: unknown): Option[] {
  if (!isPlainObject(raw)) fail('workflow')
  if (!Array.isArray(raw.statuses)) fail('workflow.statuses')
  return decodeOptionList(raw.statuses, 'id', 'name')
}
