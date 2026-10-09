import { syncError, syncRemoteError } from '../errors.ts'

const ID_LIMIT = 200
const TEXT_LIMIT = 2000
const CONTENT_LIMIT = 200_000
/** Ids reject every control character; free text keeps tabs and newlines. */
const CONTROL = /[\u0000-\u001f]/u
const TEXT_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u

/** Sections a detail read may bring back; each one costs its own request. */
export const DETAIL_SECTIONS = ['description', 'comments', 'relations', 'activities', 'attachments'] as const
export type DetailSection = (typeof DETAIL_SECTIONS)[number]

/** Relation kinds the platform exposes through `relationRecords`. */
export const RELATION_TYPES = ['PARENT', 'SUB', 'ASSOCIATED', 'DEPEND_ON', 'DEPENDED_BY'] as const
export type RelationType = (typeof RELATION_TYPES)[number]

function fail(field: string): never {
  throw syncRemoteError(syncError('InvalidRemoteResponse', { scope: 'item', field }))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function idField(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > ID_LIMIT || CONTROL.test(value)) fail(field)
  return value
}

function textField(value: unknown, field: string, limit = TEXT_LIMIT): string {
  if (typeof value !== 'string' || value.length > limit || TEXT_CONTROL.test(value)) fail(field)
  return value
}

function optionalText(value: unknown, field: string, limit = TEXT_LIMIT): string | null {
  return value === null || value === undefined ? null : textField(value, field, limit)
}

function user(value: unknown, field: string): { id: string; name: string } | null {
  if (value === null || value === undefined) return null
  if (!isPlainObject(value)) fail(field)
  return { id: idField(value.id, `${field}.id`), name: optionalText(value.name, `${field}.name`, 100) ?? '' }
}

