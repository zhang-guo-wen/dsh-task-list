import { describe, expect, it } from 'vitest'
import { DOC_KEYS, SYNC_ERRORS, syncError, syncRemoteError } from '../src/sync/errors.ts'
import { SYNC_METHODS, type SyncErrorCode, type SyncErrorScope, type SyncMethod } from '../src/sync/dto.ts'
import { parseSyncRequest, parseSyncResponse } from '../src/sync/validation.ts'
import { baseline, fakeAdapter, local, remote, rule } from './fixtures/sync.ts'

const ALL_CODES: SyncErrorCode[] = [
  'InvalidConfig', 'CredentialMissing', 'AuthDenied', 'EntitlementUnavailable',
  'ReadTimeout', 'NetworkFailure', 'RateLimited', 'InvalidRemoteResponse',
  'IncompleteDiscovery', 'RemoteUnavailable', 'UnsupportedRepresentation', 'FieldLimit',
  'MappingIncompatible', 'WorkflowRejected', 'StorageFailure', 'WriteOutcomeUnknown',
  'VerificationFailed', 'LocalVersionConflict', 'RunInterrupted', 'StaleOwner',
  'RunNotFound', 'ResultQueryFailed', 'UnexpectedFailure', 'HostRestartRequired',
]

function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) stringsIn(item, out)
  else if (value && typeof value === 'object') for (const item of Object.values(value)) stringsIn(item, out)
  return out
}

function keysIn(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) keysIn(item, out)
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) { out.push(key); keysIn(item, out) }
  }
  return out
}

const validMapping = rule().mappings[0]!

