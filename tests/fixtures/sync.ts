import { textContent } from '../../src/content.ts'
import type { TaskPriority, TaskRecord, TaskStatus } from '../../src/types.ts'
import type {
  FieldValue, RemoteItem, RemoteKey, SyncAdapter, SyncBaseline, SyncPatch, SyncProjection,
  SyncFields, WriteEvidence, WriteIntent,
} from '../../src/sync/types.ts'
import type { SyncMetadata, SyncRule, TypeMapping } from '../../src/sync/dto.ts'

const fixedTime = 1_700_000_000_000

/** A valid local task with structured rich-text content; overrides are shallow. */
export function local(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Local task',
    content: textContent('Local body'),
    notes: 'Local body',
    status: 'todo',
    priority: 'medium',
    storyPoints: null,
    tags: [],
    workspaceId: null,
    sendImmediately: false,
    sessionId: null,
    agent: null,
    useWorktree: false,
    startedAt: null,
    completedAt: null,
    version: 1,
    createdAt: fixedTime,
    updatedAt: fixedTime,
    subtasks: [],
    ...overrides,
  }
}

function value<T>(value: T, writable = true): Extract<FieldValue<T>, { presence: 'value' }> {
  return { presence: 'value', value, writable }
}

/** A valid remote item; its key id stays a string even for giant numeric ids. */
export function remote(overrides: Partial<RemoteItem> = {}): RemoteItem {
  const description = textContent('Remote body')
  return {
    key: { instance: 'api.tapd.cn', projectId: '20000001', typeId: 'story', id: '1152921504606846976123' },
    number: '1',
    url: null,
    updatedToken: '2026-10-07T00:00:00Z',
    fields: {
      title: value<string>('Remote task'),
      description: value(description),
      status: value<TaskStatus>('in_progress'),
      priority: value<TaskPriority>('high'),
      tags: value<string[]>([]),
      storyPoints: value<number | null>(3),
    },
    rawStatus: 'in_progress',
    description: { format: 'text', raw: value<string>('Remote body'), roundTrip: true },
    revisionToken: null,
    ...overrides,
  }
}

/** A valid baseline snapshot of both sides at last sync. */
export function baseline(overrides: Partial<SyncBaseline> = {}): SyncBaseline {
  const description = textContent('Shared body')
  const fields: SyncFields = {
    title: 'Shared title',
    status: 'todo',
    priority: 'medium',
    tags: [],
    storyPoints: null,
    description,
  }
  const projection: SyncProjection = { fields: ['title', 'status'], mappingRevision: 1, normalizationVersion: 1 }
  const remotePresence: SyncBaseline['remotePresence'] = {
    title: 'value', description: 'value', status: 'value', priority: 'value', tags: 'value', storyPoints: 'value',
  }
  return {
    local: fields,
    remote: fields,
    localVersion: 1,
    localUpdatedAt: fixedTime,
    remoteUpdatedToken: 'token-1',
    rawStatus: 'open',
    projection,
    remotePresence,
    remoteDescription: { format: 'text', raw: value<string>('Shared body'), roundTrip: true },
    ...overrides,
  }
}

/** A valid, disabled rule with one story mapping. */
export function rule(overrides: Partial<SyncRule> = {}): SyncRule {
  const mapping: TypeMapping = {
    typeId: 'story',
    category: 'story',
    readStates: { open: 'todo', doing: 'in_progress', done: 'done' },
    writeStates: { todo: 'open', in_progress: 'doing', done: 'done' },
    optionalFields: [],
    fieldIds: { title: 'name', status: 'status' },
    valueMaps: {},
  }
  return {
    id: '22222222-2222-4222-8222-222222222222',
    revision: 1,
    connectionId: '33333333-3333-4333-8333-333333333333',
    projectId: '20000001',
    enabled: false,
    workspaceId: null,
    filters: { assignees: [], typeIds: ['story'], iterationIds: [], statusIds: [] },
    mappings: [mapping],
    ...overrides,
  }
}

/** A controllable in-memory adapter spy; it performs no network and records reads/writes. */
export interface FakeAdapter extends SyncAdapter {
  readCalls: RemoteKey[]
  writeCalls: { key: RemoteKey; patch: SyncPatch; observed: RemoteItem; rule: SyncRule }[]
  evidenceCalls: WriteIntent[]
  setMetadata(value: SyncMetadata): void
  setRead(value: RemoteItem): void
  setDiscover(batches: RemoteItem[][]): void
  setEvidence(value: WriteEvidence): void
}

export function fakeAdapter(): FakeAdapter {
  const readCalls: RemoteKey[] = []
  const writeCalls: FakeAdapter['writeCalls'] = []
  const evidenceCalls: WriteIntent[] = []
  let metadataValue: SyncMetadata | null = null
  let discoverBatches: RemoteItem[][] = []
  let readValue: RemoteItem | null = null
  let evidenceValue: WriteEvidence = 'unknown'

  return {
    readCalls,
    writeCalls,
    evidenceCalls,
    setMetadata(value) { metadataValue = value },
    setRead(value) { readValue = value },
    setDiscover(batches) { discoverBatches = batches },
    setEvidence(value) { evidenceValue = value },
    async metadata() {
      if (!metadataValue) throw new Error('fakeAdapter metadata not configured')
      return metadataValue
    },
    async *discover() {
      for (const batch of discoverBatches) yield batch
    },
    async read(key, _rule, _signal) {
      readCalls.push(key)
      if (!readValue) throw new Error('fakeAdapter read not configured')
      return readValue
    },
    async write(key, patch, observed, rule) {
      writeCalls.push({ key, patch, observed, rule })
    },
    async evidence(intent) {
      evidenceCalls.push(intent)
      return evidenceValue
    },
  }
}
