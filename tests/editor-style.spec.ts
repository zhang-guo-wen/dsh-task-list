import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const editor = readFileSync(new URL('../src/client/TaskContentEditor.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/client/TaskContentEditor.module.css', import.meta.url), 'utf8')

describe('editor appearance', () => {
  it('reuses host buttons, tooltips and file icons instead of plain text toolbar buttons', () => {
    expect(editor).toContain("from '@deepseek-ai/dsh-client-ui-primitives'")
    expect(editor).toContain('<Tooltip')
    expect(editor).toContain('<Button variant="ghost"')
    expect(editor).toContain('<FileTypeIcon')
    expect(editor).toContain('<EditorIcon name={name}')
    expect(editor).toContain("'aria-pressed': activeFormats.includes(name)")
    expect(editor).toContain('CAN_UNDO_COMMAND')
  })
  it('keeps a grouped toolbar, readable canvas and token-based light/dark styles', () => {
    expect(css).toContain('.toolGroup + .toolGroup')
    expect(css).toContain('padding: 18px 18px 22px')
    expect(css).toContain("[aria-pressed='true']")
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(css).not.toMatch(/#[\da-f]{3,8}\b/iu)
  })
})
