// Browser regression fixture; bundled into an ignored directory, never shipped.
import { createRoot } from 'react-dom/client'
import { useSyncExternalStore } from 'react'
import { fileUpload } from '../src/client/rich-text.ts'
import type { DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { TaskCapture } from '../src/client/TaskCapture.tsx'
import { SyncSection } from '../src/client/sync/SyncSection.tsx'
import { zh } from '../src/client/locales.ts'
import { contentText } from '../src/content.ts'
import type { TaskRecord, TaskAttachmentUpload } from '../src/types.ts'

let tasks: TaskRecord[] = []
const attachments = new Map<string, TaskAttachmentUpload[]>()
let attachmentReads = 0
let failAttachmentReads = false
const snapshot = { items: [{ workspaceId: 'ws-test', title: '测试工作区' }] }
const subscribe = () => () => {}
let sessionSnapshot = { items: [
  { id: 'session-current', title: '当前中文会话', archived: false, subagent: false, blank: false },
  { id: 'session-other', title: '另一个中文会话', archived: false, subagent: false, blank: false },
  { id: 'session-subagent', title: '内部子代理会话', archived: false, subagent: true, blank: false },
  { id: 'session-blank', title: '未使用的新会话', archived: false, subagent: false, blank: true },
] }
const sessionListeners = new Set<() => void>()
let syncConnections: any[] = []
let statisticsCalls = 0
let failStatistics = false
const face = {
  calculateStatistics: async (request: any) => {
    statisticsCalls++
    if (failStatistics) throw new Error('统计读取失败测试')
    const cutoff = new Date(request.start)
    cutoff.setDate(8)
    cutoff.setHours(11)
    const hour = new Date(request.start)
    hour.setDate(8)
    hour.setHours(10)
    return { ...request, cutoff: cutoff.getTime(), calculatedAt: cutoff.getTime() + 36 * 60000, missingUsageCalls: 0,
      hours: [{ hour: hour.getTime(), sessions: 2, prompts: 5, tokens: 12345, completedTasks: 3, completedPoints: 8 }],
      totals: { sessions: 2, prompts: 5, tokens: 12345, completedTasks: 3, completedPoints: 8 } }
  },
  list: async () => ({ items: tasks, total: tasks.length, page: 1, pageSize: 20 }),
  create: async (request: any) => {
    const row = { ...request, notes: contentText(request.content), id: crypto.randomUUID(), version: 1, subtasks: [], createdAt: Date.now(), startedAt: null, completedAt: null }
    tasks = [row, ...tasks]
    attachments.set(row.id, request.attachments)
    return row
  },
  update: async (request: any) => {
    const row = { ...tasks.find(task => task.id === request.id)!, ...request, notes: contentText(request.content), version: request.version + 1 }
    tasks = tasks.map(task => task.id === row.id ? row : task)
    if (request.attachments?.length) attachments.set(row.id, [...attachments.get(row.id) ?? [], ...request.attachments])
    return row
  },
  remove: async (request: any) => { tasks = tasks.filter(task => task.id !== request.id); return { deleted: true } },
  readAttachments: async (request: any) => {
    attachmentReads++
    if (failAttachmentReads) throw new Error('附件读取失败测试')
    return attachments.get(request.id) ?? []
  },
  listAgents: async () => [], workspaceSnapshot: () => snapshot, subscribeWorkspaces: subscribe,
  sessionSnapshot: () => sessionSnapshot,
  subscribeSessions: (listener: () => void) => { sessionListeners.add(listener); return () => { sessionListeners.delete(listener) } },
  // The relationship surfaces read one graph and one overview; the fixture
  // derives both from the rows it already serves, including the reverse edges
  // the Host computes (children and waitedOnBy), so the canvas lays out the same
  // hierarchy the store would.
  taskGraph: async () => ({
    nodes: tasks.map(task => ({
      task,
      parents: task.parentId === null ? [] : [task.parentId],
      children: tasks.filter(row => row.parentId === task.id).map(row => row.id),
      waitsOn: [...task.blockingIds],
      waitedOnBy: tasks.filter(row => row.blockingIds.includes(task.id)).map(row => row.id),
      blocked: task.status !== 'done' && task.blockingIds.some(id => tasks.find(row => row.id === id)?.status !== 'done'),
    })),
    truncated: false,
  }),
  taskOverview: async () => ({
    counts: { todo: tasks.filter(task => task.status === 'todo').length, in_progress: tasks.filter(task => task.status === 'in_progress').length,
      approving: tasks.filter(task => task.status === 'approving').length, done: tasks.filter(task => task.status === 'done').length },
    total: tasks.length, blocked: tasks.filter(task => task.status !== 'done' && task.blockingIds.length > 0).length,
    sessionIds: tasks.map(task => task.sessionId).filter((id): id is string => id !== null),
  }),
  sessionExecution: (sessionId: string) => {
    const row = sessionSnapshot.items.find(item => item.id === sessionId)
    return row === undefined ? null : { title: row.title, agent: null, running: false, archived: row.archived }
  },
  sync: {
    listSyncConnections: async () => syncConnections, listSyncRules: async () => [],
    listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }),
    createSyncConnection: async (input: any) => { const row = { ...input, id: 'test-connection', revision: 1, instance: 'tapd:2001', credentialPresent: false }; syncConnections = [row]; return row },
  },
}
let input = { draft: '', phase: 'plain', attachmentIds: [] as DraftAttachmentId[], draftRev: 1 }
// Live link the composer slot resolves per capture; the regression toggles the
// blank state the way a New Session screen starts one.
let captureLink: { blank: boolean; workspaceId: string | null; agent: string | null } = { blank: false, workspaceId: 'ws-test', agent: 'preset-alpha' }
const resolveCaptureTarget = () => ({
  sessionId: captureLink.blank ? null : 'session-current',
  workspaceId: captureLink.workspaceId,
  agent: captureLink.agent,
})
const listeners = new Set<() => void>()
const draftFiles = new Map<DraftAttachmentId, File>()
const captureRequests: unknown[] = []
let failCapture = false
const publish = () => listeners.forEach(listener => listener())
const inputActions = {
  setDraft: (draft: string) => { input = { ...input, draft, draftRev: input.draftRev + 1 }; publish() },
  removeAttachment: (id: DraftAttachmentId) => { input = { ...input, attachmentIds: input.attachmentIds.filter(current => current !== id) }; publish() },
}
function useInput(select: any) {
  return select(useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => input))
}
const captureCreate = async (request: any) => {
  if (failCapture) throw new Error('保存失败测试')
  captureRequests.push(request)
  return face.create(request)
}
const captureAttachments = async (ids: DraftAttachmentId[]) => {
  const items = await Promise.all(ids.map(async id => {
    const file = draftFiles.get(id)!
    const attachmentId = crypto.randomUUID()
    return { node: { type: 'attachment', id: attachmentId, name: file.name, mediaType: file.type, bytes: file.size }, upload: { id: attachmentId, data: await fileUpload(file) } }
  }))
  return { blocks: items.map(item => item.node), uploads: items.map(item => item.upload) }
}
const t = (key: keyof typeof zh) => zh[key]
createRoot(document.getElementById('root')!).render(<>
  <TaskPanel {...face as any} t={t as any} />
  <div contentEditable suppressContentEditableWarning role="textbox" aria-label="测试对话输入框"
    onInput={event => inputActions.setDraft(event.currentTarget.textContent ?? '')} />
  <div data-testid="capture-slot" style={{ transform: 'translateZ(0)' }}>
    <TaskCapture {...{ useInput, inputActions, sessionId: 'session-current', resolveTarget: resolveCaptureTarget, create: captureCreate, captureAttachments,
      releaseAttachment: (id: DraftAttachmentId) => draftFiles.delete(id), t } as any} />
  </div>
</>)
// The sync settings page as the host settings panel mounts it (inline section,
// not a task-list modal); the fixture column mimics the panel's content width.
createRoot(document.getElementById('settings-root')!).render(
  <SyncSection {...{ sync: face.sync, workspaceSnapshot: () => snapshot, subscribeWorkspaces: subscribe, t, close: () => {} } as any} />)
