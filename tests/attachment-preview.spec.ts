import { describe, expect, it } from 'vitest'
import { attachmentImageType } from '../src/client/attachment-preview.ts'

describe('image attachment detection', () => {
  it('recognizes image MIME types regardless of filename', () => {
    expect(attachmentImageType({ name: 'clipboard', mediaType: 'image/png' })).toBe('image/png')
    expect(attachmentImageType({ name: 'photo.bin', mediaType: 'IMAGE/JPEG; charset=binary' })).toBe('image/jpeg')
  })
  it('infers browser-supported images when a file has no specific MIME type', () => {
    expect(attachmentImageType({ name: '截图.PNG', mediaType: 'application/octet-stream' })).toBe('image/png')
    expect(attachmentImageType({ name: 'photo.webp', mediaType: '' })).toBe('image/webp')
    expect(attachmentImageType({ name: 'vector.svg', mediaType: 'application/octet-stream' })).toBe('image/svg+xml')
  })
  it('does not treat documents or files with a conflicting MIME type as images', () => {
    expect(attachmentImageType({ name: 'notes.txt', mediaType: 'text/plain' })).toBeNull()
    expect(attachmentImageType({ name: 'fake.png', mediaType: 'text/html' })).toBeNull()
    expect(attachmentImageType({ name: 'unknown', mediaType: 'application/octet-stream' })).toBeNull()
  })
})
