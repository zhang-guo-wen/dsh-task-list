import type { Clock, HostRequest, SyncTransport as SyncTransportContract } from './types.ts'
import type { SyncErrorDto } from './dto.ts'
import { syncError, syncRemoteError } from './errors.ts'

/** Official, evidenced HTTPS origins only. Region instances have no documented
 * origin pattern in the capability evidence, so no region host is allowlisted. */
const ALLOWED_HOSTNAMES = new Set(['openapi-rdc.aliyuncs.com', 'api.tapd.cn'])

const READ_MAX_ATTEMPTS = 3
const READ_TIMEOUT_MS = 30_000
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_RETRY_AFTER_MS = 60_000
const RETRY_BASE_DELAY_MS = 1_000
const REQUEST_ID_HEADERS = ['x-request-id', 'request-id']
const CONTROL = /[\u0000-\u001f]/u
const REQUEST_ID_LIMIT = 200

/** An internal, retry-aware failure; the safe DTO is surfaced to the executor
 * only when the transport stops retrying. */
class TransportFailure extends Error {
  constructor(
    readonly dto: SyncErrorDto,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(dto.code)
    this.name = 'TransportFailure'
  }
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
}

function hasPathTraversal(pathname: string): boolean {
  return pathname.split('/').some(segment => {
    if (segment === '') return false
    try { return decodeURIComponent(segment) === '..' } catch { return true }
  })
}

function clampDelay(ms: number): number {
  return Math.min(Math.max(0, ms), MAX_RETRY_AFTER_MS)
}

/** Exponential read backoff for transient failures without a Retry-After:
 * 1s before the second attempt, 2s before the third, bounded at 60s. */
function retryDelay(attemptNo: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attemptNo - 1), MAX_RETRY_AFTER_MS)
}

function parseRetryAfter(headers: Headers, nowMs: number): number | undefined {
  const raw = headers.get('retry-after')
  if (raw === null) return undefined
  const value = raw.trim()
  if (value === '') return undefined
  if (/^\d+$/.test(value)) {
    const seconds = Number(value)
    if (Number.isFinite(seconds)) return clampDelay(seconds * 1000)
    return undefined
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return undefined
  return clampDelay(parsed - nowMs)
}

function safeRequestId(headers: Headers): string | undefined {
  for (const name of REQUEST_ID_HEADERS) {
    const value = headers.get(name)
    if (value !== null) {
      const trimmed = value.trim()
      if (trimmed !== '' && trimmed.length <= REQUEST_ID_LIMIT && !CONTROL.test(trimmed)) return trimmed
      return undefined
    }
  }
  return undefined
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength }
  return out
}

const decoder = new TextDecoder()

export interface SyncTransportOptions {
  fetch: typeof fetch
  clock: Clock
  /** Invoked immediately before every fetch attempt (retries included). Optional
   * for read-only configuration/tests outside a user run; the executor's real
   * adapter factory always supplies it. A throwing guard propagates its own
   * RemoteError untouched (never re-mapped to NetworkFailure/transient retry). */
  beforeRequest?: () => void
}

/**
 * Bounded HTTPS transport for the platform adapters. A {@link HostRequest} is
 * built by the host-side adapter (never through RPC), so the transport only
 * enforces the origin boundary and the read/write budget. Reads retry a
 * bounded set of transient failures; writes are issued exactly once and an
 * uncertain outcome is reported as `WriteOutcomeUnknown`.
 */
export class SyncTransport implements SyncTransportContract {
  private readonly fetch: typeof fetch
  private readonly clock: Clock
  private readonly beforeRequest: (() => void) | undefined

  constructor(options: SyncTransportOptions) {
    this.fetch = options.fetch
    this.clock = options.clock
    this.beforeRequest = options.beforeRequest
  }

  async read(request: HostRequest, signal: AbortSignal): Promise<{ value: unknown; headers: Headers; status: number }> {
    this.validateMode(request, 'read')
    this.validateUrl(request.url)
    return this.execute(request, signal, 'read')
  }

  async write(request: HostRequest, signal: AbortSignal): Promise<{ value: unknown; headers: Headers; status: number }> {
    this.validateMode(request, 'write')
    this.validateUrl(request.url)
    return this.execute(request, signal, 'write')
  }

