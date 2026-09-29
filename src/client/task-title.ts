/** Title fallback shared by the composer and its tests. */

/** Characters of the description reused as the title when none is typed. */
export const DERIVED_TITLE_LENGTH = 50

/**
 * Resolve the stored title for a task.
 * An explicit title wins; otherwise the trimmed description collapses every
 * whitespace run and contributes its first {@link DERIVED_TITLE_LENGTH}
 * characters. Returns an empty string when both inputs are blank.
 * @param title - text the user typed in the title field.
 * @param notes - task description.
 * @returns title to persist.
 */
export function deriveTaskTitle(title: string, notes: string): string {
  const explicit = title.trim()
  if (explicit) return explicit
  const collapsed = notes.trim().replace(/\s+/gu, ' ')
  return Array.from(collapsed).slice(0, DERIVED_TITLE_LENGTH).join('').trim()
}
