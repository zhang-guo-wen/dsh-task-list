/** Workspace helpers shared by the panel and the launch path. */

/** Language-neutral title the Host stores for its automatic first-use Workspace. */
export const DEFAULT_WORKSPACE_MARKER = 'default-workspace'

/** Minimal Workspace projection the helpers need. */
export interface WorkspaceOption {
  workspaceId: string
  title: string
}

function titled<T extends WorkspaceOption>(items: readonly T[], title: string): T | undefined {
  return items.find(item => String(item.title ?? '').trim() === title)
}

/**
 * Pick the Workspace an unlinked task belongs to.
 * The Host stores its automatic first-use Workspace under the
 * {@link DEFAULT_WORKSPACE_MARKER} title, which browsers label with the
 * localized {@link localizedDefault}; either title counts. Without a match the
 * first registered Workspace is used, because a task is never left without one.
 * @param items - Workspace rows in Host order.
 * @param localizedDefault - localized default Workspace name.
 * @returns the default Workspace, or undefined when none is registered.
 */
export function pickDefaultWorkspace<T extends WorkspaceOption>(items: readonly T[], localizedDefault: string): T | undefined {
  return titled(items, DEFAULT_WORKSPACE_MARKER) ?? titled(items, localizedDefault) ?? items[0]
}
