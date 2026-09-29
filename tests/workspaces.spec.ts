import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKSPACE_MARKER, pickDefaultWorkspace } from '../src/client/workspaces.ts'

const other = { workspaceId: 'ws-other', title: 'Other' }
const marker = { workspaceId: 'ws-marker', title: DEFAULT_WORKSPACE_MARKER }
const localized = { workspaceId: 'ws-cn', title: '默认工作区' }

describe('default workspace picker', () => {
  it('prefers the marker title whatever its position', () => {
    expect(pickDefaultWorkspace([other, marker, localized], '默认工作区')).toBe(marker)
  })

  it('accepts the localized default name for a legacy registry', () => {
    expect(pickDefaultWorkspace([other, localized], '默认工作区')).toBe(localized)
  })

  it('falls back to the first registered workspace', () => {
    expect(pickDefaultWorkspace([other, localized], 'Default workspace')).toBe(other)
  })

  it('returns undefined when no workspace is registered', () => {
    expect(pickDefaultWorkspace([], '默认工作区')).toBeUndefined()
    expect(pickDefaultWorkspace([{ workspaceId: 'ws-x', title: undefined as unknown as string }], '默认工作区'))
      .toEqual({ workspaceId: 'ws-x', title: undefined })
  })
})
