import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, IconSettingsOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ListWorkitemFieldsRequest, ListWorkitemsRequest, Option, SafeConnection, SafeWorkitemDescription,
  SafeWorkitemField, SafeWorkitemPage, WorkitemFillField,
} from '../sync/dto.ts'
import {
  FILTER_FIELDS, MAX_CONDITIONS, buildFilterConditions,
  type DraftCondition, type FilterFieldId,
} from './workitem-filter.ts'
import { contentHtml } from './rich-text.ts'
import type { SyncFace } from './sync/face.ts'
import type { TaskKey } from './locales.ts'
import css from './MoreTasks.module.css'

/**
 * Category values the search endpoint accepts; it refuses an empty category.
 * The page no longer asks for one: the table lists requirements, defects and
 * tasks together, so the list request joins all three.
 */
const WORKITEM_CATEGORIES = ['Req', 'Bug', 'Task'] as const
const CATEGORIES = WORKITEM_CATEGORIES.join(',')

const PAGE_SIZES = [20, 50, 100, 200] as const

/** Options one condition's value editor can offer, per field source. */
interface FilterOptionSet {
  status: Option[]
  stage: Option[]
  user: Option[]
  priority: Option[]
  sprint: Option[]
  type: Option[]
}

const EMPTY_OPTIONS: FilterOptionSet = { status: [], stage: [], user: [], priority: [], sprint: [], type: [] }
const FILTER_SPECS = new Map(FILTER_FIELDS.map(field => [field.id, field]))

/** Content equality for the field catalog, so an identical reload keeps identity. */
function sameCatalog(current: SafeWorkitemField[] | null, next: SafeWorkitemField[]): boolean {
  if (current === null || current.length !== next.length) return false
  return current.every((field, index) => {
    const other = next[index]!
    return field.id === other.id && field.name === other.name && field.format === other.format
      && field.kind === other.kind && field.required === other.required
      && field.options.length === other.options.length
      && field.options.every((option, position) => option.id === other.options[position]?.id && option.label === other.options[position]?.label)
  })
}

/** A text-typed condition commits on blur or Enter rather than per keystroke. */
function CommittedText({ label, value, placeholder, onCommit }: {
  label: string
  value: string
  placeholder: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  return <input className={css.filterValue} value={draft} aria-label={label} placeholder={placeholder}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => { if (draft !== value) onCommit(draft) }}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onCommit(draft) } }} />
}

/**
 * A column is either a native list field the adapter projects directly, or one
 * custom field the platform configures — custom values arrive inside the same
 * `customFields` array, filtered to the selected ids.
 */
type ColumnSource = { kind: 'native'; field: string } | { kind: 'custom'; fieldId: string }

interface Column {
  /** Stable identity across catalog reloads. */
  key: string
  /** Platform name, used for custom fields that have no local label. */
  name: string
  localised: TaskKey | null
  source: ColumnSource
}

/** Native columns always offered, in this order, ahead of the platform's own list. */
const NATIVE_COLUMNS: { field: string; label: TaskKey }[] = [
  { field: 'serialNumber', label: 'moreTasksColSerial' },
  { field: 'subject', label: 'moreTasksColSubject' },
  { field: 'status', label: 'moreTasksColStatus' },
  { field: 'workitemType', label: 'moreTasksColType' },
  { field: 'assignedTo', label: 'moreTasksColAssignee' },
  { field: 'creator', label: 'moreTasksColCreator' },
  { field: 'sprint', label: 'moreTasksColSprint' },
  { field: 'labels', label: 'moreTasksColLabels' },
  { field: 'gmtCreate', label: 'moreTasksColCreated' },
  { field: 'gmtModified', label: 'moreTasksColUpdated' },
]

/** Platform field ids that map to a native projection field instead of a custom value. */
const NATIVE_BY_ID: Record<string, string> = {
  id: 'id', serialNumber: 'serialNumber', subject: 'subject', status: 'status', state: 'status',
  statusStage: 'statusStage', workitemType: 'workitemType', category: 'category', space: 'space',
  assignedTo: 'assignedTo', creator: 'creator', modifier: 'modifier', verifier: 'verifier',
  participants: 'participants', trackers: 'trackers', sprint: 'sprint', labels: 'labels',
  versions: 'versions', logicalStatus: 'logicalStatus', parentId: 'parentId',
  gmtCreate: 'gmtCreate', gmtModified: 'gmtModified', updateStatusAt: 'updateStatusAt',
}

