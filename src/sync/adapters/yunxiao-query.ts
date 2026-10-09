import type { HostCredentials, SyncTransport } from '../types.ts'
import type { SafeConnection, SyncErrorDto } from '../dto.ts'
import { resolveCredentials } from '../credentials.ts'
import { syncError, syncRemoteError } from '../errors.ts'
import { LIST_FIELDS, projectWorkitem, resolveListFields, type WorkitemListField } from '../query/fields.ts'
import { buildConditions, type WorkitemConditionGroups } from '../query/filters.ts'
import {
  DETAIL_SECTIONS, RELATION_TYPES, projectActivities, projectAttachments, projectComments, projectRelationRecords,
  unpackDescription, type ActivityView, type AttachmentView, type CommentView, type DescriptionView,
  type DetailSection, type RelationRecordView, type RelationType,
} from '../query/detail.ts'

/** Search endpoint caps: per-page 200, and page × perPage at most 10000. */
export const MAX_PER_PAGE = 200
export const MAX_RESULT_WINDOW = 10_000

const ORDER_FIELDS = ['gmtCreate', 'subject', 'status', 'priority', 'assignedTo'] as const
export type WorkitemOrderField = (typeof ORDER_FIELDS)[number]

const CATEGORY = /^[A-Za-z]+(?:,[A-Za-z]+)*$/u
const ID_LIMIT = 200
const CONTROL = /[\u0000-\u001f]/u

function invalid(field: string): never {
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'query', field }))
}

function fail(field: string): never {
  throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field }))
}

function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > ID_LIMIT || CONTROL.test(value)) invalid(field)
  return value
}

export interface WorkitemListRequest {
  projectId: string
  /** One category or a comma-joined set (`Req,Bug`); spaces and empty parts are refused. */
  categories: string
  page?: number
  perPage?: number
  /** Field projection; `['*']` or omitted means every {@link LIST_FIELDS} name. */
  fields?: readonly string[]
  /** Keep only these custom-field ids; omitted means every custom field. */
  customFieldIds?: readonly string[]
  conditions?: WorkitemConditionGroups
  orderBy?: WorkitemOrderField
  sort?: 'asc' | 'desc'
  spaceType?: 'Project' | 'Program'
}

export interface WorkitemListPage {
  items: Record<string, unknown>[]
  page: number
  perPage: number
  total: number | null
  totalPages: number | null
  /** Outbound requests this call made; the caller sizes its own budget with it. */
  requestCount: number
  /** The fields actually projected. */
  fields: readonly WorkitemListField[]
}

export interface WorkitemDetailRequest {
  projectId: string
  id: string
  /** Sections to fetch; omitted means description only. */
  include?: readonly DetailSection[]
  /** Relation kinds to read; omitted means all five. */
  relationTypes?: readonly RelationType[]
  fields?: readonly string[]
  /** Fetch serialNumber/subject/status for each related item (one request each). */
  expandRelations?: boolean
  /** Upper bound on expanded relations; default 20. */
  expandLimit?: number
}

export interface WorkitemRelationGroup {
  relationType: RelationType
  records: (RelationRecordView & { item: Record<string, unknown> | null })[]
}

export interface WorkitemDetailResult {
  item: Record<string, unknown>
  description: DescriptionView | null
  comments?: CommentView[]
  relations?: WorkitemRelationGroup[]
  activities?: ActivityView[]
  attachments?: AttachmentView[]
  /** Sections that failed; the ones that succeeded are still returned. */
  sectionErrors: { section: DetailSection; error: SyncErrorDto }[]
  requestCount: number
}

export interface YunxiaoQuery {
  listWorkitems(request: WorkitemListRequest, signal: AbortSignal): Promise<WorkitemListPage>
  getWorkitem(request: WorkitemDetailRequest, signal: AbortSignal): Promise<WorkitemDetailResult>
  listFields(request: WorkitemFieldsRequest, signal: AbortSignal): Promise<WorkitemFieldDefinition[]>
}

/** One selectable field of a work-item type, straight from the platform's own config. */
export interface WorkitemFieldDefinition {
  id: string
  name: string
  format: string
  required: boolean
  /** Platform field family: NativeField, CustomField, SystemCustomField, Role, Application… */
  kind: string
  options: { id: string; label: string }[]
}

export interface WorkitemFieldsRequest {
  projectId: string
  /** Category whose work-item types are merged; the platform refuses an empty one. */
  category: string
}

const FIELD_NAME_LIMIT = 100
const FIELD_FORMAT_LIMIT = 32
const FIELD_OPTION_LIMIT = 200
const MAX_TYPES = 10

function sectionError(error: unknown, section: DetailSection): { section: DetailSection; error: SyncErrorDto } {
  if (error !== null && typeof error === 'object') {
    const candidate = error as { code?: unknown; details?: SyncErrorDto }
    if (candidate.code === 'task-list/sync' && candidate.details && typeof candidate.details.code === 'string') {
      return { section, error: candidate.details }
    }
  }
  return { section, error: syncError('UnexpectedFailure', { scope: 'item' }) }
}

