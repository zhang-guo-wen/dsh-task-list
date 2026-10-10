// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MoreTasks } from '../src/client/MoreTasks.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import type { ListWorkitemFieldsRequest, ListWorkitemsRequest, SafeWorkitemField, SafeWorkitemPage } from '../src/sync/dto.ts'

afterEach(() => { cleanup(); localStorage.clear() })
const t = (key: TaskKey) => zh[key]

/**
 * Regression guard for the "list keeps flickering" report: the page must not
 * fetch again just because its parent re-rendered, nor because the platform
 * handed back an identical field catalog as a fresh array.
 */
const catalog: SafeWorkitemField[] = [
  { id: 'subject', name: '标题', format: 'string', required: true, kind: 'NativeField', options: [] },
  { id: 'sprint', name: '迭代', format: 'sprint', required: false, kind: 'Application', options: [] },
  { id: 'priority', name: '优先级', format: 'list', required: false, kind: 'SystemCustomField', options: [{ id: 'p', label: '中' }] },
]
const connections = [{ id: 'conn-1', name: '云效 · Alpha', platform: 'yunxiao', enabled: true }]
const projects = [{ id: 'space-1', label: 'Project One' }]
const page: SafeWorkitemPage = {
  items: [{ id: 'w1', serialNumber: 'PROJ-1', subject: 'Alpha', sprint: { id: 's', name: '【3C】20261017' } }],
  page: 1, perPage: 50, total: 1, totalPages: 1, fields: ['id'],
}

function harness() {
  const listCalls: ListWorkitemsRequest[] = []
  const fieldCalls: ListWorkitemFieldsRequest[] = []
  const listWorkitems = vi.fn(async (request: ListWorkitemsRequest) => { listCalls.push(request); return page })
  const listWorkitemFields = vi.fn(async (request: ListWorkitemFieldsRequest) => { fieldCalls.push(request); return catalog })
  const getWorkitemDescription = vi.fn(async () => ({ description: null }))
  const sync = {
    listSyncConnections: async () => connections as never,
    getSyncMetadata: async () => ({ projects, members: [], iterations: [], types: [], typeCapabilities: [] } as never),
  }
  const view = render(<MoreTasks sync={sync as never} listWorkitems={listWorkitems} listWorkitemFields={listWorkitemFields}
    getWorkitemDescription={getWorkitemDescription} onDraft={() => {}} close={() => {}} t={t} />)
  return { ...view, listCalls, fieldCalls, listWorkitems, listWorkitemFields, getWorkitemDescription, sync }
}

describe('more tasks request stability', () => {
  it('does not refetch when only the parent re-renders', async () => {
    const harnessed = harness()
    await waitFor(() => expect(harnessed.listCalls).toHaveLength(1))
    expect(harnessed.fieldCalls).toHaveLength(1)

    harnessed.rerender(<MoreTasks sync={harnessed.sync as never} listWorkitems={harnessed.listWorkitems}
      listWorkitemFields={harnessed.listWorkitemFields} getWorkitemDescription={harnessed.getWorkitemDescription}
      onDraft={() => {}} close={() => {}} t={t} />)
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(harnessed.listCalls).toHaveLength(1)
    expect(harnessed.fieldCalls).toHaveLength(1)
  })

  it('keeps the projection stable when a new caller hands back the same catalog', async () => {
    const harnessed = harness()
    await waitFor(() => expect(harnessed.listCalls).toHaveLength(1))

    // A fresh function identity re-runs the catalog effect, but the payload is
    // equal, so `fields` keeps its identity and nothing downstream re-fetches.
    const sameCatalogAgain = vi.fn(async () => catalog)
    harnessed.rerender(<MoreTasks sync={harnessed.sync as never} listWorkitems={harnessed.listWorkitems}
      listWorkitemFields={sameCatalogAgain} getWorkitemDescription={harnessed.getWorkitemDescription}
      onDraft={() => {}} close={() => {}} t={t} />)
    await waitFor(() => expect(sameCatalogAgain).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(harnessed.listCalls).toHaveLength(1)
  })

  it('requests exactly once when a column is toggled', async () => {
    const harnessed = harness()
    await waitFor(() => expect(harnessed.listCalls).toHaveLength(1))
    expect(harnessed.listCalls[0]!.fields).not.toContain('sprint')

    fireEvent.click(screen.getByRole('button', { name: zh.moreTasksColumnsTitle }))
    const drawer = screen.getByRole('dialog', { name: zh.moreTasksColumnsTitle })
    fireEvent.click(within(drawer).getByRole('switch', { name: '迭代' }))
    await waitFor(() => expect(harnessed.listCalls).toHaveLength(2))
    expect(harnessed.listCalls[1]!.fields).toContain('sprint')
    await new Promise(resolve => setTimeout(resolve, 80))
    expect(harnessed.listCalls).toHaveLength(2)
  })
})
