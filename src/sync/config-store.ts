import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, DeleteConnectionRequest, DeleteSyncRuleRequest,
  SafeConnection, StatusWriteStates, SyncRule, UpdateConnectionRequest, UpdateSyncRuleRequest,
  WorkitemConditionGroups, WorkitemFillField,
} from './dto.ts'
import { DEFAULT_WORKITEM_FILL_FIELDS, WORKITEM_FILL_FIELDS_BY_PLATFORM } from './dto.ts'
import { statusMappingReady } from './mapping.ts'
import { buildConditions } from './query/filters.ts'
import { syncError, syncRemoteError } from './errors.ts'
import { parseConnectionAuth } from './validation.ts'
import { withSqliteTransaction } from '../sqlite-transaction.ts'

type Env = () => Record<string, string | undefined>

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u
const NAME_LIMIT = 100
const ID_LIMIT = 200
const ENV_LIMIT = 128
const LIST_LIMIT = 100
const CONTROL = /[\u0000-\u001f]/u

function validateName(scope: 'connection' | 'rule', value: string): void {
  if (!value.trim() || value.length > NAME_LIMIT) throw syncRemoteError(syncError('InvalidConfig', { scope, field: 'name' }))
}

function validateEnvName(scope: 'connection' | 'rule', field: string, value: string): void {
  if (!ENV_NAME.test(value) || value.length > ENV_LIMIT) throw syncRemoteError(syncError('InvalidConfig', { scope, field }))
}

function validateId(scope: 'connection' | 'rule', field: string, value: string): void {
  if (!value.trim() || value.length > ID_LIMIT) throw syncRemoteError(syncError('InvalidConfig', { scope, field }))
}

function validateRegionHost(mode: 'center' | 'region', regionHost: string | null | undefined): void {
  if (mode === 'region' && (!regionHost || !regionHost.trim())) {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'regionHost' }))
  }
}

/**
 * A center organization is what reaches the API, so a normal connection must
 * carry one — but a 云效 OAuth connection may be saved first and pick its
 * organization from the account's own list afterwards.
 */
function validateCenterOrganizationId(mode: 'center' | 'region', organizationId: string | null | undefined, oauth: boolean): void {
  const malformed = organizationId !== null && organizationId !== undefined && (organizationId.length > ID_LIMIT || CONTROL.test(organizationId))
  if (oauth) {
    if (malformed) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'organizationId' }))
    return
  }
  if (mode === 'center' && (malformed || !organizationId || !organizationId.trim())) {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'organizationId' }))
  }
}

/** The stored rule query, through the same validator the platform request uses. */
function validateRuleQuery(conditions: WorkitemConditionGroups | undefined): void {
  if (!Array.isArray(conditions)) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'conditions' }))
  try {
    buildConditions(conditions)
  } catch {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'conditions' }))
  }
  if (conditions.length > LIST_LIMIT) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'conditions' }))
}

/** Refuse an incomplete status mapping: a rule that cannot write status back is not usable. */
function validateStatusMap(statusWriteStates: StatusWriteStates | undefined): void {
  if (!statusMappingReady(statusWriteStates ?? null)) {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'statusWriteStates' }))
  }
}

interface ConnectionRow {
  id: string
  name: string
  enabled: number
  revision: number
  instance: string
  platform: 'yunxiao' | 'tapd'
  mode: string | null
  organization_id: string | null
  region_host: string | null
  token_env: string | null
  company_id: string | null
  authentication: string
  fill_fields: string | null
}

interface RuleRow {
  id: string
  revision: number
  connection_id: string
  instance: string
  project_id: string
  project_name: string | null
  enabled: number
  workspace_id: string | null
  conditions: string
  status_write_states: string
}

function parseStored<T>(text: string, field: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw syncRemoteError(syncError('StorageFailure', { scope: 'config', field }))
  }
}

/**
 * Stable remote-service identity. For tapd the company identifies the instance,
 * for yunxiao center the organization does (official host is constant), and for
 * yunxiao region the region host does. Credential env names never affect it.
 */
