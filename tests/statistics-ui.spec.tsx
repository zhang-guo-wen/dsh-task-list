// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatisticsCalendar } from '../src/client/StatisticsCalendar.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import type { StatisticsRequest, StatisticsRunOptions, StatisticsSnapshot } from '../src/statistics.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]
const hour = 3_600_000
const dayStart = new Date(2026, 9, 8, 0).getTime()
const snapshot: StatisticsSnapshot = {
  start: dayStart, end: dayStart + 24 * hour, cutoff: dayStart + 12 * hour, calculatedAt: dayStart + 13 * hour,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, missingUsageCalls: 0,
  hours: [{ hour: dayStart + 9 * hour, sessions: 3, prompts: 5, tokens: 49_914_230, completedTasks: 2, completedPoints: 8 }],
  totals: { sessions: 3, prompts: 5, tokens: 1_484_991_258, completedTasks: 2, completedPoints: 8 },
}

function abortFailure(): Error {
  return Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
}

function recorder(impl: (request: StatisticsRequest, run: StatisticsRunOptions) => Promise<StatisticsSnapshot>) {
  const calls: { request: StatisticsRequest; run: StatisticsRunOptions }[] = []
  const calculate = vi.fn((request: StatisticsRequest, run: StatisticsRunOptions = {}) => {
    calls.push({ request, run })
    return impl(request, run)
  })
  return { calculate, calls }
}

async function open() {
  const { calculate, calls } = recorder(async () => snapshot)
  const view = render(<StatisticsCalendar calculate={calculate} close={() => {}} t={t} />)
  await waitFor(() => expect(calls).toHaveLength(1))
  return { ...view, calls }
}

describe('statistics report', () => {
  it('loads on open with read-only metric cards and two metrics per cell', async () => {
    const { container, calls } = await open()
    expect(calls[0]!.run.refresh).toBe(false)

    const cards = container.querySelectorAll('[data-metric]')
    expect(cards).toHaveLength(5)
    // The cards are a read-only legend: no buttons, no pointer affordance, and
    // hovering them never changes what the grid draws.
    expect(within(cards[0] as HTMLElement).queryByRole('button')).toBeNull()
    expect(screen.getByRole('button', { name: zh.statisticsRefresh })).toBeTruthy()

    const first = container.querySelector('[data-period="day"] [data-cell]') as HTMLElement
    const before = first.textContent
    await userEvent.hover(cards[3] as HTMLElement)
    expect(first.textContent).toBe(before)
    expect(first.textContent).toContain(zh.statisticsShortPrompts)
    expect(first.textContent).toContain(zh.statisticsShortTokens)
    expect(first.textContent).not.toContain(zh.statisticsShortSessions)
    expect(first.textContent).not.toContain(zh.statisticsShortTasks)
    // 09:00 carries the fixture's tokens, and the compact unit keeps it short.
    expect((container.querySelectorAll('[data-period="day"] [data-cell]')[9] as HTMLElement).textContent).toContain('49.9M')
  })

  it('explains the hovered bucket with every metric in a floating card', async () => {
    const { container } = await open()
    expect(screen.queryByRole('tooltip')).toBeNull()

    await userEvent.hover(container.querySelectorAll('[data-period="day"] [data-cell]')[9] as HTMLElement)
    const tip = await screen.findByRole('tooltip')
    const scope = within(tip)
    for (const label of [zh.statisticsSessions, zh.statisticsPrompts, zh.statisticsTokens, zh.statisticsTasks, zh.statisticsPoints]) {
      expect(scope.getByText(label)).toBeTruthy()
    }
    expect(tip.textContent).toContain('49.9M')
    expect(tip.textContent).toContain('09:00')

    await userEvent.unhover(container.querySelectorAll('[data-period="day"] [data-cell]')[9] as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })

  it('lays a month out under a Monday-first weekday header', async () => {
    const { container } = await open()
    await userEvent.click(screen.getByRole('button', { name: zh.statisticsMonth }))
    await waitFor(() => expect(container.querySelector('[data-period="month"]')).toBeTruthy())
    const weekdays = container.querySelectorAll('[data-weekday]')
    expect([...weekdays].map(node => node.textContent)).toEqual(zh.statisticsWeekdays.split(','))
    // October 2026 starts on a Thursday: three blanks, then day 1.
    expect(container.querySelectorAll('[data-blank]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-period="month"] [data-cell]')).toHaveLength(31)
  })

  it('reloads on a period change and reads logs again only for an explicit refresh', async () => {
    const { calls } = await open()

    await userEvent.click(screen.getByRole('button', { name: zh.statisticsMonth }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]!.run.refresh).toBe(false)
    expect(new Date(calls[1]!.request.start).getDate()).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: zh.statisticsRefresh }))
    await waitFor(() => expect(calls).toHaveLength(3))
    expect(calls[2]!.run.refresh).toBe(true)
  })

  it('shows live progress and lets the user stop a running load', async () => {
    let aborted = false
    const { calculate } = recorder((_request, run) => {
      run.onProgress?.({ processed: 3, total: 10, reused: 7 })
      return new Promise<StatisticsSnapshot>((_resolve, reject) => {
        run.signal?.addEventListener('abort', () => { aborted = true; reject(abortFailure()) })
      })
    })
    render(<StatisticsCalendar calculate={calculate} close={() => {}} t={t} />)

    await screen.findByText(/已读取 3 \/ 10 个会话/u)
    await userEvent.click(screen.getByRole('button', { name: zh.statisticsCancel }))
    await screen.findByText(new RegExp(zh.statisticsCancelled, 'u'))
    await waitFor(() => expect(aborted).toBe(true))
    expect(screen.getByRole('button', { name: zh.statisticsRefresh })).toBeTruthy()
  })
})
