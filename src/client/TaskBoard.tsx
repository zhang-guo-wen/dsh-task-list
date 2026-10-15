import { useMemo, useState } from 'react'
import type { TaskGraph, TaskGraphNode, TaskOverview, TaskRecord, TaskStatus } from '../types.ts'
import { TASK_STATUSES } from '../types.ts'
import type { TaskKey } from './locales.ts'
import type { TaskExecutionInfo } from './TaskCanvas.tsx'
import css from './TaskBoard.module.css'

export interface TaskBoardProps {
  graph: TaskGraph
  overview: TaskOverview
  t: (key: TaskKey) => string
  onOpen(task: TaskRecord): void
  onOpenSession?(sessionId: string): void
  executionOf?(sessionId: string): TaskExecutionInfo | undefined
}

/** The locale key of a status label; the stored value uses an underscore, the key camel case. */
function statusKey(status: TaskStatus): TaskKey {
  if (status === 'in_progress') return 'inProgress'
  if (status === 'approving') return 'approving'
  return status
}

/** A short, human-readable mark for one Agent preset id; the full value stays in the tooltip. */
function agentMark(agent: string): string {
  const words = agent.split(/[\s._/-]+/u).filter(Boolean)
  if (words.length === 0) return agent.slice(0, 2)
  if (words.length === 1) return words[0]!.slice(0, 2)
  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`
}

/** One compact card: status, title, and the relations that matter at a glance. */
function BoardCard({ node, t, onOpen, statusOf }: {
  node: TaskGraphNode
  t: (key: TaskKey) => string
  onOpen(task: TaskRecord): void
  statusOf: Map<string, TaskStatus>
}) {
  const { task } = node
  // “Done” means the waited-on task already reached `done`; a dependency the
  // graph does not carry counts as pending, because it cannot be verified here.
  const done = task.blockingIds.filter(id => statusOf.get(id) === 'done').length
  const pending = task.blockingIds.length - done
  return <li className={css.card} data-task-id={task.id} data-status={task.status} data-blocked={node.blocked ? 'true' : 'false'}>
    <button type="button" className={css.cardTitle} title={task.title} onClick={() => onOpen(task)}>{task.title}</button>
    <p className={css.cardMeta}>
      <span className={css.workspace} title={task.workspaceId ?? t('noWorkspace')}>{task.workspaceId ?? t('noWorkspace')}</span>
      <span className={css.relation} title={t('relationTitle')}>
        {`${t('parentTask')} ${node.parents.length} · ${t('childTasks')} ${node.children.length}`}
      </span>
      {task.blockingIds.length > 0 && <span className={css.relation} title={t('dependenciesHint')}>
        {`${t('dependencyDone')} ${done} · ${t('dependencyPending')} ${pending}`}
      </span>}
      {node.blocked && <span className={css.blocked}>{t('blockedLabel')}</span>}
    </p>
  </li>
}

/**
 * The compact board: a status summary that doubles as the filter, one group per
 * status, and an execution section that aggregates the graph by session, so the
 * questions “what is left”, “what is stuck”, and “which robot is on what” are
 * answered without opening a single task.
 */
export function TaskBoard({ graph, overview, t, onOpen, onOpenSession, executionOf }: TaskBoardProps) {
  const [filter, setFilter] = useState<TaskStatus | null>(null)

  const grouped = useMemo(() => {
    const groups: Record<TaskStatus, TaskGraphNode[]> = { todo: [], in_progress: [], approving: [], done: [] }
    for (const node of graph.nodes) groups[node.task.status].push(node)
    return groups
  }, [graph.nodes])

  const sessions = useMemo(() => {
    const order = overview.sessionIds.length > 0
      ? overview.sessionIds
      : [...new Set(graph.nodes.map(node => node.task.sessionId).filter((id): id is string => id !== null))]
    return order.map(sessionId => {
      const tasks = graph.nodes.filter(node => node.task.sessionId === sessionId)
      const execution = executionOf?.(sessionId)
      return {
        sessionId,
        tasks,
        execution,
        running: execution?.running === true || tasks.some(node => node.task.status === 'in_progress' || node.task.status === 'approving'),
      }
    }).filter(row => row.tasks.length > 0)
  }, [executionOf, graph.nodes, overview.sessionIds])

  const statusOf = useMemo(() => new Map(graph.nodes.map(node => [node.task.id, node.task.status])), [graph.nodes])
  const shown = filter === null ? graph.nodes : graph.nodes.filter(node => node.task.status === filter)

  return <section className={css.board} data-board="true" aria-label={t('overviewTitle')}>
    <div className={css.summary}>
      <h2 className={css.summaryTitle}>{t('overviewTitle')}</h2>
      <div className={css.counts} role="group" aria-label={t('status')}>
        {TASK_STATUSES.map(status => <button
          key={status}
          type="button"
          className={filter === status ? css.countSelected : css.count}
          data-count={status}
          aria-pressed={filter === status}
          onClick={() => setFilter(current => current === status ? null : status)}
          title={t(statusKey(status))}
        >
          <span className={css.countValue}>{overview.counts[status]}</span>
          <span className={css.countLabel}>{t(statusKey(status))}</span>
        </button>)}
      </div>
      <div className={css.totals}>
        <span className={css.total} data-total="total"><strong>{t('overviewTotal')}</strong> {overview.total}</span>
        <span className={css.total} data-total="blocked"><strong>{t('overviewBlocked')}</strong> {overview.blocked}</span>
        <span className={css.total} data-total="sessions"><strong>{t('overviewSessions')}</strong> {overview.sessionIds.length}</span>
      </div>
    </div>

    <div className={css.groups}>
      {TASK_STATUSES.map(status => {
        const rows = filter === null || filter === status ? grouped[status] : []
        if (rows.length === 0) return null
        return <section key={status} className={css.group} data-group={status} aria-label={t(statusKey(status))}>
          <h3 className={css.groupTitle}>
            <span className={css.statusChip} data-status={status}>{t(statusKey(status))}</span>
            <span className={css.groupCount}>{rows.length}</span>
          </h3>
          <ul className={css.cards}>
            {rows.map(node => <BoardCard key={node.task.id} node={node} t={t} onOpen={onOpen} statusOf={statusOf} />)}
          </ul>
        </section>
      })}
      {shown.length === 0 && <p className={css.empty}>{t('canvasEmpty')}</p>}
    </div>

    <section className={css.execution} data-execution="true" aria-label={t('executionTitle')}>
      <h3 className={css.executionTitle}>{t('executionTitle')}</h3>
      <p className={css.executionHint}>{t('executionHint')}</p>
      {sessions.length === 0
        ? <p className={css.empty}>{t('executionNone')}</p>
        : <ul className={css.sessions}>
          {sessions.map(row => <li key={row.sessionId} className={css.session} data-session-id={row.sessionId} data-running={row.running ? 'true' : 'false'}>
            <div className={css.sessionHead}>
              <span className={css.sessionTitle} title={row.execution?.title ?? t('sessionUnavailable')}>{row.execution?.title ?? t('sessionUnavailable')}</span>
              {row.running
                ? <span className={css.runningBadge} data-running="true">{t('executionRunning')}</span>
                : <span className={css.idleBadge}>{t('executionIdle')}</span>}
              <span className={css.agentBadge} title={t('executionAgent')} data-agent={row.execution?.agent ?? ''}>
                {row.execution?.agent ? agentMark(row.execution.agent) : t('executionNoAgent')}
              </span>
              <button type="button" className={css.openSession} onClick={() => onOpenSession?.(row.sessionId)}
                disabled={onOpenSession === undefined} title={t('openSessionAction')}>{t('openSessionAction')}</button>
            </div>
            <ul className={css.sessionTasks}>
              {row.tasks.map(node => <li key={node.task.id} className={css.sessionTask}>
                <button type="button" className={css.sessionTaskTitle} title={node.task.title} onClick={() => onOpen(node.task)}>{node.task.title}</button>
                <span className={css.statusChip} data-status={node.task.status}>{t(statusKey(node.task.status))}</span>
                {node.blocked && <span className={css.blocked}>{t('blockedLabel')}</span>}
              </li>)}
            </ul>
          </li>)}
        </ul>}
    </section>
  </section>
}