Object.assign(window, { fixture: {
  statisticsCalls: () => statisticsCalls,
  failStatistics: (fail: boolean) => { failStatistics = fail },
  tasks: () => tasks,
  attachmentReads: () => attachmentReads,
  failAttachmentReads: (fail: boolean) => { failAttachmentReads = fail },
  renameSession: (id: string, title: string) => {
    sessionSnapshot = { items: sessionSnapshot.items.map(row => row.id === id ? { ...row, title } : row) }
    sessionListeners.forEach(listener => listener())
  },
  removeSession: (id: string) => {
    sessionSnapshot = { items: sessionSnapshot.items.filter(row => row.id !== id) }
    sessionListeners.forEach(listener => listener())
  },
  setArchived: (id: string, archived: boolean) => {
    sessionSnapshot = { items: sessionSnapshot.items.map(row => row.id === id ? { ...row, archived } : row) }
    sessionListeners.forEach(listener => listener())
  },
  addExternal: () => { tasks = [{ id: 'external', title: '独立远端标题', notes: '', content: { version: 1, blocks: [] }, status: 'todo', priority: 'medium', storyPoints: null, tags: [], workspaceId: 'ws-test', sendImmediately: false, sessionId: null, agent: null, useWorktree: false, startedAt: null, completedAt: null, parentId: null, blockingIds: [], version: 1, createdAt: Date.now(), updatedAt: Date.now(), subtasks: [], source: { platform: 'tapd', projectId: 'p', typeId: 'task', remoteId: '123', number: 'TASK-123', url: 'https://www.tapd.cn/2001/prong/tasks/view/123', lastSuccess: null, error: null } }, ...tasks] },
  /**
   * Seed one three-task hierarchy: `审批父任务` carries the running session,
   * `审批子任务` sits under it and waits on `前置依赖`, so the canvas has one
   * solid parent edge, one dashed wait edge, and a blocked card to draw.
   */
  seedRelations: () => {
    const now = Date.now()
    const row = (over: Partial<TaskRecord> & { id: string; title: string }): TaskRecord => ({
      notes: over.title, content: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: over.title }] }] }, status: 'todo', priority: 'medium', storyPoints: null,
      tags: [], workspaceId: 'ws-test', sendImmediately: false, sessionId: null, agent: null, useWorktree: false,
      startedAt: null, completedAt: null, parentId: null, blockingIds: [], version: 1, createdAt: now, updatedAt: now,
      subtasks: [], ...over,
    })
    tasks = [
      row({ id: 'relation-blocker', title: '前置依赖', notes: '前置依赖' }),
      row({ id: 'relation-child', title: '审批子任务', notes: '审批子任务', status: 'approving', parentId: 'relation-parent', blockingIds: ['relation-blocker'] }),
      row({ id: 'relation-parent', title: '审批父任务', notes: '审批父任务', status: 'in_progress', sessionId: 'session-current' }),
      ...tasks,
    ]
  },
  captures: () => captureRequests,
  setCaptureLink: (patch: Partial<typeof captureLink>) => { captureLink = { ...captureLink, ...patch } },
  input: () => input,
  failCapture: (fail: boolean) => { failCapture = fail },
  stageFiles: (files: File[]) => {
    const ids = files.map(file => { const id = crypto.randomUUID() as DraftAttachmentId; draftFiles.set(id, file); return id })
    input = { ...input, attachmentIds: [...input.attachmentIds, ...ids] }
    publish()
  },
} })
