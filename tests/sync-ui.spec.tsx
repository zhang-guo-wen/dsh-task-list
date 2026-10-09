// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskPanel, WorktreeNotGitError } from '../src/client/TaskPanel.tsx'
import { local } from './fixtures/sync.ts'
import { RuleSettings } from '../src/client/sync/RuleSettings.tsx'
import { SyncSection } from '../src/client/sync/SyncSection.tsx'
import { mappingReady, RuleFields } from '../src/client/sync/RuleFields.tsx'
import { SyncActions, SyncStatus } from '../src/client/sync/SyncControls.tsx'
import { useSyncPanel } from '../src/client/sync/use-sync-panel.ts'
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
/**
 * The task list's sync surface as TaskPanel composes it: one panel state behind
 * the header's split block and the status region under the toolbar.
 */
function SyncHarness({ api, onCreate = () => {} }: { api: SyncFace; onCreate?: () => void }) {
  const panel = useSyncPanel(api, () => {})
  return <><SyncActions addLabel={zh.add} onCreate={onCreate} panel={panel} t={t} /><SyncStatus panel={panel} t={t} /></>
}
/** Open the header's trailing menu and activate Sync. */
async function clickSyncRow() {
  fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: '同步' }))
}
/** Stable roster object: useSyncExternalStore requires an unchanging snapshot. */
const noWorkspaces = { items: [] as readonly { workspaceId: string; title: string }[] }
function section(api: SyncFace, workspaces: { items: readonly { workspaceId: string; title: string }[] } = noWorkspaces) {
  return <SyncSection sync={api} t={t} close={() => {}}
    workspaceSnapshot={() => workspaces} subscribeWorkspaces={() => () => {}} />
}

