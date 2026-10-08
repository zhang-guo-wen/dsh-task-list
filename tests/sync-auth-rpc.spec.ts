import { describe, expect, it } from 'vitest'
import { TYPERT_REMOTE } from '../src/remote.ts'
const method = (name: string) => TYPERT_REMOTE.descriptors!.find(row => row.method === name)!
describe('authorization RPC codecs', () => {
  it('exposes four closed methods and never admits a client secret as configuration', () => {
    for (const name of ['getSyncAuthState', 'beginSyncAuthorization', 'cancelSyncAuthorization', 'disconnectSyncAuthorization']) expect(method(name)).toBeDefined()
    const parse = method('beginSyncAuthorization').parameters[0]!.codec!.schema!.parse
    expect(parse({ connectionId: 'c1' })).toEqual({ connectionId: 'c1' })
    expect(() => parse({ connectionId: 'c1', token: 'secret' })).toThrow()
  })
  it('refuses invented error codes in safe authorization state', () => {
    const parse = method('getSyncAuthState').result!.schema!.parse
    expect(() => parse({ connectionId: 'c1', status: 'failed', attemptId: null, expiresAt: null, accountLabel: null, resourceIds: [], projectAccess: 'unverified', error: { code: 'secret-provider-body', docKey: 'unknown' } })).toThrow()
  })
  it('refuses authorization URLs containing tokens or untrusted origins', () => {
    const parse = method('beginSyncAuthorization').result!.schema!.parse
    expect(() => parse({ attemptId: 'a', expiresAt: 1000, authorizationUrl: 'https://evil.example/?state=x' })).toThrow()
    expect(() => parse({ attemptId: 'a', expiresAt: 1000, authorizationUrl: 'https://account-devops.aliyun.com/v1/oauth2/authorize?access_token=secret' })).toThrow()
  })
})
