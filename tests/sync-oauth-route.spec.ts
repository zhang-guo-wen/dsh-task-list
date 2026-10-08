import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { createOAuthCallbackHandler } from '../src/sync/oauth-route.ts'
const servers: Server[] = []
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))) })
describe('callback HTTP boundary', () => {
  it('never reflects authorization codes or provider messages and rejects non-GET requests', async () => {
    const calls: URL[] = []
    let handler: ReturnType<typeof createOAuthCallbackHandler>
    const server = createServer((req, res) => handler(req, res))
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing address')
    const base = `http://127.0.0.1:${address.port}`
    handler = createOAuthCallbackHandler({ callback: async url => { calls.push(url); throw new Error('private-code-provider-text') } }, base)
    const response = await fetch(base + '/task-list/oauth/callback?state=safe&code=private-code-provider-text')
    expect(response.status).toBe(400)
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain('private-code-provider-text')
    expect(calls).toHaveLength(1)
    const post = await fetch(base + '/task-list/oauth/callback', { method: 'POST' })
    expect(post.status).toBe(405); expect(calls).toHaveLength(1)
  })
})
