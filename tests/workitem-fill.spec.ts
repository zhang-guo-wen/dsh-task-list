import { describe, expect, it } from 'vitest'
import { FILL_FIELDS, buildWorkitemBody, fillFieldsFor, normalizeFillFields, type FillField } from '../src/client/workitem-fill.ts'
import { DEFAULT_WORKITEM_FILL_FIELDS, WORKITEM_FILL_FIELDS, WORKITEM_FILL_FIELDS_BY_PLATFORM } from '../src/sync/dto.ts'
import { zh, type TaskKey } from '../src/client/locales.ts'
import type { SafeWorkitemDescription } from '../src/sync/dto.ts'

const t = (key: TaskKey) => zh[key]

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

const description: SafeWorkitemDescription = { format: 'richtext', html: '<p>Body</p>', plain: 'Body', content: null }

describe('fill field catalog', () => {
  it('offers each platform its own fields, every one labelled', () => {
    // 云效 keeps the union's default list; TAPD swaps 自定义字段/来源 for 标签/创建人.
    expect(FILL_FIELDS.map(field => field.id)).toEqual([...WORKITEM_FILL_FIELDS_BY_PLATFORM.yunxiao])
    expect(fillFieldsFor('tapd').map(field => field.id)).toEqual(['title', 'description', 'number', 'status', 'assignee', 'sprint', 'priority', 'tags', 'creator'])
    expect(fillFieldsFor('yunxiao').map(field => field.id)).not.toContain('tags')
    expect(fillFieldsFor('tapd').map(field => field.id)).not.toContain('customFields')
    for (const platform of ['yunxiao', 'tapd'] as const) {
      for (const field of fillFieldsFor(platform)) expect(t(field.label)).toBeTruthy()
      for (const field of WORKITEM_FILL_FIELDS_BY_PLATFORM[platform]) expect(WORKITEM_FILL_FIELDS).toContain(field)
    }
    for (const field of DEFAULT_WORKITEM_FILL_FIELDS) {
      expect(WORKITEM_FILL_FIELDS_BY_PLATFORM.yunxiao).toContain(field)
      expect(WORKITEM_FILL_FIELDS_BY_PLATFORM.tapd).toContain(field)
    }
  })

  it('normalizes a selection to the platform that will use it', () => {
    // Switching 云效 → TAPD drops the 云效-only ids and keeps the platform's order.
    expect(normalizeFillFields('tapd', ['customFields', 'source', 'title', 'priority'])).toEqual(['title', 'priority'])
    expect(normalizeFillFields('yunxiao', ['tags', 'creator', 'title'])).toEqual(['title'])
    // A selection with nothing usable left is reported as empty, so the caller
    // can fall back to the platform's defaults.
    expect(normalizeFillFields('tapd', ['customFields', 'source'])).toEqual([])
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

  it('renders the TAPD-only fields when they are selected', () => {
    const tapdRow = {
      ...row,
      labels: [{ id: 'l1', name: '紧急' }, { id: 'l2', name: '移动端' }],
      creator: { id: 'user-9', name: 'Bob' },
    }
    const body = buildWorkitemBody(tapdRow, null, ['title', 'tags', 'creator'], t)
    expect(body).toBe(`Alpha work item\n\n${zh.fillTags}: 紧急、移动端\n${zh.fillCreator}: Bob`)
  })

  it('omits the description when the platform carries none and appends the source line last', () => {
    const body = buildWorkitemBody(row, null, ['title', 'description', 'source'], t)
    expect(body).toBe(`Alpha work item\n\n${zh.fillSource}: PROJ-11`)
  })

  it('produces an empty body when nothing is checked', () => {
    expect(buildWorkitemBody(row, description, [] as readonly FillField[], t)).toBe('')
  })
})
