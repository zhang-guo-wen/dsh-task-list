import { DOC_KEYS, SYNC_ERRORS, syncError, syncRemoteError } from './errors.ts'
import type {
  ConnectionSecret, CreateConnectionRequest, CreateSyncRuleRequest, DeleteConnectionRequest, DeleteSyncRuleRequest,
  DeleteResult, DocKey, EmptyRequest, GetSyncRunRequest, ListItemResultsRequest, ListOrganizationsRequest,
  ListRunsRequest, ListWorkitemFieldsRequest, ListWorkitemsRequest, MetadataScope, OptionalFieldCandidate, Option,
  OrganizationChoice, Page, SafeConnection, SafeItemCategory, SafeItemResult, SafeRun, SafeRunCounts, SafeRunPhase,
  SafeRunStatus, SafeWorkitemDescriptionResult, SafeWorkitemField, SafeWorkitemPage, SafeWorkitemRow, StartSyncResult,
  SyncErrorCode, SyncErrorDto, SyncErrorScope, SyncMetadata, SyncMethod, SyncRequest, SyncResponse, SyncRule,
  StatusWriteStates, TestConnectionResult, TypeCapabilities, UpdateConnectionRequest, UpdateSyncRuleRequest,
  WorkitemConditionGroups, WorkitemFilterCondition, WorkitemFilterOperator, GetWorkitemDescriptionRequest,
  WorkitemFillField,
} from './dto.ts'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../types.ts'
import type { TaskStatus } from '../types.ts'
import type { RemoteKey, SyncField } from './types.ts'
import { LIST_FIELDS } from './query/fields.ts'
import { CONDITION_FIELDS } from './query/filters.ts'
import { DEFAULT_WORKITEM_FILL_FIELDS, WORKITEM_FILL_FIELDS } from './dto.ts'
import { validateContent } from '../content.ts'
import type { TaskContent } from '../types.ts'

const CONTROL = /[\u0000-\u001f]/u
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])
const ID_LIMIT = 200
const NAME_LIMIT = 100
const ENV_LIMIT = 128
const SUMMARY_LIMIT = 200

const TASK_STATUSES = new Set<TaskStatus>(['todo', 'in_progress', 'done'])
const SYNC_FIELD_NAMES = new Set<SyncField>(['title', 'description', 'status', 'priority', 'tags', 'storyPoints'])
const SCOPES = new Set<SyncErrorScope>(['config', 'connection', 'rule', 'item', 'run', 'query'])
const DOC_KEY_SET = new Set<string>(DOC_KEYS)

function fail(scope: SyncErrorScope, field: string): never {
  throw syncRemoteError(syncError('InvalidConfig', { scope, field }))
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

/** Plain-object + prototype-pollution + JSON-value checks; unknown keys are checked separately. */
function parseObject(scope: SyncErrorScope, value: unknown, field: string): Record<string, unknown> {
  if (!isPlainObject(value)) fail(scope, field)
  const object = value as Record<string, unknown>
  for (const key of Object.keys(object)) {
    if (FORBIDDEN.has(key)) fail(scope, field)
  }
  if (!isJsonValue(object)) fail(scope, field)
  return object
}

function closedKeys(scope: SyncErrorScope, object: Record<string, unknown>, allowed: ReadonlySet<string>, field: string): void {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) fail(scope, field)
  }
}

/** Non-blank, length-bounded, control-free text; `trim=false` preserves the original identity. */
function text(scope: SyncErrorScope, value: unknown, field: string, max: number, trim: boolean): string {
  if (typeof value !== 'string') fail(scope, field)
  const normalized = trim ? value.trim() : value
  if (!normalized.trim() || normalized.length > max || CONTROL.test(normalized)) fail(scope, field)
  return normalized
}

/** A 云效 OAuth connection may be saved before its organization is chosen. */
function organizationIdText(scope: SyncErrorScope, value: unknown, oauth: boolean): string {
  return oauth ? boundedText(scope, value ?? '', 'organizationId', ID_LIMIT) : text(scope, value, 'organizationId', ID_LIMIT, true)
}

/**
 * A stored display label for a remote resource. Absence is `null`, and the
 * owning surface falls back to the id rather than inventing a name.
 */
function optionalProjectName(scope: SyncErrorScope, value: unknown): string | null {
  return value === undefined || value === null ? null : boundedText(scope, value, 'projectName', NAME_LIMIT)
}

/** Length-bounded, control-free text that may be empty (used for summaries). */
function boundedText(scope: SyncErrorScope, value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length > max || CONTROL.test(value)) fail(scope, field)
  return value
}

function envName(scope: SyncErrorScope, value: unknown, field: string): string {
  if (typeof value !== 'string' || !ENV_NAME.test(value) || value.length > ENV_LIMIT) fail(scope, field)
  return value
}

function bool(scope: SyncErrorScope, value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') fail(scope, field)
  return value
}

function int(scope: SyncErrorScope, value: unknown, field: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(scope, field)
  return value as number
}

function finiteNumber(scope: SyncErrorScope, value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) fail(scope, field)
  return value
}

function stringArray(scope: SyncErrorScope, value: unknown, field: string, max: number, per: number): string[] {
  if (!Array.isArray(value) || value.length > max) fail(scope, field)
  return value.map(item => text(scope, item, field, per, true))
}

function arrayOf<T>(scope: SyncErrorScope, value: unknown, field: string, parseItem: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) fail(scope, field)
  return value.map(parseItem)
}

function parseSyncFields(scope: SyncErrorScope, value: unknown): SyncField[] {
  if (!Array.isArray(value)) fail(scope, 'fields')
  const out: SyncField[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !SYNC_FIELD_NAMES.has(item as SyncField)) fail(scope, 'fields')
    const field = item as SyncField
    if (out.includes(field)) fail(scope, 'fields')
    out.push(field)
  }
  return out
}

// --- connections ---

export function parseConnectionAuth(value: unknown): import('./dto.ts').ConnectionAuth {
  const scope: SyncErrorScope = 'connection'
  const auth = parseObject(scope, value, 'authentication')
  if (auth.mode === 'manual') { closedKeys(scope, auth, new Set(['mode']), 'authentication'); return { mode: 'manual' } }
  if (auth.mode !== 'oauth') fail(scope, 'authentication')
  closedKeys(scope, auth, new Set(['mode', 'appId', 'appSecretRef', 'callbackUrl']), 'authentication')
  return { mode: 'oauth',
    ...(auth.appId !== undefined ? { appId: text(scope, auth.appId, 'appId', ID_LIMIT, true) } : {}),
    ...(auth.appSecretRef !== undefined ? { appSecretRef: envName(scope, auth.appSecretRef, 'appSecretRef') } : {}),
    ...(auth.callbackUrl !== undefined ? { callbackUrl: text(scope, auth.callbackUrl, 'callbackUrl', 2048, true) } : {}),
  }
}

