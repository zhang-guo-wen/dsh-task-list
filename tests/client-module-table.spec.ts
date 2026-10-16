import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

/** The one package-local chunk this build emits, stated once for both contracts. */
const CHUNK = 'client.StatisticsCalendar.js'

describe('built client module-table boundary', () => {
  it('loads without requesting the host-only typert protocol module', () => {
    let registered: any
    const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    runInNewContext(code, { window: { __ModuleLoader__: { load: (value: any) => { registered = value } } } })
    // `lazy`/`Suspense` are read at factory time by the report's own boundary;
    // the panel renders no lazy element until that boundary is on screen.
    const react = {
      createContext: () => ({}), forwardRef: (value: unknown) => value, memo: (value: unknown) => value,
      createElement: () => ({}), lazy: (value: unknown) => value, Suspense: (value: unknown) => value,
    }
    const modules: Record<string, unknown> = { react, 'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}) }, '@deepseek-ai/dsh-client-ui-primitives': {} }
    expect(() => registered.factory((name: string) => {
      if (!(name in modules)) throw new Error(`unexpected browser external ${name}`)
      return modules[name]
    })).not.toThrow()
  })

  it('reaches its package-local chunk only through the loader asynchronous operation', () => {
    const entry = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    const chunks = readdirSync(new URL('../lib', import.meta.url)).filter(name => /^client\..+\.js$/.test(name))
    // One heavy surface is split out because it shares no module with the panel;
    // every other shared module would have forced a second chunk whose consumers
    // could only reach it synchronously.
    expect(chunks).toEqual([CHUNK])
    // The loader resolves a package-local chunk request only when it carries the
    // relative prefix; a bare file name falls through to the module table.
    expect(entry).toContain(`require.async("./${CHUNK}")`)
    expect(entry).not.toMatch(/require\(["']\.\/client\./)
    const chunk = readFileSync(new URL(`../lib/${CHUNK}`, import.meta.url), 'utf8')
    // A chunk registers under the same package id with its own file name, which
    // is what lets the loader key it as `ownerId/fileName`.
    expect(chunk).toContain('window.__ModuleLoader__.load({')
    expect(chunk).toContain(`id: "@guowenzhang/dsh-task-list"`)
    expect(chunk).toContain(`chunk: "${CHUNK}"`)
    expect(chunk).not.toMatch(/require\(["']\.\/client\./)
  })
})
