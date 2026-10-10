import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { TaskStore } from '../store.ts'
import type { CreateTaskRequest, TaskContent, TaskRecord, TaskSourceError, UpdateTaskRequest } from '../types.ts'
import type {
  Clock, FinalizeItem, PrepareIntent, ReconcileResult, RemoteItem, RemoteKey, RunFence, SyncAdapter,
  SyncBaseline, SyncField, SyncFields, SyncLink, SyncPatch, WriteIntent,
} from './types.ts'
import type { SafeItemResult, SyncErrorDto, SyncRule } from './dto.ts'
import { syncError, syncRemoteError } from './errors.ts'
import { serializeRemoteKey } from './schema.ts'
import { withSqliteTransaction } from '../sqlite-transaction.ts'
import { assertRunFence, recordRunItemResult } from './run-store.ts'
import { buildBaseline, projectLocal, projectRemote, projectionFor } from './snapshot.ts'
import { mergeLocalAttachments } from './description-codec.ts'
import { reconcileIntent } from './reconcile.ts'

const realClock: Clock = { now: () => Date.now(), sleep: async () => {} }

interface LinkRow {
  id: string
  rule_id: string
  task_id: string | null
  task_generation: string
  platform: string
  instance: string
  project_id: string
  type_id: string
  remote_id: string
  number: string
  url: string | null
  canonical: string
  revision: number
  last_success_at: number | null
  last_error: string | null
  created_at: number
  updated_at: number
  baseline: string | null
}

interface IntentRow {
  id: string
  link_id: string
  task_id: string | null
  task_generation: string
  link_revision: number
  run_id: string
  owner_id: string
  generation: number
  rule_snapshot: string
  baseline: string
  local_before: string
  local_version: number
  remote_before: string
  patch: string
  expected: string
  phase: string
  error: string | null
  instance: string
  project_id: string
  type_id: string
  remote_id: string
}

const PENDING_PHASES = ['prepared', 'dispatched', 'unknown']

function hasPatch(patch: SyncPatch): boolean {
  return patch.title !== undefined || patch.description !== undefined || patch.status !== undefined
    || patch.priority !== undefined || patch.tags !== undefined || patch.storyPoints !== undefined
}

function patchToUpdate(taskId: string, version: number, patch: SyncPatch, content: TaskContent | undefined): UpdateTaskRequest {
  const request: UpdateTaskRequest = { id: taskId, version }
  if (patch.title !== undefined) request.title = patch.title
  if (content !== undefined) request.content = content
  if (patch.status !== undefined) request.status = patch.status
  if (patch.priority !== undefined) request.priority = patch.priority
  if (patch.tags !== undefined) request.tags = patch.tags
  if (patch.storyPoints !== undefined) request.storyPoints = patch.storyPoints
  return request
}

/**
 * Import a remote item into a task: no fake title, essential fields required,
 * default workspace honoured. The description is the packed work-item body the
 * adapter decoded (number, platform fields and the item's own text), and the
 * only synced field afterwards is the status — priority, tags and story points
 * stay local, so nothing fills them from the platform.
 */
function importedTaskRequest(item: RemoteItem, rule: SyncRule): CreateTaskRequest {
  const fields = projectRemote(item, rule)
  return {
    title: fields.title,
    content: fields.description,
    status: fields.status,
    priority: 'medium',
    tags: [],
    storyPoints: null,
    workspaceId: rule.workspaceId ?? null,
  }
}

function linkOf(row: LinkRow): SyncLink {
  return {
    id: row.id,
    key: { instance: row.instance, projectId: row.project_id, typeId: row.type_id, id: row.remote_id },
    ruleId: row.rule_id,
    taskId: row.task_id,
    taskGeneration: row.task_generation,
    revision: row.revision,
    baseline: row.baseline === null ? null : JSON.parse(row.baseline) as SyncBaseline,
  }
}

function intentOf(row: IntentRow): WriteIntent {
  return {
    id: row.id,
    linkId: row.link_id,
    key: { instance: row.instance, projectId: row.project_id, typeId: row.type_id, id: row.remote_id },
    taskId: row.task_id,
    taskGeneration: row.task_generation,
    linkRevision: row.link_revision,
    fence: { runId: row.run_id, ownerId: row.owner_id, generation: row.generation },
    ruleSnapshot: JSON.parse(row.rule_snapshot) as SyncRule,
    baseline: JSON.parse(row.baseline) as SyncBaseline,
    localBefore: JSON.parse(row.local_before) as SyncFields,
    localVersion: row.local_version,
    remoteBefore: JSON.parse(row.remote_before) as RemoteItem,
    patch: JSON.parse(row.patch) as SyncPatch,
    expected: JSON.parse(row.expected) as SyncFields,
    phase: row.phase as WriteIntent['phase'],
  }
}

