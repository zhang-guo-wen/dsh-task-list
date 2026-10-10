# DSH Task List

English | [中文](<README.zh.md>)

Manage tasks directly in DeepSeek Harness, keeping to-dos, saved messages, and AI conversations in one workflow.

In the plugin list, display names and descriptions follow the Harness language setting in English or Chinese (English is the default fallback); English names use the package name without its npm scope, Chinese names describe the purpose, and installation still uses the unchanged real package name.

## What problem does it solve?

Tasks often live across notes, chat histories, and other tools. Starting work means switching applications, finding context, and copying it into Harness.

This plugin brings task management into Harness:

- **Manage tasks in one place**: use the sidebar's **Task list** to browse To do, In progress, and Done tasks, with workspace filters, search, and paging. The header and filters stay at the top, only the middle list scrolls, and the paging bar stays at the bottom.
- **Start a conversation from a task**: click **Start** to create a session in the selected workspace with the task content and attachments ready to use. Choose an Agent preset or optionally use a Worktree.
- **Save unsent messages for later**: press `Ctrl+S` (`Cmd+S` on macOS) in the conversation composer to save text, images, and files as a task. The task always carries the composer's workspace and agent preset; it links the current session once that session has started, and keeps no session link while the session is still a blank New Session. Successful saves clear the captured input and show a top-of-page notification; failures preserve the input.
- **Keep task context together**: rich text, attachments, priority, tags, story points, session links, and created, started, and completed timestamps. When creating or editing a task, image attachments show thumbnails; click a thumbnail to enlarge it, and close with Escape, the backdrop, or the close button. Downloads remain available for all attachments.


## Screenshot

![Task list in Harness with status and workspace filters, search, and Start/Complete actions](<docs/screenshots/task-list.jpg>)

On desktop, each row shows task content, status, and workspace, with direct **Start** or **Complete** actions. On phones (up to 760px wide), rows keep the description on one line (ellipsis for long text) with the available action on the right; status, workspace, and deletion are hidden. This screenshot comes from actual use; appearance may vary with the installed version.

## Manual Yunxiao / TAPD sync (import + status write-back)

The task page has one **Bulk sync** execution entry, and it only runs when you click it: it **discovers matching Yunxiao or TAPD work items and creates a local task for every work item that is not imported yet** — the title is the work item's title and the description is the packed work item (number, status, assignee, creator, timestamps, type, sprint, labels and custom fields, followed by the work item's own body) — remembering **which connection, project and work-item id** it came from. The same work item is never imported twice. **Nothing else is synchronized in either direction**: title, body, priority, tags and story points stay local, and a remote edit never overwrites them.

**The status is the only field written back**: the rule maps to do, in progress and done onto one remote status each, and when a local task's status has changed, the next sync writes it to that work item — no other field is ever written. A status the platform moved, with no local change, is not pulled over your local status.

Sync settings are a **page named "Task sync" in the Host settings panel** (Settings → Task sync), not part of the task list; the list keeps only the execution entry. The list header's right end is one split block: its body opens a new task, its trailing caret opens a menu whose **Bulk sync** row runs the sweep. With no connection configured, it prompts you to add one; with no enabled rules, it prompts you to create and enable a rule in settings, without starting a run. The list shows no standing sync copy.

