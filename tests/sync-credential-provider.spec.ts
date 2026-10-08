import { describe, expect, it } from 'vitest'
import { HostSyncCredentialStore } from '../src/sync/credential-provider.ts'
import type { OAuthGrant } from '../src/sync/oauth-types.ts'
const grant: OAuthGrant = { platform: 'yunxiao', instance: 'org', connectionRevision: 1, accessToken: 'secret', refreshToken: 'refresh', expiresAt: 1000, clientId: 'client', tokenEndpoint: 'https://openapi-rdc.aliyuncs.com/v1/oauth2/token', purpose: 'yunxiao-api', accountLabel: null, resourceIds: [], scopes: [] }
describe('Host grant store boundary', () => {
  it('stores only in the plugin-owned grant key and keeps serialized provider mutation', async () => {
    const records = new Map<string, any>(); const keys: string[] = []
    const provider = {
      readRecord: async (key: string) => records.get(key),
      modifyRecord: async (key: string, mutate: any) => { keys.push(key); const next = await mutate(records.get(key)); if (next !== undefined) records.set(key, next); return records.get(key) },
      deleteRecord: async (key: string) => { keys.push(key); records.delete(key) },
    }
    const store = new HostSyncCredentialStore(provider)
    await store.modify('abc-123', async () => grant)
    expect(records.get('task-list/connection-abc-123')).toEqual({ kind: 'grant', payload: grant })
    expect(await store.read('abc-123')).toEqual(grant)
    await store.remove('abc-123')
    expect(records.size).toBe(0)
    expect(keys).toEqual(['task-list/connection-abc-123', 'task-list/connection-abc-123'])
  })
  it('rejects malformed records rather than treating them as absent credentials', async () => {
    const store = new HostSyncCredentialStore({ readRecord: async () => ({ kind: 'grant', payload: { accessToken: 'secret' } }), modifyRecord: async () => undefined, deleteRecord: async () => {} })
    await expect(store.read('abc')).rejects.toMatchObject({ details: { code: 'StorageFailure' } })
  })
})
