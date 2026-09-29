import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { TaskRecord } from '../src/types.ts'
import { apply } from '../src/client/index.tsx'
import { TYPERT_REMOTE } from '../src/remote.ts'

describe('client contribution', () => {
  it('mounts the task panel and its matching sidebar entry', async () => {
    const cleanups: Array<() => void> = []
    const register = vi.fn(() => vi.fn())
    const offRemote = vi.fn()
    const offLocale = vi.fn()
    const ctx = {
      remote: { $mount: vi.fn(async () => offRemote) },
      locale: { register: vi.fn(() => offLocale), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { cleanups.push(fn()) },
      slots: { inject: (_name: string, fn: () => void) => fn(), register },
    }
    await apply(ctx as unknown as Context)
    expect(ctx.remote.$mount).toHaveBeenCalledWith(TYPERT_REMOTE)
    expect(register.mock.calls.map(call => call[0])).toEqual([
      expect.objectContaining({ name: 'main', key: 'task-list' }),
      expect.objectContaining({ name: 'sidebar.panellist', id: 'task-list' }),
    ])
    expect(TYPERT_REMOTE.descriptors.map(row => row.method)).toEqual(['listTasks', 'createTask', 'updateTask', 'deleteTask'])
    cleanups.forEach(fn => fn())
    expect(offRemote).toHaveBeenCalledOnce()
    expect(offLocale).toHaveBeenCalledOnce()
  })
})

describe('task launch', () => {
  it('passes the selected top-level entries to Worktree initialization', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/init-files')
      ? { entries: [{ name: 'src', kind: 'directory' }, { name: 'notes.txt', kind: 'file' }] }
      : { initialized: true } }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const ctx = {
        remote: { $mount: vi.fn(async () => vi.fn()) },
        locale: { register: () => vi.fn(), bind: () => (key: string) => key },
        effect: (fn: () => (() => void)) => { fn() },
        slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
      }
      await apply(ctx as unknown as Context)
      const panel = ctx.slots.register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()
      expect(await panel.listInitialEntries('workspace-1')).toEqual([
        { name: 'src', kind: 'directory' }, { name: 'notes.txt', kind: 'file' },
      ])
      await panel.initializeGit('workspace-1', ['src'])
      expect(fetchMock).toHaveBeenNthCalledWith(1, '/worktree/api/init-files', expect.objectContaining({
        body: JSON.stringify({ workspaceId: 'workspace-1' }),
      }))
      expect(fetchMock).toHaveBeenNthCalledWith(2, '/worktree/api/init', expect.objectContaining({
        body: JSON.stringify({ workspaceId: 'workspace-1', selectedEntries: ['src'] }),
      }))
    } finally { globalThis.fetch = originalFetch }
  })

  it('creates a session in the linked workspace and opens an unsent title-and-description draft', async () => {
    const steps: string[] = []
    const task = { id: 'task-1', version: 1, status: 'todo', title: 'Build feature', notes: 'Include tests', workspaceId: 'workspace-1', sendImmediately: false, useWorktree: false, agent: null } as TaskRecord
    const draft = vi.fn((text: string) => { steps.push(`draft:${text}`) })
    const openSession = vi.fn((_id: string) => { steps.push('open') })
    const updateTask = vi.fn(async () => {
      steps.push('update')
      return { ok: true as const, value: { ...task, status: 'in_progress', version: 2 } }
    })
    const create = vi.fn(async () => {
      steps.push('create')
      return 'session-1'
    })
    const scope = {}
    const register = vi.fn(() => vi.fn())
    const ctx = {
      remote: { $mount: vi.fn(async () => vi.fn()) },
      get: vi.fn(() => ({ updateTask })),
      locale: { register: vi.fn(() => vi.fn()), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register },
      workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'workspace-1', title: 'Project' }] }) } },
      sessions: {
        create,
        using: vi.fn(async (_id: string, _options: unknown, operation: () => Promise<void>) => { await operation() }),
        scope: vi.fn(() => scope),
      },
      conversation: { input: { for: vi.fn(() => ({ setDraft: draft })) } },
      uiWorkspace: { openSession },
    }
    await apply(ctx as unknown as Context)
    const panel = register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()

    await panel.start(task)
    expect(create).toHaveBeenCalledWith({ workspaceId: 'workspace-1' })
    expect(ctx.sessions.using).toHaveBeenCalledWith('session-1', { source: 'controllerOperation' }, expect.any(Function))
    expect(ctx.conversation.input.for).toHaveBeenCalledWith(scope)
    expect(draft).toHaveBeenCalledWith('Build feature\n\nInclude tests')
    expect(updateTask).toHaveBeenCalledWith({ id: 'task-1', version: 1, status: 'in_progress', sessionId: 'session-1' })
    expect(openSession).toHaveBeenCalledWith('session-1')
    expect(steps).toEqual(['create', 'draft:Build feature\n\nInclude tests', 'update', 'open'])

    // An explicitly linked but deleted workspace is still refused here; a task
    // with no workspace at all launches in the default one (tested below).
    await expect(panel.start({ ...task, workspaceId: 'missing-workspace' })).rejects.toThrow('workspace is unavailable')
    expect(create).toHaveBeenCalledTimes(1)

    create.mockRejectedValueOnce(new Error('session unavailable'))
    await expect(panel.start(task)).rejects.toThrow('session unavailable')
    expect(updateTask).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledTimes(1)

    updateTask.mockRejectedValueOnce(new Error('status unavailable'))
    await expect(panel.start(task)).rejects.toThrow('status unavailable')
    expect(openSession).toHaveBeenCalledTimes(1)
  })

  it('launches a task without a workspace in the default workspace', async () => {
    const updateTask = vi.fn(async () => ({ ok: true as const, value: {} }))
    const create = vi.fn(async () => 'session-9')
    const openSession = vi.fn()
    const register = vi.fn(() => vi.fn())
    const ctx = {
      remote: { $mount: vi.fn(async () => vi.fn()) },
      get: () => ({ updateTask }),
      locale: { register: vi.fn(() => vi.fn()), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register },
      workspaces: { list: { getSnapshot: () => ({ items: [
        { workspaceId: 'ws-other', title: 'Other', path: '/other' },
        { workspaceId: 'ws-default', title: 'default-workspace', path: '/default' },
      ] }) } },
      sessions: {
        create,
        using: vi.fn(async (_id: string, _options: unknown, operation: () => Promise<void>) => { await operation() }),
        scope: vi.fn(() => ({})),
      },
      conversation: { input: { for: vi.fn(() => ({ setDraft: vi.fn() })) } },
      uiWorkspace: { openSession },
    }
    await apply(ctx as unknown as Context)
    const panel = register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()
    await panel.start({ id: 'task-6', version: 1, status: 'todo', title: 'Later', notes: '', workspaceId: null, agent: null, sendImmediately: false, useWorktree: false } as TaskRecord)
    expect(create).toHaveBeenCalledWith({ workspaceId: 'ws-default' })
    expect(updateTask).toHaveBeenCalledWith({ id: 'task-6', version: 1, status: 'in_progress', sessionId: 'session-9' })
    expect(openSession).toHaveBeenCalledWith('session-9')
  })

  it('selects the agent and submits immediately when enabled', async () => {
    const steps: string[] = []
    const select = vi.fn(async () => { steps.push('agent'); return { ok: true as const, value: 'coder' } })
    const submit = vi.fn(() => { steps.push('submit') })
    const updateTask = vi.fn(async () => { steps.push('update'); return { ok: true as const, value: {} } })
    const ctx = {
      remote: { $mount: vi.fn(async () => vi.fn()), agentPresets: { select } },
      get: () => ({ updateTask }),
      locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
      workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws', path: '/repo' }] }) } },
      sessions: { create: vi.fn(async () => 'session-2'), using: async (_id: string, _options: unknown, fn: () => Promise<void>) => fn(), scope: () => ({}) },
      conversation: { input: { for: () => ({ setDraft: () => { steps.push('draft') }, submit }) } },
      uiWorkspace: { openSession: () => { steps.push('open') } },
    }
    await apply(ctx as unknown as Context)
    const panel = ctx.slots.register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()
    await panel.start({ id: 'task-2', version: 1, status: 'todo', title: 'Run', notes: '', workspaceId: 'ws', agent: 'coder', sendImmediately: true, useWorktree: false } as TaskRecord)
    expect(select).toHaveBeenCalledWith('session-2', 'coder')
    expect(submit).toHaveBeenCalledWith('queue', 'click')
    expect(steps).toEqual(['agent', 'draft', 'update', 'open', 'submit'])
  })

  it('starts in a worktree and binds the returned session', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/list')
      ? { worktrees: [{ path: '/repo', main: true }] }
      : { sessionId: 'worktree-session', workspaceId: 'new-ws' } }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const updateTask = vi.fn(async () => ({ ok: true as const, value: {} }))
      const refresh = vi.fn(async () => undefined)
      const create = vi.fn()
      const ctx = {
        remote: { $mount: vi.fn(async () => vi.fn()) }, get: () => ({ updateTask }),
        locale: { register: () => vi.fn(), bind: () => (key: string) => key },
        effect: (fn: () => (() => void)) => { fn() },
        slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
        workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws', path: '/repo' }] }) } },
        sessions: { create, refresh, list: { getSnapshot: () => ({ byId: { 'worktree-session': {} } }) }, using: async (_id: string, _options: unknown, fn: () => Promise<void>) => fn(), scope: () => ({}) },
        conversation: { input: { for: () => ({ setDraft: vi.fn(), submit: vi.fn() }) } },
        uiWorkspace: { openSession: vi.fn() },
      }
      await apply(ctx as unknown as Context)
      const panel = ctx.slots.register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()
      await panel.start({ id: 'task-3', version: 1, status: 'todo', title: 'Work', notes: '', workspaceId: 'ws', agent: 'coder', sendImmediately: false, useWorktree: true } as TaskRecord)
      expect(fetchMock).toHaveBeenNthCalledWith(1, '/worktree/api/list', expect.objectContaining({ body: JSON.stringify({ cwd: '/repo' }) }))
      expect(fetchMock).toHaveBeenNthCalledWith(2, '/worktree/api/start', expect.objectContaining({ body: JSON.stringify({ cwd: '/repo', agentPreset: 'coder' }) }))
      expect(create).not.toHaveBeenCalled()
      expect(refresh).toHaveBeenCalledOnce()
      expect(updateTask).toHaveBeenCalledWith({ id: 'task-3', version: 1, status: 'in_progress', sessionId: 'worktree-session' })
      expect(ctx.uiWorkspace.openSession).toHaveBeenCalledWith('worktree-session')
    } finally { globalThis.fetch = originalFetch }
  })

  it('refuses a non-Git workspace before asking dsh-worktree to create anything', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: { message: '[list] fatal: not a git repository' } }) }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const updateTask = vi.fn()
      const create = vi.fn()
      const ctx = {
        remote: { $mount: vi.fn(async () => vi.fn()) }, get: () => ({ updateTask }),
        locale: { register: () => vi.fn(), bind: () => (key: string) => key },
        effect: (fn: () => (() => void)) => { fn() },
        slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
        workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws', title: 'DeepSeek', path: '/not-a-repo' }] }) } },
        sessions: { create },
      }
      await apply(ctx as unknown as Context)
      const panel = ctx.slots.register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()
      await expect(panel.start({ id: 'task-4', version: 1, status: 'todo', title: 'Work', notes: '', workspaceId: 'ws', agent: null, sendImmediately: false, useWorktree: true } as TaskRecord))
        .rejects.toThrow('worktreeRequiresGit: DeepSeek')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(create).not.toHaveBeenCalled()
      expect(updateTask).not.toHaveBeenCalled()
    } finally { globalThis.fetch = originalFetch }
  })

  it.each([
    { message: '[list] Git was not found', code: 'git_not_found' },
    { message: '[list] spawn git ENOENT' },
  ])('explains when Git is unavailable instead of offering repository initialization: $message', async gitError => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({
      ok: false, status: 500, json: async () => ({ error: gitError }),
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const updateTask = vi.fn()
      const ctx = {
        remote: { $mount: vi.fn(async () => vi.fn()) }, get: () => ({ updateTask }),
        locale: { register: () => vi.fn(), bind: () => (key: string) => key },
        effect: (fn: () => (() => void)) => { fn() },
        slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
        workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws', title: 'DeepSeek', path: '/repo' }] }) } },
        sessions: { create: vi.fn() },
      }
      await apply(ctx as unknown as Context)
      const panel = ctx.slots.register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()
      await expect(panel.start({ id: 'task-5', version: 1, status: 'todo', title: 'Work', notes: '', workspaceId: 'ws', agent: null, sendImmediately: false, useWorktree: true } as TaskRecord))
        .rejects.toThrow('gitUnavailable')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(updateTask).not.toHaveBeenCalled()
    } finally { globalThis.fetch = originalFetch }
  })
})
