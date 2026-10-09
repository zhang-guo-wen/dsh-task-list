import { useRef, useState } from 'react'
import { Button, Checkbox, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConnectionSecret, OrganizationChoice, SafeConnection } from '../../sync/dto.ts'
import type { SafeAuthState } from '../../sync/oauth-types.ts'
import type { SyncFace } from './face.ts'
import { ConnectionAuthorization } from './ConnectionAuthorization.tsx'
import { Choice } from './RuleFields.tsx'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

/**
 * Environment names a connection still records for the Host to fall back on.
 * The editor no longer asks for them: a credential typed here is stored in the
 * Host credential store and wins, and these defaults keep the stored shape and
 * every existing row readable.
 */
const DEFAULT_ENV = {
  yunxiao: { tokenEnv: 'TASK_LIST_YUNXIAO_TOKEN' },
  tapd: { userEnv: 'TASK_LIST_TAPD_USER', passwordEnv: 'TASK_LIST_TAPD_PASSWORD' },
} as const

/**
 * Read a company/organization id out of whatever the user pasted: a workbench
 * address yields its id segment, and anything else is treated as the id itself.
 * A 云效 project link carries a project id, not an organization, so it is left
 * as typed here rather than silently stored as the wrong identifier.
 */
export function resourceIdFrom(text: string, platform: 'yunxiao' | 'tapd'): string {
  const value = text.trim()
  if (!value) return ''
  const match = platform === 'tapd' ? /tapd\.cn\/(\d+)/u.exec(value) : /(?:organizations?|orgs?)\/([A-Za-z0-9_-]{4,})/u.exec(value)
  return match?.[1] ?? value
}

/**
 * Read a project id out of a pasted address. 云效 workbench links spell the
 * project id right after `/projex/project/`; anything else is the id itself.
 */
export function projectIdFrom(text: string, platform: 'yunxiao' | 'tapd' | undefined): string {
  const value = text.trim()
  if (!value || platform !== 'yunxiao') return value
  return /\/projex\/project\/([A-Za-z0-9]+)/u.exec(value)?.[1] ?? value
}

/**
 * One connection's editor, drawn as a bordered card whose own footer saves or
 * discards it — there is no separate "back to list" affordance, because the
 * card is the whole page state while it is open.
 */
