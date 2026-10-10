import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ConversationController, DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CreateSubtaskRequest, CreateTaskRequest, DeleteSubtaskRequest, DeleteTaskRequest, ListTasksRequest,
  SubtaskRecord, TaskPage, TaskRecord, UpdateSubtaskRequest, UpdateTaskRequest,
} from '../types.ts'
import type { GetWorkitemDescriptionRequest, ListOrganizationsRequest, ListWorkitemFieldsRequest, ListWorkitemsRequest, OrganizationChoice, SafeWorkitemDescriptionResult, SafeWorkitemField, SafeWorkitemPage } from '../sync/dto.ts'
import { REMOTE_NAMESPACE, TYPERT_REMOTE } from '../remote.ts'
import { createSyncFace, type SyncRemoteService } from './sync/face.ts'
import { SyncSection } from './sync/SyncSection.tsx'
import { NS, en, zh, type TaskKey } from './locales.ts'
import { TaskPanel, WorktreeNotGitError, type InitialCommitEntry, type SessionSnapshot, type TaskFace } from './TaskPanel.tsx'
import { TaskCapture } from './TaskCapture.tsx'
import { captureTarget, type CaptureTarget } from './capture.ts'
import { pickDefaultWorkspace } from './workspaces.ts'
import { ATTACHMENT_BYTE_LIMIT, ATTACHMENT_COUNT_LIMIT, ATTACHMENT_TOTAL_LIMIT, contentAttachments, contentMarkdown, textContent } from '../content.ts'
import { attachmentFile, fileUpload } from './rich-text.ts'
import { taskDocument, taskDraft } from './task-content.ts'
import type { TaskAttachmentUpload, TaskContent } from '../types.ts'
import { persistRichTask, type TaskStorageCapabilities } from './task-persistence.ts'
import type { StatisticsRequest, StatisticsRunOptions, StatisticsRunState, StatisticsSnapshot } from '../statistics.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { taskList: TaskKey }
}

interface RemoteService {
  calculateStatistics(request: StatisticsRequest): Promise<RemoteResult<StatisticsSnapshot>>
  listSyncOrganizations(request: ListOrganizationsRequest): Promise<RemoteResult<OrganizationChoice[]>>
  listWorkitems(request: ListWorkitemsRequest): Promise<RemoteResult<SafeWorkitemPage>>
  listWorkitemFields(request: ListWorkitemFieldsRequest): Promise<RemoteResult<SafeWorkitemField[]>>
  getWorkitemDescription(request: GetWorkitemDescriptionRequest): Promise<RemoteResult<SafeWorkitemDescriptionResult>>
  startStatistics(request: StatisticsRequest & { refresh?: boolean }): Promise<RemoteResult<{ jobId: string }>>
  getStatisticsRun(request: { jobId: string }): Promise<RemoteResult<StatisticsRunState | null>>
  cancelStatistics(request: { jobId: string }): Promise<RemoteResult<{ cancelled: boolean }>>
  capabilities(request: Record<string, never>): Promise<RemoteResult<TaskStorageCapabilities>>
  readTaskAttachments(request: { id: string; version: number }): Promise<RemoteResult<TaskAttachmentUpload[]>>
  listTasks(request: ListTasksRequest): Promise<RemoteResult<TaskPage>>
  createTask(request: CreateTaskRequest): Promise<RemoteResult<TaskRecord>>
  updateTask(request: UpdateTaskRequest): Promise<RemoteResult<TaskRecord>>
  deleteTask(request: DeleteTaskRequest): Promise<RemoteResult<{ deleted: true }>>
  createSubtask(request: CreateSubtaskRequest): Promise<RemoteResult<SubtaskRecord>>
  updateSubtask(request: UpdateSubtaskRequest): Promise<RemoteResult<SubtaskRecord>>
  deleteSubtask(request: DeleteSubtaskRequest): Promise<RemoteResult<{ deleted: true }>>
}

