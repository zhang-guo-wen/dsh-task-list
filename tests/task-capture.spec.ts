import { describe, expect, it, vi } from 'vitest'
import {
  captureDraft, handleCaptureKey, installCaptureShortcut, isCaptureShortcut, isComposerFocused,
  type CaptureEvent, type CaptureKeyDeps, type CaptureOutcome,
} from '../src/client/capture.ts'

const plainKey = { key: 's', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }

describe('capture shortcut', () => {
  it('matches Ctrl+S and Cmd+S', () => {
    expect(isCaptureShortcut({ ...plainKey, ctrlKey: true })).toBe(true)
    expect(isCaptureShortcut({ ...plainKey, metaKey: true })).toBe(true)
    expect(isCaptureShortcut({ ...plainKey, key: 'S', ctrlKey: true })).toBe(true)
  })

  it('rejects other keys and modified chords', () => {
    expect(isCaptureShortcut(plainKey)).toBe(false)
    expect(isCaptureShortcut({ ...plainKey, key: 'x', ctrlKey: true })).toBe(false)
    expect(isCaptureShortcut({ ...plainKey, ctrlKey: true, shiftKey: true })).toBe(false)
    expect(isCaptureShortcut({ ...plainKey, ctrlKey: true, altKey: true })).toBe(false)
  })
})

describe('composer focus', () => {
  it('accepts the composer editor and its descendants', () => {
    expect(isComposerFocused({ getAttribute: () => 'true', closest: () => null })).toBe(true)
    expect(isComposerFocused({
      getAttribute: () => null,
      closest: selector => selector === '[contenteditable="true"]' ? {} : null,
    })).toBe(true)
  })

  it('rejects a plain field and a missing focus target', () => {
    expect(isComposerFocused({ getAttribute: () => null, closest: () => null })).toBe(false)
    expect(isComposerFocused(null)).toBe(false)
    expect(isComposerFocused({ getAttribute: () => 'true', closest: selector => selector === '[role="dialog"]' ? {} : null })).toBe(false)
  })
})

