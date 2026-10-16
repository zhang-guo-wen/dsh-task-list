// One formatter for the whole panel: building an Intl.DateTimeFormat costs far
// more than using one, and the list formats a timestamp for every synced row on
// every rebuild, so it is built once at module scope.
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Format one epoch-millisecond timestamp with the panel's shared formatter.
 * @param timestamp - epoch milliseconds.
 * @returns the localised medium date and short time.
 */
export function formattedTime(timestamp: number): string {
  return timeFormat.format(timestamp)
}
