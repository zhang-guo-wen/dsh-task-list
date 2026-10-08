import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../types.ts'
import type { Clock, RemoteKey, RunFence, SyncField } from './types.ts'
import type { Page, SafeItemCategory, SafeItemResult, SafeRun, SafeRunPhase, SafeRunStatus, SyncErrorDto } from './dto.ts'
import { syncError, syncRemoteError } from './errors.ts'
import { serializeRemoteKey } from './schema.ts'
import { withSqliteTransaction } from '../sqlite-transaction.ts'

/** A run's ownership lease: no heartbeat for this long hands the run to the next claimer. */
export const SYNC_LEASE_MS = 90_000
/** How often a live executor heartbeats; the lease is the authoritative expiry. */
export const SYNC_HEARTBEAT_MS = 10_000

interface LockRow {
  runId: string
  ownerId: string
  generation: number
  leaseExpiresAt: number
}

interface RunRow {
  id: string
  status: SafeRunStatus
  phase: SafeRunPhase
  started_at: number
  finished_at: number | null
  counts_imported: number
  counts_pulled: number
  counts_pushed: number
  counts_merged: number
  counts_unchanged: number
  counts_failed: number
  counts_pending: number
  unprocessed_known: number | null
  discovery_complete: number
  scope_summary: string
  errors: string
}

interface ItemRow {
  run_id: string
  canonical: string
  task_id: string | null
  category: SafeItemCategory
  changed_fields: string
  discarded_fields: string
  written_back: number
  outside_filter: number
  error: string | null
  pending: number
}

const CATEGORY_COLUMN: Record<SafeItemCategory, string> = {
  imported: 'counts_imported',
  pulled: 'counts_pulled',
  pushed: 'counts_pushed',
  merged: 'counts_merged',
  unchanged: 'counts_unchanged',
  failed: 'counts_failed',
}

function isPendingError(error: SyncErrorDto | null): boolean {
  return error !== null && (error.code === 'WriteOutcomeUnknown' || error.code === 'VerificationFailed')
}

function parseStored<T>(text: string, field: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw syncRemoteError(syncError('StorageFailure', { scope: 'run', field }))
  }
}

function toSafeRun(row: RunRow): SafeRun {
  return {
    id: row.id,
    status: row.status,
    phase: row.phase,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    counts: {
      imported: row.counts_imported, pulled: row.counts_pulled, pushed: row.counts_pushed, merged: row.counts_merged,
      unchanged: row.counts_unchanged, failed: row.counts_failed, pending: row.counts_pending,
    },
    unprocessedKnown: row.unprocessed_known,
    discoveryComplete: row.discovery_complete === 1,
    scopeSummary: row.scope_summary,
    errors: parseStored<SyncErrorDto[]>(row.errors, 'errors'),
  }
}

function toSafeItemResult(row: ItemRow): SafeItemResult {
  const key = JSON.parse(row.canonical) as [string, string, string, string]
  return {
    key: { instance: key[0], projectId: key[1], typeId: key[2], id: key[3] },
    taskId: row.task_id,
    category: row.category,
    changedFields: JSON.parse(row.changed_fields) as SyncField[],
    discardedFields: JSON.parse(row.discarded_fields) as SyncField[],
    writtenBack: row.written_back === 1,
    outsideFilter: row.outside_filter === 1,
    error: row.error === null ? null : parseStored<SyncErrorDto>(row.error, 'error'),
  }
}

function adjustCount(db: DatabaseSync, runId: string, category: SafeItemCategory, pending: boolean, delta: 1 | -1): void {
  const column = CATEGORY_COLUMN[category]
  if (delta === 1) {
    const pendingClause = pending ? ', counts_pending = counts_pending + 1' : ''
    db.prepare(`UPDATE sync_runs SET ${column} = ${column} + 1${pendingClause} WHERE id = ?`).run(runId)
  } else {
    const pendingClause = pending ? ', counts_pending = CASE WHEN counts_pending > 0 THEN counts_pending - 1 ELSE 0 END' : ''
    db.prepare(`UPDATE sync_runs SET ${column} = CASE WHEN ${column} > 0 THEN ${column} - 1 ELSE 0 END${pendingClause} WHERE id = ?`).run(runId)
  }
}

