import { useCallback, useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { CreateTaskRequest } from '../types.ts'
import { captureDraft, installCaptureShortcut, type CaptureOutcome } from './capture.ts'
import css from './TaskCapture.module.css'

/** Business face the composer control needs: the task writer. */
export interface TaskCaptureFace {
  create(request: CreateTaskRequest): Promise<unknown>
}

type TaskCaptureProps = PropsRuntime<'conversation.input.right'> & InjectFace<TaskCaptureFace> & PropsLocale<'taskList'>

/** How long one capture result stays visible next to the control. */
const REPORT_TIMEOUT_MS = 4000

/** Composer projection the shortcut reads; the session input machine supplies it. */
interface ComposerInput { readonly draft: string }
/** Composer verbs the shortcut needs; the session input actions supply them. */
interface ComposerActions { setDraft(text: string): void }

const selectDraft = (state: ComposerInput): string => state.draft

function asDraft(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Composer control for Ctrl+S. Reads the draft through the session input
 * projection, writes one task through the injected face, and empties the
 * composer on success — no dialog, only a short inline report.
 */
export function TaskCapture({ useInput, inputActions, create, t }: TaskCaptureProps) {
  const draft = asDraft(useInput(selectDraft))
  const [outcome, setOutcome] = useState<CaptureOutcome | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The keydown listener is installed once; this ref keeps it reading the
  // latest draft, actions, and face without reinstalling per keystroke.
  const latest = useRef({ draft, inputActions, create })
  latest.current = { draft, inputActions, create }

  const report = useCallback((next: CaptureOutcome) => {
    setOutcome(next)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOutcome(null), REPORT_TIMEOUT_MS)
  }, [])

  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])

  useEffect(() => installCaptureShortcut(document, {
    readDraft: () => latest.current.draft,
    activeElement: () => document.activeElement,
    capture: text => captureDraft(text, {
      create: request => latest.current.create(request),
      clearDraft: () => (latest.current.inputActions as ComposerActions).setDraft(''),
    }),
    report,
  }), [report])

  const run = (): void => {
    void captureDraft(draft, {
      create,
      clearDraft: () => (inputActions as ComposerActions).setDraft(''),
    }).then(report)
  }

  const message = outcome === null ? '' : outcome.kind === 'created'
    ? t('captureCreated').replace('{title}', outcome.title)
    : outcome.kind === 'empty' ? t('captureEmpty') : `${t('captureFailed')}: ${outcome.message}`

  return <span className={css.capture}>
    <button type="button" className={css.button} onClick={run} title={t('captureHint')} aria-label={t('captureTask')}>
      {t('captureTask')}<kbd className={css.key}>Ctrl+S</kbd>
    </button>
    {outcome !== null && <span className={css.report} role="status" data-tone={outcome.kind}>{message}</span>}
  </span>
}
