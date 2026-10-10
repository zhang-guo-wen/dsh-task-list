import { useState } from 'react'
import { Button, Input, IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Option, WorkitemFilterCondition } from '../../sync/dto.ts'
import { CONDITION_FIELDS, type ConditionFieldSpec, type WorkitemFilterField } from '../../sync/query/filters.ts'
import type { TaskKey } from '../locales.ts'
import type { SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

/**
 * The rule's query editor. The field list is the same verified matrix the task
 * list's filter bar uses, so a rule can select exactly what that bar can select
 * (状态、状态阶段、负责人、创建者、优先级、迭代、类型、创建时间) and the platform
 * applies it — a rule never downloads the project to filter it locally.
 */
const FIELD_LABELS: Readonly<Record<WorkitemFilterField, TaskKey>> = {
  status: 'filterStatus', statusStage: 'filterStatusStage', assignedTo: 'filterAssignee',
  creator: 'filterCreator', priority: 'filterPriority', sprint: 'filterSprint',
  workitemType: 'filterType', gmtCreate: 'filterCreated', gmtModified: 'syncFilterUpdated',
  updateStatusAt: 'syncFilterStatusChanged', tag: 'syncFilterTag', subject: 'filterTitlePlaceholder',
}

export const RULE_CONDITION_FIELDS = CONDITION_FIELDS.map(spec => ({ spec, label: FIELD_LABELS[spec.field] }))

/** Candidate values one condition's editor can offer, by the field's own source. */
export interface ConditionOptions {
  status: Option[]
  stage: Option[]
  user: Option[]
  priority: Option[]
  sprint: Option[]
  type: Option[]
}

export const EMPTY_CONDITION_OPTIONS: ConditionOptions = { status: [], stage: [], user: [], priority: [], sprint: [], type: [] }

function optionsFor(spec: ConditionFieldSpec, options: ConditionOptions): readonly Option[] {
  switch (spec.source) {
    case 'status': return options.status
    case 'stage': return options.stage
    case 'user': return options.user
    case 'priority': return options.priority
    case 'sprint': return options.sprint
    case 'type': return options.type
    default: return []
  }
}

/** One multi-select menu; the trigger names the selection so a list never reads as a bare count. */
function ValueChoice({ label, options, selected, onChange, empty }: {
  label: string
  options: readonly Option[]
  selected: readonly string[]
  onChange: (ids: string[]) => void
  empty: string
}) {
  const [open, setOpen] = useState(false)
  const labels = selected.map(id => options.find(option => option.id === id)?.label ?? id)
  const summary = labels.length === 0 ? empty : labels.length === 1 ? labels[0]! : `${labels[0]} +${labels.length - 1}`
  return <Menu open={open} onClose={() => setOpen(false)} selectedIds={selected}
    items={options.map(option => ({ id: option.id, label: option.label }))} className={css.choiceAnchor}
    onSelect={id => onChange(selected.includes(id) ? selected.filter(current => current !== id) : [...selected, id])}
    anchor={<Button variant="outline" aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={options.length === 0}
      onClick={() => setOpen(!open)}><span className={css.choiceValue}>{summary}</span><IconChevronDownOutlineRegular size={14} /></Button>} />
}

function FieldChoice({ label, value, onChange, t, fields }: { label: string; value: WorkitemFilterField; onChange: (field: WorkitemFilterField) => void; t: SyncTranslate; fields: typeof RULE_CONDITION_FIELDS }) {
  const [open, setOpen] = useState(false)
  const current = RULE_CONDITION_FIELDS.find(entry => entry.spec.field === value)?.label
  return <Menu open={open} onClose={() => setOpen(false)} selectedId={value}
    items={fields.map(entry => ({ id: entry.spec.field, label: t(entry.label) }))} className={css.choiceAnchor}
    onSelect={id => { onChange(id as WorkitemFilterField); setOpen(false) }}    anchor={<Button variant="outline" aria-label={label} aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen(!open)}><span className={css.choiceValue}>{current === undefined ? '—' : t(current)}</span><IconChevronDownOutlineRegular size={14} /></Button>} />
}

