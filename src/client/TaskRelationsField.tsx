import { useMemo, useState } from 'react'
import type { TaskKey } from './locales.ts'
import css from './TaskRelationsField.module.css'

/** One row the parent and dependency pickers offer. */
export interface RelationOption {
  id: string
  title: string
}

export interface TaskRelationsFieldProps {
  t: (key: TaskKey) => string
  /** Every task the parent picker may offer; the caller has already excluded the edited task and its descendants. */
  options: readonly RelationOption[]
  /** Parent currently selected, or null for a root task. */
  parentId: string | null
  /** Ids this task waits on. */
  blockingIds: readonly string[]
  /** Id of the task being edited; absent while composing a new one. */
  selfId?: string | undefined
  disabled?: boolean
  onChange(next: { parentId: string | null; blockingIds: string[] }): void
}

/**
 * Offer every task the caller passed; a selected row stays visible even when it
 * is outside that list, so an existing relation never disappears from the form.
 */
function titlesOf(options: readonly RelationOption[], selected: readonly string[]): Map<string, string> {
  const map = new Map(options.map(option => [option.id, option.title]))
  for (const id of selected) if (!map.has(id)) map.set(id, id)
  return map
}

/**
 * Parent and dependency editor of the task composer. It reports the selection
 * only: the composer persists it, and the Host remains the authority that
 * refuses a cycle.
 */
export function TaskRelationsField({ t, options, parentId, blockingIds, selfId, disabled, onChange }: TaskRelationsFieldProps): JSX.Element {
  const [dependencyText, setDependencyText] = useState('')
  const selected = useMemo(
    () => [parentId, ...blockingIds].filter((id): id is string => id !== null),
    [parentId, blockingIds],
  )
  const titles = useMemo(() => titlesOf(options, selected), [options, selected])

  const addDependency = (id: string): void => {
    if (id === '' || id === selfId || blockingIds.includes(id)) return
    onChange({ parentId, blockingIds: [...blockingIds, id] })
    setDependencyText('')
  }

  const removeDependency = (id: string): void => {
    onChange({ parentId, blockingIds: blockingIds.filter(current => current !== id) })
  }

  const needle = dependencyText.trim().toLocaleLowerCase()
  const candidates = [...titles]
    .filter(([id, title]) => id !== selfId && id !== parentId
      && (needle === '' || title.toLocaleLowerCase().includes(needle)))

  return <section className={css.field} data-field="relations">
    <div className={css.group}>
      <label className={css.label}>{t('parentTask')}
        <select value={parentId ?? ''} disabled={disabled} onChange={event => onChange({
          parentId: event.target.value === '' ? null : event.target.value,
          blockingIds: [...blockingIds],
        })}>
          <option value="">{t('noParent')}</option>
          {[...titles].filter(([id]) => id !== selfId).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>
    </div>
    <div className={css.group}>
      <span className={css.label}>{t('dependencies')}</span>
      <p className={css.hint}>{t('dependenciesHint')}</p>
      {blockingIds.length === 0 ? <p className={css.empty}>{t('dependencyEmpty')}</p> : <ul className={css.chips}>
        {blockingIds.map(id => <li key={id} className={css.chip}>
          <span className={css.chipTitle} title={titles.get(id) ?? id}>{titles.get(id) ?? id}</span>
          <button type="button" className={css.chipRemove} disabled={disabled}
            aria-label={`${t('removeDependency')}: ${titles.get(id) ?? id}`} title={t('removeDependency')}
            onClick={() => removeDependency(id)}>×</button>
        </li>)}
      </ul>}
      <div className={css.picker}>
        <input value={dependencyText} disabled={disabled} placeholder={t('dependencySearch')}
          aria-label={t('dependencySearch')} onChange={event => setDependencyText(event.target.value)} />
        <select value="" disabled={disabled || candidates.length === 0} aria-label={t('addDependency')}
          onChange={event => addDependency(event.target.value)}>
          <option value="">{candidates.length === 0 ? t('dependencyEmpty') : t('addDependency')}</option>
          {candidates.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </div>
    </div>
  </section>
}
