import { WORKITEM_FILL_FIELDS_BY_PLATFORM, type SafeWorkitemDescription, type WorkitemFillField } from '../sync/dto.ts'
import type { TaskKey } from './locales.ts'

/**
 * Which work-item data a new task's content starts with. The selection lives on
 * the connection (its editor owns the checkboxes); the body is built as Markdown
 * so the composer's first line still becomes the task title.
 *
 * The catalog is per platform: 云效 exposes custom fields and a source number,
 * TAPD exposes 标签 and 创建人, and the editor must not offer a field the chosen
 * platform cannot carry.
 */
const FIELD_LABELS: Readonly<Record<WorkitemFillField, TaskKey>> = {
  title: 'fillTitle',
  description: 'fillDescription',
  number: 'fillNumber',
  status: 'fillStatus',
  assignee: 'fillAssignee',
  sprint: 'fillSprint',
  priority: 'fillPriority',
  customFields: 'fillCustomFields',
  source: 'fillSource',
  tags: 'fillTags',
  creator: 'fillCreator',
}

export const FILL_FIELDS: readonly { id: WorkitemFillField; label: TaskKey }[] =
  WORKITEM_FILL_FIELDS_BY_PLATFORM.yunxiao.map(id => ({ id, label: FIELD_LABELS[id] }))

/** The same list for one platform, in that platform's own order. */
export function fillFieldsFor(platform: 'yunxiao' | 'tapd'): readonly { id: WorkitemFillField; label: TaskKey }[] {
  return WORKITEM_FILL_FIELDS_BY_PLATFORM[platform].map(id => ({ id, label: FIELD_LABELS[id] }))
}

/** Drop ids the platform cannot carry, keeping the platform's own order. */
export function normalizeFillFields(platform: 'yunxiao' | 'tapd', fields: readonly WorkitemFillField[]): WorkitemFillField[] {
  const allowed = WORKITEM_FILL_FIELDS_BY_PLATFORM[platform]
  return allowed.filter(field => fields.includes(field))
}

export type FillField = WorkitemFillField

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function referenceName(value: unknown): string {
  if (typeof value !== 'object' || value === null) return ''
  const record = value as Record<string, unknown>
  const name = typeof record.displayName === 'string' && record.displayName !== '' ? record.displayName : record.name
  return typeof name === 'string' ? name : ''
}

/** The `{ id, name }` list of a label/tag array, joined for one body line. */
function namesOf(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(entry => referenceName(entry)).filter(name => name !== '').join('、')
}

/** `fieldId -> { name, value }` for every custom field carried by the row. */
function customFieldsOf(value: unknown): Map<string, { name: string; value: string }> {
  const out = new Map<string, { name: string; value: string }>()
  if (!Array.isArray(value)) return out
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const id = text(record.fieldId)
    const name = text(record.fieldName)
    const values = Array.isArray(record.values)
      ? record.values.flatMap(item => (typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).displayValue === 'string'
        ? [(item as { displayValue: string }).displayValue]
        : []))
      : []
    if (id === '' || name === '' || values.length === 0) continue
    out.set(id, { name, value: values.join('、') })
  }
  return out
}

/**
 * Build the prefilled task content: the subject becomes the first line (so the
 * task title derives from it), then the selected metadata, then the body.
 */
export function buildWorkitemBody(
  row: Record<string, unknown>,
  description: SafeWorkitemDescription | null,
  fields: readonly FillField[],
  t: (key: TaskKey) => string,
): string {
  const subject = text(row.subject)
  const serial = text(row.serialNumber)
  const custom = customFieldsOf(row.customFields)
  const blocks: string[] = []
  if (fields.includes('title') && subject !== '') blocks.push(subject)

  const meta: string[] = []
  if (fields.includes('number') && serial !== '') meta.push(`${t('fillNumber')}: ${serial}`)
  if (fields.includes('status')) {
    const status = referenceName(row.status)
    if (status !== '') meta.push(`${t('fillStatus')}: ${status}`)
  }
  if (fields.includes('assignee')) {
    const assignee = referenceName(row.assignedTo)
    if (assignee !== '') meta.push(`${t('fillAssignee')}: ${assignee}`)
  }
  if (fields.includes('sprint')) {
    const sprint = referenceName(row.sprint)
    if (sprint !== '') meta.push(`${t('fillSprint')}: ${sprint}`)
  }
  // Priority is a custom field; when its own box is checked it is labelled
  // "优先級" instead of the platform's own field name.
  if (fields.includes('priority')) {
    const priority = custom.get('priority')
    if (priority !== undefined) meta.push(`${t('fillPriority')}: ${priority.value}`)
  }
  if (fields.includes('customFields')) {
    for (const [id, entry] of custom) {
      if (id === 'priority' && fields.includes('priority')) continue
      meta.push(`${entry.name}: ${entry.value}`)
    }
  }
  if (fields.includes('source') && serial !== '') meta.push(`${t('fillSource')}: ${serial}`)
  // TAPD's own two extra fields; a 云效 row maps 标签 onto its labels.
  if (fields.includes('tags')) {
    const tags = namesOf(row.tags ?? row.labels)
    if (tags !== '') meta.push(`${t('fillTags')}: ${tags}`)
  }
  if (fields.includes('creator')) {
    const creator = referenceName(row.creator)
    if (creator !== '') meta.push(`${t('fillCreator')}: ${creator}`)
  }
  if (meta.length > 0) blocks.push(meta.join('\n'))

  const body = fields.includes('description') ? description?.plain.trim() ?? '' : ''
  if (body !== '') blocks.push(body)
  return blocks.join('\n\n')
}