function instanceOf(connection: {
  platform: 'yunxiao' | 'tapd'
  mode?: 'center' | 'region'
  organizationId?: string
  regionHost?: string | null
  companyId?: string
}): string {
  if (connection.platform === 'tapd') return connection.companyId ?? ''
  if (connection.mode === 'region') return connection.regionHost ?? ''
  return connection.organizationId ?? ''
}

function toSafeConnection(row: ConnectionRow, env: Env): SafeConnection {
  const authentication = parseConnectionAuth(parseStored(row.authentication, 'authentication'))
  const fillFields = toFillFields(row.fill_fields, row.platform)
  if (row.platform === 'yunxiao') {
    const credentialPresent = env()[row.token_env!] !== undefined
    return {
      fillFields,
      id: row.id, name: row.name, enabled: row.enabled === 1, revision: row.revision,
      authentication, credentialPresent: authentication.mode === 'oauth' ? false : credentialPresent, instance: row.instance, platform: 'yunxiao',
      mode: row.mode as 'center' | 'region',
      organizationId: row.organization_id!,
      regionHost: row.region_host,
      tokenEnv: row.token_env!,
    }
  }
  const credentialPresent = env()[row.token_env!] !== undefined
  return {
    fillFields,
    id: row.id, name: row.name, enabled: row.enabled === 1, revision: row.revision,
    authentication, credentialPresent: authentication.mode === 'oauth' ? false : credentialPresent, instance: row.instance, platform: 'tapd',
    companyId: row.company_id!, tokenEnv: row.token_env!,
  }
}

/**
 * The stored prefill selection normalized to the connection's platform, or the
 * default set when a connection predates the column (NULL) or carries something
 * unreadable. The two platforms carry different fields, so an id belonging to
 * the other one is dropped rather than handed to a caller that cannot use it.
 */
function toFillFields(stored: string | null, platform: 'yunxiao' | 'tapd'): WorkitemFillField[] {
  const allowed = new Set<string>(WORKITEM_FILL_FIELDS_BY_PLATFORM[platform])
  if (stored === null) return [...DEFAULT_WORKITEM_FILL_FIELDS]
  let parsed: unknown
  try {
    parsed = JSON.parse(stored) as unknown
  } catch {
    return [...DEFAULT_WORKITEM_FILL_FIELDS]
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_WORKITEM_FILL_FIELDS]
  const kept = WORKITEM_FILL_FIELDS_BY_PLATFORM[platform]
    .filter(field => parsed.includes(field) && allowed.has(field))
  return kept.length > 0 ? [...kept] : [...DEFAULT_WORKITEM_FILL_FIELDS]
}

/** Refuse a selection that names a field the connection's platform cannot carry. */
function validateFillFields(platform: 'yunxiao' | 'tapd', fields: readonly WorkitemFillField[]): void {
  const allowed = new Set<string>(WORKITEM_FILL_FIELDS_BY_PLATFORM[platform])
  for (const field of fields) {
    if (!allowed.has(field)) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'fillFields' }))
  }
}

/** The selection as stored: the platform's own order, defaults when empty. */
function storedFillFields(platform: 'yunxiao' | 'tapd', fields: readonly WorkitemFillField[]): string {
  const kept = WORKITEM_FILL_FIELDS_BY_PLATFORM[platform].filter(field => fields.includes(field))
  return JSON.stringify(kept.length > 0 ? kept : DEFAULT_WORKITEM_FILL_FIELDS)
}

function toSyncRule(row: RuleRow): SyncRule {
  return {
    id: row.id,
    revision: row.revision,
    connectionId: row.connection_id,
    projectId: row.project_id,
    projectName: row.project_name ?? null,
    enabled: row.enabled === 1,
    workspaceId: row.workspace_id,
    conditions: parseStored<WorkitemConditionGroups>(row.conditions, 'conditions'),
    statusWriteStates: parseStored<StatusWriteStates>(row.status_write_states, 'statusWriteStates'),
  }
}

