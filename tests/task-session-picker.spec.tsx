// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { zh } from '../src/client/locales.ts'
import type { TaskKey } from '../src/client/locales.ts'
import { local } from './fixtures/sync.ts'

afterEach(() => { cleanup() })
const t = (key: TaskKey) => zh[key]
const workspaces = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }

interface Row { id: string; title: string; archived: boolean; subagent?: boolean; blank?: boolean }
/** The session picker as the two composer paths see it: create starts empty, edit echoes the link. */
function panel(sessions: { items: readonly Row[] }, task = local({ notes: 'Linked archived', sessionId: 's-old' })) {
  const props: any = {
    list: async () => ({ items: [task], total: 1, page: 1, pageSize: 20 }),
    update: async (request: any) => ({ ...task, ...request, version: 2 }),
    readAttachments: async () => [], listAgents: async () => [],
    workspaceSnapshot: () => workspaces, subscribeWorkspaces: () => () => {},
    sessionSnapshot: () => sessions, subscribeSessions: () => () => {},
    probeWorktree: async () => {}, listInitialEntries: async () => [], initializeGit: async () => {},
    start: async () => {},
    sync: { listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }) }, t,
  }
  return render(<TaskPanel {...props} />)
}
const sessionSelect = () => screen.getByLabelText('关联会话') as HTMLSelectElement
const optionLabels = (select: HTMLSelectElement) => Array.from(select.options).map(option => option.textContent ?? '')

// The catalog mirrors what the Host delivers: normal Sessions, archived Sessions,
// internal subagent runs (origin=subagent), and retired blank entries.
const catalog: { items: readonly Row[] } = { items: [
  { id: 's-live', title: '活跃会话', archived: false },
  { id: 's-old', title: '历史归档会话', archived: true },
  { id: 's-archived', title: '另一个归档会话', archived: true },
  { id: 's-subagent', title: '内部子代理会话', archived: false, subagent: true },
  { id: 's-blank', title: '未使用的新会话', archived: false, blank: true },
] }

describe('linked session picker', () => {
  it('echoes an archived historical link but never offers other archived sessions', async () => {
    panel(catalog)
    fireEvent.click(await screen.findByRole('button', { name: '编辑: Linked archived' }))
    const select = sessionSelect()
    // The stored link renders even though its session is archived.
    expect(select.value).toBe('s-old')
    expect(select.selectedOptions[0]?.textContent).toBe('历史归档会话 · 已归档')
    // Only the linked historical row carries the archived marker.
    expect(optionLabels(select)).toEqual(['不关联会话', '历史归档会话 · 已归档', '活跃会话'])
  })

  it('offers only the Sessions the sidebar would show for a new task', async () => {
    panel(catalog, local({ notes: 'Brand new' }))
    fireEvent.click(await screen.findByRole('button', { name: '新建任务' }))
    await screen.findByRole('dialog')
    const select = sessionSelect()
    expect(select.value).toBe('')
    // Subagent runs, blank placeholders, and archived Sessions are all absent.
    expect(optionLabels(select)).toEqual(['不关联会话', '活跃会话'])
  })

  it('echoes a linked subagent or blank Session without the archived marker', async () => {
    panel(catalog, local({ notes: 'Linked subagent', sessionId: 's-subagent' }))
    fireEvent.click(await screen.findByRole('button', { name: '编辑: Linked subagent' }))
    const select = sessionSelect()
    expect(select.value).toBe('s-subagent')
    expect(select.selectedOptions[0]?.textContent).toBe('内部子代理会话')
    expect(optionLabels(select)).toEqual(['不关联会话', '内部子代理会话', '活跃会话'])
  })

  it('keeps the deleted-session fallback for a stored id missing from the catalog', async () => {
    panel({ items: catalog.items.filter(row => row.id !== 's-old') })
    fireEvent.click(await screen.findByRole('button', { name: '编辑: Linked archived' }))
    const select = sessionSelect()
    expect(select.value).toBe('s-old')
    expect(select.selectedOptions[0]?.textContent).toBe('会话已不存在或暂不可用')
  })
})
