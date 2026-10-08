import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { HostFixtureUnavailable, isHostSourceDir, resolveHostSourceDir } from './host-source.ts'

const SOURCE_SEGMENTS = ['packages', 'client', 'ui-primitives', 'src']
const REQUIRED_FILES = ['ImageLightbox.tsx', 'SegmentedTabs.tsx', 'Toast.tsx', 'Modal.tsx', 'Input.tsx', 'Checkbox.tsx', 'Menu.tsx', 'Button.tsx', 'Tooltip.tsx', 'FileTypeIcon.tsx', 'file-size.ts', join('icons', 'index.tsx')]

function writeSourceDir(dir: string) {
  for (const file of REQUIRED_FILES) {
    const path = join(dir, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '')
  }
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'dsh host source '))
}

describe('host source resolver', () => {
  it('resolves an explicit DSH_HOST_SOURCE repository root to the ui-primitives src directory', () => {
    const root = makeTempDir()
    try {
      const src = join(root, ...SOURCE_SEGMENTS)
      writeSourceDir(src)
      const result = resolveHostSourceDir({ DSH_HOST_SOURCE: root })
      expect(result).toBe(resolve(src))
      expect(isHostSourceDir(result)).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts a DSH_HOST_SOURCE that already points at the src directory', () => {
    const root = makeTempDir()
    try {
      const src = join(root, 'src with spaces')
      writeSourceDir(src)
      expect(resolveHostSourceDir({ DSH_HOST_SOURCE: src })).toBe(resolve(src))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('normalizes a quoted Windows-style override with spaces and backslashes', () => {
    const root = makeTempDir()
    try {
      const src = join(root, ...SOURCE_SEGMENTS)
      writeSourceDir(src)
      const winPath = `"${root.split(sep).join('\\')}"`
      expect(resolveHostSourceDir({ DSH_HOST_SOURCE: winPath })).toBe(resolve(src))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('auto-discovers a sibling deepseek-harness checkout from the existing layout', () => {
    const root = makeTempDir()
    try {
      const src = join(root, 'deepseek-harness', ...SOURCE_SEGMENTS)
      writeSourceDir(src)
      const fromDir = join(root, 'project', 'dsh-task-list', 'tests')
      expect(resolveHostSourceDir({}, fromDir)).toBe(resolve(src))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('throws HostFixtureUnavailable for an override that lacks the host source files', () => {
    const root = makeTempDir()
    try {
      mkdirSync(root, { recursive: true })
      expect(() => resolveHostSourceDir({ DSH_HOST_SOURCE: root })).toThrow(HostFixtureUnavailable)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('throws HostFixtureUnavailable with actionable guidance when no source is available', () => {
    const root = makeTempDir()
    try {
      const fromDir = join(root, 'project', 'tests')
      expect(() => resolveHostSourceDir({}, fromDir)).toThrow(/DSH_HOST_SOURCE/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
