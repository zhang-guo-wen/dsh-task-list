import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileTapdConditions, createTapdAdapter, listTapdOrganizations } from '../src/sync/adapters/tapd.ts'
import { decodeTapdItem } from '../src/sync/adapters/tapd-codec.ts'
import { contentText } from '../src/content.ts'
import type { RemoteItem, SafeConnection, SyncRule, SyncTransport } from '../src/sync/types.ts'
import type { TaskContent } from '../src/types.ts'

const COMPANY = '70000001'
const WORKSPACE = '20000001'
const TOKEN = 'personal-access-token'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'sync-api', name), 'utf8')) as unknown
}

function tapdConnection(): SafeConnection {
  return {
    id: 'c1', name: 'TAPD', enabled: true, revision: 1, authentication: { mode: 'manual' },
    fillFields: ['title'], credentialPresent: true, instance: COMPANY, platform: 'tapd',
    companyId: COMPANY, tokenEnv: 'TASK_LIST_TAPD_TOKEN',
  }
}

/** A rule whose own type is the TAPD collection it selects. */
function rule(overrides: Partial<SyncRule> = {}): SyncRule {
  return {
    id: 'r1', revision: 1, connectionId: 'c1', projectId: WORKSPACE, projectName: 'Workspace',
    enabled: true, workspaceId: null,
    conditions: [[{ field: 'category', operator: 'EQUALS', value: ['task'] }]],
    statusWriteStates: { todo: 'open', in_progress: 'progressing', done: 'done' },
    ...overrides,
  }
}

const statuses = { todo: 'open', in_progress: 'progressing', done: 'done' } as const

function routed(routes: { match: (url: string, method: string) => boolean; respond: (url: string) => unknown }[]) {
  const calls: { url: string; method: string; body?: unknown; headers: Record<string, string> }[] = []
  const transport = {
    read: async (request: any) => {
      const url = String(request.url)
      calls.push({ url, method: request.method, headers: request.headers })
      const route = routes.find(entry => entry.match(url, request.method))
      if (!route) throw new Error(`unrouted read: ${url}`)
      return { value: route.respond(url), headers: new Headers(), status: 200 }
    },
    write: async (request: any) => {
      const url = String(request.url)
      calls.push({ url, method: request.method, body: request.body, headers: request.headers })
      return { value: { status: 1, info: 'success', data: {} }, headers: new Headers(), status: 200 }
    },
  } as unknown as SyncTransport
  return { transport, calls }
}

function observedTask(): RemoteItem {
  return decodeTapdItem({ id: '1', workspace_id: WORKSPACE, name: 'x', status: 'open' }, {
    instance: COMPANY, projectId: WORKSPACE, typeId: 'task', category: 'task', statusWriteStates: statuses,
  })
}

