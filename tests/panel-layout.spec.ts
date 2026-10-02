import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// These are layout contracts, not rendering tests: the panel is a browser
// bundle with no DOM test environment here, and the regressions this file
// guards (the list drifting away from the Automation tasks page width, the row
// keeping columns the list should not show, and the composer field order) live
// in the component and its stylesheet.
const css = readFileSync(new URL('../src/client/TaskPanel.module.css', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/client/TaskPanel.tsx', import.meta.url), 'utf8')

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (match === null) throw new Error(`missing CSS rule: ${selector}`)
  return match[1]!
}

/** Offset of a composer literal, failing loudly when it disappeared. */
function at(source: string): number {
  const offset = panel.indexOf(source)
  if (offset < 0) throw new Error(`missing in TaskPanel.tsx: ${source}`)
  return offset
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

  it('dims a completed card exactly like an ended row on the Automation tasks page', () => {
    // The row carries its status, so the stylesheet can reach a done card.
    expect(panel).toMatch(/<li className=\{css\.row\} data-priority=\{task\.priority\} data-status=\{task\.status\}/)
    // Tertiary content over a caption workspace line, back to the usual steps
    // while the pointer is on the card or focus is inside it.
    expect(rule(".row[data-status='done'] .content")).toContain('color: var(--dsw-alias-label-tertiary')
    expect(rule(".row[data-status='done'] .workspaceMeta")).toContain('color: var(--dsw-alias-label-caption')
    expect(rule(".row[data-status='done']:is(:hover, :focus-within) .content")).toContain('color: inherit')
    expect(rule(".row[data-status='done']:is(:hover, :focus-within) .workspaceMeta")).toContain('color: var(--dsw-alias-label-tertiary')
  })

  it('lays the composer out two fields per row around full-width rows', () => {
    expect(rule('.dialog form')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(rule('.fullRow')).toContain('grid-column: 1 / -1')
    // The content field, the toggle row, the worktree hint, and the read-only
    // metadata section own their rows; every other field shares one.
    expect(panel).toContain("className={css.fullRow}>{t('notesLabel')}")
    expect(panel.match(/css\.fullRow/g)).toHaveLength(4)
  })

  it('orders the composer content, workspace and agent, toggles, priority and status, tags, story points', () => {
    const order = [
      "className={css.fullRow}>{t('notesLabel')}",
      "<label>{t('workspace')}",
      "<label>{t('agent')}",
      'css.toggleRow',
      "{t('sendImmediately')}",
      "{t('useWorktree')}",
      "<label>{t('priorityLabel')}",
      "<label>{t('status')}",
      "<label>{t('tags')}",
      "<label>{t('storyPoints')}",
    ].map(at)
    expect(order).toEqual([...order].sort((left, right) => left - right))
  })

  it('keeps Send immediately and Use worktree as the only children of one row', () => {
    expect(rule('.toggleRow')).toContain('display: flex')
    expect(panel.match(/css\.toggleRow/g)).toHaveLength(1)
    const row = /<div className=\{css\.toggleRow[^>]*\}>([\s\S]*?)<\/div>/.exec(panel)?.[1]
    expect(row).toContain("{t('sendImmediately')}")
    expect(row).toContain("{t('useWorktree')}")
  })

  it('lets the composer set the status of a new or existing task', () => {
    // One select drives both paths, so no branch keeps the stored status back.
    expect(panel).toContain("<label>{t('status')}<select value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>")
    expect(panel).toContain("{statusKeys.map(item => <option key={item} value={item}>{t(statusKey(item))}</option>)}")
    expect(panel).toContain('title: derivedTitle, notes, status, priority,')
    expect(panel).not.toContain('status: editing.status')
    expect(panel).not.toContain('composerStatus')
  })

  it('closes the composer with read-only facts in the same field style', () => {
    expect(rule('.metaSection')).toContain('border-top')
    expect(at('css.metaSection')).toBeGreaterThan(at("<label>{t('storyPoints')}"))
    // Session id, created, started, and completed use the fixed-value style.
    expect(panel.match(/css\.fixedValue/g)).toHaveLength(4)
    expect(at("t('createdAt')")).toBeLessThan(at("t('startedAt')"))
    expect(at("t('startedAt')")).toBeLessThan(at("t('completedAt')"))
    expect(at("t('notStarted')")).toBeGreaterThan(0)
    expect(at("t('notCompleted')")).toBeGreaterThan(0)
  })

  it('pins the dialog header above the scrolling field body', () => {
    expect(rule('.dialogFixed')).toContain('grid-template-rows: auto minmax(0, 1fr) auto')
    expect(rule('.dialogHeader')).toContain('padding: 20px 24px 0')
    expect(rule('.dialogHeader h2')).toContain('margin: 0')
    expect(at('css.dialogHeader')).toBeLessThan(at('css.dialogBody'))
  })

  it('offers Start and Complete side by side in the edit dialog header', () => {
    expect(rule('.dialogHeader')).toContain('justify-content: space-between')
    expect(rule('.headerActions')).toContain('display: flex')
    expect(at('css.headerActions')).toBeGreaterThan(at('css.dialogHeader'))
    expect(at('className={css.headerAction}')).toBeGreaterThan(at('css.headerActions'))
    expect(panel).toContain('editing !== null && <div className={css.headerActions}>')
    // Start stays available at every status, so a running or finished task can be
    // started again; Complete is only meaningful while the task is not Done yet.
    expect(panel).toContain('onClick={() => void saveAndLaunch(false)}')
    expect(panel).toContain('onClick={() => void saveAndLaunch(true)}')
    expect(panel).toContain("disabled={busy || !canSave}>{t('start')}")
    expect(panel).toContain("disabled={busy || !canSave || status === 'done'}>{t('finish')}")
    // Neither button runs the plain save on its own.
    expect(panel).not.toContain('onClick={() => void saveAndLaunch()}')
    // One composer error means one alert region: the banner yields to the dialog.
    expect(panel).toContain('{error && !composerOpen && <div className={css.error} role="alert">')
  })

  it('leaves subtasks out of the panel and the composer', () => {
    expect(panel).not.toMatch(/subtasksSection|subtaskDraft|css\.subtasks/)
    expect(css).not.toMatch(/\.subtask/)
  })
})
