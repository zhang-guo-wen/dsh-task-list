// Test-only resolution of the real host ui-primitives sources. The published
// @deepseek-ai/dsh-client-ui-primitives npm entry bundles the host's whole
// dependency graph, which standalone plugin tests do not have; this module
// instead locates the host checkout's source files so tests exercise the real
// components rather than mocks.
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_SEGMENTS = ['packages', 'client', 'ui-primitives', 'src']

// Virtual per-component specifiers the bridge re-exports, mapped to their
// source-relative file inside the resolved ui-primitives src directory. Both
// the Vitest config and the browser fixture builder translate these to real
// absolute paths, so no machine-specific path is hardcoded in the bridge.
const SPECIFIERS: Record<string, string> = {
  '@dsh-host-primitives/Button': 'Button.tsx',
  '@dsh-host-primitives/Modal': 'Modal.tsx',
  '@dsh-host-primitives/Input': 'Input.tsx',
  '@dsh-host-primitives/Checkbox': 'Checkbox.tsx',
  '@dsh-host-primitives/Switch': 'Switch.tsx',
  '@dsh-host-primitives/Menu': 'Menu.tsx',
  '@dsh-host-primitives/Toast': 'Toast.tsx',
  '@dsh-host-primitives/SegmentedTabs': 'SegmentedTabs.tsx',
  '@dsh-host-primitives/SegmentedControl': 'SegmentedControl.tsx',
  '@dsh-host-primitives/ImageLightbox': 'ImageLightbox.tsx',
  '@dsh-host-primitives/Tooltip': 'Tooltip.tsx',
  '@dsh-host-primitives/FileTypeIcon': 'FileTypeIcon.tsx',
  '@dsh-host-primitives/file-size': 'file-size.ts',
  '@dsh-host-primitives/icons': 'icons/index.tsx',
}

const REQUIRED_FILES = Object.values(SPECIFIERS)

/** Raised when the host ui-primitives source cannot be located or validated. */
export class HostFixtureUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HostFixtureUnavailable'
  }
}

/** Whether a directory contains every host source file the bridge re-exports. */
export function isHostSourceDir(dir: string): boolean {
  return REQUIRED_FILES.every(file => existsSync(resolve(dir, file)))
}

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

/**
 * Resolve the absolute path to the host ui-primitives `src` directory.
 * `DSH_HOST_SOURCE` wins and may name either the deepseek-harness repository
 * root (the `packages/client/ui-primitives/src` directory is then derived) or
 * the `src` directory itself. Without it, a sibling `deepseek-harness` checkout
 * is discovered by walking up from `fromDir`, mirroring the original layout
 * where the plugin sat beside the harness checkout.
 */
export function resolveHostSourceDir(
  env: { DSH_HOST_SOURCE?: string | undefined } = process.env,
  fromDir?: string,
): string {
  const override = env.DSH_HOST_SOURCE
  if (override !== undefined && override.trim() !== '') {
    const given = resolve(stripOuterQuotes(override))
    const asRepoRoot = resolve(given, ...SOURCE_SEGMENTS)
    if (isHostSourceDir(asRepoRoot)) return asRepoRoot
    if (isHostSourceDir(given)) return given
    throw new HostFixtureUnavailable(
      `DSH_HOST_SOURCE does not resolve to the host ui-primitives source. ` +
        `Set it to the deepseek-harness repository root (a directory containing ` +
        `${SOURCE_SEGMENTS.join('/')}) or directly to that src directory. ` +
        `Checked: "${asRepoRoot}" and "${given}".`,
    )
  }
  const start = fromDir !== undefined ? resolve(fromDir) : dirname(fileURLToPath(import.meta.url))
  let dir = start
  for (;;) {
    const candidate = resolve(dir, 'deepseek-harness', ...SOURCE_SEGMENTS)
    if (isHostSourceDir(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new HostFixtureUnavailable(
    `Host ui-primitives source not found. Set DSH_HOST_SOURCE to the ` +
      `deepseek-harness repository root (a directory containing ${SOURCE_SEGMENTS.join('/')}) ` +
      `or directly to that src directory, so tests reuse the real host components ` +
      `instead of mocks.`,
  )
}

/** Source directory plus the alias map consumed by Vitest and the browser fixture builder. */
export function resolveHostSource(
  env: { DSH_HOST_SOURCE?: string | undefined } = process.env,
  fromDir?: string,
): { sourceDir: string; bridge: string; aliases: Record<string, string> } {
  const sourceDir = resolveHostSourceDir(env, fromDir)
  const bridge = resolve(dirname(fileURLToPath(import.meta.url)), 'host-primitives.ts')
  const aliases: Record<string, string> = { '@deepseek-ai/dsh-client-ui-primitives': bridge }
  for (const [specifier, file] of Object.entries(SPECIFIERS)) {
    aliases[specifier] = resolve(sourceDir, file)
  }
  return { sourceDir, bridge, aliases }
}