  private validateMode(request: HostRequest, mode: 'read' | 'write'): void {
    const reject = (field: 'method' | 'readOnly'): never => {
      throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field }))
    }
    const { method } = request
    if (method !== 'GET' && method !== 'POST' && method !== 'PUT') reject('method')
    if (typeof request.readOnly !== 'boolean') reject('readOnly')
    if (mode === 'read') {
      if (method === 'PUT') reject('method')
      if (!request.readOnly) reject('readOnly')
    } else {
      if (method === 'GET') reject('method')
      if (request.readOnly) reject('readOnly')
    }
  }

  private validateUrl(url: URL): void {
    const reject = (): never => {
      throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'url' }))
    }
    if (url.protocol !== 'https:') reject()
    if (url.username !== '' || url.password !== '') reject()
    if (url.port !== '') reject()
    if (url.hash !== '') reject()
    if (!ALLOWED_HOSTNAMES.has(url.hostname.toLowerCase())) reject()
    if (hasPathTraversal(url.pathname)) reject()
  }

  private async execute(
    request: HostRequest,
    signal: AbortSignal,
    mode: 'read' | 'write',
  ): Promise<{ value: unknown; headers: Headers; status: number }> {
    const maxAttempts = mode === 'read' ? READ_MAX_ATTEMPTS : 1
    let retryAfterMs = 0
    for (let attemptNo = 1; ; attemptNo++) {
      if (signal.aborted) throw abortError()
      if (retryAfterMs > 0) {
        await this.clock.sleep(retryAfterMs, signal)
        retryAfterMs = 0
      }
      // Re-check the gate immediately before each fetch attempt (after any
      // backoff). A throwing guard surfaces its own RemoteError here, outside
      // the retry-mapping catch below, so it is never re-mapped to a transient
      // network failure.
      this.beforeRequest?.()
      try {
        return await this.attempt(request, signal, mode)
      } catch (err) {
        if (err instanceof TransportFailure) {
          if (!err.retryable || attemptNo >= maxAttempts) throw syncRemoteError(err.dto)
          retryAfterMs = err.retryAfterMs ?? retryDelay(attemptNo)
          continue
        }
        throw err
      }
    }
  }

  private async attempt(
    request: HostRequest,
    signal: AbortSignal,
    mode: 'read' | 'write',
  ): Promise<{ value: unknown; headers: Headers; status: number }> {
    const timeoutCode = mode === 'read' ? 'ReadTimeout' as const : 'WriteOutcomeUnknown' as const
    const timeoutScope = mode === 'read' ? 'connection' as const : 'item' as const
    const attemptController = new AbortController()
    const onAbort = () => attemptController.abort()
    if (signal.aborted) throw abortError()
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      const deadline = this.clock.now() + READ_TIMEOUT_MS
      const timeoutFailure = new TransportFailure(syncError(timeoutCode, { scope: timeoutScope }), false)
      const work = (async () => {
        const response = await this.fetch(request.url, this.fetchInit(request, attemptController.signal))
        return await this.handleResponse(response, mode)
      })()
      return await this.raceAttempt(work, deadline, () => attemptController.abort(), timeoutFailure)
    } catch (err) {
      if (err instanceof TransportFailure) throw err
      if (isAbortError(err)) throw abortError()
      return this.networkFailure(mode)
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }

  private networkFailure(mode: 'read' | 'write'): never {
    if (mode === 'write') {
      throw new TransportFailure(syncError('WriteOutcomeUnknown', { scope: 'item' }), false)
    }
    throw new TransportFailure(syncError('NetworkFailure', { scope: 'connection' }), true)
  }

  private raceAttempt(
    work: Promise<{ value: unknown; headers: Headers; status: number }>,
    deadline: number,
    onTimeout: () => void,
    timeoutFailure: TransportFailure,
  ): Promise<{ value: unknown; headers: Headers; status: number }> {
    return new Promise((resolve, reject) => {
      let settled = false
      // A dedicated controller lets us cancel the deadline sleep the moment
      // work settles, without aborting the parent signal or the work signal
      // (the work signal is aborted only on timeout, via onTimeout).
      const timeoutController = new AbortController()
      const settle = (fn: () => void): void => {
        if (settled) return
        settled = true
        timeoutController.abort()
        fn()
      }
      work.then(
        result => settle(() => resolve(result)),
        err => settle(() => reject(err)),
      )
      const remaining = Math.max(0, deadline - this.clock.now())
      this.clock.sleep(remaining, timeoutController.signal).then(
        () => settle(() => { onTimeout(); reject(timeoutFailure) }),
        () => { /* cancelled on settle; the work signal/abort propagates separately */ },
      )
    })
  }

  private fetchInit(request: HostRequest, signal: AbortSignal): RequestInit {
    return {
      method: request.method,
      headers: new Headers(request.headers),
      signal,
      redirect: 'error',
      ...(request.body !== undefined ? { body: request.body } : {}),
    }
  }

  private async handleResponse(
    response: Response,
    mode: 'read' | 'write',
  ): Promise<{ value: unknown; headers: Headers; status: number }> {
    const status = response.status
    const requestId = safeRequestId(response.headers)
    const scope = 'connection' as const
    const itemScope = 'item' as const

    if (status === 401 || status === 403) {
      throw new TransportFailure(syncError('AuthDenied', { scope, ...(requestId !== undefined ? { requestId } : {}) }), false)
    }

    if (status >= 300 && status <= 399) {
      // `redirect:'error'` makes real fetch reject on 3xx, so this is
      // defence-in-depth: a 3xx that reaches here is never followed, and its
      // Location is never replayed or copied into the error.
      if (mode === 'write') {
        throw new TransportFailure(syncError('WriteOutcomeUnknown', { scope: itemScope, ...(requestId !== undefined ? { requestId } : {}) }), false)
      }
      throw new TransportFailure(syncError('InvalidRemoteResponse', { scope: itemScope }), false)
    }

    if (mode === 'read') {
      if (status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers, this.clock.now())
        throw new TransportFailure(syncError('RateLimited', { scope, ...(requestId !== undefined ? { requestId } : {}) }), true, retryAfterMs)
      }
      if (status >= 500 && status <= 599) {
        throw new TransportFailure(syncError('NetworkFailure', { scope, ...(requestId !== undefined ? { requestId } : {}) }), true)
      }
      if (status >= 200 && status <= 299) return this.readSuccessBody(response)
      return this.readBestEffortBody(response)
    }

    if (status >= 200 && status <= 299) return this.readWriteBody(response)
    if (status >= 500 && status <= 599) {
      throw new TransportFailure(syncError('WriteOutcomeUnknown', { scope: itemScope, ...(requestId !== undefined ? { requestId } : {}) }), false)
    }
    return this.readBestEffortBody(response)
  }

  private async readSuccessBody(response: Response): Promise<{ value: unknown; headers: Headers; status: number }> {
    const text = decoder.decode(await this.readBody(response.body, 'InvalidRemoteResponse'))
    if (text.trim() === '') throw new TransportFailure(syncError('InvalidRemoteResponse', { scope: 'item' }), false)
    const value = parseJson(text)
    if (value === undefined) throw new TransportFailure(syncError('InvalidRemoteResponse', { scope: 'item' }), false)
    return { value, headers: response.headers, status: response.status }
  }

  private async readWriteBody(response: Response): Promise<{ value: unknown; headers: Headers; status: number }> {
    const text = decoder.decode(await this.readBody(response.body, 'WriteOutcomeUnknown'))
    if (text.trim() === '') return { value: null, headers: response.headers, status: response.status }
    const value = parseJson(text)
    if (value === undefined) {
      // A 2xx write with a non-empty, unparseable body is not a clean empty
      // success: the outcome must be reconciled, never reported as null.
      throw new TransportFailure(syncError('WriteOutcomeUnknown', { scope: 'item' }), false)
    }
    return { value, headers: response.headers, status: response.status }
  }

  private async readBestEffortBody(response: Response): Promise<{ value: unknown; headers: Headers; status: number }> {
    const text = decoder.decode(await this.readBody(response.body, 'InvalidRemoteResponse'))
    if (text.trim() === '') return { value: null, headers: response.headers, status: response.status }
    const value = parseJson(text)
    return { value: value === undefined ? null : value, headers: response.headers, status: response.status }
  }

  private async readBody(
    body: ReadableStream<Uint8Array> | null,
    overflowCode: 'InvalidRemoteResponse' | 'WriteOutcomeUnknown',
  ): Promise<Uint8Array> {
    if (!body) return new Uint8Array(0)
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          total += value.byteLength
          if (total > MAX_BODY_BYTES) {
            await reader.cancel().catch(() => {})
            throw new TransportFailure(syncError(overflowCode, { scope: 'item' }), false)
          }
          chunks.push(value)
        }
      }
    } finally {
      reader.releaseLock()
    }
    return concat(chunks, total)
  }
}

function parseJson(text: string): unknown | undefined {
  try { return JSON.parse(text) as unknown } catch { return undefined }
}
