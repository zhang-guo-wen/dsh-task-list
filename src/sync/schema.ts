import { DatabaseSync } from 'node:sqlite'
import type { RemoteKey } from './types.ts'
import { syncError, syncRemoteError } from './errors.ts'

/** Schema version the sync tables land in; the store refuses anything newer. */
export const SYNC_SCHEMA_VERSION = 10

/**
 * Stable, unique serialization of a remote identity. Ids stay strings and may
 * contain arbitrary non-control characters, so a JSON array is the canonical
 * key rather than a delimiter join.
 */
export function serializeRemoteKey(key: RemoteKey): string {
  return JSON.stringify([key.instance, key.projectId, key.typeId, key.id])
}

/** The singleton ownership lock introduced in schema 7 (per-run locks are a v6-era shape). */
const RUN_LOCK_TABLE = `CREATE TABLE sync_run_lock (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK(generation >= 0),
  heartbeat_at INTEGER NOT NULL,
  lease_expires_at INTEGER NOT NULL
) STRICT;`

const syncSchema = `
CREATE TABLE sync_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
  revision INTEGER NOT NULL CHECK(revision >= 1),
  instance TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('yunxiao', 'tapd')),
  mode TEXT CHECK(mode IS NULL OR mode IN ('center', 'region')),
  organization_id TEXT,
  region_host TEXT,
  token_env TEXT,
  company_id TEXT,
  user_env TEXT,
  password_env TEXT,
  authentication TEXT NOT NULL DEFAULT '{"mode":"manual"}'
) STRICT;

CREATE TABLE sync_rules (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  connection_id TEXT NOT NULL REFERENCES sync_connections(id),
  instance TEXT NOT NULL,
  project_id TEXT NOT NULL,
  project_name TEXT,
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
  workspace_id TEXT,
  filters TEXT NOT NULL,
  mappings TEXT NOT NULL,
  UNIQUE(instance, project_id)
) STRICT;
CREATE INDEX sync_rules_connection ON sync_rules(connection_id);

CREATE TABLE sync_links (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES sync_rules(id),
  task_id TEXT UNIQUE REFERENCES tasks(id) ON DELETE SET NULL,
  task_generation TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('yunxiao', 'tapd')),
  instance TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  number TEXT NOT NULL,
  url TEXT,
  canonical TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  last_success_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sync_links_rule_canonical ON sync_links(rule_id, canonical);
CREATE INDEX sync_links_created_at ON sync_links(created_at);

CREATE TABLE sync_baselines (
  link_id TEXT PRIMARY KEY REFERENCES sync_links(id) ON DELETE CASCADE,
  data TEXT NOT NULL
) STRICT;

CREATE TABLE sync_write_intents (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES sync_links(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  task_generation TEXT NOT NULL,
  link_revision INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK(generation >= 0),
  rule_snapshot TEXT NOT NULL,
  baseline TEXT NOT NULL,
  local_before TEXT NOT NULL,
  local_version INTEGER NOT NULL,
  remote_before TEXT NOT NULL,
  patch TEXT NOT NULL,
  expected TEXT NOT NULL,
  phase TEXT NOT NULL CHECK(phase IN ('prepared', 'dispatched', 'unknown', 'confirmed', 'cancelled')),
  error TEXT,
  confirmed_run_id TEXT,
  confirmed_owner_id TEXT,
  confirmed_generation INTEGER CHECK(confirmed_generation IS NULL OR confirmed_generation >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sync_write_intents_link ON sync_write_intents(link_id);
CREATE INDEX sync_write_intents_pending ON sync_write_intents(phase) WHERE phase IN ('prepared', 'dispatched', 'unknown');
CREATE INDEX sync_write_intents_created ON sync_write_intents(created_at);

CREATE TABLE sync_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'partial', 'failed', 'interrupted')),
  phase TEXT NOT NULL CHECK(phase IN ('discovering', 'processing', 'waiting', 'finished')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  counts_imported INTEGER NOT NULL DEFAULT 0,
  counts_pulled INTEGER NOT NULL DEFAULT 0,
  counts_pushed INTEGER NOT NULL DEFAULT 0,
  counts_merged INTEGER NOT NULL DEFAULT 0,
  counts_unchanged INTEGER NOT NULL DEFAULT 0,
  counts_failed INTEGER NOT NULL DEFAULT 0,
  counts_pending INTEGER NOT NULL DEFAULT 0,
  unprocessed_known INTEGER,
  discovery_complete INTEGER NOT NULL DEFAULT 0 CHECK(discovery_complete IN (0, 1)),
  scope_summary TEXT NOT NULL DEFAULT '',
  errors TEXT NOT NULL DEFAULT '[]'
) STRICT;
CREATE INDEX sync_runs_started ON sync_runs(started_at);

CREATE TABLE sync_run_items (
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  task_id TEXT,
  category TEXT NOT NULL CHECK(category IN ('imported', 'pulled', 'pushed', 'merged', 'unchanged', 'failed')),
  changed_fields TEXT NOT NULL,
  discarded_fields TEXT NOT NULL,
  written_back INTEGER NOT NULL CHECK(written_back IN (0, 1)),
  outside_filter INTEGER NOT NULL CHECK(outside_filter IN (0, 1)),
  error TEXT,
  pending INTEGER NOT NULL DEFAULT 0 CHECK(pending IN (0, 1)),
  PRIMARY KEY (run_id, canonical)
) STRICT;
CREATE INDEX sync_run_items_run ON sync_run_items(run_id);

CREATE TABLE sync_seen_keys (
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  PRIMARY KEY (run_id, canonical)
) STRICT;

${RUN_LOCK_TABLE}
`