const YUNXIAO_CREATE_KEYS = new Set(['platform', 'name', 'mode', 'organizationId', 'regionHost', 'tokenEnv', 'enabled', 'authentication', 'secret'])
const TAPD_CREATE_KEYS = new Set(['platform', 'name', 'companyId', 'tokenEnv', 'enabled', 'authentication', 'secret'])
const UPDATE_CONNECTION_KEYS = new Set(['id', 'revision', 'name', 'enabled', 'mode', 'organizationId', 'regionHost', 'tokenEnv', 'companyId', 'authentication', 'secret'])
/** Upper bounds for one typed credential; a platform token never approaches these. */
const SECRET_LIMIT = 4096

/**
 * Parse a user-typed credential. Values are length-checked and platform-tagged
 * here so the Host never stores a credential for the wrong platform; the value
 * itself is only ever handed to the Host credential store.
 */
function parseConnectionSecret(scope: SyncErrorScope, value: unknown): ConnectionSecret {
  const object = parseObject(scope, value, 'secret')
  closedKeys(scope, object, new Set(['platform', 'token', 'user', 'password']), 'secret')
  const platform = object.platform
  if (platform === 'yunxiao') {
    closedKeys(scope, object, new Set(['platform', 'token']), 'secret')
    return { platform: 'yunxiao', token: text(scope, object.token, 'secret.token', SECRET_LIMIT, false) }
  }
  if (platform === 'tapd') {
    closedKeys(scope, object, new Set(['platform', 'token']), 'secret')
    return { platform: 'tapd', token: text(scope, object.token, 'secret.token', SECRET_LIMIT, false) }
  }
  fail(scope, 'secret.platform')
}

function parseCreateConnection(value: unknown): CreateConnectionRequest {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'createSyncConnection')
  const platform = object.platform
  if (platform !== 'yunxiao' && platform !== 'tapd') fail(scope, 'platform')
  const enabled = object.enabled === undefined ? false : bool(scope, object.enabled, 'enabled')
  const name = text(scope, object.name, 'name', NAME_LIMIT, true)
  if (platform === 'yunxiao') {
    closedKeys(scope, object, YUNXIAO_CREATE_KEYS, 'createSyncConnection')
    let mode: 'center' | 'region'
    if (object.mode === 'center' || object.mode === 'region') mode = object.mode
    else fail(scope, 'mode')
    const organizationId = organizationIdText(scope, object.organizationId, object.authentication !== undefined && parseConnectionAuth(object.authentication).mode === 'oauth')
    const regionHost = mode === 'region'
      ? text(scope, object.regionHost, 'regionHost', ID_LIMIT, true)
      : object.regionHost === undefined || object.regionHost === null ? null : text(scope, object.regionHost, 'regionHost', ID_LIMIT, true)
    const tokenEnv = envName(scope, object.tokenEnv, 'tokenEnv')
    return { platform: 'yunxiao', name, mode, organizationId, regionHost, tokenEnv, enabled, ...(object.authentication !== undefined ? { authentication: parseConnectionAuth(object.authentication) } : {}), ...(object.secret !== undefined ? { secret: parseConnectionSecret(scope, object.secret) } : {}) }
  }
  closedKeys(scope, object, TAPD_CREATE_KEYS, 'createSyncConnection')
  const companyId = text(scope, object.companyId, 'companyId', ID_LIMIT, true)
  const tokenEnv = envName(scope, object.tokenEnv, 'tokenEnv')
  const authentication = object.authentication === undefined ? undefined : parseConnectionAuth(object.authentication)
  // TAPD has exactly one credential: a personal access token typed in the
  // editor. There is no official-authorization path left to configure.
  if (authentication?.mode === 'oauth') fail(scope, 'authentication')
  return { platform: 'tapd', name, companyId, tokenEnv, enabled, ...(authentication !== undefined ? { authentication } : {}), ...(object.secret !== undefined ? { secret: parseConnectionSecret(scope, object.secret) } : {}) }
}

function parseUpdateConnection(value: unknown): UpdateConnectionRequest {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'updateSyncConnection')
  closedKeys(scope, object, UPDATE_CONNECTION_KEYS, 'updateSyncConnection')
  const hasYunxiao = object.mode !== undefined || object.organizationId !== undefined || object.regionHost !== undefined
  const hasTapd = object.companyId !== undefined
  if (hasYunxiao && hasTapd) fail(scope, 'updateSyncConnection')
  const out: UpdateConnectionRequest = {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    revision: int(scope, object.revision, 'revision', 1, Number.MAX_SAFE_INTEGER),
  }
  if (object.authentication !== undefined) out.authentication = parseConnectionAuth(object.authentication)
  if (object.name !== undefined) out.name = text(scope, object.name, 'name', NAME_LIMIT, true)
  if (object.enabled !== undefined) out.enabled = bool(scope, object.enabled, 'enabled')
  if (object.mode !== undefined) {
    if (object.mode !== 'center' && object.mode !== 'region') fail(scope, 'mode')
    out.mode = object.mode
  }
  if (object.organizationId !== undefined) out.organizationId = organizationIdText(scope, object.organizationId, object.authentication !== undefined && parseConnectionAuth(object.authentication).mode === 'oauth')
  if (object.regionHost !== undefined) out.regionHost = object.regionHost === null ? null : text(scope, object.regionHost, 'regionHost', ID_LIMIT, true)
  if (object.tokenEnv !== undefined) out.tokenEnv = envName(scope, object.tokenEnv, 'tokenEnv')
  if (object.companyId !== undefined) out.companyId = text(scope, object.companyId, 'companyId', ID_LIMIT, true)
  if (object.secret !== undefined) out.secret = parseConnectionSecret(scope, object.secret)
  return out
}

function parseDeleteConnection(value: unknown): DeleteConnectionRequest {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'deleteSyncConnection')
  closedKeys(scope, object, new Set(['id', 'revision']), 'deleteSyncConnection')
  return {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    revision: int(scope, object.revision, 'revision', 1, Number.MAX_SAFE_INTEGER),
  }
}

// --- rules ---

const CREATE_RULE_KEYS = new Set(['connectionId', 'projectId', 'projectName', 'workspaceId', 'enabled', 'conditions', 'statusWriteStates'])
const UPDATE_RULE_KEYS = new Set(['id', 'revision', 'projectId', 'projectName', 'workspaceId', 'enabled', 'conditions', 'statusWriteStates'])

/**
 * The rule's three local statuses, each naming the platform status it writes.
 * Every one is required: a rule that cannot map all three is not usable.
 */
