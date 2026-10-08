import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { migrateSyncSchema } from '../src/sync/schema.ts'
import { parseSyncRequest, parseSyncResponse } from '../src/sync/validation.ts'

describe('non-secret connection authorization config', () => {
  it('round-trips OAuth configuration but rejects a raw client secret', () => {
    const input = { platform: 'yunxiao', name: 'Cloud', mode: 'center', organizationId: 'org', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: false, authentication: { mode: 'oauth' } }
    const parsed = parseSyncRequest('createSyncConnection', input).request as any
    expect(parsed.authentication).toEqual({ mode: 'oauth' })
    const tasks = new TaskStore(':memory:')
    try {
      const config = new SyncConfigStore(tasks.db, () => ({}))
      const connection = config.createConnection(parsed)
      expect(connection.authentication).toEqual({ mode: 'oauth' })
      expect(connection.credentialPresent).toBe(false)
      expect(parseSyncResponse('createSyncConnection', connection).response).toMatchObject({ authentication: { mode: 'oauth' } })
      expect(() => parseSyncRequest('createSyncConnection', { ...input, authentication: { mode: 'oauth', clientSecret: 'never-store-secret' } })).toThrow()
    } finally { tasks.close() }
  })
  it('forward-migrates the schema8 connection table without touching task content', () => {
    const tasks = new TaskStore(':memory:')
    const db = tasks.db
    if ((db.prepare('PRAGMA table_info(sync_connections)').all() as any[]).some(column => column.name === 'authentication')) db.exec('ALTER TABLE sync_connections DROP COLUMN authentication')
    db.exec('PRAGMA user_version = 8')
    // Exercise the public sync migration inside the same database without any real profile file.
    migrateSyncSchema(db)
    const columns = db.prepare('PRAGMA table_info(sync_connections)').all() as any[]
    expect(columns.some(column => column.name === 'authentication')).toBe(true)
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 9 })
    tasks.close()
  })
})
