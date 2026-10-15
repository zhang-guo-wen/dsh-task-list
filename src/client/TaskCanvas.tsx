import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { TaskGraph, TaskGraphNode, TaskRecord, TaskStatus } from '../types.ts'
import { TASK_STATUSES } from '../types.ts'
import type { TaskKey } from './locales.ts'
import { layoutTaskGraph, taskLayoutAnchor } from './task-graph-layout.ts'
import css from './TaskCanvas.module.css'

/** Session/robot information used for “who is working on this task”. */
export interface TaskExecutionInfo {
  title: string
  /** Agent preset id (the robot). */
  agent: string | null
  running: boolean
  archived: boolean
}

export interface TaskCanvasProps {
  graph: TaskGraph
  t: (key: TaskKey) => string
  /** Double-click a card / click its title: open that task. */
  onOpen(task: TaskRecord): void
  /** Click a session badge: open that session. */
  onOpenSession?(sessionId: string): void
  /** Session id → execution info; missing means the session is unavailable. */
  executionOf?(sessionId: string): TaskExecutionInfo | undefined
  /** Top status filter; an empty set means no filtering. */
  statusFilter?: readonly TaskStatus[]
  /** The canvas is empty (no nodes) and shows its empty state. */
  empty?: boolean
}

/** Zoom limits of the canvas. */
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2
/** Space one fit leaves around the drawing. */
const FIT_MARGIN = 24
/** Zoom one button press or wheel notch applies. */
const ZOOM_STEP = 1.2
/** Pixels one arrow key pans. */
const KEY_PAN = 40
/** Shared default for “no status filter”, so the memo below keeps its identity. */
const NO_FILTER: readonly TaskStatus[] = []

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

/** The locale key of a status label; the stored value uses an underscore, the key camel case. */
function statusKey(status: TaskStatus): TaskKey {
  if (status === 'in_progress') return 'inProgress'
  if (status === 'approving') return 'approving'
  return status
}

/** Zoom and pan of the canvas surface. */
interface ViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * A short, human-readable mark for one Agent preset id. The canvas has room for
 * an initial or two, not for a preset id, so the full value stays in the tooltip.
 */
