import { Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SafeRun } from '../../sync/dto.ts'
import type { TaskKey } from '../locales.ts'
import css from './Sync.module.css'
export type SyncTranslate = (key: TaskKey) => string
const categories = { imported: 'syncImported', pulled: 'syncPulled', pushed: 'syncPushed', merged: 'syncMerged', unchanged: 'syncSkipped', failed: 'syncFailed' } as const
/** A failure that names what broke stays readable longer; a success keeps the host Toast's own 3000ms hold. */
export const FAILURE_TOAST_HOLD_MS = 6000
/** A finished run reports counts and notes, so it is held longer than a one-line outcome. */
export const RESULT_TOAST_HOLD_MS = 8000
/** Name one run's status in the reader's own language. */
function resultLabel(run: SafeRun, t: SyncTranslate): string {
  return t(run.status === 'running' ? 'syncRunning' : run.status === 'completed' ? 'syncCompleted'
    : run.status === 'interrupted' ? 'syncInterrupted' : run.status === 'partial' ? 'syncPartial' : 'syncFailed')
}
/**
 * The one localized sentence a failure reports and the platform's own refusal
 * code, derived once so the page and the floating banner name the same reason.
 */
function failureReport(error: unknown): { key: TaskKey; detail: string } {
  const outer = typeof error === 'object' && error !== null ? error as { code?: unknown; details?: unknown } : {}
  const detail: { code?: unknown; cause?: unknown } = typeof outer.details === 'object' && outer.details !== null
    ? outer.details as { code?: unknown; cause?: unknown }
    : outer
  const code = typeof detail.code === 'string' ? detail.code : ''
  const codeKey = {
    HostRestartRequired: 'syncHostRestart',
    CredentialMissing: 'syncCredentialMissing',
    WriteOutcomeUnknown: 'syncPendingHint',
    VerificationFailed: 'syncPendingHint',
  } as const
  const key = codeKey[code as keyof typeof codeKey] ?? 'syncSafeError'
  // A wrapper may keep the platform's own refusal code as the visible reason.
  const cause = typeof detail.cause === 'string' ? detail.cause : ''
  return { key, detail: cause !== '' ? `${code}: ${cause}` : code }
}
/** One failure as localized text: the banner has no element of its own for the code. */
export function syncFailureText(error: unknown, t: SyncTranslate): string {
  const { key, detail } = failureReport(error)
  return detail === '' ? t(key) : `${t(key)} ${detail}`
}
export function SyncFailure({ error, t }: { error: unknown; t: SyncTranslate }) {
  const { key, detail } = failureReport(error)
  return <p role="alert" className={css.error}>{t(key)} {detail !== '' && <code>{detail}</code>}</p>
}

/**
 * One run's outcome as the host's floating banner.
 *
 * The banner takes a sentence and its own inline actions, so the counts and the
 * standing notes are folded into that one line rather than passed as a body: it
 * is the same surface the archive report uses, and the outcome is no longer a
 * block the list scrolls away. A failed run and an unfinished discovery read
 * longer than a clean finish.
 */
export function SyncResults({ run, t, onDismiss }: { run: SafeRun; t: SyncTranslate; onDismiss: () => void }) {
  return <Toast
    text={resultText(run, t)}
    holdMs={run.status === 'failed' ? FAILURE_TOAST_HOLD_MS : RESULT_TOAST_HOLD_MS}
    actions={[{ label: t('syncCloseResult'), onClick: onDismiss }]}
    onDone={onDismiss}
  />
}

/**
 * One run as the single sentence the banner reports, localized: its status, the
 * counts that are non-zero, and what the reader has to know about the read
 * behind them. Item IDs are not task-list content.
 * @param run - the run to describe.
 * @param t - this plugin's copy.
 * @returns the banner's text.
 */
export function resultText(run: SafeRun, t: SyncTranslate): string {
  const count = run.counts
  const parts = [resultLabel(run, t)]
  for (const [key, text] of Object.entries(categories)) {
    if (count[key as keyof typeof categories] > 0) parts.push(`${t(text)}：${count[key as keyof typeof categories]}`)
  }
  if (count.pending > 0) parts.push(`${t('syncPending')}：${count.pending}`)
  parts.push(t('syncScope'))
  if (run.status !== 'running' && !run.discoveryComplete) parts.push(t('syncIncomplete'))
  if (count.pending > 0) parts.push(t('syncPendingHint'))
  if (run.errors.length > 0) parts.push(`${t('syncFailed')}：${run.errors.length}`)
  return parts.join(' · ')
}
