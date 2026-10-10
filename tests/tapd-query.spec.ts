import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createTapdQuery } from '../src/sync/adapters/tapd-query.ts'
import type { WorkitemListRequest } from '../src/sync/adapters/yunxiao-query.ts'
import type { SafeConnection, SyncTransport } from '../src/sync/types.ts'
import { contentText } from '../src/content.ts'

const signal = new AbortController().signal
const connection: SafeConnection = {
  id: 'tapd', name: 'TAPD', platform: 'tapd', companyId: '70000001', instance: '70000001', tokenEnv: 'TAPD_TOKEN',
  enabled: false, revision: 1, credentialPresent: true, fillFields: ['title'], authentication: { mode: 'manual' },
}
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'sync-api', name), 'utf8'))
}
function envelope(data: unknown): unknown { return { status: 1, info: 'success', data } }
function setup(handler: (url: URL) => unknown = url => {
  if (url.pathname.endsWith('/count')) return envelope({ count: 2 })
  if (url.pathname.endsWith('/get_fields_info')) return fixture('tapd-story-fields.json')
  return fixture('tapd-stories-list.json')
}) {
  const calls: { url: URL; headers: Record<string, string>; method: string; readOnly: boolean }[] = []
  const transport = {
    read: vi.fn(async (request: any) => {
      calls.push(request)
      return { value: handler(request.url), status: 200, headers: new Headers() }
    }),
    write: vi.fn(() => { throw new Error('write forbidden') }),
  }
  return { query: createTapdQuery(connection, transport as unknown as SyncTransport, {}, { kind: 'tapd', token: 'PAT' }), calls, transport }
}
const request: WorkitemListRequest = { projectId: '20000001', categories: 'story', fields: ['subject', 'status', 'assignedTo'], perPage: 50 }

