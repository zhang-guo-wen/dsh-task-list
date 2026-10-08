import { useCallback, useEffect, useState } from 'react'
import { Button, FileTypeIcon, ImageLightbox } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TaskAttachmentUpload, TaskContentBlock } from '../types.ts'
import type { TaskKey } from './locales.ts'
import { attachmentFile } from './rich-text.ts'
import { attachmentImageType } from './attachment-preview.ts'
import css from './TaskContentEditor.module.css'

type Attachment = Extract<TaskContentBlock, { type: 'attachment' }>

export function TaskAttachmentPreview({ node, upload, readUploads, t }: {
  node: Attachment
  upload: TaskAttachmentUpload | undefined
  readUploads(): Promise<TaskAttachmentUpload[]>
  t(key: TaskKey): string
}) {
  const mediaType = attachmentImageType(node)
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    if (!mediaType) return
    let active = true
    let source = ''
    setUrl('')
    setFailed(false)
    setOpen(false)
    void (async () => {
      try {
        const bytes = upload ?? (await readUploads()).find(item => item.id === node.id)
        if (!bytes) throw new Error('missing attachment')
        if (!active) return
        source = URL.createObjectURL(attachmentFile({ ...node, mediaType }, bytes.data))
        setUrl(source)
      } catch { if (active) setFailed(true) }
    })()
    return () => { active = false; if (source) URL.revokeObjectURL(source) }
  }, [node.id, node.name, mediaType, upload?.data, readUploads, attempt])

  if (!mediaType) return <span className={css.fileIcon}><FileTypeIcon path={node.name} size={28} /></span>
  const label = `${t('previewAttachment')}: ${node.name}`
  return <>
    <Button variant="ghost" size="sm" className={css.imageThumbnail} aria-label={label}
      title={failed ? t('imagePreviewFailed') : label} disabled={!url && !failed}
      onClick={() => { if (failed) setAttempt(value => value + 1); else setOpen(true) }}>
      {url && !failed ? <img src={url} alt={node.name} decoding="async" onError={() => setFailed(true)} />
        : <span className={css.thumbnailStatus}>{failed ? t('imagePreviewFailed') : t('attachmentReading')}</span>}
    </Button>
    {open && url && !failed && <ImageLightbox src={url} alt={node.name}
      labels={{ dialog: label, close: t('closeImagePreview') }} onClose={close} />}
  </>
}
