import type {
  HostCredentials, RemoteItem, RemoteKey, SyncAdapter, SyncPatch, SyncTransport, WriteEvidence, WriteIntent,
} from '../types.ts'
import type {
  MetadataScope, Option, OrganizationChoice, SafeConnection, SyncMetadata, SyncRule, TypeCapabilities, WorkitemConditionGroups,
} from '../dto.ts'
import {
  classifyWriteBusinessError, decodeCollection, decodeEnvelope, decodeFieldMap, decodeOptionCollection,
  decodeStatusMap, decodeStatusOptions, decodeTapdItem, decodeTapdItemId,
  decodeTransitions, decodeWorkflows, decodeWorkitemTypes, hasFieldConfig, TAPD_CATEGORY_FIELDS,
  TAPD_COLLECTION, TAPD_WORKFLOW_SYSTEM, TAPD_WORKFLOW_SYSTEM_NAME, TAPD_WRAPPER,
  type TapdCategory, type TapdWorkflow, type TapdWorkitemType,
} from './tapd-codec.ts'
import { resolveCredentials } from '../credentials.ts'
import { encodeStatus } from '../mapping.ts'
import { syncError, syncRemoteError } from '../errors.ts'

const PAGE_SIZE = 200
const ORIGIN = 'https://api.tapd.cn'

/**
 * Only documented collection fields are evaluated. Do not flatten AND/OR groups
 * into URL parameters: duplicate fields overwrite each other, bug field names
 * differ, and an ignored parameter would silently widen imports. The local
 * predicate also serves the read-only TAPD query surface.
 * Docs: https://o.tapd.tencent.com/document/api-doc/API文档/api_reference/{story,bug,task}/
 */
const CONDITION_OPERATORS: Readonly<Record<string, readonly string[]>> = {
  category: ['EQUALS', 'CONTAINS'], workitemType: ['EQUALS', 'CONTAINS'],
  assignedTo: ['EQUALS', 'CONTAINS'], creator: ['EQUALS', 'CONTAINS'], status: ['EQUALS', 'CONTAINS'],
  sprint: ['CONTAINS'], priority: ['EQUALS', 'CONTAINS'], tag: ['CONTAINS'], subject: ['CONTAINS'],
  gmtCreate: ['BETWEEN'], gmtModified: ['BETWEEN'],
}
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/u
const CONTROL = /[\u0000-\u001f]/u

function invalidCondition(field: string): never {
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field }))
}

/** Compare platform wall-clock dates without guessing a browser/host timezone. */
function dateValue(value: string, endOfDay = false): string | null {
  const match = DATETIME.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const stamp = new Date(`${year}-${month}-${day}T${hour ?? '00'}:${minute ?? '00'}:${second ?? '00'}Z`)
  if (!Number.isFinite(stamp.getTime()) || stamp.toISOString().slice(0, 19) !== `${year}-${month}-${day}T${hour ?? '00'}:${minute ?? '00'}:${second ?? '00'}`) return null
  return `${year}-${month}-${day} ${hour ?? (endOfDay ? '23' : '00')}:${minute ?? (endOfDay ? '59' : '00')}:${second ?? (endOfDay ? '59' : '00')}`
}