describe('TAPD credentials and organization', () => {
  it('reads the account company from the token alone', async () => {
    const { transport, calls } = routed([{ match: url => url.includes('user_participant_projects'), respond: () => fixture('tapd-projects.json') }])
    expect(await listTapdOrganizations(TOKEN, transport, new AbortController().signal)).toEqual([{ id: '20000003', name: 'Company Workspace' }])
    expect(calls[0]?.url).toBe('https://api.tapd.cn/workspaces/user_participant_projects')
  })

  it('sends the connection token as a Bearer header', async () => {
    const { transport, calls } = routed([
      { match: url => url.includes('user_participant_projects'), respond: () => fixture('tapd-projects.json') },
    ])
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    await adapter.metadata({ connectionId: 'c1' }, new AbortController().signal)
    expect(calls[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('refuses an empty token before any request', async () => {
    const { transport, calls } = routed([])
    await expect(listTapdOrganizations('  ', transport, new AbortController().signal)).rejects.toMatchObject({ details: { code: 'CredentialMissing' } })
    expect(calls).toHaveLength(0)
  })
})

describe('TAPD item decoding', () => {
  it('inverts the rule status map and packs the body into the task content', () => {
    const raw = { id: '1000000000000000001', workspace_id: WORKSPACE, name: 'Alpha task', status: 'progressing', owner: 'Alice', description: 'first line\nsecond line', modified: '2026-10-10 10:00:00' }
    const item: RemoteItem = decodeTapdItem(raw, { instance: COMPANY, projectId: WORKSPACE, typeId: 'task', category: 'task', statusWriteStates: statuses })
    expect(item.fields.status).toEqual({ presence: 'value', value: 'in_progress', writable: true })
    expect(item.rawStatus).toBe('progressing')
    expect(item.number).toBe('1000000000000000001')
    expect(item.updatedToken).toBe('2026-10-10 10:00:00')
    // TAPD bodies are plain text, so newlines survive as paragraphs.
    expect(item.description.format).toBe('text')
    const packed = item.fields.description.presence === 'value' ? contentText(item.fields.description.value as TaskContent) : ''
    expect(packed).toContain('second line')
    // The title travels as the task's own title field, not inside the body.
    expect(item.fields.title).toEqual({ presence: 'value', value: 'Alpha task', writable: true })
    // Priority/tags are never compared: only the status is written back, as for Yunxiao.
    expect(item.fields.priority.presence).toBe('absent')
    expect(item.fields.tags.presence).toBe('absent')
  })

  it('fails closed on a status the rule does not map', () => {
    expect(() => decodeTapdItem({ id: '1', workspace_id: WORKSPACE, name: 'x', status: 'unknown-status' }, {
      instance: COMPANY, projectId: WORKSPACE, typeId: 'task', category: 'task', statusWriteStates: statuses,
    })).toThrow()
  })
})

describe('TAPD condition semantics', () => {
  it('ANDs repeated fields, ORs groups/values, and uses bug title/owner/reporter', () => {
    const filter = compileTapdConditions([
      [{ field: 'workitemType', value: ['bug'] }, { field: 'assignedTo', value: ['alice', 'bob'] }, { field: 'creator', value: ['reporter'] }, { field: 'subject', operator: 'CONTAINS', value: ['fix'] }],
      [{ field: 'workitemType', value: ['task'] }, { field: 'status', value: ['done'] }],
    ])
    expect(filter.matches('bug', { current_owner: 'alice;carol', reporter: 'reporter', title: 'fix it', owner: 'wrong', name: 'wrong' })).toBe(true)
    expect(filter.matches('bug', { current_owner: 'alice2', reporter: 'reporter', title: 'fix it' })).toBe(false)
    expect(filter.matches('task', { status: 'done' })).toBe(true)
    expect(filter.matches('task', { status: 'open' })).toBe(false)
    const repeated = compileTapdConditions([[{ field: 'status', value: ['open'] }, { field: 'status', value: ['done'] }]])
    expect(repeated.matches('task', { status: 'open' })).toBe(false)
  })

  it('checks full label identities, iteration and priority_label against the existing fixture', () => {
    const row = (fixture('tapd-task-detail.json') as any).data[0].Task
    const filter = compileTapdConditions([[{ field: 'tag', operator: 'CONTAINS', value: ['test'] }, { field: 'priority', value: ['Middle'] }, { field: 'sprint', operator: 'CONTAINS', value: ['1152921504606846001'] }]])
    expect(filter.matches('task', row)).toBe(true)
    expect(filter.matches('task', { ...row, label: 'testing' })).toBe(false)
    expect(filter.matches('task', { ...row, priority: 'Middle', priority_label: 'High' })).toBe(false)
  })

  it('handles inclusive date ranges, date-only upper days and T separators', () => {
    const filter = compileTapdConditions([[{ field: 'gmtCreate', operator: 'BETWEEN', value: ['2026-10-07'], toValue: '2026-10-08' }, { field: 'gmtModified', operator: 'BETWEEN', value: ['2026-10-08T12:00:00'], toValue: '2026-10-08 13:00:00' }]])
    expect(filter.matches('task', { created: '2026-10-08 23:59:59', modified: '2026-10-08 13:00:00' })).toBe(true)
    expect(filter.matches('task', { created: '2026-10-09 00:00:00', modified: '2026-10-08 13:00:00' })).toBe(false)
    expect(() => filter.matches('task', { created: 'bad', modified: '2026-10-08 13:00:00' })).toThrow()
  })

  it.each(['statusStage', 'updateStatusAt', 'unknown'])('fails closed on unsupported %s before requests', async field => {
    const { transport, calls } = routed([])
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    await expect(async () => {
      for await (const _batch of adapter.discover(rule({ conditions: [[{ field, value: ['x'] }]] }), new AbortController().signal)) { /* consume */ }
    }).rejects.toMatchObject({ details: { code: 'InvalidConfig', field: `conditions.${field}` } })
    expect(calls).toHaveLength(0)
  })

  it('refuses invalid dates, reversed ranges, unknown categories/operators and missing response fields', () => {
    for (const [from, to] of [['2026-02-30', '2026-03-01'], ['2026-10-09', '2026-10-08']]) {
      expect(() => compileTapdConditions([[{ field: 'gmtCreate', operator: 'BETWEEN', value: [from!], toValue: to }]])).toThrow()
    }
    expect(() => compileTapdConditions([[{ field: 'workitemType', value: ['type-id'] }]])).toThrow()
    expect(() => compileTapdConditions([[{ field: 'status', operator: 'BETWEEN', value: ['open'] }]])).toThrow()
    const filter = compileTapdConditions([[{ field: 'assignedTo', value: ['alice'] }]])
    expect(() => filter.matches('bug', { owner: 'alice' })).toThrow()
    expect(() => filter.matches('bug', { current_owner: 1 })).toThrow()
    expect(filter.matches('bug', { current_owner: null })).toBe(false)
  })
})

describe('TAPD story subtype status safety', () => {
  const signal = new AbortController().signal
  const storyKey = { instance: COMPANY, projectId: WORKSPACE, typeId: 'story', id: '1152921504606846976123' }
  const storyTypes = fixture('tapd-workitem-types.json') as any
  const storyWorkflows = fixture('tapd-workflows-story.json') as any
  const storyDetail = fixture('tapd-story-detail.json') as any
  const storyStatusMap = fixture('tapd-status-map-story.json') as any
  const storyTransitions = fixture('tapd-transitions-story.json') as any
  const storyRule = rule({ conditions: [[{ field: 'category', value: ['story'] }]], statusWriteStates: { todo: 'open', in_progress: 'in_progress', done: 'done' } })
  const observed = decodeTapdItem(storyDetail.data[0].Story, {
    instance: COMPANY, projectId: WORKSPACE, typeId: 'story', category: 'story', statusWriteStates: storyRule.statusWriteStates,
  })
  function storyRoutes(overrides: {
    types?: unknown; workflows?: unknown; detail?: unknown; transitions?: unknown
    statusMap?: (subtype: string) => unknown
  } = {}) {
    return routed([
      { match: url => new URL(url).pathname === '/workspaces/user_participant_projects', respond: () => fixture('tapd-projects.json') },
      { match: url => new URL(url).pathname === '/workspaces/users', respond: () => fixture('tapd-members.json') },
      { match: url => new URL(url).pathname === '/iterations', respond: () => fixture('tapd-iterations.json') },
      { match: url => new URL(url).pathname === '/stories/get_fields_info', respond: () => fixture('tapd-story-fields.json') },
      { match: url => new URL(url).pathname === '/workitem_types', respond: () => overrides.types ?? storyTypes },
      { match: url => new URL(url).pathname === '/workflows', respond: () => overrides.workflows ?? storyWorkflows },
      { match: url => new URL(url).pathname === '/workflows/status_map', respond: url => overrides.statusMap?.(new URL(url).searchParams.get('workitem_type_id') ?? '') ?? storyStatusMap },
      { match: url => new URL(url).pathname === '/workflows/all_transitions', respond: () => overrides.transitions ?? storyTransitions },
      { match: url => new URL(url).pathname === '/stories', respond: () => overrides.detail ?? storyDetail },
    ])
  }

  it('uses real story subtype ids for metadata maps; offers only statuses common to classic workflows', async () => {
    const { transport, calls } = storyRoutes({ statusMap: subtype => ({
      status: 1, data: subtype === '1152921504606846003'
        ? { open: '待处理', in_progress: '处理中', done: '已完成' }
        : { open: '待处理', blocked: '阻塞', done: '已完成' },
    }) })
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    const metadata = await adapter.metadata({ connectionId: 'c1', projectId: WORKSPACE, typeId: 'story' }, signal)
    const capability = metadata.typeCapabilities[0]!
    expect(capability.typeId).toBe('story')
    expect(capability.readStates.map(state => state.id)).toEqual(['open', 'in_progress', 'done', 'blocked'])
    expect(capability.writeStates).toEqual([]) // second subtype has a BPM workflow
    expect(capability.workflow).toEqual({ readOnly: true })
    const maps = calls.filter(call => new URL(call.url).pathname === '/workflows/status_map')
    expect(maps.map(call => new URL(call.url).searchParams.get('workitem_type_id'))).toEqual(['1152921504606846003', '1152921504606846004'])
    expect(calls.every(call => call.headers.authorization === `Bearer ${TOKEN}`)).toBe(true)
  })

  it('offers only shared status writes if all story subtypes have known classic workflows', async () => {
    const workflows = { status: 1, data: storyWorkflows.data.map((row: any) => ({ Workflow: { ...row.Workflow, type: 'classic' } })) }
    const { transport } = storyRoutes({ workflows, statusMap: subtype => ({
      status: 1, data: subtype === '1152921504606846003' ? { open: '待处理', done: '已完成' } : { open: '待处理', blocked: '阻塞' },
    }) })
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    const capability = (await adapter.metadata({ connectionId: 'c1', projectId: WORKSPACE, typeId: 'story' }, signal)).typeCapabilities[0]!
    expect(capability.writeStates.map(state => state.id)).toEqual(['open'])
    expect(capability.workflow).toEqual({ readOnly: false })
  })

  it('gates a story update using its raw subtype, exact classic workflow and subtype transition', async () => {
    const { transport, calls } = storyRoutes()
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    await adapter.write(storyKey, { status: 'done' }, observed, storyRule, signal)
    const statusCall = calls.find(call => new URL(call.url).pathname === '/workflows/status_map')!
    const transitionCall = calls.find(call => new URL(call.url).pathname === '/workflows/all_transitions')!
    expect(new URL(statusCall.url).searchParams.get('workitem_type_id')).toBe('1152921504606846003')
    expect(new URL(transitionCall.url).searchParams.get('workitem_type_id')).toBe('1152921504606846003')
    expect(calls.at(-1)?.url).toBe('https://api.tapd.cn/stories/update')
    expect(String(calls.at(-1)?.body)).toContain('is_auto_close_task=0')
    expect(calls.every(call => call.headers.authorization === `Bearer ${TOKEN}`)).toBe(true)
  })

  it.each([
    ['missing', undefined], ['unknown', '999999'], ['wrong entity', 'bug'], ['BPM', '1152921504606846004'],
  ])('rejects %s story subtype before any POST', async (_case, subtype) => {
    const detail = { status: 1, data: [{ Story: { ...storyDetail.data[0].Story } }] }
    if (subtype === undefined) delete detail.data[0].Story.workitem_type_id
    else detail.data[0].Story.workitem_type_id = subtype
    const types = subtype === 'bug' ? { status: 1, data: [...storyTypes.data, { WorkitemType: { id: 'bug', name: 'Bug', entity_type: 'bug', workflow_id: 'wf-story-1' } }] } : storyTypes
    const { transport, calls } = storyRoutes({ detail, types })
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    await expect(adapter.write(storyKey, { status: 'done' }, observed, storyRule, signal))
      .rejects.toMatchObject({ details: { code: 'WorkflowRejected' } })
    expect(calls.every(call => call.method !== 'POST')).toBe(true)
  })

  it('rejects missing workflow, stale status, missing state or unsafe edge before POST', async () => {
    for (const overrides of [
      { types: { status: 1, data: [{ WorkitemType: { ...storyTypes.data[0].WorkitemType, workflow_id: null } }] } },
      { types: { status: 1, data: [{ WorkitemType: { ...storyTypes.data[0].WorkitemType, workflow_id: 'unknown-workflow' } }] } },
      { detail: { status: 1, data: [{ Story: { ...storyDetail.data[0].Story, status: 'done' } }] } },
      { statusMap: () => ({ status: 1, data: { open: '待处理', in_progress: '处理中' } }) },
      { transitions: fixture('tapd-transitions-story-required.json') },
      { transitions: { status: 1, data: [{ StepPrevious: 'in_progress', StepNext: 'done', workflow_id: 'wf-story-2' }] } },
    ]) {
      const { transport, calls } = storyRoutes(overrides)
      const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
      await expect(adapter.write(storyKey, { status: 'done' }, observed, storyRule, signal))
        .rejects.toMatchObject({ details: { code: 'WorkflowRejected' } })
      expect(calls.every(call => call.method !== 'POST')).toBe(true)
    }
  })
})

describe('TAPD rule surface', () => {
  it('walks the collection the rule names', async () => {
    const { transport, calls } = routed([
      { match: url => url.includes('/tasks'), respond: () => fixture('tapd-task-detail.json') },
    ])
    const adapter = createTapdAdapter(tapdConnection(), transport, { TASK_LIST_TAPD_TOKEN: TOKEN })
    const seen: RemoteItem[] = []
    for await (const batch of adapter.discover(rule(), new AbortController().signal)) seen.push(...batch)
    // The rule's category chose the collection, and the workspace id scoped it.
    expect(calls[0]?.url).toContain('https://api.tapd.cn/tasks?')
    expect(calls[0]?.url).toContain(`workspace_id=${WORKSPACE}`)
    expect(seen.every(item => item.key.typeId === 'task')).toBe(true)
  })

  it('walks all collections for an empty rule and preserves category-qualified identities', async () => {
    const { transport, calls } = routed(['stories', 'bugs', 'tasks'].map((collection, index) => ({
      match: url => new URL(url).pathname === `/${collection}`,
      respond: () => ({ status: 1, data: [{ [['Story', 'Bug', 'Task'][index]!]: { id: '90071992547409930', workspace_id: WORKSPACE, name: 'name', title: 'bug', status: 'open' } }] }),
    })))
    const adapter = createTapdAdapter(tapdConnection(), transport, { TASK_LIST_TAPD_TOKEN: TOKEN })
    const seen: RemoteItem[] = []
    for await (const batch of adapter.discover(rule({ conditions: [] }), new AbortController().signal)) seen.push(...batch)
    expect(seen.map(item => item.key.typeId)).toEqual(['story', 'bug', 'task'])
    expect(calls.every(call => new URL(call.url).searchParams.get('page') === '1')).toBe(true)
    expect(calls.every(call => !new URL(call.url).searchParams.has('cursor'))).toBe(true)
  })

  it('accepts workitemType multi-select with legacy category compatibility', () => {
    const filter = compileTapdConditions([[{ field: 'workitemType', operator: 'CONTAINS', value: ['story', 'task'] }]])
    expect(filter.categories).toEqual(['story', 'task'])
    expect(compileTapdConditions(rule().conditions).categories).toEqual(['task'])
    expect(compileTapdConditions([
      [{ field: 'workitemType', value: ['bug'] }],
      [{ field: 'workitemType', value: ['task'] }],
    ]).categories).toEqual(['bug', 'task'])
  })

  it('filters out unmapped statuses before decoding and never sends guessed condition parameters', async () => {
    const { transport, calls } = routed([{ match: () => true, respond: () => ({ status: 1, data: [{ Task: { id: '2', name: 'x', status: 'unmapped', owner: 'bob' } }, { Task: { id: '1', name: 'x', status: 'open', owner: 'alice' } }] }) }])
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    const seen: RemoteItem[] = []
    for await (const batch of adapter.discover(rule({ conditions: [[{ field: 'workitemType', value: ['task'] }, { field: 'status', value: ['open'] }, { field: 'assignedTo', value: ['alice'] }]] }), new AbortController().signal)) seen.push(...batch)
    expect(seen.map(item => item.key.id)).toEqual(['1'])
    expect([...new URL(calls[0]!.url).searchParams.keys()]).toEqual(['workspace_id', 'limit', 'page', 'order'])
  })

  it('pages with documented page numbers and deduplicates overlap using lossless IDs', async () => {
    let page = 0
    const base = 9007199254740993000n
    const first = Array.from({ length: 200 }, (_, index) => ({ Task: { id: String(base - BigInt(index)), name: 'x', status: 'open' } }))
    const { transport, calls } = routed([{ match: () => true, respond: () => ({ status: 1, data: ++page === 1 ? first : [first.at(-1), { Task: { id: String(base - 200n), name: 'y', status: 'open' } }] }) }])
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    const seen: RemoteItem[] = []
    for await (const batch of adapter.discover(rule(), new AbortController().signal)) seen.push(...batch)
    expect(seen).toHaveLength(201)
    expect(new Set(seen.map(item => item.key.id)).size).toBe(201)
    expect(calls.map(call => new URL(call.url).searchParams.get('page'))).toEqual(['1', '2'])
  })

  it.each(['repeated', 'short-repeat', 'unordered', 'oversized'])('fails closed for %s pagination', async scenario => {
    let page = 0
    const first = Array.from({ length: 200 }, (_, index) => ({ Task: { id: String(1000 - index), name: 'x', status: 'open' } }))
    const { transport } = routed([{ match: () => true, respond: () => {
      page += 1
      const data = scenario === 'oversized' ? [...first, first[0]] : scenario === 'unordered' ? [first[1], first[0]] : page === 1 || scenario === 'repeated' ? first : [first.at(-1)]
      return { status: 1, data }
    } }])
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    await expect(async () => { for await (const _batch of adapter.discover(rule(), new AbortController().signal)) { /* consume */ } })
      .rejects.toMatchObject({ details: { code: scenario === 'oversized' ? 'InvalidRemoteResponse' : 'IncompleteDiscovery' } })
  })

  it('preserves bug workflow routing without a story subtype lookup', async () => {
    const { transport, calls } = routed([
      { match: url => new URL(url).pathname === '/workflows', respond: () => fixture('tapd-workflows-bug.json') },
      { match: url => new URL(url).pathname === '/workflows/all_transitions', respond: () => fixture('tapd-transitions-bug.json') },
    ])
    const adapter = createTapdAdapter(tapdConnection(), transport, {}, { kind: 'tapd', token: TOKEN })
    const bugRule = rule({ statusWriteStates: { todo: 'open', in_progress: 'in_progress', done: 'resolved' } })
    const bug = (fixture('tapd-bug-detail.json') as any).data[0].Bug
    const observed = decodeTapdItem(bug, { instance: COMPANY, projectId: WORKSPACE, typeId: 'bug', category: 'bug', statusWriteStates: bugRule.statusWriteStates })
    await adapter.write(observed.key, { status: 'done' }, observed, bugRule, new AbortController().signal)
    expect(calls.map(call => new URL(call.url).pathname)).toEqual(['/workflows', '/workflows/all_transitions', '/bugs/update'])
    expect(new URL(calls[0]!.url).searchParams.get('system_name')).toBe('bugtrace')
    expect(new URL(calls[1]!.url).searchParams.get('system')).toBe('bug')
    expect(String(calls.at(-1)?.body)).toContain('keep_owner=1')
  })

  it('writes back only the status, and refuses any other field', async () => {
    const { transport, calls } = routed([])
    const adapter = createTapdAdapter(tapdConnection(), transport, { TASK_LIST_TAPD_TOKEN: TOKEN })
    const key = { instance: COMPANY, projectId: WORKSPACE, typeId: 'task', id: '1' }
    await expect(adapter.write(key, { title: 'changed' }, observedTask(), rule(), new AbortController().signal))
      .rejects.toMatchObject({ details: { code: 'MappingIncompatible' } })

    await adapter.write(key, { status: 'done' }, observedTask(), rule(), new AbortController().signal)
    const write = calls.at(-1)!
    expect(write.url).toBe('https://api.tapd.cn/tasks/update')
    expect(String(write.body)).toContain('status=done')
    // A task write keeps TAPD from completing the owner's effort automatically.
    expect(String(write.body)).toContain('auto_complete_effort=0')
  })
})
