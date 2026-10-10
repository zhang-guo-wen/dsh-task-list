import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { TaskStore } from '../src/store.ts'
import { SyncConfigStore } from '../src/sync/config-store.ts'
import { migrateSyncSchema } from '../src/sync/schema.ts'
import { parseSyncRequest, parseSyncResponse } from '../src/sync/validation.ts'
import type { CreateSyncRuleRequest } from '../src/sync/dto.ts'

describe('non-secret connection authorization config', () => {
  it('round-trips OAuth configuration but rejects a raw client secret', () => {
    const input = { platform: 'yunxiao', name: 'Cloud', mode: 'center', organizationId: 'org', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: false, authentication: { mode: 'oauth' } }
    const parsed = parseSyncRequest('createSyncConnection', input).request as any
    expect(parsed.authentication).toEqual({ mode: 'oauth' })
    const tasks = new TaskStore(':memory:')
    try {
      const config = new SyncConfigStore(tasks.db, () => ({}))
      const connection = config.createConnection(parsed)
      expect(connection.authentication).toEqual({ mode: 'oauth' })
      expect(connection.credentialPresent).toBe(false)
      expect(parseSyncResponse('createSyncConnection', connection).response).toMatchObject({ authentication: { mode: 'oauth' } })
      expect(() => parseSyncRequest('createSyncConnection', { ...input, authentication: { mode: 'oauth', clientSecret: 'never-store-secret' } })).toThrow()
    } finally { tasks.close() }
  })
  it('forward-migrates the schema8 connection table without touching task content', () => {
    const tasks = new TaskStore(':memory:')
    const db = tasks.db
    if ((db.prepare('PRAGMA table_info(sync_connections)').all() as any[]).some(column => column.name === 'authentication')) db.exec('ALTER TABLE sync_connections DROP COLUMN authentication')
    db.exec('PRAGMA user_version = 8')
    // Exercise the public sync migration inside the same database without any real profile file.
    migrateSyncSchema(db)
    const columns = db.prepare('PRAGMA table_info(sync_connections)').all() as any[]
    expect(columns.some(column => column.name === 'authentication')).toBe(true)
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 14 })
    expect((db.prepare('PRAGMA table_info(sync_rules)').all() as any[]).some(column => column.name === 'project_name')).toBe(true)
    // Schema 11 stores each connection's prefill selection beside the connection.
    expect((db.prepare('PRAGMA table_info(sync_connections)').all() as any[]).some(column => column.name === 'fill_fields')).toBe(true)
    // Schema 13 replaces the rule's filter dimensions with one platform query.
    expect((db.prepare('PRAGMA table_info(sync_rules)').all() as any[]).some(column => column.name === 'conditions')).toBe(true)
    tasks.close()
  })

  it('disables already-upgraded unmapped rules without changing complete rules', () => {
    const tasks = new TaskStore(':memory:')
    try {
      const db = tasks.db
      const config = new SyncConfigStore(db, () => ({}))
      const connection = config.createConnection({
        platform: 'yunxiao', name: 'Cloud', mode: 'center', organizationId: 'org',
        regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: true,
      })
      const complete = config.createRule({
        connectionId: connection.id, projectId: 'complete', enabled: true, workspaceId: null,
        conditions: [], statusWriteStates: { todo: '待处理', in_progress: '处理中', done: '已完成' },
      })
      db.prepare(`INSERT INTO sync_rules
        (id, revision, connection_id, instance, project_id, enabled, workspace_id, conditions, status_write_states)
        VALUES ('old-rule', 1, ?, ?, 'old', 1, NULL, '[]', '{}')`).run(connection.id, connection.instance)
      db.exec('PRAGMA user_version = 13')
      migrateSyncSchema(db)
      expect(config.getRule('old-rule')?.enabled).toBe(false)
      expect(config.getRule(complete.id)?.enabled).toBe(true)
      expect(parseSyncResponse('listSyncRules', config.listRules()).response).toHaveLength(2)
    } finally { tasks.close() }
  })

  it.each([
    { name: '云效', input: { platform: 'yunxiao' as const, name: 'Cloud', mode: 'center' as const, organizationId: 'org', regionHost: null, tokenEnv: 'YUNXIAO_TOKEN', enabled: true } },
    { name: 'TAPD', input: { platform: 'tapd' as const, name: 'TAPD', companyId: 'company', tokenEnv: 'TAPD_TOKEN', enabled: true } },
  ])('saves a $name rule after upgrading a v12 database with required legacy columns', ({ input }) => {
    const tasks = new TaskStore(':memory:')
    try {
      const db = tasks.db
      const config = new SyncConfigStore(db, () => ({}))
      const connection = config.createConnection(input)
      // The old physical shape has no defaults for filters/mappings, unlike a
      // freshly created v13 database. Keep an old rule to exercise list/enable.
      db.exec(`DROP TABLE sync_rules;
        CREATE TABLE sync_rules (
          id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision >= 1),
          connection_id TEXT NOT NULL REFERENCES sync_connections(id), instance TEXT NOT NULL,
          project_id TEXT NOT NULL, project_name TEXT,
          enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)), workspace_id TEXT,
          filters TEXT NOT NULL, mappings TEXT NOT NULL,
          UNIQUE(instance, project_id)
        ) STRICT;
        CREATE INDEX sync_rules_connection ON sync_rules(connection_id);`)
      db.prepare(`INSERT INTO sync_rules
        (id, revision, connection_id, instance, project_id, project_name, enabled, workspace_id, filters, mappings)
        VALUES (?, 1, ?, ?, 'previous', 'Previous', 1, NULL, '[]', '{}')`)
        .run('old-rule', connection.id, connection.instance)
      db.prepare(`INSERT INTO sync_links
        (id, rule_id, task_id, task_generation, platform, instance, project_id, type_id,
         remote_id, number, url, canonical, revision, last_success_at, last_error, created_at, updated_at)
        VALUES ('link-old', 'old-rule', NULL, 'generation', ?, ?, 'previous', 'type',
          'remote', '1', NULL, 'legacy-remote', 1, NULL, NULL, 1, 1)`).run(connection.platform, connection.instance)
      db.exec('PRAGMA user_version = 12')
      migrateSyncSchema(db)
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(14)
      const oldRule = config.listRules().find(rule => rule.id === 'old-rule')!
      expect(oldRule.enabled).toBe(false)
      expect(db.prepare('SELECT rule_id FROM sync_links WHERE id = ?').get('link-old'))
        .toEqual({ rule_id: 'old-rule' })
      expect(parseSyncResponse('listSyncRules', config.listRules()).response).toMatchObject([
        { id: 'old-rule', enabled: false, statusWriteStates: { todo: '', in_progress: '', done: '' } },
      ])
      expect(() => config.updateRule({ id: oldRule.id, revision: oldRule.revision, enabled: true })).toThrow()

      const request = {
        connectionId: connection.id, projectId: 'project', projectName: '平台项目集',
        enabled: false, workspaceId: null,
        conditions: [[
          { field: 'assignedTo', operator: 'EQUALS', value: ['user-1'] },
          { field: 'status', operator: 'EQUALS', value: ['待办', '进行中'] },
        ]],
        statusWriteStates: { todo: '待处理', in_progress: '处理中', done: '已完成' },
      } satisfies CreateSyncRuleRequest
      const parsed = parseSyncRequest('createSyncRule', request)
      const created = config.createRule(parsed.request as CreateSyncRuleRequest)
      expect(created.projectId).toBe('project')
      expect(parseSyncResponse('createSyncRule', created).response).toMatchObject({ id: created.id, projectId: 'project' })
      expect(config.listRules()).toHaveLength(2)
      expect(db.prepare('SELECT filters, mappings FROM sync_rules WHERE id = ?').get(created.id))
        .toEqual({ filters: '[]', mappings: '{}' })
      const upgraded = config.updateRule({
        id: oldRule.id, revision: oldRule.revision, enabled: true,
        statusWriteStates: { todo: '待处理', in_progress: '处理中', done: '已完成' },
      })
      expect(upgraded.enabled).toBe(true)
      expect(parseSyncResponse('listSyncRules', config.listRules()).response).toHaveLength(2)
    } finally { tasks.close() }
  })
})
