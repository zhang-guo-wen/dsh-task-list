import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SafeConnection, SyncMetadata, SyncRule, TypeMapping } from '../../sync/dto.ts'
import type { SyncFace } from './face.ts'
import type { WorkspaceChoice } from './SyncSection.tsx'
import { projectIdFrom } from './ConnectionSettings.tsx'
import { MultiChoice, Choice, mappingReady, RuleFields } from './RuleFields.tsx'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'
const emptyFilters = () => ({ assignees: [], typeIds: [], iterationIds: [], statusIds: [] } as SyncRule['filters'])

export function RuleSettings({ rule, connections, face, workspaces, t, onBack, onSaved, onDeleted }: { rule: SyncRule | null; connections: SafeConnection[]; face: SyncFace; workspaces: readonly WorkspaceChoice[]; t: SyncTranslate; onBack: () => void; onSaved: () => Promise<void>; onDeleted?: () => Promise<void> }) {
  const [step, setStep] = useState(1)
  const [connectionId, setConnectionId] = useState(rule?.connectionId ?? connections[0]?.id ?? '')
  const [projectId, setProjectId] = useState(rule?.projectId ?? '')
  const [workspaceId, setWorkspaceId] = useState(rule?.workspaceId ?? '')
  const [filters, setFilters] = useState<SyncRule['filters']>(rule?.filters ?? emptyFilters())
  const [mappings, setMappings] = useState<TypeMapping[]>(rule?.mappings ?? [])
  const [metadata, setMetadata] = useState<SyncMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(rule?.enabled ?? false)
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  const saving = useRef(false)
  const connection = connections.find(item => item.id === connectionId)
  const scopeReady = Boolean(connection && projectId && mappings.length && !loading)
  const ready = Boolean(scopeReady && (connection?.credentialPresent || metadata?.credentialPresent) && mappings.every(mapping => {
    const capability = metadata?.typeCapabilities.find(cap => cap.typeId === mapping.typeId)
    return capability && mappingReady(mapping, capability)
  }))
  const load = async (id: string, project = '') => {
    if (!id) return
    const revision = ++generation.current
    setLoading(true); setError(null); setMetadata(null)
    try {
      const next = await face.getSyncMetadata({ connectionId: id, ...(project ? { projectId: project } : {}) })
      if (!mounted.current || revision !== generation.current) return
      setMetadata(next)
      setMappings(previous => previous.filter(mapping => next.typeCapabilities.some(cap => cap.typeId === mapping.typeId)))
    } catch (failure) { if (mounted.current && revision === generation.current) setError(failure) }
    finally { if (mounted.current && revision === generation.current) setLoading(false) }
  }
  useEffect(() => {
    mounted.current = true
    if (rule) void load(rule.connectionId, rule.projectId)
    return () => { mounted.current = false; generation.current++ }
  }, [rule?.id])
  const changeConnection = (id: string) => {
    generation.current++; setConnectionId(id); setProjectId(''); setFilters(emptyFilters()); setMappings([]); setEnabled(false); setMetadata(null); setLoading(false); setError(null)
  }
  const chooseTypes = (ids: string[]) => {
    setFilters(previous => ({ ...previous, typeIds: ids })); setEnabled(false)
    setMappings(previous => ids.map(typeId => previous.find(item => item.typeId === typeId) ?? {
      typeId, category: connection?.platform === 'tapd' ? typeId === 'bug' || typeId === 'task' ? typeId : 'story' : typeId,
      readStates: {}, writeStates: { todo: '', in_progress: '', done: '' }, optionalFields: [], fieldIds: {}, valueMaps: {},
    }))
  }
  const save = async () => {
    if (saving.current || !scopeReady || enabled && !ready) return
    saving.current = true; setBusy(true); setError(null)
    try {
      // The project's display name travels with the rule, so the roster can name
      // it later without asking the platform again.
      const projectName = metadata?.projects.find(item => item.id === projectId)?.label.trim() || null
      const values = { projectId, projectName, workspaceId: workspaceId || null, enabled, filters, mappings }
      if (rule) await face.updateSyncRule({ id: rule.id, revision: rule.revision, ...values })
      else await face.createSyncRule({ connectionId, ...values })
      await onSaved(); if (mounted.current) onBack()
    } catch (failure) { if (mounted.current) setError(failure) }
    finally { saving.current = false; if (mounted.current) setBusy(false) }
  }
  /** Two-step removal: the button arms on the first click, deletes on the second. */
  const remove = async () => {
    if (!rule || !onDeleted || busy) return
    if (!armed) { setArmed(true); return }
    setBusy(true); setError(null)
    try {
      await face.deleteSyncRule({ id: rule.id, revision: rule.revision })
      await onDeleted()
    } catch (failure) { setError(failure) }
    finally { if (mounted.current) setBusy(false) }
  }
  return <section className={css.editor}>
    <h3 className={css.editorTitle}>{t(rule ? 'edit' : 'syncNewRule')}</h3>
    <ol className={css.steps} aria-label={t('syncRule')}>
      {(['syncStepScope', 'syncStepMapping', 'syncStepConfirm'] as const).map((key, index) => <li key={key} aria-current={step === index + 1 ? 'step' : undefined} data-active={step === index + 1}>{t(key)}</li>)}
    </ol>
    {error !== null && <SyncFailure error={error} t={t} />}
    <div className={css.editorBox}>
    {step === 1 && <>
      <div className={css.formGrid}>
        <Choice label={t('syncConnection')} value={connectionId} options={connections.map(item => ({ id: item.id, label: item.name }))} disabled={Boolean(rule)} onChange={changeConnection} />
        {metadata === null
          ? <label>{t('syncProjectId')}<Input aria-label={t('syncProjectId')} placeholder={t('syncProjectHint')} value={projectId} disabled={loading}
            onChange={event => { generation.current++; setProjectId(projectIdFrom(event.target.value, connection?.platform)); setFilters(emptyFilters()); setMappings([]); setEnabled(false) }} /></label>
          : <Choice label={t('syncProject')} value={projectId} options={metadata.projects} disabled={loading} onChange={id => { setProjectId(id); setFilters(emptyFilters()); setMappings([]); setEnabled(false); void load(connectionId, id) }} />}
      </div>
      <Button disabled={!connection || loading} onClick={() => void load(connectionId, projectId)}>{loading ? t('loading') : t('syncLoadMetadata')}</Button>
      {metadata && projectId && <div className={css.formGrid}>
        <MultiChoice label={t('syncTypes')} options={metadata.types} selected={filters.typeIds} onChange={chooseTypes} empty={t('syncChoose')} />
        <MultiChoice label={t('syncAssignees')} options={metadata.members} selected={filters.assignees} onChange={assignees => setFilters({ ...filters, assignees })} empty={t('syncChoose')} />
        <MultiChoice label={t('syncIterations')} options={metadata.iterations} selected={filters.iterationIds} onChange={iterationIds => setFilters({ ...filters, iterationIds })} empty={t('syncChoose')} />
        <MultiChoice label={t('syncStatuses')} options={[...new Map(metadata.typeCapabilities.flatMap(cap => cap.readStates).map(state => [state.id, state])).values()]} selected={filters.statusIds} onChange={statusIds => setFilters({ ...filters, statusIds })} empty={t('syncChoose')} />
      </div>}
      {!scopeReady && <p>{t('syncScopeRequired')}</p>}
    </>}
    {step === 2 && <>
      {mappings.map(mapping => { const capability = metadata?.typeCapabilities.find(cap => cap.typeId === mapping.typeId); return capability && <RuleFields key={mapping.typeId} name={metadata?.types.find(item => item.id === mapping.typeId)?.label} t={t} mapping={mapping} capability={capability} tapd={connection?.platform === 'tapd'} onChange={next => { setMappings(previous => previous.map(item => item.typeId === next.typeId ? next : item)); setEnabled(false) }} /> })}
      {!ready && <p>{t('syncMappingRequired')}</p>}
    </>}
    {step === 3 && <>
      <h3>{t('syncRuleSummary')}</h3>
      <dl className={css.summary}>
        <dt>{t('syncConnection')}</dt><dd>{connection?.name}</dd>
        <dt>{t('syncProject')}</dt><dd>{metadata?.projects.find(item => item.id === projectId)?.label ?? projectId}</dd>
        <dt>{t('workspace')}</dt><dd>{workspaces.find(item => item.workspaceId === workspaceId)?.title ?? t('noWorkspace')}</dd>
        <dt>{t('syncTypes')}</dt><dd>{filters.typeIds.map(id => metadata?.types.find(item => item.id === id)?.label ?? id).join(', ')}</dd>
      </dl>
      <Checkbox label={t('syncEnableRule')} checked={enabled} disabled={!ready || busy} onChange={setEnabled} />
    </>}
    <div className={css.editorActions}>
      {/* Removal lives inside the rule's own editor, armed by a first click. */}
      {rule && onDeleted && <Button disabled={busy} onClick={() => void remove()}>{armed ? t('syncDeleteConfirm') : t('syncDeleteRule')}</Button>}
      <div className={css.editorButtons}>
        <Button disabled={busy} onClick={() => step === 1 ? onBack() : setStep(step - 1)}>{t(step === 1 ? 'cancel' : 'syncPrevious')}</Button>
        {step < 3 ? <Button variant="primary" disabled={step === 1 ? !scopeReady : !ready} onClick={() => setStep(step + 1)}>{t('syncNext')}</Button> : <Button variant="primary" disabled={busy || enabled && !ready} onClick={() => void save()}>{t('syncSaveRule')}</Button>}
      </div>
    </div>
    </div>
  </section>
}
