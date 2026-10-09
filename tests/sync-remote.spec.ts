import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncLinkStore } from '../src/sync/link-store.ts'
import { SyncRunStore } from '../src/sync/run-store.ts'
import { SyncExecutor } from '../src/sync/executor.ts'
import { SyncService } from '../src/sync/service.ts'
import { TYPERT_REMOTE } from '../src/remote.ts'
import { SYNC_METHODS } from '../src/sync/dto.ts'
import { SyncTransport } from '../src/sync/transport.ts'
import { createYunxiaoAdapter } from '../src/sync/adapters/yunxiao.ts'
import type { Clock, AdapterContext, AdapterFactory, SyncAdapter } from '../src/sync/types.ts'
import type { CreateConnectionRequest, SafeConnection, SyncMetadata } from '../src/sync/dto.ts'

const roots: string[] = []
const closable: { close(): void }[] = []
afterEach(() => {
  for (const handle of closable.splice(0)) { try { handle.close() } catch { /* already closed */ } }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-task-list-remote-'))
  roots.push(root)
  return join(root, 'tasks.sqlite')
}

/** A clock that never advances its sleep (waits for abort), so no run leaks a timer. */
function idleClock(): Clock {
  return {
    now: () => Date.now(),
    sleep: (_ms: number, signal: AbortSignal) => new Promise<void>((_resolve, reject) => {
      const onAbort = () => reject(new DOMException('The operation was aborted', 'AbortError'))
      if (signal.aborted) { onAbort(); return }
      signal.addEventListener('abort', onAbort, { once: true })
    }),
  }
}

interface Setup {
  store: TaskStore
  clock: Clock
  config: SyncConfigStore
  links: SyncLinkStore
  runs: SyncRunStore
}

function setup(): Setup {
  const store = new TaskStore(fixture())
  closable.push(store)
  const clock = idleClock()
  const config = new SyncConfigStore(store.db, () => ({}))
  const links = new SyncLinkStore(store.db, store, clock)
  const runs = new SyncRunStore(store.db, clock)
  return { store, clock, config, links, runs }
}

function build(s: Setup, adapterFactory: AdapterFactory): { service: SyncService; executor: SyncExecutor } {
  const executor = new SyncExecutor({ tasks: s.store, config: s.config, links: s.links, runs: s.runs, adapterFactory, clock: s.clock })
  const service = new SyncService({ tasks: s.store, config: s.config, links: s.links, runs: s.runs, executor, adapterFactory })
  return { service, executor }
}

const tapdInput: CreateConnectionRequest = { platform: 'tapd', name: 'TAPD', companyId: '20000001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', enabled: false }

function noAdapter(): AdapterFactory {
  return () => { throw new Error('adapter should not be constructed') }
}

/** The safe DTO output must never carry a raw secret, baseline, intent or payload key. */
const FORBIDDEN_OUTPUT = ['raw', 'baseline', 'intent', 'body', 'stack', 'header', 'auth', 'payload', 'url']

function thrown(fn: () => unknown): { code: string; details: { code: string } } | null {
  try { fn(); return null } catch (error) { return error as { code: string; details: { code: string } } }
}

/** The async counterpart of {@link thrown}: connection writes now await the Host credential store. */
async function rejected(fn: () => Promise<unknown>): Promise<{ code: string; details: { code: string } } | null> {
  try { await fn(); return null } catch (error) { return error as { code: string; details: { code: string } } }
}

const mapping = {
  typeId: 'story', category: 'story',
  readStates: { open: 'todo', doing: 'in_progress', done: 'done' },
  writeStates: { todo: 'open', in_progress: 'doing', done: 'done' },
  optionalFields: [] as string[], fieldIds: { title: 'name', status: 'status' }, valueMaps: {},
}

describe('RPC descriptor contract', () => {
  it('exposes sync, authorization, legacy and statistics methods on the taskList namespace', () => {
    const methods = TYPERT_REMOTE.descriptors.map(row => row.method)
    expect(methods).toHaveLength(35)
    for (const method of SYNC_METHODS) expect(methods).toContain(method)
    for (const method of ['capabilities', 'listTasks', 'createTask', 'updateTask', 'deleteTask', 'readTaskAttachments', 'createSubtask', 'updateSubtask', 'deleteSubtask']) {
      expect(methods).toContain(method)
    }
  })

  it('applies a closed request and result codec to sync methods, passthrough to legacy', () => {
    const create = TYPERT_REMOTE.descriptors.find(row => row.method === 'createSyncConnection')!
    const requestSchema = create.parameters[0]!.codec.create()
    // A valid create defaults `enabled` to false and rejects an unsafe secret key.
    expect(requestSchema.parse({ platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'U', passwordEnv: 'P' }))
      .toMatchObject({ platform: 'tapd', enabled: false })
    expect(() => requestSchema.parse({ platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'U', passwordEnv: 'P', token: 'sk-live-secret' })).toThrow()

    const resultSchema = create.result.create()
    const valid = { id: 'x', name: 'T', enabled: false, revision: 1, credentialPresent: false, instance: 'api.tapd.cn', platform: 'tapd', companyId: 'c', userEnv: 'U', passwordEnv: 'P' }
    expect(resultSchema.parse(valid)).toMatchObject({ platform: 'tapd' })
    expect(() => resultSchema.parse({ ...valid, raw: 'sk-live-secret' })).toThrow()

    const legacy = TYPERT_REMOTE.descriptors.find(row => row.method === 'capabilities')!
    expect(legacy.result.create().parse({ version: 1, richText: true, attachments: true, extra: 'x' })).toMatchObject({ version: 1 })
  })
})

describe('SyncService connections and rules', () => {
  it('creates a disabled connection and returns a safe DTO without raw/env values/baseline/intent', async () => {
    const s = setup()
    const { service } = build(s, noAdapter())
    const created = await service.createSyncConnection(tapdInput)
    expect(created.enabled).toBe(false)
    const listed = await service.listSyncConnections()
    expect(listed).toHaveLength(1)
    expect(listed[0]!.platform).toBe('tapd')
    expect(listed[0]!.userEnv).toBe('TAPD_USER')
    expect(listed[0]!.passwordEnv).toBe('TAPD_PASS')
    const json = JSON.stringify(listed)
    for (const key of FORBIDDEN_OUTPUT) expect(json).not.toContain(`"${key}":`)
    expect(Object.keys(listed[0]!).sort()).toEqual(
      ['id', 'name', 'enabled', 'revision', 'authentication', 'credentialPresent', 'instance', 'platform', 'companyId', 'userEnv', 'passwordEnv'].sort(),
    )
  })

  it('creates rules whose safe DTO carries no baseline or intent', async () => {
    const s = setup()
    const { service } = build(s, noAdapter())
    const connection = await service.createSyncConnection(tapdInput)
    const rule = service.createSyncRule({
      connectionId: connection.id, projectId: '20000001', workspaceId: null, enabled: false,
      filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] }, mappings: [mapping],
    })
    expect(rule.enabled).toBe(false)
    const json = JSON.stringify(service.listSyncRules())
    expect(json).not.toContain('baseline')
    expect(json).not.toContain('intent')
    expect(json).not.toContain('raw')
  })

  it('rejects a stale revision with a structured LocalVersionConflict error', async () => {
    const s = setup()
    const { service } = build(s, noAdapter())
    const created = await service.createSyncConnection(tapdInput)
    const updateError = await rejected(() => service.updateSyncConnection({ id: created.id, revision: 999, name: 'X' }))
    expect(updateError?.code).toBe('task-list/sync')
    expect(updateError?.details.code).toBe('LocalVersionConflict')
    const deleteError = await rejected(() => service.deleteSyncConnection({ id: created.id, revision: 999 }))
    expect(deleteError?.details.code).toBe('LocalVersionConflict')
  })
})