export function ConnectionSettings({ connection, face, t, onSaved, onBack, onDeleted }: { connection: SafeConnection | null; face: SyncFace; t: SyncTranslate; onSaved: (connection: SafeConnection) => Promise<void>; onBack: () => void; onDeleted?: () => Promise<void> }) {
  const [platform, setPlatform] = useState<'tapd' | 'yunxiao'>(connection?.platform ?? 'yunxiao')
  const [resource, setResource] = useState(connection ? connection.platform === 'tapd' ? connection.companyId : connection.organizationId : '')
  const [token, setToken] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  // 云效 opens on its official sign-in; TAPD's official path needs an admin
  // application, so a fresh TAPD connection opens on manual credentials.
  const [authMode, setAuthMode] = useState<'manual' | 'oauth'>(connection?.authentication?.mode ?? (platform === 'yunxiao' ? 'oauth' : 'manual'))
  const [appId, setAppId] = useState(connection?.authentication?.mode === 'oauth' ? connection.authentication.appId ?? '' : '')
  const [appSecretRef, setAppSecretRef] = useState(connection?.authentication?.mode === 'oauth' ? connection.authentication.appSecretRef ?? '' : '')
  const [callbackUrl, setCallbackUrl] = useState(connection?.authentication?.mode === 'oauth' ? connection.authentication.callbackUrl ?? '' : '')
  const [enabled, setEnabled] = useState(connection?.enabled ?? false)
  const [organizations, setOrganizations] = useState<OrganizationChoice[] | null>(null)
  const [auth, setAuth] = useState<SafeAuthState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const gate = useRef(false)
  const autoRead = useRef(false)
  const [armed, setArmed] = useState(false)
  const typed = platform === 'yunxiao' ? token.trim() !== '' : user.trim() !== '' && password.trim() !== ''
  const credentialReady = typed || Boolean(connection?.credentialPresent)
  // A 云效 OAuth connection is saved first and picks its organization from the
  // authorized account's own list; every other path needs the id up front.
  const ready = authMode === 'manual'
    ? Boolean(resource.trim()) && credentialReady
    : platform === 'yunxiao' || Boolean(resource.trim())
  /** Stored connections keep their name unless the resolved organization names one better. */
  const organizationName = organizations?.find(row => row.id === resource.trim())?.name
  const name = platform === 'yunxiao' && organizationName
    ? `云效 · ${organizationName}`
    : connection?.name.trim() || (platform === 'yunxiao' ? `云效 · ${resource.trim()}` : `TAPD · ${resource.trim()}`)
  const act = async (operation: () => Promise<void>) => {
    if (gate.current) return
    gate.current = true; setBusy(true); setError(null); setNotice('')
    try { await operation() } catch (failure) { setError(failure) }
    finally { gate.current = false; setBusy(false) }
  }
  /** Authorization state, plus the one automatic organization read it unlocks. */
  const handleAuthState = (next: SafeAuthState | null) => {
    setAuth(next)
    if (next?.status === 'authorized' && connection && !autoRead.current) {
      autoRead.current = true
      void readOrganizations()
    }
  }
  const readOrganizations = () => act(async () => {    setOrganizations(null)
    const rows = await face.listSyncOrganizations({ ...(token.trim() ? { token: token.trim() } : {}), ...(connection ? { connectionId: connection.id } : {}) })
    setOrganizations(rows)
    if (rows.length > 0 && !resource.trim()) setResource(rows[0]!.id)
  })
  /**
   * Sign in first, save later: the authorization needs a persisted connection,
   * so an unsaved draft is written on the way in rather than asked for up front.
   */
  const startAuthorization = () => act(async () => {
    const current = connection ?? await persist()
    const result = await face.beginSyncAuthorization({ connectionId: current.id })
    window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer')
    setAuth({ connectionId: current.id, status: 'waiting', attemptId: result.attemptId, expiresAt: result.expiresAt, accountLabel: null, resourceIds: [], projectAccess: 'unverified', error: null })
  })
  const cancelAuthorization = (waiting: boolean) => act(async () => {
    if (!connection) return
    if (waiting && auth?.attemptId) await face.cancelSyncAuthorization({ connectionId: connection.id, attemptId: auth.attemptId })
    else { await face.disconnectSyncAuthorization({ connectionId: connection.id }); setOrganizations(null); setResource('') }
    setAuth(null)
  })
  /** Write the draft and return the saved row; both Save and the sign-in action use it. */
  const persist = async (): Promise<SafeConnection> => {
    const authentication = authMode === 'manual' ? { mode: 'manual' as const } : { mode: 'oauth' as const, ...(platform === 'tapd' ? { ...(appId ? { appId } : {}), ...(appSecretRef ? { appSecretRef } : {}), ...(callbackUrl ? { callbackUrl } : {}) } : {}) }
    const secret: ConnectionSecret | undefined = authMode === 'manual' && typed
      ? platform === 'yunxiao' ? { platform: 'yunxiao', token: token.trim() } : { platform: 'tapd', user: user.trim(), password: password.trim() }
      : undefined
    const common = { name, enabled: connection?.credentialPresent ? enabled : false, authentication, ...(secret ? { secret } : {}) }
    const values = platform === 'tapd' ? { ...common, companyId: resource.trim(), ...DEFAULT_ENV.tapd } : { ...common, mode: 'center' as const, regionHost: null, organizationId: resource.trim(), ...DEFAULT_ENV.yunxiao }
    const next = connection ? await face.updateSyncConnection({ id: connection.id, revision: connection.revision, ...values })
      : platform === 'tapd' ? await face.createSyncConnection({ ...common, platform, companyId: resource.trim(), ...DEFAULT_ENV.tapd, enabled: false })
      : await face.createSyncConnection({ ...common, platform, mode: 'center', regionHost: null, organizationId: resource.trim(), ...DEFAULT_ENV.yunxiao, enabled: false })
    await onSaved(next)
    return next
  }
  const save = () => act(async () => {
    if (!ready) return
    await persist()
    // Saving always returns to the roster, whichever authentication it records.
    onBack()
  })
  /** Two-step removal: the button arms on the first click, deletes on the second. */
  const remove = () => act(async () => {
    if (!connection || !onDeleted) return
    if (!armed) { setArmed(true); return }
    await face.deleteSyncConnection({ id: connection.id, revision: connection.revision })
    await onDeleted()
  })
  const resourceLabel = t(platform === 'tapd' ? 'syncCompany' : 'syncOrganization')
  return <section className={css.editor}>
    <h3 className={css.editorTitle}>{t(connection ? 'syncConfigure' : 'syncNewConnection')}</h3>
    {error !== null && <SyncFailure error={error} t={t} />}
    {notice && <p role="status">{notice}</p>}
    <div className={css.editorBox}>
      <div className={css.formGrid}>
        <Choice label={t('syncPlatform')} value={platform} options={[{ id: 'yunxiao', label: '云效 Projex' }, { id: 'tapd', label: 'TAPD' }]} disabled={connection !== null || busy} onChange={id => { setPlatform(id as 'tapd' | 'yunxiao'); setOrganizations(null); setAuthMode(id === 'yunxiao' ? 'oauth' : 'manual') }} />
        <Choice label={t('syncAuthMethod')} value={authMode} options={platform === 'yunxiao'
          ? [{ id: 'manual', label: t('syncManualToken') }, { id: 'oauth', label: t('syncOAuthMode') }]
          : [{ id: 'manual', label: t('syncManualCredentials') }, { id: 'oauth', label: t('syncOAuthMode') }]} onChange={id => setAuthMode(id as 'manual' | 'oauth')} />
      </div>
      {authMode === 'manual' ? <>
        <div className={css.formGrid}>
          {platform === 'yunxiao' ? <label>{t('syncToken')}<Input type="password" data-modal-autofocus aria-label={t('syncToken')} autoComplete="off"
            placeholder={connection?.credentialPresent ? t('syncCredentialStored') : t('syncTokenPlaceholder')} value={token} maxLength={4096} disabled={busy} onChange={event => setToken(event.target.value)} /></label>
            : <>
              <label>{t('syncUser')}<Input data-modal-autofocus aria-label={t('syncUser')} autoComplete="off" placeholder={connection?.credentialPresent ? t('syncCredentialStored') : t('syncUserPlaceholder')} value={user} maxLength={4096} disabled={busy} onChange={event => setUser(event.target.value)} /></label>
              <label>{t('syncPassword')}<Input type="password" aria-label={t('syncPassword')} autoComplete="off" value={password} maxLength={4096} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
            </>}
          {/* The organization sits beside the credential; opening the menu is
              what fetches the list, so no separate read button is needed. */}
          {platform === 'yunxiao' && <Choice label={resourceLabel} value={resource} options={(organizations ?? []).map(row => ({ id: row.id, label: row.name }))}
            disabled={busy} onOpen={() => { if (organizations === null) void readOrganizations() }} onChange={setResource} />}
        </div>
        {platform === 'tapd' && <label className={css.fullRow}>{resourceLabel}<Input aria-label={resourceLabel} placeholder={t('syncCompanyPlaceholder')} value={resource} maxLength={200}
          disabled={busy} onChange={event => setResource(resourceIdFrom(event.target.value, 'tapd'))} /></label>}
      </> : <>
        {platform === 'yunxiao' ? <div className={css.formGrid}>
          {/* Account first, organization second: that is the order they happen
              in — signing in is what makes the organization list available. */}
          <div className={css.field}><span className={css.fieldLabel}>{t('syncAccount')}</span>
            {auth?.status === 'authorized'
              ? <div className={css.accountRow}><span className={css.accountValue}>{auth.accountLabel ?? t('syncAuthDone')}</span>
                <Button size="sm" disabled={busy} onClick={() => void cancelAuthorization(false)}>{t('syncAuthDisconnect')}</Button></div>
              : auth?.status === 'waiting'
                ? <div className={css.accountRow}><span className={css.accountValue}>{t('syncAuthWaiting')}</span>
                  <Button size="sm" disabled={busy} onClick={() => void cancelAuthorization(true)}>{t('syncAuthCancel')}</Button></div>
                : <div className={css.accountRow}><Button variant="outline" disabled={busy} onClick={() => void startAuthorization()}>{t('syncLoginCloud')}</Button></div>}
          </div>
          <Choice label={resourceLabel} value={resource} options={(organizations ?? []).map(row => ({ id: row.id, label: row.name }))}
            disabled={busy} onOpen={() => { if (organizations === null && connection) void readOrganizations() }} onChange={setResource} />
        </div> : <div className={css.formGrid}>
          <label>{resourceLabel}<Input aria-label={resourceLabel} value={resource} maxLength={200} disabled={busy || connection !== null} onChange={event => setResource(resourceIdFrom(event.target.value, 'tapd'))} /></label>
        </div>}
        <ConnectionAuthorization connection={connection} platform={platform} tapdConfigured={Boolean(appId && appSecretRef && callbackUrl)} face={face} t={t}
          actions={platform !== 'yunxiao'} onState={handleAuthState} />
        {platform === 'tapd' && <details className={css.alternative}><summary>{t('syncTapdAppRequired')}</summary><div className={css.formGrid}>
          <label>{t('syncAppId')}<Input aria-label={t('syncAppId')} value={appId} onChange={event => setAppId(event.target.value)} /></label>
          <label>{t('syncAppSecretRef')}<Input aria-label={t('syncAppSecretRef')} value={appSecretRef} onChange={event => setAppSecretRef(event.target.value)} /></label>
          <label>{t('syncCallbackUrl')}<Input aria-label={t('syncCallbackUrl')} value={callbackUrl} onChange={event => setCallbackUrl(event.target.value)} /></label>
        </div></details>}
      </>}
      <div className={css.editorActions}>
        {/* Removal lives inside the editor it applies to; the first click only
            arms it, so a stored connection is never dropped by one stray click. */}
        {connection && onDeleted && <Button disabled={busy} onClick={() => void remove()}>{armed ? t('syncDeleteConfirm') : t('syncDeleteConnection')}</Button>}
        <div className={css.editorButtons}>
          <Button disabled={busy} onClick={onBack}>{t('cancel')}</Button>
          <Button variant="primary" disabled={busy || !ready} onClick={() => void save()}>{t('syncSaveConnection')}</Button>
        </div>
      </div>
    </div>
  </section>
}
