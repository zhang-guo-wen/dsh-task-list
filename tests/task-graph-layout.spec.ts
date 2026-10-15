import { describe, expect, it } from 'vitest'
import { textContent } from '../src/content.ts'
import type { TaskGraph, TaskGraphNode, TaskRecord, TaskStatus } from '../src/types.ts'
import {
  CANVAS_PADDING, COLUMN_GAP, NODE_HEIGHT, NODE_WIDTH, SIBLING_GAP,
  layoutTaskGraph, taskLayoutAnchor,
} from '../src/client/task-graph-layout.ts'

/** A placed node, positioned by its parent chain. */
function node(id: string, parents: string[] = [], waitsOn: string[] = []): TaskGraphNode {
  return {
    task: {
      id,
      title: id,
      content: textContent(id),
      notes: id,
      status: 'todo' as TaskStatus,
      priority: 'medium',
      storyPoints: null,
      tags: [],
      workspaceId: null,
      sendImmediately: false,
      sessionId: null,
      agent: null,
      useWorktree: false,
      startedAt: null,
      completedAt: null,
      parentId: parents[0] ?? null,
      blockingIds: waitsOn,
      version: 1,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      subtasks: [],
    },
    parents,
    children: [],
    waitsOn,
    waitedOnBy: [],
    blocked: false,
  }
}

/** A graph whose nodes carry their declared edges, in the order they are listed. */
function graph(...nodes: TaskGraphNode[]): TaskGraph {
  return { nodes, truncated: false }
}

/** The record behind a node, for assertions about the payload the canvas renders. */
function record(id: string, parents: string[] = []): TaskRecord {
  return node(id, parents).task
}

function at(layout: ReturnType<typeof layoutTaskGraph>, id: string) {
  const found = layout.nodes.find(candidate => candidate.id === id)
  if (found === undefined) throw new Error(`node ${id} was not placed`)
  return found
}

/** Horizontal or vertical distance between two anchors of the same edge. */
function gap(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y)
}