1. Open the **Connections** tab in **Settings → Task sync** and add one. Choose Yunxiao Projex or TAPD. Yunxiao offers official sign-in (the default) or a personal access token; TAPD uses only a personal access token with the Bearer header. Yunxiao official sign-in **does not need a saved connection first** — clicking *Sign in and authorize Yunxiao* stores the draft and opens the official page, and on return the organization dropdown lists the organizations you belong to; pick one and save.
2. You can also type a **personal access token** right there. It is stored in the DSH Host credential store — **never in the task database, never read back** — so no environment variable is needed (env vars remain a compatibility fallback). The connection name is derived from the platform and resource, so there is nothing to name. Each roster row carries its own enable **switch**; the rule rows do too.
3. The organization/company dropdown reads the chosen platform with the entered token. Yunxiao uses `x-yunxiao-token`; TAPD lists organizations available to the Bearer-token account. Errors are shown rather than silently substituting an ID.
4. Open **Rules** and follow Project/scope → Query → Status write-back. Choosing a connection **loads its projects into the picker and preselects the first one** — there is no separate "load candidates" button; the preselected project and each later selection automatically load its members, iterations, types and statuses.
5. **Query** uses the platform's supported filter fields: status, assignee, creator, priority, sprint, type and created (date range); status stage is Yunxiao-only. Conditions are combined with AND and the values inside one condition with OR; **an empty query imports every work item in the project**. Yunxiao runs the query remotely. TAPD reads its category collections and checks supported conditions locally because its collection endpoints cannot safely express every AND/OR group; unsupported filters fail closed.
6. **Status write-back** maps to do, in progress and done onto one remote status each (all three are required). The editor carries neither a workspace nor an enable switch: **a new rule is saved disabled**, and you turn it on with the switch on its row in the rule list — only then does Sync run it. Rule rows show the **project name**, captured with the rule so no platform request is needed (rows saved earlier show the id until saved again).
7. Back on the task page, click **Bulk sync** in the header's trailing menu. All enabled rules participate, independently of the task-list filters. Already-imported items outside the query are still checked for a status write-back. Leaving the panel does not stop the Host run; re-entering only queries its latest run. The task page shows a dismissible summary rather than a list of work-item IDs; dismissing it neither stops the run nor undoes imported tasks.

Imported tasks show an independent title, remote identity and last-sync time. Start fills the draft with title, a blank line and Markdown body, retaining local attachments. Workspace, Agent, session, immediate-send, Worktree and subtasks remain local. The plugin **never creates remote tasks** and does not propagate remote deletion.

Results distinguish imported, pushed, unchanged and failed; pending confirmation is a subset of failed. Incomplete discovery never invents a total or percentage. **Pending does not mean the write failed:** the platform may have accepted it. The next manual sync reconciles read-only and never blindly replays the old transition. Unsupported workflow, permissions or required fields fail closed.

Limits: official public-cloud origins only; Yunxiao region mode is unavailable; TAPD uses personal access tokens only, and status write-back requires the token's update permission and a verified safe workflow transition. Remote attachments are not downloaded and local files are not uploaded. Offline adapter/recovery tests exist; **fixture tests pass, but the restored TAPD UI/sync and actual project write permissions have not been verified end to end in a live account**. See the [capability matrix](docs/sync-capabilities.md).

## More tasks (paged Yunxiao / TAPD work items)

**More tasks**, next to the report button in the task page header, opens a read-only page; **Close** in its top-right returns to the list. The title row carries the **connection and project** selectors. Requirements, defects and tasks are listed **together** — there is no category filter. A **gear icon at the right edge of the table head** opens a right-hand drawer that lists **every field this project configures**, grouped into shown and hidden — custom fields such as priority, story points and 所属模块 appear under the platform's own names, with a search box and a switch per field. The table scrolls in the middle and the **paging bar stays pinned at the bottom** (previous/next plus 20/50/100/200 per page).

The list projects **only the shown columns** locally; TAPD also asks for the supported collection fields needed to decode the row. Description, comments, relations and activity belong to separate detail reads. A page holds at most 200 rows, and `page × perPage` may not exceed 10000; an out-of-range window is refused before any request. Yunxiao exposes no readable path for images embedded in a work item body, so those stay invisible here.