function parseStatusWriteStates(scope: SyncErrorScope, value: unknown, allowUnmapped = false): StatusWriteStates {
  const object = parseObject(scope, value, 'statusWriteStates')
  closedKeys(scope, object, new Set(TASK_STATUSES), 'statusWriteStates')
  const out = {} as StatusWriteStates
  for (const status of TASK_STATUSES) out[status] = allowUnmapped
    ? boundedText(scope, object[status], `statusWriteStates.${status}`, ID_LIMIT).trim()
    : text(scope, object[status], `statusWriteStates.${status}`, ID_LIMIT, true)
  return out
}

function parseCreateRule(value: unknown): CreateSyncRuleRequest {
  const scope: SyncErrorScope = 'rule'
  const object = parseObject(scope, value, 'createSyncRule')
  closedKeys(scope, object, CREATE_RULE_KEYS, 'createSyncRule')
  return {
    connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false),
    projectId: text(scope, object.projectId, 'projectId', ID_LIMIT, true),
    projectName: optionalProjectName(scope, object.projectName),
    workspaceId: object.workspaceId === undefined || object.workspaceId === null ? null : text(scope, object.workspaceId, 'workspaceId', ID_LIMIT, true),
    enabled: object.enabled === undefined ? false : bool(scope, object.enabled, 'enabled'),
    conditions: parseWorkitemConditions(scope, object.conditions ?? []),
    statusWriteStates: parseStatusWriteStates(scope, object.statusWriteStates),
  }
}

function parseUpdateRule(value: unknown): UpdateSyncRuleRequest {
  const scope: SyncErrorScope = 'rule'
  const object = parseObject(scope, value, 'updateSyncRule')
  closedKeys(scope, object, UPDATE_RULE_KEYS, 'updateSyncRule')
  const out: UpdateSyncRuleRequest = {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    revision: int(scope, object.revision, 'revision', 1, Number.MAX_SAFE_INTEGER),
  }
  if (object.projectId !== undefined) out.projectId = text(scope, object.projectId, 'projectId', ID_LIMIT, true)
  if (object.projectName !== undefined) out.projectName = optionalProjectName(scope, object.projectName)
  if (object.workspaceId !== undefined) out.workspaceId = object.workspaceId === null ? null : text(scope, object.workspaceId, 'workspaceId', ID_LIMIT, true)
  if (object.enabled !== undefined) out.enabled = bool(scope, object.enabled, 'enabled')
  if (object.conditions !== undefined) out.conditions = parseWorkitemConditions(scope, object.conditions)
  if (object.statusWriteStates !== undefined) out.statusWriteStates = parseStatusWriteStates(scope, object.statusWriteStates)
  return out
}

function parseDeleteRule(value: unknown): DeleteSyncRuleRequest {
  const scope: SyncErrorScope = 'rule'
  const object = parseObject(scope, value, 'deleteSyncRule')
  closedKeys(scope, object, new Set(['id', 'revision']), 'deleteSyncRule')
  return {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    revision: int(scope, object.revision, 'revision', 1, Number.MAX_SAFE_INTEGER),
  }
}

// --- metadata / runs ---

const METADATA_KEYS = new Set(['connectionId', 'projectId', 'typeId'])

function parseMetadataScope(value: unknown, method: SyncMethod): MetadataScope {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, method)
  closedKeys(scope, object, METADATA_KEYS, method)
  const out: MetadataScope = { connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false) }
  if (object.projectId !== undefined) out.projectId = text(scope, object.projectId, 'projectId', ID_LIMIT, true)
  if (object.typeId !== undefined) out.typeId = text(scope, object.typeId, 'typeId', ID_LIMIT, true)
  return out
}

function parseGetSyncRun(value: unknown): GetSyncRunRequest {
  const scope: SyncErrorScope = 'run'
  const object = parseObject(scope, value, 'getSyncRun')
  closedKeys(scope, object, new Set(['id']), 'getSyncRun')
  return { id: text(scope, object.id, 'id', ID_LIMIT, false) }
}

function parseListRuns(value: unknown): ListRunsRequest {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'listSyncRuns')
  closedKeys(scope, object, new Set(['page', 'pageSize']), 'listSyncRuns')
  return {
    page: object.page === undefined ? 1 : int(scope, object.page, 'page', 1, Number.MAX_SAFE_INTEGER),
    pageSize: object.pageSize === undefined ? DEFAULT_PAGE_SIZE : int(scope, object.pageSize, 'pageSize', 1, MAX_PAGE_SIZE),
  }
}

function parseListItemResults(value: unknown): ListItemResultsRequest {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'listSyncItemResults')
  closedKeys(scope, object, new Set(['id', 'page', 'pageSize']), 'listSyncItemResults')
  return {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    page: object.page === undefined ? 1 : int(scope, object.page, 'page', 1, Number.MAX_SAFE_INTEGER),
    pageSize: object.pageSize === undefined ? DEFAULT_PAGE_SIZE : int(scope, object.pageSize, 'pageSize', 1, MAX_PAGE_SIZE),
  }
}

function parseEmpty(scope: SyncErrorScope, value: unknown, method: SyncMethod): EmptyRequest {
  const object = parseObject(scope, value, method)
  closedKeys(scope, object, new Set<string>(), method)
  return {}
}

/** List the organizations a token can see; the token is transient and never stored by this call. */
function parseListOrganizations(value: unknown): ListOrganizationsRequest {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'listSyncOrganizations')
  closedKeys(scope, object, new Set(['token', 'connectionId', 'platform']), 'listSyncOrganizations')
  if (object.token === undefined && object.connectionId === undefined) fail(scope, 'token')
  if (object.platform !== undefined && object.platform !== 'yunxiao' && object.platform !== 'tapd') fail(scope, 'platform')
  return {
    ...(object.token !== undefined ? { token: text(scope, object.token, 'token', SECRET_LIMIT, false) } : {}),
    ...(object.connectionId !== undefined ? { connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false) } : {}),
    ...(object.platform !== undefined ? { platform: object.platform as 'yunxiao' | 'tapd' } : {}),
  }
}

/** One organization row of the closed `listSyncOrganizations` result. */
function parseOrganizationChoice(value: unknown): OrganizationChoice {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'organization')
  closedKeys(scope, object, new Set(['id', 'name']), 'organization')
  return { id: text(scope, object.id, 'organization.id', ID_LIMIT, false), name: text(scope, object.name, 'organization.name', NAME_LIMIT, true) }
}

// --- read-only work-item queries ---

const WORKITEM_FIELDS = new Set<string>(LIST_FIELDS)
const ORDER_FIELDS = new Set(['gmtCreate', 'subject', 'status', 'priority', 'assignedTo'])
const CATEGORIES = /^[A-Za-z]+(?:,[A-Za-z]+)*$/u
/**
 * The verified field/operator matrix, imported from the platform request builder
 * so a rule query and the wire request can never disagree about which operator a
 * field accepts.
 */
