export interface StatisticsRequest {
  start: number
  end: number
  timeZone: string
}
/** A statistics request plus the explicit cache bypass used by the rescan affordance. */
export interface StatisticsRunRequest extends StatisticsRequest {
  refresh?: boolean
}
export interface HourStatistics {
  hour: number
  sessions: number
  prompts: number
  tokens: number
  /** Tasks whose status became `done` inside this hour. */
  completedTasks: number
  /** Story points carried by those completions. */
  completedPoints: number
}
export interface StatisticsSnapshot {
  start: number
  end: number
  cutoff: number
  calculatedAt: number
  timeZone: string
  missingUsageCalls: number
  hours: HourStatistics[]
  totals: {
    sessions: number
    prompts: number
    tokens: number
    completedTasks: number
    completedPoints: number
  }
}

/** Progress of one background statistics run. */
export interface StatisticsProgress {
  /** Sessions whose log has been read during this run. */
  processed: number
  /** Sessions this run still has to read; zero when the cache covered everything. */
  total: number
  /** Sessions answered from the per-session cache instead of a log read. */
  reused: number
}
export type StatisticsRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'
/** One observed state of a background statistics run. */
export type StatisticsRunState = StatisticsProgress & {
  status: StatisticsRunStatus
  error?: string
  snapshot?: StatisticsSnapshot
}

/** Browser-side controls for one statistics run. */
export interface StatisticsRunOptions {
  /** Ignore the per-session cache and read every log again. */
  refresh?: boolean
  onProgress?(progress: StatisticsProgress): void
  signal?: AbortSignal
}

// A structural projection of the public sessionQuery service; no direct log access.
interface ReportedUsage {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}
export interface StatisticsEvent {
  seq: number
  time: number
  type: string
  data: {
    id?: string
    source?: { kind: string; rpcId?: string }
    turn?: number
    step?: number
    usage?: ReportedUsage
    stream?: readonly { chunk?: { type: string; usage?: ReportedUsage } }[]
  }
  sourceEventSeqs?: readonly number[]
}
export interface StatisticsQuery {
  listSessions(): Promise<{ header: { id: string; createdAt: number; origin?: string }; live?: boolean }[]>
  readSession(id: string): Promise<{ inheritedEventCount: number; events: readonly StatisticsEvent[] }>
}

/**
 * One session event that the range fold still needs, captured at extraction time
 * in log order and carrying no range decision. `p` admitted human message, `c`
 * compaction usage, `u` a call that reported no usage, `r` a retry boundary, and
 * `a` one assistant settlement sample.
 */
export type ProjectionEvent =
  | readonly ['p', time: number]
  | readonly ['c', time: number, tokens: number]
  | readonly ['u', time: number]
  | readonly ['r', time: number, turn: number | null, step: number | null]
  | readonly ['a', time: number, turn: number | null, step: number | null, tokens: number]

/**
 * Cacheable, range-independent extraction of one session log. Applying a range
 * later reproduces the request-time fold exactly, including how a settlement
 * sample that supersedes an earlier one rewrites the earlier hour.
 */
export interface SessionProjection {
  events: ProjectionEvent[]
}

/** One task completion lifted from the task store; bucketed by `time`. */
export interface StatisticsCompletion {
  time: number
  points: number
}

/** One projected session as the range fold consumes it. */
export interface StatisticsEntry {
  id: string
  createdAt: number
  projection: SessionProjection
}

/** Validated absolute bounds of one request, with the current hour excluded. */
export interface StatisticsBounds {
  start: number
  end: number
  cutoff: number
}

const MAX_RANGE_MS = 367 * 86400_000
const FORMAT_CACHE_LIMIT = 16
const minuteSecondFormats = new Map<string, Intl.DateTimeFormat>()

/**
 * A formatter is immutable and expensive to construct, so one per zone is shared
 * across the whole sweep instead of being rebuilt for every event.
 * @param timeZone - IANA zone the caller bucketed in.
 * @returns the cached minute/second parts formatter for that zone.
 */
function minuteSecondFormat(timeZone: string): Intl.DateTimeFormat {
  let format = minuteSecondFormats.get(timeZone)
  if (format === undefined) {
    format = new Intl.DateTimeFormat('en', { timeZone, minute: 'numeric', second: 'numeric' })
    if (minuteSecondFormats.size >= FORMAT_CACHE_LIMIT) minuteSecondFormats.clear()
    minuteSecondFormats.set(timeZone, format)
  }
  return format
}

export function currentHourStart(now: number, timeZone: string): number {
  const parts = minuteSecondFormat(timeZone).formatToParts(now)
  const minute = Number(parts.find(part => part.type === 'minute')!.value)
  const second = Number(parts.find(part => part.type === 'second')!.value)
  return now - minute * 60_000 - second * 1000 - (now % 1000)
}

/**
 * Validate one request and resolve its absolute bounds.
 * @param request - the raw request from the wire.
 * @param now - reference instant that fixes the excluded current hour.
 * @returns validated start, the effective end, and the cutoff.
 * @throws when the range is absent, inverted, oversized, or the zone is unknown.
 */
