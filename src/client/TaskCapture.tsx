import { useCallback, useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { CreateTaskRequest, TaskContent, TaskAttachmentUpload } from '../types.ts'
import type { DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { captureDraft, installCaptureShortcut, type CaptureOutcome } from './capture.ts'
import css from './TaskCapture.module.css'

/** Business face the composer control needs: the task writer. */
export interface TaskCaptureFace {
  create(request: CreateTaskRequest): Promise<unknown>
  captureAttachments(ids: readonly DraftAttachmentId[]): Promise<{ blocks: TaskContent['blocks']; uploads: TaskAttachmentUpload[] }>
  releaseAttachment(id: DraftAttachmentId): void
}

type TaskCaptureProps = PropsRuntime<'conversation.input.right'> & InjectFace<TaskCaptureFace> & PropsLocale<'taskList'>

/** How long one capture result stays visible next to the control. */
const REPORT_TIMEOUT_MS = 4000

/** Composer projection the shortcut reads; the session input machine supplies it. */
interface ComposerInput { readonly draft: string; readonly attachmentIds?: readonly DraftAttachmentId[]; readonly phase?: string; readonly draftRev?: number }
/** Composer verbs the shortcut needs; the session input actions supply them. */
interface ComposerActions { setDraft(text: string): void; removeAttachment(id: DraftAttachmentId): void }

const selectInput = (state: ComposerInput): ComposerInput => state

function asDraft(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Parked: the visible Save as task button is intentionally removed. Restore
 * the button in this component if requested; keep the Ctrl+S listener mounted.
 * Reads the draft through the session input projection and reports captures.
 */
export function TaskCapture({ useInput, inputActions, create, captureAttachments, releaseAttachment, t }: TaskCaptureProps) {
  const input = useInput(selectInput)
  const draft = asDraft(input?.draft)
  const [outcome, setOutcome] = useState<CaptureOutcome | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The keydown listener is installed once; this ref keeps it reading the
  // latest draft, actions, and face without reinstalling per keystroke.
  const latest = useRef({ draft, input, inputActions, create, captureAttachments, releaseAttachment, t })
  latest.current = { draft, input, inputActions, create, captureAttachments, releaseAttachment, t }
  const capturing = useRef(false)

  const report = useCallback((next: CaptureOutcome) => {
    setOutcome(next)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOutcome(null), REPORT_TIMEOUT_MS)
  }, [])

  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])

  useEffect(() => installCaptureShortcut(document, {
    readDraft: () => latest.current.draft,
    activeElement: () => document.activeElement,
    capture: async text => {
      const snapshot = latest.current
      if (capturing.current || snapshot.input?.phase && snapshot.input.phase !== 'plain') return { kind: 'failed', message: snapshot.t('captureBusy') }
      capturing.current = true
      const ids = [...snapshot.input?.attachmentIds ?? []]
      try {
        return await captureDraft(text, {
          create: snapshot.create,
          hasAttachments: ids.length > 0,
          ...(ids.length ? { captureAttachments: () => snapshot.captureAttachments(ids) } : {}),
          clearDraft: () => {
            // Do not erase edits made while attachment reads / RPC were in flight.
            if (latest.current.inputActions === snapshot.inputActions && latest.current.input?.phase === snapshot.input?.phase && latest.current.draft === text
              && latest.current.input?.draftRev === snapshot.input?.draftRev) (snapshot.inputActions as ComposerActions).setDraft('')
          },
          clearAttachments: () => {
            if (latest.current.inputActions !== snapshot.inputActions || latest.current.input?.phase !== snapshot.input?.phase) return
            for (const id of ids) {
              (snapshot.inputActions as ComposerActions).removeAttachment(id)
              snapshot.releaseAttachment(id)
            }
          },
        })
      } finally { capturing.current = false }
    },
    report,
  }), [report])

  const message = outcome === null ? '' : outcome.kind === 'created'
    ? t('captureCreated').replace('{title}', outcome.title)
    : outcome.kind === 'empty' ? t('captureEmpty') : `${t('captureFailed')}: ${outcome.message}`

  if (outcome === null) return null

  return <span className={css.capture}>
    <span className={css.report} role="status" data-tone={outcome.kind}>{message}</span>
  </span>
}
