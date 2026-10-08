import { randomUUID } from 'node:crypto'
import {
  aggregateStatistics, projectSession, statisticsBounds,
  type StatisticsCompletion, type StatisticsEntry, type StatisticsProgress,
  type StatisticsRunRequest, type StatisticsRunState, type StatisticsSnapshot,
} from './statistics.ts'
import type { StatisticsCacheRow, StatisticsCacheStore } from './statistics-store.ts'
import type { StatisticsSource, StatisticsSourceRecord } from './statistics-source.ts'

/** Delivery figures for one range, read from this plugin's own task store. */
export interface StatisticsTaskStore {
  listCompletions(from: number, to: number): { time: number; points: number }[]
}

/** Finished runs kept addressable for the polling client; oldest settle first. */
const MAX_RETAINED_JOBS = 8
/** Projections per cache write, so a sweep does not fsync once per session. */
const WRITE_BATCH = 25
/**
 * Sessions read at once. Every read is dominated by per-session backend work
 * (directory resolution and handle setup), so overlapping a small batch is
 * safe for the seam — its own batch reader uses the same width — and shortens
 * the one cold sweep that populates the cache.
 */
const READ_CONCURRENCY = 4

interface Job {
  readonly id: string
  readonly controller: AbortController
  state: StatisticsRunState
}

function abortError(): Error {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

/**
 * A cached row may answer a listing record only when its invalidation key still
 * matches. With an exact stored revision that check is exact; without one the
 * only sound rule is that a session observed while closed cannot have grown.
 */
function cacheHit(row: StatisticsCacheRow | undefined, record: StatisticsSourceRecord): row is StatisticsCacheRow {
  if (row === undefined || row.createdAt !== record.createdAt) return false
  if (record.revision !== undefined && record.stored !== false) return row.revision === record.revision
  return row.sealed && record.live === false
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Sweeps the session corpus into hourly statistics, re-using persisted
 * per-session projections until their revision changes.
 *
 * A sweep is exposed as an addressable run so the browser can show progress and
 * cancel: reading hundreds of logs is the slow half and must not look frozen.
 */
export class StatisticsService {
  private readonly jobs = new Map<string, Job>()

  constructor(
    private readonly cache: StatisticsCacheStore,
    private readonly source: () => StatisticsSource,
    private readonly tasks: StatisticsTaskStore,
  ) {}

  /** Fold a request to completion and return its snapshot. */
  async calculate(request: StatisticsRunRequest): Promise<StatisticsSnapshot> {
    return this.sweep(request, new AbortController().signal, () => {})
  }

  /**
   * Start one background sweep.
   * @param request - the range to fold, plus an optional cache bypass.
   * @returns the id the caller polls with `get` and stops with `cancel`.
   */
  start(request: StatisticsRunRequest): string {
    const job: Job = { id: randomUUID(), controller: new AbortController(), state: { status: 'running', processed: 0, total: 0, reused: 0 } }
    this.remember(job)
    void this.sweep(request, job.controller.signal, progress => { job.state = { ...job.state, ...progress } })
      .then(snapshot => { job.state = { ...job.state, status: 'completed', snapshot } })
      .catch((error: unknown) => {
        job.state = job.controller.signal.aborted
          ? { ...job.state, status: 'cancelled' }
          : { ...job.state, status: 'failed', error: messageOf(error) }
      })
    return job.id
  }

  /**
   * Read one run's current state.
   * @param jobId - id returned by `start`.
   * @returns the observed state, or `null` when the run is unknown or evicted.
   */
  get(jobId: string): StatisticsRunState | null {
    return this.jobs.get(jobId)?.state ?? null
  }

  /**
   * Ask a run to stop; the sweep checks between session reads.
   * @param jobId - id returned by `start`.
   * @returns whether a known run was asked to stop.
   */
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (job === undefined) return false
    job.controller.abort()
    return true
  }

  private remember(job: Job): void {
    while (this.jobs.size >= MAX_RETAINED_JOBS) {
      const settled = [...this.jobs.values()].find(entry => entry.state.status !== 'running')
      const victim = settled ?? this.jobs.values().next().value
      if (victim === undefined) break
      this.jobs.delete(victim.id)
    }
    this.jobs.set(job.id, job)
  }

  /**
   * Read the corpus, refresh only what the cache cannot answer, and fold it.
   * @param request - requested range and cache policy.
   * @param signal - cancellation observed between session reads.
   * @param onProgress - called with the running counters.
   * @returns the folded snapshot.
   */
  private async sweep(
    request: StatisticsRunRequest,
    signal: AbortSignal,
    onProgress: (progress: StatisticsProgress) => void,
  ): Promise<StatisticsSnapshot> {
    const now = Date.now()
    const bounds = statisticsBounds(request, now)
    const source = this.source()
    const listed = await source.list(signal)
    const unique: StatisticsSourceRecord[] = []
    const ids = new Set<string>()
    for (const record of listed) {
      if (ids.has(record.id)) continue
      ids.add(record.id)
      unique.push(record)
    }
    // A session created inside the excluded range contributes nothing, so it is
    // never read; it still counts as present for cache pruning.
    const eligible = unique.filter(record => record.createdAt < bounds.end)
    this.cache.prune(ids)
    const cached = this.cache.read()
    const entries: StatisticsEntry[] = []
    const pending: StatisticsSourceRecord[] = []
    for (const record of eligible) {
      const row = cached.get(record.id)
      if (request.refresh !== true && cacheHit(row, record)) {
        entries.push({ id: record.id, createdAt: record.createdAt, projection: row.projection })
        continue
      }
      pending.push(record)
    }
    const reused = entries.length
    onProgress({ processed: 0, total: pending.length, reused })
    const batch: StatisticsCacheRow[] = []
    let processed = 0
    let cursor = 0
    const readNext = async (): Promise<void> => {
      for (;;) {
        if (signal.aborted) throw abortError()
        const index = cursor++
        if (index >= pending.length) return
        const record = pending[index]!
        // Read outside any transaction and fold immediately, so at most
        // READ_CONCURRENCY decoded logs are alive at once.
        const log = await source.read(record, signal)
        const projection = projectSession(log, record.origin)
        entries.push({ id: record.id, createdAt: record.createdAt, projection })
        batch.push({ sessionId: record.id, createdAt: record.createdAt, revision: record.revision ?? null, sealed: record.live === false, projection })
        processed++
        if (batch.length >= WRITE_BATCH) this.cache.write(batch.splice(0, batch.length))
        onProgress({ processed, total: pending.length, reused })
      }
    }
    const settled = await Promise.allSettled(
      Array.from({ length: Math.min(READ_CONCURRENCY, pending.length) }, () => readNext()),
    )
    const failure = settled.find(result => result.status === 'rejected')
    if (failure) throw failure.reason
    this.cache.write(batch)
    if (signal.aborted) throw abortError()
    // Delivery figures are a cheap indexed read from the plugin's own database,
    // so they are recomputed per request instead of being cached per session.
    const completions: StatisticsCompletion[] = this.tasks.listCompletions(request.start, bounds.end)
    return aggregateStatistics(entries, request, now, completions)
  }
}

/** Narrow an untrusted wire request to a run request; `statisticsBounds` rejects the rest. */
export function statisticsRunRequest(request: unknown): StatisticsRunRequest {
  const value = (request ?? {}) as { start?: unknown; end?: unknown; timeZone?: unknown; refresh?: unknown }
  return {
    start: value.start as number,
    end: value.end as number,
    timeZone: value.timeZone as string,
    refresh: value.refresh === true,
  }
}
