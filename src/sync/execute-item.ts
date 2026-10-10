import type { TaskRecord } from '../types.ts'
import type { SafeItemResult, SyncErrorDto, SyncRule } from './dto.ts'
import { SYNC_ERRORS, syncError, syncRemoteError } from './errors.ts'
import { projectionFor } from './snapshot.ts'
import { planSync } from './planner.ts'
import { reconcileIntent } from './reconcile.ts'
import { buildBaseline, projectRemote, rebaseProjection } from './snapshot.ts'
import type {
  ItemExecution, RemoteItem, SyncAdapter, SyncBaseline, SyncField, SyncLink, SyncPatch, SyncPlan, WriteIntent,
} from './types.ts'

/** Re-read/re-plan at most this many times before a write before reporting instability. */
const MAX_REPLANS = 3

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function hasPatch(patch: SyncPatch): boolean {
  return patch.title !== undefined || patch.description !== undefined || patch.status !== undefined
    || patch.priority !== undefined || patch.tags !== undefined || patch.storyPoints !== undefined
}

function isUncertainWrite(code: string): boolean {
  return code === 'WriteOutcomeUnknown' || code === 'VerificationFailed'
}

const CONNECTION_FATAL = new Set(['AuthDenied', 'RateLimited', 'EntitlementUnavailable'])

function isConnectionFatal(code: string): boolean {
  return CONNECTION_FATAL.has(code)
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
}

/** Extract a safe DTO from a thrown value, never echoing a raw message/header/body. */
function errorDto(err: unknown, scope: SyncErrorDto['scope'] = 'item'): SyncErrorDto {
  if (err !== null && typeof err === 'object') {
    const e = err as { code?: unknown; details?: SyncErrorDto; problem?: unknown; action?: unknown }
    if (e.code === 'task-list/sync' && e.details && typeof e.details.code === 'string') return e.details
    if (typeof e.code === 'string' && SYNC_ERRORS[e.code as keyof typeof SYNC_ERRORS] !== undefined
      && typeof e.problem === 'string' && typeof e.action === 'string') {
      return e as unknown as SyncErrorDto
    }
    if (isAbortError(err)) return syncError('RunInterrupted', { scope: 'run' })
  }
  return syncError('UnexpectedFailure', { scope })
}

function raise(code: Parameters<typeof syncError>[0], scope: SyncErrorDto['scope'] = 'item', field?: string): never {
  throw syncRemoteError(syncError(code, { scope, ...(field !== undefined ? { field } : {}) }))
}

/** The rule must still be enabled under a live connection before any adapter request. */
function assertEnabled(config: ItemExecution['config'], rule: SyncRule): void {
  const current = config.getRule(rule.id)
  if (current === null || !current.enabled) raise('InvalidConfig', 'rule', 'enabled')
  const connection = config.getConnection(current.connectionId)
  if (connection === null || !connection.enabled) raise('InvalidConfig', 'connection', 'enabled')
}

function mergePatch(a: SyncPatch, b: SyncPatch): SyncPatch {
  const out: SyncPatch = { ...a }
  for (const field of Object.keys(b) as SyncField[]) {
    if (b[field] !== undefined) (out as Record<string, unknown>)[field] = b[field]
  }
  return out
}

function applyOptionalPatch(task: TaskRecord, patch: SyncPatch): TaskRecord {
  return {
    ...task,
    priority: patch.priority ?? task.priority,
    tags: patch.tags ?? task.tags,
    storyPoints: patch.storyPoints ?? task.storyPoints,
  }
}

function resultFor(
  key: ItemExecution['key'], taskId: string | null, category: SafeItemResult['category'],
  changedFields: SyncField[], writtenBack: boolean, outsideFilter: boolean, error: SyncErrorDto | null,
): SafeItemResult {
  return { key, taskId, category, changedFields, discardedFields: [], writtenBack, outsideFilter, error }
}

function finalBaseline(task: TaskRecord, localPatch: SyncPatch, observed: RemoteItem, rule: SyncRule): SyncBaseline {
  const base = buildBaseline(task, observed, rule)
  if (!hasPatch(localPatch)) return base
  return { ...base, local: { ...base.local, ...localPatch }, localVersion: task.version + 1 }
}

function sameRemotePatch(a: SyncPatch, b: SyncPatch): boolean {
  const fields = new Set([...Object.keys(a), ...Object.keys(b)] as SyncField[])
  for (const field of fields) {
    if (a[field] === undefined && b[field] === undefined) continue
    if (!deepEqual(a[field] ?? null, b[field] ?? null)) return false
  }
  return true
}