describe('manual sync controls', () => {
  it('a rapid second activation cannot dispatch a second run; settings never start one', async () => {
    const api = face()
    let calls = 0
    let release!: (value: { runId: string; existing: boolean }) => void
    api.startSync = () => { calls++; return new Promise(resolve => { release = resolve }) }
    render(<SyncHarness api={api} />)
    await clickSyncRow()
    await waitFor(() => expect(calls).toBe(1))
    // The row is disabled while the run is being requested, so reopening the
    // menu cannot reach the Host a second time.
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    const row = await screen.findByRole('menuitem', { name: '同步中' })
    fireEvent.click(row)
    expect(calls).toBe(1)
    release({ runId: 'run1', existing: false })
    await screen.findByText('同步完成')
  })
  it('remount reconnects to the Host run without executing sync', async () => {
    const api = face()
    api.listSyncRuns = async () => ({ items: [completed], total: 1, page: 1, pageSize: 1 })
    const start = vi.fn(api.startSync); api.startSync = start
    const first = render(<SyncHarness api={api} />)
    await screen.findByText('同步完成'); first.unmount()
    render(<SyncHarness api={api} />)
    await screen.findByText('同步完成')
    expect(start).not.toHaveBeenCalled()
  })
  it('an unconfigured click points at the settings page and never starts a run', async () => {
    const api = face(); api.listSyncConnections = async () => []
    const start = vi.fn(api.startSync); api.startSync = start
    render(<SyncHarness api={api} />)
    expect(screen.queryByText(/同步所有已启用规则/)).toBeNull()
    expect(screen.queryByText(/双方都改动时/)).toBeNull()
    await clickSyncRow()
    await screen.findByText('还没有同步连接。请在「设置 → 任务同步」中添加连接。')
    expect(start).not.toHaveBeenCalled()
  })
  it('connections without an enabled rule point at the settings page too', async () => {
    const api = face(); api.listSyncRules = async () => []
    const start = vi.fn(api.startSync); api.startSync = start
    render(<SyncHarness api={api} />)
    await clickSyncRow()
    await screen.findByText('请在「设置 → 任务同步」中启用连接和规则。')
    expect(start).not.toHaveBeenCalled()
  })
  it('the refused prompt can be dismissed and leaves the page clean again', async () => {
    const api = face(); api.listSyncConnections = async () => []
    render(<SyncHarness api={api} />)
    await clickSyncRow()
    await screen.findByText('还没有同步连接。请在「设置 → 任务同步」中添加连接。')
    fireEvent.click(screen.getByRole('button', { name: '知道了' }))
    expect(screen.queryByText(/还没有同步连接/)).toBeNull()
  })
  it('the trailing menu closes on Escape and returns focus to its handle', async () => {
    const user = userEvent.setup()
    render(<SyncHarness api={face()} />)
    const handle = screen.getByRole('button', { name: '更多操作' })
    await user.click(handle)
    await screen.findByRole('menuitem', { name: '同步' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: '同步' })).toBeNull())
    expect(document.activeElement).toBe(handle)
  })
  it('result pagination queries page two without starting another run', async () => {
    const api = face(); const pages: number[] = []
    api.listSyncRuns = async () => ({ items: [completed], total: 1, page: 1, pageSize: 1 })
    api.listSyncItemResults = async request => { pages.push(request.page); return { items: [], total: 21, page: request.page, pageSize: 20 } }
    const start = vi.fn(api.startSync); api.startSync = start
    render(<SyncHarness api={api} />)
    fireEvent.click(await screen.findByRole('button', { name: '下一页' }))
    await waitFor(() => expect(pages).toEqual([1, 2]))
    expect(start).not.toHaveBeenCalled()
  })
  it('structured credential errors are localized without displaying a secret or raw provider message', async () => {
    const api = face()
    api.listSyncConnections = async () => { throw { code: 'task-list/sync', message: 'secret-provider-body', details: { code: 'CredentialMissing', docKey: 'credentials' } } }
    render(<SyncHarness api={api} />)
    await clickSyncRow()
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
  it('the roster row owns the enable switch, not the editor', async () => {
    const api = face()
    render(section(api))
    // The list row carries the switch...
    const toggle = await screen.findByRole('switch', { name: '启用连接' })
    expect(toggle).toBeDefined()
    // ...and the editor that row opens does not duplicate it.
    fireEvent.click(screen.getByRole('button', { name: '配置: TAPD' }))
    await screen.findByLabelText('公司 ID')
    expect(screen.queryByRole('switch', { name: '启用连接' })).toBeNull()
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
      sync: { listSyncRuns: async () => ({ items: [], total: 0, page: 1, pageSize: 1 }) },
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
  it('the list header offers one split block: create on the body, Sync in the menu', async () => {
    const api = face(); api.listSyncConnections = async () => []
    const emptyTasks = { items: [] as readonly unknown[] }
    const props: any = {
      list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      workspaceSnapshot: () => emptyTasks, subscribeWorkspaces: () => () => {},
      sessionSnapshot: () => emptyTasks, subscribeSessions: () => () => {},
      listAgents: async () => [], sync: api, t,
    }
    render(<TaskPanel {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: '新建任务' }))
    await screen.findByRole('dialog', { name: '新建任务' })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    // No standing explanation of sync, and no settings entry, on the list page.
    expect(screen.queryByRole('button', { name: '任务同步' })).toBeNull()
    expect(screen.queryByText(/同步所有已启用规则/)).toBeNull()
    expect(screen.queryByText(/双方都改动时/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '同步' }))
    await screen.findByText('还没有同步连接。请在「设置 → 任务同步」中添加连接。')
  })
  it('the settings page is an inline section, not a modal, and keeps its two tabs', async () => {
    render(section(face()))
    expect(screen.queryByRole('dialog')).toBeNull()
    const tabs = await screen.findByRole('tab', { name: /连接/ })
    expect(tabs.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: /规则/ })).toBeDefined()
  })
  it('settings saves a disabled connection without executing sync', async () => {
    const api = face(); api.listSyncConnections = async () => []; api.listSyncRules = async () => []
    let saved: unknown
    api.createSyncConnection = async request => { saved = request; return { ...request, id: 'new', revision: 1, credentialPresent: false, instance: 'tapd:1' } as any }
    const start = vi.fn(api.startSync); api.startSync = start
    render(section(api))
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    fireEvent.click(screen.getByRole('button', { name: '平台' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'TAPD' }))
    fireEvent.change(screen.getByLabelText('公司 ID'), { target: { value: '2001' } })
    fireEvent.change(screen.getByLabelText('API 用户'), { target: { value: 'TAPD_USER' } })
    fireEvent.change(screen.getByLabelText('API 密码'), { target: { value: 'TAPD_PASS' } })
    fireEvent.click(screen.getByRole('button', { name: '保存连接' }))
    await waitFor(() => expect(saved).toEqual({
      platform: 'tapd', name: 'TAPD · 2001', companyId: '2001', userEnv: 'TASK_LIST_TAPD_USER', passwordEnv: 'TASK_LIST_TAPD_PASSWORD',
      enabled: false, authentication: { mode: 'manual' }, secret: { platform: 'tapd', user: 'TAPD_USER', password: 'TAPD_PASS' },
    }))
    expect(start).not.toHaveBeenCalled()
  })
  it('a typed token lists organizations and the picked id is saved with the credential', async () => {
    const api = face(); api.listSyncConnections = async () => []; api.listSyncRules = async () => []
    api.listSyncOrganizations = async request => {
      expect(request).toEqual({ token: 'pat-secret' })
      return [{ id: 'org-1', name: '示例企业' }] as any
    }
    let saved: any
    api.createSyncConnection = async request => { saved = request; return { ...request, id: 'new', revision: 1, credentialPresent: true, instance: 'org-1' } as any }
    render(section(api))
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    fireEvent.click(screen.getByRole('button', { name: '鉴权方式' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '手动填写（个人访问令牌）' }))
    fireEvent.change(screen.getByLabelText('个人访问令牌'), { target: { value: 'pat-secret' } })
    // Opening the organization menu is what fetches the list.
    fireEvent.click(screen.getByRole('button', { name: '组织' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '示例企业' }))
    fireEvent.click(screen.getByRole('button', { name: '保存连接' }))
    await waitFor(() => expect(saved).toEqual({
      platform: 'yunxiao', name: '云效 · 示例企业', mode: 'center', regionHost: null, organizationId: 'org-1',
      tokenEnv: 'TASK_LIST_YUNXIAO_TOKEN', enabled: false, authentication: { mode: 'manual' },
      secret: { platform: 'yunxiao', token: 'pat-secret' },
    }))
  })
  it('a failed organization read keeps the manual field and never invents an id', async () => {
    const api = face(); api.listSyncConnections = async () => []; api.listSyncRules = async () => []
    api.listSyncOrganizations = async () => { throw { code: 'task-list/sync', message: 'x', details: { code: 'AuthDenied', docKey: 'permissions' } } }
    render(section(api))
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    fireEvent.click(screen.getByRole('button', { name: '鉴权方式' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '手动填写（个人访问令牌）' }))
    fireEvent.change(screen.getByLabelText('个人访问令牌'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByRole('button', { name: '组织' }))
    await screen.findByText(/AuthDenied/)
    expect(screen.getByRole('button', { name: '组织' })).toBeDefined()
  })
  it('results show pending as a subset of failures, never an invented percent', async () => {
    const api = face()
    const partial = { ...completed, status: 'partial' as const, counts: { ...completed.counts, failed: 2, pending: 1 }, discoveryComplete: false, unprocessedKnown: null }
    api.listSyncRuns = async () => ({ items: [partial], total: 1, page: 1, pageSize: 1 })
    api.getSyncRun = async () => partial
    render(<SyncHarness api={api} />)
    await screen.findByText(/待确认：1/)
    expect(screen.getByText(/发现未完成/).textContent).not.toContain('%')
  })
})
