import { useEffect, useRef, useState } from 'react'
import type { SafeConnection } from '../../sync/dto.ts'
import type { SafeAuthState } from '../../sync/oauth-types.ts'
import type { SyncFace } from './face.ts'
import { SyncFailure, type SyncTranslate } from './SyncResults.tsx'
import css from './Sync.module.css'

/**
 * Polls one 云效 connection's official authorization and reports its state to
 * the owning editor, which owns every action: starting the sign-in, cancelling
 * an attempt, and disconnecting all live in the editor's account field, so this
 * surface only ever explains what the protocol last answered.
 */
export function ConnectionAuthorization({ connection, face, t, onState }: {
  connection: SafeConnection | null
  face: SyncFace
  t: SyncTranslate
  onState?: (state: SafeAuthState | null) => void
}) {
  const [state, setState] = useState<SafeAuthState | null>(null)
  const [error, setError] = useState<unknown>(null)
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
  }, [connection?.id, connection?.authentication?.mode])
  return <div className={css.auth}>
    {error !== null && <SyncFailure error={error} t={t} />}
    {state?.status === 'unavailable' && <p>{t('syncAuthUnavailable')}</p>}
    {state?.status === 'authorized' && <strong>{state.accountLabel ?? t('syncAuthDone')}</strong>}
    {state?.status === 'expired' && <p>{t('syncAuthExpired')}</p>}
  </div>
}
