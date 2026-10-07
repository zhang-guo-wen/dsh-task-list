import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TYPERT_REMOTE } from '../src/remote.ts'

describe('Host Remote parameter contract', () => {
  it('uses the descriptor request parameter for the capability probe', () => {
    const source = readFileSync(new URL('../src/task-service.ts', import.meta.url), 'utf8')
    const descriptor = TYPERT_REMOTE.descriptors.find(row => row.method === 'capabilities')
    expect(descriptor?.parameters[0]?.name).toBe('request')
    expect(source).toMatch(/async capabilities\(request: Record<string, never>\)/u)
  })
})
