// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { textContent } from '../src/content.ts'
import type { TaskGraph, TaskGraphNode, TaskOverview, TaskRecord, TaskStatus } from '../src/types.ts'
import { TaskBoard } from '../src/client/TaskBoard.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]

interface Spec {
  id: string
  status?: TaskStatus
  parents?: string[]
  children?: string[]
  waitsOn?: string[]
  blocked?: boolean
  sessionId?: string | null
  agent?: string | null
  workspaceId?: string | null
  title?: string
}

/** A graph node with the defaults a card needs, so each test states only what it shows. */
function makeNode(spec: Spec): TaskGraphNode {
  const task: TaskRecord = {
    id: spec.id,
    title: spec.title ?? `task ${spec.id}`,
    content: textContent(spec.title ?? spec.id),
    notes: spec.title ?? spec.id,
    status: spec.status ?? 'todo',
    priority: 'medium',
    storyPoints: null,
    tags: [],
    workspaceId: spec.workspaceId === undefined ? 'ws-1' : spec.workspaceId,
    sendImmediately: false,
    sessionId: spec.sessionId ?? null,
    agent: spec.agent ?? null,
    useWorktree: false,
    startedAt: null,
    completedAt: null,
    parentId: spec.parents?.[0] ?? null,
    blockingIds: spec.waitsOn ?? [],
    version: 1,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    subtasks: [],
  }
  return {
    task,
    parents: spec.parents ?? [],
    children: spec.children ?? [],
    waitsOn: spec.waitsOn ?? [],
    waitedOnBy: [],
    blocked: spec.blocked ?? false,
  }
}

function makeGraph(...specs: Spec[]): TaskGraph {
  return { nodes: specs.map(makeNode), truncated: false }
}

function overview(graph: TaskGraph, overrides: Partial<TaskOverview> = {}): TaskOverview {
  const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, approving: 0, done: 0 }
  for (const node of graph.nodes) counts[node.task.status] += 1
  return {
    counts,
    total: graph.nodes.length,
    blocked: graph.nodes.filter(node => node.blocked).length,
    sessionIds: [...new Set(graph.nodes.map(node => node.task.sessionId).filter((id): id is string => id !== null))],
    ...overrides,
  }
}

