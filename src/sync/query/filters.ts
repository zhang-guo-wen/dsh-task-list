import { syncError, syncRemoteError } from '../errors.ts'
import type { WorkitemConditionGroups } from '../dto.ts'

/** Filter fields verified against the live service; anything else fails closed. */
export type WorkitemFilterField =
  | 'assignedTo' | 'creator' | 'status' | 'statusStage' | 'sprint' | 'workitemType' | 'priority' | 'tag' | 'subject'
  | 'gmtCreate' | 'gmtModified' | 'updateStatusAt'

export type WorkitemFilterOperator = 'EQUALS' | 'CONTAINS' | 'BETWEEN'

/**
 * One platform filter object as the adapter builds it: `groupId` is implicit in
 * the group it sits in — conditions inside one group are ANDed, groups are ORed,
 * and the `value` array is an OR set, all three verified against the live service.
 */
export interface WorkitemCondition {
  field: WorkitemFilterField
  operator?: WorkitemFilterOperator
  value: readonly string[]
  /** Inclusive upper bound for BETWEEN; ignored by other operators. */
  toValue?: string
}

interface FieldSpec {
  className: string
  format: string
  operators: readonly WorkitemFilterOperator[]
}

/**
 * className/format pairs measured with real responses (assignedTo/user+list,
 * status/status+list, sprint/sprint+list, workitemType/workitemType+list,
 * priority/list+list, tag/tag+multiList, subject/string+input, dates/dateTime+input).
 * A wrong pair is silently ignored by the platform, so the adapter never let a
 * caller pick one.
 */
const SPEC: Readonly<Record<WorkitemFilterField, FieldSpec>> = {
  assignedTo: { className: 'user', format: 'list', operators: ['EQUALS', 'CONTAINS'] },
  creator: { className: 'user', format: 'list', operators: ['EQUALS', 'CONTAINS'] },
  status: { className: 'status', format: 'list', operators: ['EQUALS', 'CONTAINS'] },
  // Both statusStage and status layers accept the stage id; the platform answers
  // the same set either way, so the more specific pair is the one recorded.
  statusStage: { className: 'statusStage', format: 'list', operators: ['EQUALS'] },
  sprint: { className: 'sprint', format: 'list', operators: ['CONTAINS'] },
  workitemType: { className: 'workitemType', format: 'list', operators: ['EQUALS', 'CONTAINS'] },
  priority: { className: 'list', format: 'list', operators: ['EQUALS', 'CONTAINS'] },
  tag: { className: 'tag', format: 'multiList', operators: ['CONTAINS'] },
  subject: { className: 'string', format: 'input', operators: ['CONTAINS'] },
  gmtCreate: { className: 'dateTime', format: 'input', operators: ['BETWEEN'] },
  gmtModified: { className: 'dateTime', format: 'input', operators: ['BETWEEN'] },
  updateStatusAt: { className: 'dateTime', format: 'input', operators: ['BETWEEN'] },
}

const MAX_GROUPS = 10
const MAX_CONDITIONS = 20
const MAX_VALUES = 50
const VALUE_LIMIT = 200
const CONTROL = /[\u0000-\u001f]/u
const DATETIME = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/u

function invalid(field: string): never {
  throw syncRemoteError(syncError('InvalidConfig', { scope: 'query', field }))
}

function checkedValue(field: WorkitemFilterField, value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > VALUE_LIMIT || CONTROL.test(value)) invalid(`filters.${field}`)
  return value
}

/**
 * Build the `conditions` JSON string the search endpoint expects, or
 * `undefined` when there is nothing to filter — the endpoint treats an absent
 * `conditions` differently from an empty array, so callers must omit it.
 *
 * This is also the single validator for a stored rule query: it refuses an
 * unknown field, an operator the field does not accept, and a value shape the
 * platform silently ignores, so a malformed rule fails at parse time instead of
 * discovering the whole project.
 */
export function buildConditions(groups: WorkitemConditionGroups | undefined): string | undefined {
  if (groups === undefined || groups.length === 0) return undefined
  if (groups.length > MAX_GROUPS) invalid('conditions')
  const conditionGroups: Record<string, unknown>[][] = []
  for (const group of groups) {
    if (group.length === 0) continue
    if (group.length > MAX_CONDITIONS) invalid('conditions')
    const conditions: Record<string, unknown>[] = []
    for (const condition of group) {
      const spec = SPEC[condition.field as WorkitemFilterField]
      if (spec === undefined) invalid('conditions.field')
      const operator: WorkitemFilterOperator = condition.operator ?? spec.operators[0]!
      if (!spec.operators.includes(operator)) invalid(`conditions.operator(${condition.field})`)
      if (!Array.isArray(condition.value) || condition.value.length === 0 || condition.value.length > MAX_VALUES) invalid(`conditions.value(${condition.field})`)
      const value = condition.value.map(item => checkedValue(condition.field as WorkitemFilterField, item))
      const entry: Record<string, unknown> = {
        fieldIdentifier: condition.field,
        operator,
        value,
        toValue: null,
        className: spec.className,
        format: spec.format,
      }
      if (operator === 'BETWEEN') {
        if (condition.value.length !== 1 || !DATETIME.test(value[0]!)) invalid(`conditions.value(${condition.field})`)
        const to = condition.toValue
        if (typeof to !== 'string' || !DATETIME.test(to)) invalid(`conditions.toValue(${condition.field})`)
        entry.toValue = to
      }
      conditions.push(entry)
    }
    if (conditions.length > 0) conditionGroups.push(conditions)
  }
  if (conditionGroups.length === 0) return undefined
  return JSON.stringify({ conditionGroups })
}

/**
 * The fields a rule query may use, with the operators each one accepts and the
 * value source its editor should offer. The rule editor renders exactly this
 * list, so a query can never name a field the platform silently ignores.
 */
export interface ConditionFieldSpec {
  field: WorkitemFilterField
  operators: readonly WorkitemFilterOperator[]
  /** Where the editor's candidate values come from, or `date` for a range. */
  source: 'status' | 'stage' | 'user' | 'priority' | 'sprint' | 'type' | 'date' | 'text'
}

export const CONDITION_FIELDS: readonly ConditionFieldSpec[] = (Object.keys(SPEC) as WorkitemFilterField[])
  .map(field => ({ field, operators: SPEC[field].operators, source: sourceOf(field) }))

function sourceOf(field: WorkitemFilterField): ConditionFieldSpec['source'] {
  switch (field) {
    case 'status': return 'status'
    case 'statusStage': return 'stage'
    case 'assignedTo': case 'creator': return 'user'
    case 'priority': return 'priority'
    case 'sprint': return 'sprint'
    case 'workitemType': return 'type'
    case 'gmtCreate': case 'gmtModified': case 'updateStatusAt': return 'date'
    default: return 'text'
  }
}

export const FILTER_FIELDS: readonly WorkitemFilterField[] = Object.keys(SPEC) as WorkitemFilterField[]
