// @vitest-environment jsdom
// Integration of the list, the topology canvas, and the card board: one panel,
// one relationship read, and a composer that writes parent and dependency
// selections back through the same face.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import { local } from './fixtures/sync.ts'
import type { TaskGraph, TaskRecord } from '../src/types.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]
const workspaces = { items: [{ workspaceId: 'ws', title: '工作区' }] }
const sessions = { items: [
  { id: 'session-1', title: '处理会话', archived: false, subagent: false, blank: false, agent: 'standard', running: true },
] }

function node(task: TaskRecord) {
  return { task, parents: task.parentId === null ? [] : [task.parentId], children: [], waitsOn: [...task.blockingIds], waitedOnBy: [], blocked: false }
}

/** Two related tasks: `child` sits under `parent` and waits on `blocker`. */
function tasks(): { parent: TaskRecord; child: TaskRecord; blocker: TaskRecord } {
  return {
    parent: local({ id: 'parent', title: '父任务', notes: '父任务', workspaceId: 'ws', status: 'in_progress' }),
    child: local({ id: 'child', title: '子任务', notes: '子任务', workspaceId: 'ws', parentId: 'parent', blockingIds: ['blocker'], sessionId: 'session-1' }),
    blocker: local({ id: 'blocker', title: '前置任务', notes: '前置任务', workspaceId: 'ws' }),
  }
}

function graphOf(rows = tasks()): TaskGraph {
  return { nodes: [node(rows.parent), node(rows.child), node(rows.blocker)], truncated: false }
}

function open(options: { graph?: TaskGraph; tasks?: TaskRecord[] } = {}) {
  const rows = tasks()
  // The list row and the graph node are the same record, exactly as the Host
  // serves them: a fixture that drifts between the two would hide a real bug.
  const page = options.tasks ?? [rows.child]
  const taskGraph = vi.fn(async () => options.graph ?? graphOf(rows))
  const taskOverview = vi.fn(async () => ({
    counts: { todo: 2, in_progress: 1, approving: 1, done: 0 }, total: 4, blocked: 1, sessionIds: ['session-1'],
  }))
  const create = vi.fn(async (request: any) => ({ ...local(), ...request }))
  const update = vi.fn(async (request: any) => ({ ...rows.child, ...request, version: 2 }))
  const props: any = {
    list: vi.fn(async () => ({ items: page, total: page.length, page: 1, pageSize: 20 })),
    create, update, remove: vi.fn(async () => ({ deleted: true as const })),
    readAttachments: async () => [], listAgents: async () => [],
    workspaceSnapshot: () => workspaces, subscribeWorkspaces: () => () => {},
    sessionSnapshot: () => sessions, subscribeSessions: () => () => {},
    taskGraph, taskOverview,
    sessionExecution: (id: string) => sessions.items.find(row => row.id === id) ?? null,
    openSession: vi.fn(),
    sync: { listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }) }, t,
  }
  return { ...render(<TaskPanel {...props} />), taskGraph, taskOverview, create, update }
}

