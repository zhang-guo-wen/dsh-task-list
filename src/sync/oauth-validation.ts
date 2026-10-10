import { parseSyncErrorDto } from './validation.ts'
import { syncError, syncRemoteError } from './errors.ts'
import type { BeginAuthResult, SafeAuthState } from './oauth-types.ts'
export const AUTH_METHODS = ['getSyncAuthState', 'beginSyncAuthorization', 'cancelSyncAuthorization', 'disconnectSyncAuthorization'] as const
export type AuthMethod = typeof AUTH_METHODS[number]
export interface AuthRequest { connectionId: string; attemptId?: string }
function fail(): never { throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection' })) }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  const row = value as Record<string, unknown>
  if (Object.keys(row).some(key => !keys.includes(key))) fail()
  return row
}
function text(value: unknown, max = 200): string { if (typeof value !== 'string' || !value || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) fail(); return value }
function number(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) fail(); return value as number }
export function parseAuthRequest(method: AuthMethod, value: unknown): AuthRequest {
  const row = object(value, method === 'cancelSyncAuthorization' ? ['connectionId', 'attemptId'] : ['connectionId'])
  return { connectionId: text(row.connectionId), ...(method === 'cancelSyncAuthorization' ? { attemptId: text(row.attemptId) } : {}) }
}
export function parseAuthResponse(method: AuthMethod, value: unknown): BeginAuthResult | SafeAuthState | { ok: true } {
  if (method === 'beginSyncAuthorization') {
    const row = object(value, ['attemptId', 'authorizationUrl', 'expiresAt'])
    const raw = text(row.authorizationUrl, 8192)
    let url: URL
    try { url = new URL(raw) } catch { fail() }
    if (!(url.origin === 'https://account-devops.aliyun.com' && url.pathname === '/v1/oauth2/authorize') || url.username || url.password || url.hash) fail()
    const allowed = ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method']
    for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) fail()
    if (url.searchParams.get('response_type') !== 'code' || !url.searchParams.get('state')) fail()
    return { attemptId: text(row.attemptId), authorizationUrl: raw, expiresAt: number(row.expiresAt) }
  }
  if (method !== 'getSyncAuthState') { const row = object(value, ['ok']); if (row.ok !== true) fail(); return { ok: true } }
  const row = object(value, ['connectionId', 'status', 'attemptId', 'expiresAt', 'accountLabel', 'resourceIds', 'error'])
  if (!['signed-out', 'waiting', 'authorized', 'expired', 'failed', 'unavailable'].includes(String(row.status))) fail()
  if (!Array.isArray(row.resourceIds) || row.resourceIds.length > 100) fail()
  // Error details use the same closed safe DTO codec as all sync operations.
  const error = row.error === null ? null : parseSyncErrorDto(row.error, 'connection')
  return { connectionId: text(row.connectionId), status: row.status as SafeAuthState['status'], attemptId: row.attemptId === null ? null : text(row.attemptId), expiresAt: row.expiresAt === null ? null : number(row.expiresAt), accountLabel: row.accountLabel === null ? null : text(row.accountLabel), resourceIds: row.resourceIds.map(value => text(value)), error }
}
