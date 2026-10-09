import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button, SegmentedTabs, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SafeConnection, SyncRule } from '../../sync/dto.ts'
import type { SyncFace } from './face.ts'
import { SyncFailure } from './SyncResults.tsx'
import { ConnectionSettings } from './ConnectionSettings.tsx'
import { RuleSettings } from './RuleSettings.tsx'
import { FILL_FIELDS, readFillFields, writeFillFields, type FillField } from '../workitem-fill.ts'
import { FILTER_FIELDS, readFilterFields, writeFilterFields, type FilterFieldId } from '../workitem-filter.ts'
import css from './Sync.module.css'

export interface WorkspaceChoice { workspaceId: string; title: string }
export interface SyncSectionFace {
  sync: SyncFace
  workspaceSnapshot(): { items: readonly WorkspaceChoice[] }
  subscribeWorkspaces(listener: () => void): () => void
}
/** Section props: the shell owns the panel, this section owns its two lists. */
export type SyncSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'taskList'> & InjectFace<SyncSectionFace>

/**
 * Sync settings as one page of the host's settings panel: connections and
 * rules, with each editor as a local view of this page rather than a modal of
 * its own. Nothing here starts a run — saving only records configuration.
 */
export function SyncSection({ sync: face, workspaceSnapshot, subscribeWorkspaces, t }: SyncSectionProps) {
  const [tab, setTab] = useState<'connections' | 'rules'>('connections')
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [connections, setConnections] = useState<SafeConnection[]>([])
  const [rules, setRules] = useState<SyncRule[]>([])
  const [editingConnection, setEditingConnection] = useState<SafeConnection | null>(null)
  const [editingRule, setEditingRule] = useState<SyncRule | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [fill, setFill] = useState<readonly FillField[]>(() => readFillFields())
  /** Persist immediately: the "more tasks" page reads the same key on handover. */
  const toggleFill = (id: FillField) => {
    setFill(current => {
      const next = current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]
      writeFillFields(next)
      return next
    })
  }
  const [filters, setFilters] = useState<readonly FilterFieldId[]>(() => readFilterFields())
  /** Same contract as the fill switch: the filter bar reads this key as it mounts. */
  const toggleFilter = (id: FilterFieldId) => {
    setFilters(current => {
      const next = current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]
      writeFilterFields(next)
      return next
    })
  }
  const generation = useRef(0)
  const workspaceState = useSyncExternalStore(subscribeWorkspaces, workspaceSnapshot)
  const refresh = useCallback(async () => {
    const revision = ++generation.current
    try {
      const [nextConnections, nextRules] = await Promise.all([face.listSyncConnections(), face.listSyncRules()])
      if (revision !== generation.current) return
      setConnections(nextConnections); setRules(nextRules); setError(null)
    } catch (failure) { if (revision === generation.current) setError(failure) }
    finally { if (revision === generation.current) setLoading(false) }
  }, [face])
  useEffect(() => { void refresh(); return () => { generation.current++ } }, [refresh])
  const saved = async () => { await refresh(); setNotice(t('syncSaved')) }
  /** Enable or disable from the roster itself: the switch belongs with the row it governs. */
  const toggleEnabled = async (connection: SafeConnection, next: boolean) => {
    try { await face.updateSyncConnection({ id: connection.id, revision: connection.revision, enabled: next }); await refresh() }
    catch (failure) { setError(failure) }
  }
  /** The rule row owns its own switch for the same reason the connection row does. */
  const toggleRuleEnabled = async (rule: SyncRule, next: boolean) => {
    try { await face.updateSyncRule({ id: rule.id, revision: rule.revision, enabled: next }); await refresh() }
    catch (failure) { setError(failure) }
  }
  /** Leaving after a removal: the roster is the only place left to be. */
  const removed = async () => { await refresh(); setView('list') }
  const back = () => setView('list')
  return <section className={css.settings} aria-label={t('syncSettings')}>
    <SegmentedTabs value={tab} label={t('syncSettings')} className={css.settingsTabs} items={[
      { value: 'connections', label: `${t('syncConnectionsTab')} ${connections.length}`, id: 'sync-connections-tab', panelId: 'sync-connections-panel' },
      { value: 'rules', label: `${t('syncRulesTab')} ${rules.length}`, id: 'sync-rules-tab', panelId: 'sync-rules-panel' },
    ]} onChange={next => { setTab(next); setView('list'); setNotice('') }} />
    {error !== null && <SyncFailure error={error} t={t} />}
    {notice && <p role="status">{notice}</p>}
    {/* Which work-item data a new task starts with; a browser preference, saved
        on change, read by the "more tasks" page when it hands over a draft. */}
    <div className={css.fillSettings}>
      <h3>{t('fillSettingsTitle')}</h3>
      <p className={css.hint}>{t('fillSettingsHint')}</p>
      <div className={css.fillGrid} role="group" aria-label={t('fillSettingsTitle')}>
        {FILL_FIELDS.map(field => <label key={field.id} className={css.fillRow}>
          <input type="checkbox" checked={fill.includes(field.id)} onChange={() => toggleFill(field.id)} />
          <span>{t(field.label)}</span>
        </label>)}
      </div>
    </div>
    {/* Which filters the "more tasks" bar offers, and how many it may show at once. */}
    <div className={css.fillSettings}>
      <h3>{t('filterSettingsTitle')}</h3>
      <p className={css.hint}>{t('filterSettingsHint')}</p>
      <div className={css.fillGrid} role="group" aria-label={t('filterSettingsTitle')}>
        {FILTER_FIELDS.map(field => <label key={field.id} className={css.fillRow}>
          <input type="checkbox" checked={filters.includes(field.id)} onChange={() => toggleFilter(field.id)} />
          <span>{t(field.label)}</span>
        </label>)}
      </div>
      <p className={css.hint}>{t('filterParticipantsNote')}</p>
    </div>
    <div role="tabpanel" id={tab === 'connections' ? 'sync-connections-panel' : 'sync-rules-panel'} aria-labelledby={tab === 'connections' ? 'sync-connections-tab' : 'sync-rules-tab'}>
      {loading ? <p>{t('loading')}</p> : tab === 'connections' ? view === 'edit'
        ? <ConnectionSettings key={editingConnection?.id ?? 'new'} connection={editingConnection} face={face} t={t} onSaved={async next => { setEditingConnection(next); await saved() }} onBack={back} onDeleted={removed} />
        : <>
          <div className={css.sectionHeading}><h3>{t('syncConnectionsTab')}</h3><Button variant="primary" onClick={() => { setEditingConnection(null); setView('edit'); setNotice('') }}>{t('syncNewConnection')}</Button></div>
          {connections.length === 0 && <p className={css.hint}>{t('syncNoConnections')}</p>}
          <ul className={css.cards}>{connections.map(connection => <li className={css.connectionCard} key={connection.id}>
            <span className={css.platformBadge} data-platform={connection.platform}>{connection.platform === 'tapd' ? 'T' : '云'}</span>
            <div className={css.cardText}><strong>{connection.name}</strong><small>{connection.platform === 'tapd' ? 'TAPD' : '云效 Projex'} · {rules.filter(rule => rule.connectionId === connection.id).length} {t('syncRule')}</small></div>
            <Switch label={t('syncEnableConnection')} checked={connection.enabled} disabled={!connection.credentialPresent}
              onChange={next => void toggleEnabled(connection, next)} />
            <Button size="sm" aria-label={`${t('syncConfigure')}: ${connection.name}`} onClick={() => { setEditingConnection(connection); setView('edit'); setNotice('') }}>{t('syncConfigure')} ›</Button>
          </li>)}</ul>
        </>
        : view === 'edit'
          ? <RuleSettings key={editingRule?.id ?? 'new'} rule={editingRule} connections={connections} face={face} workspaces={workspaceState.items} t={t} onSaved={saved} onBack={back} onDeleted={removed} />
          : <>
            <div className={css.sectionHeading}><h3>{t('syncRule')}</h3><Button variant="primary" disabled={connections.length === 0} onClick={() => { setEditingRule(null); setView('edit'); setNotice('') }}>{t('syncNewRule')}</Button></div>
            {rules.length === 0 && <p className={css.hint}>{t('syncNoRules')}</p>}
            <ul className={css.cards}>{rules.map(rule => <li key={rule.id} className={css.connectionCard}>
              <div className={css.cardText}><strong>{rule.projectName ?? rule.projectId}</strong><small>{connections.find(item => item.id === rule.connectionId)?.name} · {rule.filters.typeIds.join(', ')}</small></div>
              <Switch label={t('syncEnableRule')} checked={rule.enabled} onChange={next => void toggleRuleEnabled(rule, next)} />
              <Button size="sm" aria-label={`${t('edit')}: ${rule.projectId}`} onClick={() => { setEditingRule(rule); setView('edit'); setNotice('') }}>{t('edit')}</Button>
            </li>)}</ul>
          </>}
    </div>
  </section>
}
