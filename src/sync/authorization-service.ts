import { OAuthManager } from './oauth.ts'
import type { BeginAuthResult, SafeAuthState, SyncCredentialStore, TapdAppConfig } from './oauth-types.ts'
import type { SafeConnection } from './dto.ts'
import type { AuthRequest } from './oauth-validation.ts'
import type { SyncConfigStore } from './config-store.ts'
import { syncError, syncRemoteError } from './errors.ts'
export interface AuthorizationOptions {
  config: SyncConfigStore
  store: SyncCredentialStore | null
  callbackBaseUrl: string | null
  resolveSecret: (reference: string) => Promise<string | null>
}
/** Connection-bound protocol runners, owned and disposed by the plugin. */
export class SyncAuthorizationService {
  private disposed = false
  private readonly managers = new Map<string, { fingerprint: string; manager: OAuthManager }>()
  constructor(private readonly options: AuthorizationOptions) {}
  private connection(id: string): SafeConnection {
    const connection = this.options.config.getConnection(id)
    if (!connection) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
    return connection
  }
  /**
   * The identity an authorization is bound to. A 云效 grant is account-scoped,
   * so choosing or fixing its organization must not throw the sign-in away; a
   * TAPD grant is instance-bound and still is. The callback check and the
   * manager's own comparison must use this one definition, or a legitimate
   * callback is rejected as stale.
   */
  private fingerprintOf(connection: SafeConnection): string {
    return JSON.stringify([connection.platform === 'yunxiao' ? '' : connection.instance, connection.authentication])
  }
  private async manager(connection: SafeConnection): Promise<OAuthManager> {
    if (this.disposed) throw syncRemoteError(syncError('RunInterrupted', { scope: 'connection' }))
    if (!this.options.store || !this.options.callbackBaseUrl) throw syncRemoteError(syncError('HostRestartRequired', { scope: 'connection' }))
    const fingerprint = this.fingerprintOf(connection)
    const existing = this.managers.get(connection.id)
    if (existing?.fingerprint === fingerprint) return existing.manager
    if (existing) { await existing.manager.dispose(); await existing.manager.disconnect(connection.id) }
    const auth = connection.authentication
    let app: TapdAppConfig | undefined
    if (connection.platform === 'tapd' && auth?.mode === 'oauth' && auth.appId && auth.appSecretRef && auth.callbackUrl) {
      const ref = auth.appSecretRef
      app = { clientId: auth.appId, secret: () => this.options.resolveSecret(ref), callbackUrl: auth.callbackUrl, scopes: ['story#read', 'bug#read', 'task#read'] }
    }
    const manager = new OAuthManager({ store: this.options.store, callbackBaseUrl: this.options.callbackBaseUrl, fetch: globalThis.fetch, now: Date.now, ...(app ? { tapdAppConfig: app } : {}) })
    this.managers.set(connection.id, { fingerprint, manager }); return manager
  }
  async decorate(connection: SafeConnection): Promise<SafeConnection> {
    if (connection.authentication?.mode !== 'oauth') return connection
    // 云效's OAuth grant is an ordinary access token for the open platform
    // (documented as user-equivalent and carried by `x-yunxiao-token`), so a
    // live one makes the connection usable; TAPD needs its project grant.
    if (connection.platform === 'yunxiao') {
      // The 云效 token is account-scoped: the organization is only a path
      // segment, so an authorization stays valid while the organization is
      // chosen or corrected afterwards.
      const grant = await this.options.store?.read(connection.id)
      return { ...connection, credentialPresent: Boolean(grant?.platform === 'yunxiao' && grant.expiresAt > Date.now()) }
    }
    const grant = await this.options.store?.read(connection.id + '-project')
    return { ...connection, credentialPresent: Boolean(grant?.purpose === 'tapd-project' && grant.instance === connection.instance && grant.clientId === connection.authentication.appId && grant.expiresAt > Date.now() && grant.resourceIds.length > 0) }
  }
  /** The live 云效 access token of an authorized connection, or null when absent/expired. */
  async yunxiaoToken(connection: SafeConnection): Promise<string | null> {
    const grant = await this.options.store?.read(connection.id)
    return grant?.platform === 'yunxiao' && grant.expiresAt > Date.now() ? grant.accessToken : null
  }
  async state({ connectionId }: AuthRequest): Promise<SafeAuthState> {
    const connection = this.connection(connectionId)
    if (!this.options.store || !this.options.callbackBaseUrl) return { connectionId, status: 'unavailable', attemptId: null, expiresAt: null, accountLabel: null, resourceIds: [], projectAccess: 'unverified', error: syncError('HostRestartRequired', { scope: 'connection' }) }
    return (await this.manager(connection)).state(connectionId)
  }
  async begin({ connectionId }: AuthRequest): Promise<BeginAuthResult> {
    const connection = this.connection(connectionId)
    if (connection.authentication?.mode !== 'oauth' || connection.platform === 'yunxiao' && connection.mode !== 'center') throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection' }))
    return (await this.manager(connection)).begin(connection)
  }
  async cancel({ connectionId, attemptId }: AuthRequest): Promise<{ ok: true }> { await (await this.manager(this.connection(connectionId))).cancel(connectionId, attemptId!); return { ok: true } }
  async deleteConnection(request: { id: string; revision: number }): Promise<void> {
    const connection = this.connection(request.id)
    if (connection.revision !== request.revision) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'connection' }))
    if (this.options.config.listRules(request.id).length) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
    const entry = this.managers.get(request.id)
    if (entry) { await entry.manager.dispose(); await entry.manager.disconnect(request.id); this.managers.delete(request.id) }
    else if (this.options.store) { await this.options.store.remove(request.id); await this.options.store.remove(request.id + '-project') }
    this.options.config.deleteConnection(request)
  }
  async disconnect({ connectionId }: AuthRequest): Promise<{ ok: true }> {
    const connection = this.connection(connectionId)
    this.options.config.updateConnection({ id: connection.id, revision: connection.revision, enabled: false })
    for (const rule of this.options.config.listRules().filter(rule => rule.connectionId === connectionId && rule.enabled)) this.options.config.updateRule({ id: rule.id, revision: rule.revision, enabled: false })
    if (this.options.store && this.options.callbackBaseUrl) await (await this.manager(connection)).disconnect(connectionId)
    return { ok: true }
  }
  async callback(url: URL): Promise<void> {
    for (const [id, entry] of this.managers) {
      if (!entry.manager.acceptsCallback(url)) continue
      const current = this.connection(id)
      if (entry.fingerprint !== this.fingerprintOf(current)) { await entry.manager.dispose(); throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection' })) }
      await entry.manager.callback(url); return
    }
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection' }))
  }
  async projectToken(connection: SafeConnection, projectId: string, beforeRequest?: () => void): Promise<string> { return (await this.manager(connection)).projectToken(connection, projectId, beforeRequest) }
  async dispose(): Promise<void> { this.disposed = true; await Promise.all([...this.managers.values()].map(entry => entry.manager.dispose())); this.managers.clear() }
}
