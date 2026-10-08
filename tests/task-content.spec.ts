import { describe, expect, it } from 'vitest'
import { textContent } from '../src/content.ts'
import { taskDraft, taskEditPayload, taskDocument, safeSourceUrl, retainTaskSource } from '../src/client/task-content.ts'
import type { TaskRecord } from '../src/types.ts'
const external = { title: 'Remote title', notes: 'Description', content: textContent('Description'), source: { platform: 'tapd', url: null } } as TaskRecord

describe('external task content', () => {
  it('launches the independent title followed by rich description Markdown', () => {
    expect(taskDraft(external)).toBe('Remote title\n\nDescription')
    expect(taskDraft({ ...external, content: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'Bold', marks: ['bold'] }] }] } })).toBe('Remote title\n\n**Bold**')
  })
  it('never copies an external title into an empty description', () => {
    const empty = { ...external, notes: '', content: textContent('') }
    expect(taskDocument(empty)).toEqual(textContent(''))
    expect(taskDraft(empty)).toBe('Remote title')
    expect(taskEditPayload(empty, '  Independent  ', textContent(''), [])).toEqual({ title: 'Independent', content: textContent(''), attachments: [] })
  })
  it('local files-only drafts remain empty and local titles still derive from content', () => {
    const local = { ...external, source: undefined, content: { version: 1, blocks: [{ type: 'attachment', id: 'file', name: 'report.txt', mediaType: 'text/plain', bytes: 4 }] } } as TaskRecord
    expect(taskDraft(local)).toBe('')
    expect(taskEditPayload(null, '', textContent('Local content'), [])).toEqual({ title: 'Local content', content: textContent('Local content'), attachments: [] })
  })
  it('retains the structured document and upload bytes when editing an external title', () => {
    const uploads = [{ id: 'file', data: 'YWJj' }]
    const result = taskEditPayload(external, 'Another title', external.content, uploads)
    expect(result.content).toBe(external.content)
    expect(result.attachments).toBe(uploads)
  })
  it('Save-and-Start retains source when the ordinary CRUD response omits it', () => {
    const saved = { ...external, source: undefined, title: 'Edited title' } as TaskRecord
    expect(taskDraft(retainTaskSource(external, saved))).toBe('Edited title\n\nDescription')
  })
  it('only links official source origins without credentials or executable schemes', () => {
    expect(safeSourceUrl('javascript:alert(1)')).toBeNull()
    expect(safeSourceUrl('https://evil.tapd.cn.example.org/task')).toBeNull()
    expect(safeSourceUrl('https://user:pass@www.tapd.cn/task')).toBeNull()
    expect(safeSourceUrl('https://www.tapd.cn/123/prong/stories/view/1')).toBe('https://www.tapd.cn/123/prong/stories/view/1')
  })
})
