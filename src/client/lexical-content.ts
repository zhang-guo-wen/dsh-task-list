import { $getRoot, $isElementNode, $isTextNode, $isLineBreakNode, type LexicalNode } from 'lexical'
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text'
import { $isListNode, $isListItemNode } from '@lexical/list'
import { $isLinkNode } from '@lexical/link'
import { $isTableNode, $isTableRowNode, $isTableCellNode } from '@lexical/table'
import type { TaskContentBlock, TaskInline, TaskMark, TaskTextBlock } from '../types.ts'
import { safeLink } from '../content.ts'

/** Translate Lexical's node tree to our editor-independent persistence vocabulary. */
export function $readTaskBlocks(): TaskContentBlock[] {
  const inline = (node: LexicalNode, href?: string): TaskInline[] => {
    if ($isTextNode(node)) {
      const marks = (['bold', 'italic', 'underline', 'code', 'strikethrough'] as TaskMark[]).filter(mark => node.hasFormat(mark))
      return [{ text: node.getTextContent(), ...(marks.length ? { marks } : {}), ...(href ? { href } : {}) }]
    }
    if ($isLineBreakNode(node)) return [{ text: '\n' }]
    if ($isLinkNode(node)) return node.getChildren().flatMap(child => inline(child, safeLink(node.getURL())))
    if ($isElementNode(node) && !$isListNode(node)) return node.getChildren().flatMap(child => inline(child, href))
    return []
  }
  const textBlocks = (node: LexicalNode, indent = 0): TaskTextBlock[] => {
    if ($isListNode(node)) return node.getChildren().flatMap(child => {
      if (!$isListItemNode(child)) return []
      const children = child.getChildren().filter(child => !$isListNode(child)).flatMap(child => inline(child))
      return [...(children.length ? [{ type: node.getListType() === 'number' ? 'ordered' as const : 'bullet' as const, children, ...(indent ? { indent } : {}) }] : []),
        ...child.getChildren().filter($isListNode).flatMap(child => textBlocks(child, indent + 1))]
    })
    const type = $isHeadingNode(node) ? 'heading' : $isQuoteNode(node) ? 'quote' : 'paragraph'
    return [{ type, children: inline(node), ...($isHeadingNode(node) ? { level: Number(node.getTag().slice(1)) } : {}) }]
  }
  return $getRoot().getChildren().flatMap((node): TaskContentBlock[] => {
    if (!$isTableNode(node)) return textBlocks(node)
    return [{ type: 'table', rows: node.getChildren().filter($isTableRowNode).map(row => row.getChildren().filter($isTableCellNode).map(cell => ({
      blocks: cell.getChildren().flatMap(child => textBlocks(child)),
      ...(cell.hasHeader() ? { header: true } : {}),
      ...(cell.getColSpan() > 1 ? { colSpan: cell.getColSpan() } : {}),
      ...(cell.getRowSpan() > 1 ? { rowSpan: cell.getRowSpan() } : {}),
    }))) }]
  })
}
