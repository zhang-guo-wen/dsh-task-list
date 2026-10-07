# DSH Task List

English | [中文](<README.zh.md>)

Manage tasks directly in DeepSeek Harness, keeping to-dos, saved messages, and AI conversations in one workflow.

## What problem does it solve?

Tasks often live across notes, chat histories, and other tools. Starting work means switching applications, finding context, and copying it into Harness.

This plugin brings task management into Harness:

- **Manage tasks in one place**: use the sidebar's **Task list** to browse To do, In progress, and Done tasks, with workspace filters, search, and paging.
- **Start a conversation from a task**: click **Start** to create a session in the selected workspace with the task content and attachments ready to use. Choose an Agent preset or optionally use a Worktree.
- **Save unsent messages for later**: press `Ctrl+S` (`Cmd+S` on macOS) in the conversation composer to save text, images, and files as a task. It links the current session by default. Successful saves clear the captured input and show a top-of-page notification; failures preserve the input.
- **Keep task context together**: rich text, attachments, priority, tags, story points, session links, and created, started, and completed timestamps.

**Planned integrations**: connect project management tools such as Alibaba Cloud Yunxiao and TAPD to the task workflow in Harness. These integrations and third-party task synchronization are not available in the current version.

## Screenshot

![Task list in Harness with status and workspace filters, search, and Start/Complete actions](<docs/screenshots/task-list.jpg>)

Each row shows task content, status, and workspace, with direct **Start** or **Complete** actions. This screenshot comes from actual use; appearance may vary with the installed version.

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