export function statisticsBounds(request: StatisticsRequest, now: number): StatisticsBounds {
  if (!request || !Number.isSafeInteger(request.start) || !Number.isSafeInteger(request.end)
    || request.start < 0 || request.end <= request.start || request.end - request.start > MAX_RANGE_MS
    || typeof request.timeZone !== 'string') throw new Error('Invalid statistics range')
  const cutoff = currentHourStart(now, request.timeZone)
  return { start: request.start, end: Math.min(request.end, cutoff), cutoff }
}

function usageTokens(usage: ReportedUsage | undefined): number | undefined {
  if (!usage || ![usage.inputTokens, usage.outputTokens].every(value => Number.isSafeInteger(value) && value >= 0)) return
  const values = [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens ?? 0, usage.cacheWriteTokens ?? 0]
  if (!values.every(value => Number.isSafeInteger(value) && value >= 0)) return
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!Number.isSafeInteger(total)) return
  if (usage.totalTokens !== undefined) {
    if (!Number.isSafeInteger(usage.totalTokens) || usage.totalTokens < total) return
    if (usage.cacheReadTokens !== undefined && usage.cacheWriteTokens !== undefined && usage.totalTokens !== total) return
    return usage.totalTokens
  }
  return total
}

function usageOf(event: StatisticsEvent): ReportedUsage | undefined {
  if (event.type === 'assistant/message' && event.data.usage) return event.data.usage
  const stream = event.data.stream
  if (!Array.isArray(stream)) return
  // Durable v2 streams retain chunk envelopes, not incremental usage totals.
  for (let index = stream.length - 1; index >= 0; index--) {
    const chunk = stream[index]?.chunk
    if (chunk?.type === 'usage') return chunk.usage
  }
}

/**
 * Extract every range-relevant fact from one session log once, in log order.
 *
 * The result is independent of the requested range, so it can be persisted and
 * re-folded for any later day, month, or year without reading the log again.
 * @param log - inherited count and events of one session.
 * @param origin - session origin header; `subagent` sessions only admit explicit human sends.
 * @returns the ordered projection for that session.
 */
export function projectSession(
  log: { inheritedEventCount: number; events: readonly StatisticsEvent[] },
  origin: string | undefined,
): SessionProjection {
  const events: ProjectionEvent[] = []
  const messages = new Set<string>()
  for (const event of log.events) {
    if (event.seq < log.inheritedEventCount) continue
    if (event.type === 'user/message' && !event.sourceEventSeqs?.length && event.data.source?.kind === 'user'
      && (origin !== 'subagent' || event.data.source.rpcId)) {
      const identity = event.data.source.rpcId ?? event.data.id ?? String(event.seq)
      if (!messages.has(identity)) {
        messages.add(identity)
        events.push(['p', event.time])
      }
    }
    if (event.type === 'compaction/summary') {
      const tokens = usageTokens(event.data.usage)
      events.push(tokens === undefined ? ['u', event.time] : ['c', event.time, tokens])
      continue
    }
    if (event.type === 'llm/retry-started') {
      events.push(['r', event.time, event.data.turn ?? null, event.data.step ?? null])
      continue
    }
    if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') continue
    const tokens = usageTokens(usageOf(event))
    if (tokens === undefined) {
      events.push(['u', event.time])
      continue
    }
    events.push(['a', event.time, event.data.turn ?? null, event.data.step ?? null, tokens])
  }
  return { events }
}

/**
 * Whether a session ever admitted a real user message.
 *
 * Subagent runs, scheduled work, and abandoned records create sessions without
 * starting a conversation, so they must not inflate the "new sessions" figure.
 * The projection already carries the admitted prompts, so this costs one scan.
 */
function hasUserMessage(projection: SessionProjection): boolean {
  return projection.events.some(event => event[0] === 'p')
}

type Bucket = (time: number) => HourStatistics | undefined

/** Fold one projected session into the hour buckets under the request's range. */
function foldProjection(projection: SessionProjection, bucket: Bucket, end: number): number {
  let missingUsageCalls = 0
  let last: { turn: number | null; step: number | null; time: number; tokens: number } | undefined
  for (const event of projection.events) {
    if (event[1] >= end) continue
    switch (event[0]) {
      case 'p': {
        const row = bucket(event[1])
        if (row) row.prompts++
        break
      }
      case 'c': {
        const row = bucket(event[1])
        if (row) row.tokens += event[2]
        break
      }
      case 'u': {
        if (bucket(event[1])) missingUsageCalls++
        break
      }
      case 'r': {
        if (last?.turn === event[2] && last?.step === event[3]) last = undefined
        break
      }
      case 'a': {
        const [time, turn, step, tokens] = [event[1], event[2], event[3], event[4]]
        if (last && last.turn === turn && last.step === step) {
          if (last.tokens === tokens) break
          const previous = bucket(last.time)
          if (previous) previous.tokens -= last.tokens
        }
        const row = bucket(time)
        if (row) row.tokens += tokens
        last = { turn, step, time, tokens }
        break
      }
    }
  }
  return missingUsageCalls
}

