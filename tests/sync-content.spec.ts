import { describe, expect, it } from 'vitest'
import { decodeDescription, encodeDescription, mergeLocalAttachments } from '../src/sync/description-codec.ts'
import type { FieldValue } from '../src/sync/types.ts'
import { textContent } from '../src/content.ts'
import type { TaskContent } from '../src/types.ts'

function value<T>(v: T): Extract<FieldValue<T>, { presence: 'value' }> {
  return { presence: 'value', value: v, writable: true }
}
function nullField<T>(): Extract<FieldValue<T>, { presence: 'null' }> {
  return { presence: 'null', writable: true }
}
function absent<T>(): Extract<FieldValue<T>, { presence: 'absent' }> {
  return { presence: 'absent', writable: false }
}
function unsupported<T>(): Extract<FieldValue<T>, { presence: 'unsupported' }> {
  return { presence: 'unsupported', writable: false }
}

function expectSyncCode(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    expect((error as { code?: string }).code).toBe('task-list/sync')
    expect((error as { details?: { code?: string } }).details?.code).toBe(code)
    return
  }
  throw new Error(`expected sync error ${code}`)
}

const attachment = { type: 'attachment', id: '11111111-1111-4111-8111-111111111111', name: 'note.txt', mediaType: 'text/plain', bytes: 4 } as const

