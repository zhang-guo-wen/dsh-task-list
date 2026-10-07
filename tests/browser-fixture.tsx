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
const snapshot = { items: [{ workspaceId: 'ws-test', title: '测试工作区' }] }
const subscribe = () => () => {}
const face = {
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
  readAttachments: async (request: any) => attachments.get(request.id) ?? [],
  listAgents: async () => [], workspaceSnapshot: () => snapshot, subscribeWorkspaces: subscribe,
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
  <TaskCapture {...{ useInput, inputActions, create: captureCreate, captureAttachments,
    releaseAttachment: (id: DraftAttachmentId) => draftFiles.delete(id), t } as any} />
</>)
Object.assign(window, { fixture: {
  tasks: () => tasks,
  captures: () => captureRequests,
  input: () => input,
  failCapture: (fail: boolean) => { failCapture = fail },
  stageFiles: (files: File[]) => {
    const ids = files.map(file => { const id = crypto.randomUUID() as DraftAttachmentId; draftFiles.set(id, file); return id })
    input = { ...input, attachmentIds: [...input.attachmentIds, ...ids] }
    publish()
  },
} })