describe('captureDraft', () => {
  it('creates one task from the draft and clears the composer', async () => {
    const create = vi.fn(async () => ({ id: 'task-1' }))
    const clearDraft = vi.fn()

    const outcome = await captureDraft(' 写一个任务列表\n第二行 ', { create, clearDraft })

    expect(outcome).toEqual({ kind: 'created', title: '写一个任务列表 第二行' })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      title: '写一个任务列表 第二行',
      notes: '写一个任务列表\n第二行',
      content: { version: 1, blocks: [
        { type: 'paragraph', children: [{ text: '写一个任务列表' }] },
        { type: 'paragraph', children: [{ text: '第二行' }] },
      ] },
      attachments: [],
      priority: 'medium',
      storyPoints: null,
      tags: [],
      workspaceId: null,
      sendImmediately: false,
      sessionId: null,
      agent: null,
      useWorktree: false,
    })
    expect(clearDraft).toHaveBeenCalledTimes(1)
  })

  it('links the captured task to its composer session', async () => {
    const create = vi.fn(async () => ({}))
    await captureDraft('保存当前会话任务', { create, clearDraft: vi.fn(), sessionId: 'session-current' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-current' }))
  })

  it('keeps the originating session while attachment capture is pending', async () => {
    const create = vi.fn(async () => ({}))
    const node = { type: 'attachment' as const, id: '22222222-2222-4222-8222-222222222222', name: '需求.txt', mediaType: 'text/plain', bytes: 3 }
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let activeSession = 'session-original'
    const outcome = captureDraft('异步保存', {
      create, clearDraft: vi.fn(), sessionId: activeSession, hasAttachments: true,
      captureAttachments: async () => { await pending; return { blocks: [node], uploads: [{ id: node.id, data: 'YWJj' }] } },
    })
    activeSession = 'session-other'
    release()
    await expect(outcome).resolves.toMatchObject({ kind: 'created' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-original' }))
  })

  it('captures attachment-only drafts and releases them only after persistence', async () => {
    const steps: string[] = []
    const node = { type: 'attachment' as const, id: '22222222-2222-4222-8222-222222222222', name: '需求.txt', mediaType: 'text/plain', bytes: 3 }
    const create = vi.fn(async () => { steps.push('save') })
    const outcome = await captureDraft('', {
      create, hasAttachments: true,
      captureAttachments: async () => ({ blocks: [node], uploads: [{ id: node.id, data: 'YWJj' }] }),
      clearDraft: () => { steps.push('clear') }, clearAttachments: () => { steps.push('release') },
    })
    expect(outcome).toEqual({ kind: 'created', title: '需求.txt' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ notes: '\n需求.txt', attachments: [{ id: node.id, data: 'YWJj' }] }))
    expect(steps).toEqual(['save', 'clear', 'release'])
    const clearDraft = vi.fn()
    const clearAttachments = vi.fn()
    expect(await captureDraft('text', {
      create, clearDraft, clearAttachments, hasAttachments: true,
      captureAttachments: async () => { throw new Error('read failed') },
    })).toEqual({ kind: 'failed', message: 'read failed' })
    expect(clearDraft).not.toHaveBeenCalled()
    expect(clearAttachments).not.toHaveBeenCalled()
  })

  it('does not discard attachments when the writer refuses the task or capture is unavailable', async () => {
    const create = vi.fn(async () => { throw new Error('save refused') })
    const clearDraft = vi.fn()
    const clearAttachments = vi.fn()
    const node = { type: 'attachment' as const, id: '22222222-2222-4222-8222-222222222222', name: 'file.txt', mediaType: 'text/plain', bytes: 1 }
    expect(await captureDraft('text', {
      create, clearDraft, clearAttachments, hasAttachments: true,
      captureAttachments: async () => ({ blocks: [node], uploads: [{ id: node.id, data: 'YQ==' }] }),
    })).toEqual({ kind: 'failed', message: 'save refused' })
    expect(await captureDraft('text', { create, clearDraft, clearAttachments, hasAttachments: true }))
      .toEqual({ kind: 'failed', message: 'attachment capture is unavailable' })
    expect(create).toHaveBeenCalledOnce()
    expect(clearDraft).not.toHaveBeenCalled()
    expect(clearAttachments).not.toHaveBeenCalled()
  })

  it('ignores a blank draft without writing anything', async () => {
    const create = vi.fn()
    const clearDraft = vi.fn()

    expect(await captureDraft('   \n ', { create, clearDraft })).toEqual({ kind: 'empty' })
    expect(create).not.toHaveBeenCalled()
    expect(clearDraft).not.toHaveBeenCalled()
  })

  it('keeps the draft and reports the reason when the task is refused', async () => {
    const create = vi.fn(async () => { throw new Error('store is read-only') })
    const clearDraft = vi.fn()

    expect(await captureDraft('写代码', { create, clearDraft })).toEqual({ kind: 'failed', message: 'store is read-only' })
    expect(clearDraft).not.toHaveBeenCalled()
  })
})

function event(overrides: Partial<CaptureEvent> = {}): CaptureEvent {
  return { ...plainKey, ctrlKey: true, preventDefault: vi.fn(), ...overrides }
}

function deps(activeElement: CaptureKeyDeps['activeElement'], capture: CaptureKeyDeps['capture']): {
  deps: CaptureKeyDeps
  report: ReturnType<typeof vi.fn>
} {
  const report = vi.fn()
  return { deps: { readDraft: () => '草稿内容', activeElement, capture, report }, report }
}

const editor = { getAttribute: () => 'true', closest: () => null }
const plainField = { getAttribute: () => null, closest: () => null }

describe('capture key handling', () => {
  it('consumes Ctrl+S in the composer and reports the outcome', async () => {
    const capture = vi.fn(async (): Promise<CaptureOutcome> => ({ kind: 'created', title: '草稿内容' }))
    const { deps: keyDeps, report } = deps(() => editor, capture)
    const key = event()

    expect(handleCaptureKey(key, keyDeps)).toBe(true)
    expect(key.preventDefault).toHaveBeenCalledOnce()
    expect(capture).toHaveBeenCalledWith('草稿内容')
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith({ kind: 'created', title: '草稿内容' }))
  })

  it('leaves Ctrl+S outside the composer to the browser', () => {
    const capture = vi.fn()
    const { deps: keyDeps } = deps(() => plainField, capture)
    const key = event()

    expect(handleCaptureKey(key, keyDeps)).toBe(false)
    expect(key.preventDefault).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
  })

  it('leaves other chords alone in the composer', () => {
    const capture = vi.fn()
    const { deps: keyDeps } = deps(() => editor, capture)
    const key = event({ ctrlKey: false })

    expect(handleCaptureKey(key, keyDeps)).toBe(false)
    expect(key.preventDefault).not.toHaveBeenCalled()
  })
})

describe('capture shortcut installation', () => {
  interface Registered {
    type: string
    listener: (event: CaptureEvent) => void
    options: { capture: boolean }
  }

  function target(): {
    target: Parameters<typeof installCaptureShortcut>[0]
    registered: Registered[]
    removeEventListener: ReturnType<typeof vi.fn>
  } {
    const registered: Registered[] = []
    const removeEventListener = vi.fn()
    return {
      target: {
        addEventListener: (type, listener, options) => { registered.push({ type, listener, options }) },
        removeEventListener,
      },
      registered,
      removeEventListener,
    }
  }

  it('listens for keydown in the capture phase and releases it on dispose', async () => {
    const capture = vi.fn(async (): Promise<CaptureOutcome> => ({ kind: 'created', title: '草稿内容' }))
    const { deps: keyDeps, report } = deps(() => editor, capture)
    const { target: sink, registered, removeEventListener } = target()

    const dispose = installCaptureShortcut(sink, keyDeps)

    expect(registered).toEqual([{ type: 'keydown', listener: expect.any(Function), options: { capture: true } }])
    registered[0]!.listener(event())
    expect(capture).toHaveBeenCalledWith('草稿内容')
    await vi.waitFor(() => expect(report).toHaveBeenCalledOnce())

    dispose()
    expect(removeEventListener).toHaveBeenCalledWith('keydown', registered[0]!.listener, { capture: true })
  })
})
