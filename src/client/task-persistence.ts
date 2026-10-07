import type { TaskContent, TaskRecord, TaskAttachmentUpload } from '../types.ts'
import { contentAttachments } from '../content.ts'

export interface TaskStorageCapabilities { version: 1; richText: true; attachments: true }

/** Do not write with a new browser payload against a stale Host that silently ignores it. */
export async function persistRichTask(
  content: TaskContent | undefined,
  capabilities: () => Promise<TaskStorageCapabilities>,
  write: () => Promise<TaskRecord>,
  readAttachments: (task: TaskRecord) => Promise<TaskAttachmentUpload[]>,
  unavailableMessage: string,
): Promise<TaskRecord> {
  if (!content) return write()
  let support: TaskStorageCapabilities
  try { support = await capabilities() } catch { throw new Error(unavailableMessage) }
  if (support?.version !== 1 || support.richText !== true || support.attachments !== true) throw new Error(unavailableMessage)
  const saved = await write()
  if (JSON.stringify(saved.content) !== JSON.stringify(content)) throw new Error(unavailableMessage)
  const expected = contentAttachments(content)
  if (expected.length) {
    const uploads = await readAttachments(saved)
    if (uploads.length !== expected.length || expected.some(node => !uploads.some(upload => upload.id === node.id))) throw new Error(unavailableMessage)
  }
  return saved
}