export class SyncConfigStore {
  readonly db: DatabaseSync
  private readonly env: Env

  constructor(db: DatabaseSync, env: Env = () => process.env as Record<string, string | undefined>) {
    this.db = db
    this.env = env
  }

  listConnections(): SafeConnection[] {
    const rows = this.db.prepare('SELECT * FROM sync_connections ORDER BY name, id').all() as unknown as ConnectionRow[]
    return rows.map(row => toSafeConnection(row, this.env))
  }

  getConnection(id: string): SafeConnection | null {
    const row = this.db.prepare('SELECT * FROM sync_connections WHERE id = ?').get(id) as unknown as ConnectionRow | undefined
    return row ? toSafeConnection(row, this.env) : null
  }

  createConnection(input: CreateConnectionRequest): SafeConnection {
    const id = randomUUID()
    validateName('connection', input.name)
    if (input.platform === 'yunxiao') { validateEnvName('connection', 'tokenEnv', input.tokenEnv); validateRegionHost(input.mode, input.regionHost); validateCenterOrganizationId(input.mode, input.organizationId, (input.authentication ?? { mode: 'manual' }).mode === 'oauth') }
    else validateEnvName('connection', 'tokenEnv', input.tokenEnv)
    const authentication = parseConnectionAuth(input.authentication ?? { mode: 'manual' })
    if (input.fillFields !== undefined) validateFillFields(input.platform, input.fillFields)
    const instance = instanceOf(input)
    withSqliteTransaction(this.db, () => {
      this.db.prepare(`INSERT INTO sync_connections
        (id, name, enabled, revision, instance, platform, mode, organization_id, region_host, token_env, company_id, user_env, password_env, authentication, fill_fields)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, input.name, input.enabled ? 1 : 0, instance, input.platform,
        input.platform === 'yunxiao' ? input.mode : null,
        input.platform === 'yunxiao' ? input.organizationId : null,
        input.platform === 'yunxiao' ? input.regionHost : null,
        input.tokenEnv,
        input.platform === 'tapd' ? input.companyId : null,
        null,
        null,
        JSON.stringify(authentication),
        storedFillFields(input.platform, input.fillFields ?? DEFAULT_WORKITEM_FILL_FIELDS),
      )
    })
    return this.getConnection(id)!
  }

  updateConnection(input: UpdateConnectionRequest): SafeConnection {
    const row = this.db.prepare('SELECT * FROM sync_connections WHERE id = ?').get(input.id) as unknown as ConnectionRow | undefined
    if (!row) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
    if (input.name !== undefined) validateName('connection', input.name)
    if (input.tokenEnv !== undefined) validateEnvName('connection', 'tokenEnv', input.tokenEnv)
    // Reject other-platform keys against the existing row's platform, not the flat request.
    if (row.platform === 'yunxiao') {
      if (input.companyId !== undefined) {
        throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
      }
    } else if (input.mode !== undefined || input.organizationId !== undefined || input.regionHost !== undefined) {
      throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
    }
    const authentication = parseConnectionAuth(input.authentication ?? parseStored(row.authentication, 'authentication'))
    // TAPD keeps exactly one credential path: a personal access token.
    if (row.platform === 'tapd' && authentication.mode === 'oauth') throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'authentication' }))
    const name = input.name ?? row.name
    const enabled = input.enabled === undefined ? row.enabled === 1 : input.enabled
    const mode = input.mode !== undefined ? input.mode : row.mode
    const organizationId = input.organizationId !== undefined ? input.organizationId : row.organization_id
    const regionHost = input.regionHost !== undefined ? input.regionHost : row.region_host
    const tokenEnv = input.tokenEnv !== undefined ? input.tokenEnv : row.token_env
    const companyId = input.companyId !== undefined ? input.companyId : row.company_id
    if (row.platform === 'yunxiao') { validateRegionHost(mode as 'center' | 'region', regionHost); validateCenterOrganizationId(mode as 'center' | 'region', organizationId, authentication.mode === 'oauth') }
    const instance = row.platform === 'yunxiao'
      ? instanceOf({ platform: 'yunxiao', mode: mode as 'center' | 'region', organizationId: organizationId!, regionHost })
      : instanceOf({ platform: 'tapd', companyId: companyId! })
    if (instance !== row.instance) {
      const referenced = this.db.prepare('SELECT 1 FROM sync_rules WHERE connection_id = ? LIMIT 1').get(input.id)
      if (referenced) throw syncRemoteError(syncError('MappingIncompatible', { scope: 'connection' }))
    }
    if (input.fillFields !== undefined) validateFillFields(row.platform, input.fillFields)
    const fillFields = input.fillFields === undefined ? toFillFields(row.fill_fields, row.platform) : input.fillFields
    withSqliteTransaction(this.db, () => {
      const result = this.db.prepare(`UPDATE sync_connections SET name = ?, enabled = ?, instance = ?, mode = ?,
        organization_id = ?, region_host = ?, token_env = ?, company_id = ?, user_env = ?, password_env = ?, authentication = ?, fill_fields = ?,
        revision = revision + 1 WHERE id = ? AND revision = ?`).run(
        name, enabled ? 1 : 0, instance, mode, organizationId, regionHost, tokenEnv, companyId, null, null, JSON.stringify(authentication), storedFillFields(row.platform, fillFields),
        input.id, input.revision,
      )
      if (result.changes !== 1) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'connection' }))
    })
    return this.getConnection(input.id)!
  }

  deleteConnection(input: DeleteConnectionRequest): void {
    const row = this.db.prepare('SELECT revision FROM sync_connections WHERE id = ?').get(input.id) as { revision: number } | undefined
    if (!row) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
    if (row.revision !== input.revision) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'connection' }))
    const referenced = this.db.prepare('SELECT 1 FROM sync_rules WHERE connection_id = ? LIMIT 1').get(input.id)
    if (referenced) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
    withSqliteTransaction(this.db, () => {
      const result = this.db.prepare('DELETE FROM sync_connections WHERE id = ? AND revision = ?').run(input.id, input.revision)
      if (result.changes !== 1) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'connection' }))
    })
  }

  listRules(connectionId?: string): SyncRule[] {
    const rows = connectionId === undefined
      ? this.db.prepare('SELECT * FROM sync_rules ORDER BY project_id, id').all() as unknown as RuleRow[]
      : this.db.prepare('SELECT * FROM sync_rules WHERE connection_id = ? ORDER BY project_id, id').all(connectionId) as unknown as RuleRow[]
    return rows.map(toSyncRule)
  }

  getRule(id: string): SyncRule | null {
    const row = this.db.prepare('SELECT * FROM sync_rules WHERE id = ?').get(id) as unknown as RuleRow | undefined
    return row ? toSyncRule(row) : null
  }

  /**
   * Cheap enabled check for the per-request gate: one join, no JSON parse of
   * filters/mappings. Returns false for a missing rule or a disabled rule or
   * connection.
   */
  isRuleActive(ruleId: string): boolean {
    const row = this.db.prepare(`SELECT r.enabled AS ruleEnabled, c.enabled AS connEnabled
      FROM sync_rules r JOIN sync_connections c ON c.id = r.connection_id WHERE r.id = ?`).get(ruleId) as { ruleEnabled: number; connEnabled: number } | undefined
    return row !== undefined && row.ruleEnabled === 1 && row.connEnabled === 1
  }

  /**
   * Build a per-rule enabled guard for the per-request gate. Only the compiled
   * statement is cached; every call re-reads the live rule/connection rows, so a
   * mid-run disable still takes effect before the next dispatch.
   */
  createActiveGuard(ruleId: string): () => void {
    const stmt = this.db.prepare(`SELECT r.enabled AS ruleEnabled, c.enabled AS connEnabled
      FROM sync_rules r JOIN sync_connections c ON c.id = r.connection_id WHERE r.id = ?`)
    return () => {
      const row = stmt.get(ruleId) as { ruleEnabled: number; connEnabled: number } | undefined
      if (row === undefined || row.ruleEnabled !== 1 || row.connEnabled !== 1) {
        throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'enabled' }))
      }
    }
  }

  createRule(input: CreateSyncRuleRequest): SyncRule {
    const connection = this.db.prepare('SELECT instance FROM sync_connections WHERE id = ?').get(input.connectionId) as { instance: string } | undefined
    if (!connection) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'connectionId' }))
    validateId('rule', 'projectId', input.projectId)
    validateRuleQuery(input.conditions)
    validateStatusMap(input.statusWriteStates)
    const instance = connection.instance
    const duplicate = this.db.prepare('SELECT 1 FROM sync_rules WHERE instance = ? AND project_id = ?').get(instance, input.projectId)
    if (duplicate) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'projectId' }))
    const id = randomUUID()
    withSqliteTransaction(this.db, () => {
      this.db.prepare(`INSERT INTO sync_rules
        (id, revision, connection_id, instance, project_id, project_name, enabled, workspace_id, conditions, status_write_states)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, input.connectionId, instance, input.projectId, input.projectName ?? null, input.enabled ? 1 : 0,
        input.workspaceId, JSON.stringify(input.conditions), JSON.stringify(input.statusWriteStates),
      )
    })
    return this.getRule(id)!
  }

