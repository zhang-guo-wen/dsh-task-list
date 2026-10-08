import { useState } from 'react'
import { Button, Checkbox, Input, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Option, TypeCapabilities, TypeMapping } from '../../sync/dto.ts'
import type { TaskStatus } from '../../types.ts'
import type { SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

export function Choice({ label, value, options, onChange, disabled = false, autofocus = false }: { label: string; value: string; options: readonly Option[]; onChange: (id: string) => void; disabled?: boolean; autofocus?: boolean }) {
  const [open, setOpen] = useState(false)
  return <div className={css.choice}><span>{label}</span><Menu open={open} onClose={() => setOpen(false)} selectedId={value} items={options.map(option => ({ id: option.id, label: option.label }))}
    onSelect={id => { onChange(id); setOpen(false) }} anchor={<Button data-modal-autofocus={autofocus || undefined} aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled || options.length === 0} onClick={() => setOpen(!open)}>{options.find(option => option.id === value)?.label ?? '—'}</Button>} /></div>
}
export function CandidateChecks({ label, options, selected, onChange }: { label: string; options: readonly Option[]; selected: readonly string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className={css.candidates}><legend>{label}</legend>{options.map(option => <Checkbox key={option.id} label={option.label} checked={selected.includes(option.id)} onChange={checked => onChange(checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} />)}</fieldset>
}
const statuses: TaskStatus[] = ['todo', 'in_progress', 'done']
export function mappingReady(mapping: TypeMapping, capability: TypeCapabilities): boolean {
  return !('unsupported' in capability.workflow) && !capability.workflow.readOnly && !('unsupported' in capability.representation) && capability.representation.roundTrip && capability.readStates.length > 0 && capability.readStates.every(state => mapping.readStates[state.id]) && (!mapping.optionalFields.includes('priority') || ['low', 'medium', 'high', 'urgent'].every(priority => mapping.valueMaps.priority?.[priority]?.trim())) && (!mapping.optionalFields.includes('tags') || Object.keys(mapping.valueMaps.tags ?? {}).length > 0) && statuses.every(state => mapping.readStates[mapping.writeStates[state]] === state && capability.writeStates.some(option => option.id === mapping.writeStates[state]))
}
export function RuleFields({ mapping, capability, t, onChange, tapd }: { mapping: TypeMapping; capability: TypeCapabilities; t: SyncTranslate; onChange: (next: TypeMapping) => void; tapd: boolean }) {
  const local = statuses.map(id => ({ id, label: t(id === 'in_progress' ? 'inProgress' : id) }))
  return <fieldset className={css.mapping}>
    <legend>{mapping.typeId}</legend>
    {tapd && <Choice label={t('syncCategory')} value={mapping.category} options={['story', 'bug', 'task'].map(id => ({ id, label: id }))} onChange={category => onChange({ ...mapping, category })} />}
    {('unsupported' in capability.workflow || capability.workflow.readOnly || 'unsupported' in capability.representation || !capability.representation.roundTrip) && <p>{t('syncUnsupported')}</p>}
    {capability.candidateFields.map(candidate => <div key={candidate.field}>
      <Checkbox label={t(candidate.field === 'priority' ? 'priorityLabel' : candidate.field)} checked={mapping.optionalFields.includes(candidate.field)} disabled={!candidate.writable} onChange={checked => onChange({ ...mapping, optionalFields: checked ? [...mapping.optionalFields, candidate.field] : mapping.optionalFields.filter(field => field !== candidate.field), fieldIds: { ...mapping.fieldIds, [candidate.field]: candidate.remoteId } })} />
      {mapping.optionalFields.includes(candidate.field) && candidate.field === 'priority' && <div>{(['low', 'medium', 'high', 'urgent'] as const).map(priority => <label key={priority}>{t(priority)}<Input aria-label={`${t('priorityLabel')}: ${t(priority)}`} value={mapping.valueMaps.priority?.[priority] ?? ''} onChange={event => onChange({ ...mapping, valueMaps: { ...mapping.valueMaps, priority: { ...mapping.valueMaps.priority, [priority]: event.target.value } } })} /></label>)}</div>}
      {mapping.optionalFields.includes(candidate.field) && candidate.field === 'tags' && <>
        <p>{t('syncExistingTags')}</p>
        <Input aria-label={t('tags')} placeholder={t('syncTagMaps')} defaultValue={Object.entries(mapping.valueMaps.tags ?? {}).map(([local, remote]) => `${local}=${remote}`).join(', ')} onBlur={event => {
          const tags: Record<string, string> = {}
          for (const pair of event.target.value.split(',')) { const index = pair.indexOf('='); if (index > 0) tags[pair.slice(0, index).trim()] = pair.slice(index + 1).trim() }
          onChange({ ...mapping, valueMaps: { ...mapping.valueMaps, tags } })
        }} />
      </>}
    </div>)}
    <h4>{t('syncReadMap')}</h4>
    {capability.readStates.map(state => <Choice key={state.id} label={state.label} options={local} value={mapping.readStates[state.id] ?? ''} onChange={status => onChange({ ...mapping, readStates: { ...mapping.readStates, [state.id]: status as TaskStatus } })} />)}
    <h4>{t('syncWriteMap')}</h4>
    {local.map(state => <Choice key={state.id} label={state.label} options={capability.writeStates} value={mapping.writeStates[state.id as TaskStatus] ?? ''} onChange={remote => onChange({ ...mapping, writeStates: { ...mapping.writeStates, [state.id]: remote } })} />)}
  </fieldset>
}
