import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Button, IconChevronDownOutlineRegular, Menu, Modal, Pill, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SEARCH_LIMIT, TASK_STATUSES,
  // The subtask remotes stay on the face while the panel hides the feature.
  type CreateSubtaskRequest, type CreateTaskRequest, type DeleteSubtaskRequest, type DeleteTaskRequest,
  type ListTasksRequest, type SubtaskRecord, type TaskGraph, type TaskOverview, type TaskPage, type TaskPriority,
  type TaskRecord, type TaskStatus, type UpdateSubtaskRequest, type UpdateTaskRequest,
} from '../types.ts'
import type { TaskKey } from './locales.ts'
import { deriveTaskTitle } from './task-title.ts'
import { retainTaskSource, taskDocument } from './task-content.ts'
import { formattedTime } from './format-time.ts'
import { statusKey } from './task-status.ts'
import { pickDefaultWorkspace } from './workspaces.ts'
import css from './TaskPanel.module.css'
import { contentText, textContent } from '../content.ts'
import type { TaskAttachmentUpload, TaskContent } from '../types.ts'
import type { SyncFace } from './sync/face.ts'
import type { ListWorkitemFieldsRequest, ListWorkitemsRequest, SafeWorkitemDescription, SafeWorkitemDescriptionResult, SafeWorkitemField, SafeWorkitemPage, WorkitemFillField } from '../sync/dto.ts'
import { buildWorkitemBody } from './workitem-fill.ts'
import { SyncActions, SyncStatus } from './sync/SyncControls.tsx'
import { useSyncPanel } from './sync/use-sync-panel.ts'

import type { StatisticsRequest, StatisticsRunOptions, StatisticsSnapshot } from '../statistics.ts'
import { markQuickAddSaved, quickAddState, subscribeQuickAdd } from './quick-add.ts'
import { MoreTasks } from './MoreTasks.tsx'
import { TaskContentEditor } from './TaskContentEditor.tsx'
import { TaskCanvas, type TaskExecutionInfo } from './TaskCanvas.tsx'
import { TaskBoard } from './TaskBoard.tsx'
import { TaskRelationsField } from './TaskRelationsField.tsx'
import { TaskRow } from './TaskRow.tsx'
import { GRAPH_NODE_LIMIT, useTaskRelations } from './use-task-relations.ts'

// The report is the one heavy surface that shares no module with the panel
// itself, so it is the one surface fetched on demand through the host module
// loader's asynchronous chunk operation, as `client.StatisticsCalendar.js`.
// The Lexical editor, the work-item page, and the two graph surfaces all share
// modules with the entry bundle (`rich-text.ts`, `types.ts`); a shared module
// becomes its own chunk, and its consumers could then only reach it through a
// synchronous relative require — a URL the loader's module table cannot answer —
// so they stay in the entry bundle rather than ship an unloadable chunk.
const StatisticsCalendar = lazy(() => import('./StatisticsCalendar.tsx').then(module => ({ default: module.StatisticsCalendar })))

interface WorkspaceSnapshot {
  items: readonly { workspaceId: string; title: string }[]
}

/** One Session offered by the session picker. */
export interface SessionOption {
  id: string
  title: string
  archived: boolean
  subagent: boolean
  blank: boolean
  /** Agent preset the Session runs, when the Host projects one. */
  agent?: string | undefined
  /** True while the Session owns a live Agent. */
  running?: boolean | undefined
}
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
  /** One page of relationship data behind the canvas, the board, and the relation pickers. */
  taskGraph(): Promise<TaskGraph>
  /** Counts per status plus the Sessions the tasks are handled in. */
  taskOverview(): Promise<TaskOverview>
  /** Execution facts of one Session, or null when it is gone. */
  sessionExecution(sessionId: string): TaskExecutionInfo | null
  /** Manual sync surface; consumed by the sync UI, not by the task list rows. */
  sync: SyncFace
  /** One page of remote work items for the "more tasks" page. */
  listWorkitems(request: ListWorkitemsRequest): Promise<SafeWorkitemPage>
  /** The platform's own column catalog for one project category. */
  listWorkitemFields(request: ListWorkitemFieldsRequest): Promise<SafeWorkitemField[]>
  /** One work item's body, read only when a draft needs it. */
  getWorkitemDescription(request: { connectionId: string; projectId: string; id: string }): Promise<SafeWorkitemDescriptionResult>
}

