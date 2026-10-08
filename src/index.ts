import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { isAbsolute, join } from 'node:path'
import { HostSyncCredentialStore, type HostCredentialProvider } from './sync/credential-provider.ts'
import { SyncAuthorizationService } from './sync/authorization-service.ts'
import { createOAuthCallbackHandler } from './sync/oauth-route.ts'
import { OAUTH_CALLBACK_PATH } from './sync/oauth.ts'
import { syncError, syncRemoteError } from './sync/errors.ts'
import { TaskStore } from './store.ts'
import { TaskService } from './task-service.ts'
import { StatisticsCacheStore } from './statistics-store.ts'
import { createStatisticsSource } from './statistics-source.ts'
import { StatisticsService } from './statistics-service.ts'
import { SyncConfigStore } from './sync/config-store.ts'
import { SyncLinkStore } from './sync/link-store.ts'
import { SyncRunStore } from './sync/run-store.ts'
import { SyncExecutor } from './sync/executor.ts'
import { SyncService } from './sync/service.ts'
import { SyncTransport } from './sync/transport.ts'
import { createYunxiaoAdapter } from './sync/adapters/yunxiao.ts'
import { createTapdAdapter } from './sync/adapters/tapd.ts'
import type { AdapterFactory, Clock } from './sync/types.ts'

export { TaskStore } from './store.ts'
export type * from './types.ts'

export const name = 'task-list'
export const inject = []
export interface Config { file?: string; dshHome?: string }
export const Config = z.object({
  file: z.string().description('Optional absolute task SQLite path'),
  dshHome: z.string().description('Harness data home override'),
})

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

/** Real wall clock whose `sleep` rejects on abort, so heartbeat and retry backoff settle on stop. */
const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms: number, signal: AbortSignal): Promise<void> => {
    if (signal.aborted) return Promise.reject(abortError())
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
      function onAbort(): void { clearTimeout(timer); reject(abortError()) }
      signal.addEventListener('abort', onAbort, { once: true })
    })
  },
}

export function apply(ctx: Context, config: Config = {}): void {
  if (config.file && !isAbsolute(config.file)) throw new Error('task-list file path must be absolute')
  const file = config.file ?? join(resolveDshHome(config.dshHome), 'task-list', 'tasks.sqlite')
  const store = new TaskStore(file)
  const configStore = new SyncConfigStore(store.db)
  type Credentials = HostCredentialProvider & { resolve(ref: string): Promise<{ value: string } | undefined> }
  type WebServer = { host: string; port: number; register(route: { kind: 'exact'; path: string; handler: ReturnType<typeof createOAuthCallbackHandler> }): () => void }
  const authOptions: import('./sync/authorization-service.ts').AuthorizationOptions = { config: configStore, store: null, callbackBaseUrl: null, resolveSecret: async ref => {
    const credentials = ctx.get('credentials') as Credentials | undefined
    return credentials?.resolve ? (await credentials.resolve(ref))?.value ?? null : process.env[ref] ?? null
  } }
  const authorization = new SyncAuthorizationService(authOptions)
  const authFiber = ctx.inject(['credentials', 'webServer'], authCtx => {
    const credentials = authCtx.get('credentials') as Credentials
    const webServer = authCtx.get('webServer') as WebServer
    if (typeof credentials?.readRecord !== 'function' || typeof credentials?.modifyRecord !== 'function' || typeof credentials?.deleteRecord !== 'function' || webServer.host !== '127.0.0.1') return
    authOptions.store = new HostSyncCredentialStore(credentials)
    authOptions.callbackBaseUrl = `http://127.0.0.1:${webServer.port}`
    const off = webServer.register({ kind: 'exact', path: OAUTH_CALLBACK_PATH, handler: createOAuthCallbackHandler(authorization, authOptions.callbackBaseUrl) })
    authCtx.effect(() => () => { off(); authOptions.store = null; authOptions.callbackBaseUrl = null })
  })
  const links = new SyncLinkStore(store.db, store, realClock)
  const runs = new SyncRunStore(store.db, realClock)
  // Per-request gate bound to a rule/connection is injected through `context`, so
  // every transport attempt respects the current fence/enable/budget. Credentials
  // resolve inside the adapter factory and never enter a DTO.
  const adapterFactory: AdapterFactory = async (connection, context) => {
    if (connection.authentication?.mode === 'oauth') {
      if (connection.platform !== 'tapd' || !context.projectId) throw syncRemoteError(syncError('AuthDenied', { scope: 'connection', field: 'authentication' }))
      context.beforeRequest()
      const token = await authorization.projectToken(connection, context.projectId, context.beforeRequest)
      context.beforeRequest()
      const transport = new SyncTransport({ fetch: globalThis.fetch, clock: realClock, beforeRequest: context.beforeRequest })
      return createTapdAdapter(connection, transport, {}, { kind: 'tapd-project', token, projectIds: [context.projectId] })
    }
    const transport = new SyncTransport({ fetch: globalThis.fetch, clock: realClock, beforeRequest: context.beforeRequest })
    return connection.platform === 'yunxiao'
      ? createYunxiaoAdapter(connection, transport)
      : createTapdAdapter(connection, transport)
  }
  const executor = new SyncExecutor({ tasks: store, config: configStore, links, runs, adapterFactory, clock: realClock })
  const sync = new SyncService({ tasks: store, config: configStore, links, runs, executor, adapterFactory })
  // Session projections are cached in this plugin's own database; the session
  // read surface is resolved per request, so a later-mounted persistence
  // backend is picked up without reloading the plugin.
  const statistics = new StatisticsService(new StatisticsCacheStore(store.db), () => createStatisticsSource(ctx), store)
  // Stop the owned run (revoke ownership, abort, await callbacks) before closing
  // the database, so a late result never writes into a closed store.
  ctx.effect(() => async () => {
    await authorization.dispose()
    await executor.stop()
    await authFiber.dispose()
    store.close()
  }, 'task-list: SQLite close')
  new TaskService(ctx, store, sync, statistics, authorization)
}
