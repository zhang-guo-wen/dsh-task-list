import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const component = readFileSync(new URL('../src/client/MoreTasks.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/client/MoreTasks.module.css', import.meta.url), 'utf8')

/**
 * The work-item table freezes the title on the left and the row action on the
 * right, so the middle columns can scroll sideways without losing either end.
 * jsdom cannot compute sticky layout, so the contract is asserted on the source.
 */
describe('more tasks frozen columns', () => {
  it('pins the title left and the action right in style', () => {
    // Chromium ignores sticky table cells under border-collapse: collapse.
    expect(css).toMatch(/\.table\s*\{[^}]*border-collapse:\s*separate;/u)
    expect(css).toMatch(/\.frozenLeft\s*\{[^}]*position:\s*sticky;[^}]*left:\s*0;/u)
    expect(css).toMatch(/\.frozenRight\s*\{[^}]*position:\s*sticky;[^}]*right:\s*0;/u)
    // Opaque backgrounds, or the columns scrolling underneath would show through.
    expect(css).toMatch(/\.frozenLeft\s*\{[^}]*background:/u)
    expect(css).toMatch(/\.frozenRight\s*\{[^}]*background:/u)
    // The header corners must sit above both the scrolling headers and the frozen body cells.
    expect(css).toMatch(/\.table thead \.frozenLeft,\s*\.table thead \.frozenRight\s*\{\s*z-index:\s*3;/u)
  })

  it('applies both classes to the title column and the action column', () => {
    expect(component).toContain('isSubject(column) ? `${css.subject} ${css.frozenLeft}` : undefined')
    expect(component).toContain('<th scope="col" className={css.frozenRight}>')
    expect(component).toContain('className={`${css.rowActions} ${css.frozenRight}`}')
    // The title is matched by its native field, not by column position.
    expect(component).toContain("column.source.kind === 'native' && column.source.field === 'subject'")
  })

  it('keeps the column-settings entry in the table head, not the toolbar', () => {
    expect(component).toContain('<span className={css.actionsHeader}>')
    // One entry point in the head, plus the drawer's own label; the title row has none.
    expect(component.match(/moreTasksColumnsTitle/g)).toHaveLength(4)
    const controls = component.slice(component.indexOf('css.controls'), component.indexOf('css.filters'))
    expect(controls).not.toContain("t('moreTasksColumnsTitle')")
  })
})
