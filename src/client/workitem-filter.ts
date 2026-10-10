import type { WorkitemConditionGroups, WorkitemFilterCondition } from '../sync/dto.ts'
import type { TaskKey } from './locales.ts'

/** The filter ids the bar can offer; each one also exists in the host allowlist. */
export type FilterFieldId =
  | 'status' | 'statusStage' | 'assignedTo' | 'creator' | 'priority' | 'sprint' | 'workitemType' | 'gmtCreate'

/**
 * Filter fields the bar may offer. Every entry's className/format/operator triple
 * was measured against the live service; a wrong triple is silently ignored by
 * the platform, which is why the caller never gets to assemble one.
 *
 * `participants` is deliberately absent: `participants CONTAINS` answers 200
 * with zero results for an id that does occur, so a "no results" answer there
 * cannot be trusted.
 */
export const FILTER_FIELDS: readonly {
  id: FilterFieldId
  label: TaskKey
  /** Where the candidate values come from. */
  source: 'status' | 'stage' | 'user' | 'priority' | 'sprint' | 'type' | 'date'
  operator: 'EQUALS' | 'CONTAINS' | 'BETWEEN'
  className: string
  format: string
}[] = [
  { id: 'status', label: 'filterStatus', source: 'status', operator: 'EQUALS', className: 'status', format: 'list' },
  { id: 'statusStage', label: 'filterStatusStage', source: 'stage', operator: 'EQUALS', className: 'statusStage', format: 'list' },
  { id: 'assignedTo', label: 'filterAssignee', source: 'user', operator: 'EQUALS', className: 'user', format: 'list' },
  { id: 'creator', label: 'filterCreator', source: 'user', operator: 'EQUALS', className: 'user', format: 'list' },
  { id: 'priority', label: 'filterPriority', source: 'priority', operator: 'EQUALS', className: 'list', format: 'list' },
  { id: 'sprint', label: 'filterSprint', source: 'sprint', operator: 'CONTAINS', className: 'sprint', format: 'list' },
  { id: 'workitemType', label: 'filterType', source: 'type', operator: 'EQUALS', className: 'workitemType', format: 'list' },
  { id: 'gmtCreate', label: 'filterCreated', source: 'date', operator: 'BETWEEN', className: 'dateTime', format: 'input' },
]

/** The user's own limit: one title search plus at most this many conditions. */
export const MAX_CONDITIONS = 2

const BY_ID = new Map(FILTER_FIELDS.map(field => [field.id, field]))

export interface DraftCondition {
  field: FilterFieldId
  value: string
  /** Inclusive upper bound, only for the date window. */
  toValue: string
}

/**
 * One condition group: the title search and every condition are ANDed, which is
 * exactly one `conditionGroups` entry. Returns undefined when nothing is set, so
 * the request omits `conditions` entirely.
 */
export function buildFilterConditions(title: string, conditions: readonly DraftCondition[]): WorkitemConditionGroups | undefined {
  const group: WorkitemFilterCondition[] = []
  const trimmed = title.trim()
  if (trimmed !== '') {
    group.push({ field: 'subject', operator: 'CONTAINS', value: [trimmed] })
  }
  for (const condition of conditions) {
    const spec = BY_ID.get(condition.field)
    const value = condition.value.trim()
    if (spec === undefined || value === '') continue
    if (spec.operator === 'BETWEEN') {
      const to = condition.toValue.trim()
      // A half-open window is not a filter the platform can express safely.
      if (to === '') continue
      group.push({ field: condition.field, operator: 'BETWEEN', value: [value], toValue: to })
      continue
    }
    group.push({ field: condition.field, operator: spec.operator, value: [value] })
  }
  return group.length === 0 ? undefined : [group]
}

export const FILTER_FIELD_IDS: readonly FilterFieldId[] = FILTER_FIELDS.map(field => field.id)
