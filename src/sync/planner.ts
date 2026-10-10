import type { TaskRecord } from '../types.ts'
import { projectLocal, projectRemote, projectionFor } from './snapshot.ts'
import type {
  FieldValue, RemoteItem, SyncBaseline, SyncField, SyncFields, SyncPatch, SyncPlan,
} from './types.ts'
import type { SyncRule } from './dto.ts'

function isReadable(field: SyncField, value: FieldValue<unknown>): boolean {
  if (field === 'title' || field === 'status') return value.presence === 'value'
  return value.presence === 'value' || value.presence === 'null'
}

function selectedFields(item: RemoteItem, fields: SyncField[]): SyncField[] {
  return fields.filter(field => isReadable(field, item.fields[field]))
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function setField(patch: SyncPatch, field: SyncField, value: SyncFields[SyncField]): void {
  ;(patch as Record<string, unknown>)[field] = value
}

function hasPatch(patch: SyncPatch): boolean {
  return patch.title !== undefined || patch.description !== undefined || patch.status !== undefined
    || patch.priority !== undefined || patch.tags !== undefined || patch.storyPoints !== undefined
}

/**
 * Decide the task-level action for one linked item. Only the canonical snapshots of
 * selected fields are compared; timestamps never drive the decision. The selected
 * set is the rule's own projection — today just the status — so the only patch a
 * plan can carry is a status the local task changed after the last sync.
 */
export function planSync(input: {
  local: TaskRecord | null; remote: RemoteItem; baseline: SyncBaseline | null; rule: SyncRule
}): SyncPlan {
  const { local, remote, baseline, rule } = input
  const projection = projectionFor(rule)
  const selected = selectedFields(remote, projection.fields)

  if (local === null) {
    return { kind: 'import', localPatch: {}, remotePatch: {}, selectedFields: selected }
  }

  const localFields = projectLocal(local, projection)
  const remoteFields = projectRemote(remote, rule)

  if (baseline === null) {
    // A link without a stored baseline: reconcile the two current values directly.
    const localPatch: SyncPatch = {}
    const remotePatch: SyncPatch = {}
    for (const field of selected) {
      if (field === 'status') {
        if (!deepEqual(localFields.status, remoteFields.status)) setField(remotePatch, 'status', localFields.status)
      } else if (!deepEqual(remoteFields[field], localFields[field])) {
        setField(localPatch, field, remoteFields[field])
      }
    }
    return { kind: hasPatch(localPatch) || hasPatch(remotePatch) ? 'merge' : 'unchanged', localPatch, remotePatch, selectedFields: selected }
  }

  const localChanged = selected.filter(field => !deepEqual(localFields[field], baseline.local[field]))
  const remoteChanged = selected.filter(field => !deepEqual(remoteFields[field], baseline.remote[field]))

  if (localChanged.length === 0 && remoteChanged.length === 0) {
    return { kind: 'unchanged', localPatch: {}, remotePatch: {}, selectedFields: selected }
  }

  // Status is the only reconciled field and the local side always wins it: the
  // user's own status change is the intent, so the remote target is written back
  // whether or not the platform moved the status in the meantime.
  const remotePatch: SyncPatch = {}
  if (localChanged.includes('status')) setField(remotePatch, 'status', localFields.status)
  return { kind: hasPatch(remotePatch) ? 'push' : 'unchanged', localPatch: {}, remotePatch, selectedFields: selected }
}
