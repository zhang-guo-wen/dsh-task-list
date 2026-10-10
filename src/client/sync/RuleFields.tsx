import { useState } from 'react'
import { Button, IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Option, StatusWriteStates, SyncMetadata } from '../../sync/dto.ts'
import { statusMappingReady } from '../../sync/mapping.ts'
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

export const RULE_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done']

/**
 * Every status the project's work-item types expose, deduplicated by id. The
 * platform reports statuses per type; a rule maps one local status to one of
 * them, so the union is what the editor offers.
 */
export function projectStatuses(metadata: SyncMetadata | null): Option[] {
  if (metadata === null) return []
  const out = new Map<string, Option>()
  for (const capability of metadata.typeCapabilities) {
    for (const status of capability.writeStates) if (!out.has(status.id)) out.set(status.id, status)
  }
  return [...out.values()]
}

/**
 * The three local statuses with the platform status each one writes. Every row
 * is required: a rule that cannot map all three is refused before it is enabled.
 */
export function StatusWriteMap({ value, options, t, onChange }: {
  value: StatusWriteStates
  options: readonly Option[]
  t: SyncTranslate
  onChange: (next: StatusWriteStates) => void
}) {
  return <div className={css.statusMap} role="group" aria-label={t('syncStatusMap')}>
    {RULE_STATUSES.map(status => <div className={css.statusMapRow} key={status}>
      <span className={css.fieldLabel}>{t(status === 'in_progress' ? 'inProgress' : status)}</span>
      <Choice label={`${t('syncStatusTarget')} · ${t(status === 'in_progress' ? 'inProgress' : status)}`}
        value={value[status] ?? ''} options={options}
        onChange={id => onChange({ ...value, [status]: id })} />
    </div>)}
    {!statusMappingReady(value) && <p className={css.error}>{t('syncMappingRequired')}</p>}
  </div>
}
