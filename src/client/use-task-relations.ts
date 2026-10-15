import { useCallback, useRef, useState } from 'react'
import { MAX_GRAPH_NODES, type TaskGraph, type TaskOverview, type TaskRecord } from '../types.ts'

/** One task row the relation pickers may offer. */
export interface RelationOption { id: string; title: string }

/** Relationship data the panel needs for the canvas, the board, and the composer. */
export interface TaskRelationState {
  graph: TaskGraph | null
  overview: TaskOverview | null
  loading: boolean
  error: string
  /** Read the whole graph once per mounted panel; later calls refresh it only when `force` is set. */
  load(force?: boolean): Promise<void>
  /** Options for one task's pickers: every task except itself and its descendants. */
  optionsFor(taskId: string | undefined): RelationOption[]
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Load the relationship graph and the status overview behind one hook.
 *
 * The panel keeps this data for the whole mount: the canvas, the board, and the
 * composer read the same snapshot, and a plain refresh reuses it so the canvas
 * does not redraw while the user is panning. `load(true)` is the explicit
 * reload after a write.
 */
export function useTaskRelations(
  fetchGraph: () => Promise<TaskGraph>,
  fetchOverview: () => Promise<TaskOverview>,
): TaskRelationState {
  const [graph, setGraph] = useState<TaskGraph | null>(null)
  const [overview, setOverview] = useState<TaskOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef<Promise<void> | null>(null)
  const loaded = useRef(false)

  const load = useCallback(async (force = false): Promise<void> => {
    if (!force && loaded.current) return
    if (inFlight.current !== null) return inFlight.current
    setLoading(true)
    const run = (async () => {
      try {
        const [nextGraph, nextOverview] = await Promise.all([fetchGraph(), fetchOverview()])
        loaded.current = true
        setGraph(nextGraph)
        setOverview(nextOverview)
        setError('')
      } catch (failure) {
        setError(messageOf(failure))
      } finally {
        setLoading(false)
        inFlight.current = null
      }
    })()
    inFlight.current = run
    return run
  }, [fetchGraph, fetchOverview])

  /**
   * Options for one task's pickers. The edited task and every task below it in
   * the parent chain are removed, because either would close a hierarchy cycle;
   * the Host still refuses anything this filter misses.
   */
  const optionsFor = useCallback((taskId: string | undefined): RelationOption[] => {
    if (graph === null) return []
    const childrenOf = new Map<string, string[]>()
    for (const node of graph.nodes) {
      for (const parent of node.parents) {
        const list = childrenOf.get(parent)
        if (list) list.push(node.task.id)
        else childrenOf.set(parent, [node.task.id])
      }
    }
    const excluded = new Set<string>()
    if (taskId !== undefined) {
      excluded.add(taskId)
      const queue = [...childrenOf.get(taskId) ?? []]
      while (queue.length > 0) {
        const id = queue.pop()!
        if (excluded.has(id)) continue
        excluded.add(id)
        queue.push(...childrenOf.get(id) ?? [])
      }
    }
    return graph.nodes
      .filter(node => !excluded.has(node.task.id))
      .map(node => ({ id: node.task.id, title: node.task.title }))
      .sort((left, right) => left.title.localeCompare(right.title))
  }, [graph])

  return { graph, overview, loading, error, load, optionsFor }
}

/** The node cap one panel asks for; the Host clamps anything larger. */
export const GRAPH_NODE_LIMIT = MAX_GRAPH_NODES

/** Title of one task in the loaded graph, for relation chips. */
export function graphTitle(graph: TaskGraph | null, taskId: string): string | null {
  return graph?.nodes.find(node => node.task.id === taskId)?.task.title ?? null
}

/** The task behind one canvas or board card. */
export function graphTask(graph: TaskGraph, taskId: string): TaskRecord | null {
  return graph.nodes.find(node => node.task.id === taskId)?.task ?? null
}