describe('task board', () => {
  it('counts every status plus the blocked tasks and the sessions', () => {
    const graph = makeGraph(
      { id: 'a', status: 'todo', blocked: true },
      { id: 'b', status: 'in_progress', sessionId: 's-1' },
      { id: 'c', status: 'approving', sessionId: 's-2' },
      { id: 'd', status: 'done' },
    )
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={() => {}} />)
    const counts = [...container.querySelectorAll('[data-count]')] as HTMLElement[]
    expect(counts.map(row => row.dataset.count)).toEqual(['todo', 'in_progress', 'approving', 'done'])
    expect(counts.map(row => within(row).getByText(/^\d+$/).textContent)).toEqual(['1', '1', '1', '1'])
    expect(within(container.querySelector('[data-total="total"]') as HTMLElement).getByText('4')).toBeTruthy()
    expect(within(container.querySelector('[data-total="blocked"]') as HTMLElement).getByText('1')).toBeTruthy()
    expect(within(container.querySelector('[data-total="sessions"]') as HTMLElement).getByText('2')).toBeTruthy()
    expect(container.querySelector('[data-count="approving"]')?.textContent).toContain(zh.approving)
  })

  it('groups the cards by status and shows the relations of each card', async () => {
    const onOpen = vi.fn()
    const graph = makeGraph(
      { id: 'a', title: 'Root', children: ['b'], status: 'todo' },
      { id: 'b', title: 'Child', parents: ['a'], waitsOn: ['a'], blocked: true, status: 'in_progress' },
      { id: 'c', title: 'Done one', status: 'done' },
    )
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={onOpen} />)
    expect(container.querySelectorAll('[data-group]')).toHaveLength(3)
    const inProgress = container.querySelector('[data-group="in_progress"]') as HTMLElement
    expect(within(inProgress).getByText('Child')).toBeTruthy()
    expect(within(inProgress).getByText('ws-1')).toBeTruthy()
    expect(inProgress.textContent).toContain(`${zh.parentTask} 1`)
    expect(inProgress.textContent).toContain(`${zh.dependencyPending} 1`)
    expect(within(inProgress).getByText(zh.blockedLabel)).toBeTruthy()
    const todo = container.querySelector('[data-group="todo"]') as HTMLElement
    expect(todo.textContent).toContain(`${zh.childTasks} 1`)
    // A dependency that is already done is reported as done, not pending.
    const child = container.querySelector('[data-task-id="b"]') as HTMLElement
    expect(within(child).getByText('Child').closest('button')).not.toBeNull()
    await userEvent.click(within(child).getByRole('button', { name: 'Child' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
  })

  it('reports a dependency the graph does not carry as pending', () => {
    const graph = makeGraph({ id: 'a', waitsOn: ['outside'], blocked: true })
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={() => {}} />)
    const card = container.querySelector('[data-task-id="a"]') as HTMLElement
    expect(card.textContent).toContain(`${zh.dependencyDone} 0`)
    expect(card.textContent).toContain(`${zh.dependencyPending} 1`)
  })

  it('filters the groups from the summary counts and clears the filter on a second click', async () => {
    const graph = makeGraph({ id: 'a', status: 'todo' }, { id: 'b', status: 'in_progress' }, { id: 'c', status: 'done' })
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={() => {}} />)
    const user = userEvent.setup()
    const approve = container.querySelector('[data-count="in_progress"]') as HTMLElement
    await user.click(approve)
    expect(approve.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelectorAll('[data-group]')).toHaveLength(1)
    expect(container.querySelector('[data-group="in_progress"]')).not.toBeNull()
    await user.click(approve)
    expect(approve.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelectorAll('[data-group]')).toHaveLength(3)
  })

  it('aggregates the tasks of one session with its title, robot and running badge', () => {
    const graph = makeGraph(
      { id: 'a', title: 'Alpha', status: 'in_progress', sessionId: 's-1', agent: 'reviewer' },
      { id: 'b', title: 'Beta', status: 'todo', sessionId: 's-1' },
      { id: 'c', title: 'Gamma', status: 'done', sessionId: 's-2' },
    )
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={() => {}}
      executionOf={id => id === 's-1'
        ? { title: 'Nightly run', agent: 'reviewer', running: true, archived: false }
        : { title: 'Old run', agent: null, running: false, archived: false }} />)
    const sessions = container.querySelectorAll('[data-session-id]')
    expect(sessions).toHaveLength(2)
    const first = sessions[0] as HTMLElement
    expect(first.dataset.sessionId).toBe('s-1')
    expect(first.dataset.running).toBe('true')
    expect(within(first).getByText('Nightly run')).toBeTruthy()
    expect(within(first).getByText(zh.executionRunning)).toBeTruthy()
    expect(first.textContent).toContain('Alpha')
    expect(first.textContent).toContain('Beta')
    expect(first.textContent).not.toContain('Gamma')
    const agent = first.querySelector('[data-agent="reviewer"]') as HTMLElement
    expect(agent.textContent).toBe('re')
    expect(agent.getAttribute('title')).toBe(zh.executionAgent)
    const second = sessions[1] as HTMLElement
    expect(second.dataset.running).toBe('false')
    expect(within(second).getByText(zh.executionIdle)).toBeTruthy()
    expect(within(second).getByText(zh.executionNoAgent)).toBeTruthy()
  })

  it('marks a session running from its own task status when the lookup is missing', () => {
    const graph = makeGraph({ id: 'a', status: 'in_progress', sessionId: 's-1' })
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={() => {}} />)
    expect((container.querySelector('[data-session-id="s-1"]') as HTMLElement).dataset.running).toBe('true')
  })

  it('opens the conversation from the execution row and the task from its own row', async () => {
    const onOpen = vi.fn()
    const onOpenSession = vi.fn()
    const graph = makeGraph({ id: 'a', title: 'Alpha', status: 'in_progress', sessionId: 's-1' })
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={onOpen} onOpenSession={onOpenSession}
      executionOf={() => ({ title: 'Nightly run', agent: 'reviewer', running: true, archived: false })} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: zh.openSessionAction }))
    expect(onOpenSession).toHaveBeenCalledWith('s-1')
    await user.click(within(container.querySelector('[data-session-id]') as HTMLElement)
      .getAllByRole('button', { name: 'Alpha' })
      .find(button => button.className.includes('sessionTaskTitle'))!)
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  it('states an empty board instead of drawing nothing', () => {
    const graph: TaskGraph = { nodes: [], truncated: false }
    const { container } = render(<TaskBoard graph={graph} overview={overview(graph)} t={t} onOpen={() => {}} />)
    expect(container.querySelectorAll('[data-task-id]')).toHaveLength(0)
    expect(screen.getByText(zh.canvasEmpty)).toBeTruthy()
    expect(screen.getByText(zh.executionNone)).toBeTruthy()
  })

  it('does not invent a session row for a task without a session', () => {
    const graph = makeGraph({ id: 'a' })
    const { container } = render(<TaskBoard graph={graph} overview={{ ...overview(graph), sessionIds: [] }} t={t} onOpen={() => {}} />)
    expect(container.querySelectorAll('[data-session-id]')).toHaveLength(0)
    expect(screen.getByText(zh.executionNone)).toBeTruthy()
  })
})
