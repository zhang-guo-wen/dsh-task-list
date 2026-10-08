import { describe, expect, it, vi } from 'vitest'
import { resolveCredentials } from '../src/sync/credentials.ts'
import { syncError, syncRemoteError } from '../src/sync/errors.ts'
import { SyncTransport } from '../src/sync/transport.ts'
import type { Clock, HostRequest, SafeConnection } from '../src/sync/types.ts'

// --- controllable clock ---------------------------------------------------

interface FakeClockApi {
  clock: Clock
  now(): number
  advance(ms: number): Promise<void>
  activeSleeps(): number
}

function makeFakeClock(initial = 1_700_000_000_000): FakeClockApi {
  let current = initial
  const pending: { at: number; resolve: () => void; reject: (e: unknown) => void }[] = []
  const abortError = () => new DOMException('The operation was aborted', 'AbortError')

  const clock: Clock = {
    now: () => current,
    sleep(ms: number, signal: AbortSignal): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (signal.aborted) { reject(abortError()); return }
        const entry: { at: number; resolve: () => void; reject: (e: unknown) => void } = {
          at: current + ms, resolve: () => {}, reject: () => {},
        }
        const onAbort = () => {
          const i = pending.indexOf(entry)
          if (i >= 0) pending.splice(i, 1)
          entry.reject(abortError())
        }
        entry.resolve = () => { signal.removeEventListener('abort', onAbort); resolve() }
        entry.reject = (e: unknown) => { signal.removeEventListener('abort', onAbort); reject(e) }
        signal.addEventListener('abort', onAbort, { once: true })
        pending.push(entry)
      })
    },
  }

  async function advance(ms: number): Promise<void> {
    const target = current + ms
    for (;;) {
      const due = pending.filter(e => e.at <= target).sort((a, b) => a.at - b.at)
      if (due.length === 0) break
      const next = due[0]!
      current = next.at
      const i = pending.indexOf(next)
      if (i >= 0) pending.splice(i, 1)
      next.resolve()
      await settle()
    }
    current = target
    await settle()
  }

  return { clock, now: () => current, advance, activeSleeps: () => pending.length }
}

/** Flush the microtask queue so async chains settle without real timers. */
function settle(): Promise<void> {
  return new Promise<void>(resolve => setImmediate(resolve))
}

// --- fixtures -------------------------------------------------------------

function request(overrides: Partial<HostRequest> = {}): HostRequest {
  return {
    url: new URL('https://api.tapd.cn/stories?workspace_id=1'),
    method: 'GET',
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
    readOnly: true,
    ...overrides,
  }
}

function yunxiaoConnection(overrides: Partial<SafeConnection> = {}): SafeConnection {
  return {
    id: '1', name: 'Yunxiao', enabled: true, revision: 1, credentialPresent: true, instance: 'org',
    platform: 'yunxiao', mode: 'center', organizationId: 'org', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN',
    ...overrides,
  } as SafeConnection
}

function tapdConnection(overrides: Partial<SafeConnection> = {}): SafeConnection {
  return {
    id: '1', name: 'TAPD', enabled: true, revision: 1, credentialPresent: true, instance: '20000001',
    platform: 'tapd', companyId: '20000001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS',
    ...overrides,
  } as SafeConnection
}

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function textResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers })
}

function streamResponse(chunks: (string | Uint8Array)[], status = 200, headers: Record<string, string> = {}): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      controller.close()
    },
  })
  return new Response(stream, { status, headers })
}

// --- error inspection -----------------------------------------------------

async function captureRejection(p: Promise<unknown>): Promise<unknown> {
  try { await p } catch (e) { return e }
  throw new Error('expected rejection but the promise resolved')
}

function capture(fn: () => unknown): unknown {
  try { fn() } catch (e) { return e }
  throw new Error('expected throw but the call did not throw')
}

function detailCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'details' in err) {
    const details = (err as { details?: unknown }).details
    if (details && typeof details === 'object' && 'code' in details) return (details as { code: string }).code
  }
  return undefined
}

async function rejectCode(p: Promise<unknown>): Promise<string | undefined> {
  return detailCode(await captureRejection(p))
}

function secretStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) secretStrings(item, out)
  else if (value && typeof value === 'object') for (const item of Object.values(value)) secretStrings(item, out)
  return out
}

const SECRET = 'SUPERSECRETVALUE123'

// --- credentials ----------------------------------------------------------

