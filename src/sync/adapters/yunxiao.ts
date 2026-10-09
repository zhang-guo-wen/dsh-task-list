import type {
  HostCredentials, HostRequest, RemoteItem, RemoteKey, SyncAdapter, SyncPatch, SyncTransport,
  WriteEvidence, WriteIntent,
} from '../types.ts'
import type {
  MetadataScope, Option, OrganizationChoice, SafeConnection, SyncMetadata, SyncRule, TypeCapabilities, TypeMapping,
} from '../dto.ts'
import { decodeOptionList, decodeSearchIdentity, decodeWorkflowStatuses, decodeWorkitem, decodeWorkitemFilterIdentity } from './yunxiao-codec.ts'
import { resolveCredentials } from '../credentials.ts'
import { encodeStatus, mappingFor } from '../mapping.ts'
import { encodeDescription } from '../description-codec.ts'
import { syncError, syncRemoteError } from '../errors.ts'

const PAGE_SIZE = 200
const TYPE_CATEGORIES = ['Req', 'Bug', 'Task'] as const

function fail(field: string): never {
  throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field }))
}

function headerInt(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name)
  if (raw === null) return undefined
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined
}

/**
 * Resolve the next page number from the six documented pagination headers, or
 * `null` when the response proves termination (`x-page >= x-total-pages`). A
 * repeated/non-increasing page or an absence of any reliable termination
 * evidence reports IncompleteDiscovery rather than silently truncating.
 */
function nextPage(headers: Headers, currentPage: number): number | null {
  const page = headerInt(headers, 'x-page')
  const totalPages = headerInt(headers, 'x-total-pages')
  const next = headerInt(headers, 'x-next-page')
  if (page !== undefined && totalPages !== undefined && page >= totalPages) return null
  if (next !== undefined && next > currentPage) return next
  throw syncRemoteError(syncError('IncompleteDiscovery', { scope: 'connection' }))
}

function fieldId(mapping: TypeMapping, field: 'title' | 'status', fallback: string): string {
  return mapping.fieldIds[field] ?? fallback
}

/**
 * Official 云效 endpoint listing the organizations one credential can see. The
 * standard-proprietary family is the one that answers here (same origin and
 * `x-yunxiao-token` header as every Projex call); the Alibaba Cloud OpenAPI
 * name of the same operation does not exist on this host and redirects away.
 */
const ORGANIZATIONS_URL = 'https://openapi-rdc.aliyuncs.com/oapi/v1/platform/organizations'

/**
 * Decode the organization list. The envelope differs between the documented
 * OpenAPI shape and the standard-proprietary one this host serves, so every
 * known carrier of the array is accepted and only `id`/`name` pairs survive.
 */
function decodeOrganizations(raw: unknown): OrganizationChoice[] {
  const rows = organizationRows(raw)
  if (rows === null) fail('organizations')
  return rows.map(row => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) fail('organizations')
    const value = row as Record<string, unknown>
    const id = value.id
    if (typeof id === 'string' && id.trim()) return { id: id.trim(), name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id.trim() }
    if (typeof id === 'number' && Number.isSafeInteger(id)) return { id: String(id), name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : String(id) }
    fail('organizations')
  })
}

/** The row array of one organization response, or null when the body carries none. */
function organizationRows(raw: unknown): unknown[] | null {
  // This endpoint answers with a bare JSON array (verified against the real
  // service); the wrapped shapes stay for the documented envelope of the same
  // operation on other deployments.
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'object' || raw === null) return null
  const body = raw as Record<string, unknown>
  for (const key of ['organizations', 'result', 'content', 'data', 'items']) {
    const value = body[key]
    if (Array.isArray(value)) return value
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>
      for (const inner of ['organizations', 'content', 'data', 'items']) {
        if (Array.isArray(nested[inner])) return nested[inner] as unknown[]
      }
    }
  }
  return null
}

/**
 * List the organizations a 云效 personal access token can see. The token is
 * used for this one request and never stored or returned.
 */
export async function listYunxiaoOrganizations(token: string, transport: SyncTransport, signal: AbortSignal): Promise<OrganizationChoice[]> {
  if (!token.trim()) throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'token' }))
  const response = await transport.read({ url: new URL(ORGANIZATIONS_URL), method: 'GET', headers: { 'x-yunxiao-token': token }, readOnly: true }, signal)
  return decodeOrganizations(response.value)
}

/**
 * Build a Yunxiao (modern Projex) adapter for one center connection. The token
 * is the Host-resolved credential when one was typed in the settings page, and
 * otherwise the referenced environment variable; either way a missing
 * credential fails before any network request and the token never enters a DTO.
 * Region mode has no documented origin in the transport allowlist, so it is
 * rejected explicitly rather than guessing a host.
 */
