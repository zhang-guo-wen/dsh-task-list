import { syncError, syncRemoteError } from './errors.ts'
import type { OAuthGrant, SyncCredentialStore } from './oauth-types.ts'
/** Structural Host-only service contract. No runtime import is exposed to the browser. */
export interface HostCredentialProvider {
  readRecord(key: string): Promise<unknown>
  modifyRecord(key: string, mutate: (record: unknown) => Promise<unknown>): Promise<unknown>
  deleteRecord(key: string): Promise<void>
}
function key(id: string): string {
  if (!/^[a-z0-9-]{1,100}$/u.test(id)) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
  return `task-list/connection-${id}`
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
  if (value.platform !== 'yunxiao' && value.platform !== 'tapd') invalid()
  if (value.purpose !== 'yunxiao-api' && value.purpose !== 'tapd-user' && value.purpose !== 'tapd-project') invalid()
  for (const field of ['instance', 'accessToken', 'clientId', 'tokenEndpoint']) if (typeof value[field] !== 'string' || !String(value[field]).trim() || String(value[field]).length > 16384) invalid()
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