const CONDITION_SPECS = new Map(CONDITION_FIELDS.map(spec => [spec.field as string, spec] as const))
const FILTER_FIELDS = new Set(CONDITION_SPECS.keys())
const DATETIME = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/u
const MAX_CONDITION_GROUPS = 10
const MAX_CONDITIONS_PER_GROUP = 20
const MAX_FILTER_VALUES = 50
const FILTER_VALUE_LIMIT = 200
const MAX_PER_PAGE = 200
const MAX_RESULT_WINDOW = 10_000
const FIELD_NAME_LIMIT = 100
const FIELD_FORMAT_LIMIT = 32
const MAX_FIELD_OPTIONS = 200
/** A work item body can be long; the transport already caps a response at 2 MiB. */
const CONTENT_LIMIT = 200_000

/**
 * One filter object; the field/operator pair is checked against the verified
 * matrix, so a query the platform would silently ignore never reaches a rule.
 * The matrix lives with the platform request builder, so both sides agree.
 */
function parseWorkitemCondition(scope: SyncErrorScope, value: unknown): WorkitemFilterCondition {
  const object = parseObject(scope, value, 'conditions')
  closedKeys(scope, object, new Set(['field', 'operator', 'value', 'toValue']), 'conditions')
  const field = text(scope, object.field, 'conditions.field', 32, true)
  if (!FILTER_FIELDS.has(field)) fail(scope, 'conditions.field')
  const spec = CONDITION_SPECS.get(field)!
  const operator = object.operator === undefined ? spec.operators[0]! : text(scope, object.operator, 'conditions.operator', 16, true)
  if (!spec.operators.includes(operator as WorkitemFilterOperator)) fail(scope, 'conditions.operator')
  const values = stringArray(scope, object.value, 'conditions.value', MAX_FILTER_VALUES, FILTER_VALUE_LIMIT)
  // An empty value set describes no condition at all; the platform would ignore
  // it, so it is refused here rather than silently widening the query.
  if (values.length === 0) fail(scope, 'conditions.value')
  const out: WorkitemFilterCondition = { field, operator: operator as WorkitemFilterOperator, value: values }
  if (object.toValue !== undefined && object.toValue !== null) {
    const to = text(scope, object.toValue, 'conditions.toValue', FILTER_VALUE_LIMIT, true)
    if (!DATETIME.test(to)) fail(scope, 'conditions.toValue')
    out.toValue = to
  }
  if (operator === 'BETWEEN') {
    if (values.length !== 1 || !DATETIME.test(values[0]!) || out.toValue === undefined) fail(scope, 'conditions.value')
  }
  return out
}

function parseWorkitemConditions(scope: SyncErrorScope, value: unknown): WorkitemConditionGroups {
  if (!Array.isArray(value) || value.length > MAX_CONDITION_GROUPS) fail(scope, 'conditions')
  return value.map(group => {
    if (!Array.isArray(group) || group.length > MAX_CONDITIONS_PER_GROUP) fail(scope, 'conditions')
    return group.map(condition => parseWorkitemCondition(scope, condition))
  })
}

function parseListWorkitems(value: unknown): ListWorkitemsRequest {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'listWorkitems')
  closedKeys(scope, object, new Set([
    'connectionId', 'projectId', 'categories', 'page', 'perPage', 'fields', 'customFieldIds', 'orderBy', 'sort', 'conditions',
  ]), 'listWorkitems')
  const categories = text(scope, object.categories, 'categories', NAME_LIMIT, true)
  if (!CATEGORIES.test(categories) || categories.split(',').some(part => part.trim() === '')) fail(scope, 'categories')
  const page = object.page === undefined ? 1 : int(scope, object.page, 'page', 1, Number.MAX_SAFE_INTEGER)
  const perPage = object.perPage === undefined ? 50 : int(scope, object.perPage, 'perPage', 1, MAX_PER_PAGE)
  // The service refuses a window it knows the platform rejects, before any request.
  if (page * perPage > MAX_RESULT_WINDOW) fail(scope, 'page')
  const orderBy = object.orderBy === undefined ? 'gmtCreate' : text(scope, object.orderBy, 'orderBy', 32, true)
  if (!ORDER_FIELDS.has(orderBy)) fail(scope, 'orderBy')
  const sort = object.sort === undefined ? 'desc' : text(scope, object.sort, 'sort', 8, true)
  if (sort !== 'asc' && sort !== 'desc') fail(scope, 'sort')
  const fields = object.fields === undefined ? ['*'] : stringArray(scope, object.fields, 'fields', LIST_FIELDS.length, 32)
  for (const field of fields) if (field !== '*' && !WORKITEM_FIELDS.has(field)) fail(scope, 'fields')
  return {
    connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false),
    projectId: text(scope, object.projectId, 'projectId', ID_LIMIT, true),
    categories,
    page,
    perPage,
    fields,
    customFieldIds: object.customFieldIds === undefined ? [] : stringArray(scope, object.customFieldIds, 'customFieldIds', 100, ID_LIMIT),
    orderBy: orderBy as ListWorkitemsRequest['orderBy'],
    sort,
    ...(object.conditions === undefined ? {} : { conditions: parseWorkitemConditions(scope, object.conditions) }),
  }
}

/** One projected row: only the supported fields, each a bounded JSON value. */
function parseWorkitemRow(value: unknown): SafeWorkitemRow {
  const scope: SyncErrorScope = 'item'
  const object = parseObject(scope, value, 'workitem')
  closedKeys(scope, object, WORKITEM_FIELDS, 'workitem')
  if (!isJsonValue(object)) fail(scope, 'workitem')
  return object
}

function parseWorkitemPage(value: unknown): SafeWorkitemPage {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'listWorkitems')
  closedKeys(scope, object, new Set(['items', 'page', 'perPage', 'total', 'totalPages', 'fields']), 'listWorkitems')
  return {
    items: object.items === undefined ? [] : arrayOf(scope, object.items, 'listWorkitems.items', parseWorkitemRow),
    page: int(scope, object.page, 'listWorkitems.page', 1, Number.MAX_SAFE_INTEGER),
    perPage: int(scope, object.perPage, 'listWorkitems.perPage', 1, MAX_PER_PAGE),
    total: object.total === null || object.total === undefined ? null : int(scope, object.total, 'listWorkitems.total', 0, Number.MAX_SAFE_INTEGER),
    totalPages: object.totalPages === null || object.totalPages === undefined ? null : int(scope, object.totalPages, 'listWorkitems.totalPages', 0, Number.MAX_SAFE_INTEGER),
    fields: object.fields === undefined ? [] : stringArray(scope, object.fields, 'listWorkitems.fields', LIST_FIELDS.length, 32),
  }
}

