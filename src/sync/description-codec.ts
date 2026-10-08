import { parseFragment } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'
import { safeLink, textContent, validateContent } from '../content.ts'
import type {
  TaskContent, TaskContentBlock, TaskInline, TaskMark, TaskTableCell, TaskTextBlock,
} from '../types.ts'
import type { FieldValue } from './types.ts'
import { syncError, syncRemoteError } from './errors.ts'

// --- canonicalization (marks are unordered; adjacent equivalent inlines merge) ---

const MARK_ORDER: TaskMark[] = ['bold', 'italic', 'underline', 'code', 'strikethrough']

function canonicalMarks(marks: TaskMark[] | undefined): TaskMark[] | undefined {
  if (!marks || marks.length === 0) return undefined
  const sorted = [...new Set(marks)].sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b))
  return sorted.length > 0 ? sorted : undefined
}

function canonicalInline(inline: TaskInline): TaskInline {
  const marks = canonicalMarks(inline.marks)
  const out: TaskInline = { text: inline.text }
  if (marks) out.marks = marks
  if (inline.href) out.href = inline.href
  return out
}

function inlineSignature(inline: TaskInline): string {
  return JSON.stringify([inline.marks ?? null, inline.href ?? null])
}

function canonicalChildren(children: TaskInline[]): TaskInline[] {
  const out: TaskInline[] = []
  for (const child of children) {
    const canon = canonicalInline(child)
    const prev = out[out.length - 1]
    if (prev && inlineSignature(prev) === inlineSignature(canon)) {
      prev.text += canon.text
    } else {
      out.push(canon)
    }
  }
  return out
}

function canonicalizeTextBlock(block: TaskTextBlock): TaskTextBlock {
  const out: TaskTextBlock = { type: block.type, children: canonicalChildren(block.children) }
  if (block.level) out.level = block.level
  if (block.indent) out.indent = block.indent
  return out
}

function canonicalizeCell(cell: TaskTableCell): TaskTableCell {
  const out: TaskTableCell = { blocks: cell.blocks.map(canonicalizeTextBlock) }
  if (cell.header) out.header = true
  if (cell.colSpan) out.colSpan = cell.colSpan
  if (cell.rowSpan) out.rowSpan = cell.rowSpan
  return out
}

function canonicalizeBlock(block: TaskContentBlock): TaskContentBlock {
  if (block.type === 'attachment') return { ...block }
  if (block.type === 'table') return { type: 'table', rows: block.rows.map(row => row.map(canonicalizeCell)) }
  return canonicalizeTextBlock(block)
}

/** Canonical form of a content document; never mutates the input. */
export function canonicalContent(content: TaskContent): TaskContent {
  return { version: 1, blocks: content.blocks.map(canonicalizeBlock) }
}

/** Remove attachment nodes (local-only) from a content document. */
export function stripAttachments(content: TaskContent): TaskContent {
  return { version: 1, blocks: content.blocks.filter(block => block.type !== 'attachment') }
}

/** Canonical, attachment-free description snapshot used for comparison. */
export function canonicalDescription(content: TaskContent): TaskContent {
  return canonicalContent(stripAttachments(content))
}

// --- HTML decode (inert parse5 tree, no script execution, no network) ---

type P5Node = DefaultTreeAdapterTypes.Node
type P5Element = DefaultTreeAdapterTypes.Element
type P5TextNode = DefaultTreeAdapterTypes.TextNode
type P5ChildNode = DefaultTreeAdapterTypes.ChildNode

interface Ctx { roundTrip: boolean }
interface InlineStyle { marks: TaskMark[]; href: string | null }

const MARK_BY_TAG: Record<string, TaskMark> = {
  strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline',
  code: 'code', s: 'strikethrough', strike: 'strikethrough', del: 'strikethrough',
}

