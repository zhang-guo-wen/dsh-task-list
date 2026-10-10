import type {
  HostCredentials, RemoteItem, RemoteKey, SyncAdapter, SyncPatch, SyncTransport, WriteEvidence, WriteIntent,
} from '../types.ts'
import type {
  MetadataScope, Option, OrganizationChoice, SafeConnection, SyncMetadata, SyncRule, TypeCapabilities,
} from '../dto.ts'
import {
  classifyWriteBusinessError, decodeCollection, decodeEnvelope, decodeFieldMap, decodeOptionCollection,
  decodeStatusMap, decodeStatusOptions, decodeTapdFilterIdentity, decodeTapdItem, decodeTapdItemId,
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
 * TAPD splits work items across three collections, so a rule's own type *is* one
 * of them. The rule names it with a `category` condition — the TAPD counterpart
 * of 云效's type — and every other condition becomes a query parameter.
 */
function categoryOf(rule: SyncRule): TapdCategory {
  const value = rule.conditions.flat().find(condition => String(condition.field) === 'category')?.value[0]
  if (value === 'story' || value === 'bug' || value === 'task') return value
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'category' }))
}

/** One condition field → the TAPD query parameter that selects the same rows. */
const CONDITION_PARAMS: Readonly<Record<string, string>> = {
  category: 'workitem_type', workitemType: 'workitem_type_id', status: 'status', statusStage: 'status',
  assignedTo: 'owner', creator: 'creator', priority: 'priority', sprint: 'iteration_id',
  gmtCreate: 'created', gmtModified: 'modified', subject: 'name', tag: 'label',
}

/** The three collections a TAPD rule can target, in the platform's own order. */
const TAPD_CATEGORIES: readonly TapdCategory[] = ['story', 'bug', 'task']
/** TAPD's own names for them, as its own UI shows them. */
const TAPD_TYPE_LABELS: Readonly<Record<TapdCategory, string>> = { story: '需求', bug: '缺陷', task: '任务' }

function isTapdCategory(value: string): value is TapdCategory {
  return value === 'story' || value === 'bug' || value === 'task'
}

/** The equality values of one condition field, if the rule set any. */
function conditionValues(rule: SyncRule, field: string): string[] {
  return rule.conditions.flat()
    .filter(condition => String(condition.field) === field)
    .flatMap(condition => condition.value)
    .filter(value => value !== '')
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

    const readStates = category === 'task'
      ? decodeStatusOptions(fieldMap)
      : await fetchStatusMap(projectId, category, category, signal)

    let workflow: TypeCapabilities['workflow'] = { readOnly: true }
    let writeStates: Option[] = []
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

    return {
      typeId: category,
      fields: ['title', 'description', 'status'],
      readStates,
      writeStates,
      representation: { format: 'text', roundTrip: true },
      paging: { kind: 'cursor' },
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
    const workflows = await fetchWorkflows(key.projectId, category, signal)
    const workflow = resolveWorkflow(category, null, workflows)
    if (workflow === null || workflow.type !== 'classic') {
      throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
    }
    const transitions = await fetchTransitions(key.projectId, category, category, signal)
    const edge = transitions.find(t => t.source === currentRaw && t.target === targetRaw)
    if (edge === undefined || edge.requiresUnsupported) {
      throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
    }
    if (edge.workflowId !== null && edge.workflowId !== workflow.id) {
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
      // The rule's own type is the collection to walk; its category condition is
      // spent on that choice and never sent as a filter parameter.
      const category = categoryOf(rule)
      const ownerField = TAPD_CATEGORY_FIELDS[category].owner
      const assignees = conditionValues(rule, 'assignedTo')
      const iterationIds = conditionValues(rule, 'sprint')
      const statusIds = conditionValues(rule, 'status')
      const filters = Object.entries(CONDITION_PARAMS)
        .filter(([field]) => field !== 'category')
        .flatMap(([field, parameter]) => {
          const values = conditionValues(rule, field)
          return values.length > 0 ? [[parameter, values.join('|')] as const] : []
        })
      let cursor: string | null = null
      for (;;) {
        const params: Record<string, string> = {
          workspace_id: rule.projectId,
          limit: String(PAGE_SIZE),
          order: 'id desc',
        }
        for (const [parameter, value] of filters) params[parameter] = value
        if (cursor === null) params.page = '1'
        else params.cursor = cursor
        const response = await transport.read({
          url: url(`/${collectionFor(category)}`, params),
          method: 'GET',
          headers: auth(),
          readOnly: true,
        }, signal)
        const rawItems = decodeCollection(response.value, wrapperFor(category))
        if (rawItems.length > PAGE_SIZE) {
          throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'connection', field: 'page' }))
        }
        const batch: RemoteItem[] = []
        for (const rawItem of rawItems) {
          const item = decodeTapdItem(rawItem, {
            instance, projectId: rule.projectId, typeId: category, category, statusWriteStates: rule.statusWriteStates,
          })
          // The platform already filtered, but a silently ignored parameter would
          // widen the scope, so the identity-bearing ones are verified once more.
          if (statusIds.length > 0 && !statusIds.includes(item.rawStatus)) continue
          const identity = decodeTapdFilterIdentity(rawItem, ownerField)
          if (assignees.length > 0) {
            if (identity.owner.kind === 'absent' || identity.owner.kind === 'malformed') {
              throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: ownerField }))
            }
            if (identity.owner.kind === 'null') continue
            if (!assignees.includes(identity.owner.id)) continue
          }
          if (iterationIds.length > 0) {
            if (identity.iteration.kind === 'absent' || identity.iteration.kind === 'malformed') {
              throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: 'iteration_id' }))
            }
            if (identity.iteration.kind === 'null') continue
            if (!iterationIds.includes(identity.iteration.id)) continue
          }
          batch.push(item)
        }
        yield batch
        if (rawItems.length < PAGE_SIZE) break
        // Full page: advance the ID cursor from the last raw item's id.
        let lastId: string
        try {
          lastId = decodeTapdItemId(rawItems[rawItems.length - 1]!)
        } catch {
          throw syncRemoteError(syncError('IncompleteDiscovery', { scope: 'connection' }))
        }
        if (cursor !== null && lastId === cursor) {
          throw syncRemoteError(syncError('IncompleteDiscovery', { scope: 'connection' }))
        }
        cursor = lastId
      }
    },

    async read(key: RemoteKey, rule: SyncRule, signal: AbortSignal): Promise<RemoteItem> {
      const category = isTapdCategory(key.typeId) ? key.typeId : categoryOf(rule)
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
      const category = isTapdCategory(key.typeId) ? key.typeId : categoryOf(rule)
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