describe('read-only queries and configuration', () => {
  it('query methods never write a task or start a sync run', () => {
    const s = setup()
    const { service } = build(s, noAdapter())
    expect(service.getSyncRun({ id: 'missing' })).toBeNull()
    expect(service.listSyncRuns({ page: 1, pageSize: 20 })).toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
    expect(service.listSyncItemResults({ id: 'missing', page: 1, pageSize: 20 })).toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
    expect(service.listSyncRuns({ page: 1, pageSize: 20 }).total).toBe(0)
    expect(s.store.list().total).toBe(0)
  })

  it('saving configuration never starts a sync run', async () => {
    const s = setup()
    const { service } = build(s, noAdapter())
    await service.createSyncConnection(tapdInput)
    service.createSyncRule({
      connectionId: (await service.listSyncConnections())[0]!.id, projectId: 'p', workspaceId: null, enabled: false,
      filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] }, mappings: [mapping],
    })
    expect(service.listSyncRuns({ page: 1, pageSize: 20 }).total).toBe(0)
  })
})

describe('metadata and connection test', () => {
  it('loads metadata through the adapter factory for a disabled connection without a run', async () => {
    const s = setup()
    const created = s.config.createConnection({ platform: 'tapd', name: 'T', companyId: 'c', userEnv: 'U', passwordEnv: 'P', enabled: false })
    const metadata: SyncMetadata = { connectionId: created.id, credentialPresent: false, readOnly: true, projects: [], members: [], iterations: [], types: [], typeCapabilities: [] }
    const calls: { connection: SafeConnection; context: AdapterContext }[] = []
    const adapter: SyncAdapter = {
      metadata: async () => metadata,
      discover: async function* () {},
      read: async () => { throw new Error('unused') },
      write: async () => {},
      evidence: async () => 'unknown',
    }
    const adapterFactory: AdapterFactory = (connection, context) => { calls.push({ connection, context }); return adapter }
    const { service } = build(s, adapterFactory)
    await expect(service.getSyncMetadata({ connectionId: created.id })).resolves.toEqual(metadata)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.connection.id).toBe(created.id)
    expect(typeof calls[0]!.context.beforeRequest).toBe('function')
    expect(service.listSyncRuns({ page: 1, pageSize: 20 }).total).toBe(0)
  })

  it('reports credentialPresent false with a safe error and issues no request when credentials are missing', async () => {
    const s = setup()
    const { service } = build(s, (connection, context) => {
      const transport = new SyncTransport({ fetch: globalThis.fetch, clock: s.clock, beforeRequest: context.beforeRequest })
      return createYunxiaoAdapter(connection, transport, {})
    })
    const created = await service.createSyncConnection({ platform: 'yunxiao', name: 'Y', mode: 'center', organizationId: 'org', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: false })
    const result = await service.testSyncConnection({ connectionId: created.id })
    expect(result.ok).toBe(false)
    expect(result.credentialPresent).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CredentialMissing')
    expect(service.listSyncRuns({ page: 1, pageSize: 20 }).total).toBe(0)
  })

  it('reports a successful read-only test against a disabled connection', async () => {
    const s = setup()
    const created = s.config.createConnection({ platform: 'tapd', name: 'T', companyId: 'c', userEnv: 'U', passwordEnv: 'P', enabled: false })
    const adapter: SyncAdapter = {
      metadata: async () => ({ connectionId: created.id, credentialPresent: true, readOnly: true, projects: [], members: [], iterations: [], types: [], typeCapabilities: [] }),
      discover: async function* () {},
      read: async () => { throw new Error('unused') },
      write: async () => {},
      evidence: async () => 'unknown',
    }
    const adapterFactory: AdapterFactory = () => adapter
    const { service } = build(s, adapterFactory)
    const result = await service.testSyncConnection({ connectionId: created.id })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.readOnly).toBe(true)
  })
})