function headerInt(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name)
  if (raw === null) return undefined
  const value = raw.trim()
  if (!/^\d+$/u.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Sections to read: omitted means description only; an unknown name fails closed. */
function detailSections(include: readonly DetailSection[] | undefined): DetailSection[] {
  if (include === undefined || include.length === 0) return ['description']
  for (const section of include) if (!DETAIL_SECTIONS.includes(section)) invalid('include')
  return [...new Set(include)]
}

/**
 * Read-only query surface over the same connection/credential plumbing as the
 * sync adapter. `listWorkitems` is one search request and takes a field
 * projection; `getWorkitem` is the detail read that alone can carry the body,
 * comments, relations, activity and attachments.
 */
export function createYunxiaoQuery(
  connection: SafeConnection,
  transport: SyncTransport,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  stored?: HostCredentials,
): YunxiaoQuery {
  if (connection.platform !== 'yunxiao') invalid('platform')
  if (connection.mode === 'region') invalid('regionHost')
  const credentials = stored ?? resolveCredentials(connection, env)
  if (credentials.kind !== 'yunxiao') invalid('platform')
  const token = credentials.token
  const instance = connection.organizationId
  const base = `https://openapi-rdc.aliyuncs.com/oapi/v1/projex/organizations/${encodeURIComponent(instance)}`
  const url = (path: string): URL => new URL(`${base}${path}`)
  const auth = (extra: Record<string, string> = {}): Record<string, string> => ({ 'x-yunxiao-token': token, ...extra })

  let requests = 0
  const read = async (path: string, init: { method: 'GET' | 'POST', body?: string }, signal: AbortSignal): Promise<{ value: unknown; headers: Headers }> => {
    requests += 1
    const response = await transport.read({
      url: url(path),
      method: init.method,
      headers: auth(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(init.body === undefined ? {} : { body: init.body }),
      readOnly: true,
    }, signal)
    return { value: response.value, headers: response.headers }
  }

  async function listWorkitems(request: WorkitemListRequest, signal: AbortSignal): Promise<WorkitemListPage> {
    if (!CATEGORY.test(request.categories) || request.categories.split(',').some(part => part.trim() === '')) invalid('categories')
    const page = request.page ?? 1
    const perPage = request.perPage ?? 50
    if (!Number.isSafeInteger(page) || page < 1) invalid('page')
    if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) invalid('perPage')
    if (page * perPage > MAX_RESULT_WINDOW) invalid('page')
    const orderBy = request.orderBy ?? 'gmtCreate'
    if (!ORDER_FIELDS.includes(orderBy)) invalid('orderBy')
    const sort = request.sort ?? 'desc'
    if (sort !== 'asc' && sort !== 'desc') invalid('sort')
    const spaceType = request.spaceType ?? 'Project'
    if (spaceType !== 'Project' && spaceType !== 'Program') invalid('spaceType')
    const fields = resolveListFields(request.fields)
    const customFieldIds = request.customFieldIds === undefined || request.customFieldIds.length === 0
      ? null
      : new Set(request.customFieldIds.map(id => identifier(id, 'customFieldIds')))
    const conditions = buildConditions(request.conditions)

    const body: Record<string, unknown> = {
      category: request.categories,
      spaceId: identifier(request.projectId, 'projectId'),
      spaceType,
      page,
      perPage,
      orderBy,
      sort,
    }
    if (conditions !== undefined) body.conditions = conditions

    const before = requests
    const response = await read('/workitems:search', { method: 'POST', body: JSON.stringify(body) }, signal)
    if (!Array.isArray(response.value)) fail('search')
    const items = response.value.map(row => projectWorkitem(row, fields, { customFieldIds }))
    const total = headerInt(response.headers, 'x-total') ?? null
    const totalPages = headerInt(response.headers, 'x-total-pages')
      ?? (total === null ? null : Math.max(1, Math.ceil(total / perPage)))
    return { items, page, perPage, total, totalPages, fields, requestCount: requests - before }
  }

  async function getWorkitem(request: WorkitemDetailRequest, signal: AbortSignal): Promise<WorkitemDetailResult> {
    const id = identifier(request.id, 'id')
    const projectId = identifier(request.projectId, 'projectId')
    const sections = detailSections(request.include)
    const want = (section: DetailSection): boolean => sections.includes(section)
    const relationTypes = request.relationTypes === undefined || request.relationTypes.length === 0
      ? RELATION_TYPES
      : request.relationTypes.filter(type => {
        if (!RELATION_TYPES.includes(type)) invalid('relationTypes')
        return true
      })
    const expandLimit = request.expandLimit ?? 20
    if (!Number.isSafeInteger(expandLimit) || expandLimit < 0 || expandLimit > 100) invalid('expandLimit')
    const fields = resolveListFields(request.fields)

    const before = requests
    const raw = await read(`/workitems/${encodeURIComponent(id)}`, { method: 'GET' }, signal)
    if (!isPlainObject(raw.value)) fail('item')
    const space = raw.value.space
    const spaceId = isPlainObject(space) && typeof space.id === 'string' ? space.id : null
    if (raw.value.id !== id || (spaceId !== null && spaceId !== projectId)) fail('item')
    const item = projectWorkitem(raw.value, fields)
    const description = want('description') ? unpackDescription(raw.value.description, raw.value.formatType) : null

    const sectionErrors: { section: DetailSection; error: SyncErrorDto }[] = []
    let comments: CommentView[] | undefined
    if (want('comments')) {
      try {
        const response = await read(`/workitems/${encodeURIComponent(id)}/comments`, { method: 'GET' }, signal)
        comments = projectComments(response.value)
      } catch (error) { sectionErrors.push(sectionError(error, 'comments')) }
    }
    let activities: ActivityView[] | undefined
    if (want('activities')) {
      try {
        const response = await read(`/workitems/${encodeURIComponent(id)}/activities`, { method: 'GET' }, signal)
        activities = projectActivities(response.value)
      } catch (error) { sectionErrors.push(sectionError(error, 'activities')) }
    }
    let attachments: AttachmentView[] | undefined
    if (want('attachments')) {
      try {
        const response = await read(`/workitems/${encodeURIComponent(id)}/attachments`, { method: 'GET' }, signal)
        attachments = projectAttachments(response.value)
      } catch (error) { sectionErrors.push(sectionError(error, 'attachments')) }
    }
    let relations: WorkitemRelationGroup[] | undefined
    if (want('relations')) {
      relations = []
      let expanded = 0
      for (const relationType of relationTypes) {
        try {
          const response = await read(`/workitems/${encodeURIComponent(id)}/relationRecords?relationType=${relationType}`, { method: 'GET' }, signal)
          const records = projectRelationRecords(response.value, relationType)
          const group: WorkitemRelationGroup = { relationType, records: records.map(record => ({ ...record, item: null })) }
          if (request.expandRelations === true) {
            for (const record of group.records) {
              if (expanded >= expandLimit) break
              expanded += 1
              try {
                const related = await read(`/workitems/${encodeURIComponent(record.resourceId)}`, { method: 'GET' }, signal)
                record.item = isPlainObject(related.value) ? projectWorkitem(related.value, fields) : null
              } catch { record.item = null }
            }
          }
          relations.push(group)
        } catch (error) { sectionErrors.push(sectionError(error, 'relations')) }
      }
    }

    return {
      item,
      description,
      ...(comments === undefined ? {} : { comments }),
      ...(relations === undefined ? {} : { relations }),
      ...(activities === undefined ? {} : { activities }),
      ...(attachments === undefined ? {} : { attachments }),
      sectionErrors,
      requestCount: requests - before,
    }
  }

  /**
   * Every selectable field of the chosen category, read from the platform's own
   * config and merged across that category's work-item types (a project-wide
   * field picker needs one list, and reading only the first type would hide
   * fields another type adds). First occurrence wins for name/format.
   */
  async function listFields(request: WorkitemFieldsRequest, signal: AbortSignal): Promise<WorkitemFieldDefinition[]> {
    const projectId = identifier(request.projectId, 'projectId')
    if (!CATEGORY.test(request.category) || request.category.includes(',')) invalid('category')
    const types = await read(`/projects/${encodeURIComponent(projectId)}/workitemTypes?category=${request.category}`, { method: 'GET' }, signal)
    if (!Array.isArray(types.value)) fail('workitemTypes')
    const merged = new Map<string, WorkitemFieldDefinition>()
    for (const entry of types.value.slice(0, MAX_TYPES)) {
      if (!isPlainObject(entry)) fail('workitemTypes')
      const typeId = bounded(entry.id, ID_LIMIT)
      if (typeId === null) fail('workitemTypes.id')
      const response = await read(`/projects/${encodeURIComponent(projectId)}/workitemTypes/${encodeURIComponent(typeId)}/fields`, { method: 'GET' }, signal)
      if (!Array.isArray(response.value)) fail('fields')
      for (const raw of response.value) {
        if (!isPlainObject(raw)) fail('fields')
        const id = bounded(raw.id, ID_LIMIT)
        if (id === null || id === '' || merged.has(id)) continue
        const options: { id: string; label: string }[] = []
        if (Array.isArray(raw.options)) {
          for (const option of raw.options.slice(0, FIELD_OPTION_LIMIT)) {
            if (!isPlainObject(option)) continue
            const optionId = bounded(option.id, ID_LIMIT)
            if (optionId === null) continue
            options.push({ id: optionId, label: bounded(option.displayValue, FIELD_NAME_LIMIT) ?? bounded(option.value, FIELD_NAME_LIMIT) ?? optionId })
          }
        }
        merged.set(id, {
          id,
          name: bounded(raw.name, FIELD_NAME_LIMIT) ?? id,
          format: bounded(raw.format, FIELD_FORMAT_LIMIT) ?? '',
          required: raw.required === true,
          kind: bounded(raw.type, FIELD_FORMAT_LIMIT) ?? '',
          options,
        })
      }
    }
    return [...merged.values()]
  }

  return { listWorkitems, getWorkitem, listFields }
}

function bounded(value: unknown, limit: number): string | null {
  return typeof value === 'string' && value.length <= limit && !CONTROL.test(value) ? value : null
}

export const LIST_FIELD_NAMES: readonly string[] = LIST_FIELDS