/**
 * Wrap an adapter so a per-request gate runs before every high-level
 * read/write/evidence/metadata call. `discover` (an async generator) is not
 * wrapped here: its per-page fetches are gated by the transport's injected
 * `beforeRequest` seam instead.
 */
function gatedAdapter(adapter: SyncAdapter, beforeRequest: (() => void) | undefined): SyncAdapter {
  if (beforeRequest === undefined) return adapter
  const gate = (): void => { beforeRequest() }
  return {
    metadata: (scope, signal) => { gate(); return adapter.metadata(scope, signal) },
    discover: (rule, signal) => adapter.discover(rule, signal),
    read: (key, rule, signal) => { gate(); return adapter.read(key, rule, signal) },
    write: (key, patch, observed, rule, signal) => { gate(); return adapter.write(key, patch, observed, rule, signal) },
    evidence: (intent, observed, signal) => { gate(); return adapter.evidence(intent, observed, signal) },
  }
}

/**
 * Baseline that acknowledges the pending write-set as already applied on the
 * remote, so a later plan never re-sends the old patch. Shared by the same-run
 * confirm and the old-run adoption path.
 */
function acknowledgedBaseline(link: SyncLink, pending: WriteIntent, observed: RemoteItem, rule: SyncRule): SyncBaseline {
  const base = link.baseline ?? pending.baseline
  // A readback proves only the dispatched write-set, not unrelated remote fields.
  // Keep their original baseline so independent changes still enter the both-change branch.
  const acknowledged: SyncPatch = {}
  for (const field of Object.keys(pending.patch) as SyncField[]) {
    ;(acknowledged as Record<string, unknown>)[field] = pending.expected[field]
  }
  return { ...base, remote: { ...base.remote, ...acknowledged } }
}

async function stabilizeWrite(input: ItemExecution, task: TaskRecord, baseline: SyncBaseline | null): Promise<{ observed: RemoteItem; plan: SyncPlan }> {
  let observed = await input.adapter.read(input.key, input.rule, input.signal)
  let plan = planSync({ local: task, remote: observed, baseline, rule: input.rule })
  for (let changes = 0; changes < MAX_REPLANS; changes += 1) {
    if (!hasPatch(plan.remotePatch)) return { observed, plan }
    const latest = await input.adapter.read(input.key, input.rule, input.signal)
    const latestPlan = planSync({ local: task, remote: latest, baseline, rule: input.rule })
    if (sameRemotePatch(latestPlan.remotePatch, plan.remotePatch) && latestPlan.kind === plan.kind) {
      return { observed: latest, plan: latestPlan }
    }
    observed = latest
    plan = latestPlan
  }
  const current = input.tasks.get(task.id)
  if (current === null || current.version !== task.version) raise('LocalVersionConflict', 'item')
  raise('RemoteUnavailable', 'item')
}

function verifyWrite(intent: WriteIntent, observed: RemoteItem): boolean {
  const projected = projectRemote(observed, intent.ruleSnapshot)
  return (Object.keys(intent.patch) as SyncField[]).every(field => {
    if (intent.patch[field] === undefined) return true
    return deepEqual(projected[field], intent.expected[field])
  })
}

/** The single-item sync pipeline; returns a recorded result and throws only run/storage-fatal errors. */
export async function executeItem(input: ItemExecution): Promise<SafeItemResult> {
  const { key, links, runs, fence, outsideFilter = false } = input
  try {
    return await executeItemInner({ ...input, adapter: gatedAdapter(input.adapter, input.beforeRequest) })
  } catch (err) {
    const dto = errorDto(err)
    if (dto.code === 'StaleOwner' || dto.code === 'StorageFailure' || dto.code === 'RunInterrupted' || isConnectionFatal(dto.code)) {
      throw syncRemoteError(dto)
    }
    const link = links.getLink(key)
    const failed = resultFor(key, link?.taskId ?? null, 'failed', [], false, outsideFilter, dto)
    runs.recordResult(fence, failed)
    return failed
  }
}

async function executeItemInner(input: ItemExecution): Promise<SafeItemResult> {
  const { fence, rule, key, tasks, config, links, runs, adapter, outsideFilter = false } = input
  const signal = input.signal

  runs.assertFence(fence)
  assertEnabled(config, rule)

  const observed = await adapter.read(key, rule, signal)

  const pending = links.getPending(key)
  if (pending !== null) {
    return reconcilePending(input, pending, observed)
  }

  const link = links.getLink(key)
  const task = link !== null && link.taskId !== null ? tasks.get(link.taskId) : null

  if (task === null) {
    const created = links.importItem(observed, rule, fence)
    const result = resultFor(key, created.id, 'imported', projectionFor(rule).fields, false, outsideFilter, null)
    runs.recordResult(fence, result)
    return result
  }

  return processLinked(input, link!, task, observed)
}