function sourceErrorOf(lastError: string | null): TaskSourceError | null {
  if (lastError === null) return null
  const error = JSON.parse(lastError) as SyncErrorDto
  return { code: error.code, problem: error.problem, action: error.action }
}

const SELECT_LINK = `SELECT l.*, b.data AS baseline FROM sync_links l LEFT JOIN sync_baselines b ON b.link_id = l.id`
const SELECT_INTENT = `SELECT wi.*, l.instance AS instance, l.project_id AS project_id, l.type_id AS type_id, l.remote_id AS remote_id
  FROM sync_write_intents wi JOIN sync_links l ON l.id = wi.link_id`

export class SyncLinkStore {
  readonly db: DatabaseSync
  private readonly tasks: TaskStore
  private readonly clock: Clock

  constructor(db: DatabaseSync, tasks: TaskStore, clock: Clock = realClock) {
    this.db = db
    this.tasks = tasks
    this.clock = clock
  }

  private platformOf(ruleId: string): 'yunxiao' | 'tapd' {
    const row = this.db.prepare('SELECT c.platform AS platform FROM sync_connections c JOIN sync_rules r ON r.connection_id = c.id WHERE r.id = ?').get(ruleId) as { platform: 'yunxiao' | 'tapd' } | undefined
    if (!row) throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'ruleId' }))
    return row.platform
  }

  getLink(key: RemoteKey): SyncLink | null {
    const row = this.db.prepare(`${SELECT_LINK} WHERE l.canonical = ?`).get(serializeRemoteKey(key)) as unknown as LinkRow | undefined
    return row ? linkOf(row) : null
  }

  getLinkByTask(taskId: string): SyncLink | null {
    const row = this.db.prepare(`${SELECT_LINK} WHERE l.task_id = ?`).get(taskId) as unknown as LinkRow | undefined
    return row ? linkOf(row) : null
  }

  listLinked(ruleId: string, afterKey: string | null, limit: number): SyncLink[] {
    const bounded = Math.min(Math.max(1, Math.trunc(limit)), 100)
    const rows = this.db.prepare(`${SELECT_LINK} WHERE l.rule_id = ? AND l.canonical > ? ORDER BY l.canonical LIMIT ?`)
      .all(ruleId, afterKey ?? '', bounded) as unknown as LinkRow[]
    return rows.map(linkOf)
  }

  importItem(item: RemoteItem, rule: SyncRule, fence: RunFence): TaskRecord {
    // Every executor entry requires a live ownership fence, including the
    // read-only "already linked" return; an expired or stale owner must not
    // continue the run, only a live one may import.
    assertRunFence(this.db, fence, this.clock.now())
    const canonical = serializeRemoteKey(item.key)
    if (this.getPending(item.key)) throw syncRemoteError(syncError('WriteOutcomeUnknown', { scope: 'item', retryable: true }))
    const existing = this.getLink(item.key)
    if (existing && existing.taskId !== null) return this.tasks.get(existing.taskId)!
    return withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const task = this.tasks.create(importedTaskRequest(item, rule))
      const taskGeneration = randomUUID()
      const now = this.clock.now()
      const baseline = buildBaseline(task, item, rule)
      const platform = this.platformOf(rule.id)
      if (existing) {
        this.db.prepare(`UPDATE sync_links SET task_id = ?, task_generation = ?, number = ?, url = ?,
          revision = revision + 1, updated_at = ? WHERE id = ?`).run(task.id, taskGeneration, item.number, item.url, now, existing.id)
        this.db.prepare('DELETE FROM sync_baselines WHERE link_id = ?').run(existing.id)
        this.db.prepare('INSERT INTO sync_baselines (link_id, data) VALUES (?, ?)').run(existing.id, JSON.stringify(baseline))
      } else {
        const id = randomUUID()
        this.db.prepare(`INSERT INTO sync_links (id, rule_id, task_id, task_generation, platform, instance, project_id, type_id, remote_id, number, url, canonical, revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
          id, rule.id, task.id, taskGeneration, platform, item.key.instance, item.key.projectId, item.key.typeId, item.key.id,
          item.number, item.url, canonical, now, now,
        )
        this.db.prepare('INSERT INTO sync_baselines (link_id, data) VALUES (?, ?)').run(id, JSON.stringify(baseline))
      }
      return task
    })
  }

  prepareIntent(input: PrepareIntent): WriteIntent {
    const id = randomUUID()
    const now = this.clock.now()
    const baseline = input.link.baseline ?? buildBaseline(input.task, input.observed, input.rule)
    const projection = projectionFor(input.rule)
    const localBefore = projectLocal(input.task, projection)
    const expected = { ...projectRemote(input.observed, input.rule), ...input.plan.remotePatch }
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, input.fence, this.clock.now())
      this.db.prepare(`INSERT INTO sync_write_intents (id, link_id, task_id, task_generation, link_revision, run_id, owner_id, generation, rule_snapshot, baseline, local_before, local_version, remote_before, patch, expected, phase, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`).run(
        id, input.link.id, input.link.taskId, input.link.taskGeneration, input.link.revision,
        input.fence.runId, input.fence.ownerId, input.fence.generation,
        JSON.stringify(input.rule), JSON.stringify(baseline), JSON.stringify(localBefore), input.task.version,
        JSON.stringify(input.observed), JSON.stringify(input.plan.remotePatch), JSON.stringify(expected), now, now,
      )
    })
    return this.getIntent(id)!
  }

  private getIntent(id: string): WriteIntent | null {
    const row = this.db.prepare(`${SELECT_INTENT} WHERE wi.id = ?`).get(id) as unknown as IntentRow | undefined
    return row ? intentOf(row) : null
  }

  markDispatched(intentId: string, fence: RunFence): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const result = this.db.prepare(`UPDATE sync_write_intents SET phase = 'dispatched', updated_at = ?
        WHERE id = ? AND run_id = ? AND owner_id = ? AND generation = ? AND phase = 'prepared'`).run(
        this.clock.now(), intentId, fence.runId, fence.ownerId, fence.generation,
      )
      if (result.changes !== 1) throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'intentId' }))
    })
  }

  recordUnknown(intentId: string, fence: RunFence, error: SyncErrorDto): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const result = this.db.prepare(`UPDATE sync_write_intents SET phase = 'unknown', error = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND owner_id = ? AND generation = ? AND phase IN ('prepared', 'dispatched')`).run(
        JSON.stringify(error), this.clock.now(), intentId, fence.runId, fence.ownerId, fence.generation,
      )
      if (result.changes !== 1) throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'intentId' }))
    })
  }

  /**
   * Cancel a prepared/dispatched intent after a definitive write rejection
   * (e.g. a platform 4xx). Unlike {@link recordUnknown}, the intent leaves the
   * pending set, so it is never re-reconciled as an uncertain outcome. The
   * rejection error is retained for the link's last_error.
   */
  cancelIntent(intentId: string, fence: RunFence, error: SyncErrorDto): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const result = this.db.prepare(`UPDATE sync_write_intents SET phase = 'cancelled', error = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND owner_id = ? AND generation = ? AND phase IN ('prepared', 'dispatched')`).run(
        JSON.stringify(error), this.clock.now(), intentId, fence.runId, fence.ownerId, fence.generation,
      )
      if (result.changes !== 1) throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'intentId' }))
    })
  }

  getPending(key: RemoteKey): WriteIntent | null {
    const row = this.db.prepare(`${SELECT_INTENT} WHERE l.canonical = ? AND wi.phase IN ('prepared', 'dispatched', 'unknown')
      ORDER BY wi.created_at DESC LIMIT 1`).get(serializeRemoteKey(key)) as unknown as IntentRow | undefined
    return row ? intentOf(row) : null
  }

  listPending(ruleId: string, afterId: string | null, limit: number): WriteIntent[] {
    const bounded = Math.min(Math.max(1, Math.trunc(limit)), 100)
    const rows = this.db.prepare(`${SELECT_INTENT} WHERE l.rule_id = ? AND wi.phase IN ('prepared', 'dispatched', 'unknown')
      AND wi.id > ? ORDER BY wi.id LIMIT ?`).all(ruleId, afterId ?? '', bounded) as unknown as IntentRow[]
    return rows.map(intentOf)
  }

  finalizeItem(input: FinalizeItem): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, input.fence, this.clock.now())
      const link = this.db.prepare('SELECT * FROM sync_links WHERE id = ?').get(input.linkId) as unknown as LinkRow | undefined
      if (!link) throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'linkId' }))
      if (link.revision !== input.linkRevision || link.task_generation !== input.taskGeneration) {
        throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
      }
      const taskId = link.task_id
      if (taskId !== null && hasPatch(input.localPatch)) {
        const task = this.tasks.get(taskId)
        if (!task) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
        if (task.version !== input.expectedTaskVersion) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
        const content = input.localPatch.description === undefined
          ? undefined
          : mergeLocalAttachments(input.localPatch.description, task.content)
        this.tasks.update(patchToUpdate(taskId, task.version, input.localPatch, content))
      }
      const now = this.clock.now()
      this.db.prepare(`INSERT INTO sync_baselines (link_id, data) VALUES (?, ?)
        ON CONFLICT(link_id) DO UPDATE SET data = excluded.data`).run(input.linkId, JSON.stringify(input.baseline))
      if (input.intentId !== null) {
        // Confirming a write intent is fenced to the exact link, revision, task and run it
        // was prepared for. A wrong intent (another link/canonical key, a stale revision, a
        // different run/owner/generation) must be rejected and every compound write rolled back.
        const intent = this.db.prepare(`SELECT link_id AS linkId, task_id AS taskId, task_generation AS taskGeneration,
          link_revision AS linkRevision, run_id AS runId, owner_id AS ownerId, generation
          FROM sync_write_intents WHERE id = ?`).get(input.intentId) as {
          linkId: string; taskId: string | null; taskGeneration: string; linkRevision: number
          runId: string; ownerId: string; generation: number
        } | undefined
        if (!intent) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item', field: 'intentId' }))
        if (intent.runId !== input.fence.runId || intent.ownerId !== input.fence.ownerId || intent.generation !== input.fence.generation) {
          throw syncRemoteError(syncError('StaleOwner', { scope: 'run', runId: input.fence.runId }))
        }
        if (intent.linkId !== input.linkId || intent.linkRevision !== input.linkRevision
          || intent.taskGeneration !== input.taskGeneration || intent.taskId !== taskId) {
          throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
        }
        const confirmed = this.db.prepare(`UPDATE sync_write_intents SET phase = 'confirmed', error = NULL, updated_at = ?
          WHERE id = ? AND link_id = ? AND link_revision = ? AND task_generation = ? AND task_id IS ?
            AND run_id = ? AND owner_id = ? AND generation = ? AND phase IN ('dispatched', 'unknown')`).run(
          now, input.intentId, input.linkId, input.linkRevision, input.taskGeneration, taskId,
          input.fence.runId, input.fence.ownerId, input.fence.generation,
        )
        if (confirmed.changes !== 1) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
      }
      const success = input.result.error === null
      this.db.prepare(`UPDATE sync_links SET revision = revision + 1, last_success_at = ?, last_error = ?, updated_at = ? WHERE id = ?`).run(
        success ? now : link.last_success_at, success ? null : JSON.stringify(input.result.error), now, input.linkId,
      )
      recordRunItemResult(this.db, input.fence.runId, { ...input.result, taskId })
    })
  }

  /**
   * Reconcile a pending intent dispatched by a different (now-expired) run and,
   * when the remote effect is actually confirmed by read-only observation, adopt
   * it under the current fence. The read runs entirely outside any DB transaction;
   * only the confirm is a short fenced transaction. The original write provenance
   * and baseline are preserved unchanged, and the recorded result is derived from
   * the observed effect — never from caller-supplied baseline/result input, so a
   * fabricated confirmation cannot reach the store.
   */
  async reconcileAndAdopt(intentId: string, fence: RunFence, adapter: SyncAdapter, signal: AbortSignal): Promise<ReconcileResult> {
    assertRunFence(this.db, fence, this.clock.now())
    const state = this.readAdoptionState(intentId, fence)
    this.assertRuleEnabled(state.ruleId)
    const result = await reconcileIntent(state.intent, adapter, signal)
    if (result.kind !== 'confirmed') return result
    this.confirmReconciled(intentId, fence, state)
    return result
  }

  private readAdoptionState(intentId: string, fence: RunFence): { intent: WriteIntent; ruleId: string; taskVersion: number | null } {
    const intent = this.getIntent(intentId)
    if (!intent) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item', field: 'intentId' }))
    if (intent.phase !== 'dispatched' && intent.phase !== 'unknown') {
      throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item', field: 'intentId' }))
    }
    if (intent.fence.runId === fence.runId) {
      throw syncRemoteError(syncError('StaleOwner', { scope: 'run', runId: fence.runId }))
    }
    const link = this.db.prepare('SELECT rule_id AS ruleId FROM sync_links WHERE id = ?').get(intent.linkId) as { ruleId: string } | undefined
    if (!link) throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'linkId' }))
    let taskVersion: number | null = null
    if (intent.taskId !== null) {
      const task = this.tasks.get(intent.taskId)
      if (!task) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
      taskVersion = task.version
    }
    return { intent, ruleId: link.ruleId, taskVersion }
  }

  private assertRuleEnabled(ruleId: string): void {
    const row = this.db.prepare(`SELECT r.enabled AS ruleEnabled, c.enabled AS connEnabled
      FROM sync_rules r JOIN sync_connections c ON c.id = r.connection_id WHERE r.id = ?`).get(ruleId) as { ruleEnabled: number; connEnabled: number } | undefined
    if (!row || row.ruleEnabled !== 1 || row.connEnabled !== 1) {
      throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'enabled' }))
    }
  }

  /** Short fenced transaction: re-verify fence/CAS, then record the confirmed adoption. */
  private confirmReconciled(intentId: string, fence: RunFence, state: { intent: WriteIntent; taskVersion: number | null }): void {
    withSqliteTransaction(this.db, () => {
      assertRunFence(this.db, fence, this.clock.now())
      const row = this.db.prepare(`SELECT link_id AS linkId, task_id AS taskId, task_generation AS taskGeneration,
        link_revision AS linkRevision, run_id AS runId, owner_id AS ownerId, generation, phase
        FROM sync_write_intents WHERE id = ?`).get(intentId) as {
        linkId: string; taskId: string | null; taskGeneration: string; linkRevision: number
        runId: string; ownerId: string; generation: number; phase: string
      } | undefined
      if (!row) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item', field: 'intentId' }))
      if (row.phase !== 'dispatched' && row.phase !== 'unknown') {
        throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item', field: 'intentId' }))
      }
      if (row.runId === fence.runId) throw syncRemoteError(syncError('StaleOwner', { scope: 'run', runId: fence.runId }))
      const link = this.db.prepare('SELECT id, revision, task_generation AS taskGeneration, task_id AS taskId FROM sync_links WHERE id = ?').get(row.linkId) as {
        id: string; revision: number; taskGeneration: string; taskId: string | null
      } | undefined
      if (!link) throw syncRemoteError(syncError('InvalidConfig', { scope: 'item', field: 'linkId' }))
      if (link.revision !== row.linkRevision || link.taskGeneration !== row.taskGeneration || link.taskId !== row.taskId) {
        throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
      }
      if (row.taskId !== null) {
        const task = this.tasks.get(row.taskId)
        if (!task || task.version !== state.taskVersion) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item' }))
      }
      const now = this.clock.now()
      const confirmed = this.db.prepare(`UPDATE sync_write_intents SET phase = 'confirmed', error = NULL, updated_at = ?,
        confirmed_run_id = ?, confirmed_owner_id = ?, confirmed_generation = ?
        WHERE id = ? AND phase IN ('dispatched', 'unknown')
          AND run_id = ? AND owner_id = ? AND generation = ? AND link_revision = ? AND task_generation = ?`).run(
        now, fence.runId, fence.ownerId, fence.generation,
        intentId, row.runId, row.ownerId, row.generation, row.linkRevision, row.taskGeneration,
      )
      if (confirmed.changes !== 1) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'item', field: 'intentId' }))
      // Derive the safe result from the recorded intent + confirmed observation, never
      // from caller input; the baseline is left untouched for the next full sync.
      recordRunItemResult(this.db, fence.runId, {
        key: state.intent.key,
        taskId: row.taskId,
        category: 'pushed',
        changedFields: Object.keys(state.intent.patch) as SyncField[],
        discardedFields: [],
        writtenBack: true,
        outsideFilter: false,
        error: null,
      })
      this.db.prepare('UPDATE sync_links SET last_error = NULL, updated_at = ? WHERE id = ?').run(now, row.linkId)
    })
  }

  attachSources(tasks: TaskRecord[]): TaskRecord[] {
    if (tasks.length === 0) return tasks
    const ids = tasks.map(task => task.id)
    const rows = this.db.prepare(`SELECT task_id AS taskId, platform, project_id AS projectId, type_id AS typeId,
      remote_id AS remoteId, number, url, last_success_at AS lastSuccess, last_error AS lastError
      FROM sync_links WHERE task_id IN (${ids.map(() => '?').join(', ')})`).all(...ids) as unknown as {
      taskId: string; platform: 'yunxiao' | 'tapd'; projectId: string; typeId: string; remoteId: string; number: string;
      url: string | null; lastSuccess: number | null; lastError: string | null
    }[]
    const byTask = new Map(rows.map(row => [row.taskId, row]))
    return tasks.map(task => {
      const source = byTask.get(task.id)
      if (!source) return task
      return {
        ...task,
        source: {
          platform: source.platform, projectId: source.projectId, typeId: source.typeId, remoteId: source.remoteId,
          number: source.number, url: source.url, lastSuccess: source.lastSuccess, error: sourceErrorOf(source.lastError),
        },
      }
    })
  }
}