/** The legacy one-lock-per-run shape (schema 6) the v7 migration must rebuild. */
const OLD_RUN_LOCK_COLUMNS = ['run_id', 'owner_id', 'generation'] as const
const NEW_RUN_LOCK_COLUMNS = ['id', 'run_id', 'owner_id', 'generation', 'heartbeat_at', 'lease_expires_at'] as const
const CONFIRM_AUDIT_COLUMNS = ['confirmed_run_id', 'confirmed_owner_id', 'confirmed_generation'] as const

function readUserVersion(db: DatabaseSync): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
}

function tableColumns(db: DatabaseSync, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]
  return new Set(rows.map(row => row.name))
}

function hasAll(columns: Set<string>, required: readonly string[]): boolean {
  return required.every(name => columns.has(name))
}

/** An unrecognized table shape is a storage failure, never a heuristic drop. */
function storageShapeError(table: string): never {
  throw syncRemoteError(syncError('StorageFailure', { scope: 'config', field: table }))
}

/**
 * Advance a schema-6 database to 7 without any heuristic data loss. Only the two
 * tables whose shape changed since v6 are inspected via `PRAGMA table_info`:
 * `sync_write_intents` (gains three confirmed-* audit columns) and `sync_run_lock`
 * (per-run `run_id` primary key becomes the singleton `id CHECK(id = 1)`). A shape
 * that is neither the exact old nor the exact new form is rejected rather than
 * guessed. Old `running` runs are marked `interrupted` before the lock table is
 * rebuilt (the lock role is transient; pending intents retain the original owner).
 */
