import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createTapdAdapter } from '../src/sync/adapters/tapd.ts'
import { decodeTransitions } from '../src/sync/adapters/tapd-codec.ts'
import { SyncTransport } from '../src/sync/transport.ts'
import { projectRemote } from '../src/sync/snapshot.ts'
import type { Clock, RemoteItem, SafeConnection, SyncAdapter } from '../src/sync/types.ts'
import type { SyncRule, TypeMapping } from '../src/sync/dto.ts'

describe('application project credentials', () => {
  it('uses project Bearer credentials rather than a user OAuth token or API Basic fallback', async () => {
    const headers: unknown[] = []
    const transport = { read: async (request: any) => { headers.push(request.headers); return { value: { status: 1, data: [] }, headers: new Headers(), status: 200 } }, write: async () => { throw new Error('no writes') } }
    const adapter = createTapdAdapter(tapdConnection({ authentication: { mode: 'oauth' } }), transport, {}, { kind: 'tapd-project', token: 'application-token', projectIds: [WORKSPACE] })
    const metadata = await adapter.metadata({ connectionId: 'conn-1' }, new AbortController().signal)
    expect(metadata.projects).toEqual([{ id: WORKSPACE, label: WORKSPACE }])
    expect(headers).toHaveLength(0)
    const rule = typeRule('task')
    try { for await (const _page of adapter.discover(rule, new AbortController().signal)) break } catch { /* fixture only proves outbound auth */ }
    expect(headers[0]).toMatchObject({ authorization: 'Bearer application-token' })
  })
})

const COMPANY = '70000001'
const WORKSPACE = '20000001'
const USER = 'api-user'
const PASSWORD = 'api-secret'
const BASIC = `Basic ${btoa(`${USER}:${PASSWORD}`)}`

const STORY_SUBTYPE = '1152921504606846003'
const STORY_SUBTYPE_BPM = '1152921504606846004'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sync-api', name), 'utf8'))
}

function tapdConnection(overrides: Partial<SafeConnection> = {}): SafeConnection {
  return {
    id: 'conn-1', name: 'TAPD', enabled: true, revision: 1, credentialPresent: true, instance: 'api.tapd.cn',
    platform: 'tapd', companyId: COMPANY, userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS',
    ...overrides,
  } as SafeConnection
}

function makeMapping(typeId: string, category: 'story' | 'bug' | 'task', overrides: Partial<TypeMapping> = {}): TypeMapping {
  const readStates: Record<string, string> = category === 'bug'
    ? { new: 'todo', in_progress: 'in_progress', resolved: 'done' }
    : category === 'task'
      ? { open: 'todo', progressing: 'in_progress', in_progress: 'in_progress', done: 'done' }
      : { open: 'todo', in_progress: 'in_progress', done: 'done', progressing: 'in_progress' }
  const writeStates: Record<string, string> = category === 'bug'
    ? { todo: 'new', in_progress: 'in_progress', done: 'resolved' }
    : category === 'task'
      ? { todo: 'open', in_progress: 'progressing', done: 'done' }
      : { todo: 'open', in_progress: 'in_progress', done: 'done' }
  return {
    typeId, category,
    readStates, writeStates,
    optionalFields: [], fieldIds: {}, valueMaps: {},
    ...overrides,
  }
}

function typeRule(typeId: 'story' | 'bug' | 'task', overrides: Partial<SyncRule> = {}): SyncRule {
  return {
    id: 'rule-1', revision: 1, connectionId: 'conn-1', projectId: WORKSPACE, enabled: true, workspaceId: null,
    filters: { assignees: [], typeIds: [typeId], iterationIds: [], statusIds: [] },
    mappings: [makeMapping(typeId, typeId)],
    ...overrides,
  }
}