/** Elements whose content must never enter the decoded draft. */
const SKIP_TAGS = new Set([
  'script', 'style', 'img', 'iframe', 'object', 'embed', 'video', 'audio', 'canvas',
  'svg', 'math', 'template', 'input', 'button', 'select', 'textarea', 'form',
  'link', 'meta', 'base', 'source', 'track', 'noscript',
])

function isElement(node: P5Node): node is P5Element {
  return 'tagName' in node
}

function isText(node: P5Node): node is P5TextNode {
  return node.nodeName === '#text'
}

function unsupported(): never {
  throw syncRemoteError(syncError('UnsupportedRepresentation', { scope: 'item', field: 'description' }))
}

function checkAttrs(node: P5Element, ctx: Ctx): void {
  for (const attr of node.attrs) {
    const name = attr.name.toLowerCase()
    if (name === 'style' || name.startsWith('on')) ctx.roundTrip = false
  }
}

function hrefOf(node: P5Element, ctx: Ctx): string | null {
  const href = node.attrs.find(attr => attr.name.toLowerCase() === 'href')?.value
  if (!href) return null
  const safe = safeLink(href)
  if (safe === undefined) { ctx.roundTrip = false; return null }
  return safe
}

function walkInlines(node: P5Node, style: InlineStyle, out: TaskInline[], ctx: Ctx): void {
  if (isText(node)) {
    out.push({
      text: node.value,
      ...(style.marks.length ? { marks: [...style.marks] } : {}),
      ...(style.href !== null ? { href: style.href } : {}),
    })
    return
  }
  if (!isElement(node)) return
  checkAttrs(node, ctx)
  const tag = node.tagName
  if (tag === 'br') { out.push({ text: '\n' }); return }
  const mark = MARK_BY_TAG[tag]
  if (mark !== undefined) {
    const next: InlineStyle = { marks: [...style.marks, mark], href: style.href }
    for (const child of node.childNodes) walkInlines(child, next, out, ctx)
    return
  }
  if (tag === 'a') {
    const href = hrefOf(node, ctx)
    const next: InlineStyle = { marks: [...style.marks], href: href ?? style.href }
    for (const child of node.childNodes) walkInlines(child, next, out, ctx)
    return
  }
  if (tag !== 'span') ctx.roundTrip = false
  for (const child of node.childNodes) walkInlines(child, style, out, ctx)
}

function collectInlines(element: P5Element, ctx: Ctx): TaskInline[] {
  const out: TaskInline[] = []
  for (const child of element.childNodes) walkInlines(child, { marks: [], href: null }, out, ctx)
  return out
}

/**
 * Collect the text of a `<pre>` block while skipping blocked elements (script/
 * style/images/…). A `<code>` wrapper and plain text are the lossless subset;
 * any other nested markup marks the representation as not lossless.
 */
function collectPreText(element: P5Element, ctx: Ctx): string {
  let text = ''
  const walk = (node: P5Node, insideCode: boolean): void => {
    if (isText(node)) {
      // The encoder emits `<pre><code>…</code></pre>`; bare text directly under
      // `<pre>` would gain a `<code>` wrapper on re-encode, so it is not lossless.
      if (!insideCode) ctx.roundTrip = false
      text += node.value
      return
    }
    if (!isElement(node)) return
    const tag = node.tagName
    if (SKIP_TAGS.has(tag)) { ctx.roundTrip = false; return }
    checkAttrs(node, ctx)
    if (tag === 'code') {
      if (insideCode) { ctx.roundTrip = false; return }
      for (const child of node.childNodes) walk(child, true)
      return
    }
    ctx.roundTrip = false
    for (const child of node.childNodes) walk(child, false)
  }
  for (const child of element.childNodes) walk(child, false)
  return text
}

function collectListInlines(li: P5Element, ctx: Ctx): TaskInline[] {
  const out: TaskInline[] = []
  for (const child of li.childNodes) {
    if (isElement(child) && (child.tagName === 'ul' || child.tagName === 'ol')) continue
    walkInlines(child, { marks: [], href: null }, out, ctx)
  }
  return out
}

