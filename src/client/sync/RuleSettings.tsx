import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ListWorkitemFieldsRequest, SafeConnection, SafeWorkitemField, StatusWriteStates, SyncMetadata, SyncRule,
  WorkitemConditionGroups, WorkitemFilterCondition,
} from '../../sync/dto.ts'
import type { SyncFace } from './face.ts'
import { Choice, projectStatuses, StatusWriteMap } from './RuleFields.tsx'
import { ConditionBuilder, EMPTY_CONDITION_OPTIONS, RULE_CONDITION_FIELDS, type ConditionOptions } from './RuleConditions.tsx'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

/**
 * The editor shows the query as one flat, ANDed list: that is what the task
 * list's filter bar does. A stored rule that carries several OR groups (written
 * by an older editor) is flattened into that same list rather than hidden.
 */
const flattenConditions = (rule: SyncRule | null): WorkitemFilterCondition[] =>
  rule === null ? [] : rule.conditions.flat()

/** One group means the conditions are ANDed, which is the editor's own wording. */
const toGroups = (conditions: readonly WorkitemFilterCondition[]): WorkitemConditionGroups =>
  conditions.every(condition => condition.value.length === 0) ? [] : [[...conditions.filter(condition => condition.value.some(value => value.trim() !== ''))]]

/** A new rule starts unmapped, so saving without choosing a target is refused. */
const emptyStatuses = (): StatusWriteStates => ({ todo: '', in_progress: '', done: '' })

/**
 * One rule's editor: pick the connection, pick a project from the list the
 * connection loads by itself, write the query, map the three statuses. The rule
 * is enabled from the roster row's switch, so this editor never carries one.
 */
