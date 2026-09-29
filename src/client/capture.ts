/** Composer draft capture: Ctrl+S turns unsent input into a task. */
import type { CreateTaskRequest } from '../types.ts'
import { deriveTaskTitle } from './task-title.ts'

/** Keyboard shape the shortcut check reads; a DOM KeyboardEvent satisfies it. */
export interface ShortcutEvent {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}

/** Focused element shape; a DOM Element satisfies it. */
export interface FocusTarget {
  getAttribute?(name: string): string | null
  closest?(selector: string): unknown
}

/** Keydown event the handler consumes: the shortcut shape plus cancellation. */
export interface CaptureEvent extends ShortcutEvent {
  preventDefault(): void
}

/** What one capture attempt did, in the words the control reports. */
export type CaptureOutcome =
  | { readonly kind: 'created'; readonly title: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'failed'; readonly message: string }

export interface CaptureDeps {
  /** Persist the task built from the draft. */
  create(request: CreateTaskRequest): Promise<unknown>
  /** Empty the composer after a successful capture. */
  clearDraft(): void
}

export interface CaptureKeyDeps {
  /** Live composer draft of the focused session. */
  readDraft(): string
  /** Document focus, used to keep the shortcut inside the composer. */
  activeElement(): FocusTarget | null
  capture(draft: string): Promise<CaptureOutcome>
  report(outcome: CaptureOutcome): void
}

/** Keydown sink a DOM document satisfies. */
export interface KeydownTarget {
  addEventListener(type: 'keydown', listener: (event: CaptureEvent) => void, options: { capture: boolean }): void
  removeEventListener(type: 'keydown', listener: (event: CaptureEvent) => void, options: { capture: boolean }): void
}

/** @returns whether the event is Ctrl+S or Cmd+S with no other modifier. */
export function isCaptureShortcut(event: ShortcutEvent): boolean {
  if (!event.ctrlKey && !event.metaKey) return false
  if (event.altKey || event.shiftKey) return false
  return event.key.toLowerCase() === 's'
}

/** @returns whether the focused element is the composer editor or inside it. */
export function isComposerFocused(target: FocusTarget | null): boolean {
  if (target === null) return false
  if (target.getAttribute?.('contenteditable') === 'true') return true
  const inside = target.closest?.('[contenteditable="true"]')
  return inside !== null && inside !== undefined
}

/**
 * Persist one task holding the draft. A successful capture empties the
 * composer; a refusal keeps the text so nothing is lost.
 * @param draft - current composer text.
 * @param deps - task writer and composer clear.
 * @returns what the control should report.
 */
export async function captureDraft(draft: string, deps: CaptureDeps): Promise<CaptureOutcome> {
  const notes = draft.trim()
  if (notes === '') return { kind: 'empty' }
  const title = deriveTaskTitle('', notes)
  try {
    await deps.create({
      title, notes, priority: 'medium', storyPoints: null, tags: [],
      workspaceId: null, sendImmediately: false, sessionId: null, agent: null, useWorktree: false,
    })
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
  deps.clearDraft()
  return { kind: 'created', title }
}

/**
 * Consume one keydown: the composer's Ctrl+S creates a task instead of
 * reaching the browser's save dialog, every other key passes through.
 * @returns whether the shortcut owned the event.
 */
export function handleCaptureKey(event: CaptureEvent, deps: CaptureKeyDeps): boolean {
  if (!isCaptureShortcut(event) || !isComposerFocused(deps.activeElement())) return false
  event.preventDefault()
  void deps.capture(deps.readDraft()).then(deps.report)
  return true
}

/**
 * Route the composer's Ctrl+S to the capture during the capture phase, so the
 * editor never sees the chord.
 * @param target - the document-like keydown sink.
 * @param deps - draft reader and capture runner.
 * @returns disposer releasing the listener.
 */
export function installCaptureShortcut(target: KeydownTarget, deps: CaptureKeyDeps): () => void {
  const listener = (event: CaptureEvent): void => { handleCaptureKey(event, deps) }
  target.addEventListener('keydown', listener, { capture: true })
  return () => target.removeEventListener('keydown', listener, { capture: true })
}
