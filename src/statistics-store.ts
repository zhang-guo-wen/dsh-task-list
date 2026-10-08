import type { DatabaseSync } from 'node:sqlite'
import { withSqliteTransaction } from './sqlite-transaction.ts'
import { projectionPayload, readProjectionPayload, type SessionProjection } from './statistics.ts'

/** One cached session projection with the key that decides whether it is still valid. */
export interface StatisticsCacheRow {
  sessionId: string
  createdAt: number
  /** Exact stored revision, or `null` when the backend exposes none. */
  revision: string | null
  /** True when the row was captured while the session was closed and cannot grow. */
  sealed: boolean
  projection: SessionProjection
}

/**
 * The projection cache table. It is created on every open rather than versioned
 * with the task schema: the rows are rebuildable from the session corpus, so an
 * older build may ignore the table and a newer one recreates it at will.
 */
export const statisticsSchema = `CREATE TABLE IF NOT EXISTS statistics_sessions (
  session_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  revision TEXT,
  sealed INTEGER NOT NULL CHECK(sealed IN (0, 1)),
  payload TEXT NOT NULL,
  indexed_at INTEGER NOT NULL
) STRICT;`

/**
 * Persistent per-session projection cache.
 *
 * Reading a session log is by far the expensive half of a statistics sweep, so
 * each session is folded into a compact projection once and re-used for every
 * later range until its invalidation key changes. Unreadable or stale payload
 * rows are dropped rather than repaired: the next sweep simply re-reads them.
 */
export class StatisticsCacheStore {
  constructor(private readonly db: DatabaseSync) {}

  /**
   * Read every cached projection.
   * @returns rows keyed by session id, with malformed payloads already dropped.
   */
  read(): Map<string, StatisticsCacheRow> {
    const rows = this.db.prepare('SELECT session_id AS sessionId, created_at AS createdAt, revision, sealed, payload FROM statistics_sessions')
      .all() as unknown as { sessionId: string; createdAt: number; revision: string | null; sealed: number; payload: string }[]
    const result = new Map<string, StatisticsCacheRow>()
    const broken: string[] = []
    for (const row of rows) {
      let projection: SessionProjection | undefined
      try { projection = readProjectionPayload(JSON.parse(row.payload)) } catch { projection = undefined }
      if (projection === undefined) {
        broken.push(row.sessionId)
        continue
      }
      result.set(row.sessionId, { sessionId: row.sessionId, createdAt: row.createdAt, revision: row.revision, sealed: row.sealed === 1, projection })
    }
    if (broken.length) this.delete(broken)
    return result
  }

  /**
   * Insert or replace a batch of session projections in one transaction.
   * @param rows - projections captured since the previous flush.
   */
  write(rows: readonly StatisticsCacheRow[]): void {
    if (rows.length === 0) return
    withSqliteTransaction(this.db, () => {
      const statement = this.db.prepare(`INSERT INTO statistics_sessions (session_id, created_at, revision, sealed, payload, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET created_at = excluded.created_at, revision = excluded.revision,
          sealed = excluded.sealed, payload = excluded.payload, indexed_at = excluded.indexed_at`)
      const now = Date.now()
      for (const row of rows) {
        statement.run(row.sessionId, row.createdAt, row.revision, row.sealed ? 1 : 0, projectionPayload(row.projection), now)
      }
    })
  }

  /**
   * Drop rows whose session is no longer in the corpus.
   * @param keep - ids still present in the newest listing.
   * @returns the number of removed rows.
   */
  prune(keep: ReadonlySet<string>): number {
    const rows = this.db.prepare('SELECT session_id AS sessionId FROM statistics_sessions').all() as unknown as { sessionId: string }[]
    const stale = rows.map(row => row.sessionId).filter(id => !keep.has(id))
    if (stale.length) this.delete(stale)
    return stale.length
  }

  /** Drop every cached projection, so the next sweep re-reads all sessions. */
  clear(): void {
    withSqliteTransaction(this.db, () => { this.db.prepare('DELETE FROM statistics_sessions').run() })
  }

  private delete(ids: readonly string[]): void {
    withSqliteTransaction(this.db, () => {
      const statement = this.db.prepare('DELETE FROM statistics_sessions WHERE session_id = ?')
      for (const id of ids) statement.run(id)
    })
  }
}
