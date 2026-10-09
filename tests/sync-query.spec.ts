import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createYunxiaoQuery } from '../src/sync/adapters/yunxiao-query.ts'
import { SyncTransport } from '../src/sync/transport.ts'
import { parseSyncRequest, parseSyncResponse } from '../src/sync/validation.ts'
import { projectWorkitem, resolveListFields } from '../src/sync/query/fields.ts'
import { buildConditions, ruleConditions } from '../src/sync/query/filters.ts'
import { projectAttachments, projectComments, projectRelationRecords, unpackDescription } from '../src/sync/query/detail.ts'
import type { Clock, SafeConnection, SyncTransport as TransportContract } from '../src/sync/types.ts'

const TOKEN = 'tok-query'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sync-api', name), 'utf8'))
}

function connection(): SafeConnection {
  return {
    id: 'conn-1', name: 'Yunxiao', enabled: true, revision: 1, credentialPresent: true, instance: 'org-1',
    platform: 'yunxiao', mode: 'center', organizationId: 'org-1', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN',
  } as SafeConnection
}

// The deadline sleep never resolves on its own: the transport cancels it when
// the work settles, so the fake clock cannot time out a fast response.
const clock: Clock = {
  now: () => 1_700_000_000_000,
  sleep: (_ms: number, signal: AbortSignal) => new Promise<void>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
  }),
}

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } })
}

interface Call { url: string; method: string; body: string | undefined }

function routed(handler: (call: Call) => Response): { fetch: ReturnType<typeof vi.fn>; calls: Call[] } {
  const calls: Call[] = []
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined }
    calls.push(call)
    return handler(call)
  })
  return { fetch, calls }
}

function makeQuery(fetch: ReturnType<typeof vi.fn>): {
  list: ReturnType<typeof createYunxiaoQuery>['listWorkitems']
  detail: ReturnType<typeof createYunxiaoQuery>['getWorkitem']
  fields: ReturnType<typeof createYunxiaoQuery>['listFields']
} {
  const transport = new SyncTransport({ fetch: fetch as unknown as typeof globalThis.fetch, clock }) as TransportContract
  const query = createYunxiaoQuery(connection(), transport, { YUNXIAO_TOKEN: TOKEN })
  return { list: query.listWorkitems, detail: query.getWorkitem, fields: query.listFields }
}

function detailCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object') {
    const details = (error as { details?: unknown }).details
    if (details !== null && typeof details === 'object' && typeof (details as { code?: unknown }).code === 'string') {
      return (details as { code: string }).code
    }
  }
  return undefined
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try { await promise } catch (error) { return error }
  throw new Error('expected a rejection')
}

// --- field projection -------------------------------------------------------

describe('work-item list projection', () => {
  it("expands '*' and defaults to every supported field", () => {
    const all = resolveListFields(['*'])
    expect(all).toContain('subject')
    expect(all).toContain('customFields')
    expect(all).not.toContain('description')
    expect(resolveListFields(undefined)).toEqual(all)
  })

  it('refuses detail-only fields on the list surface', () => {
    expect(detailCode((() => { try { resolveListFields(['description']); return undefined } catch (error) { return error } })())).toBe('InvalidConfig')
  })

  it('keeps only the requested fields and normalizes platform placeholders', () => {
    const page = fixture('yunxiao-query-search.json') as Record<string, unknown>[]
    const item = projectWorkitem(page[0], resolveListFields(['id', 'serialNumber', 'subject', 'status', 'parentId', 'sprint', 'customFields']))
    expect(Object.keys(item).sort()).toEqual(['customFields', 'id', 'parentId', 'serialNumber', 'sprint', 'status', 'subject'])
    expect(item.subject).toBe('Alpha work item')
    expect(item.status).toEqual({ id: '100005', name: '待处理', displayName: '待处理', nameEn: 'To Do' })
    // The platform writes EMPTY_VALUE for "no parent"; the projection reports null.
    expect(item.parentId).toBeNull()
    expect((item.sprint as { name: string }).name).toBe('Sprint 42')
    expect((item.customFields as unknown[]).length).toBe(2)
  })

  it('narrows custom fields to the requested ids', () => {
    const page = fixture('yunxiao-query-search.json') as Record<string, unknown>[]
    const item = projectWorkitem(page[0], resolveListFields(['customFields']), { customFieldIds: new Set(['priority']) })
    expect((item.customFields as { fieldId: string }[]).map(entry => entry.fieldId)).toEqual(['priority'])
  })

  it('reports a malformed row instead of rendering it', () => {
    const error = (() => { try { projectWorkitem({ id: 42 }, resolveListFields(['subject'])); return undefined } catch (caught) { return caught } })()
    expect(detailCode(error)).toBe('InvalidRemoteResponse')
  })
})

