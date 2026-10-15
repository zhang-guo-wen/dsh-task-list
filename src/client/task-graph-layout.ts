import type { TaskGraph, TaskGraphNode } from '../types.ts'

/**
 * Pure layered layout for the relationship canvas: no DOM, no measuring, no
 * randomness. The canvas feeds it a `TaskGraph` and paints the result, and the
 * unit tests pin the geometry without rendering anything.
 *
 * The tree is laid out the way a decomposition tree reads: parents on the left,
 * children to their right, one column per depth of the parent chain. Children of
 * the same parent are kept adjacent inside their column so a parent's rows read
 * as one block, and every column is centred on the canvas' horizontal axis.
 */

/** Width of one task card. */
export const NODE_WIDTH = 236
/** Height of one task card. */
export const NODE_HEIGHT = 118
/** Horizontal gap between two columns. */
export const COLUMN_GAP = 72
/** Vertical gap between two cards of the same column. */
export const SIBLING_GAP = 28
/** Breathing room kept around the drawing. */
export const CANVAS_PADDING = 24

/** One placed card; `x`/`y` are its top-left corner in canvas coordinates. */
export interface TaskLayoutNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Depth of the parent chain; roots sit in column 0. */
  level: number
  /** Index of the card inside its column, top to bottom. */
  order: number
}

/** One drawn relationship. `kind` picks the stroke: solid tree edge, dashed wait edge. */
export interface TaskLayoutEdge {
  id: string
  kind: 'parent' | 'waitsOn'
  /** `from` is the parent (tree) or the waiting task (dependency). */
  from: string
  to: string
}

export interface TaskGraphLayout {
  nodes: TaskLayoutNode[]
  edges: TaskLayoutEdge[]
  /** Extent of the drawing, including `CANVAS_PADDING` on every side. */
  width: number
  height: number
  /** Nodes that could not be placed because `maxNodes` cut them off. */
  dropped: number
  /** Parent references that point at a node the graph does not carry; those cards are treated as roots. */
  danglingParents: number
}

/** One graph node with its depth relaxed to the longest parent chain that reaches it. */
interface DepthNode {
  id: string
  depth: number
  /** Original index in the graph; keeps the output stable and root order meaningful. */
  index: number
}

/**
 * The stored parent of one node.
 *
 * The task record's own `parentId` is the source of truth and needs no graph
 * projection to be present, so the column of a card never depends on which edge
 * lists a caller filled in. `parents` stays the edge list the canvas draws.
 */
function parentOf(node: TaskGraphNode): string | null {
  return node.task.parentId
}

/**
 * Depth of every node in its parent chain, roots at 0.
 *
 * A node whose parent is missing is a root. A cyclic parent chain cannot loop
 * forever: the longest-chain relaxation below terminates, so the cards still get
 * a column instead of hanging the canvas.
 */
function resolveDepths(graph: TaskGraph): DepthNode[] {
  const nodes = [...graph.nodes].sort((left, right) => left.task.id.localeCompare(right.task.id))
  const index = new Map<string, number>()
  const depths = new Array<number>(nodes.length).fill(0)
  nodes.forEach((node, position) => index.set(node.task.id, position))
  const edges: [number, number][] = []
  for (const [child, node] of nodes.entries()) {
    const parentId = parentOf(node)
    if (parentId === null) continue
    const parent = index.get(parentId)
    if (parent !== undefined) edges.push([parent, child])
  }
  // Relaxing every edge once per node is enough for the longest chain: a chain
  // can use at most one edge per node, so no node can deepen after N passes.
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false
    for (const [parent, child] of edges) {
      const candidate = depths[parent]! + 1
      if (depths[child]! < candidate) {
        depths[child] = candidate
        changed = true
      }
    }
    if (!changed) break
  }
  return nodes.map((node, position) => ({ id: node.task.id, depth: depths[position]!, index: position }))
}

/**
 * Order one column so children of the same parent stay adjacent.
 *
 * The blocks are sorted by where their parent sits in the previous column, which
 * keeps a subtree visually together, and a block's own rows keep the stable
 * (id-sorted) order of the graph.
 */
function orderLevel(level: DepthNode[], parentOf: Map<string, string>, previous: DepthNode[]): DepthNode[] {
  const rank = new Map<string, number>()
  previous.forEach((node, position) => rank.set(node.id, position))
  const blocks: { key: string; rank: number; rows: DepthNode[] }[] = []
  const open = new Map<string, (typeof blocks)[number]>()
  for (const node of level) {
    const parent = parentOf.get(node.id)
    if (parent === undefined) {
      blocks.push({ key: `#${node.id}`, rank: Number.POSITIVE_INFINITY, rows: [node] })
      continue
    }
    const block = open.get(parent)
    if (block !== undefined) {
      block.rows.push(node)
      continue
    }
    const created = { key: parent, rank: rank.get(parent) ?? Number.POSITIVE_INFINITY, rows: [node] }
    open.set(parent, created)
    blocks.push(created)
  }
  // Stable: equal keys keep the order they were discovered in, so parentless
  // roots stay in their own (id-sorted) order and do not jump between renders.
  blocks.sort((left, right) => left.rank - right.rank)
  return blocks.flatMap(block => block.rows)
}

