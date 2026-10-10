import { describe, expect, it } from 'vitest'
import { textContent } from '../src/content.ts'
import { local, remote, baseline, rule } from './fixtures/sync.ts'
import { planSync } from '../src/sync/planner.ts'
import { encodeStatus, statusMappingReady } from '../src/sync/mapping.ts'
import { projectLocal, projectRemote, projectionFor, rebaseProjection } from '../src/sync/snapshot.ts'
import { statusForRaw } from '../src/sync/adapters/yunxiao-codec.ts'
import type { SyncBaseline, SyncFields, RemoteItem } from '../src/sync/types.ts'
import type { TaskContent, TaskPriority, TaskRecord, TaskStatus } from '../src/types.ts'
import type { StatusWriteStates, SyncRule } from '../src/sync/dto.ts'

function value<T>(v: T): { presence: 'value'; value: T; writable: boolean } {
  return { presence: 'value', value: v, writable: true }
}

function expectSyncCode(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    const details = (error as { details?: { code?: string } }).details
    expect(details?.code).toBe(code)
    return
  }
  throw new Error(`expected sync error ${code}`)
}

/** A fully synced local task, remote item and baseline sharing one status. */
function synced(overrides: { status?: TaskStatus; description?: TaskContent } = {}): {
  task: TaskRecord
  item: RemoteItem
  base: SyncBaseline
  r: SyncRule
} {
  const r = rule()
  const status = overrides.status ?? 'todo'
  const rawStatus = statusWriteStatesOf(r)[status]
  const description = overrides.description ?? textContent('Shared body')
  const fields: SyncFields = { title: 'Shared title', status, priority: 'medium', tags: [], storyPoints: null, description }
  const item: RemoteItem = remote({
    fields: {
      title: value('Shared title'),
      description: value(description),
      status: value(status),
      priority: value('medium' as TaskPriority),
      tags: value([] as string[]),
      storyPoints: value(null),
    },
    rawStatus,
  })
  const task: TaskRecord = local({ title: 'Shared title', status, content: description })
  const base: SyncBaseline = { ...baseline(), local: fields, remote: fields, projection: projectionFor(r) }
  return { task, item, base, r }
}

function statusWriteStatesOf(r: SyncRule): StatusWriteStates {
  return r.statusWriteStates
}

describe('status write admission', () => {
  it('rejects a write target the rule does not map', () => {
    const partial = { todo: 'open', in_progress: 'doing' } as StatusWriteStates
    expectSyncCode(() => encodeStatus('done', 'open', partial), 'MappingIncompatible')
  })

  it('requires all three local statuses before a rule can write back', () => {
    expect(statusMappingReady({ todo: 'open', in_progress: 'doing', done: 'done' })).toBe(true)
    expect(statusMappingReady({ todo: 'open', in_progress: 'doing', done: '' })).toBe(false)
    expect(statusMappingReady({ todo: 'open', in_progress: 'doing' } as StatusWriteStates)).toBe(false)
    expect(statusMappingReady(null)).toBe(false)
  })
})

describe('encodeStatus and statusForRaw', () => {
  it('preserves the observed status when it already means the target', () => {
    const states: StatusWriteStates = { todo: 'open', in_progress: 'doing', done: 'done' }
    expect(encodeStatus('todo', 'open', states)).toBe('open')
    expect(encodeStatus('todo', 'done', states)).toBe('open')
    expect(encodeStatus('in_progress', 'open', states)).toBe('doing')
  })

  it('maps a platform status id back to the local status that owns it', () => {
    const states: StatusWriteStates = { todo: 'open', in_progress: 'doing', done: 'done' }
    expect(statusForRaw('doing', states)).toBe('in_progress')
    expectSyncCode(() => statusForRaw('archived', states), 'MappingIncompatible')
  })
})

