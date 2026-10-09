import { describe, expect, it } from 'vitest'
import { HostManualSecretStore, HostSyncCredentialStore } from '../src/sync/credential-provider.ts'
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

describe('Host typed-credential store', () => {
  function provider(records = new Map<string, unknown>()) {
    return {
      records,
      readRecord: async (key: string) => records.get(key),
      modifyRecord: async (key: string, mutate: (record: unknown) => Promise<unknown>) => { const next = await mutate(records.get(key)); if (next !== undefined) records.set(key, next); return records.get(key) },
      deleteRecord: async (key: string) => { records.delete(key) },
    }
  }
  it('round-trips a token under the connection-scoped secret key only', async () => {
    const host = provider()
    const store = new HostManualSecretStore(host)
    await store.write('abc-123', { platform: 'yunxiao', token: 'pat-secret' })
    expect(host.records.get('task-list/connection-abc-123-secret')).toEqual({ kind: 'grant', payload: { platform: 'yunxiao', token: 'pat-secret' } })
    expect(host.records.has('task-list/connection-abc-123')).toBe(false)
    expect(await store.read('abc-123')).toEqual({ platform: 'yunxiao', token: 'pat-secret' })
    await store.remove('abc-123')
    expect(await store.read('abc-123')).toBeNull()
  })
  it('round-trips the TAPD API pair and rejects a blank or foreign record', async () => {
    const store = new HostManualSecretStore(provider())
    await store.write('c-1', { platform: 'tapd', user: 'u', password: 'p' })
    expect(await store.read('c-1')).toEqual({ platform: 'tapd', user: 'u', password: 'p' })
    const blank = new HostManualSecretStore({ readRecord: async () => ({ kind: 'grant', payload: { platform: 'yunxiao', token: '   ' } }), modifyRecord: async () => undefined, deleteRecord: async () => {} })
    await expect(blank.read('c-1')).rejects.toMatchObject({ details: { code: 'StorageFailure' } })
    const foreign = new HostManualSecretStore({ readRecord: async () => ({ kind: 'api-key', key: 'x' }), modifyRecord: async () => undefined, deleteRecord: async () => {} })
    await expect(foreign.read('c-1')).rejects.toMatchObject({ details: { code: 'StorageFailure' } })
  })
  it('persists both manual and OAuth credentials in Host-supported records across a reload', async () => {
    const records = new Map<string, unknown>()
    const host = provider(records)
    const checked = {
      ...host,
      modifyRecord: async (key: string, mutate: (record: unknown) => Promise<unknown>) => host.modifyRecord(key, async current => {
        const next = await mutate(current) as { kind: string; payload: unknown }
        // The Host accepts only api-key and grant; custom kinds prevent startup.
        if (next.kind !== 'grant') throw new Error('Unsupported Host credential kind')
        return JSON.parse(JSON.stringify(next))
      }),
    }
    await new HostManualSecretStore(checked).write('abc-123', { platform: 'yunxiao', token: 'pat-secret' })
    await new HostManualSecretStore(checked).write('tapd-123', { platform: 'tapd', user: 'user', password: 'password' })
    await new HostSyncCredentialStore(checked).modify('abc-123', async () => grant)
    const reloaded = provider(new Map(JSON.parse(JSON.stringify([...records]))))
    expect(await new HostManualSecretStore(reloaded).read('abc-123')).toEqual({ platform: 'yunxiao', token: 'pat-secret' })
    expect(await new HostManualSecretStore(reloaded).read('tapd-123')).toEqual({ platform: 'tapd', user: 'user', password: 'password' })
    expect(await new HostSyncCredentialStore(reloaded).read('abc-123')).toEqual(grant)
  })
  it('refuses a connection id outside the record-key grammar', async () => {
    const store = new HostManualSecretStore(provider())
    await expect(store.write('bad/id', { platform: 'yunxiao', token: 'x' })).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
  })
})