export function compileTapdConditions(groups: WorkitemConditionGroups): {
  categories: TapdCategory[]
  matches(category: TapdCategory, raw: unknown): boolean
} {
  if (!Array.isArray(groups) || groups.length > 10) invalidCondition('conditions')
  const compiled = groups.filter(group => {
    if (!Array.isArray(group) || group.length > 20) invalidCondition('conditions')
    return group.length > 0
  }).map(group => group.map(condition => {
    if (!condition || typeof condition.field !== 'string') invalidCondition('conditions.field')
    const field = condition.field
    const operators = CONDITION_OPERATORS[field]
    if (!operators) invalidCondition(`conditions.${field}`)
    const operator = condition.operator ?? operators[0]!
    if (!operators.includes(operator)) invalidCondition(`conditions.operator(${field})`)
    if (!Array.isArray(condition.value) || condition.value.length === 0 || condition.value.length > 50
      || condition.value.some(value => typeof value !== 'string' || !value.trim() || value.length > 200 || CONTROL.test(value))) invalidCondition(`conditions.value(${field})`)
    const values = [...condition.value]
    const type = field === 'category' || field === 'workitemType'
    if (type && !values.every(isTapdCategory)) invalidCondition(`conditions.value(${field})`)
    let from: string | null = null
    let to: string | null = null
    if (operator === 'BETWEEN') {
      if (values.length !== 1 || typeof condition.toValue !== 'string') invalidCondition(`conditions.value(${field})`)
      from = dateValue(values[0]!)
      to = dateValue(condition.toValue, true)
      if (from === null || to === null || from > to) invalidCondition(`conditions.value(${field})`)
    } else if (condition.toValue !== undefined) invalidCondition(`conditions.toValue(${field})`)
    return { field, values, type, from, to }
  }))
  const relevantGroups = (category: TapdCategory) => compiled.filter(group => group.every(condition => !condition.type || condition.values.includes(category)))
  const categories = TAPD_CATEGORIES.filter(category => compiled.length === 0 || relevantGroups(category).length > 0)
  return {
    categories,
    matches(category, raw) {
      if (compiled.length === 0) return true
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: 'item' }))
      }
      const row = raw as Record<string, unknown>
      return relevantGroups(category).map(group => group.map(condition => {
        if (condition.type) return true
        const { field, values, from, to } = condition
        const remoteField = field === 'assignedTo' ? TAPD_CATEGORY_FIELDS[category].owner
          : field === 'subject' ? TAPD_CATEGORY_FIELDS[category].title
          : field === 'creator' ? (category === 'bug' ? 'reporter' : 'creator')
          : ({ status: 'status', sprint: 'iteration_id', priority: 'priority_label', tag: 'label', gmtCreate: 'created', gmtModified: 'modified' } as Record<string, string>)[field]!
        const value = row[remoteField]
        if (value === undefined || (value !== null && typeof value !== 'string') || (typeof value === 'string' && CONTROL.test(value))) {
          throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: remoteField }))
        }
        if (value === null || value === '') return false
        if (from !== null && to !== null) {
          const date = dateValue(value as string)
          if (date === null) throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: remoteField }))
          return date >= from && date <= to
        }
        if (field === 'subject') return values.some(candidate => (value as string).includes(candidate))
        // TAPD people lists use ';', labels use '|'. Match complete identities,
        // never substrings (alice must not match alice2).
        const entries = field === 'assignedTo' || field === 'creator' ? (value as string).split(';').map(entry => entry.trim())
          : field === 'tag' ? (value as string).split('|').map(entry => entry.trim()) : [value as string]
        return values.some(candidate => entries.includes(candidate))
      }).every(Boolean)).some(Boolean)
    },
  }
}

function categoryOfKey(key: RemoteKey): TapdCategory {
  if (isTapdCategory(key.typeId)) return key.typeId
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'typeId' }))
}

/** The three collections a TAPD rule can target, in the platform's own order. */
const TAPD_CATEGORIES: readonly TapdCategory[] = ['story', 'bug', 'task']
/** TAPD's own names for them, as its own UI shows them. */
const TAPD_TYPE_LABELS: Readonly<Record<TapdCategory, string>> = { story: '需求', bug: '缺陷', task: '任务' }

function isTapdCategory(value: string): value is TapdCategory {
  return value === 'story' || value === 'bug' || value === 'task'
}

/**
 * Build a TAPD (public cloud) adapter for one connection. The personal access
 * token is resolved from the Host credential store or the referenced
 * environment variable inside the factory, so a missing credential fails before
 * any request and the credential never enters a DTO. The token travels as
 * `Authorization: Bearer`, exactly as WorkBuddy's TAPD connector uses it, and
 * only `https://api.tapd.cn` is used.
 */
/**
 * List the organizations a TAPD personal access token belongs to. Verified live
 * on 2026-10-10: `/workspaces/projects` demands a `company_id`, while
 * `/workspaces/user_participant_projects` answers with no parameter at all and
 * includes the account's organization as a row whose `category` is
 * `organization`. So the company never has to be typed in by hand.
 */
export async function listTapdOrganizations(token: string, transport: SyncTransport, signal: AbortSignal): Promise<OrganizationChoice[]> {
  if (!token.trim()) throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'token' }))
  const response = await transport.read({
    url: new URL(`${ORIGIN}/workspaces/user_participant_projects`),
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
    readOnly: true,
  }, signal)
  return decodeOptionCollection(response.value, 'Workspace', 'id', 'name', item => item.category === 'organization')
    .map(option => ({ id: option.id, name: option.label }))
}

