import { useState } from 'react'
import { Button, IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { SyncFailure, SyncResults, type SyncTranslate } from './SyncResults.tsx'
import type { SyncPanel } from './use-sync-panel.ts'
import css from './Sync.module.css'

/**
 * The task list header's split block: the main half creates a task, the
 * trailing half opens the menu holding Sync. Sync settings are not here — they
 * are a page in the host's settings panel, so the list page keeps one row of
 * chrome instead of a settings entry of its own.
 */
export function SyncActions({ addLabel, onCreate, panel, t }: {
  addLabel: string
  onCreate: () => void
  panel: SyncPanel
  t: SyncTranslate
}) {
  const [open, setOpen] = useState(false)
  return <div className={css.split} data-split="create-sync">
    <button type="button" className={css.splitAdd} onClick={onCreate}>{addLabel}</button>
    <Menu
      open={open}
      className={css.splitAnchor}
      listClassName={css.splitMenu}
      items={[{ id: 'sync', label: panel.busy ? t('syncRunning') : t('sync'), disabled: panel.busy }]}
      onClose={() => setOpen(false)}
      onSelect={id => { setOpen(false); if (id === 'sync') panel.sync() }}
      anchor={<button type="button" className={css.splitToggle} aria-label={t('moreActions')}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <IconChevronDownOutlineRegular size={14} />
      </button>} />
  </div>
}

/**
 * Everything Sync has to say on the list page: a refused click's prompt, a
 * scope or query failure, and the running or finished run's results. It draws
 * nothing at rest, so the page carries no standing explanation of what sync
 * does — that copy lives on the settings page next to the rules it describes.
 */
export function SyncStatus({ panel, t }: { panel: SyncPanel; t: SyncTranslate }) {
  const { run, prompt, scopeError, dismiss } = panel
  if (prompt === null && scopeError === null && run.queryError === null && run.run === null) return null
  return <section className={css.status} aria-label={t('syncResults')}>
    {prompt !== null && <p className={css.notice} role="status">{t(prompt === 'none' ? 'syncNoConnection' : 'syncNoScope')}
      <button type="button" className={css.noticeClose} onClick={dismiss}>{t('syncNoticeDismiss')}</button></p>}
    {scopeError !== null && <SyncFailure error={scopeError} t={t} />}
    {run.queryError !== null && <>
      <SyncFailure error={run.queryError} t={t} />
      <p>{t('syncQueryFailed')}</p>
      <Button onClick={() => void run.reconnect()}>{t('syncReconnect')}</Button>
    </>}
    {run.run && <SyncResults run={run.run} items={run.items} t={t} changePage={run.changePage} />}
  </section>
}
