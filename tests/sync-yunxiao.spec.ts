import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createYunxiaoAdapter } from '../src/sync/adapters/yunxiao.ts'
import { SyncTransport } from '../src/sync/transport.ts'
import { syncError, syncRemoteError } from '../src/sync/errors.ts'
import { parseSyncResponse } from '../src/sync/validation.ts'
import { projectRemote } from '../src/sync/snapshot.ts'
import type { Clock, RemoteItem, SafeConnection, SyncAdapter } from '../src/sync/types.ts'
import type { SyncRule } from '../src/sync/dto.ts'

const TOKEN = 'tok-123'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sync-api', name), 'utf8'))
}

function yunxiaoConnection(overrides: Partial<SafeConnection> = {}): SafeConnection {
  return {
    id: 'conn-1', name: 'Yunxiao', enabled: true, revision: 1, credentialPresent: true, instance: 'org-1',
    platform: 'yunxiao', mode: 'center', organizationId: 'org-1', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN',
    ...overrides,
  } as SafeConnection
}

function yunxiaoRule(overrides: Partial<SyncRule> = {}): SyncRule {
  return {
    id: 'rule-1', revision: 1, connectionId: 'conn-1', projectId: 'space-1', enabled: true, workspaceId: null,
    filters: { assignees: [], typeIds: ['req-type-1'], iterationIds: [], statusIds: [] },
    mappings: [{
      typeId: 'req-type-1', category: 'Req',
      readStates: { todo: 'todo', doing: 'in_progress', done: 'done' },
      writeStates: { todo: 'todo', in_progress: 'doing', done: 'done' },
      optionalFields: [], fieldIds: { title: 'subject', status: 'status' }, valueMaps: {},
    }],
    ...overrides,
  }
}

// --- fake clock ------------------------------------------------------------

interface FakeClockApi { clock: Clock }
function makeFakeClock(initial = 1_700_000_000_000): FakeClockApi {
  let current = initial
  const pending: { at: number; resolve: () => void; reject: (e: unknown) => void }[] = []
  const clock: Clock = {
    now: () => current,
    sleep(ms: number, signal: AbortSignal): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return }
        const entry = { at: current + ms, resolve: () => {}, reject: (e: unknown) => {} }
        const onAbort = () => { const i = pending.indexOf(entry); if (i >= 0) pending.splice(i, 1); entry.reject(new DOMException('aborted', 'AbortError')) }
        entry.resolve = () => { signal.removeEventListener('abort', onAbort); resolve() }
        entry.reject = (e: unknown) => { signal.removeEventListener('abort', onAbort); reject(e) }
        signal.addEventListener('abort', onAbort, { once: true })
        pending.push(entry)
      })
    },
  }
  return { clock }
}

// --- helpers ---------------------------------------------------------------

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function makeAdapter(fetch: ReturnType<typeof vi.fn>, connection = yunxiaoConnection()): SyncAdapter {
  const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
  return createYunxiaoAdapter(connection, transport, { YUNXIAO_TOKEN: TOKEN })
}

function capture(fn: () => unknown): unknown {
  try { return fn() } catch (e) { return e }
  throw new Error('expected throw')
}

function captureRejection(p: Promise<unknown>): Promise<unknown> {
  return p.then(() => { throw new Error('expected rejection') }, (e: unknown) => e)
}

function detailCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'details' in err) {
    const details = (err as { details?: unknown }).details
    if (details && typeof details === 'object' && 'code' in details) return (details as { code: string }).code
  }
  return undefined
}

async function collectDiscover(adapter: SyncAdapter, rule: SyncRule): Promise<RemoteItem[]> {
  const out: RemoteItem[] = []
  for await (const batch of adapter.discover(rule, new AbortController().signal)) out.push(...batch)
  return out
}

const KEY = { instance: 'org-1', projectId: 'space-1', typeId: 'req-type-1', id: '1000000000000000001' }

