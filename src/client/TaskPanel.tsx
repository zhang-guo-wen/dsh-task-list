import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SEARCH_LIMIT,
  // The subtask remotes stay on the face while the panel hides the feature.
  type CreateSubtaskRequest, type CreateTaskRequest, type DeleteSubtaskRequest, type DeleteTaskRequest,
  type ListTasksRequest, type SubtaskRecord, type TaskPage, type TaskPriority, type TaskRecord, type TaskStatus,
  type UpdateSubtaskRequest, type UpdateTaskRequest,
} from '../types.ts'
import type { TaskKey } from './locales.ts'
import { deriveTaskTitle } from './task-title.ts'
import { safeSourceUrl, taskDocument, retainTaskSource } from './task-content.ts'
import { pickDefaultWorkspace } from './workspaces.ts'
import css from './TaskPanel.module.css'
import { contentText, textContent } from '../content.ts'
import type { TaskAttachmentUpload, TaskContent } from '../types.ts'
import { TaskContentEditor } from './TaskContentEditor.tsx'
import type { SyncFace } from './sync/face.ts'
import type { ListWorkitemFieldsRequest, ListWorkitemsRequest, SafeWorkitemDescription, SafeWorkitemDescriptionResult, SafeWorkitemField, SafeWorkitemPage } from '../sync/dto.ts'
import { buildWorkitemBody, readFillFields } from './workitem-fill.ts'
import { SyncActions, SyncStatus } from './sync/SyncControls.tsx'
import { useSyncPanel } from './sync/use-sync-panel.ts'

import { StatisticsCalendar } from './StatisticsCalendar.tsx'
import type { StatisticsRequest, StatisticsRunOptions, StatisticsSnapshot } from '../statistics.ts'
import { MoreTasks } from './MoreTasks.tsx'

interface WorkspaceSnapshot {
  items: readonly { workspaceId: string; title: string }[]
}

/** One Session offered by the session picker. */
export interface SessionOption { id: string; title: string; archived: boolean; subagent: boolean; blank: boolean }
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
  calculateStatistics(request: StatisticsRequest, options?: StatisticsRunOptions): Promise<StatisticsSnapshot>
  list(request: ListTasksRequest): Promise<TaskPage>
  create(request: CreateTaskRequest): Promise<TaskRecord>
  update(request: UpdateTaskRequest): Promise<TaskRecord>
  readAttachments(request: { id: string; version: number }): Promise<TaskAttachmentUpload[]>
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
  /** Manual sync surface; consumed by the sync UI, not by the task list rows. */
  sync: SyncFace
  /** One page of remote work items for the "more tasks" page. */
  listWorkitems(request: ListWorkitemsRequest): Promise<SafeWorkitemPage>
  /** The platform's own column catalog for one project category. */
  listWorkitemFields(request: ListWorkitemFieldsRequest): Promise<SafeWorkitemField[]>
  /** One work item's body, read only when a draft needs it. */
  getWorkitemDescription(request: { connectionId: string; projectId: string; id: string }): Promise<SafeWorkitemDescriptionResult>
}

type TaskPanelProps = PropsLocale<'taskList'> & InjectFace<TaskFace>
type StatusFilter = 'all' | TaskStatus
const statusKeys: TaskStatus[] = ['todo', 'in_progress', 'done']
const priorityKeys: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const pageSizes: number[] = [10, 20, 50, MAX_PAGE_SIZE]

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
  return task.source ? task.title : task.notes.trim() || task.title
}

