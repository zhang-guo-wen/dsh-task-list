import { rolldown } from 'rolldown'
import { transform } from 'lightningcss'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { resolveHostSource } from './host-source.ts'
const root = resolve(import.meta.dirname, '..')
const host = resolveHostSource()
const out = resolve(root, '.browser-test')

/**
 * The Host's own theme, declaration for declaration. A hand-picked subset drifts
 * from the Host, and a token the Host never defines then silently keeps the light
 * fallback written beside it — which is how the report's period switch came out as
 * a white box with white labels on the dark theme. `body` carries the light tokens
 * and `body[data-ds-dark-theme]` the dark ones, so the fixture switches themes the
 * way the Host does.
 */
const THEME_SHEETS = ['design-platform.css', 'base.css', 'focus.css', 'gradient-shadow-text.css', 'corner-shape.css']
/** Selectors whose custom properties the fixture reproduces; the rest of the Host theme is app chrome. */
const THEME_SELECTORS = new Set([':root', 'body', 'body[data-ds-dark-theme]', 'body, body *'])
async function themeTokens() {
  const styles = resolve(host.sourceDir, '../../ui-theme/src/styles')
  const blocks = []
  for (const sheet of THEME_SHEETS) {
    // Comments precede several blocks, so drop them before reading selectors.
    const source = (await readFile(resolve(styles, sheet), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
    for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const name = selector.trim().replace(/\s+/g, ' ')
      if (!THEME_SELECTORS.has(name)) continue
      const declarations = body.split(';').map(line => line.trim()).filter(line => line.startsWith('--dsw-'))
      if (declarations.length > 0) blocks.push(`${name} { ${declarations.join('; ')}; }`)
    }
  }
  if (blocks.length === 0) throw new Error(`no theme tokens found under ${styles}`)
  return blocks.join('\n')
}
const theme = await themeTokens()

await mkdir(out, { recursive: true })
const bundle = await rolldown({
  input: resolve(root, 'tests/browser-fixture.tsx'), platform: 'browser',
  transform: { define: { 'process.env.NODE_ENV': '"development"' } },
  plugins: [{ name: 'host-primitives', resolveId(source) {
    if (source in host.aliases) return host.aliases[source]
    if (source === 'react') return resolve(root, 'node_modules/react/index.js')
    if (source === 'react/jsx-runtime') return resolve(root, 'node_modules/react/jsx-runtime.js')
    if (source === 'react-dom') return resolve(root, 'node_modules/react-dom/index.js')
    if (source === 'react-dom/client') return resolve(root, 'node_modules/react-dom/client.js')
  } }, { name: 'css', resolveId(source, importer) { if (source.endsWith('.module.css')) return '\0css:' + resolve(dirname(importer), source) + '.mjs' },
    async load(id) {
      if (!id.startsWith('\0css:')) return
      const path = id.slice(5, -4)
      const { code, exports } = transform({ filename: path, code: await readFile(path), cssModules: true })
      const map = Object.fromEntries(Object.entries(exports).map(([key, value]) => [key, value.name]))
      return `const tag = document.createElement('style'); tag.textContent = ${JSON.stringify(String(code))}; document.head.appendChild(tag); export default ${JSON.stringify(map)}`
    },
  }],
})
await bundle.write({ format: 'iife', file: resolve(out, 'fixture.js') })
await writeFile(resolve(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Task rich text regression fixture</title>
<style>${theme}
body { margin:0; } #root { height:100vh; } #settings-root { width:564px; max-width:100%; box-sizing:border-box; margin:0 auto; padding:0 24px 24px; }</style><div id="root"></div><div id="settings-root"></div><script src="fixture.js"></script>`)
console.log(out)