/** A fetch mock routed by URL/method; routes are tried in order. */
function route(routes: Array<{ match: (url: string, method: string) => boolean; respond: () => Response }>): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const found = routes.find(r => r.match(url, method))
    if (!found) throw new Error(`no route for ${method} ${url}`)
    return found.respond()
  })
}

// --- factory ---------------------------------------------------------------

describe('createYunxiaoAdapter factory', () => {
  it('resolves the token from the referenced env var and rejects a missing one before any network', () => {
    const fetch = vi.fn()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const err = capture(() => createYunxiaoAdapter(yunxiaoConnection(), transport, {}))
    expect(detailCode(err)).toBe('CredentialMissing')
    expect(fetch).not.toHaveBeenCalled()
    expect(createYunxiaoAdapter(yunxiaoConnection(), transport, { YUNXIAO_TOKEN: TOKEN })).toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a region connection as unsupported instead of guessing a host', () => {
    const fetch = vi.fn()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const region = yunxiaoConnection({ mode: 'region', regionHost: 'region.example.com', instance: 'region.example.com' })
    const err = capture(() => createYunxiaoAdapter(region, transport, { YUNXIAO_TOKEN: TOKEN }))
    expect(detailCode(err)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })
})

// --- discover --------------------------------------------------------------

describe('yunxiao discover', () => {
  it('scopes the search POST to one space with category, paging and fixed sort, then reads each detail', async () => {
    const fetch = route([
      {
        match: (u, m) => u.includes('/workitems:search') && m === 'POST',
        respond: () => jsonResponse(fixture('yunxiao-center-search.json'), 200, { 'x-page': '1', 'x-total-pages': '1' }),
      },
      { match: (u, m) => u.endsWith('/workitems/1000000000000000001') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-detail.json')) },
    ])
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, yunxiaoRule())
    expect(items).toHaveLength(1)
    expect(items[0]?.key.id).toBe('1000000000000000001')
    expect(items[0]?.fields.status.presence).toBe('value')
  })

  it('encodes category, spaceId, paging and sort in the search body', async () => {
    let body: Record<string, unknown> = {}
    const fetch = route([
      {
        match: (u, m) => u.includes('/workitems:search') && m === 'POST',
        respond: () => jsonResponse([], 200, { 'x-page': '1', 'x-total-pages': '1' }),
      },
    ])
    // capture the body by wrapping fetch
    const wrapped = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/workitems:search') && init?.method === 'POST') body = JSON.parse((init.body as string) ?? '{}') as Record<string, unknown>
      return jsonResponse([], 200, { 'x-page': '1', 'x-total-pages': '1' })
    })
    const adapter = makeAdapter(wrapped)
    await collectDiscover(adapter, yunxiaoRule())
    expect(body.spaceId).toBe('space-1')
    expect(body.category).toBe('Req')
    expect(body.page).toBe(1)
    expect(body.perPage).toBe(200)
    expect(body.orderBy).toBe('gmtCreate')
    expect(body.sort).toBe('asc')
    expect('conditions' in body).toBe(false)
  })

  it('follows an increasing next-page header and stops at the terminal page', async () => {
    let searchCalls = 0
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/workitems:search') && method === 'POST') {
        searchCalls += 1
        if (searchCalls === 1) return jsonResponse(fixture('yunxiao-center-search.json'), 200, { 'x-page': '1', 'x-total-pages': '2', 'x-next-page': '2' })
        return jsonResponse([], 200, { 'x-page': '2', 'x-total-pages': '2' })
      }
      if (url.endsWith('/workitems/1000000000000000001') && method === 'GET') return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + method + ' ' + url)
    })
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, yunxiaoRule())
    expect(items).toHaveLength(1)
    expect(searchCalls).toBe(2)
  })

  it('reports IncompleteDiscovery when pagination headers repeat a page without terminating', async () => {
    const fetch = route([
      { match: (u, m) => u.includes('/workitems:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-search.json'), 200, { 'x-page': '1', 'x-total-pages': '2', 'x-next-page': '1' }) },
    ])
    const adapter = makeAdapter(fetch)
    expect(detailCode(await captureRejection(collectDiscover(adapter, yunxiaoRule())))).toBe('IncompleteDiscovery')
  })

  it('reports IncompleteDiscovery when pagination headers are missing with no termination evidence', async () => {
    const fetch = route([
      { match: (u, m) => u.includes('/workitems:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-search.json'), 200) },
    ])
    const adapter = makeAdapter(fetch)
    expect(detailCode(await captureRejection(collectDiscover(adapter, yunxiaoRule())))).toBe('IncompleteDiscovery')
  })

  it('filters a discovered item whose type is not mapped by the rule without reading detail', async () => {
    const crossType = [{ id: '2', space: { id: 'space-1' }, workitemType: { id: 'bug-type-1' } }]
    let detailReads = 0
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/workitems:search')) return jsonResponse(crossType, 200, { 'x-page': '1', 'x-total-pages': '1' })
      if (url.includes('/workitems/')) detailReads += 1
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, yunxiaoRule())
    expect(items).toHaveLength(0)
    expect(detailReads).toBe(0)
  })

  const ABSENT = Symbol('absent')

  function filterDetail(id: string, typeId: string, assignedTo: unknown, sprint: unknown, status: string): unknown {
    const raw: Record<string, unknown> = {
      id, serialNumber: id, subject: 'Item ' + id, description: '<p>x</p>', formatType: 'RICHTEXT',
      gmtModified: '2026-10-07T00:00:00+08:00',
      space: { id: 'space-1', name: 'Project One' },
      workitemType: { id: typeId, name: typeId },
      status: { id: status, name: status },
      labels: [], customFieldValues: [],
    }
    if (assignedTo !== ABSENT) raw.assignedTo = assignedTo
    if (sprint !== ABSENT) raw.sprint = sprint
    return raw
  }

  const FILTER_OWNERS: Record<string, { typeId: string; assignedTo: unknown; sprint: unknown; status: string }> = {
    i1: { typeId: 'req-type-1', assignedTo: { id: 'user-1', name: 'Alice' }, sprint: { id: 'sprint-1', name: 'Sprint 1' }, status: 'doing' },
    i2: { typeId: 'req-type-1', assignedTo: { id: 'user-1', name: 'Alice' }, sprint: { id: 'sprint-2', name: 'Sprint 2' }, status: 'todo' },
    i3: { typeId: 'req-type-1', assignedTo: { id: 'user-2', name: 'Bob' }, sprint: { id: 'sprint-1', name: 'Sprint 1' }, status: 'doing' },
    i4: { typeId: 'req-type-1', assignedTo: { id: 'user-1', name: 'Alice' }, sprint: null, status: 'done' },
    i5: { typeId: 'req-type-1', assignedTo: null, sprint: { id: 'sprint-2', name: 'Sprint 2' }, status: 'doing' },
    i6: { typeId: 'bug-type-1', assignedTo: { id: 'user-1', name: 'Alice' }, sprint: { id: 'sprint-1', name: 'Sprint 1' }, status: 'doing' },
  }

  async function collectFiltered(rule: SyncRule): Promise<string[]> {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/workitems:search') && method === 'POST') {
        return jsonResponse(
          Object.keys(FILTER_OWNERS).map(id => ({ id, space: { id: 'space-1' }, workitemType: { id: FILTER_OWNERS[id]!.typeId } })),
          200, { 'x-page': '1', 'x-total-pages': '1' },
        )
      }
      const match = url.match(/\/workitems\/([^/?]+)$/)
      if (match && method === 'GET') {
        const id = match[1]!
        const entry = FILTER_OWNERS[id]
        if (!entry) throw new Error('no detail for ' + id)
        return jsonResponse(filterDetail(id, entry.typeId, entry.assignedTo, entry.sprint, entry.status))
      }
      throw new Error('unexpected ' + method + ' ' + url)
    })
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, rule)
    return items.map(item => item.key.id)
  }

  it('returns only items matching the combined assignee and sprint filters', async () => {
    const rule = yunxiaoRule({ filters: { assignees: ['user-1'], typeIds: [], iterationIds: ['sprint-2'], statusIds: [] } })
    expect(await collectFiltered(rule)).toEqual(['i2'])
  })

  it('applies OR within an assignee filter and excludes items whose assignee is explicitly null', async () => {
    const rule = yunxiaoRule({ filters: { assignees: ['user-1', 'user-2'], typeIds: [], iterationIds: [], statusIds: [] } })
    expect(await collectFiltered(rule)).toEqual(['i1', 'i2', 'i3', 'i4'])
  })

  it('excludes a mapped item whose sprint is explicitly null when a sprint filter is set', async () => {
    const rule = yunxiaoRule({ filters: { assignees: [], typeIds: [], iterationIds: ['sprint-2'], statusIds: [] } })
    expect(await collectFiltered(rule)).toEqual(['i2', 'i5'])
  })

  it('returns all mapped types when every filter is empty', async () => {
    expect(await collectFiltered(yunxiaoRule({ filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] } }))).toEqual(['i1', 'i2', 'i3', 'i4', 'i5'])
  })

  async function discoverErrorCode(rule: SyncRule, detail: unknown): Promise<string | undefined> {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/workitems:search') && method === 'POST') {
        return jsonResponse([{ id: 'a1', space: { id: 'space-1' }, workitemType: { id: 'req-type-1' } }], 200, { 'x-page': '1', 'x-total-pages': '1' })
      }
      if (method === 'GET') return jsonResponse(detail)
      throw new Error('unexpected ' + method + ' ' + url)
    })
    const adapter = makeAdapter(fetch)
    return detailCode(await captureRejection(collectDiscover(adapter, rule)))
  }

  const assigneeRule = () => yunxiaoRule({ filters: { assignees: ['user-1'], typeIds: [], iterationIds: [], statusIds: [] } })
  const sprintRule = () => yunxiaoRule({ filters: { assignees: [], typeIds: [], iterationIds: ['sprint-1'], statusIds: [] } })

  it('errors instead of silently excluding when an assignee filter is set and assignedTo is absent', async () => {
    expect(await discoverErrorCode(assigneeRule(), filterDetail('a1', 'req-type-1', ABSENT, { id: 'sprint-1' }, 'doing'))).toBe('InvalidRemoteResponse')
  })

  it('errors when an assignee filter is set and assignedTo is malformed (missing id)', async () => {
    expect(await discoverErrorCode(assigneeRule(), filterDetail('a1', 'req-type-1', { name: 'Alice' }, { id: 'sprint-1' }, 'doing'))).toBe('InvalidRemoteResponse')
  })

  it('errors instead of silently excluding when a sprint filter is set and sprint is absent', async () => {
    expect(await discoverErrorCode(sprintRule(), filterDetail('a1', 'req-type-1', { id: 'user-1' }, ABSENT, 'doing'))).toBe('InvalidRemoteResponse')
  })

  it('errors when a sprint filter is set and sprint is malformed (missing id)', async () => {
    expect(await discoverErrorCode(sprintRule(), filterDetail('a1', 'req-type-1', { id: 'user-1' }, { name: 'Sprint 1' }, 'doing'))).toBe('InvalidRemoteResponse')
  })

  it('matches a canonical detail fixture carrying an official assignedTo {id,name}', async () => {
    const fetch = route([
      { match: (u, m) => u.includes('/workitems:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-search.json'), 200, { 'x-page': '1', 'x-total-pages': '1' }) },
      { match: (u, m) => u.endsWith('/workitems/1000000000000000001') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-detail.json')) },
    ])
    const adapter = makeAdapter(fetch)
    const rule = yunxiaoRule({ filters: { assignees: ['user-1'], typeIds: [], iterationIds: [], statusIds: [] } })
    expect((await collectDiscover(adapter, rule)).map(i => i.key.id)).toEqual(['1000000000000000001'])
  })
})

