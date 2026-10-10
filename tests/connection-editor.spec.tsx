// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConnectionSettings } from '../src/client/sync/ConnectionSettings.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import type { SyncFace } from '../src/client/sync/face.ts'
import type { SafeConnection } from '../src/sync/dto.ts'

afterEach(cleanup)
const t = (key: TaskKey) => zh[key]

// jsdom's import.meta.url is not a file URL, so the source scan resolves from the project root.
const component = readFileSync(resolve('src/client/sync/ConnectionSettings.tsx'), 'utf8')
const css = readFileSync(resolve('src/client/sync/Sync.module.css'), 'utf8')

/** An already signed-in 云效 connection: the editor asks the host about its authorization. */
const authorized: SafeConnection = {
  id: 'c1', name: '云效 · 示例企业', enabled: true, revision: 1, authentication: { mode: 'oauth' },
  fillFields: ['title', 'description'], credentialPresent: false, instance: 'org-1', platform: 'yunxiao',
  mode: 'center', organizationId: 'org-1', regionHost: null, tokenEnv: 'TASK_LIST_YUNXIAO_TOKEN',
}

function editor(options: { connection?: SafeConnection | null; face?: Partial<SyncFace>; onDeleted?: () => Promise<void> } = {}) {
  const calls = { organizations: 0 }
  const api = {
    getSyncAuthState: async () => ({
      connectionId: 'c1', status: 'authorized' as const, attemptId: null, expiresAt: null,
      accountLabel: '张国文', resourceIds: [], error: null,
    }),
    listSyncOrganizations: async () => {
      calls.organizations += 1
      return [{ id: 'org-1', name: '示例企业' }]
    },
    ...options.face,
  } as unknown as SyncFace
  render(<ConnectionSettings connection={options.connection === undefined ? authorized : options.connection}
    face={api} t={t} onSaved={async () => {}} onBack={() => {}} onDeleted={options.onDeleted} />)
  return calls
}

describe('connection editor usability', () => {
  it('selects the account’s only organization without a click', () => {
    const calls = editor()
    return waitFor(() => {
      expect(calls.organizations).toBe(1)
      // The choice shows the resolved name instead of the empty placeholder.
      expect(screen.getByRole('button', { name: zh.syncOrganization }).textContent).toContain('示例企业')
    })
  })

  it('offers 云效’s own prefill catalog: custom fields and the source number', () => {
    editor({ connection: null })
    expect(screen.getByLabelText(zh.fillCustomFields)).toBeTruthy()
    expect(screen.getByLabelText(zh.fillSource)).toBeTruthy()
    // The platform selector is gone: 云效 Projex is the only platform this
    // editor can configure, and the retired TAPD-only fields never appear.
    expect(screen.queryByRole('button', { name: zh.syncPlatform })).toBeNull()
    expect(screen.queryByLabelText(zh.fillTags)).toBeNull()
    expect(screen.queryByLabelText(zh.fillCreator)).toBeNull()
  })

  it('saves the picked organization together with the typed token', async () => {
    const requests: unknown[] = []
    const saved: unknown[] = []
    editor({
      connection: null,
      face: {
        listSyncOrganizations: async request => { requests.push(request); return [{ id: '56474829', name: '示例组织' }] },
        createSyncConnection: async request => { saved.push(request); return { ...request, id: 'new', revision: 1, credentialPresent: true, instance: 'org-1' } as never },
      },
    })
    // A typed credential is the manual method; official authorization is the default.
    fireEvent.click(screen.getByRole('button', { name: zh.syncAuthMethod }))
    fireEvent.click(await screen.findByRole('menuitem', { name: zh.syncManualToken }))
    fireEvent.change(screen.getByLabelText(zh.syncToken), { target: { value: 'pat-1' } })
    fireEvent.click(screen.getByRole('button', { name: zh.syncOrganization }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '示例组织' }))
    fireEvent.click(screen.getByRole('button', { name: zh.syncSaveConnection }))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(requests[0]).toMatchObject({ token: 'pat-1' })
    expect(saved[0]).toMatchObject({
      platform: 'yunxiao', mode: 'center', organizationId: '56474829', secret: { platform: 'yunxiao', token: 'pat-1' },
    })
  })

  it('names the platform’s refusal instead of hiding it', async () => {
    editor({
      connection: null,
      face: {
        listSyncOrganizations: async () => { throw Object.assign(new Error('refused'), { code: 'task-list/sync', details: { code: 'AuthDenied', docKey: 'permissions' } }) },
      },
    })
    fireEvent.click(screen.getByRole('button', { name: zh.syncAuthMethod }))
    fireEvent.click(await screen.findByRole('menuitem', { name: zh.syncManualToken }))
    fireEvent.change(screen.getByLabelText(zh.syncToken), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: zh.syncOrganization }))
    const alert = await screen.findByRole('alert')
    // The platform's refusal is named, so a truncated paste is not mistaken for a bug.
    expect(alert.textContent).toContain(zh.syncSafeError)
    expect(alert.textContent).toContain('AuthDenied')
  })

  it('paints sign-in as the primary action and deletion as destructive', () => {
    // The host Button has no destructive variant, so the colour comes from the
    // theme token while the button keeps the host geometry.
    expect(component).toMatch(/<Button variant="primary"[\s\S]*?\{t\('syncLoginCloud'\)\}<\/Button>/u)
    expect(component).toContain('className={armed ? css.dangerArmed : css.danger}')
    expect(css).toMatch(/\.danger, \.dangerArmed \{[^}]*state-error-primary/u)
    expect(css).toMatch(/\.dangerArmed \{[^}]*background: var\(--dsw-alias-state-error-primary/u)
  })
})