describe('resolveCredentials', () => {
  it('resolves a yunxiao token from the referenced environment variable', () => {
    const credentials = resolveCredentials(yunxiaoConnection(), { YUNXIAO_TOKEN: 'tok-123' })
    expect(credentials).toEqual({ kind: 'yunxiao', token: 'tok-123' })
  })

  it('resolves tapd user and password from the referenced variables', () => {
    const credentials = resolveCredentials(tapdConnection(), { TAPD_USER: 'u', TAPD_PASS: 'p' })
    expect(credentials).toEqual({ kind: 'tapd', user: 'u', password: 'p' })
  })

  it('throws CredentialMissing when the yunxiao token variable is missing or empty', () => {
    expect(() => resolveCredentials(yunxiaoConnection(), {})).toThrow()
    expect(() => resolveCredentials(yunxiaoConnection(), { YUNXIAO_TOKEN: '' })).toThrow()
    expect(detailCode(capture(() => resolveCredentials(yunxiaoConnection(), {})))).toBe('CredentialMissing')
  })

  it('throws CredentialMissing when the tapd password is missing', () => {
    const err = capture(() => resolveCredentials(tapdConnection(), { TAPD_USER: 'u' }))
    expect(detailCode(err)).toBe('CredentialMissing')
  })

  it('reads only the referenced environment variable names, never enumerates', () => {
    const accessed: string[] = []
    const env = new Proxy({ YUNXIAO_TOKEN: 'tok-1' } as Record<string, string | undefined>, {
      get(target, prop, receiver) {
        if (typeof prop === 'string') accessed.push(prop)
        return Reflect.get(target, prop, receiver)
      },
    })
    const credentials = resolveCredentials(yunxiaoConnection(), env)
    expect(credentials).toEqual({ kind: 'yunxiao', token: 'tok-1' })
    expect(accessed).toEqual(['YUNXIAO_TOKEN'])
  })
})

// --- transport URL boundary ----------------------------------------------

