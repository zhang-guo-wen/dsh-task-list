import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConnectionSecret, OrganizationChoice, WorkitemFillField, YunxiaoConnection } from '../../sync/dto.ts'
import type { SafeAuthState } from '../../sync/oauth-types.ts'
import type { SyncFace } from './face.ts'
import { ConnectionAuthorization } from './ConnectionAuthorization.tsx'
import { Choice } from './RuleFields.tsx'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import { fillFieldsFor } from '../workitem-fill.ts'
import { DEFAULT_WORKITEM_FILL_FIELDS } from '../../sync/dto.ts'
import css from './Sync.module.css'

/**
 * The environment variable the connection falls back on when no credential is
 * typed. The editor no longer asks for it: a credential typed here is stored in
 * the Host credential store and wins, and this default keeps the stored shape
 * and every existing row readable.
 */
const DEFAULT_ENV = { tokenEnv: 'TASK_LIST_YUNXIAO_TOKEN' } as const

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
 *
 * Only 云效 Projex is supported. It authenticates either with official
 * authorization (the default) or with a personal access token typed here; the
 * token is stored in the Host credential store and never read back.
 */
export function ConnectionSettings({ connection, face, t, onSaved, onBack, onDeleted }: { connection: YunxiaoConnection | null; face: SyncFace; t: SyncTranslate; onSaved: (connection: YunxiaoConnection) => Promise<void>; onBack: () => void; onDeleted?: () => Promise<void> }) {
  const [resource, setResource] = useState(connection?.organizationId ?? '')
  const [token, setToken] = useState('')
  const [authMode, setAuthMode] = useState<'manual' | 'oauth'>(connection?.authentication?.mode ?? 'oauth')
  const [enabled, setEnabled] = useState(connection?.enabled ?? false)
  /** Work-item data a new task starts with, chosen here and saved with the connection. */
  const [fillFields, setFillFields] = useState<readonly WorkitemFillField[]>(() => connection?.fillFields ?? [...DEFAULT_WORKITEM_FILL_FIELDS])
  const [organizations, setOrganizations] = useState<OrganizationChoice[] | null>(null)
  const [auth, setAuth] = useState<SafeAuthState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const gate = useRef(false)
  const autoRead = useRef(false)
  const [armed, setArmed] = useState(false)
  const typed = token.trim() !== ''
  const credentialReady = typed || Boolean(connection?.credentialPresent)
  // A manual save needs the organization (it is what the API path is built
  // from); an authorized account picks it from its own list.
  const ready = authMode === 'manual' ? credentialReady && Boolean(resource.trim()) : true
  /** Stored connections keep their name unless the resolved organization names one better. */
  const organizationName = organizations?.find(row => row.id === resource.trim())?.name
  const connectionName = (organization: string, label: string | undefined): string => label !== undefined
    ? `云效 · ${label}`
    : connection?.name.trim() || `云效 · ${organization}`
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
  const readOrganizations = () => act(async () => {
    setOrganizations(null)
    const rows = await face.listSyncOrganizations({ ...(token.trim() ? { token: token.trim() } : {}), ...(connection ? { connectionId: connection.id } : {}) })
    setOrganizations(rows)
    // One organization needs no further choice; with several, keep the current
    // pick when it is still valid and otherwise take the first.
    if (rows.length > 0) {
      const current = resource.trim()
      setResource(rows.length === 1 || !rows.some(row => row.id === current) ? rows[0]!.id : current)
    }
  })
  /**
   * An authorized account resolves its own organization list without a click:
   * the sign-in state can arrive before this component has a saved connection,
   * so the read is retried once both are in place.
   */
  useEffect(() => {
    if (authMode !== 'oauth') return
    if (autoRead.current || organizations !== null) return
    if (auth?.status !== 'authorized' || connection === null) return
    autoRead.current = true
    void readOrganizations()
  })
  /**
   * Sign in first, save later: the authorization needs a persisted connection,
   * so an unsaved draft is written on the way in rather than asked for up front.
   */
  const startAuthorization = () => act(async () => {
    const current = connection ?? await persist()
    const result = await face.beginSyncAuthorization({ connectionId: current.id })
    window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer')
    setAuth({ connectionId: current.id, status: 'waiting', attemptId: result.attemptId, expiresAt: result.expiresAt, accountLabel: null, resourceIds: [], error: null })
  })
  const cancelAuthorization = (waiting: boolean) => act(async () => {
    if (!connection) return
    if (waiting && auth?.attemptId) await face.cancelSyncAuthorization({ connectionId: connection.id, attemptId: auth.attemptId })
    else { await face.disconnectSyncAuthorization({ connectionId: connection.id }); setOrganizations(null); setResource('') }
    setAuth(null)
  })
  /** Write the draft and return the saved row; both Save and the sign-in action use it. */
  const persist = async (): Promise<YunxiaoConnection> => {
    const oauth = authMode === 'oauth'
    const authentication = oauth ? { mode: 'oauth' as const } : { mode: 'manual' as const }
    const secret: ConnectionSecret | undefined = !oauth && typed ? { platform: 'yunxiao', token: token.trim() } : undefined
    const organization = resource.trim()
    const name = connectionName(organization, organizationName)
    const common = {
      name, platform: 'yunxiao' as const, mode: 'center' as const, regionHost: null, organizationId: organization,
      authentication, fillFields: [...fillFields], ...DEFAULT_ENV, ...(secret ? { secret } : {}),
    }
    const next = connection
      ? await face.updateSyncConnection({ id: connection.id, revision: connection.revision, ...common, enabled: connection.credentialPresent ? enabled : false })
      : await face.createSyncConnection({ ...common, enabled: false })
    if (next.platform !== 'yunxiao') throw new Error('sync connection is not Yunxiao')
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
  return <section className={css.editor}>
    <h3 className={css.editorTitle}>{t(connection ? 'syncConfigure' : 'syncNewConnection')}</h3>
    {error !== null && <SyncFailure error={error} t={t} />}
    {notice && <p role="status">{notice}</p>}
    <div className={css.editorBox}>
      <div className={css.formGrid}>
        <Choice label={t('syncAuthMethod')} value={authMode} options={[{ id: 'manual', label: t('syncManualToken') }, { id: 'oauth', label: t('syncOAuthMode') }]} onChange={id => setAuthMode(id as 'manual' | 'oauth')} />
      </div>
      {authMode === 'manual' ? <>
        <div className={css.formGrid}>
          <label>{t('syncToken')}<Input type="password" data-modal-autofocus aria-label={t('syncToken')} autoComplete="off"
            placeholder={connection?.credentialPresent ? t('syncCredentialStored') : t('syncTokenPlaceholder')} value={token} maxLength={4096} disabled={busy} onChange={event => setToken(event.target.value)} /></label>
          {/* The organization sits beside the credential; opening the menu is
              what fetches the list, so no separate read button is needed. */}
          <Choice label={t('syncOrganization')} value={resource} options={(organizations ?? []).map(row => ({ id: row.id, label: row.name }))}
            disabled={busy} onOpen={() => { if (organizations === null) void readOrganizations() }} onChange={setResource} />
        </div>
      </> : <div className={css.formGrid}>
        {/* Account first, organization second: that is the order they happen
            in — signing in is what makes the organization list available. */}
        <div className={css.field}><span className={css.fieldLabel}>{t('syncAccount')}</span>
          {auth?.status === 'authorized'
            ? <div className={css.accountRow}><span className={css.accountValue}>{auth.accountLabel ?? t('syncAuthDone')}</span>
              <Button size="sm" disabled={busy} onClick={() => void cancelAuthorization(false)}>{t('syncAuthDisconnect')}</Button></div>
            : auth?.status === 'waiting'
              ? <div className={css.accountRow}><span className={css.accountValue}>{t('syncAuthWaiting')}</span>
                <Button size="sm" disabled={busy} onClick={() => void cancelAuthorization(true)}>{t('syncAuthCancel')}</Button></div>
              : <div className={css.accountRow}><Button variant="primary" disabled={busy} onClick={() => void startAuthorization()}>{t('syncLoginCloud')}</Button></div>}
        </div>
        <Choice label={t('syncOrganization')} value={resource} options={(organizations ?? []).map(row => ({ id: row.id, label: row.name }))}
          disabled={busy} onOpen={() => { if (organizations === null && connection) void readOrganizations() }} onChange={setResource} />
      </div>}
      {authMode === 'oauth' && <ConnectionAuthorization connection={connection} face={face} t={t} onState={handleAuthState} />}
      {/* Which work-item data a new task starts with. It belongs to the
          connection, so the "more tasks" page hands the draft over with the
          selection that belongs to the connection it is reading. */}
      <fieldset className={css.fillSettings}>
        <legend>{t('fillSettingsTitle')}</legend>
        <p className={css.hint}>{t('fillSettingsHint')}</p>
        <div className={css.fillGrid}>
          {fillFieldsFor('yunxiao').map(field => <label key={field.id} className={css.fillRow}>
            <input type="checkbox" checked={fillFields.includes(field.id)} disabled={busy}
              onChange={() => setFillFields(current => current.includes(field.id) ? current.filter(entry => entry !== field.id) : [...current, field.id])} />
            <span>{t(field.label)}</span>
          </label>)}
        </div>
      </fieldset>
      <div className={css.editorActions}>
        {/* Removal lives inside the editor it applies to; the first click only
            arms it, so a stored connection is never dropped by one stray click. */}
        {connection && onDeleted && <Button className={armed ? css.dangerArmed : css.danger} disabled={busy} onClick={() => void remove()}>{armed ? t('syncDeleteConfirm') : t('syncDeleteConnection')}</Button>}
        <div className={css.editorButtons}>
          <Button disabled={busy} onClick={onBack}>{t('cancel')}</Button>
          <Button variant="primary" disabled={busy || !ready} onClick={() => void save()}>{t('syncSaveConnection')}</Button>
        </div>
      </div>
    </div>
  </section>
}
