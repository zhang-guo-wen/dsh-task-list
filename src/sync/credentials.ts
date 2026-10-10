import type { HostCredentials } from './types.ts'
import type { SafeConnection } from './dto.ts'
import { syncError, syncRemoteError } from './errors.ts'

/**
 * Resolve the host-side credentials a connection references. Both platforms
 * carry a personal access token, so only the exact environment variable name
 * recorded on the connection is read — the env record is never enumerated, and
 * no credential value is exported to the browser. A missing or blank variable
 * raises a safe `CredentialMissing` error before any request is issued.
 */
export function resolveCredentials(
  connection: SafeConnection,
  env: Record<string, string | undefined>,
): HostCredentials {
  const token = env[connection.tokenEnv]
  if (token === undefined || token.trim() === '') {
    throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'tokenEnv' }))
  }
  return connection.platform === 'yunxiao' ? { kind: 'yunxiao', token } : { kind: 'tapd', token }
}
