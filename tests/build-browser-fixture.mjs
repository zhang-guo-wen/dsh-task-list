import { rolldown } from 'rolldown'
import { transform } from 'lightningcss'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const out = resolve(root, '.browser-test')
await mkdir(out, { recursive: true })
const bundle = await rolldown({
  input: resolve(root, 'tests/browser-fixture.tsx'), platform: 'browser',
  transform: { define: { 'process.env.NODE_ENV': '"development"' } },
  plugins: [{ name: 'host-primitives', resolveId(source) {
    if (source === '@deepseek-ai/dsh-client-ui-primitives') return resolve(root, 'tests/host-primitives.ts')
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
await writeFile(resolve(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Task rich text regression fixture</title>
<style>:root { --dsw-alias-label-primary:#15171c; --dsw-alias-bg-base:#fff; --dsw-alias-border-l3:#ccc; --dsw-alias-label-tertiary:#888; --dsw-alias-state-business-primary:#326dca; --dsw-alias-label-error:#a32929; --dsw-alias-interactive-bg-hover:#eee; --dsw-static-neutral-bluish-300:#a9b3c3; --dsw-static-deepseek-450:#5689dc; --dsw-radius-md:12px; --dsw-radius-sm:8px; --dsw-alias-label-secondary:#69717c; } body { margin:0; } #root { height:100vh; }</style><div id="root"></div><script src="fixture.js"></script>`)
console.log(out)
