import type { SafeWorkitemDescription } from '../sync/dto.ts'
import type { TaskKey } from './locales.ts'

/**
 * Which work-item data a new task's content starts with. The selection is a
 * browser preference (the settings page owns the checkboxes), and the body is
 * built as Markdown so the composer's first line still becomes the task title.
 */
export const FILL_FIELDS: readonly { id: FillField; label: TaskKey }[] = [
  { id: 'title', label: 'fillTitle' },
  { id: 'description', label: 'fillDescription' },
  { id: 'number', label: 'fillNumber' },
  { id: 'status', label: 'fillStatus' },
  { id: 'assignee', label: 'fillAssignee' },
  { id: 'sprint', label: 'fillSprint' },
  { id: 'priority', label: 'fillPriority' },
  { id: 'customFields', label: 'fillCustomFields' },
  { id: 'source', label: 'fillSource' },
]

export type FillField = 'title' | 'description' | 'number' | 'status' | 'assignee' | 'sprint' | 'priority' | 'customFields' | 'source'

export const DEFAULT_FILL_FIELDS: readonly FillField[] = ['title', 'description', 'number', 'status', 'assignee', 'priority']

const STORAGE_KEY = 'dsh-task-list.workitem-fill'
const IDS = new Set<string>(FILL_FIELDS.map(field => field.id))

interface Readable { getItem(key: string): string | null }
interface Writable { setItem(key: string, value: string): void }

/** The saved selection, filtered to known ids; an absent or broken value means the defaults. */
export function readFillFields(storage: Readable | null = safeStorage()): FillField[] {
  if (storage === null) return [...DEFAULT_FILL_FIELDS]
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return [...DEFAULT_FILL_FIELDS]
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_FILL_FIELDS]
    const kept = parsed.filter((id): id is FillField => typeof id === 'string' && IDS.has(id))
    return kept.length > 0 ? kept : [...DEFAULT_FILL_FIELDS]
  } catch {
    return [...DEFAULT_FILL_FIELDS]
  }
}

export function writeFillFields(fields: readonly FillField[], storage: Writable | null = safeStorage()): void {
  if (storage === null) return
  storage.setItem(STORAGE_KEY, JSON.stringify(fields.filter(field => IDS.has(field))))
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function referenceName(value: unknown): string {
  if (typeof value !== 'object' || value === null) return ''
  const record = value as Record<string, unknown>
  const name = typeof record.displayName === 'string' && record.displayName !== '' ? record.displayName : record.name
  return typeof name === 'string' ? name : ''
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
  if (meta.length > 0) blocks.push(meta.join('\n'))

  const body = fields.includes('description') ? description?.plain.trim() ?? '' : ''
  if (body !== '') blocks.push(body)
  return blocks.join('\n\n')
}