/** Real ownership check: the run_lock row must match the fence at commit time and the lease must not have expired. */
export function assertRunFence(db: DatabaseSync, fence: RunFence, now: number): void {
  const lock = db.prepare('SELECT owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE run_id = ?').get(fence.runId) as { ownerId: string; generation: number; leaseExpiresAt: number } | undefined
  if (!lock || lock.ownerId !== fence.ownerId || lock.generation !== fence.generation || lock.leaseExpiresAt <= now) {
    throw syncRemoteError(syncError('StaleOwner', { scope: 'run', runId: fence.runId }))
  }
}

/**
 * Upsert one item result and keep the run's category counters consistent.
 * Performs no ownership check; callers assert the fence around it.
 */
export function recordRunItemResult(db: DatabaseSync, runId: string, result: SafeItemResult, pendingHint?: boolean): void {
  const canonical = serializeRemoteKey(result.key)
  const existing = db.prepare('SELECT category, pending, error FROM sync_run_items WHERE run_id = ? AND canonical = ?')
    .get(runId, canonical) as { category: SafeItemCategory; pending: number; error: string | null } | undefined
  const errorJson = result.error === null ? null : JSON.stringify(result.error)
  const changedFields = JSON.stringify(result.changedFields)
  const discardedFields = JSON.stringify(result.discardedFields)
  const pending = pendingHint ?? isPendingError(result.error)
  if (existing) {
    const wasPending = existing.pending === 1
    db.prepare(`UPDATE sync_run_items SET task_id = ?, category = ?, changed_fields = ?, discarded_fields = ?,
      written_back = ?, outside_filter = ?, error = ?, pending = ? WHERE run_id = ? AND canonical = ?`).run(
      result.taskId, result.category, changedFields, discardedFields,
      result.writtenBack ? 1 : 0, result.outsideFilter ? 1 : 0, errorJson, pending ? 1 : 0, runId, canonical,
    )
    if (existing.category !== result.category || wasPending !== pending) {
      adjustCount(db, runId, existing.category, wasPending, -1)
      adjustCount(db, runId, result.category, pending, 1)
    }
  } else {
    db.prepare(`INSERT INTO sync_run_items (run_id, canonical, task_id, category, changed_fields, discarded_fields, written_back, outside_filter, error, pending)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      runId, canonical, result.taskId, result.category, changedFields, discardedFields,
      result.writtenBack ? 1 : 0, result.outsideFilter ? 1 : 0, errorJson, pending ? 1 : 0,
    )
    adjustCount(db, runId, result.category, pending, 1)
  }
}

export class SyncRunStore {
  readonly db: DatabaseSync
  private readonly clock: Clock

  constructor(db: DatabaseSync, clock: Clock) {
    this.db = db
    this.clock = clock
  }

  /**
   * Claim the single active ownership slot for a sync run. When no lock exists,
   * or the previous lease has expired, a fresh run is created (the abandoned run
   * is marked `interrupted`) and the fence's generation advances monotonically.
   * When a live lock exists, the existing run id is returned with `existing` set;
   * only a fence whose owner matches the lock may write, so a second process can
   * observe but never silently continue the old owner's run.
   */
  claimRun(ownerId: string, now: number): { fence: RunFence; existing: boolean } {
    return withSqliteTransaction(this.db, () => {
      const lock = this.db.prepare('SELECT run_id AS runId, owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE id = 1')
        .get() as LockRow | undefined
      if (lock && lock.leaseExpiresAt > now) {
        return { fence: { runId: lock.runId, ownerId, generation: lock.generation }, existing: true }
      }
      let generation = 0
      if (lock) {
        this.db.prepare(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished', finished_at = ?
          WHERE id = ? AND status = 'running'`).run(now, lock.runId)
        generation = lock.generation + 1
      }
      const runId = randomUUID()
      this.db.prepare(`INSERT INTO sync_runs (id, status, phase, started_at) VALUES (?, 'running', 'discovering', ?)`).run(runId, now)
      this.db.prepare(`INSERT INTO sync_run_lock (id, run_id, owner_id, generation, heartbeat_at, lease_expires_at)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET run_id = excluded.run_id, owner_id = excluded.owner_id,
          generation = excluded.generation, heartbeat_at = excluded.heartbeat_at, lease_expires_at = excluded.lease_expires_at`).run(
        runId, ownerId, generation, now, now + SYNC_LEASE_MS,
      )
      return { fence: { runId, ownerId, generation }, existing: false }
    })
  }

  /** Refresh the ownership lease; returns false when the fence is stale or already expired. */
  heartbeat(fence: RunFence, now: number): boolean {
    return withSqliteTransaction(this.db, () => {
      const lock = this.db.prepare('SELECT owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE run_id = ?')
        .get(fence.runId) as { ownerId: string; generation: number; leaseExpiresAt: number } | undefined
      if (!lock || lock.ownerId !== fence.ownerId || lock.generation !== fence.generation || lock.leaseExpiresAt <= now) return false
      const result = this.db.prepare('UPDATE sync_run_lock SET heartbeat_at = ?, lease_expires_at = ? WHERE run_id = ? AND owner_id = ? AND generation = ?')
        .run(now, now + SYNC_LEASE_MS, fence.runId, fence.ownerId, fence.generation)
      return result.changes === 1
    })
  }

  /** Assert the fence still owns the run and the lease is live; throws StaleOwner otherwise. */
  assertFence(fence: RunFence): void {
    assertRunFence(this.db, fence, this.clock.now())
  }

  /**
   * Build a per-run fence guard for the per-request gate. Only the compiled
   * statement is cached; every call re-reads the live lock row, so an ownership
   * loss or lease expiry that lands between requests still surfaces StaleOwner.
   */
  createFenceGuard(fence: RunFence): () => void {
    const stmt = this.db.prepare('SELECT owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE run_id = ?')
    return () => {
      const lock = stmt.get(fence.runId) as { ownerId: string; generation: number; leaseExpiresAt: number } | undefined
      if (!lock || lock.ownerId !== fence.ownerId || lock.generation !== fence.generation || lock.leaseExpiresAt <= this.clock.now()) {
        throw syncRemoteError(syncError('StaleOwner', { scope: 'run', runId: fence.runId }))
      }
    }
  }

  /**
   * Release ownership after a stop: mark the owned run interrupted (a terminal
   * row, never an orphan `running`), then remove the lock so a later claim
   * starts a fresh run. Only the current owner's run is touched.
   */
  revoke(fence: RunFence): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      this.db.prepare(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished', finished_at = ?
        WHERE id = ? AND status = 'running'`).run(this.clock.now(), fence.runId)
      this.db.prepare('DELETE FROM sync_run_lock WHERE id = 1 AND run_id = ? AND owner_id = ? AND generation = ?')
        .run(fence.runId, fence.ownerId, fence.generation)
    })
  }

  /**
   * Mark a run interrupted by id without a fence check; used by the heartbeat
   * loop when it detects the lease has been lost (the fence is already stale,
   * so an ownership assertion would fail).
   */
  markInterrupted(runId: string): void {
    withSqliteTransaction(this.db, () => {
      this.db.prepare(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished', finished_at = ?
        WHERE id = ? AND status = 'running'`).run(this.clock.now(), runId)
    })
  }

  getRun(id: string): SafeRun | null {
    const row = this.db.prepare('SELECT * FROM sync_runs WHERE id = ?').get(id) as unknown as RunRow | undefined
    return row ? toSafeRun(row) : null
  }

  listRuns(page = 1, pageSize = DEFAULT_PAGE_SIZE): Page<SafeRun> {
    const safePageSize = Math.min(Math.max(1, Math.trunc(pageSize)), MAX_PAGE_SIZE)
    const total = (this.db.prepare('SELECT COUNT(*) AS total FROM sync_runs').get() as { total: number }).total
    const pageCount = Math.max(1, Math.ceil(total / safePageSize))
    const safePage = Math.min(Math.max(1, Math.trunc(page)), pageCount)
    const rows = this.db.prepare('SELECT * FROM sync_runs ORDER BY started_at DESC, id LIMIT ? OFFSET ?')
      .all(safePageSize, (safePage - 1) * safePageSize) as unknown as RunRow[]
    return { items: rows.map(toSafeRun), total, page: safePage, pageSize: safePageSize }
  }

  listItemResults(id: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Page<SafeItemResult> {
    const safePageSize = Math.min(Math.max(1, Math.trunc(pageSize)), MAX_PAGE_SIZE)
    const total = (this.db.prepare('SELECT COUNT(*) AS total FROM sync_run_items WHERE run_id = ?').get(id) as { total: number }).total
    const pageCount = Math.max(1, Math.ceil(total / safePageSize))
    const safePage = Math.min(Math.max(1, Math.trunc(page)), pageCount)
    const rows = this.db.prepare('SELECT * FROM sync_run_items WHERE run_id = ? ORDER BY canonical LIMIT ? OFFSET ?')
      .all(id, safePageSize, (safePage - 1) * safePageSize) as unknown as ItemRow[]
    return { items: rows.map(toSafeItemResult), total, page: safePage, pageSize: safePageSize }
  }

  setPhase(fence: RunFence, phase: SafeRunPhase): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const result = this.db.prepare('UPDATE sync_runs SET phase = ? WHERE id = ?').run(phase, fence.runId)
      if (result.changes !== 1) throw syncRemoteError(syncError('RunNotFound', { scope: 'run', runId: fence.runId }))
    })
  }

  recordResult(fence: RunFence, result: SafeItemResult, pendingHint?: boolean): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      recordRunItemResult(this.db, fence.runId, result, pendingHint)
    })
  }

  markSeen(fence: RunFence, key: RemoteKey): boolean {
    return withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const result = this.db.prepare('INSERT OR IGNORE INTO sync_seen_keys (run_id, canonical) VALUES (?, ?)').run(fence.runId, serializeRemoteKey(key))
      return result.changes === 1
    })
  }

  hasSeen(runId: string, key: RemoteKey): boolean {
    return this.db.prepare('SELECT 1 FROM sync_seen_keys WHERE run_id = ? AND canonical = ?').get(runId, serializeRemoteKey(key)) !== undefined
  }

  finishRun(fence: RunFence, status: Exclude<SafeRunStatus, 'running'>, summary: { discoveryComplete: boolean; unprocessedKnown: number | null; errors: SyncErrorDto[] }): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const result = this.db.prepare(`UPDATE sync_runs SET status = ?, phase = 'finished', finished_at = ?,
        unprocessed_known = ?, discovery_complete = ?, errors = ? WHERE id = ?`).run(
        status, this.clock.now(), summary.unprocessedKnown, summary.discoveryComplete ? 1 : 0, JSON.stringify(summary.errors), fence.runId,
      )
      if (result.changes !== 1) throw syncRemoteError(syncError('RunNotFound', { scope: 'run', runId: fence.runId }))
      // Release the singleton lock for the current owner only, so a normal
      // completion never leaves a second manual start waiting out the lease.
      this.db.prepare('DELETE FROM sync_run_lock WHERE id = 1 AND run_id = ? AND owner_id = ? AND generation = ?')
        .run(fence.runId, fence.ownerId, fence.generation)
    })
  }

  /**
   * Delete completed-run history bounded to `maxRows` rows per call, keeping at most 100
   * completed runs younger than 30 days. Baselines and write intents are never touched.
   */
  pruneCompleted(now: number, maxRows = 1000): { removedRows: number; more: boolean } {
    const cutoff = now - 30 * 24 * 60 * 60 * 1000
    return withSqliteTransaction(this.db, () => {
      const candidates = this.db.prepare(`SELECT id FROM sync_runs
        WHERE status != 'running'
          AND (started_at < ? OR id NOT IN (SELECT id FROM sync_runs WHERE status != 'running' ORDER BY started_at DESC LIMIT 100))
        ORDER BY started_at ASC LIMIT ?`).all(cutoff, maxRows) as unknown as { id: string }[]
      for (const candidate of candidates) this.db.prepare('DELETE FROM sync_runs WHERE id = ?').run(candidate.id)
      return { removedRows: candidates.length, more: candidates.length >= maxRows }
    })
  }
}