function collectList(node: P5Element, blocks: TaskContentBlock[], ctx: Ctx, type: 'bullet' | 'ordered', indent: number): void {
  checkAttrs(node, ctx)
  for (const child of node.childNodes) {
    if (!isElement(child) || child.tagName !== 'li') continue
    checkAttrs(child, ctx)
    blocks.push({ type, indent, children: collectListInlines(child, ctx) })
    for (const liChild of child.childNodes) {
      if (isElement(liChild) && (liChild.tagName === 'ul' || liChild.tagName === 'ol')) {
        collectList(liChild, blocks, ctx, liChild.tagName === 'ol' ? 'ordered' : 'bullet', indent + 1)
      }
    }
  }
}

function attrInt(el: P5Element, name: string): number | undefined {
  const raw = el.attrs.find(attr => attr.name.toLowerCase() === name)?.value
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 100) return undefined
  return n
}

function collectRow(tr: P5Element, ctx: Ctx): TaskTableCell[] {
  const row: TaskTableCell[] = []
  for (const cellEl of tr.childNodes) {
    if (!isElement(cellEl) || (cellEl.tagName !== 'td' && cellEl.tagName !== 'th')) continue
    checkAttrs(cellEl, ctx)
    const cell: TaskTableCell = { blocks: [{ type: 'paragraph', children: collectInlines(cellEl, ctx) }] }
    if (cellEl.tagName === 'th') cell.header = true
    const colSpan = attrInt(cellEl, 'colspan')
    const rowSpan = attrInt(cellEl, 'rowspan')
    if (colSpan) cell.colSpan = colSpan
    if (rowSpan) cell.rowSpan = rowSpan
    row.push(cell)
  }
  return row
}

function collectTable(node: P5Element, ctx: Ctx): TaskContentBlock {
  checkAttrs(node, ctx)
  const rows: TaskTableCell[][] = []
  const collectRows = (container: P5Element): void => {
    for (const child of container.childNodes) {
      if (!isElement(child)) continue
      if (child.tagName === 'tr') {
        checkAttrs(child, ctx)
        rows.push(collectRow(child, ctx))
      } else if (child.tagName === 'tbody' || child.tagName === 'thead' || child.tagName === 'tfoot') {
        checkAttrs(child, ctx)
        collectRows(child)
      }
    }
  }
  collectRows(node)
  return { type: 'table', rows }
}

function appendTopLevel(node: P5ChildNode, blocks: TaskContentBlock[], ctx: Ctx): void {
  if (isText(node)) {
    if (node.value.trim() === '') return
    blocks.push({ type: 'paragraph', children: [{ text: node.value }] })
    return
  }
  if (!isElement(node)) return
  checkAttrs(node, ctx)
  const tag = node.tagName
  switch (tag) {
    case 'p': case 'div': case 'section': case 'article': case 'main': case 'header': case 'footer':
      blocks.push({ type: 'paragraph', children: collectInlines(node, ctx) })
      return
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      blocks.push({ type: 'heading', level: Number(tag.charAt(1)), children: collectInlines(node, ctx) })
      return
    case 'ul': case 'ol':
      collectList(node, blocks, ctx, tag === 'ol' ? 'ordered' : 'bullet', 0)
      return
    case 'blockquote':
      blocks.push({ type: 'quote', children: collectInlines(node, ctx) })
      return
    case 'pre':
      blocks.push({ type: 'code', children: [{ text: collectPreText(node, ctx) }] })
      return
    case 'table':
      blocks.push(collectTable(node, ctx))
      return
    case 'br':
      blocks.push({ type: 'paragraph', children: [] })
      return
    default:
      if (SKIP_TAGS.has(tag)) { ctx.roundTrip = false; return }
      ctx.roundTrip = false
      blocks.push({ type: 'paragraph', children: collectInlines(node, ctx) })
      return
  }
}

