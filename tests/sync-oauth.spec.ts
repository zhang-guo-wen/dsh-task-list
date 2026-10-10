import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { OAuthManager } from '../src/sync/oauth.ts'
import type { OAuthGrant, SyncCredentialStore } from '../src/sync/oauth-types.ts'
const connection = { id: '11111111-1111-4111-8111-111111111111', platform: 'yunxiao' as const, instance: 'org', revision: 1 }
function setup(tokenEndpoint = 'https://openapi-rdc.aliyuncs.com/v1/oauth2/token') {
  const records = new Map<string, OAuthGrant>()
  let tail = Promise.resolve()
  const store: SyncCredentialStore = {
    read: async id => records.get(id) ?? null,
    modify: (id, mutate) => {
      const result = tail.then(async () => { const next = await mutate(records.get(id) ?? null); if (next) records.set(id, next); else records.delete(id); return next })
      tail = result.then(() => {}, () => {})
      return result
    },
    remove: async id => { await tail; records.delete(id) },
  }
  let now = 1_700_000_000_000
  const calls: { url: string; body: string }[] = []
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const address = String(url); calls.push({ url: address, body: String(init?.body ?? '') })
    if (address.endsWith('oauth-authorization-server')) return Response.json({ issuer: 'https://openapi-rdc.aliyuncs.com', authorization_endpoint: 'https://account-devops.aliyun.com/v1/oauth2/authorize', registration_endpoint: 'https://openapi-rdc.aliyuncs.com/v1/oauth2/register', token_endpoint: tokenEndpoint, code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] })
    if (address.endsWith('/register')) return Response.json({ client_id: 'public-client' })
    return Response.json({ access_token: 'oat-secret', refresh_token: 'ort-secret', token_type: 'Bearer', expires_in: 86400 })
  }
  const manager = new OAuthManager({ store, fetch: fetcher, now: () => now, callbackBaseUrl: 'http://127.0.0.1:3082' })
  return { manager, records, calls, advance: (ms: number) => { now += ms } }
}

