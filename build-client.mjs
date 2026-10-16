// build-client.mjs — bundle src/client into the DSH client-loader handoff format.
// window.__ModuleLoader__.load({ id, chunk?, factory }). react + @deepseek-ai/* external.
// CSS modules compiled with lightningcss; `.module.css` -> hashed class map + <style> inject.
//
// Source-level `import()` is emitted as one package-local chunk per imported
// module, named `client.<name>.js`, and the loader's asynchronous operation
// (`require.async`) is what fetches it. That is the handoff contract the host
// preset implements for `packages/`; this repository's own build has to state it
// here: entry/chunk filenames, the per-chunk registration banner, and the
// rewrite from rolldown's generated `require` to `require.async`. A synchronous
// relative require would be a URL the loader's module table cannot answer, so the
// build fails rather than shipping one.
import { rolldown } from 'rolldown'
import { transform } from 'lightningcss'
import { readFile, readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
// Protocol identity: this must stay equal to package.json `name`. The Host
// cache-busts changed client artifacts with their content revision.
const HANDOFF_ID = '@guowenzhang/dsh-task-list'
const VIRT = '\0dsh-css:'
const SUFFIX = '.mjs'
/** The chunk filename shape the loader accepts for a package-local chunk. */
const CHUNK_NAME = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/

const INTRO = 'var module = { exports: {} }; var exports = module.exports;'
const OUTRO = 'return module.exports; } });'

/** The per-chunk registration banner: the entry carries no `chunk` field. */
function registration(chunk) {
  const marker = chunk.isEntry ? '' : `chunk: ${JSON.stringify(chunk.fileName)}, `
  return 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(HANDOFF_ID) + ', ' + marker + 'factory: (require) => {'
}

const cssModulePlugin = {
  name: 'dsh-css-modules-inline',
  resolveId(source, importer) {
    if (!source.endsWith('.module.css')) return null
    const abs = importer ? join(dirname(importer), source) : source
    return VIRT + abs + SUFFIX
  },
  async load(id) {
    if (!id.startsWith(VIRT)) return null
    const fileId = id.slice(VIRT.length, -SUFFIX.length)
    this.addWatchFile?.(fileId)
    const css = await readFile(fileId)
    const { code, exports: cssExports } = transform({
      filename: fileId,
      code: css,
      cssModules: { pattern: '[hash]_[local]' },
      minify: true,
    })
    const classMap = {}
    // lightningcss's `exports` object carries no stable key order, so an
    // unsorted walk emits the same entries in a different sequence on every
    // build: behaviourally identical, but a different byte-for-byte artifact
    // and a spurious diff in the committed lib/. Sort the local names.
    for (const local of Object.keys(cssExports ?? {}).sort()) {
      classMap[local] = cssExports[local].name
    }
    const cssText = String(code)
    const tagId = HANDOFF_ID + '/' + fileId.split(/[\\/]/).pop()
    return [
      'const css = ' + JSON.stringify(cssText) + ';',
      'const tagId = ' + JSON.stringify(tagId) + ';',
      "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
      "  const tag = document.createElement('style');",
      '  tag.dataset.pluginCss = tagId;',
      '  tag.textContent = css;',
      '  document.head.appendChild(tag);',
      '}',
      'export default ' + JSON.stringify(classMap) + ';',
    ].join('\n')
  },
}

/**
 * Turn rolldown's generated dynamic-import require into the loader's
 * asynchronous operation, and refuse a build that would ship a synchronous
 * relative require to a sibling chunk.
 */
const asyncChunkPlugin = {
  name: 'dsh-client-async-chunk-require',
  renderChunk(code, chunk, outputOptions) {
    if (outputOptions.format !== 'cjs') return null
    for (const dynamicImport of chunk.dynamicImports ?? []) {
      // Rolldown reports the emitted file name with or without the relative
      // prefix depending on the output shape; the loader requires `./` on a
      // package-local chunk request, so the specifier is rebuilt, never copied.
      const fileName = dynamicImport.startsWith('./') ? dynamicImport.slice(2) : dynamicImport
      if (!CHUNK_NAME.test(fileName)) continue
      const specifier = `./${fileName}`
      const quoted = new RegExp(
        'Promise\\.resolve\\(\\)\\.then\\(\\(\\)\\s*=>\\s*require\\(([\'"])\\./' + fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\1\\)\\)',
        'gu',
      )
      if (!quoted.test(code)) {
        throw new Error(`client bundle: dynamic chunk ${JSON.stringify(specifier)} has no generated import expression`)
      }
      code = code.replace(quoted, `require.async(${JSON.stringify(specifier)})`)
    }
    if (/(^|[^.\w])require\((['"])\.\/client\./.test(code)) {
      throw new Error(`client bundle: ${chunk.fileName} keeps a synchronous relative require to a sibling chunk`)
    }
    return code
  },
}

// Drop the previous build's chunks only: lib/index.mjs belongs to the node half.
for (const entry of await readdir(join(root, 'lib'))) {
  if (CHUNK_NAME.test(entry)) await rm(join(root, 'lib', entry), { force: true })
}

const bundle = await rolldown({
  input: join(root, 'src', 'client', 'index.tsx'),
  platform: 'browser',
  transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  external: source => /^react(?:\/|$)/.test(source) || source.startsWith('@deepseek-ai/') && source !== '@deepseek-ai/dsh-typert-protocol',
  plugins: [{ name: 'browser-remote-error', resolveId(source) {
    if (source === '@deepseek-ai/dsh-typert-protocol') return join(root, 'src/client/sync/remote-error.ts')
  } }, cssModulePlugin, asyncChunkPlugin],
})
const output = await bundle.write({
  format: 'cjs', dir: join(root, 'lib'), sourcemap: false, codeSplitting: true,
  entryFileNames: 'client.js', chunkFileNames: 'client.[name].js',
  banner: registration, footer: OUTRO, intro: INTRO,
})
const chunks = output.output.filter(item => item.type === 'chunk').map(item => item.fileName).sort()
console.log('lib/ written (ModuleLoader handoff bundle): ' + chunks.join(', '))