async function reconcilePending(input: ItemExecution, pending: WriteIntent, observed: RemoteItem): Promise<SafeItemResult> {
  const { fence, key, links, runs, adapter, rule } = input
  const patchFields = Object.keys(pending.patch) as SyncField[]

  if (pending.fence.runId === fence.runId) {
    const result = await reconcileIntent(pending, adapter, input.signal)
    if (result.kind !== 'confirmed') {
      const failed = resultFor(key, pending.taskId, 'failed', [], false, false, syncError('WriteOutcomeUnknown', { scope: 'item' }))
      runs.recordResult(fence, failed)
      return failed
    }
    const link = links.getLink(key)!
    // Acknowledge the write-set in the baseline so the next manual run is
    // `unchanged` and never replays the old patch as a spurious merge.
    const ackBaseline = acknowledgedBaseline(link, pending, result.observed, rule)
    try {
      links.finalizeItem({
        fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
        expectedTaskVersion: pending.localVersion, localPatch: {}, observed: result.observed,
        baseline: ackBaseline, intentId: pending.id,
        result: resultFor(key, pending.taskId, 'pushed', patchFields, true, false, null),
      })
      return resultFor(key, pending.taskId, 'pushed', patchFields, true, false, null)
    } catch (err) {
      const dto = errorDto(err)
      if (dto.code === 'StaleOwner') throw syncRemoteError(dto)
      // The write applied but the local task advanced; plan the remaining edit instead of swallowing it.
      return planAfterAck(input, pending, result.observed)
    }
  }

  const adopted = await links.reconcileAndAdopt(pending.id, fence, adapter, input.signal)
  if (adopted.kind !== 'confirmed') {
    const failed = resultFor(key, pending.taskId, 'failed', [], false, false, syncError('WriteOutcomeUnknown', { scope: 'item' }))
    runs.recordResult(fence, failed)
    return failed
  }
  return planAfterAck(input, pending, adopted.observed)
}

/** After an acknowledged old write, acknowledge the write-set in the baseline and plan the remaining edit. */
async function planAfterAck(input: ItemExecution, pending: WriteIntent, observed: RemoteItem): Promise<SafeItemResult> {
  const { key, links, tasks, rule } = input
  const link = links.getLink(key)!
  const task = link.taskId !== null ? tasks.get(link.taskId) : null
  const patchFields = Object.keys(pending.patch) as SyncField[]
  if (task === null) {
    return resultFor(key, null, 'pushed', patchFields, true, false, null)
  }
  const ackBaseline = acknowledgedBaseline(link, pending, observed, rule)
  // No remaining edit after the acknowledged write: keep the adoption's pushed result, never re-record unchanged.
  const remaining = planSync({ local: task, remote: observed, baseline: ackBaseline, rule })
  if (remaining.kind === 'unchanged') {
    return resultFor(key, task.id, 'pushed', patchFields, true, false, null)
  }
  return processLinked(input, link, task, observed, ackBaseline)
}

async function processLinked(
  input: ItemExecution, link: SyncLink, task: TaskRecord, observed: RemoteItem, baselineOverride: SyncBaseline | null = null,
): Promise<SafeItemResult> {
  const { fence, rule, key, tasks, links, runs, adapter, outsideFilter = false } = input

  let baseline = baselineOverride ?? link.baseline
  let initializePatch: SyncPatch = {}
  if (baseline !== null) {
    const rebased = rebaseProjection({ task, remote: observed, baseline, rule })
    baseline = rebased.baseline
    initializePatch = rebased.initializePatch
  }

  const planningTask = hasPatch(initializePatch) ? applyOptionalPatch(task, initializePatch) : task
  const plan = planSync({ local: planningTask, remote: observed, baseline, rule })

  if (!hasPatch(plan.remotePatch)) {
    const localPatch = mergePatch(initializePatch, plan.localPatch)
    const category = plan.kind === 'merge' ? 'merged' : plan.kind === 'unchanged' ? 'unchanged' : 'pulled'
    const changed = plan.selectedFields.filter(f => (localPatch[f] ?? plan.remotePatch[f]) !== undefined)
    const result = resultFor(key, task.id, category, changed, false, outsideFilter, null)
    links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: task.version, localPatch, observed,
      baseline: finalBaseline(task, localPatch, observed, rule), intentId: null, result,
    })
    return result
  }

  const settled = await stabilizeWrite(input, planningTask, baseline)
  return performWrite(input, link, task, settled.observed, settled.plan, initializePatch, baseline)
}