// --- encode (host-side serializer; separate from the browser contentHtml) ---

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

function encodeInlines(children: TaskInline[]): string {
  return children.map(inline => {
    let inner = escapeHtml(inline.text)
    for (const mark of inline.marks ?? []) {
      if (mark === 'bold') inner = `<strong>${inner}</strong>`
      else if (mark === 'italic') inner = `<em>${inner}</em>`
      else if (mark === 'underline') inner = `<u>${inner}</u>`
      else if (mark === 'code') inner = `<code>${inner}</code>`
      else if (mark === 'strikethrough') inner = `<s>${inner}</s>`
    }
    if (inline.href) inner = `<a href="${escapeAttr(inline.href)}">${inner}</a>`
    return inner
  }).join('')
}

function encodeTable(block: Extract<TaskContentBlock, { type: 'table' }>): string {
  const rows = block.rows.map(row => {
    const cells = row.map(cell => {
      const tag = cell.header ? 'th' : 'td'
      const spans = `${cell.colSpan ? ` colspan="${cell.colSpan}"` : ''}${cell.rowSpan ? ` rowspan="${cell.rowSpan}"` : ''}`
      return `<${tag}${spans}>${cell.blocks.map(encodeTextBlock).join('')}</${tag}>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<table>${rows}</table>`
}

function encodeTextBlock(block: TaskTextBlock): string {
  switch (block.type) {
    case 'paragraph': return `<p>${encodeInlines(block.children)}</p>`
    case 'heading': return `<h${block.level ?? 2}>${encodeInlines(block.children)}</h${block.level ?? 2}>`
    case 'quote': return `<blockquote>${encodeInlines(block.children)}</blockquote>`
    case 'code': return `<pre><code>${escapeHtml(block.children.map(c => c.text).join(''))}</code></pre>`
    case 'bullet': return `<ul><li>${encodeInlines(block.children)}</li></ul>`
    case 'ordered': return `<ol><li>${encodeInlines(block.children)}</li></ol>`
  }
}

interface ListRun { type: 'bullet' | 'ordered'; indent: number; children: TaskInline[] }

function encodeList(runs: ListRun[]): string {
  if (runs.length > 0) {
    if (runs[0]!.indent !== 0) unsupported()
    let prev = runs[0]!.indent
    for (let i = 1; i < runs.length; i += 1) {
      const indent = runs[i]!.indent
      if (indent > prev + 1) unsupported()
      prev = indent
    }
  }
  let index = 0
  function process(level: number): string {
    let html = ''
    let currentTag: 'ul' | 'ol' | null = null
    let opened = false
    while (index < runs.length) {
      const run = runs[index]!
      const indent = run.indent
      if (indent < level) break
      if (indent !== level) { html += process(indent); continue }
      const tag = run.type === 'bullet' ? 'ul' : 'ol'
      if (!opened) { html += `<${tag}>`; currentTag = tag; opened = true }
      else if (tag !== currentTag) { html += `</${currentTag}><${tag}>`; currentTag = tag }
      html += `<li>${encodeInlines(run.children)}`
      index += 1
      if (index < runs.length && runs[index]!.indent > indent) html += process(runs[index]!.indent)
      html += '</li>'
    }
    if (opened) html += `</${currentTag}>`
    return html
  }
  return process(0)
}

function encodeHtml(content: TaskContent): string {
  const html: string[] = []
  let i = 0
  while (i < content.blocks.length) {
    const block = content.blocks[i]!
    if (block.type === 'attachment') unsupported()
    if (block.type === 'bullet' || block.type === 'ordered') {
      const runs: ListRun[] = []
      while (i < content.blocks.length && (content.blocks[i]!.type === 'bullet' || content.blocks[i]!.type === 'ordered')) {
        const listBlock = content.blocks[i]! as TaskTextBlock & { type: 'bullet' | 'ordered' }
        runs.push({ type: listBlock.type, indent: listBlock.indent ?? 0, children: listBlock.children })
        i += 1
      }
      html.push(encodeList(runs))
    } else if (block.type === 'table') {
      html.push(encodeTable(block)); i += 1
    } else {
      html.push(encodeTextBlock(block)); i += 1
    }
  }
  return html.join('')
}

function encodeText(content: TaskContent): string {
  const lines: string[] = []
  for (const block of content.blocks) {
    if (block.type === 'attachment') unsupported()
    if (block.type !== 'paragraph') unsupported()
    for (const inline of block.children) {
      if (inline.marks?.length || inline.href) unsupported()
    }
    lines.push(block.children.map(c => c.text).join(''))
  }
  return lines.join('\n')
}

/**
 * Whether `source` is exactly one fenced code block that can be stored and
 * re-emitted verbatim. The info string, fence length, line endings and body are
 * all part of the stored raw source, so the only shapes we cannot delimit
 * unambiguously (a body containing backticks, a closing fence shorter than the
 * opening one, or trailing text after the fence) are rejected as not lossless.
 */
function singleFencedCode(source: string): boolean {
  const match = /^(`{3,})([^\r\n`]*)\r?\n([\s\S]*?)\r?\n(`{3,})([ \t]*)$/u.exec(source)
  if (!match) return false
  if (match[4]!.length < match[1]!.length) return false
  return !match[3]!.includes('`')
}

function encodeMarkdown(content: TaskContent): string {
  // The decoder only round-trips exactly one fenced code block; a multi-block
  // document would emit markdown the decoder treats as not lossless.
  if (content.blocks.length !== 1) unsupported()
  const block = content.blocks[0]!
  if (block.type === 'attachment') unsupported()
  if (block.type !== 'code') unsupported()
  const text = block.children.map(c => c.text).join('')
  if (!singleFencedCode(text)) unsupported()
  return text
}

// --- public API ---

export type DescriptionFormat = 'text' | 'markdown' | 'richtext'

/** Decode an untrusted remote description into the supported vocabulary without executing scripts. */
export function decodeDescription(raw: FieldValue<string>, format: DescriptionFormat): { content: TaskContent; roundTrip: boolean } {
  switch (raw.presence) {
    case 'absent':
    case 'unsupported':
      unsupported()
      break
    case 'null':
      return { content: { version: 1, blocks: [] }, roundTrip: true }
    case 'value':
      break
  }
  const source = raw.value
  if (source === '') return { content: { version: 1, blocks: [] }, roundTrip: true }
  switch (format) {
    case 'text': return { content: canonicalContent(textContent(source)), roundTrip: true }
    case 'markdown': {
      if (singleFencedCode(source)) {
        return { content: { version: 1, blocks: [{ type: 'code', children: [{ text: source }] }] }, roundTrip: true }
      }
      return { content: canonicalContent(textContent(source)), roundTrip: false }
    }
    case 'richtext': {
      const ctx: Ctx = { roundTrip: true }
      const fragment = parseFragment(source)
      const blocks: TaskContentBlock[] = []
      for (const child of fragment.childNodes) appendTopLevel(child, blocks, ctx)
      return { content: canonicalContent({ version: 1, blocks }), roundTrip: ctx.roundTrip }
    }
    default: unsupported()
  }
}

/** Encode a local description to the remote format, refusing anything not provably lossless. */
export function encodeDescription(content: TaskContent, rawFormat: DescriptionFormat): string {
  switch (rawFormat) {
    case 'text': return encodeText(content)
    case 'markdown': return encodeMarkdown(content)
    case 'richtext': return encodeHtml(content)
    default: unsupported()
  }
}

/** Reattach the current task's local attachments after a pulled description, validating the whole document. */
export function mergeLocalAttachments(remoteDescription: TaskContent, current: TaskContent): TaskContent {
  const attachments = current.blocks.filter(block => block.type === 'attachment')
  return validateContent({ version: 1, blocks: [...remoteDescription.blocks, ...attachments] })
}
