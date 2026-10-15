// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { TaskQuickAdd } from '../src/client/TaskQuickAdd.tsx'
import { closeQuickAdd, markQuickAddSaved } from '../src/client/quick-add.ts'
import { zh, type TaskKey } from '../src/client/locales.ts'
import { local } from './fixtures/sync.ts'

afterEach(() => { cleanup(); closeQuickAdd() })

const t = (key: TaskKey) => zh[key]
const workspaces = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }
const sessions = { items: [] }

/** The face both surfaces receive; the overlay must never load the page list. */
function face() {
  return {
    list: vi.fn(async () => ({ items: [local({ notes: 'Page 1' })], total: 1, page: 1, pageSize: 20 })),
    create: vi.fn(async (request: Record<string, unknown>) => ({ ...local(), ...request })),
    update: vi.fn(async (request: Record<string, unknown>) => ({ ...local(), ...request })),
    remove: vi.fn(async () => ({ deleted: true as const })),
    readAttachments: vi.fn(async () => []),
    listAgents: vi.fn(async () => []),
    workspaceSnapshot: () => workspaces,
    subscribeWorkspaces: () => () => {},
    sessionSnapshot: () => sessions,
    subscribeSessions: () => () => {},
    taskGraph: vi.fn(async () => ({ nodes: [], truncated: false })),
    taskOverview: vi.fn(async () => ({ counts: { todo: 0, in_progress: 0, approving: 0, done: 0 }, total: 0, blocked: 0, sessionIds: [] })),
    sessionExecution: () => null,
    sync: { listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }) },
    t,
  }
}

/** The composer, identified by its own title so an unrelated dialog never matches. */
const composer = () => screen.queryByRole('heading', { name: zh.add })

/** Press Ctrl+S as the browser would deliver it. */
const pressChord = async (target: Element | Document = document) => {
  await act(async () => { fireEvent.keyDown(target, { key: 's', ctrlKey: true }) })
}

describe('frame-wide New task dialog', () => {
  it('stays closed until Ctrl+S, then opens the composer without loading the page', async () => {
    const api = face()
    render(<TaskQuickAdd {...(api as never)} />)

    expect(composer()).toBeNull()
    await pressChord()
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(composer()).toBeTruthy()
    // The dialog is the current page's overlay, not a task page: no list read.
    expect(api.list).not.toHaveBeenCalled()
  })

  it('names the Ctrl+S shortcut in the New task footer', async () => {
    render(<TaskQuickAdd {...(face() as never)} />)
    await pressChord()
    await screen.findByRole('dialog')

    expect(screen.getByText(zh.shortcutHint)).toBeTruthy()
  })

  it('leaves the chord to a focused field', async () => {
    const api = face()
    render(<TaskQuickAdd {...(api as never)} />)
    const field = document.createElement('input')
    document.body.append(field)
    field.focus()

    await pressChord(field)

    expect(composer()).toBeNull()
    field.remove()
  })

  it('leaves the chord to an open dialog', async () => {
    const api = face()
    render(<TaskQuickAdd {...(api as never)} />)
    const modal = document.createElement('div')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    document.body.append(modal)

    await pressChord()

    expect(composer()).toBeNull()
    modal.remove()
  })

  it('closes on Cancel and reopens on the next chord', async () => {
    render(<TaskQuickAdd {...(face() as never)} />)
    await pressChord()
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: zh.cancel }))
    await waitFor(() => expect(composer()).toBeNull())

    await pressChord()
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('reloads a task page that is already on screen after the dialog saved', async () => {
    const api = face()
    render(<TaskPanel {...(api as never)} />)
    await screen.findByRole('button', { name: `${zh.edit}: Page 1` })
    const reads = api.list.mock.calls.length

    await act(async () => { markQuickAddSaved() })

    await waitFor(() => expect(api.list.mock.calls.length).toBe(reads + 1))
  })
})