describe('startSync', () => {
  it('returns a fresh run id then the existing active id and keeps one owner', async () => {
    const s = setup()
    const connection = s.config.createConnection({ platform: 'tapd', name: 'T', companyId: 'c', userEnv: 'U', passwordEnv: 'P', enabled: true })
    s.config.createRule({
      connectionId: connection.id, projectId: 'p', workspaceId: null, enabled: true,
      filters: { assignees: [], typeIds: [], iterationIds: [], statusIds: [] }, mappings: [mapping],
    })
    const adapter: SyncAdapter = {
      metadata: async () => { throw new Error('unused') },
      async *discover(_rule, signal) {
        await new Promise<void>((_resolve, reject) => {
          const onAbort = () => reject(new DOMException('aborted', 'AbortError'))
          if (signal.aborted) { onAbort(); return }
          signal.addEventListener('abort', onAbort, { once: true })
        })
        yield []
      },
      read: async () => { throw new Error('unused') },
      write: async () => {},
      evidence: async () => 'unknown',
    }
    const { service, executor } = build(s, () => adapter)
    const first = service.startSync()
    expect(first.existing).toBe(false)
    expect(first.runId).toBeTruthy()
    const second = service.startSync()
    expect(second.existing).toBe(true)
    expect(second.runId).toBe(first.runId)
    await executor.stop()
  })

  it('returns a completed run after an empty sync settles', async () => {
    const s = setup()
    const { service, executor } = build(s, noAdapter())
    const started = service.startSync()
    expect(started.existing).toBe(false)
    await executor.done()
    expect(service.getSyncRun({ id: started.runId })?.status).toBe('completed')
  })
})