function epoch(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function stripHtml(html: string): string {
  const bounded = html.length > CONTENT_LIMIT ? html.slice(0, CONTENT_LIMIT) : html
  const withoutBlocks = bounded.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
  const withoutTags = withoutBlocks.replace(/<[^>]*>/gu, ' ')
  return withoutTags
    .replace(/&nbsp;/gu, ' ')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, '&')
    .replace(/[ \t\u00a0]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

export interface DescriptionView {
  format: 'richtext' | 'markdown' | 'text'
  /** Rich-text HTML when the platform carries it; null for plain-text formats. */
  html: string | null
  /** Search/preview projection: tags removed, entities decoded. */
  plain: string
}

/**
 * Unwrap the platform's description carrier. The live service returns a JSON
 * string of the form `{"htmlValue":"<article…>","jsonMLValue":[…]}` whenever the
 * body was written as rich text; a hand-written fixture of plain HTML does not
 * exist in production, so both shapes are accepted and neither is guessed at.
 */
export function unpackDescription(raw: unknown, formatType: unknown): DescriptionView | null {
  if (raw === null || raw === undefined) return null
  const source = textField(raw, 'description', CONTENT_LIMIT)
  if (source === '') return null
  const format = typeof formatType === 'string' && formatType.toUpperCase() === 'MARKDOWN' ? 'markdown' as const : 'richtext' as const
  if (source.trimStart().startsWith('{')) {
    let parsed: unknown
    try { parsed = JSON.parse(source) as unknown } catch { parsed = undefined }
    if (isPlainObject(parsed)) {
      const html = parsed.htmlValue
      if (typeof html === 'string' && html.length <= CONTENT_LIMIT) {
        return { format: 'richtext', html, plain: stripHtml(html) }
      }
      const markdown = parsed.markdownValue
      if (typeof markdown === 'string' && markdown.length <= CONTENT_LIMIT) {
        return { format: 'markdown', html: null, plain: markdown }
      }
    }
    fail('description')
  }
  if (format === 'markdown') return { format, html: null, plain: source }
  return { format, html: source, plain: stripHtml(source) }
}

export interface CommentView {
  id: string
  /** Comment text; `format` tells the renderer which dialect it is. */
  content: string
  /**
   * Measured against the live service: `contentFormat` says RICHTEXT for every
   * comment while the body is plain Markdown-ish text, so the dialect is taken
   * from the content itself and `contentFormat` is kept for diagnostics only.
   */
  format: 'html' | 'markdown'
  contentFormat: string | null
  parentId: string | null
  top: boolean
  user: { id: string; name: string } | null
  gmtCreate: number | null
  gmtModified: number | null
}

export function projectComments(raw: unknown): CommentView[] {
  if (raw === null || raw === undefined) return []
  if (!Array.isArray(raw)) fail('comments')
  return raw.map(entry => {
    if (!isPlainObject(entry)) fail('comments')
    const content = textField(entry.content, 'comments.content', CONTENT_LIMIT)
    return {
      id: idField(entry.id, 'comments.id'),
      content,
      format: content.trimStart().startsWith('<') ? 'html' as const : 'markdown' as const,
      contentFormat: optionalText(entry.contentFormat, 'comments.contentFormat', 32),
      parentId: entry.parentId === null || entry.parentId === undefined ? null : idField(entry.parentId, 'comments.parentId'),
      top: entry.top === true,
      user: user(entry.user, 'comments.user'),
      gmtCreate: epoch(entry.gmtCreate),
      gmtModified: epoch(entry.gmtModified),
    }
  })
}

export interface RelationRecordView {
  relationType: RelationType
  /** Platform category of the far side, e.g. `Req` or `Bug`. */
  resourceType: string | null
  resourceId: string
  gmtCreate: number | null
}

/** Project one relation list; a record claiming another type is a mismatch, not a silent pass. */
export function projectRelationRecords(raw: unknown, expected: RelationType): RelationRecordView[] {
  if (raw === null || raw === undefined) return []
  if (!Array.isArray(raw)) fail('relationRecords')
  return raw.map(entry => {
    if (!isPlainObject(entry)) fail('relationRecords')
    const relationType = textField(entry.relationType, 'relationRecords.relationType', 32)
    if (relationType !== expected) fail('relationRecords.relationType')
    return {
      relationType: expected,
      resourceType: optionalText(entry.resourceType, 'relationRecords.resourceType', 32),
      resourceId: idField(entry.resourceId, 'relationRecords.resourceId'),
      gmtCreate: epoch(entry.gmtCreate),
    }
  })
}

export interface ActivityValue { identifier: string; displayValue: string }

export interface ActivityView {
  eventId: number | null
  eventType: string
  eventTime: number | null
  operator: { id: string; name: string } | null
  property: { propertyType: string | null; propertyId: string | null; propertyName: string | null } | null
  actionType: string | null
  oldValue: ActivityValue[]
  newValue: ActivityValue[]
  relatedResource: { resourceType: string | null; resourceId: string } | null
}

function activityValues(value: unknown): ActivityValue[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(entry => {
    if (!isPlainObject(entry)) return []
    const display = optionalText(entry.displayValue, 'activities.values.displayValue', TEXT_LIMIT)
    if (display === null) return []
    return [{ identifier: optionalText(entry.identifier, 'activities.values.identifier', ID_LIMIT) ?? display, displayValue: display }]
  })
}

export function projectActivities(raw: unknown): ActivityView[] {
  if (raw === null || raw === undefined) return []
  if (!Array.isArray(raw)) fail('activities')
  return raw.map(entry => {
    if (!isPlainObject(entry)) fail('activities')
    const property = isPlainObject(entry.property)
      ? {
        propertyType: optionalText(entry.property.propertyType, 'activities.property.propertyType', 32),
        propertyId: optionalText(entry.property.propertyId, 'activities.property.propertyId', ID_LIMIT),
        propertyName: optionalText(entry.property.propertyName, 'activities.property.propertyName', 100),
      }
      : null
    const related = isPlainObject(entry.relatedResource)
      ? {
        resourceType: optionalText(entry.relatedResource.resourceType, 'activities.relatedResource.resourceType', 32),
        resourceId: idField(entry.relatedResource.resourceId, 'activities.relatedResource.resourceId'),
      }
      : null
    return {
      eventId: typeof entry.eventId === 'number' && Number.isSafeInteger(entry.eventId) ? entry.eventId : null,
      eventType: textField(entry.eventType, 'activities.eventType', 64),
      eventTime: epoch(entry.eventTime),
      operator: user(entry.operator, 'activities.operator'),
      property,
      actionType: optionalText(entry.actionType, 'activities.actionType', 32),
      oldValue: activityValues(entry.oldValue),
      newValue: activityValues(entry.newValue),
      relatedResource: related,
    }
  })
}

export interface AttachmentView {
  id: string
  fileId: string
  fileName: string
  suffix: string | null
  size: number | null
  creator: { id: string; name: string } | null
  gmtCreate: number | null
  /**
   * Short-lived signed download URL (measured ~1 minute). Callers must fetch it
   * immediately and never persist it; the console URL in `embedUrl` needs a
   * browser session and answers 401 to a token.
   */
  url: string | null
  urlExpiresAt: number | null
  embedUrl: string | null
}

function signedExpiry(url: string | null): number | null {
  if (url === null) return null
  const match = /[?&]Expires=(\d+)/u.exec(url)
  return match ? Number(match[1]) * 1000 : null
}

export function projectAttachments(raw: unknown): AttachmentView[] {
  if (raw === null || raw === undefined) return []
  if (!Array.isArray(raw)) fail('attachments')
  return raw.map(entry => {
    if (!isPlainObject(entry)) fail('attachments')
    const url = optionalText(entry.url, 'attachments.url', 4000)
    return {
      id: idField(entry.id, 'attachments.id'),
      fileId: idField(entry.fileId, 'attachments.fileId'),
      fileName: optionalText(entry.fileName, 'attachments.fileName', 500) ?? '',
      suffix: optionalText(entry.suffix, 'attachments.suffix', 32),
      size: typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : null,
      creator: user(entry.creator, 'attachments.creator'),
      gmtCreate: epoch(entry.gmtCreate),
      url,
      urlExpiresAt: signedExpiry(url),
      embedUrl: optionalText(entry.embedUrl, 'attachments.embedUrl', 4000),
    }
  })
}
