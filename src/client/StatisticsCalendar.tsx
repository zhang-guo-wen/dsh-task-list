import { Fragment, useEffect, useRef, useState } from 'react'
import { Button, SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { StatisticsProgress, StatisticsRequest, StatisticsRunOptions, StatisticsSnapshot } from '../statistics.ts'
import {
  calendarCells, calendarWeeks, compactNumber, heatLevel, periodRequest, periodValue,
  type CalendarCell, type StatisticsPeriod,
} from './statistics-calendar.ts'
import type { TaskKey } from './locales.ts'
import css from './StatisticsCalendar.module.css'

type MetricKey = 'sessions' | 'prompts' | 'tokens' | 'completedTasks' | 'completedPoints'
interface Metric {
  key: MetricKey
  label: TaskKey
  short: TaskKey
}
/** Two families: session activity, then delivery from the task store. */
const GROUPS: Metric[][] = [
  [
    { key: 'sessions', label: 'statisticsSessions', short: 'statisticsShortSessions' },
    { key: 'prompts', label: 'statisticsPrompts', short: 'statisticsShortPrompts' },
    { key: 'tokens', label: 'statisticsTokens', short: 'statisticsShortTokens' },
  ],
  [
    { key: 'completedTasks', label: 'statisticsTasks', short: 'statisticsShortTasks' },
    { key: 'completedPoints', label: 'statisticsPoints', short: 'statisticsShortPoints' },
  ],
]
const METRICS = GROUPS.flat()
/** Drawn in every heat cell; every other metric appears while its card is hovered. */
const ALWAYS_SHOWN: readonly MetricKey[] = ['prompts', 'tokens']
const periodKeys = { day: 'statisticsDay', month: 'statisticsMonth', year: 'statisticsYear' } as const
/** Period switch order; the id base also names its tabs and the panel they own. */
const PERIODS = ['day', 'month', 'year'] as const
const PERIOD_ID = 'statistics-period'
/** Delay before a period or date change reloads, so typing a year runs once. */
const RELOAD_DEBOUNCE_MS = 200
/** How long the pointer must rest on a cell before its hover card opens. */
const TIP_SHOW_DELAY_MS = 400
const exactCount = new Intl.NumberFormat()

function aborted(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function metricText(key: MetricKey, value: number): string {
  // A Host from before this metric existed omits the field; show zero, not NaN.
  const safe = Number.isFinite(value) ? value : 0
  return key === 'tokens' ? compactNumber(safe) : exactCount.format(safe)
}

/** Calendar anchor of a period value, so a step keeps the same day or month. */
function anchorOf(value: string): Date {
  return /^\d{4}/.test(value)
    ? new Date(`${value.slice(0, 4)}-${value.slice(5, 7) || '01'}-${value.slice(8, 10) || '01'}T00:00:00`)
    : new Date()
}

/** The same anchor stepped one period forward or back. */
function stepAnchor(value: string, period: StatisticsPeriod, direction: -1 | 1): Date {
  const anchor = anchorOf(value)
  if (period === 'day') anchor.setDate(anchor.getDate() + direction)
  else if (period === 'month') anchor.setMonth(anchor.getMonth() + direction)
  else anchor.setFullYear(anchor.getFullYear() + direction)
  return anchor
}

export function StatisticsCalendar({ calculate, close, t }: PropsLocale<'taskList'> & {
  calculate(request: StatisticsRequest, options?: StatisticsRunOptions): Promise<StatisticsSnapshot>
  close(): void
}) {
  const [period, setPeriod] = useState<StatisticsPeriod>('day')
  const [value, setValue] = useState(() => periodValue('day'))
  const [result, setResult] = useState<{ period: StatisticsPeriod; snapshot: StatisticsSnapshot } | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<StatisticsProgress | null>(null)
  const [error, setError] = useState('')
  const [tip, setTip] = useState<{ cell: CalendarCell; x: number; top: number; bottom: number; below: boolean } | null>(null)
  const generation = useRef(0)
  const control = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const tipTimer = useRef<number | null>(null)
  const tipOpen = useRef(false)
  const tipCell = useRef<number | null>(null)

  const run = async (refresh: boolean) => {
    let request: StatisticsRequest
    try {
      request = periodRequest(period, value)
    } catch {
      // An incomplete date is not worth reporting while the user is typing one.
      return
    }
    // A newer selection supersedes the run in flight instead of queueing behind it.
    control.current?.abort()
    const active = new AbortController()
    control.current = active
    const current = ++generation.current
    setBusy(true)
    setError('')
    setProgress(null)
    setTip(null)
    try {
      const snapshot = await calculate(request, {
        refresh,
        signal: active.signal,
        onProgress: next => { if (generation.current === current) setProgress(next) },
      })
      // Keep the period the data belongs to, so a switch never renders an old
      // snapshot through the new layout while the next one is in flight.
      if (generation.current === current) setResult({ period, snapshot })
    } catch (failure) {
      // A cancelled run is the user's decision, so it reports as such rather than
      // as a failure; an unmounted panel has already bumped the generation.
      if (generation.current === current) {
        setError(aborted(failure) ? t('statisticsCancelled') : failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (control.current === active) control.current = null
      if (generation.current === current) setBusy(false)
    }
  }

  useEffect(() => {
    heading.current?.focus()
    // Closing the report aborts the run so the Host stops sweeping.
    return () => { generation.current++; control.current?.abort(); cancelTipTimer() }
  }, [])

  // Opening the report loads it instead of asking for a click, and every later
  // period or date change reloads the same way. Only 刷新 re-reads logs.
  useEffect(() => {
    const timer = setTimeout(() => { void run(false) }, RELOAD_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [period, value])

  const valid = (() => {
    try {
      periodRequest(period, value)
      return true
    } catch {
      return false
    }
  })()
  // Stepping back is always available; stepping forward stops at the period that
  // contains now, because a future period has nothing to report.
  const canStepForward = valid && stepAnchor(value, period, 1).getTime() <= Date.now()
  const stepLabel = (direction: -1 | 1) => t(direction < 0 ? 'statisticsPrev' : 'statisticsNext')
    .replace('{unit}', t(period === 'month' ? 'statisticsUnitMonth' : periodKeys[period]))
  const step = (direction: -1 | 1) => {
    if (direction > 0 && !canStepForward) return
    setValue(periodValue(period, stepAnchor(value, period, direction)))
    closeTip()
  }
  // The grid is drawn for the period its data belongs to, so switching views
  // keeps the previous grid intact until the new one arrives.
  const view: StatisticsPeriod = result?.period ?? period
  const snapshot = result?.snapshot ?? null
  const cells = snapshot
    ? calendarCells(snapshot, view, day => t('statisticsDayOfMonth').replace('{day}', String(day)))
    : []
  const weeks = snapshot && view === 'month' ? calendarWeeks(snapshot) : 5
  // The grid always draws these two; the hover card on a cell carries the rest.
  const shown = new Set<MetricKey>(ALWAYS_SHOWN)
  const columns = view === 'day' ? 6 : view === 'month' ? 7 : 6
  const weekdays = t('statisticsWeekdays').split(',')
  const progressText = busy
    ? `${t('statisticsCalculating')}${progress && progress.total > 0
      ? ` · ${t('statisticsProgress').replace('{processed}', exactCount.format(progress.processed)).replace('{total}', exactCount.format(progress.total))}`
      : ''}`
    : ''

  // The hover card waits a moment before it opens, then follows the pointer from
  // cell to cell without another wait. Leaving the grid closes it.
  const placeTip = (cell: CalendarCell, target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    tipCell.current = cell.start
    tipOpen.current = true
    setTip({ cell, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, below: rect.top < 200 })
  }
  const cancelTipTimer = () => {
    if (tipTimer.current === null) return
    window.clearTimeout(tipTimer.current)
    tipTimer.current = null
  }
  const closeTip = () => {
    cancelTipTimer()
    tipCell.current = null
    if (!tipOpen.current) return
    tipOpen.current = false
    setTip(null)
  }
  const scheduleTip = (cell: CalendarCell, target: HTMLElement) => {
    cancelTipTimer()
    if (tipOpen.current) {
      placeTip(cell, target)
      return
    }
    tipTimer.current = window.setTimeout(() => {
      tipTimer.current = null
      // The cell can be gone by now when a reload re-rendered the grid.
      if (target.isConnected) placeTip(cell, target)
    }, TIP_SHOW_DELAY_MS)
  }
  const hoverCell = (event: React.MouseEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]')
    if (target === null) return
    const cell = cells[Number(target.dataset.index)]
    if (!cell) return
    // Ignore the extra events fired while the pointer crosses a cell's own text.
    if (tipOpen.current && tipCell.current === cell.start) return
    scheduleTip(cell, target)
  }
  return <section className={css.view} aria-labelledby="task-statistics-title" aria-busy={busy}>
    <header className={css.header}>
      <h1 id="task-statistics-title" ref={heading} tabIndex={-1}>{t('statisticsTitle')}</h1>
      <Button variant="outline" onClick={close}>{t('statisticsClose')}</Button>
    </header>
    <div className={css.toolbar}>
      {/* The Host's own segmented control: it carries the themed track, the sliding
          selection indicator and the focus ring, so the switch reads in both themes. */}
      <SegmentedControl id={PERIOD_ID} value={period} label={t('statisticsPeriod')} className={css.periods} disabled={busy}
        options={PERIODS.map(item => ({ value: item, label: t(periodKeys[item]) }))}
        onChange={next => {
          // Keep the same day visible when the period changes, so 天→月 lands on that month.
          setPeriod(next)
          setValue(periodValue(next, anchorOf(value)))
          closeTip()
        }} />
      <div className={css.stepper}>
        <Button variant="ghost" size="sm" aria-label={stepLabel(-1)} disabled={busy || !valid} onClick={() => step(-1)}>←</Button>
        <input type={period === 'day' ? 'date' : period === 'month' ? 'month' : 'number'} aria-label={t('statisticsDate')}
          value={value} min={period === 'day' ? '1970-01-01' : period === 'month' ? '1970-01' : '1970'}
          max={period === 'day' ? '9998-12-31' : period === 'month' ? '9998-12' : '9998'} disabled={busy}
          onChange={event => { setValue(event.target.value); closeTip() }} />
        <Button variant="ghost" size="sm" aria-label={stepLabel(1)} disabled={busy || !canStepForward} onClick={() => step(1)}>→</Button>
      </div>
      <Button variant="primary" disabled={busy || !valid} onClick={() => void run(true)}>{t('statisticsRefresh')}</Button>
      {busy && <Button variant="ghost" onClick={() => control.current?.abort()}>{t('statisticsCancel')}</Button>}
      {/* Lives in the toolbar and always occupies its slot, so nothing shifts
          vertically when a reload starts or finishes. */}
      <span className={css.progress} role="status">{progressText}</span>
    </div>
    {error && <p className={css.error} role="alert">{t('error')}: {error}</p>}
    {snapshot && <>
      <div className={css.totals} role="group" aria-label={t('statisticsMetric')}>
        {METRICS.map(item => <div key={item.key} className={css.total} data-metric={item.key}>
          <span className={css.totalLabel}>{t(item.label)}</span>
          <span className={css.totalValue}>{metricText(item.key, snapshot.totals[item.key])}</span>
        </div>)}
      </div>
      {/* The period switch owns this panel: the grid it labels is the tab's target. */}
      <div className={css.calendar} role="tabpanel" id={`${PERIOD_ID}-${period}-panel`} aria-labelledby={`${PERIOD_ID}-${period}`}>
        {view === 'month' && <div className={css.weekdays} aria-hidden="true">{weekdays.map(day => <span key={day} data-weekday>{day}</span>)}</div>}
        <div className={css.grid} data-period={view} data-columns={columns} data-weeks={view === 'month' ? weeks : undefined}
          role="group" aria-label={t('statisticsDay')} onMouseOver={hoverCell} onMouseLeave={closeTip}>
          {cells.map((cell, index) => {
            if (!cell) return <span key={`blank-${index}`} className={css.blank} data-blank aria-hidden="true" />
            const summary = GROUPS.map(group => group
              .filter(item => shown.has(item.key))
              .map(item => `${t(item.short)}: ${metricText(item.key, cell[item.key])}`)
              .join(' · '))
              .filter(Boolean).join(' · ')
            const label = `${t('statisticsTitle')} ${cell.label} · ${cell.excluded ? t('statisticsExcluded') : summary}`
            const level = cell.excluded ? undefined : heatLevel(cell.tokens, view)
            return <div key={cell.start} className={css.cell} tabIndex={0} data-cell data-index={index} data-level={level}
              data-excluded={cell.excluded || undefined} aria-label={label}
              onFocus={event => placeTip(cell, event.currentTarget)}
              onBlur={closeTip}>
              <div className={css.cellHead}><b>{cell.label}</b></div>
              <div className={css.cellBody}>
                {GROUPS.map((group, groupIndex) => {
                  const metrics = group.filter(item => shown.has(item.key))
                  if (metrics.length === 0) return null
                  return <div key={groupIndex} className={css.group}>
                    {metrics.map(item => <span key={item.key} className={css.stat}>
                      <em className={css.statLabel}>{t(item.short)}</em>
                      <b className={css.statValue}>{cell.excluded ? '—' : metricText(item.key, cell[item.key])}</b>
                    </span>)}
                  </div>
                })}
              </div>
            </div>
          })}
        </div>
      </div>
      <div className={css.legend}>
        <span>{t('statisticsLess')}</span>
        {[0, 1, 2, 3, 4].map(level => <span key={level} className={css.swatch} data-level={level} />)}
        <span>{t('statisticsMore')}</span>
        <span className={css.swatch} data-excluded="true" />
        <span>{t('statisticsExcluded')}</span>
      </div>
    </>}
    {tip && <div className={css.tip} role="tooltip"
      style={{ top: tip.below ? tip.bottom : tip.top, left: tip.x, transform: `translate(-50%, ${tip.below ? '8px' : 'calc(-100% - 8px)'})` }}>
      <div className={css.tipHead}>
        <b>{tip.cell.label}</b>
        {tip.cell.excluded && <span>{t('statisticsExcluded')}</span>}
      </div>
      {GROUPS.map((group, groupIndex) => <div key={groupIndex} className={css.tipGroup}>
        {group.map(item => <Fragment key={item.key}>
          <em className={css.tipLabel}>{t(item.label)}</em>
          <b className={css.tipValue}>{tip.cell.excluded ? '—' : metricText(item.key, tip.cell[item.key])}</b>
        </Fragment>)}
      </div>)}
    </div>}
  </section>
}
