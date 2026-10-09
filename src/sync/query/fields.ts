import { syncError, syncRemoteError } from '../errors.ts'

const ID_LIMIT = 200
const TEXT_LIMIT = 1000
const NAME_LIMIT = 100
/** Ids reject every control character; free text keeps tabs and newlines. */
const CONTROL = /[\u0000-\u001f]/u
const TEXT_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u

/**
 * Fields a work-item list may carry. The platform returns a fixed payload for
 * every search row, but callers name what they need and the adapter projects
 * exactly that — so a list page never drags description bodies or comment
 * threads across the wire.
 *
 * `description` is deliberately absent: it is detail-only content (one extra
 * `GET /workitems/{id}`) and asking for it here fails closed.
 */
export const LIST_FIELDS = [
  'id', 'serialNumber', 'subject', 'status', 'statusStage', 'workitemType', 'category',
  'space', 'assignedTo', 'creator', 'modifier', 'verifier', 'participants', 'trackers',
  'sprint', 'labels', 'versions', 'customFields', 'logicalStatus', 'parentId',
  'gmtCreate', 'gmtModified', 'updateStatusAt',
] as const
export type WorkitemListField = (typeof LIST_FIELDS)[number]

/** Requested name -> key in the platform payload. */
const FIELD_KEYS: Readonly<Record<WorkitemListField, string>> = {
  id: 'id',
  serialNumber: 'serialNumber',
  subject: 'subject',
  status: 'status',
  statusStage: 'statusStageId',
  workitemType: 'workitemType',
  category: 'categoryId',
  space: 'space',
  assignedTo: 'assignedTo',
  creator: 'creator',
  modifier: 'modifier',
  verifier: 'verifier',
  participants: 'participants',
  trackers: 'trackers',
  sprint: 'sprint',
  labels: 'labels',
  versions: 'versions',
  customFields: 'customFieldValues',
  logicalStatus: 'logicalStatus',
  parentId: 'parentId',
  gmtCreate: 'gmtCreate',
  gmtModified: 'gmtModified',
  updateStatusAt: 'updateStatusAt',
}

/** Detail-only fields that must never be requested from the list surface. */
const DETAIL_ONLY = new Set(['description', 'formatType', 'comments', 'relations', 'activities', 'attachments'])

const FIELD_SET = new Set<string>(LIST_FIELDS)

/** The platform's placeholder id for "no parent"; the adapter reports it as null. */
const EMPTY_VALUE = 'EMPTY_VALUE'

function fail(field: string): never {
  throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field }))
}

function invalidConfig(field: string): never {
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'query', field }))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') return isPlainObject(value) && Object.values(value).every(isJsonValue)
  return false
}

function boundedText(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > TEXT_LIMIT || TEXT_CONTROL.test(value)) return null
  return value
}

function boundedId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > ID_LIMIT || CONTROL.test(value)) return null
  return value
}

/** A required string field: missing or malformed is a malformed row, never a null. */
function requiredText(value: unknown, field: string): string {
  const text = boundedText(value)
  if (text === null || text.trim() === '') fail(field)
  return text
}

/** A `{ id, name }` reference, or null when the platform reports no value. */
function reference(value: unknown): { id: string; name: string } | null {
  if (value === null || value === undefined) return null
  if (!isPlainObject(value)) fail('reference')
  const id = boundedId(value.id)
  if (id === null) fail('reference.id')
  return { id, name: boundedText(value.name) ?? '' }
}

/** A `{ id, name }` reference with the status extras the platform adds. */
function statusReference(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (!isPlainObject(value)) fail('status')
  const id = boundedId(value.id)
  if (id === null) fail('status.id')
  const name = boundedText(value.name) ?? ''
  const displayName = boundedText(value.displayName) ?? name
  const nameEn = boundedText(value.nameEn)
  return { id, name, displayName, ...(nameEn === null ? {} : { nameEn }) }
}

/** A `{ id, name, color }` label. */
function label(value: unknown): Record<string, unknown> {
  const ref = reference(value)
  if (ref === null) fail('label')
  const color = isPlainObject(value) && typeof value.color === 'string' && value.color.length <= 32 && !CONTROL.test(value.color)
    ? value.color
    : null
  return { ...ref, color }
}

function references(value: unknown, field: string): Record<string, unknown>[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) fail(field)
  return value.map(item => reference(item) ?? fail(field))
}

function labels(value: unknown): Record<string, unknown>[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) fail('labels')
  return value.map(item => label(item))
}