/**
 * Fold projected sessions into one snapshot. Duplicate session ids keep their
 * first occurrence, and a session created inside the excluded range contributes
 * nothing at all.
 * @param entries - projected sessions, newest-first order is irrelevant.
 * @param request - the validated request that fixes the range.
 * @param now - reference instant that fixes the cutoff.
 * @returns the hour rows, totals, and missing-usage count.
 */
export function aggregateStatistics(
  entries: readonly StatisticsEntry[],
  request: StatisticsRequest,
  now = Date.now(),
  completions: readonly StatisticsCompletion[] = [],
): StatisticsSnapshot {
  const { end, cutoff } = statisticsBounds(request, now)
  const hours = new Map<number, HourStatistics>()
  const bucket: Bucket = time => {
    if (!Number.isFinite(time) || time < request.start || time >= end) return
    const hour = currentHourStart(time, request.timeZone)
    let row = hours.get(hour)
    if (!row) {
      row = { hour, sessions: 0, prompts: 0, tokens: 0, completedTasks: 0, completedPoints: 0 }
      hours.set(hour, row)
    }
    return row
  }
  let missingUsageCalls = 0
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.id) || entry.createdAt >= end) continue
    seen.add(entry.id)
    // A record only counts as a new session once a real user message reached it.
    const created = bucket(entry.createdAt)
    if (created && hasUserMessage(entry.projection)) created.sessions++
    missingUsageCalls += foldProjection(entry.projection, bucket, end)
  }
  // Delivery figures come from the task store, bucketed by their own timestamps
  // in the same zone so an hour row carries both families.
  for (const completion of completions) {
    const row = bucket(completion.time)
    if (!row) continue
    row.completedTasks++
    row.completedPoints += completion.points
  }
  const rows = [...hours.values()].sort((a, b) => a.hour - b.hour)
  return {
    start: request.start, end: request.end, cutoff, calculatedAt: now, timeZone: request.timeZone, missingUsageCalls, hours: rows,
    totals: rows.reduce((sum, row) => ({
      sessions: sum.sessions + row.sessions, prompts: sum.prompts + row.prompts, tokens: sum.tokens + row.tokens,
      completedTasks: sum.completedTasks + row.completedTasks, completedPoints: sum.completedPoints + row.completedPoints,
    }), { sessions: 0, prompts: 0, tokens: 0, completedTasks: 0, completedPoints: 0 }),
  }
}

/** Read and fold every session on demand; the uncached reference path. */
export async function calculateStatistics(
  query: StatisticsQuery,
  request: StatisticsRequest,
  now = Date.now(),
  completions: readonly StatisticsCompletion[] = [],
): Promise<StatisticsSnapshot> {
  const { end } = statisticsBounds(request, now)
  const records = await query.listSessions()
  const entries: StatisticsEntry[] = []
  const seen = new Set<string>()
  for (const { header } of records) {
    if (seen.has(header.id) || header.createdAt >= end) continue
    seen.add(header.id)
    const log = await query.readSession(header.id)
    entries.push({ id: header.id, createdAt: header.createdAt, projection: projectSession(log, header.origin) })
  }
  return aggregateStatistics(entries, request, now, completions)
}

/** The compact cache key for one projection, stable across processes. */
export const PROJECTION_PAYLOAD_VERSION = 1

/**
 * Validate one persisted projection payload.
 * @param value - parsed JSON from the cache row.
 * @returns the projection, or `undefined` when the payload is not the current shape.
 */
export function readProjectionPayload(value: unknown): SessionProjection | undefined {
  if (typeof value !== 'object' || value === null) return
  const record = value as { v?: unknown; e?: unknown }
  if (record.v !== PROJECTION_PAYLOAD_VERSION || !Array.isArray(record.e)) return
  const events: ProjectionEvent[] = []
  for (const item of record.e) {
    if (!Array.isArray(item) || typeof item[0] !== 'string' || !Number.isFinite(item[1])) return
    const time = item[1] as number
    if (item[0] === 'p' && item.length === 2) events.push(['p', time])
    else if (item[0] === 'c' && item.length === 3 && Number.isFinite(item[2])) events.push(['c', time, item[2] as number])
    else if (item[0] === 'u' && item.length === 2) events.push(['u', time])
    else if (item[0] === 'r' && item.length === 4) events.push(['r', time, nullableNumber(item[2]), nullableNumber(item[3])])
    else if (item[0] === 'a' && item.length === 5 && Number.isFinite(item[4])) {
      events.push(['a', time, nullableNumber(item[2]), nullableNumber(item[3]), item[4] as number])
    } else return
  }
  return { events }
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Serialize a projection into the cache payload shape. */
export function projectionPayload(projection: SessionProjection): string {
  return JSON.stringify({ v: PROJECTION_PAYLOAD_VERSION, e: projection.events })
}