/** A date-range condition: one day or an inclusive pair, both as `YYYY-MM-DD`. */
function DateRange({ from, to, onChange, t }: { from: string; to: string; onChange: (from: string, to: string) => void; t: SyncTranslate }) {
  return <div className={css.range}>
    <input type="date" aria-label={`${t('filterCreated')} ${t('syncConditionFrom')}`} value={from} onChange={event => onChange(event.target.value, to)} />
    <span aria-hidden="true">–</span>
    <input type="date" aria-label={`${t('filterCreated')} ${t('syncConditionTo')}`} value={to} onChange={event => onChange(from, event.target.value)} />
  </div>
}

export function ConditionBuilder({ conditions, options, t, onChange, platform = 'yunxiao' }: {
  conditions: readonly WorkitemFilterCondition[]
  options: ConditionOptions
  t: SyncTranslate
  onChange: (next: WorkitemFilterCondition[]) => void
  platform?: 'yunxiao' | 'tapd'
}) {
  const fields = platform === 'tapd' ? RULE_CONDITION_FIELDS.filter(entry => !['statusStage', 'updateStatusAt'].includes(entry.spec.field)) : RULE_CONDITION_FIELDS
  const update = (index: number, patch: Partial<WorkitemFilterCondition>): void => {
    onChange(conditions.map((condition, position) => position === index ? { ...condition, ...patch } : condition))
  }
  const remove = (index: number): void => { onChange(conditions.filter((_unused, position) => position !== index)) }
  /** A condition always names the field's primary operator, so the stored query
   *  is explicit instead of relying on the platform's own default. */
  const primaryOperator = (field: string): NonNullable<WorkitemFilterCondition['operator']> =>
    CONDITION_FIELDS.find(entry => entry.field === field)?.operators[0] ?? 'EQUALS'
  const add = (): void => {
    const used = new Set(conditions.map(condition => condition.field))
    const free = fields.find(entry => !used.has(entry.spec.field)) ?? fields[0]!
    onChange([...conditions, { field: free.spec.field, operator: primaryOperator(free.spec.field), value: [] }])
  }
  return <div className={css.conditions}>
    <div className={css.conditionList} role="group" aria-label={t('syncConditions')}>
      {conditions.map((condition, index) => {
        const spec = CONDITION_FIELDS.find(entry => entry.field === condition.field)
        if (spec === undefined) return null
        const isDate = spec.source === 'date'
        return <div className={css.conditionRow} key={`${condition.field}-${index}`}>
          <FieldChoice label={`${t('syncConditionField')} ${index + 1}`} value={condition.field as WorkitemFilterField}
            t={t} fields={fields}
            onChange={field => {
              const next = CONDITION_FIELDS.find(entry => entry.field === field)!
              // Replace rather than patch: a previous date range's toValue must
              // not leak into a text/status condition and fail rule validation.
              onChange(conditions.map((condition, position) => position === index
                ? { field, operator: next.operators[0] ?? 'EQUALS', value: [], ...(next.source === 'date' ? { toValue: '' } : {}) }
                : condition))
            }} />
          {isDate
            ? <DateRange from={condition.value[0] ?? ''} to={condition.toValue ?? ''} t={t}
              onChange={(from, to) => update(index, { value: from === '' ? [] : [from], toValue: to })} />
            : spec.source === 'text' || spec.source === 'stage'
              ? <Input aria-label={`${spec.field} ${index + 1}`} value={condition.value.join(',')} maxLength={200} placeholder={t(spec.source === 'stage' ? 'filterStageHint' : 'syncConditionAny')}
                onChange={event => update(index, { value: event.target.value.trim() ? (spec.source === 'stage' ? event.target.value.split(',').map(value => value.trim()).filter(Boolean) : [event.target.value]) : [] })} />
              : <div><ValueChoice label={`${spec.field} ${index + 1}`} options={optionsFor(spec, options)} selected={condition.value} empty={t('syncConditionAny')}
                onChange={value => update(index, { value })} />
                {optionsFor(spec, options).length === 0 && <small>{t('syncNoCandidates')}</small>}</div>}
          <button type="button" className={css.conditionRemove} aria-label={`${t('filterRemove')} ${index + 1}`} onClick={() => remove(index)}>×</button>
        </div>
      })}
    </div>
    <div className={css.conditionActions}>
      <Button variant="outline" size="sm" onClick={add}>{t('syncConditionAdd')}</Button>
      <p className={css.conditionHint}>{t('syncConditionHint')}</p>
    </div>
  </div>
}
