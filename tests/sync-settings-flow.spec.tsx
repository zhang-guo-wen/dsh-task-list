// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SyncSection } from '../src/client/sync/SyncSection.tsx'
import { zh } from '../src/client/locales.ts'
import type { TaskKey } from '../src/client/locales.ts'
import type { SyncFace } from '../src/client/sync/face.ts'
afterEach(cleanup)
const t = (key: TaskKey) => zh[key]
const connection = { id: 'c1', name: '研发TAPD', platform: 'tapd', companyId: '2001', userEnv: 'TAPD_USER', passwordEnv: 'TAPD_PASS', instance: '2001', revision: 1, enabled: true, credentialPresent: true }
function api(): SyncFace { return { listSyncConnections: async () => [connection], listSyncRules: async () => [] } as SyncFace }
/** Stable roster object: useSyncExternalStore requires an unchanging snapshot. */
const noWorkspaces = { items: [] as readonly { workspaceId: string; title: string }[] }
/** The sync settings page as the host settings panel mounts it: inline, no modal. */
function section(face: SyncFace) {
  return <SyncSection sync={face} t={t} close={() => {}}
    workspaceSnapshot={() => noWorkspaces} subscribeWorkspaces={() => () => {}} />
}

describe('compact native sync settings', () => {
  it('starts with connection cards instead of exposing all rule fields', async () => {
    render(section(api()))
    await screen.findByText('研发TAPD')
    expect(screen.queryByLabelText('公司 ID')).toBeNull()
    expect(screen.queryByRole('button', { name: '项目' })).toBeNull()
    expect(screen.getByRole('tab', { name: /连接/ }).getAttribute('aria-selected')).toBe('true')
  })
  it('new connections open on official authorization and still offer typed credentials', async () => {
    render(section(api()))
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    // 云效 opens on its official sign-in: the account field is that action.
    expect(screen.getByRole('button', { name: '登录并授权云效' })).toBeDefined()
    expect(screen.queryByLabelText('个人访问令牌')).toBeNull()
    expect(screen.queryByLabelText('连接名称')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '鉴权方式' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '手动填写（个人访问令牌）' }))
    expect(screen.getByLabelText('个人访问令牌')).toBeDefined()
    // No standing description and no environment-variable field anywhere.
    expect(screen.queryByLabelText('Token 环境变量名')).toBeNull()
  })
  it('a Yunxiao OAuth draft signs in first and is saved on the way in', async () => {
    const face = api(); let created: any; let begun = 0
    face.createSyncConnection = async input => { created = { ...input, id: 'cloud-new', revision: 1, instance: '', credentialPresent: false }; return created }
    face.listSyncConnections = async () => created ? [created] : []
    face.beginSyncAuthorization = async () => { begun++; return { attemptId: 'a1', authorizationUrl: 'https://example.test/auth', expiresAt: Date.now() + 600000 } as any }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(section(face))
    fireEvent.click(await screen.findByRole('button', { name: '新增连接' }))
    fireEvent.click(screen.getByRole('button', { name: '鉴权方式' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '官方授权登录' }))
    // The organization is never typed: it is a dropdown the account fills.
    expect(screen.queryByRole('textbox', { name: '组织' })).toBeNull()
    // Signing in is offered before saving; the draft is written on the way in.
    const login = screen.getByRole('button', { name: '登录并授权云效' }) as HTMLButtonElement
    expect(login.disabled).toBe(false)
    fireEvent.click(login)
    await waitFor(() => expect(begun).toBe(1))
    expect(created).toBeDefined()
    open.mockRestore()
  })
  it('OAuth rules accept an explicit project ID before metadata is available', async () => {
    const face = api(); face.listSyncConnections = async () => [{ ...connection, authentication: { mode: 'oauth' }, credentialPresent: false }] as any
    render(section(face))
    await screen.findByText('研发TAPD'); fireEvent.click(screen.getByRole('tab', { name: /规则/ })); fireEvent.click(screen.getByRole('button', { name: '新增规则' }))
    expect(screen.getByRole('textbox', { name: '项目 ID' })).toBeDefined()
  })
  it('new rules show only the scope step, not the mapping and enable controls', async () => {
    render(section(api()))
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
