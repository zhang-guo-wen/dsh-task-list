import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Modal, SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SafeConnection, SyncRule } from '../../sync/dto.ts'
import type { SyncFace } from './face.ts'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import { ConnectionSettings } from './ConnectionSettings.tsx'
import { RuleSettings } from './RuleSettings.tsx'
import css from './Sync.module.css'

export interface WorkspaceChoice { workspaceId: string; title: string }
export function SyncSettings({ face, t, workspaces, onClose, onSaved }: { face: SyncFace; t: SyncTranslate; workspaces: readonly WorkspaceChoice[]; onClose: () => void; onSaved: () => void }) {
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
  const saved = async () => { await refresh(); setNotice(t('syncSaved')); onSaved() }
  const back = () => setView('list')
  return <Modal open title={t('syncSettings')} closeLabel={t('syncClose')} onClose={onClose} className={css.modal!} contentClassName={css.modalContent!} footer={<div className={css.modalFooter}><span>{t('syncScope')}</span><Button onClick={onClose}>{t('syncClose')}</Button></div>}>
    <div className={css.settings}>
      <SegmentedTabs value={tab} label={t('syncSettings')} className={css.settingsTabs} items={[
        { value: 'connections', label: `${t('syncConnectionsTab')} ${connections.length}`, id: 'sync-connections-tab', panelId: 'sync-connections-panel' },
        { value: 'rules', label: `${t('syncRulesTab')} ${rules.length}`, id: 'sync-rules-tab', panelId: 'sync-rules-panel' },
      ]} onChange={next => { setTab(next); setView('list'); setNotice('') }} />
      {error !== null && <SyncFailure error={error} t={t} />}
      {notice && <p role="status">{notice}</p>}
      <div role="tabpanel" id={tab === 'connections' ? 'sync-connections-panel' : 'sync-rules-panel'} aria-labelledby={tab === 'connections' ? 'sync-connections-tab' : 'sync-rules-tab'}>
        {loading ? <p>{t('loading')}</p> : tab === 'connections' ? view === 'edit'
          ? <ConnectionSettings key={editingConnection?.id ?? 'new'} connection={editingConnection} face={face} t={t} onSaved={async next => { setEditingConnection(next); await saved() }} onBack={back} />
          : <>
            <div className={css.sectionHeading}><div><h3>{t('syncConnectionsTab')}</h3><p>{t('syncConnectionIntro')}</p></div><Button variant="primary" onClick={() => { setEditingConnection(null); setView('edit'); setNotice('') }}>{t('syncNewConnection')}</Button></div>
            {connections.length === 0 && <p className={css.hint}>{t('syncNoConnections')}</p>}
            <ul className={css.cards}>{connections.map(connection => <li className={css.connectionCard} key={connection.id}>
              <span className={css.platformBadge} data-platform={connection.platform}>{connection.platform === 'tapd' ? 'T' : '云'}</span>
              <div className={css.cardText}><strong>{connection.name}</strong><small>{connection.platform === 'tapd' ? 'TAPD' : '云效 Projex'} · {rules.filter(rule => rule.connectionId === connection.id).length} {t('syncRule')}</small></div>
              <span className={css.connectionState} data-enabled={connection.enabled}>{t(connection.credentialPresent ? connection.enabled ? 'syncEnabled' : 'syncDisabled' : 'syncCredentialMissing')}</span>
              <Button size="sm" aria-label={`${t('syncConfigure')}: ${connection.name}`} onClick={() => { setEditingConnection(connection); setView('edit'); setNotice('') }}>{t('syncConfigure')} ›</Button>
            </li>)}</ul>
            <div className={css.hint}>{t('syncCredentialHint')}</div>
          </>
          : view === 'edit'
            ? <RuleSettings key={editingRule?.id ?? 'new'} rule={editingRule} connections={connections} face={face} workspaces={workspaces} t={t} onSaved={saved} onBack={back} />
            : <>
              <div className={css.sectionHeading}><div><h3>{t('syncRule')}</h3><p>{t('syncRuleIntro')}</p></div><Button variant="primary" disabled={connections.length === 0} onClick={() => { setEditingRule(null); setView('edit'); setNotice('') }}>{t('syncNewRule')}</Button></div>
              {rules.length === 0 && <p className={css.hint}>{t('syncNoRules')}</p>}
              <ul className={css.cards}>{rules.map(rule => <li key={rule.id} className={css.connectionCard}>
                <div className={css.cardText}><strong>{rule.projectId}</strong><small>{connections.find(item => item.id === rule.connectionId)?.name} · {rule.filters.typeIds.join(', ')}</small></div>
                <span className={css.connectionState} data-enabled={rule.enabled}>{t(rule.enabled ? 'syncEnabled' : 'syncDisabled')}</span>
                <Button size="sm" aria-label={`${t('edit')}: ${rule.projectId}`} onClick={() => { setEditingRule(rule); setView('edit'); setNotice('') }}>{t('edit')}</Button>
              </li>)}</ul>
              <div className={css.hint}>{t('syncConflict')}</div>
            </>}
      </div>
    </div>
  </Modal>
}
