import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveHostSourceDir } from './host-source.ts'

// Theme adaptation is a contract with the Host rather than a rendering test. A
// custom property the Host never defines fails quietly in the browser: the
// declaration is dropped — so the text keeps whatever colour its surface has — or
// the light fallback written beside it wins on a dark surface. That is how the
// report's 天/月/年 switch became a white box whose labels were white too.
const hostStyles = resolve(resolveHostSourceDir(), '../../ui-theme/src/styles')

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.isFile() && entry.name.endsWith('.css') ? [path] : []
  })
}

function definitions(files: readonly string[]): string[] {
  return files.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/(--dsw-[a-z0-9-]+)\s*:/g)].map(match => match[1]!))
}

function references(files: readonly string[]): string[] {
  return files.flatMap(file => readFileSync(file, 'utf8').match(/--dsw-[a-z0-9-]+/g) ?? [])
}

const hostTokens = new Set(definitions(cssFiles(hostStyles)))
const reportCss = [resolve(import.meta.dirname, '../src/client/StatisticsCalendar.module.css')]
const reportSource = readFileSync(resolve(import.meta.dirname, '../src/client/StatisticsCalendar.tsx'), 'utf8')

describe('theme adaptation', () => {
  it('reads only custom properties the Host theme defines', () => {
    expect(hostTokens.size).toBeGreaterThan(100)
    // The token that started this: the Host has no --dsw-alias-bg-elevated, so the
    // #fafbfc fallback beside it painted the switch track on the dark theme.
    expect(hostTokens.has('--dsw-alias-bg-elevated')).toBe(false)
    const unknown = [...new Set(references(cssFiles(resolve(import.meta.dirname, '../src'))))]
      .filter(token => !hostTokens.has(token))
    expect(unknown).toEqual([])
  })

  it('leaves the report period switch to the Host segmented control', () => {
    expect(reportSource).toContain("import { Button, SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives'")
    expect(reportSource).toContain("label={t('statisticsPeriod')}")
    // The hand-rolled group painted its own light track and its own pressed buttons.
    expect(reportSource).not.toContain("role=\"group\" aria-label={t('statisticsPeriod')}")
    expect(reportSource).not.toMatch(/aria-pressed=\{period === item\}/)
    // The class is placement only: track, indicator and radii belong to the control.
    const rule = /\.periods\s*\{([^}]*)\}/.exec(readFileSync(reportCss[0]!, 'utf8'))?.[1] ?? ''
    expect(rule.replace(/\s+/g, ' ').trim()).toBe('flex: none;')
  })
})
