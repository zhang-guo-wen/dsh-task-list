import { describe, expect, it } from 'vitest'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { SyncAuthorizationService } from '../src/sync/authorization-service.ts'
import type { OAuthGrant, SyncCredentialStore } from '../src/sync/oauth-types.ts'
function setup() {
  const tasks = new TaskStore(':memory:'); const config = new SyncConfigStore(tasks.db, () => ({}))
  const connection = config.createConnection({ platform: 'yunxiao', name: 'Y', mode: 'center', organizationId: 'org', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: false, authentication: { mode: 'oauth' } })
  const records = new Map<string, OAuthGrant>()
  const store: SyncCredentialStore = { read: async id => records.get(id) ?? null, modify: async (id, fn) => { const next = await fn(records.get(id) ?? null); if (next) records.set(id, next); return next }, remove: async id => { records.delete(id) } }
  const service = new SyncAuthorizationService({ config, store, callbackBaseUrl: 'http://127.0.0.1:3082', resolveSecret: async () => 'secret' })
  return { tasks, connection, records, service }
}
function grant(instance: string, overrides: Partial<OAuthGrant> = {}): OAuthGrant {
  return { platform: 'yunxiao', instance, connectionRevision: 1, accessToken: 'secret', refreshToken: null, expiresAt: Date.now() + 100000, clientId: 'client', tokenEndpoint: 'https://openapi-rdc.aliyuncs.com/v1/oauth2/token', purpose: 'yunxiao-api', accountLabel: null, resourceIds: [], scopes: [], ...overrides }
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
  it('deleting a connection removes its plugin-owned grant as well as configuration', async () => {
    const s = setup()
    s.records.set(s.connection.id, grant(s.connection.instance))
    try { await s.service.deleteConnection({ id: s.connection.id, revision: s.connection.revision }); expect(s.records.size).toBe(0); expect(new SyncConfigStore(s.tasks.db).getConnection(s.connection.id)).toBeNull() } finally { await s.service.dispose(); s.tasks.close() }
  })
  it('cannot restart authorization after plugin disposal', async () => {
    const s = setup(); await s.service.dispose()
    try { await expect(s.service.begin({ connectionId: s.connection.id })).rejects.toMatchObject({ details: { code: 'RunInterrupted' } }) } finally { s.tasks.close() }
  })
  it('marks a 云效 account credential present only while its grant is live', async () => {
    const s = setup()
    try {
      expect((await s.service.decorate(s.connection)).credentialPresent).toBe(false)
      s.records.set(s.connection.id, grant(s.connection.instance))
      expect((await s.service.decorate(s.connection)).credentialPresent).toBe(true)
      s.records.set(s.connection.id, grant(s.connection.instance, { expiresAt: Date.now() - 1 }))
      expect((await s.service.decorate(s.connection)).credentialPresent).toBe(false)
    } finally { await s.service.dispose(); s.tasks.close() }
  })
  it('refuses to start an authorization for a TAPD connection, which has no official path', async () => {
    const tasks = new TaskStore(':memory:')
    const config = new SyncConfigStore(tasks.db, () => ({}))
    const connection = config.createConnection({ platform: 'tapd', name: 'TAPD', companyId: '2001', tokenEnv: 'TAPD_TOKEN', enabled: false })
    const service = new SyncAuthorizationService({ config, store: { read: async () => null, modify: async () => null, remove: async () => {} }, callbackBaseUrl: 'http://127.0.0.1:3082', resolveSecret: async () => 'secret' })
    try {
      await expect(service.begin({ connectionId: connection.id })).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    } finally { await service.dispose(); tasks.close() }
  })
})
