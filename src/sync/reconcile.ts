import { projectRemote } from './snapshot.ts'
import type { ReconcileResult, SyncAdapter, SyncField, WriteIntent } from './types.ts'

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Reconcile an uncertain write against the platform's current state.
 *
 * Only the write-set (the fields the intent actually wrote) is compared, using
 * the intent's recorded rule snapshot — never the current mapping. A matching
 * write-set confirms the write even when a third party changed other fields. A
 * value equal to the before-value does not prove "not applied" (the write could
 * have been accepted then withdrawn), so only platform evidence can yield
 * `proven_not_applied`; everything else stays `pending` and must not be retried
 * as an ordinary write.
 */
export async function reconcileIntent(intent: WriteIntent, adapter: SyncAdapter, signal: AbortSignal): Promise<ReconcileResult> {
  const observed = await adapter.read(intent.key, intent.ruleSnapshot, signal)
  const projected = projectRemote(observed, intent.ruleSnapshot)
  const applied = (Object.keys(intent.patch) as SyncField[]).every(field => {
    if (intent.patch[field] === undefined) return true
    return deepEqual(projected[field], intent.expected[field])
  })
  if (applied) return { kind: 'confirmed', observed }
  const evidence = await adapter.evidence(intent, observed, signal)
  if (evidence === 'applied') return { kind: 'confirmed', observed }
  if (evidence === 'not_applied_proven') return { kind: 'proven_not_applied', observed }
  return { kind: 'pending', observed }
}
