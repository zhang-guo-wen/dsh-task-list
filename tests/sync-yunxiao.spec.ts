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
    conditions: [[{ field: 'workitemType', operator: 'EQUALS', value: ['req-type-1'] }]], statusWriteStates: { todo: 'open', in_progress: 'doing', done: 'done' },
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

/** The decoded description's blocks flattened to text, in order: heading, labelled lines, body. */
function packedBlocks(item: RemoteItem): { type: string; text: string }[] {
  const field = item.fields.description
  if (field.presence !== 'value') return []
  return field.value.blocks.map(block => {
    if (block.type === 'attachment') return { type: block.type, text: block.name }
    if (block.type === 'table') return { type: block.type, text: '' }
    return { type: block.type, text: block.children.map(child => child.text).join('') }
  })
}

/** A fetch mock that answers every search with an empty page and records the posted bodies. */
function captureSearchBodies(): { fetch: ReturnType<typeof vi.fn>; bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = []
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/workitems:search') && init?.method === 'POST') {
      bodies.push(JSON.parse((init.body as string) ?? '{}') as Record<string, unknown>)
    }
    return jsonResponse([], 200, { 'x-page': '1', 'x-total-pages': '1' })
  })
  return { fetch, bodies }
}

/** Discover a search whose rows and detail bodies are both caller-supplied. */
async function collectRawDetails(details: Record<string, unknown>, rule: SyncRule): Promise<{ items: RemoteItem[]; bodies: Record<string, unknown>[] }> {
  const bodies: Record<string, unknown>[] = []
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url.includes('/workitems:search') && method === 'POST') {
      bodies.push(JSON.parse((init.body as string) ?? '{}') as Record<string, unknown>)
      return jsonResponse(
        Object.keys(details).map(id => ({ id, space: { id: 'space-1' }, workitemType: { id: 'req-type-1' } })),
        200, { 'x-page': '1', 'x-total-pages': '1' },
      )
    }
    const match = url.match(/\/workitems\/([^/?]+)$/)
    const id = match?.[1]
    if (id !== undefined && method === 'GET') {
      const detail = details[id]
      if (detail === undefined) throw new Error('no detail for ' + id)
      return jsonResponse(detail)
    }
    throw new Error('unexpected ' + method + ' ' + url)
  })
  const items = await collectDiscover(makeAdapter(fetch), rule)
  return { items, bodies }
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
    const { fetch, bodies } = captureSearchBodies()
    await collectDiscover(makeAdapter(fetch), yunxiaoRule())
    const body = bodies[0]!
    expect(body.spaceId).toBe('space-1')
    expect(body.category).toBe('Req,Bug,Task')
    expect(body.page).toBe(1)
    expect(body.perPage).toBe(200)
    expect(body.orderBy).toBe('gmtCreate')
    expect(body.sort).toBe('asc')
  })

  it('sends the rule query as a conditions JSON string whose group carries the rule fields', async () => {
    const { fetch, bodies } = captureSearchBodies()
    await collectDiscover(makeAdapter(fetch), yunxiaoRule())
    expect(JSON.parse(bodies[0]!.conditions as string)).toEqual({
      conditionGroups: [[{
        fieldIdentifier: 'workitemType', operator: 'EQUALS', value: ['req-type-1'],
        toValue: null, className: 'workitemType', format: 'list',
      }]],
    })
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

  it('reads every search row detail because type filtering happens on the platform', async () => {
    const rows = [
      { id: '2000000000000000001', typeId: 'req-type-1' },
      { id: '2000000000000000002', typeId: 'bug-type-1' },
    ]
    let detailReads = 0
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/workitems:search') && method === 'POST') {
        return jsonResponse(rows.map(row => ({ id: row.id, space: { id: 'space-1' }, workitemType: { id: row.typeId } })), 200, { 'x-page': '1', 'x-total-pages': '1' })
      }
      const match = url.match(/\/workitems\/([^/?]+)$/)
      const id = match?.[1]
      const row = rows.find(entry => entry.id === id)
      if (row !== undefined && method === 'GET') {
        detailReads += 1
        return jsonResponse(filterDetail(row.id, row.typeId, { id: 'user-1', name: 'Alice' }, { id: 'sprint-1', name: 'Sprint 1' }, 'doing'))
      }
      throw new Error('unexpected ' + method + ' ' + url)
    })
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, yunxiaoRule())
    expect(items.map(item => item.key.id)).toEqual(['2000000000000000001', '2000000000000000002'])
    expect(detailReads).toBe(2)
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

  const assigneeRule = () => yunxiaoRule({ conditions: [[{ field: 'assignedTo', operator: 'EQUALS', value: ['user-1'] }]] })
  const sprintRule = () => yunxiaoRule({ conditions: [[{ field: 'sprint', operator: 'CONTAINS', value: ['sprint-1'] }]] })

  it('sends the combined assignee and sprint conditions as one AND group', async () => {
    const { fetch, bodies } = captureSearchBodies()
    const rule = yunxiaoRule({ conditions: [[
      { field: 'assignedTo', operator: 'EQUALS', value: ['user-1'] },
      { field: 'sprint', operator: 'CONTAINS', value: ['sprint-2'] },
    ]] })
    await collectDiscover(makeAdapter(fetch), rule)
    const parsed = JSON.parse(bodies[0]!.conditions as string) as { conditionGroups: Record<string, unknown>[][] }
    expect(parsed.conditionGroups).toHaveLength(1)
    expect(parsed.conditionGroups[0]).toHaveLength(2)
    expect(parsed.conditionGroups[0]![0]).toMatchObject({ fieldIdentifier: 'assignedTo', operator: 'EQUALS', value: ['user-1'] })
    expect(parsed.conditionGroups[0]![1]).toMatchObject({ fieldIdentifier: 'sprint', operator: 'CONTAINS', value: ['sprint-2'] })
  })

  it('sends a multi-value condition as one OR set of values', async () => {
    const { fetch, bodies } = captureSearchBodies()
    await collectDiscover(makeAdapter(fetch), yunxiaoRule({ conditions: [[{ field: 'assignedTo', operator: 'EQUALS', value: ['user-1', 'user-2'] }]] }))
    const parsed = JSON.parse(bodies[0]!.conditions as string) as { conditionGroups: Record<string, unknown>[][] }
    expect(parsed.conditionGroups).toHaveLength(1)
    expect(parsed.conditionGroups[0]).toHaveLength(1)
    expect(parsed.conditionGroups[0]![0]).toMatchObject({ fieldIdentifier: 'assignedTo', operator: 'EQUALS', value: ['user-1', 'user-2'] })
  })

  it('omits conditions entirely for an empty rule query', async () => {
    const { fetch, bodies } = captureSearchBodies()
    await collectDiscover(makeAdapter(fetch), yunxiaoRule({ conditions: [] }))
    expect(bodies).toHaveLength(1)
    expect('conditions' in bodies[0]!).toBe(false)
  })

  it('sends the assignee condition to the platform instead of excluding a detail without one', async () => {
    const { items, bodies } = await collectRawDetails({
      a1: filterDetail('a1', 'req-type-1', ABSENT, { id: 'sprint-1' }, 'doing'),
      a2: filterDetail('a2', 'req-type-1', { name: 'Alice' }, { id: 'sprint-1' }, 'doing'),
      a3: filterDetail('a3', 'req-type-1', null, { id: 'sprint-1' }, 'doing'),
    }, assigneeRule())
    expect(JSON.parse(bodies[0]!.conditions as string)).toMatchObject({
      conditionGroups: [[{ fieldIdentifier: 'assignedTo', operator: 'EQUALS', value: ['user-1'] }]],
    })
    expect(items.map(item => item.key.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('sends the sprint condition to the platform instead of excluding a detail without one', async () => {
    const { items, bodies } = await collectRawDetails({
      s1: filterDetail('s1', 'req-type-1', { id: 'user-1' }, ABSENT, 'doing'),
      s2: filterDetail('s2', 'req-type-1', { id: 'user-1' }, { name: 'Sprint 1' }, 'doing'),
      s3: filterDetail('s3', 'req-type-1', { id: 'user-1' }, null, 'doing'),
    }, sprintRule())
    expect(JSON.parse(bodies[0]!.conditions as string)).toMatchObject({
      conditionGroups: [[{ fieldIdentifier: 'sprint', operator: 'CONTAINS', value: ['sprint-1'] }]],
    })
    expect(items.map(item => item.key.id)).toEqual(['s1', 's2', 's3'])
  })

  it('packs a canonical detail fixture, including its official assignedTo, into the description', async () => {
    const fetch = route([
      { match: (u, m) => u.includes('/workitems:search') && m === 'POST', respond: () => jsonResponse(fixture('yunxiao-center-search.json'), 200, { 'x-page': '1', 'x-total-pages': '1' }) },
      { match: (u, m) => u.endsWith('/workitems/1000000000000000001') && m === 'GET', respond: () => jsonResponse(fixture('yunxiao-center-detail.json')) },
    ])
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, yunxiaoRule({ conditions: [[{ field: 'assignedTo', operator: 'EQUALS', value: ['user-1'] }]] }))
    expect(items.map(item => item.key.id)).toEqual(['1000000000000000001'])
    const blocks = packedBlocks(items[0]!)
    expect(blocks[0]).toEqual({ type: 'heading', text: 'PROJ-1 Implement sync adapter' })
    const meta = blocks.find(block => block.text.includes('Status: '))
    expect(meta?.text).toContain('Status: In Progress')
    expect(meta?.text).toContain('Assignee: Alice')
    expect(meta?.text).toContain('Type: Requirement')
    expect(blocks.at(-1)?.text).toBe('Body bold')
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
    const blocks = packedBlocks(item)
    expect(blocks[0]?.type).toBe('heading')
    expect(blocks[0]?.text.startsWith('PROJ-1')).toBe(true)
    expect(blocks.some(block => block.text.includes('Status: '))).toBe(true)
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
    const unmapped = yunxiaoRule({ statusWriteStates: { todo: 'open', in_progress: 'progressing', done: 'done' } })
    expect(detailCode(await captureRejection(adapter.read(KEY, unmapped, new AbortController().signal)))).toBe('MappingIncompatible')
  })

  it('retains a giant numeric id as a string', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/workitems/9223372036854775807123456789')) return jsonResponse(fixture('yunxiao-center-detail-giant.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    // The giant fixture reports the platform's own `todo` status id, so the rule maps it directly.
    const rule = yunxiaoRule({ statusWriteStates: { todo: 'todo', in_progress: 'doing', done: 'done' } })
    const item = await adapter.read({ ...KEY, id: '9223372036854775807123456789' }, rule, new AbortController().signal)
    expect(item.key.id).toBe('9223372036854775807123456789')
    expect(item.fields.status).toMatchObject({ presence: 'value', value: 'todo' })
    expect(packedBlocks(item)[0]?.text).toBe('GIANT-1 Giant id item')
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
  it('PUTs the mapped status id and no other field, without reading back an entity', async () => {
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
    await adapter.write(KEY, { status: 'done' }, observed, yunxiaoRule(), new AbortController().signal)
    expect(puts).toHaveLength(1)
    expect(puts[0]!.method).toBe('PUT')
    // The observed `doing` does not map to `done`, so the rule's target is what the platform receives.
    expect(JSON.parse(puts[0]!.body)).toEqual({ status: 'done' })
    expect(fetch).toHaveBeenCalledTimes(2) // read + write, no read-back
  })

  it('preserves the observed raw status when it already equals the target', async () => {
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
    expect(observed.rawStatus).toBe('doing')
    await adapter.write(KEY, { status: 'in_progress' }, observed, yunxiaoRule(), new AbortController().signal)
    // `in_progress` maps to the observed `doing`; no description, subject or formatType is sent.
    expect(JSON.parse(puts[0]!)).toEqual({ status: 'doing' })
  })

  it('refuses to write any field other than status', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001') && (init?.method ?? 'GET') === 'GET') return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + (init?.method ?? 'GET') + ' ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    const refuse = async (patch: Parameters<SyncAdapter['write']>[1]): Promise<void> => {
      const err = await captureRejection(adapter.write(KEY, patch, observed, yunxiaoRule(), new AbortController().signal))
      expect(detailCode(err)).toBe('MappingIncompatible')
    }
    await refuse({ title: 'New title' })
    await refuse({ priority: 'high' })
    await refuse({ description: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'new' }] }] } })
    await refuse({ tags: ['a'], status: 'done' }) // a mixed patch is refused whole, never partially written
    expect(fetch).toHaveBeenCalledTimes(1) // only the read; no field other than status is ever written
  })

  it('never writes a description, even when the observed representation is not lossless', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001')) return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    const lossy = { ...observed, description: { ...observed.description, roundTrip: false } }
    const err = await captureRejection(adapter.write(KEY, { description: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'x' }] }] } }, lossy, yunxiaoRule(), new AbortController().signal))
    expect(detailCode(err)).toBe('MappingIncompatible')
    expect(fetch).toHaveBeenCalledTimes(1) // only the read, no PUT
  })

  it('treats a 204 empty-body write as success without a read entity', async () => {
    let putCount = 0
    const bodies: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workitems/1000000000000000001') && init?.method === 'PUT') {
        putCount += 1
        bodies.push((init.body as string) ?? '')
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/workitems/1000000000000000001')) return jsonResponse(fixture('yunxiao-center-detail.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(KEY, yunxiaoRule(), new AbortController().signal)
    await adapter.write(KEY, { status: 'done' }, observed, yunxiaoRule(), new AbortController().signal)
    expect(putCount).toBe(1)
    expect(JSON.parse(bodies[0]!)).toEqual({ status: 'done' })
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
