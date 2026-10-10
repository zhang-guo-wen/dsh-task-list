import { randomUUID } from 'node:crypto'
import type { TaskStore } from '../store.ts'
import type { SyncConfigStore } from './config-store.ts'
import type { SyncLinkStore } from './link-store.ts'
import type { SyncRunStore } from './run-store.ts'
import { SYNC_HEARTBEAT_MS } from './run-store.ts'
import { serializeRemoteKey } from './schema.ts'
import { SYNC_ERRORS, syncError, syncRemoteError } from './errors.ts'
import type { SafeConnection, SafeItemResult, SafeRunStatus, SyncErrorDto, SyncRule } from './dto.ts'
import type { AdapterFactory, Clock, RemoteKey, RunFence, SyncAdapter } from './types.ts'
import { executeItem } from './execute-item.ts'

/** Whole-run wall-clock budget; a manual sync may not run past this. */
const RUN_BUDGET_MS = 30 * 60 * 1000
/** Discovery pages and linked scans are bounded to this many per chunk. */
const LINK_SCAN_LIMIT = 100

const CONNECTION_FATAL = new Set(['AuthDenied', 'RateLimited', 'EntitlementUnavailable'])
const RUN_FATAL = new Set(['StaleOwner', 'RunInterrupted', 'StorageFailure'])

function isConnectionFatal(code: string): boolean {
  return CONNECTION_FATAL.has(code)
}

function isRunFatal(code: string): boolean {
  return RUN_FATAL.has(code)
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
}

function errorDto(err: unknown): SyncErrorDto {
  if (err !== null && typeof err === 'object') {
    const e = err as { code?: unknown; details?: SyncErrorDto; problem?: unknown; action?: unknown }
    if (e.code === 'task-list/sync' && e.details && typeof e.details.code === 'string') return e.details
    if (typeof e.code === 'string' && SYNC_ERRORS[e.code as keyof typeof SYNC_ERRORS] !== undefined
      && typeof e.problem === 'string' && typeof e.action === 'string') {
      return e as unknown as SyncErrorDto
    }
    if (isAbortError(err)) return syncError('RunInterrupted', { scope: 'run' })
  }
  return syncError('UnexpectedFailure', { scope: 'run' })
}

/** Yield the event loop so long synchronous SQLite loops never starve other work. */
function yieldLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

export interface SyncExecutorOptions {
  tasks: TaskStore
  config: SyncConfigStore
  links: SyncLinkStore
  runs: SyncRunStore
  adapterFactory: AdapterFactory
  clock: Clock
}

/**
 * Host-side manual sync executor. `start()` claims the singleton run lock and
 * returns the run id immediately; the run proceeds on its own AbortController
 * (never tied to a browser connection) and the host holds the settled promise.
 * An already-live lock returns `existing: true` without starting work or
 * heartbeating. `stop()` revokes the fence (marking the run interrupted), aborts
 * the run, and awaits it. A concurrent heartbeat loop renews the ownership lease
 * while the run awaits long reads/writes, so a healthy slow request never fenced
 * out as a false zombie.
 */
export class SyncExecutor {
  private readonly tasks: TaskStore
  private readonly config: SyncConfigStore
  private readonly links: SyncLinkStore
  private readonly runs: SyncRunStore
  private readonly adapterFactory: AdapterFactory
  private readonly clock: Clock
  private readonly ownerId = randomUUID()

  private fence: RunFence | null = null
  private controller: AbortController | null = null
  private runPromise: Promise<void> | null = null
  private ownsRun = false

  constructor(options: SyncExecutorOptions) {
    this.tasks = options.tasks
    this.config = options.config
    this.links = options.links
    this.runs = options.runs
    this.adapterFactory = options.adapterFactory
    this.clock = options.clock
  }

  start(): { runId: string; existing: boolean } {
    const claim = this.runs.claimRun(this.ownerId, this.clock.now())
    if (claim.existing) return { runId: claim.fence.runId, existing: true }
    const controller = new AbortController()
    this.fence = claim.fence
    this.ownsRun = true
    this.controller = controller
    this.runPromise = this.runRun(claim.fence, controller)
    return { runId: claim.fence.runId, existing: false }
  }

  /** Resolves when the current run settles; never rejects. */
  done(): Promise<void> {
    return this.runPromise ?? Promise.resolve()
  }