interface AgentPresetService {
  list(): Promise<RemoteResult<{ presets: readonly { id: string; name?: string; isDefault: boolean; broken?: string }[] }>>
  select(sessionId: string, agent: string): Promise<RemoteResult<string>>
}

/** Projection of the Session Controller catalog the picker needs. */
interface SessionListLike {
  ids: readonly string[]
  byId: Record<string, {
    displayTitle?: string
    origin?: string
    blank?: boolean
    /** Host-projected values, including the agent preset a Session runs. */
    projectionValues?: { agentPreset?: unknown }
  } | undefined>
}

interface WorkspaceArchiveSnapshotLike {
  archivedSessionIds: readonly string[]
}

interface WorktreeStartResult { sessionId: string; workspaceId: string }

async function worktreeRequest(method: 'list' | 'start' | 'init' | 'init-files', request: Record<string, unknown>, gitUnavailableMessage: string): Promise<unknown> {
  const response = await fetch(`/worktree/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (body as { error?: { message?: string; code?: string } } | null)?.error
    if (error?.code === 'git_not_found' || /\bspawn\s+git\s+ENOENT\b/iu.test(error?.message ?? '')) {
      throw new Error(gitUnavailableMessage)
    }
    throw new Error(error?.message ?? `dsh-worktree is unavailable (${response.status})`)
  }
  return body
}

async function startWorktree(cwd: string, agent: string | null, gitUnavailableMessage: string): Promise<WorktreeStartResult> {
  const body = await worktreeRequest('start', { cwd, ...(agent ? { agentPreset: agent } : {}) }, gitUnavailableMessage)
  const result = body as WorktreeStartResult | null
  if (!result || typeof result.sessionId !== 'string' || typeof result.workspaceId !== 'string') {
    throw new Error('dsh-worktree returned an invalid session')
  }
  return result
}

async function unwrap<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  const result = await call
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

/** How often the browser asks a running sweep for its counters. */
const STATISTICS_POLL_MS = 200

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError())
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, ms)
    function onAbort(): void { clearTimeout(timer); reject(abortError()) }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function TaskIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <rect x="3" y="2.5" width="14" height="15" rx="2" />
    <path d="m6 7 1.4 1.4L10 5.8M11.5 7.2H14M6 12h2.5M11.5 12H14" />
  </svg>
}

// `remote.agentPresets` must be injected explicitly: Cordis refuses a
// namespace property that the plugin did not declare.
export const inject = ['slots', 'locale', 'remote', 'remote.agentPresets', 'workspaces', 'sessions', 'conversation', 'uiWorkspace']
export async function apply(ctx: Context): Promise<void> {
  const off = await ctx.remote.$mount(TYPERT_REMOTE)
  ctx.effect(() => () => off(), 'task-list: remote mount')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-list: dictionaries')
  const t = ctx.locale.bind(NS)
  const remote = (): RemoteService & SyncRemoteService => {
    const service = ctx.get(`remote.${REMOTE_NAMESPACE}`) as (RemoteService & SyncRemoteService) | undefined
    if (!service) throw new Error('taskList namespace is not mounted')
    return service
  }
  const conversation = () => ctx.conversation as ConversationController
  const agentPresets = (): AgentPresetService => ctx.remote.agentPresets as unknown as AgentPresetService
  const workspaceFor = (id: string | null) => ctx.workspaces.list.getSnapshot().items.find(item => item.workspaceId === id)
  // Project the Session catalog and archive registry together. Archived sessions
  // are hidden from new selections but remain available for an existing task's
  // linked-session value to render in the editor. The archive set is re-read on
  // every render, and the panel already re-renders on Workspace snapshot changes,
  // so archiving a session while the composer is open drops it on the next pass.
  const noArchives: readonly string[] = []
  // Compare archive sets by content, so a caller publishing a fresh array with
  // the same membership cannot invalidate the projection identity that
  // useSyncExternalStore depends on.
  const sameArchiveSet = (left: readonly string[], right: readonly string[]): boolean =>
    left === right || (left.length === right.length && left.every((id, index) => id === right[index]))
  let sessionCache: { source: unknown; archives: readonly string[]; value: SessionSnapshot } = { source: undefined, archives: noArchives, value: { items: [] } }
  const sessionSnapshot = (): SessionSnapshot => {
    const snapshot = ctx.sessions.list.getSnapshot() as unknown as SessionListLike | undefined
    const archiveSnapshot = ctx.workspaces.list.getSnapshot() as unknown as WorkspaceArchiveSnapshotLike | undefined
    const archivedSessionIds = archiveSnapshot?.archivedSessionIds ?? noArchives
    if (sessionCache.source !== snapshot || !sameArchiveSet(sessionCache.archives, archivedSessionIds)) {
      const ids = snapshot?.ids ?? []
      const byId = snapshot?.byId ?? {}
      const archived = new Set(archivedSessionIds)
      sessionCache = {
        source: snapshot,
        archives: archivedSessionIds,
        // `subagent` and `blank` mirror the Host sidebar's own visibility rule:
        // internal subagent runs and retired blank entries never become picker rows.
        value: { items: ids.map(id => ({ id, title: byId[id]?.displayTitle?.trim() || t('sessionUntitled'), archived: archived.has(id), subagent: byId[id]?.origin === 'subagent', blank: byId[id]?.blank === true })) },
      }
    }
    return sessionCache.value
  }
  const probeWorktree = async (workspaceId: string): Promise<void> => {
    const workspace = workspaceFor(workspaceId)
    if (workspace === undefined) throw new Error(t('startWorkspaceMissing'))
    if (!workspace.path) throw new Error(t('worktreeRequiresGit'))
    try {
      const result = await worktreeRequest('list', { cwd: workspace.path }, t('gitUnavailable')) as { worktrees?: unknown } | null
      if (!Array.isArray(result?.worktrees) || result.worktrees.length === 0) throw new Error(t('worktreeRequiresGit'))
    } catch (error) {
      if (/not a git repository/iu.test(error instanceof Error ? error.message : String(error))) {
        throw new WorktreeNotGitError(workspace.title, workspace.path, t('worktreeRequiresGit'))
      }
      throw error
    }
  }
  // Ctrl+S links the live Session, its Workspace, and its agent. A blank Session
  // is the reusable seat of the next New Session, so the task keeps no Session
  // link while it lasts, while the Workspace it was opened in and the preset it
  // would run still describe the captured work.
  const resolveCaptureTarget = async (sessionId: string): Promise<CaptureTarget> => {
    const sessions = ctx.sessions?.list?.getSnapshot?.() as unknown as SessionListLike | undefined
    const session = sessions?.byId?.[sessionId]
    const preset = session?.projectionValues?.agentPreset
    return captureTarget({
      sessionId,
      session,
      workspaces: ctx.workspaces?.list?.getSnapshot?.()?.items ?? [],
      // The default is what a Session recording no preset actually runs, and the
      // roster read is skipped whenever the Session already records one.
      defaultAgent: typeof preset === 'string' && preset !== '' ? null : await defaultAgentPreset(),
    })
  }
  /** Host-effective default agent preset, or null when the roster read fails. */
  const defaultAgentPreset = async (): Promise<string | null> => {
    try {
      const result = await agentPresets().list()
      if (!result.ok) return null
      return result.value.presets.find(row => row.isDefault && !row.broken)?.id ?? null
    } catch { return null }
  }
  const face: TaskFace = {
    calculateStatistics: async (request, options = {}) => {
      const service = remote()
      const started = await unwrap(service.startStatistics(options.refresh === true ? { ...request, refresh: true } : request))
      let settled = false
      try {
        for (;;) {
          if (options.signal?.aborted) throw abortError()
          const run = await unwrap(service.getStatisticsRun({ jobId: started.jobId }))
          if (run === null) throw new Error('statistics run is no longer available')
          options.onProgress?.({ processed: run.processed, total: run.total, reused: run.reused })
          if (run.status === 'completed') {
            if (!run.snapshot) throw new Error('statistics run finished without a result')
            settled = true
            return run.snapshot
          }
          if (run.status === 'cancelled') throw abortError()
          if (run.status === 'failed') throw new Error(run.error ?? 'statistics failed')
          await delay(STATISTICS_POLL_MS, options.signal)
        }
      } finally {
        // A closed dialog or a superseded run must stop the host sweep too.
        if (!settled) await service.cancelStatistics({ jobId: started.jobId }).catch(() => undefined)
      }
    },
    list: request => unwrap(remote().listTasks(request)),
    listWorkitems: request => unwrap(remote().listWorkitems(request)),
    listWorkitemFields: request => unwrap(remote().listWorkitemFields(request)),
    getWorkitemDescription: request => unwrap(remote().getWorkitemDescription(request)),
    readAttachments: request => unwrap(remote().readTaskAttachments(request)),
    create: request => persistRichTask(request.content, () => unwrap(remote().capabilities({})),
      () => unwrap(remote().createTask(request)), task => unwrap(remote().readTaskAttachments({ id: task.id, version: task.version })), t('storageUpgradeRequired')),
    update: request => persistRichTask(request.content, () => unwrap(remote().capabilities({})),
      () => unwrap(remote().updateTask(request)), task => unwrap(remote().readTaskAttachments({ id: task.id, version: task.version })), t('storageUpgradeRequired')),
    remove: request => unwrap(remote().deleteTask(request)),
    createSubtask: request => unwrap(remote().createSubtask(request)),
    updateSubtask: request => unwrap(remote().updateSubtask(request)),
    removeSubtask: request => unwrap(remote().deleteSubtask(request)),
    openSession: sessionId => ctx.uiWorkspace.openSession(sessionId as Parameters<typeof ctx.uiWorkspace.openSession>[0]),
    sessionSnapshot,
    subscribeSessions: listener => ctx.sessions.list.subscribe(listener),
    listAgents: async () => {
      const result = await agentPresets().list()
      if (!result.ok) throw new Error(result.error.message)
      return result.value.presets
    },
    probeWorktree,
    listInitialEntries: async workspaceId => {
      const result = await worktreeRequest('init-files', { workspaceId }, t('gitUnavailable')) as { entries?: InitialCommitEntry[] } | null
      if (!Array.isArray(result?.entries)) throw new Error('dsh-worktree returned an invalid file list')
      return result.entries
    },
    initializeGit: async (workspaceId, selectedEntries) => {
      const result = await worktreeRequest('init', { workspaceId, selectedEntries }, t('gitUnavailable')) as { initialized?: unknown } | null
      if (result?.initialized !== true) throw new Error('dsh-worktree did not initialize the repository')
    },
    start: async task => {
      // A task without a linked workspace belongs to the default one instead
      // of being unlaunchable; an explicitly linked but deleted workspace is
      // still an error the caller must fix.
      const workspace = task.workspaceId === null
        ? pickDefaultWorkspace(ctx.workspaces.list.getSnapshot().items, t('defaultWorkspaceName'))
        : workspaceFor(task.workspaceId)
      if (workspace === undefined) throw new Error('task workspace is unavailable')
      const document = taskDocument(task)
      const nodes = contentAttachments(document)
      // Read before creating a session, so stale tasks or missing bytes do not launch empty sessions.
      const uploads = nodes.length ? await unwrap(remote().readTaskAttachments({ id: task.id, version: task.version })) : []
      const files = nodes.map(node => {
        const upload = uploads.find(upload => upload.id === node.id)
        if (!upload) throw new Error(t('attachmentMissing'))
        return attachmentFile(node, upload.data)
      })
      let sessionId: string
      if (task.useWorktree) {
        await probeWorktree(workspace.workspaceId)
        sessionId = (await startWorktree(workspace.path!, task.agent, t('gitUnavailable'))).sessionId
        await ctx.sessions.refresh()
        if (!ctx.sessions.list.getSnapshot().byId[sessionId]) await ctx.sessions.refresh()
      } else {
        sessionId = await ctx.sessions.create({ workspaceId: workspace.workspaceId })
      }
      await ctx.sessions.using(sessionId, { source: 'controllerOperation' }, async () => {
        const scope = ctx.sessions.scope(sessionId as Parameters<typeof ctx.sessions.scope>[0])
        if (scope === undefined) throw new Error('new session has no active scope')
        if (task.agent && !task.useWorktree) {
          await unwrap(agentPresets().select(sessionId, task.agent))
        }
        // The title is derived from the content, so the draft carries the content
        // only; a legacy row without content still falls back to its stored title.
        const content = taskDraft(task)
        const input = ctx.conversation.input.for(scope)
        const drafts = files.length ? conversation().createDrafts(sessionId as Parameters<ConversationController['createDrafts']>[0], files) : []
        try {
          if (drafts.length && !input.addAttachments(drafts.map(draft => draft.id))) throw new Error(t('captureBusy'))
          input.setDraft(content)
          await unwrap(remote().updateTask({ id: task.id, version: task.version, status: 'in_progress', sessionId }))
        } catch (error) {
          for (const draft of drafts) input.removeAttachment(draft.id)
          if (drafts.length) conversation().releaseDraftAttachments(drafts)
          throw error
        }
        ctx.uiWorkspace.openSession(sessionId)
        if (task.sendImmediately) input.submit('queue', 'click')
      })
    },
    workspaceSnapshot: () => ctx.workspaces.list.getSnapshot(),
    subscribeWorkspaces: listener => ctx.workspaces.list.subscribe(listener),
    sync: createSyncFace(() => remote()),
  }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'task-list', locale: NS, inject: () => face }, TaskPanel))
  // Sync settings are one page of the host's settings panel rather than a modal
  // of the task list: the same face, rendered inline. A rule no longer carries a
  // workspace, so the section does not need the workspace roster.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'task-list-sync', order: 26, label: () => t('syncSettings'), locale: NS,
    inject: () => ({ sync: face.sync, listWorkitemFields: face.listWorkitemFields }),
  }, SyncSection))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: 'task-list', order: 25, label: () => t('nav'),
  }, TaskIcon))
  // Ctrl+S stores the unsent draft as a task. Mount the listener with the
  // composer; feedback uses the host's top toast, without a capture button.
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right', id: 'task-capture', order: 60, locale: NS,
    inject: sessionId => ({
      sessionId,
      resolveTarget: () => resolveCaptureTarget(sessionId),
      create: (request: CreateTaskRequest) => face.create(request),
      captureAttachments: async (ids: readonly DraftAttachmentId[]): Promise<{ blocks: TaskContent['blocks']; uploads: TaskAttachmentUpload[] }> => {
        const drafts = conversation().resolveDraftAttachments(ids)
        if (drafts.length !== ids.length) throw new Error(t('attachmentMissing'))
        if (drafts.length > ATTACHMENT_COUNT_LIMIT || drafts.some(draft => draft.file.size > ATTACHMENT_BYTE_LIMIT)
          || drafts.reduce((sum, draft) => sum + draft.file.size, 0) > ATTACHMENT_TOTAL_LIMIT) throw new Error(t('attachmentLimit'))
        const items = await Promise.all(drafts.map(async draft => {
          const id = crypto.randomUUID()
          return { node: { type: 'attachment' as const, id, name: draft.file.name, mediaType: draft.file.type || 'application/octet-stream', bytes: draft.file.size }, upload: { id, data: await fileUpload(draft.file) } }
        }))
        return { blocks: items.map(item => item.node), uploads: items.map(item => item.upload) }
      },
      releaseAttachment: (id: DraftAttachmentId) => conversation().releaseDraftAttachment(id),
    }),
  }, TaskCapture))
}
