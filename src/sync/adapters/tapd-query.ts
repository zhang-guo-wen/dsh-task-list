import type { HostCredentials, SyncTransport } from '../types.ts'
import type { SafeConnection, WorkitemConditionGroups } from '../dto.ts'
import type {
  YunxiaoQuery, WorkitemDetailRequest, WorkitemDetailResult, WorkitemFieldDefinition,
  WorkitemFieldsRequest, WorkitemListPage, WorkitemListRequest,
} from './yunxiao-query.ts'
import { resolveCredentials } from '../credentials.ts'
import { syncError, syncRemoteError } from '../errors.ts'
import { decodeCollection, decodeFieldMap, decodeTapdItemId, TAPD_CATEGORY_FIELDS, TAPD_COLLECTION, TAPD_WRAPPER, type TapdCategory } from './tapd-codec.ts'
import { resolveListFields, type WorkitemListField } from '../query/fields.ts'
import { decodeDescription } from '../description-codec.ts'
import { contentText, textContent } from '../../content.ts'

const CATEGORIES: readonly TapdCategory[] = ['story', 'bug', 'task']
const LABELS: Record<TapdCategory, string> = { story: '需求', bug: '缺陷', task: '任务' }
const MAX_PER_PAGE = 200
// A plugin-side bounded result window, not a claim about a TAPD server cap.
const MAX_RESULT_WINDOW = 10_000
const CONTROL = /[\u0000-\u001f]/u
const QUERY_SYNTAX = /[|;,<>~]/u
const FIELD = /^[A-Za-z][A-Za-z0-9_]*$/u

function invalid(field: string): never {
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'query', field }))
}
function fail(field: string): never {
  throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field }))
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}
function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || CONTROL.test(value)) invalid(field)
  return value
}
function numericId(value: unknown, field: string): string {
  const id = identifier(value, field)
  if (!/^\d+$/u.test(id)) invalid(field)
  return id
}
function categories(value: string): TapdCategory[] {
  const parts = value.split(',')
  if (parts.length === 0 || parts.some(part => !CATEGORIES.includes(part as TapdCategory))) invalid('categories')
  return [...new Set(parts)] as TapdCategory[]
}
function text(value: unknown, field: string, limit = 1000): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > limit || CONTROL.test(value)) fail(field)
  return value
}
function reference(value: unknown, field: string): { id: string; name: string } | null {
  const id = text(value, field, 200)
  return id === null || id === '0' ? null : { id, name: id }
}
function date(value: unknown, field: string, remote = false): string {
  const reject = (): never => remote ? fail(field) : invalid(field)
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/u.test(value)) return reject()
  const normalized = value.replace('T', ' ')
  const stamp = Date.parse(normalized.replace(' ', 'T') + (normalized.length === 10 ? 'T00:00:00Z' : 'Z'))
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, normalized.length).replace('T', ' ') !== normalized) return reject()
  return normalized
}

interface Filter {
  param: string
  encoded: string
  matches(raw: Record<string, unknown>): boolean
}

/**
 * TAPD URL parameters are ANDed. A value set is ORed only where documented.
 * There is no verified cross-field OR/group parameter on these endpoints: never
 * flatten groups, overwrite repeated fields, or silently drop unknown filters.
 * Date ranges use from~to, per the official API's 使用必读 (2025-06-18).
 */
