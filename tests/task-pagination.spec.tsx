// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import { local } from './fixtures/sync.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]
const workspaces = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }
const sessions = { items: [] }

function open() {
  const list = vi.fn(async (request: any) => ({
    items: [local({ id: `task-${request.page}`, notes: `Page ${request.page}` })],
    total: 60, page: request.page, pageSize: request.pageSize,
  }))
  const props: any = {
    list, readAttachments: async () => [], listAgents: async () => [],
    workspaceSnapshot: () => workspaces, subscribeWorkspaces: () => () => {},
    sessionSnapshot: () => sessions, subscribeSessions: () => () => {},
    sync: { listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }) }, t,
  }
  return { ...render(<TaskPanel {...props} />), list }
}

async function body() {
  const row = await screen.findByRole('button', { name: '编辑: Page 1' })
  return row.closest('ul')!.parentElement!
}

describe('task list paging layout', () => {
  it('keeps the paging controls outside the scrolling body and starts a new page at the top', async () => {
    const { list } = open()
    const scroll = await body()
    const next = screen.getByRole('button', { name: zh.nextPage })
    expect(scroll.contains(next)).toBe(false)
    expect(scroll.parentElement).toBe(next.closest('div')!.parentElement!.parentElement)
    scroll.scrollTop = 300
    fireEvent.click(next)
    await screen.findByRole('button', { name: '编辑: Page 2' })
    expect(scroll.scrollTop).toBe(0)
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    scroll.scrollTop = 200
    fireEvent.click(screen.getByRole('button', { name: zh.prevPage }))
    await screen.findByRole('button', { name: '编辑: Page 1' })
    expect(scroll.scrollTop).toBe(0)
  })

  it('resets the body for a new page size or filter but preserves it on refresh', async () => {
    const { list } = open()
    const scroll = await body()
    await waitFor(() => expect((screen.getByRole('button', { name: zh.refresh }) as HTMLButtonElement).disabled).toBe(false))
    scroll.scrollTop = 120
    const before = list.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: zh.refresh }))
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(before))
    expect(scroll.scrollTop).toBe(120)
    fireEvent.change(screen.getByLabelText(zh.perPage), { target: { value: '50' } })
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 })))
    expect(scroll.scrollTop).toBe(0)
    scroll.scrollTop = 80
    fireEvent.click(screen.getByRole('button', { name: zh.todo, exact: true }))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'todo' })))
    expect(scroll.scrollTop).toBe(0)
  })
})
