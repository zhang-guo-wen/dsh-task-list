import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILL_FIELDS, FILL_FIELDS, buildWorkitemBody, readFillFields, writeFillFields, type FillField,
} from '../src/client/workitem-fill.ts'
import { zh, type TaskKey } from '../src/client/locales.ts'
import type { SafeWorkitemDescription } from '../src/sync/dto.ts'

const t = (key: TaskKey) => zh[key]

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    raw: store,
  }
}

const row: Record<string, unknown> = {
  id: 'w1',
  serialNumber: 'PROJ-11',
  subject: 'Alpha work item',
  status: { id: '100005', name: '待处理', displayName: '待处理' },
  assignedTo: { id: 'user-1', name: 'Alice' },
  sprint: { id: 'sprint-1', name: 'Sprint 42' },
  customFields: [
    { fieldId: 'priority', fieldName: '优先级', fieldFormat: 'list', values: [{ identifier: 'p', displayValue: '中' }] },
    { fieldId: 'progress', fieldName: '进度', fieldFormat: 'float', values: [{ identifier: '0', displayValue: '0' }] },
  ],
}

const description: SafeWorkitemDescription = { format: 'richtext', html: '<p>Body</p>', plain: 'Body' }

describe('fill settings storage', () => {
  it('falls back to the defaults when nothing is saved', () => {
    expect(readFillFields(memoryStorage())).toEqual([...DEFAULT_FILL_FIELDS])
  })

  it('round-trips a selection and drops unknown ids', () => {
    const storage = memoryStorage()
    writeFillFields(['title', 'number', 'customFields'], storage)
    expect(readFillFields(storage)).toEqual(['title', 'number', 'customFields'])
    storage.raw.set('dsh-task-list.workitem-fill', JSON.stringify(['title', 'bogus']))
    expect(readFillFields(storage)).toEqual(['title'])
  })

  it('survives a broken value and an empty selection', () => {
    expect(readFillFields(memoryStorage({ 'dsh-task-list.workitem-fill': '{oops' }))).toEqual([...DEFAULT_FILL_FIELDS])
    expect(readFillFields(memoryStorage({ 'dsh-task-list.workitem-fill': '[]' }))).toEqual([...DEFAULT_FILL_FIELDS])
    expect(readFillFields(null)).toEqual([...DEFAULT_FILL_FIELDS])
  })

  it('offers every documented field', () => {
    const ids = FILL_FIELDS.map(field => field.id)
    expect(ids).toEqual(['title', 'description', 'number', 'status', 'assignee', 'sprint', 'priority', 'customFields', 'source'])
    for (const field of FILL_FIELDS) expect(t(field.label)).toBeTruthy()
  })
})

describe('work item draft body', () => {
  it('leads with the subject so the composer derives the task title', () => {
    const body = buildWorkitemBody(row, description, ['title', 'description', 'number', 'status', 'assignee'], t)
    expect(body.split('\n')[0]).toBe('Alpha work item')
    expect(body).toContain(`${zh.fillNumber}: PROJ-11`)
    expect(body).toContain(`${zh.fillStatus}: 待处理`)
    expect(body).toContain(`${zh.fillAssignee}: Alice`)
    expect(body.endsWith('Body')).toBe(true)
  })

  it('includes only what is checked', () => {
    const body = buildWorkitemBody(row, description, ['title', 'number'], t)
    expect(body).toBe(`Alpha work item\n\n${zh.fillNumber}: PROJ-11`)
    expect(body).not.toContain('Body')
    expect(body).not.toContain(zh.fillStatus)
  })

  it('labels priority with its own name and keeps other custom fields under theirs', () => {
    const body = buildWorkitemBody(row, null, ['title', 'priority', 'customFields'], t)
    expect(body).toContain(`${zh.fillPriority}: 中`)
    // The custom-field sweep must not repeat the priority line.
    expect(body.match(/中/gu)).toHaveLength(1)
    expect(body).toContain('进度: 0')
  })

  it('omits the description when the platform carries none and appends the source line last', () => {
    const body = buildWorkitemBody(row, null, ['title', 'description', 'source'], t)
    expect(body).toBe(`Alpha work item\n\n${zh.fillSource}: PROJ-11`)
  })

  it('produces an empty body when nothing is checked', () => {
    expect(buildWorkitemBody(row, description, [] as readonly FillField[], t)).toBe('')
  })
})
