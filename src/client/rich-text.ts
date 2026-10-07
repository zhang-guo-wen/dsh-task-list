import type { TaskContent, TaskContentBlock, TaskTextBlock } from '../types.ts'
import { safeLink } from '../content.ts'

const escape = (text: string) => text.replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

function textHtml(block: TaskTextBlock): string {
  const tag = block.type === 'heading' ? `h${block.level ?? 2}` : { paragraph: 'p', bullet: 'ul', ordered: 'ol', quote: 'blockquote', code: 'pre' }[block.type]
  let text = block.children.map(child => {
    let html = escape(child.text).replace(/\n/gu, '<br>')
    for (const mark of child.marks ?? []) {
      const tag = { bold: 'strong', italic: 'em', underline: 'u', code: 'code', strikethrough: 's' }[mark]
      html = `<${tag}>${html}</${tag}>`
    }
    return child.href && safeLink(child.href) ? `<a href="${escape(child.href)}">${html}</a>` : html
  }).join('') || '<br>'
  if (block.type === 'bullet' || block.type === 'ordered') {
    text = `<li>${text}</li>`
    for (let depth = 0; depth < (block.indent ?? 0); depth++) text = `<li><${tag}>${text}</${tag}></li>`
  }
  return `<${tag}>${text}</${tag}>`
}

export function contentHtml(content: TaskContent): string {
  return content.blocks.filter(block => block.type !== 'attachment').map(block => {
    if (block.type !== 'table') return textHtml(block)
    return `<table><tbody>${block.rows.map(row => `<tr>${row.map(cell => {
      const tag = cell.header ? 'th' : 'td'
      return `<${tag} colspan="${cell.colSpan ?? 1}" rowspan="${cell.rowSpan ?? 1}">${cell.blocks.map(textHtml).join('')}</${tag}>`
    }).join('')}</tr>`).join('')}</tbody></table>`
  }).join('')
}

/** Build a new allowlisted document. Never insert untrusted clipboard HTML into the live DOM. */
export function sanitizeClipboardHtml(html: string): { document: Document; omittedImages: boolean } {
  const source = new DOMParser().parseFromString(html.slice(0, 2_000_000), 'text/html')
  const target = document.implementation.createHTMLDocument('')
  const allowed = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'SPAN'])
  const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'LINK', 'META', 'NOSCRIPT'])
  let count = 0
  const copy = (node: Node, parent: Node) => {
    if (++count > 10000) return
    if (node.nodeType === 3) { parent.appendChild(target.createTextNode(node.textContent ?? '')); return }
    if (!(node instanceof HTMLElement) || blocked.has(node.tagName) || node.tagName === 'IMG') return
    const element = allowed.has(node.tagName) ? target.createElement(node.tagName.toLowerCase()) : target.createElement('span')
    if (node.tagName === 'A') {
      const href = safeLink(node.getAttribute('href'))
      if (href) element.setAttribute('href', href)
    }
    if (node.tagName === 'TD' || node.tagName === 'TH') {
      for (const key of ['colspan', 'rowspan']) {
        const span = Number(node.getAttribute(key))
        if (Number.isInteger(span) && span > 0 && span <= 100) element.setAttribute(key, String(span))
      }
    }
    // Word/Google Docs often encode basic marks on span styles. Preserve only these, never arbitrary CSS.
    let inner: Node = element
    const style = node.style
    for (const [active, tag] of [[style.fontWeight === 'bold' || Number(style.fontWeight) >= 600, 'strong'], [style.fontStyle === 'italic', 'em'], [style.textDecoration.includes('underline'), 'u'], [style.textDecoration.includes('line-through'), 's']] as const) {
      if (active) { const wrapper = target.createElement(tag); inner.appendChild(wrapper); inner = wrapper }
    }
    for (const child of node.childNodes) copy(child, inner)
    parent.appendChild(element)
  }
  for (const node of source.body.childNodes) copy(node, target.body)
  return { document: target, omittedImages: source.querySelector('img') !== null }
}

export async function fileUpload(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768))
  return btoa(binary)
}

export function attachmentFile(node: Extract<TaskContentBlock, { type: 'attachment' }>, data: string): File {
  const binary = atob(data)
  return new File([Uint8Array.from(binary, char => char.charCodeAt(0))], node.name, { type: node.mediaType })
}