/** List the selectable fields of one or more project categories (native + custom). */
function parseListWorkitemFields(value: unknown): ListWorkitemFieldsRequest {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'listWorkitemFields')
  closedKeys(scope, object, new Set(['connectionId', 'projectId', 'categories']), 'listWorkitemFields')
  const categories = text(scope, object.categories, 'categories', NAME_LIMIT, true)
  if (!CATEGORIES.test(categories) || categories.split(',').some(part => part.trim() === '')) fail(scope, 'categories')
  return {
    connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false),
    projectId: text(scope, object.projectId, 'projectId', ID_LIMIT, true),
    categories,
  }
}

/** One field definition row; options stay bounded so a picker cannot be flooded. */
function parseWorkitemField(value: unknown): SafeWorkitemField {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'workitemField')
  closedKeys(scope, object, new Set(['id', 'name', 'format', 'required', 'kind', 'options']), 'workitemField')
  return {
    id: text(scope, object.id, 'workitemField.id', ID_LIMIT, true),
    name: text(scope, object.name, 'workitemField.name', FIELD_NAME_LIMIT, true),
    format: boundedText(scope, object.format ?? '', 'workitemField.format', FIELD_FORMAT_LIMIT),
    required: bool(scope, object.required, 'workitemField.required'),
    kind: boundedText(scope, object.kind ?? '', 'workitemField.kind', FIELD_FORMAT_LIMIT),
    options: object.options === undefined || object.options === null
      ? []
      : arrayOf(scope, Array.isArray(object.options) ? object.options.slice(0, MAX_FIELD_OPTIONS) : object.options, 'workitemField.options', parseWorkitemFieldOption),
  }
}

function parseWorkitemFieldOption(value: unknown): { id: string; label: string } {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'workitemFieldOption')
  closedKeys(scope, object, new Set(['id', 'label']), 'workitemFieldOption')
  return {
    id: text(scope, object.id, 'workitemFieldOption.id', ID_LIMIT, true),
    label: boundedText(scope, object.label, 'workitemFieldOption.label', FIELD_NAME_LIMIT),
  }
}

/** Read one work item's body; this is the only surface that carries it. */
function parseGetWorkitemDescription(value: unknown): GetWorkitemDescriptionRequest {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'getWorkitemDescription')
  closedKeys(scope, object, new Set(['connectionId', 'projectId', 'id']), 'getWorkitemDescription')
  return {
    connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false),
    projectId: text(scope, object.projectId, 'projectId', ID_LIMIT, true),
    id: text(scope, object.id, 'id', ID_LIMIT, true),
  }
}

function parseWorkitemDescriptionResult(value: unknown): SafeWorkitemDescriptionResult {
  const scope: SyncErrorScope = 'query'
  const object = parseObject(scope, value, 'getWorkitemDescription')
  closedKeys(scope, object, new Set(['description']), 'getWorkitemDescription')
  if (object.description === null || object.description === undefined) return { description: null }
  const description = parseObject(scope, object.description, 'description')
  closedKeys(scope, description, new Set(['format', 'html', 'plain', 'content']), 'description')
  const format = text(scope, description.format, 'description.format', 16, true)
  if (format !== 'richtext' && format !== 'markdown' && format !== 'text') fail(scope, 'description.format')
  return {
    description: {
      format,
      html: description.html === null || description.html === undefined ? null : boundedText(scope, description.html, 'description.html', CONTENT_LIMIT),
      plain: boundedText(scope, description.plain, 'description.plain', CONTENT_LIMIT),
      content: description.content === undefined || description.content === null ? null : parseWorkitemContent(description.content),
    },
  }
}

/**
 * The decoded body, validated with the same closed content validator the task
 * store uses — remote HTML never crosses the wire, only this explicit vocabulary.
 */
function parseWorkitemContent(value: unknown): TaskContent {
  const scope: SyncErrorScope = 'item'
  const object = parseObject(scope, value, 'content')
  if (!isJsonValue(object)) fail(scope, 'content')
  try {
    return validateContent(object)
  } catch {
    return fail(scope, 'content')
  }
}

/** Parse and validate one wire request into its method-discriminated closed schema. */
export function parseSyncRequest(method: SyncMethod, value: unknown): SyncRequest {
  switch (method) {
    case 'listSyncConnections': return { method, request: parseEmpty('connection', value, method) }
    case 'createSyncConnection': return { method, request: parseCreateConnection(value) }
    case 'updateSyncConnection': return { method, request: parseUpdateConnection(value) }
    case 'deleteSyncConnection': return { method, request: parseDeleteConnection(value) }
    case 'listSyncRules': return { method, request: parseEmpty('rule', value, method) }
    case 'createSyncRule': return { method, request: parseCreateRule(value) }
    case 'updateSyncRule': return { method, request: parseUpdateRule(value) }
    case 'deleteSyncRule': return { method, request: parseDeleteRule(value) }
    case 'getSyncMetadata': return { method, request: parseMetadataScope(value, method) }
    case 'testSyncConnection': return { method, request: parseMetadataScope(value, method) }
    case 'startSync': return { method, request: parseEmpty('run', value, method) }
    case 'getSyncRun': return { method, request: parseGetSyncRun(value) }
    case 'listSyncRuns': return { method, request: parseListRuns(value) }
    case 'listSyncItemResults': return { method, request: parseListItemResults(value) }
    case 'listSyncOrganizations': return { method, request: parseListOrganizations(value) }
    case 'listWorkitems': return { method, request: parseListWorkitems(value) }
    case 'listWorkitemFields': return { method, request: parseListWorkitemFields(value) }
    case 'getWorkitemDescription': return { method, request: parseGetWorkitemDescription(value) }
    default: return fail('config', 'method')
  }
}

// --- safe response validators ---

const ERROR_OUTPUT_KEYS = new Set(['code', 'scope', 'field', 'problem', 'cause', 'causePossible', 'action', 'docKey', 'retryable', 'runId', 'requestId'])
const REMOTE_KEY_KEYS = new Set(['instance', 'projectId', 'typeId', 'id'])
const RUN_STATUSES = new Set(['running', 'completed', 'partial', 'failed', 'interrupted'])
const RUN_PHASES = new Set(['discovering', 'processing', 'waiting', 'finished'])
const ITEM_CATEGORIES = new Set(['imported', 'pulled', 'pushed', 'merged', 'unchanged', 'failed'])

