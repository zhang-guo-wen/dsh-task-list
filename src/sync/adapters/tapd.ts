import type {
  HostCredentials, RemoteItem, RemoteKey, SyncAdapter, SyncField, SyncPatch, SyncTransport, WriteEvidence, WriteIntent,
} from '../types.ts'
import type {
  MetadataScope, Option, SafeConnection, SyncMetadata, SyncRule, TypeCapabilities, TypeMapping,
} from '../dto.ts'
import {
  classifyWriteBusinessError, decodeCollection, decodeEnvelope, decodeFieldMap, decodeOptionCollection,
  decodeStatusMap, decodeStatusOptions, decodeTapdFilterIdentity, decodeTapdItem, decodeTapdItemId,
  decodeTransitions, decodeWorkflows, decodeWorkitemTypes, hasFieldConfig, storySubtypeRelation, TAPD_CATEGORY_FIELDS,
  TAPD_COLLECTION, TAPD_WORKFLOW_SYSTEM, TAPD_WORKFLOW_SYSTEM_NAME, TAPD_WRAPPER,
  type TapdCategory, type TapdWorkflow, type TapdWorkitemType,
} from './tapd-codec.ts'
import { resolveCredentials } from '../credentials.ts'
import { encodeDescription } from '../description-codec.ts'
import { encodeStatus, mappingFor } from '../mapping.ts'
import { syncError, syncRemoteError } from '../errors.ts'

const PAGE_SIZE = 200
const ORIGIN = 'https://api.tapd.cn'

function basicAuth(user: string, password: string): string {
  return `Basic ${btoa(`${user}:${password}`)}`
}

function categoryOf(mapping: TypeMapping): TapdCategory {
  if (mapping.category === 'story' || mapping.category === 'bug' || mapping.category === 'task') return mapping.category
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'category' }))
}

/**
 * Build a TAPD (public cloud) adapter for one connection. The Basic-auth API
 * user/password are resolved from the referenced environment variables inside
 * the factory, so a missing credential fails before any request and the
 * credentials never enter a DTO. Only `https://api.tapd.cn` is used.
 */