describe('SyncTransport URL boundary', () => {
  const rejectedUrls: [string, string][] = [
    ['http', 'http://api.tapd.cn/stories'],
    ['username', 'https://user@api.tapd.cn/stories'],
    ['password', 'https://:pass@api.tapd.cn/stories'],
    ['ip host', 'https://127.0.0.1/stories'],
    ['non-allowlisted host', 'https://evil.example.com/stories'],
    ['hostname prefix', 'https://api.tapd.cn.evil.com/stories'],
    ['port', 'https://api.tapd.cn:8443/stories'],
    ['fragment', 'https://api.tapd.cn/stories#frag'],
    ['punycode lookalike', 'https://арi.tapd.cn/stories'],
  ]

  it.each(rejectedUrls)('rejects a %s URL without issuing any request', async (_label, raw) => {
    const fetch = vi.fn()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.read(request({ url: new URL(raw) }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('accepts the official tapd and yunxiao center origins', async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const result = await transport.read(request(), new AbortController().signal)
    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)

    const fetch2 = vi.fn(async () => jsonResponse({ ok: true }))
    const transport2 = new SyncTransport({ fetch: fetch2 as unknown as typeof fetch, clock: makeFakeClock().clock })
    await transport2.read(request({ url: new URL('https://openapi-rdc.aliyuncs.com/oapi/v1/x') }), new AbortController().signal)
    expect(fetch2).toHaveBeenCalledTimes(1)
  })
})

// --- request mode enforcement (readOnly routing) --------------------------

describe('SyncTransport request mode enforcement', () => {
  function transportWith(fetch: ReturnType<typeof vi.fn>): SyncTransport {
    return new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
  }

  it('rejects a mutating POST routed to read before any fetch', async () => {
    const fetch = vi.fn()
    const transport = transportWith(fetch)
    const p = transport.read(request({ method: 'POST', body: '{}', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a PUT routed to read before any fetch', async () => {
    const fetch = vi.fn()
    const transport = transportWith(fetch)
    const p = transport.read(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a read whose readOnly flag is absent or non-boolean', async () => {
    const fetch = vi.fn()
    const transport = transportWith(fetch)
    const missing = { ...request(), readOnly: undefined } as unknown as HostRequest
    expect(await rejectCode(transport.read(missing, new AbortController().signal))).toBe('InvalidConfig')
    const nonBool = { ...request(), readOnly: 'yes' } as unknown as HostRequest
    expect(await rejectCode(transport.read(nonBool, new AbortController().signal))).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a request whose verb is outside the GET/POST/PUT enum', async () => {
    const fetch = vi.fn()
    const transport = transportWith(fetch)
    const bad = { ...request(), method: 'DELETE' } as unknown as HostRequest
    expect(await rejectCode(transport.read(bad, new AbortController().signal))).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows a read-only POST search through read with a single fetch', async () => {
    const fetch = vi.fn(async () => jsonResponse({ items: [] }))
    const transport = transportWith(fetch)
    const result = await transport.read(request({ method: 'POST', body: '{}', readOnly: true }), new AbortController().signal)
    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects a GET read whose readOnly flag is false', async () => {
    const fetch = vi.fn()
    const transport = transportWith(fetch)
    const p = transport.read(request({ method: 'GET', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a write marked readOnly to prevent accidental routing', async () => {
    const fetch = vi.fn()
    const transport = transportWith(fetch)
    const p = transport.write(request({ method: 'PUT', body: '{}', readOnly: true }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a write whose verb is GET', async () => {
    const fetch = vi.fn()
    const transport = transportWith(fetch)
    const p = transport.write(request({ method: 'GET', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidConfig')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows a non-readOnly POST write with a single fetch', async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }))
    const transport = transportWith(fetch)
    const result = await transport.write(request({ method: 'POST', body: '{}', readOnly: false }), new AbortController().signal)
    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

// --- redirect handling ----------------------------------------------------

describe('SyncTransport redirect handling', () => {
  it('never follows redirects and never replays auth to another origin', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      throw new TypeError('fetch failed')
    })
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.read(request(), new AbortController().signal)
    const codePromise = rejectCode(p)
    await settle()
    await clock.advance(1_000); await settle()
    await clock.advance(2_000); await settle()
    expect(await codePromise).toBe('NetworkFailure')
    expect(calls.length).toBe(3)
    for (const call of calls) {
      expect(call.url).toBe('https://api.tapd.cn/stories?workspace_id=1')
      expect(call.init.redirect).toBe('error')
    }
  })

  it('classifies an unexpected 3xx read as InvalidRemoteResponse without following', async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (input: string | URL | Request) => {
      calls.push(String(input))
      return new Response(null, { status: 302, headers: { location: 'https://evil.example.com/steal' } })
    })
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.read(request(), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidRemoteResponse')
    expect(calls).toEqual(['https://api.tapd.cn/stories?workspace_id=1'])
  })

  it('classifies an unexpected 3xx write as WriteOutcomeUnknown without following', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example.com/steal' } }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('WriteOutcomeUnknown')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('never leaks a redirect Location header into the error', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 302, headers: { location: `https://evil.example.com/${SECRET}` } }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const err = await captureRejection(transport.read(request(), new AbortController().signal))
    expect(detailCode(err)).toBe('InvalidRemoteResponse')
    for (const text of secretStrings(err)) expect(text).not.toContain(SECRET)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

// --- retry budget and Retry-After ----------------------------------------

describe('SyncTransport read retries', () => {
  it('retries numeric Retry-After once the delay elapses', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '5' }))
      .mockResolvedValue(jsonResponse({ ok: true }))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.read(request(), new AbortController().signal)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(4_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(1)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect((await p).status).toBe(200)
  })

  it('clamps a large numeric Retry-After to 60s', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '90' }))
      .mockResolvedValue(jsonResponse({ ok: true }))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.read(request(), new AbortController().signal)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(59_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(1)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect((await p).status).toBe(200)
  })

  it('honours an HTTP-date Retry-After relative to the injected clock', async () => {
    const base = 1_700_000_000_000
    const future = new Date(base + 10_000).toUTCString()
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': future }))
      .mockResolvedValue(jsonResponse({ ok: true }))
    const clock = makeFakeClock(base)
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.read(request(), new AbortController().signal)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(9_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(1)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect((await p).status).toBe(200)
  })

  it('stops after at most 3 read attempts on persistent 5xx', async () => {
    const fetch = vi.fn(async () => textResponse('boom', 500))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.read(request(), new AbortController().signal)
    const codePromise = rejectCode(p)
    await settle()
    await clock.advance(1_000); await settle()
    await clock.advance(2_000); await settle()
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(await codePromise).toBe('NetworkFailure')
  })

  it('backs off 1s then 2s before the second and third transient attempts', async () => {
    const fetch = vi.fn(async () => textResponse('boom', 500))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.read(request(), new AbortController().signal)
    const codePromise = rejectCode(p)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(1); await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
    await clock.advance(1_999)
    expect(fetch).toHaveBeenCalledTimes(2)
    await clock.advance(1); await settle()
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(await codePromise).toBe('NetworkFailure')
  })

  it('fails immediately on 401 without retrying', async () => {
    const fetch = vi.fn(async () => textResponse('nope', 401))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.read(request(), new AbortController().signal)
    expect(await rejectCode(p)).toBe('AuthDenied')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('aborts a read after the 30s budget elapses', async () => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.read(request(), new AbortController().signal)
    const codePromise = rejectCode(p)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(30_000); await settle()
    expect(await codePromise).toBe('ReadTimeout')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

// --- response body bounds and parsing ------------------------------------

describe('SyncTransport response handling', () => {
  it('returns value, headers and status on a successful JSON read', async () => {
    const fetch = vi.fn(async () => jsonResponse({ items: [] }, 200, { 'x-next-page': '2' }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const result = await transport.read(request(), new AbortController().signal)
    expect(result.status).toBe(200)
    expect(result.value).toEqual({ items: [] })
    expect(result.headers.get('x-next-page')).toBe('2')
  })

  it('rejects a 2xx read whose body is not JSON', async () => {
    const fetch = vi.fn(async () => textResponse('<html>not json</html>', 200))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.read(request(), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidRemoteResponse')
  })

  it('rejects a streaming body over 2MiB even without a Content-Length header', async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1).fill(0x78)
    const fetch = vi.fn(async () => streamResponse([big]))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.read(request(), new AbortController().signal)
    expect(await rejectCode(p)).toBe('InvalidRemoteResponse')
  })

  it('reassembles a JSON body split across chunks', async () => {
    const fetch = vi.fn(async () => streamResponse(['{"a":', '"hello ', 'world", "b":1}']))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const result = await transport.read(request(), new AbortController().signal)
    expect(result.value).toEqual({ a: 'hello world', b: 1 })
  })

  it('returns a non-auth 4xx to the adapter without treating it as success', async () => {
    const fetch = vi.fn(async () => jsonResponse({ error: 'bad' }, 422))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const result = await transport.read(request(), new AbortController().signal)
    expect(result.status).toBe(422)
    expect(result.value).toEqual({ error: 'bad' })
  })

  it('never copies a secret from header, body, or upstream message into the error', async () => {
    // header leak via a 401 (auth denied is not retried, so no backoff)
    const fetchAuth = vi.fn(async () => new Response(null, { status: 401, headers: { 'x-error': SECRET, 'x-upstream': SECRET } }))
    const t1 = new SyncTransport({ fetch: fetchAuth as unknown as typeof fetch, clock: makeFakeClock().clock })
    const err1 = await captureRejection(t1.read(request(), new AbortController().signal))
    for (const text of secretStrings(err1)) expect(text).not.toContain(SECRET)

    // body leak via a 2xx non-JSON payload (not retried)
    const fetchBody = vi.fn(async () => textResponse(`<html>${SECRET}</html>`, 200))
    const t2 = new SyncTransport({ fetch: fetchBody as unknown as typeof fetch, clock: makeFakeClock().clock })
    const err2 = await captureRejection(t2.read(request(), new AbortController().signal))
    for (const text of secretStrings(err2)) expect(text).not.toContain(SECRET)

    // exception message leak via a write (single attempt, no retry)
    const fetchNet = vi.fn(async () => { throw new TypeError(`connect failed: ${SECRET}`) })
    const t3 = new SyncTransport({ fetch: fetchNet as unknown as typeof fetch, clock: makeFakeClock().clock })
    const err3 = await captureRejection(t3.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal))
    for (const text of secretStrings(err3)) expect(text).not.toContain(SECRET)
  })
})

// --- write path -----------------------------------------------------------

describe('SyncTransport write', () => {
  it('writes exactly once and surfaces WriteOutcomeUnknown on a hung request', async () => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const p = transport.write(request({ method: 'PUT', body: '{"title":"x"}', readOnly: false }), new AbortController().signal)
    const codePromise = rejectCode(p)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    await clock.advance(30_000); await settle()
    expect(await codePromise).toBe('WriteOutcomeUnknown')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a write on network failure and reports an unknown outcome', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('connect failed') })
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('WriteOutcomeUnknown')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a write on 500', async () => {
    const fetch = vi.fn(async () => textResponse('boom', 500))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('WriteOutcomeUnknown')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns value null for a successful empty PUT', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const result = await transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(result.status).toBe(204)
    expect(result.value).toBeNull()
  })

  it('returns unexpected JSON as the value rather than failing', async () => {
    const fetch = vi.fn(async () => jsonResponse({ unexpected: true, nested: { x: 1 } }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const result = await transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(result.status).toBe(200)
    expect(result.value).toEqual({ unexpected: true, nested: { x: 1 } })
  })

  it('sends a PUT without a body when none is provided', async () => {
    const calls: { init: RequestInit }[] = []
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      calls.push({ init: init ?? {} })
      return jsonResponse({ ok: true })
    })
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    await transport.write(request({ method: 'PUT', readOnly: false }), new AbortController().signal)
    expect(calls[0]?.init.body).toBeUndefined()
  })

  it('throws WriteOutcomeUnknown on a 2xx write whose body is non-JSON', async () => {
    const fetch = vi.fn(async () => textResponse('<html>oops</html>', 200, { 'content-type': 'text/html' }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('WriteOutcomeUnknown')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws WriteOutcomeUnknown on a 2xx write whose body exceeds 2MiB', async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1).fill(0x78)
    const fetch = vi.fn(async () => streamResponse([big], 200, { 'content-type': 'application/json' }))
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock })
    const p = transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(await rejectCode(p)).toBe('WriteOutcomeUnknown')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

// --- cancellation ---------------------------------------------------------

describe('SyncTransport cancellation', () => {
  it('stops waiting and issues no further attempt when the signal aborts during backoff', async () => {
    const fetch = vi.fn(async () => jsonResponse({}, 429, { 'retry-after': '60' }))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const controller = new AbortController()
    const p = transport.read(request(), controller.signal)
    const errPromise = captureRejection(p)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    controller.abort()
    const err = await errPromise
    expect((err as { name?: string }).name).toBe('AbortError')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

// --- deadline timer -------------------------------------------------------

describe('SyncTransport deadline timer', () => {
  it('cancels the deadline sleep once a read settles', async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const result = await transport.read(request(), new AbortController().signal)
    expect(result.status).toBe(200)
    expect(clock.activeSleeps()).toBe(0)
  })

  it('cancels the deadline sleep once a write settles', async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }))
    const clock = makeFakeClock()
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const result = await transport.write(request({ method: 'PUT', body: '{}', readOnly: false }), new AbortController().signal)
    expect(result.status).toBe(200)
    expect(clock.activeSleeps()).toBe(0)
  })

  it('propagates a parent abort during the body read and cancels the deadline', async () => {
    const clock = makeFakeClock()
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { streamController = controller },
    })
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal
      signal?.addEventListener('abort', () => {
        streamController?.error(new DOMException('The operation was aborted', 'AbortError'))
      })
      return new Response(stream, { status: 200 })
    })
    const transport = new SyncTransport({ fetch: fetch as unknown as typeof fetch, clock: clock.clock })
    const controller = new AbortController()
    const p = transport.read(request(), controller.signal)
    const errPromise = captureRejection(p)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    controller.abort()
    const err = await errPromise
    expect((err as { name?: string }).name).toBe('AbortError')
    expect(clock.activeSleeps()).toBe(0)
  })
})

// --- per-request preflight gate -------------------------------------------

describe('SyncTransport beforeRequest gate', () => {
  it('invokes beforeRequest immediately before every fetch attempt', async () => {
    const order: string[] = []
    const fetch = vi.fn(async () => { order.push('fetch'); return jsonResponse({ ok: true }) })
    const transport = new SyncTransport({
      fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock,
      beforeRequest: () => { order.push('gate') },
    })
    await transport.read(request(), new AbortController().signal)
    expect(order).toEqual(['gate', 'fetch'])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('propagates a throwing guard error unchanged, without mapping it to NetworkFailure or retrying', async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }))
    const transport = new SyncTransport({
      fetch: fetch as unknown as typeof fetch, clock: makeFakeClock().clock,
      beforeRequest: () => { throw syncRemoteError(syncError('StaleOwner', { scope: 'run', runId: 'run-1' })) },
    })
    const p = transport.read(request(), new AbortController().signal)
    expect(await rejectCode(p)).toBe('StaleOwner')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('re-checks the guard after a backoff before the retry attempt and blocks the second fetch', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '1' }))
      .mockResolvedValue(jsonResponse({ ok: true }))
    let failNext = false
    let gates = 0
    const clock = makeFakeClock()
    const transport = new SyncTransport({
      fetch: fetch as unknown as typeof fetch, clock: clock.clock,
      beforeRequest: () => {
        gates += 1
        if (failNext) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'enabled' }))
      },
    })
    const p = transport.read(request(), new AbortController().signal)
    const codePromise = rejectCode(p)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    failNext = true
    await clock.advance(1_000)
    await settle()
    expect(await codePromise).toBe('InvalidConfig')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(gates).toBe(2)
  })
})
