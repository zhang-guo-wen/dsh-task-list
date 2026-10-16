import type { TaskStatus } from '../types.ts'
import type { TaskKey } from './locales.ts'

/**
 * Locale key for one stored status: two statuses are spelled with an underscore
 * in storage but camelCase in the dictionary.
 * @param status - the stored task status.
 * @returns the dictionary key that names it.
 */
export function statusKey(status: TaskStatus): TaskKey {
  if (status === 'in_progress') return 'inProgress'
  if (status === 'approving') return 'approving'
  return status
}
