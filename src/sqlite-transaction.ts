import { DatabaseSync } from 'node:sqlite'

/**
 * Controlled, synchronous transaction helper for this plugin. Every database
 * mutation in the plugin goes through here so nested writes never mix with a
 * bare `BEGIN`/`COMMIT`.
 *
 * The outermost call opens a real transaction with `BEGIN IMMEDIATE`; nested
 * calls open a uniquely-named `SAVEPOINT`. On error the active savepoint is
 * rolled back to and then released, or the outer transaction is rolled back.
 * Only generated, sanitized savepoint names are ever interpolated.
 */

const depths = new WeakMap<DatabaseSync, number>()
let savepointCounter = 0

function isPromiseLike(value: unknown): value is { then: unknown } {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

export function withSqliteTransaction<T>(db: DatabaseSync, operation: () => T): T {
  const depth = depths.get(db) ?? 0
  depths.set(db, depth + 1)
  const savepoint = `sp_${savepointCounter++}`
  try {
    if (depth === 0) db.exec('BEGIN IMMEDIATE')
    else db.exec(`SAVEPOINT ${savepoint}`)

    const result = operation()
    if (isPromiseLike(result)) {
      throw new Error('withSqliteTransaction callback must be synchronous and must not return a Promise')
    }

    if (depth === 0) db.exec('COMMIT')
    else db.exec(`RELEASE SAVEPOINT ${savepoint}`)
    return result
  } catch (error) {
    if (depth === 0) {
      try { db.exec('ROLLBACK') } catch { /* no active transaction */ }
    } else {
      try { db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`) } catch { /* nothing to roll back */ }
      try { db.exec(`RELEASE SAVEPOINT ${savepoint}`) } catch { /* already released */ }
    }
    throw error
  } finally {
    depths.set(db, depth)
  }
}
