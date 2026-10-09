import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TYPERT_REMOTE } from '../src/remote.ts'
import { SYNC_METHODS } from '../src/sync/dto.ts'

describe('Host Remote parameter contract', () => {
  it('exposes on-demand statistics with descriptor-compatible requests', () => {
    const source = readFileSync(new URL('../src/task-service.ts', import.meta.url), 'utf8')
    const statistics = readFileSync(new URL('../src/statistics-source.ts', import.meta.url), 'utf8')
    for (const method of ['calculateStatistics', 'startStatistics', 'getStatisticsRun', 'cancelStatistics']) {
      expect(TYPERT_REMOTE.descriptors.find(row => row.method === method)?.parameters[0]?.name).toBe('request')
    }
    expect(source).toMatch(/async calculateStatistics\(request: StatisticsRequest\)/u)
    expect(source).toMatch(/async startStatistics\(request: StatisticsRequest\)/u)
    // Statistics keep integrating through DSH session services: the persistence
    // seam when it is mounted, the session-query service as the portable fallback.
    expect(statistics).toContain("ctx.get('sessionQuery')")
    expect(statistics).toContain("ctx.get('sessionPersistence')")
  })
  it('uses the descriptor request parameter for the capability probe', () => {
    const source = readFileSync(new URL('../src/task-service.ts', import.meta.url), 'utf8')
    const descriptor = TYPERT_REMOTE.descriptors.find(row => row.method === 'capabilities')
    expect(descriptor?.parameters[0]?.name).toBe('request')
    expect(source).toMatch(/async capabilities\(request: Record<string, never>\)/u)
  })

  it('exposes sync, authorization, legacy and statistics methods on the taskList namespace', () => {
    const methods = TYPERT_REMOTE.descriptors.map(row => row.method)
    expect(methods).toHaveLength(35)
    for (const method of SYNC_METHODS) expect(methods).toContain(method)
    for (const method of ['capabilities', 'listTasks', 'createTask', 'updateTask', 'deleteTask', 'readTaskAttachments', 'createSubtask', 'updateSubtask', 'deleteSubtask']) {
      expect(methods).toContain(method)
    }
  })

  it('applies a closed request and result codec to sync methods while legacy stays passthrough', () => {
    const create = TYPERT_REMOTE.descriptors.find(row => row.method === 'createSyncConnection')!
    const requestSchema = create.parameters[0]!.codec.create()
    expect(requestSchema.parse({ platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'U', passwordEnv: 'P' }))
      .toMatchObject({ platform: 'tapd', enabled: false })
    expect(() => requestSchema.parse({ platform: 'tapd', name: 'TAPD', companyId: 'c', userEnv: 'U', passwordEnv: 'P', token: 'sk-live' })).toThrow()

    const resultSchema = create.result.create()
    const valid = { id: 'x', name: 'T', enabled: false, revision: 1, credentialPresent: false, instance: 'api.tapd.cn', platform: 'tapd', companyId: 'c', userEnv: 'U', passwordEnv: 'P' }
    expect(resultSchema.parse(valid)).toMatchObject({ platform: 'tapd' })
    expect(() => resultSchema.parse({ ...valid, raw: 'sk-live' })).toThrow()

    const legacy = TYPERT_REMOTE.descriptors.find(row => row.method === 'capabilities')!
    expect(legacy.result.create().parse({ version: 1, richText: true, attachments: true, extra: 'x' })).toMatchObject({ version: 1 })
  })

  it('scopes a malformed nested error to its surrounding run/connection context', () => {
    const getRun = TYPERT_REMOTE.descriptors.find(row => row.method === 'getSyncRun')!
    const resultSchema = getRun.result.create()
    const bogusError = { code: 'bogus', scope: 'run', problem: 'p', cause: 'c', action: 'a', docKey: 'recovery', retryable: false }
    const validRun = {
      id: 'run1', status: 'completed', phase: 'finished', startedAt: 1700000000000, finishedAt: 1700000001000,
      counts: { imported: 0, pulled: 0, pushed: 0, merged: 0, unchanged: 0, failed: 0, pending: 0 },
      unprocessedKnown: 0, discoveryComplete: true, scopeSummary: '', errors: [bogusError],
    }
    let thrown: { code?: string; details?: { code?: string; scope?: string } } | null = null
    try { resultSchema.parse(validRun) } catch (error) { thrown = error as { code?: string; details?: { code?: string; scope?: string } } }
    expect(thrown?.details?.code).toBe('InvalidConfig')
    expect(thrown?.details?.scope).toBe('run')

    const testConnection = TYPERT_REMOTE.descriptors.find(row => row.method === 'testSyncConnection')!
    const testSchema = testConnection.result.create()
    let testThrown: { code?: string; details?: { code?: string; scope?: string } } | null = null
    try { testSchema.parse({ ok: false, credentialPresent: false, error: bogusError }) } catch (error) { testThrown = error as { code?: string; details?: { code?: string; scope?: string } } }
    expect(testThrown?.details?.code).toBe('InvalidConfig')
    expect(testThrown?.details?.scope).toBe('connection')
  })
})

