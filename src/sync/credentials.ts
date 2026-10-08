import type { HostCredentials } from './types.ts'
import type { SafeConnection } from './dto.ts'
import { syncError, syncRemoteError } from './errors.ts'

/**
 * Resolve the host-side credentials a connection references. Only the exact
 * environment variable names recorded on the connection are read — the env
 * record is never enumerated, and no credential value is exported to the
 * browser. A missing or blank variable raises a safe `CredentialMissing`
 * error before any request is issued.
 */
export function resolveCredentials(
  connection: SafeConnection,
  env: Record<string, string | undefined>,
): HostCredentials {
  if (connection.platform === 'yunxiao') {
    const token = env[connection.tokenEnv]
    if (token === undefined || token.trim() === '') {
      throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'tokenEnv' }))
    }
    return { kind: 'yunxiao', token }
  }
  const user = env[connection.userEnv]
  if (user === undefined || user.trim() === '') {
    throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'userEnv' }))
  }
  const password = env[connection.passwordEnv]
  if (password === undefined || password.trim() === '') {
    throw syncRemoteError(syncError('CredentialMissing', { scope: 'connection', field: 'passwordEnv' }))
  }
  return { kind: 'tapd', user, password }
}