/** One `customFieldValues[]` entry, projected to the stable display shape. */
function customField(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) fail('customFieldValues')
  const fieldId = boundedId(value.fieldId)
  if (fieldId === null) fail('customFieldValues.fieldId')
  const values = value.values
  if (!Array.isArray(values)) fail('customFieldValues.values')
  return {
    fieldId,
    fieldName: boundedText(value.fieldName) ?? '',
    fieldFormat: boundedText(value.fieldFormat) ?? '',
    values: values.map(entry => {
      if (!isPlainObject(entry)) fail('customFieldValues.values')
      const display = boundedText(entry.displayValue) ?? ''
      const identifier = boundedText(entry.identifier) ?? display
      return { identifier, displayValue: display }
    }),
  }
}

function customFields(value: unknown, only: ReadonlySet<string> | null): Record<string, unknown>[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) fail('customFieldValues')
  const projected = value.map(entry => customField(entry))
  return only === null ? projected : projected.filter(entry => only.has(entry.fieldId as string))
}

/** Keep only the payload's own numbers; anything else becomes null. */
function epoch(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function listValue(field: WorkitemListField, raw: Record<string, unknown>, onlyFields: ReadonlySet<string> | null): unknown {
  const value = raw[FIELD_KEYS[field]]
  switch (field) {
    case 'id':
      return requiredText(value, 'item.id')
    case 'logicalStatus': case 'serialNumber': case 'subject':
      return value === undefined ? null : requiredText(value, `item.${field}`)
    case 'statusStage':
      return value === undefined || value === null ? null : boundedId(value)
    case 'parentId': {
      const id = value === undefined || value === null ? null : boundedId(value)
      // The platform writes the literal EMPTY_VALUE for "no parent".
      return id === null || id === EMPTY_VALUE ? null : id
    }
    case 'customFields':
      return customFields(value, onlyFields)
    case 'labels':
      return labels(value)
    case 'participants': case 'trackers':
      return references(value, field)
    case 'versions':
      if (value === null || value === undefined) return null
      if (!Array.isArray(value) || !value.every(isJsonValue)) fail('versions')
      return value
    case 'status':
      return statusReference(value)
    case 'workitemType': case 'space': case 'assignedTo': case 'creator': case 'modifier': case 'verifier': case 'sprint':
      return reference(value)
    case 'category':
      return value === undefined || value === null ? null : boundedText(value)
    case 'gmtCreate': case 'gmtModified': case 'updateStatusAt':
      return epoch(value)
    default:
      fail('fields')
  }
}

export interface ProjectionOptions {
  /** `null` keeps every custom field; a set keeps only those field ids. */
  customFieldIds?: ReadonlySet<string> | null
}

/**
 * Resolve a caller's field list. `'*'` expands to every list field; unknown or
 * detail-only names fail closed rather than silently returning nothing. `id` is
 * always present — it is the row identity every caller needs to key on.
 */
export function resolveListFields(fields: readonly string[] | undefined): readonly WorkitemListField[] {
  const out: WorkitemListField[] = ['id']
  const seen = new Set<string>(['id'])
  if (fields === undefined || fields.length === 0) {
    for (const field of LIST_FIELDS) if (!seen.has(field)) { seen.add(field); out.push(field) }
    return out
  }
  for (const name of fields) {
    if (name === '*') {
      for (const field of LIST_FIELDS) if (!seen.has(field)) { seen.add(field); out.push(field) }
      continue
    }
    if (DETAIL_ONLY.has(name)) invalidConfig(`fields(${name})`)
    if (!FIELD_SET.has(name)) invalidConfig(`fields(${name})`)
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name as WorkitemListField)
  }
  return out
}

/**
 * Project one platform work-item row down to the requested fields. Values keep
 * the platform's meaning (ids stay strings, timestamps stay epoch numbers) but
 * every shape is verified, so a malformed row is reported instead of rendered.
 */
export function projectWorkitem(raw: unknown, fields: readonly WorkitemListField[], options: ProjectionOptions = {}): Record<string, unknown> {
  if (!isPlainObject(raw)) fail('item')
  if (!isJsonValue(raw)) fail('item')
  const only = options.customFieldIds ?? null
  const out: Record<string, unknown> = {}
  for (const field of fields) out[field] = listValue(field, raw, only)
  return out
}

/** Names a caller may ask for; surfaced in docs and settings copy. */
export const LIST_FIELD_NAMES: readonly string[] = LIST_FIELDS
