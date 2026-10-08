# DSH Task List

English | [中文](<README.zh.md>)

Manage tasks directly in DeepSeek Harness, keeping to-dos, saved messages, and AI conversations in one workflow.

In the plugin list, display names and descriptions follow the Harness language setting in English or Chinese (English is the default fallback); English names use the package name without its npm scope, Chinese names describe the purpose, and installation still uses the unchanged real package name.

## What problem does it solve?

Tasks often live across notes, chat histories, and other tools. Starting work means switching applications, finding context, and copying it into Harness.

This plugin brings task management into Harness:

- **Manage tasks in one place**: use the sidebar's **Task list** to browse To do, In progress, and Done tasks, with workspace filters, search, and paging.
- **Start a conversation from a task**: click **Start** to create a session in the selected workspace with the task content and attachments ready to use. Choose an Agent preset or optionally use a Worktree.
- **Save unsent messages for later**: press `Ctrl+S` (`Cmd+S` on macOS) in the conversation composer to save text, images, and files as a task. It links the current session by default. Successful saves clear the captured input and show a top-of-page notification; failures preserve the input.
- **Keep task context together**: rich text, attachments, priority, tags, story points, session links, and created, started, and completed timestamps. When creating or editing a task, image attachments show thumbnails; click a thumbnail to enlarge it, and close with Escape, the backdrop, or the close button. Downloads remain available for all attachments.


## Screenshot

![Task list in Harness with status and workspace filters, search, and Start/Complete actions](<docs/screenshots/task-list.jpg>)

On desktop, each row shows task content, status, and workspace, with direct **Start** or **Complete** actions. On phones (up to 760px wide), rows keep the description on one line (ellipsis for long text) with the available action on the right; status, workspace, and deletion are hidden. This screenshot comes from actual use; appearance may vary with the installed version.

## Manual Yunxiao / TAPD sync

The task page has one **Sync** execution button. It imports missing remote tasks and compares linked tasks with the last successful snapshots. Remote-only changes pull to local; local-only changes push to remote; when both changed, remote title/description/business fields win while **the entire local status wins and is written back**. Unchanged tasks are skipped. Saving settings, testing a connection, opening the page, and querying results never start a sync.

1. Open the **Connections** tab in Sync settings and add Yunxiao Projex (center) or TAPD. Official authorization is the default; manual API references remain a collapsed alternative. Never enter secret values into task settings.
2. Save and continue sign-in on the official page. Tokens stay in the Host credential provider; Credentials and WebServer services are required, with local Web callbacks currently supported. **The Yunxiao OAuth protocol is implemented, but its Projex REST authentication contract remains unverified; OAuth connections cannot enable task sync. Use the PAT alternative.** TAPD requires an administrator-configured open application ID, secret reference and registered callback. User sign-in is not general project access; application project grants are verified separately. Manual credentials must exist in DSH's startup environment; restart after changes. Read tests do not prove all write permissions.
3. Open **Rules** and follow Project/scope → Status mapping → Confirm. TAPD application mode requires an explicit project ID; candidate loading must succeed before enabling. Map all remote read states and three local write targets, then enable the connection/rule.
4. Click **Sync**. All enabled rules participate, independently of the task-list filters. Already-linked items outside import filters are still checked. Leaving the panel does not stop the Host run; re-entering only queries its latest run.

Source tasks show an independent title, remote identity and last-sync time. An external title is never derived from its description, which may be empty. Start fills the draft with title, a blank line and Markdown body, retaining local attachments. Workspace, Agent, session, immediate-send, Worktree and subtasks remain local. The plugin neither creates remote tasks nor propagates remote deletion.

Results distinguish imported, pulled, pushed, merged, unchanged and failed; pending confirmation is a subset of failed. Incomplete discovery never invents a total or percentage. **Pending does not mean the write failed:** the platform may have accepted it. The next manual sync reconciles read-only and never blindly replays the old transition. Unsupported workflow, permissions, additional assignments or content representation fail closed.

Limits: official public-cloud origins only; Yunxiao region mode is unavailable; TAPD BPM and unsafe transitions are refused conservatively. Remote attachments are not downloaded and local files are not uploaded. Offline adapter/recovery tests exist; **the installed Web settings and callback have been checked; real account sign-in, project permissions and writes are not integration-tested**. See the [capability matrix](docs/sync-capabilities.md).

### Sync troubleshooting

<a id="credentials"></a>**Credentials:** use environment variable names available to the DSH process; never paste secrets into tasks or chat.

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
3. Click **Complete** when finished. You can also change status and choose or clear a linked session in the edit dialog.
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

The default database is `<DSH_HOME>/task-list/tasks.sqlite` (normally `~/.dsh/task-list/tasks.sqlite`). The plugin accepts an optional absolute `file` path in its Cordis configuration. SQLite WAL mode and optimistic row versions protect ordinary concurrent edits. Back up the database using SQLite's backup API or `VACUUM INTO` while DSH is running; when DSH is stopped, copy `tasks.sqlite` and any WAL sidecars together. Existing databases migrate automatically on startup: versions before 3 receive the card fields and launch options, version 3 gains the subtask table; version 4 and earlier migrate to v5 with structured content and attachment storage. Legacy content migrates literally as plain text, without interpreting HTML or changing row versions/timestamps. The sync build advances to schema 9 (v9 adds non-secret authentication configuration; tokens remain in the Host credential provider): connection/rule/snapshot/intent/run tables (v6), singleton lease and reconciliation audit (v7), and run-scoped pending flags (v8). Migration is transactional, preserves content/attachments, and rejects future versions. Restart the Host after upgrading. An old plugin cannot open the migrated database.

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
