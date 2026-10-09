// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MoreTasks } from '../src/client/MoreTasks.tsx'
import { TaskPanel } from '../src/client/TaskPanel.tsx'
import { zh, type TaskKey } from '../src/client/locales.ts'
import type { ListWorkitemFieldsRequest, ListWorkitemsRequest, SafeWorkitemDescription, SafeWorkitemField, SafeWorkitemPage } from '../src/sync/dto.ts'

afterEach(() => { cleanup(); localStorage.clear() })
const t = (key: TaskKey) => zh[key]

const connections = [
  { id: 'conn-1', name: '云效 · Alpha', platform: 'yunxiao', enabled: true },
  { id: 'conn-2', name: '云效 · Beta', platform: 'yunxiao', enabled: false },
]
const projects = [{ id: 'space-1', label: 'Project One' }, { id: 'space-2', label: 'Project Two' }]

/** The catalog the platform configures: native fields plus custom ones. */
const catalog: SafeWorkitemField[] = [
  { id: 'subject', name: '标题', format: 'string', required: true, kind: 'NativeField', options: [] },
  { id: 'assignedTo', name: '负责人', format: 'user', required: true, kind: 'NativeField', options: [] },
  { id: 'status', name: '状态', format: 'list', required: true, kind: 'NativeField', options: [] },
  { id: 'creator', name: '创建者', format: 'user', required: false, kind: 'NativeField', options: [] },
  { id: 'gmtCreate', name: '创建时间', format: 'dateTime', required: false, kind: 'NativeField', options: [] },
  { id: 'sprint', name: '迭代', format: 'sprint', required: false, kind: 'Application', options: [] },
  { id: 'priority', name: '优先级', format: 'list', required: true, kind: 'SystemCustomField', options: [] },
  { id: 'story_points', name: 'Story Points', format: 'list', required: false, kind: 'SystemCustomField', options: [] },
  { id: '79', name: '计划开始时间', format: 'date', required: false, kind: 'CustomField', options: [] },
]

const row = (overrides: Record<string, unknown> = {}) => ({
  id: '1000000000000000001',
  serialNumber: 'PROJ-11',
  subject: 'Alpha work item',
  status: { id: '100005', name: '待处理', displayName: '待处理' },
  assignedTo: { id: 'user-1', name: 'Alice' },
  creator: { id: 'user-1', name: 'Alice' },
  gmtCreate: 1_791_000_000_000,
  customFields: [
    { fieldId: 'priority', fieldName: '优先级', fieldFormat: 'list', values: [{ identifier: 'prio-medium', displayValue: '中' }] },
  ],
  ...overrides,
})

function page(items: Record<string, unknown>[], overrides: Partial<SafeWorkitemPage> = {}): SafeWorkitemPage {
  return { items, page: 1, perPage: 50, total: items.length, totalPages: 1, fields: ['id'], ...overrides }
}

function face() {
  return {
    listSyncConnections: async () => connections as never,
    getSyncMetadata: async () => ({
      projects,
      members: [{ id: 'user-1', label: 'Alice' }, { id: 'user-2', label: 'Bob' }],
      iterations: [{ id: 'sprint-1', label: 'Sprint 42' }],
      types: [{ id: 'req-type-1', label: 'Tech requirement' }],
      typeCapabilities: [{ typeId: 'req-type-1', readStates: [{ id: '100005', label: '待处理' }, { id: '100014', label: '已完成' }] }],
    } as never),
  }
}

function recorder(impl: (request: ListWorkitemsRequest) => Promise<SafeWorkitemPage>) {
  const calls: ListWorkitemsRequest[] = []
  const list = vi.fn((request: ListWorkitemsRequest) => { calls.push(request); return impl(request) })
  return { list, calls }
}

