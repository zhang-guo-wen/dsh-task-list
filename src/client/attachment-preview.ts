import type { TaskContentBlock } from '../types.ts'

type Attachment = Extract<TaskContentBlock, { type: 'attachment' }>
const imageTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
  ico: 'image/x-icon', apng: 'image/apng',
}

/** Only infer a type from the filename when the uploader did not supply one. */
export function attachmentImageType(node: Pick<Attachment, 'name' | 'mediaType'>): string | null {
  const type = node.mediaType.trim().toLowerCase().split(';')[0]!
  if (type.startsWith('image/')) return type
  if (type && type !== 'application/octet-stream') return null
  return imageTypes[node.name.split('.').at(-1)?.toLowerCase() ?? ''] ?? null
}
