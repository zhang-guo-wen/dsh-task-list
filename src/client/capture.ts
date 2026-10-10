/** Composer draft capture: Ctrl+S turns unsent input into a task. */
import type { CreateTaskRequest, TaskAttachmentUpload, TaskContent } from '../types.ts'
import { contentText, textContent, validateContent } from '../content.ts'
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

/** Session catalog row the capture link reads: blankness and the recorded agent preset. */
export interface CaptureSessionRow {
  readonly blank?: boolean | undefined
  readonly projectionValues?: { readonly agentPreset?: unknown } | undefined
}

/** Live snapshots one capture link resolves against. */
export interface CaptureTargetSources {
  /** Session currently owning the composer. */
  readonly sessionId: string
  /** Catalog row of that Session; absent before its list row arrives. */
  readonly session: CaptureSessionRow | undefined
  /** Workspace registry, in host order. */
  readonly workspaces: readonly { readonly workspaceId: string; readonly sessionIds: readonly string[] }[]
  /** Host-effective default preset, read only while a Session records none. */
  readonly defaultAgent: string | null
}

/** What one captured task links: its Session, that Session's Workspace, and its agent. */
export interface CaptureTarget {
  readonly sessionId: string | null
  readonly workspaceId: string | null
  readonly agent: string | null
}

/**
 * Resolve the link one capture writes. A blank Session is the reusable seat of
 * the next New Session — its identity does not stand for the work — so the task
 * keeps no Session link while it lasts. The Workspace the Session was opened in
 * and the agent preset it runs describe the captured work either way.
 * @param sources - live catalog, Workspace registry, and default-preset reads.
 * @returns the Session, Workspace, and agent triple to persist.
 */
export function captureTarget(sources: CaptureTargetSources): CaptureTarget {
  const preset = sources.session?.projectionValues?.agentPreset
  return {
    sessionId: sources.session?.blank === true ? null : sources.sessionId,
    workspaceId: sources.workspaces.find(workspace => workspace.sessionIds.includes(sources.sessionId))?.workspaceId ?? null,
    agent: typeof preset === 'string' && preset !== '' ? preset : sources.defaultAgent,
  }
}

export interface CaptureDeps {
  /** Persist the task built from the draft. */
  create(request: CreateTaskRequest): Promise<unknown>
  /** Empty the composer after a successful capture. */
  clearDraft(): void
  /** Persist bytes first; callers keep runtime attachments until the task is saved. */
  captureAttachments?(): Promise<{ blocks: TaskContent['blocks']; uploads: TaskAttachmentUpload[] }>
  hasAttachments?: boolean
  /** Session owning the draft, captured before asynchronous attachment reads. */
  sessionId?: string | null
  /** Workspace that Session belongs to, captured with it. */
  workspaceId?: string | null
  /** Agent preset that Session runs, captured with it. */
  agent?: string | null
  clearAttachments?(): void
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
  if (target === null || target.closest?.('[role="dialog"]')) return false
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
  const text = draft.trim()
  if (text === '' && !deps.hasAttachments) return { kind: 'empty' }
  let title: string
  try {
    // Never silently downgrade an attachment-bearing draft to a text-only task.
    if (deps.hasAttachments && !deps.captureAttachments) throw new Error('attachment capture is unavailable')
    const captured = await deps.captureAttachments?.() ?? { blocks: [], uploads: [] }
    if (deps.hasAttachments && (captured.blocks.length === 0 || captured.uploads.length === 0)) throw new Error('attachment bytes missing')
    const content = validateContent({ version: 1, blocks: [...textContent(text).blocks, ...captured.blocks] })
    const notes = contentText(content)
    title = deriveTaskTitle('', notes)
    await deps.create({
      title, notes, content, attachments: captured.uploads, priority: 'medium', storyPoints: null, tags: [],
      workspaceId: deps.workspaceId ?? null, sendImmediately: false, sessionId: deps.sessionId ?? null,
      agent: deps.agent ?? null, useWorktree: false,
    })
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
  deps.clearDraft()
  deps.clearAttachments?.()
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