describe('parseSyncRequest closed request parsing', () => {
  it('rejects raw secrets, urls, payloads, unknown keys and non-plain objects', () => {
    const valid = { platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS' }
    const bad: unknown[] = [
      null, 'x', 42, true, [], new Date(), () => {},
      { ...valid, url: 'https://evil.example.com' },
      { ...valid, token: 'sk-live-secret' },
      { ...valid, payload: { arbitrary: 'remote-payload' } },
      { ...valid, secret: 'password123' },
      { ...valid, headers: { authorization: 'Bearer x' } },
      { ...valid, extra: 1 },
    ]
    for (const value of bad) {
      expect(() => parseSyncRequest('createSyncConnection', value)).toThrow()
    }
  })

  it('rejects prototype pollution keys', () => {
    const valid = { platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS' }
    const pollution: unknown[] = [
      JSON.parse('{"__proto__": {"polluted": true}}'),
      { ...valid, constructor: { polluted: true } },
      { ...valid, prototype: { polluted: true } },
    ]
    for (const value of pollution) {
      expect(() => parseSyncRequest('createSyncConnection', value)).toThrow()
    }
  })

  it('startSync accepts an empty object and rejects any payload', () => {
    expect(() => parseSyncRequest('startSync', { scope: 'x' })).toThrow()
    expect(() => parseSyncRequest('startSync', { pageSize: 10 })).toThrow()
    expect(parseSyncRequest('startSync', {}).method).toBe('startSync')
  })

  it('rejects page sizes above 100 and non-integer paging', () => {
    expect(() => parseSyncRequest('listSyncRuns', { pageSize: 101 })).toThrow()
    expect(() => parseSyncRequest('listSyncRuns', { pageSize: 0 })).toThrow()
    expect(() => parseSyncRequest('listSyncRuns', { pageSize: 2.5 })).toThrow()
    expect(() => parseSyncRequest('listSyncRuns', { page: 0 })).toThrow()
    expect(() => parseSyncRequest('listSyncItemResults', { id: 'run1', pageSize: 101 })).toThrow()
    const ok = parseSyncRequest('listSyncRuns', { page: 1, pageSize: 100 })
    if (ok.method === 'listSyncRuns') expect(ok.request.pageSize).toBe(100)
  })

  it('rejects invalid environment variable names', () => {
    const valid = { platform: 'yunxiao', name: 'Y', mode: 'center', organizationId: 'org', tokenEnv: 'TOKEN' }
    for (const tokenEnv of ['', '1ABC', 'A-B', 'A B', 'A.B', 'TOKEN!', 'a'.repeat(129)]) {
      expect(() => parseSyncRequest('createSyncConnection', { ...valid, tokenEnv })).toThrow()
    }
    expect(() => parseSyncRequest('createSyncConnection', { ...valid, tokenEnv: 'OK_TOKEN_1' })).not.toThrow()
  })

  it('rejects filters with more than 100 entries', () => {
    const request = {
      connectionId: '33333333-3333-4333-8333-333333333333',
      projectId: 'p',
      filters: { assignees: [], typeIds: Array.from({ length: 101 }, (_, i) => `t${i}`), iterationIds: [], statusIds: [] },
      mappings: [validMapping],
    }
    expect(() => parseSyncRequest('createSyncRule', request)).toThrow()
  })

  it('rejects updates and deletes without a revision', () => {
    const connectionId = '33333333-3333-4333-8333-333333333333'
    const ruleId = '22222222-2222-4222-8222-222222222222'
    expect(() => parseSyncRequest('updateSyncConnection', { id: connectionId })).toThrow()
    expect(() => parseSyncRequest('deleteSyncConnection', { id: connectionId })).toThrow()
    expect(() => parseSyncRequest('updateSyncRule', { id: ruleId })).toThrow()
    expect(() => parseSyncRequest('deleteSyncRule', { id: ruleId })).toThrow()
    expect(() => parseSyncRequest('updateSyncConnection', { id: connectionId, revision: 1 })).not.toThrow()
  })

  it('valid create requests default to disabled', () => {
    const conn = parseSyncRequest('createSyncConnection', {
      platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS',
    })
    if (conn.method === 'createSyncConnection') expect(conn.request.enabled).toBe(false)
    const req = parseSyncRequest('createSyncRule', {
      connectionId: '33333333-3333-4333-8333-333333333333',
      projectId: 'p',
      filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] },
      mappings: [validMapping],
    })
    if (req.method === 'createSyncRule') expect(req.request.enabled).toBe(false)
  })

  it('keeps giant IDs as strings', () => {
    const giant = '1152921504606846976123'
    const req = parseSyncRequest('createSyncRule', {
      connectionId: '33333333-3333-4333-8333-333333333333',
      projectId: 'p',
      filters: { assignees: [], typeIds: [giant], iterationIds: [], statusIds: [] },
      mappings: [validMapping],
    })
    if (req.method === 'createSyncRule') expect(req.request.filters.typeIds[0]).toBe(giant)
    const item = remote({ key: { instance: 'api.tapd.cn', projectId: 'p', typeId: 'story', id: giant } })
    expect(item.key.id).toBe(giant)
  })

  it('parses all 18 methods into discriminated requests', () => {
    expect(SYNC_METHODS).toHaveLength(18)
    const expected: SyncMethod[] = [
      'listSyncConnections', 'createSyncConnection', 'updateSyncConnection', 'deleteSyncConnection',
      'listSyncRules', 'createSyncRule', 'updateSyncRule', 'deleteSyncRule',
      'getSyncMetadata', 'testSyncConnection',
      'startSync', 'getSyncRun', 'listSyncRuns', 'listSyncItemResults', 'listSyncOrganizations',
      'listWorkitems', 'listWorkitemFields', 'getWorkitemDescription',
    ]
    expect([...SYNC_METHODS].sort()).toEqual([...expected].sort())

    const connectionId = '33333333-3333-4333-8333-333333333333'
    const cases: [SyncMethod, unknown][] = [
      ['listSyncConnections', {}],
      ['createSyncConnection', { platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'U', passwordEnv: 'P' }],
      ['updateSyncConnection', { id: connectionId, revision: 1, name: 'New' }],
      ['deleteSyncConnection', { id: connectionId, revision: 1 }],
      ['listSyncRules', {}],
      ['createSyncRule', { connectionId, projectId: 'p', filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] }, mappings: [validMapping] }],
      ['updateSyncRule', { id: '22222222-2222-4222-8222-222222222222', revision: 1, enabled: true }],
      ['deleteSyncRule', { id: '22222222-2222-4222-8222-222222222222', revision: 1 }],
      ['getSyncMetadata', { connectionId }],
      ['testSyncConnection', { connectionId, projectId: 'p' }],
      ['startSync', {}],
      ['getSyncRun', { id: 'run1' }],
      ['listSyncRuns', { page: 1, pageSize: 20 }],
      ['listSyncItemResults', { id: 'run1', page: 1, pageSize: 20 }],
      ['listWorkitems', {
        connectionId, projectId: 'space-1', categories: 'Req', page: 1, perPage: 20,
        fields: ['serialNumber', 'subject'], customFieldIds: [], orderBy: 'gmtCreate', sort: 'desc',
      }],
      ['listWorkitemFields', { connectionId, projectId: 'space-1', category: 'Req' }],
      ['getWorkitemDescription', { connectionId, projectId: 'space-1', id: 'w1' }],
    ]
    for (const [method, value] of cases) {
      expect(parseSyncRequest(method, value).method).toBe(method)
    }
  })
})