describe('task graph layout', () => {
  it('lays a parent chain out in columns, roots on the left', () => {
    const layout = layoutTaskGraph(graph(node('c', ['b']), node('b', ['a']), node('a')))
    expect(layout.nodes).toHaveLength(3)
    expect([at(layout, 'a').level, at(layout, 'b').level, at(layout, 'c').level]).toEqual([0, 1, 2])
    expect(at(layout, 'a').x).toBe(CANVAS_PADDING)
    expect(at(layout, 'b').x - at(layout, 'a').x).toBe(NODE_WIDTH + COLUMN_GAP)
    expect(at(layout, 'c').x - at(layout, 'b').x).toBe(NODE_WIDTH + COLUMN_GAP)
    // One card per column, so every column starts on the shared top line.
    expect(new Set(layout.nodes.map(placed => placed.y)).size).toBe(1)
    expect(at(layout, 'a').y).toBe(CANVAS_PADDING)
  })

  it('keeps a whole level off the canvas edge and inside the footprint', () => {
    const layout = layoutTaskGraph(graph(node('r'), node('a', ['r']), node('b', ['r']), node('c', ['r'])))
    const bottom = Math.max(...layout.nodes.map(placed => placed.y + NODE_HEIGHT))
    expect(at(layout, 'a').y).toBe(CANVAS_PADDING)
    expect(at(layout, 'a').y).toBe(at(layout, 'b').y - (NODE_HEIGHT + SIBLING_GAP))
    expect(at(layout, 'c').y).toBe(at(layout, 'b').y + NODE_HEIGHT + SIBLING_GAP)
    expect(at(layout, 'r').y).toBe(at(layout, 'a').y)
    expect(layout.height).toBe(bottom + CANVAS_PADDING)
    expect(layout.width).toBe(CANVAS_PADDING + NODE_WIDTH + COLUMN_GAP + NODE_WIDTH + CANVAS_PADDING)
    expect(new Set(layout.nodes.map(placed => placed.x)).size).toBe(2)
  })

  it('places every card inside the returned width and height', () => {
    const layout = layoutTaskGraph(graph(
      node('a'), node('b', ['a']), node('c', ['a']), node('d', ['b']), node('e', ['b']), node('f', ['c']),
    ))
    expect(layout.nodes).toHaveLength(6)
    for (const placed of layout.nodes) {
      expect(placed.x).toBeGreaterThanOrEqual(0)
      expect(placed.y).toBeGreaterThanOrEqual(0)
      expect(placed.x + placed.width).toBeLessThanOrEqual(layout.width)
      expect(placed.y + placed.height).toBeLessThanOrEqual(layout.height)
    }
  })

  it('never overlaps two cards of the same column', () => {
    const layout = layoutTaskGraph(graph(node('r'), node('a', ['r']), node('b', ['r']), node('c', ['r']), node('d', ['r'])))
    const column = layout.nodes.filter(placed => placed.x === at(layout, 'a').x).sort((left, right) => left.y - right.y)
    expect(column).toHaveLength(4)
    for (let index = 1; index < column.length; index += 1) {
      expect(column[index]!.y - (column[index - 1]!.y + NODE_HEIGHT)).toBeGreaterThanOrEqual(SIBLING_GAP)
    }
    expect(layout.nodes.filter(placed => placed.x === at(layout, 'r').x)).toHaveLength(1)
  })

  it('keeps the children of one parent adjacent in their column', () => {
    // Two roots each with two children; the child ids are interleaved so a naive
    // id sort would separate them.
    const layout = layoutTaskGraph(graph(
      node('p'), node('q'),
      node('a1', ['p']), node('a2', ['p']),
      node('b1', ['q']), node('b2', ['q']),
    ))
    const orders = ['a1', 'a2', 'b1', 'b2'].map(id => at(layout, id).order)
    expect(orders.slice().sort((left, right) => left - right)).toEqual([0, 1, 2, 3])
    expect(Math.abs(at(layout, 'a1').order - at(layout, 'a2').order)).toBe(1)
    expect(Math.abs(at(layout, 'b1').order - at(layout, 'b2').order)).toBe(1)
    expect(new Set(orders).size).toBe(4)
  })

  it('returns one edge per relationship, waiting edges pointing at the waited-on task', () => {
    const layout = layoutTaskGraph(graph(node('a'), node('b', ['a'], ['a'])))
    expect(layout.edges).toEqual([
      { id: 'parent:a->b', kind: 'parent', from: 'a', to: 'b' },
      { id: 'waitsOn:b->a', kind: 'waitsOn', from: 'b', to: 'a' },
    ])
  })

  it('is deterministic and does not depend on the order the graph lists its nodes', () => {
    const forward = layoutTaskGraph(graph(node('a'), node('b', ['a']), node('c', ['a']), node('d', ['b'])))
    const backward = layoutTaskGraph(graph(node('d', ['b']), node('c', ['a']), node('b', ['a']), node('a')))
    expect(forward).toEqual(backward)
    expect(layoutTaskGraph(graph(node('a'), node('b', ['a'])))).toEqual(layoutTaskGraph(graph(node('b', ['a']), node('a'))))
  })

  it('returns an empty layout for an empty graph', () => {
    expect(layoutTaskGraph({ nodes: [], truncated: false })).toEqual({
      nodes: [], edges: [], width: 0, height: 0, dropped: 0, danglingParents: 0,
    })
  })

  it('treats a parent that the graph does not carry as a root and counts it', () => {
    const layout = layoutTaskGraph(graph(node('a'), node('b', ['missing'])))
    expect(at(layout, 'b').level).toBe(0)
    expect(layout.danglingParents).toBe(1)
    expect(layout.edges).toEqual([])
  })

  it('terminates on a cyclic parent chain instead of hanging', () => {
    // The store refuses cycles; the layout must stay finite even if one arrives.
    const layout = layoutTaskGraph(graph(node('a', ['b']), node('b', ['a'])))
    expect(layout.nodes).toHaveLength(2)
    expect(layout.nodes.every(placed => Number.isFinite(placed.x) && Number.isFinite(placed.y))).toBe(true)
  })

  it('anchors a tree edge on the right of the parent and the left of the child', () => {
    const layout = layoutTaskGraph(graph(node('a'), node('b', ['a'])))
    const parent = taskLayoutAnchor(layout, 'a', 'b')
    const child = taskLayoutAnchor(layout, 'b', 'a')
    expect(parent).toEqual({ x: at(layout, 'a').x + NODE_WIDTH, y: at(layout, 'a').y + NODE_HEIGHT / 2, side: 'right' })
    expect(child).toEqual({ x: at(layout, 'b').x, y: at(layout, 'b').y + NODE_HEIGHT / 2, side: 'left' })
    expect(taskLayoutAnchor(layout, 'missing', 'a')).toBeNull()
  })

  it('leaves a stacked card on the side away from its partner', () => {
    // The layout never stacks two related cards itself, so the stacked case is
    // pinned on a hand-built layout: the lower card leaves and is entered on its
    // right, away from the card above it.
    const stacked: ReturnType<typeof layoutTaskGraph> = {
      nodes: [
        { id: 'a', x: 24, y: 24, width: NODE_WIDTH, height: NODE_HEIGHT, level: 0, order: 0 },
        { id: 'b', x: 24, y: 24 + NODE_HEIGHT + SIBLING_GAP, width: NODE_WIDTH, height: NODE_HEIGHT, level: 0, order: 1 },
      ],
      edges: [], width: 0, height: 0, dropped: 0, danglingParents: 0,
    }
    const parent = taskLayoutAnchor(stacked, 'a', 'b')
    const child = taskLayoutAnchor(stacked, 'b', 'a')
    expect(parent).toEqual({ x: 24 + NODE_WIDTH, y: 24 + NODE_HEIGHT / 2, side: 'right' })
    expect(child).toEqual({ x: 24 + NODE_WIDTH, y: 24 + NODE_HEIGHT + SIBLING_GAP + NODE_HEIGHT / 2, side: 'right' })
    expect(gap(parent, child)).toBeGreaterThan(0)
  })

  it('draws a wait edge from the waiter to the task it waits on', () => {
    // `b` waits on `a`, and both are roots in one column: the edge has to leave
    // `b`, point at `a`, and meet each card on the edge that faces the other.
    const layout = layoutTaskGraph(graph(node('a'), node('b', [], ['a'])))
    expect(layout.edges).toEqual([{ id: 'waitsOn:b->a', kind: 'waitsOn', from: 'b', to: 'a' }])
    const from = taskLayoutAnchor(layout, 'b', 'a')
    const to = taskLayoutAnchor(layout, 'a', 'b')
    expect(from).not.toBeNull()
    expect(to).not.toBeNull()
    const b = at(layout, 'b')
    const a = at(layout, 'a')
    expect([b.x, b.x + NODE_WIDTH]).toContain(from!.x)
    expect(from!.y).toBe(b.y + NODE_HEIGHT / 2)
    expect([a.x, a.x + NODE_WIDTH]).toContain(to!.x)
    expect(to!.y).toBe(a.y + NODE_HEIGHT / 2)
    expect(gap(from!, to!)).toBeGreaterThan(0)
  })

  it('places the records it is given without inventing ids', () => {
    const layout = layoutTaskGraph(graph(node('a'), node('b', ['a'])))
    const ids: string[] = layout.nodes.map(placed => placed.id)
    expect(ids.slice().sort()).toEqual(['a', 'b'])
    expect(layout.nodes.every(placed => placed.width === NODE_WIDTH)).toBe(true)
    expect(layout.nodes.every(placed => placed.height === NODE_HEIGHT)).toBe(true)
    expect(record('a')).toMatchObject({ id: 'a', parentId: null, blockingIds: [] })
    expect(record('b', ['a'])).toMatchObject({ id: 'b', parentId: 'a' })
  })
})