export function parseSyncErrorDto(value: unknown, scope: SyncErrorScope = 'item'): SyncErrorDto {
  const object = parseObject(scope, value, 'error')
  closedKeys(scope, object, ERROR_OUTPUT_KEYS, 'error')
  const code = object.code
  if (typeof code !== 'string' || !(code in SYNC_ERRORS)) fail(scope, 'error.code')
  const errorScope = object.scope
  if (typeof errorScope !== 'string' || !SCOPES.has(errorScope as SyncErrorScope)) fail(scope, 'error.scope')
  const docKey = object.docKey
  if (typeof docKey !== 'string' || !DOC_KEY_SET.has(docKey)) fail(scope, 'error.docKey')
  const out: SyncErrorDto = {
    code: code as SyncErrorCode,
    scope: errorScope as SyncErrorScope,
    problem: text(scope, object.problem, 'error.problem', ID_LIMIT, true),
    cause: text(scope, object.cause, 'error.cause', ID_LIMIT, true),
    action: text(scope, object.action, 'error.action', ID_LIMIT, true),
    docKey: docKey as DocKey,
    retryable: bool(scope, object.retryable, 'error.retryable'),
  }
  if (object.field !== undefined) out.field = text(scope, object.field, 'error.field', ID_LIMIT, false)
  if (object.causePossible !== undefined) out.causePossible = bool(scope, object.causePossible, 'error.causePossible')
  if (object.runId !== undefined) out.runId = text(scope, object.runId, 'error.runId', ID_LIMIT, false)
  if (object.requestId !== undefined) out.requestId = text(scope, object.requestId, 'error.requestId', ID_LIMIT, false)
  return out
}

function parseRemoteKey(value: unknown): RemoteKey {
  const scope: SyncErrorScope = 'item'
  const object = parseObject(scope, value, 'key')
  closedKeys(scope, object, REMOTE_KEY_KEYS, 'key')
  return {
    instance: text(scope, object.instance, 'key.instance', ID_LIMIT, false),
    projectId: text(scope, object.projectId, 'key.projectId', ID_LIMIT, false),
    typeId: text(scope, object.typeId, 'key.typeId', ID_LIMIT, false),
    id: text(scope, object.id, 'key.id', ID_LIMIT, false),
  }
}

const CONNECTION_BASE_KEYS = ['id', 'name', 'enabled', 'revision', 'credentialPresent', 'instance', 'platform', 'authentication', 'fillFields']
const YUNXIAO_OUTPUT_KEYS = new Set([...CONNECTION_BASE_KEYS, 'mode', 'organizationId', 'regionHost', 'tokenEnv'])
const TAPD_OUTPUT_KEYS = new Set([...CONNECTION_BASE_KEYS, 'companyId', 'tokenEnv'])

/**
 * The per-connection prefill selection: known ids only, at most one of each.
 * An absent key means "use the default set" rather than "clear everything".
 */
function parseFillFields(value: unknown): WorkitemFillField[] {
  const scope: SyncErrorScope = 'connection'
  const known = new Set<string>(WORKITEM_FILL_FIELDS)
  const fields = stringArray(scope, value, 'fillFields', WORKITEM_FILL_FIELDS.length, 32)
  for (const field of fields) if (!known.has(field)) fail(scope, 'fillFields')
  return [...new Set(fields)] as WorkitemFillField[]
}

function parseSafeConnection(value: unknown): SafeConnection {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'connection')
  const platform = object.platform
  if (platform !== 'yunxiao' && platform !== 'tapd') fail(scope, 'connection.platform')
  const base = {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    name: text(scope, object.name, 'name', NAME_LIMIT, true),
    enabled: bool(scope, object.enabled, 'enabled'),
    revision: int(scope, object.revision, 'revision', 0, Number.MAX_SAFE_INTEGER),
    ...(object.authentication !== undefined ? { authentication: parseConnectionAuth(object.authentication) } : {}),
    fillFields: object.fillFields === undefined ? [...DEFAULT_WORKITEM_FILL_FIELDS] : parseFillFields(object.fillFields),
    credentialPresent: bool(scope, object.credentialPresent, 'credentialPresent'),
    instance: text(scope, object.instance, 'instance', ID_LIMIT, true),
  }
  if (platform === 'yunxiao') {
    closedKeys(scope, object, YUNXIAO_OUTPUT_KEYS, 'connection')
    const mode = object.mode
    if (mode !== 'center' && mode !== 'region') fail(scope, 'connection.mode')
    return {
      ...base, platform: 'yunxiao', mode,
      /* An OAuth connection is readable before its organization is chosen. */
      organizationId: boundedText(scope, object.organizationId, 'organizationId', ID_LIMIT),
      regionHost: object.regionHost === null ? null : text(scope, object.regionHost, 'regionHost', ID_LIMIT, true),
      tokenEnv: envName(scope, object.tokenEnv, 'tokenEnv'),
    }
  }
  closedKeys(scope, object, TAPD_OUTPUT_KEYS, 'connection')
  return {
    ...base, platform: 'tapd',
    companyId: text(scope, object.companyId, 'companyId', ID_LIMIT, true),
    tokenEnv: envName(scope, object.tokenEnv, 'tokenEnv'),
  }
}

const RULE_OUTPUT_KEYS = new Set(['id', 'revision', 'connectionId', 'projectId', 'projectName', 'enabled', 'workspaceId', 'conditions', 'statusWriteStates'])

function parseSyncRule(value: unknown): SyncRule {
  const scope: SyncErrorScope = 'rule'
  const object = parseObject(scope, value, 'rule')
  closedKeys(scope, object, RULE_OUTPUT_KEYS, 'rule')
  return {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    revision: int(scope, object.revision, 'revision', 0, Number.MAX_SAFE_INTEGER),
    connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false),
    projectId: text(scope, object.projectId, 'projectId', ID_LIMIT, true),
    projectName: optionalProjectName(scope, object.projectName),
    enabled: bool(scope, object.enabled, 'enabled'),
    workspaceId: object.workspaceId === null ? null : text(scope, object.workspaceId, 'workspaceId', ID_LIMIT, true),
    conditions: parseWorkitemConditions(scope, object.conditions),
    statusWriteStates: parseStatusWriteStates(scope, object.statusWriteStates, object.enabled === false),
  }
}

const OPTION_KEYS = new Set(['id', 'label'])

function parseOption(scope: SyncErrorScope, value: unknown): Option {
  const object = parseObject(scope, value, 'option')
  closedKeys(scope, object, OPTION_KEYS, 'option')
  return {
    id: text(scope, object.id, 'option.id', ID_LIMIT, false),
    label: text(scope, object.label, 'option.label', NAME_LIMIT, true),
  }
}

function parseOptions(scope: SyncErrorScope, value: unknown, field: string): Option[] {
  return arrayOf(scope, value, field, item => parseOption(scope, item))
}

const REPRESENTATION_KEYS = new Set(['format', 'roundTrip', 'unsupported'])
const PAGING_KEYS = new Set(['kind', 'unsupported'])
const WORKFLOW_KEYS = new Set(['readOnly', 'unsupported'])