describe('safe error registry and serialization', () => {
  it('maps every error code to problem, action and an allowlisted docKey', () => {
    expect(Object.keys(SYNC_ERRORS).sort()).toEqual([...ALL_CODES].sort())
    for (const code of ALL_CODES) {
      const definition = SYNC_ERRORS[code]
      expect(definition.problem).toBeTruthy()
      expect(definition.action).toBeTruthy()
      expect(DOC_KEYS).toContain(definition.docKey)
      expect(typeof definition.retryable).toBe('boolean')
    }
  })

  it('wraps a SyncErrorDto under the task-list/sync outer code', () => {
    const dto = syncError('CredentialMissing', { scope: 'connection', field: 'tokenEnv' })
    const err = syncRemoteError(dto)
    expect(err.code).toBe('task-list/sync')
    expect(err.details).toEqual(dto)
    expect(err.details.code).toBe('CredentialMissing')
  })

  it('never serializes secrets in safe errors', () => {
    const pseudo = 'SUPERSECRETVALUE123'
    const errors = ALL_CODES.map(code => syncRemoteError(syncError(code, { scope: 'connection' })))
    const output = JSON.stringify(errors)
    expect(output).not.toContain(pseudo)
    const parsed = JSON.parse(output) as unknown
    for (const text of stringsIn(parsed)) {
      expect(text).not.toContain(pseudo)
      expect(text).not.toMatch(/^sk-|^ghp_|^xox[bap]-|^Bearer /iu)
    }
    for (const key of keysIn(parsed)) {
      expect(key.toLowerCase()).not.toMatch(/^(stack|header|body|token|password|secret|authorization)$/iu)
    }
  })
})

describe('sync fixtures', () => {
  it('produces valid shapes and records adapter reads/writes without network', async () => {
    const task = local()
    expect(task.content.version).toBe(1)
    expect(task.subtasks).toEqual([])

    const item = remote()
    expect(item.fields.title.presence).toBe('value')
    expect(item.fields.description.value.blocks.length).toBeGreaterThan(0)

    const base = baseline()
    expect(base.projection.normalizationVersion).toBe(1)

    const r = rule()
    expect(r.mappings).toHaveLength(1)
    expect(r.enabled).toBe(false)

    const adapter = fakeAdapter()
    adapter.setRead(remote())
    const read = await adapter.read({ instance: 'x', projectId: 'p', typeId: 't', id: '1' }, r, new AbortController().signal)
    expect(read.key.id).toBe('1152921504606846976123')
    expect(adapter.readCalls).toHaveLength(1)
    await adapter.write(read.key, { title: 'x' }, read, r, new AbortController().signal)
    expect(adapter.writeCalls).toHaveLength(1)
    expect(adapter.writeCalls[0]?.patch).toEqual({ title: 'x' })
  })
})

