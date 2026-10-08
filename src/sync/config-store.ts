import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type {
  CreateConnectionRequest, CreateSyncRuleRequest, DeleteConnectionRequest, DeleteSyncRuleRequest,
  SafeConnection, SyncRule, SyncRuleFilters, TypeMapping, UpdateConnectionRequest, UpdateSyncRuleRequest,
} from './dto.ts'
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

function validateCenterOrganizationId(mode: 'center' | 'region', organizationId: string | null | undefined): void {
  if (mode === 'center' && (!organizationId || !organizationId.trim() || organizationId.length > ID_LIMIT || CONTROL.test(organizationId))) {
    throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'organizationId' }))
  }
}

function validateRuleSize(filters: SyncRuleFilters, mappings: TypeMapping[]): void {
  const lists = [filters.assignees.length, filters.typeIds.length, filters.iterationIds.length, filters.statusIds.length]
  if (lists.some(count => count > LIST_LIMIT)) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'filters' }))
  if (mappings.length > LIST_LIMIT) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'mappings' }))
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
  user_env: string | null
  password_env: string | null
  authentication: string
}

interface RuleRow {
  id: string
  revision: number
  connection_id: string
  instance: string
  project_id: string
  enabled: number
  workspace_id: string | null
  filters: string
  mappings: string
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
  if (row.platform === 'yunxiao') {
    const credentialPresent = env()[row.token_env!] !== undefined
    return {
      id: row.id, name: row.name, enabled: row.enabled === 1, revision: row.revision,
      authentication, credentialPresent: authentication.mode === 'oauth' ? false : credentialPresent, instance: row.instance, platform: 'yunxiao',
      mode: row.mode as 'center' | 'region',
      organizationId: row.organization_id!,
      regionHost: row.region_host,
      tokenEnv: row.token_env!,
    }
  }
  const credentialPresent = env()[row.user_env!] !== undefined && env()[row.password_env!] !== undefined
  return {
    id: row.id, name: row.name, enabled: row.enabled === 1, revision: row.revision,
    authentication, credentialPresent: authentication.mode === 'oauth' ? false : credentialPresent, instance: row.instance, platform: 'tapd',
    companyId: row.company_id!, userEnv: row.user_env!, passwordEnv: row.password_env!,
  }
}

