import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  CreateTaskRequest, DeleteTaskRequest, ListTasksRequest, TaskPriority, TaskRecord, TaskStatus, UpdateTaskRequest,
} from '../types.ts'
import { deriveTaskTitle } from './task-title.ts'
import { pickDefaultWorkspace } from './workspaces.ts'
import css from './TaskPanel.module.css'

interface WorkspaceSnapshot {
  items: readonly { workspaceId: string; title: string }[]
}

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
  list(request: ListTasksRequest): Promise<TaskRecord[]>
  create(request: CreateTaskRequest): Promise<TaskRecord>
  update(request: UpdateTaskRequest): Promise<TaskRecord>
  remove(request: DeleteTaskRequest): Promise<{ deleted: true }>
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formattedTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

export function TaskPanel({
  list, create, update, remove, start, probeWorktree, listInitialEntries, initializeGit, listAgents, workspaceSnapshot, subscribeWorkspaces, t,
}: TaskPanelProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<TaskRecord | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
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
  const workspaceState = useSyncExternalStore(subscribeWorkspaces, workspaceSnapshot)
  const workspaces = workspaceState.items
  const workspaceNames = new Map(workspaces.map(row => [row.workspaceId, row.title]))
  const defaultWorkspace = pickDefaultWorkspace(workspaces, t('defaultWorkspaceName'))
  const defaultWorkspaceId = defaultWorkspace?.workspaceId ?? null
  const defaultAgent = agents.find(row => row.isDefault && !row.broken)

  const refresh = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    try {
      const rows = await list({})
      if (mounted.current && generation.current === current) {
        setTasks(rows)
        setError('')
      }
    } catch (failure) {
      if (mounted.current && generation.current === current) setError(errorText(failure))
    } finally {
      if (mounted.current && generation.current === current) setLoading(false)
    }
  }, [list])

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
    setTitle('')
    setNotes('')
    setStatus('todo')
    setPriority('medium')
    setStoryPoints('')
    setTagsInput('')
    setWorkspaceId(defaultWorkspaceId ?? '')
    setSendImmediately(false)
    setSessionId('')
    setAgent('')
    setUseWorktree(false)
    setComposerOpen(true)
  }

  const openEdit = (task: TaskRecord) => {
    setEditing(task)
    setTitle(task.title)
    setNotes(task.notes)
    setStatus(task.status)
    setPriority(task.priority)
    setStoryPoints(task.storyPoints === null ? '' : String(task.storyPoints))
    setTagsInput(task.tags.join(', '))
    setWorkspaceId(task.workspaceId ?? defaultWorkspaceId ?? '')
    setSendImmediately(task.sendImmediately)
    setSessionId(task.sessionId ?? '')
    setAgent(task.agent ?? '')
    setUseWorktree(task.useWorktree)
    setComposerOpen(true)
  }

  const derivedTitle = deriveTaskTitle(title, notes)

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
      if (editing) await update({ id: editing.id, version: editing.version, status, ...fields })
      else await create(fields)
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
  const visible = tasks.filter(task => (filter === 'all' || task.status === filter)
    && (workspaceFilter === 'all' || workspaceOf(task) === workspaceFilter.slice(3)))
    .sort((left, right) => statusKeys.indexOf(left.status) - statusKeys.indexOf(right.status)
      || right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
  const selectableInitialEntries = initialEntries.filter(entry => entry.kind !== 'nested_repository')
  const canSave = Boolean(derivedTitle)
  const sessionIdLocked = Boolean(editing?.sessionId)

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
            aria-pressed={filter === item} onClick={() => setFilter(item)}>{t(item === 'in_progress' ? 'inProgress' : item)}</button>)}
        </div>
        <div className={css.toolbarRight}>
          <select aria-label={t('workspace')} value={workspaceFilter} onChange={event => setWorkspaceFilter(event.target.value)}>
            <option value="all">{t('allWorkspaces')}</option>
            {[...workspaceOptions].map(([id, name]) => <option key={id} value={`ws:${id}`}>{name}</option>)}
          </select>
          <button type="button" className={css.textButton} onClick={() => void refresh()} disabled={loading}>{t('refresh')}</button>
        </div>
      </div>

      {error && <div className={css.error} role="alert">{t('error')}: {error} <button type="button" onClick={() => void refresh()}>{t('retry')}</button></div>}
      {loading && tasks.length === 0 ? <p className={css.placeholder}>{t('loading')}</p> : visible.length === 0 ? <div className={css.empty}>
        <strong>{t('empty')}</strong><span>{t('emptyHint')}</span>
      </div> : <ul className={css.list}>
        {visible.map(task => {
          const linked = workspaceOf(task)
          const ready = workspaceReady(linked)
          return <li className={css.row} data-priority={task.priority} key={task.id}>
            <button type="button" className={css.rowOpen} onClick={() => openEdit(task)} disabled={busy}
              aria-label={`${t('edit')}: ${task.title}`} />
            <div className={css.rowMain}>
              <h2 className={task.status === 'done' ? css.completed : ''} title={task.title}>{task.title}</h2>
              <div className={css.rowMeta}>
                <span className={css.workspaceMeta} title={workspaceLabel(linked)}>{workspaceLabel(linked)}</span>
                <span className={css.metaSeparator} aria-hidden="true">·</span>
                <span className={css.createdMeta} title={formattedTime(task.createdAt)}>{t('createdAt')} {formattedTime(task.createdAt)}</span>
              </div>
            </div>
            <div className={css.rowActions}>
              {task.status === 'done' ? <span className={css.doneState}>{t('done')}</span> : <button
                type="button" className={css.start}
                onClick={() => void (task.status === 'todo' ? startTask(task) : finishTask(task))}
                disabled={busy || task.status === 'todo' && !ready}
                aria-label={`${t(task.status === 'todo' ? 'start' : 'finish')}: ${task.title}`}
                title={task.status === 'todo' && !ready ? linked === null ? t('startRequiresWorkspace') : t('startWorkspaceMissing') : undefined}>
                {t(task.status === 'todo' ? 'start' : 'finish')}
              </button>}
              <button type="button" className={css.delete} onClick={() => void deleteTask(task)} disabled={busy}
                aria-label={`${t('remove')}: ${task.title}`} title={t('remove')}>×</button>
            </div>
          </li>
        })}
      </ul>}
    </div>

    {composerOpen && <div className={css.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setComposerOpen(false) }}>
      <div className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="task-list-dialog-title">
        <h2 id="task-list-dialog-title">{editing ? t('edit') : t('add')}</h2>
        <form onSubmit={event => void save(event)}>
          <label className={css.full}>{t('titleLabel')}<input value={title} maxLength={200} placeholder={t('titleHint')} onChange={event => setTitle(event.target.value)} /></label>
          <label className={css.full}>{t('notesLabel')}<textarea autoFocus required value={notes} maxLength={20000} rows={3} onChange={event => setNotes(event.target.value)} /></label>
          {editing && <label>{t('status')}<select value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>
            {statusKeys.map(item => <option key={item} value={item}>{t(item === 'in_progress' ? 'inProgress' : item)}</option>)}
          </select></label>}
          <label>{t('priorityLabel')}<select value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>
            {priorityKeys.map(item => <option key={item} value={item}>{t(item)}</option>)}
          </select></label>
          <label>{t('storyPoints')}<input type="number" min="0" max="1000" step="1" value={storyPoints} onChange={event => setStoryPoints(event.target.value)} /></label>
          <label className={css.full}>{t('tags')}<input value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder={t('tagsHint')} /></label>
          <label className={css.full}>{t('workspace')}<select value={workspaceId} onChange={event => setWorkspaceId(event.target.value)}>
            {workspaces.length === 0 && <option value="">{t('noWorkspace')}</option>}
            {workspaceId && !workspaceOptions.has(workspaceId) && <option value={workspaceId}>{workspaceId}</option>}
            {[...workspaceOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>{t('agent')}<select value={agent} onChange={event => setAgent(event.target.value)}>
            <option value="">{t('defaultAgent')}</option>
            {agent && !agents.some(row => row.id === agent) && <option value={agent}>{agent}</option>}
            {agents.map(row => <option key={row.id} value={row.id} disabled={Boolean(row.broken)}>{row.name ?? row.id}{row.isDefault ? ` · ${t('defaultAgent')}` : ''}</option>)}
          </select></label>
          <label className={css.full}>{t('sessionId')}<input value={sessionId} maxLength={200} readOnly={sessionIdLocked} onChange={event => setSessionId(event.target.value)} placeholder={t('sessionIdHint')} /></label>
          {sessionIdLocked && <p className={css.fieldHint + ' ' + css.full}>{t('sessionIdLocked')}</p>}
          <label className={css.toggle}><input type="checkbox" checked={sendImmediately} onChange={event => setSendImmediately(event.target.checked)} />{t('sendImmediately')}</label>
          <label className={css.toggle}><input type="checkbox" checked={useWorktree} onChange={event => setUseWorktree(event.target.checked)} />{t('useWorktree')}</label>
          {useWorktree && <p className={css.worktreeHint + ' ' + (worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? css.worktreeError : '')} role={worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? 'alert' : undefined}>
            {!workspaceId ? t('startRequiresWorkspace') : worktreeProbe?.workspaceId !== workspaceId || worktreeProbe.checking ? t('worktreeChecking')
              : worktreeProbe.needsInit ? t('worktreeNeedsInit') : worktreeProbe.error || t('worktreeAvailable')}
          </p>}
          {editing && <div className={css.full + ' ' + css.readOnlyTimes}>
            <span>{t('createdAt')}: {formattedTime(editing.createdAt)}</span>
            {editing.startedAt !== null && <span>{t('startedAt')}: {formattedTime(editing.startedAt)}</span>}
            {editing.completedAt !== null && <span>{t('completedAt')}: {formattedTime(editing.completedAt)}</span>}
          </div>}
          <div className={css.dialogActions + ' ' + css.full}>
            <button type="button" onClick={() => setComposerOpen(false)} disabled={busy}>{t('cancel')}</button>
            <button type="submit" className={css.primary} disabled={busy || !canSave}>{t('save')}</button>
          </div>
        </form>
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