function migrateV6ToV7(db: DatabaseSync): void {
  const intentColumns = tableColumns(db, 'sync_write_intents')
  const lockColumns = tableColumns(db, 'sync_run_lock')

  const intentNew = hasAll(intentColumns, CONFIRM_AUDIT_COLUMNS)
  const intentOld = !CONFIRM_AUDIT_COLUMNS.some(name => intentColumns.has(name))
  const lockNew = hasAll(lockColumns, NEW_RUN_LOCK_COLUMNS)
  const lockOld = hasAll(lockColumns, OLD_RUN_LOCK_COLUMNS)
    && !lockColumns.has('id') && !lockColumns.has('heartbeat_at') && !lockColumns.has('lease_expires_at')

  if (!intentNew && !intentOld) throw storageShapeError('sync_write_intents')
  if (!lockNew && !lockOld) throw storageShapeError('sync_run_lock')

  if (intentOld) {
    db.exec(`ALTER TABLE sync_write_intents ADD COLUMN confirmed_run_id TEXT;
      ALTER TABLE sync_write_intents ADD COLUMN confirmed_owner_id TEXT;
      ALTER TABLE sync_write_intents ADD COLUMN confirmed_generation INTEGER CHECK(confirmed_generation IS NULL OR confirmed_generation >= 0)`)
  }

  if (lockOld) {
    db.exec(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished' WHERE status = 'running'`)
    db.exec('ALTER TABLE sync_run_lock RENAME TO sync_run_lock_v6')
    db.exec(RUN_LOCK_TABLE)
    db.exec('DROP TABLE sync_run_lock_v6')
  }
}

/**
 * Advance a schema-7 database to 8 by adding the per-item `pending` flag
 * (persists whether a result left an unresolved write intent, so counter
 * reconciliation is idempotent across re-records). Existing rows are backfilled
 * from two sources without heuristic loss: a stored pending error code
 * (`WriteOutcomeUnknown` / `VerificationFailed`) marks pending directly, and a
 * still-unresolved intent for the same run+link canonical marks pending by
 * correlation (the StorageFailure-at-finalize case, where the error code alone
 * is not a pending code). The column is `NOT NULL DEFAULT 0` so a strict table
 * gains it without rewriting rows.
 */
function migrateV7ToV8(db: DatabaseSync): void {
  const itemColumns = tableColumns(db, 'sync_run_items')
  if (itemColumns.has('pending')) return
  db.exec('ALTER TABLE sync_run_items ADD COLUMN pending INTEGER NOT NULL DEFAULT 0 CHECK(pending IN (0, 1))')

  const setPending = db.prepare('UPDATE sync_run_items SET pending = 1 WHERE run_id = ? AND canonical = ?')
  const errorRows = db.prepare('SELECT run_id, canonical, error FROM sync_run_items WHERE error IS NOT NULL').all() as unknown as { run_id: string; canonical: string; error: string }[]
  for (const row of errorRows) {
    let code: string | null = null
    try { code = (JSON.parse(row.error) as { code?: unknown }).code as string | null } catch { code = null }
    if (code === 'WriteOutcomeUnknown' || code === 'VerificationFailed') setPending.run(row.run_id, row.canonical)
  }

  // StorageFailure-at-finalize leaves the intent dispatched (pending) with a
  // non-pending error code; correlate on the same run + link canonical only.
  db.exec(`UPDATE sync_run_items SET pending = 1
    WHERE EXISTS (
      SELECT 1 FROM sync_write_intents wi
      JOIN sync_links l ON l.id = wi.link_id
      WHERE l.canonical = sync_run_items.canonical
        AND wi.run_id = sync_run_items.run_id
        AND wi.phase IN ('prepared', 'dispatched', 'unknown')
    )`)
}

/** Create or advance the sync tables to the current version; any failure rolls the whole DDL back. */
export function migrateSyncSchema(db: DatabaseSync): void {
  const version = readUserVersion(db)
  if (version > SYNC_SCHEMA_VERSION) throw new Error(`unsupported task database version: ${version}`)
  if (version === SYNC_SCHEMA_VERSION) return
  if (version < 6) {
    // Sync tables are introduced at version 6, so there is nothing to preserve.
    db.exec(syncSchema)
  } else {
    migrateV6ToV7(db)
    migrateV7ToV8(db)
    if (!tableColumns(db, 'sync_connections').has('authentication')) db.exec(`ALTER TABLE sync_connections ADD COLUMN authentication TEXT NOT NULL DEFAULT '{"mode":"manual"}'`)
    // v10 records the display label of a rule's project beside its id, so the
    // roster can name it without a platform request; existing rows keep NULL and
    // fall back to the id until they are saved again.
    if (!tableColumns(db, 'sync_rules').has('project_name')) db.exec('ALTER TABLE sync_rules ADD COLUMN project_name TEXT')
  }
  db.exec(`PRAGMA user_version = ${SYNC_SCHEMA_VERSION}`)
}