  /** Stop the owned run: mark it interrupted and release the lock, then abort and await. */
  async stop(): Promise<void> {
    if (!this.ownsRun) {
      this.fence = null
      this.runPromise = null
      this.controller = null
      return
    }
    const fence = this.fence
    const controller = this.controller
    const promise = this.runPromise
    // Detach shared run state synchronously so a concurrent start() during the
    // await below gets clean fields and its own fresh controller.
    this.fence = null
    this.ownsRun = false
    this.runPromise = null
    this.controller = null
    if (fence !== null) {
      try { this.runs.revoke(fence) } catch { /* already released */ }
    }
    controller?.abort()
    if (promise !== null) await promise.catch(() => {})
  }

  /**
   * Per-request gate bound to one rule. Re-checked before every HTTP attempt via
   * the transport, and before every high-level adapter call via `executeItem`'s
   * wrapped proxy. A throwing guard surfaces its own safe error and is never
   * re-mapped to a transient failure.
   */
  private gateFor(rule: SyncRule, fence: RunFence, signal: AbortSignal, startedAt: number): () => void {
    // Cache only the compiled statements (compiled once per rule); each dispatch
    // re-reads the live rows, so a mid-run disable or ownership loss still applies.
    const assertFence = this.runs.createFenceGuard(fence)
    const assertActive = this.config.createActiveGuard(rule.id)
    return () => {
      if (signal.aborted) throw syncRemoteError(syncError('RunInterrupted', { scope: 'run', runId: fence.runId }))
      if (this.clock.now() - startedAt > RUN_BUDGET_MS) throw syncRemoteError(syncError('RunInterrupted', { scope: 'run', runId: fence.runId }))
      assertFence()
      assertActive()
    }
  }

  private async runRun(fence: RunFence, controller: AbortController): Promise<void> {
    const heartbeatAbort = new AbortController()
    const heartbeat = this.heartbeatLoop(fence, controller, heartbeatAbort.signal)
    try {
      await this.runSync(fence, controller.signal)
    } catch {
      // runSync records the failure; the promise itself never rejects
    } finally {
      heartbeatAbort.abort()
      await heartbeat.catch(() => {})
      // Clear shared run state only if it still belongs to this run, so an old
      // run's finally can never abort or clear a newer user-run.
      if (this.controller === controller) {
        this.controller = null
        this.ownsRun = false
        this.fence = null
      }
    }
  }

  /** Renew the lease on a concurrent timer; abort the run when ownership is lost. */
  private async heartbeatLoop(fence: RunFence, controller: AbortController, signal: AbortSignal): Promise<void> {
    try {
      for (;;) {
        await this.clock.sleep(SYNC_HEARTBEAT_MS, signal)
        if (this.runs.heartbeat(fence, this.clock.now())) continue
        this.runs.markInterrupted(fence.runId)
        controller.abort()
        return
      }
    } catch (err) {
      if (isAbortError(err)) return
      this.runs.markInterrupted(fence.runId)
      controller.abort()
    }
  }

  private async runSync(fence: RunFence, signal: AbortSignal): Promise<void> {
    const startedAt = this.clock.now()
    const errors: SyncErrorDto[] = []
    let discoveryComplete = true
    let unprocessedKnown: number | null = 0
    let status: SafeRunStatus = 'completed'
    const overBudget = (): boolean => this.clock.now() - startedAt > RUN_BUDGET_MS

    try {
      this.runs.setPhase(fence, 'discovering')
      const connections = this.config.listConnections()
      for (const connection of connections) {
        if (signal.aborted || overBudget()) { discoveryComplete = false; unprocessedKnown = null; break }
        if (!connection.enabled) continue
        // Sync is Yunxiao-only: a stored connection of another platform is skipped
        // rather than failing the run it happens to share a database with.
        if (connection.platform !== 'yunxiao') continue
        const rules = this.config.listRules(connection.id)
        for (const rule of rules) {
          if (signal.aborted || overBudget()) { discoveryComplete = false; unprocessedKnown = null; break }
          if (!rule.enabled) continue
          const gate = this.gateFor(rule, fence, signal, startedAt)
          const adapter = await this.adapterFactory(connection, { beforeRequest: gate, projectId: rule.projectId })
          const outcome = await this.processRule(connection, rule, adapter, fence, signal, startedAt, gate)
          if (!outcome.discoveryComplete) { discoveryComplete = false; unprocessedKnown = null }
          errors.push(...outcome.errors)
          if (outcome.connectionStopped) break
        }
      }
      if (errors.length > 0 || !discoveryComplete) status = 'partial'
    } catch (err) {
      const dto = errorDto(err)
      errors.push(dto)
      discoveryComplete = false
      unprocessedKnown = null
      status = dto.code === 'RunInterrupted' ? 'partial' : 'failed'
    } finally {
      this.runs.finishRun(fence, status, { discoveryComplete, unprocessedKnown, errors })
    }
  }