describe('TAPD read-only workitem query', () => {
  it('uses existing collection paging and exact field projection with Bearer PAT', async () => {
    const { query, calls, transport } = setup()
    const page = await query.listWorkitems({ ...request, page: 2 }, signal)
    expect(page.items[0]).toEqual({ id: '1152921504606846976123', subject: 'Implement sync adapter', status: { id: 'open', name: 'open' }, assignedTo: { id: 'alice', name: 'alice' } })
    expect(page).toMatchObject({ page: 2, perPage: 50, total: 2, totalPages: 1, requestCount: 2 })
    expect(calls[0]!.url.origin).toBe('https://api.tapd.cn')
    expect(calls[0]!.url.searchParams.get('page')).toBe('2')
    expect(calls[0]!.url.searchParams.get('limit')).toBe('50')
    expect(calls[0]!.url.searchParams.get('order')).toBe('created desc')
    expect(calls[0]!.url.searchParams.get('fields')!.split(',')).not.toContain('description')
    expect(calls.every(call => call.headers.authorization === 'Bearer PAT' && call.method === 'GET' && call.readOnly)).toBe(true)
    expect(transport.write).not.toHaveBeenCalled()
  })

  it('merges three category prefixes before slicing a globally ordered page', async () => {
    const dates: Record<string, number[]> = { stories: [9, 6, 3], bugs: [8, 5], tasks: [7] }
    const wrapper: Record<string, string> = { stories: 'Story', bugs: 'Bug', tasks: 'Task' }
    const { query, calls } = setup(url => {
      const collection = url.pathname.split('/')[1]!
      const sequence = dates[collection]!
      if (url.pathname.endsWith('/count')) return envelope({ count: sequence.length })
      const page = Number(url.searchParams.get('page'))
      const limit = Number(url.searchParams.get('limit'))
      return envelope(sequence.slice((page - 1) * limit, page * limit).map(day => ({ [wrapper[collection]!]: {
        id: String(day), workspace_id: '20000001', created: `2026-10-${String(day).padStart(2, '0')} 00:00:00`,
        [collection === 'bugs' ? 'title' : 'name']: `Item ${day}`,
      } })))
    })
    const result = await query.listWorkitems({ ...request, categories: 'story,bug,task', page: 2, perPage: 2, fields: ['subject', 'category'] }, signal)
    expect(result.items.map(item => item.id)).toEqual(['7', '6'])
    expect(result).toMatchObject({ total: 6, totalPages: 3, requestCount: 6 })
    expect(calls.filter(call => call.url.pathname.endsWith('/count'))).toHaveLength(3)
  })

  it('applies the category type filter before querying independent collections', async () => {
    const { query, calls } = setup(url => url.pathname === '/bugs/count' ? envelope({ count: 1 }) : envelope([{
      Bug: { id: '42', workspace_id: '20000001', title: 'Bug 42', status: 'open', created: '2026-10-09 00:00:00' },
    }]))
    const result = await query.listWorkitems({ ...request, categories: 'story,bug,task', conditions: [[{ field: 'workitemType', value: ['bug'] }]], fields: ['subject', 'category'] }, signal)
    expect(result.items).toMatchObject([{ id: '42', subject: 'Bug 42', category: 'bug' }])
    expect(result.total).toBe(1)
    expect(calls.every(call => call.url.pathname.startsWith('/bugs'))).toBe(true)
  })

  it.each(['bug', 'task'] as const)('routes %s to its own title and owner fields', async category => {
    const { query, calls } = setup(url => url.pathname.endsWith('/count') ? envelope({ count: 1 }) : fixture(`tapd-${category}-detail.json`))
    const page = await query.listWorkitems({ ...request, categories: category, orderBy: 'assignedTo' }, signal)
    expect(page.items[0]!.subject).toBeTruthy()
    expect(page.items[0]!.assignedTo).toBeTruthy()
    expect(calls[0]!.url.pathname).toBe(category === 'bug' ? '/bugs' : '/tasks')
    expect(calls[0]!.url.searchParams.get('order')).toBe(category === 'bug' ? 'current_owner desc' : 'owner desc')
  })

  it('retains AND, enum OR sets and from~to date syntax on list AND count', async () => {
    const { query, calls } = setup(url => url.pathname.endsWith('/count') ? envelope({ count: 1 }) : envelope([{ Story: {
      id: '1', workspace_id: '20000001', name: 'Match', status: 'open', owner: 'alice', created: '2026-10-02 10:00:00',
    } }]))
    await query.listWorkitems({ ...request, conditions: [[
      { field: 'status', value: ['open', 'in_progress'] },
      { field: 'assignedTo', value: ['alice'], operator: 'EQUALS' },
      { field: 'gmtCreate', value: ['2026-10-01 00:00:00'], toValue: '2026-10-03 23:59:59', operator: 'BETWEEN' },
    ]] }, signal)
    for (const call of calls) {
      expect(call.url.searchParams.get('status')).toBe('open|in_progress')
      expect(call.url.searchParams.get('owner')).toBe('EQ<alice>')
      expect(call.url.searchParams.get('created')).toBe('2026-10-01 00:00:00~2026-10-03 23:59:59')
    }
    expect(calls[1]!.url.searchParams.has('page')).toBe(false)
  })

  it('never returns rows when a server ignored a requested filter', async () => {
    const { query, calls } = setup()
    await expect(query.listWorkitems({ ...request, conditions: [[{ field: 'status', value: ['done'] }]] }, signal))
      .rejects.toMatchObject({ details: { code: 'InvalidRemoteResponse', field: 'filters.status' } })
    expect(calls).toHaveLength(1)
  })

  it.each([
    { perPage: 201 }, { page: 201, perPage: 50 }, { page: 0 }, { perPage: 0 },
    { categories: 'Req,Bug,Task' }, { fields: ['description'] },
    { conditions: [[{ field: 'status', value: ['open'] }], [{ field: 'status', value: ['done'] }]] },
    { conditions: [[{ field: 'status', value: ['open'] }, { field: 'status', value: ['done'] }]] },
    { conditions: [[{ field: 'statusStage', value: ['done'] }]] },
    { conditions: [[{ field: 'assignedTo', value: ['a', 'b'] }]] },
    { conditions: [[{ field: 'status', value: ['open|done'] }]] },
    { conditions: [[{ field: 'gmtModified', operator: 'BETWEEN', value: ['2026-02-30'], toValue: '2026-03-01' }]] },
    { conditions: [[{ field: 'gmtModified', operator: 'BETWEEN', value: ['2026-10-02'], toValue: '2026-10-01' }]] },
    { conditions: [[{ field: 'gmtModified', operator: 'BETWEEN', value: ['2026-10-01'], toValue: '2026-10-02 00:00:00' }]] },
  ])('refuses unsupported/ambiguous input before transport: %j', async override => {
    const { query, calls } = setup()
    await expect(query.listWorkitems({ ...request, ...override } as WorkitemListRequest, signal)).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    expect(calls).toHaveLength(0)
  })

  it('projects configured custom fields and priority while preserving wall-clock dates', async () => {
    const { query } = setup()
    const page = await query.listWorkitems({ ...request, fields: ['customFields', 'gmtModified'], customFieldIds: ['priority'] }, signal)
    expect(page.items[0]!.gmtModified).toBe('2026-10-07 12:00:00')
    expect(page.items[0]!.customFields).toEqual([{ fieldId: 'priority', fieldName: '优先级', fieldFormat: 'select', values: [{ identifier: 'High', displayValue: 'High' }] }])
    expect(page.requestCount).toBe(3)
  })

  it('gets exact-id description without a category guess; no status mapping required', async () => {
    const { query, calls } = setup(url => url.pathname === '/bugs' ? fixture('tapd-bug-detail.json') : envelope([]))
    const detail = await query.getWorkitem({ projectId: '20000001', id: '1152921504606846977999', include: ['description'], fields: ['id'] }, signal)
    expect(detail.description?.plain).toBe('Bug body')
    expect(contentText(detail.description!.content!)).toBe('Bug body')
    expect(detail.requestCount).toBe(3)
    expect(calls.every(call => call.url.searchParams.get('id') === '1152921504606846977999')).toBe(true)
  })

  it('keeps plain and JSON-looking descriptions plain rather than guessing Yunxiao carriers', async () => {
    const { query } = setup(url => url.pathname === '/tasks' ? envelope([{ Task: { id: '1', workspace_id: '20000001', description: '{"plain":"body"}' } }]) : envelope([]))
    expect((await query.getWorkitem({ projectId: '20000001', id: '1', fields: ['id'] }, signal)).description)
      .toMatchObject({ format: 'text', html: null, plain: '{"plain":"body"}' })
  })

  it.each(['workspace', 'id', 'ambiguous', 'oversized', 'business', 'count'])('fails closed for malformed %s responses', async mode => {
    const { query } = setup(url => {
      if (mode === 'business') return { status: 0, info: 'token denied SECRET', data: {} }
      if (url.pathname.endsWith('/count')) return envelope({ count: '2' })
      if (mode === 'count') return fixture('tapd-stories-list.json')
      if (mode === 'oversized') return envelope(Array.from({ length: 51 }, (_, i) => ({ Story: { id: String(i), workspace_id: '20000001' } })))
      if (mode === 'ambiguous') return envelope([{ [url.pathname === '/stories' ? 'Story' : url.pathname === '/bugs' ? 'Bug' : 'Task']: { id: '1', workspace_id: '20000001' } }])
      return envelope([{ Story: { id: mode === 'id' ? 1 : '1', workspace_id: mode === 'workspace' ? 'wrong' : '20000001' } }])
    })
    const action = mode === 'ambiguous' ? query.getWorkitem({ projectId: '20000001', id: '1', fields: ['id'] }, signal) : query.listWorkitems({ ...request, fields: ['id'] }, signal)
    await expect(action).rejects.toMatchObject({ details: { code: mode === 'business' ? 'AuthDenied' : 'InvalidRemoteResponse' } })
  })

  it('merges selectable category field catalogs with stable native ids and options', async () => {
    const { query, calls } = setup(url => fixture(`tapd-${url.pathname.startsWith('/bugs') ? 'bug' : url.pathname.startsWith('/tasks') ? 'task' : 'story'}-fields.json`))
    const fields = await query.listFields({ projectId: '20000001', categories: 'story,bug,task' }, signal)
    expect(fields.find(field => field.id === 'subject')).toMatchObject({ name: '标题', kind: 'NativeField' })
    expect(fields.find(field => field.id === 'priority')).toMatchObject({ name: '优先级', kind: 'CustomField' })
    expect(fields.find(field => field.id === 'status')!.options.map(option => option.id)).toContain('progressing')
    expect(fields.some(field => field.id === 'description')).toBe(false)
    expect(calls).toHaveLength(3)
  })

  it('rejects non-PAT authentication and missing token without requests', () => {
    const { transport, calls } = setup()
    expect(() => createTapdQuery({ ...connection, authentication: { mode: 'oauth' } } as SafeConnection, transport as unknown as SyncTransport, {}, { kind: 'tapd', token: 'PAT' })).toThrow()
    expect(() => createTapdQuery(connection, transport as unknown as SyncTransport, {})).toThrow()
    expect(() => createTapdQuery(connection, transport as unknown as SyncTransport, {}, { kind: 'tapd', token: ' ' })).toThrow()
    expect(calls).toHaveLength(0)
  })
})
