import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { ListTasksRequest, TaskPage, TaskRecord } from '../src/types.ts'
import { syncError, syncRemoteError } from '../src/sync/errors.ts'
import type { SyncFace } from '../src/client/sync/face.ts'
import { apply } from '../src/client/index.tsx'
import { TYPERT_REMOTE } from '../src/remote.ts'
import { captureDraft } from '../src/client/capture.ts'
import type { TaskCaptureFace } from '../src/client/TaskCapture.tsx'
import type { DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { TaskStore } from '../src/store.ts'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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
      expect.objectContaining({ name: 'conversation.input.right', id: 'task-capture' }),
    ])
    expect(TYPERT_REMOTE.descriptors.map(row => row.method)).toEqual([
      'capabilities', 'listTasks', 'createTask', 'updateTask', 'deleteTask', 'readTaskAttachments', 'createSubtask', 'updateSubtask', 'deleteSubtask', 'calculateStatistics',
      'startStatistics', 'getStatisticsRun', 'cancelStatistics',
      'listSyncConnections', 'createSyncConnection', 'updateSyncConnection', 'deleteSyncConnection',
      'listSyncRules', 'createSyncRule', 'updateSyncRule', 'deleteSyncRule',
      'getSyncMetadata', 'testSyncConnection', 'startSync', 'getSyncRun', 'listSyncRuns', 'listSyncItemResults',
      'getSyncAuthState', 'beginSyncAuthorization', 'cancelSyncAuthorization', 'disconnectSyncAuthorization',
    ])
    cleanups.forEach(fn => fn())
    expect(offRemote).toHaveBeenCalledOnce()
    expect(offLocale).toHaveBeenCalledOnce()
  })
})