function subtypeRule(typeId: string, category: 'story' | 'bug' | 'task', overrides: Partial<SyncRule> = {}): SyncRule {
  return {
    id: 'rule-1', revision: 1, connectionId: 'conn-1', projectId: WORKSPACE, enabled: true, workspaceId: null,
    filters: { assignees: [], typeIds: [typeId], iterationIds: [], statusIds: [] },
    mappings: [makeMapping(typeId, category)],
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

function makeAdapter(fetch: ReturnType<typeof vi.fn>, connection = tapdConnection()): SyncAdapter {
  const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
  return createTapdAdapter(connection, transport, { TAPD_USER: USER, TAPD_PASS: PASSWORD })
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

function storyDetailResponse(): Response {
  return jsonResponse(fixture('tapd-story-detail.json'))
}

function storyDetailFor(workitemTypeId: string): Response {
  const base = (fixture('tapd-story-detail.json') as { data: Array<{ Story: Record<string, unknown> }> }).data[0]!.Story
  return jsonResponse({ status: 1, info: 'success', data: [{ Story: { ...base, workitem_type_id: workitemTypeId } }] })
}

const STORY_KEY = { instance: COMPANY, projectId: WORKSPACE, typeId: 'story', id: '1152921504606846976123' }
const BUG_KEY = { instance: COMPANY, projectId: WORKSPACE, typeId: 'bug', id: '1152921504606846977999' }
const TASK_KEY = { instance: COMPANY, projectId: WORKSPACE, typeId: 'task', id: '1152921504606846978333' }

// --- factory ---------------------------------------------------------------

describe('createTapdAdapter factory', () => {
  it('resolves Basic credentials from the referenced env vars and rejects missing ones before any network', () => {
    const fetch = vi.fn()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const err = capture(() => createTapdAdapter(tapdConnection(), transport, {}))
    expect(detailCode(err)).toBe('CredentialMissing')
    expect(fetch).not.toHaveBeenCalled()
    expect(createTapdAdapter(tapdConnection(), transport, { TAPD_USER: USER, TAPD_PASS: PASSWORD })).toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a non-tapd connection as an invalid configuration', () => {
    const fetch = vi.fn()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const wrong = { ...tapdConnection(), platform: 'yunxiao' } as SafeConnection
    const err = capture(() => createTapdAdapter(wrong, transport, { TAPD_USER: USER, TAPD_PASS: PASSWORD }))
    expect(detailCode(err)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends the HTTP Basic Authorization header on the first read', async () => {
    const seen: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') {
        seen.push((init?.headers as Headers).get('authorization') ?? '')
        return storyDetailResponse()
      }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    expect(seen).toEqual([BASIC])
  })
})

// --- read ------------------------------------------------------------------

describe('tapd read', () => {
  it('GETs detail by workspace_id + id, keeps ids as strings and modified as an opaque token', async () => {
    const seen: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') { seen.push(url); return storyDetailResponse() }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const item = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    expect(item.key.id).toBe('1152921504606846976123')
    expect(item.updatedToken).toBe('2026-10-07 12:00:00')
    expect(item.revisionToken).toBeNull()
    expect(item.fields.title).toMatchObject({ presence: 'value', value: 'Implement sync adapter' })
    expect(item.fields.status).toMatchObject({ presence: 'value', value: 'in_progress' })
    expect(item.rawStatus).toBe('in_progress')
    expect(seen).toEqual(['https://api.tapd.cn/stories?workspace_id=20000001&id=1152921504606846976123'])
  })

  it('returns a status projectRemote accepts with a single read (no hidden cache)', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const item = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    expect(projectRemote(item, typeRule('story')).status).toBe('in_progress')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('uses title/current_owner for bugs and name/owner for tasks', async () => {
    const bugFetch = vi.fn(async () => jsonResponse(fixture('tapd-bug-detail.json')))
    const bugAdapter = makeAdapter(bugFetch)
    const bug = await bugAdapter.read(BUG_KEY, typeRule('bug'), new AbortController().signal)
    expect(bug.fields.title).toMatchObject({ presence: 'value', value: 'Fix crash on save' })
    expect(bug.rawStatus).toBe('in_progress')

    const taskFetch = vi.fn(async () => jsonResponse(fixture('tapd-task-detail.json')))
    const taskAdapter = makeAdapter(taskFetch)
    const task = await taskAdapter.read(TASK_KEY, typeRule('task'), new AbortController().signal)
    expect(task.fields.title).toMatchObject({ presence: 'value', value: 'Write regression tests' })
    expect(task.rawStatus).toBe('open')
  })

  it('throws MappingIncompatible when the raw status is not mapped by the rule', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const unmapped = typeRule('story', { mappings: [{ ...typeRule('story').mappings[0]!, readStates: { done: 'done' } }] })
    expect(detailCode(await captureRejection(adapter.read(STORY_KEY, unmapped, new AbortController().signal)))).toBe('MappingIncompatible')
  })

  it('rejects a non-array or wrong-wrapper collection shape', async () => {
    const shapes = [
      { status: 1, info: 'success', data: { Story: { id: '1' } } },
      { status: 1, info: 'success', data: [{ Bug: { id: '1' } }] },
      { status: 1, info: 'success', data: [{ Story: 'not-an-object' }] },
    ]
    for (const shape of shapes) {
      const fetch = vi.fn(async () => jsonResponse(shape))
      const adapter = makeAdapter(fetch)
      expect(detailCode(await captureRejection(adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)))).toBe('InvalidRemoteResponse')
    }
  })

  it('rejects a detail with zero or more than one item', async () => {
    const empty = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [] }))
    const emptyAdapter = makeAdapter(empty)
    expect(detailCode(await captureRejection(emptyAdapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)))).toBe('RemoteUnavailable')

    const multi = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [{ Story: { id: '1' } }, { Story: { id: '2' } }] }))
    const multiAdapter = makeAdapter(multi)
    expect(detailCode(await captureRejection(multiAdapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })

  it('rejects a cross-workspace item whose workspace_id does not match the key', async () => {
    const wrong = { status: 1, info: 'success', data: [{ Story: { ...(fixture('tapd-story-detail.json') as { data: Array<{ Story: object }> }).data[0]!.Story, workspace_id: '99999999' } }] }
    const fetch = vi.fn(async () => jsonResponse(wrong))
    const adapter = makeAdapter(fetch)
    expect(detailCode(await captureRejection(adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })

  it('rejects a numeric or object workspace_id instead of ignoring it', async () => {
    const base = (fixture('tapd-story-detail.json') as { data: Array<{ Story: Record<string, unknown> }> }).data[0]!.Story
    for (const workspaceId of [20000001, { id: '20000001' }]) {
      const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [{ Story: { ...base, workspace_id: workspaceId } }] }))
      const adapter = makeAdapter(fetch)
      expect(detailCode(await captureRejection(adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)))).toBe('InvalidRemoteResponse')
    }
  })

  it('classifies read business failures and never echoes the upstream info string', async () => {
    const secret = 'topsecret-info-value-xyz'
    const cases: Array<{ info: string; code: string }> = [
      { info: 'no permission to access this resource', code: 'AuthDenied' },
      { info: 'invalid parameter: workspace_id', code: 'InvalidRemoteResponse' },
      { info: 'api not enabled for this account', code: 'EntitlementUnavailable' },
      { info: secret, code: 'InvalidRemoteResponse' },
    ]
    for (const { info, code } of cases) {
      const fetch = vi.fn(async () => jsonResponse({ status: 0, info, data: [] }))
      const adapter = makeAdapter(fetch)
      const err = await captureRejection(adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal))
      expect(detailCode(err)).toBe(code)
      expect(JSON.stringify(err)).not.toContain(secret)
    }
  })

  it('treats a giant numeric id as a string and never coerces it to Number', async () => {
    const giant = '9223372036854775807123456789'
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes(giant)) {
        const base = (fixture('tapd-story-detail.json') as { data: Array<{ Story: object }> }).data[0]!.Story as Record<string, unknown>
        return jsonResponse({ status: 1, info: 'success', data: [{ Story: { ...base, id: giant } }] })
      }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const item = await adapter.read({ ...STORY_KEY, id: giant }, typeRule('story'), new AbortController().signal)
    expect(item.key.id).toBe(giant)
  })
})