async function open(options: {
  list?: (request: ListWorkitemsRequest) => Promise<SafeWorkitemPage>
  fields?: SafeWorkitemField[]
  description?: SafeWorkitemDescription | null
} = {}) {
  const { list, calls } = recorder(options.list ?? (async () => page([row()])))
  const fieldCalls: ListWorkitemFieldsRequest[] = []
  const descriptionCalls: { connectionId: string; projectId: string; id: string }[] = []
  const drafts: { row: Record<string, unknown>; description: SafeWorkitemDescription | null; mode: 'sync' | 'start' }[] = []
  const query = {
    listWorkitems: list,
    listWorkitemFields: async (request: ListWorkitemFieldsRequest) => { fieldCalls.push(request); return options.fields ?? catalog },
    getWorkitemDescription: async (request: { connectionId: string; projectId: string; id: string }) => {
      descriptionCalls.push(request)
      return { description: options.description === undefined ? { format: 'richtext' as const, html: '<p>Body</p>', plain: 'Body' } : options.description }
    },
  }
  const view = render(<MoreTasks sync={face() as never} query={query} close={() => {}}
    onDraft={(item, description, mode) => { drafts.push({ row: item, description, mode }) }} t={t} />)
  await waitFor(() => expect(calls.length).toBeGreaterThan(0))
  return { ...view, calls, fieldCalls, descriptionCalls, drafts, list }
}

