import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTapdAdapter, listTapdOrganizations } from '../src/sync/adapters/tapd.ts'
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

function routed(routes: { match: (url: string, method: string) => boolean; respond: () => unknown }[]) {
  const calls: { url: string; method: string; body?: unknown; headers: Record<string, string> }[] = []
  const transport = {
    read: async (request: any) => {
      const url = String(request.url)
      calls.push({ url, method: request.method, headers: request.headers })
      const route = routes.find(entry => entry.match(url, request.method))
      if (!route) throw new Error(`unrouted read: ${url}`)
      return { value: route.respond(), headers: new Headers(), status: 200 }
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

  it('refuses a rule that names no collection', async () => {
    const { transport } = routed([])
    const adapter = createTapdAdapter(tapdConnection(), transport, { TASK_LIST_TAPD_TOKEN: TOKEN })
    await expect(async () => {
      for await (const _batch of adapter.discover(rule({ conditions: [] }), new AbortController().signal)) break
    }).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
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
