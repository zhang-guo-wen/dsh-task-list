import { describe, expect, it } from 'vitest'
import { textContent } from '../src/content.ts'
import { local, remote, baseline, rule } from './fixtures/sync.ts'
import { planSync } from '../src/sync/planner.ts'
import { encodeStatus } from '../src/sync/mapping.ts'
import { projectLocal, projectRemote, rebaseProjection } from '../src/sync/snapshot.ts'
import type { SyncBaseline, SyncFields, SyncPatch, SyncProjection, RemoteItem } from '../src/sync/types.ts'
import type { TaskContent, TaskPriority, TaskRecord, TaskStatus } from '../src/types.ts'
import type { SyncRule, TypeMapping } from '../src/sync/dto.ts'

const fullProjection: SyncProjection = { fields: ['title', 'description', 'status'], mappingRevision: 1, normalizationVersion: 1 }
const mapping = rule().mappings[0]!

function value<T>(v: T): { presence: 'value'; value: T; writable: boolean } {
  return { presence: 'value', value: v, writable: true }
}

function expectSyncCode(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    expect((error as { code?: string }).code).toBe('task-list/sync')
    expect((error as { details?: { code?: string } }).details?.code).toBe(code)
    return
  }
  throw new Error(`expected sync error ${code}`)
}

/** Build a fully synced local task, remote item and baseline around one shared value. */
function synced(overrides: { title?: string; status?: TaskStatus; description?: TaskContent } = {}): {
  task: TaskRecord
  item: RemoteItem
  base: SyncBaseline
  r: SyncRule
} {
  const r = rule()
  const title = overrides.title ?? 'Shared title'
  const status = overrides.status ?? 'todo'
  const description = overrides.description ?? textContent('Shared body')
  const rawStatus = status === 'todo' ? 'open' : status === 'in_progress' ? 'doing' : 'done'
  const fields: SyncFields = { title, status, priority: 'medium', tags: [], storyPoints: null, description }
  const item: RemoteItem = remote({
    fields: {
      title: value(title),
      description: value(description),
      status: value(status),
      priority: value('medium' as TaskPriority),
      tags: value([] as string[]),
      storyPoints: value(null),
    },
    rawStatus,
  })
  const task: TaskRecord = local({ title, status, content: description })
  const base: SyncBaseline = { ...baseline(), local: fields, remote: fields, projection: { ...fullProjection, mappingRevision: r.revision } }
  return { task, item, base, r }
}

/** Apply an initialize patch to a task record, mirroring the controller's rebase flow. */
function applyPatch(task: TaskRecord, patch: SyncPatch): TaskRecord {
  const next: TaskRecord = { ...task }
  if (patch.title !== undefined) next.title = patch.title
  if (patch.description !== undefined) next.content = patch.description
  if (patch.status !== undefined) next.status = patch.status
  if (patch.priority !== undefined) next.priority = patch.priority
  if (patch.tags !== undefined) next.tags = patch.tags
  if (patch.storyPoints !== undefined) next.storyPoints = patch.storyPoints
  return next
}

describe('status write admission', () => {
  it('rejects a contradictory write target before any remote transition', () => {
    const contradictory = { ...mapping, writeStates: { todo: 'done', in_progress: 'doing', done: 'open' } }
    expectSyncCode(() => encodeStatus('todo', remote({ rawStatus: 'doing' }), contradictory), 'MappingIncompatible')
  })
})

