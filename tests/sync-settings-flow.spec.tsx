// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SyncSettings } from '../src/client/sync/SyncSettings.tsx'
import { zh } from '../src/client/locales.ts'
import type { TaskKey } from '../src/client/locales.ts'
import type { SyncFace } from '../src/client/sync/face.ts'
afterEach(cleanup)
const t = (key: TaskKey) => zh[key]
const connection = { id: 'c1', name: '研发TAPD', platform: 'tapd', companyId: '2001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', instance: '2001', revision: 1, enabled: true, credentialPresent: true }
function api(): SyncFace { return { listSyncConnections: async () => [connection], listSyncRules: async () => [] } as SyncFace }

describe('compact native sync settings', () => {
  it('starts with connection cards instead of exposing all rule fields', async () => {
    render(<SyncSettings face={api()} t={t} workspaces={[]} onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('研发TAPD')
    expect(screen.queryByLabelText('公司 ID')).toBeNull()
    expect(screen.queryByRole('button', { name: '项目' })).toBeNull()
    expect(screen.getByRole('tab', { name: /连接/ }).getAttribute('aria-selected')).toBe('true')
  })
  it('new connections prefer official authorization with manual credentials collapsed', async () => {
    render(<SyncSettings face={api()} t={t} workspaces={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    expect(screen.getByRole('button', { name: '登录并授权云效' })).toBeDefined()
    expect(document.querySelector('details')!.open).toBe(false)
    expect(screen.getByText(/权限与授权用户等同/)).toBeDefined()
  })
  it('saving an OAuth connection keeps its official login action available', async () => {
    const face = api(); let created: any
    face.createSyncConnection = async input => { created = { ...input, id: 'cloud-new', revision: 1, instance: 'org', credentialPresent: false }; return created }
    face.listSyncConnections = async () => created ? [created] : []
    render(<SyncSettings face={face} t={t} workspaces={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    fireEvent.change(screen.getByRole('textbox', { name: '连接名称' }), { target: { value: 'Cloud' } })
    fireEvent.change(screen.getByRole('textbox', { name: '组织 ID' }), { target: { value: 'org' } })
    fireEvent.click(screen.getByRole('button', { name: '保存连接' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '登录并授权云效' }) as HTMLButtonElement).disabled).toBe(false))
  })
  it('OAuth rules accept an explicit project ID before metadata is available', async () => {
    const face = api(); face.listSyncConnections = async () => [{ ...connection, authentication: { mode: 'oauth' }, credentialPresent: false }] as any
    render(<SyncSettings face={face} t={t} workspaces={[]} onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('研发TAPD'); fireEvent.click(screen.getByRole('tab', { name: /规则/ })); fireEvent.click(screen.getByRole('button', { name: '新增规则' }))
    expect(screen.getByRole('textbox', { name: '项目 ID' })).toBeDefined()
  })
  it('new rules show only the scope step, not the mapping and enable controls', async () => {
    render(<SyncSettings face={api()} t={t} workspaces={[]} onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('研发TAPD')
    fireEvent.click(screen.getByRole('tab', { name: /规则/ }))
    fireEvent.click(screen.getByRole('button', { name: '新增规则' }))
    expect(screen.getByText('1. 项目与范围')).toBeDefined()
    expect(screen.queryByRole('checkbox', { name: '启用此规则' })).toBeNull()
    expect(screen.queryByText('远端状态 → 本地状态')).toBeNull()
    expect((screen.getByRole('button', { name: '下一步' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByRole('button', { name: '新增规则' })).toBeDefined()
  })
})
