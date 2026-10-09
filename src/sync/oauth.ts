import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { syncError, syncRemoteError } from './errors.ts'
import type { BeginAuthResult, OAuthConnection, OAuthGrant, SafeAuthState, SyncCredentialStore, TapdAppConfig } from './oauth-types.ts'
const CLOUD = 'https://openapi-rdc.aliyuncs.com'
const AUTHORIZE = 'https://account-devops.aliyun.com'
export const OAUTH_CALLBACK_PATH = '/task-list/oauth/callback'
const ATTEMPT_MS = 10 * 60_000
const MAX_BODY = 2 * 1024 * 1024
interface Options { store: SyncCredentialStore; fetch: typeof fetch; now: () => number; callbackBaseUrl: string; tapdAppConfig?: TapdAppConfig }
interface Attempt {
  id: string; connection: OAuthConnection; state: string; verifier: string; clientId: string; tokenEndpoint: string
  redirectUri: string; expiresAt: number; controller: AbortController; epoch: number; consumed: boolean; timer: ReturnType<typeof setTimeout>
}
function fail(code: 'InvalidConfig' | 'CredentialMissing' | 'AuthDenied' | 'InvalidRemoteResponse' | 'NetworkFailure' | 'RunInterrupted' = 'InvalidConfig'): never {
  throw syncRemoteError(syncError(code, { scope: 'connection' }))
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('InvalidRemoteResponse')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 16_384): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) fail('InvalidRemoteResponse')
  return value
}
function officialEndpoint(value: unknown, kind: 'authorize' | 'register' | 'token'): string {
  let url: URL
  try { url = new URL(text(value, 2048)) } catch { fail() }
  const origin = kind === 'authorize' ? AUTHORIZE : CLOUD
  const path = `/v1/oauth2/${kind === 'register' ? 'register' : kind === 'token' ? 'token' : 'authorize'}`
  if (url.origin !== origin || url.pathname !== path || url.username || url.password || url.hash || url.search) fail()
  return url.href
}
function callbackOrigin(value: string): string {
  let url: URL
  try { url = new URL(value) } catch { fail() }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') fail()
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1')) fail()
  return url.origin
}

