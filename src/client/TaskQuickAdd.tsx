import { useEffect, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TaskFace, TaskPanelProps } from './TaskPanel.tsx'
import { TaskPanel } from './TaskPanel.tsx'
import {
  closeQuickAdd, installQuickAddShortcut, openQuickAdd, quickAddAvailable, quickAddState, subscribeQuickAdd,
} from './quick-add.ts'

type TaskQuickAddProps = PropsRuntime<'shell.overlay'> & InjectFace<TaskFace> & PropsLocale<'taskList'>

/**
 * The frame-wide New task dialog. It owns no surface of its own: it listens for
 * Ctrl+S on the page (never inside a field, a terminal, or an open dialog),
 * and while the request stands it renders the task panel's own composer over
 * whatever page the user is on — no panel switch, no navigation.
 *
 * The panel's page copy subscribes to the same request, so a task created here
 * reloads a list that is on screen; see `quick-add.ts`.
 */
export function TaskQuickAdd(props: TaskQuickAddProps) {
  const request = useSyncExternalStore(subscribeQuickAdd, quickAddState)
  useEffect(() => installQuickAddShortcut(document, {
    available: () => quickAddAvailable(document),
    open: openQuickAdd,
  }), [])
  if (!request.open) return null
  const dialog: NonNullable<TaskPanelProps['dialog']> = { onClose: closeQuickAdd }
  return <TaskPanel {...props} dialog={dialog} />
}