function parseRepresentation(scope: SyncErrorScope, value: unknown): TypeCapabilities['representation'] {
  const object = parseObject(scope, value, 'representation')
  closedKeys(scope, object, REPRESENTATION_KEYS, 'representation')
  if ('unsupported' in object) {
    if (Object.keys(object).length !== 1) fail(scope, 'representation')
    return { unsupported: text(scope, object.unsupported, 'representation.unsupported', ID_LIMIT, true) }
  }
  const format = object.format
  if (format !== 'text' && format !== 'markdown' && format !== 'richtext') fail(scope, 'representation.format')
  return { format, roundTrip: bool(scope, object.roundTrip, 'representation.roundTrip') }
}

function parsePaging(scope: SyncErrorScope, value: unknown): TypeCapabilities['paging'] {
  const object = parseObject(scope, value, 'paging')
  closedKeys(scope, object, PAGING_KEYS, 'paging')
  if ('unsupported' in object) {
    if (Object.keys(object).length !== 1) fail(scope, 'paging')
    return { unsupported: text(scope, object.unsupported, 'paging.unsupported', ID_LIMIT, true) }
  }
  const kind = object.kind
  if (kind !== 'page' && kind !== 'cursor') fail(scope, 'paging.kind')
  return { kind }
}

function parseWorkflow(scope: SyncErrorScope, value: unknown): TypeCapabilities['workflow'] {
  const object = parseObject(scope, value, 'workflow')
  closedKeys(scope, object, WORKFLOW_KEYS, 'workflow')
  if ('unsupported' in object) {
    if (Object.keys(object).length !== 1) fail(scope, 'workflow')
    return { unsupported: text(scope, object.unsupported, 'workflow.unsupported', ID_LIMIT, true) }
  }
  return { readOnly: bool(scope, object.readOnly, 'workflow.readOnly') }
}

const TYPE_CAPABILITIES_KEYS = new Set(['typeId', 'fields', 'readStates', 'writeStates', 'representation', 'paging', 'workflow', 'candidateFields'])

const CANDIDATE_FIELD_KEYS = new Set(['field', 'remoteId', 'format', 'writable'])
const OPTIONAL_FIELD_NAMES = new Set(['priority', 'tags', 'storyPoints'])

function parseCandidateField(scope: SyncErrorScope, value: unknown): OptionalFieldCandidate {
  const object = parseObject(scope, value, 'candidateFields')
  closedKeys(scope, object, CANDIDATE_FIELD_KEYS, 'candidateFields')
  const field = object.field
  if (typeof field !== 'string' || !OPTIONAL_FIELD_NAMES.has(field)) fail(scope, 'candidateFields.field')
  return {
    field: field as OptionalFieldCandidate['field'],
    remoteId: text(scope, object.remoteId, 'candidateFields.remoteId', ID_LIMIT, true),
    format: text(scope, object.format, 'candidateFields.format', ID_LIMIT, true),
    writable: bool(scope, object.writable, 'candidateFields.writable'),
  }
}

function parseCandidateFields(scope: SyncErrorScope, value: unknown): OptionalFieldCandidate[] {
  if (value === undefined) return []
  return arrayOf(scope, value, 'candidateFields', item => parseCandidateField(scope, item))
}

function parseTypeCapabilities(scope: SyncErrorScope, value: unknown): TypeCapabilities {
  const object = parseObject(scope, value, 'typeCapabilities')
  closedKeys(scope, object, TYPE_CAPABILITIES_KEYS, 'typeCapabilities')
  return {
    typeId: text(scope, object.typeId, 'typeId', ID_LIMIT, false),
    fields: parseSyncFields(scope, object.fields),
    readStates: parseOptions(scope, object.readStates, 'readStates'),
    writeStates: parseOptions(scope, object.writeStates, 'writeStates'),
    representation: parseRepresentation(scope, object.representation),
    paging: parsePaging(scope, object.paging),
    workflow: parseWorkflow(scope, object.workflow),
    candidateFields: parseCandidateFields(scope, object.candidateFields),
  }
}

const METADATA_OUTPUT_KEYS = new Set(['connectionId', 'credentialPresent', 'readOnly', 'projects', 'members', 'iterations', 'types', 'typeCapabilities'])

function parseSyncMetadata(value: unknown): SyncMetadata {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'metadata')
  closedKeys(scope, object, METADATA_OUTPUT_KEYS, 'metadata')
  return {
    connectionId: text(scope, object.connectionId, 'connectionId', ID_LIMIT, false),
    credentialPresent: bool(scope, object.credentialPresent, 'credentialPresent'),
    readOnly: bool(scope, object.readOnly, 'readOnly'),
    projects: parseOptions(scope, object.projects, 'projects'),
    members: parseOptions(scope, object.members, 'members'),
    iterations: parseOptions(scope, object.iterations, 'iterations'),
    types: parseOptions(scope, object.types, 'types'),
    typeCapabilities: arrayOf(scope, object.typeCapabilities, 'typeCapabilities', item => parseTypeCapabilities(scope, item)),
  }
}

const COUNTS_KEYS = new Set(['imported', 'pulled', 'pushed', 'merged', 'unchanged', 'failed', 'pending'])

function parseSafeRunCounts(value: unknown): SafeRunCounts {
  const scope: SyncErrorScope = 'run'
  const object = parseObject(scope, value, 'counts')
  closedKeys(scope, object, COUNTS_KEYS, 'counts')
  const counts: SafeRunCounts = {
    imported: int(scope, object.imported, 'counts.imported', 0, Number.MAX_SAFE_INTEGER),
    pulled: int(scope, object.pulled, 'counts.pulled', 0, Number.MAX_SAFE_INTEGER),
    pushed: int(scope, object.pushed, 'counts.pushed', 0, Number.MAX_SAFE_INTEGER),
    merged: int(scope, object.merged, 'counts.merged', 0, Number.MAX_SAFE_INTEGER),
    unchanged: int(scope, object.unchanged, 'counts.unchanged', 0, Number.MAX_SAFE_INTEGER),
    failed: int(scope, object.failed, 'counts.failed', 0, Number.MAX_SAFE_INTEGER),
    pending: int(scope, object.pending, 'counts.pending', 0, Number.MAX_SAFE_INTEGER),
  }
  if (counts.pending > counts.failed) fail(scope, 'counts.pending')
  return counts
}

const SAFE_RUN_KEYS = new Set(['id', 'status', 'phase', 'startedAt', 'finishedAt', 'counts', 'unprocessedKnown', 'discoveryComplete', 'scopeSummary', 'errors'])