The filter bar is **one title search plus at most two conditions**, with status, assignee, creator, priority, sprint, type and created (date range); status stage is available on Yunxiao only. TAPD rejects filters its endpoints cannot safely express rather than returning a wider result. Candidate values come from the platform itself (status from the workflow, people from project members, priority from the field config, sprint from the project's iterations). The title search and every condition apply together (AND); a blank condition value is simply left out. Yunxiao's "participants" filter answers zero results silently, so it is not offered.

Every row carries **Sync**: it closes this page and opens the **new task** form prefilled with the work item, leaving the save to you. **Clicking a row title** opens a read-only drawer on the right with the row's visible fields and the **work item body**; the body is rendered from the plugin's own structured form — platform HTML is never injected — an empty body says so, and images inside it cannot be displayed. Which data is copied is chosen in the **connection editor** under "Prefill a new task with" and **saved per connection**, with **each platform offering its own fields**: 云效 has title, description, number, status, assignee, sprint, priority, custom fields and source number; TAPD has title, description, number, status, assignee, sprint, priority, tags and creator (the list follows the platform selector, and a field the chosen platform cannot carry is dropped). Only the description costs an extra detail request, and only when its box is checked — every other field comes from the list itself.

### Sync troubleshooting

<a id="credentials"></a>**Credentials:** enter manual credentials in the connection settings; environment variable references remain an alternative. Never paste secrets into tasks or chat. If startup reports an unknown `secret` record kind for `task-list/connection-…-secret`, back up `~/.dsh/.credentials.yaml` and change only those records' `kind` to `grant`, preserving their keys and payloads, then rebuild/upgrade this plugin and restart DSH.

<a id="permissions"></a>**Permissions:** ask the platform administrator to check API entitlement, authentication and workflow privileges. Read-only success does not imply write permission.

<a id="mapping"></a>**Mapping:** select metadata candidates and complete both read mappings and write targets. Incompatible mappings keep local tasks and report an error.

<a id="content"></a>**Content:** only round-trippable representations are synchronized; unsupported structures or field limits never silently downgrade content.

<a id="network"></a>**Network:** reads use bounded retries/timeouts; each write is attempted once. Rate limits or connection failures may leave an uncertain write.

<a id="recovery"></a>**Recovery:** do not delete pending evidence or replay old transitions. The next manual sync reads back first; unresolved effects stay pending.

<a id="host-upgrade"></a>**Host upgrade:** missing new RPC methods require plugin reload or Host restart. Rebuilding the browser bundle alone does not replace Host code.

## Requirements

## Installation

### Requirements

- DeepSeek Harness **0.2.0-rc.1 or newer**, with the Web workspace controller.
- Install into the **`web` profile** running the Web interface.
- Node.js **`^22.19.0` or `>=24.0.0`** (uses built-in `node:sqlite`).
- Only when **Use worktree** is enabled: **`@guowenzhang/dsh-worktree` 1.x or 2.x**, installed and enabled in the same profile.

### Install from npm

Using your installed Harness CLI:

```sh
dsh plugin --profile web add @guowenzhang/dsh-task-list
```

Package: [@guowenzhang/dsh-task-list](https://www.npmjs.com/package/@guowenzhang/dsh-task-list).

Restart the corresponding Harness host and refresh the page, then select **Task list** in the sidebar. If your Web interface runs under another profile, replace `web` with that profile's name.

### Quick start

1. Click **New task**, enter the content, optionally choose a workspace, Agent, and launch options, then save. The title is generated from the content; no separate title is required.
2. Click **Start** to create a conversation. By default, content and attachments are placed in the composer for review; they are submitted automatically only when **Send immediately** is enabled.
3. Click **Complete** when finished. You can also change status and choose or clear a linked session in the edit dialog. The session picker lists only the sessions the sidebar shows: archived sessions, subagent runs, and unused new-session placeholders are left out. When a task's existing link has been hidden (archived, for example), that session is still echoed with an **Archived** marker so you can keep or replace it.
4. Save messages you are not ready to send with `Ctrl+S` / `Cmd+S` in the conversation composer.

### Statistics report

The report button is hidden on phones (viewport width up to 760px); it remains available on wider screens.

Click **Statistics report** next to **New task** to open a separate report page. **Close** returns to the task list with filters, search, and paging preserved. Choose **Day**, **Month**, or **Year** and a date, then click **Calculate statistics**. Compact fixed heatmaps show hours in **6 columns × 4 rows**, days in **7 columns × 5 rows**, or months in **3 columns × 4 rows**. Month cells run sequentially from day 1, without weekday alignment; unused slots remain blank. Switch **New sessions**, **User sends**, and **Tokens consumed** to compare values and intensity; hover or focus a cell to see all three counts.

- Calculation is button-triggered only. Opening reports, changing the period, date or metric, and refreshing tasks never calculate statistics. Results remain a snapshot until the next click; changing the period or date clears the displayed snapshot.
- Uses the browser's local time zone. The current hour and future hours are excluded, not shown as zero. The snapshot displays its calculation time and exclusive cutoff.
- Statistics cover the host's complete available session corpus, independently of task filters and session links. New sessions include subagent sessions. User sends count admitted human messages, not queued/rejected drafts, injected context, automatic goal rounds, or initial agent delegations.
- Tokens use reported model usage, including input, output, cache, retries, subagent calls, and recorded compaction usage. Reasoning tokens are not added twice, and fork-inherited history is not counted again. Missing usage is indicated; background calls without session usage records are outside the scope. Deleted/unavailable logs cannot be reconstructed.
- Requires the host's `sessionQuery` service (`listSessions` / `readSession`). Read failures are surfaced rather than silently producing partial zero totals. Host code changes require plugin reload or host restart.

### Local development installation

Run from this repository:

```sh
npm ci
npm run typecheck
npm test
npm run build
dsh plugin --profile web add 'link:/absolute/path/to/dsh-task-list'
```

Replace the link with your local absolute path; on Windows, for example, `link:C:/path/to/dsh-task-list`. Rebuild and refresh after changes; host changes also require plugin reload or host restart. Maintainer notes are in [AGENTS.md](https://github.com/zhang-guo-wen/dsh-task-list/blob/main/AGENTS.md).

## Important notes

The default database is `<DSH_HOME>/task-list/tasks.sqlite` (normally `~/.dsh/task-list/tasks.sqlite`). The plugin accepts an optional absolute `file` path in its Cordis configuration. SQLite WAL mode and optimistic row versions protect ordinary concurrent edits. Back up the database using SQLite's backup API or `VACUUM INTO` while DSH is running; when DSH is stopped, copy `tasks.sqlite` and any WAL sidecars together. Existing databases migrate automatically on startup: versions before 3 receive the card fields and launch options, version 3 gains the subtask table; version 4 and earlier migrate to v5 with structured content and attachment storage. Legacy content migrates literally as plain text, without interpreting HTML or changing row versions/timestamps. The sync build advances to schema 10 (v9 adds non-secret authentication configuration; tokens remain in the Host credential provider; v10 adds the rule's `project_name` display column): connection/rule/snapshot/intent/run tables (v6), singleton lease and reconciliation audit (v7), and run-scoped pending flags (v8). Migration is transactional, preserves content/attachments, and rejects future versions. Restart the Host after upgrading. An old plugin cannot open the migrated database.

- **Local storage**: tasks and attachments use the plugin's own SQLite database at `<DSH_HOME>/task-list/tasks.sqlite` (normally `~/.dsh/task-list/tasks.sqlite`). The plugin does not directly modify Harness session logs or query indexes, nor automatically synchronize the session-local `todo/write` checklist. Set an absolute `file` path in the Cordis configuration to use a different location.
- **Back up before upgrading**: databases migrate automatically and cannot be reopened by an older plugin after migration. While DSH is running, use SQLite's backup API or `VACUUM INTO`; when stopped, copy the database and any WAL sidecars together. Restart the host after upgrading to avoid rich-text or attachment save failures caused by stale code.
- **Attachment limits**: up to 8 files, 10 MiB per file, and 20 MiB total. Deleting a task also deletes its attachments and subtask data. Historical attachments with only a filename and no saved bytes must be added again.
- **Rich text is not full Office import**: pasted web or Word content can retain common formatting, links, and tables, but not full fonts, colors, or page layout. Images referenced by external URLs or Word-local paths are not downloaded automatically; add them manually. Document attachments are not automatically parsed into the body.
- **Start creates a new session**: it links that session and moves the task to In progress. Starting an in-progress or completed task again from the edit dialog also creates a new session and replaces the link. **Send immediately** defaults to off. Tasks without a workspace use the default workspace; deleted workspaces must be replaced.
- **Worktree performs Git operations**: it requires the Worktree plugin and a Git workspace. For a non-Git folder, a dialog offers another workspace or confirmation to **initialize and start**. The latter creates a Git repository and initial commit, adding unselected items to the root `.gitignore`. For a parent folder containing multiple repositories, choose a specific repository instead. Confirm the path and file selection before proceeding.
- **Subtask UI is temporarily unavailable**: existing subtask data is retained, but subtasks cannot currently be viewed or edited in the list or dialog.
- **Uninstalling keeps task data**: the following command removes the plugin but leaves its database in place.

```sh
dsh plugin --profile web remove @guowenzhang/dsh-task-list
```

## License

This plugin is licensed under **Apache License 2.0**. See [LICENSE](<LICENSE>).

The browser bundle includes Lexical under the MIT license. See [THIRD_PARTY_NOTICES.md](<THIRD_PARTY_NOTICES.md>) for third-party notices.