const DEFAULT_NATIVE = ['serialNumber', 'subject', 'status', 'assignedTo', 'creator', 'gmtCreate']
const DEFAULT_CUSTOM = ['priority']

function formattedTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function referenceName(value: unknown): string {
  if (typeof value !== 'object' || value === null) return ''
  const record = value as Record<string, unknown>
  const name = typeof record.displayName === 'string' && record.displayName.trim() !== '' ? record.displayName : record.name
  return typeof name === 'string' ? name : ''
}

function namesOf(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(entry => referenceName(entry)).filter(name => name !== '').join('、')
}

/** Read one custom value out of the projected `customFields` array. */
function customFieldText(value: unknown, fieldId: string): string {
  if (!Array.isArray(value)) return ''
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    if (record.fieldId !== fieldId) continue
    const values = record.values
    if (!Array.isArray(values)) return ''
    return values.map(item => (typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).displayValue === 'string'
      ? (item as { displayValue: string }).displayValue
      : '')).filter(text => text !== '').join('、')
  }
  return ''
}

function nativeText(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  switch (field) {
    case 'subject':
    case 'serialNumber':
      return typeof value === 'string' ? value : ''
    case 'status':
    case 'workitemType':
    case 'assignedTo':
    case 'creator':
    case 'sprint':
      return referenceName(value)
    case 'labels':
    case 'participants':
      return namesOf(value)
    case 'gmtCreate':
    case 'gmtModified':
    case 'updateStatusAt':
      return typeof value === 'number' ? formattedTime(value) : ''
    default:
      return typeof value === 'string' ? value : ''
  }
}

function cellText(row: Record<string, unknown>, column: Column): string {
  return column.source.kind === 'native'
    ? nativeText(row, column.source.field)
    : customFieldText(row.customFields, column.source.fieldId)
}