describe('planSync: the status is the only reconciled field', () => {
  it('plans import when there is no local task', () => {
    const plan = planSync({ local: null, remote: remote(), baseline: null, rule: rule() })
    expect(plan.kind).toBe('import')
    expect(plan.localPatch).toEqual({})
    expect(plan.remotePatch).toEqual({})
  })

  it('plans unchanged when the status matches', () => {
    const { task, item, base, r } = synced()
    const plan = planSync({ local: task, remote: item, baseline: base, rule: r })
    expect(plan.kind).toBe('unchanged')
    expect(plan.remotePatch).toEqual({})
    expect(plan.localPatch).toEqual({})
    expect(plan.selectedFields).toEqual(['status'])
  })

  it('pushes the local status when the user changed it', () => {
    const { task, item, base, r } = synced()
    const changed = { ...task, status: 'done' as TaskStatus }
    const plan = planSync({ local: changed, remote: item, baseline: base, rule: r })
    expect(plan.kind).toBe('push')
    expect(plan.remotePatch).toEqual({ status: 'done' })
    expect(plan.localPatch).toEqual({})
  })

  it('still pushes the local status when the platform moved it in the meantime', () => {
    const { task, item, base, r } = synced()
    const changed = { ...task, status: 'in_progress' as TaskStatus }
    const remoteChanged = { ...item, fields: { ...item.fields, status: value('done' as TaskStatus) }, rawStatus: 'done' }
    const plan = planSync({ local: changed, remote: remoteChanged, baseline: base, rule: r })
    expect(plan.kind).toBe('push')
    expect(plan.remotePatch).toEqual({ status: 'in_progress' })
  })

  it('never pulls a remote status over the local one', () => {
    const { task, item, base, r } = synced()
    const remoteChanged = { ...item, fields: { ...item.fields, status: value('done' as TaskStatus) }, rawStatus: 'done' }
    const plan = planSync({ local: task, remote: remoteChanged, baseline: base, rule: r })
    expect(plan.kind).toBe('unchanged')
    expect(plan.localPatch).toEqual({})
  })

  it('ignores every other field, on either side', () => {
    const { task, item, base, r } = synced()
    const localEdited: TaskRecord = { ...task, title: 'Local title', content: textContent('Local body'), priority: 'urgent', tags: ['x'], storyPoints: 5, workspaceId: 'ws-1' }
    const remoteEdited = {
      ...item,
      fields: { ...item.fields, title: value('Remote title'), description: value(textContent('Remote body')) },
    }
    const plan = planSync({ local: localEdited, remote: remoteEdited, baseline: base, rule: r })
    expect(plan.kind).toBe('unchanged')
    expect(plan.localPatch).toEqual({})
    expect(plan.remotePatch).toEqual({})
  })

  it('detects a status change even when the clock did not move', () => {
    const { task, item, base, r } = synced()
    const changed = { ...task, status: 'done' as TaskStatus, updatedAt: task.updatedAt }
    expect(planSync({ local: changed, remote: item, baseline: base, rule: r }).remotePatch).toEqual({ status: 'done' })
    const reclocked = { ...task, updatedAt: task.updatedAt + 9_999_999 }
    expect(planSync({ local: reclocked, remote: item, baseline: base, rule: r }).kind).toBe('unchanged')
  })

  it('reconciles status directly when the link has no baseline', () => {
    const { task, item, r } = synced()
    const changed = { ...task, status: 'in_progress' as TaskStatus }
    const plan = planSync({ local: changed, remote: item, baseline: null, rule: r })
    expect(plan.remotePatch).toEqual({ status: 'in_progress' })
    expect(plan.localPatch).toEqual({})
  })
})

describe('rebaseProjection', () => {
  it('returns the unchanged baseline when the projection did not change', () => {
    const { task, item, base, r } = synced()
    const result = rebaseProjection({ task, remote: item, baseline: base, rule: r })
    expect(result.initializePatch).toEqual({})
    expect(result.baseline).toBe(base)
  })

  it('replaces the baseline projection on a revision change without inventing a patch', () => {
    const { task, item, base } = synced()
    const next: SyncRule = rule({ revision: 2 })
    const result = rebaseProjection({ task, remote: item, baseline: { ...base, projection: { fields: ['title', 'status'], mappingRevision: 1, normalizationVersion: 1 } }, rule: next })
    expect(result.initializePatch).toEqual({})
    expect(result.baseline.projection).toEqual({ fields: ['status'], mappingRevision: 2, normalizationVersion: 1 })
  })
})

describe('projectLocal and projectRemote', () => {
  it('strips attachments and canonicalizes marks in projectLocal', () => {
    const content: TaskContent = { version: 1, blocks: [
      { type: 'paragraph', children: [{ text: 'body', marks: ['italic', 'bold'] }] },
      { type: 'attachment', id: '11111111-1111-4111-8111-111111111111', name: 'a.txt', mediaType: 'text/plain', bytes: 1 },
    ] }
    const fields = projectLocal(local({ content }), projectionFor(rule()))
    expect(fields.description.blocks).toEqual([
      { type: 'paragraph', children: [{ text: 'body', marks: ['bold', 'italic'] }] },
    ])
  })

  it('normalizes remote tags by case and rejects a missing essential title', () => {
    const item = remote({ fields: { ...remote().fields, tags: value(['  Alpha ', 'alpha', 'Beta']) } })
    expect(projectRemote(item, rule()).tags).toEqual(['Alpha', 'Beta'])
    const noTitle = remote({ fields: { ...remote().fields, title: { presence: 'absent', writable: false } } })
    expectSyncCode(() => projectRemote(noTitle, rule()), 'InvalidRemoteResponse')
  })
})