describe('planSync five branches', () => {
  it('plans import when there is no local task', () => {
    const plan = planSync({ local: null, remote: remote(), baseline: null, rule: rule() })
    expect(plan.kind).toBe('import')
    expect(plan.localPatch).toEqual({})
    expect(plan.remotePatch).toEqual({})
  })

  it('plans unchanged with an empty remote patch when neither side changed', () => {
    const { task, item, base, r } = synced()
    const plan = planSync({ local: task, remote: item, baseline: base, rule: r })
    expect(plan.kind).toBe('unchanged')
    expect(plan.remotePatch).toEqual({})
    expect(plan.localPatch).toEqual({})
  })

  it('pulls when only the remote description changed', () => {
    const { task, item, base, r } = synced()
    const changed = { ...item, fields: { ...item.fields, description: value(textContent('Remote new body')) } }
    const plan = planSync({ local: task, remote: changed, baseline: base, rule: r })
    expect(plan.kind).toBe('pull')
    expect(plan.localPatch).toEqual({ description: textContent('Remote new body') })
    expect(plan.remotePatch).toEqual({})
  })

  it('pushes when only the local description changed', () => {
    const { task, item, base, r } = synced()
    const changed = { ...task, content: textContent('Local new body') }
    const plan = planSync({ local: changed, remote: item, baseline: base, rule: r })
    expect(plan.kind).toBe('push')
    expect(plan.remotePatch).toEqual({ description: textContent('Local new body') })
    expect(plan.localPatch).toEqual({})
  })

  it('merges local description change with remote status done: remote wins description, local wins status', () => {
    const { task, item, base, r } = synced()
    const localChanged = { ...task, content: textContent('Local new body') }
    const remoteChanged = { ...item, fields: { ...item.fields, status: value('done' as TaskStatus) }, rawStatus: 'done' }
    const plan = planSync({ local: localChanged, remote: remoteChanged, baseline: base, rule: r })
    expect(plan.kind).toBe('merge')
    expect(plan.localPatch).toEqual({ description: textContent('Shared body') })
    expect(plan.remotePatch).toEqual({ status: 'todo' })
  })

  it('ignores local-only session and workspace changes', () => {
    const { task, item, base, r } = synced()
    const changed = { ...task, workspaceId: 'ws-1', sessionId: 'sess-1' }
    const plan = planSync({ local: changed, remote: item, baseline: base, rule: r })
    expect(plan.kind).toBe('unchanged')
  })

  it('detects a same-timestamp content change and ignores clock magnitude', () => {
    const { task, item, base, r } = synced()
    const changed = { ...task, content: textContent('Changed'), updatedAt: task.updatedAt }
    expect(planSync({ local: changed, remote: item, baseline: base, rule: r }).kind).toBe('push')

    const reclocked = { ...task, updatedAt: task.updatedAt + 9_999_999 }
    expect(planSync({ local: reclocked, remote: item, baseline: base, rule: r }).kind).toBe('unchanged')
  })

  it('pushes on a bold or href change even when contentText is identical', () => {
    const { task, item, base, r } = synced({ description: textContent('hi') })
    const bold = { ...task, content: { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'hi', marks: ['bold'] }] }] } as TaskContent }
    expect(planSync({ local: bold, remote: item, baseline: base, rule: r }).kind).toBe('push')
  })

  it('does not push when only the marks array order changed', () => {
    const before: TaskContent = { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'hi', marks: ['bold', 'italic'] }] }] }
    const after: TaskContent = { version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'hi', marks: ['italic', 'bold'] }] }] }
    const s = synced({ description: before })
    const changed = { ...s.task, content: after }
    expect(planSync({ local: changed, remote: s.item, baseline: s.base, rule: s.r }).kind).toBe('unchanged')
  })

  it('does not push on attachment-only local changes', () => {
    const { task, item, base, r } = synced({ description: textContent('body') })
    const withAttachment: TaskRecord = {
      ...task,
      content: { version: 1, blocks: [
        { type: 'paragraph', children: [{ text: 'body' }] },
        { type: 'attachment', id: '11111111-1111-4111-8111-111111111111', name: 'a.txt', mediaType: 'text/plain', bytes: 1 },
      ] },
    }
    expect(planSync({ local: withAttachment, remote: item, baseline: base, rule: r }).kind).toBe('unchanged')
  })

  it('merges different edited fields so the remote wins every non-status field', () => {
    const { task, item, base, r } = synced()
    const localChanged = { ...task, title: 'Local title' }
    const remoteChanged = { ...item, fields: { ...item.fields, description: value(textContent('Remote body')) } }
    const plan = planSync({ local: localChanged, remote: remoteChanged, baseline: base, rule: r })
    expect(plan.kind).toBe('merge')
    expect(plan.localPatch).toEqual({ title: 'Shared title', description: textContent('Remote body') })
    expect(plan.remotePatch).toEqual({})
  })

  it('does not clear a local description when the remote description is absent', () => {
    const { task, base, r } = synced()
    const itemNoDesc: RemoteItem = remote({
      fields: {
        title: value('Shared title'),
        description: { presence: 'absent', writable: false },
        status: value('todo' as TaskStatus),
        priority: value('medium' as TaskPriority),
        tags: value([] as string[]),
        storyPoints: value(null),
      },
      rawStatus: 'open',
    })
    const changed = { ...task, content: textContent('Local new') }
    const plan = planSync({ local: changed, remote: itemNoDesc, baseline: base, rule: r })
    expect(plan.selectedFields).not.toContain('description')
    expect(plan.kind).toBe('unchanged')
  })
})

