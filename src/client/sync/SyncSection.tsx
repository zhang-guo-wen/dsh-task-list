import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, SegmentedTabs, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ListWorkitemFieldsRequest, SafeWorkitemField, SyncRule, SafeConnection } from '../../sync/dto.ts'
import type { SyncFace } from './face.ts'
import { SyncFailure } from './SyncResults.tsx'
import { ConnectionSettings } from './ConnectionSettings.tsx'
import { RuleSettings } from './RuleSettings.tsx'
import css from './Sync.module.css'

export interface SyncSectionFace {
  sync: SyncFace
  /** The project's field catalog, so a rule's priority condition offers real values. */
  listWorkitemFields(request: ListWorkitemFieldsRequest): Promise<SafeWorkitemField[]>
}
/** Section props: the shell owns the panel, this section owns its two lists. */
export type SyncSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'taskList'> & InjectFace<SyncSectionFace>

/**
 * Sync settings as one page of the host's settings panel: connections and
 * rules, with each editor as a local view of this page rather than a modal of
 * its own. Nothing here starts a run — saving only records configuration, and a
 * rule is enabled from its own roster row.
 */
export function SyncSection({ sync: face, listWorkitemFields, t }: SyncSectionProps) {
  const [tab, setTab] = useState<'connections' | 'rules'>('connections')
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [connections, setConnections] = useState<SafeConnection[]>([])
  const [rules, setRules] = useState<SyncRule[]>([])
  const [editingConnection, setEditingConnection] = useState<SafeConnection | null>(null)
  const [editingRule, setEditingRule] = useState<SyncRule | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const generation = useRef(0)
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
    <div role="tabpanel" id={tab === 'connections' ? 'sync-connections-panel' : 'sync-rules-panel'} aria-labelledby={tab === 'connections' ? 'sync-connections-tab' : 'sync-rules-tab'}>
      {loading ? <p>{t('loading')}</p> : tab === 'connections' ? view === 'edit'
        ? <ConnectionSettings key={editingConnection?.id ?? 'new'} connection={editingConnection} face={face} t={t} onSaved={async next => { setEditingConnection(next); await saved() }} onBack={back} onDeleted={removed} />
        : <>
          <div className={css.sectionHeading}><h3>{t('syncConnectionsTab')}</h3><Button variant="primary" onClick={() => { setEditingConnection(null); setView('edit'); setNotice('') }}>{t('syncNewConnection')}</Button></div>
          {connections.length === 0 && <p className={css.hint}>{t('syncNoConnections')}</p>}
          <ul className={css.cards}>{connections.map(connection => <li className={css.connectionCard} key={connection.id}>
            <span className={css.platformBadge} data-platform={connection.platform}>{t(connection.platform === 'tapd' ? 'syncTapdBadge' : 'syncYunxiaoBadge')}</span>
            <div className={css.cardText}><strong>{connection.name}</strong><small>{t(connection.platform === 'tapd' ? 'syncTapd' : 'syncYunxiao')} · {rules.filter(rule => rule.connectionId === connection.id).length} {t('syncRule')}</small></div>
            <Switch label={t('syncEnableConnection')} checked={connection.enabled} disabled={!connection.credentialPresent}
              onChange={next => void toggleEnabled(connection, next)} />
            <Button size="sm" aria-label={`${t('syncConfigure')}: ${connection.name}`} onClick={() => { setEditingConnection(connection); setView('edit'); setNotice('') }}>{t('syncConfigure')} ›</Button>
          </li>)}</ul>
        </>
        : view === 'edit'
          ? <RuleSettings key={editingRule?.id ?? 'new'} rule={editingRule} connections={connections} face={face}
            listWorkitemFields={listWorkitemFields} t={t} onSaved={saved} onBack={back} onDeleted={removed} />
          : <>
            <div className={css.sectionHeading}><h3>{t('syncRule')}</h3><Button variant="primary" disabled={connections.length === 0} onClick={() => { setEditingRule(null); setView('edit'); setNotice('') }}>{t('syncNewRule')}</Button></div>
            {rules.length === 0 && <p className={css.hint}>{t('syncNoRules')}</p>}
            <ul className={css.cards}>{rules.map(rule => <li key={rule.id} className={css.connectionCard}>
              <div className={css.cardText}><strong>{rule.projectName ?? rule.projectId}</strong><small>{connections.find(item => item.id === rule.connectionId)?.name} · {t('syncConditionCount').replace('{count}', String(rule.conditions.length))}</small></div>
              <Switch label={t('syncEnableRule')} checked={rule.enabled} onChange={next => void toggleRuleEnabled(rule, next)} />
              <Button size="sm" aria-label={`${t('edit')}: ${rule.projectId}`} onClick={() => { setEditingRule(rule); setView('edit'); setNotice('') }}>{t('edit')}</Button>
            </li>)}</ul>
          </>}
    </div>
  </section>
}
