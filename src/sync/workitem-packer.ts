import type { TaskContent, TaskContentBlock, TaskTextBlock } from '../types.ts'

/**
 * Pack one platform work item into the description of the task an import
 * creates. The row's own values become labelled lines above the work item's
 * body, so a task carries its number, status, owner and platform fields without
 * the plugin ever injecting platform HTML.
 *
 * The labels are English on purpose: this text is generated on the Host during a
 * sync run, where the browser locale is not available, and it must read the same
 * whatever language the UI is in.
 */

/** The row values a packer reads; every one is optional, an absent value is skipped. */
export interface WorkitemDisplayFields {
  number: string
  status: string
  assignee: string
  creator: string
  created: string
  updated: string
  type: string
  sprint: string
  priority: string
  labels: string
  custom: readonly { name: string; value: string }[]
}

const LABELS: readonly [keyof Omit<WorkitemDisplayFields, 'number' | 'custom'>, string][] = [
  ['status', 'Status'],
  ['assignee', 'Assignee'],
  ['creator', 'Creator'],
  ['created', 'Created'],
  ['updated', 'Updated'],
  ['type', 'Type'],
  ['sprint', 'Sprint'],
  ['priority', 'Priority'],
  ['labels', 'Labels'],
]

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function referenceName(value: unknown): string {
  if (typeof value !== 'object' || value === null) return ''
  const record = value as Record<string, unknown>
  const name = typeof record.displayName === 'string' && record.displayName !== '' ? record.displayName : record.name
  return typeof name === 'string' ? name : ''
}

function namesOf(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(entry => referenceName(entry)).filter(name => name !== '').join(', ')
}

/** `{ name, value }` for every custom field the row carries, in platform order. */
function customFieldsOf(value: unknown): { name: string; value: string }[] {
  if (!Array.isArray(value)) return []
  const out: { name: string; value: string }[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const name = text(record.fieldName)
    const values = Array.isArray(record.values)
      ? record.values.flatMap(item => (typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).displayValue === 'string'
        ? [(item as { displayValue: string }).displayValue]
        : []))
      : []
    if (name === '' || values.length === 0) continue
    out.push({ name, value: values.join(', ') })
  }
  return out
}

/**
 * Read the display values out of one raw work-item row. Timestamps are epoch
 * milliseconds in the platform payload; an absent or non-numeric one is skipped
 * rather than shown as a wrong date.
 */
export function displayFieldsOf(raw: unknown, format: (timestamp: number) => string): WorkitemDisplayFields {
  const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const stamp = (value: unknown): string => {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null
    return numeric === null ? '' : format(numeric)
  }
  return {
    number: text(row.serialNumber) || (typeof row.serialNumber === 'number' ? String(row.serialNumber) : ''),
    status: referenceName(row.status),
    assignee: referenceName(row.assignedTo),
    creator: referenceName(row.creator),
    created: stamp(row.gmtCreate),
    updated: stamp(row.gmtModified),
    type: referenceName(row.workitemType),
    sprint: referenceName(row.sprint),
    priority: '',
    labels: namesOf(row.labels ?? row.tags),
    custom: customFieldsOf(row.customFieldValues),
  }
}

/** A timestamp as a date-time string; the platform's own values are epoch ms. */
export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function paragraph(text: string): TaskTextBlock {
  return { type: 'paragraph', children: [{ text }] }
}

/**
 * Build the description: the number and subject as the heading-shaped first
 * line (so a task title still reads), then the labelled row values, then the
 * work item's own body as plain text.
 */
export function packWorkitemDescription(raw: unknown, body: string): TaskContent {
  const display = displayFieldsOf(raw, formatTimestamp)
  const blocks: TaskContentBlock[] = []
  const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const subject = text(row.subject)
  const heading = display.number === '' ? subject : subject === '' ? display.number : `${display.number} ${subject}`
  if (heading !== '') blocks.push({ type: 'heading', level: 3, children: [{ text: heading }] })

  const meta: string[] = []
  const priority = display.custom.find(entry => entry.name === '优先级' || entry.name === 'priority')
  const resolved: WorkitemDisplayFields = { ...display, priority: priority?.value ?? '' }
  for (const [field, label] of LABELS) {
    const value = resolved[field]
    if (value !== '') meta.push(`${label}: ${value}`)
  }
  for (const entry of resolved.custom) {
    if (entry === priority) continue
    meta.push(`${entry.name}: ${entry.value}`)
  }
  if (meta.length > 0) blocks.push(paragraph(meta.join('\n')))

  const trimmed = body.trim()
  if (trimmed !== '') blocks.push(paragraph(trimmed))
  return { version: 1, blocks }
}
