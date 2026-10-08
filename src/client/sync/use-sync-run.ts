import { useCallback, useEffect, useRef, useState } from 'react'
import type { Page, SafeItemResult, SafeRun } from '../../sync/dto.ts'
import type { SyncFace } from './face.ts'

export function useSyncRun(face: SyncFace) {
  const [run, setRun] = useState<SafeRun | null>(null)
  const [items, setItems] = useState<Page<SafeItemResult>>({ items: [], total: 0, page: 1, pageSize: 20 })
  const [queryError, setQueryError] = useState<unknown>(null)
  const [starting, setStarting] = useState(false)
  const active = useRef(false)
  const locked = useRef(false)
  const id = useRef<string | null>(null)
  const generation = useRef(0)
  const page = useRef(1)
  const query = useCallback(async (runId: string) => {
    const revision = ++generation.current
    try {
      const [next, results] = await Promise.all([face.getSyncRun({ id: runId }), face.listSyncItemResults({ id: runId, page: page.current, pageSize: 20 })])
      if (!active.current || revision !== generation.current) return
      setRun(next); setItems(results); setQueryError(null)
    } catch (error) { if (active.current && revision === generation.current) setQueryError(error) }
  }, [face])
  const reconnect = useCallback(async () => {
    try {
      const latest = await face.listSyncRuns({ page: 1, pageSize: 1 })
      if (!active.current) return
      id.current = latest.items[0]?.id ?? null
      if (id.current) await query(id.current)
      else { setRun(null); setQueryError(null) }
    } catch (error) { if (active.current) setQueryError(error) }
  }, [face, query])
  useEffect(() => {
    active.current = true
    void reconnect()
    return () => { active.current = false; generation.current++ }
  }, [reconnect])
  useEffect(() => {
    if (run?.status !== 'running' || queryError) return
    const timer = setTimeout(() => { if (id.current) void query(id.current) }, 1200)
    return () => clearTimeout(timer)
  }, [run, queryError, query])
  const start = useCallback(async () => {
    if (locked.current || run?.status === 'running') return
    locked.current = true; setStarting(true)
    try {
      const result = await face.startSync()
      id.current = result.runId; page.current = 1
      // Only a run identifier is retained; the Host's latest-run query remains authoritative.
      try { sessionStorage.setItem('dsh-task-list:sync-run', result.runId) } catch { /* storage unavailable */ }
      if (active.current) await query(result.runId)
    } catch (error) { if (active.current) setQueryError(error) }
    finally { locked.current = false; if (active.current) setStarting(false) }
  }, [face, query, run?.status])
  const changePage = useCallback((next: number) => {
    page.current = next
    if (id.current) void query(id.current)
  }, [query])
  return { run, items, queryError, starting, start, reconnect, changePage }
}
