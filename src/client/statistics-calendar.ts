import type { StatisticsRequest, StatisticsSnapshot } from '../statistics.ts'

export type StatisticsPeriod = 'day' | 'month' | 'year'
export function periodValue(period: StatisticsPeriod, now = new Date()): string {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return period === 'year' ? String(now.getFullYear()) : period === 'month' ? month : `${month}-${String(now.getDate()).padStart(2, '0')}`
}
export function periodRequest(period: StatisticsPeriod, value: string): StatisticsRequest {
  const pattern = period === 'year' ? /^\d{4}$/ : period === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/
  if (!pattern.test(value)) throw new Error('Invalid statistics period')
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  if (year < 1970 || year > 9998 || start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) throw new Error('Invalid statistics period')
  const end = new Date(start)
  if (period === 'year') end.setFullYear(year + 1)
  else if (period === 'month') end.setMonth(month)
  else end.setDate(day + 1)
  return { start: start.getTime(), end: end.getTime(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
}

/**
 * Medium cell colour: one day of this many tokens, scaled to whatever bucket a
 * view draws. An absolute anchor keeps a busy hour, day, and month comparable
 * across views, which a maximum-relative scale cannot do.
 */
export const MEDIUM_DAY_TOKENS = 6e8
/** Ratios of the bucket's medium value; 1x lands in the middle band. */
const BANDS = [0.5, 1.5, 3] as const

/** Medium token count for one cell of the given view. */
export function mediumTokens(period: StatisticsPeriod): number {
  if (period === 'day') return MEDIUM_DAY_TOKENS / 24
  if (period === 'month') return MEDIUM_DAY_TOKENS
  return MEDIUM_DAY_TOKENS * 30
}
/**
 * Heat level of one cell.
 * @param tokens - tokens recorded in the bucket.
 * @param period - view the bucket belongs to.
 * @returns 0 for an empty bucket, else 1 through 4.
 */
export function heatLevel(tokens: number, period: StatisticsPeriod): number {
  if (!(tokens > 0)) return 0
  const ratio = tokens / mediumTokens(period)
  if (ratio < BANDS[0]) return 1
  if (ratio < BANDS[1]) return 2
  if (ratio < BANDS[2]) return 3
  return 4
}

const exactCount = new Intl.NumberFormat()

/**
 * Compact magnitude for large counters: `79.7M`, `1.48B`. A value below a
 * million stays exact, so ordinary counts never become unreadable fractions.
 * @param value - raw counter value.
 * @returns the display text for one counter.
 */
export function compactNumber(value: number): string {
  const magnitude = Math.abs(value)
  if (magnitude < 1_000_000) return exactCount.format(value)
  const billions = magnitude >= 1_000_000_000
  const scaled = value / (billions ? 1_000_000_000 : 1_000_000)
  return `${Number(scaled.toFixed(billions ? 2 : 1))}${billions ? 'B' : 'M'}`
}

export interface CalendarCell {
  label: string
  start: number
  excluded: boolean
  sessions: number
  prompts: number
  tokens: number
  completedTasks: number
  completedPoints: number
}

function emptyCell(label: string, start: number, excluded: boolean): CalendarCell {
  return { label, start, excluded, sessions: 0, prompts: 0, tokens: 0, completedTasks: 0, completedPoints: 0 }
}

/**
 * Cells for one view in draw order.
 *
 * A month view starts with one `null` per weekday before its first day, so the
 * cells line up under a Monday-first weekday header.
 * @param snapshot - folded report.
 * @param period - view to lay out.
 * @param dayLabel - how a month cell names its day of month, e.g. `1号`.
 * @returns cells, with month padding entries as `null`.
 */
export function calendarCells(
  snapshot: StatisticsSnapshot,
  period: StatisticsPeriod,
  dayLabel: (day: number) => string = String,
): Array<CalendarCell | null> {
  const first = new Date(snapshot.start)
  if (period === 'day') {
    const cells = Array.from({ length: 24 }, (_, hour) => {
      const date = new Date(first)
      date.setHours(hour, 0, 0, 0)
      // A DST transition can repeat or skip a wall-clock hour; such a slot is not this hour.
      return emptyCell(`${String(hour).padStart(2, '0')}:00`, date.getTime(), date.getTime() >= snapshot.cutoff || date.getHours() !== hour)
    })
    return applyHours(cells, snapshot, 'day')
  }
  if (period === 'month') {
    const lead = (first.getDay() + 6) % 7
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const blanks: Array<CalendarCell | null> = Array.from({ length: lead }, () => null)
    const cells = Array.from({ length: days }, (_, index) => {
      const date = new Date(first.getFullYear(), first.getMonth(), index + 1)
      return emptyCell(dayLabel(index + 1), date.getTime(), date.getTime() >= snapshot.cutoff)
    })
    return [...blanks, ...applyHours(cells, snapshot, 'month')]
  }
  const year = first.getFullYear()
  const cells = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1)
    return emptyCell(`${index + 1}月`, date.getTime(), date.getTime() >= snapshot.cutoff)
  })
  return applyHours(cells, snapshot, 'year')
}

/** Week rows a month grid needs: five for most months, six when the month starts late. */
export function calendarWeeks(snapshot: StatisticsSnapshot): number {
  const first = new Date(snapshot.start)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return Math.ceil((lead + days) / 7)
}

/**
 * Sum the report's hour rows into their cells.
 *
 * Wall-clock fields decide the target so both occurrences of a DST hour share
 * one day cell.
 */
function applyHours(
  cells: CalendarCell[],
  snapshot: StatisticsSnapshot,
  period: StatisticsPeriod,
): CalendarCell[] {
  const format = new Intl.DateTimeFormat('en', { timeZone: snapshot.timeZone, month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' })
  for (const row of snapshot.hours) {
    if (row.hour < snapshot.start || row.hour >= snapshot.end || row.hour >= snapshot.cutoff) continue
    const parts = format.formatToParts(row.hour)
    const field = period === 'day' ? 'hour' : period === 'month' ? 'day' : 'month'
    const index = Number(parts.find(part => part.type === field)!.value) - (period === 'day' ? 0 : 1)
    const cell = cells[index]
    if (!cell || cell.excluded) continue
    cell.sessions += row.sessions
    cell.prompts += row.prompts
    cell.tokens += row.tokens
    cell.completedTasks += row.completedTasks
    cell.completedPoints += row.completedPoints
  }
  return cells
}

export const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