export type TaskPanelProps = PropsLocale<'taskList'> & InjectFace<TaskFace> & {
  /**
   * Present only for the frame overlay's copy of this panel: it renders the
   * composer alone, over whatever page the user is on, and reports its close
   * back to the overlay request instead of a page that is not there.
   */
  dialog?: { onClose(): void } | undefined
}
type StatusFilter = 'all' | TaskStatus
/** The task list's own view switch; the value names the surface it draws. */
export type TaskView = 'list' | 'canvas' | 'board'
const statusKeys: TaskStatus[] = [...TASK_STATUSES]
const priorityKeys: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const pageSizes: number[] = [10, 20, 50, MAX_PAGE_SIZE]
/** Counts shown while the overview has not loaded yet. */
const EMPTY_OVERVIEW: TaskOverview = {
  counts: { todo: 0, in_progress: 0, approving: 0, done: 0 }, total: 0, blocked: 0, sessionIds: [],
}
/** Rows the first-load skeleton stands in for. */
const SKELETON_ROWS = [0, 1, 2, 3, 4]

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Progress of the composer's own write, shown in its footer. */
type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export function TaskPanel({
  list, create, update, remove, readAttachments,
  start, probeWorktree, listInitialEntries, initializeGit, listAgents, workspaceSnapshot, subscribeWorkspaces,
  sessionSnapshot, subscribeSessions, openSession, sync, calculateStatistics, listWorkitems, listWorkitemFields, getWorkitemDescription,
  taskGraph, taskOverview, sessionExecution, t, dialog,
}: TaskPanelProps) {
  const dialogMode = dialog !== undefined
  const [reportsOpen, setReportsOpen] = useState(false)
  const reportButton = useRef<HTMLButtonElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButton = useRef<HTMLButtonElement>(null)
  const [view, setView] = useState<TaskView>('list')
  const relations = useTaskRelations(taskGraph, taskOverview)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState('all')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  /**
   * The page-level write result. It floats above the page instead of occupying a
   * band above the list: the band moved the rows whenever a save settled, and a
   * refusal or an outcome reported there sat at the top of a scrolling surface.
   * The dialog keeps its own copy of the same two states in its footer.
   */
  const [report, setReport] = useState<{ text: string; seq: number; kind: 'success' | 'error' } | null>(null)
  const reportSeq = useRef(0)
  const reportWrite = useCallback((text: string, kind: 'success' | 'error') => {
    reportSeq.current += 1
    setReport({ text, seq: reportSeq.current, kind })
  }, [])
  /**
   * Report a page-level failure in both places it is needed: the state keeps the
   * dialog's own copy, and the banner says why the last action did not land.
   */
  const reportFailure = useCallback((failure: unknown) => {
    const text = errorText(failure)
    setError(text)
    reportWrite(`${t('error')}: ${text}`, 'error')
  }, [reportWrite, t])
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
  const [parentId, setParentId] = useState<string | null>(null)
  const [blockingIds, setBlockingIds] = useState<string[]>([])
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
  const listBody = useRef<HTMLDivElement>(null)
  const agentPrefilled = useRef(false)
  const quickAdd = useSyncExternalStore(subscribeQuickAdd, quickAddState)
  const sessionState = useSyncExternalStore(subscribeSessions, sessionSnapshot)
  const workspaceState = useSyncExternalStore(subscribeWorkspaces, workspaceSnapshot)
  const workspaces = workspaceState.items
  // Both projections walk the whole Session catalog, and the host pushes a fresh
  // snapshot on every stream frame; they are derived once per snapshot instead of
  // once per render.
  const sessionNames = useMemo(() => new Map(sessionState.items.map(row => [row.id, row.title])), [sessionState])
  // Mirror the Host sidebar's own visibility rule for the picker: internal
  // subagent runs, retired blank entries, and archived Sessions are not offered.
  // A Session already linked to this task is still echoed even when hidden.
  const selectableSessions = useMemo(() => sessionState.items.filter(row => !row.archived && !row.subagent && !row.blank), [sessionState])
  const linkedSession = sessionState.items.find(row => row.id === sessionId)
  const echoedLinkedSession = linkedSession !== undefined && (linkedSession.archived || linkedSession.subagent || linkedSession.blank)
    ? linkedSession : undefined
  // Memoised for identity, not for cost: the row list is keyed on this map, and
  // rebuilding it every render would defeat that.
  const workspaceNames = useMemo(() => new Map(workspaces.map(row => [row.workspaceId, row.title])), [workspaces])
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
      // The rows already on screen stay where they are: a failed reload reports
      // itself and leaves the last successful page in place.
      if (mounted.current && generation.current === current) reportFailure(failure)
    } finally {
      if (mounted.current && generation.current === current) setLoading(false)
    }
  }, [list, filter, query, workspaceFilter, defaultWorkspaceId, page, pageSize])

  // Sync lives on this page as the header's trailing menu row; its results and
  // refusals render below the toolbar, and nothing is drawn while it is idle.
  const syncPanel = useSyncPanel(sync, refresh)

  // Any change to the request identity (status, phrase, workspace, paging)
  // re-runs this effect and loads the matching page. The overlay's dialog copy
  // has no page to load, but its save path still reads `mounted` to decide
  // whether it may still close itself.
  useEffect(() => {
    mounted.current = true
    if (!dialogMode) void refresh()
    return () => { mounted.current = false; generation.current++ }
  }, [refresh, dialogMode])

  // A task created by the frame overlay's dialog is in the database, not in
  // this page's loaded rows: reload once per save, and only when this page is
  // the one on screen.
  const savedRevision = quickAdd.saved
  const seenSaved = useRef(savedRevision)
  useEffect(() => {
    if (savedRevision === seenSaved.current) return
    seenSaved.current = savedRevision
    if (!dialogMode) void refresh()
  }, [savedRevision, dialogMode, refresh])

  // A new page or filter starts at its first row; ordinary refreshes keep the
  // current position. Scroll the list body, never the panel or the window.
  useEffect(() => {
    if (listBody.current) listBody.current.scrollTop = 0
  }, [page, pageSize, filter, query, workspaceFilter])

  // Load the preset roster when the composer opens: fetching it at mount races
  // the Remote namespace mount, which left the Agent select with one option.
  useEffect(() => {
    if (!composerOpen) return
    let active = true
    void listAgents().then(rows => { if (active) setAgents(rows) }).catch(failure => { if (active) reportFailure(failure) })
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

  // The canvas and the board draw the relationship graph, and the composer's
  // two relation pickers read the same snapshot. One read serves all three; the
  // explicit refresh and the dialogs that write relations ask for a reload.
  const relationsLoad = relations.load
  useEffect(() => {
    if (dialogMode) return
    if (view !== 'list' || composerOpen) void relationsLoad()
  }, [view, composerOpen, dialogMode, relationsLoad])

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
    setParentId(null)
    setBlockingIds([])
    setUseWorktree(false)
    setError('')
    setSaveState('idle')
    setComposerOpen(true)
  }

  // The overlay mounts this copy to create a task, so its empty form is up as
  // soon as it mounts; the page's own copy stays closed until Add is clicked.
  useEffect(() => {
    if (dialogMode) openCreate()
  }, [])

  /**
   * Open the create composer prefilled from a remote work item. The body is
   * built from the fields the settings page has checked; saving stays the user's
   * own action, so the composer opens with the ordinary defaults.
   */
  const openDraft = (row: Record<string, unknown>, description: SafeWorkitemDescription | null, fillFields: readonly WorkitemFillField[]) => {
    setEditing(null)
    setContent(textContent(buildWorkitemBody(row, description, fillFields, t)))
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
    setParentId(null)
    setBlockingIds([])
    setUseWorktree(false)
    setError('')
    setSaveState('idle')
    setMoreOpen(false)
    setComposerOpen(true)
  }

  // Stable identities: each row is memoised on them, so it only re-renders when
  // something it shows actually changed.
  const openEdit = useCallback((task: TaskRecord) => {
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
    // The list row carries both relations, so the composer opens with them and
    // a save that changes nothing else still writes them back unchanged.
    setParentId(task.parentId ?? null)
    setBlockingIds([...task.blockingIds])
    setUseWorktree(task.useWorktree)
    setError('')
    setSaveState('idle')
    setComposerOpen(true)
  }, [defaultWorkspaceId])

  /**
   * Close the composer. The page keeps it inline; the overlay's copy is the
   * dialog itself, so closing means handing the request back to the frame.
   */
  const closeComposer = () => {
    if (dialog !== undefined) { dialog.onClose(); return }
    setComposerOpen(false)
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
      parentId, blockingIds,
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
    setSaveState('saving')
    setError('')
    try {
      await persist()
      if (!mounted.current) return
      setSaveState('saved')
      reportWrite(t('saved'), 'success')
      setEditing(null)
      closeComposer()
      // A saved relation (parent or dependency) changes the graph the canvas
      // and the pickers draw, so the snapshot is re-read with the page.
      void relationsLoad(true)
      // The dialog's own copy creates the row, not a page: the mounted task
      // list reloads through the request store instead.
      if (dialogMode) markQuickAddSaved()
      else await refresh()
    } catch (failure) {
      if (mounted.current) { setSaveState('failed'); reportFailure(failure) }
    }
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
    setSaveState('saving')
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
      if (mounted.current) { setSaveState('saved'); reportWrite(t('saved'), 'success'); await refresh() }
    } catch (failure) {
      if (!mounted.current) return
      setSaveState('failed')
      // A non-Git workspace is resolved with the initialization dialog, exactly as in the list.
      if (failure instanceof WorktreeNotGitError && saved !== null) {
        setInitializeTask({ task: saved, workspaceTitle: failure.workspaceTitle, workspacePath: failure.workspacePath })
        return
      }
      reportFailure(failure)
    }
    finally { if (mounted.current) setBusy(false) }
  }

  const deleteTask = useCallback(async (task: TaskRecord) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await remove({ id: task.id, version: task.version })
      if (mounted.current) {
        await refresh()
        void relationsLoad(true)
      }
    } catch (failure) {
      if (mounted.current) {
        await refresh()
        if (mounted.current) reportFailure(failure)
      }
    } finally { if (mounted.current) setBusy(false) }
  }, [busy, remove, refresh, relationsLoad])

  const startTask = useCallback(async (task: TaskRecord) => {
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
        if (mounted.current) reportFailure(failure)
      }
    }
    finally { if (mounted.current) setBusy(false) }
  }, [busy, start, refresh])

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
        if (mounted.current) reportFailure(failure)
      }
    } finally { if (mounted.current) setBusy(false) }
  }

  const finishTask = useCallback(async (task: TaskRecord) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await update({ id: task.id, version: task.version, status: 'done' })
      if (mounted.current) await refresh()
    } catch (failure) {
      if (mounted.current) {
        await refresh()
        if (mounted.current) reportFailure(failure)
      }
    } finally { if (mounted.current) setBusy(false) }
  }, [busy, update, refresh])

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

  // Each row is memoised on primitives and the stable callbacks above, so a
  // frame that changes nothing a row shows — a workspace snapshot with the same
  // membership, a keystroke in the search box — does not rebuild its timestamp,
  // its sanitised URL, or its element tree.
  const rows = tasks.map(task => {
    const linked = workspaceOf(task)
    return <TaskRow key={task.id} task={task} linked={linked} ready={workspaceReady(linked)} busy={busy}
      workspaceLabel={workspaceLabel(linked)} t={t}
      onOpen={openEdit} onStart={startTask} onFinish={finishTask} onDelete={deleteTask} />
  })

  // Everything below derives from the rows above, so the row memo is not
  // invalidated by a change to any of these elements.

  /** Execution facts of one Session; undefined when the Session is gone. */
  const executionOf = (id: string): TaskExecutionInfo | undefined => sessionExecution(id) ?? undefined

  // One page's controls, shared by the list and the canvas: the status tabs
  // stay usable in both views, while search and paging belong to the list.
  const statusFilters = <div className={css.filters} role="group" aria-label={t('status')}>
    {(['all', ...statusKeys] as StatusFilter[]).map(item => <button
      key={item} type="button" className={filter === item ? css.selected : css.filter}
      aria-pressed={filter === item} onClick={() => changeFilter(item)}>{item === 'all' ? t('all') : t(statusKey(item))}</button>)}
  </div>

  const listToolbar = <div className={css.toolbar}>
    {statusFilters}
    <div className={css.toolbarRight}>
      <form className={css.searchBox} role="search" onSubmit={event => { event.preventDefault(); submitSearch() }}>
        <input value={searchText} maxLength={SEARCH_LIMIT} placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')} onChange={event => setSearchText(event.target.value)} />
        {searchText !== '' && <button type="button" className={css.searchClear} title={t('clearSearch')}
          aria-label={t('clearSearch')} onClick={clearSearch}>×</button>}
        <button type="submit" className={css.searchButton} disabled={loading}>{t('search')}</button>
      </form>
      <Menu open={workspaceMenuOpen} portal className={css.workspaceMenu}
        selectedId={workspaceFilter}
        items={[{ id: 'all', label: t('allWorkspaces') },
          ...[...workspaceOptions].map(([id, name]) => ({ id: `ws:${id}`, label: name }))]}
        onClose={() => setWorkspaceMenuOpen(false)}
        onSelect={id => { setWorkspaceMenuOpen(false); changeWorkspaceFilter(id) }}
        anchor={<Button variant="outline" className={css.workspaceTrigger}
          aria-label={t('workspace')} aria-haspopup="menu" aria-expanded={workspaceMenuOpen}
          onClick={() => setWorkspaceMenuOpen(value => !value)}>
          <span className={css.workspaceName}>{workspaceFilter === 'all'
            ? t('allWorkspaces') : workspaceOptions.get(workspaceFilter.slice(3))}</span>
          <IconChevronDownOutlineRegular size={16} />
        </Button>} />
      <button type="button" className={css.textButton} onClick={() => void refresh()} disabled={loading}
        aria-busy={loading || undefined}>{t('refresh')}</button>
    </div>
  </div>

  const listBodyView = <div className={css.listBody} ref={listBody}>
  {/* Sync's own output only: a refused click's prompt, a failure, or a run's
      results. Idle, it renders nothing — the standing description of what
      sync does lives on its settings page. */}
  <SyncStatus panel={syncPanel} t={t} />
  {/* A reload keeps the rows and the scroll position: only this local quiet
      notice says a read is in flight. */}
  {loading && tasks.length > 0 && <p className={css.placeholder} role="status">{t('refreshing')}</p>}
  {/* The first load draws the rows' own box so the page does not jump when the
      page itself lands. */}
  {loading && tasks.length === 0 ? <div className={css.listSkeleton} role="status" aria-label={t('loading')}>
    {SKELETON_ROWS.map(index => <span key={index} />)}
  </div> : tasks.length === 0 ? <div className={css.empty}>
    <strong>{filtered ? t('emptySearch') : t('empty')}</strong><span>{filtered ? t('emptySearchHint') : t('emptyHint')}</span>
  </div> : <ul className={css.list}>
    {rows}
  </ul>}
  </div>

  const pager = total > 0 && <div className={css.pager}>
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
  </div>

  // One composer serves both surfaces: the page renders it over its list, and
  // the frame overlay's copy renders it alone. The surface, the mask, the focus
  // lifetime, and Escape belong to the host Modal; the classes below own only
  // the three-row layout and the field grid.
  const composerDialog = composerOpen && <Modal open onClose={closeComposer}
    title={editing ? t('edit') : t('add')}
    headless className={css.dialog + ' ' + css.dialogFixed}>
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
        <TaskRelationsField t={t} options={relations.optionsFor(editing?.id)} parentId={parentId} blockingIds={blockingIds}
          selfId={editing?.id} disabled={busy} onChange={next => { setParentId(next.parentId); setBlockingIds(next.blockingIds) }} />
      </form>
    </div>
    <div className={css.dialogFooter}>
      {/* The chord is what opens this composer on any page, so the New task form names it.
          The edit dialog keeps the row to its own actions. */}
      {editing === null && <span className={css.shortcutHint}>{t('shortcutHint')}</span>}
      {/* The write's own progress: saving and refusal are reported here, and the
          saved outcome stays in the list's notice after the dialog closes. */}
      {saveState !== 'idle' && <span className={css.saveState} data-state={saveState} role="status">{t(saveState === 'saving' ? 'saving' : saveState === 'saved' ? 'saved' : 'saveFailed')}</span>}
      <button type="button" onClick={closeComposer} disabled={busy || attachmentBusy}>{t('cancel')}</button>
      <button type="submit" form="task-list-form" className={css.primary} disabled={busy || !canSave} aria-busy={busy || undefined}>{t('save')}</button>
    </div>
  </Modal>

  const initializationDialog = initializeTask && <Modal open onClose={() => setInitializeTask(null)}
    title={t('initializeGitTitle')} closeLabel={t('cancel')}
    footer={<div className={css.dialogActions}>
      <button type="button" onClick={() => setInitializeTask(null)} disabled={busy}>{t('cancel')}</button>
      <button type="button" onClick={() => { const task = initializeTask.task; setInitializeTask(null); openEdit(task) }} disabled={busy}>{t('changeWorkspace')}</button>
      <button type="button" className={css.primary} onClick={() => void initializeAndStart()}
        disabled={busy || initialEntriesLoading || Boolean(initialEntriesError)}>{t('initializeAndStart')}</button>
    </div>}>
    <p>{t('initializeGitIntro')} <strong>{initializeTask.workspaceTitle}</strong></p>
    <p className={css.initPath}>{initializeTask.workspacePath}</p>
    <div className={css.initToolbar}>
      <strong>{t('initialCommitEntries')}</strong>
      <button type="button" disabled={busy || initialEntriesLoading || Boolean(initialEntriesError)}
        onClick={() => setSelectedEntries(selectableInitialEntries.map(entry => entry.name))}>{t('selectAll')}</button>
      <button type="button" disabled={busy || initialEntriesLoading || Boolean(initialEntriesError)}
        onClick={() => setSelectedEntries([])}>{t('selectNone')}</button>
    </div>
    {initialEntriesLoading ? <p className={css.initLoading} role="status">{t('initialEntriesLoading')}</p>
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
  </Modal>

  // These pressed buttons switch surfaces within the same task page.
  const viewSwitcher = <div className={css.viewSwitch} role="group" aria-label={t('viewLabel')}>
    {(['list', 'canvas', 'board'] as TaskView[]).map(item => <Pill
      key={item} className={css.viewButton} active={view === item}
      aria-pressed={view === item} onClick={() => setView(item)}>
      {t(item === 'list' ? 'viewList' : item === 'canvas' ? 'viewCanvas' : 'viewBoard')}
    </Pill>)}
  </div>

  const header = <header className={css.header}>
    <h1>{t('title')}</h1>
    {viewSwitcher}
    <div className={css.titleActions}>
      <Button className={css.reportButton} variant="outline" ref={reportButton} onClick={() => setReportsOpen(true)}>{t('statisticsTitle')}</Button>
      <Button className={css.reportButton} variant="outline" ref={moreButton} onClick={() => setMoreOpen(true)}>{t('moreTasksTitle')}</Button>
      {/* One right-hand block: the body creates a task, the trailing caret
          opens the menu holding Sync. */}
      <SyncActions addLabel={t('add')} onCreate={openCreate} panel={syncPanel} t={t} />
    </div>
  </header>

  // The canvas reads the same status filter as the list and applies it to the
  // nodes it draws; `all` means no restriction.
  const canvasFilter: TaskStatus[] = filter === 'all' ? [] : [filter]
  const graph = relations.graph
  const graphEdges = graph === null ? 0
    : graph.nodes.reduce((sum, node) => sum + node.parents.length + node.waitsOn.length, 0)
  const truncated = graph !== null && graph.nodes.length >= GRAPH_NODE_LIMIT
  const nodeSummary = t('canvasNodeCount')
    .replace('{count}', String(graph?.nodes.length ?? 0)).replace('{edges}', String(graphEdges))
  const relationError = relations.error

  const relationSurface = <div className={css.graphSurface}>
    {relationError !== '' ? <div className={css.error} role="alert">{t('error')}: {relationError}
      <button type="button" onClick={() => void relations.load(true)}>{t('retry')}</button></div>
      : relations.loading && graph === null ? <><div className={css.skeleton} aria-hidden="true" />
        <p className={css.placeholder} role="status">{t('loading')}</p></>
        : view === 'canvas' ? <TaskCanvas graph={graph ?? { nodes: [], truncated: false }} t={t} onOpen={openEdit}
          onOpenSession={sessionId => openSession(sessionId)} executionOf={executionOf} statusFilter={canvasFilter}
          empty={graph === null || graph.nodes.length === 0} />
          : <TaskBoard graph={graph ?? { nodes: [], truncated: false }} overview={relations.overview ?? EMPTY_OVERVIEW} t={t}
            onOpen={openEdit} onOpenSession={sessionId => openSession(sessionId)} executionOf={executionOf} />}
    {graph !== null && graph.nodes.length === 0 && relationError === '' && view === 'board'
      && <div className={css.empty}><strong>{t('canvasEmpty')}</strong><span>{t('canvasEmptyHint')}</span></div>}
  </div>

  // The canvas carries its own header, status counts, node summary, and view
  // controls, so only the status tabs are drawn above it. The board counts and
  // filters by status itself, so it is given no toolbar at all: a second status
  // row above it would be the same control twice.
  const canvasToolbar = <div className={css.graphToolbar}>
    {statusFilters}
    <div className={css.graphMeta}>
      <span className={css.graphCount}>{nodeSummary}</span>
      {truncated && <span className={css.graphWarn} role="status">{t('canvasTruncated').replace('{count}', String(GRAPH_NODE_LIMIT))}</span>}
      <button type="button" className={css.textButton} onClick={() => void relations.load(true)} disabled={relations.loading}>{t('refresh')}</button>
    </div>
  </div>

  /**
   * The page-level write result as the host's floating banner: the same surface
   * the archive report uses. A failed action carries the retry as its own inline
   * action, because the band that held that button moved the rows when it came
   * and went, and a long list could scroll it away.
   *
   * The composer's own footer already shows the write it just made, so only that
   * copy is withheld: a failure the dialog is not currently showing still
   * announces itself, and the banner outlives the dialog either way.
   */
  const resultToast = report === null || (composerOpen && report.text === `${t('error')}: ${error}`) ? null : <Toast
    key={report.seq}
    text={report.text}
    {...(report.kind === 'success'
      ? { tone: 'success' as const }
      : { holdMs: 6000, actions: [{ label: t('retry'), onClick: () => { setReport(null); void refresh() } }] })}
    onDone={() => { setReport(current => current?.seq === report.seq ? null : current) }}
  />

  // The overlay's copy is the dialog itself: it renders the composer over
  // whatever page is on screen and never draws the task page.
  if (dialog !== undefined) return <>{composerDialog}{initializationDialog}{resultToast}</>

  if (reportsOpen) return <main className={css.page} data-report="true">
    <div className={css.inner}>
      <Suspense fallback={<div className={css.skeleton} aria-hidden="true" />}>
        <StatisticsCalendar calculate={calculateStatistics} t={t} close={() => {
          setReportsOpen(false)
          requestAnimationFrame(() => reportButton.current?.focus())
        }} />
      </Suspense>
    </div>
    {resultToast}
  </main>

  if (moreOpen) return <main className={css.page} data-more="true">
    <div className={css.inner}>
      <MoreTasks sync={sync} listWorkitems={listWorkitems} listWorkitemFields={listWorkitemFields}
        getWorkitemDescription={getWorkitemDescription} onDraft={openDraft} t={t} close={() => {
        setMoreOpen(false)
        requestAnimationFrame(() => moreButton.current?.focus())
      }} />
    </div>
    {resultToast}
  </main>

  // Each surface is one page of the same panel: the canvas gets the status tabs
  // and its own node summary, the card board owns its scrolling and its counts.
  if (view !== 'list') return <main className={css.page} data-graph={view === 'canvas' ? 'true' : undefined} data-board={view === 'board' ? 'true' : undefined}>
    <div className={css.inner}>
      {header}
      {view === 'canvas' ? canvasToolbar : null}
      {relationSurface}
    </div>
    {composerDialog}
    {initializationDialog}
    {resultToast}
  </main>

  return <main className={css.page} data-list="true">
    <div className={css.inner}>
      {header}
      {listToolbar}
      {listBodyView}
      {pager}
    </div>

    {composerDialog}
    {initializationDialog}
    {resultToast}
  </main>
}