describe('parseSyncResponse closed response validation', () => {
  const connectionId = '33333333-3333-4333-8333-333333333333'

  function validSafeConnection(overrides: Record<string, unknown> = {}) {
    return {
      id: connectionId,
      name: 'TAPD',
      enabled: true,
      revision: 1,
      credentialPresent: true,
      instance: 'api.tapd.cn',
      platform: 'tapd',
      companyId: '20000001',
      userEnv: 'TAPD_USER',
      passwordEnv: 'TAPD_PASS',
      ...overrides,
    }
  }

  function validSyncError(overrides: Record<string, unknown> = {}) {
    return {
      code: 'CredentialMissing',
      scope: 'connection',
      problem: 'A required credential is not configured',
      cause: 'A required credential is not configured',
      action: 'Set the referenced environment variable and restart the Host',
      docKey: 'credentials',
      retryable: false,
      ...overrides,
    }
  }

  function validSafeRun(overrides: Record<string, unknown> = {}) {
    return {
      id: 'run1',
      status: 'completed',
      phase: 'finished',
      startedAt: 1700000000000,
      finishedAt: 1700000001000,
      counts: { imported: 1, pulled: 0, pushed: 0, merged: 0, unchanged: 0, failed: 0, pending: 0 },
      unprocessedKnown: 0,
      discoveryComplete: true,
      scopeSummary: 'scanned 1 item',
      errors: [],
      ...overrides,
    }
  }

  function validSafeItemResult(overrides: Record<string, unknown> = {}) {
    return {
      key: { instance: 'api.tapd.cn', projectId: '20000001', typeId: 'story', id: '1152921504606846976123' },
      taskId: null,
      category: 'imported',
      changedFields: ['title'],
      discardedFields: [],
      writtenBack: false,
      outsideFilter: false,
      error: null,
      ...overrides,
    }
  }

  function validSyncMetadata(overrides: Record<string, unknown> = {}) {
    return {
      connectionId,
      credentialPresent: true,
      readOnly: false,
      projects: [{ id: 'p', label: 'Project' }],
      members: [],
      iterations: [],
      types: [{ id: 'story', label: 'Story' }],
      typeCapabilities: [{
        typeId: 'story',
        fields: ['title', 'status'],
        readStates: [{ id: 'open', label: 'Open' }],
        writeStates: [{ id: 'open', label: 'Open' }],
        representation: { format: 'text', roundTrip: true },
        paging: { kind: 'page' },
        workflow: { readOnly: false },
      }],
      ...overrides,
    }
  }

  function validSyncRule(overrides: Record<string, unknown> = {}) {
    return {
      id: '22222222-2222-4222-8222-222222222222',
      revision: 1,
      connectionId,
      projectId: '20000001',
      enabled: false,
      workspaceId: null,
      filters: { assignees: [], typeIds: ['story'], iterationIds: [], statusIds: [] },
      mappings: [{
        typeId: 'story',
        category: 'story',
        readStates: { open: 'todo', doing: 'in_progress', done: 'done' },
        writeStates: { todo: 'open', in_progress: 'doing', done: 'done' },
        optionalFields: [],
        fieldIds: { title: 'name', status: 'status' },
        valueMaps: {},
      }],
      ...overrides,
    }
  }

  function validPage(item: unknown) {
    return { items: [item], total: 1, page: 1, pageSize: 20 }
  }

  it('accepts a valid SafeRun and rejects tampered extra raw secret keys', () => {
    expect(parseSyncResponse('getSyncRun', validSafeRun()).response).toMatchObject({ id: 'run1' })
    expect(() => parseSyncResponse('getSyncRun', { ...validSafeRun(), raw: 'sk-live-secret' })).toThrow()
    expect(() => parseSyncResponse('getSyncRun', { ...validSafeRun(), token: 'sk-live-secret' })).toThrow()
  })

  it('rejects nested secret/body keys inside error, connection and metadata outputs', () => {
    expect(() => parseSyncResponse('getSyncRun', { ...validSafeRun(), errors: [{ ...validSyncError(), body: 'x' }] })).toThrow()
    expect(() => parseSyncResponse('getSyncRun', { ...validSafeRun(), errors: [{ ...validSyncError(), stack: 'trace' }] })).toThrow()
    expect(() => parseSyncResponse('listSyncConnections', [{ ...validSafeConnection(), token: 'sk' }])).toThrow()
    expect(() => parseSyncResponse('listSyncConnections', [{ ...validSafeConnection(), password: 'x' }])).toThrow()
    expect(() => parseSyncResponse('getSyncMetadata', { ...validSyncMetadata(), description: 'raw' })).toThrow()
    expect(() => parseSyncResponse('getSyncMetadata', { ...validSyncMetadata(), intent: { raw: true } })).toThrow()
  })

  it('rejects malformed times, counts, categories and mappings', () => {
    expect(() => parseSyncResponse('getSyncRun', { ...validSafeRun(), startedAt: Number.POSITIVE_INFINITY })).toThrow()
    expect(() => parseSyncResponse('getSyncRun', { ...validSafeRun(), counts: { imported: -1, pulled: 0, pushed: 0, merged: 0, unchanged: 0, failed: 0, pending: 0 } })).toThrow()
    expect(() => parseSyncResponse('getSyncRun', { ...validSafeRun(), counts: { imported: 0, pulled: 0, pushed: 0, merged: 0, unchanged: 0, failed: 1, pending: 2 } })).toThrow()
    expect(() => parseSyncResponse('listSyncItemResults', validPage({ ...validSafeItemResult(), category: 'bogus' }))).toThrow()
    expect(() => parseSyncResponse('listSyncItemResults', validPage({ ...validSafeItemResult(), key: { instance: 'i', projectId: 'p', typeId: 't', id: 123 } }))).toThrow()
  })

  it('parses all 14 legitimate response paths', () => {
    const cases: [SyncMethod, unknown][] = [
      ['listSyncConnections', [validSafeConnection()]],
      ['createSyncConnection', validSafeConnection()],
      ['updateSyncConnection', validSafeConnection()],
      ['deleteSyncConnection', { deleted: true }],
      ['listSyncRules', [validSyncRule()]],
      ['createSyncRule', validSyncRule()],
      ['updateSyncRule', validSyncRule()],
      ['deleteSyncRule', { deleted: true }],
      ['getSyncMetadata', validSyncMetadata()],
      ['testSyncConnection', { ok: true, credentialPresent: true, readOnly: false }],
      ['startSync', { runId: 'run1', existing: false }],
      ['getSyncRun', validSafeRun()],
      ['listSyncRuns', validPage(validSafeRun())],
      ['listSyncItemResults', validPage(validSafeItemResult())],
    ]
    for (const [method, value] of cases) {
      expect(parseSyncResponse(method, value).method).toBe(method)
    }
  })

  it('accepts both platform connection outputs and both test-result variants', () => {
    const yunxiao = {
      id: connectionId, name: 'Y', enabled: false, revision: 1, credentialPresent: true,
      instance: 'yunxiao.example.com', platform: 'yunxiao', mode: 'center', organizationId: 'org', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN',
    }
    expect(parseSyncResponse('listSyncConnections', [yunxiao]).response).toHaveLength(1)
    expect(parseSyncResponse('testSyncConnection', { ok: false, credentialPresent: false, error: validSyncError() }).response).toMatchObject({ ok: false })
    expect(() => parseSyncResponse('testSyncConnection', { ok: true, credentialPresent: true })).toThrow()
  })

  it('rejects responses that carry a secret in a disallowed output field', () => {
    const secret = 'sk-live-SUPERSECRETVALUE123'
    const attempts: [SyncMethod, unknown][] = [
      ['getSyncRun', { ...validSafeRun(), raw: secret }],
      ['getSyncRun', { ...validSafeRun(), body: secret }],
      ['listSyncItemResults', validPage({ ...validSafeItemResult(), raw: secret })],
      ['listSyncConnections', [{ ...validSafeConnection(), token: secret }]],
      ['listSyncConnections', [{ ...validSafeConnection(), password: secret }]],
      ['getSyncMetadata', { ...validSyncMetadata(), auth: secret }],
    ]
    for (const [method, value] of attempts) {
      expect(() => parseSyncResponse(method, value)).toThrow()
    }
  })
})

