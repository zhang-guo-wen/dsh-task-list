import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyncFace } from './face.ts'
import { useSyncRun } from './use-sync-run.ts'

/**
 * What the task list says when Sync cannot start, checked at click time
 * instead of at mount: `none` means no connection is configured at all,
 * `unusable` means connections exist but no enabled, credentialed rule can run.
 */
export type SyncPanelPrompt = 'none' | 'unusable' | null

/**
 * One sync surface for the task list page: the header's Sync menu row and the
 * result region below the toolbar share this state, so a run is never started
 * twice and its progress is rendered in exactly one place.
 */
export interface SyncPanel {
  run: ReturnType<typeof useSyncRun>
  /** Why the last Sync click refused to start; cleared by `dismiss` or the next click. */
  prompt: SyncPanelPrompt
  /** A refused scope read (the Host or Remote namespace is unavailable). */
  scopeError: unknown
  /** A run is being requested or is already running. */
  busy: boolean
  /** Entered from the menu: verify the configuration, then start the run. */
  sync: () => void
  dismiss: () => void
}

/**
 * Read the connection/rule scope fresh on every click: the settings page is a
 * different surface, so a cached snapshot taken here would go stale the moment
 * the user adds a connection there.
 */
export function useSyncPanel(face: SyncFace, onComplete: () => void): SyncPanel {
  const run = useSyncRun(face)
  const { start } = run
  const [prompt, setPrompt] = useState<SyncPanelPrompt>(null)
  const [scopeError, setScopeError] = useState<unknown>(null)
  const [checking, setChecking] = useState(false)
  const completed = useRef<string | null>(null)
  const generation = useRef(0)

  useEffect(() => () => { generation.current++ }, [])

  useEffect(() => {
    const current = run.run
    if (!current || current.status === 'running' || completed.current === current.id) return
    completed.current = current.id
    onComplete()
  }, [run.run, onComplete])

  const sync = useCallback(() => {
    if (checking || run.starting || run.run?.status === 'running') return
    setPrompt(null)
    setScopeError(null)
    setChecking(true)
    const revision = ++generation.current
    void (async () => {
      try {
        const [connections, rules] = await Promise.all([face.listSyncConnections(), face.listSyncRules()])
        if (revision !== generation.current) return
        if (connections.length === 0) { setPrompt('none'); return }
        const runnable = rules.some(rule => rule.enabled
          && connections.some(connection => connection.id === rule.connectionId && connection.enabled && connection.credentialPresent))
        if (!runnable) { setPrompt('unusable'); return }
        await start()
      } catch (error) {
        if (revision === generation.current) setScopeError(error)
      } finally {
        if (revision === generation.current) setChecking(false)
      }
    })()
  }, [face, start, checking, run.starting, run.run?.status])

  const dismiss = useCallback(() => { setPrompt(null); setScopeError(null) }, [])
  return { run, prompt, scopeError, busy: checking || run.starting || run.run?.status === 'running', sync, dismiss }
}
