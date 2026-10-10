// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RuleSettings } from '../src/client/sync/RuleSettings.tsx'
import { ConditionBuilder, EMPTY_CONDITION_OPTIONS } from '../src/client/sync/RuleConditions.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import type { SyncFace } from '../src/client/sync/face.ts'
import type { SafeConnection, SyncMetadata } from '../src/sync/dto.ts'
import { parseSyncRequest } from '../src/sync/validation.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]
const connection: SafeConnection = { id: 'c1', name: '云效', platform: 'yunxiao', mode: 'center', organizationId: 'org', regionHost: null, tokenEnv: 'TOKEN', fillFields: [], instance: 'org', credentialPresent: true, enabled: true, revision: 1 }
const metadata = (project = ''): SyncMetadata => ({
  connectionId: 'c1', credentialPresent: true, readOnly: false, projects: [{ id: 'p1', label: '第一个项目' }],
  members: project ? [{ id: 'u1', label: '张三' }] : [], iterations: project ? [{ id: 'i1', label: '迭代一' }] : [],
  types: project ? [{ id: 't1', label: '需求' }] : [],
  typeCapabilities: project ? [{ typeId: 't1', fields: ['status'], readStates: [{ id: 'read-only', label: '只读状态' }], writeStates: [{ id: 'open', label: '待处理' }], representation: { format: 'text', roundTrip: true }, paging: { kind: 'page' }, workflow: { readOnly: false }, candidateFields: [] }] : [],
})
function mount(getSyncMetadata: SyncFace['getSyncMetadata'], listWorkitemFields = vi.fn(async () => [{ id: 'priority', name: '优先级', kind: 'custom' as const, options: [{ id: 'high', label: '高' }] }]), connections: SafeConnection[] = [connection]) {
  const face = { getSyncMetadata } as SyncFace
  render(<RuleSettings rule={null} connections={connections} face={face} listWorkitemFields={listWorkitemFields as never} t={t} onBack={() => {}} onSaved={async () => {}} />)
  return listWorkitemFields
}
async function query(field: string) {
  await waitFor(() => expect((screen.getByRole('button', { name: zh.syncNext }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: zh.syncNext }))
  fireEvent.click(screen.getByRole('button', { name: zh.syncConditionAdd }))
  fireEvent.click(screen.getByRole('button', { name: `${zh.syncConditionField} 1` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: field }))
}
describe('default project candidates', () => {
  it.each(['yunxiao', 'tapd'] as const)('removes a stale date upper bound when switching to a %s text condition', async platform => {
    const onChange = vi.fn()
    render(<ConditionBuilder conditions={[{ field: 'gmtCreate', operator: 'BETWEEN', value: ['2026-01-01'], toValue: '2026-02-01' }]}
      options={EMPTY_CONDITION_OPTIONS} platform={platform} t={t} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: `${zh.syncConditionField} 1` }))
    fireEvent.click(await screen.findByRole('menuitem', { name: zh.filterTitlePlaceholder }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]![0][0]).toEqual({ field: 'subject', operator: 'CONTAINS', value: [] })
    const subject = { ...onChange.mock.calls[0]![0][0], value: ['hello'] }
    expect(() => parseSyncRequest('createSyncRule', {
      connectionId: 'c1', projectId: 'p1', enabled: false, workspaceId: null,
      conditions: [[subject]], statusWriteStates: { todo: 'Open', in_progress: 'Doing', done: 'Done' },
    })).not.toThrow()
  })
  it('loads the first project without reselecting it and offers project members', async () => {
    const read = vi.fn(async request => metadata(request.projectId))
    const fields = mount(read)
    await query(zh.filterAssignee)
    expect(read.mock.calls.map(([request]) => request)).toEqual([{ connectionId: 'c1' }, { connectionId: 'c1', projectId: 'p1' }])
    expect(fields).toHaveBeenCalledWith({ connectionId: 'c1', projectId: 'p1', categories: 'Req,Bug,Task' })
    fireEvent.click(screen.getByRole('button', { name: 'assignedTo 1' }))
    expect(await screen.findByRole('menuitem', { name: '张三' })).toBeTruthy()
  })
  it('requests the TAPD priority catalog with TAPD category names', async () => {
    const tapd: SafeConnection = { id: 'c1', name: 'TAPD', platform: 'tapd', companyId: '1', tokenEnv: 'TOKEN', fillFields: [], instance: '1', credentialPresent: true, enabled: true, revision: 1 }
    const fields = mount(async request => metadata(request.projectId), vi.fn(async () => []), [tapd])
    await waitFor(() => expect(fields).toHaveBeenCalledWith({ connectionId: 'c1', projectId: 'p1', categories: 'story,bug,task' }))
  })
  it('offers read states for filtering rather than limiting them to writable states', async () => {
    mount(async request => metadata(request.projectId))
    await query(zh.filterStatus)
    fireEvent.click(screen.getByRole('button', { name: 'status 1' }))
    expect(await screen.findByRole('menuitem', { name: '只读状态' })).toBeTruthy()
  })
  it('does not offer Save for a new rule until all three status targets are selected', async () => {
    mount(async request => metadata(request.projectId))
    await waitFor(() => expect((screen.getByRole('button', { name: zh.syncNext }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: zh.syncNext }))
    fireEvent.click(screen.getByRole('button', { name: zh.syncNext }))
    expect((screen.getByRole('button', { name: zh.syncSaveRule }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('blocks the next step after a project read fails and can retry it', async () => {
    let failed = true
    const read = vi.fn(async request => {
      if (request.projectId && failed) throw Object.assign(new Error('denied'), { code: 'task-list/sync', details: { code: 'AuthDenied', docKey: 'permissions' } })
      return metadata(request.projectId)
    })
    mount(read)
    await screen.findByRole('alert')
    expect((screen.getByRole('button', { name: zh.syncNext }) as HTMLButtonElement).disabled).toBe(true)
    failed = false
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    await query(zh.filterAssignee)
    fireEvent.click(screen.getByRole('button', { name: 'assignedTo 1' }))
    expect(await screen.findByRole('menuitem', { name: '张三' })).toBeTruthy()
  })
})