describe('safe error builder validation', () => {
  it('rejects unbounded or control-bearing field/runId/requestId', () => {
    expect(() => syncError('CredentialMissing', { field: 'x'.repeat(201) })).toThrow()
    expect(() => syncError('CredentialMissing', { field: 'bad\x00control' })).toThrow()
    expect(() => syncError('CredentialMissing', { runId: 'x'.repeat(201) })).toThrow()
    expect(() => syncError('CredentialMissing', { requestId: 'bad\x01control' })).toThrow()
  })

  it('rejects an unknown scope at the builder boundary', () => {
    expect(() => syncError('CredentialMissing', { scope: 'bogus' as SyncErrorScope })).toThrow()
  })

  it('generates cause from the static registered template', () => {
    for (const code of ALL_CODES) {
      expect(syncError(code).cause).toBe(SYNC_ERRORS[code].problem)
    }
  })
})

describe('minor contract hardening', () => {
  const connectionId = '33333333-3333-4333-8333-333333333333'
  const mapping = rule().mappings[0]!

  it('rejects whitespace-only ids without rewriting them', () => {
    expect(() => parseSyncRequest('getSyncRun', { id: '   ' })).toThrow()
    expect(() => parseSyncRequest('updateSyncConnection', { id: '   ', revision: 1 })).toThrow()
    expect(() => parseSyncRequest('createSyncRule', {
      connectionId: '   ', projectId: 'p',
      filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] },
      mappings: [mapping],
    })).toThrow()
  })

  it('bounds readStates keys and valueMaps inner keys', () => {
    const longKey = 'x'.repeat(201)
    expect(() => parseSyncRequest('createSyncRule', {
      connectionId, projectId: 'p',
      filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] },
      mappings: [{ ...mapping, readStates: { [longKey]: 'todo' } }],
    })).toThrow()
    expect(() => parseSyncRequest('createSyncRule', {
      connectionId, projectId: 'p',
      filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] },
      mappings: [{ ...mapping, valueMaps: { priority: { [longKey]: 'high' } } }],
    })).toThrow()
  })

  it('rejects obvious mixed-platform update combinations', () => {
    expect(() => parseSyncRequest('updateSyncConnection', { id: connectionId, revision: 1, mode: 'region', companyId: 'c' })).toThrow()
    expect(() => parseSyncRequest('updateSyncConnection', { id: connectionId, revision: 1, tokenEnv: 'TOKEN', companyId: 'c' })).toThrow()
    expect(() => parseSyncRequest('updateSyncConnection', { id: connectionId, revision: 1, mode: 'region' })).not.toThrow()
    expect(() => parseSyncRequest('updateSyncConnection', { id: connectionId, revision: 1, companyId: 'c' })).not.toThrow()
  })
})
