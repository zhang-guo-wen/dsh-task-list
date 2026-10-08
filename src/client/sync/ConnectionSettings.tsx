import { useRef, useState } from 'react'
import { Button, Checkbox, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SafeConnection } from '../../sync/dto.ts'
import type { SyncFace } from './face.ts'
import { ConnectionAuthorization } from './ConnectionAuthorization.tsx'
import { Choice } from './RuleFields.tsx'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

export function ConnectionSettings({ connection, face, t, onSaved, onBack }: { connection: SafeConnection | null; face: SyncFace; t: SyncTranslate; onSaved: (connection: SafeConnection) => Promise<void>; onBack: () => void }) {
  const [platform, setPlatform] = useState<'tapd' | 'yunxiao'>(connection?.platform ?? 'yunxiao')
  const [name, setName] = useState(connection?.name ?? '')
  const [resource, setResource] = useState(connection ? connection.platform === 'tapd' ? connection.companyId : connection.organizationId : '')
  const [userEnv, setUserEnv] = useState(connection?.platform === 'tapd' ? connection.userEnv : 'TAPD_USER')
  const [passwordEnv, setPasswordEnv] = useState(connection?.platform === 'tapd' ? connection.passwordEnv : 'TAPD_PASS')
  const [tokenEnv, setTokenEnv] = useState(connection?.platform === 'yunxiao' ? connection.tokenEnv : 'YUNXIAO_TOKEN')
  const [authMode, setAuthMode] = useState<'manual' | 'oauth'>(connection?.authentication?.mode ?? (connection ? 'manual' : 'oauth'))
  const [appId, setAppId] = useState(connection?.authentication?.mode === 'oauth' ? connection.authentication.appId ?? '' : '')
  const [appSecretRef, setAppSecretRef] = useState(connection?.authentication?.mode === 'oauth' ? connection.authentication.appSecretRef ?? '' : '')
  const [callbackUrl, setCallbackUrl] = useState(connection?.authentication?.mode === 'oauth' ? connection.authentication.callbackUrl ?? '' : '')
  const [enabled, setEnabled] = useState(connection?.enabled ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const gate = useRef(false)
  const validEnv = (value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
  const ready = Boolean(name.trim() && resource.trim() && (platform === 'tapd' ? validEnv(userEnv) && validEnv(passwordEnv) : validEnv(tokenEnv)))
  const act = async (operation: () => Promise<void>) => {
    if (gate.current) return
    gate.current = true; setBusy(true); setError(null); setNotice('')
    try { await operation() } catch (failure) { setError(failure) }
    finally { gate.current = false; setBusy(false) }
  }
  const save = () => act(async () => {
    if (!ready) return
    const authentication = authMode === 'manual' ? { mode: 'manual' as const } : { mode: 'oauth' as const, ...(platform === 'tapd' ? { ...(appId ? { appId } : {}), ...(appSecretRef ? { appSecretRef } : {}), ...(callbackUrl ? { callbackUrl } : {}) } : {}) }
    const common = { name: name.trim(), enabled: connection?.credentialPresent ? enabled : false, authentication }
    const values = platform === 'tapd' ? { ...common, companyId: resource.trim(), userEnv, passwordEnv } : { ...common, mode: 'center' as const, regionHost: null, organizationId: resource.trim(), tokenEnv }
    const next = connection ? await face.updateSyncConnection({ id: connection.id, revision: connection.revision, ...values })
      : platform === 'tapd' ? await face.createSyncConnection({ ...common, platform, companyId: resource.trim(), userEnv, passwordEnv, enabled: false })
      : await face.createSyncConnection({ ...common, platform, mode: 'center', regionHost: null, organizationId: resource.trim(), tokenEnv, enabled: false })
    await onSaved(next)
    if (authMode === 'manual') onBack()
  })
  return <section className={css.editor}>
    <div className={css.sectionHeading}><Button size="sm" onClick={onBack}>{t('syncBack')}</Button><h3>{t(connection ? 'syncConfigure' : 'syncNewConnection')}</h3></div>
    {error !== null && <SyncFailure error={error} t={t} />}
    {notice && <p role="status">{notice}</p>}
    <div className={css.formGrid}>
      <Choice label={t('syncPlatform')} value={platform} options={[{ id: 'yunxiao', label: '云效 Projex' }, { id: 'tapd', label: 'TAPD' }]} disabled={connection !== null || busy} onChange={id => setPlatform(id as 'tapd' | 'yunxiao')} />
      <label>{t('syncName')}<Input data-modal-autofocus aria-label={t('syncName')} value={name} maxLength={100} onChange={event => setName(event.target.value)} disabled={busy} /></label>
    </div>
    <label>{t(platform === 'tapd' ? 'syncCompany' : 'syncOrganization')}<Input aria-label={t(platform === 'tapd' ? 'syncCompany' : 'syncOrganization')} value={resource} onChange={event => setResource(event.target.value)} disabled={busy} /></label>
    <Choice label={t('syncAuthMethod')} value={authMode} options={[{ id: 'oauth', label: t('syncOAuthMode') }, { id: 'manual', label: t('syncManualMode') }]} onChange={id => setAuthMode(id as 'oauth' | 'manual')} />
    {authMode === 'oauth' && <ConnectionAuthorization connection={connection} platform={platform} tapdConfigured={Boolean(appId && appSecretRef && callbackUrl)} face={face} t={t} />}
    {platform === 'tapd' && <details className={css.alternative}><summary>{t('syncTapdAppRequired')}</summary><div className={css.formGrid}>
      <label>{t('syncAppId')}<Input aria-label={t('syncAppId')} value={appId} onChange={event => { setAppId(event.target.value); setAuthMode('oauth') }} /></label>
      <label>{t('syncAppSecretRef')}<Input aria-label={t('syncAppSecretRef')} value={appSecretRef} onChange={event => setAppSecretRef(event.target.value)} /></label>
      <label>{t('syncCallbackUrl')}<Input aria-label={t('syncCallbackUrl')} value={callbackUrl} onChange={event => setCallbackUrl(event.target.value)} /></label>
    </div></details>}
    <details className={css.alternative} open={authMode === 'manual'}>
      <summary>{t('syncManualAuth')}</summary>
      <p>{t('syncCredentialHint')}</p>
      <div className={css.formGrid}>
        {platform === 'tapd' ? <>
          <label>{t('syncUserEnv')}<Input aria-label={t('syncUserEnv')} value={userEnv} onChange={event => setUserEnv(event.target.value)} disabled={busy} /></label>
          <label>{t('syncPasswordEnv')}<Input aria-label={t('syncPasswordEnv')} value={passwordEnv} onChange={event => setPasswordEnv(event.target.value)} disabled={busy} /></label>
        </> : <label>{t('syncTokenEnv')}<Input aria-label={t('syncTokenEnv')} value={tokenEnv} onChange={event => setTokenEnv(event.target.value)} disabled={busy} /></label>}
      </div>
    </details>
    {connection && !connection.credentialPresent && <p>{t('syncCredentialMissing')}</p>}
    {connection && <Checkbox label={t('syncEnableConnection')} checked={enabled} disabled={busy || !connection.credentialPresent} onChange={setEnabled} />}
    <div className={css.editorActions}>
      {connection && <Button disabled={busy} onClick={() => void act(async () => {
        const result = await face.testSyncConnection({ connectionId: connection.id })
        if (!result.ok) { setError(result.error ?? { code: 'CredentialMissing' }); return }
        setNotice(t('syncTestOk'))
      })}>{t('syncTest')}</Button>}
      <Button variant="primary" disabled={busy || !ready} onClick={() => void save()}>{t('syncSaveConnection')}</Button>
    </div>
  </section>
}
