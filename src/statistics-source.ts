import type { Context } from '@deepseek-ai/cordis'
import type { StatisticsEvent, StatisticsQuery } from './statistics.ts'

/** One session the sweep can account for, with whatever invalidation key its backend exposes. */
export interface StatisticsSourceRecord {
  id: string
  createdAt: number
  origin?: string
  /** Exact stored revision when the backend exposes one; absent means the row cannot be revision-checked. */
  revision?: string
  /** Whether the session is currently open in this process. */
  live?: boolean
  /** Whether a stored artifact exists yet; a session created moments ago has none. */
  stored?: boolean
}

/**
 * The read surface the statistics sweep needs: an O(N) listing plus a per-session
 * log read. Two adapters implement it — the persistence seam (exact revisions, no
 * corpus listing per read) and the session-query service (the portable fallback).
 */
export interface StatisticsSource {
  list(signal?: AbortSignal): Promise<StatisticsSourceRecord[]>
  read(record: StatisticsSourceRecord, signal?: AbortSignal): Promise<{ inheritedEventCount: number; events: readonly StatisticsEvent[] }>
}

interface PersistenceSnapshot {
  header: { id: string; createdAt: number; origin?: string }
  revision?: string
  sizeBytes?: number
}
interface PersistenceReadHandle {
  header: { id: string; createdAt: number; origin?: string }
  inheritedEventCount: number
  read(start?: number, end?: number, options?: { signal?: AbortSignal }): Promise<{ events: readonly StatisticsEvent[] }>
  close(): Promise<void>
}
interface StatisticsPersistence {
  list(options?: { signal?: AbortSignal }): Promise<readonly PersistenceSnapshot[]>
  open(id: string, mode: 'read', options?: { signal?: AbortSignal }): Promise<PersistenceReadHandle>
}

function notStored(error: unknown): boolean {
  return error instanceof Error
    && (error.name === 'SessionPersistenceNotFoundError' || /\bnot found\b/iu.test(error.message))
}

/** Read one complete stored log without taking ownership; the closers that balance a torn turn cannot affect these counts. */
async function readStored(persistence: StatisticsPersistence, id: string, signal?: AbortSignal): Promise<{ inheritedEventCount: number; events: readonly StatisticsEvent[] }> {
  const options = signal === undefined ? undefined : { signal }
  const handle = await persistence.open(id, 'read', options)
  try {
    const read = await handle.read(0, undefined, options)
    return { inheritedEventCount: handle.inheritedEventCount, events: read.events }
  } finally {
    await handle.close()
  }
}

function sessionQuerySource(query: StatisticsQuery): StatisticsSource {
  return {
    list: async () => (await query.listSessions()).map(({ header, live }) => ({
      id: header.id, createdAt: header.createdAt, ...header.origin === undefined ? {} : { origin: header.origin },
      ...live === undefined ? {} : { live }, stored: true,
    })),
    read: (record) => query.readSession(record.id),
  }
}

function persistenceSource(persistence: StatisticsPersistence, fallback: StatisticsQuery | undefined): StatisticsSource {
  return {
    async list(signal) {
      const snapshots = await persistence.list(signal === undefined ? undefined : { signal })
      return snapshots.map(snapshot => ({
        id: snapshot.header.id, createdAt: snapshot.header.createdAt,
        ...snapshot.header.origin === undefined ? {} : { origin: snapshot.header.origin },
        ...snapshot.revision === undefined ? {} : { revision: snapshot.revision },
        // Only a materialized artifact can be opened by id; a session created but
        // not yet written is served from the live in-memory log instead.
        stored: snapshot.sizeBytes !== undefined,
      }))
    },
    async read(record, signal) {
      if (record.stored !== false) {
        try {
          return await readStored(persistence, record.id, signal)
        } catch (error) {
          if (!notStored(error) || fallback === undefined) throw error
        }
      }
      if (fallback === undefined) throw new Error(`session "${record.id}" is not readable`)
      return fallback.readSession(record.id)
    },
  }
}

/**
 * Resolve the best available read surface for statistics.
 *
 * The persistence seam is preferred: `open` resolves one session directly, while
 * the query service re-lists the whole corpus for every single `readSession`,
 * which turns a corpus sweep quadratic. The query service stays the fallback for
 * compositions without a persistence backend.
 * @param ctx - host context carrying either service.
 * @returns the resolved source.
 * @throws when neither service is mounted.
 */
export function createStatisticsSource(ctx: Context): StatisticsSource {
  const query = ctx.get('sessionQuery') as StatisticsQuery | undefined
  const usableQuery = query && typeof query.listSessions === 'function' && typeof query.readSession === 'function' ? query : undefined
  const persistence = ctx.get('sessionPersistence') as StatisticsPersistence | undefined
  if (persistence && typeof persistence.list === 'function' && typeof persistence.open === 'function') {
    return persistenceSource(persistence, usableQuery)
  }
  if (usableQuery !== undefined) return sessionQuerySource(usableQuery)
  throw new Error('Session statistics require the Harness sessionQuery service (listSessions/readSession) or a session persistence backend. Reload or upgrade the host.')
}