export function createTapdAdapter(
  connection: SafeConnection,
  transport: SyncTransport,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  projectCredential?: HostCredentials,
): SyncAdapter {
  if (connection.platform !== 'tapd') {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
  }
  if (connection.authentication?.mode === 'oauth' && !projectCredential) throw syncRemoteError(syncError('AuthDenied', { scope: 'connection', field: 'authentication' }))
  const credentials = projectCredential ?? resolveCredentials(connection, env)
  if (credentials.kind !== 'tapd' && credentials.kind !== 'tapd-project') throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
  const companyId = connection.companyId
  const instance = companyId
  const authorization = credentials.kind === 'tapd-project' ? 'Bearer ' + credentials.token : basicAuth(credentials.user, credentials.password)
  /** The application-project grant, when this adapter runs on one; it bounds workspaces. */
  const project = credentials.kind === 'tapd-project' ? credentials : undefined

  const url = (path: string, params: Record<string, string> = {}): URL => {
    if (project && params.workspace_id && !project.projectIds.includes(params.workspace_id)) throw syncRemoteError(syncError('AuthDenied', { scope: 'connection' }))
    const built = new URL(`${ORIGIN}${path}`)
    for (const [key, value] of Object.entries(params)) built.searchParams.set(key, value)
    return built
  }
  const auth = (extra: Record<string, string> = {}): Record<string, string> => ({ authorization, ...extra })

  const collectionFor = (category: TapdCategory): string => TAPD_COLLECTION[category]
  const wrapperFor = (category: TapdCategory): string => TAPD_WRAPPER[category]

  async function listProjects(signal: AbortSignal): Promise<Option[]> {
    const response = await transport.read({
      url: url('/workspaces/projects', { company_id: companyId }),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return decodeOptionCollection(response.value, 'Workspace', 'id', 'name')
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
    typeId: string,
    category: TapdCategory,
    workflowId: string | null,
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
      : await fetchStatusMap(projectId, category, typeId, signal)

    let workflow: TypeCapabilities['workflow'] = { readOnly: true }
    let writeStates: Option[] = []
    if (category === 'task') {
      // No workflow API; the fixed states are writable with auto_complete_effort=0.
      workflow = { readOnly: false }
      writeStates = readStates
    } else {
      const resolved = resolveWorkflow(category, workflowId, workflows)
      if (resolved !== null && resolved.type === 'classic') {
        workflow = { readOnly: false }
        writeStates = readStates
      }
    }

    return {
      typeId,
      fields: ['title', 'description', 'status'],
      readStates,
      writeStates,
      representation: { format: 'richtext', roundTrip: true },
      paging: { kind: 'cursor' },
      workflow,
      candidateFields,
    }
  }

  /** Throw MappingIncompatible for a local optional value with no known remote candidate. */
  function mappedValue(localValue: string, valueMap: Record<string, string> | undefined, field: SyncField): string {
    if (!valueMap) throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field }))
    const remote = valueMap[localValue]
    if (remote === undefined || remote === '') throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field }))
    return remote
  }

  /** Gate a real status transition on a classic workflow plus a known safe edge; tasks skip the workflow API. */
  async function gateStatusWrite(
    key: RemoteKey,
    category: TapdCategory,
    mapping: TypeMapping,
    currentRaw: string,
    targetRaw: string,
    signal: AbortSignal,
  ): Promise<void> {
    if (category === 'task') return
    const workflows = await fetchWorkflows(key.projectId, category, signal)
    let workflowId: string | null = null
    if (category === 'story') {
      const workitemTypes = await fetchWorkitemTypes(key.projectId, signal)
      workflowId = workitemTypes.find(t => t.id === mapping.typeId)?.workflowId ?? null
    }
    const workflow = resolveWorkflow(category, workflowId, workflows)
    if (workflow === null || workflow.type !== 'classic') {
      throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item', field: 'status' }))
    }
    const transitions = await fetchTransitions(key.projectId, category, mapping.typeId, signal)
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
      const projects = project ? project.projectIds.map(id => ({ id, label: id })) : await listProjects(signal)
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

        const workitemTypes = await fetchWorkitemTypes(scope.projectId, signal)
        const storySubtypes = workitemTypes.filter(t => t.entityType === 'story')
        types = [
          ...storySubtypes.map(t => ({ id: t.id, label: t.name })),
          { id: 'bug', label: 'Bug' },
          { id: 'task', label: 'Task' },
        ]

        const targetIds = scope.typeId !== undefined ? [scope.typeId] : types.map(t => t.id)
        const categoriesNeeded = new Set(targetIds.map(typeId => categoryForTypeId(typeId, workitemTypes)))
        const fieldMaps = new Map<TapdCategory, Record<string, unknown>>()
        const workflowLists = new Map<TapdCategory, TapdWorkflow[]>()
        for (const category of categoriesNeeded) {
          fieldMaps.set(category, await fetchFieldMap(scope.projectId, category, signal))
          if (category !== 'task') workflowLists.set(category, await fetchWorkflows(scope.projectId, category, signal))
        }
        for (const typeId of targetIds) {
          const category = categoryForTypeId(typeId, workitemTypes)
          const workflowId = category === 'story'
            ? (workitemTypes.find(t => t.id === typeId)?.workflowId ?? null)
            : null
          typeCapabilities.push(await capability(
            scope.projectId, typeId, category, workflowId,
            fieldMaps.get(category)!, workflowLists.get(category) ?? [], signal,
          ))
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
      const { assignees, iterationIds, statusIds, typeIds } = rule.filters
      for (const mapping of rule.mappings) {
        const category = categoryOf(mapping)
        if (typeIds.length > 0 && !typeIds.includes(mapping.typeId)) continue
        const ownerField = TAPD_CATEGORY_FIELDS[category].owner
        let cursor: string | null = null
        for (;;) {
          const params: Record<string, string> = {
            workspace_id: rule.projectId,
            limit: String(PAGE_SIZE),
            order: 'id desc',
          }
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
            const raw = rawItem as Record<string, unknown>
            if (category === 'story' && mapping.typeId !== 'story') {
              const relation = storySubtypeRelation(raw.workitem_type_id, mapping.typeId)
              if (relation === 'malformed') {
                throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: 'workitem_type_id' }))
              }
              if (relation === 'skip') continue
            }
            const item = decodeTapdItem(rawItem, { instance, projectId: rule.projectId, typeId: mapping.typeId, category, mapping })
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
      }
    },

    async read(key: RemoteKey, rule: SyncRule, signal: AbortSignal): Promise<RemoteItem> {
      const mapping = mappingFor(rule, key.typeId)
      const category = categoryOf(mapping)
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
        instance, projectId: key.projectId, typeId: key.typeId, category, id: key.id, mapping,
      })
    },

    async write(key: RemoteKey, patch: SyncPatch, observed: RemoteItem, rule: SyncRule, signal: AbortSignal): Promise<void> {
      const mapping = mappingFor(rule, key.typeId)
      const category = categoryOf(mapping)
      const body: Record<string, string> = { workspace_id: key.projectId, id: key.id }
      const titleField = mapping.fieldIds.title ?? TAPD_CATEGORY_FIELDS[category].title
      if (patch.title !== undefined) body[titleField] = patch.title
      if (patch.description !== undefined) {
        if (!observed.description.roundTrip) {
          throw syncRemoteError(syncError('UnsupportedRepresentation', { scope: 'item', field: 'description' }))
        }
        body.description = encodeDescription(patch.description, observed.description.format)
      }
      if (patch.priority !== undefined) {
        body[mapping.fieldIds.priority ?? 'priority_label'] = mappedValue(patch.priority, mapping.valueMaps?.priority, 'priority')
      }
      if (patch.tags !== undefined) {
        const labels = patch.tags.map(tag => mappedValue(tag, mapping.valueMaps?.tags, 'tags'))
        body[mapping.fieldIds.tags ?? 'label'] = labels.join('|')
      }
      if (patch.storyPoints !== undefined) {
        throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: 'storyPoints' }))
      }
      if (patch.status !== undefined) {
        const targetRaw = encodeStatus(patch.status, observed, mapping)
        if (targetRaw !== observed.rawStatus) {
          await gateStatusWrite(key, category, mapping, observed.rawStatus, targetRaw, signal)
          body[mapping.fieldIds.status ?? 'status'] = targetRaw
          if (category === 'story') body.is_auto_close_task = '0'
          else if (category === 'task') body.auto_complete_effort = '0'
          else body.keep_owner = '1'
        }
      }
      if (Object.keys(body).length <= 2) return

      const response = await transport.write({
        url: url(`/${collectionFor(category)}`),
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
