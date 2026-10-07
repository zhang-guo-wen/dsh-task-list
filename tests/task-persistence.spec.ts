import { describe, expect, it, vi } from 'vitest'
import { persistRichTask } from '../src/client/task-persistence.ts'
import type { TaskRecord } from '../src/types.ts'
const node = { type: 'attachment' as const, id: '22222222-2222-4222-8222-222222222222', name: 'image.png', mediaType: 'image/png', bytes: 3 }
const content = { version: 1 as const, blocks: [node] }
const support = async () => ({ version: 1 as const, richText: true as const, attachments: true as const })

describe('rich-task save acknowledgement', () => {
  it('refuses an old Host before writing or clearing any draft', async () => {
    const write = vi.fn()
    await expect(persistRichTask(content, async () => { throw new Error('method not found') }, write, vi.fn(), 'reload Host')).rejects.toThrow('reload Host')
    expect(write).not.toHaveBeenCalled()
  })
  it('detects a Host silently discarding structured content or image bytes', async () => {
    await expect(persistRichTask(content, support, async () => ({ content: { version: 1, blocks: [] } } as TaskRecord), vi.fn(), 'reload Host')).rejects.toThrow('reload Host')
    await expect(persistRichTask(content, support, async () => ({ content } as TaskRecord), async () => [], 'reload Host')).rejects.toThrow('reload Host')
  })
  it('accepts only a saved document with readable attachment bytes', async () => {
    const task = { id: 'saved', version: 1, content } as TaskRecord
    expect(await persistRichTask(content, support, async () => task, async () => [{ id: node.id, data: 'YWJj' }], 'reload Host')).toBe(task)
  })
})