// --- conditions -------------------------------------------------------------

describe('condition builder', () => {
  it('emits the verified filter object shape', () => {
    const conditions = buildConditions([[{ field: 'assignedTo', operator: 'EQUALS', value: ['user-1'] }]])
    expect(conditions).toBeDefined()
    expect(JSON.parse(conditions!)).toEqual({
      conditionGroups: [[{
        fieldIdentifier: 'assignedTo', operator: 'EQUALS', value: ['user-1'], toValue: null, className: 'user', format: 'list',
      }]],
    })
  })

  it('keeps groups ORed and values inside one filter in a single OR set', () => {
    const parsed = JSON.parse(buildConditions([
      [{ field: 'status', operator: 'EQUALS', value: ['100005'] }],
      [{ field: 'status', operator: 'EQUALS', value: ['100014'] }],
    ])!)
    expect(parsed.conditionGroups).toHaveLength(2)
    expect(parsed.conditionGroups[0][0].value).toEqual(['100005'])
  })

  it('drops empty groups and returns undefined when nothing is left', () => {
    expect(buildConditions([])).toBeUndefined()
    expect(buildConditions([[]])).toBeUndefined()
  })

  it('refuses an operator the field does not support', () => {
    const error = (() => { try { buildConditions([[{ field: 'subject', operator: 'EQUALS', value: ['x'] }]]); return undefined } catch (caught) { return caught } })()
    expect(detailCode(error)).toBe('InvalidConfig')
  })

  it('requires a datetime window for BETWEEN', () => {
    const error = (() => { try { buildConditions([[{ field: 'gmtModified', operator: 'BETWEEN', value: ['2026-10-01 00:00:00'] }]]); return undefined } catch (caught) { return caught } })()
    expect(detailCode(error)).toBe('InvalidConfig')
    const ok = buildConditions([[{ field: 'gmtModified', operator: 'BETWEEN', value: ['2026-10-01 00:00:00'], toValue: '2026-10-09 00:00:00' }]])
    expect(JSON.parse(ok!).conditionGroups[0][0]).toMatchObject({ fieldIdentifier: 'gmtModified', className: 'dateTime', toValue: '2026-10-09 00:00:00' })
  })

  it('maps the rule dimensions onto one AND group', () => {
    const groups = ruleConditions({ assignees: ['user-1'], statusIds: ['100005'], iterationIds: ['sprint-1'], typeIds: ['req-type-1'] })
    expect(groups).toHaveLength(1)
    expect(groups![0].map(condition => condition.field)).toEqual(['assignedTo', 'status', 'sprint', 'workitemType'])
    expect(ruleConditions({ assignees: [], statusIds: [], iterationIds: [], typeIds: [] })).toBeUndefined()
  })
})

// --- detail projections -----------------------------------------------------

describe('detail projections', () => {
  it('unwraps the JSON description carrier the live service returns', () => {
    const view = unpackDescription('{"htmlValue":"<p>Body</p>","jsonMLValue":["root"]}', 'RICHTEXT')
    expect(view).toEqual({ format: 'richtext', html: '<p>Body</p>', plain: 'Body' })
  })

  it('accepts a bare HTML body and reports an empty description as null', () => {
    expect(unpackDescription('<p>Plain</p>', 'RICHTEXT')?.plain).toBe('Plain')
    expect(unpackDescription('', 'RICHTEXT')).toBeNull()
    expect(unpackDescription(null, 'RICHTEXT')).toBeNull()
  })

  it('takes a comment dialect from its content, not from contentFormat', () => {
    const comments = projectComments(fixture('yunxiao-query-comments.json'))
    expect(comments).toHaveLength(2)
    expect(comments[0]).toMatchObject({ id: 'c1', format: 'markdown', contentFormat: 'RICHTEXT', parentId: null, top: false })
    expect(comments[1]).toMatchObject({ id: 'c2', format: 'html', parentId: 'c1', top: true })
  })

  it('verifies each relation record against the requested type', () => {
    const records = projectRelationRecords(fixture('yunxiao-query-relations-sub.json'), 'SUB')
    expect(records.map(record => record.resourceId)).toEqual(['1000000000000000003', '1000000000000000004'])
    expect(records[0]).toMatchObject({ relationType: 'SUB', resourceType: 'Req' })
    expect(detailCode((() => { try { projectRelationRecords(fixture('yunxiao-query-relations-sub.json'), 'PARENT'); return undefined } catch (caught) { return caught } })())).toBe('InvalidRemoteResponse')
  })

  it('exposes the short-lived signed attachment URL and its expiry', () => {
    const [attachment] = projectAttachments(fixture('yunxiao-query-attachments.json'))
    expect(attachment).toMatchObject({ fileId: 'file-1', fileName: 'normal_video.mp4', size: 22503329, urlExpiresAt: 1_791_538_993_000 })
  })
})