function parseSafeRun(value: unknown): SafeRun {
  const scope: SyncErrorScope = 'run'
  const object = parseObject(scope, value, 'run')
  closedKeys(scope, object, SAFE_RUN_KEYS, 'run')
  const status = object.status
  if (typeof status !== 'string' || !RUN_STATUSES.has(status)) fail(scope, 'run.status')
  const phase = object.phase
  if (typeof phase !== 'string' || !RUN_PHASES.has(phase)) fail(scope, 'run.phase')
  return {
    id: text(scope, object.id, 'id', ID_LIMIT, false),
    status: status as SafeRunStatus,
    phase: phase as SafeRunPhase,
    startedAt: finiteNumber(scope, object.startedAt, 'startedAt', 0),
    finishedAt: object.finishedAt === null ? null : finiteNumber(scope, object.finishedAt, 'finishedAt', 0),
    counts: parseSafeRunCounts(object.counts),
    unprocessedKnown: object.unprocessedKnown === null ? null : int(scope, object.unprocessedKnown, 'unprocessedKnown', 0, Number.MAX_SAFE_INTEGER),
    discoveryComplete: bool(scope, object.discoveryComplete, 'discoveryComplete'),
    scopeSummary: boundedText(scope, object.scopeSummary, 'scopeSummary', SUMMARY_LIMIT),
    errors: arrayOf(scope, object.errors, 'errors', item => parseSyncErrorDto(item, 'run')),
  }
}

const SAFE_ITEM_RESULT_KEYS = new Set(['key', 'taskId', 'category', 'changedFields', 'discardedFields', 'writtenBack', 'outsideFilter', 'error'])

function parseSafeItemResult(value: unknown): SafeItemResult {
  const scope: SyncErrorScope = 'item'
  const object = parseObject(scope, value, 'result')
  closedKeys(scope, object, SAFE_ITEM_RESULT_KEYS, 'result')
  const category = object.category
  if (typeof category !== 'string' || !ITEM_CATEGORIES.has(category)) fail(scope, 'result.category')
  return {
    key: parseRemoteKey(object.key),
    taskId: object.taskId === null ? null : text(scope, object.taskId, 'taskId', ID_LIMIT, false),
    category: category as SafeItemCategory,
    changedFields: parseSyncFields(scope, object.changedFields),
    discardedFields: parseSyncFields(scope, object.discardedFields),
    writtenBack: bool(scope, object.writtenBack, 'writtenBack'),
    outsideFilter: bool(scope, object.outsideFilter, 'outsideFilter'),
    error: object.error === null ? null : parseSyncErrorDto(object.error, 'item'),
  }
}

function parseDeleteResult(value: unknown): DeleteResult {
  const scope: SyncErrorScope = 'rule'
  const object = parseObject(scope, value, 'delete')
  closedKeys(scope, object, new Set(['deleted']), 'delete')
  if (object.deleted !== true) fail(scope, 'delete.deleted')
  return { deleted: true }
}

function parseStartSyncResult(value: unknown): StartSyncResult {
  const scope: SyncErrorScope = 'run'
  const object = parseObject(scope, value, 'start')
  closedKeys(scope, object, new Set(['runId', 'existing']), 'start')
  return { runId: text(scope, object.runId, 'runId', ID_LIMIT, false), existing: bool(scope, object.existing, 'existing') }
}

function parseTestConnectionResult(value: unknown): TestConnectionResult {
  const scope: SyncErrorScope = 'connection'
  const object = parseObject(scope, value, 'test')
  if (object.ok === true) {
    closedKeys(scope, object, new Set(['ok', 'credentialPresent', 'readOnly']), 'test')
    return { ok: true, credentialPresent: bool(scope, object.credentialPresent, 'credentialPresent'), readOnly: bool(scope, object.readOnly, 'readOnly') }
  }
  if (object.ok === false) {
    closedKeys(scope, object, new Set(['ok', 'credentialPresent', 'error']), 'test')
    return { ok: false, credentialPresent: bool(scope, object.credentialPresent, 'credentialPresent'), error: parseSyncErrorDto(object.error, 'connection') }
  }
  fail(scope, 'test.ok')
}

const PAGE_KEYS = new Set(['items', 'total', 'page', 'pageSize'])

function parsePage<T>(value: unknown, parseItem: (item: unknown) => T, scope: SyncErrorScope, field: string): Page<T> {
  const object = parseObject(scope, value, field)
  closedKeys(scope, object, PAGE_KEYS, field)
  return {
    items: arrayOf(scope, object.items, `${field}.items`, parseItem),
    total: int(scope, object.total, `${field}.total`, 0, Number.MAX_SAFE_INTEGER),
    page: int(scope, object.page, `${field}.page`, 1, Number.MAX_SAFE_INTEGER),
    pageSize: int(scope, object.pageSize, `${field}.pageSize`, 1, MAX_PAGE_SIZE),
  }
}

/** Parse and validate one wire response into its method-discriminated closed schema. */
export function parseSyncResponse(method: SyncMethod, value: unknown): SyncResponse {
  switch (method) {
    case 'listSyncConnections': return { method, response: arrayOf('connection', value, 'listSyncConnections', parseSafeConnection) }
    case 'createSyncConnection': return { method, response: parseSafeConnection(value) }
    case 'updateSyncConnection': return { method, response: parseSafeConnection(value) }
    case 'deleteSyncConnection': return { method, response: parseDeleteResult(value) }
    case 'listSyncRules': return { method, response: arrayOf('rule', value, 'listSyncRules', parseSyncRule) }
    case 'createSyncRule': return { method, response: parseSyncRule(value) }
    case 'updateSyncRule': return { method, response: parseSyncRule(value) }
    case 'deleteSyncRule': return { method, response: parseDeleteResult(value) }
    case 'getSyncMetadata': return { method, response: parseSyncMetadata(value) }
    case 'testSyncConnection': return { method, response: parseTestConnectionResult(value) }
    case 'startSync': return { method, response: parseStartSyncResult(value) }
    case 'getSyncRun': return { method, response: parseSafeRun(value) }
    case 'listSyncRuns': return { method, response: parsePage(value, parseSafeRun, 'run', 'listSyncRuns') }
    case 'listSyncItemResults': return { method, response: parsePage(value, parseSafeItemResult, 'item', 'listSyncItemResults') }
    case 'listSyncOrganizations': return { method, response: arrayOf('connection', value, 'listSyncOrganizations', parseOrganizationChoice) }
    case 'listWorkitems': return { method, response: parseWorkitemPage(value) }
    case 'listWorkitemFields': return { method, response: arrayOf('query', value, 'listWorkitemFields', parseWorkitemField) }
    case 'getWorkitemDescription': return { method, response: parseWorkitemDescriptionResult(value) }
    default: return fail('config', 'method')
  }
}
