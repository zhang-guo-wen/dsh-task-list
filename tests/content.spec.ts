import { describe, expect, it } from 'vitest'
import { contentMarkdown, contentText, textContent, validateContent } from '../src/content.ts'
import { contentHtml } from '../src/client/rich-text.ts'

describe('structured rich text', () => {
  it('round-trips plain text including empty lines and literal markup', () => {
    const text = '<script>alert(1)</script>\n\n中文'
    expect(contentText(validateContent(textContent(text)))).toBe(text)
    expect(contentHtml(textContent(text))).toContain('&lt;script&gt;')
    expect(contentHtml(textContent(text))).not.toContain('<script>')
  })

  it('projects formatting to Markdown and strips unknown properties', () => {
    const content = validateContent({ version: 1, blocks: [
      { type: 'heading', html: '<script>', children: [{ text: 'Plan', marks: ['bold'], onclick: 'bad' }] },
      { type: 'bullet', children: [{ text: 'Tests', marks: ['italic'] }] },
      { type: 'code', children: [{ text: 'npm test' }] },
    ] })
    expect(contentText(content)).toBe('Plan\nTests\nnpm test')
    expect(contentMarkdown(content)).toBe('## **Plan**\n- *Tests*\n```\nnpm test\n```')
    expect(JSON.stringify(content)).not.toMatch(/html|onclick/)
  })

  it('keeps links, heading levels, tables and nested list indentation through validation', () => {
    const content = validateContent({ version: 1, blocks: [
      { type: 'heading', level: 1, children: [{ text: 'Title' }] },
      { type: 'bullet', indent: 1, children: [{ text: 'Link', href: 'https://example.com' }] },
      { type: 'table', rows: [[{ header: true, blocks: [{ type: 'paragraph', children: [{ text: 'Key' }] }] }],
        [{ colSpan: 2, blocks: [{ type: 'paragraph', children: [{ text: 'Value' }] }] }]] },
    ] })
    expect(contentText(content)).toBe('Title\nLink\nKey\nValue')
    expect(contentMarkdown(content)).toContain('  - [Link](https://example.com)')
    expect(contentMarkdown(content)).toContain('| Key |\n| --- |\n| Value |')
    expect(contentHtml(content)).toContain('<h1>Title</h1>')
    expect(contentHtml(content)).toContain('colspan="2"')
    expect(() => validateContent({ version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'bad', href: 'javascript:alert(1)' }] }] })).toThrow('invalid content link')
  })

  it('rejects arbitrary nodes, formats, overlong content and duplicate attachment identities', () => {
    expect(() => validateContent({ version: 2, blocks: [] })).toThrow('invalid task content')
    expect(() => validateContent({ version: 1, blocks: [{ type: 'html', children: [] }] })).toThrow('invalid text block')
    expect(() => validateContent({ version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'a', marks: ['script'] }] }] })).toThrow('invalid text marks')
    expect(() => validateContent(textContent('a'.repeat(20001)))).toThrow()
    const attachment = { type: 'attachment', id: '11111111-1111-4111-8111-111111111111', name: 'x.txt', mediaType: 'text/plain', bytes: 1 }
    expect(() => validateContent({ version: 1, blocks: [attachment, attachment] })).toThrow('invalid task attachment')
  })
})
