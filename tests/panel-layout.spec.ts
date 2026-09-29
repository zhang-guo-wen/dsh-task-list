import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// These are layout contracts, not rendering tests: the panel is a browser
// bundle with no DOM test environment here, and the regressions this file
// guards (the list drifting away from the Automation tasks page width, and the
// row keeping columns the list should not show) live in the stylesheet.
const css = readFileSync(new URL('../src/client/TaskPanel.module.css', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/client/TaskPanel.tsx', import.meta.url), 'utf8')

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (match === null) throw new Error(`missing CSS rule: ${selector}`)
  return match[1]!
}

describe('panel layout', () => {
  it('keeps the centred 960px content box used by the Automation tasks page', () => {
    const inner = rule('.inner')
    expect(inner).toContain('max-width: 960px')
    expect(inner).toContain('margin: 0 auto')
    expect(inner).toContain('padding: 0 clamp(24px, 4vw, 48px) 48px')
  })

  it('shows content, status, workspace, and actions only in a task row', () => {
    expect(rule('.rowLine')).toContain('grid-template-columns: minmax(0, 1fr) 72px 128px auto')
    expect(panel).not.toMatch(/sessionMeta|createdMeta/)
    expect(css).not.toMatch(/sessionMeta|createdMeta/)
  })

  it('lays the composer out two fields per row around full-width rows', () => {
    expect(rule('.dialog form')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(rule('.fullRow')).toContain('grid-column: 1 / -1')
    // The content field, the worktree hint, the timestamps, and the subtask
    // section own their rows; every other field shares one.
    expect(panel).toContain("className={css.fullRow}>{t('notesLabel')}")
    expect(panel.match(/css\.fullRow/g)).toHaveLength(4)
  })
})
