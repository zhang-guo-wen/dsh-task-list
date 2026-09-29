# DSH Task List

A native task-list panel for DeepSeek Harness Web. Tasks appear as a single-column list: every row shows the title, workspace, and creation time, with Start on the right. The title is optional — an empty title saves the first 50 characters of the description, and only the description is required. Click a row to edit its priority, story points, tags, workspace, or status; hover to reveal Delete, which deletes without a confirmation prompt. A task without a workspace belongs to the default workspace, and its session ID is bound automatically on start and cannot be edited. The default order is To do, In progress, then Done. Tasks are stored in the plugin's own SQLite database; the plugin does not write to Harness session files or query indexes.

## Requirements

- DeepSeek Harness 0.2.0-rc.1 or newer, with the Web workspace controller
- Web profile
- Node.js `^22.19.0` or `>=24.0.0` (`node:sqlite`)
- `@guowenzhang/dsh-worktree` 1.x installed and enabled in the Web profile when **Use worktree** is selected

## Build and install from this checkout

```powershell
cd C:\02-codespace\DeepSeek\dsh-task-list
npm ci
npm run typecheck
npm test
npm run build
dsh plugin --profile web add 'link:C:/02-codespace/DeepSeek/dsh-task-list'
```

Restart `dsh web` and refresh the browser. Select **Task list** in the sidebar. Rebuild and refresh for client changes; restart the Host for Host changes. To remove it, run `dsh plugin --profile web remove @guowenzhang/dsh-task-list`. Removing the plugin leaves task data in place.

The default database is `<DSH_HOME>/task-list/tasks.sqlite` (normally `~/.dsh/task-list/tasks.sqlite`). The plugin accepts an optional absolute `file` path in its Cordis configuration. SQLite WAL mode and optimistic row versions protect ordinary concurrent edits. Back up the database using SQLite's backup API or `VACUUM INTO` while DSH is running; when DSH is stopped, copy `tasks.sqlite` and any WAL sidecars together. Existing version-1 databases migrate automatically on startup; their tasks retain their status and receive default card fields.

This is a manual task list with three states: **To do**, **In progress**, and **Done**. A task records its actual start time on its first move to **In progress**, and its completion time on a move to **Done**. Reopening clears the completion time but keeps the first start time. Tasks that predate this feature have no inferred timestamps. Workspaces come from the Harness workspace list; a task without one is treated as belonging to the default workspace (the row titled `default-workspace` or the localized "Default workspace", falling back to the first registered workspace).

Tasks can store an Agent preset, session ID, **Send immediately**, and **Use worktree**. **Send immediately** defaults to off. **Start** on a to-do card creates a session in its linked workspace, puts the task title and description in the conversation draft, binds the new session ID to the task, and moves it to **In progress**. With **Send immediately** on, it submits that draft. A selected Agent preset is applied before the first message. **Use worktree** starts a new checkout and session through `dsh-worktree`; the task keeps its original workspace as the source for the checkout. The edit form warns when the chosen workspace is not a Git repository while still allowing the task to be saved. Starting from a non-Git workspace opens a dialog to choose another workspace or initialize and start. The dialog lists top-level files and folders with Select all and Select none; selected folders contribute their contents to the first commit, and unselected items are added to the root `.gitignore`. The `.gitignore` file is preserved and committed. Separate nested Git repositories cannot be selected. For a parent folder containing multiple repositories, choose a specific Git workspace to keep its files. A task without a linked workspace starts in the default workspace; a workspace id whose registration was deleted reports a failure instead. In-progress cards show **Complete**, which moves the task to **Done**; done cards show a read-only status. The task list does not mirror the session-local `todo/write` checklist.

## Development

`src/store.ts` owns validation, schema, and SQLite reads/writes. `src/task-service.ts` exposes Host methods over DSH's remote service; `src/client/` registers the sidebar and panel. The database rejects unknown tables or a future schema version rather than overwriting them. Behavior tests use temporary SQLite files.

```powershell
npm run typecheck
npm test
npm run build
```
