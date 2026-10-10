import type { SafeRun } from '../../sync/dto.ts'
import type { TaskKey } from '../locales.ts'
import css from './Sync.module.css'
export type SyncTranslate = (key: TaskKey) => string
const categories = { imported: 'syncImported', pulled: 'syncPulled', pushed: 'syncPushed', merged: 'syncMerged', unchanged: 'syncSkipped', failed: 'syncFailed' } as const
export function SyncFailure({ error, t }: { error: unknown; t: SyncTranslate }) {
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
  return <p role="alert" className={css.error}>{t(key)} {code && <code>{cause !== '' ? `${code}: ${cause}` : code}</code>}</p>
}

/** A dismissible run summary; item IDs are not task-list content. */
export function SyncResults({ run, t, onDismiss }: { run: SafeRun; t: SyncTranslate; onDismiss: () => void }) {
  const label = run.status === 'running' ? 'syncRunning' : run.status === 'completed' ? 'syncCompleted' : run.status === 'interrupted' ? 'syncInterrupted' : run.status === 'partial' ? 'syncPartial' : 'syncFailed'
  const count = run.counts
  const summary = Object.entries(categories)
    .filter(([key]) => count[key as keyof typeof categories] > 0)
    .map(([key, text]) => `${t(text)}：${count[key as keyof typeof categories]}`)
  if (count.pending > 0) summary.push(`${t('syncPending')}：${count.pending}`)
  return <section className={css.results} aria-label={t('syncResults')}>
    <div className={css.resultHeading}>
      <strong role="status" aria-live="polite">{t(label)}</strong>
      <button type="button" className={css.noticeClose} onClick={onDismiss}>{t('syncCloseResult')}</button>
    </div>
    {summary.length > 0 && <p className={css.resultSummary}>{summary.join(' · ')}</p>}
    <p className={css.resultHint}>{t('syncScope')}</p>
    {run.status !== 'running' && !run.discoveryComplete && <p className={css.resultHint}>{t('syncIncomplete')}</p>}
    {count.pending > 0 && <p className={css.resultHint}>{t('syncPendingHint')}</p>}
    {run.errors.length > 0 && <details className={css.resultErrors}>
      <summary>{t('syncFailed')}：{run.errors.length}</summary>
      <div>{run.errors.map((error, index) => <SyncFailure key={index} error={error} t={t} />)}</div>
    </details>}
  </section>
}
