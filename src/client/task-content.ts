import { contentAttachments, contentMarkdown, contentText, textContent } from '../content.ts'
import type { TaskRecord, TaskContent, TaskAttachmentUpload, UpdateTaskRequest } from '../types.ts'
import { deriveTaskTitle } from './task-title.ts'

export function taskDocument(task: TaskRecord): TaskContent {
  if (task.source) return task.content ?? textContent(task.notes)
  return task.content?.blocks.length ? task.content : textContent(task.notes.trim() || task.title.trim())
}
export function taskDraft(task: TaskRecord): string {
  const document = taskDocument(task)
  const body = contentMarkdown(document).trim()
  if (task.source) return task.title.trim() + (body ? `\n\n${body}` : '')
  return body || (contentAttachments(document).length ? '' : task.title.trim())
}
export function taskEditPayload(task: TaskRecord | null, title: string, content: TaskContent, attachments: TaskAttachmentUpload[]): Pick<UpdateTaskRequest, 'title' | 'content' | 'attachments'> {
  return { title: task?.source ? title.trim() : deriveTaskTitle('', contentText(content)), content, attachments }
}
export function retainTaskSource(original: TaskRecord, saved: TaskRecord): TaskRecord { return original.source ? { ...saved, source: original.source } : saved }
export function safeSourceUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null
    if (!['www.tapd.cn', 'tapd.cn', 'devops.aliyun.com'].includes(url.hostname)) return null
    return url.href
  } catch { return null }
}