  private async processRule(
    connection: SafeConnection, rule: SyncRule, adapter: SyncAdapter, fence: RunFence, signal: AbortSignal, startedAt: number, gate: () => void,
  ): Promise<{ discoveryComplete: boolean; errors: SyncErrorDto[]; connectionStopped: boolean }> {
    const errors: SyncErrorDto[] = []
    let discoveryComplete = true
    const overBudget = (): boolean => this.clock.now() - startedAt > RUN_BUDGET_MS

    try {
      for await (const batch of adapter.discover(rule, signal)) {
        if (signal.aborted) break
        for (const item of batch) {
          if (signal.aborted || overBudget()) { discoveryComplete = false; return { discoveryComplete, errors, connectionStopped: false } }
          if (!this.runs.markSeen(fence, item.key)) continue
          const outcome = await this.runItem(fence, rule, item.key, adapter, false, signal, gate)
          if (outcome.connectionStopped) {
            if (outcome.error) errors.push(outcome.error)
            return { discoveryComplete, errors, connectionStopped: true }
          }
        }
        await yieldLoop()
      }
    } catch (err) {
      const dto = errorDto(err)
      if (isRunFatal(dto.code)) throw err
      errors.push(dto)
      discoveryComplete = false
      if (isConnectionFatal(dto.code)) return { discoveryComplete, errors, connectionStopped: true }
      // Non-fatal discovery failure (IncompleteDiscovery etc.): still scan existing links.
    }

    // Existing links are synced even when discovery was empty or incomplete.
    let afterKey: string | null = null
    for (;;) {
      if (signal.aborted || overBudget()) { discoveryComplete = false; return { discoveryComplete, errors, connectionStopped: false } }
      const page = this.links.listLinked(rule.id, afterKey, LINK_SCAN_LIMIT)
      if (page.length === 0) break
      for (const link of page) {
        if (signal.aborted || overBudget()) { discoveryComplete = false; return { discoveryComplete, errors, connectionStopped: false } }
        if (this.runs.hasSeen(fence.runId, link.key)) continue
        this.runs.markSeen(fence, link.key)
        const outcome = await this.runItem(fence, rule, link.key, adapter, true, signal, gate)
        if (outcome.connectionStopped) {
          if (outcome.error) errors.push(outcome.error)
          return { discoveryComplete, errors, connectionStopped: true }
        }
      }
      afterKey = serializeRemoteKey(page[page.length - 1]!.key)
      await yieldLoop()
    }

    return { discoveryComplete, errors, connectionStopped: false }
  }

  private async runItem(fence: RunFence, rule: SyncRule, key: RemoteKey, adapter: SyncAdapter, outsideFilter: boolean, signal: AbortSignal, gate: () => void): Promise<{ connectionStopped: boolean; error: SyncErrorDto | null }> {
    try {
      await executeItem({
        fence, rule, key, tasks: this.tasks, config: this.config, links: this.links, runs: this.runs,
        adapter, clock: this.clock, signal, outsideFilter, beforeRequest: gate,
      })
      return { connectionStopped: false, error: null }
    } catch (err) {
      const dto = errorDto(err)
      if (isRunFatal(dto.code)) throw syncRemoteError(dto)
      const link = this.links.getLink(key)
      const failed: SafeItemResult = { key, taskId: link?.taskId ?? null, category: 'failed', changedFields: [], discardedFields: [], writtenBack: false, outsideFilter, error: dto }
      this.runs.recordResult(fence, failed)
      const connectionStopped = isConnectionFatal(dto.code)
      return { connectionStopped, error: connectionStopped ? dto : null }
    }
  }
}