function filters(groups: WorkitemConditionGroups | undefined, category: TapdCategory): Filter[] {
  if (groups === undefined || groups.length === 0) return []
  if (groups.length !== 1 || groups[0]!.length === 0 || groups[0]!.length > 20) invalid('conditions')
  const used = new Set<string>()
  return groups[0]!.map(condition => {
    const field = condition.field
    const params: Record<string, string> = {
      status: 'status', assignedTo: TAPD_CATEGORY_FIELDS[category].owner,
      creator: category === 'bug' ? 'reporter' : 'creator', priority: 'priority_label',
      sprint: 'iteration_id', subject: TAPD_CATEGORY_FIELDS[category].title,
      gmtCreate: 'created', gmtModified: 'modified',
      ...(category === 'story' ? { workitemType: 'workitem_type_id' } : {}),
    }
    const param = params[field]
    if (param === undefined || used.has(param)) invalid(`conditions.field(${field})`)
    used.add(param)
    if (!Array.isArray(condition.value) || condition.value.length < 1 || condition.value.length > 50) invalid(`conditions.value(${field})`)
    const values = condition.value.map(value => identifier(value, `conditions.value(${field})`))
    const operator = condition.operator ?? (field === 'subject' ? 'CONTAINS' : field === 'gmtCreate' || field === 'gmtModified' ? 'BETWEEN' : 'EQUALS')
    if (field === 'gmtCreate' || field === 'gmtModified') {
      if (operator !== 'BETWEEN' || values.length !== 1) invalid(`conditions.operator(${field})`)
      const from = date(values[0], `conditions.value(${field})`)
      const to = date(condition.toValue, `conditions.toValue(${field})`)
      // Mixed precision has ambiguous end-of-day semantics; require equal precision.
      if (from.length !== to.length || from > to) invalid(`conditions.toValue(${field})`)
      return { param, encoded: `${from}~${to}`, matches: raw => {
        const value = date(raw[param], param, true).slice(0, from.length)
        return value >= from && value <= to
      } }
    }
    if (condition.toValue !== undefined && condition.toValue !== null) invalid(`conditions.toValue(${field})`)
    if (values.some(value => QUERY_SYNTAX.test(value))) invalid(`conditions.value(${field})`)
    if (field === 'subject') {
      if (operator !== 'CONTAINS') invalid(`conditions.operator(${field})`)
      return { param, encoded: `LIKE_OR<${values.join('|')}>`, matches: raw => {
        const value = text(raw[param], param)
        return value !== null && values.some(part => value.includes(part))
      } }
    }
    if (field === 'assignedTo' || field === 'creator' || field === 'priority') {
      // Bare owner/current_owner is fuzzy. EQ is exact; multi-person set equality
      // and an OR of several EQ expressions have no verified encoding here.
      if (operator !== 'EQUALS' || values.length !== 1) invalid(`conditions.operator(${field})`)
      return { param, encoded: `EQ<${values[0]!}>`, matches: raw => text(raw[param], param, 200) === values[0] }
    }
    if (operator !== 'EQUALS' && operator !== 'CONTAINS') invalid(`conditions.operator(${field})`)
    return { param, encoded: values.join('|'), matches: raw => {
      const value = text(raw[param], param, 200)
      return value !== null && values.includes(value)
    } }
  })
}

function nativeMap(category: TapdCategory): Record<string, WorkitemListField> {
  return {
    id: 'id', [TAPD_CATEGORY_FIELDS[category].title]: 'subject', status: 'status',
    [TAPD_CATEGORY_FIELDS[category].owner]: 'assignedTo',
    [category === 'bug' ? 'reporter' : 'creator']: 'creator', workspace_id: 'space',
    iteration_id: 'sprint', label: 'labels', created: 'gmtCreate', modified: 'gmtModified',
    ...(category === 'story' ? { workitem_type_id: 'workitemType', parent_id: 'parentId' } : {}),
  }
}