export function TaskPanel({
  list, create, update, remove, readAttachments,
  start, probeWorktree, listInitialEntries, initializeGit, listAgents, workspaceSnapshot, subscribeWorkspaces,
  sessionSnapshot, subscribeSessions, sync, calculateStatistics, listWorkitems, listWorkitemFields, getWorkitemDescription, t,
}: TaskPanelProps) {
  const [reportsOpen, setReportsOpen] = useState(false)
  const reportButton = useRef<HTMLButtonElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButton = useRef<HTMLButtonElement>(null)
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
  const [externalTitle, setExternalTitle] = useState('')
  const [content, setContent] = useState<TaskContent>(() => textContent(''))
  const [uploads, setUploads] = useState<TaskAttachmentUpload[]>([])
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [contentValid, setContentValid] = useState(true)
  const notes = contentText(content)
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [storyPoints, setStoryPoints] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [sendImmediately, setSendImmediately] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [agent, setAgent] = useState('')
  const [useWorktree, setUseWorktree] = useState(false)
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
  const sessionState = useSyncExternalStore(subscribeSessions, sessionSnapshot)
  const sessionNames = new Map(sessionState.items.map(row => [row.id, row.title]))
  // Mirror the Host sidebar's own visibility rule for the picker: internal
  // subagent runs, retired blank entries, and archived Sessions are not offered.
  // A Session already linked to this task is still echoed even when hidden.
  const selectableSessions = sessionState.items.filter(row => !row.archived && !row.subagent && !row.blank)
  const linkedSession = sessionState.items.find(row => row.id === sessionId)
  const echoedLinkedSession = linkedSession !== undefined && (linkedSession.archived || linkedSession.subagent || linkedSession.blank)
    ? linkedSession : undefined
  const workspaceState = useSyncExternalStore(subscribeWorkspaces, workspaceSnapshot)
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

  // Sync lives on this page as the header's trailing menu row; its results and
  // refusals render below the toolbar, and nothing is drawn while it is idle.
  const syncPanel = useSyncPanel(sync, refresh)

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

  const openCreate = () => {
    setEditing(null)
    setContent(textContent(''))
    setUploads([])
    setAttachmentBusy(false)
    setContentValid(true)
    setStatus('todo')
    setPriority('medium')
    setStoryPoints('')
    setTagsInput('')
    setWorkspaceId(defaultWorkspaceId ?? '')
    setSendImmediately(false)
    setSessionId('')
    setAgent('')
    setUseWorktree(false)
    setError('')
    setComposerOpen(true)
  }

  /**
   * Open the create composer prefilled from a remote work item. The body is
   * built from the fields the settings page has checked, and `start` arms the
   * "start immediately" switch so saving launches the session in one step.
   */
  const openDraft = (row: Record<string, unknown>, description: SafeWorkitemDescription | null, mode: 'sync' | 'start') => {
    setEditing(null)
    setContent(textContent(buildWorkitemBody(row, description, readFillFields(), t)))
    setUploads([])
    setAttachmentBusy(false)
    setContentValid(true)
    setStatus('todo')
    setPriority('medium')
    setStoryPoints('')
    setTagsInput('')
    setWorkspaceId(defaultWorkspaceId ?? '')
    setSendImmediately(mode === 'start')
    setSessionId('')
    setAgent('')
    setUseWorktree(false)
    setError('')
    setMoreOpen(false)
    setComposerOpen(true)
  }

  const openEdit = (task: TaskRecord) => {
    setEditing(task)
    setExternalTitle(task.title)
    setContent(taskDocument(task))
    setUploads([])
    setAttachmentBusy(false)
    setContentValid(true)
    setStatus(task.status)
    setPriority(task.priority)
    setStoryPoints(task.storyPoints === null ? '' : String(task.storyPoints))
    setTagsInput(task.tags.join(', '))
    setWorkspaceId(task.workspaceId ?? defaultWorkspaceId ?? '')
    setSendImmediately(task.sendImmediately)
    setSessionId(task.sessionId ?? '')
    setAgent(task.agent ?? '')
    setUseWorktree(task.useWorktree)
    setError('')
    setComposerOpen(true)
  }

  const changeFilter = (next: StatusFilter) => { setFilter(next); setPage(1) }
  const changeWorkspaceFilter = (next: string) => { setWorkspaceFilter(next); setPage(1) }
  const changePageSize = (next: number) => { setPageSize(next); setPage(1) }
  const submitSearch = () => { setQuery(searchText.trim()); setPage(1) }
  const clearSearch = () => { setSearchText(''); setQuery(''); setPage(1) }

  const derivedTitle = editing?.source ? externalTitle.trim() : deriveTaskTitle('', notes)

  /** Write the composer fields and return the saved row; a refusal is thrown for the caller to show. */
  const persist = async (): Promise<TaskRecord> => {
    const fields = {
      title: derivedTitle, notes, status, priority,
      content, attachments: uploads,
      storyPoints: storyPoints === '' ? null : Number(storyPoints),
      tags: tagsInput.split(/[,，]/u).map(tag => tag.trim()).filter(Boolean),
      workspaceId: workspaceId || null,
      sendImmediately, sessionId: sessionId.trim() || null, agent: agent || null, useWorktree,
    }
    // The composer's status is authoritative, so the same payload serves the
    // create and the edit path and any transition is one save away.
    return editing
      ? await update({ id: editing.id, version: editing.version, ...fields })
      : await create(fields)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || attachmentBusy || !contentValid || !derivedTitle) return
    setBusy(true)
    setError('')
    try {
      await persist()
      if (!mounted.current) return
      setComposerOpen(false)
      setEditing(null)
      await refresh()
    } catch (failure) { if (mounted.current) setError(errorText(failure)) }
    finally { if (mounted.current) setBusy(false) }
  }

  /**
   * The dialog header actions for a saved task: write the composer first, then run the same
   * start/finish the list row offers, so the dialog never closes on an unsaved edit. Starting
   * opens a fresh session for this task, so it is offered at every status — a task that is
   * already In progress or Done can be started again, which rebinds it to the new session.
   */
  const saveAndLaunch = async (finish: boolean) => {
    if (busy || attachmentBusy || !contentValid || !derivedTitle || editing === null) return
    let saved: TaskRecord | null = null
    setBusy(true)
    setError('')
    try {
      saved = retainTaskSource(editing, await persist())
      if (!mounted.current) return
      setComposerOpen(false)
      setEditing(null)
      await refresh()
      if (!mounted.current) return
      if (finish) await update({ id: saved.id, version: saved.version, status: 'done' })
      else await start(saved)
      if (mounted.current) await refresh()
    } catch (failure) {
      if (!mounted.current) return
      // A non-Git workspace is resolved with the initialization dialog, exactly as in the list.
      if (failure instanceof WorktreeNotGitError && saved !== null) {
        setInitializeTask({ task: saved, workspaceTitle: failure.workspaceTitle, workspacePath: failure.workspacePath })
        return
      }
      setError(errorText(failure))
    }
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
  const canSave = Boolean(derivedTitle) && Array.from(derivedTitle).length <= 200 && !attachmentBusy && contentValid
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const pageSummary = t('pageSummary')
    .replace('{page}', String(page)).replace('{pages}', String(pageCount)).replace('{total}', String(total))
  const filtered = query !== '' || filter !== 'all' || workspaceFilter !== 'all'

  if (reportsOpen) return <main className={css.page} data-report="true">
    <div className={css.inner}>
      <StatisticsCalendar calculate={calculateStatistics} t={t} close={() => {
        setReportsOpen(false)
        requestAnimationFrame(() => reportButton.current?.focus())
      }} />
    </div>
  </main>

  if (moreOpen) return <main className={css.page} data-more="true">
    <div className={css.inner}>
      <MoreTasks sync={sync} query={{ listWorkitems, listWorkitemFields, getWorkitemDescription }} onDraft={openDraft} t={t} close={() => {
        setMoreOpen(false)
        requestAnimationFrame(() => moreButton.current?.focus())
      }} />
    </div>
  </main>

  return <main className={css.page}>
    <div className={css.inner}>
      <header className={css.header}>
        <h1>{t('title')}</h1>
        <div className={css.titleActions}>
          <Button className={css.reportButton} variant="outline" ref={reportButton} onClick={() => setReportsOpen(true)}>{t('statisticsTitle')}</Button>
          <Button className={css.reportButton} variant="outline" ref={moreButton} onClick={() => setMoreOpen(true)}>{t('moreTasksTitle')}</Button>
          {/* One right-hand block: the body creates a task, the trailing caret
              opens the menu holding Sync. */}
          <SyncActions addLabel={t('add')} onCreate={openCreate} panel={syncPanel} t={t} />
        </div>
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

      {/* Sync's own output only: a refused click's prompt, a failure, or a run's
          results. Idle, it renders nothing — the standing description of what
          sync does lives on its settings page. */}
      <SyncStatus panel={syncPanel} t={t} />

      {/* With the composer open its own copy is the visible one, so the banner
          stays quiet to avoid announcing the same failure twice. */}
      {error && !composerOpen && <div className={css.error} role="alert">{t('error')}: {error} <button type="button" onClick={() => void refresh()}>{t('retry')}</button></div>}
      {loading && tasks.length === 0 ? <p className={css.placeholder}>{t('loading')}</p> : tasks.length === 0 ? <div className={css.empty}>
        <strong>{filtered ? t('emptySearch') : t('empty')}</strong><span>{filtered ? t('emptySearchHint') : t('emptyHint')}</span>
      </div> : <ul className={css.list}>
        {tasks.map(task => {
          const linked = workspaceOf(task)
          const ready = workspaceReady(linked)
          const content = contentOf(task)
          return <li className={css.row} data-priority={task.priority} data-status={task.status} key={task.id}>
            <div className={css.rowLine}>
              <button type="button" className={css.content} onClick={() => openEdit(task)} disabled={busy}
                title={content} aria-label={`${t('edit')}: ${content}`}>{content}</button>
              <span className={css.statusChip} data-status={task.status} title={t(statusKey(task.status))}>{t(statusKey(task.status))}</span>
              <span className={css.workspaceMeta} title={workspaceLabel(linked)}>{workspaceLabel(linked)}</span>
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
            {task.source && <div className={css.sourceLine}>
              {safeSourceUrl(task.source.url) ? <a href={safeSourceUrl(task.source.url)!} target="_blank" rel="noopener noreferrer">{task.source.platform} · {task.source.number || task.source.remoteId}</a> : <span>{task.source.platform} · {task.source.number || task.source.remoteId}</span>}
              <span>{t('lastSync')}: {task.source.lastSuccess === null ? t('notStarted') : formattedTime(task.source.lastSuccess)}</span>
              {task.source.error && <span role="status">{t('syncFailed')} · {task.source.error.code}</span>}
            </div>}
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

    {composerOpen && <div className={css.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy && !attachmentBusy) setComposerOpen(false) }}>
      <div className={css.dialog + ' ' + css.dialogFixed} role="dialog" aria-modal="true" aria-labelledby="task-list-dialog-title">
        <div className={css.dialogHeader}>
          <h2 id="task-list-dialog-title">{editing ? t('edit') : t('add')}</h2>
          {editing !== null && <div className={css.headerActions}>
            {/* Start is offered at every status: a running or finished task can be started
                again, which opens a fresh session and rebinds the task to it. */}
            <button type="button" className={css.headerAction} onClick={() => void saveAndLaunch(false)}
              disabled={busy || !canSave}>{t('start')}</button>
            {/* Nothing left to complete once the composer already reads Done. */}
            <button type="button" className={css.headerAction} onClick={() => void saveAndLaunch(true)}
              disabled={busy || !canSave || status === 'done'}>{t('finish')}</button>
          </div>}
        </div>
        <div className={css.dialogBody}>
          {error && <div className={css.dialogError} role="alert">{t('error')}: {error}</div>}
          <form id="task-list-form" onSubmit={event => void save(event)}>
            {editing?.source && <label className={css.fullRow}>{t('externalTitle')}<input value={externalTitle} maxLength={200} required onChange={event => setExternalTitle(event.target.value)} /></label>}
            <div className={css.fullRow}>{t('notesLabel')}{editing?.source && <span> · {t('externalDescription')}</span>}<TaskContentEditor value={content} uploads={uploads}
              onChange={(content, uploads) => { setContent(content); setUploads(uploads) }}
              readAttachments={() => editing ? readAttachments({ id: editing.id, version: editing.version }) : Promise.resolve([])}
              disabled={busy} onBusy={setAttachmentBusy} onValid={setContentValid} t={t} /></div>
            <label>{t('workspace')}<select value={workspaceId} onChange={event => setWorkspaceId(event.target.value)}>
              {workspaces.length === 0 && <option value="">{t('noWorkspace')}</option>}
              {workspaceId && !workspaceOptions.has(workspaceId) && <option value={workspaceId}>{workspaceId}</option>}
              {[...workspaceOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select></label>
            <label>{t('agent')}<select value={agent} onChange={event => setAgent(event.target.value)}>
              <option value="">{t('defaultAgent')}</option>
              {agent && !agents.some(row => row.id === agent) && <option value={agent}>{agent}</option>}
              {agents.map(row => <option key={row.id} value={row.id} disabled={Boolean(row.broken)}>{row.name ?? row.id}{row.isDefault ? ` · ${t('defaultAgent')}` : ''}</option>)}
            </select></label>
            <div className={css.toggleRow + ' ' + css.fullRow}>
              <label className={css.toggle}><input type="checkbox" checked={sendImmediately} onChange={event => setSendImmediately(event.target.checked)} />{t('sendImmediately')}</label>
              <label className={css.toggle}><input type="checkbox" checked={useWorktree} onChange={event => setUseWorktree(event.target.checked)} />{t('useWorktree')}</label>
            </div>
            {useWorktree && <p className={css.worktreeHint + ' ' + css.fullRow + ' ' + (worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? css.worktreeError : '')} role={worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? 'alert' : undefined}>
              {!workspaceId ? t('startRequiresWorkspace') : worktreeProbe?.workspaceId !== workspaceId || worktreeProbe.checking ? t('worktreeChecking')
                : worktreeProbe.needsInit ? t('worktreeNeedsInit') : worktreeProbe.error || t('worktreeAvailable')}
            </p>}
            <label>{t('priorityLabel')}<select value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>
              {priorityKeys.map(item => <option key={item} value={item}>{t(item)}</option>)}
            </select></label>
            <label>{t('status')}<select value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>
              {statusKeys.map(item => <option key={item} value={item}>{t(statusKey(item))}</option>)}
            </select></label>
            <label>{t('tags')}<input value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder={t('tagsHint')} /></label>
            <label>{t('storyPoints')}<input type="number" min="0" max="1000" step="1" value={storyPoints} onChange={event => setStoryPoints(event.target.value)} /></label>
            <section className={css.metaSection + ' ' + css.fullRow}>
              <div className={css.fieldBlock}>
                <label>{t('sessionId')}<select value={sessionId} disabled={busy} onChange={event => setSessionId(event.target.value)}>
                  <option value="">{t('noSession')}</option>
                  {echoedLinkedSession && <option value={echoedLinkedSession.id}>{echoedLinkedSession.title}{echoedLinkedSession.archived ? ` · ${t('sessionArchived')}` : ''}</option>}
                  {sessionId && !sessionNames.has(sessionId) && <option value={sessionId}>{t('sessionUnavailable')}</option>}
                  {selectableSessions.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
                </select></label>
                <p className={css.fieldHint}>{t('sessionIdHint')}</p>
              </div>
              {editing && <label>{t('createdAt')}<span className={css.fixedValue}>{formattedTime(editing.createdAt)}</span></label>}
              {editing && <label>{t('startedAt')}<span className={css.fixedValue}>{editing.startedAt === null ? t('notStarted') : formattedTime(editing.startedAt)}</span></label>}
              {editing && <label>{t('completedAt')}<span className={css.fixedValue}>{editing.completedAt === null ? t('notCompleted') : formattedTime(editing.completedAt)}</span></label>}
            </section>
          </form>
        </div>
        <div className={css.dialogFooter}>
          <button type="button" onClick={() => setComposerOpen(false)} disabled={busy || attachmentBusy}>{t('cancel')}</button>
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