export function RuleSettings({ rule, connections, face, listWorkitemFields, t, onBack, onSaved, onDeleted }: {
  rule: SyncRule | null
  connections: readonly SafeConnection[]
  face: SyncFace
  /** The project's own field catalog, used for the priority condition's values. */
  listWorkitemFields(request: ListWorkitemFieldsRequest): Promise<SafeWorkitemField[]>
  t: SyncTranslate
  onBack: () => void
  onSaved: () => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [step, setStep] = useState(1)
  const [connectionId, setConnectionId] = useState(rule?.connectionId ?? connections[0]?.id ?? '')
  const [projectId, setProjectId] = useState(rule?.projectId ?? '')
  const [conditions, setConditions] = useState<WorkitemFilterCondition[]>(flattenConditions(rule))
  const [statusWriteStates, setStatusWriteStates] = useState<StatusWriteStates>(rule?.statusWriteStates ?? emptyStatuses())
  const [metadata, setMetadata] = useState<SyncMetadata | null>(null)
  const [priorities, setPriorities] = useState<ConditionOptions['priority']>([])
  const [loadedProjectId, setLoadedProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  const saving = useRef(false)
  const connection = connections.find(item => item.id === connectionId)
  const scopeReady = Boolean(connection && projectId && loadedProjectId === projectId && !loading)
  const mappingComplete = Object.values(statusWriteStates).every(target => target.trim() !== '')
  const ready = Boolean(scopeReady && mappingComplete)
  /**
   * Load one connection's project list — and, once a project is chosen, the
   * members, iterations, types and statuses its query editor offers. The list is
   * read again for the chosen project so its own statuses are available; a
   * failure of the optional field catalog never blocks the editor.
   */
  const load = async (id: string, project = '') => {
    if (!id) return
    const revision = ++generation.current
    setLoading(true); setError(null); setMetadata(null); setPriorities([]); setLoadedProjectId('')
    try {
      let next = await face.getSyncMetadata({ connectionId: id, ...(project ? { projectId: project } : {}) })
      if (!mounted.current || revision !== generation.current) return
      setMetadata(next)
      // Preselection must perform the same project-scoped read as a click.
      // Connection metadata only contains projects, not the picker candidates.
      if (project === '') {
        project = next.projects[0]?.id ?? ''
        setProjectId(project)
        if (project === '') return
        next = await face.getSyncMetadata({ connectionId: id, projectId: project })
        if (!mounted.current || revision !== generation.current) return
        setMetadata(next)
      }
      setLoadedProjectId(project)
      // Priority is a project custom field; its candidate values come from the
      // field catalog the "more tasks" page already reads. A refused catalog only
      // costs that picker its options.
      try {
        const categories = connections.find(item => item.id === id)?.platform === 'tapd' ? 'story,bug,task' : 'Req,Bug,Task'
        const fields = await listWorkitemFields({ connectionId: id, projectId: project, categories })
        if (mounted.current && revision === generation.current) {
          setPriorities(fields.find(field => field.id === 'priority')?.options ?? [])
        }
      } catch (failure) {
        if (mounted.current && revision === generation.current) setError(failure)
      }
    } catch (failure) { if (mounted.current && revision === generation.current) setError(failure) }
    finally { if (mounted.current && revision === generation.current) setLoading(false) }
  }
  useEffect(() => {
    mounted.current = true
    void load(rule?.connectionId ?? connections[0]?.id ?? '', rule?.projectId ?? '')
    return () => { mounted.current = false; generation.current++ }
  }, [rule?.id])
  const changeConnection = (id: string) => {
    generation.current++; setConnectionId(id); setProjectId(''); setConditions([]); setStatusWriteStates(emptyStatuses()); setMetadata(null); setPriorities([]); setLoading(false); setError(null)
    void load(id)
  }
  const changeProject = (id: string) => {
    if (id === projectId && loadedProjectId === id) return
    setProjectId(id); setConditions([]); setStatusWriteStates(emptyStatuses()); void load(connectionId, id)
  }
  /** Values the query editor offers; each one comes from the platform's own list. */
  const options: ConditionOptions = {
    ...EMPTY_CONDITION_OPTIONS,
    status: projectStatuses(metadata, 'read'),
    user: metadata?.members ?? [],
    sprint: metadata?.iterations ?? [],
    type: metadata?.types ?? [],
    priority: priorities,
  }
  const statuses = projectStatuses(metadata)
  const save = async () => {
    if (saving.current || !ready) return
    saving.current = true; setBusy(true); setError(null)
    try {
      // The project's display name travels with the rule, so the roster can name
      // it later without asking the platform again. A rule no longer carries a
      // workspace: an imported task is global, and enabling happens in the roster.
      const projectName = metadata?.projects.find(item => item.id === projectId)?.label.trim() || null
      const values = { projectId, projectName, workspaceId: null, conditions: toGroups(conditions), statusWriteStates }
      if (rule) await face.updateSyncRule({ id: rule.id, revision: rule.revision, ...values })
      else await face.createSyncRule({ connectionId, ...values, enabled: false })
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
  // The summary names each condition's field in the reader's own language, using
  // the same label table the query editor shows.
  const conditionSummary = conditions.length === 0
    ? t('syncConditionAll')
    : conditions.map(condition => {
      const label = RULE_CONDITION_FIELDS.find(entry => entry.spec.field === condition.field)?.label
      return label === undefined ? condition.field : t(label)
    }).join('、')
  return <section className={css.editor}>
    <h3 className={css.editorTitle}>{t(rule ? 'edit' : 'syncNewRule')}</h3>
    <ol className={css.steps} aria-label={t('syncRule')}>
      {(['syncStepScope', 'syncStepQuery', 'syncStepStatus'] as const).map((key, index) => <li key={key} aria-current={step === index + 1 ? 'step' : undefined} data-active={step === index + 1}>{t(key)}</li>)}
    </ol>
    {error !== null && <><SyncFailure error={error} t={t} /><Button disabled={loading} onClick={() => void load(connectionId, projectId)}>{t('retry')}</Button></>}
    <div className={css.editorBox}>
    {step === 1 && <>
      <div className={css.formGrid}>
        {/* Opening the connection menu loads its projects, so the project picker
            below is ready as soon as a connection is chosen. */}
        <Choice label={t('syncConnection')} value={connectionId} options={connections.map(item => ({ id: item.id, label: item.name }))}
          onChange={changeConnection} onOpen={() => { if (metadata === null && connectionId !== '') void load(connectionId) }} />
        <Choice label={t('syncProject')} value={projectId} options={metadata?.projects ?? []} disabled={loading || connectionId === ''}
          onChange={changeProject} onOpen={() => { if (metadata === null && connectionId !== '') void load(connectionId) }} />
      </div>
      {loading && <p>{t('loading')}</p>}
      {!loading && metadata !== null && metadata.projects.length === 0 && <p>{t('moreTasksNoProject')}</p>}
      {!loading && (connection === undefined || connectionId === '') && <p>{t('syncScopeRequired')}</p>}
    </>}
    {step === 2 && <>
      <h4 className={css.editorTitle}>{t('syncConditions')}</h4>
      <ConditionBuilder conditions={conditions} options={options} t={t} platform={connection?.platform ?? 'yunxiao'} onChange={setConditions} />
      {loading && <p>{t('loading')}</p>}
    </>}
    {step === 3 && <>
      <h3>{t('syncRuleSummary')}</h3>
      <dl className={css.summary}>
        <dt>{t('syncConnection')}</dt><dd>{connection?.name}</dd>
        <dt>{t('syncProject')}</dt><dd>{metadata?.projects.find(item => item.id === projectId)?.label ?? projectId}</dd>
        <dt>{t('syncConditions')}</dt><dd>{conditionSummary}</dd>
      </dl>
      <h4 className={css.editorTitle}>{t('syncStatusMap')}</h4>
      <StatusWriteMap value={statusWriteStates} options={statuses} t={t} onChange={setStatusWriteStates} />
      <p className={css.conditionHint}>{t('syncStatusMapHint')}</p>
      {/* Enabling belongs to the roster row's switch, so a new rule is saved
          disabled and turned on from the list. */}
      {rule === null && <p className={css.conditionHint}>{t('syncEnableFromList')}</p>}
    </>}
    <div className={css.editorActions}>
      {/* Removal lives inside the rule's own editor, armed by a first click. */}
      {rule && onDeleted && <Button disabled={busy} onClick={() => void remove()}>{armed ? t('syncDeleteConfirm') : t('syncDeleteRule')}</Button>}
      <div className={css.editorButtons}>
        <Button disabled={busy} onClick={() => (step === 1 ? onBack() : setStep(step - 1))}>{t(step === 1 ? 'cancel' : 'syncPrevious')}</Button>
        {step < 3
          ? <Button variant="primary" disabled={step === 1 ? !scopeReady : !scopeReady} onClick={() => { setError(null); setStep(step + 1) }}>{t('syncNext')}</Button>
          : <Button variant="primary" disabled={busy || !ready} onClick={() => void save()}>{t('syncSaveRule')}</Button>}
      </div>
    </div>
    </div>
  </section>
}
