import { syncError, syncRemoteError } from './errors.ts'
import type { ConnectionSecret } from './dto.ts'
import type { OAuthGrant, SyncCredentialStore } from './oauth-types.ts'
/** Opaque JSON payload stored using the Host's supported credential record kind. */
export interface HostGrantRecord {
  kind: 'grant'
  payload: unknown
}
/** Structural Host-only service contract. No runtime import is exposed to the browser. */
export interface HostCredentialProvider {
  readRecord(key: string): Promise<unknown>
  modifyRecord(key: string, mutate: (record: unknown) => Promise<HostGrantRecord>): Promise<unknown>
  deleteRecord(key: string): Promise<void>
}
function key(id: string): string {
  if (!/^[a-z0-9-]{1,100}$/u.test(id)) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
  return `task-list/connection-${id}`
}
/** Record key of one connection's user-typed credentials; separate from the OAuth grant record. */
function secretKey(id: string): string {
  if (!/^[a-z0-9-]{1,100}$/u.test(id)) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
  return `task-list/connection-${id}-secret`
}
function invalid(): never { throw syncRemoteError(syncError('StorageFailure', { scope: 'connection' })) }
function decode(record: unknown): OAuthGrant | null {
  if (record === undefined || record === null) return null
  if (typeof record !== 'object' || Array.isArray(record)) invalid()
  const row = record as { kind?: unknown; payload?: unknown }
  if (row.kind !== 'grant' || !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) invalid()
  const value = row.payload as Record<string, unknown>
  if (value.revoked === true && Object.keys(value).length === 1) return null
  const allowed = ['platform', 'instance', 'connectionRevision', 'accessToken', 'refreshToken', 'expiresAt', 'clientId', 'tokenEndpoint', 'purpose', 'accountLabel', 'resourceIds', 'scopes']
  if (Object.keys(value).some(field => !allowed.includes(field))) invalid()
  if (value.platform !== 'yunxiao') invalid()
  if (value.purpose !== 'yunxiao-api') invalid()
  for (const field of ['accessToken', 'clientId', 'tokenEndpoint']) if (typeof value[field] !== 'string' || !String(value[field]).trim() || String(value[field]).length > 16384) invalid()
  // `instance` is identity metadata, and a 云效 authorization is account-scoped:
  // it may legitimately be recorded before its organization is chosen.
  if (typeof value.instance !== 'string' || value.instance.length > 16384) invalid()
  if (value.refreshToken !== null && (typeof value.refreshToken !== 'string' || !value.refreshToken.trim())) invalid()
  if (!Number.isSafeInteger(value.connectionRevision) || Number(value.connectionRevision) < 1 || !Number.isSafeInteger(value.expiresAt) || Number(value.expiresAt) < 0) invalid()
  if (value.accountLabel !== null && (typeof value.accountLabel !== 'string' || value.accountLabel.length > 200)) invalid()
  for (const field of ['resourceIds', 'scopes']) if (!Array.isArray(value[field]) || (value[field] as unknown[]).length > 100 || (value[field] as unknown[]).some(item => typeof item !== 'string' || item.length > 200)) invalid()
  return value as unknown as OAuthGrant
}
export class HostSyncCredentialStore implements SyncCredentialStore {
  constructor(private readonly provider: HostCredentialProvider) {}
  async read(id: string): Promise<OAuthGrant | null> { return decode(await this.provider.readRecord(key(id))) }
  async modify(id: string, mutate: (grant: OAuthGrant | null) => Promise<OAuthGrant | null>): Promise<OAuthGrant | null> {
    const record = await this.provider.modifyRecord(key(id), async current => {
      const next = await mutate(decode(current))
      // The provider uses undefined to mean unchanged, not removed. A tombstone
      // records null atomically; explicit disconnect calls deleteRecord afterwards.
      return { kind: 'grant', payload: next === null ? { revoked: true } : decode({ kind: 'grant', payload: next }) }
    })
    return decode(record)
  }
  async remove(id: string): Promise<void> { await this.provider.deleteRecord(key(id)) }
}

/** Host-side port for one connection's user-typed credentials. */
export interface ManualSecretStore {
  read(id: string): Promise<ConnectionSecret | null>
  write(id: string, secret: ConnectionSecret): Promise<void>
  remove(id: string): Promise<void>
}

/** Largest accepted secret; a platform token never approaches it. */
const SECRET_LIMIT = 4096

function decodeSecret(record: unknown): ConnectionSecret | null {
  if (record === undefined || record === null) return null
  if (typeof record !== 'object' || Array.isArray(record)) invalid()
  const row = record as { kind?: unknown; payload?: unknown }
  if (row.kind !== 'grant' || !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) invalid()
  const value = row.payload as Record<string, unknown>
  if (value.platform === 'yunxiao') {
    if (Object.keys(value).some(field => field !== 'platform' && field !== 'token')) invalid()
    if (typeof value.token !== 'string' || !value.token.trim() || value.token.length > SECRET_LIMIT) invalid()
    return { platform: 'yunxiao', token: value.token }
  }
  if (value.platform === 'tapd') {
    // The API-account credential (user + password) was removed with TAPD's
    // Basic-auth path. A payload written by that version is treated as absent
    // rather than a storage failure, so the connection simply reports "no
    // credential" until a personal access token is typed.
    if (value.user !== undefined || value.password !== undefined) return null
    if (Object.keys(value).some(field => field !== 'platform' && field !== 'token')) invalid()
    if (typeof value.token !== 'string' || !value.token.trim() || value.token.length > SECRET_LIMIT) invalid()
    return { platform: 'tapd', token: value.token }
  }
  invalid()
}

/**
 * User-typed credentials live in the Host credential store, never in the task
 * database: the connection row keeps only non-secret configuration, and no
 * read path ever returns these values to the browser. The Host stores the
 * plugin-owned payload as a grant record under a separate manual-secret key.
 */
export class HostManualSecretStore implements ManualSecretStore {
  constructor(private readonly provider: HostCredentialProvider) {}
  async read(id: string): Promise<ConnectionSecret | null> { return decodeSecret(await this.provider.readRecord(secretKey(id))) }
  async write(id: string, secret: ConnectionSecret): Promise<void> {
    await this.provider.modifyRecord(secretKey(id), async () => ({ kind: 'grant', payload: decodeSecret({ kind: 'grant', payload: secret }) }))
  }
  async remove(id: string): Promise<void> { await this.provider.deleteRecord(secretKey(id)) }
}
