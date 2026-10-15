/**
 * Frame-wide Ctrl+S "New task" dialog. The chord cannot be a configurable Host
 * command: Host Web bindings reject a primary-only `S` (the browser's own Save),
 * so the plugin routes the chord itself, exactly as the composer's Ctrl+S
 * capture does. The trigger is claimed only on plain page input — a focused
 * field, a terminal, or an open dialog keeps the chord for itself.
 */
import { isCaptureShortcut, type CaptureEvent, type FocusTarget, type KeydownTarget } from './capture.ts'

/** The Host's own "local input owns the keyboard" selector, region `editable`. */
export const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
/** The Host's terminal region; a focused terminal keeps its own chords. */
export const TERMINAL_SELECTOR = '.xterm'
/** The Host's modal surfaces: an open dialog or menu owns the keyboard. */
export const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], [role="menu"]'

/** Document shape the availability guard reads; a DOM Document satisfies it. */
export interface ShortcutDocument {
  querySelector(selector: string): unknown
  readonly activeElement: FocusTarget | null
}

function inside(target: FocusTarget, selector: string): boolean {
  const found = target.closest?.(selector)
  return found !== null && found !== undefined
}

/**
 * @param document - live document whose focus and modal state decide the owner.
 * @returns whether the chord belongs to the New task dialog right now.
 */
export function quickAddAvailable(document: ShortcutDocument): boolean {
  if (document.querySelector(MODAL_SELECTOR) !== null) return false
  const focused = document.activeElement
  if (focused === null) return true
  return !inside(focused, EDITABLE_SELECTOR) && !inside(focused, TERMINAL_SELECTOR)
}

/** One read of the overlay request: whether the dialog is up, and how many tasks it saved. */
export interface QuickAddState {
  readonly open: boolean
  /** Successful saves, so a mounted task list reloads what the dialog created. */
  readonly saved: number
}

/** Stable identity for `useSyncExternalStore`, replaced per mutation. */
let state: QuickAddState = { open: false, saved: 0 }
const listeners = new Set<() => void>()

function publish(next: QuickAddState): void {
  state = next
  for (const listener of [...listeners]) listener()
}

/** @returns the current overlay request. */
export function quickAddState(): QuickAddState {
  return state
}

/** @param listener - called after every request or save. @returns its disposer. */
export function subscribeQuickAdd(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Show the New task dialog; a repeated request keeps the open one. */
export function openQuickAdd(): void {
  if (!state.open) publish({ ...state, open: true })
}

/** Hide the New task dialog. */
export function closeQuickAdd(): void {
  if (state.open) publish({ ...state, open: false })
}

/** Record one task created by the dialog, so the page's list reloads. */
export function markQuickAddSaved(): void {
  publish({ ...state, saved: state.saved + 1 })
}

/** What the chord handler reads and runs. */
export interface QuickAddKeyDeps {
  /** Whether the chord belongs to the dialog right now. */
  available(): boolean
  /** Show the dialog. */
  open(): void
}

/**
 * Consume one keydown: a Ctrl+S outside every field and dialog opens the New
 * task dialog instead of reaching the browser's own Save.
 * @param event - the keydown to arbitrate.
 * @param deps - live availability and the open action.
 * @returns whether the shortcut owned the event.
 */
export function handleQuickAddKey(event: CaptureEvent, deps: QuickAddKeyDeps): boolean {
  if (!isCaptureShortcut(event) || !deps.available()) return false
  event.preventDefault()
  deps.open()
  return true
}

/**
 * Route the page-level Ctrl+S to the dialog during the capture phase, so the
 * browser's Save never sees the chord.
 * @param target - the document-like keydown sink.
 * @param deps - availability guard and the open action.
 * @returns disposer releasing the listener.
 */
export function installQuickAddShortcut(target: KeydownTarget, deps: QuickAddKeyDeps): () => void {
  const listener = (event: CaptureEvent): void => { handleQuickAddKey(event, deps) }
  target.addEventListener('keydown', listener, { capture: true })
  return () => target.removeEventListener('keydown', listener, { capture: true })
}
