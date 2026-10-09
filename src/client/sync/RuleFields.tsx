import { useState } from 'react'
import { Button, Checkbox, IconChevronDownOutlineRegular, Input, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Option, TypeCapabilities, TypeMapping } from '../../sync/dto.ts'
import type { TaskStatus } from '../../types.ts'
import type { SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

export function Choice({ label, value, options, onChange, disabled = false, autofocus = false, onOpen }: { label: string; value: string; options: readonly Option[]; onChange: (id: string) => void; disabled?: boolean; autofocus?: boolean; onOpen?: () => void }) {
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.id === value)?.label
  // Label on its own line, control below: a bordered control with the value at
  // the left and a caret at the right, so a menu reads as a select next to the
  // inputs and a two-column form reads straight down. The trigger stays
  // clickable with no options yet, so opening it can be what fetches them.
  return <div className={css.field}><span className={css.fieldLabel}>{label}</span><Menu open={open} onClose={() => setOpen(false)} selectedId={value} items={options.map(option => ({ id: option.id, label: option.label }))}
    className={css.choiceAnchor}
    onSelect={id => { onChange(id); setOpen(false) }} anchor={<Button variant="outline" data-modal-autofocus={autofocus || undefined} aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => { if (!open) onOpen?.(); setOpen(!open) }}><span className={css.choiceValue}>{current ?? '—'}</span><IconChevronDownOutlineRegular size={14} /></Button>} /></div>
}
export function CandidateChecks({ label, options, selected, onChange }: { label: string; options: readonly Option[]; selected: readonly string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className={css.candidates}><legend>{label}</legend>{options.map(option => <Checkbox key={option.id} label={option.label} checked={selected.includes(option.id)} onChange={checked => onChange(checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} />)}</fieldset>
}

/**
 * One multi-select as a dropdown instead of a wall of checkboxes: the menu
 * stays open while rows are toggled, so a long candidate list costs one line.
 */
export function MultiChoice({ label, options, selected, onChange, empty }: { label: string; options: readonly Option[]; selected: readonly string[]; onChange: (ids: string[]) => void; empty: string }) {
  const [open, setOpen] = useState(false)
  // The trigger names what is selected — one label, or the first plus a count —
  // so a long list never reads as a bare number that looks like a chosen value.
  const labels = selected.map(id => options.find(option => option.id === id)?.label ?? id)
  const summary = labels.length === 0 ? empty : labels.length === 1 ? labels[0]! : `${labels[0]} +${labels.length - 1}`
  return <div className={css.field}><span className={css.fieldLabel}>{label}</span><Menu open={open} onClose={() => setOpen(false)} selectedIds={selected}
    items={options.map(option => ({ id: option.id, label: option.label }))} className={css.choiceAnchor}
    onSelect={id => onChange(selected.includes(id) ? selected.filter(current => current !== id) : [...selected, id])}
    anchor={<Button variant="outline" aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={options.length === 0}
      onClick={() => setOpen(!open)}><span className={css.choiceValue}>{summary}</span><IconChevronDownOutlineRegular size={14} /></Button>} /></div>
}
const statuses: TaskStatus[] = ['todo', 'in_progress', 'done']
export function mappingReady(mapping: TypeMapping, capability: TypeCapabilities): boolean {
  return !('unsupported' in capability.workflow) && !capability.workflow.readOnly && !('unsupported' in capability.representation) && capability.representation.roundTrip && capability.readStates.length > 0 && capability.readStates.every(state => mapping.readStates[state.id]) && (!mapping.optionalFields.includes('priority') || ['low', 'medium', 'high', 'urgent'].every(priority => mapping.valueMaps.priority?.[priority]?.trim())) && (!mapping.optionalFields.includes('tags') || Object.keys(mapping.valueMaps.tags ?? {}).length > 0) && statuses.every(state => mapping.readStates[mapping.writeStates[state]] === state && capability.writeStates.some(option => option.id === mapping.writeStates[state]))
}
export function RuleFields({ mapping, capability, name, t, onChange, tapd }: { mapping: TypeMapping; capability: TypeCapabilities; name?: string | undefined; t: SyncTranslate; onChange: (next: TypeMapping) => void; tapd: boolean }) {
  const local = statuses.map(id => ({ id, label: t(id === 'in_progress' ? 'inProgress' : id) }))
  return <fieldset className={css.mapping}>
    {/* The type's own name, not its opaque remote id. */}
    <legend>{name ?? mapping.typeId}</legend>
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