describe('decodeDescription', () => {
  it('decodes plain text into paragraphs with exact newlines and roundTrip true', () => {
    const result = decodeDescription(value('one\n\ntwo'), 'text')
    expect(result.roundTrip).toBe(true)
    expect(result.content).toEqual({ version: 1, blocks: [
      { type: 'paragraph', children: [{ text: 'one' }] },
      { type: 'paragraph', children: [{ text: '' }] },
      { type: 'paragraph', children: [{ text: 'two' }] },
    ] })
  })

  it('decodes an empty string and an explicit null to empty content without error', () => {
    expect(decodeDescription(value(''), 'text')).toEqual({ content: { version: 1, blocks: [] }, roundTrip: true })
    expect(decodeDescription(nullField<string>(), 'text')).toEqual({ content: { version: 1, blocks: [] }, roundTrip: true })
  })

  it('rejects absent and unsupported presence instead of silently clearing', () => {
    expectSyncCode(() => decodeDescription(absent<string>(), 'text'), 'UnsupportedRepresentation')
    expectSyncCode(() => decodeDescription(unsupported<string>(), 'text'), 'UnsupportedRepresentation')
    expectSyncCode(() => decodeDescription(value('x'), 'bogus' as 'text'), 'UnsupportedRepresentation')
  })

  it('stores a markdown code fence as exact raw source and marks other structure roundTrip false', () => {
    const source = '```js\nconst x = 1\n```'
    const code = decodeDescription(value(source), 'markdown')
    expect(code.roundTrip).toBe(true)
    expect(code.content).toEqual({ version: 1, blocks: [{ type: 'code', children: [{ text: source }] }] })

    const other = decodeDescription(value('# Heading\npara'), 'markdown')
    expect(other.roundTrip).toBe(false)
  })

  it('round-trips markdown fences with meta info and CRLF exactly and rejects ambiguous shapes', () => {
    const withMeta = '```js title="x"\nconst x = 1\n```'
    const metaDecoded = decodeDescription(value(withMeta), 'markdown')
    expect(metaDecoded.roundTrip).toBe(true)
    expect(encodeDescription(metaDecoded.content, 'markdown')).toBe(withMeta)

    const crlf = '```js\r\nconst x = 1\r\n```'
    const crlfDecoded = decodeDescription(value(crlf), 'markdown')
    expect(crlfDecoded.roundTrip).toBe(true)
    expect(encodeDescription(crlfDecoded.content, 'markdown')).toBe(crlf)

    const bodyBackticks = '```js\nconst x = `a`\n```'
    expect(decodeDescription(value(bodyBackticks), 'markdown').roundTrip).toBe(false)
    const trailingBlank = '```js\nconst x = 1\n```\n'
    expect(decodeDescription(value(trailingBlank), 'markdown').roundTrip).toBe(false)
  })

  it('decodes HTML headings, paragraphs, marks, links, quote and code into the vocabulary', () => {
    const result = decodeDescription(value(
      '<h1>Title</h1><p>Hello <strong>world</strong> <a href="https://example.com">link</a></p><blockquote>quoted</blockquote><pre><code>npm test</code></pre>',
    ), 'richtext')
    expect(result.roundTrip).toBe(true)
    expect(result.content).toEqual({ version: 1, blocks: [
      { type: 'heading', level: 1, children: [{ text: 'Title' }] },
      { type: 'paragraph', children: [
        { text: 'Hello ' }, { text: 'world', marks: ['bold'] }, { text: ' ' }, { text: 'link', href: 'https://example.com' },
      ] },
      { type: 'quote', children: [{ text: 'quoted' }] },
      { type: 'code', children: [{ text: 'npm test' }] },
    ] })
  })

  it('decodes lists with indentation and tables with spans and headers', () => {
    const result = decodeDescription(value(
      '<ul><li>One</li><li>Two<ul><li>Nested</li></ul></li></ul>' +
      '<table><tr><th>Key</th></tr><tr><td colspan="2">Value</td></tr></table>',
    ), 'richtext')
    expect(result.roundTrip).toBe(true)
    expect(result.content).toEqual({ version: 1, blocks: [
      { type: 'bullet', children: [{ text: 'One' }] },
      { type: 'bullet', children: [{ text: 'Two' }] },
      { type: 'bullet', indent: 1, children: [{ text: 'Nested' }] },
      { type: 'table', rows: [
        [{ header: true, blocks: [{ type: 'paragraph', children: [{ text: 'Key' }] }] }],
        [{ colSpan: 2, blocks: [{ type: 'paragraph', children: [{ text: 'Value' }] }] }],
      ] },
    ] })
  })

  it('marks script/style/images/events/javascript hrefs and unknown nodes as not lossless', () => {
    const cases: string[] = [
      '<p>safe</p><script>alert(1)</script>',
      '<p>safe</p><style>body{}</style>',
      '<p>a</p><img src="x.png">',
      '<p onclick="boom()">x</p>',
      '<a href="javascript:alert(1)">x</a>',
      '<p style="color:red">x</p>',
      '<custom-widget>z</custom-widget>',
    ]
    for (const html of cases) {
      const result = decodeDescription(value(html), 'richtext')
      expect(result.roundTrip).toBe(false)
    }
  })

  it('never lets script content into the decoded draft', () => {
    const result = decodeDescription(value('<p>safe</p><script>alert(1)</script>'), 'richtext')
    const text = JSON.stringify(result.content)
    expect(text).not.toContain('alert(1)')
    expect(text).toContain('safe')
  })

  it('decodes a plain pre/code subset losslessly and refuses nested markup as lossless', () => {
    const plain = decodeDescription(value('<pre><code>npm test</code></pre>'), 'richtext')
    expect(plain.roundTrip).toBe(true)
    expect(plain.content).toEqual({ version: 1, blocks: [{ type: 'code', children: [{ text: 'npm test' }] }] })

    const bold = decodeDescription(value('<pre><b>bold</b></pre>'), 'richtext')
    expect(bold.roundTrip).toBe(false)
    expect(bold.content).toEqual({ version: 1, blocks: [{ type: 'code', children: [{ text: 'bold' }] }] })
  })

  it('never lets a nested script inside pre enter the code block', () => {
    const result = decodeDescription(value('<pre><script>alert(1)</script></pre>'), 'richtext')
    expect(result.roundTrip).toBe(false)
    expect(JSON.stringify(result.content)).not.toContain('alert(1)')
    expect(result.content).toEqual({ version: 1, blocks: [{ type: 'code', children: [{ text: '' }] }] })
  })

  it('marks a bare <pre> whose text is not wrapped in <code> as not lossless', () => {
    const bare = decodeDescription(value('<pre>npm test</pre>'), 'richtext')
    expect(bare.roundTrip).toBe(false)
    expect(bare.content).toEqual({ version: 1, blocks: [{ type: 'code', children: [{ text: 'npm test' }] }] })

    const trailing = decodeDescription(value('<pre><code>npm test</code>suffix</pre>'), 'richtext')
    expect(trailing.roundTrip).toBe(false)
  })

  it('sorts marks and merges adjacent equivalent inlines in decoded content', () => {
    const sorted = decodeDescription(value('<p><em>x</em><strong>y</strong></p>'), 'richtext')
    expect(sorted.content).toEqual({ version: 1, blocks: [
      { type: 'paragraph', children: [{ text: 'x', marks: ['italic'] }, { text: 'y', marks: ['bold'] }] },
    ] })

    const merged = decodeDescription(value('<p><strong>a</strong><strong>b</strong></p>'), 'richtext')
    expect(merged.content).toEqual({ version: 1, blocks: [
      { type: 'paragraph', children: [{ text: 'ab', marks: ['bold'] }] },
    ] })
  })
})

