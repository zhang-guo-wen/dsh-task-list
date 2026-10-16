// @vitest-environment jsdom
// Render-cost contracts for the task list: the typing and refresh paths must not
// rebuild work that grows with the number of synced rows on screen.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import { local } from './fixtures/sync.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]
const workspaces = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }
const sessions = { items: [] }

function sourceOf(index: number) {
  return {
    platform: 'tapd', projectId: 'p', typeId: 'task', remoteId: String(index), number: `TASK-${index}`,
    url: `https://www.tapd.cn/1/prong/tasks/view/${index}`, lastSuccess: 1_700_000_000_000 + index * 1000, error: null,
  }
}

/** One page in which every row is a synced row: a timestamp and a link each. */
function syncedPage(count: number) {
  return Array.from({ length: count }, (_, index) => local({
    id: `task-${index}`, title: `Synced ${index}`, notes: `Synced ${index}`, workspaceId: 'ws', source: sourceOf(index),
  }))
}

function open(list: ReturnType<typeof vi.fn>) {
  const props: any = {
    list, readAttachments: async () => [], listAgents: async () => [],
    workspaceSnapshot: () => workspaces, subscribeWorkspaces: () => () => {},
    sessionSnapshot: () => sessions, subscribeSessions: () => () => {},
    taskGraph: async () => ({ nodes: [], truncated: false }),
    taskOverview: async () => ({ counts: { todo: 0, in_progress: 0, approving: 0, done: 0 }, total: 0, blocked: 0, sessionIds: [] }),
    sessionExecution: () => null,
    sync: { listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }) }, t,
  }
  return render(<TaskPanel {...props} />)
}

describe('task list render cost', () => {
  it('builds the timestamp formatter once instead of once per synced row per render', async () => {
    const rows = syncedPage(20)
    const list = vi.fn(async () => ({ items: rows, total: rows.length, page: 1, pageSize: 20 }))
    open(list)
    await screen.findByRole('button', { name: '编辑: Synced 0' })
    // Every one of the 20 rows shows a formatted timestamp, so a formatter built
    // on the render path would be constructed at least 20 times per refresh.
    const built = vi.spyOn(Intl, 'DateTimeFormat')
    await waitFor(() => expect((screen.getByRole('button', { name: zh.refresh }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: zh.refresh }))
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(1))
    await screen.findByRole('button', { name: '编辑: Synced 19' })
    expect(built).not.toHaveBeenCalled()
  })

  it('keeps the sanitised source link and the plain fallback for a rejected URL', async () => {
    const rows = [
      local({ id: 'linked', title: 'Linked', notes: 'Linked', workspaceId: 'ws', source: sourceOf(0) }),
      local({ id: 'rejected', title: 'Rejected', notes: 'Rejected', workspaceId: 'ws', source: { ...sourceOf(1), url: 'https://evil.example.org/task' } }),
    ]
    const list = vi.fn(async () => ({ items: rows, total: rows.length, page: 1, pageSize: 20 }))
    open(list)
    const link = await screen.findByRole('link', { name: /TASK-0/ })
    expect(link.getAttribute('href')).toBe('https://www.tapd.cn/1/prong/tasks/view/0')
    // The rejected host renders as text, never as a link.
    expect(screen.queryByRole('link', { name: /TASK-1/ })).toBeNull()
    expect(screen.getByText(/TASK-1/)).toBeTruthy()
  })
})