function toSyncRule(row: RuleRow): SyncRule {
  return {
    id: row.id,
    revision: row.revision,
    connectionId: row.connection_id,
    projectId: row.project_id,
    enabled: row.enabled === 1,
    workspaceId: row.workspace_id,
    filters: parseStored<SyncRuleFilters>(row.filters, 'filters'),
    mappings: parseStored<TypeMapping[]>(row.mappings, 'mappings'),
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
    if (input.platform === 'yunxiao') { validateEnvName('connection', 'tokenEnv', input.tokenEnv); validateRegionHost(input.mode, input.regionHost); validateCenterOrganizationId(input.mode, input.organizationId) }
    else { validateEnvName('connection', 'userEnv', input.userEnv); validateEnvName('connection', 'passwordEnv', input.passwordEnv) }
    const authentication = parseConnectionAuth(input.authentication ?? { mode: 'manual' })
    const instance = instanceOf(input)
    withSqliteTransaction(this.db, () => {
      this.db.prepare(`INSERT INTO sync_connections
        (id, name, enabled, revision, instance, platform, mode, organization_id, region_host, token_env, company_id, user_env, password_env, authentication)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, input.name, input.enabled ? 1 : 0, instance, input.platform,
        input.platform === 'yunxiao' ? input.mode : null,
        input.platform === 'yunxiao' ? input.organizationId : null,
        input.platform === 'yunxiao' ? input.regionHost : null,
        input.platform === 'yunxiao' ? input.tokenEnv : null,
        input.platform === 'tapd' ? input.companyId : null,
        input.platform === 'tapd' ? input.userEnv : null,
        input.platform === 'tapd' ? input.passwordEnv : null,
        JSON.stringify(authentication),
      )
    })
    return this.getConnection(id)!
  }

  updateConnection(input: UpdateConnectionRequest): SafeConnection {
    const row = this.db.prepare('SELECT * FROM sync_connections WHERE id = ?').get(input.id) as unknown as ConnectionRow | undefined
    if (!row) throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'id' }))
    if (input.name !== undefined) validateName('connection', input.name)
    if (input.tokenEnv !== undefined) validateEnvName('connection', 'tokenEnv', input.tokenEnv)
    if (input.userEnv !== undefined) validateEnvName('connection', 'userEnv', input.userEnv)
    if (input.passwordEnv !== undefined) validateEnvName('connection', 'passwordEnv', input.passwordEnv)
    // Reject other-platform keys against the existing row's platform, not the flat request.
    if (row.platform === 'yunxiao') {
      if (input.companyId !== undefined || input.userEnv !== undefined || input.passwordEnv !== undefined) {
        throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
      }
    } else if (input.mode !== undefined || input.organizationId !== undefined || input.regionHost !== undefined || input.tokenEnv !== undefined) {
      throw syncRemoteError(syncError('InvalidConfig', { scope: 'connection', field: 'platform' }))
    }
    const authentication = parseConnectionAuth(input.authentication ?? parseStored(row.authentication, 'authentication'))
    const name = input.name ?? row.name
    const enabled = input.enabled === undefined ? row.enabled === 1 : input.enabled
    const mode = input.mode !== undefined ? input.mode : row.mode
    const organizationId = input.organizationId !== undefined ? input.organizationId : row.organization_id
    const regionHost = input.regionHost !== undefined ? input.regionHost : row.region_host
    const tokenEnv = input.tokenEnv !== undefined ? input.tokenEnv : row.token_env
    const companyId = input.companyId !== undefined ? input.companyId : row.company_id
    const userEnv = input.userEnv !== undefined ? input.userEnv : row.user_env
    const passwordEnv = input.passwordEnv !== undefined ? input.passwordEnv : row.password_env
    if (row.platform === 'yunxiao') { validateRegionHost(mode as 'center' | 'region', regionHost); validateCenterOrganizationId(mode as 'center' | 'region', organizationId) }
    const instance = row.platform === 'yunxiao'
      ? instanceOf({ platform: 'yunxiao', mode: mode as 'center' | 'region', organizationId: organizationId!, regionHost })
      : instanceOf({ platform: 'tapd', companyId: companyId! })
    if (instance !== row.instance) {
      const referenced = this.db.prepare('SELECT 1 FROM sync_rules WHERE connection_id = ? LIMIT 1').get(input.id)
      if (referenced) throw syncRemoteError(syncError('MappingIncompatible', { scope: 'connection' }))
    }
    withSqliteTransaction(this.db, () => {
      const result = this.db.prepare(`UPDATE sync_connections SET name = ?, enabled = ?, instance = ?, mode = ?,
        organization_id = ?, region_host = ?, token_env = ?, company_id = ?, user_env = ?, password_env = ?, authentication = ?,
        revision = revision + 1 WHERE id = ? AND revision = ?`).run(
        name, enabled ? 1 : 0, instance, mode, organizationId, regionHost, tokenEnv, companyId, userEnv, passwordEnv, JSON.stringify(authentication),
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
    validateRuleSize(input.filters, input.mappings)
    const instance = connection.instance
    const duplicate = this.db.prepare('SELECT 1 FROM sync_rules WHERE instance = ? AND project_id = ?').get(instance, input.projectId)
    if (duplicate) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'projectId' }))
    const id = randomUUID()
    withSqliteTransaction(this.db, () => {
      this.db.prepare(`INSERT INTO sync_rules
        (id, revision, connection_id, instance, project_id, enabled, workspace_id, filters, mappings)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, input.connectionId, instance, input.projectId, input.enabled ? 1 : 0,
        input.workspaceId, JSON.stringify(input.filters), JSON.stringify(input.mappings),
      )
    })
    return this.getRule(id)!
  }

  updateRule(input: UpdateSyncRuleRequest): SyncRule {
    const row = this.db.prepare('SELECT * FROM sync_rules WHERE id = ?').get(input.id) as unknown as RuleRow | undefined
    if (!row) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'id' }))
    if (input.projectId !== undefined) validateId('rule', 'projectId', input.projectId)
    if (input.filters !== undefined || input.mappings !== undefined) {
      const mergedFilters = input.filters ?? parseStored<SyncRuleFilters>(row.filters, 'filters')
      const mergedMappings = input.mappings ?? parseStored<TypeMapping[]>(row.mappings, 'mappings')
      validateRuleSize(mergedFilters, mergedMappings)
    }
    const projectId = input.projectId !== undefined ? input.projectId : row.project_id
    if (input.projectId !== undefined && input.projectId !== row.project_id) {
      const duplicate = this.db.prepare('SELECT 1 FROM sync_rules WHERE instance = ? AND project_id = ? AND id != ?').get(row.instance, projectId, input.id)
      if (duplicate) throw syncRemoteError(syncError('InvalidConfig', { scope: 'rule', field: 'projectId' }))
    }
    const enabled = input.enabled === undefined ? row.enabled === 1 : input.enabled
    const workspaceId = input.workspaceId !== undefined ? input.workspaceId : row.workspace_id
    const filters = input.filters === undefined ? row.filters : JSON.stringify(input.filters)
    const mappings = input.mappings === undefined ? row.mappings : JSON.stringify(input.mappings)
    withSqliteTransaction(this.db, () => {
      const result = this.db.prepare(`UPDATE sync_rules SET project_id = ?, enabled = ?, workspace_id = ?, filters = ?, mappings = ?,
        revision = revision + 1 WHERE id = ? AND revision = ?`).run(
        projectId, enabled ? 1 : 0, workspaceId, filters, mappings, input.id, input.revision,
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
