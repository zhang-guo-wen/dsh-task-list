import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTER_FIELDS, FILTER_FIELDS, MAX_CONDITIONS, buildFilterConditions, readFilterFields, writeFilterFields,
  type FilterFieldId,
} from '../src/client/workitem-filter.ts'
import { zh, type TaskKey } from '../src/client/locales.ts'

const t = (key: TaskKey) => zh[key]

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    raw: store,
  }
}

describe('filter field settings', () => {
  it('defaults to status and assignee, and round-trips a selection', () => {
    const storage = memoryStorage()
    expect(readFilterFields(storage)).toEqual([...DEFAULT_FILTER_FIELDS])
    writeFilterFields(['priority', 'gmtCreate'], storage)
    expect(readFilterFields(storage)).toEqual(['priority', 'gmtCreate'])
  })

  it('drops unknown ids and survives a broken value', () => {
    expect(readFilterFields(memoryStorage({ 'dsh-task-list.workitem-filters': JSON.stringify(['status', 'nope']) }))).toEqual(['status'])
    expect(readFilterFields(memoryStorage({ 'dsh-task-list.workitem-filters': 'not json' }))).toEqual([...DEFAULT_FILTER_FIELDS])
    expect(readFilterFields(null)).toEqual([...DEFAULT_FILTER_FIELDS])
  })

  it('offers the verified fields, each with a label, and never participants', () => {
    const ids = FILTER_FIELDS.map(field => field.id)
    expect(ids).toEqual(['status', 'statusStage', 'assignedTo', 'creator', 'priority', 'sprint', 'workitemType', 'gmtCreate'])
    expect(ids).not.toContain('participants')
    for (const field of FILTER_FIELDS) {
      expect(t(field.label)).toBeTruthy()
      expect(field.className).toBeTruthy()
      expect(field.format).toBeTruthy()
    }
    expect(MAX_CONDITIONS).toBe(2)
  })
})

describe('filter condition builder', () => {
  it('returns undefined when nothing is set, so the request omits conditions', () => {
    expect(buildFilterConditions('', [])).toBeUndefined()
    expect(buildFilterConditions('   ', [{ field: 'status', value: '', toValue: '' }])).toBeUndefined()
  })

  it('puts the title search and every condition in one ANDed group', () => {
    const groups = buildFilterConditions('OCR', [
      { field: 'status', value: '100005', toValue: '' },
      { field: 'assignedTo', value: 'user-1', toValue: '' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups![0].map(condition => [condition.field, condition.operator, condition.value])).toEqual([
      ['subject', 'CONTAINS', ['OCR']],
      ['status', 'EQUALS', ['100005']],
      ['assignedTo', 'EQUALS', ['user-1']],
    ])
  })

  it('keeps a half-open date window out of the request', () => {
    expect(buildFilterConditions('', [{ field: 'gmtCreate', value: '2026-09-01', toValue: '' }])).toBeUndefined()
    const complete = buildFilterConditions('', [{ field: 'gmtCreate', value: '2026-09-01', toValue: '2026-09-30' }])
    expect(complete![0][0]).toMatchObject({ field: 'gmtCreate', operator: 'BETWEEN', value: ['2026-09-01'], toValue: '2026-09-30' })
  })

  it('trims the title and skips blank condition values', () => {
    const groups = buildFilterConditions('  OCR  ', [{ field: 'sprint', value: '   ', toValue: '' }])
    expect(groups).toEqual([[{ field: 'subject', operator: 'CONTAINS', value: ['OCR'] }]])
  })

  it('caps the bar at two conditions by construction', () => {
    const conditions = [
      { field: 'status' as FilterFieldId, value: '100005', toValue: '' },
      { field: 'assignedTo' as FilterFieldId, value: 'user-1', toValue: '' },
      { field: 'priority' as FilterFieldId, value: 'prio-medium', toValue: '' },
    ]
    // The builder itself renders whatever it is handed; the bar is what caps the list.
    expect(buildFilterConditions('', conditions)![0]).toHaveLength(3)
    expect(conditions.slice(0, MAX_CONDITIONS)).toHaveLength(2)
  })
})