describe('subtasks and sessions', () => {
  interface PanelFace {
    openSession(sessionId: string): void
    sessionSnapshot(): { items: readonly { id: string; title: string }[] }
    subscribeSessions(listener: () => void): () => void
    createSubtask(request: { taskId: string; notes: string }): Promise<unknown>
    updateSubtask(request: { id: string; version: number; notes: string }): Promise<unknown>
    removeSubtask(request: { id: string; version: number }): Promise<unknown>
  }

  function panelOf(ctx: Record<string, unknown>): PanelFace {
    return (ctx.slots as { register: { mock: { calls: Array<[Record<string, unknown>]> } } })
      .register.mock.calls.find(call => call[0]!.name === 'main')?.[0]!.inject() as PanelFace
  }

  function baseContext(remote: Record<string, unknown>): Record<string, unknown> {
    return {
      remote: { $mount: vi.fn(async () => vi.fn()), ...remote },
      locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
      workspaces: { list: { getSnapshot: () => ({ items: [] }) } },
    }
  }

  it('jumps to a linked conversation and projects the session catalog once per snapshot', async () => {
    const openSession = vi.fn()
    const unsubscribe = vi.fn()
    const snapshot = {
      ids: ['s-2', 's-1'],
      byId: { 's-1': { displayTitle: 'Release notes' }, 's-2': { displayTitle: undefined } },
    }
    const subscribe = vi.fn(() => unsubscribe)
    const ctx = baseContext({})
    ctx.sessions = { list: { getSnapshot: () => snapshot, subscribe } }
    ctx.uiWorkspace = { openSession }
    await apply(ctx as unknown as Context)
    const panel = panelOf(ctx)

    expect(panel.sessionSnapshot().items).toEqual([
      { id: 's-2', title: 'sessionUntitled' }, { id: 's-1', title: 'Release notes' },
    ])
    // useSyncExternalStore compares by identity, so one snapshot projects once.
    expect(panel.sessionSnapshot()).toBe(panel.sessionSnapshot())

    panel.openSession('s-2')
    expect(openSession).toHaveBeenCalledWith('s-2')

    const listener = () => undefined
    panel.subscribeSessions(listener)
    expect(subscribe).toHaveBeenCalledWith(listener)
  })

  it('keeps older linked sessions and updates titles when the catalog changes', async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `session-${index}`)
    let snapshot = { ids, byId: Object.fromEntries(ids.map(id => [id, { displayTitle: id === 'session-204' ? '较早的中文会话' : '   ' }])) }
    const ctx = baseContext({})
    ctx.sessions = { list: { getSnapshot: () => snapshot, subscribe: vi.fn(() => vi.fn()) } }
    await apply(ctx as unknown as Context)
    const panel = panelOf(ctx)
    const before = panel.sessionSnapshot()
    expect(before.items).toHaveLength(205)
    expect(before.items[204]).toEqual({ id: 'session-204', title: '较早的中文会话' })
    expect(before.items[0].title).toBe('sessionUntitled')
    snapshot = { ...snapshot, byId: { ...snapshot.byId, 'session-204': { displayTitle: '改名后的会话' } } }
    expect(panel.sessionSnapshot()).not.toBe(before)
    expect(panel.sessionSnapshot().items[204].title).toBe('改名后的会话')
  })

  it('routes subtask edits through the taskList remote namespace', async () => {
    const createSubtask = vi.fn(async () => ({ ok: true as const, value: { id: 'sub-1', notes: 'Write tests' } }))
    const updateSubtask = vi.fn(async () => ({ ok: true as const, value: { id: 'sub-1', notes: 'Write more tests' } }))
    const deleteSubtask = vi.fn(async () => ({ ok: true as const, value: { deleted: true as const } }))
    const ctx = baseContext({})
    ctx.get = () => ({ createSubtask, updateSubtask, deleteSubtask })
    await apply(ctx as unknown as Context)
    const panel = panelOf(ctx)

    await expect(panel.createSubtask({ taskId: 'task-1', notes: 'Write tests' }))
      .resolves.toMatchObject({ id: 'sub-1' })
    await panel.updateSubtask({ id: 'sub-1', version: 1, notes: 'Write more tests' })
    await panel.removeSubtask({ id: 'sub-1', version: 2 })
    expect(createSubtask).toHaveBeenCalledWith({ taskId: 'task-1', notes: 'Write tests' })
    expect(updateSubtask).toHaveBeenCalledWith({ id: 'sub-1', version: 1, notes: 'Write more tests' })
    expect(deleteSubtask).toHaveBeenCalledWith({ id: 'sub-1', version: 2 })
  })

  it('surfaces a refused subtask edit as a plain error', async () => {
    const createSubtask = vi.fn(async () => ({ ok: false as const, error: { message: 'task not found' } }))
    const ctx = baseContext({})
    ctx.get = () => ({ createSubtask })
    await apply(ctx as unknown as Context)
    const panel = panelOf(ctx)
    await expect(panel.createSubtask({ taskId: 'missing', notes: 'x' })).rejects.toThrow('task not found')
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

  it('creates a session in the linked workspace and opens an unsent content-only draft', async () => {
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
    // The title is derived from the content, so the draft never repeats it.
    expect(draft).toHaveBeenCalledWith('Include tests')
    expect(updateTask).toHaveBeenCalledWith({ id: 'task-1', version: 1, status: 'in_progress', sessionId: 'session-1' })
    expect(openSession).toHaveBeenCalledWith('session-1')
    expect(steps).toEqual(['create', 'draft:Include tests', 'update', 'open'])

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

    // A legacy row stored before content became the source still sends its title.
    await panel.start({ ...task, title: 'Legacy row', notes: '' })
    expect(draft).toHaveBeenLastCalledWith('Legacy row')
  })

  it.each([
    { name: 'requirements.txt', mediaType: 'text/plain', data: 'YWJj', bytes: 3 },
    { name: 'image.png', mediaType: 'image/png', data: 'iVBORw==', bytes: 4 },
  ])('restores persisted $name and Markdown before immediate submit', async attachment => {
    const node = { type: 'attachment' as const, id: '22222222-2222-4222-8222-222222222222', name: attachment.name, mediaType: attachment.mediaType, bytes: attachment.bytes }
    const setDraft = vi.fn()
    const addAttachments = vi.fn(() => true)
    const submit = vi.fn()
    const createDrafts = vi.fn((_id: string, files: File[]) => files.map(file => ({ id: 'runtime-id', file })))
    const readTaskAttachments = vi.fn(async () => ({ ok: true, value: [{ id: node.id, data: attachment.data }] }))
    const updateTask = vi.fn(async () => ({ ok: true, value: {} }))
    const ctx = {
      remote: { $mount: vi.fn(async () => vi.fn()) }, get: () => ({ readTaskAttachments, updateTask }),
      locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
      workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws' }] }) } },
      sessions: { create: vi.fn(async () => 'session-attachments'), using: async (_id: string, _options: unknown, fn: () => Promise<void>) => fn(), scope: () => ({}) },
      conversation: { createDrafts, input: { for: () => ({ setDraft, addAttachments, submit }) } },
      uiWorkspace: { openSession: vi.fn() },
    }
    await apply(ctx as unknown as Context)
    const panel = ctx.slots.register.mock.calls.find(call => call[0].name === 'main')?.[0].inject()
    const task = { id: 'task-attachments', version: 2, title: 'Check', notes: 'Check', workspaceId: 'ws', agent: null, sendImmediately: true,
      content: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'Check', marks: ['bold'] }] }, node] } } as TaskRecord
    await panel.start(task)
    expect(readTaskAttachments).toHaveBeenCalledWith({ id: task.id, version: 2 })
    expect(createDrafts).toHaveBeenCalledWith('session-attachments', [expect.objectContaining({ name: attachment.name, type: attachment.mediaType, size: attachment.bytes })])
    expect(Buffer.from(await createDrafts.mock.calls[0][1][0].arrayBuffer()).toString('base64')).toBe(attachment.data)
    expect(addAttachments).toHaveBeenCalledWith(['runtime-id'])
    expect(setDraft).toHaveBeenCalledWith('**Check**')
    expect(submit).toHaveBeenCalledWith('queue', 'click')
    readTaskAttachments.mockRejectedValueOnce(new Error('task changed'))
    await expect(panel.start(task)).rejects.toThrow('task changed')
    expect(ctx.sessions.create).toHaveBeenCalledTimes(1)
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

