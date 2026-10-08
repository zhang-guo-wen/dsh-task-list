// Browser regression fixture; bundled into an ignored directory, never shipped.
import { createRoot } from 'react-dom/client'
import { useSyncExternalStore } from 'react'
import { fileUpload } from '../src/client/rich-text.ts'
import type { DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { TaskCapture } from '../src/client/TaskCapture.tsx'
import { zh } from '../src/client/locales.ts'
import { contentText } from '../src/content.ts'
import type { TaskRecord, TaskAttachmentUpload } from '../src/types.ts'

let tasks: TaskRecord[] = []
const attachments = new Map<string, TaskAttachmentUpload[]>()
let attachmentReads = 0
let failAttachmentReads = false
const snapshot = { items: [{ workspaceId: 'ws-test', title: '测试工作区' }] }
const subscribe = () => () => {}
let sessionSnapshot = { items: [{ id: 'session-current', title: '当前中文会话' }, { id: 'session-other', title: '另一个中文会话' }] }
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
  sync: {
    listSyncConnections: async () => syncConnections, listSyncRules: async () => [],
    listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }),
    createSyncConnection: async (input: any) => { const row = { ...input, id: 'test-connection', revision: 1, instance: 'tapd:2001', credentialPresent: false }; syncConnections = [row]; return row },
  },
}
let input = { draft: '', phase: 'plain', attachmentIds: [] as DraftAttachmentId[], draftRev: 1 }
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
    <TaskCapture {...{ useInput, inputActions, sessionId: 'session-current', create: captureCreate, captureAttachments,
      releaseAttachment: (id: DraftAttachmentId) => draftFiles.delete(id), t } as any} />
  </div>
</>)
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
  addExternal: () => { tasks = [{ id: 'external', title: '独立远端标题', notes: '', content: { version: 1, blocks: [] }, status: 'todo', priority: 'medium', storyPoints: null, tags: [], workspaceId: 'ws-test', sendImmediately: false, sessionId: null, agent: null, useWorktree: false, startedAt: null, completedAt: null, version: 1, createdAt: Date.now(), updatedAt: Date.now(), subtasks: [], source: { platform: 'tapd', projectId: 'p', typeId: 'task', remoteId: '123', number: 'TASK-123', url: 'https://www.tapd.cn/2001/prong/tasks/view/123', lastSuccess: null, error: null } }, ...tasks] },
  captures: () => captureRequests,
  input: () => input,
  failCapture: (fail: boolean) => { failCapture = fail },
  stageFiles: (files: File[]) => {
    const ids = files.map(file => { const id = crypto.randomUUID() as DraftAttachmentId; draftFiles.set(id, file); return id })
    input = { ...input, attachmentIds: [...input.attachmentIds, ...ids] }
    publish()
  },
} })
