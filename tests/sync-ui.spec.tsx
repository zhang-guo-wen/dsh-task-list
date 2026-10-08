// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskPanel, WorktreeNotGitError } from '../src/client/TaskPanel.tsx'
import { local } from './fixtures/sync.ts'
import { RuleSettings } from '../src/client/sync/RuleSettings.tsx'
import { SyncSettings } from '../src/client/sync/SyncSettings.tsx'
import { mappingReady, RuleFields } from '../src/client/sync/RuleFields.tsx'
import { SyncControls } from '../src/client/sync/SyncControls.tsx'
import { zh } from '../src/client/locales.ts'
import type { TaskKey } from '../src/client/locales.ts'
import type { SyncFace } from '../src/client/sync/face.ts'
import type { SafeRun } from '../src/sync/dto.ts'

afterEach(() => { cleanup(); sessionStorage.clear() })
const t = (key: TaskKey) => zh[key]
const completed: SafeRun = { id: 'run1', status: 'completed', phase: 'finished', startedAt: 1, finishedAt: 2, counts: { imported: 1, pulled: 0, pushed: 0, merged: 0, unchanged: 0, failed: 0, pending: 0 }, unprocessedKnown: 0, discoveryComplete: true, scopeSummary: '', errors: [] }
function face(): SyncFace {
  return {
    listSyncConnections: async () => [{ id: 'c1', revision: 1, name: 'TAPD', platform: 'tapd', companyId: '1', userEnv: 'USER', passwordEnv: 'PASS', instance: 'tapd:1', enabled: true, credentialPresent: true }],
    listSyncRules: async () => [{ id: 'r1', revision: 1, connectionId: 'c1', projectId: 'p1', enabled: true, workspaceId: null, filters: { assignees: [], typeIds: ['task'], statusIds: [], iterationIds: [] }, mappings: [] }],
    listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }),
    getSyncRun: async () => completed,
    listSyncItemResults: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    startSync: async () => ({ runId: 'run1', existing: false }),
  } as SyncFace
}

