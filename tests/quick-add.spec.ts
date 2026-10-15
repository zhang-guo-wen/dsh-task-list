import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EDITABLE_SELECTOR, MODAL_SELECTOR, closeQuickAdd, handleQuickAddKey, markQuickAddSaved, openQuickAdd,
  quickAddAvailable, quickAddState, subscribeQuickAdd,
} from '../src/client/quick-add.ts'
import type { CaptureEvent } from '../src/client/capture.ts'

/** A focus target that is inside nothing. */
const plainTarget = { getAttribute: () => null, closest: () => null }
/** A focus target inside the given selector, and nowhere else. */
const insideTarget = (selector: string) => ({
  getAttribute: () => null,
  closest: (candidate: string) => candidate === selector ? {} : null,
})
const documentWith = (focused: unknown, modal: unknown = null) => ({
  querySelector: (selector: string) => selector === MODAL_SELECTOR ? modal : null,
  activeElement: focused as never,
})

/** A Ctrl+S keydown that records whether it was cancelled. */
function chord(overrides: Partial<CaptureEvent> = {}): CaptureEvent & { cancelled: number } {
  const event = {
    key: 's', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false,
    cancelled: 0,
    preventDefault() { event.cancelled++ },
    ...overrides,
  }
  return event
}

afterEach(() => { closeQuickAdd() })

describe('new-task chord ownership', () => {
  it('claims plain page focus', () => {
    expect(quickAddAvailable(documentWith(plainTarget) as never)).toBe(true)
    expect(quickAddAvailable(documentWith(null) as never)).toBe(true)
  })

  it('leaves a field, an editor, a terminal, and an open dialog alone', () => {
    expect(quickAddAvailable(documentWith(insideTarget(EDITABLE_SELECTOR)) as never)).toBe(false)
    expect(quickAddAvailable(documentWith(insideTarget('.xterm')) as never)).toBe(false)
    expect(quickAddAvailable(documentWith(plainTarget, {}) as never)).toBe(false)
  })
})

describe('new-task chord handler', () => {
  it('opens the dialog and cancels the browser Save', () => {
    const open = vi.fn()
    const event = chord()
    expect(handleQuickAddKey(event, { available: () => true, open })).toBe(true)
    expect(event.cancelled).toBe(1)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('passes when the chord belongs to something else', () => {
    const open = vi.fn()
    const busy = chord()
    expect(handleQuickAddKey(busy, { available: () => false, open })).toBe(false)
    expect(busy.cancelled).toBe(0)

    const other = chord({ key: 'x' })
    expect(handleQuickAddKey(other, { available: () => true, open })).toBe(false)
    expect(other.cancelled).toBe(0)
    expect(open).not.toHaveBeenCalled()
  })
})

describe('overlay request store', () => {
  it('opens and closes once per state change', () => {
    const listener = vi.fn()
    const off = subscribeQuickAdd(listener)
    openQuickAdd()
    openQuickAdd()
    expect(quickAddState().open).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    closeQuickAdd()
    closeQuickAdd()
    expect(quickAddState().open).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    openQuickAdd()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('counts the tasks the dialog created, so a page list can reload', () => {
    const before = quickAddState().saved
    markQuickAddSaved()
    expect(quickAddState().saved).toBe(before + 1)
    expect(quickAddState().open).toBe(false)
  })
})
