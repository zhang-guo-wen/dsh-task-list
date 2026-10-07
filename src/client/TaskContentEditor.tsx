import { useEffect, useRef, useState } from 'react'
import type { TaskAttachmentUpload, TaskContent } from '../types.ts'
import { ATTACHMENT_BYTE_LIMIT, ATTACHMENT_COUNT_LIMIT, ATTACHMENT_TOTAL_LIMIT, contentAttachments, contentText, validateContent } from '../content.ts'
import type { TaskKey } from './locales.ts'
import { attachmentFile, contentHtml, fileUpload, sanitizeClipboardHtml } from './rich-text.ts'
import { createEditor, $getRoot, $getSelection, $isRangeSelection, $createParagraphNode, $insertNodes, FORMAT_TEXT_COMMAND, PASTE_COMMAND, COMMAND_PRIORITY_HIGH, UNDO_COMMAND, REDO_COMMAND, type LexicalEditor, type TextFormatType } from 'lexical'
import { registerRichText, HeadingNode, QuoteNode, $createHeadingNode } from '@lexical/rich-text'
import { registerHistory, createEmptyHistoryState } from '@lexical/history'
import { ListNode, ListItemNode, registerList, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list'
import { LinkNode } from '@lexical/link'
import { TableNode, TableRowNode, TableCellNode, registerTablePlugin, registerTableSelectionObserver } from '@lexical/table'
import { $generateNodesFromDOM } from '@lexical/html'
import { $setBlocksType } from '@lexical/selection'
import { $readTaskBlocks } from './lexical-content.ts'
import css from './TaskContentEditor.module.css'
import { Button, Tooltip, FileTypeIcon, fileSizeText, IconPaperclipOutlineRegular, IconCloseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { $isHeadingNode } from '@lexical/rich-text'
import { $isListNode } from '@lexical/list'
import { CAN_UNDO_COMMAND, CAN_REDO_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical'
import { EditorIcon } from './EditorIcon.tsx'

const toolbarGroups = [
  [['undo', 'formatUndo'], ['redo', 'formatRedo']],
  [['paragraph', 'formatParagraph'], ['heading', 'formatHeading']],
  [['bold', 'formatBold'], ['italic', 'formatItalic'], ['underline', 'formatUnderline']],
  [['bullet', 'formatBullet'], ['ordered', 'formatOrdered']],
] as const

interface Props {
  value: TaskContent
  uploads: TaskAttachmentUpload[]
  onChange(value: TaskContent, uploads: TaskAttachmentUpload[]): void
  readAttachments(): Promise<TaskAttachmentUpload[]>
  onBusy(busy: boolean): void
  onValid(valid: boolean): void
  disabled: boolean
  t(key: TaskKey): string
}

export function TaskContentEditor({ value, uploads, onChange, readAttachments, onBusy, onValid, disabled, t }: Props) {
  const editor = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const lexical = useRef<LexicalEditor | null>(null)
  const readingRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reading, setReading] = useState(false)
  const [activeFormats, setActiveFormats] = useState<string[]>([])
  const [history, setHistory] = useState({ undo: false, redo: false })
  const [empty, setEmpty] = useState(true)
  const [dragging, setDragging] = useState(false)
  const latest = useRef({ value, uploads, onChange, onValid, onBusy, disabled, t })
  latest.current = { value, uploads, onChange, onValid, onBusy, disabled, t }
  const attachments = contentAttachments(value)
  useEffect(() => {
    const instance = createEditor({
      namespace: 'task-list-rich-text',
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, TableNode, TableRowNode, TableCellNode],
      theme: { text: { bold: css.bold!, italic: css.italic!, underline: css.underline!, strikethrough: css.strike!, code: css.code! } },
      onError: failure => { setError(failure.message); latest.current.onValid(false) },
    })
    lexical.current = instance
    instance.setRootElement(editor.current)
    const cleanups = [registerRichText(instance), registerList(instance), registerTablePlugin(instance), registerTableSelectionObserver(instance)]
    instance.update(() => {
      const root = $getRoot()
      root.clear()
      const parsed = new DOMParser().parseFromString(contentHtml(latest.current.value), 'text/html')
      const nodes = $generateNodesFromDOM(instance, parsed)
      root.append(...(nodes.length ? nodes : [$createParagraphNode()]))
      root.selectEnd()
    }, { discrete: true })
    cleanups.push(registerHistory(instance, createEmptyHistoryState(), 300, undefined, undefined, 100))
    cleanups.push(instance.registerCommand(CAN_UNDO_COMMAND, enabled => { setHistory(current => ({ ...current, undo: enabled })); return false }, COMMAND_PRIORITY_LOW))
    cleanups.push(instance.registerCommand(CAN_REDO_COMMAND, enabled => { setHistory(current => ({ ...current, redo: enabled })); return false }, COMMAND_PRIORITY_LOW))
    const readSelection = () => {
      setEmpty($getRoot().getTextContent().length === 0)
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const active = ['bold', 'italic', 'underline'].filter(format => selection.hasFormat(format as TextFormatType))
      let node = selection.anchor.getNode()
      let block = 'paragraph'
      while (node.getParent()) {
        if ($isListNode(node)) { block = node.getListType() === 'number' ? 'ordered' : 'bullet'; break }
        if ($isHeadingNode(node)) block = 'heading'
        node = node.getParent()!
      }
      setActiveFormats([...active, block])
    }
    instance.getEditorState().read(readSelection)
    cleanups.push(instance.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      editorState.read(readSelection)
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
      const current = latest.current
      try {
        const blocks = editorState.read($readTaskBlocks)
        const content = validateContent({ version: 1, blocks: [...blocks, ...contentAttachments(current.value)] })
        current.onChange(content, current.uploads)
        current.onValid(true)
        setError('')
      } catch { setError(current.t('contentTooLong')); current.onValid(false) }
    }))
    cleanups.push(instance.registerCommand(PASTE_COMMAND, event => {
      if (!(event instanceof ClipboardEvent) || !event.clipboardData) return false
      event.preventDefault()
      const html = event.clipboardData.getData('text/html')
      if (html) {
        const safe = sanitizeClipboardHtml(html)
        $insertNodes($generateNodesFromDOM(instance, safe.document))
        if (safe.omittedImages && !event.clipboardData.files.length) setNotice(latest.current.t('pasteImagesOmitted'))
      } else {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) selection.insertRawText(event.clipboardData.getData('text/plain'))
      }
      if (event.clipboardData.files.length) void addFiles([...event.clipboardData.files])
      return true
    }, COMMAND_PRIORITY_HIGH))
    instance.focus()
    return () => { cleanups.reverse().forEach(off => off()); instance.setRootElement(null); lexical.current = null }
  }, [])

  useEffect(() => { lexical.current?.setEditable(!disabled && !reading) }, [disabled, reading])
  const addFiles = async (files: File[]) => {
    if (latest.current.disabled || readingRef.current) return
    readingRef.current = true
    setReading(true)
    latest.current.onBusy(true)
    setError('')
    try {
      const existing = contentAttachments(latest.current.value)
      if (existing.length + files.length > ATTACHMENT_COUNT_LIMIT
        || files.some(file => file.size > ATTACHMENT_BYTE_LIMIT)
        || existing.reduce((sum, node) => sum + node.bytes, 0) + files.reduce((sum, file) => sum + file.size, 0) > ATTACHMENT_TOTAL_LIMIT) throw new Error(t('attachmentLimit'))
      const added = await Promise.all(files.map(async file => {
        const id = crypto.randomUUID()
        return { node: { type: 'attachment' as const, id, name: file.name, mediaType: file.type || 'application/octet-stream', bytes: file.size }, upload: { id, data: await fileUpload(file) } }
      }))
      const current = latest.current
      const content = validateContent({ version: 1, blocks: [...current.value.blocks, ...added.map(item => item.node)] })
      current.onChange(content, [...current.uploads, ...added.map(item => item.upload)])
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { readingRef.current = false; setReading(false); latest.current.onBusy(false) }
  }
  const download = async (id: string) => {
    try {
      const node = attachments.find(node => node.id === id)!
      const upload = uploads.find(upload => upload.id === id) ?? (await readAttachments()).find(upload => upload.id === id)
      if (!upload) throw new Error(t('attachmentMissing'))
      const url = URL.createObjectURL(attachmentFile(node, upload.data))
      const link = document.createElement('a')
      link.href = url
      link.download = node.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
  }
  const command = (name: string) => {
    const instance = lexical.current
    if (!instance) return
    instance.focus()
    if (['bold', 'italic', 'underline'].includes(name)) instance.dispatchCommand(FORMAT_TEXT_COMMAND, name as TextFormatType)
    else if (name === 'bullet') instance.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    else if (name === 'ordered') instance.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    else if (name === 'undo') instance.dispatchCommand(UNDO_COMMAND, undefined)
    else if (name === 'redo') instance.dispatchCommand(REDO_COMMAND, undefined)
    else instance.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) $setBlocksType(selection, () => name === 'heading' ? $createHeadingNode('h2') : $createParagraphNode())
    })
  }

  return <div className={css.wrapper}>
    <div className={css.surface} data-dragging={dragging || undefined}>
    <div className={css.toolbar} role="toolbar" aria-label={t('formatToolbar')}>
      {toolbarGroups.map((group, index) => <div key={index} className={css.toolGroup}>
        {group.map(([name, key]) => <Tooltip key={name} label={t(key)} side="top" portal delayMs={250}>
          <Button variant="ghost" size="sm" className={css.toolButton} aria-label={t(key)}
            {...(name === 'undo' || name === 'redo' ? {} : { 'aria-pressed': activeFormats.includes(name) })}
            disabled={disabled || reading || name === 'undo' && !history.undo || name === 'redo' && !history.redo}
            onMouseDown={event => event.preventDefault()} onClick={() => command(name)}><EditorIcon name={name} /></Button>
        </Tooltip>)}
      </div>)}
      <Tooltip label={t('addAttachment')} side="top" portal delayMs={250}>
        <Button variant="ghost" size="sm" className={css.attachButton} aria-label={t('addAttachment')}
          disabled={disabled || reading} icon={<IconPaperclipOutlineRegular size={18} />} onClick={() => picker.current?.click()} />
      </Tooltip>
    </div>
    <input ref={picker} className={css.picker} type="file" multiple tabIndex={-1} aria-label={t('addAttachment')}
      onChange={event => { void addFiles([...event.target.files ?? []]); event.target.value = '' }} />
    <div className={css.canvas}>
    {empty && <div className={css.placeholder}>{t('editorPlaceholder')}</div>}
    <div ref={editor} className={css.editor} contentEditable={!disabled && !reading} suppressContentEditableWarning role="textbox"
      aria-multiline="true" aria-required="true" aria-label={t('notesLabel')} data-placeholder={t('notesHint')}
      onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true) } }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault()
        setDragging(false)
        if (event.dataTransfer.files.length) void addFiles([...event.dataTransfer.files])
        else {
          const text = event.dataTransfer.getData('text/plain')
          lexical.current?.update(() => { const selection = $getSelection(); if ($isRangeSelection(selection)) selection.insertRawText(text) })
        }
      }} />
    </div>
    <div className={css.editorFooter}>
      <span>{reading ? t('attachmentReading') : t('editorPasteHint')}</span>
      <span>{t('editorCharacterCount').replace('{count}', String(contentText({ ...value, blocks: value.blocks.filter(block => block.type !== 'attachment') }).length))}</span>
    </div>
    </div>
    {attachments.length > 0 && <ul className={css.attachments} aria-label={t('attachments')}>
      {attachments.map(node => <li key={node.id}>
        <span className={css.fileIcon}><FileTypeIcon path={node.name} size={28} /></span>
        <button type="button" className={css.fileInfo} title={t('downloadAttachment')} aria-label={node.name} onClick={() => void download(node.id)}>
          <span className={css.fileName}>{node.name}</span><small>{fileSizeText(node.bytes)} · {t('downloadAttachment')}</small>
        </button>
        <Tooltip label={t('removeAttachment')} side="top" portal delayMs={250}>
          <Button variant="ghost" size="sm" className={css.removeButton} disabled={disabled || reading} aria-label={`${t('removeAttachment')}: ${node.name}`} onClick={() => {
            onChange({ ...value, blocks: value.blocks.filter(block => block.type !== 'attachment' || block.id !== node.id) }, uploads.filter(upload => upload.id !== node.id))
          }}><IconCloseOutlineRegular size={16} /></Button>
        </Tooltip>
      </li>)}
    </ul>}
    <p className={css.hint}>{t('attachmentLimit')}</p>
    {notice && <p role="status" className={css.hint}>{notice}</p>}
    {error && <p role="alert" className={css.error}>{error}</p>}
  </div>
}