async function performWrite(
  input: ItemExecution, link: SyncLink, task: TaskRecord,
  observed: RemoteItem, plan: SyncPlan, initializePatch: SyncPatch, baseline: SyncBaseline | null,
): Promise<SafeItemResult> {
  const { fence, rule, key, tasks, config, links, runs, adapter, outsideFilter = false } = input

  const current = tasks.get(task.id)
  if (current === null || current.version !== task.version) raise('LocalVersionConflict', 'item')

  let intent: WriteIntent
  try {
    intent = links.prepareIntent({ fence, link, task: current, observed, rule, plan })
  } catch (err) {
    const dto = errorDto(err)
    if (dto.code === 'StaleOwner') throw syncRemoteError(dto)
    const failed = resultFor(key, task.id, 'failed', [], false, outsideFilter, syncError('StorageFailure', { scope: 'item' }))
    runs.recordResult(fence, failed)
    return failed
  }

  try {
    assertEnabled(config, rule)
    runs.assertFence(fence)
  } catch (err) {
    const dto = errorDto(err)
    if (dto.code === 'StaleOwner') throw syncRemoteError(dto)
    // Pre-dispatch disable: no HTTP was issued, so the prepared intent is
    // definitively cancelled and never re-reconciled.
    links.cancelIntent(intent.id, fence, dto)
    const failed = resultFor(key, task.id, 'failed', [], false, outsideFilter, dto)
    runs.recordResult(fence, failed)
    return failed
  }
  if (tasks.get(task.id)?.version !== current.version) {
    links.cancelIntent(intent.id, fence, syncError('LocalVersionConflict', { scope: 'item' }))
    const failed = resultFor(key, task.id, 'failed', [], false, outsideFilter, syncError('LocalVersionConflict', { scope: 'item' }))
    runs.recordResult(fence, failed)
    return failed
  }

  links.markDispatched(intent.id, fence)

  try {
    await adapter.write(key, plan.remotePatch, observed, rule, input.signal)
  } catch (err) {
    const dto = errorDto(err)
    if (dto.code === 'StaleOwner' || dto.code === 'RunInterrupted') throw syncRemoteError(dto)
    // A guard error (disable) fired after `markDispatched`: the intent is already
    // marked dispatched, so the outcome is unknown (conservative), never cancelled.
    if (isUncertainWrite(dto.code) || dto.code === 'InvalidConfig') links.recordUnknown(intent.id, fence, dto)
    else links.cancelIntent(intent.id, fence, dto)
    const failed = resultFor(key, task.id, 'failed', [], false, outsideFilter, dto)
    runs.recordResult(fence, failed, links.getPending(key) !== null)
    return failed
  }

  const writtenBack = await adapter.read(key, rule, input.signal)
  if (!verifyWrite(intent, writtenBack)) {
    const dto = syncError('VerificationFailed', { scope: 'item' })
    links.recordUnknown(intent.id, fence, dto)
    const failed = resultFor(key, task.id, 'failed', [], false, outsideFilter, dto)
    runs.recordResult(fence, failed)
    return failed
  }

  const localPatch = mergePatch(initializePatch, plan.localPatch)
  const category: SafeItemResult['category'] = plan.kind === 'merge' ? 'merged' : 'pushed'
  const changed = plan.selectedFields.filter(f => (plan.remotePatch[f] ?? localPatch[f]) !== undefined)
  const result = resultFor(key, task.id, category, changed, true, outsideFilter, null)
  try {
    links.finalizeItem({
      fence, linkId: link.id, linkRevision: link.revision, taskGeneration: link.taskGeneration,
      expectedTaskVersion: current.version, localPatch, observed: writtenBack,
      baseline: finalBaseline(current, localPatch, writtenBack, rule), intentId: intent.id, result,
    })
    return result
  } catch (err) {
    const dto = errorDto(err)
    if (dto.code === 'StaleOwner') throw syncRemoteError(dto)
    if (dto.code === 'LocalVersionConflict') {
      const failed = resultFor(key, task.id, 'failed', [], false, outsideFilter, dto)
      runs.recordResult(fence, failed)
      return failed
    }
    // The write applied and verified, but the local finalize failed: the intent
    // remains in the pending set, so the item is counted pending too.
    const failed = resultFor(key, task.id, 'failed', [], false, outsideFilter, syncError('StorageFailure', { scope: 'item' }))
    runs.recordResult(fence, failed, links.getPending(key) !== null)
    return failed
  }
}
