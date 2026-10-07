import { useCallback, useEffect, useRef, useState } from 'react'
import { Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { CreateTaskRequest, TaskContent, TaskAttachmentUpload } from '../types.ts'
import type { DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { captureDraft, installCaptureShortcut, type CaptureOutcome } from './capture.ts'

/** Business face the composer control needs: the task writer. */
export interface TaskCaptureFace {
  sessionId: string
  create(request: CreateTaskRequest): Promise<unknown>
  captureAttachments(ids: readonly DraftAttachmentId[]): Promise<{ blocks: TaskContent['blocks']; uploads: TaskAttachmentUpload[] }>
  releaseAttachment(id: DraftAttachmentId): void
}

type TaskCaptureProps = PropsRuntime<'conversation.input.right'> & InjectFace<TaskCaptureFace> & PropsLocale<'taskList'>

/** Full-opacity hold; the host Toast owns its fade and dismissal timer. */
const REPORT_HOLD_MS = 3000

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
export function TaskCapture({ useInput, inputActions, sessionId, create, captureAttachments, releaseAttachment, t }: TaskCaptureProps) {
  const input = useInput(selectInput)
  const draft = asDraft(input?.draft)
  const [notice, setNotice] = useState<{ outcome: CaptureOutcome; seq: number } | null>(null)
  const sequence = useRef(0)
  // The keydown listener is installed once; this ref keeps it reading the
  // latest draft, actions, and face without reinstalling per keystroke.
  const latest = useRef({ draft, input, inputActions, sessionId, create, captureAttachments, releaseAttachment, t })
  latest.current = { draft, input, inputActions, sessionId, create, captureAttachments, releaseAttachment, t }
  const capturing = useRef(false)

  const report = useCallback((outcome: CaptureOutcome) => {
    // A repeated result must remount Toast to restart its hold/fade cycle.
    setNotice({ outcome, seq: ++sequence.current })
  }, [])

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
          sessionId: snapshot.sessionId,
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

  if (notice === null) return null

  const { outcome, seq } = notice
  const message = outcome.kind === 'created'
    ? t('captureCreated').replace('{title}', outcome.title)
    : outcome.kind === 'empty' ? t('captureEmpty') : `${t('captureFailed')}: ${outcome.message}`

  // Toast portals into document.body: no result occupies the composer slot.
  return <Toast key={seq} text={message} {...(outcome.kind === 'created' ? { tone: 'success' as const } : {})}
    holdMs={REPORT_HOLD_MS} onDone={() => setNotice(current => current?.seq === seq ? null : current)} />
}
