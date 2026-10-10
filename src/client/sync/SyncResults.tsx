import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Page, SafeItemResult, SafeRun } from '../../sync/dto.ts'
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
export function SyncResults({ run, items, t, changePage }: { run: SafeRun; items: Page<SafeItemResult>; t: SyncTranslate; changePage: (page: number) => void }) {
  const label = run.status === 'running' ? 'syncRunning' : run.status === 'completed' ? 'syncCompleted' : run.status === 'interrupted' ? 'syncInterrupted' : run.status === 'partial' ? 'syncPartial' : 'syncFailed'
  const count = run.counts
  return <section className={css.results} aria-label={t('syncResults')}>
    <strong role="status" aria-live="polite">{t(label)}</strong>
    <p>{Object.entries(categories).map(([key, text]) => `${t(text)}：${count[key as keyof typeof categories]}`).join(' · ')} · {t('syncPending')}：{count.pending}</p>
    {!run.discoveryComplete && <p>{t('syncIncomplete')}</p>}
    {count.pending > 0 && <p>{t('syncPendingHint')}</p>}
    {run.status === 'completed' && count.unchanged > 0 && count.imported + count.pulled + count.pushed + count.merged + count.failed === 0 && <p>{t('syncUnchanged')}</p>}
    {run.errors.map((error, index) => <SyncFailure key={index} error={error} t={t} />)}
    <ul className={css.resultList}>{items.items.map(item => <li key={`${item.key.instance}:${item.key.projectId}:${item.key.typeId}:${item.key.id}`}>
      <span>{item.key.id} · {t(categories[item.category])}</span>
      {item.outsideFilter && <span>{t('syncOutside')}</span>}
      {item.error && <SyncFailure error={item.error} t={t} />}
      {(item.discardedFields.length > 0 || item.writtenBack) && <details><summary>{t('syncDetails')}</summary>
        {item.discardedFields.length > 0 && <p>{t('syncDiscarded')}: {item.discardedFields.join(', ')}</p>}
        {item.writtenBack && <p>{t('syncWritten')}: {item.changedFields.join(', ')}</p>}
      </details>}
    </li>)}</ul>
    {items.total > 20 && <div className={css.actions}>
      <Button size="sm" disabled={items.page <= 1} onClick={() => changePage(items.page - 1)}>{t('prevPage')}</Button>
      <span>{items.page} / {Math.ceil(items.total / 20)}</span>
      <Button size="sm" disabled={items.page * 20 >= items.total} onClick={() => changePage(items.page + 1)}>{t('nextPage')}</Button>
    </div>}
  </section>
}