// --- adapter ----------------------------------------------------------------

describe('createYunxiaoQuery.listWorkitems', () => {
  it('sends one search request with the category, paging, order and projection', async () => {
    const { fetch, calls } = routed(call => {
      expect(call.url).toContain('/workitems:search')
      return jsonResponse(fixture('yunxiao-query-search.json'), 200, { 'x-page': '1', 'x-total': '523', 'x-total-pages': '3', 'x-per-page': '200' })
    })
    const { list } = makeQuery(fetch)
    const page = await list({ projectId: 'space-1', categories: 'Req,Bug', page: 1, perPage: 200, fields: ['serialNumber', 'subject'], orderBy: 'gmtCreate', sort: 'desc' }, new AbortController().signal)
    const body = JSON.parse(calls[0]!.body!)
    expect(calls).toHaveLength(1)
    expect(body).toMatchObject({ category: 'Req,Bug', spaceId: 'space-1', spaceType: 'Project', page: 1, perPage: 200, orderBy: 'gmtCreate', sort: 'desc' })
    // No conditions means the key is absent rather than an empty array.
    expect('conditions' in body).toBe(false)
    expect(page.items).toEqual([
      { id: '1000000000000000001', serialNumber: 'PROJ-11', subject: 'Alpha work item' },
      { id: '1000000000000000002', serialNumber: 'PROJ-12', subject: 'Beta bug' },
    ])
    expect(page).toMatchObject({ page: 1, perPage: 200, total: 523, totalPages: 3, requestCount: 1 })
  })

  it('serializes conditions and refuses a window the platform would reject', async () => {
    const { fetch, calls } = routed(() => jsonResponse(fixture('yunxiao-query-search.json')))
    const { list } = makeQuery(fetch)
    await list({
      projectId: 'space-1', categories: 'Req', fields: ['id'],
      conditions: [[{ field: 'status', operator: 'EQUALS', value: ['100005'] }]],
    }, new AbortController().signal)
    expect(JSON.parse(JSON.parse(calls[0]!.body!).conditions)).toEqual({
      conditionGroups: [[{ fieldIdentifier: 'status', operator: 'EQUALS', value: ['100005'], toValue: null, className: 'status', format: 'list' }]],
    })

    const error = await rejection(list({ projectId: 'space-1', categories: 'Req', page: 51, perPage: 200 }, new AbortController().signal))
    expect(detailCode(error)).toBe('InvalidConfig')
    expect(calls).toHaveLength(1)
  })

  it('reports a non-array payload as a malformed response', async () => {
    const { fetch } = routed(() => jsonResponse({ items: [] }))
    const { list } = makeQuery(fetch)
    expect(detailCode(await rejection(list({ projectId: 'space-1', categories: 'Req' }, new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })
})

describe('createYunxiaoQuery.getWorkitem', () => {
  it('reads every requested section and keeps the sections that succeeded', async () => {
    const { fetch, calls } = routed(call => {
      if (call.url.endsWith('/comments')) return jsonResponse(fixture('yunxiao-query-comments.json'))
      if (call.url.includes('/relationRecords')) return jsonResponse(fixture('yunxiao-query-relations-sub.json'))
      if (call.url.endsWith('/activities')) return jsonResponse(fixture('yunxiao-query-activities.json'))
      if (call.url.endsWith('/attachments')) return jsonResponse(fixture('yunxiao-query-attachments.json'))
      return jsonResponse(fixture('yunxiao-query-detail.json'))
    })
    const { detail } = makeQuery(fetch)
    const result = await detail({
      projectId: 'space-1', id: '1000000000000000001',
      include: ['description', 'comments', 'relations', 'activities', 'attachments'],
      fields: ['id', 'serialNumber', 'subject', 'status', 'customFields'],
      relationTypes: ['SUB'],
    }, new AbortController().signal)

    expect(result.item).toMatchObject({ id: '1000000000000000001', serialNumber: 'PROJ-11', subject: 'Alpha work item' })
    expect(result.description?.html).toContain('功能需求')
    expect(result.description?.plain).toContain('功能需求')
    expect(result.description?.plain).not.toContain('<article')
    expect(result.comments).toHaveLength(2)
    expect(result.relations).toEqual([{ relationType: 'SUB', records: [
      { relationType: 'SUB', resourceType: 'Req', resourceId: '1000000000000000003', gmtCreate: 1_791_400_000_000, item: null },
      { relationType: 'SUB', resourceType: 'Bug', resourceId: '1000000000000000004', gmtCreate: 1_791_410_000_000, item: null },
    ] }])
    expect(result.activities?.[0]).toMatchObject({ eventType: 'workitem.association.changed', actionType: 'associate' })
    expect(result.activities?.[1]?.newValue[0]?.displayValue).toBe('2026-09-22')
    expect(result.attachments?.[0]?.fileName).toBe('normal_video.mp4')
    expect(result.sectionErrors).toEqual([])
    // detail + comments + relations + activities + attachments
    expect(result.requestCount).toBe(5)
    expect(calls.map(call => call.url.replace(/^.*organizations\/[^/]+/u, ''))).toEqual([
      '/workitems/1000000000000000001',
      '/workitems/1000000000000000001/comments',
      '/workitems/1000000000000000001/activities',
      '/workitems/1000000000000000001/attachments',
      '/workitems/1000000000000000001/relationRecords?relationType=SUB',
    ])
  })

  it('returns the item and description when a section fails, with the failure reported', async () => {
    const { fetch } = routed(call => call.url.endsWith('/comments')
      ? jsonResponse({ error: 'nope' })
      : jsonResponse(fixture('yunxiao-query-detail.json')))
    const { detail } = makeQuery(fetch)
    const result = await detail({ projectId: 'space-1', id: '1000000000000000001', include: ['description', 'comments'], fields: ['id'] }, new AbortController().signal)
    expect(result.description?.format).toBe('richtext')
    expect(result.sectionErrors.map(entry => entry.section)).toEqual(['comments'])
    expect(result.sectionErrors[0]?.error.code).toBe('InvalidRemoteResponse')
  })

  it('rejects a detail that belongs to another project', async () => {
    const detail = fixture('yunxiao-query-detail.json') as Record<string, unknown>
    const { fetch } = routed(() => jsonResponse({ ...detail, space: { id: 'other-space', name: 'Other' } }))
    const { detail: read } = makeQuery(fetch)
    expect(detailCode(await rejection(read({ projectId: 'space-1', id: '1000000000000000001' }, new AbortController().signal)))).toBe('InvalidRemoteResponse')
  })

  it('expands related items when asked, within the bound', async () => {
    const { fetch, calls } = routed(call => {
      if (call.url.includes('/relationRecords')) return jsonResponse(fixture('yunxiao-query-relations-sub.json'))
      if (call.url.endsWith('/1000000000000000003')) return jsonResponse({ ...(fixture('yunxiao-query-search.json') as Record<string, unknown>[])[0], id: '1000000000000000003' })
      if (call.url.endsWith('/1000000000000000004')) return jsonResponse({ ...(fixture('yunxiao-query-detail.json') as Record<string, unknown>), id: '1000000000000000004' })
      return jsonResponse(fixture('yunxiao-query-detail.json'))
    })
    const { detail } = makeQuery(fetch)
    const result = await detail({
      projectId: 'space-1', id: '1000000000000000001', include: ['relations'],
      fields: ['id', 'serialNumber'], relationTypes: ['SUB'], expandRelations: true, expandLimit: 1,
    }, new AbortController().signal)
    const records = result.relations![0]!.records
    expect(records[0]!.item).not.toBeNull()
    expect(records[1]!.item).toBeNull()
    expect(calls.filter(call => /100000000000000000[34]$/u.test(call.url))).toHaveLength(1)
  })
})

// --- RPC contract -----------------------------------------------------------

describe('listWorkitems RPC contract', () => {
  const request = {
    connectionId: 'conn-1', projectId: 'space-1', categories: 'Req',
    page: 1, perPage: 50, fields: ['*'], customFieldIds: [], orderBy: 'gmtCreate', sort: 'desc',
  }

  it('parses a closed request and refuses unknown fields or a forbidden window', () => {
    expect(parseSyncRequest('listWorkitems', request).request).toMatchObject({ categories: 'Req', perPage: 50 })
    expect(() => parseSyncRequest('listWorkitems', { ...request, extra: 1 })).toThrow()
    expect(() => parseSyncRequest('listWorkitems', { ...request, fields: ['description'] })).toThrow()
    expect(() => parseSyncRequest('listWorkitems', { ...request, page: 51, perPage: 200 })).toThrow()
    expect(() => parseSyncRequest('listWorkitems', { ...request, categories: 'Req, Bug' })).toThrow()
  })

  it('validates the response page and refuses unknown row keys', () => {
    const page = { items: [{ id: 'w1', subject: 'Alpha' }], page: 1, perPage: 50, total: 1, totalPages: 1, fields: ['id', 'subject'] }
    expect(parseSyncResponse('listWorkitems', page).response).toEqual(page)
    expect(() => parseSyncResponse('listWorkitems', { ...page, items: [{ id: 'w1', secret: 'x' }] })).toThrow()
  })
})

describe('createYunxiaoQuery.listFields', () => {
  it("merges every field of the category's work-item types, first occurrence wins", async () => {
    const { fetch, calls } = routed(call => {
      if (call.url.includes('/workitemTypes?')) return jsonResponse(fixture('yunxiao-query-types.json'))
      if (call.url.endsWith('/req-type-1/fields')) return jsonResponse(fixture('yunxiao-query-fields-type1.json'))
      if (call.url.endsWith('/req-type-2/fields')) return jsonResponse(fixture('yunxiao-query-fields-type2.json'))
      throw new Error(`unexpected ${call.url}`)
    })
    const { fields } = makeQuery(fetch)
    const list = await fields({ projectId: 'space-1', category: 'Req' }, new AbortController().signal)
    // subject appears for both types but is offered once; the second type's own
    // custom fields (Story Points, 所属模块) are added.
    expect(list.map(field => field.id)).toEqual(['subject', 'assignedTo', 'priority', '79', 'story_points', '5b35c9e6485c4eae7d47367bb6'])
    expect(list[0]).toMatchObject({ name: '标题', format: 'string', required: true, kind: 'NativeField' })
    expect(list[2]).toMatchObject({ id: 'priority', kind: 'SystemCustomField', options: [{ id: 'prio-urgent', label: '紧急' }, { id: 'prio-medium', label: '中' }] })
    expect(calls).toHaveLength(3)
  })

  it('refuses a category the search endpoint would reject', async () => {
    const { fetch, calls } = routed(() => jsonResponse(fixture('yunxiao-query-types.json')))
    const { fields } = makeQuery(fetch)
    expect(detailCode(await rejection(fields({ projectId: 'space-1', category: 'Req,Bug' }, new AbortController().signal)))).toBe('InvalidConfig')
    expect(calls).toHaveLength(0)
  })
})

describe('listWorkitemFields RPC contract', () => {
  it('parses the closed request and the field rows', () => {
    expect(parseSyncRequest('listWorkitemFields', { connectionId: 'conn-1', projectId: 'space-1', category: 'Req' }).request)
      .toEqual({ connectionId: 'conn-1', projectId: 'space-1', category: 'Req' })
    expect(() => parseSyncRequest('listWorkitemFields', { connectionId: 'conn-1', projectId: 'space-1', category: 'Req,Bug' })).toThrow()
    const row = { id: 'priority', name: '优先级', format: 'list', required: true, kind: 'SystemCustomField', options: [{ id: 'p1', label: '中' }] }
    expect(parseSyncResponse('listWorkitemFields', [row]).response).toEqual([row])
    expect(() => parseSyncResponse('listWorkitemFields', [{ ...row, secret: 'x' }])).toThrow()
  })
})