function agentMark(agent: string): string {
  const words = agent.split(/[\s._/-]+/u).filter(Boolean)
  if (words.length === 0) return agent.slice(0, 2)
  if (words.length === 1) return words[0]!.slice(0, 2)
  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`
}

/** Where one edge starts and ends, as a cubic curve leaving and entering a card. */
function edgePath(from: { x: number; y: number; side: 'left' | 'right' }, to: { x: number; y: number; side: 'left' | 'right' }): string {
  const reach = Math.max(24, Math.abs(to.x - from.x) / 2)
  const startControl = from.side === 'right' ? from.x + reach : from.x - reach
  const endControl = to.side === 'left' ? to.x - reach : to.x + reach
  return `M ${from.x} ${from.y} C ${startControl} ${from.y}, ${endControl} ${to.y}, ${to.x} ${to.y}`
}

interface CardProps {
  node: TaskGraphNode
  x: number
  y: number
  execution: TaskExecutionInfo | undefined
  sessionId: string | null
  t: (key: TaskKey) => string
  onOpen(task: TaskRecord): void
  onOpenSession?: ((sessionId: string) => void) | undefined
}

/** One task card. The title opens the task, the session badge opens the conversation. */
function TaskCard({ node, x, y, execution, sessionId, t, onOpen, onOpenSession }: CardProps) {
  const { task } = node
  const agent = execution?.agent ?? task.agent
  const sessionTitle = sessionId === null ? t('executionNone') : execution?.title ?? t('sessionUnavailable')
  const sessionState = execution === undefined
    ? sessionId === null ? t('executionNone') : t('sessionUnavailable')
    : execution.archived ? t('sessionArchived') : execution.running ? t('executionRunning') : t('executionIdle')
  /** First letters of the parent and child titles, so the card states its place in the tree. */
  const treeSummary = `${t('parentTask')} ${node.parents.length} · ${t('childTasks')} ${node.children.length}`
  return <article
    className={css.card}
    data-node-id={task.id}
    data-status={task.status}
    data-blocked={node.blocked ? 'true' : 'false'}
    data-priority={task.priority}
    style={{ left: `${x}px`, top: `${y}px` }}
  >
    <div className={css.cardTop}>
      <span className={css.statusChip} data-status={task.status} title={t(statusKey(task.status))}>{t(statusKey(task.status))}</span>
      <span className={css.priority} data-priority={task.priority} title={t('priorityLabel')}>{t(task.priority)}</span>
      {node.blocked && <span className={css.blocked} title={t('blockedLabel')}>{t('blockedLabel')}</span>}
    </div>
    <button type="button" className={css.title} title={task.title} onClick={() => onOpen(task)}>{task.title}</button>
    <div className={css.meta}>
      <span className={css.workspace} title={task.workspaceId ?? t('noWorkspace')}>{task.workspaceId ?? t('noWorkspace')}</span>
      <span className={css.tree} title={treeSummary}>{treeSummary}</span>
    </div>
    {sessionId === null
      ? <span className={css.sessionEmpty}>{sessionTitle}</span>
      : <div className={css.sessionRow}>
        <button type="button" className={css.session} title={`${sessionTitle} · ${sessionState}`}
          onClick={() => onOpenSession?.(sessionId)} disabled={onOpenSession === undefined}>{sessionTitle}</button>
        {agent !== null && <span className={css.agentBadge} data-agent={agent} title={`${t('executionAgent')}: ${agent}`}>{agentMark(agent)}</span>}
      </div>}
  </article>
}

/**
 * The relationship canvas: an SVG edge layer under an HTML card layer, both
 * inside one transformed surface, so panning and zooming move the two together
 * without touching layout. The wheel zooms around the cursor, a pointer drag
 * pans, and the four header buttons (fit, zoom in, zoom out, reset) are native
 * buttons with keyboard access.
 */
export function TaskCanvas({ graph, t, onOpen, onOpenSession, executionOf, statusFilter, empty }: TaskCanvasProps) {
  const layout = useMemo(() => layoutTaskGraph(graph), [graph])
  const viewport = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const drag = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  // The fit button frames the drawing in the real viewport, so the box is
  // measured rather than assumed. A Host without ResizeObserver (or jsdom)
  // keeps the declared fallback and still lays out.
  useEffect(() => {
    const element = viewport.current
    if (element === null) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [graph])

  /** Zoom while keeping the point under the cursor (or the viewport middle) still. */
  const zoomAt = useCallback((pointX: number, pointY: number, factor: number) => {
    setView(current => {
      const scale = clampZoom(current.scale * factor)
      if (scale === current.scale) return current
      const ratio = scale / current.scale
      return {
        scale,
        offsetX: pointX - (pointX - current.offsetX) * ratio,
        offsetY: pointY - (pointY - current.offsetY) * ratio,
      }
    })
  }, [])

  /** Zoom around the middle of the viewport, which is where the buttons sit. */
  const zoomCenter = useCallback((factor: number) => {
    const element = viewport.current
    const width = element?.clientWidth ?? size.width
    const height = element?.clientHeight ?? size.height
    zoomAt(width / 2, height / 2, factor)
  }, [size.height, size.width, zoomAt])

  const reset = useCallback(() => setView({ scale: 1, offsetX: 0, offsetY: 0 }), [])

  const fit = useCallback(() => {
    const element = viewport.current
    const width = element?.clientWidth ?? size.width
    const height = element?.clientHeight ?? size.height
    if (width <= 0 || height <= 0 || layout.width <= 0 || layout.height <= 0) {
      reset()
      return
    }
    const scale = clampZoom(Math.min((width - FIT_MARGIN * 2) / layout.width, (height - FIT_MARGIN * 2) / layout.height))
    setView({
      scale,
      offsetX: (width - layout.width * scale) / 2,
      offsetY: (height - layout.height * scale) / 2,
    })
  }, [layout.height, layout.width, reset, size.height, size.width])

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const element = viewport.current
    if (element === null) return
    event.preventDefault()
    const bounds = element.getBoundingClientRect()
    zoomAt(event.clientX - bounds.left, event.clientY - bounds.top, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Only a primary press pans: a right-click belongs to the Host's own menu.
    if (event.button > 0) return
    // A press on a button belongs to that button: only the surface pans.
    if (event.target instanceof Element && event.target.closest('button') !== null) return
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: view.offsetX, offsetY: view.offsetY }
    setDragging(true)
    // Capturing keeps the gesture on this element when the pointer leaves it. A
    // Host or test DOM without the API still pans; it just loses that guarantee.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      drag.current = null
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (current === null || current.pointerId !== event.pointerId) return
    setView(previous => ({ ...previous, offsetX: current.offsetX + event.clientX - current.x, offsetY: current.offsetY + event.clientY - current.y }))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A release that never started a gesture (a secondary press, a press on a
    // card control) still settles the surface, so this is idempotent.
    if (drag.current === null) {
      setDragging(false)
      return
    }
    const current = drag.current
    if (current.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const pan = (x: number, y: number) => {
      event.preventDefault()
      setView(current => ({ ...current, offsetX: current.offsetX + x, offsetY: current.offsetY + y }))
    }
    if (event.key === 'ArrowLeft') pan(-KEY_PAN, 0)
    else if (event.key === 'ArrowRight') pan(KEY_PAN, 0)
    else if (event.key === 'ArrowUp') pan(0, -KEY_PAN)
    else if (event.key === 'ArrowDown') pan(0, KEY_PAN)
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomCenter(ZOOM_STEP) }
    else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomCenter(1 / ZOOM_STEP) }
    else if (event.key === '0') { event.preventDefault(); reset() }
  }

  const byId = useMemo(() => new Map(graph.nodes.map(node => [node.task.id, node])), [graph.nodes])
  const filter = statusFilter ?? NO_FILTER
  const visible = useMemo(() => {
    const nodes = filter.length === 0 ? layout.nodes : layout.nodes.filter(node => {
      const status = byId.get(node.id)?.task.status
      return status !== undefined && filter.includes(status)
    })
    return { nodes, ids: new Set(nodes.map(node => node.id)) }
  }, [byId, filter, layout.nodes])

  const counts = useMemo(() => {
    const total: Record<TaskStatus, number> = { todo: 0, in_progress: 0, approving: 0, done: 0 }
    for (const node of graph.nodes) total[node.task.status] += 1
    return total
  }, [graph.nodes])

  const showEmpty = empty === true || layout.nodes.length === 0

  return <section className={css.canvas} data-canvas="true" role="region" aria-label={t('canvasTitle')}>
    <header className={css.header}>
      <h2 className={css.heading}>{t('canvasTitle')}</h2>
      <div className={css.stats} role="group" aria-label={t('status')}>
        {TASK_STATUSES.map(status => <span key={status} className={css.stat} data-status={status}>
          <span className={css.statValue}>{counts[status]}</span>
          <span className={css.statLabel}>{t(statusKey(status))}</span>
        </span>)}
      </div>
      <div className={css.viewControls} role="group" aria-label={t('viewLabel')}>
        <button type="button" onClick={fit} title={t('canvasFit')} aria-label={t('canvasFit')}>{t('canvasFit')}</button>
        <button type="button" onClick={() => zoomCenter(ZOOM_STEP)} title={t('canvasZoomIn')} aria-label={t('canvasZoomIn')}>+</button>
        <button type="button" onClick={() => zoomCenter(1 / ZOOM_STEP)} title={t('canvasZoomOut')} aria-label={t('canvasZoomOut')}>−</button>
        <button type="button" onClick={reset} title={t('canvasReset')} aria-label={t('canvasReset')}>{t('canvasReset')}</button>
      </div>
    </header>

    {showEmpty
      ? <div className={css.empty}>
        <strong>{t('canvasEmpty')}</strong>
        <span>{t('canvasEmptyHint')}</span>
      </div>
      : <div
        className={css.viewport}
        data-dragging={dragging ? 'true' : 'false'}
        data-testid="task-canvas-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label={t('canvasTitle')}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div className={css.surface} data-testid="task-canvas-surface" data-zoom={view.scale.toFixed(2)}
          style={{ transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`, width: `${layout.width}px`, height: `${layout.height}px` }}>
          <svg className={css.edges} width={layout.width} height={layout.height} aria-hidden="true" focusable="false">
            <defs>
              <marker id="task-canvas-arrow-parent" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 8 4 L 0 8 z" className={css.arrowParent} />
              </marker>
              <marker id="task-canvas-arrow-waits" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 8 4 L 0 8 z" className={css.arrowWaits} />
              </marker>
            </defs>
            {layout.edges.map(edge => {
              if (!visible.ids.has(edge.from) || !visible.ids.has(edge.to)) return null
              const from = taskLayoutAnchor(layout, edge.from, edge.to)
              const to = taskLayoutAnchor(layout, edge.to, edge.from)
              if (from === null || to === null) return null
              return <path
                key={edge.id}
                className={edge.kind === 'parent' ? css.edgeParent : css.edgeWaits}
                data-edge={edge.kind}
                data-from={edge.from}
                data-to={edge.to}
                d={edgePath(from, to)}
                markerEnd={`url(#${edge.kind === 'parent' ? 'task-canvas-arrow-parent' : 'task-canvas-arrow-waits'})`}
              />
            })}
          </svg>
          {visible.nodes.map(node => {
            const record = byId.get(node.id)
            if (record === undefined) return null
            const sessionId = record.task.sessionId
            return <TaskCard
              key={node.id}
              node={record}
              x={node.x}
              y={node.y}
              sessionId={sessionId}
              execution={sessionId === null ? undefined : executionOf?.(sessionId)}
              t={t}
              onOpen={onOpen}
              onOpenSession={onOpenSession}
            />
          })}
        </div>
      </div>}

    <footer className={css.footer}>
      <span className={css.nodeCount}>{t('canvasNodeCount').replace('{count}', String(visible.nodes.length)).replace('{edges}', String(layout.edges.length))}</span>
      {graph.truncated && <p className={css.truncated} role="status">{t('canvasTruncated').replace('{count}', String(graph.nodes.length))}</p>}
    </footer>
  </section>
}
