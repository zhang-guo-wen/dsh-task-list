import type { TaskRecord } from '../types.ts'
import { projectionFor } from './mapping.ts'
import { projectLocal, projectRemote } from './snapshot.ts'
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
 * selected fields are compared; timestamps never drive the decision. When both sides
 * changed, non-status fields take the remote value and the status field takes the
 * local value — the whole status, never a per-field merge.
 */
export function planSync(input: {
  local: TaskRecord | null; remote: RemoteItem; baseline: SyncBaseline | null; rule: SyncRule
}): SyncPlan {
  const { local, remote, baseline, rule } = input
  const projection = projectionFor(rule, remote.key.typeId)
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

  if (remoteChanged.length === 0) {
    const remotePatch: SyncPatch = {}
    for (const field of localChanged) {
      if (!deepEqual(localFields[field], remoteFields[field])) setField(remotePatch, field, localFields[field])
    }
    return { kind: 'push', localPatch: {}, remotePatch, selectedFields: selected }
  }

  if (localChanged.length === 0) {
    const localPatch: SyncPatch = {}
    for (const field of remoteChanged) {
      if (!deepEqual(remoteFields[field], localFields[field])) setField(localPatch, field, remoteFields[field])
    }
    return { kind: 'pull', localPatch, remotePatch: {}, selectedFields: selected }
  }

  const localPatch: SyncPatch = {}
  const remotePatch: SyncPatch = {}
  for (const field of selected) {
    if (field === 'status') {
      if (!deepEqual(localFields.status, remoteFields.status)) setField(remotePatch, 'status', localFields.status)
    } else if (!deepEqual(remoteFields[field], localFields[field])) {
      setField(localPatch, field, remoteFields[field])
    }
  }
  return { kind: 'merge', localPatch, remotePatch, selectedFields: selected }
}
