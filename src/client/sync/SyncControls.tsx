import { useState } from 'react'
import { Button, IconChevronDownOutlineRegular, Menu, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { FAILURE_TOAST_HOLD_MS, SyncFailure, SyncResults, syncFailureText, type SyncTranslate } from './SyncResults.tsx'
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
 * Everything Sync has to say on the list page.
 *
 * A refused click keeps its reason on the page: the prompt names configuration
 * the reader has to change on another surface, so it waits there until it is
 * dismissed or the next Sync click replaces it. What floats instead is the
 * outcome of a run and the failures around it — the host's banner carries the
 * reason, the counts and the standing notes, out of the list's scroll range,
 * and each continues the sentence with its own action. The banner announces
 * every run state it is re-keyed to, which is what makes a running run's
 * progress audible without a live region of this page's own. Copy describing
 * what Sync does lives on the settings page next to the rules it describes.
 */
export function SyncStatus({ panel, t }: { panel: SyncPanel; t: SyncTranslate }) {
  const { run, prompt, scopeError, dismiss } = panel
  if (panel.hidden) return null
  // The query failure is the more specific answer to the same click, so it
  // replaces the scope failure rather than stacking a second banner.
  const failure = run.queryError ?? scopeError
  return <section className={css.status} aria-label={t('syncResults')}>
    {prompt !== null && <p className={css.notice} role="status">{t(prompt === 'none' ? 'syncNoConnection' : prompt === 'noRule' ? 'syncNoEnabledRule' : 'syncNoScope')}
      <button type="button" className={css.noticeClose} onClick={dismiss}>{t('syncNoticeDismiss')}</button></p>}
    {failure !== null && <Toast
      key={`failure:${syncFailureText(failure, t)}`}
      // The reason and what to do about it read as the one sentence the banner
      // reports; the host Toast takes no body of its own.
      text={run.queryError === null ? syncFailureText(failure, t) : `${syncFailureText(failure, t)} · ${t('syncQueryFailed')}`}
      holdMs={FAILURE_TOAST_HOLD_MS}
      actions={run.queryError !== null
        ? [{ label: t('syncReconnect'), onClick: () => { void run.reconnect() } }, { label: t('syncCloseResult'), onClick: dismiss }]
        : [{ label: t('syncCloseResult'), onClick: dismiss }]}
      onDone={dismiss}
    />}
    {run.run !== null && <SyncResults key={`run:${run.run.id}`} run={run.run} t={t} onDismiss={dismiss} />}
  </section>
}