describe('rebaseProjection', () => {
  it('initializes a newly enabled field from remote and keeps other pending edits', () => {
    const r = rule({ mappings: [{ ...mapping, optionalFields: ['storyPoints'] }] })
    const task = local({ title: 'Shared title', content: textContent('Local pending') })
    const item = remote()
    const base = baseline({ projection: { fields: ['title', 'description', 'status'], mappingRevision: 1, normalizationVersion: 1 } })
    const result = rebaseProjection({ task, remote: item, baseline: base, rule: r })
    expect(result.baseline.projection.fields).toEqual(['title', 'description', 'status', 'storyPoints'])
    expect(result.initializePatch).toEqual({ storyPoints: 3 })
  })

  it('returns the unchanged baseline when the projection did not change', () => {
    const { task, item, base, r } = synced()
    const result = rebaseProjection({ task, remote: item, baseline: base, rule: r })
    expect(result.initializePatch).toEqual({})
    expect(result.baseline).toBe(base)
  })

  it('drops a disabled field from the projection so it stops propagating', () => {
    const withPoints = { ...mapping, optionalFields: ['storyPoints'] as const }
    const r = rule({ mappings: [withPoints] })
    const task = local({ storyPoints: 7 })
    const item = remote()
    const base = baseline({ projection: { fields: ['title', 'description', 'status', 'storyPoints'], mappingRevision: 1, normalizationVersion: 1 } })
    const result = rebaseProjection({ task, remote: item, baseline: base, rule: rule() })
    expect(result.baseline.projection.fields).toEqual(['title', 'description', 'status'])
    expect(result.initializePatch).toEqual({})
  })

  it('keeps a pending local description edit pushable after enabling a field', () => {
    const { task, item, base } = synced()
    const pending = { ...task, content: textContent('Local pending') }
    const r = rule({ mappings: [{ ...mapping, optionalFields: ['storyPoints'] }] })
    const { baseline: rebased, initializePatch } = rebaseProjection({ task: pending, remote: item, baseline: base, rule: r })
    const plan = planSync({ local: applyPatch(pending, initializePatch), remote: item, baseline: rebased, rule: r })
    expect(plan.kind).toBe('push')
    expect(plan.remotePatch).toEqual({ description: textContent('Local pending') })
  })

  it('keeps a pending remote description edit pullable after enabling a field', () => {
    const { task, item, base } = synced()
    const remoteChanged = { ...item, fields: { ...item.fields, description: value(textContent('Remote pending')) } }
    const r = rule({ mappings: [{ ...mapping, optionalFields: ['storyPoints'] }] })
    const { baseline: rebased, initializePatch } = rebaseProjection({ task, remote: remoteChanged, baseline: base, rule: r })
    const plan = planSync({ local: applyPatch(task, initializePatch), remote: remoteChanged, baseline: rebased, rule: r })
    expect(plan.kind).toBe('pull')
    expect(plan.localPatch).toEqual({ description: textContent('Remote pending') })
  })

  it('keeps a both-edited merge with local status winning after enabling a field', () => {
    const { task, item, base } = synced()
    const localChanged = { ...task, content: textContent('Local new') }
    const remoteChanged = { ...item, fields: { ...item.fields, status: value('done' as TaskStatus) }, rawStatus: 'done' }
    const r = rule({ mappings: [{ ...mapping, optionalFields: ['storyPoints'] }] })
    const { baseline: rebased, initializePatch } = rebaseProjection({ task: localChanged, remote: remoteChanged, baseline: base, rule: r })
    const plan = planSync({ local: applyPatch(localChanged, initializePatch), remote: remoteChanged, baseline: rebased, rule: r })
    expect(plan.kind).toBe('merge')
    expect(plan.localPatch).toEqual({ description: textContent('Shared body') })
    expect(plan.remotePatch).toEqual({ status: 'todo' })
  })

  it('enabling a field with a remote value does not push the local default', () => {
    const { task, item, base } = synced()
    const itemWithPoints = { ...item, fields: { ...item.fields, storyPoints: value(3) } }
    const r = rule({ mappings: [{ ...mapping, optionalFields: ['storyPoints'] }] })
    const { baseline: rebased, initializePatch } = rebaseProjection({ task, remote: itemWithPoints, baseline: base, rule: r })
    expect(initializePatch).toEqual({ storyPoints: 3 })
    const plan = planSync({ local: applyPatch(task, initializePatch), remote: itemWithPoints, baseline: rebased, rule: r })
    expect(plan.kind).toBe('unchanged')
    expect(plan.remotePatch).toEqual({})
    expect(plan.localPatch).toEqual({})
  })

  it('a revision-only mapping change does not erase a pending local edit', () => {
    const { task, item, base } = synced()
    const pending = { ...task, content: textContent('Local pending') }
    const r = rule({ revision: 2 })
    const { baseline: rebased, initializePatch } = rebaseProjection({ task: pending, remote: item, baseline: base, rule: r })
    expect(initializePatch).toEqual({})
    const plan = planSync({ local: pending, remote: item, baseline: rebased, rule: r })
    expect(plan.kind).toBe('push')
    expect(plan.remotePatch).toEqual({ description: textContent('Local pending') })
  })

  it('throws MappingIncompatible when the new read map no longer matches the old raw status', () => {
    const { task, item, base } = synced()
    const r = rule({ revision: 2, mappings: [{ ...mapping, readStates: { open: 'in_progress', doing: 'in_progress', done: 'done' } }] })
    expectSyncCode(() => rebaseProjection({ task, remote: item, baseline: base, rule: r }), 'MappingIncompatible')
  })
})