describe('task list render contracts', () => {
  // The jsdom environment gives import.meta.url a non-file scheme, so the panel
  // source is read through the project root Vitest was started in.
  const panel = readFileSync(resolve(process.cwd(), 'src/client/TaskPanel.tsx'), 'utf8')
  const row = readFileSync(resolve(process.cwd(), 'src/client/TaskRow.tsx'), 'utf8')
  const clock = readFileSync(resolve(process.cwd(), 'src/client/format-time.ts'), 'utf8')

  it('keeps one formatter and one URL sanitiser call site on the render path', () => {
    // One module-level formatter for the panel and its rows together, never
    // rebuilt inside a render.
    expect(clock.match(/new Intl\.DateTimeFormat/g)).toHaveLength(1)
    expect(panel.match(/new Intl\.DateTimeFormat/g)).toBeNull()
    expect(row.match(/new Intl\.DateTimeFormat/g)).toBeNull()
    // The anchor and its fallback share a single sanitised URL per row.
    expect(row.match(/safeSourceUrl\(/g)).toHaveLength(1)
    expect(panel.match(/safeSourceUrl\(/g)).toBeNull()
  })

  it('keeps the row a memoised component of primitives and stable callbacks', () => {
    // The measured cost of a frame that changes nothing visible is the row
    // rebuild, so the row must be memoised and must receive no fresh object
    // identity per render.
    expect(row).toContain('export const TaskRow = memo(TaskRowView)')
    expect(row).not.toContain('useMemo')
    expect(panel).toContain('<TaskRow key={task.id} task={task} linked={linked} ready={workspaceReady(linked)} busy={busy}')
  })
})

// The host pushes a fresh session projection while a session streams, and the
// panel subscribes to it directly. This measures what one such frame costs:
// a new snapshot identity on every notification, nothing visible changing.
const CHURN = 120

interface ChurnReport {
  label: string
  commits: number
  commitMs: number
  maxCommitMs: number
  notifyMs: number
  maxNotifyMs: number
  rows: number
}

async function churn(options: { rows: number; sessions: number; churn: 'sessions' | 'workspaces' }): Promise<ChurnReport> {
  const sessionItems = Array.from({ length: options.sessions }, (_, index) => ({
    id: `session-${index}`, title: `会话标题 ${index}`, archived: false, subagent: false, blank: false,
  }))
  let sessionState = { items: sessionItems }
  let workspaceState: { items: { workspaceId: string; title: string }[] } = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }
  const sessionListeners = new Set<() => void>()
  const workspaceListeners = new Set<() => void>()
  const subscribe = (listeners: Set<() => void>) => (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const rows = syncedPage(options.rows)

  const commits: number[] = []
  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => { commits.push(actualDuration) }
  const props: any = {
    list: async () => ({ items: rows, total: rows.length, page: 1, pageSize: options.rows }),
    readAttachments: async () => [], listAgents: async () => [],
    workspaceSnapshot: () => workspaceState, subscribeWorkspaces: subscribe(workspaceListeners),
    sessionSnapshot: () => sessionState, subscribeSessions: subscribe(sessionListeners),
    sync: { listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }) }, t,
  }
  // The loop mounts one panel per case; without this the queries would match
  // every earlier panel still in the document.
  cleanup()
  render(<Profiler id="panel" onRender={onRender}><TaskPanel {...props} /></Profiler>)
  await screen.findByRole('button', { name: `编辑: Synced 0` })

  const notify = options.churn === 'sessions'
    // A new object identity every frame, exactly as a fresh projection would be.
    ? () => { sessionState = { items: [...sessionItems] }; sessionListeners.forEach(listener => listener()) }
    : () => { workspaceState = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }; workspaceListeners.forEach(listener => listener()) }

  const before = commits.length
  const samples: number[] = []
  for (let index = 0; index < CHURN; index++) {
    const start = performance.now()
    await act(async () => { notify() })
    samples.push(performance.now() - start)
  }
  const frameCommits = commits.slice(before)
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
  return {
    label: `${options.rows} rows / ${options.sessions} sessions / ${options.churn} churn`,
    commits: frameCommits.length,
    commitMs: Number(sum(frameCommits).toFixed(2)),
    maxCommitMs: Number(Math.max(...frameCommits).toFixed(2)),
    notifyMs: Number(sum(samples).toFixed(2)),
    maxNotifyMs: Number(Math.max(...samples).toFixed(2)),
    rows: options.rows,
  }
}

describe('session and workspace snapshot churn', () => {
  it('measures what one stream frame costs the panel', async () => {
    const reports: ChurnReport[] = []
    for (const rows of [20, 50, 100]) {
      for (const sessions of [0, 200]) {
        reports.push(await churn({ rows, sessions, churn: 'sessions' }))
      }
    }
    reports.push(await churn({ rows: 50, sessions: 200, churn: 'workspaces' }))
    for (const report of reports) {
      console.log(`CHURN ${report.label} commits=${report.commits} commitMs=${report.commitMs} maxCommitMs=${report.maxCommitMs} notifyMs=${report.notifyMs} maxNotifyMs=${report.maxNotifyMs}`)
    }
    // Measured on this harness: 120 notifications settle into 180 commits
    // (1.5 each), independent of the row count. The bound guards the failure
    // that matters here — a snapshot getter losing its identity would make the
    // commit count explode instead of staying proportional to the frames.
    for (const report of reports) expect(report.commits).toBeLessThanOrEqual(2 * CHURN)
  }, 180_000)
})