export function createYunxiaoAdapter(
  connection: SafeConnection,
  transport: SyncTransport,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  stored?: HostCredentials,
): SyncAdapter {
  if (connection.platform !== 'yunxiao') {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
  }
  if (connection.mode === 'region') {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'regionHost' }))
  }
  const credentials = stored ?? resolveCredentials(connection, env)
  if (credentials.kind !== 'yunxiao') {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
  }
  const token = credentials.token
  const instance = connection.organizationId
  const base = `https://openapi-rdc.aliyuncs.com/oapi/v1/projex/organizations/${encodeURIComponent(instance)}`

  const url = (path: string): URL => new URL(`${base}${path}`)
  const auth = (extra: Record<string, string> = {}): Record<string, string> => ({ 'x-yunxiao-token': token, ...extra })

  async function fetchDetailRaw(key: RemoteKey, signal: AbortSignal): Promise<unknown> {
    const response = await transport.read({
      url: url(`/workitems/${encodeURIComponent(key.id)}`),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    return response.value
  }

  async function readDetail(key: RemoteKey, mapping: TypeMapping, signal: AbortSignal): Promise<RemoteItem> {
    const raw = await fetchDetailRaw(key, signal)
    return decodeWorkitem(raw, {
      instance, projectId: key.projectId, typeId: key.typeId, id: key.id, mapping,
    })
  }

  async function listOptions(path: string, idKey: string, labelKey: string, signal: AbortSignal): Promise<Option[]> {
    const response = await transport.read({ url: url(path), method: 'GET', headers: auth(), readOnly: true }, signal)
    return decodeOptionList(response.value, idKey, labelKey)
  }

  async function searchProjects(signal: AbortSignal): Promise<Option[]> {
    const out: Option[] = []
    let page = 1
    for (;;) {
      const response = await transport.read({
        url: url('/projects:search'),
        method: 'POST',
        headers: auth({ 'content-type': 'application/json' }),
        body: JSON.stringify({ page, perPage: PAGE_SIZE }),
        readOnly: true,
      }, signal)
      if (!Array.isArray(response.value)) fail('projects')
      out.push(...decodeOptionList(response.value, 'id', 'name'))
      const next = nextPage(response.headers, page)
      if (next === null) break
      page = next
    }
    return out
  }

  async function listTypes(projectId: string, signal: AbortSignal): Promise<unknown[]> {
    const out: unknown[] = []
    for (const category of TYPE_CATEGORIES) {
      const response = await transport.read({
        url: url(`/projects/${encodeURIComponent(projectId)}/workitemTypes?category=${category}`),
        method: 'GET',
        headers: auth(),
        readOnly: true,
      }, signal)
      if (!Array.isArray(response.value)) fail('types')
      out.push(...response.value)
    }
    return out
  }

  async function typeCapability(projectId: string, typeId: string, signal: AbortSignal): Promise<TypeCapabilities> {
    await transport.read({
      url: url(`/projects/${encodeURIComponent(projectId)}/workitemTypes/${encodeURIComponent(typeId)}/fields`),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    const workflow = await transport.read({
      url: url(`/projects/${encodeURIComponent(projectId)}/workitemTypes/${encodeURIComponent(typeId)}/workflows`),
      method: 'GET',
      headers: auth(),
      readOnly: true,
    }, signal)
    const statuses = decodeWorkflowStatuses(workflow.value)
    return {
      typeId,
      fields: ['title', 'description', 'status'],
      readStates: statuses,
      writeStates: statuses,
      representation: { format: 'richtext', roundTrip: true },
      paging: { kind: 'page' },
      workflow: statuses.length ? { readOnly: false } : { readOnly: true },
      candidateFields: [],
    }
  }

  return {
    async metadata(scope: MetadataScope, signal: AbortSignal): Promise<SyncMetadata> {
      const projects = await searchProjects(signal)
      let members: Option[] = []
      let iterations: Option[] = []
      let types: Option[] = []
      let typeCapabilities: TypeCapabilities[] = []
      if (scope.projectId !== undefined) {
        members = await listOptions(`/projects/${encodeURIComponent(scope.projectId)}/members`, 'userId', 'userName', signal)
        iterations = await listOptions(`/projects/${encodeURIComponent(scope.projectId)}/sprints`, 'id', 'name', signal)
        const rawTypes = await listTypes(scope.projectId, signal)
        const uniqueTypes: unknown[] = []
        const seenTypeIds = new Set<string>()
        for (const item of rawTypes) {
          const typeId = (item as { id?: unknown }).id
          if (typeof typeId === 'string' && !seenTypeIds.has(typeId)) { seenTypeIds.add(typeId); uniqueTypes.push(item) }
        }
        types = decodeOptionList(uniqueTypes, 'id', 'name')
        const targets = scope.typeId !== undefined
          ? uniqueTypes.filter(item => (item as { id?: unknown }).id === scope.typeId)
          : uniqueTypes
        for (const item of targets) {
          const typeId = (item as { id?: unknown }).id
          if (typeof typeId === 'string') typeCapabilities.push(await typeCapability(scope.projectId, typeId, signal))
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
      const categories = [...new Set(rule.mappings.map(mapping => mapping.category))]
      const mappedTypes = new Set(rule.mappings.map(mapping => mapping.typeId))
      const { assignees, iterationIds, statusIds, typeIds } = rule.filters
      for (const category of categories) {
        let page = 1
        for (;;) {
          const response = await transport.read({
            url: url('/workitems:search'),
            method: 'POST',
            headers: auth({ 'content-type': 'application/json' }),
            body: JSON.stringify({ category, spaceId: rule.projectId, page, perPage: PAGE_SIZE, orderBy: 'gmtCreate', sort: 'asc' }),
            readOnly: true,
          }, signal)
          if (!Array.isArray(response.value)) fail('search')
          const next = nextPage(response.headers, page)
          const batch: RemoteItem[] = []
          for (const raw of response.value) {
            const { id, typeId } = decodeSearchIdentity(raw, rule.projectId)
            if (!mappedTypes.has(typeId)) continue
            if (typeIds.length > 0 && !typeIds.includes(typeId)) continue
            const key = { instance, projectId: rule.projectId, typeId, id }
            const rawDetail = await fetchDetailRaw(key, signal)
            const item = decodeWorkitem(rawDetail, { ...key, mapping: mappingFor(rule, typeId) })
            if (statusIds.length > 0 && !statusIds.includes(item.rawStatus)) continue
            const identity = decodeWorkitemFilterIdentity(rawDetail)
            if (assignees.length > 0) {
              const assignee = identity.assignee
              // Absent or malformed assignedTo under a non-empty filter cannot
              // be read as "unassigned"; fail closed instead of silently
              // dropping the item into a zero-match.
              if (assignee.kind === 'absent' || assignee.kind === 'malformed') {
                throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: 'assignedTo' }))
              }
              if (assignee.kind === 'null') continue
              if (!assignees.includes(assignee.id)) continue
            }
            if (iterationIds.length > 0) {
              const sprint = identity.sprint
              if (sprint.kind === 'absent' || sprint.kind === 'malformed') {
                throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field: 'sprint' }))
              }
              if (sprint.kind === 'null') continue
              if (!iterationIds.includes(sprint.id)) continue
            }
            batch.push(item)
          }
          yield batch
          if (next === null) break
          page = next
        }
      }
    },

    async read(key: RemoteKey, rule: SyncRule, signal: AbortSignal): Promise<RemoteItem> {
      return readDetail(key, mappingFor(rule, key.typeId), signal)
    },

    async write(key: RemoteKey, patch: SyncPatch, observed: RemoteItem, rule: SyncRule, signal: AbortSignal): Promise<void> {
      const mapping = mappingFor(rule, key.typeId)
      for (const optional of ['priority', 'tags', 'storyPoints'] as const) {
        if (patch[optional] !== undefined) {
          throw syncRemoteError(syncError('MappingIncompatible', { scope: 'item', field: optional }))
        }
      }
      const body: Record<string, unknown> = {}
      if (patch.title !== undefined) body[fieldId(mapping, 'title', 'subject')] = patch.title
      if (patch.description !== undefined) {
        if (!observed.description.roundTrip) {
          throw syncRemoteError(syncError('UnsupportedRepresentation', { scope: 'item', field: 'description' }))
        }
        body.description = encodeDescription(patch.description, observed.description.format)
        body.formatType = observed.description.format === 'markdown' ? 'MARKDOWN' : 'RICHTEXT'
      }
      if (patch.status !== undefined) {
        body[fieldId(mapping, 'status', 'status')] = encodeStatus(patch.status, observed, mapping)
      }
      const result = await transport.write({
        url: url(`/workitems/${encodeURIComponent(key.id)}`),
        method: 'PUT',
        headers: auth({ 'content-type': 'application/json' }),
        body: JSON.stringify(body),
        readOnly: false,
      }, signal)
      if (result.status >= 200 && result.status <= 299) return
      // A definitive non-2xx is a rejected write, never a silent success; the
      // transport already surfaced auth (401/403), 3xx and 5xx as thrown errors,
      // and returns the remaining 4xx here for the adapter to interpret. The raw
      // body is never echoed into the safe error DTO.
      if (result.status === 404) throw syncRemoteError(syncError('RemoteUnavailable', { scope: 'item' }))
      // A 429 on a non-idempotent write is an uncertain outcome: the PUT may
      // have been applied before the rate-limit response. Report it as unknown
      // so a future executor reconciles instead of re-sending on a retryable flag.
      if (result.status === 429) throw syncRemoteError(syncError('WriteOutcomeUnknown', { scope: 'item' }))
      throw syncRemoteError(syncError('WorkflowRejected', { scope: 'item' }))
    },

    async evidence(_intent: WriteIntent, _observed: RemoteItem, _signal: AbortSignal): Promise<WriteEvidence> {
      // No documented CAS or idempotency token; write-effect reconciliation is Task 7.
      return 'unknown'
    },
  }
}
