import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SyncRunStore } from '../src/sync/run-store.ts'
import { SyncExecutor } from '../src/sync/executor.ts'
import { createTapdAdapter } from '../src/sync/adapters/tapd.ts'
import type { Clock, SyncTransport } from '../src/sync/types.ts'
import type { WorkitemConditionGroups } from '../src/sync/dto.ts'
import { parseSyncRequest } from '../src/sync/validation.ts'

const COMPANY = '70000001'
const PROJECT = '20000001'
const states = { todo: 'open', in_progress: 'progressing', done: 'done' }
const opened: { store: TaskStore; root: string }[] = []
afterEach(() => {
  for (const { store, root } of opened.splice(0)) {
    store.close()
    rmSync(root, { recursive: true, force: true })
  }
})

function setup(conditions: WorkitemConditionGroups = []) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-tapd-executor-'))
  const store = new TaskStore(join(root, 'tasks.sqlite'))
  opened.push({ store, root })
  const clock: Clock = {
    now: () => Date.now(),
    sleep: (_ms, signal) => new Promise((_resolve, reject) => {
      if (signal.aborted) reject(new DOMException('aborted', 'AbortError'))
      else signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }),
  }
  const config = new SyncConfigStore(store.db, () => ({ TAPD_TOKEN: 'fixture-token' }))
  const connection = config.createConnection({ platform: 'tapd', name: 'TAPD', companyId: COMPANY, tokenEnv: 'TAPD_TOKEN', enabled: true })
  let rule = config.createRule({ connectionId: connection.id, projectId: PROJECT, enabled: true, workspaceId: null, conditions, statusWriteStates: states })
  const links = new SyncLinkStore(store.db, store, clock)
  const runs = new SyncRunStore(store.db, clock)
  const rows: Record<string, Record<string, unknown>[]> = {
    stories: [{ id: '9007199254740993000', workspace_id: PROJECT, name: 'Story title', status: 'open', description: 'Story body', modified: '2026-10-10 12:00:00' }],
    bugs: [{ id: '9007199254740993000', workspace_id: PROJECT, title: 'Bug title', status: 'open', description: 'Bug body', current_owner: 'alice', modified: '2026-10-10 12:00:00' }],
    tasks: [{ id: '9007199254740993000', workspace_id: PROJECT, name: 'Task title', status: 'open', description: 'Task body', owner: 'alice', modified: '2026-10-10 12:00:00' }],
  }
  const reads: URL[] = []
  const writes: { url: URL; body: URLSearchParams }[] = []
  let rejectDiscovery = false
  const transport: SyncTransport = {
    async read(request) {
      const url = request.url
      reads.push(url)
      const collection = url.pathname.slice(1)
      const wrapper = ({ stories: 'Story', bugs: 'Bug', tasks: 'Task' } as Record<string, string>)[collection]
      if (!wrapper) throw new Error(`unrouted request: ${url}`)
      if (rejectDiscovery && !url.searchParams.has('id')) return { value: { status: 0, info: 'invalid parameter', data: [] }, headers: new Headers(), status: 200 }
      const selected = (rows[collection] ?? []).filter(row => !url.searchParams.has('id') || row.id === url.searchParams.get('id'))
      return { value: { status: 1, data: selected.map(row => ({ [wrapper]: row })) }, headers: new Headers(), status: 200 }
    },
    async write(request) {
      const body = new URLSearchParams(String(request.body))
      writes.push({ url: request.url, body })
      const collection = request.url.pathname.split('/')[1]!
      const row = rows[collection]!.find(row => row.id === body.get('id'))!
      row.status = body.get('status')
      return { value: { status: 1, data: {}, info: 'success' }, headers: new Headers(), status: 200 }
    },
  } as SyncTransport
  const executor = new SyncExecutor({ tasks: store, config, links, runs, clock, adapterFactory: connection => createTapdAdapter(connection, transport, {}, { kind: 'tapd', token: 'fixture-token' }) })
  return {
    store, config, links, runs, rows, reads, writes, executor,
    async run() { const { runId } = executor.start(); await executor.done(); return runs.getRun(runId)! },
    changeConditions(conditions: WorkitemConditionGroups) { rule = config.updateRule({ id: rule.id, revision: rule.revision, conditions }) },
    failDiscovery() { rejectDiscovery = true },
    taskKey: { instance: COMPANY, projectId: PROJECT, typeId: 'task', id: '9007199254740993000' },
  }
}

