import { defineConfig } from 'vitest/config'
import { resolveHostSource } from './tests/host-source.ts'

const host = resolveHostSource()

// The plugin repository is a sibling of the deepseek-harness checkout, not a
// workspace inside it, so a bare `vitest run` would otherwise inherit the
// harness root config and find none of these specs. This config pins the
// project to this repository's own tests and to Node (the host-side modules
// under test read real files). tests/host-source.ts resolves the real host
// ui-primitives sources (DSH_HOST_SOURCE override or sibling-layout
// auto-discovery) and aliases them here so the host components are reused,
// never mocked.
export default defineConfig({
  resolve: { alias: host.aliases, dedupe: ['react', 'react-dom'] },
  test: {
    root: import.meta.dirname,
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
  },
})