// --- per-request gate seam -------------------------------------------------

describe('yunxiao adapter per-request gate', () => {
  it('stops the detail fetch when the gate throws between the search and detail requests', async () => {
    let gates = 0
    const fetch = route([
      { match: (u, m) => u.includes('/workitems:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-search.json'), 200, { 'x-page': '1', 'x-total-pages': '1' }) },
      { match: (u, m) => u.endsWith('/workitems/1000000000000000001') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-detail.json')) },
    ])
    const transport = new SyncTransport({
      fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock,
      beforeRequest: () => {
        gates += 1
        if (gates > 1) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'enabled' }))
      },
    })
    const adapter = createYunxiaoAdapter(yunxiaoConnection(), transport, { YUNXIAO_TOKEN: TOKEN })
    const err = await captureRejection(collectDiscover(adapter, yunxiaoRule()))
    expect(detailCode(err)).toBe('InvalidConfig')
    expect(fetch).toHaveBeenCalledTimes(1) // only the search; the detail fetch is gated
  })

  it('stops the members metadata request when the gate throws between two metadata fetches', async () => {
    let gates = 0
    const fetch = route([
      { match: (u, m) => u.includes('/projects:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-projects.json'), 200, { 'x-page': '1', 'x-total-pages': '1' }) },
      { match: (u, m) => u.includes('/projects/space-1/members') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-members.json')) },
    ])
    const transport = new SyncTransport({
      fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock,
      beforeRequest: () => {
        gates += 1
        if (gates > 1) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'enabled' }))
      },
    })
    const adapter = createYunxiaoAdapter(yunxiaoConnection(), transport, { YUNXIAO_TOKEN: TOKEN })
    const err = await captureRejection(adapter.metadata({ connectionId: 'conn-1', projectId: 'space-1' }, new AbortController().signal))
    expect(detailCode(err)).toBe('InvalidConfig')
    expect(fetch).toHaveBeenCalledTimes(1) // only projects:search; members is gated
  })
})

