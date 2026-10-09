import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SafeConnection } from '../../sync/dto.ts'
import type { SafeAuthState } from '../../sync/oauth-types.ts'
import type { SyncFace } from './face.ts'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

/**
 * Drives one connection's official authorization: start it, poll it, cancel it,
 * or drop it. The owning editor reads the state through `onState` (the account
 * label and the authorized edge are its business) and may take the actions over
 * with `actions={false}` so they can sit in the editor's own account field.
 */
export function ConnectionAuthorization({ connection, platform, tapdConfigured, face, t, onState, actions = true }: {
  connection: SafeConnection | null
  platform: 'yunxiao' | 'tapd'
  tapdConfigured: boolean
  face: SyncFace
  t: SyncTranslate
  onState?: (state: SafeAuthState | null) => void
  actions?: boolean
}) {
  const [state, setState] = useState<SafeAuthState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [url, setUrl] = useState('')
  const mounted = useRef(true)
  const notify = useRef(onState)
  notify.current = onState
  const publish = (next: SafeAuthState | null) => { setState(next); notify.current?.(next) }
  useEffect(() => {
    mounted.current = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const query = async () => {
      if (!connection || connection.authentication?.mode !== 'oauth' || !face.getSyncAuthState) return
      try {
        const next = await face.getSyncAuthState({ connectionId: connection.id })
        if (!mounted.current) return
        publish(next)
        if (next.status === 'waiting') timer = setTimeout(() => void query(), 1500)
      } catch (failure) { if (mounted.current) setError(failure) }
    }
    void query()
    return () => { mounted.current = false; if (timer) clearTimeout(timer) }
  }, [connection?.id, connection?.authentication?.mode, busy])
  const begin = async () => {
    if (busy || !connection || state?.status === 'waiting') return
    setBusy(true); setError(null)
    try {
      const result = await face.beginSyncAuthorization({ connectionId: connection.id })
      if (!mounted.current) return
      setUrl(result.authorizationUrl)
      window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer')
      publish({ connectionId: connection.id, status: 'waiting', attemptId: result.attemptId, expiresAt: result.expiresAt, accountLabel: null, resourceIds: [], projectAccess: 'unverified', error: null })
    } catch (failure) { if (mounted.current) setError(failure) }
    finally { if (mounted.current) setBusy(false) }
  }
  const cancel = async (disconnect: boolean) => {
    if (!connection || busy) return
    setBusy(true); setError(null)
    try {
      if (disconnect) await face.disconnectSyncAuthorization({ connectionId: connection.id })
      else if (state?.attemptId) await face.cancelSyncAuthorization({ connectionId: connection.id, attemptId: state.attemptId })
      setUrl(''); publish(null)
    } catch (failure) { if (mounted.current) setError(failure) }
    finally { if (mounted.current) setBusy(false) }
  }
  /** Exposed to the owning editor so its account field can drive the same flow. */
  const login = <Button variant="primary" disabled={!connection || connection.authentication?.mode !== 'oauth' || busy || platform === 'tapd' && !tapdConfigured || state?.status === 'unavailable'} onClick={() => void begin()}>{t(platform === 'yunxiao' ? 'syncLoginCloud' : 'syncLoginTapd')}</Button>
  return <div className={css.auth}>
    {error !== null && <SyncFailure error={error} t={t} />}
    {state?.status === 'unavailable' && <p>{t('syncAuthUnavailable')}</p>}
    {state?.status === 'authorized' && <strong>{state.accountLabel ?? t('syncAuthDone')}</strong>}
    {state?.status === 'expired' && <p>{t('syncAuthExpired')}</p>}
    {actions && (state?.status === 'waiting' ? <>
      <p role="status">{t('syncAuthWaiting')}</p>
      {url && <a href={url} target="_blank" rel="noopener noreferrer">{t('syncAuthContinue')}</a>}
      <Button disabled={busy} onClick={() => void cancel(false)}>{t('syncAuthCancel')}</Button>
    </> : login)}
    {actions && state && ['authorized', 'expired', 'failed'].includes(state.status) && <Button disabled={busy} onClick={() => void cancel(true)}>{t('syncAuthDisconnect')}</Button>}
  </div>
}