describe('manual sync controls', () => {
  it('a rapid second click cannot dispatch a second run; save/query never starts one', async () => {
    const api = face()
    let calls = 0
    let release!: (value: { runId: string; existing: boolean }) => void
    api.startSync = () => { calls++; return new Promise(resolve => { release = resolve }) }
    render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    const button = await screen.findByRole('button', { name: '同步', exact: true })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    expect(calls).toBe(0)
    fireEvent.click(button); fireEvent.click(button)
    expect(calls).toBe(1)
    release({ runId: 'run1', existing: false })
    await screen.findByText('同步完成')
  })
  it('remount reconnects to the Host run without executing sync', async () => {
    const api = face()
    api.listSyncRuns = async () => ({ items: [completed], total: 1, page: 1, pageSize: 1 })
    const start = vi.fn(api.startSync); api.startSync = start
    const first = render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    await screen.findByText('同步完成'); first.unmount()
    render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    await screen.findByText('同步完成')
    expect(start).not.toHaveBeenCalled()
  })
  it('no enabled scope disables sync and shows the scope explanation', async () => {
    const api = face(); api.listSyncRules = async () => []
    render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    await screen.findByText('请先在同步设置中启用连接和规则。')
    expect((screen.getByRole('button', { name: '同步', exact: true }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('result pagination queries page two without starting another run', async () => {
    const api = face(); const pages: number[] = []
    api.listSyncRuns = async () => ({ items: [completed], total: 1, page: 1, pageSize: 1 })
    api.listSyncItemResults = async request => { pages.push(request.page); return { items: [], total: 21, page: request.page, pageSize: 20 } }
    const start = vi.fn(api.startSync); api.startSync = start
    render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '下一页' }))
    await waitFor(() => expect(pages).toEqual([1, 2]))
    expect(start).not.toHaveBeenCalled()
  })
  it('structured credential errors are localized without displaying a secret or raw provider message', async () => {
    const api = face()
    api.listSyncConnections = async () => { throw { code: 'task-list/sync', message: 'secret-provider-body', details: { code: 'CredentialMissing', docKey: 'credentials' } } }
    render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    await screen.findByText(/宿主缺少凭据/)
    expect(document.body.textContent).not.toContain('secret-provider-body')
  })
  it('optional fields are opt-in and use the remotely confirmed field identifier', () => {
    let result: any
    const mapping = { typeId: 'task', category: 'task', readStates: {}, writeStates: { todo: '', in_progress: '', done: '' }, optionalFields: [], fieldIds: {}, valueMaps: {} }
    const capability = { typeId: 'task', fields: ['title', 'description', 'status', 'priority'], readStates: [], writeStates: [], representation: { format: 'text', roundTrip: true }, paging: { kind: 'cursor' }, workflow: { readOnly: false }, candidateFields: [{ field: 'priority', remoteId: 'priority_label', writable: true, format: 'select' }] }
    render(<RuleFields mapping={mapping as any} capability={capability as any} t={t} tapd onChange={next => { result = next }} />)
    fireEvent.click(screen.getByRole('checkbox', { name: '优先级' }))
    expect(result.optionalFields).toEqual(['priority'])
    expect(result.fieldIds.priority).toBe('priority_label')
  })
  it('late metadata from the previous connection cannot replace new candidates', async () => {
    const api = face()
    const connection = (id: string) => ({ id, revision: 1, name: id, platform: 'tapd', companyId: id, userEnv: 'USER', passwordEnv: 'PASS', instance: `tapd:${id}`, enabled: false, credentialPresent: true })
    api.listSyncConnections = async () => [connection('A'), connection('B')] as any
    api.listSyncRules = async () => []
    let first!: (value: any) => void
    api.getSyncMetadata = request => request.connectionId === 'A' ? new Promise(resolve => { first = resolve }) : Promise.resolve({ connectionId: 'B', credentialPresent: true, readOnly: false, projects: [{ id: 'new', label: 'New project' }], members: [], iterations: [], types: [], typeCapabilities: [] })
    render(<RuleSettings rule={null} connections={[connection('A'), connection('B')] as any} face={api} t={t} workspaces={[]} onBack={() => {}} onSaved={async () => {}} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '连接与凭据' })).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '连接与凭据' })); fireEvent.click(await screen.findByRole('menuitem', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: '读取候选' }))
    fireEvent.click(screen.getByRole('button', { name: '连接与凭据' })); fireEvent.click(await screen.findByRole('menuitem', { name: 'B' }))
    fireEvent.click(screen.getByRole('button', { name: '读取候选' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '项目' }) as HTMLButtonElement).disabled).toBe(false))
    first({ connectionId: 'A', credentialPresent: true, readOnly: false, projects: [{ id: 'old', label: 'Old project' }], members: [], iterations: [], types: [], typeCapabilities: [] })
    fireEvent.click(screen.getByRole('button', { name: '项目' }))
    await screen.findByRole('menuitem', { name: 'New project' })
    expect(screen.queryByRole('menuitem', { name: 'Old project' })).toBeNull()
  })
  it('a rejected read-only connection test never displays success even when credentials exist', async () => {
    const api = face()
    api.testSyncConnection = async () => ({ ok: false, credentialPresent: true, error: { code: 'AuthDenied', scope: 'connection', problem: '', cause: '', action: '', docKey: 'permissions', retryable: false } })
    render(<SyncSettings face={api} t={t} workspaces={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '配置: TAPD' }))
    fireEvent.click(screen.getByRole('button', { name: '测试只读连接' }))
    await screen.findByText('AuthDenied')
    expect(screen.queryByText('只读连接测试成功，不代表有回写权限。')).toBeNull()
  })
  it('contradictory read and write targets cannot enable a rule', () => {
    const states = [{ id: 'open', label: 'Open' }, { id: 'doing', label: 'Doing' }, { id: 'done', label: 'Done' }]
    const mapping = { typeId: 'task', category: 'task', readStates: { open: 'todo', doing: 'in_progress', done: 'done' }, writeStates: { todo: 'done', in_progress: 'doing', done: 'open' }, optionalFields: [], fieldIds: {}, valueMaps: {} }
    const capability = { typeId: 'task', fields: ['title', 'status', 'description'], readStates: states, writeStates: states, representation: { format: 'text', roundTrip: true }, paging: { kind: 'cursor' }, workflow: { readOnly: false }, candidateFields: [] }
    expect(mappingReady(mapping as any, capability as any)).toBe(false)
  })
  it('external source is retained through the non-Git Worktree initialization retry', async () => {
    const task = local({ title: 'Independent title', workspaceId: 'ws', useWorktree: true, source: { platform: 'tapd', projectId: 'p', typeId: 'task', remoteId: '123', number: 'T-123', url: null, lastSuccess: null, error: null } })
    const started: any[] = []
    const snapshot = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }
    const sessions = { items: [] }
    const props: any = {
      list: async () => ({ items: [task], total: 1, page: 1, pageSize: 20 }),
      update: async (request: any) => { const { source, ...saved } = task; return { ...saved, ...request, version: 2 } },
      readAttachments: async () => [], listAgents: async () => [],
      workspaceSnapshot: () => snapshot, subscribeWorkspaces: () => () => {},
      sessionSnapshot: () => sessions, subscribeSessions: () => () => {},
      probeWorktree: async () => {}, listInitialEntries: async () => [], initializeGit: async () => {},
      start: async (row: any) => { started.push(row); if (started.length === 1) throw new WorktreeNotGitError('Workspace', 'C:/test', 'not Git') }, t,
    }
    render(<TaskPanel {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: '编辑: Independent title' }))
    fireEvent.click(screen.getAllByRole('button', { name: '启动', exact: true }).at(-1)!)
    const retry = await screen.findByRole('button', { name: '初始化并启动' })
    await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(retry)
    await waitFor(() => expect(started).toHaveLength(2))
    expect(started[1].source?.remoteId).toBe('123')
    expect(started[1].title).toBe('Independent title')
  })
  it('native settings Escape closes the dialog and returns focus to its trigger', async () => {
    const user = userEvent.setup()
    render(<SyncControls face={face()} t={t} workspaces={[]} onComplete={() => {}} />)
    const trigger = screen.getByRole('button', { name: '同步设置' })
    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
  it('settings saves a disabled connection without executing sync', async () => {
    const api = face(); api.listSyncConnections = async () => []; api.listSyncRules = async () => []
    let saved: unknown
    api.createSyncConnection = async request => { saved = request; return { ...request, id: 'new', revision: 1, credentialPresent: false, instance: 'tapd:1' } as any }
    const start = vi.fn(api.startSync); api.startSync = start
    render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '同步设置' }))
    await screen.findByRole('dialog')
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    fireEvent.click(screen.getByRole('button', { name: '平台' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'TAPD' }))
    fireEvent.click(screen.getByRole('button', { name: '鉴权方式' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '手动 API 凭据' }))
    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: 'Work' } })
    fireEvent.change(screen.getByLabelText('公司 ID'), { target: { value: '2001' } })
    fireEvent.change(screen.getByLabelText('API 用户环境变量名'), { target: { value: 'TAPD_USER' } })
    fireEvent.change(screen.getByLabelText('API 密码环境变量名'), { target: { value: 'TAPD_PASS' } })
    fireEvent.click(screen.getByRole('button', { name: '保存连接' }))
    await waitFor(() => expect(saved).toEqual({ platform: 'tapd', name: 'Work', companyId: '2001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', enabled: false, authentication: { mode: 'manual' } }))
    expect(start).not.toHaveBeenCalled()
  })
  it('results show pending as a subset of failures, never an invented percent', async () => {
    const api = face()
    const partial = { ...completed, status: 'partial' as const, counts: { ...completed.counts, failed: 2, pending: 1 }, discoveryComplete: false, unprocessedKnown: null }
    api.listSyncRuns = async () => ({ items: [partial], total: 1, page: 1, pageSize: 1 })
    api.getSyncRun = async () => partial
    render(<SyncControls face={api} t={t} workspaces={[]} onComplete={() => {}} />)
    await screen.findByText(/待确认：1/)
    expect(screen.getByText(/发现未完成/).textContent).not.toContain('%')
  })
})
