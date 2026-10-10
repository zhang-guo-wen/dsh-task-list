import type { SyncErrorDto } from './dto.ts'
export interface OAuthConnection { id: string; platform: 'yunxiao'; instance: string; revision: number }
/** Host-only record, never an RPC value. */
export interface OAuthGrant {
  platform: 'yunxiao'
  instance: string
  connectionRevision: number
  accessToken: string
  refreshToken: string | null
  expiresAt: number
  clientId: string
  tokenEndpoint: string
  purpose: 'yunxiao-api'
  accountLabel: string | null
  resourceIds: string[]
  scopes: string[]
}
export interface SyncCredentialStore {
  read(id: string): Promise<OAuthGrant | null>
  modify(id: string, mutate: (current: OAuthGrant | null) => Promise<OAuthGrant | null>): Promise<OAuthGrant | null>
  remove(id: string): Promise<void>
}
export interface SafeAuthState {
  connectionId: string
  status: 'signed-out' | 'waiting' | 'authorized' | 'expired' | 'failed' | 'unavailable'
  attemptId: string | null
  expiresAt: number | null
  accountLabel: string | null
  resourceIds: string[]
  error: SyncErrorDto | null
}
export interface BeginAuthResult { attemptId: string; authorizationUrl: string; expiresAt: number }