/** Owns protocol state only. Secrets live in the injected Host credential provider. */
export class OAuthManager {
  private readonly attempts = new Map<string, Attempt>()
  private readonly failures = new Map<string, SafeAuthState['error']>()
  private readonly epochs = new Map<string, number>()
  private readonly running = new Set<Promise<unknown>>()
  private readonly controllers = new Set<AbortController>()
  private readonly preparing = new Set<string>()
  private readonly withdrawing = new Set<string>()
  private disposed = false
  private readonly callbackUrl: string
  constructor(private readonly options: Options) {
    this.callbackUrl = callbackOrigin(options.callbackBaseUrl) + OAUTH_CALLBACK_PATH
  }
  private epoch(id: string): number { return this.epochs.get(id) ?? 0 }
  private track<T>(operation: Promise<T>): Promise<T> {
    this.running.add(operation)
    void operation.then(() => this.running.delete(operation), () => this.running.delete(operation))
    return operation
  }
  private live(id: string, epoch: number, signal?: AbortSignal): void {
    if (this.disposed || this.withdrawing.has(id) || this.epoch(id) !== epoch || signal?.aborted) fail('RunInterrupted')
  }
  private async request(url: string, init: RequestInit, signal?: AbortSignal, beforeRequest?: () => void): Promise<Record<string, unknown>> {
    if (this.disposed || signal?.aborted) fail('RunInterrupted')
    beforeRequest?.()
    const controller = new AbortController()
    this.controllers.add(controller)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, 30_000)
    try {
      const response = await this.options.fetch(url, { ...init, redirect: 'error', signal: controller.signal })
      if (!response.ok) fail(response.status === 400 || response.status === 401 || response.status === 403 ? 'AuthDenied' : 'NetworkFailure')
      const reader = response.body?.getReader()
      if (!reader) fail('InvalidRemoteResponse')
      const chunks: Uint8Array[] = []; let total = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          total += value.byteLength
          if (total > MAX_BODY) { await reader.cancel(); fail('InvalidRemoteResponse') }
          chunks.push(value)
        }
      } finally { reader.releaseLock() }
      let result: unknown
      try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { fail('InvalidRemoteResponse') }
      return object(result)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'task-list/sync') throw error
      if (signal?.aborted || this.disposed) fail('RunInterrupted')
      return fail('NetworkFailure')
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); this.controllers.delete(controller)
    }
  }
  begin(connection: OAuthConnection): Promise<BeginAuthResult> { return this.track(this.beginInner(connection)) }
  private async beginInner(connection: OAuthConnection): Promise<BeginAuthResult> {
    if (this.disposed || this.withdrawing.has(connection.id) || this.preparing.has(connection.id) || this.attempts.has(connection.id)) fail()
    if (!/^[a-z0-9-]{1,100}$/u.test(connection.id) || !Number.isInteger(connection.revision) || connection.revision < 1) fail()
    // A 云效 grant is account-scoped, so signing in before its organization is
    // known is legitimate; a TAPD grant is instance-bound and still requires one.
    if (connection.platform === 'tapd' && !connection.instance.trim()) fail()
    if (connection.platform === 'tapd' && !this.options.tapdAppConfig) fail()
    const controller = new AbortController()
    this.controllers.add(controller); this.preparing.add(connection.id)
    const epoch = this.epoch(connection.id)
    try {
      let clientId: string; let tokenEndpoint: string; let authorizationEndpoint: string; let redirectUri = this.callbackUrl
      const verifier = randomBytes(32).toString('base64url')
      if (connection.platform === 'yunxiao') {
        const metadata = await this.request(CLOUD + '/.well-known/oauth-authorization-server', { method: 'GET' }, controller.signal)
        if (metadata.issuer !== CLOUD || !Array.isArray(metadata.code_challenge_methods_supported) || !metadata.code_challenge_methods_supported.includes('S256') || !Array.isArray(metadata.token_endpoint_auth_methods_supported) || !metadata.token_endpoint_auth_methods_supported.includes('none')) fail()
        authorizationEndpoint = officialEndpoint(metadata.authorization_endpoint, 'authorize')
        tokenEndpoint = officialEndpoint(metadata.token_endpoint, 'token')
        const registerEndpoint = officialEndpoint(metadata.registration_endpoint, 'register')
        this.live(connection.id, epoch, controller.signal)
        const registration = await this.request(registerEndpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'DeepSeek Harness Task List', redirect_uris: [redirectUri], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }),
        }, controller.signal)
        clientId = text(registration.client_id, 512)
      } else {
        const app = this.options.tapdAppConfig!
        clientId = text(app.clientId, 512)
        if (app.callbackUrl !== this.callbackUrl || app.scopes.length === 0 || app.scopes.some(scope => !/^[a-z_]+(?:#(?:read|write))?$/u.test(scope))) fail()
        if (!await app.secret()) fail('CredentialMissing')
        authorizationEndpoint = 'https://www.tapd.cn/oauth/'
        tokenEndpoint = 'https://api.tapd.cn/tokens/request_token'
      }
      this.live(connection.id, epoch, controller.signal)
      const state = randomBytes(32).toString('base64url')
      const id = randomUUID(); const expiresAt = this.options.now() + ATTEMPT_MS
      const timer = setTimeout(() => {
        const attempt = this.attempts.get(connection.id)
        if (attempt?.id === id) { this.clearAttempt(attempt); this.failures.set(connection.id, syncError('RunInterrupted', { scope: 'connection' })) }
      }, ATTEMPT_MS)
      timer.unref?.()
      const attempt: Attempt = { id, connection: { ...connection }, state, verifier, clientId, tokenEndpoint, redirectUri, expiresAt, controller, epoch, consumed: false, timer }
      this.attempts.set(connection.id, attempt); this.failures.delete(connection.id)
      const url = new URL(authorizationEndpoint)
      url.searchParams.set('response_type', 'code'); url.searchParams.set('client_id', clientId); url.searchParams.set('redirect_uri', redirectUri); url.searchParams.set('state', state)
      if (connection.platform === 'yunxiao') { url.searchParams.set('code_challenge_method', 'S256'); url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url')) }
      else { url.searchParams.set('auth_by', 'user'); url.searchParams.set('scope', this.options.tapdAppConfig!.scopes.join(' ')) }
      return { attemptId: id, authorizationUrl: url.href, expiresAt }
    } finally { this.preparing.delete(connection.id); this.controllers.delete(controller) }
  }
  private clearAttempt(attempt: Attempt): void {
    clearTimeout(attempt.timer); attempt.controller.abort()
    if (this.attempts.get(attempt.connection.id)?.id === attempt.id) this.attempts.delete(attempt.connection.id)
  }
  acceptsCallback(url: URL): boolean { const state = url.searchParams.get('state'); return state !== null && [...this.attempts.values()].some(attempt => attempt.state === state) }
  callback(url: URL): Promise<void> { return this.track(this.callbackInner(url)) }
  private async callbackInner(url: URL): Promise<void> {
    if (url.origin !== new URL(this.callbackUrl).origin || url.pathname !== OAUTH_CALLBACK_PATH || url.href.length > 8192) fail()
    for (const name of ['state', 'code', 'error', 'resource']) if (url.searchParams.getAll(name).length > 1) fail()
    const state = url.searchParams.get('state')
    if (!state || !/^[A-Za-z0-9_-]{43}$/u.test(state)) fail()
    const attempt = [...this.attempts.values()].find(item => item.state === state)
    if (!attempt || attempt.consumed || attempt.expiresAt <= this.options.now()) { if (attempt) this.clearAttempt(attempt); fail() }
    this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal)
    attempt.consumed = true
    try {
      if (url.searchParams.has('error')) fail('AuthDenied')
      const code = text(url.searchParams.get('code'), 4096)
      const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: attempt.redirectUri })
      const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' }
      if (attempt.connection.platform === 'yunxiao') { body.set('client_id', attempt.clientId); body.set('code_verifier', attempt.verifier) }
      else {
        const secret = await this.options.tapdAppConfig!.secret()
        if (!secret) fail('CredentialMissing')
        headers.authorization = 'Basic ' + Buffer.from(`${attempt.clientId}:${secret}`).toString('base64')
      }
      const result = await this.request(attempt.tokenEndpoint, { method: 'POST', headers, body: body.toString() }, attempt.controller.signal)
      this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal)
      const payload = attempt.connection.platform === 'tapd' ? result.status === 1 ? object(result.data) : fail('AuthDenied') : result
      const grant = this.parseGrant(payload, attempt)
      await this.options.store.modify(attempt.connection.id, async () => { this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal); return grant })
      this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal)
      this.failures.delete(attempt.connection.id)
    } catch (error) {
      this.failures.set(attempt.connection.id, syncError('AuthDenied', { scope: 'connection' }))
      throw error
    } finally { this.clearAttempt(attempt) }
  }
  private parseGrant(payload: Record<string, unknown>, attempt: Attempt): OAuthGrant {
    const accessToken = text(payload.access_token)
    if (typeof payload.token_type !== 'string' || payload.token_type.toLowerCase() !== 'bearer' || typeof payload.expires_in !== 'number' || !Number.isInteger(payload.expires_in) || payload.expires_in < 1 || payload.expires_in > 90 * 86400) fail('InvalidRemoteResponse')
    const resourceIds: string[] = []
    if (attempt.connection.platform === 'tapd' && payload.resource !== undefined) {
      const resource = object(payload.resource)
      if (resource.type === 'workspace' && (typeof resource.workspace_id === 'string' || typeof resource.workspace_id === 'number' && Number.isSafeInteger(resource.workspace_id))) resourceIds.push(String(resource.workspace_id))
      else fail('InvalidRemoteResponse')
    }
    return {
      platform: attempt.connection.platform, instance: attempt.connection.instance, connectionRevision: attempt.connection.revision,
      accessToken, refreshToken: payload.refresh_token === undefined ? null : text(payload.refresh_token), expiresAt: this.options.now() + payload.expires_in * 1000,
      clientId: attempt.clientId, tokenEndpoint: attempt.tokenEndpoint, purpose: attempt.connection.platform === 'yunxiao' ? 'yunxiao-api' : 'tapd-user',
      accountLabel: null, resourceIds, scopes: typeof payload.scope === 'string' ? payload.scope.split(/\s+/u).filter(Boolean) : [],
    }
  }
  projectToken(connection: OAuthConnection, projectId: string, beforeRequest?: () => void): Promise<string> { return this.track(this.projectTokenInner(connection, projectId, beforeRequest)) }
  private async projectTokenInner(connection: OAuthConnection, projectId: string, beforeRequest?: () => void): Promise<string> {
    const app = this.options.tapdAppConfig
    if (connection.platform !== 'tapd' || !app || !/^[A-Za-z0-9_-]{1,200}$/u.test(projectId)) fail()
    const epoch = this.epoch(connection.id)
    this.live(connection.id, epoch)
    const grant = await this.options.store.modify(connection.id + '-project', async current => {
      this.live(connection.id, epoch)
      if (current && (current.purpose !== 'tapd-project' || current.instance !== connection.instance || current.clientId !== app.clientId)) fail()
      let candidate = current
      if (!candidate || candidate.expiresAt <= this.options.now() + 60_000) {
        const secret = await app.secret()
        if (!secret) fail('CredentialMissing')
        const result = await this.request('https://api.tapd.cn/tokens/request_token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(`${app.clientId}:${secret}`).toString('base64') }, body: new URLSearchParams({ grant_type: 'client_credentials' }).toString() }, undefined, beforeRequest)
        if (result.status !== 1) fail('AuthDenied')
        const payload = object(result.data)
        const resource = object(payload.resource)
        if (resource.type !== 'open_app_auth' || String(resource.app_id) !== app.clientId) fail('AuthDenied')
        const scopes = text(payload.scope, 4096).split(/\s+/u).filter(Boolean)
        for (const category of ['story', 'task', 'bug']) if (!scopes.includes(category) && (!scopes.includes(category + '#read') || !scopes.includes(category + '#write'))) fail('AuthDenied')
        if (typeof payload.expires_in !== 'number' || !Number.isInteger(payload.expires_in) || payload.expires_in < 1 || payload.expires_in > 86400 * 90 || typeof payload.token_type !== 'string' || payload.token_type.toLowerCase() !== 'bearer') fail('InvalidRemoteResponse')
        candidate = { platform: 'tapd', instance: connection.instance, connectionRevision: connection.revision, accessToken: text(payload.access_token), refreshToken: null, expiresAt: this.options.now() + payload.expires_in * 1000, clientId: app.clientId, tokenEndpoint: 'https://api.tapd.cn/tokens/request_token', purpose: 'tapd-project', accountLabel: null, resourceIds: [], scopes }
      }
      if (!candidate.resourceIds.includes(projectId)) {
        const probe = new URL('https://api.tapd.cn/stories')
        probe.searchParams.set('workspace_id', projectId); probe.searchParams.set('limit', '1'); probe.searchParams.set('fields', 'id')
        const observed = await this.request(probe.href, { method: 'GET', headers: { authorization: 'Bearer ' + candidate.accessToken } }, undefined, beforeRequest)
        if (observed.status !== 1 || !Array.isArray(observed.data)) fail('AuthDenied')
        candidate = { ...candidate, resourceIds: [...candidate.resourceIds, projectId] }
      }
      this.live(connection.id, epoch)
      return candidate
    })
    this.live(connection.id, epoch)
    if (!grant) fail('CredentialMissing')
    return grant.accessToken
  }
  async state(connectionId: string): Promise<SafeAuthState> {
    const attempt = this.attempts.get(connectionId)
    const grant = await this.options.store.read(connectionId)
    const project = await this.options.store.read(connectionId + '-project')
    const error = this.failures.get(connectionId) ?? null
    // A completed exchange outranks a leftover attempt: the official page can
    // finish while the polling client is closed, and reporting "waiting" for a
    // sign-in that already succeeded leaves the editor stuck forever.
    const live = grant !== null && grant.expiresAt > this.options.now()
    if (live && attempt !== undefined) this.clearAttempt(attempt)
    return { connectionId, status: live ? 'authorized' : attempt !== undefined ? 'waiting' : grant !== null ? 'expired' : error !== null ? 'failed' : 'signed-out', attemptId: live ? null : attempt?.id ?? null, expiresAt: live ? grant.expiresAt : attempt?.expiresAt ?? grant?.expiresAt ?? null, accountLabel: grant?.accountLabel ?? null, resourceIds: [...new Set([...(grant?.resourceIds ?? []), ...(project?.resourceIds ?? [])])], projectAccess: project && project.expiresAt > this.options.now() && project.resourceIds.length > 0 ? 'ready' : 'unverified', error }
  }
  async cancel(connectionId: string, attemptId: string): Promise<void> {
    const attempt = this.attempts.get(connectionId)
    if (!attempt || attempt.id !== attemptId) fail()
    await this.disconnect(connectionId)
  }
  async disconnect(connectionId: string): Promise<void> {
    this.withdrawing.add(connectionId)
    this.epochs.set(connectionId, this.epoch(connectionId) + 1)
    const attempt = this.attempts.get(connectionId); if (attempt) this.clearAttempt(attempt)
    try {
      // Never rely on deleteRecord sharing the provider's modifyRecord lock.
      // Deny new operations first, then let every admitted commit settle before removal.
      await Promise.allSettled([...this.running])
      await this.options.store.remove(connectionId)
      await this.options.store.remove(connectionId + '-project')
      this.failures.delete(connectionId)
    } finally { this.withdrawing.delete(connectionId) }
  }
  accessToken(connectionId: string): Promise<string> { return this.track(this.accessTokenInner(connectionId)) }
  private async accessTokenInner(connectionId: string): Promise<string> {
    const epoch = this.epoch(connectionId)
    this.live(connectionId, epoch)
    const grant = await this.options.store.modify(connectionId, async current => {
      this.live(connectionId, epoch)
      if (!current) fail('CredentialMissing')
      if (current.expiresAt > this.options.now() + 60_000) return current
      if (current.platform !== 'yunxiao' || !current.refreshToken) fail('AuthDenied')
      const endpoint = officialEndpoint(current.tokenEndpoint, 'token')
      const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken, client_id: current.clientId })
      const result = await this.request(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() })
      this.live(connectionId, epoch)
      const accessToken = text(result.access_token)
      if (typeof result.expires_in !== 'number' || !Number.isInteger(result.expires_in) || result.expires_in < 1 || result.expires_in > 86400 * 90 || typeof result.token_type !== 'string' || result.token_type.toLowerCase() !== 'bearer') fail('InvalidRemoteResponse')
      return { ...current, accessToken, refreshToken: result.refresh_token === undefined ? current.refreshToken : text(result.refresh_token), expiresAt: this.options.now() + result.expires_in * 1000 }
    })
    this.live(connectionId, epoch)
    if (!grant) fail('CredentialMissing')
    return grant.accessToken
  }
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    for (const attempt of this.attempts.values()) this.clearAttempt(attempt)
    for (const controller of this.controllers) controller.abort()
    await Promise.allSettled([...this.running])
  }
}
