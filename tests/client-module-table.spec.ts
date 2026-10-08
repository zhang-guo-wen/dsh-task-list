import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

describe('built client module-table boundary', () => {
  it('loads without requesting the host-only typert protocol module', () => {
    let registered: any
    const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    runInNewContext(code, { window: { __ModuleLoader__: { load: (value: any) => { registered = value } } } })
    const react = { createContext: () => ({}), forwardRef: (value: unknown) => value, memo: (value: unknown) => value, createElement: () => ({}) }
    const modules: Record<string, unknown> = { react, 'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}) }, '@deepseek-ai/dsh-client-ui-primitives': {} }
    expect(() => registered.factory((name: string) => {
      if (!(name in modules)) throw new Error(`unexpected browser external ${name}`)
      return modules[name]
    })).not.toThrow()
  })
})
