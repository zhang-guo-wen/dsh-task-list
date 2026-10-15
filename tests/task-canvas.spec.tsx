// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { textContent } from '../src/content.ts'
import type { TaskGraph, TaskGraphNode, TaskRecord, TaskStatus } from '../src/types.ts'
import { TaskCanvas } from '../src/client/TaskCanvas.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]

interface Spec {
  id: string
  status?: TaskStatus
  priority?: TaskRecord['priority']
  parents?: string[]
  waitsOn?: string[]
  children?: string[]
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
    priority: spec.priority ?? 'medium',
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

function surface(): HTMLElement {
  return screen.getByTestId('task-canvas-surface')
}

function viewport(): HTMLElement {
  return screen.getByTestId('task-canvas-viewport')
}

function zoomOf(): number {
  return Number(surface().dataset.zoom)
}

describe('task canvas', () => {
  it('renders one card per node with its status, priority, workspace and tree place', () => {
    const graph = makeGraph(
      { id: 'a', status: 'in_progress', priority: 'high', children: ['b'] },
      { id: 'b', status: 'approving', parents: ['a'] },
      { id: 'c', status: 'done' },
      { id: 'd' },
    )
    const { container } = render(<TaskCanvas graph={graph} t={t} onOpen={() => {}} />)
    const cards = container.querySelectorAll('[data-node-id]')
    expect(cards).toHaveLength(4)
    expect(within(cards[0] as HTMLElement).getByText(zh.inProgress)).toBeTruthy()
    expect(within(cards[0] as HTMLElement).getByText(zh.high)).toBeTruthy()
    expect(within(cards[0] as HTMLElement).getByText('ws-1')).toBeTruthy()
    expect(within(cards[1] as HTMLElement).getByText(zh.approving)).toBeTruthy()
    expect(within(cards[2] as HTMLElement).getByText(zh.done)).toBeTruthy()
    expect(within(cards[3] as HTMLElement).getByText(zh.todo)).toBeTruthy()
    // Position comes from the layout, not from the DOM.
    expect((cards[0] as HTMLElement).style.left).toBe('24px')
    expect((cards[1] as HTMLElement).style.left).not.toBe('24px')
  })

  it('marks a blocked node visibly and leaves an unblocked one alone', () => {
    const { container } = render(<TaskCanvas graph={makeGraph({ id: 'a', blocked: true }, { id: 'b' })} t={t} onOpen={() => {}} />)
    const blocked = container.querySelector('[data-node-id="a"]') as HTMLElement
    const free = container.querySelector('[data-node-id="b"]') as HTMLElement
    expect(blocked.dataset.blocked).toBe('true')
    expect(free.dataset.blocked).toBe('false')
    expect(within(blocked).getByText(zh.blockedLabel)).toBeTruthy()
    expect(within(free).queryByText(zh.blockedLabel)).toBeNull()
  })

  it('draws parent edges solid and wait edges dashed with an arrow', () => {
    const graph = makeGraph(
      { id: 'a', children: ['b'] },
      { id: 'b', parents: ['a'], waitsOn: ['c'], blocked: true },
      { id: 'c' },
    )
    const { container } = render(<TaskCanvas graph={graph} t={t} onOpen={() => {}} />)
    const parent = container.querySelector('[data-edge="parent"]') as SVGPathElement
    const wait = container.querySelector('[data-edge="waitsOn"]') as SVGPathElement
    expect(parent.dataset.from).toBe('a')
    expect(parent.dataset.to).toBe('b')
    // The waiting task is the edge's source, the waited-on task its target.
    expect(wait.dataset.from).toBe('b')
    expect(wait.dataset.to).toBe('c')
    expect(wait.getAttribute('marker-end')).toContain('arrow-waits')
    expect(parent.getAttribute('marker-end')).toContain('arrow-parent')
    expect(parent.getAttribute('class')).not.toBe(wait.getAttribute('class'))
  })

  it('opens the task from the card title and the session from the badge', () => {
    const onOpen = vi.fn()
    const onOpenSession = vi.fn()
    const graph = makeGraph({ id: 'a', title: 'Ship it', sessionId: 'session-1', agent: 'reviewer' })
    render(<TaskCanvas graph={graph} t={t} onOpen={onOpen} onOpenSession={onOpenSession}
      executionOf={() => ({ title: 'Nightly run', agent: 'reviewer', running: true, archived: false })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ship it' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen.mock.calls[0]![0]).toMatchObject({ id: 'a' })
    const badge = screen.getByRole('button', { name: 'Nightly run' })
    expect(badge.getAttribute('title')).toContain(zh.executionRunning)
    fireEvent.click(badge)
    expect(onOpenSession).toHaveBeenCalledWith('session-1')
    // The robot preset is shown on the card, with its id in the tooltip.
    expect(document.querySelector('[data-agent="reviewer"]')?.getAttribute('title')).toContain('reviewer')
  })

  it('shows the agent stored on the task when the session lookup has no info', () => {
    const { container } = render(<TaskCanvas graph={makeGraph({ id: 'a', sessionId: 's', agent: 'tester' })} t={t} onOpen={() => {}} />)
    expect(container.querySelector('[data-agent="tester"]')).not.toBeNull()
  })

  it('states an unavailable or missing session instead of inventing one', () => {
    const graph = makeGraph({ id: 'a', sessionId: 'gone' }, { id: 'b' })
    const { container } = render(<TaskCanvas graph={graph} t={t} onOpen={() => {}} />)
    expect(within(container.querySelector('[data-node-id="a"]') as HTMLElement).getByText(zh.sessionUnavailable)).toBeTruthy()
    expect(within(container.querySelector('[data-node-id="b"]') as HTMLElement).getByText(zh.executionNone)).toBeTruthy()
  })

  it('keeps zoom inside 0.4 and 2 through the buttons and the wheel', () => {
    render(<TaskCanvas graph={makeGraph({ id: 'a' })} t={t} onOpen={() => {}} />)
    const zoomOut = screen.getByRole('button', { name: zh.canvasZoomOut })
    const zoomIn = screen.getByRole('button', { name: zh.canvasZoomIn })
    for (let step = 0; step < 12; step += 1) fireEvent.click(zoomOut)
    expect(zoomOf()).toBe(0.4)
    for (let step = 0; step < 20; step += 1) fireEvent.click(zoomIn)
    expect(zoomOf()).toBe(2)
    fireEvent.wheel(viewport(), { deltaY: -100 })
    expect(zoomOf()).toBe(2)
    fireEvent.wheel(viewport(), { deltaY: 100 })
    expect(zoomOf()).toBeLessThan(2)
    for (let step = 0; step < 20; step += 1) fireEvent.wheel(viewport(), { deltaY: 100 })
    expect(zoomOf()).toBe(0.4)
  })

  it('resets the view to the default scale and origin', () => {
    render(<TaskCanvas graph={makeGraph({ id: 'a' })} t={t} onOpen={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: zh.canvasZoomIn }))
    fireEvent.wheel(viewport(), { deltaY: -100 })
    expect(zoomOf()).not.toBe(1)
    fireEvent.click(screen.getByRole('button', { name: zh.canvasReset }))
    expect(zoomOf()).toBe(1)
    expect(surface().style.transform).toContain('translate(0px, 0px)')
  })

  it('pans with a pointer drag and with the arrow keys', async () => {
    render(<TaskCanvas graph={makeGraph({ id: 'a' })} t={t} onOpen={() => {}} />)
    const box = viewport()
    const user = userEvent.setup()
    // jsdom has no PointerEvent constructor, so the gesture is dispatched by
    // user-event, which synthesises a real pointer sequence.
    await user.pointer({ target: box, keys: '[MouseLeft>]', coords: { clientX: 200, clientY: 150 } })
    expect(box.dataset.dragging).toBe('true')
    await user.pointer({ target: box, coords: { clientX: 230, clientY: 180 } })
    expect(surface().style.transform).toContain('translate(30px, 30px)')
    await user.pointer({ target: box, keys: '[/MouseLeft]', coords: { clientX: 230, clientY: 180 } })
    expect(box.dataset.dragging).toBe('false')
    fireEvent.keyDown(box, { key: 'ArrowRight' })
    expect(surface().style.transform).toContain('translate(70px, 30px)')
    fireEvent.keyDown(box, { key: 'ArrowUp' })
    expect(surface().style.transform).toContain('translate(70px, -10px)')
  })

  it('does not pan when the press starts on a card control', async () => {
    const onOpen = vi.fn()
    render(<TaskCanvas graph={makeGraph({ id: 'a', title: 'Ship it' })} t={t} onOpen={onOpen} />)
    const box = viewport()
    const title = screen.getByRole('button', { name: 'Ship it' })
    // user-event refuses a pointer press on an element the stylesheet would make
    // clickable, and jsdom has no stylesheet: the press is dispatched directly.
    fireEvent.pointerDown(title, { button: 0, pointerId: 2, clientX: 100, clientY: 100 })
    expect(box.dataset.dragging).toBe('false')
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 160, clientY: 160 })
    expect(surface().style.transform).toContain('translate(0px, 0px)')
    fireEvent.pointerUp(box, { pointerId: 2, clientX: 160, clientY: 160 })
    fireEvent.click(title)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('frames the drawing and its real bounds when fitting', () => {
    render(<TaskCanvas graph={makeGraph({ id: 'a' }, { id: 'b', parents: ['a'] })} t={t} onOpen={() => {}} />)
    const box = viewport()
    // jsdom measures nothing, so the test states the box the fit has to read.
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: 1000 })
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 600 })
    fireEvent.click(screen.getByRole('button', { name: zh.canvasFit }))
    const width = Number.parseFloat(surface().style.width)
    const height = Number.parseFloat(surface().style.height)
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
    expect(zoomOf()).toBeGreaterThan(0.4)
    expect(zoomOf()).toBeLessThanOrEqual(2)
    expect(surface().style.transform).not.toContain('translate(0px, 0px)')
    fireEvent.click(screen.getByRole('button', { name: zh.canvasReset }))
    expect(zoomOf()).toBe(1)
  })

  it('filters the cards and their edges by status and keeps every edge endpoint visible', () => {
    const graph = makeGraph({ id: 'a', children: ['b'] }, { id: 'b', parents: ['a'], status: 'done' })
    const { container } = render(<TaskCanvas graph={graph} t={t} onOpen={() => {}} statusFilter={['done']} />)
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(1)
    // The parent edge would dangle, so it is not drawn either.
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(0)
  })

  it('shows the empty state for an empty graph and for the empty flag', () => {
    const { unmount } = render(<TaskCanvas graph={{ nodes: [], truncated: false }} t={t} onOpen={() => {}} />)
    expect(screen.getByText(zh.canvasEmpty)).toBeTruthy()
    expect(screen.getByText(zh.canvasEmptyHint)).toBeTruthy()
    unmount()
    render(<TaskCanvas graph={makeGraph({ id: 'a' })} t={t} onOpen={() => {}} empty />)
    expect(screen.getByText(zh.canvasEmpty)).toBeTruthy()
  })

  it('reports a truncated graph and the node and edge count', () => {
    const graph: TaskGraph = { nodes: makeGraph({ id: 'a' }, { id: 'b', parents: ['a'] }).nodes, truncated: true }
    render(<TaskCanvas graph={graph} t={t} onOpen={() => {}} />)
    expect(screen.getByText(zh.canvasTruncated.replace('{count}', '2'))).toBeTruthy()
    expect(screen.getByText(zh.canvasNodeCount.replace('{count}', '2').replace('{edges}', '1'))).toBeTruthy()
  })
})
