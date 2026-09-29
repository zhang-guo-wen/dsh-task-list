import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SEARCH_LIMIT,
  type CreateSubtaskRequest, type CreateTaskRequest, type DeleteSubtaskRequest, type DeleteTaskRequest,
  type ListTasksRequest, type SubtaskRecord, type TaskPage, type TaskPriority, type TaskRecord, type TaskStatus,
  type UpdateSubtaskRequest, type UpdateTaskRequest,
} from '../types.ts'
import type { TaskKey } from './locales.ts'
import { deriveTaskTitle } from './task-title.ts'
import { pickDefaultWorkspace } from './workspaces.ts'
import css from './TaskPanel.module.css'

interface WorkspaceSnapshot {
  items: readonly { workspaceId: string; title: string }[]
}

/** One Session offered by the subtask picker. */
export interface SessionOption { id: string; title: string }
export interface SessionSnapshot { items: readonly SessionOption[] }

export class WorktreeNotGitError extends Error {
  constructor(readonly workspaceTitle: string, readonly workspacePath: string, message: string) {
    super(`${message}: ${workspaceTitle}`)
    this.name = 'WorktreeNotGitError'
  }
}

export interface InitialCommitEntry {
  name: string
  kind: 'file' | 'directory' | 'nested_repository'
}

export interface TaskFace {
  list(request: ListTasksRequest): Promise<TaskPage>
  create(request: CreateTaskRequest): Promise<TaskRecord>
  update(request: UpdateTaskRequest): Promise<TaskRecord>
  remove(request: DeleteTaskRequest): Promise<{ deleted: true }>
  createSubtask(request: CreateSubtaskRequest): Promise<SubtaskRecord>
  updateSubtask(request: UpdateSubtaskRequest): Promise<SubtaskRecord>
  removeSubtask(request: DeleteSubtaskRequest): Promise<{ deleted: true }>
  /** Select a Session and show its conversation. */
  openSession(sessionId: string): void
  sessionSnapshot(): SessionSnapshot
  subscribeSessions(listener: () => void): () => void
  start(task: TaskRecord): Promise<void>
  probeWorktree(workspaceId: string): Promise<void>
  listInitialEntries(workspaceId: string): Promise<InitialCommitEntry[]>
  initializeGit(workspaceId: string, selectedEntries: string[]): Promise<void>
  listAgents(): Promise<readonly { id: string; name?: string; isDefault: boolean; broken?: string }[]>
  workspaceSnapshot(): WorkspaceSnapshot
  subscribeWorkspaces(listener: () => void): () => void
}

type TaskPanelProps = PropsLocale<'taskList'> & InjectFace<TaskFace>
type StatusFilter = 'all' | TaskStatus
const statusKeys: TaskStatus[] = ['todo', 'in_progress', 'done']
const priorityKeys: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const pageSizes: number[] = [10, 20, 50, MAX_PAGE_SIZE]