// --- optional field read ---------------------------------------------------

describe('tapd optional field read', () => {
  it('decodes an enabled priority and tags through unambiguous inverse maps and projects them', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { mappings: [{ ...typeRule('story').mappings[0]!, optionalFields: ['priority', 'tags'], valueMaps: { priority: { low: 'Low', medium: 'Middle', high: 'High', urgent: 'Urgent' }, tags: { sync: 'sync', backend: 'backend', ui: 'ui' } } }] })
    const item = await adapter.read(STORY_KEY, rule, new AbortController().signal)
    expect(item.fields.priority).toMatchObject({ presence: 'value', value: 'high', writable: true })
    expect(item.fields.tags).toMatchObject({ presence: 'value', value: ['sync', 'backend'], writable: true })
    const remote = projectRemote(item, rule)
    expect(remote.priority).toBe('high')
    expect(remote.tags).toEqual(['sync', 'backend'])
  })

  it('fails MappingIncompatible when two local priorities map to one remote label (ambiguous inverse)', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { mappings: [{ ...typeRule('story').mappings[0]!, optionalFields: ['priority'], valueMaps: { priority: { high: 'High', urgent: 'High', low: 'Low', medium: 'Middle' } } }] })
    expect(detailCode(await captureRejection(adapter.read(STORY_KEY, rule, new AbortController().signal)))).toBe('MappingIncompatible')
  })

  it('fails MappingIncompatible on an unknown remote priority label instead of defaulting to medium', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { mappings: [{ ...typeRule('story').mappings[0]!, optionalFields: ['priority'], valueMaps: { priority: { low: 'Low', medium: 'Middle' } } }] })
    expect(detailCode(await captureRejection(adapter.read(STORY_KEY, rule, new AbortController().signal)))).toBe('MappingIncompatible')
  })

  it('fails MappingIncompatible on an unknown remote tag token', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { mappings: [{ ...typeRule('story').mappings[0]!, optionalFields: ['tags'], valueMaps: { tags: { sync: 'sync' } } }] })
    expect(detailCode(await captureRejection(adapter.read(STORY_KEY, rule, new AbortController().signal)))).toBe('MappingIncompatible')
  })

  it('keeps disabled priority and tags absent with no value propagation', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const item = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    expect(item.fields.priority).toEqual({ presence: 'absent', writable: false })
    expect(item.fields.tags).toEqual({ presence: 'absent', writable: false })
    expect(projectRemote(item, typeRule('story')).priority).toBe('medium')
    expect(projectRemote(item, typeRule('story')).tags).toEqual([])
  })
})

// --- discover --------------------------------------------------------------

describe('tapd discover', () => {
  it('lists with workspace_id, limit=200, order=id desc and page, then decodes the collection', async () => {
    const params: URLSearchParams[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') {
        params.push(new URL(url).searchParams)
        return jsonResponse(fixture('tapd-stories-list.json'))
      }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, typeRule('story'))
    expect(items).toHaveLength(2)
    expect(items[0]?.key.id).toBe('1152921504606846976123')
    expect(params[0]?.get('workspace_id')).toBe(WORKSPACE)
    expect(params[0]?.get('limit')).toBe('200')
    expect(params[0]?.get('order')).toBe('id desc')
    expect(params[0]?.get('page')).toBe('1')
  })

  it('stops after a short first page without requesting a cursor page', async () => {
    let calls = 0
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes('/stories')) throw new Error('unexpected ' + url)
      calls += 1
      if (calls === 1) return jsonResponse(fixture('tapd-stories-list.json'))
      throw new Error('should not fetch a second page for a short page')
    })
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, typeRule('story'))
    expect(items).toHaveLength(2)
    expect(calls).toBe(1)
  })

  it('reports IncompleteDiscovery when a full page repeats its cursor without advancing', async () => {
    const item = (fixture('tapd-stories-list.json') as { data: Array<{ Story: object }> }).data[0]!.Story
    const fullPage = Array.from({ length: 200 }, (_, i) => ({ Story: { ...item, id: `1000000000000000${1000 - i}` } }))
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: fullPage }))
    const adapter = makeAdapter(fetch)
    expect(detailCode(await captureRejection(collectDiscover(adapter, typeRule('story'))))).toBe('IncompleteDiscovery')
  })

  it('continues past page 100 with an id cursor and completes 20001 items across 101 pages', async () => {
    const TOTAL = 20_001
    const seenUrls: string[] = []
    let calls = 0
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      seenUrls.push(url)
      calls += 1
      const start = TOTAL - (calls - 1) * 200
      const count = Math.min(200, TOTAL - (calls - 1) * 200)
      const rows = Array.from({ length: count }, (_, i) => ({ Story: { workspace_id: WORKSPACE, name: 'Item', status: 'open', id: String(start - i) } }))
      return jsonResponse({ status: 1, info: 'success', data: rows })
    })
    const adapter = makeAdapter(fetch)
    const items = await collectDiscover(adapter, typeRule('story'))
    expect(items).toHaveLength(TOTAL)
    expect(calls).toBe(101)
    expect(new URL(seenUrls[0]!).searchParams.get('page')).toBe('1')
    expect(new URL(seenUrls[0]!).searchParams.has('cursor')).toBe(false)
    expect(new URL(seenUrls[1]!).searchParams.get('cursor')).toBe(String(TOTAL - 199))
    expect(new URL(seenUrls[1]!).searchParams.has('page')).toBe(false)
  })

  it('rejects a server page that returns more than the requested limit', async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ Story: { workspace_id: WORKSPACE, name: 'Item', status: 'open', id: String(300 - i) } }))
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: rows }))
    const adapter = makeAdapter(fetch)
    expect(detailCode(await captureRejection(collectDiscover(adapter, typeRule('story'))))).toBe('InvalidRemoteResponse')
  })

  it('applies the assignee/iteration/status/type filter dimensions with AND across dimensions and OR within', async () => {
    const item = (fixture('tapd-stories-list.json') as { data: Array<{ Story: object }> }).data[0]!.Story as Record<string, unknown>
    const rows = [
      { ...item, id: '1', owner: 'alice', iteration_id: 'it1', status: 'open' },
      { ...item, id: '2', owner: 'alice', iteration_id: 'it2', status: 'in_progress' },
      { ...item, id: '3', owner: 'bob', iteration_id: 'it1', status: 'open' },
      { ...item, id: '4', owner: 'alice', iteration_id: 'it1', status: 'in_progress' },
    ]
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: rows.map(r => ({ Story: r })) }))
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { filters: { assignees: ['alice', 'bob'], typeIds: ['story'], iterationIds: ['it1'], statusIds: ['open'] } })
    const items = await collectDiscover(adapter, rule)
    expect(items.map(i => i.key.id)).toEqual(['1', '3'])
  })

  it('errors instead of silently zeroing when an assignee filter is set and owner is absent or empty', async () => {
    const item = (fixture('tapd-stories-list.json') as { data: Array<{ Story: object }> }).data[0]!.Story as Record<string, unknown>
    for (const owner of [undefined, '']) {
      const row: Record<string, unknown> = { ...item, id: '1', status: 'open' }
      if (owner === undefined) delete row.owner
      else row.owner = owner
      const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [{ Story: row }] }))
      const adapter = makeAdapter(fetch)
      const rule = typeRule('story', { filters: { assignees: ['alice'], typeIds: [], iterationIds: [], statusIds: [] } })
      expect(detailCode(await captureRejection(collectDiscover(adapter, rule)))).toBe('InvalidRemoteResponse')
    }
  })

  it('excludes an item whose owner is explicitly null under an assignee filter', async () => {
    const item = (fixture('tapd-stories-list.json') as { data: Array<{ Story: object }> }).data[0]!.Story as Record<string, unknown>
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [{ Story: { ...item, id: '1', owner: null, status: 'open' } }] }))
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { filters: { assignees: ['alice'], typeIds: [], iterationIds: [], statusIds: [] } })
    expect((await collectDiscover(adapter, rule)).map(i => i.key.id)).toEqual([])
  })
})