describe('TAPD executor integration', () => {
  it('imports all three categories for an empty rule, keeping same numeric IDs distinct', async () => {
    const s = setup()
    const run = await s.run()
    expect(run.status).toBe('completed')
    expect(run.discoveryComplete).toBe(true)
    expect(run.counts.imported).toBe(3)
    for (const typeId of ['story', 'bug', 'task']) {
      const link = s.links.getLink({ ...s.taskKey, typeId })!
      const task = s.store.get(link.taskId!)!
      expect(task.title).toBe(`${typeId[0]!.toUpperCase()}${typeId.slice(1)} title`)
      expect(task.notes).toContain(`${typeId[0]!.toUpperCase()}${typeId.slice(1)} body`)
      expect(task.status).toBe('todo')
    }
    expect(s.writes).toHaveLength(0)
    const second = await s.run()
    expect(second.counts.unchanged).toBe(3)
    expect(second.counts.imported).toBe(0)
  })

  it('discovers workitemType category multi-select, not workitem_type_id', async () => {
    const s = setup([[{ field: 'workitemType', operator: 'EQUALS', value: ['bug', 'task'] }]])
    expect((await s.run()).counts.imported).toBe(2)
    expect(s.reads.every(url => url.pathname !== '/stories')).toBe(true)
    expect(s.reads.every(url => !url.searchParams.has('workitem_type_id'))).toBe(true)
  })

  it('pushes only local status, preserves local title/body, ignores remote-only status and follows existing links outside the filter', async () => {
    const s = setup([[{ field: 'workitemType', value: ['task'] }]])
    await s.run()
    const link = s.links.getLink(s.taskKey)!
    const task = s.store.get(link.taskId!)!
    s.store.update({ id: task.id, version: task.version, status: 'done', title: 'Local title', notes: 'Local body' })
    s.changeConditions([[{ field: 'workitemType', value: ['task'] }, { field: 'assignedTo', value: ['bob'] }]])
    const run = await s.run()
    expect(run.counts.pushed).toBe(1)
    expect(s.writes).toHaveLength(1)
    expect(s.writes[0]!.url.pathname).toBe('/tasks/update')
    expect(Object.fromEntries(s.writes[0]!.body)).toEqual({ workspace_id: PROJECT, id: s.taskKey.id, status: 'done', auto_complete_effort: '0' })
    const result = s.runs.listItemResults(run.id, 1, 20).items[0]!
    expect(result.outsideFilter).toBe(true)
    expect(result.changedFields).toEqual(['status'])
    expect(s.store.get(task.id)).toMatchObject({ title: 'Local title', notes: 'Local body', status: 'done' })
    s.rows.tasks![0]!.status = 'progressing'
    expect((await s.run()).counts.unchanged).toBe(1)
    expect(s.store.get(task.id)?.status).toBe('done')
    expect(s.writes).toHaveLength(1)
  })

  it('keeps syncing existing links after incomplete discovery and reports partial honestly', async () => {
    const s = setup([[{ field: 'workitemType', value: ['task'] }]])
    await s.run()
    const task = s.store.get(s.links.getLink(s.taskKey)!.taskId!)!
    s.store.update({ id: task.id, version: task.version, status: 'in_progress' })
    s.failDiscovery()
    const run = await s.run()
    expect(run.status).toBe('partial')
    expect(run.discoveryComplete).toBe(false)
    expect(run.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'InvalidRemoteResponse' })]))
    expect(run.counts.pushed).toBe(1)
    expect(s.writes[0]!.body.get('status')).toBe('progressing')
  })

  it('documents that legacy category cannot pass shared rule validation; new workitemType and empty rules can', () => {
    const base = { connectionId: 'c', projectId: PROJECT, statusWriteStates: states }
    expect(() => parseSyncRequest('createSyncRule', { ...base, conditions: [[{ field: 'category', value: ['task'] }]] })).toThrow()
    expect(() => parseSyncRequest('createSyncRule', { ...base, conditions: [[{ field: 'workitemType', value: ['task'] }]] })).not.toThrow()
    expect(() => parseSyncRequest('createSyncRule', { ...base, conditions: [] })).not.toThrow()
  })
})