/** One editable subtask row held by the composer until Save applies it. */
interface SubtaskDraft {
  key: string
  id: string | null
  version: number | null
  notes: string
  status: TaskStatus
  sessionId: string | null
  removed: boolean
  savedNotes: string
  savedStatus: TaskStatus
  savedSessionId: string | null
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formattedTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function statusKey(status: TaskStatus): TaskKey {
  return status === 'in_progress' ? 'inProgress' : status
}

/** The stored title is derived from the content, so legacy rows without content fall back to it. */
function contentOf(task: TaskRecord): string {
  return task.notes.trim() || task.title
}

export function TaskPanel({
  list, create, update, remove, createSubtask, updateSubtask, removeSubtask, openSession,
  sessionSnapshot, subscribeSessions,
  start, probeWorktree, listInitialEntries, initializeGit, listAgents, workspaceSnapshot, subscribeWorkspaces, t,
}: TaskPanelProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<TaskRecord | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [storyPoints, setStoryPoints] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [sendImmediately, setSendImmediately] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [agent, setAgent] = useState('')
  const [useWorktree, setUseWorktree] = useState(false)
  const [subtaskDrafts, setSubtaskDrafts] = useState<SubtaskDraft[]>([])
  const [worktreeProbe, setWorktreeProbe] = useState<{ workspaceId: string; checking: boolean; needsInit: boolean; error: string } | null>(null)
  const [initializeTask, setInitializeTask] = useState<{ task: TaskRecord; workspaceTitle: string; workspacePath: string } | null>(null)
  const [initialEntries, setInitialEntries] = useState<InitialCommitEntry[]>([])
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [initialEntriesLoading, setInitialEntriesLoading] = useState(false)
  const [initialEntriesError, setInitialEntriesError] = useState('')
  const [initialEntriesRevision, setInitialEntriesRevision] = useState(0)
  const [agents, setAgents] = useState<readonly { id: string; name?: string; isDefault: boolean; broken?: string }[]>([])
  const mounted = useRef(false)
  const generation = useRef(0)
  const agentPrefilled = useRef(false)
  const draftKeys = useRef(0)
  const workspaceState = useSyncExternalStore(subscribeWorkspaces, workspaceSnapshot)
  const sessions = useSyncExternalStore(subscribeSessions, sessionSnapshot).items
  const workspaces = workspaceState.items
  const workspaceNames = new Map(workspaces.map(row => [row.workspaceId, row.title]))
  const defaultWorkspace = pickDefaultWorkspace(workspaces, t('defaultWorkspaceName'))
  const defaultWorkspaceId = defaultWorkspace?.workspaceId ?? null
  const defaultAgent = agents.find(row => row.isDefault && !row.broken)

  const refresh = useCallback(async () => {
    const current = ++generation.current
    const workspace = workspaceFilter === 'all' ? undefined : workspaceFilter.slice(3)
    setLoading(true)
    try {
      const result = await list({
        ...(filter === 'all' ? {} : { status: filter }),
        ...(query ? { query } : {}),
        ...(workspace === undefined ? {} : { workspaceId: workspace, includeUnassigned: workspace === defaultWorkspaceId }),
        page,
        pageSize,
      })
      if (mounted.current && generation.current === current) {
        setTasks(result.items)
        setTotal(result.total)
        setPage(result.page)
        setPageSize(result.pageSize)
        setError('')
      }
    } catch (failure) {
      if (mounted.current && generation.current === current) setError(errorText(failure))
    } finally {
      if (mounted.current && generation.current === current) setLoading(false)
    }
  }, [list, filter, query, workspaceFilter, defaultWorkspaceId, page, pageSize])

  // Any change to the request identity (status, phrase, workspace, paging)
  // re-runs this effect and loads the matching page.
  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => { mounted.current = false; generation.current++ }
  }, [refresh])

  // Load the preset roster when the composer opens: fetching it at mount races
  // the Remote namespace mount, which left the Agent select with one option.
  useEffect(() => {
    if (!composerOpen) return
    let active = true
    void listAgents().then(rows => { if (active) setAgents(rows) }).catch(failure => { if (active) setError(errorText(failure)) })
    return () => { active = false }
  }, [composerOpen, listAgents])

  // The default Agent is a real selection, not an empty placeholder: fill it in
  // once per composer opening, as soon as the preset list is known.
  useEffect(() => {
    if (!composerOpen) { agentPrefilled.current = false; return }
    if (editing || agentPrefilled.current || defaultAgent === undefined) return
    agentPrefilled.current = true
    setAgent(defaultAgent.id)
  }, [composerOpen, editing, defaultAgent])

  const initializationWorkspaceId = initializeTask?.task.workspaceId
  useEffect(() => {
    if (!initializationWorkspaceId) return
    let active = true
    setInitialEntries([])
    setSelectedEntries([])
    setInitialEntriesError('')
    setInitialEntriesLoading(true)
    void listInitialEntries(initializationWorkspaceId).then(entries => {
      if (active) setInitialEntries(entries)
    }).catch(failure => {
      if (active) setInitialEntriesError(errorText(failure))
    }).finally(() => {
      if (active) setInitialEntriesLoading(false)
    })
    return () => { active = false }
  }, [initializationWorkspaceId, initialEntriesRevision, listInitialEntries])

  useEffect(() => {
    if (!composerOpen || !useWorktree || !workspaceId) { setWorktreeProbe(null); return }
    let active = true
    setWorktreeProbe({ workspaceId, checking: true, needsInit: false, error: '' })
    void probeWorktree(workspaceId).then(() => {
      if (active) setWorktreeProbe({ workspaceId, checking: false, needsInit: false, error: '' })
    }).catch(failure => {
      if (active) setWorktreeProbe({ workspaceId, checking: false, needsInit: failure instanceof WorktreeNotGitError,
        error: failure instanceof WorktreeNotGitError ? '' : errorText(failure) })
    })
    return () => { active = false }
  }, [composerOpen, useWorktree, workspaceId, probeWorktree])

  const nextDraftKey = (): string => `draft-${++draftKeys.current}`

  const draftOf = (subtask: SubtaskRecord): SubtaskDraft => ({
    key: subtask.id, id: subtask.id, version: subtask.version,
    notes: subtask.notes, status: subtask.status, sessionId: subtask.sessionId, removed: false,
    savedNotes: subtask.notes, savedStatus: subtask.status, savedSessionId: subtask.sessionId,
  })

  const emptyDraft = (): SubtaskDraft => ({
    key: nextDraftKey(), id: null, version: null, notes: '', status: 'todo', sessionId: null, removed: false,
    savedNotes: '', savedStatus: 'todo', savedSessionId: null,
  })

  const openCreate = () => {
    setEditing(null)
    setNotes('')
    setPriority('medium')
    setStoryPoints('')
    setTagsInput('')
    setWorkspaceId(defaultWorkspaceId ?? '')
    setSendImmediately(false)
    setSessionId('')
    setAgent('')
    setUseWorktree(false)
    setSubtaskDrafts([])
    setComposerOpen(true)
  }

  const openEdit = (task: TaskRecord) => {
    setEditing(task)
    setNotes(task.notes)
    setPriority(task.priority)
    setStoryPoints(task.storyPoints === null ? '' : String(task.storyPoints))
    setTagsInput(task.tags.join(', '))
    setWorkspaceId(task.workspaceId ?? defaultWorkspaceId ?? '')
    setSendImmediately(task.sendImmediately)
    setSessionId(task.sessionId ?? '')
    setAgent(task.agent ?? '')
    setUseWorktree(task.useWorktree)
    setSubtaskDrafts(task.subtasks.map(draftOf))
    setComposerOpen(true)
  }

  const changeFilter = (next: StatusFilter) => { setFilter(next); setPage(1) }
  const changeWorkspaceFilter = (next: string) => { setWorkspaceFilter(next); setPage(1) }
  const changePageSize = (next: number) => { setPageSize(next); setPage(1) }
  const submitSearch = () => { setQuery(searchText.trim()); setPage(1) }
  const clearSearch = () => { setSearchText(''); setQuery(''); setPage(1) }

  const updateDraft = (key: string, patch: Partial<SubtaskDraft>) => {
    setSubtaskDrafts(current => current.map(draft => draft.key === key ? { ...draft, ...patch } : draft))
  }
  const addDraft = () => { setSubtaskDrafts(current => [...current, emptyDraft()]) }
  const toggleDraft = (key: string) => {
    setSubtaskDrafts(current => current.flatMap(draft => {
      if (draft.key !== key) return [draft]
      // A row that was never saved is simply dropped; a saved one is marked for deletion.
      if (draft.id === null) return []
      return [{ ...draft, removed: !draft.removed }]
    }))
  }

  /** Apply the composer's subtask edits to a saved task: deletions, additions, then changes. */
  const syncSubtasks = async (taskId: string) => {
    for (const draft of subtaskDrafts) {
      if (!draft.removed || draft.id === null || draft.version === null) continue
      await removeSubtask({ id: draft.id, version: draft.version })
    }
    for (const draft of subtaskDrafts) {
      if (draft.removed) continue
      const text = draft.notes.trim()
      if (!text) continue
      if (draft.id === null) {
        await createSubtask({ taskId, notes: text, status: draft.status, sessionId: draft.sessionId })
      } else if (draft.version !== null && (text !== draft.savedNotes || draft.status !== draft.savedStatus
        || draft.sessionId !== draft.savedSessionId)) {
        await updateSubtask({ id: draft.id, version: draft.version, notes: text, status: draft.status, sessionId: draft.sessionId })
      }
    }
  }

  const derivedTitle = deriveTaskTitle('', notes)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !derivedTitle) return
    setBusy(true)
    setError('')
    const fields = {
      title: derivedTitle, notes, priority,
      storyPoints: storyPoints === '' ? null : Number(storyPoints),
      tags: tagsInput.split(/[,，]/u).map(tag => tag.trim()).filter(Boolean),
      workspaceId: workspaceId || null,
      sendImmediately, sessionId: sessionId.trim() || null, agent: agent || null, useWorktree,
    }
    try {
      const saved = editing
        ? await update({ id: editing.id, version: editing.version, status: editing.status, ...fields })
        : await create(fields)
      await syncSubtasks(saved.id)
      if (!mounted.current) return
      setComposerOpen(false)
      setEditing(null)
      await refresh()
    } catch (failure) { if (mounted.current) setError(errorText(failure)) }
    finally { if (mounted.current) setBusy(false) }
  }

  const deleteTask = async (task: TaskRecord) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await remove({ id: task.id, version: task.version })
      if (mounted.current) await refresh()
    } catch (failure) {
      if (mounted.current) {
        await refresh()
        if (mounted.current) setError(errorText(failure))
      }
    } finally { if (mounted.current) setBusy(false) }
  }

  const startTask = async (task: TaskRecord) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await start(task)
      if (mounted.current) await refresh()
    }
    catch (failure) {
      if (mounted.current) {
        if (failure instanceof WorktreeNotGitError) {
          setInitializeTask({ task, workspaceTitle: failure.workspaceTitle, workspacePath: failure.workspacePath })
          return
        }
        await refresh()
        if (mounted.current) setError(errorText(failure))
      }
    }
    finally { if (mounted.current) setBusy(false) }
  }

  const initializeAndStart = async () => {
    const workspaceId = initializeTask?.task.workspaceId
    if (!initializeTask || busy || !workspaceId) return
    const task = initializeTask.task
    setBusy(true)
    setError('')
    try {
      await initializeGit(workspaceId, selectedEntries)
      await start(task)
      if (mounted.current) {
        setInitializeTask(null)
        await refresh()
      }
    } catch (failure) {
      if (mounted.current) {
        setInitializeTask(null)
        await refresh()
        if (mounted.current) setError(errorText(failure))
      }
    } finally { if (mounted.current) setBusy(false) }
  }

  const finishTask = async (task: TaskRecord) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await update({ id: task.id, version: task.version, status: 'done' })
      if (mounted.current) await refresh()
    } catch (failure) {
      if (mounted.current) {
        await refresh()
        if (mounted.current) setError(errorText(failure))
      }
    } finally { if (mounted.current) setBusy(false) }
  }

  const workspaceOptions = new Map(workspaceNames)
  for (const task of tasks) {
    if (task.workspaceId && !workspaceOptions.has(task.workspaceId)) workspaceOptions.set(task.workspaceId, task.workspaceId)
  }
  /** A task without a workspace belongs to the default Workspace instead. */
  const workspaceOf = (task: TaskRecord): string | null => task.workspaceId ?? defaultWorkspaceId
  const workspaceLabel = (id: string | null): string => id === null ? t('noWorkspace') : workspaceNames.get(id) ?? id
  const workspaceReady = (id: string | null): boolean => id !== null && workspaceNames.has(id)
  const selectableInitialEntries = initialEntries.filter(entry => entry.kind !== 'nested_repository')
  const canSave = Boolean(derivedTitle)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const pageSummary = t('pageSummary')
    .replace('{page}', String(page)).replace('{pages}', String(pageCount)).replace('{total}', String(total))
  const filtered = query !== '' || filter !== 'all' || workspaceFilter !== 'all'
  const composerStatus = editing?.status ?? 'todo'

  return <main className={css.page}>
    <div className={css.inner}>
      <header className={css.header}>
        <h1>{t('title')}</h1>
        <button type="button" className={css.primary} onClick={openCreate}>{t('add')}</button>
      </header>

      <div className={css.toolbar}>
        <div className={css.filters} role="group" aria-label={t('status')}>
          {(['all', ...statusKeys] as StatusFilter[]).map(item => <button
            key={item} type="button" className={filter === item ? css.selected : css.filter}
            aria-pressed={filter === item} onClick={() => changeFilter(item)}>{t(item === 'in_progress' ? 'inProgress' : item)}</button>)}
        </div>
        <div className={css.toolbarRight}>
          <form className={css.searchBox} role="search" onSubmit={event => { event.preventDefault(); submitSearch() }}>
            <input value={searchText} maxLength={SEARCH_LIMIT} placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')} onChange={event => setSearchText(event.target.value)} />
            {searchText !== '' && <button type="button" className={css.searchClear} title={t('clearSearch')}
              aria-label={t('clearSearch')} onClick={clearSearch}>×</button>}
            <button type="submit" className={css.searchButton} disabled={loading}>{t('search')}</button>
          </form>
          <select aria-label={t('workspace')} value={workspaceFilter} onChange={event => changeWorkspaceFilter(event.target.value)}>
            <option value="all">{t('allWorkspaces')}</option>
            {[...workspaceOptions].map(([id, name]) => <option key={id} value={`ws:${id}`}>{name}</option>)}
          </select>
          <button type="button" className={css.textButton} onClick={() => void refresh()} disabled={loading}>{t('refresh')}</button>
        </div>
      </div>

      {error && <div className={css.error} role="alert">{t('error')}: {error} <button type="button" onClick={() => void refresh()}>{t('retry')}</button></div>}
      {loading && tasks.length === 0 ? <p className={css.placeholder}>{t('loading')}</p> : tasks.length === 0 ? <div className={css.empty}>
        <strong>{filtered ? t('emptySearch') : t('empty')}</strong><span>{filtered ? t('emptySearchHint') : t('emptyHint')}</span>
      </div> : <ul className={css.list}>
        {tasks.map(task => {
          const linked = workspaceOf(task)
          const ready = workspaceReady(linked)
          const content = contentOf(task)
          return <li className={css.row} data-priority={task.priority} key={task.id}>
            <div className={css.rowLine}>
              <button type="button" className={css.content} onClick={() => openEdit(task)} disabled={busy}
                title={content} aria-label={`${t('edit')}: ${content}`}>{content}</button>
              <span className={css.statusChip} data-status={task.status} title={t(statusKey(task.status))}>{t(statusKey(task.status))}</span>
              <span className={css.workspaceMeta} title={workspaceLabel(linked)}>{workspaceLabel(linked)}</span>
              <span className={task.sessionId ? css.sessionMeta : css.sessionMetaEmpty}
                title={task.sessionId ?? t('sessionUnbound')}>{task.sessionId ?? t('sessionUnbound')}</span>
              <span className={css.createdMeta} title={formattedTime(task.createdAt)}>{formattedTime(task.createdAt)}</span>
              <div className={css.rowActions}>
                {task.status === 'done' ? <span className={css.doneState}>{t('done')}</span> : <button
                  type="button" className={css.start}
                  onClick={() => void (task.status === 'todo' ? startTask(task) : finishTask(task))}
                  disabled={busy || task.status === 'todo' && !ready}
                  aria-label={`${t(task.status === 'todo' ? 'start' : 'finish')}: ${content}`}
                  title={task.status === 'todo' && !ready ? linked === null ? t('startRequiresWorkspace') : t('startWorkspaceMissing') : undefined}>
                  {t(task.status === 'todo' ? 'start' : 'finish')}
                </button>}
                <button type="button" className={css.delete} onClick={() => void deleteTask(task)} disabled={busy}
                  aria-label={`${t('remove')}: ${content}`} title={t('remove')}>×</button>
              </div>
            </div>
            {task.subtasks.length > 0 && <ul className={css.subtasks}>
              {task.subtasks.map(subtask => <li className={css.subtaskRow} data-status={subtask.status} key={subtask.id}>
                {subtask.sessionId === null
                  ? <span className={css.subtaskText} title={subtask.notes}>{subtask.notes}</span>
                  : <button type="button" className={css.subtaskText + ' ' + css.subtaskLinked} title={t('openSession')}
                    onClick={() => openSession(subtask.sessionId!)}>{subtask.notes}</button>}
                <span className={css.subtaskStatus}>{t(statusKey(subtask.status))}</span>
                {subtask.sessionId === null ? <span className={css.subtaskSessionEmpty}>{t('noSession')}</span>
                  : <button type="button" className={css.subtaskOpen} title={`${t('openSession')}: ${subtask.sessionId}`}
                    onClick={() => openSession(subtask.sessionId!)}>{t('openSession')}</button>}
              </li>)}
            </ul>}
          </li>
        })}
      </ul>}

      {total > 0 && <div className={css.pager}>
        <label className={css.pageSize}>{t('perPage')}
          <select aria-label={t('perPage')} value={String(pageSize)} onChange={event => changePageSize(Number(event.target.value))}>
            {pageSizes.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <span className={css.pageSummary}>{pageSummary}</span>
        <div className={css.pageButtons}>
          <button type="button" className={css.textButton} disabled={loading || page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}>{t('prevPage')}</button>
          <button type="button" className={css.textButton} disabled={loading || page >= pageCount}
            onClick={() => setPage(value => Math.min(pageCount, value + 1))}>{t('nextPage')}</button>
        </div>
      </div>}
    </div>

    {composerOpen && <div className={css.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setComposerOpen(false) }}>
      <div className={css.dialog + ' ' + css.dialogFixed} role="dialog" aria-modal="true" aria-labelledby="task-list-dialog-title">
        <div className={css.dialogBody}>
          <h2 id="task-list-dialog-title">{editing ? t('edit') : t('add')}</h2>
          <form id="task-list-form" onSubmit={event => void save(event)}>
            <label>{t('notesLabel')}<textarea autoFocus required value={notes} maxLength={20000} rows={5}
              placeholder={t('notesHint')} onChange={event => setNotes(event.target.value)} /></label>
            <label>{t('status')}<span className={css.fixedValue} title={t(statusKey(composerStatus))}>{t(statusKey(composerStatus))}</span></label>
            <p className={css.fieldHint}>{t('statusFixed')}</p>
            <label>{t('priorityLabel')}<select value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>
              {priorityKeys.map(item => <option key={item} value={item}>{t(item)}</option>)}
            </select></label>
            <label>{t('storyPoints')}<input type="number" min="0" max="1000" step="1" value={storyPoints} onChange={event => setStoryPoints(event.target.value)} /></label>
            <label>{t('tags')}<input value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder={t('tagsHint')} /></label>
            <label>{t('workspace')}<select value={workspaceId} onChange={event => setWorkspaceId(event.target.value)}>
              {workspaces.length === 0 && <option value="">{t('noWorkspace')}</option>}
              {workspaceId && !workspaceOptions.has(workspaceId) && <option value={workspaceId}>{workspaceId}</option>}
              {[...workspaceOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select></label>
            <label>{t('sessionId')}<span className={css.fixedValue} title={sessionId || t('sessionUnbound')}>{sessionId || t('sessionUnbound')}</span></label>
            <p className={css.fieldHint}>{t('sessionIdLocked')}</p>
            <label>{t('agent')}<select value={agent} onChange={event => setAgent(event.target.value)}>
              <option value="">{t('defaultAgent')}</option>
              {agent && !agents.some(row => row.id === agent) && <option value={agent}>{agent}</option>}
              {agents.map(row => <option key={row.id} value={row.id} disabled={Boolean(row.broken)}>{row.name ?? row.id}{row.isDefault ? ` · ${t('defaultAgent')}` : ''}</option>)}
            </select></label>
            <label className={css.toggle}><input type="checkbox" checked={sendImmediately} onChange={event => setSendImmediately(event.target.checked)} />{t('sendImmediately')}</label>
            <label className={css.toggle}><input type="checkbox" checked={useWorktree} onChange={event => setUseWorktree(event.target.checked)} />{t('useWorktree')}</label>
            {useWorktree && <p className={css.worktreeHint + ' ' + (worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? css.worktreeError : '')} role={worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? 'alert' : undefined}>
              {!workspaceId ? t('startRequiresWorkspace') : worktreeProbe?.workspaceId !== workspaceId || worktreeProbe.checking ? t('worktreeChecking')
                : worktreeProbe.needsInit ? t('worktreeNeedsInit') : worktreeProbe.error || t('worktreeAvailable')}
            </p>}
            {editing && <div className={css.readOnlyTimes}>
              <span>{t('createdAt')}: {formattedTime(editing.createdAt)}</span>
              {editing.startedAt !== null && <span>{t('startedAt')}: {formattedTime(editing.startedAt)}</span>}
              {editing.completedAt !== null && <span>{t('completedAt')}: {formattedTime(editing.completedAt)}</span>}
            </div>}
            <section className={css.subtasksSection}>
              <div className={css.subtasksHeader}>
                <strong>{t('subtasks')}</strong>
                <button type="button" className={css.textButton} onClick={addDraft} disabled={busy}>{t('addSubtask')}</button>
              </div>
              {subtaskDrafts.length === 0 ? <p className={css.fieldHint}>{t('subtasksEmpty')}</p>
                : <ul className={css.subtaskDrafts}>
                  {subtaskDrafts.map(draft => <li key={draft.key} className={draft.removed ? css.subtaskDraft + ' ' + css.subtaskDraftRemoved : css.subtaskDraft}>
                    <input value={draft.notes} maxLength={2000} placeholder={t('subtaskHint')} disabled={draft.removed} aria-label={t('subtaskHint')}
                      onChange={event => updateDraft(draft.key, { notes: event.target.value })} />
                    <select aria-label={t('status')} value={draft.status} disabled={draft.removed}
                      onChange={event => updateDraft(draft.key, { status: event.target.value as TaskStatus })}>
                      {statusKeys.map(item => <option key={item} value={item}>{t(statusKey(item))}</option>)}
                    </select>
                    <select aria-label={t('subtaskSession')} value={draft.sessionId ?? ''} disabled={draft.removed}
                      onChange={event => updateDraft(draft.key, { sessionId: event.target.value || null })}>
                      <option value="">{t('noSession')}</option>
                      {draft.sessionId !== null && !sessions.some(option => option.id === draft.sessionId)
                        && <option value={draft.sessionId ?? ''}>{draft.sessionId}</option>}
                      {sessions.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
                    </select>
                    <button type="button" className={css.subtaskDraftAction} disabled={busy}
                      onClick={() => toggleDraft(draft.key)}>{draft.removed ? t('restore') : t('remove')}</button>
                  </li>)}
                </ul>}
            </section>
          </form>
        </div>
        <div className={css.dialogFooter}>
          <button type="button" onClick={() => setComposerOpen(false)} disabled={busy}>{t('cancel')}</button>
          <button type="submit" form="task-list-form" className={css.primary} disabled={busy || !canSave}>{t('save')}</button>
        </div>
      </div>
    </div>}
    {initializeTask && <div className={css.backdrop} role="presentation">
      <div className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="task-list-init-title">
        <h2 id="task-list-init-title">{t('initializeGitTitle')}</h2>
        <p>{t('initializeGitIntro')} <strong>{initializeTask.workspaceTitle}</strong></p>
        <p className={css.initPath}>{initializeTask.workspacePath}</p>
        <div className={css.initToolbar}>
          <strong>{t('initialCommitEntries')}</strong>
          <button type="button" disabled={busy || initialEntriesLoading || Boolean(initialEntriesError)}
            onClick={() => setSelectedEntries(selectableInitialEntries.map(entry => entry.name))}>{t('selectAll')}</button>
          <button type="button" disabled={busy || initialEntriesLoading || Boolean(initialEntriesError)}
            onClick={() => setSelectedEntries([])}>{t('selectNone')}</button>
        </div>
        {initialEntriesLoading ? <p className={css.initLoading}>{t('initialEntriesLoading')}</p>
          : initialEntriesError ? <p className={css.initError} role="alert">{initialEntriesError} <button type="button"
            onClick={() => setInitialEntriesRevision(value => value + 1)}>{t('retry')}</button></p>
            : initialEntries.length === 0 ? <p className={css.initLoading}>{t('initialEntriesEmpty')}</p>
              : <ul className={css.initEntries}>
                {initialEntries.map(entry => <li key={entry.name}>
                  <label>
                    <input type="checkbox" checked={selectedEntries.includes(entry.name)}
                      disabled={busy || entry.kind === 'nested_repository'}
                      onChange={event => {
                        const checked = event.target.checked
                        setSelectedEntries(current => checked
                          ? [...current, entry.name] : current.filter(name => name !== entry.name))
                      }} />
                    <span className={css.initEntryName} title={entry.name}>{entry.name}</span>
                    <small>{t(entry.kind === 'directory' ? 'initialDirectory' : entry.kind === 'nested_repository' ? 'initialNestedRepository' : 'initialFile')}</small>
                  </label>
                </li>)}
              </ul>}
        <p className={css.initWarning}>{t('initializeGitWarning')}</p>
        <div className={css.dialogActions}>
          <button type="button" onClick={() => setInitializeTask(null)} disabled={busy}>{t('cancel')}</button>
          <button type="button" onClick={() => { const task = initializeTask.task; setInitializeTask(null); openEdit(task) }} disabled={busy}>{t('changeWorkspace')}</button>
          <button type="button" className={css.primary} onClick={() => void initializeAndStart()}
            disabled={busy || initialEntriesLoading || Boolean(initialEntriesError)}>{t('initializeAndStart')}</button>
        </div>
      </div>
    </div>}
  </main>
}
