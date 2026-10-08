import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SyncFace } from './face.ts'
import { useSyncRun } from './use-sync-run.ts'
import { SyncFailure, SyncResults, type SyncTranslate } from './SyncResults.tsx'
import { SyncSettings, type WorkspaceChoice } from './SyncSettings.tsx'
import css from './Sync.module.css'
export function SyncControls({ face, t, workspaces, onComplete }: { face: SyncFace; t: SyncTranslate; workspaces: readonly WorkspaceChoice[]; onComplete: () => void }) {
  const state = useSyncRun(face)
  const [settings, setSettings] = useState(false)
  const [ready, setReady] = useState(false)
  const [scopeError, setScopeError] = useState<unknown>(null)
  const [scopeLoaded, setScopeLoaded] = useState(false)
  const completed = useRef<string | null>(null)
  const generation = useRef(0)
  const loadScope = useCallback(async () => {
    const current = ++generation.current
    try {
      const [connections, rules] = await Promise.all([face.listSyncConnections(), face.listSyncRules()])
      if (current !== generation.current) return
      setReady(rules.some(rule => rule.enabled && connections.some(connection => connection.id === rule.connectionId && connection.enabled && connection.credentialPresent)))
      setScopeError(null)
    } catch (error) { if (current === generation.current) { setReady(false); setScopeError(error) } }
    finally { if (current === generation.current) setScopeLoaded(true) }
  }, [face])
  useEffect(() => { void loadScope(); return () => { generation.current++ } }, [loadScope])
  useEffect(() => {
    if (!state.run || state.run.status === 'running' || completed.current === state.run.id) return
    completed.current = state.run.id; onComplete()
  }, [state.run, onComplete])
  return <div className={css.controls}>
    <div className={css.actions}>
      <Button variant="primary" disabled={!ready || state.starting || state.run?.status === 'running'} onClick={() => void state.start()}>{t('sync')}</Button>
      <Button onClick={() => setSettings(true)}>{t('syncSettings')}</Button>
    </div>
    <p>{t('syncScope')}</p><p>{t('syncConflict')}</p>
    {scopeLoaded && !ready && !scopeError && <p>{t('syncNoScope')}</p>}
    {scopeError !== null && <SyncFailure error={scopeError} t={t} />}
    {state.queryError !== null && <><SyncFailure error={state.queryError} t={t} /><p>{t('syncQueryFailed')}</p><Button onClick={() => void state.reconnect()}>{t('syncReconnect')}</Button></>}
    {state.run && <SyncResults run={state.run} items={state.items} t={t} changePage={state.changePage} />}
    {settings && <SyncSettings face={face} t={t} workspaces={workspaces} onClose={() => setSettings(false)} onSaved={() => void loadScope()} />}
  </div>
}
