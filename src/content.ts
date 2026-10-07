import type { TaskContent, TaskInline, TaskContentBlock, TaskTextBlock, TaskTableCell } from './types.ts'

export const CONTENT_TEXT_LIMIT = 20_000
export const ATTACHMENT_COUNT_LIMIT = 8
export const ATTACHMENT_BYTE_LIMIT = 10 * 1024 * 1024
export const ATTACHMENT_TOTAL_LIMIT = 20 * 1024 * 1024
const blockTypes = new Set(['paragraph', 'heading', 'bullet', 'ordered', 'quote', 'code'])
const marks = new Set(['bold', 'italic', 'underline', 'code', 'strikethrough'])

export function safeLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020]/u.test(value)) return
  try { const url = new URL(value); if (['https:', 'http:', 'mailto:'].includes(url.protocol)) return value } catch { /* reject relative / executable URLs */ }
}

export function textContent(text: string): TaskContent {
  return { version: 1, blocks: text.split('\n').map(line => ({ type: 'paragraph', children: [{ text: line }] })) }
}

function validateText(block: TaskTextBlock): TaskTextBlock {
  if (!block || !blockTypes.has(block.type) || !Array.isArray(block.children) || block.children.length > 20000) throw new Error('invalid text block')
  const children: TaskInline[] = block.children.map(child => {
    if (!child || typeof child.text !== 'string' || child.text.length > CONTENT_TEXT_LIMIT) throw new Error('invalid content text')
    if (child.marks !== undefined && (!Array.isArray(child.marks) || child.marks.length > 5 || child.marks.some(mark => !marks.has(mark)))) throw new Error('invalid text marks')
    if (child.href !== undefined && !safeLink(child.href)) throw new Error('invalid content link')
    return { text: child.text, ...(child.marks?.length ? { marks: [...new Set(child.marks)] } : {}), ...(child.href ? { href: child.href } : {}) }
  })
  if (block.level !== undefined && (!Number.isInteger(block.level) || block.level < 1 || block.level > 6)) throw new Error('invalid heading level')
  if (block.indent !== undefined && (!Number.isInteger(block.indent) || block.indent < 0 || block.indent > 12)) throw new Error('invalid list indent')
  return { type: block.type, children, ...(block.level ? { level: block.level } : {}), ...(block.indent ? { indent: block.indent } : {}) }
}

/** A bounded, explicit vocabulary; never persist arbitrary HTML, styles or executable URLs. */
export function validateContent(value: unknown): TaskContent {
  const doc = value as TaskContent
  if (!doc || doc.version !== 1 || !Array.isArray(doc.blocks) || doc.blocks.length > 2000) throw new Error('invalid task content')
  let bytes = 0
  let attachments = 0
  let cells = 0
  const ids = new Set<string>()
  const blocks: TaskContentBlock[] = doc.blocks.map(block => {
    if (!block || typeof block !== 'object') throw new Error('invalid content block')
    if (block.type === 'attachment') {
      if (typeof block.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(block.id) || ids.has(block.id)
        || typeof block.name !== 'string' || !block.name.trim() || block.name.length > 255 || /[\u0000-\u001f]/u.test(block.name)
        || typeof block.mediaType !== 'string' || block.mediaType.length > 200 || !/^[\w.+-]+\/[\w.+-]+$/u.test(block.mediaType)
        || !Number.isSafeInteger(block.bytes) || block.bytes < 0 || block.bytes > ATTACHMENT_BYTE_LIMIT) throw new Error('invalid task attachment')
      ids.add(block.id)
      bytes += block.bytes
      attachments++
      return { type: 'attachment', id: block.id, name: block.name, mediaType: block.mediaType, bytes: block.bytes }
    }
    if (block.type === 'table') {
      if (!Array.isArray(block.rows) || block.rows.length > 100) throw new Error('invalid content table')
      return { type: 'table', rows: block.rows.map(row => {
        if (!Array.isArray(row) || row.length > 50 || (cells += row.length) > 500) throw new Error('table cell limit exceeded')
        return row.map((cell): TaskTableCell => {
          if (!cell || !Array.isArray(cell.blocks) || cell.blocks.length > 100) throw new Error('invalid table cell')
          for (const span of [cell.colSpan, cell.rowSpan]) if (span !== undefined && (!Number.isInteger(span) || span < 1 || span > 100)) throw new Error('invalid table span')
          return { blocks: cell.blocks.map(validateText), ...(cell.header ? { header: true } : {}), ...(cell.colSpan ? { colSpan: cell.colSpan } : {}), ...(cell.rowSpan ? { rowSpan: cell.rowSpan } : {}) }
        })
      }) }
    }
    return validateText(block)
  })
  if (attachments > ATTACHMENT_COUNT_LIMIT || bytes > ATTACHMENT_TOTAL_LIMIT) throw new Error('task attachment limit exceeded')
  const result: TaskContent = { version: 1, blocks }
  if (contentText(result).length > CONTENT_TEXT_LIMIT) throw new Error('content must contain at most 20000 characters')
  if (JSON.stringify(result).length > 1_000_000) throw new Error('content structure limit exceeded')
  return result
}

const plainText = (block: TaskTextBlock) => block.children.map(child => child.text).join('')
/** Search/title projection includes filenames, not JSON syntax or attachment bytes. */
export function contentText(content: TaskContent): string {
  return content.blocks.map(block => block.type === 'attachment' ? block.name : block.type === 'table'
    ? block.rows.map(row => row.map(cell => cell.blocks.map(plainText).join('\n')).join('\t')).join('\n') : plainText(block)).join('\n')
}

export function contentAttachments(content: TaskContent) {
  return content.blocks.filter((block): block is Extract<TaskContentBlock, { type: 'attachment' }> => block.type === 'attachment')
}

function markdownText(block: TaskTextBlock): string {
  const text = block.children.map(child => {
    let text = child.text
    for (const mark of child.marks ?? []) {
      if (mark === 'bold') text = `**${text}**`
      else if (mark === 'italic') text = `*${text}*`
      else if (mark === 'code') text = `\`${text}\``
      else if (mark === 'strikethrough') text = `~~${text}~~`
    }
    return child.href ? `[${text}](${child.href})` : text
  }).join('')
  if (block.type === 'heading') return `${'#'.repeat(block.level ?? 2)} ${text}`
  if (block.type === 'bullet') return `${'  '.repeat(block.indent ?? 0)}- ${text}`
  if (block.type === 'ordered') return `${'  '.repeat(block.indent ?? 0)}1. ${text}`
  if (block.type === 'quote') return `> ${text}`
  if (block.type === 'code') return `\`\`\`\n${text}\n\`\`\``
  return text
}

/** Preserve supported formatting in the text-only host composer; files travel separately. */
export function contentMarkdown(content: TaskContent): string {
  return content.blocks.filter(block => block.type !== 'attachment').map(block => {
    if (block.type !== 'table') return markdownText(block)
    const rows = block.rows.map(row => `| ${row.map(cell => cell.blocks.map(markdownText).join('<br>').replace(/\|/gu, '\\|')).join(' | ')} |`)
    if (rows.length) rows.splice(1, 0, `| ${block.rows[0]!.map(() => '---').join(' | ')} |`)
    return rows.join('\n')
  }).join('\n')
}