describe('projectLocal and projectRemote', () => {
  it('strips attachments and canonicalizes marks in projectLocal', () => {
    const content: TaskContent = { version: 1, blocks: [
      { type: 'paragraph', children: [{ text: 'body', marks: ['italic', 'bold'] }] },
      { type: 'attachment', id: '11111111-1111-4111-8111-111111111111', name: 'a.txt', mediaType: 'text/plain', bytes: 1 },
    ] }
    const fields = projectLocal(local({ content }), fullProjection)
    expect(fields.description.blocks).toEqual([
      { type: 'paragraph', children: [{ text: 'body', marks: ['bold', 'italic'] }] },
    ])
  })

  it('normalizes remote tags by case and dedup and rejects a missing essential title', () => {
    const item = remote({ fields: { ...remote().fields, tags: value(['  Alpha ', 'alpha', 'Beta']) } })
    expect(projectRemote(item, rule()).tags).toEqual(['Alpha', 'Beta'])
    const noTitle = remote({ fields: { ...remote().fields, title: { presence: 'absent', writable: false } } })
    expectSyncCode(() => projectRemote(noTitle, rule()), 'InvalidRemoteResponse')
  })
})

describe('encodeStatus', () => {
  it('preserves an already-consistent finer-grained remote status', () => {
    const m: TypeMapping = { ...mapping, readStates: { open: 'todo', reopened: 'todo', done: 'done' } }
    const observed = { ...remote(), rawStatus: 'reopened' }
    expect(encodeStatus('todo', observed, m)).toBe('reopened')
    expect(encodeStatus('todo', { ...observed, rawStatus: 'done' }, m)).toBe('open')
  })

  it('rejects an unknown status that has no write target', () => {
    const m: TypeMapping = { ...mapping, writeStates: { todo: 'open', in_progress: 'doing' } }
    expectSyncCode(() => encodeStatus('done', { ...remote(), rawStatus: 'open' }, m), 'MappingIncompatible')
  })
})