describe('encodeDescription', () => {
  it('encodes text with exact newlines and rejects marked or structural content', () => {
    expect(encodeDescription(textContent('a\n\nb'), 'text')).toBe('a\n\nb')
    expect(encodeDescription({ version: 1, blocks: [] }, 'text')).toBe('')
    const bold = { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'x', marks: ['bold'] }] }] } as TaskContent
    expectSyncCode(() => encodeDescription(bold, 'text'), 'UnsupportedRepresentation')
    const heading = { version: 1, blocks: [{ type: 'heading', level: 1, children: [{ text: 'T' }] }] } as TaskContent
    expectSyncCode(() => encodeDescription(heading, 'text'), 'UnsupportedRepresentation')
  })

  it('encodes a markdown code block as its exact raw source and rejects non-fenced or non-code content', () => {
    const source = '```js\nconst x = 1\n```'
    const code = { version: 1, blocks: [{ type: 'code', children: [{ text: source }] }] } as TaskContent
    expect(encodeDescription(code, 'markdown')).toBe(source)

    const bare = { version: 1, blocks: [{ type: 'code', children: [{ text: 'const x = 1' }] }] } as TaskContent
    expectSyncCode(() => encodeDescription(bare, 'markdown'), 'UnsupportedRepresentation')

    const heading = { version: 1, blocks: [{ type: 'heading', level: 1, children: [{ text: 'T' }] }] } as TaskContent
    expectSyncCode(() => encodeDescription(heading, 'markdown'), 'UnsupportedRepresentation')
  })

  it('rejects markdown with more than one code block as unsupported for a lossless round trip', () => {
    const two = { version: 1, blocks: [
      { type: 'code', children: [{ text: '```js\nconst a = 1\n```' }] },
      { type: 'code', children: [{ text: '```js\nconst b = 2\n```' }] },
    ] } as TaskContent
    expectSyncCode(() => encodeDescription(two, 'markdown'), 'UnsupportedRepresentation')

    const codeThenParagraph = { version: 1, blocks: [
      { type: 'code', children: [{ text: '```js\nconst a = 1\n```' }] },
      { type: 'paragraph', children: [{ text: 'text' }] },
    ] } as TaskContent
    expectSyncCode(() => encodeDescription(codeThenParagraph, 'markdown'), 'UnsupportedRepresentation')
  })

  it('encodes HTML for the supported vocabulary and round-trips through decode', () => {
    const content = { version: 1, blocks: [
      { type: 'heading', level: 1, children: [{ text: 'Title' }] },
      { type: 'paragraph', children: [{ text: 'Hi ', }, { text: 'there', marks: ['bold'] }] },
      { type: 'bullet', children: [{ text: 'One' }] },
      { type: 'bullet', children: [{ text: 'Two' }] },
      { type: 'code', children: [{ text: 'npm test' }] },
    ] } as TaskContent
    const html = encodeDescription(content, 'richtext')
    expect(html).toBe('<h1>Title</h1><p>Hi <strong>there</strong></p><ul><li>One</li><li>Two</li></ul><pre><code>npm test</code></pre>')
    const back = decodeDescription(value(html), 'richtext')
    expect(back.roundTrip).toBe(true)
    expect(back.content).toEqual(content)
  })

  it('rejects a list with a non-contiguous indent jump instead of silently collapsing it', () => {
    const jump = { version: 1, blocks: [
      { type: 'bullet', children: [{ text: 'A' }] },
      { type: 'bullet', indent: 2, children: [{ text: 'B' }] },
    ] } as TaskContent
    expectSyncCode(() => encodeDescription(jump, 'richtext'), 'UnsupportedRepresentation')
  })

  it('rejects a list whose first item is indented', () => {
    const firstIndented = { version: 1, blocks: [
      { type: 'bullet', indent: 1, children: [{ text: 'A' }] },
    ] } as TaskContent
    expectSyncCode(() => encodeDescription(firstIndented, 'richtext'), 'UnsupportedRepresentation')
  })

  it('rejects attachments entering the encoded payload for any format', () => {
    const withAttachment: TaskContent = { version: 1, blocks: [
      { type: 'paragraph', children: [{ text: 'body' }] },
      attachment,
    ] }
    expectSyncCode(() => encodeDescription(withAttachment, 'text'), 'UnsupportedRepresentation')
    expectSyncCode(() => encodeDescription(withAttachment, 'markdown'), 'UnsupportedRepresentation')
    expectSyncCode(() => encodeDescription(withAttachment, 'richtext'), 'UnsupportedRepresentation')
  })
})

describe('mergeLocalAttachments', () => {
  it('appends the current attachments after the new description in original order', () => {
    const second = { ...attachment, id: '22222222-2222-4222-8222-222222222222', name: 'two.txt' }
    const current: TaskContent = { version: 1, blocks: [
      { type: 'paragraph', children: [{ text: 'old' }] },
      attachment,
      second,
    ] }
    const remote: TaskContent = textContent('new body')
    const merged = mergeLocalAttachments(remote, current)
    expect(merged.blocks.map(b => b.type)).toEqual(['paragraph', 'attachment', 'attachment'])
    expect(merged.blocks[1]).toEqual(attachment)
    expect(merged.blocks[2]).toEqual(second)
  })

  it('fails the whole item when the merged content exceeds limits without dropping attachments', () => {
    const big = { type: 'attachment', id: '33333333-3333-4333-8333-333333333333', name: 'big.bin', mediaType: 'application/octet-stream', bytes: 9 * 1024 * 1024 } as const
    const current: TaskContent = { version: 1, blocks: [big] }
    const remote: TaskContent = textContent('x'.repeat(20001))
    expect(() => mergeLocalAttachments(remote, current)).toThrow()
  })
})
