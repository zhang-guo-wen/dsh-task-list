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