// --- story subtype scoping -------------------------------------------------

describe('tapd story subtype scoping', () => {
  it('skips stories of other subtypes and keeps matching ones during discovery', async () => {
    const base = (fixture('tapd-stories-list.json') as { data: Array<{ Story: Record<string, unknown> }> }).data[0]!.Story
    const rows = [
      { ...base, id: '1', workitem_type_id: STORY_SUBTYPE },
      { ...base, id: '2', workitem_type_id: STORY_SUBTYPE_BPM },
      { ...base, id: '3', workitem_type_id: STORY_SUBTYPE },
    ]
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: rows.map(r => ({ Story: r })) }))
    const adapter = makeAdapter(fetch)
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    const items = await collectDiscover(adapter, rule)
    expect(items.map(i => i.key.id)).toEqual(['1', '3'])
  })

  it('errors during discovery when an enabled story subtype item omits workitem_type_id', async () => {
    const base = (fixture('tapd-stories-list.json') as { data: Array<{ Story: Record<string, unknown> }> }).data[0]!.Story as Record<string, unknown>
    const row: Record<string, unknown> = { ...base, id: '1' }
    delete row.workitem_type_id
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [{ Story: row }] }))
    const adapter = makeAdapter(fetch)
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    expect(detailCode(await captureRejection(collectDiscover(adapter, rule)))).toBe('InvalidRemoteResponse')
  })

  it('rejects a story subtype read whose item omits workitem_type_id', async () => {
    const base = (fixture('tapd-story-detail.json') as { data: Array<{ Story: Record<string, unknown> }> }).data[0]!.Story as Record<string, unknown>
    const row: Record<string, unknown> = { ...base }
    delete row.workitem_type_id
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [{ Story: row }] }))
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    expect(detailCode(await captureRejection(adapter.read(key, rule, new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })

  it('rejects a story subtype read whose item has a mismatched workitem_type_id', async () => {
    const base = (fixture('tapd-story-detail.json') as { data: Array<{ Story: Record<string, unknown> }> }).data[0]!.Story as Record<string, unknown>
    const row: Record<string, unknown> = { ...base, workitem_type_id: STORY_SUBTYPE_BPM }
    const fetch = vi.fn(async () => jsonResponse({ status: 1, info: 'success', data: [{ Story: row }] }))
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    expect(detailCode(await captureRejection(adapter.read(key, rule, new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })
})

// --- write -----------------------------------------------------------------

describe('tapd write', () => {
  it('POSTs a sparse form body with workspace_id, id and only the patched title field', async () => {
    const posts: { url: string; method: string; body: string; contentType: string }[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && init?.method === 'POST') {
        posts.push({ url, method: init.method, body: (init.body as string) ?? '', contentType: (init?.headers as Headers).get('content-type') ?? '' })
        return jsonResponse(fixture('tapd-story-update.json'))
      }
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    await adapter.write(STORY_KEY, { title: 'Updated title' }, observed, typeRule('story'), new AbortController().signal)
    expect(posts).toHaveLength(1)
    expect(posts[0]!.method).toBe('POST')
    expect(posts[0]!.contentType).toBe('application/x-www-form-urlencoded')
    const body = new URLSearchParams(posts[0]!.body)
    expect(body.get('workspace_id')).toBe(WORKSPACE)
    expect(body.get('id')).toBe('1152921504606846976123')
    expect(body.get('name')).toBe('Updated title')
    expect(body.has('status')).toBe(false)
    expect(body.has('description')).toBe(false)
  })

  it('encodes description as richtext and refuses a lossy observed representation', async () => {
    const posts: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && init?.method === 'POST') { posts.push((init.body as string) ?? ''); return jsonResponse(fixture('tapd-story-update.json')) }
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    await adapter.write(STORY_KEY, { description: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'new body' }] }] } }, observed, typeRule('story'), new AbortController().signal)
    const body = new URLSearchParams(posts[0]!)
    expect(body.get('description')).toBe('<p>new body</p>')

    const lossy = { ...observed, description: { ...observed.description, roundTrip: false } }
    const err = await captureRejection(adapter.write(STORY_KEY, { description: { version: 1, blocks: [] } }, lossy, typeRule('story'), new AbortController().signal))
    expect(detailCode(err)).toBe('UnsupportedRepresentation')
  })

  it('POSTs mapped priority and tags joined by pipe without inventing labels', async () => {
    const posts: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && init?.method === 'POST') { posts.push((init.body as string) ?? ''); return jsonResponse(fixture('tapd-story-update.json')) }
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { mappings: [{ ...typeRule('story').mappings[0]!, optionalFields: ['priority', 'tags'], valueMaps: { priority: { high: 'High', medium: 'Middle', low: 'Low', urgent: 'Urgent' }, tags: { backend: 'backend', sync: 'sync' } } }] })
    const observed = await adapter.read(STORY_KEY, rule, new AbortController().signal)
    await adapter.write(STORY_KEY, { priority: 'high', tags: ['backend', 'sync'] }, observed, rule, new AbortController().signal)
    const body = new URLSearchParams(posts[0]!)
    expect(body.get('priority_label')).toBe('High')
    expect(body.get('label')).toBe('backend|sync')
  })

  it('rejects an unmapped priority or tag without posting', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && init?.method === 'POST') throw new Error('should not POST')
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const rule = typeRule('story', { mappings: [{ ...typeRule('story').mappings[0]!, optionalFields: ['priority', 'tags'], valueMaps: { priority: { high: 'High', medium: 'Middle', urgent: 'Urgent' }, tags: { backend: 'backend', sync: 'sync' } } }] })
    const observed = await adapter.read(STORY_KEY, rule, new AbortController().signal)
    for (const patch of [{ priority: 'low' as const }, { tags: ['newtag'] as string[] }]) {
      const err = await captureRejection(adapter.write(STORY_KEY, patch, observed, rule, new AbortController().signal))
      expect(detailCode(err)).toBe('MappingIncompatible')
    }
  })

  it('rejects a storyPoints write because no proven field exists', async () => {
    const fetch = vi.fn(async () => storyDetailResponse())
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    const err = await captureRejection(adapter.write(STORY_KEY, { storyPoints: 3 }, observed, typeRule('story'), new AbortController().signal))
    expect(detailCode(err)).toBe('MappingIncompatible')
  })

  it('does not POST when the status target equals the observed raw status', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    await adapter.write(STORY_KEY, { status: 'in_progress' }, observed, typeRule('story'), new AbortController().signal)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('classifies a 2xx write business failure as AuthDenied on a permission info', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && init?.method === 'POST') return jsonResponse({ status: 0, info: 'no permission to update', data: {} })
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    const err = await captureRejection(adapter.write(STORY_KEY, { title: 'x' }, observed, typeRule('story'), new AbortController().signal))
    expect(detailCode(err)).toBe('AuthDenied')
  })

  it('checks the business status of a 2xx write and never reports a false void success', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stories') && init?.method === 'POST') return jsonResponse({ status: 0, info: 'rejected', data: {} })
      if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const observed = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
    const err = await captureRejection(adapter.write(STORY_KEY, { title: 'x' }, observed, typeRule('story'), new AbortController().signal))
    expect(detailCode(err)).toBe('WorkflowRejected')
  })

  it('interprets non-2xx write statuses without echoing the response body', async () => {
    const secret = 'topsecret-body-value'
    const cases: Array<{ status: number; code: string }> = [
      { status: 400, code: 'WorkflowRejected' },
      { status: 404, code: 'RemoteUnavailable' },
      { status: 429, code: 'WriteOutcomeUnknown' },
    ]
    for (const { status, code } of cases) {
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/stories') && init?.method === 'POST') return jsonResponse({ error: secret }, status)
        if (url.includes('/stories') && (init?.method ?? 'GET') === 'GET') return storyDetailResponse()
        throw new Error('unexpected ' + url)
      })
      const adapter = makeAdapter(fetch)
      const observed = await adapter.read(STORY_KEY, typeRule('story'), new AbortController().signal)
      const err = await captureRejection(adapter.write(STORY_KEY, { title: 'x' }, observed, typeRule('story'), new AbortController().signal))
      expect(detailCode(err)).toBe(code)
      expect(JSON.stringify(err)).not.toContain(secret)
    }
  })

  it('returns unknown evidence because TAPD documents no CAS or idempotency token', async () => {
    const adapter = makeAdapter(vi.fn())
    expect(await adapter.evidence({} as never, {} as RemoteItem, new AbortController().signal)).toBe('unknown')
  })
})