/** Place one `TaskGraph` on the canvas; the same graph always yields the same layout. */
export function layoutTaskGraph(graph: TaskGraph): TaskGraphLayout {
  if (graph.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0, dropped: 0, danglingParents: 0 }
  }
  const depthNodes = resolveDepths(graph)
  const ids = new Set(graph.nodes.map(node => node.task.id))
  const blockParent = new Map<string, string>()
  let danglingParents = 0
  for (const node of graph.nodes) {
    for (const parent of node.parents) {
      // The store only returns edges between nodes it carries, so a missing
      // parent means a cut-off scope: the child is drawn as a root instead.
      if (ids.has(parent)) {
        if (!blockParent.has(node.task.id)) blockParent.set(node.task.id, parent)
      } else {
        danglingParents += 1
      }
    }
  }

  const levels = new Map<number, DepthNode[]>()
  for (const node of depthNodes) {
    const level = levels.get(node.depth)
    if (level === undefined) levels.set(node.depth, [node])
    else level.push(node)
  }
  const ordered = [...levels.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([depth, level]) => ({ depth, rows: depth === 0 ? level : orderLevel(level, blockParent, levels.get(depth - 1) ?? []) }))

  const placed = new Map<string, TaskLayoutNode>()
  for (const { depth, rows } of ordered) {
    rows.forEach((row, order) => {
      placed.set(row.id, {
        id: row.id,
        x: CANVAS_PADDING + depth * (NODE_WIDTH + COLUMN_GAP),
        y: 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        level: depth,
        order,
      })
    })
  }

  // Each column is centred on its children's span, so a parent lines up with the
  // middle of the subtree it owns instead of sharing every column's top line; a
  // level with no children above it keeps the plain top line. Shifting the whole
  // column preserves the gaps inside it.
  const centers = new Map<number, number>()
  for (const { depth, rows } of ordered.slice(1)) {
    const positions: number[] = []
    rows.forEach((row, order) => {
      const parent = blockParent.get(row.id)
      if (parent === undefined) return
      const parentRow = ordered[depth - 1]?.rows.findIndex(candidate => candidate.id === parent) ?? -1
      if (parentRow >= 0) positions.push(parentRow * (NODE_HEIGHT + SIBLING_GAP) + NODE_HEIGHT / 2)
      else positions.push(order * (NODE_HEIGHT + SIBLING_GAP) + NODE_HEIGHT / 2)
    })
    if (positions.length === 0) continue
    const lowest = Math.min(...positions)
    const highest = Math.max(...positions)
    centers.set(depth, (lowest + highest) / 2)
  }

  for (const { depth, rows } of ordered) {
    const height = rows.length * NODE_HEIGHT + Math.max(0, rows.length - 1) * SIBLING_GAP
    const center = centers.get(depth)
    let y = center === undefined ? CANVAS_PADDING : Math.max(CANVAS_PADDING, center - height / 2)
    for (const row of rows) {
      const node = placed.get(row.id)
      if (node !== undefined) node.y = y
      y += NODE_HEIGHT + SIBLING_GAP
    }
  }

  const nodes = depthNodes.map(row => placed.get(row.id)).filter((node): node is TaskLayoutNode => node !== undefined)
  const visible = new Set(nodes.map(node => node.id))
  const edges: TaskLayoutEdge[] = []
  for (const node of graph.nodes) {
    if (!visible.has(node.task.id)) continue
    for (const parent of node.parents) {
      if (visible.has(parent)) edges.push({ id: `parent:${parent}->${node.task.id}`, kind: 'parent', from: parent, to: node.task.id })
    }
    for (const target of node.waitsOn) {
      if (visible.has(target)) edges.push({ id: `waitsOn:${node.task.id}->${target}`, kind: 'waitsOn', from: node.task.id, to: target })
    }
  }
  // The same graph must always produce the same layout, whichever order its
  // nodes and edges arrive in: the drawing order is sorted, not inherited.
  edges.sort((left, right) => left.kind === right.kind ? left.id.localeCompare(right.id) : left.kind === 'parent' ? -1 : 1)

  const right = nodes.reduce((extent, node) => Math.max(extent, node.x + node.width), 0)
  const bottom = nodes.reduce((extent, node) => Math.max(extent, node.y + node.height), 0)
  return {
    nodes,
    edges,
    width: right + CANVAS_PADDING,
    height: bottom + CANVAS_PADDING,
    dropped: graph.nodes.length - nodes.length,
    danglingParents,
  }
}

/** Where one edge meets a card: `side` is 'right' when the edge leaves to the right. */
export interface TaskLayoutAnchor {
  x: number
  y: number
  side: 'left' | 'right'
}

/**
 * The point one edge should touch on `id`, or null when the node is not placed.
 *
 * A card is entered on the edge that faces its partner, so the edge crosses the
 * space between the two cards instead of running over them. When the partner sits
 * in the same column, the two are stacked rather than side by side: both anchors
 * then sit on the right, where the edge's own curve leaves and re-enters outside
 * the cards, instead of on facing sides that would cut through both. Two edges of
 * one pair stay symmetric because the anchor depends only on the two positions.
 */
export function taskLayoutAnchor(layout: TaskGraphLayout, id: string, toward: string): TaskLayoutAnchor | null {
  const node = layout.nodes.find(candidate => candidate.id === id)
  if (node === undefined) return null
  const other = layout.nodes.find(candidate => candidate.id === toward)
  const anchor = (side: 'left' | 'right'): TaskLayoutAnchor =>
    ({ x: side === 'right' ? node.x + node.width : node.x, y: node.y + node.height / 2, side })
  if (other === undefined || other.x >= node.x) return anchor('right')
  return anchor('left')
}
