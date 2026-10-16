import { memo } from 'react'
import type { TaskRecord } from '../types.ts'
import type { TaskKey } from './locales.ts'
import { safeSourceUrl } from './task-content.ts'
import { formattedTime } from './format-time.ts'
import { statusKey } from './task-status.ts'
import css from './TaskPanel.module.css'

/** One task row: every prop is a primitive or a stable callback, so a frame that
 * changes nothing the row shows does not re-render it. */
export interface TaskRowProps {
  task: TaskRecord
  /** Resolved workspace label for the row, or the "no workspace" copy. */
  workspaceLabel: string
  /** The workspace this row would start in; null when the task has none. */
  linked: string | null
  /** Whether that workspace still exists, so Start is offered. */
  ready: boolean
  /** True while another write is in flight; disables the row's own actions. */
  busy: boolean
  t(key: TaskKey): string
  onOpen(task: TaskRecord): void
  onStart(task: TaskRecord): void
  onFinish(task: TaskRecord): void
  onDelete(task: TaskRecord): void
}

/** The stored title is derived from the content, so legacy rows without content fall back to it. */
function contentOf(task: TaskRecord): string {
  return task.source ? task.title : task.notes.trim() || task.title
}

function TaskRowView({ task, workspaceLabel, linked, ready, busy, t, onOpen, onStart, onFinish, onDelete }: TaskRowProps) {
  const content = contentOf(task)
  const statusLabel = t(statusKey(task.status))
  // Sanitised once per row: the anchor and its fallback share the result.
  const source = task.source
  const sourceUrl = source ? safeSourceUrl(source.url) : null
  const startHint = task.status === 'todo' && !ready
    ? linked === null ? t('startRequiresWorkspace') : t('startWorkspaceMissing')
    : undefined
  return <li className={css.row} data-priority={task.priority} data-status={task.status}>
    <div className={css.rowLine}>
      <button type="button" className={css.content} onClick={() => onOpen(task)} disabled={busy}
        title={content} aria-label={`${t('edit')}: ${content}`}>{content}</button>
      <span className={css.statusChip} data-status={task.status} title={statusLabel}>{statusLabel}</span>
      <span className={css.workspaceMeta} title={workspaceLabel}>{workspaceLabel}</span>
      <div className={css.rowActions}>
        {task.status === 'done' ? <span className={css.doneState}>{t('done')}</span> : <button
          type="button" className={css.start}
          onClick={() => void (task.status === 'todo' ? onStart(task) : onFinish(task))}
          disabled={busy || task.status === 'todo' && !ready}
          aria-label={`${t(task.status === 'todo' ? 'start' : 'finish')}: ${content}`}
          title={startHint}>
          {t(task.status === 'todo' ? 'start' : 'finish')}
        </button>}
        <button type="button" className={css.delete} onClick={() => void onDelete(task)} disabled={busy}
          aria-label={`${t('remove')}: ${content}`} title={t('remove')}>×</button>
      </div>
    </div>
    {source && <div className={css.sourceLine}>
      {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{source.platform} · {source.number || source.remoteId}</a> : <span>{source.platform} · {source.number || source.remoteId}</span>}
      <span>{t('lastSync')}: {source.lastSuccess === null ? t('notStarted') : formattedTime(source.lastSuccess)}</span>
      {source.error && <span role="status">{t('syncFailed')} · {source.error.code}</span>}
    </div>}
  </li>
}

/**
 * A task list row. Memoised because the measured cost of a refresh that changes
 * nothing visible is the row rebuild: a workspace-snapshot frame rebuilds every
 * row's timestamp, sanitised URL, and element tree.
 */
export const TaskRow = memo(TaskRowView)