  updateRule(input: UpdateSyncRuleRequest): SyncRule {
    const row = this.db.prepare('SELECT * FROM sync_rules WHERE id = ?').get(input.id) as unknown as RuleRow | undefined
    if (!row) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'id' }))
    if (input.projectId !== undefined) validateId('rule', 'projectId', input.projectId)
    const conditions = input.conditions ?? parseStored<WorkitemConditionGroups>(row.conditions, 'conditions')
    const statusWriteStates = input.statusWriteStates ?? parseStored<StatusWriteStates>(row.status_write_states, 'statusWriteStates')
    if (input.conditions !== undefined) validateRuleQuery(conditions)
    if (input.statusWriteStates !== undefined) validateStatusMap(statusWriteStates)
    const projectId = input.projectId !== undefined ? input.projectId : row.project_id
    if (input.projectId !== undefined && input.projectId !== row.project_id) {
      const duplicate = this.db.prepare('SELECT 1 FROM sync_rules WHERE instance = ? AND project_id = ? AND id != ?').get(row.instance, projectId, input.id)
      if (duplicate) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'projectId' }))
    }
    const enabled = input.enabled === undefined ? row.enabled === 1 : input.enabled
    const projectName = input.projectName !== undefined ? input.projectName : row.project_name
    const workspaceId = input.workspaceId !== undefined ? input.workspaceId : row.workspace_id
    withSqliteTransaction(this.db, () => {
      const result = this.db.prepare(`UPDATE sync_rules SET project_id = ?, project_name = ?, enabled = ?, workspace_id = ?, conditions = ?, status_write_states = ?,
        revision = revision + 1 WHERE id = ? AND revision = ?`).run(
        projectId, projectName, enabled ? 1 : 0, workspaceId, JSON.stringify(conditions), JSON.stringify(statusWriteStates),
        input.id, input.revision,
      )
      if (result.changes !== 1) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'rule' }))
    })
    return this.getRule(input.id)!
  }

  deleteRule(input: DeleteSyncRuleRequest): void {
    const row = this.db.prepare('SELECT revision FROM sync_rules WHERE id = ?').get(input.id) as { revision: number } | undefined
    if (!row) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'id' }))
    if (row.revision !== input.revision) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'rule' }))
    const referenced = this.db.prepare('SELECT 1 FROM sync_links WHERE rule_id = ? LIMIT 1').get(input.id)
    if (referenced) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'id' }))
    withSqliteTransaction(this.db, () => {
      const result = this.db.prepare('DELETE FROM sync_rules WHERE id = ? AND revision = ?').run(input.id, input.revision)
      if (result.changes !== 1) throw syncRemoteError(syncError('LocalVersionConflict', { scope: 'rule' }))
    })
  }
}