/** Read-only PAT/Bearer query surface, reusing TAPD's already-used collections and codecs. */
export function createTapdQuery(
  connection: SafeConnection,
  transport: SyncTransport,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  stored?: HostCredentials,
): YunxiaoQuery {
  if (connection.platform !== 'tapd') invalid('platform')
  if (connection.authentication?.mode === 'oauth') invalid('authentication')
  const credentials = stored ?? resolveCredentials(connection, env)
  if (credentials.kind !== 'tapd') invalid('platform')
  if (!credentials.token.trim()) throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'token' }))

  async function read(path: string, params: Record<string, string>, signal: AbortSignal): Promise<unknown> {
    const url = new URL(`https://api.tapd.cn${path}`)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const result = await transport.read({ url, method: 'GET', headers: { authorization: `Bearer ${credentials.token}` }, readOnly: true }, signal)
    return result.value
  }
  async function fieldMap(projectId: string, category: TapdCategory, signal: AbortSignal): Promise<Record<string, unknown>> {
    return decodeFieldMap(await read(`/${TAPD_COLLECTION[category]}/get_fields_info`, { workspace_id: projectId }, signal))
  }
  function row(raw: unknown, category: TapdCategory, projectId: string): Record<string, unknown> {
    if (!object(raw)) fail('item')
    decodeTapdItemId(raw)
    if (raw.workspace_id !== undefined && raw.workspace_id !== projectId) fail('workspace_id')
    return raw
  }
  function project(raw: Record<string, unknown>, category: TapdCategory, projectId: string, fields: readonly WorkitemListField[], configs: Record<string, unknown>, only: ReadonlySet<string> | null): Record<string, unknown> {
    const mapping = nativeMap(category)
    const reverse = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [value, key]))
    const out: Record<string, unknown> = {}
    for (const field of fields) {
      const key = reverse[field]
      const value = key === undefined ? undefined : raw[key]
      switch (field) {
        case 'id': case 'serialNumber': out[field] = decodeTapdItemId(raw); break
        case 'subject': out[field] = text(value, field) ?? fail(field); break
        case 'category': out[field] = category; break
        case 'space': out[field] = { id: projectId, name: projectId }; break
        case 'workitemType': out[field] = reference(value, field) ?? { id: category, name: LABELS[category] }; break
        case 'status': out[field] = reference(value, field); break
        case 'assignedTo': case 'creator': case 'sprint': out[field] = reference(value, field); break
        case 'labels': out[field] = (text(value, field) ?? '').split('|').filter(Boolean).map(id => ({ id, name: id, color: null })); break
        // TAPD returns wall-clock strings without an offset; retain them rather
        // than manufacture an epoch in the host's local timezone.
        case 'gmtCreate': case 'gmtModified': out[field] = value === undefined || value === null || value === '' ? null : date(value, field, true); break
        case 'parentId': out[field] = value === '0' ? null : text(value, field, 200); break
        case 'customFields': {
          const custom: Record<string, unknown>[] = []
          for (const [id, config] of Object.entries(configs)) {
            if (mapping[id] !== undefined || id === 'description' || !FIELD.test(id)) continue
            const fieldId = id === 'priority_label' ? 'priority' : id
            if (only !== null && !only.has(fieldId)) continue
            const source = raw[id]
            if (source === undefined || source === null || source === '') continue
            const display = typeof source === 'number' && Number.isFinite(source) ? String(source) : text(source, id)
            if (display === null) continue
            custom.push({ fieldId, fieldName: object(config) ? text(config.label, id) ?? fieldId : fieldId,
              fieldFormat: object(config) ? text(config.html_type, id, 32) ?? '' : '',
              values: [{ identifier: display, displayValue: display }] })
          }
          out[field] = custom
          break
        }
        default: out[field] = null
      }
    }
    return out
  }
  async function listWorkitems(request: WorkitemListRequest, signal: AbortSignal): Promise<WorkitemListPage> {
    let selected = categories(request.categories)
    let typeValues: string[] = []
    const conditions = request.conditions
    if (conditions?.some(group => group.some(item => item.field === 'workitemType'))) {
      if (conditions.length !== 1 || conditions[0]!.filter(item => item.field === 'workitemType').length !== 1) invalid('conditions.workitemType')
      const type = conditions[0]!.find(item => item.field === 'workitemType')!
      if ((type.operator ?? 'EQUALS') !== 'EQUALS' || type.toValue != null || !Array.isArray(type.value) || type.value.length < 1 || type.value.length > 50) invalid('conditions.workitemType')
      typeValues = type.value.map(value => identifier(value, 'conditions.workitemType'))
      if (typeValues.some(value => !CATEGORIES.includes(value as TapdCategory) && !/^\d+$/u.test(value))) invalid('conditions.workitemType')
      selected = selected.filter(part => typeValues.includes(part) || (part === 'story' && typeValues.some(value => /^\d+$/u.test(value))))
    }
    const category = selected[0] ?? categories(request.categories)[0]!
    const conditionsFor = (part: TapdCategory): WorkitemConditionGroups | undefined => {
      if (typeValues.length === 0) return conditions
      const rest = conditions![0]!.filter(item => item.field !== 'workitemType')
      const subtypeIds = part === 'story' && !typeValues.includes('story') ? typeValues.filter(value => /^\d+$/u.test(value)) : []
      return rest.length || subtypeIds.length ? [[...rest, ...(subtypeIds.length ? [{ field: 'workitemType', operator: 'EQUALS' as const, value: subtypeIds }] : [])]] : undefined
    }
    const projectId = numericId(request.projectId, 'projectId')
    const page = request.page ?? 1
    const perPage = request.perPage ?? 50
    if (!Number.isSafeInteger(page) || page < 1 || page * perPage > MAX_RESULT_WINDOW) invalid('page')
    if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) invalid('perPage')
    if (request.spaceType !== undefined && request.spaceType !== 'Project') invalid('spaceType')
    const orderFields: Record<string, string> = { gmtCreate: 'created', subject: TAPD_CATEGORY_FIELDS[category].title, status: 'status', priority: 'priority_label', assignedTo: TAPD_CATEGORY_FIELDS[category].owner }
    const order = orderFields[request.orderBy ?? 'gmtCreate']
    if (order === undefined) invalid('orderBy')
    const sort = request.sort ?? 'desc'
    if (sort !== 'asc' && sort !== 'desc') invalid('sort')
    const fields = resolveListFields(request.fields)
    const only = request.customFieldIds === undefined || request.customFieldIds.length === 0 ? null : new Set(request.customFieldIds.map(id => identifier(id, 'customFieldIds')))
    if (selected.length === 0) {
      filters(conditionsFor(category), category)
      return { items: [], page, perPage, total: 0, totalPages: 1, fields, requestCount: 0 }
    }
    if (selected.length > 1) {
      // The three collections have independent page numbers. Read a bounded
      // prefix of each ordered collection, then merge before slicing; merging
      // just page N of each would skip earlier entries in the combined list.
      if ((request.orderBy ?? 'gmtCreate') !== 'gmtCreate') invalid('orderBy')
      const window = page * perPage
      const plans = selected.map(part => ({ part, checked: filters(conditionsFor(part), part) }))
      const merged: { item: Record<string, unknown>; created: string; id: string; category: TapdCategory }[] = []
      let total = 0
      let requestCount = 0
      for (const { part, checked } of plans) {
        const params: Record<string, string> = { workspace_id: projectId }
        for (const filter of checked) params[filter.param] = filter.encoded
        const collection = TAPD_COLLECTION[part]
        const count = decodeFieldMap(await read(`/${collection}/count`, params, signal)).count
        requestCount++
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) fail('count')
        total += count
        if (!Number.isSafeInteger(total)) fail('count')
        const configs = fields.includes('customFields') ? await fieldMap(projectId, part, signal) : {}
        if (fields.includes('customFields')) requestCount++
        const remoteFields = new Set(['id', 'workspace_id', 'created', ...Object.keys(nativeMap(part)), ...checked.map(filter => filter.param)])
        if (fields.includes('customFields')) for (const key of Object.keys(configs)) {
          if (key !== 'description' && FIELD.test(key) && (only === null || only.has(key === 'priority_label' ? 'priority' : key))) remoteFields.add(key)
        }
        const ids = new Set<string>()
        const wanted = Math.min(count, window)
        for (let offset = 0; offset < wanted; offset += MAX_PER_PAGE) {
          const limit = MAX_PER_PAGE
          const rows = decodeCollection(await read(`/${collection}`, {
            ...params, page: String(Math.floor(offset / MAX_PER_PAGE) + 1), limit: String(limit),
            order: `created ${sort}`, fields: [...remoteFields].join(','),
          }, signal), TAPD_WRAPPER[part])
          requestCount++
          if (rows.length !== Math.min(limit, count - offset)) fail('page')
          for (const raw of rows.slice(0, wanted - offset)) {
            const value = row(raw, part, projectId)
            const id = decodeTapdItemId(value)
            if (ids.has(id)) fail('item.id')
            ids.add(id)
            for (const filter of checked) if (!filter.matches(value)) fail(`filters.${filter.param}`)
            merged.push({ item: project(value, part, projectId, fields, configs, only), created: date(value.created, 'created', true), id, category: part })
          }
        }
      }
      merged.sort((a, b) => {
        const compared = a.created < b.created ? -1 : a.created > b.created ? 1 : 0
        if (compared !== 0) return sort === 'asc' ? compared : -compared
        const categoryOrder = selected.indexOf(a.category) - selected.indexOf(b.category)
        if (categoryOrder !== 0) return categoryOrder
        return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      })
      return { items: merged.slice((page - 1) * perPage, window).map(entry => entry.item), page, perPage,
        total, totalPages: Math.max(1, Math.ceil(total / perPage)), fields, requestCount }
    }
    const checkedFilters = filters(conditionsFor(category), category)
    const params: Record<string, string> = { workspace_id: projectId }
    for (const filter of checkedFilters) params[filter.param] = filter.encoded
    const configs = fields.includes('customFields') ? await fieldMap(projectId, category, signal) : {}
    const remoteFields = new Set(['id', 'workspace_id', ...Object.keys(nativeMap(category)), ...checkedFilters.map(filter => filter.param)])
    if (fields.includes('customFields')) for (const key of Object.keys(configs)) {
      if (key !== 'description' && FIELD.test(key) && (only === null || only.has(key === 'priority_label' ? 'priority' : key))) remoteFields.add(key)
    }
    const collection = TAPD_COLLECTION[category]
    const rawItems = decodeCollection(await read(`/${collection}`, { ...params, page: String(page), limit: String(perPage), order: `${order} ${sort}`, fields: [...remoteFields].join(',') }, signal), TAPD_WRAPPER[category])
    if (rawItems.length > perPage) fail('page')
    const ids = new Set<string>()
    const items = rawItems.map(raw => {
      const value = row(raw, category, projectId)
      const id = decodeTapdItemId(value)
      if (ids.has(id)) fail('item.id')
      ids.add(id)
      // An ignored remote parameter must not widen a page. Fail, rather than
      // discarding rows and presenting a misleading partial page/count.
      for (const filter of checkedFilters) if (!filter.matches(value)) fail(`filters.${filter.param}`)
      return project(value, category, projectId, fields, configs, only)
    })
    const count = decodeFieldMap(await read(`/${collection}/count`, params, signal)).count
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) fail('count')
    return { items, page, perPage, total: count, totalPages: Math.max(1, Math.ceil(count / perPage)), fields, requestCount: fields.includes('customFields') ? 3 : 2 }
  }
  async function getWorkitem(request: WorkitemDetailRequest, signal: AbortSignal): Promise<WorkitemDetailResult> {
    const projectId = numericId(request.projectId, 'projectId')
    const id = numericId(request.id, 'id')
    if (request.include?.some(section => section !== 'description') || request.expandRelations === true || request.relationTypes !== undefined) invalid('include')
    const fields = resolveListFields(request.fields)
    let found: { raw: Record<string, unknown>; category: TapdCategory } | null = null
    // The public description DTO has no category. Exact id lookups on all three
    // known collections avoid guessing a category from the id or using a cache.
    for (const category of CATEGORIES) {
      const rows = decodeCollection(await read(`/${TAPD_COLLECTION[category]}`, { workspace_id: projectId, id, limit: '2', fields: ['description', ...Object.keys(nativeMap(category))].join(',') }, signal), TAPD_WRAPPER[category])
      if (rows.length > 1) fail('detail')
      if (rows.length === 0) continue
      const raw = row(rows[0], category, projectId)
      if (raw.id !== id || found !== null) fail('item.id')
      found = { raw, category }
    }
    if (found === null) throw syncRemoteError(syncError('RemoteUnavailable', { scope: 'item', field: 'id' }))
    const source = found.raw.description
    let description: WorkitemDetailResult['description'] = null
    if (source !== undefined && source !== null && source !== '') {
      if (typeof source !== 'string' || source.length > 200_000) fail('description')
      // TAPD carries HTML directly, not Yunxiao's JSON string carrier. Plain
      // bodies (including JSON-looking text) remain plain text.
      if (/<\/?[A-Za-z][^>]*>/u.test(source)) {
        const decoded = decodeDescription({ presence: 'value', value: source, writable: false }, 'richtext')
        description = { format: 'richtext', html: source, plain: contentText(decoded.content), content: decoded.content }
      } else description = { format: 'text', html: null, plain: source, content: textContent(source) }
    }
    return { item: project(found.raw, found.category, projectId, fields, {}, null), description, sectionErrors: [], requestCount: 3 }
  }
  async function listFields(request: WorkitemFieldsRequest, signal: AbortSignal): Promise<WorkitemFieldDefinition[]> {
    const projectId = numericId(request.projectId, 'projectId')
    const selected = categories(request.categories)
    const merged = new Map<string, WorkitemFieldDefinition>()
    for (const category of selected) {
      const configs = await fieldMap(projectId, category, signal)
      const mapping = nativeMap(category)
      for (const [remoteId, config] of Object.entries(configs)) {
        if (!FIELD.test(remoteId) || remoteId.length > 200 || !object(config)) fail('fields')
        if (remoteId === 'description') continue
        const id = mapping[remoteId] ?? (remoteId === 'priority_label' ? 'priority' : remoteId)
        const options = object(config.options) ? Object.entries(config.options).slice(0, 200).map(([key, value]) => ({ id: text(key, 'fields.options.id', 200) ?? fail('fields.options.id'), label: text(value, 'fields.options.label', 100) ?? key })) : []
        const previous = merged.get(id)
        if (previous) {
          const known = new Set(previous.options.map(option => option.id))
          for (const option of options) if (!known.has(option.id) && previous.options.length < 200) { known.add(option.id); previous.options.push(option) }
          previous.required = previous.required || config.required === true || config.required === 1 || config.required === '1'
          continue
        }
        merged.set(id, { id, name: text(config.label, 'fields.label', 100) ?? id, format: text(config.html_type, 'fields.format', 32) ?? '',
          required: config.required === true || config.required === 1 || config.required === '1', kind: mapping[remoteId] === undefined ? 'CustomField' : 'NativeField', options })
      }
    }
    return [...merged.values()]
  }
  return { listWorkitems, getWorkitem, listFields }
}
