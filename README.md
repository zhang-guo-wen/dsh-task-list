# DSH Task List

A native task-list panel for DeepSeek Harness Web. The page uses the same content box as the built-in Automation tasks page: one centred column capped at 960px whose side padding follows the panel width (`clamp(24px, 4vw, 48px)`), so switching between the two pages does not change the list width. Tasks appear as a single-column list: every row shows the task content (its description) first, followed by fixed-width status and workspace columns that clip with an ellipsis, with Start or Complete on the right; the bound session ID and the creation time are not shown in the list (the edit dialog still shows the created, started, and completed times). The toolbar offers status tabs, a workspace filter, a search box with Search and Refresh buttons, and the list loads one page at a time (10, 20, 50, or 100 rows; 20 by default). Paging, filtering, and searching all run on the Host.

A task can carry subtasks. They render under their task and may be linked to a conversation; select the subtask content or **Open session** to jump back into that session. The composer adds, edits, links, and removes subtasks, and Save applies them together with the task.

Create and edit share one dialog. There is no title field — an empty title is derived from the first 50 characters of the content, and only the content is required. Status and session ID are read-only in both modes: a new task is fixed to To do with an unbound session, an edited task keeps its current values, and the session ID is bound automatically on start. The dialog keeps a fixed height as one column of two rows: the field body scrolls while Cancel and Save stay pinned to the bottom. Inside the field body every field except the content and the subtask section takes half a row, so two of them share a row; each read-only field keeps its own hint underneath, and a dialog narrower than 560px falls back to one field per row.

Tasks are stored in the plugin's own SQLite database; the plugin does not write to Harness session files or query indexes.

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

Restart `dsh web` and refresh the browser. Select **Task list** in the sidebar. Rebuild and refresh for client changes; **a Host restart is required for Host changes** — the list call now answers with a page object, so an old Host and a new browser bundle cannot be mixed. To remove it, run `dsh plugin --profile web remove @guowenzhang/dsh-task-list`. Removing the plugin leaves task data in place.

The default database is `<DSH_HOME>/task-list/tasks.sqlite` (normally `~/.dsh/task-list/tasks.sqlite`). The plugin accepts an optional absolute `file` path in its Cordis configuration. SQLite WAL mode and optimistic row versions protect ordinary concurrent edits. Back up the database using SQLite's backup API or `VACUUM INTO` while DSH is running; when DSH is stopped, copy `tasks.sqlite` and any WAL sidecars together. Existing databases migrate automatically on startup: versions before 3 receive the card fields and launch options, version 3 gains the subtask table, and existing tasks are left untouched.

Search is literal: `%`, `_`, and `\` are not wildcards. A phrase matches a task's title, content, or session ID, and also its subtasks' content or session ID. Paging and filtering apply at the same time. The default order is To do, In progress, then Done, newest update first inside each group.

The list has three states: **To do**, **In progress**, and **Done**. A task records its actual start time on its first move to **In progress**, and its completion time on a move to **Done**. Reopening clears the completion time but keeps the first start time. Tasks that predate this feature have no inferred timestamps. Workspaces come from the Harness workspace list; a task without one belongs to the default workspace (the row titled `default-workspace` or the localized "Default workspace", falling back to the first registered workspace), and filtering by that default workspace also lists tasks with no workspace at all.

Tasks can store an Agent preset, session ID, **Send immediately**, and **Use worktree**. **Send immediately** defaults to off. **Start** on a to-do card creates a session in its linked workspace, puts the task title and description in the conversation draft, binds the new session ID to the task, and moves it to **In progress**. With **Send immediately** on, it submits that draft. A selected Agent preset is applied before the first message. **Use worktree** starts a new checkout and session through `dsh-worktree`; the task keeps its original workspace as the source for the checkout. The edit form warns when the chosen workspace is not a Git repository while still allowing the task to be saved. Starting from a non-Git workspace opens a dialog to choose another workspace or initialize and start. The dialog lists top-level files and folders with Select all and Select none; selected folders contribute their contents to the first commit, and unselected items are added to the root `.gitignore`. The `.gitignore` file is preserved and committed. Separate nested Git repositories cannot be selected. For a parent folder containing multiple repositories, choose a specific Git workspace to keep its files. A task without a linked workspace starts in the default workspace; a workspace id whose registration was deleted reports a failure instead. In-progress cards show **Complete**, which moves the task to **Done**; done cards show a read-only status. Deleting a task deletes its subtasks with it. The task list does not mirror the session-local `todo/write` checklist.

## Development

`src/store.ts` owns validation, schema, search, paging, and SQLite reads/writes. `src/task-service.ts` exposes Host methods over DSH's remote service; `src/client/` registers the sidebar and panel and reads the session catalog for linkable conversations. The database rejects unknown tables or a future schema version rather than overwriting them. Behavior tests use temporary SQLite files.

```powershell
npm run typecheck
npm test
npm run build
```