// --- read ------------------------------------------------------------------

describe('yunxiao read', () => {
  it('GETs detail by encoded id, normalizes status via the rule and keeps gmtModified as the opaque token', async () => {
    const seen: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001') && (init?.method ?? 'GET') === 'GET') {
        seen.push(url)
        return jsonResponse(fixture('yunxiao-center-detail.json'))
      }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const item = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    expect(item.updatedToken).toBe('2026-10-07T00:00:00+08:00')
    expect(item.revisionToken).toBeNull()
    expect(item.fields.title).toMatchObject({ presence: 'value', value: 'Implement sync adapter' })
    expect(item.fields.status).toMatchObject({ presence: 'value', value: 'in_progress' })
    expect(item.rawStatus).toBe('doing')
    expect(seen).toEqual(['https://openapi-rdc.aliyuncs.com/oapi/v1/projex/organizations/org-1/workitems/1000000000000000001'])
  })

  it('read returns a status projectRemote accepts without any hidden pre-discovery cache', async () => {
    const fetch = vi.fn(async () => jsonResponse(fixture('yunxiao-center-detail.json')))
    const adapter = makeAdapter(fetch)
    const rule = yunxiaoRule()
    const item = await adapter.read(KEY, rule, new AbortController().signal)
    expect(projectRemote(item, rule).status).toBe('in_progress')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws MappingIncompatible when the raw status is not mapped by the given rule', async () => {
    const fetch = vi.fn(async () => jsonResponse(fixture('yunxiao-center-detail.json')))
    const adapter = makeAdapter(fetch)
    const unmapped = yunxiaoRule({
      mappings: [{ ...yunxiaoRule().mappings[0]!, readStates: { done: 'done' }, writeStates: { done: 'done' } }],
    })
    expect(detailCode(await captureRejection(adapter.read(KEY, unmapped, new AbortController().signal)))).toBe('MappingIncompatible')
  })

  it('retains a giant numeric id as a string', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/workitems/9223372036854775807123456789')) return jsonResponse(fixture('yunxiao-center-detail-giant.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const item = await adapter.read({ ...KEY, id: '9223372036854775807123456789' }, yunxiaoRule(), new AbortController().signal)
    expect(item.key.id).toBe('9223372036854775807123456789')
  })

  it('rejects a counterfeit response whose space does not match the key', async () => {
    const wrongSpace = { ...(fixture('yunxiao-center-detail.json') as object), space: { id: 'other-space' } }
    const fetch = vi.fn(async () => jsonResponse(wrongSpace))
    const adapter = makeAdapter(fetch)
    expect(detailCode(await captureRejection(adapter.read(KEY, yunxiaoRule(), new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })

  it('rejects a response whose workitem id does not match the requested id', async () => {
    const wrongId = { ...(fixture('yunxiao-center-detail.json') as object), id: '999' }
    const fetch = vi.fn(async () => jsonResponse(wrongId))
    const adapter = makeAdapter(fetch)
    expect(detailCode(await captureRejection(adapter.read(KEY, yunxiaoRule(), new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })
})

// --- write -----------------------------------------------------------------

describe('yunxiao write', () => {
  it('PUTs only the patched fields with a minimal body and does not read back an entity', async () => {
    const puts: { url: string; method: string; body: string }[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001') && init?.method === 'PUT') {
        puts.push({ url, method: init.method, body: (init.body as string) ?? '' })
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/workitems/1000000000000000001') && (init?.method ?? 'GET') === 'GET') return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    await adapter.write(KEY, { title: 'New title' }, observed, yunxiaoRule(), new AbortController().signal)
    expect(puts).toHaveLength(1)
    expect(puts[0]!.method).toBe('PUT')
    const body = JSON.parse(puts[0]!.body) as Record<string, unknown>
    expect(body).toEqual({ subject: 'New title' })
    expect(fetch).toHaveBeenCalledTimes(2) // read + write, no read-back
  })

  it('sends description together with formatType and encodes status as a scalar statusId', async () => {
    const puts: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001') && init?.method === 'PUT') {
        puts.push((init.body as string) ?? '')
        return new Response(null, { status: 200 })
      }
      if (url.endsWith('/workitems/1000000000000000001') && (init?.method ?? 'GET') === 'GET') return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    await adapter.write(KEY, { description: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'new' }] }] }, status: 'done' }, observed, yunxiaoRule(), new AbortController().signal)
    const body = JSON.parse(puts[0]!) as Record<string, unknown>
    expect(body.formatType).toBe('RICHTEXT')
    expect(typeof body.description).toBe('string')
    expect(body.status).toBe('done')
    expect(body.subject).toBeUndefined()
  })

  it('refuses to write a description whose observed representation is not lossless', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001')) return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    const lossy = { ...observed, description: { ...observed.description, roundTrip: false } }
    const err = await captureRejection(adapter.write(KEY, { description: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'x' }] }] } }, lossy, yunxiaoRule(), new AbortController().signal))
    expect(detailCode(err)).toBe('UnsupportedRepresentation')
    expect(fetch).toHaveBeenCalledTimes(1) // only the read, no PUT
  })

  it('treats a 204 empty-body write as success without a read entity', async () => {
    let putCount = 0
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001') && init?.method === 'PUT') { putCount += 1; return new Response(null, { status: 204 }) }
      if (url.endsWith('/workitems/1000000000000000001')) return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    await adapter.write(KEY, { title: 'Renamed' }, observed, yunxiaoRule(), new AbortController().signal)
    expect(putCount).toBe(1)
  })

  it('interprets non-2xx write statuses and never reads back after a rejected write', async () => {
    const cases: Array<{ status: number; code: string }> = [
      { status: 400, code: 'WorkflowRejected' },
      { status: 422, code: 'WorkflowRejected' },
      { status: 404, code: 'RemoteUnavailable' },
      { status: 429, code: 'WriteOutcomeUnknown' },
    ]
    for (const { status, code } of cases) {
      let putCount = 0
      let getCount = 0
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/workitems/1000000000000000001') && init?.method === 'PUT') {
          putCount += 1
          return jsonResponse({ message: 'rejected' }, status)
        }
        if (url.endsWith('/workitems/1000000000000000001') && (init?.method ?? 'GET') === 'GET') {
          getCount += 1
          return jsonResponse(fixture('yunxiao-center-detail.json'))
        }
        throw new Error('unexpected ' + url)
      })
      const adapter = makeAdapter(fetch)
      const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
      const err = await captureRejection(adapter.write(KEY, { status: 'done' }, observed, yunxiaoRule(), new AbortController().signal))
      expect(detailCode(err)).toBe(code)
      expect(putCount).toBe(1)
      expect(getCount).toBe(1)
    }
  })

  it('does not echo the rejection body into the safe error DTO', async () => {
    const secret = 'topsecret-body-value'
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001') && init?.method === 'PUT') {
        return jsonResponse({ error: secret }, 400)
      }
      if (url.endsWith('/workitems/1000000000000000001')) return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    const err = await captureRejection(adapter.write(KEY, { status: 'done' }, observed, yunxiaoRule(), new AbortController().signal))
    expect(detailCode(err)).toBe('WorkflowRejected')
    expect(JSON.stringify(err)).not.toContain(secret)
  })
})