describe('task views', () => {
  it('offers the list, the topology, and the card board, and does not read the graph until one is chosen', async () => {
    const { taskGraph } = open()
    await screen.findByRole('button', { name: '编辑: 子任务' })
    expect(taskGraph).not.toHaveBeenCalled()
    const views = screen.getByRole('group', { name: zh.viewLabel })
    expect(within(views).getByRole('button', { name: zh.viewList }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(within(views).getByRole('button', { name: zh.viewCanvas }))
    await waitFor(() => expect(taskGraph).toHaveBeenCalledTimes(1))
    // The canvas draws the relation edges the graph carries.
    const canvas = await screen.findByRole('region', { name: zh.canvasTitle })
    expect(canvas.querySelectorAll('path[data-edge="parent"]')).toHaveLength(1)
    expect(canvas.querySelectorAll('path[data-edge="waitsOn"]')).toHaveLength(1)
    expect(within(canvas).getByText(zh.canvasNodeCount.replace('{count}', '3').replace('{edges}', '2'))).toBeTruthy()

    fireEvent.click(within(views).getByRole('button', { name: zh.viewBoard }))
    expect(await screen.findByRole('heading', { name: zh.overviewTitle })).toBeTruthy()
    // One graph read serves both surfaces.
    expect(taskGraph).toHaveBeenCalledTimes(1)
  })

  it('keeps the approving status in the filter row and the overview', async () => {
    open()
    await screen.findByRole('button', { name: '编辑: 子任务' })
    const filters = screen.getByRole('group', { name: zh.status })
    expect(within(filters).getByRole('button', { name: zh.approving })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zh.viewBoard }))
    // The board counts every status, the review gate included; the status tab
    // in the toolbar carries the same label without a count.
    const board = await screen.findByRole('region', { name: zh.overviewTitle })
    const approving = board.querySelector('[data-count="approving"]')
    expect(approving?.textContent).toContain('1')
    expect(approving?.textContent).toContain(zh.approving)
    expect(within(board).getByText(zh.overviewBlocked)).toBeTruthy()
  })

  it('reports a refused relationship read with a retry instead of an empty canvas', async () => {
    const graph = graphOf()
    const failing = vi.fn()
      .mockRejectedValueOnce(new Error('图读取失败'))
      .mockResolvedValue(graph)
    const { taskGraph } = open()
    taskGraph.mockImplementation(failing)
    fireEvent.click(screen.getByRole('button', { name: zh.viewCanvas }))
    expect(await screen.findByText(/图读取失败/u)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    await waitFor(() => expect(failing).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('region', { name: zh.canvasTitle })).toBeTruthy()
  })

  it('writes the parent and the dependencies the composer selects', async () => {
    const { update } = open()
    fireEvent.click(await screen.findByRole('button', { name: '编辑: 子任务' }))
    // The pickers offer the graph's other tasks.
    const parentSelect = await screen.findByLabelText(zh.parentTask)
    await waitFor(() => expect(within(parentSelect).getByRole('option', { name: '父任务' })).toBeTruthy())
    fireEvent.change(parentSelect, { target: { value: 'parent' } })
    expect((parentSelect as HTMLSelectElement).value).toBe('parent')
    const addDependency = screen.getByLabelText(zh.addDependency)
    await waitFor(() => expect(within(addDependency).queryByRole('option', { name: '前置任务' })).toBeTruthy())
    fireEvent.change(addDependency, { target: { value: 'blocker' } })
    // The chip's own remove action proves the dependency was selected.
    expect(screen.getByRole('button', { name: `${zh.removeDependency}: 前置任务` })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh.save }))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0]![0]).toMatchObject({ id: 'child', parentId: 'parent', blockingIds: ['blocker'] })
  })

  it('shows the linked session and its bot on the board', async () => {
    open()
    await screen.findByRole('button', { name: '编辑: 子任务' })
    fireEvent.click(screen.getByRole('button', { name: zh.viewBoard }))
    expect(await screen.findByText('处理会话')).toBeTruthy()
    expect(screen.getAllByText(zh.executionRunning).length).toBeGreaterThan(0)
  })
})

describe('write results on the list page', () => {
  it('reports a landed write in the floating banner instead of a band above the list', async () => {
    const { update } = open()
    fireEvent.click(await screen.findByRole('button', { name: '编辑: 子任务' }))
    fireEvent.change(await screen.findByLabelText(zh.storyPoints), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: zh.save }))
    await waitFor(() => expect(update).toHaveBeenCalled())
    const banner = await screen.findByRole('alert')
    expect(banner.textContent).toBe(zh.saved)
    // The host Toast portals to the body: the outcome is not a line the list can
    // scroll away, and the composer's own footer copy is gone with the dialog.
    expect(banner.parentElement).toBe(document.body)
    expect(screen.queryByText(zh.saveFailed)).toBeNull()
  })

  it('reports a refused write in the banner and keeps the retry inside it', async () => {
    const { update } = open()
    update.mockRejectedValueOnce(new Error('写入被拒测试'))
    fireEvent.click(await screen.findByRole('button', { name: '编辑: 子任务' }))
    fireEvent.change(await screen.findByLabelText(zh.storyPoints), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: zh.save }))
    // A failed write leaves the composer open on the reason it already shows in
    // its own body, so this one copy is not announced twice.
    expect((await screen.findByText(/写入被拒测试/u)).closest('[role="alert"]')).toBeTruthy()
    // Closing it hands the same outcome to the banner, which is where the reason
    // and its retry survive the dialog that produced them.
    fireEvent.click(screen.getByRole('button', { name: zh.cancel }))
    const banner = await screen.findByRole('alert')
    expect(banner.textContent).toContain('写入被拒测试')
    expect(within(banner).getByRole('button', { name: zh.retry })).toBeTruthy()
  })
})