// --- workflow status writes ------------------------------------------------

describe('tapd workflow status writes', () => {
  it('writes a classic story status with is_auto_close_task=0 after verifying workflow and transition', async () => {
    const posts: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/stories') && method === 'POST') { posts.push((init?.body as string) ?? ''); return jsonResponse(fixture('tapd-story-update.json')) }
      if (url.includes('/stories') && method === 'GET') return storyDetailFor(STORY_SUBTYPE)
      if (url.includes('/workitem_types')) return jsonResponse(fixture('tapd-workitem-types.json'))
      if (url.includes('/workflows/all_transitions')) return jsonResponse(fixture('tapd-transitions-story.json'))
      if (url.includes('/workflows') && url.includes('system_name=story')) return jsonResponse(fixture('tapd-workflows-story.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    const observed = await adapter.read(key, rule, new AbortController().signal)
    await adapter.write(key, { status: 'done' }, observed, rule, new AbortController().signal)
    expect(posts).toHaveLength(1)
    const body = new URLSearchParams(posts[0]!)
    expect(body.get('status')).toBe('done')
    expect(body.get('is_auto_close_task')).toBe('0')
    expect(body.get('workspace_id')).toBe(WORKSPACE)
  })

  it('rejects a bpm story status write without posting', async () => {
    let posted = false
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/stories') && method === 'POST') { posted = true; throw new Error('should not POST') }
      if (url.includes('/stories') && method === 'GET') return storyDetailFor(STORY_SUBTYPE_BPM)
      if (url.includes('/workitem_types')) return jsonResponse(fixture('tapd-workitem-types.json'))
      if (url.includes('/workflows') && url.includes('system_name=story')) return jsonResponse(fixture('tapd-workflows-story.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE_BPM }
    const rule = subtypeRule(STORY_SUBTYPE_BPM, 'story')
    const observed = await adapter.read(key, rule, new AbortController().signal)
    const err = await captureRejection(adapter.write(key, { status: 'done' }, observed, rule, new AbortController().signal))
    expect(detailCode(err)).toBe('WorkflowRejected')
    expect(posted).toBe(false)
  })

  it('rejects a classic status write whose transition requires a mandatory field', async () => {
    let posted = false
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/stories') && method === 'POST') { posted = true; throw new Error('should not POST') }
      if (url.includes('/stories') && method === 'GET') return storyDetailFor(STORY_SUBTYPE)
      if (url.includes('/workitem_types')) return jsonResponse(fixture('tapd-workitem-types.json'))
      if (url.includes('/workflows/all_transitions')) return jsonResponse(fixture('tapd-transitions-story-required.json'))
      if (url.includes('/workflows') && url.includes('system_name=story')) return jsonResponse(fixture('tapd-workflows-story.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    const observed = await adapter.read(key, rule, new AbortController().signal)
    const err = await captureRejection(adapter.write(key, { status: 'done' }, observed, rule, new AbortController().signal))
    expect(detailCode(err)).toBe('WorkflowRejected')
    expect(posted).toBe(false)
  })

  it('rejects a status write when the story workflow id is unknown', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/stories') && method === 'GET') return storyDetailFor(STORY_SUBTYPE)
      if (url.includes('/workitem_types')) return jsonResponse(fixture('tapd-workitem-types.json'))
      if (url.includes('/workflows') && url.includes('system_name=story')) {
        return jsonResponse({ status: 1, info: 'success', data: [{ Workflow: { id: 'wf-other', workspace_id: WORKSPACE, system_name: 'story', is_default: '1', type: 'classic' } }] })
      }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    const observed = await adapter.read(key, rule, new AbortController().signal)
    const err = await captureRejection(adapter.write(key, { status: 'done' }, observed, rule, new AbortController().signal))
    expect(detailCode(err)).toBe('WorkflowRejected')
  })

  it('scopes all_transitions to the story subtype workitem_type_id', async () => {
    const posts: string[] = []
    const seenTransitions: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/stories') && method === 'POST') { posts.push((init?.body as string) ?? ''); return jsonResponse(fixture('tapd-story-update.json')) }
      if (url.includes('/stories') && method === 'GET') return storyDetailFor(STORY_SUBTYPE)
      if (url.includes('/workitem_types')) return jsonResponse(fixture('tapd-workitem-types.json'))
      if (url.includes('/workflows/all_transitions')) { seenTransitions.push(url); return jsonResponse(fixture('tapd-transitions-story.json')) }
      if (url.includes('/workflows') && url.includes('system_name=story')) return jsonResponse(fixture('tapd-workflows-story.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    const observed = await adapter.read(key, rule, new AbortController().signal)
    await adapter.write(key, { status: 'done' }, observed, rule, new AbortController().signal)
    expect(posts).toHaveLength(1)
    const params = new URL(seenTransitions[0]!).searchParams
    expect(params.get('workitem_type_id')).toBe(STORY_SUBTYPE)
    expect(params.get('system')).toBe('story')
  })

  it('rejects a classic transition gated by a top-level AuthorizedUser without posting', async () => {
    let posted = false
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/stories') && method === 'POST') { posted = true; throw new Error('should not POST') }
      if (url.includes('/stories') && method === 'GET') return storyDetailFor(STORY_SUBTYPE)
      if (url.includes('/workitem_types')) return jsonResponse(fixture('tapd-workitem-types.json'))
      if (url.includes('/workflows/all_transitions')) return jsonResponse({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', AuthorizedUser: 'role:pm' }] })
      if (url.includes('/workflows') && url.includes('system_name=story')) return jsonResponse(fixture('tapd-workflows-story.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    const observed = await adapter.read(key, rule, new AbortController().signal)
    const err = await captureRejection(adapter.write(key, { status: 'done' }, observed, rule, new AbortController().signal))
    expect(detailCode(err)).toBe('WorkflowRejected')
    expect(posted).toBe(false)
  })

  it('rejects a classic transition edge whose workflow_id mismatches the resolved workflow', async () => {
    let posted = false
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/stories') && method === 'POST') { posted = true; throw new Error('should not POST') }
      if (url.includes('/stories') && method === 'GET') return storyDetailFor(STORY_SUBTYPE)
      if (url.includes('/workitem_types')) return jsonResponse(fixture('tapd-workitem-types.json'))
      if (url.includes('/workflows/all_transitions')) return jsonResponse({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', workflow_id: 'wf-other' }] })
      if (url.includes('/workflows') && url.includes('system_name=story')) return jsonResponse(fixture('tapd-workflows-story.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const key = { ...STORY_KEY, typeId: STORY_SUBTYPE }
    const rule = subtypeRule(STORY_SUBTYPE, 'story')
    const observed = await adapter.read(key, rule, new AbortController().signal)
    const err = await captureRejection(adapter.write(key, { status: 'done' }, observed, rule, new AbortController().signal))
    expect(detailCode(err)).toBe('WorkflowRejected')
    expect(posted).toBe(false)
  })

  it('writes a classic bug status with keep_owner=1', async () => {
    const posts: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/bugs') && method === 'POST') { posts.push((init?.body as string) ?? ''); return jsonResponse({ status: 1, info: 'success', data: {} }) }
      if (url.includes('/bugs') && method === 'GET') return jsonResponse(fixture('tapd-bug-detail.json'))
      if (url.includes('/workflows/all_transitions') && url.includes('system=bug')) return jsonResponse(fixture('tapd-transitions-bug.json'))
      if (url.includes('/workflows') && url.includes('system_name=bugtrace')) return jsonResponse(fixture('tapd-workflows-bug.json'))
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const rule = typeRule('bug')
    const observed = await adapter.read(BUG_KEY, rule, new AbortController().signal)
    await adapter.write(BUG_KEY, { status: 'done' }, observed, rule, new AbortController().signal)
    expect(posts).toHaveLength(1)
    const body = new URLSearchParams(posts[0]!)
    expect(body.get('status')).toBe('resolved')
    expect(body.get('keep_owner')).toBe('1')
  })

  it('writes a task status with auto_complete_effort=0 and never fetches workflow metadata', async () => {
    const posts: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/tasks') && method === 'POST') { posts.push((init?.body as string) ?? ''); return jsonResponse({ status: 1, info: 'success', data: {} }) }
      if (url.includes('/tasks') && method === 'GET') return jsonResponse(fixture('tapd-task-detail.json'))
      if (url.includes('/workflows') || url.includes('/workitem_types')) throw new Error('task must not fetch workflow metadata')
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const rule = typeRule('task')
    const observed = await adapter.read(TASK_KEY, rule, new AbortController().signal)
    await adapter.write(TASK_KEY, { status: 'done' }, observed, rule, new AbortController().signal)
    expect(posts).toHaveLength(1)
    const body = new URLSearchParams(posts[0]!)
    expect(body.get('status')).toBe('done')
    expect(body.get('auto_complete_effort')).toBe('0')
  })
})

// --- transition decoding ---------------------------------------------------

describe('decodeTransitions', () => {
  it('decodes an array of direct transition objects with the documented keys', () => {
    const transitions = decodeTransitions({ status: 1, info: 'success', data: [
      { StepPrevious: 'open', StepNext: 'in_progress', Name: 'x' },
      { StepPrevious: 'in_progress', StepNext: 'done', Name: 'y' },
    ] })
    expect(transitions).toEqual([
      { source: 'open', target: 'in_progress', workflowId: null, requiresUnsupported: false },
      { source: 'in_progress', target: 'done', workflowId: null, requiresUnsupported: false },
    ])
  })

  it('decodes a single transition object container', () => {
    const transitions = decodeTransitions({ status: 1, info: 'success', data: { StepPrevious: 'in_progress', StepNext: 'resolved' } })
    expect(transitions).toEqual([{ source: 'in_progress', target: 'resolved', workflowId: null, requiresUnsupported: false }])
  })

  it('rejects an undocumented WorkflowTransition wrapper instead of guessing an unwrap', () => {
    const err = capture(() => decodeTransitions({ status: 1, info: 'success', data: [{ WorkflowTransition: { StepPrevious: 'open', StepNext: 'done' } }] }))
    expect(detailCode(err)).toBe('InvalidRemoteResponse')
  })

  it('marks an edge unsupported when Appendfield requires a mandatory field (Notnull yes)', () => {
    const transitions = decodeTransitions({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', Appendfield: [{ FieldName: 'x', Notnull: 'yes', DefaultValue: [] }] }] })
    expect(transitions[0]!.requiresUnsupported).toBe(true)
  })

  it('marks an edge unsupported when an Appendfield entry carries a non-empty DefaultValue array', () => {
    const transitions = decodeTransitions({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', Appendfield: [{ FieldName: 'x', Notnull: 'no', DefaultValue: [{ Type: 'text', Value: 'v' }] }] }] })
    expect(transitions[0]!.requiresUnsupported).toBe(true)
  })

  it('accepts an empty Appendfield array as no additional fields', () => {
    const transitions = decodeTransitions({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', Appendfield: [] }] })
    expect(transitions[0]!.requiresUnsupported).toBe(false)
  })

  it('rejects a string DefaultValue (cannot parse a DefaultValue array as a string)', () => {
    const err = capture(() => decodeTransitions({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', Appendfield: [{ FieldName: 'x', Notnull: 'no', DefaultValue: 'abc' }] }] }))
    expect(detailCode(err)).toBe('InvalidRemoteResponse')
  })

  it('rejects a Notnull value that is neither yes nor no', () => {
    const err = capture(() => decodeTransitions({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', Appendfield: [{ FieldName: 'x', Notnull: '1', DefaultValue: [] }] }] }))
    expect(detailCode(err)).toBe('InvalidRemoteResponse')
  })

  it('marks an edge unsupported when top-level AuthorizedUser is set', () => {
    const transitions = decodeTransitions({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', AuthorizedUser: 'role:pm' }] })
    expect(transitions[0]!.requiresUnsupported).toBe(true)
  })

  it('captures an optional workflow_id for scope verification', () => {
    const transitions = decodeTransitions({ status: 1, info: 'success', data: [{ StepPrevious: 'in_progress', StepNext: 'done', workflow_id: 'wf-story-1' }] })
    expect(transitions[0]!.workflowId).toBe('wf-story-1')
  })
})

// --- metadata --------------------------------------------------------------

describe('tapd metadata', () => {
  function workflowMetadataFetch() {
    return route([
      { match: (u, m) => u.includes('/workspaces/projects') && m === 'GET', respond: () => jsonResponse(fixture('tapd-projects.json')) },
      { match: (u, m) => u.includes('/workspaces/users') && m === 'GET', respond: () => jsonResponse(fixture('tapd-members.json')) },
      { match: (u, m) => u.includes('/iterations') && m === 'GET', respond: () => jsonResponse(fixture('tapd-iterations.json')) },
      { match: (u, m) => u.includes('/workitem_types') && m === 'GET', respond: () => jsonResponse(fixture('tapd-workitem-types.json')) },
      { match: (u, m) => u.includes('/workflows/status_map') && u.includes('system=story') && m === 'GET', respond: () => jsonResponse(fixture('tapd-status-map-story.json')) },
      { match: (u, m) => u.includes('/workflows/status_map') && u.includes('system=bug') && m === 'GET', respond: () => jsonResponse(fixture('tapd-status-map-bug.json')) },
      { match: (u, m) => u.includes('/workflows') && u.includes('system_name=story') && m === 'GET', respond: () => jsonResponse(fixture('tapd-workflows-story.json')) },
      { match: (u, m) => u.includes('/workflows') && u.includes('system_name=bugtrace') && m === 'GET', respond: () => jsonResponse(fixture('tapd-workflows-bug.json')) },
      { match: (u, m) => u.includes('/stories/get_fields_info') && m === 'GET', respond: () => jsonResponse(fixture('tapd-story-fields.json')) },
      { match: (u, m) => u.includes('/bugs/get_fields_info') && m === 'GET', respond: () => jsonResponse(fixture('tapd-bug-fields.json')) },
      { match: (u, m) => u.includes('/tasks/get_fields_info') && m === 'GET', respond: () => jsonResponse(fixture('tapd-task-fields.json')) },
    ])
  }

  it('lists projects using company_id when no project is scoped', async () => {
    const seen: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/workspaces/projects')) { seen.push(url); return jsonResponse(fixture('tapd-projects.json')) }
      throw new Error('unexpected ' + url)
    })
    const adapter = makeAdapter(fetch)
    const meta = await adapter.metadata({ connectionId: 'conn-1' }, new AbortController().signal)
    expect(meta.projects).toEqual([{ id: '20000001', label: 'Project One' }, { id: '20000002', label: 'Project Two' }])
    expect(meta.typeCapabilities).toEqual([])
    expect(seen[0]).toContain(`company_id=${COMPANY}`)
  })

  it('enumerates story subtypes and reports classic vs bpm workflow and cursor paging', async () => {
    const adapter = makeAdapter(workflowMetadataFetch())
    const meta = await adapter.metadata({ connectionId: 'conn-1', projectId: WORKSPACE }, new AbortController().signal)
    expect(meta.members).toEqual([{ id: 'alice', label: 'Alice' }, { id: 'bob', label: 'Bob' }])
    expect(meta.types).toEqual([
      { id: STORY_SUBTYPE, label: '需求' },
      { id: STORY_SUBTYPE_BPM, label: '技术需求' },
      { id: 'bug', label: 'Bug' },
      { id: 'task', label: 'Task' },
    ])
    const byType = new Map(meta.typeCapabilities.map(c => [c.typeId, c]))

    const classic = byType.get(STORY_SUBTYPE)!
    const storyStates = [{ id: 'open', label: '待处理' }, { id: 'in_progress', label: '处理中' }, { id: 'done', label: '已完成' }]
    expect(classic.readStates).toEqual(storyStates)
    expect(classic.writeStates).toEqual(storyStates)
    expect(classic.workflow).toEqual({ readOnly: false })
    expect(classic.paging).toEqual({ kind: 'cursor' })

    const bpm = byType.get(STORY_SUBTYPE_BPM)!
    expect(bpm.workflow).toEqual({ readOnly: true })
    expect(bpm.writeStates).toEqual([])

    const bug = byType.get('bug')!
    expect(bug.readStates).toEqual([{ id: 'new', label: '新' }, { id: 'in_progress', label: '处理中' }, { id: 'resolved', label: '已解决' }])
    expect(bug.workflow).toEqual({ readOnly: false })

    const task = byType.get('task')!
    expect(task.readStates).toEqual([{ id: 'open', label: '未开始' }, { id: 'progressing', label: '进行中' }, { id: 'done', label: '已完成' }])
    expect(task.workflow).toEqual({ readOnly: false })
  })

  it('advertises priority_label and label candidates for a subtype but never storyPoints', async () => {
    const adapter = makeAdapter(workflowMetadataFetch())
    const meta = await adapter.metadata({ connectionId: 'conn-1', projectId: WORKSPACE, typeId: STORY_SUBTYPE }, new AbortController().signal)
    expect(meta.typeCapabilities).toHaveLength(1)
    const caps = meta.typeCapabilities[0]!
    expect(caps.fields).toEqual(['title', 'description', 'status'])
    expect(caps.candidateFields).toEqual([
      { field: 'priority', remoteId: 'priority_label', format: 'priority', writable: true },
      { field: 'tags', remoteId: 'label', format: 'label', writable: true },
    ])
    expect(caps.candidateFields.some(c => c.field === 'storyPoints')).toBe(false)
  })

  it('returns the same priority/tags candidate set for bugs and tasks', async () => {
    const adapter = makeAdapter(workflowMetadataFetch())
    for (const typeId of ['bug', 'task'] as const) {
      const meta = await adapter.metadata({ connectionId: 'conn-1', projectId: WORKSPACE, typeId }, new AbortController().signal)
      const fields = meta.typeCapabilities[0]!.candidateFields.map(c => c.field)
      expect(fields).toContain('priority')
      expect(fields).toContain('tags')
      expect(fields).not.toContain('storyPoints')
    }
  })
})