describe('more tasks page', () => {
  it('loads the first connection and project, then lists the platform columns', async () => {
    const { calls, fieldCalls } = await open()
    const select = screen.getByLabelText(zh.moreTasksConnection) as HTMLSelectElement
    expect(Array.from(select.options).map(option => option.textContent)).toEqual(['云效 · Alpha', '云效 · Beta'])
    expect(select.value).toBe('conn-1')
    expect((screen.getByLabelText(zh.moreTasksProject) as HTMLSelectElement).value).toBe('space-1')
    expect(fieldCalls[0]).toEqual({ connectionId: 'conn-1', projectId: 'space-1', category: 'Req' })

    expect(calls[0]).toMatchObject({ connectionId: 'conn-1', projectId: 'space-1', categories: 'Req', page: 1, perPage: 50, orderBy: 'gmtCreate', sort: 'desc' })
    // Only the shown columns are requested; the description never is.
    expect(calls[0]!.fields).toContain('subject')
    expect(calls[0]!.fields).toContain('customFields')
    expect(calls[0]!.customFieldIds).toEqual(['priority'])
    expect(calls[0]!.fields).not.toContain('description')

    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map(cell => cell.textContent)
    expect(headers).toEqual([
      zh.moreTasksColSerial, zh.moreTasksColSubject, zh.moreTasksColStatus, zh.moreTasksColAssignee,
      zh.moreTasksColCreator, zh.moreTasksColCreated, zh.moreTasksColPriority, zh.moreActions,
    ])
    const first = within(screen.getByRole('table')).getAllByRole('row')[1]!
    expect(within(first).getByText('PROJ-11')).toBeTruthy()
    expect(within(first).getByText('Alpha work item')).toBeTruthy()
    expect(within(first).getByText('中')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(zh.moreTasksSummary.replace('{page}', '1').replace('{pages}', '1').replace('{total}', '1'))
  })

  it('lists every platform field in the header drawer and requests a newly shown custom field', async () => {
    const { calls } = await open()
    fireEvent.click(screen.getByRole('button', { name: zh.moreTasksColumnsTitle }))
    const drawer = screen.getByRole('dialog', { name: zh.moreTasksColumnsTitle })
    expect(within(drawer).getByText(zh.moreTasksShownFields)).toBeTruthy()
    expect(within(drawer).getByText(zh.moreTasksHiddenFields)).toBeTruthy()
    // A custom field the project configures is offered by its own name.
    expect(within(drawer).getByRole('switch', { name: 'Story Points' })).toBeTruthy()
    expect(within(drawer).getByRole('switch', { name: '计划开始时间' })).toBeTruthy()
    // The search box filters both sections.
    fireEvent.change(within(drawer).getByRole('searchbox', { name: zh.moreTasksFieldSearch }), { target: { value: '计划' } })
    expect(within(drawer).queryByRole('switch', { name: 'Story Points' })).toBeNull()
    expect(within(drawer).getByRole('switch', { name: '计划开始时间' })).toBeTruthy()
    fireEvent.change(within(drawer).getByRole('searchbox', { name: zh.moreTasksFieldSearch }), { target: { value: '' } })

    fireEvent.click(within(drawer).getByRole('switch', { name: 'Story Points' }))
    await waitFor(() => expect(calls.at(-1)!.customFieldIds).toEqual(['priority', 'story_points']))
    expect(calls.at(-1)!.fields).toContain('customFields')
  })

  it('drops a column from the request when its switch is turned off', async () => {
    const { calls } = await open()
    expect(calls[0]!.fields).toContain('assignedTo')
    fireEvent.click(screen.getByRole('button', { name: zh.moreTasksColumnsTitle }))
    const drawer = screen.getByRole('dialog', { name: zh.moreTasksColumnsTitle })
    fireEvent.click(within(drawer).getByRole('switch', { name: zh.moreTasksColAssignee }))
    await waitFor(() => expect(calls.at(-1)!.fields).not.toContain('assignedTo'))
    expect(within(screen.getByRole('table')).queryByText(zh.moreTasksColAssignee)).toBeNull()
  })

  it('changes connection, project, category, page size and page with new requests', async () => {
    const { calls } = await open({ list: async request => page([row()], { page: request.page, perPage: request.perPage, totalPages: 3, total: 120 }) })
    fireEvent.change(screen.getByLabelText(zh.moreTasksCategory), { target: { value: 'Bug' } })
    await waitFor(() => expect(calls.at(-1)?.categories).toBe('Bug'))

    fireEvent.change(screen.getByLabelText(zh.moreTasksProject), { target: { value: 'space-2' } })
    await waitFor(() => expect(calls.at(-1)?.projectId).toBe('space-2'))

    fireEvent.change(screen.getByLabelText(zh.perPage), { target: { value: '100' } })
    await waitFor(() => expect(calls.at(-1)?.perPage).toBe(100))

    fireEvent.click(screen.getByRole('button', { name: zh.nextPage }))
    await waitFor(() => expect(calls.at(-1)?.page).toBe(2))
    fireEvent.click(screen.getByRole('button', { name: zh.prevPage }))
    await waitFor(() => expect(calls.at(-1)?.page).toBe(1))
    expect((screen.getByRole('button', { name: zh.prevPage }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('hands a row to the composer with the description only when the settings ask for it', async () => {
    localStorage.setItem('dsh-task-list.workitem-fill', JSON.stringify(['title', 'description', 'number']))
    const withDescription = await open()
    fireEvent.click(within(screen.getByRole('table')).getAllByRole('button', { name: zh.moreTasksSync })[0]!)
    await waitFor(() => expect(withDescription.drafts).toHaveLength(1))
    expect(withDescription.descriptionCalls).toEqual([{ connectionId: 'conn-1', projectId: 'space-1', id: '1000000000000000001' }])
    expect(withDescription.drafts[0]).toMatchObject({ mode: 'sync' })
    expect(withDescription.drafts[0]!.description?.plain).toBe('Body')

    cleanup()
    // Without the description box the detail request is skipped entirely.
    localStorage.setItem('dsh-task-list.workitem-fill', JSON.stringify(['title', 'number']))
    const withoutDescription = await open()
    fireEvent.click(within(screen.getByRole('table')).getAllByRole('button', { name: zh.moreTasksSync })[0]!)
    await waitFor(() => expect(withoutDescription.drafts).toHaveLength(1))
    expect(withoutDescription.descriptionCalls).toEqual([])
    expect(withoutDescription.drafts[0]!.description).toBeNull()
  })

  it('marks the row Start action as start-immediately', async () => {
    localStorage.setItem('dsh-task-list.workitem-fill', JSON.stringify(['title']))
    const { drafts } = await open()
    fireEvent.click(within(screen.getByRole('table')).getAllByRole('button', { name: zh.moreTasksStart })[0]!)
    await waitFor(() => expect(drafts).toHaveLength(1))
    expect(drafts[0]!.mode).toBe('start')
    expect(drafts[0]!.row.subject).toBe('Alpha work item')
  })

  it('filters by title plus at most two configured conditions', async () => {
    localStorage.setItem('dsh-task-list.workitem-filters', JSON.stringify(['status', 'assignedTo', 'priority']))
    const { calls } = await open()

    // Title search is a form submit, not a request per keystroke.
    const titleBox = screen.getByRole('searchbox', { name: zh.filterTitlePlaceholder })
    fireEvent.change(titleBox, { target: { value: 'OCR' } })
    expect(calls).toHaveLength(1)
    fireEvent.submit(titleBox.closest('form')!)
    await waitFor(() => expect(calls.at(-1)?.conditions).toEqual([[{ field: 'subject', operator: 'CONTAINS', value: ['OCR'] }]]))

    // A condition offers the configured field's own values (statuses from metadata).
    fireEvent.click(screen.getByRole('button', { name: zh.filterAdd }))
    const statusValue = await screen.findByLabelText(zh.filterStatus)
    expect(Array.from((statusValue as HTMLSelectElement).options).map(option => option.textContent)).toContain('待处理')
    fireEvent.change(statusValue, { target: { value: '100005' } })
    await waitFor(() => expect(calls.at(-1)?.conditions![0].map(condition => condition.field)).toEqual(['subject', 'status']))

    // Two is the cap: the add button disables and a second condition can be removed.
    fireEvent.click(screen.getByRole('button', { name: zh.filterAdd }))
    await waitFor(() => expect((screen.getByRole('button', { name: zh.filterAdd }) as HTMLButtonElement).disabled).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: `${zh.filterRemove} 1` }))
    // The replacement row is the next configured field and has no value yet, so
    // only the title search reaches the request.
    await waitFor(() => expect(calls.at(-1)?.conditions![0].map(condition => condition.field)).toEqual(['subject']))
    expect((within(screen.getByRole('group', { name: zh.filterSettingsTitle })).getByLabelText(`${zh.filterAny} 1`) as HTMLSelectElement).value).toBe('assignedTo')

    fireEvent.click(screen.getByRole('button', { name: zh.filterClear }))
    await waitFor(() => expect(calls.at(-1)?.conditions).toBeUndefined())
  })

  it('reports an empty page and a load failure without dropping the controls', async () => {
    await open({ list: async () => page([]) })
    expect(screen.getByText(zh.moreTasksEmpty)).toBeTruthy()

    cleanup()
    const view = render(<MoreTasks sync={face() as never}
      query={{ listWorkitems: async () => { throw new Error('boom') }, listWorkitemFields: async () => catalog, getWorkitemDescription: async () => ({ description: null }) }}
      onDraft={() => {}} close={() => {}} t={t} />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('boom'))
    expect(within(view.container).getByLabelText(zh.moreTasksConnection)).toBeTruthy()
  })
})

describe('more tasks entry point', () => {
  // useSyncExternalStore requires a cached snapshot: a fresh object per call loops.
  const workspaces = { items: [{ workspaceId: 'ws', title: 'Workspace' }] }
  const sessions = { items: [] as { id: string; title: string; archived: boolean }[] }

  function panel(onList: (request: ListWorkitemsRequest) => Promise<SafeWorkitemPage>) {
    const props: any = {
      list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      update: async () => { throw new Error('unused') },
      readAttachments: async () => [], listAgents: async () => [],
      workspaceSnapshot: () => workspaces, subscribeWorkspaces: () => () => {},
      sessionSnapshot: () => sessions, subscribeSessions: () => () => {},
      probeWorktree: async () => {}, listInitialEntries: async () => [], initializeGit: async () => {},
      start: async () => {},
      listWorkitems: onList,
      listWorkitemFields: async () => catalog,
      getWorkitemDescription: async () => ({ description: { format: 'richtext', html: '<p>Body</p>', plain: 'Body' } }),
      sync: { listSyncConnections: async () => connections, getSyncMetadata: async () => ({ projects }) },
      t,
    }
    return render(<TaskPanel {...props} />)
  }

  it('opens next to the report button and closes back to the list', async () => {
    panel(async () => page([row()]))
    expect(screen.getByRole('button', { name: zh.moreTasksTitle })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh.moreTasksTitle }))
    expect(await screen.findByRole('heading', { name: zh.moreTasksTitle })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh.moreTasksClose })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: zh.moreTasksClose }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: zh.moreTasksTitle })).toBeNull())
    expect(screen.getByRole('button', { name: zh.moreTasksTitle })).toBeTruthy()
  })

  it('opens the create composer prefilled when a work item is synced', async () => {
    localStorage.setItem('dsh-task-list.workitem-fill', JSON.stringify(['title', 'description', 'number']))
    panel(async () => page([row()]))
    fireEvent.click(screen.getByRole('button', { name: zh.moreTasksTitle }))
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy())

    fireEvent.click(within(screen.getByRole('table')).getAllByRole('button', { name: zh.moreTasksSync })[0]!)
    // The work-item page closes and the create dialog owns the screen, with the
    // subject as the first content line so the task title derives from it.
    await waitFor(() => expect(screen.queryByRole('heading', { name: zh.moreTasksTitle })).toBeNull())
    expect(await screen.findByRole('dialog')).toBeTruthy()
    const editor = document.querySelector('[contenteditable="true"]')
    expect(editor?.textContent ?? '').toContain('Alpha work item')
    expect(editor?.textContent ?? '').toContain(`${zh.fillNumber}: PROJ-11`)
  })
})
