import { describe, expect, it } from 'vitest'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncAuthorizationService } from '../src/sync/authorization-service.ts'
import type { OAuthGrant, SyncCredentialStore } from '../src/sync/oauth-types.ts'
function setup() {
  const tasks = new TaskStore(':memory:'); const config = new SyncConfigStore(tasks.db, () => ({}))
  const connection = config.createConnection({ platform: 'tapd', name: 'TAPD', companyId: '2001', userEnv: 'T_USER', passwordEnv: 'T_PASS', enabled: false, authentication: { mode: 'oauth', appId: 'app', appSecretRef: 'APP_SECRET', callbackUrl: 'http://127.0.0.1:3082/task-list/oauth/callback' } })
  const records = new Map<string, OAuthGrant>()
  const store: SyncCredentialStore = { read: async id => records.get(id) ?? null, modify: async (id, fn) => { const next = await fn(records.get(id) ?? null); if (next) records.set(id, next); return next }, remove: async id => { records.delete(id) } }
  const service = new SyncAuthorizationService({ config, store, callbackBaseUrl: 'http://127.0.0.1:3082', resolveSecret: async () => 'secret' })
  return { tasks, connection, records, service }
}
describe('connection-bound authorization', () => {
  it('late Host capability activation makes authorization available without replacing task services', async () => {
    const s = setup()
    const options = { config: new SyncConfigStore(s.tasks.db), store: null as SyncCredentialStore | null, callbackBaseUrl: null as string | null, resolveSecret: async () => 'secret' }
    const service = new SyncAuthorizationService(options)
    try {
      expect((await service.state({ connectionId: s.connection.id })).status).toBe('unavailable')
      options.store = { read: async () => null, modify: async () => null, remove: async () => {} }; options.callbackBaseUrl = 'http://127.0.0.1:3082'
      expect((await service.state({ connectionId: s.connection.id })).status).toBe('signed-out')
    } finally { await service.dispose(); await s.service.dispose(); s.tasks.close() }
  })
  it('deleting a connection removes its plugin-owned grants as well as configuration', async () => {
    const s = setup()
    const grant = { platform: 'tapd', instance: s.connection.instance, connectionRevision: 1, accessToken: 'secret', refreshToken: null, expiresAt: Date.now() + 100000, clientId: 'app', tokenEndpoint: 'https://api.tapd.cn/tokens/request_token', purpose: 'tapd-project', accountLabel: null, resourceIds: ['p1'], scopes: ['story'] } as OAuthGrant
    s.records.set(s.connection.id + '-project', grant)
    try { await s.service.deleteConnection({ id: s.connection.id, revision: s.connection.revision }); expect(s.records.size).toBe(0); expect(new SyncConfigStore(s.tasks.db).getConnection(s.connection.id)).toBeNull() } finally { await s.service.dispose(); s.tasks.close() }
  })
  it('cannot restart authorization after plugin disposal', async () => {
    const s = setup(); await s.service.dispose()
    try { await expect(s.service.begin({ connectionId: s.connection.id })).rejects.toMatchObject({ details: { code: 'RunInterrupted' } }) } finally { s.tasks.close() }
  })
  it('marks project credentials present only for the current instance and application', async () => {
    const s = setup()
    const grant: OAuthGrant = { platform: 'tapd', instance: s.connection.instance, connectionRevision: 1, accessToken: 'project-secret', refreshToken: null, expiresAt: Date.now() + 100000, clientId: 'app', tokenEndpoint: 'https://api.tapd.cn/tokens/request_token', purpose: 'tapd-project', accountLabel: null, scopes: ['story', 'task', 'bug'], resourceIds: ['p1'] }
    try {
      expect((await s.service.decorate(s.connection)).credentialPresent).toBe(false)
      s.records.set(s.connection.id + '-project', grant)
      expect((await s.service.decorate(s.connection)).credentialPresent).toBe(true)
      s.records.set(s.connection.id + '-project', { ...grant, instance: 'another-company' })
      expect((await s.service.decorate(s.connection)).credentialPresent).toBe(false)
    } finally { await s.service.dispose(); s.tasks.close() }
  })
})