export function createTapdAdapter(
  connection: SafeConnection,
  transport: SyncTransport,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  storedCredential?: HostCredentials,
): SyncAdapter {
  if (connection.platform !== 'tapd') {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
  }
  const credentials = storedCredential ?? resolveCredentials(connection, env)
  if (credentials.kind !== 'tapd') throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'tokenEnv' }))
  const companyId = connection.companyId
  const instance = companyId
  const authorization = 'Bearer ' + credentials.token

  const url = (path: string, params: Record<string, string> = {}): URL => {
    const built = new URL(`${ORIGIN}${path}`)
    for (const [key, value] of Object.entries(params)) built.searchParams.set(key, value)
    return built
  }
  const auth = (extra: Record<string, string> = {}): Record<string, string> => ({ authorization, ...extra })

  const collectionFor = (category: TapdCategory): string => TAPD_COLLECTION[category]
  const wrapperFor = (category: TapdCategory): string => TAPD_WRAPPER[category]

  async function listProjects(signal: AbortSignal): Promise<Option[]> {
    // A personal access token cannot enumerate a company's projects: TAPD
    // answers 403 (`not allowed to access project <company>`), verified live on
    // 2026-10-10. It can list the projects its own account participates in,
    // which is exactly the set a rule may target, so the company id stays only
    // as the connection's identity. The company workspace itself is not a
    // project and is filtered out.
    const response = await transport.read({
      url: url('/workspaces/user_participant_projects'),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return decodeOptionCollection(response.value, 'Workspace', 'id', 'name', item => item.category !== 'organization')
  }

  async function fetchFieldMap(projectId: string, category: TapdCategory, signal: AbortSignal): Promise<Record<string, unknown>> {
    const response = await transport.read({
      url: url(`/${collectionFor(category)}/get_fields_info`, { workspace_id: projectId }),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return decodeFieldMap(response.value)
  }

  async function fetchWorkitemTypes(projectId: string, signal: AbortSignal): Promise<TapdWorkitemType[]> {
    const response = await transport.read({
      url: url('/workitem_types', { workspace_id: projectId }),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return decodeWorkitemTypes(response.value)
  }

  async function fetchWorkflows(projectId: string, category: TapdCategory, signal: AbortSignal): Promise<TapdWorkflow[]> {
    const systemName = TAPD_WORKFLOW_SYSTEM_NAME[category]
    if (systemName === undefined) return []
    const response = await transport.read({
      url: url('/workflows', { workspace_id: projectId, system_name: systemName }),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return decodeWorkflows(response.value)
  }

  async function fetchStatusMap(projectId: string, category: TapdCategory, workitemTypeId: string, signal: AbortSignal): Promise<Option[]> {
    const system = TAPD_WORKFLOW_SYSTEM[category]
    if (system === undefined) return []
    const params: Record<string, string> = { workspace_id: projectId, system }
    if (category === 'story') params.workitem_type_id = workitemTypeId
    const response = await transport.read({
      url: url('/workflows/status_map', params),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return decodeStatusMap(response.value)
  }

  async function fetchTransitions(projectId: string, category: TapdCategory, workitemTypeId: string, signal: AbortSignal) {
    const system = TAPD_WORKFLOW_SYSTEM[category]
    if (system === undefined) return []
    const params: Record<string, string> = { workspace_id: projectId, system }
    if (category === 'story') params.workitem_type_id = workitemTypeId
    const response = await transport.read({
      url: url('/workflows/all_transitions', params),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return decodeTransitions(response.value)
  }

  /** Resolve the workflow that gates a category's status writes; null means unknown/ambiguous. */
  function resolveWorkflow(category: TapdCategory, workflowId: string | null, workflows: TapdWorkflow[]): TapdWorkflow | null {
    if (category === 'story') {
      if (workflowId === null) return null
      return workflows.find(w => w.id === workflowId) ?? null
    }
    if (workflowId !== null) {
      const match = workflows.find(w => w.id === workflowId)
      if (match) return match
    }
    const defaults = workflows.filter(w => w.isDefault)
    if (defaults.length === 1) return defaults[0]!
    if (defaults.length === 0 && workflows.length === 1) return workflows[0]!
    return null
  }

  function categoryForTypeId(typeId: string, workitemTypes: TapdWorkitemType[]): TapdCategory {
    if (typeId === 'bug') return 'bug'
    if (typeId === 'task') return 'task'
    const wt = workitemTypes.find(t => t.id === typeId)
    if (wt && (wt.entityType === 'story' || wt.entityType === 'bug' || wt.entityType === 'task')) return wt.entityType as TapdCategory
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'typeId' }))
  }

  async function capability(
    projectId: string,
    category: TapdCategory,
    fieldMap: Record<string, unknown>,
    workflows: TapdWorkflow[],
    signal: AbortSignal,
  ): Promise<TypeCapabilities> {
    const candidateFields: TypeCapabilities['candidateFields'] = []
    if (hasFieldConfig(fieldMap, 'priority_label')) {
      candidateFields.push({ field: 'priority', remoteId: 'priority_label', format: 'priority', writable: true })
    }
    if (hasFieldConfig(fieldMap, 'label')) {
      candidateFields.push({ field: 'tags', remoteId: 'label', format: 'label', writable: true })
    }

    let readStates: Option[]
    let workflow: TypeCapabilities['workflow'] = { readOnly: true }
    let writeStates: Option[] = []
    if (category === 'story') {
      // A story's category is not its workitem_type_id. Each subtype has its
      // own status map and workflow; never query status_map with 'story'. The
      // category-wide selector can safely offer writes only to states shared
      // by every subtype with a known classic workflow.
      const storyTypes = (await fetchWorkitemTypes(projectId, signal)).filter(type => type.entityType === 'story')
      const statusMaps = await Promise.all(storyTypes.map(type => fetchStatusMap(projectId, category, type.id, signal)))
      const labels = new Map<string, string>()
      const conflicts = new Set<string>()
      for (const options of statusMaps) for (const option of options) {
        const previous = labels.get(option.id)
        if (previous !== undefined && previous !== option.label) conflicts.add(option.id)
        else labels.set(option.id, option.label)
      }
      readStates = [...labels].filter(([id]) => !conflicts.has(id)).map(([id, label]) => ({ id, label }))
      if (storyTypes.length > 0 && storyTypes.every(type => resolveWorkflow(category, type.workflowId, workflows)?.type === 'classic')) {
        workflow = { readOnly: false }
        writeStates = readStates.filter(option => statusMaps.every(map => map.some(state => state.id === option.id)))
      }
    } else {
      readStates = category === 'task' ? decodeStatusOptions(fieldMap) : await fetchStatusMap(projectId, category, category, signal)
      if (category === 'task') {
        // No workflow API; the fixed states are writable with auto_complete_effort=0.
        workflow = { readOnly: false }
        writeStates = readStates
      } else {
        const resolved = resolveWorkflow(category, null, workflows)
        if (resolved !== null && resolved.type === 'classic') {
          workflow = { readOnly: false }
          writeStates = readStates
        }
      }
    }

    return {
      typeId: category,
      fields: ['title', 'description', 'status'],
      readStates,
      writeStates,
      representation: { format: 'text', roundTrip: true },
      paging: { kind: 'page' },
      workflow,
      candidateFields,
    }
  }

  /** Gate a real status transition on a classic workflow plus a known safe edge; tasks skip the workflow API. */
  async function gateStatusWrite(
    key: RemoteKey,
    category: TapdCategory,
    currentRaw: string,
    targetRaw: string,
    signal: AbortSignal,
  ): Promise<void> {
    if (category === 'task') return
    let workitemTypeId: string = category
    let workflowId: string | null = null
    if (category === 'story') {
      // RemoteItem deliberately carries no subtype. Re-read this exact story
      // before writing: never infer the subtype from its collection or a rule.
      const response = await transport.read({
        url: url('/stories', { workspace_id: key.projectId, id: key.id }),
        method: 'GET', headers: auth(), readOnly: true,
      }, signal)
      const stories = decodeCollection(response.value, 'Story')
      if (stories.length !== 1 || decodeTapdItemId(stories[0]) !== key.id) {
        throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
      }
      const raw = stories[0] as Record<string, unknown>
      if (raw.workspace_id !== key.projectId || raw.status !== currentRaw) {
        throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
      }
      const subtype = raw.workitem_type_id
      if (typeof subtype !== 'string' || !subtype.trim() || CONTROL.test(subtype)) {
        throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'workitem_type_id' }))
      }
      const types = await fetchWorkitemTypes(key.projectId, signal)
      const matches = types.filter(type => type.id === subtype && type.entityType === 'story')
      if (matches.length !== 1 || matches[0]!.workflowId === null) {
        throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'workitem_type_id' }))
      }
      workitemTypeId = subtype
      workflowId = matches[0]!.workflowId
    }
    const workflows = await fetchWorkflows(key.projectId, category, signal)
    const workflow = resolveWorkflow(category, workflowId, workflows)
    if (workflow === null || workflow.type !== 'classic' || (category === 'story' && workflows.filter(w => w.id === workflow.id).length !== 1)) {
      throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
    }
    if (category === 'story') {
      const states = await fetchStatusMap(key.projectId, category, workitemTypeId, signal)
      if (!states.some(state => state.id === currentRaw) || !states.some(state => state.id === targetRaw)) {
        throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
      }
    }
    const transitions = await fetchTransitions(key.projectId, category, workitemTypeId, signal)
    const edges = transitions.filter(t => t.source === currentRaw && t.target === targetRaw)
    const edge = edges[0]
    if (edge === undefined || (category === 'story' && edges.length !== 1) || edge.requiresUnsupported
      || (edge.workflowId !== null && edge.workflowId !== workflow.id)) {
      throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
    }
  }

  return {
    async metadata(scope: MetadataScope, signal: AbortSignal): Promise<SyncMetadata> {
      const projects = await listProjects(signal)
      let members: Option[] = []
      let iterations: Option[] = []
      let types: Option[] = []
      let typeCapabilities: TypeCapabilities[] = []
      if (scope.projectId !== undefined) {
        const memberResponse = await transport.read({
          url: url('/workspaces/users', { workspace_id: scope.projectId }),
          method: 'GET',
          headers: auth(),
          readOnly: true,
        }, signal)
        members = decodeOptionCollection(memberResponse.value, 'UserWorkspace', 'user', 'name')
        const iterationResponse = await transport.read({
          url: url('/iterations', { workspace_id: scope.projectId, limit: String(PAGE_SIZE), page: '1', order: 'id asc' }),
          method: 'GET',
          headers: auth(),
          readOnly: true,
        }, signal)
        iterations = decodeOptionCollection(iterationResponse.value, 'Iteration', 'id', 'name')

        // The three TAPD collections are the selectable types; each carries its own
        // field configuration and its own status set.
        types = TAPD_CATEGORIES.map(category => ({ id: category, label: TAPD_TYPE_LABELS[category] }))
        const targets = scope.typeId !== undefined && isTapdCategory(scope.typeId) ? [scope.typeId] : TAPD_CATEGORIES
        for (const category of targets) {
          const fieldMap = await fetchFieldMap(scope.projectId, category, signal)
          const workflows = category === 'task' ? [] : await fetchWorkflows(scope.projectId, category, signal)
          typeCapabilities.push(await capability(scope.projectId, category, fieldMap, workflows, signal))
        }
      }
      return {
        connectionId: scope.connectionId,
        credentialPresent: true,
        readOnly: false,
        projects,
        members,
        iterations,
        types,
        typeCapabilities,
      }
    },

    async *discover(rule: SyncRule, signal: AbortSignal): AsyncIterable<RemoteItem[]> {
      const filter = compileTapdConditions(rule.conditions)
      for (const category of filter.categories) {
        const seen = new Set<string>()
        let previousLast: bigint | null = null
        // TAPD documents page/limit, not cursor. Bound even a server that keeps
        // fabricating forward pages; the executor also has a wall-clock budget.
        for (let page = 1; ; page += 1) {
          if (page > 10_000) throw syncRemoteError(syncError('IncompleteDiscovery', { scope: 'connection', field: 'page' }))
          const response = await transport.read({
            url: url(`/${collectionFor(category)}`, {
              workspace_id: rule.projectId, limit: String(PAGE_SIZE), page: String(page), order: 'id desc',
            }),
            method: 'GET', headers: auth(), readOnly: true,
          }, signal)
          const rawItems = decodeCollection(response.value, wrapperFor(category))
          if (rawItems.length > PAGE_SIZE) {
            throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'connection', field: 'page' }))
          }
          const batch: RemoteItem[] = []
          let last: bigint | null = null
          for (const rawItem of rawItems) {
            const id = decodeTapdItemId(rawItem)
            // IDs are decimal strings (larger than JS safe integers). Descending
            // order must be honored; repeated/overlapping rows are deduplicated.
            if (!/^\d+$/u.test(id)) throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: 'id' }))
            const numericId = BigInt(id)
            if (last !== null && numericId > last) throw syncRemoteError(syncError('IncompleteDiscovery', { scope: 'connection', field: 'order' }))
            last = numericId
            if (seen.has(id)) continue
            seen.add(id)
            if (!filter.matches(category, rawItem)) continue
            batch.push(decodeTapdItem(rawItem, {
              instance, projectId: rule.projectId, typeId: category, category, statusWriteStates: rule.statusWriteStates,
            }))
          }
          // Detect an ignored page parameter before yielding duplicate data or
          // claiming completeness, including a repeated *short* terminal page.
          if (last !== null && previousLast !== null && last >= previousLast) {
            throw syncRemoteError(syncError('IncompleteDiscovery', { scope: 'connection', field: 'page' }))
          }
          yield batch
          if (rawItems.length < PAGE_SIZE) break
          previousLast = last
        }
      }
    },

    async read(key: RemoteKey, rule: SyncRule, signal: AbortSignal): Promise<RemoteItem> {
      const category = categoryOfKey(key)
      const response = await transport.read({
        url: url(`/${collectionFor(category)}`, { workspace_id: key.projectId, id: key.id }),
        method: 'GET',
        headers: auth(),
        readOnly: true,
      }, signal)
      const rawItems = decodeCollection(response.value, wrapperFor(category))
      if (rawItems.length === 0) {
        throw syncRemoteError(syncError('RemoteUnavailable', { scope: 'item', field: 'id' }))
      }
      if (rawItems.length > 1) {
        throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: 'detail' }))
      }
      return decodeTapdItem(rawItems[0], {
        instance, projectId: key.projectId, typeId: category, category, id: key.id, statusWriteStates: rule.statusWriteStates,
      })
    },

    /**
     * Write back the one field a rule owns: the status, as the rule's own map
     * decides. Every other patch key is a configuration error, never a silent
     * write attempt — the same contract 云效's adapter implements.
     */
    async write(key: RemoteKey, patch: SyncPatch, observed: RemoteItem, rule: SyncRule, signal: AbortSignal): Promise<void> {
      for (const field of Object.keys(patch) as (keyof SyncPatch)[]) {
        if (field !== 'status' && patch[field] !== undefined) {
          throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field }))
        }
      }
      if (patch.status === undefined) return
      const category = categoryOfKey(key)
      const targetRaw = encodeStatus(patch.status, observed.rawStatus, rule.statusWriteStates)
      if (targetRaw === observed.rawStatus) return
      await gateStatusWrite(key, category, observed.rawStatus, targetRaw, signal)
      const body: Record<string, string> = { workspace_id: key.projectId, id: key.id, status: targetRaw }
      // Keep TAPD's own automatic side effects out of a status write.
      if (category === 'story') body.is_auto_close_task = '0'
      else if (category === 'task') body.auto_complete_effort = '0'
      else body.keep_owner = '1'

      const response = await transport.write({
        url: url(`/${collectionFor(category)}/update`),
        method: 'POST',
        headers: auth({ 'content-type': 'application/x-www-form-urlencoded' }),
        body: new URLSearchParams(body).toString(),
        readOnly: false,
      }, signal)
      if (response.status >= 200 && response.status <= 299) {
        if (response.value === null) {
          throw syncRemoteError(syncError('WriteOutcomeUnknown', { scope: 'item' }))
        }
        const envelope = decodeEnvelope(response.value, 'write')
        if (envelope.status !== 1) {
          throw syncRemoteError(syncError(classifyWriteBusinessError(envelope.info), { scope: 'item' }))
        }
        return
      }
      if (response.status === 404) {
        throw syncRemoteError(syncError('RemoteUnavailable', { scope: 'item' }))
      }
      if (response.status === 429) {
        throw syncRemoteError(syncError('WriteOutcomeUnknown', { scope: 'item' }))
      }
      throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item' }))
    },

    async evidence(_intent: WriteIntent, _observed: RemoteItem, _signal: AbortSignal): Promise<WriteEvidence> {
      // No documented CAS or idempotency token; write-effect reconciliation is Task 7.
      return 'unknown'
    },
  }
}