/** The title column is frozen to the left while the rest scrolls sideways. */
function isSubject(column: Column): boolean {
  return column.source.kind === 'native' && column.source.field === 'subject'
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Build the column catalog: the native columns this page can always show, then
 * every field the platform configures for the category (custom fields included).
 * A platform field that maps to a native field reuses the local label.
 */
function buildCatalog(fields: SafeWorkitemField[]): Column[] {
  const catalog: Column[] = []
  const seen = new Set<string>()
  const push = (column: Column): void => {
    if (seen.has(column.key)) return
    seen.add(column.key)
    catalog.push(column)
  }
  const labelByField = new Map(NATIVE_COLUMNS.map(entry => [entry.field, entry.label]))
  for (const entry of NATIVE_COLUMNS) push({ key: `native:${entry.field}`, name: entry.field, localised: entry.label, source: { kind: 'native', field: entry.field } })
  for (const field of fields) {
    const native = NATIVE_BY_ID[field.id]
    if (native !== undefined) {
      const label = labelByField.get(native)
      push({ key: `native:${native}`, name: field.name, localised: label ?? null, source: { kind: 'native', field: native } })
      continue
    }
    push({ key: `custom:${field.id}`, name: field.name, localised: null, source: { kind: 'custom', fieldId: field.id } })
  }
  return catalog
}

/**
 * "More tasks": pick a connection and a project in the title row, choose the
 * columns from the platform's own field catalog (the settings icon in the table
 * head), then page through the work items. Requirements, defects and tasks are
 * listed together — there is no category filter. The list asks the Host for
 * exactly the shown fields, so no description body, comment thread or relation
 * list is fetched to render a row; a row's title opens the detail drawer.
 */
export function MoreTasks({ sync, listWorkitems, listWorkitemFields, getWorkitemDescription, close, onDraft, t }: PropsLocale<'taskList'> & {
  sync: SyncFace
  /** Stable function references: an inline object here re-triggers every effect. */
  listWorkitems(request: ListWorkitemsRequest): Promise<SafeWorkitemPage>
  listWorkitemFields(request: ListWorkitemFieldsRequest): Promise<SafeWorkitemField[]>
  getWorkitemDescription(request: { connectionId: string; projectId: string; id: string }): Promise<{ description: SafeWorkitemDescription | null }>
  /** Hand a work item to the task composer, with that connection's prefill set. */
  onDraft(row: Record<string, unknown>, description: SafeWorkitemDescription | null, fillFields: readonly WorkitemFillField[]): void
  close: () => void
}) {
  const [connections, setConnections] = useState<SafeConnection[] | null>(null)
  const [connectionId, setConnectionId] = useState('')
  const [projects, setProjects] = useState<Option[] | null>(null)
  const [projectId, setProjectId] = useState('')
  const [pageSize, setPageSize] = useState<number>(50)
  const [page, setPage] = useState(1)
  const [fields, setFields] = useState<SafeWorkitemField[] | null>(null)
  const [selected, setSelected] = useState<readonly string[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<SafeWorkitemPage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleInput, setTitleInput] = useState('')
  const [title, setTitle] = useState('')
  const [conditions, setConditions] = useState<readonly DraftCondition[]>([])
  const [options, setOptions] = useState<FilterOptionSet>(EMPTY_OPTIONS)
  const [detail, setDetail] = useState<{
    row: Record<string, unknown>
    loading: boolean
    error: string | null
    description: SafeWorkitemDescription | null
  } | null>(null)
  const detailSequence = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const sequence = useRef(0)

  useEffect(() => {
    heading.current?.focus()
    let cancelled = false
    sync.listSyncConnections()
      .then(list => {
        if (cancelled) return
        const usable = list.filter(connection => connection.platform === 'yunxiao')
        setConnections(usable)
        const first = usable.find(connection => connection.enabled) ?? usable[0]
        if (first !== undefined) setConnectionId(first.id)
      })
      .catch((failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure)) })
    return () => { cancelled = true }
  }, [sync])

  useEffect(() => {
    if (connectionId === '') { setProjects(null); setProjectId(''); return }
    let cancelled = false
    setProjects(null)
    setProjectId('')
    sync.getSyncMetadata({ connectionId })
      .then(metadata => {
        if (cancelled) return
        setProjects(metadata.projects)
        const first = metadata.projects[0]
        if (first !== undefined) setProjectId(first.id)
      })
      .catch((failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure)) })
    return () => { cancelled = true }
  }, [sync, connectionId])

  // The column catalog comes from the platform's own field config, so custom
  // fields (priority, story points, 所属模块…) are offered by their real names.
  // It is cleared only when the project really changes, and replaced only when
  // the payload differs: a fresh array of the same fields would cascade into a
  // new projection and re-fetch the list on every parent render.
  const catalogKey = `${connectionId}\u0000${projectId}`
  const loadedCatalogKey = useRef<string | null>(null)
  useEffect(() => {
    if (connectionId === '' || projectId === '') { setFields(null); loadedCatalogKey.current = null; return }
    if (loadedCatalogKey.current !== catalogKey) {
      loadedCatalogKey.current = catalogKey
      setFields(null)
    }
    let cancelled = false
    listWorkitemFields({ connectionId, projectId, categories: CATEGORIES })
      .then(list => {
        if (cancelled) return
        setFields(current => (sameCatalog(current, list) ? current : list))
      })
      .catch(() => { if (!cancelled) setFields(current => (current !== null && current.length === 0 ? current : [])) })
    return () => { cancelled = true }
  }, [listWorkitemFields, connectionId, projectId, catalogKey])

  const catalog = useMemo(() => buildCatalog(fields ?? []), [fields])
  const byKey = useMemo(() => new Map(catalog.map(column => [column.key, column])), [catalog])

  // Candidate values for the filter bar: members/iterations/types/statuses come
  // from the sync metadata, list options from the platform's field config.
  useEffect(() => {
    if (connectionId === '' || projectId === '') { setOptions(EMPTY_OPTIONS); return }
    let cancelled = false
    sync.getSyncMetadata({ connectionId, projectId })
      .then(metadata => {
        if (cancelled) return
        const statuses = new Map<string, Option>()
        for (const capability of metadata.typeCapabilities) {
          for (const state of capability.readStates) statuses.set(state.id, state)
        }
        setOptions({
          status: [...statuses.values()],
          stage: [],
          user: metadata.members,
          priority: (fields ?? []).find(field => field.id === 'priority')?.options ?? [],
          sprint: metadata.iterations,
          type: metadata.types,
        })
      })
      .catch(() => { if (!cancelled) setOptions(EMPTY_OPTIONS) })
    return () => { cancelled = true }
  }, [sync, connectionId, projectId, fields])

  // The default columns can only be chosen once the catalog is known (a custom
  // field's key depends on its field id), so selection starts empty and fills in
  // exactly once — a later reload never overwrites the user's own choice.
  useEffect(() => {
    if (fields === null || selected !== null) return
    const defaults = catalog.filter(column => column.source.kind === 'native'
      ? DEFAULT_NATIVE.includes(column.source.field)
      : DEFAULT_CUSTOM.includes(column.source.fieldId))
    const fallback = catalog.filter(column => column.source.kind === 'native' || column.source.fieldId !== 'priority').slice(0, 6)
    setSelected((defaults.length > 0 ? defaults : fallback).map(column => column.key))
  }, [fields, selected, catalog])

  const columns = useMemo(
    () => (selected ?? []).flatMap(key => { const column = byKey.get(key); return column === undefined ? [] : [column] }),
    [selected, byKey],
  )
  const label = useCallback((column: Column): string => (column.localised === null ? column.name : t(column.localised)), [t])

  const load = useCallback(() => {
    // Waiting for the catalog avoids a throwaway request that asks for `id` only.
    if (connectionId === '' || projectId === '' || selected === null || fields === null) return
    const id = ++sequence.current
    setBusy(true)
    setError(null)
    const native = new Set<string>(['id'])
    const customIds: string[] = []
    for (const column of columns) {
      if (column.source.kind === 'native') native.add(column.source.field)
      else customIds.push(column.source.fieldId)
    }
    if (customIds.length > 0) native.add('customFields')
    const filterConditions = buildFilterConditions(title, conditions)
    listWorkitems({
      connectionId,
      projectId,
      categories: CATEGORIES,
      page,
      perPage: pageSize,
      fields: [...native],
      customFieldIds: customIds,
      orderBy: 'gmtCreate',
      sort: 'desc',
      ...(filterConditions === undefined ? {} : { conditions: filterConditions }),
    })
      .then(next => { if (id === sequence.current) setResult(next) })
      .catch((failure: unknown) => {
        if (id !== sequence.current) return
        setResult(null)
        setError(failure instanceof Error ? failure.message : String(failure))
      })
      .finally(() => { if (id === sequence.current) setBusy(false) })
  }, [listWorkitems, connectionId, projectId, page, pageSize, columns, selected, title, conditions])

  useEffect(load, [load])

  const toggle = (key: string): void => {
    setSelected(current => {
      const list = current ?? []
      if (list.includes(key)) return list.length <= 1 ? list : list.filter(entry => entry !== key)
      return [...list, key]
    })
    setPage(1)
  }

  /**
   * Read one work item's body for the detail drawer. The row already carries the
   * metadata, so this is the only request the drawer makes.
   */
  const openDetail = async (row: Record<string, unknown>): Promise<void> => {
    const id = typeof row.id === 'string' ? row.id : ''
    if (id === '') return
    const ticket = ++detailSequence.current
    setPickerOpen(false)
    setDetail({ row, loading: true, error: null, description: null })
    try {
      const result = await getWorkitemDescription({ connectionId, projectId, id })
      if (ticket !== detailSequence.current) return
      setDetail({ row, loading: false, error: null, description: result.description })
    } catch (failure) {
      if (ticket !== detailSequence.current) return
      setDetail({ row, loading: false, error: failure instanceof Error ? failure.message : String(failure), description: null })
    }
  }

  /**
   * Hand one work item to the task composer. The description costs one detail
   * request and is only read when the settings say the composer needs it.
   */
  const draft = async (row: Record<string, unknown>): Promise<void> => {
    const id = typeof row.id === 'string' ? row.id : ''
    if (id === '') return
    const connection = (connections ?? []).find(entry => entry.id === connectionId)
    const fillFields = connection?.fillFields ?? []
    setBusy(true)
    setError(null)
    let description: SafeWorkitemDescription | null = null
    if (fillFields.includes('description')) {
      try {
        description = (await getWorkitemDescription({ connectionId, projectId, id })).description
      } catch (failure) {
        setError(`${t('moreTasksDraftFailed')}: ${failure instanceof Error ? failure.message : String(failure)}`)
        setBusy(false)
        return
      }
    }
    setBusy(false)
    onDraft(row, description, fillFields)
  }

  /**
   * Every verified filter field is offered; the platform decides what each one
   * means. The cap stays at two conditions plus the title search.
   */
  const availableFilters = useMemo(() => FILTER_FIELDS.map(field => field.id), [])
  const conditionLimit = Math.min(MAX_CONDITIONS, availableFilters.length)
  const addCondition = (): void => {
    setConditions(current => {
      if (current.length >= conditionLimit) return current
      const free = availableFilters.find(id => !current.some(condition => condition.field === id)) ?? availableFilters[0]
      if (free === undefined) return current
      return [...current, { field: free, value: '', toValue: '' }]
    })
    setPage(1)
  }
  const updateCondition = (index: number, patch: Partial<DraftCondition>): void => {
    setConditions(current => current.map((condition, position) => (position === index ? { ...condition, ...patch } : condition)))
    setPage(1)
  }
  const removeCondition = (index: number): void => {
    setConditions(current => current.filter((_, position) => position !== index))
    setPage(1)
  }

  const active = selected ?? []
  const shownKeys = active.filter(key => byKey.has(key))
  const hiddenKeys = catalog.map(column => column.key).filter(key => !shownKeys.includes(key))
  const filtered = search.trim() === '' ? null : search.trim().toLowerCase()
  const matches = (column: Column): boolean => filtered === null
    || label(column).toLowerCase().includes(filtered) || column.name.toLowerCase().includes(filtered)
  const renderToggle = (key: string): JSX.Element | null => {
    const column = byKey.get(key)
    if (column === undefined || !matches(column)) return null
    const on = shownKeys.includes(key)
    return <div key={key} className={css.pickerRow}>
      <span className={css.pickerGrip} aria-hidden="true">⋮⋮</span>
      <span className={css.pickerLabel}>{label(column)}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label(column)}
        className={on ? css.switchOn : css.switchOff} onClick={() => toggle(key)}>
        <span className={css.switchKnob} />
      </button>
    </div>
  }

  const totalPages = result?.totalPages ?? null
  const summary = result === null
    ? ''
    : result.total === null || totalPages === null
      ? t('moreTasksSummaryPartial').replace('{page}', String(result.page))
      : t('moreTasksSummary').replace('{page}', String(result.page)).replace('{pages}', String(totalPages)).replace('{total}', String(result.total))
  const ready = connectionId !== '' && projectId !== ''

  return <section className={css.view} aria-labelledby="task-more-title" aria-busy={busy} data-more-tasks="true">
    <header className={css.header}>
      <h1 id="task-more-title" ref={heading} tabIndex={-1}>{t('moreTasksTitle')}</h1>

      {/* Connection and project live in the title row; the column-settings icon
          sits in the table head, so the table keeps the full width for columns. */}
      <div className={css.controls}>
        <label className={css.field}>{t('moreTasksConnection')}
          <select value={connectionId} disabled={connections === null || connections.length === 0}
            onChange={event => { setConnectionId(event.target.value); setPage(1); setResult(null) }}>
            {connections === null
              ? <option value="">{t('loading')}</option>
              : connections.length === 0
                ? <option value="">{t('moreTasksNoConnection')}</option>
                : <>
                  {connectionId === '' && <option value="">{t('moreTasksSelectConnection')}</option>}
                  {connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
                </>}
          </select>
        </label>

        <label className={css.field}>{t('moreTasksProject')}
          <select value={projectId} disabled={projects === null || projects.length === 0}
            onChange={event => { setProjectId(event.target.value); setPage(1); setResult(null) }}>
            {projects === null
              ? <option value="">{connectionId === '' ? t('moreTasksSelectConnection') : t('loading')}</option>
              : projects.length === 0
                ? <option value="">{t('moreTasksNoProject')}</option>
                : <>
                  {projectId === '' && <option value="">{t('moreTasksSelectProject')}</option>}
                  {projects.map(project => <option key={project.id} value={project.id}>{project.label}</option>)}
                </>}
          </select>
        </label>

        <Button variant="outline" onClick={close}>{t('moreTasksClose')}</Button>
      </div>
    </header>

    {/* One title search plus at most two conditions; the settings page decides
        which fields may appear here. */}
    <div className={css.filters} role="group" aria-label={t('filterSettingsTitle')}>
      <form className={css.filterSearch} role="search" onSubmit={event => { event.preventDefault(); setTitle(titleInput); setPage(1) }}>
        <input type="search" value={titleInput} maxLength={200} placeholder={t('filterTitlePlaceholder')} aria-label={t('filterTitlePlaceholder')}
          onChange={event => setTitleInput(event.target.value)} />
        <Button variant="outline" size="sm" type="submit">{t('search')}</Button>
      </form>

      {conditions.map((condition, index) => {
        const spec = FILTER_SPECS.get(condition.field)
        return <div key={`${condition.field}-${index}`} className={css.condition}>
          <select aria-label={`${t('filterAny')} ${index + 1}`} value={condition.field}
            onChange={event => updateCondition(index, { field: event.target.value as FilterFieldId, value: '', toValue: '' })}>
            {availableFilters.map(id => <option key={id} value={id}>{t(FILTER_SPECS.get(id)!.label)}</option>)}
          </select>
          {spec?.source === 'date'
            ? <>
              <input type="date" className={css.filterValue} aria-label={t('filterCreated')} value={condition.value}
                onChange={event => updateCondition(index, { value: event.target.value })} />
              <span aria-hidden="true">–</span>
              <input type="date" className={css.filterValue} aria-label={`${t('filterCreated')} ${t('filterAny')}`} value={condition.toValue}
                onChange={event => updateCondition(index, { toValue: event.target.value })} />
            </>
            : spec?.source === 'stage'
              ? <CommittedText label={t('filterStatusStage')} value={condition.value} placeholder={t('filterStageHint')}
                onCommit={next => updateCondition(index, { value: next })} />
              : <select className={css.filterValue} aria-label={spec === undefined ? t('filterAny') : t(spec.label)}
                value={condition.value} onChange={event => updateCondition(index, { value: event.target.value })}>
                <option value="">{t('filterAny')}</option>
                {(spec === undefined ? [] : options[spec.source]).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>}
          <button type="button" className={css.filterRemove} aria-label={`${t('filterRemove')} ${index + 1}`} onClick={() => removeCondition(index)}>×</button>
        </div>
      })}

      <Button variant="outline" size="sm" disabled={conditions.length >= conditionLimit} onClick={addCondition}>{t('filterAdd')}</Button>
      {(title !== '' || conditions.length > 0) && <Button variant="ghost" size="sm" onClick={() => {
        setTitle(''); setTitleInput(''); setConditions([]); setPage(1)
      }}>{t('filterClear')}</Button>}
    </div>

    <p className={css.hint}>{t('moreTasksHint')}</p>
    {error !== null && <p role="alert" className={css.error}>{t('error')} · {error}</p>}

    <div className={css.body}>
      <div className={css.tableBox}>
        {!ready
          ? <p className={css.empty}>{t('loading')}</p>
          : busy && result === null
            ? <p className={css.empty}>{t('loading')}</p>
            : result === null || result.items.length === 0
              ? <p className={css.empty}>{t('moreTasksEmpty')}</p>
              : <table className={css.table}>
                <thead>
                  <tr>
                    {columns.map(column => <th key={column.key} scope="col"
                      className={isSubject(column) ? `${css.subject} ${css.frozenLeft}` : undefined}>{label(column)}</th>)}
                    <th scope="col" className={css.frozenRight}>
                      <span className={css.actionsHeader}>
                        <span>{t('moreTasksActions')}</span>
                        {/* Column settings moved out of the toolbar into the table head. */}
                        <Tooltip label={t('moreTasksColumnsTitle')} side="bottom" align="end">
                          <Button variant="ghost" size="sm" className={css.iconButton} aria-label={t('moreTasksColumnsTitle')}
                            aria-expanded={pickerOpen}
                            onClick={() => setPickerOpen(open => { if (!open) setDetail(null); return !open })}>
                            <IconSettingsOutlineRegular size={16} />
                          </Button>
                        </Tooltip>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((row, index) => {
                    const key = typeof row.id === 'string' ? row.id : `row-${index}`
                    return <tr key={key}>
                      {columns.map(column => {
                        const text = cellText(row, column)
                        const shown = text === '' ? '—' : text
                        return <td key={column.key}
                          className={isSubject(column) ? `${css.subject} ${css.frozenLeft}` : undefined}>
                          {isSubject(column) && text !== ''
                            ? <button type="button" className={css.subjectButton} title={text}
                              onClick={() => void openDetail(row)}>{shown}</button>
                            : shown}
                        </td>
                      })}
                      <td className={`${css.rowActions} ${css.frozenRight}`}>
                        <Button variant="primary" size="sm" disabled={busy} onClick={() => void draft(row)}>{t('moreTasksSync')}</Button>
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>}
      </div>

      {/* The detail drawer reads the body on demand and renders the plugin's own
          structured form of it, never the remote HTML. */}
      {detail !== null && <aside className={css.detail} role="dialog" aria-label={t('moreTasksDetail')}>
        <header className={css.pickerHeader}>
          <strong className={css.detailTitle} title={textOf(detail.row.subject)}>{textOf(detail.row.subject) || t('moreTasksDetail')}</strong>
          <button type="button" className={css.pickerClose} aria-label={t('moreTasksClose')}
            onClick={() => { detailSequence.current += 1; setDetail(null) }}>×</button>
        </header>
        <div className={css.detailScroll}>
          <dl className={css.detailMeta}>
            {columns.filter(column => !isSubject(column)).map(column => {
              const text = cellText(detail.row, column)
              return text === '' ? null : <div key={column.key} className={css.detailMetaRow}>
                <dt>{label(column)}</dt><dd>{text}</dd>
              </div>
            })}
          </dl>
          <h2 className={css.pickerHeading}>{t('moreTasksDetailDescription')}</h2>
          {detail.loading
            ? <p className={css.pickerNote}>{t('loading')}</p>
            : detail.error !== null
              ? <p role="alert" className={css.error}>{t('error')} · {detail.error}</p>
              : detail.description === null || detail.description.plain.trim() === ''
                ? <p className={css.pickerNote}>{t('moreTasksDetailEmpty')}</p>
                : detail.description.content !== null
                  // The HTML is generated by the plugin's own encoder from validated
                  // blocks (see contentHtml), never taken from the platform.
                  ? <div className={css.detailBody} dangerouslySetInnerHTML={{ __html: contentHtml(detail.description.content) }} />
                  : <p className={css.detailPlain}>{detail.description.plain}</p>}
        </div>
      </aside>}

      {pickerOpen && <aside className={css.picker} role="dialog" aria-label={t('moreTasksColumnsTitle')}>
        <header className={css.pickerHeader}>
          <strong>{t('moreTasksColumnsTitle')}</strong>
          <button type="button" className={css.pickerClose} aria-label={t('moreTasksClose')} onClick={() => setPickerOpen(false)}>×</button>
        </header>
        <input className={css.pickerSearch} type="search" value={search} aria-label={t('moreTasksFieldSearch')}
          placeholder={t('moreTasksFieldSearch')} onChange={event => setSearch(event.target.value)} />
        <div className={css.pickerScroll}>
          <h2 className={css.pickerHeading}>{t('moreTasksShownFields')}</h2>
          {shownKeys.map(renderToggle)}
          <h2 className={css.pickerHeading}>{t('moreTasksHiddenFields')}</h2>
          {hiddenKeys.map(renderToggle)}
          {fields === null && <p className={css.pickerNote}>{t('loading')}</p>}
          {fields !== null && fields.length === 0 && <p className={css.pickerNote}>{t('moreTasksFieldsEmpty')}</p>}
        </div>
      </aside>}
    </div>

    <footer className={css.footer}>
      <span role="status" aria-live="polite">{summary}</span>
      <label className={css.field}>{t('perPage')}
        <select value={String(pageSize)} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>
          {PAGE_SIZES.map(size => <option key={size} value={String(size)}>{String(size)}</option>)}
        </select>
      </label>
      <div className={css.pager}>
        <Button variant="outline" size="sm" disabled={busy || page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>{t('prevPage')}</Button>
        <span className={css.pageNow}>{totalPages === null ? String(page) : `${page} / ${totalPages}`}</span>
        <Button variant="outline" size="sm" disabled={busy || result === null || (totalPages !== null && page >= totalPages)} onClick={() => setPage(current => current + 1)}>{t('nextPage')}</Button>
      </div>
    </footer>
  </section>
}