describe('composer capture', () => {
  it('carries original file and image bytes into SQLite, even while the host file upload is pending', async () => {
    const root = mkdtempSync(join(tmpdir(), 'task-capture-attachments-'))
    let store = new TaskStore(join(root, 'tasks.sqlite'))
    try {
      const file = new File(['file bytes'], '需求.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const image = new File([new Uint8Array([137, 80, 78, 71])], '截图.png', { type: 'image/png' })
      const ids = ['file-runtime', 'image-runtime'] as DraftAttachmentId[]
      const drafts = [{ kind: 'file', id: ids[0], file }, { kind: 'image', id: ids[1], file: image, previewUrl: 'blob:preview' }]
      const releaseDraftAttachment = vi.fn()
      const createTask = vi.fn(async (request: Parameters<TaskStore['create']>[0]) => ({ ok: true as const, value: store.create(request) }))
      const ctx = {
        remote: { $mount: vi.fn(async () => vi.fn()) }, get: () => ({ createTask, capabilities: async () => ({ ok: true, value: { version: 1, richText: true, attachments: true } }),
          readTaskAttachments: async (request: { id: string; version: number }) => ({ ok: true, value: store.readAttachments(request.id, request.version) }) }),
        locale: { register: () => vi.fn(), bind: () => (key: string) => key },
        effect: (fn: () => (() => void)) => { fn() },
        slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
        conversation: { resolveDraftAttachments: vi.fn(() => drafts), releaseDraftAttachment,
          fileUploads: { getSnapshot: () => ({ 'file-runtime': { status: 'uploading' } }) } },
      }
      await apply(ctx as unknown as Context)
      const face = ctx.slots.register.mock.calls.find(call => call[0].name === 'conversation.input.right')![0].inject() as TaskCaptureFace
      const clearDraft = vi.fn()
      expect(await captureDraft('带文件和图片的任务', {
        create: face.create, hasAttachments: true, captureAttachments: () => face.captureAttachments(ids), clearDraft,
        clearAttachments: () => ids.forEach(face.releaseAttachment),
      })).toEqual({ kind: 'created', title: '带文件和图片的任务 需求.docx 截图.png' })
      const task = store.list().items[0]!
      const nodes = task.content.blocks.filter(block => block.type === 'attachment')
      expect(nodes.map(node => [node.name, node.mediaType, node.bytes])).toEqual([[file.name, file.type, file.size], [image.name, image.type, image.size]])
      expect(clearDraft).toHaveBeenCalledOnce()
      expect(releaseDraftAttachment.mock.calls.map(call => call[0])).toEqual(ids)
      store.close()
      store = new TaskStore(join(root, 'tasks.sqlite'))
      const bytes = store.readAttachments(task.id, task.version)
      expect(Buffer.from(bytes[0]!.data, 'base64').toString()).toBe('file bytes')
      expect([...Buffer.from(bytes[1]!.data, 'base64')]).toEqual([137, 80, 78, 71])
      // A disappeared browser object must fail rather than save just the text.
      ctx.conversation.resolveDraftAttachments.mockReturnValueOnce([])
      await expect(face.captureAttachments(ids)).rejects.toThrow('attachmentMissing')
    } finally { store.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('injects the owning composer session instead of a global active session', async () => {
    const register = vi.fn(() => vi.fn())
    const ctx = {
      remote: { $mount: vi.fn(async () => vi.fn()) },
      locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register },
    }
    await apply(ctx as unknown as Context)
    const capture = register.mock.calls.find(call => call[0].name === 'conversation.input.right')![0]
    expect(capture.inject('session-one').sessionId).toBe('session-one')
    expect(capture.inject('session-two').sessionId).toBe('session-two')
  })

  it('writes the captured draft through the taskList remote namespace', async () => {
    const createTask = vi.fn(async () => ({ ok: true as const, value: { id: 'task-9', title: '整理发布清单' } }))
    const register = vi.fn(() => vi.fn())
    const ctx = {
      remote: { $mount: vi.fn(async () => vi.fn()) },
      get: () => ({ createTask }),
      locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register },
      workspaces: { list: { getSnapshot: () => ({ items: [] }) } },
    }
    await apply(ctx as unknown as Context)
    const entry = register.mock.calls.find(call => call[0].name === 'conversation.input.right')
    expect(entry?.[0]).toMatchObject({ id: 'task-capture' })

    const face = entry![0].inject() as { create(request: Record<string, unknown>): Promise<unknown> }
    await expect(face.create({ title: '整理发布清单', notes: '整理发布清单' }))
      .resolves.toMatchObject({ id: 'task-9' })
    expect(createTask).toHaveBeenCalledWith({ title: '整理发布清单', notes: '整理发布清单' })
  })

  it('surfaces a refused capture as a plain error', async () => {
    const createTask = vi.fn(async () => ({ ok: false as const, error: { message: 'task store is read-only' } }))
    const register = vi.fn(() => vi.fn())
    const ctx = {
      remote: { $mount: vi.fn(async () => vi.fn()) },
      get: () => ({ createTask }),
      locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register },
      workspaces: { list: { getSnapshot: () => ({ items: [] }) } },
    }
    await apply(ctx as unknown as Context)
    const face = register.mock.calls.find(call => call[0].name === 'conversation.input.right')![0]
      .inject() as { create(request: Record<string, unknown>): Promise<unknown> }
    await expect(face.create({ title: 'x', notes: 'x' })).rejects.toThrow('task store is read-only')
  })
})

describe('sync face', () => {
  interface SyncPanelFace {
    sync: SyncFace
    list(request: ListTasksRequest): Promise<TaskPage>
  }

  function panelOf(ctx: Record<string, unknown>): SyncPanelFace {
    return (ctx.slots as { register: { mock: { calls: Array<[Record<string, unknown>]> } } })
      .register.mock.calls.find(call => call[0]!.name === 'main')?.[0]!.inject() as SyncPanelFace
  }

  function baseContext(remote: Record<string, unknown>): Record<string, unknown> {
    return {
      remote: { $mount: vi.fn(async () => vi.fn()), ...remote },
      locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      effect: (fn: () => (() => void)) => { fn() },
      slots: { inject: (_name: string, fn: () => void) => fn(), register: vi.fn(() => vi.fn()) },
      workspaces: { list: { getSnapshot: () => ({ items: [] }) } },
    }
  }

  it('maps sync methods to business values and preserves a structured RemoteError', async () => {
    const dto = syncError('CredentialMissing', { scope: 'connection', field: 'tokenEnv' })
    const listSyncConnections = vi.fn(async () => ({ ok: true as const, value: [{ id: 'c1', platform: 'tapd' }] }))
    const startSync = vi.fn(async () => ({ ok: false as const, error: syncRemoteError(dto) }))
    const ctx = baseContext({})
    ctx.get = () => ({ listSyncConnections, startSync })
    await apply(ctx as unknown as Context)
    const face = panelOf(ctx)

    await expect(face.sync.listSyncConnections()).resolves.toEqual([{ id: 'c1', platform: 'tapd' }])
    expect(listSyncConnections).toHaveBeenCalledWith({})

    const error = await face.sync.startSync().catch(error => error) as { code: string; details: unknown }
    expect(error.code).toBe('task-list/sync')
    expect(error.details).toEqual(dto)
  })

  it('turns a missing sync method into HostRestartRequired and keeps old CRUD working', async () => {
    const listSyncConnections = vi.fn(async () => { throw new Error('taskList/listSyncConnections is not mounted') })
    const listTasks = vi.fn(async () => ({ ok: true as const, value: { items: [], total: 0, page: 1, pageSize: 20 } }))
    const ctx = baseContext({})
    ctx.get = () => ({ listSyncConnections, listTasks })
    await apply(ctx as unknown as Context)
    const face = panelOf(ctx)

    const error = await face.sync.listSyncConnections().catch(error => error) as { code: string; details: { code: string } }
    expect(error.code).toBe('task-list/sync')
    expect(error.details.code).toBe('HostRestartRequired')

    await expect(face.list({ page: 1, pageSize: 20 })).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
    expect(listTasks).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
  })
})