describe('official OAuth attempt lifecycle', () => {
  it('uses PKCE S256 and one-use state, never sends a secret to the browser', async () => {
    const s = setup(); const begin = await s.manager.begin(connection)
    const url = new URL(begin.authorizationUrl)
    expect(url.origin).toBe('https://account-devops.aliyun.com')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')!.length).toBeGreaterThanOrEqual(43)
    expect(begin.authorizationUrl).not.toContain('code_verifier')
    const callback = new URL('http://127.0.0.1:3082/task-list/oauth/callback')
    callback.searchParams.set('state', url.searchParams.get('state')!); callback.searchParams.set('code', 'one-use-code')
    await s.manager.callback(callback)
    const body = new URLSearchParams(s.calls.at(-1)!.body)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(createHash('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(url.searchParams.get('code_challenge'))
    expect(s.records.get(connection.id)?.accessToken).toBe('oat-secret')
    expect(await s.manager.state(connection.id)).toMatchObject({ status: 'authorized' })
    expect(JSON.stringify(await s.manager.state(connection.id))).not.toContain('oat-secret')
    await expect(s.manager.callback(callback)).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    await s.manager.dispose()
  })
  it('rejects bad or duplicate state before exchanging a token', async () => {
    const s = setup(); const begin = await s.manager.begin(connection)
    const url = new URL(begin.authorizationUrl); const before = s.calls.length
    await expect(s.manager.callback(new URL('http://127.0.0.1:3082/task-list/oauth/callback?state=wrong&code=x'))).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    const callback = new URL(`http://127.0.0.1:3082/task-list/oauth/callback?state=${url.searchParams.get('state')}&state=extra&code=x`)
    await expect(s.manager.callback(callback)).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    expect(s.calls).toHaveLength(before)
    await s.manager.dispose()
  })
  it('cancel and expiry prevent callbacks from storing a grant', async () => {
    const s = setup(); const begin = await s.manager.begin(connection)
    const url = new URL(begin.authorizationUrl)
    await s.manager.cancel(connection.id, begin.attemptId)
    await expect(s.manager.callback(new URL(`http://127.0.0.1:3082/task-list/oauth/callback?state=${url.searchParams.get('state')}&code=x`))).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    const next = await s.manager.begin(connection); s.advance(600001)
    await expect(s.manager.callback(new URL(`http://127.0.0.1:3082/task-list/oauth/callback?state=${new URL(next.authorizationUrl).searchParams.get('state')}&code=x`))).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    expect(s.records.size).toBe(0); await s.manager.dispose()
  })
  it('rejects metadata directing the token exchange to an untrusted host', async () => {
    const s = setup('https://evil.example/token')
    await expect(s.manager.begin(connection)).rejects.toMatchObject({ details: { code: 'InvalidConfig' } })
    expect(s.calls).toHaveLength(1); await s.manager.dispose()
  })
  it('serializes refreshes and disconnect removes the persisted grant', async () => {
    const s = setup(); const begin = await s.manager.begin(connection)
    await s.manager.callback(new URL(`http://127.0.0.1:3082/task-list/oauth/callback?state=${new URL(begin.authorizationUrl).searchParams.get('state')}&code=x`))
    s.advance(86400_000)
    const before = s.calls.length
    const tokens = await Promise.all([s.manager.accessToken(connection.id), s.manager.accessToken(connection.id)])
    expect(tokens).toEqual(['oat-secret', 'oat-secret'])
    expect(s.calls.length - before).toBe(1)
    expect(new URLSearchParams(s.calls.at(-1)!.body).get('grant_type')).toBe('refresh_token')
    await s.manager.disconnect(connection.id)
    expect(s.records.size).toBe(0)
    expect(await s.manager.state(connection.id)).toMatchObject({ status: 'signed-out' })
    await s.manager.dispose()
  })
  it('disconnect during a refresh cannot resurrect the grant when the response arrives late', async () => {
    const s = setup(); const begin = await s.manager.begin(connection)
    await s.manager.callback(new URL(`http://127.0.0.1:3082/task-list/oauth/callback?state=${new URL(begin.authorizationUrl).searchParams.get('state')}&code=x`))
    s.advance(86400_000)
    const promise = s.manager.accessToken(connection.id)
    const rejection = expect(promise).rejects.toMatchObject({ details: { code: 'RunInterrupted' } })
    await s.manager.disconnect(connection.id)
    await rejection
    expect(s.records.size).toBe(0); await s.manager.dispose()
  })
  it('a cancelled in-flight exchange cannot commit a late token', async () => {
    const records = new Map<string, OAuthGrant>(); let release!: (response: Response) => void
    const manager = new OAuthManager({ now: () => 1000, callbackBaseUrl: 'http://127.0.0.1:3082',
      store: { read: async id => records.get(id) ?? null, modify: async (id, fn) => { const next = await fn(records.get(id) ?? null); if (next) records.set(id, next); return next }, remove: async id => { records.delete(id) } },
      fetch: async url => String(url).endsWith('oauth-authorization-server') ? Response.json({ issuer: 'https://openapi-rdc.aliyuncs.com', authorization_endpoint: 'https://account-devops.aliyun.com/v1/oauth2/authorize', registration_endpoint: 'https://openapi-rdc.aliyuncs.com/v1/oauth2/register', token_endpoint: 'https://openapi-rdc.aliyuncs.com/v1/oauth2/token', code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] }) : String(url).endsWith('/register') ? Response.json({ client_id: 'client' }) : new Promise(resolve => { release = resolve }),
    })
    const begin = await manager.begin(connection)
    const pending = manager.callback(new URL(`http://127.0.0.1:3082/task-list/oauth/callback?state=${new URL(begin.authorizationUrl).searchParams.get('state')}&code=x`))
    const rejection = expect(pending).rejects.toMatchObject({ details: { code: 'RunInterrupted' } })
    const cancelled = manager.cancel(connection.id, begin.attemptId)
    release(Response.json({ access_token: 'late-secret', token_type: 'Bearer', expires_in: 86400 }))
    await cancelled; await rejection
    expect(records.size).toBe(0); await manager.dispose()
  })
  it('disconnect waits for the final credential commit even when removal is not serialized by the provider', async () => {
    const records = new Map<string, OAuthGrant>(); let committed!: () => void; let release!: () => void
    const entered = new Promise<void>(resolve => { committed = resolve })
    const store: SyncCredentialStore = {
      read: async id => records.get(id) ?? null,
      modify: async (id, mutate) => { const next = await mutate(records.get(id) ?? null); committed(); await new Promise<void>(resolve => { release = resolve }); if (next) records.set(id, next); return next },
      remove: async id => { records.delete(id) },
    }
    const manager = new OAuthManager({
      store, now: () => 1000, callbackBaseUrl: 'http://127.0.0.1:3082',
      fetch: async url => String(url).endsWith('oauth-authorization-server')
        ? Response.json({ issuer: 'https://openapi-rdc.aliyuncs.com', authorization_endpoint: 'https://account-devops.aliyun.com/v1/oauth2/authorize', registration_endpoint: 'https://openapi-rdc.aliyuncs.com/v1/oauth2/register', token_endpoint: 'https://openapi-rdc.aliyuncs.com/v1/oauth2/token', code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] })
        : String(url).endsWith('/register') ? Response.json({ client_id: 'client' }) : Response.json({ access_token: 'late-secret', token_type: 'Bearer', expires_in: 86400 }),
    })
    const begin = await manager.begin(connection)
    const pending = manager.callback(new URL(`http://127.0.0.1:3082/task-list/oauth/callback?state=${new URL(begin.authorizationUrl).searchParams.get('state')}&code=x`))
    const rejected = expect(pending).rejects.toMatchObject({ details: { code: 'RunInterrupted' } })
    await entered
    let disconnected = false
    const cleanup = manager.disconnect(connection.id).then(() => { disconnected = true })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(disconnected).toBe(false)
    release(); await cleanup; await rejected
    expect(records.size).toBe(0); await manager.dispose()
  })
})