// --- evidence --------------------------------------------------------------

describe('yunxiao evidence', () => {
  it('returns unknown because no CAS or idempotency token is documented', async () => {
    const adapter = makeAdapter(vi.fn())
    const observed = {} as RemoteItem
    expect(await adapter.evidence({} as never, observed, new AbortController().signal)).toBe('unknown')
  })
})

// --- metadata --------------------------------------------------------------

describe('yunxiao metadata', () => {
  function metadataFetch() {
    return route([
      { match: (u, m) => u.includes('/projects:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-projects.json'), 200, { 'x-page': '1', 'x-total-pages': '1' }) },
      { match: (u, m) => u.includes('/projects/space-1/members') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-members.json')) },
      { match: (u, m) => u.includes('/projects/space-1/sprints') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-sprints.json')) },
      { match: (u, m) => u.includes('/workitemTypes?category=') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-types.json')) },
      { match: (u, m) => u.includes('/workitemTypes/req-type-1/fields') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-fields.json')) },
      { match: (u, m) => u.includes('/workitemTypes/req-type-1/workflows') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-workflow.json')) },
    ])
  }

  it('lists projects when no project scope is provided', async () => {
    const adapter = makeAdapter(metadataFetch())
    const meta = await adapter.metadata({ connectionId: 'conn-1' }, new AbortController().signal)
    expect(meta.credentialPresent).toBe(true)
    expect(meta.projects).toEqual([{ id: 'space-1', label: 'Project One' }])
    expect(meta.typeCapabilities).toEqual([])
  })

  it('omits the conditions field from projects:search when unrestricted', async () => {
    let body: Record<string, unknown> = {}
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/projects:search') && init?.method === 'POST') {
        body = JSON.parse((init.body as string) ?? '{}') as Record<string, unknown>
        return jsonResponse(fixture('yunxiao-center-projects.json'), 200, { 'x-page': '1', 'x-total-pages': '1' })
      }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    await adapter.metadata({ connectionId: 'conn-1' }, new AbortController().signal)
    expect('conditions' in body).toBe(false)
    expect(body.page).toBe(1)
    expect(body.perPage).toBe(200)
  })

  it('returns full type capabilities for a project and type', async () => {
    const adapter = makeAdapter(metadataFetch())
    const meta = await adapter.metadata({ connectionId: 'conn-1', projectId: 'space-1', typeId: 'req-type-1' }, new AbortController().signal)
    expect(meta.members).toEqual([{ id: 'user-1', label: 'Alice' }, { id: 'user-2', label: 'Bob' }])
    expect(meta.iterations).toEqual([{ id: 'sprint-1', label: 'Sprint 1' }, { id: 'sprint-2', label: 'Sprint 2' }])
    expect(meta.types).toEqual([{ id: 'req-type-1', label: 'Requirement' }])
    expect(meta.typeCapabilities).toHaveLength(1)
    const caps = meta.typeCapabilities[0]!
    expect(caps.fields).toEqual(['title', 'description', 'status'])
    expect(caps.readStates).toEqual([{ id: 'todo', label: 'To Do' }, { id: 'doing', label: 'In Progress' }, { id: 'done', label: 'Done' }])
    expect(caps.writeStates).toEqual(caps.readStates)
    expect(caps.workflow).toEqual({ readOnly: false })
    expect(caps.paging).toEqual({ kind: 'page' })
    expect(caps.candidateFields).toEqual([])
  })

  it('disables the status capability when the workflow exposes no state candidates', async () => {
    const fetch = route([
      { match: (u, m) => u.includes('/projects:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-projects.json'), 200, { 'x-page': '1', 'x-total-pages': '1' }) },
      { match: (u, m) => u.includes('/projects/space-1/members') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-members.json')) },
      { match: (u, m) => u.includes('/projects/space-1/sprints') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-sprints.json')) },
      { match: (u, m) => u.includes('/workitemTypes?category=') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-types.json')) },
      { match: (u, m) => u.includes('/workitemTypes/req-type-1/fields') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-fields.json')) },
      { match: (u, m) => u.includes('/workitemTypes/req-type-1/workflows') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-workflow-empty.json')) },
    ])
    const adapter = makeAdapter(fetch)
    const meta = await adapter.metadata({ connectionId: 'conn-1', projectId: 'space-1', typeId: 'req-type-1' }, new AbortController().signal)
    const caps = meta.typeCapabilities[0]!
    expect(caps.readStates).toEqual([])
    expect(caps.writeStates).toEqual([])
    expect(caps.workflow).toEqual({ readOnly: true })
  })
})

// --- OptionalFieldCandidate closed validator -------------------------------

describe('OptionalFieldCandidate closed validator', () => {
  const connectionId = 'conn-1'
  const baseCaps = {
    typeId: 'req-type-1',
    fields: ['title', 'description', 'status'],
    readStates: [{ id: 'todo', label: 'To Do' }],
    writeStates: [],
    representation: { format: 'richtext', roundTrip: true },
    paging: { kind: 'page' },
    workflow: { readOnly: false },
    candidateFields: [],
  }
  function validMetadata(candidateFields: unknown) {
    return {
      connectionId, credentialPresent: true, readOnly: false,
      projects: [], members: [], iterations: [], types: [{ id: 'req-type-1', label: 'Requirement' }],
      typeCapabilities: [{ ...baseCaps, candidateFields }],
    }
  }

  it('accepts a typed candidate field and rejects arbitrary raw objects or unknown keys', () => {
    const valid = [{ field: 'priority', remoteId: 'field-priority', format: 'priority', writable: true }]
    expect(parseSyncResponse('getSyncMetadata', validMetadata(valid)).method).toBe('getSyncMetadata')
    expect(() => parseSyncResponse('getSyncMetadata', validMetadata([{ ...valid[0], extra: 'raw' }]))).toThrow()
    expect(() => parseSyncResponse('getSyncMetadata', validMetadata([{ field: 'bogus', remoteId: 'x', format: 'x', writable: true }]))).toThrow()
    expect(() => parseSyncResponse('getSyncMetadata', validMetadata('raw'))).toThrow()
  })
})
