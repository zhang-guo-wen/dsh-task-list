window.__ModuleLoader__.load({
	id: "@guowenzhang/dsh-task-list",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/remote.ts
		const REMOTE_NAMESPACE = "taskList";
		const passthrough = { parse: (value) => value };
		function codec(typeSymbol) {
			return {
				mode: "strict",
				typeSymbol,
				schema: passthrough,
				create: () => passthrough
			};
		}
		function descriptor(method) {
			const owner = `@guowenzhang/dsh-task-list#${REMOTE_NAMESPACE}/${method}`;
			return {
				id: owner,
				service: REMOTE_NAMESPACE,
				namespace: REMOTE_NAMESPACE,
				method,
				invocation: { kind: "direct" },
				parameters: [{
					name: "request",
					wire: "request",
					source: "json",
					codec: codec(`${owner}:request`)
				}],
				result: codec(`${owner}:result`)
			};
		}
		const TYPERT_REMOTE = {
			package: "@guowenzhang/dsh-task-list",
			descriptors: [
				"listTasks",
				"createTask",
				"updateTask",
				"deleteTask",
				"createSubtask",
				"updateSubtask",
				"deleteSubtask"
			].map(descriptor)
		};
		//#endregion
		//#region src/client/locales.ts
		const NS = "taskList";
		const zh = {
			nav: "任务列表",
			title: "任务列表",
			subtitle: "把要做的事放在这里，随时跟进。",
			add: "新建任务",
			notesLabel: "内容（必填）",
			notesHint: "内容的前 50 个字会成为任务标题",
			save: "保存",
			cancel: "取消",
			todo: "待办",
			inProgress: "进行中",
			done: "已完成",
			all: "全部",
			status: "状态",
			priorityLabel: "优先级",
			low: "低",
			medium: "普通",
			high: "高",
			urgent: "紧急",
			storyPoints: "故事点",
			pointsShort: "点",
			tags: "标签",
			tagsHint: "用逗号分隔标签",
			workspace: "工作区",
			allWorkspaces: "全部工作区",
			noWorkspace: "未关联工作区",
			defaultWorkspaceName: "默认工作区",
			createdAt: "创建时间",
			startedAt: "开始时间",
			completedAt: "完成时间",
			notStarted: "未开始",
			notCompleted: "未完成",
			sendImmediately: "立即发送",
			sessionId: "会话 ID",
			sessionIdHint: "启动后自动绑定",
			sessionIdLocked: "会话 ID 由启动时自动绑定，不能修改",
			sessionUnbound: "未绑定",
			agent: "Agent",
			defaultAgent: "默认 Agent",
			useWorktree: "使用 Worktree",
			worktreeRequiresGit: "Worktree 需要 Git 仓库，请选择 Git 工作区或关闭“使用 Worktree”",
			worktreeNeedsInit: "该工作区尚未初始化 Git。保存任务后点击“启动”，可确认初始化并创建 Worktree。",
			gitUnavailable: "未找到 Git。请安装 Git，确保 DSH 启动环境的 PATH 包含 Git，然后重启 DSH。",
			worktreeChecking: "正在检查工作区是否支持 Worktree…",
			worktreeAvailable: "该工作区支持 Worktree",
			initializeGitTitle: "初始化 Git 仓库？",
			initializeGitIntro: "这个工作区还不是 Git 仓库：",
			initialCommitEntries: "首次提交的文件和目录",
			selectAll: "全选",
			selectNone: "全不选",
			initialEntriesLoading: "正在读取首层文件…",
			initialEntriesEmpty: "没有可选择的首层文件",
			initialFile: "文件",
			initialDirectory: "目录",
			initialNestedRepository: "独立 Git 仓库，不可勾选",
			initializeGitWarning: "勾选的文件及目录内容会进入首次提交；未勾选项会加入根目录 .gitignore。现有 .gitignore 会保留并提交。空目录无法由 Git 跟踪。",
			changeWorkspace: "更换工作区",
			initializeAndStart: "初始化并启动",
			empty: "还没有任务",
			emptyHint: "创建第一个任务，开始整理工作。",
			emptySearch: "没有匹配的任务",
			emptySearchHint: "换个关键词，或清空搜索后重试。",
			start: "启动",
			finish: "完成",
			startRequiresWorkspace: "请先为任务选择工作区",
			startWorkspaceMissing: "关联的工作区已不存在",
			edit: "编辑",
			remove: "删除",
			refresh: "刷新",
			loading: "加载中…",
			error: "操作失败",
			retry: "重试",
			search: "搜索",
			searchPlaceholder: "搜索任务内容、子任务或会话 ID",
			clearSearch: "清空",
			perPage: "每页",
			prevPage: "上一页",
			nextPage: "下一页",
			pageSummary: "第 {page}/{pages} 页 · 共 {total} 条",
			subtasks: "子任务",
			addSubtask: "添加子任务",
			subtasksEmpty: "还没有子任务",
			subtaskHint: "子任务内容，例如：确认接口字段",
			noSession: "不关联会话",
			openSession: "打开会话",
			subtaskSession: "关联会话",
			restore: "恢复",
			captureTask: "存为任务",
			captureHint: "Ctrl+S：把输入框内容创建成任务，并清空输入框",
			captureCreated: "已创建任务：{title}",
			captureEmpty: "输入框没有内容",
			captureFailed: "创建任务失败"
		};
		const en = {
			nav: "Tasks",
			title: "Task list",
			subtitle: "Keep work in one place and track its progress.",
			add: "New task",
			notesLabel: "Content (required)",
			notesHint: "The first 50 characters become the task title",
			save: "Save",
			cancel: "Cancel",
			todo: "To do",
			inProgress: "In progress",
			done: "Done",
			all: "All",
			status: "Status",
			priorityLabel: "Priority",
			low: "Low",
			medium: "Medium",
			high: "High",
			urgent: "Urgent",
			storyPoints: "Story points",
			pointsShort: "SP",
			tags: "Tags",
			tagsHint: "Separate tags with commas",
			workspace: "Workspace",
			allWorkspaces: "All workspaces",
			noWorkspace: "No workspace",
			defaultWorkspaceName: "Default workspace",
			createdAt: "Created",
			startedAt: "Started",
			completedAt: "Completed",
			notStarted: "Not started",
			notCompleted: "Not completed",
			sendImmediately: "Send immediately",
			sessionId: "Session ID",
			sessionIdHint: "Bound automatically on start",
			sessionIdLocked: "The session ID is bound automatically when the task starts and cannot be edited",
			sessionUnbound: "Not bound",
			agent: "Agent",
			defaultAgent: "Default agent",
			useWorktree: "Use worktree",
			worktreeRequiresGit: "Worktree requires a Git repository. Choose a Git workspace or turn off Use worktree",
			worktreeNeedsInit: "This workspace has no Git repository. Save the task, then select Start to confirm initialization and create the worktree.",
			gitUnavailable: "Git was not found. Install Git, add it to the DSH host PATH, then restart DSH.",
			worktreeChecking: "Checking worktree support for this workspace…",
			worktreeAvailable: "This workspace supports worktrees",
			initializeGitTitle: "Initialize a Git repository?",
			initializeGitIntro: "This workspace is not a Git repository:",
			initialCommitEntries: "Files and folders for the first commit",
			selectAll: "Select all",
			selectNone: "Select none",
			initialEntriesLoading: "Loading top-level files…",
			initialEntriesEmpty: "No top-level files to select",
			initialFile: "File",
			initialDirectory: "Folder",
			initialNestedRepository: "Separate Git repository; cannot select",
			initializeGitWarning: "Selected files and folder contents enter the first commit. Unselected items are added to the root .gitignore. An existing .gitignore is preserved and committed. Git cannot track empty folders.",
			changeWorkspace: "Change workspace",
			initializeAndStart: "Initialize and start",
			empty: "No tasks yet",
			emptyHint: "Create your first task to get started.",
			emptySearch: "No matching tasks",
			emptySearchHint: "Try another phrase, or clear the search.",
			start: "Start",
			finish: "Complete",
			startRequiresWorkspace: "Choose a workspace for this task first",
			startWorkspaceMissing: "The linked workspace is no longer available",
			edit: "Edit",
			remove: "Delete",
			refresh: "Refresh",
			loading: "Loading…",
			error: "Action failed",
			retry: "Retry",
			search: "Search",
			searchPlaceholder: "Search content, subtasks, or a session ID",
			clearSearch: "Clear",
			perPage: "Per page",
			prevPage: "Previous",
			nextPage: "Next",
			pageSummary: "Page {page}/{pages} · {total} tasks",
			subtasks: "Subtasks",
			addSubtask: "Add subtask",
			subtasksEmpty: "No subtasks yet",
			subtaskHint: "Subtask content, for example: confirm the API fields",
			noSession: "No session",
			openSession: "Open session",
			subtaskSession: "Linked session",
			restore: "Restore",
			captureTask: "Save as task",
			captureHint: "Ctrl+S: create a task from the composer draft and clear the composer",
			captureCreated: "Task created: {title}",
			captureEmpty: "The composer is empty",
			captureFailed: "Could not create the task"
		};
		/**
		* Resolve the stored title for a task.
		* An explicit title wins; otherwise the trimmed description collapses every
		* whitespace run and contributes its first {@link DERIVED_TITLE_LENGTH}
		* characters. Returns an empty string when both inputs are blank.
		* @param title - text the user typed in the title field.
		* @param notes - task description.
		* @returns title to persist.
		*/
		function deriveTaskTitle(title, notes) {
			const explicit = title.trim();
			if (explicit) return explicit;
			const collapsed = notes.trim().replace(/\s+/gu, " ");
			return Array.from(collapsed).slice(0, 50).join("").trim();
		}
		function titled(items, title) {
			return items.find((item) => String(item.title ?? "").trim() === title);
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
		function pickDefaultWorkspace(items, localizedDefault) {
			return titled(items, "default-workspace") ?? titled(items, localizedDefault) ?? items[0];
		}
		//#endregion
		//#region \0dsh-css:C:\02-codespace\DeepSeek\dsh-task-list\src\client\TaskPanel.module.css.mjs
		const css$1 = ".yCgN3W_page{scrollbar-gutter:stable;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-bg-base,#fff);font-family:var(--dsw-font-family,system-ui, sans-serif);font-size:14px;line-height:1.6;overflow:auto}.yCgN3W_inner{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}.yCgN3W_header{justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px;padding-top:28px;display:flex}.yCgN3W_header h1{flex:1;min-width:0;margin:0;font-size:20px;font-weight:500;line-height:28px}.yCgN3W_primary,.yCgN3W_filter,.yCgN3W_selected,.yCgN3W_textButton,.yCgN3W_rowActions button,.yCgN3W_dialogActions button,.yCgN3W_searchButton,.yCgN3W_headerAction{font:inherit;cursor:pointer}.yCgN3W_primary{background:var(--dsw-alias-label-primary,#0f1115);height:32px;color:var(--dsw-alias-bg-base,#fff);white-space:nowrap;border:0;border-radius:16px;padding:0 12px;font-size:13px;line-height:20px}.yCgN3W_primary:hover{opacity:.86}.yCgN3W_toolbar{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 16px;display:flex}.yCgN3W_filters{flex-wrap:wrap;align-items:center;gap:8px 12px;display:flex}.yCgN3W_filter,.yCgN3W_selected{height:28px;color:var(--dsw-alias-label-tertiary,#81858c);white-space:nowrap;background:0 0;border:0;border-radius:14px;align-items:center;padding:0 10px;font-size:14px;line-height:22px;display:inline-flex}.yCgN3W_filter:hover,.yCgN3W_selected{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.yCgN3W_selected{color:var(--dsw-alias-label-primary,#0f1115)}.yCgN3W_toolbarRight{flex-wrap:wrap;align-items:center;gap:8px;margin-left:auto;display:flex}.yCgN3W_toolbar select,.yCgN3W_dialog select{font:inherit;border:1px solid var(--dsw-alias-border-l3,#ddd);height:36px;color:inherit;background:var(--dsw-alias-bg-base,#fff);border-radius:12px;padding:0 10px}.yCgN3W_toolbar select{flex:none;width:auto;min-width:150px;max-width:240px}.yCgN3W_toolbar select:hover,.yCgN3W_dialog select:hover{border-color:var(--dsw-alias-border-l2,#b8bbc0)}.yCgN3W_toolbar select:focus-visible,.yCgN3W_dialog select:focus-visible{outline-color:var(--dsw-alias-state-business-primary,#326dca)}.yCgN3W_searchBox{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-base,#fff);border-radius:12px;flex:none;align-items:center;gap:6px;height:36px;padding:0 4px 0 10px;display:flex}.yCgN3W_searchBox:focus-within{border-color:var(--dsw-alias-state-business-primary,#326dca)}.yCgN3W_searchBox input{width:clamp(140px,22vw,260px);min-width:0;color:inherit;font:inherit;background:0 0;border:0;outline:none;padding:0;font-size:13px}.yCgN3W_searchBox input::placeholder{color:var(--dsw-alias-label-tertiary,#81858c)}.yCgN3W_searchClear{width:20px;height:20px;color:var(--dsw-alias-label-tertiary,#81858c);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;padding:0;font-size:16px;line-height:1}.yCgN3W_searchClear:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.yCgN3W_searchButton{background:var(--dsw-alias-label-primary,#0f1115);height:28px;color:var(--dsw-alias-bg-base,#fff);white-space:nowrap;border:0;border-radius:14px;flex:none;padding:0 12px;font-size:13px}.yCgN3W_searchButton:hover:not(:disabled){opacity:.86}.yCgN3W_textButton,.yCgN3W_dialogActions button{border:1px solid var(--dsw-alias-border-l3,#ddd);color:inherit;background:0 0}.yCgN3W_textButton{border-radius:12px;height:36px;padding:0 12px;font-size:13px}.yCgN3W_textButton:hover,.yCgN3W_dialogActions button:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.yCgN3W_list{flex-direction:column;gap:10px;margin:18px 0 0;padding:0;list-style:none;display:flex}.yCgN3W_row{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#ddd);border-left:4px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-base,#fff);border-radius:12px;flex-direction:column;gap:8px;padding:12px 14px 12px 16px;transition:border-color .18s,box-shadow .18s;display:flex;box-shadow:0 2px 8px #0000000a}.yCgN3W_row:hover,.yCgN3W_row:focus-within{box-shadow:0 6px 18px #00000014}.yCgN3W_row[data-priority=low]{border-left-color:#8293a4}.yCgN3W_row[data-priority=medium]{border-left-color:#4b87bd}.yCgN3W_row[data-priority=high]{border-left-color:#dd9230}.yCgN3W_row[data-priority=urgent]{border-left-color:#d64e4e}.yCgN3W_row[data-status=done] .yCgN3W_content{color:var(--dsw-alias-label-tertiary,#81858c)}.yCgN3W_row[data-status=done] .yCgN3W_workspaceMeta{color:var(--dsw-alias-label-caption,#a8abb0)}.yCgN3W_row[data-status=done]:is(:hover,:focus-within) .yCgN3W_content{color:inherit}.yCgN3W_row[data-status=done]:is(:hover,:focus-within) .yCgN3W_workspaceMeta{color:var(--dsw-alias-label-tertiary,#81858c)}.yCgN3W_rowLine{grid-template-columns:minmax(0,1fr) 72px 128px auto;align-items:center;gap:12px;display:grid}.yCgN3W_content{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;padding:0;font-size:14px;line-height:22px;overflow:hidden}.yCgN3W_content:hover{text-decoration:underline}.yCgN3W_content:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#326dca);outline-offset:2px;border-radius:4px}.yCgN3W_statusChip{box-sizing:border-box;text-overflow:ellipsis;white-space:nowrap;background:var(--dsw-alias-interactive-bg-hover,#2631480f);height:22px;color:var(--dsw-alias-label-tertiary,#81858c);border-radius:11px;justify-content:center;align-items:center;padding:0 8px;font-size:12px;line-height:1;display:inline-flex;overflow:hidden}.yCgN3W_statusChip[data-status=in_progress]{color:#2f6fbd;background:#e8f1fd}.yCgN3W_statusChip[data-status=done]{color:#3f7d4f;background:#e8f5ea}.yCgN3W_workspaceMeta{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary,#81858c);font-size:12px;overflow:hidden}.yCgN3W_rowActions{align-items:center;gap:8px;display:flex}.yCgN3W_rowActions .yCgN3W_start{background:var(--dsw-alias-button-primary-fill,#0f1115);min-height:30px;color:var(--dsw-alias-label-primary-foreground,#fff);white-space:nowrap;border:0;border-radius:15px;flex:none;padding:5px 16px;font-size:13px;font-weight:500;transition:background .15s,opacity .15s}.yCgN3W_rowActions .yCgN3W_start:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#252b35)}.yCgN3W_delete{width:28px;height:28px;color:var(--dsw-alias-label-tertiary,#81858c);font:inherit;cursor:pointer;opacity:0;pointer-events:none;background:0 0;border:0;border-radius:6px;flex:none;padding:0;font-size:20px;line-height:1;transition:opacity .15s}.yCgN3W_row:hover .yCgN3W_delete,.yCgN3W_row:focus-within .yCgN3W_delete{opacity:1;pointer-events:auto}.yCgN3W_delete:hover,.yCgN3W_delete:focus-visible{color:#b74242;background:#f8dede}.yCgN3W_doneState{background:var(--dsw-alias-interactive-bg-hover,#2631480f);color:var(--dsw-alias-label-tertiary,#81858c);border-radius:14px;flex:none;padding:4px 10px;font-size:12px}.yCgN3W_placeholder{color:var(--dsw-alias-label-tertiary,#81858c);padding:28px 4px}.yCgN3W_empty{color:var(--dsw-alias-label-tertiary,#81858c);flex-direction:column;align-items:center;gap:8px;padding:48px 20px;display:flex}.yCgN3W_empty strong{color:var(--dsw-alias-label-primary,#0f1115)}.yCgN3W_pager{flex-wrap:wrap;align-items:center;gap:12px;margin-top:16px;display:flex}.yCgN3W_pageSize{color:var(--dsw-alias-label-tertiary,#81858c);align-items:center;gap:8px;font-size:13px;display:flex}.yCgN3W_pageSize select{font:inherit;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-base,#fff);height:32px;color:inherit;border-radius:10px;padding:0 8px}.yCgN3W_pageSummary{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary,#81858c);flex:1;font-size:13px;overflow:hidden}.yCgN3W_pageButtons{gap:8px;display:flex}.yCgN3W_error{color:#a32929;background:#fff0f0;border-radius:8px;margin-top:16px;padding:12px}.yCgN3W_error button{cursor:pointer;color:inherit;background:0 0;border:0;text-decoration:underline}.yCgN3W_backdrop{z-index:1000;background:#0008;place-items:center;padding:20px;display:grid;position:fixed;inset:0}.yCgN3W_dialog{box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);width:min(100%,620px);max-height:90vh;color:var(--dsw-alias-label-primary,#0f1115);border-radius:12px;padding:20px 24px;overflow:auto;box-shadow:0 18px 54px #0003}.yCgN3W_dialog h2{margin:0 0 16px;font-size:20px}.yCgN3W_dialogHeader{justify-content:space-between;align-items:center;gap:12px;padding:20px 24px 0;display:flex}.yCgN3W_dialogHeader h2{flex:1;min-width:0;margin:0}.yCgN3W_headerActions{flex:none;align-items:center;gap:8px;display:flex}.yCgN3W_headerAction{background:var(--dsw-alias-button-primary-fill,#0f1115);min-height:30px;color:var(--dsw-alias-label-primary-foreground,#fff);white-space:nowrap;border:0;border-radius:15px;flex:none;padding:5px 16px;font-size:13px;font-weight:500}.yCgN3W_headerAction:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#252b35)}.yCgN3W_dialogError{color:#a32929;background:#fff0f0;border-radius:8px;margin:0 0 12px;padding:10px 12px;font-size:13px}.yCgN3W_dialogFixed{grid-template-rows:auto minmax(0,1fr) auto;grid-template-columns:minmax(0,1fr);height:min(640px,88vh);max-height:88vh;padding:0;display:grid;overflow:hidden}.yCgN3W_dialogBody{min-height:0;padding:16px 24px 20px;overflow:auto}.yCgN3W_dialogFooter{border-top:1px solid var(--dsw-alias-border-l2,#eee);background:var(--dsw-alias-bg-base,#fff);justify-content:flex-end;gap:8px;padding:12px 24px 16px;display:flex}.yCgN3W_dialog form{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:12px 16px;display:grid}.yCgN3W_fullRow{grid-column:1/-1}.yCgN3W_dialog label{min-width:0;color:var(--dsw-alias-label-secondary,#5b6068);flex-direction:column;gap:8px;font-size:13px;display:flex}.yCgN3W_dialog input,.yCgN3W_dialog textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#ddd);width:100%;color:inherit;font:inherit;background:0 0;border-radius:8px;padding:10px}.yCgN3W_dialog textarea{resize:vertical;min-height:96px}.yCgN3W_fixedValue{box-sizing:border-box;background:var(--dsw-alias-interactive-bg-hover,#2631480f);min-height:36px;color:var(--dsw-alias-label-tertiary,#81858c);text-overflow:ellipsis;white-space:nowrap;border-radius:8px;align-items:center;padding:8px 10px;font-size:13px;display:flex;overflow:hidden}.yCgN3W_dialog select{width:100%}.yCgN3W_dialog .yCgN3W_toggle{cursor:pointer;flex-direction:row;align-items:center;gap:8px;display:flex}.yCgN3W_dialog .yCgN3W_toggle input{width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary,#326dca);margin:0;padding:0}.yCgN3W_fieldHint{color:var(--dsw-alias-label-tertiary,#81858c);margin:-6px 0 0;font-size:12px}.yCgN3W_fieldBlock{flex-direction:column;gap:8px;min-width:0;display:flex}.yCgN3W_fieldBlock .yCgN3W_fieldHint{margin:0}.yCgN3W_worktreeHint{color:var(--dsw-alias-label-tertiary,#81858c);margin:-4px 0 0;font-size:12px}.yCgN3W_worktreeError{color:#a32929}.yCgN3W_toggleRow{flex-wrap:wrap;align-items:center;gap:8px 24px;display:flex}.yCgN3W_metaSection{border-top:1px solid var(--dsw-alias-border-l2,#eee);grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:12px 16px;margin-top:4px;padding-top:14px;display:grid}.yCgN3W_initPath{overflow-wrap:anywhere;background:var(--dsw-alias-interactive-bg-hover,#2631480f);border-radius:8px;padding:8px 10px;font-size:12px}.yCgN3W_initToolbar{align-items:center;gap:8px;margin-top:16px;font-size:13px;display:flex}.yCgN3W_initToolbar strong{flex:1;font-weight:500}.yCgN3W_initToolbar button,.yCgN3W_initError button{color:var(--dsw-alias-state-business-primary,#326dca);font:inherit;cursor:pointer;background:0 0;border:0}.yCgN3W_initToolbar button:disabled{opacity:.5;cursor:default}.yCgN3W_initEntries{border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:8px;max-height:240px;margin:8px 0;padding:0;list-style:none;overflow:auto}.yCgN3W_initEntries li+li{border-top:1px solid var(--dsw-alias-border-l2,#eee)}.yCgN3W_initEntries label{cursor:pointer;flex-direction:row;align-items:center;gap:8px;min-width:0;padding:8px 10px;display:flex}.yCgN3W_initEntries input{width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary,#326dca);flex:none;margin:0;padding:0}.yCgN3W_initEntries input:disabled{cursor:default}.yCgN3W_initEntryName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13px;overflow:hidden}.yCgN3W_initEntries small{color:var(--dsw-alias-label-tertiary,#81858c);white-space:nowrap;font-size:11px}.yCgN3W_initLoading,.yCgN3W_initError{color:var(--dsw-alias-label-tertiary,#81858c);margin:8px 0;font-size:12px}.yCgN3W_initError{color:var(--dsw-alias-label-error,#a32929)}.yCgN3W_initWarning{color:var(--dsw-alias-label-tertiary,#81858c);font-size:13px}.yCgN3W_dialogActions{justify-content:flex-end;gap:8px;display:flex}.yCgN3W_dialogActions button{border-radius:16px;height:32px;padding:0 12px;font-size:13px}.yCgN3W_dialogActions .yCgN3W_primary{background:var(--dsw-alias-label-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff);border:0}.yCgN3W_dialogActions .yCgN3W_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#252b35);color:var(--dsw-alias-label-primary-foreground,#fff)}.yCgN3W_dialogActions .yCgN3W_primary:hover:disabled{background:var(--dsw-alias-label-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff)}.yCgN3W_dialogFooter button{border:1px solid var(--dsw-alias-border-l3,#ddd);height:32px;color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:16px;padding:0 12px;font-size:13px}.yCgN3W_dialogFooter button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.yCgN3W_dialogFooter .yCgN3W_primary{background:var(--dsw-alias-label-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff);border:0}.yCgN3W_dialogFooter .yCgN3W_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#252b35);color:var(--dsw-alias-label-primary-foreground,#fff)}button:disabled,select:disabled,input:disabled{opacity:.5;cursor:default}@media (hover:none){.yCgN3W_delete{opacity:1;pointer-events:auto}}@media (width<=900px){.yCgN3W_rowLine{grid-template-columns:minmax(0,1fr) 72px auto}.yCgN3W_workspaceMeta{display:none}}@media (width<=760px){.yCgN3W_toolbarRight{width:100%;margin-left:0}.yCgN3W_toolbar select{flex:1;max-width:none}.yCgN3W_searchBox{width:100%}.yCgN3W_searchBox input{flex:1;width:100%}}@media (width<=560px){.yCgN3W_dialog form,.yCgN3W_metaSection{grid-template-columns:minmax(0,1fr)}}@media (prefers-reduced-motion:reduce){.yCgN3W_row{transition:none}}";
		const tagId$1 = "@guowenzhang/dsh-task-list/TaskPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var TaskPanel_module_css_default = {
			"backdrop": "yCgN3W_backdrop",
			"content": "yCgN3W_content",
			"delete": "yCgN3W_delete",
			"dialog": "yCgN3W_dialog",
			"dialogActions": "yCgN3W_dialogActions",
			"dialogBody": "yCgN3W_dialogBody",
			"dialogError": "yCgN3W_dialogError",
			"dialogFixed": "yCgN3W_dialogFixed",
			"dialogFooter": "yCgN3W_dialogFooter",
			"dialogHeader": "yCgN3W_dialogHeader",
			"doneState": "yCgN3W_doneState",
			"empty": "yCgN3W_empty",
			"error": "yCgN3W_error",
			"fieldBlock": "yCgN3W_fieldBlock",
			"fieldHint": "yCgN3W_fieldHint",
			"filter": "yCgN3W_filter",
			"filters": "yCgN3W_filters",
			"fixedValue": "yCgN3W_fixedValue",
			"fullRow": "yCgN3W_fullRow",
			"header": "yCgN3W_header",
			"headerAction": "yCgN3W_headerAction",
			"headerActions": "yCgN3W_headerActions",
			"initEntries": "yCgN3W_initEntries",
			"initEntryName": "yCgN3W_initEntryName",
			"initError": "yCgN3W_initError",
			"initLoading": "yCgN3W_initLoading",
			"initPath": "yCgN3W_initPath",
			"initToolbar": "yCgN3W_initToolbar",
			"initWarning": "yCgN3W_initWarning",
			"inner": "yCgN3W_inner",
			"list": "yCgN3W_list",
			"metaSection": "yCgN3W_metaSection",
			"page": "yCgN3W_page",
			"pageButtons": "yCgN3W_pageButtons",
			"pageSize": "yCgN3W_pageSize",
			"pageSummary": "yCgN3W_pageSummary",
			"pager": "yCgN3W_pager",
			"placeholder": "yCgN3W_placeholder",
			"primary": "yCgN3W_primary",
			"row": "yCgN3W_row",
			"rowActions": "yCgN3W_rowActions",
			"rowLine": "yCgN3W_rowLine",
			"searchBox": "yCgN3W_searchBox",
			"searchButton": "yCgN3W_searchButton",
			"searchClear": "yCgN3W_searchClear",
			"selected": "yCgN3W_selected",
			"start": "yCgN3W_start",
			"statusChip": "yCgN3W_statusChip",
			"textButton": "yCgN3W_textButton",
			"toggle": "yCgN3W_toggle",
			"toggleRow": "yCgN3W_toggleRow",
			"toolbar": "yCgN3W_toolbar",
			"toolbarRight": "yCgN3W_toolbarRight",
			"workspaceMeta": "yCgN3W_workspaceMeta",
			"worktreeError": "yCgN3W_worktreeError",
			"worktreeHint": "yCgN3W_worktreeHint"
		};
		//#endregion
		//#region src/client/TaskPanel.tsx
		var WorktreeNotGitError = class extends Error {
			workspaceTitle;
			workspacePath;
			constructor(workspaceTitle, workspacePath, message) {
				super(`${message}: ${workspaceTitle}`);
				this.workspaceTitle = workspaceTitle;
				this.workspacePath = workspacePath;
				this.name = "WorktreeNotGitError";
			}
		};
		const statusKeys = [
			"todo",
			"in_progress",
			"done"
		];
		const priorityKeys = [
			"low",
			"medium",
			"high",
			"urgent"
		];
		const pageSizes = [
			10,
			20,
			50,
			100
		];
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function formattedTime(timestamp) {
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(timestamp);
		}
		function statusKey(status) {
			return status === "in_progress" ? "inProgress" : status;
		}
		/** The stored title is derived from the content, so legacy rows without content fall back to it. */
		function contentOf(task) {
			return task.notes.trim() || task.title;
		}
		function TaskPanel({ list, create, update, remove, start, probeWorktree, listInitialEntries, initializeGit, listAgents, workspaceSnapshot, subscribeWorkspaces, t }) {
			const [tasks, setTasks] = (0, react.useState)([]);
			const [total, setTotal] = (0, react.useState)(0);
			const [page, setPage] = (0, react.useState)(1);
			const [pageSize, setPageSize] = (0, react.useState)(20);
			const [filter, setFilter] = (0, react.useState)("all");
			const [workspaceFilter, setWorkspaceFilter] = (0, react.useState)("all");
			const [searchText, setSearchText] = (0, react.useState)("");
			const [query, setQuery] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [editing, setEditing] = (0, react.useState)(null);
			const [composerOpen, setComposerOpen] = (0, react.useState)(false);
			const [notes, setNotes] = (0, react.useState)("");
			const [status, setStatus] = (0, react.useState)("todo");
			const [priority, setPriority] = (0, react.useState)("medium");
			const [storyPoints, setStoryPoints] = (0, react.useState)("");
			const [tagsInput, setTagsInput] = (0, react.useState)("");
			const [workspaceId, setWorkspaceId] = (0, react.useState)("");
			const [sendImmediately, setSendImmediately] = (0, react.useState)(false);
			const [sessionId, setSessionId] = (0, react.useState)("");
			const [agent, setAgent] = (0, react.useState)("");
			const [useWorktree, setUseWorktree] = (0, react.useState)(false);
			const [worktreeProbe, setWorktreeProbe] = (0, react.useState)(null);
			const [initializeTask, setInitializeTask] = (0, react.useState)(null);
			const [initialEntries, setInitialEntries] = (0, react.useState)([]);
			const [selectedEntries, setSelectedEntries] = (0, react.useState)([]);
			const [initialEntriesLoading, setInitialEntriesLoading] = (0, react.useState)(false);
			const [initialEntriesError, setInitialEntriesError] = (0, react.useState)("");
			const [initialEntriesRevision, setInitialEntriesRevision] = (0, react.useState)(0);
			const [agents, setAgents] = (0, react.useState)([]);
			const mounted = (0, react.useRef)(false);
			const generation = (0, react.useRef)(0);
			const agentPrefilled = (0, react.useRef)(false);
			const workspaces = (0, react.useSyncExternalStore)(subscribeWorkspaces, workspaceSnapshot).items;
			const workspaceNames = new Map(workspaces.map((row) => [row.workspaceId, row.title]));
			const defaultWorkspaceId = pickDefaultWorkspace(workspaces, t("defaultWorkspaceName"))?.workspaceId ?? null;
			const defaultAgent = agents.find((row) => row.isDefault && !row.broken);
			const refresh = (0, react.useCallback)(async () => {
				const current = ++generation.current;
				const workspace = workspaceFilter === "all" ? void 0 : workspaceFilter.slice(3);
				setLoading(true);
				try {
					const result = await list({
						...filter === "all" ? {} : { status: filter },
						...query ? { query } : {},
						...workspace === void 0 ? {} : {
							workspaceId: workspace,
							includeUnassigned: workspace === defaultWorkspaceId
						},
						page,
						pageSize
					});
					if (mounted.current && generation.current === current) {
						setTasks(result.items);
						setTotal(result.total);
						setPage(result.page);
						setPageSize(result.pageSize);
						setError("");
					}
				} catch (failure) {
					if (mounted.current && generation.current === current) setError(errorText(failure));
				} finally {
					if (mounted.current && generation.current === current) setLoading(false);
				}
			}, [
				list,
				filter,
				query,
				workspaceFilter,
				defaultWorkspaceId,
				page,
				pageSize
			]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				refresh();
				return () => {
					mounted.current = false;
					generation.current++;
				};
			}, [refresh]);
			(0, react.useEffect)(() => {
				if (!composerOpen) return;
				let active = true;
				listAgents().then((rows) => {
					if (active) setAgents(rows);
				}).catch((failure) => {
					if (active) setError(errorText(failure));
				});
				return () => {
					active = false;
				};
			}, [composerOpen, listAgents]);
			(0, react.useEffect)(() => {
				if (!composerOpen) {
					agentPrefilled.current = false;
					return;
				}
				if (editing || agentPrefilled.current || defaultAgent === void 0) return;
				agentPrefilled.current = true;
				setAgent(defaultAgent.id);
			}, [
				composerOpen,
				editing,
				defaultAgent
			]);
			const initializationWorkspaceId = initializeTask?.task.workspaceId;
			(0, react.useEffect)(() => {
				if (!initializationWorkspaceId) return;
				let active = true;
				setInitialEntries([]);
				setSelectedEntries([]);
				setInitialEntriesError("");
				setInitialEntriesLoading(true);
				listInitialEntries(initializationWorkspaceId).then((entries) => {
					if (active) setInitialEntries(entries);
				}).catch((failure) => {
					if (active) setInitialEntriesError(errorText(failure));
				}).finally(() => {
					if (active) setInitialEntriesLoading(false);
				});
				return () => {
					active = false;
				};
			}, [
				initializationWorkspaceId,
				initialEntriesRevision,
				listInitialEntries
			]);
			(0, react.useEffect)(() => {
				if (!composerOpen || !useWorktree || !workspaceId) {
					setWorktreeProbe(null);
					return;
				}
				let active = true;
				setWorktreeProbe({
					workspaceId,
					checking: true,
					needsInit: false,
					error: ""
				});
				probeWorktree(workspaceId).then(() => {
					if (active) setWorktreeProbe({
						workspaceId,
						checking: false,
						needsInit: false,
						error: ""
					});
				}).catch((failure) => {
					if (active) setWorktreeProbe({
						workspaceId,
						checking: false,
						needsInit: failure instanceof WorktreeNotGitError,
						error: failure instanceof WorktreeNotGitError ? "" : errorText(failure)
					});
				});
				return () => {
					active = false;
				};
			}, [
				composerOpen,
				useWorktree,
				workspaceId,
				probeWorktree
			]);
			const openCreate = () => {
				setEditing(null);
				setNotes("");
				setStatus("todo");
				setPriority("medium");
				setStoryPoints("");
				setTagsInput("");
				setWorkspaceId(defaultWorkspaceId ?? "");
				setSendImmediately(false);
				setSessionId("");
				setAgent("");
				setUseWorktree(false);
				setError("");
				setComposerOpen(true);
			};
			const openEdit = (task) => {
				setEditing(task);
				setNotes(task.notes);
				setStatus(task.status);
				setPriority(task.priority);
				setStoryPoints(task.storyPoints === null ? "" : String(task.storyPoints));
				setTagsInput(task.tags.join(", "));
				setWorkspaceId(task.workspaceId ?? defaultWorkspaceId ?? "");
				setSendImmediately(task.sendImmediately);
				setSessionId(task.sessionId ?? "");
				setAgent(task.agent ?? "");
				setUseWorktree(task.useWorktree);
				setError("");
				setComposerOpen(true);
			};
			const changeFilter = (next) => {
				setFilter(next);
				setPage(1);
			};
			const changeWorkspaceFilter = (next) => {
				setWorkspaceFilter(next);
				setPage(1);
			};
			const changePageSize = (next) => {
				setPageSize(next);
				setPage(1);
			};
			const submitSearch = () => {
				setQuery(searchText.trim());
				setPage(1);
			};
			const clearSearch = () => {
				setSearchText("");
				setQuery("");
				setPage(1);
			};
			const derivedTitle = deriveTaskTitle("", notes);
			/** Write the composer fields and return the saved row; a refusal is thrown for the caller to show. */
			const persist = async () => {
				const fields = {
					title: derivedTitle,
					notes,
					status,
					priority,
					storyPoints: storyPoints === "" ? null : Number(storyPoints),
					tags: tagsInput.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean),
					workspaceId: workspaceId || null,
					sendImmediately,
					sessionId: sessionId.trim() || null,
					agent: agent || null,
					useWorktree
				};
				return editing ? await update({
					id: editing.id,
					version: editing.version,
					...fields
				}) : await create(fields);
			};
			const save = async (event) => {
				event.preventDefault();
				if (busy || !derivedTitle) return;
				setBusy(true);
				setError("");
				try {
					await persist();
					if (!mounted.current) return;
					setComposerOpen(false);
					setEditing(null);
					await refresh();
				} catch (failure) {
					if (mounted.current) setError(errorText(failure));
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			/**
			* The dialog header actions for a saved task: write the composer first, then run the same
			* start/finish the list row offers, so the dialog never closes on an unsaved edit. Starting
			* opens a fresh session for this task, so it is offered at every status — a task that is
			* already In progress or Done can be started again, which rebinds it to the new session.
			*/
			const saveAndLaunch = async (finish) => {
				if (busy || !derivedTitle || editing === null) return;
				let saved = null;
				setBusy(true);
				setError("");
				try {
					saved = await persist();
					if (!mounted.current) return;
					setComposerOpen(false);
					setEditing(null);
					await refresh();
					if (!mounted.current) return;
					if (finish) await update({
						id: saved.id,
						version: saved.version,
						status: "done"
					});
					else await start(saved);
					if (mounted.current) await refresh();
				} catch (failure) {
					if (!mounted.current) return;
					if (failure instanceof WorktreeNotGitError && saved !== null) {
						setInitializeTask({
							task: saved,
							workspaceTitle: failure.workspaceTitle,
							workspacePath: failure.workspacePath
						});
						return;
					}
					setError(errorText(failure));
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const deleteTask = async (task) => {
				if (busy) return;
				setBusy(true);
				setError("");
				try {
					await remove({
						id: task.id,
						version: task.version
					});
					if (mounted.current) await refresh();
				} catch (failure) {
					if (mounted.current) {
						await refresh();
						if (mounted.current) setError(errorText(failure));
					}
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const startTask = async (task) => {
				if (busy) return;
				setBusy(true);
				setError("");
				try {
					await start(task);
					if (mounted.current) await refresh();
				} catch (failure) {
					if (mounted.current) {
						if (failure instanceof WorktreeNotGitError) {
							setInitializeTask({
								task,
								workspaceTitle: failure.workspaceTitle,
								workspacePath: failure.workspacePath
							});
							return;
						}
						await refresh();
						if (mounted.current) setError(errorText(failure));
					}
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const initializeAndStart = async () => {
				const workspaceId = initializeTask?.task.workspaceId;
				if (!initializeTask || busy || !workspaceId) return;
				const task = initializeTask.task;
				setBusy(true);
				setError("");
				try {
					await initializeGit(workspaceId, selectedEntries);
					await start(task);
					if (mounted.current) {
						setInitializeTask(null);
						await refresh();
					}
				} catch (failure) {
					if (mounted.current) {
						setInitializeTask(null);
						await refresh();
						if (mounted.current) setError(errorText(failure));
					}
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const finishTask = async (task) => {
				if (busy) return;
				setBusy(true);
				setError("");
				try {
					await update({
						id: task.id,
						version: task.version,
						status: "done"
					});
					if (mounted.current) await refresh();
				} catch (failure) {
					if (mounted.current) {
						await refresh();
						if (mounted.current) setError(errorText(failure));
					}
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const workspaceOptions = new Map(workspaceNames);
			for (const task of tasks) if (task.workspaceId && !workspaceOptions.has(task.workspaceId)) workspaceOptions.set(task.workspaceId, task.workspaceId);
			/** A task without a workspace belongs to the default Workspace instead. */
			const workspaceOf = (task) => task.workspaceId ?? defaultWorkspaceId;
			const workspaceLabel = (id) => id === null ? t("noWorkspace") : workspaceNames.get(id) ?? id;
			const workspaceReady = (id) => id !== null && workspaceNames.has(id);
			const selectableInitialEntries = initialEntries.filter((entry) => entry.kind !== "nested_repository");
			const canSave = Boolean(derivedTitle);
			const pageCount = Math.max(1, Math.ceil(total / pageSize));
			const pageSummary = t("pageSummary").replace("{page}", String(page)).replace("{pages}", String(pageCount)).replace("{total}", String(total));
			const filtered = query !== "" || filter !== "all" || workspaceFilter !== "all";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
				className: TaskPanel_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TaskPanel_module_css_default.inner,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
								className: TaskPanel_module_css_default.header,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: TaskPanel_module_css_default.primary,
									onClick: openCreate,
									children: t("add")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskPanel_module_css_default.toolbar,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: TaskPanel_module_css_default.filters,
									role: "group",
									"aria-label": t("status"),
									children: ["all", ...statusKeys].map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: filter === item ? TaskPanel_module_css_default.selected : TaskPanel_module_css_default.filter,
										"aria-pressed": filter === item,
										onClick: () => changeFilter(item),
										children: t(item === "in_progress" ? "inProgress" : item)
									}, item))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TaskPanel_module_css_default.toolbarRight,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
											className: TaskPanel_module_css_default.searchBox,
											role: "search",
											onSubmit: (event) => {
												event.preventDefault();
												submitSearch();
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													value: searchText,
													maxLength: 200,
													placeholder: t("searchPlaceholder"),
													"aria-label": t("searchPlaceholder"),
													onChange: (event) => setSearchText(event.target.value)
												}),
												searchText !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: TaskPanel_module_css_default.searchClear,
													title: t("clearSearch"),
													"aria-label": t("clearSearch"),
													onClick: clearSearch,
													children: "×"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "submit",
													className: TaskPanel_module_css_default.searchButton,
													disabled: loading,
													children: t("search")
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											"aria-label": t("workspace"),
											value: workspaceFilter,
											onChange: (event) => changeWorkspaceFilter(event.target.value),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "all",
												children: t("allWorkspaces")
											}), [...workspaceOptions].map(([id, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: `ws:${id}`,
												children: name
											}, id))]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.textButton,
											onClick: () => void refresh(),
											disabled: loading,
											children: t("refresh")
										})
									]
								})]
							}),
							error && !composerOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskPanel_module_css_default.error,
								role: "alert",
								children: [
									t("error"),
									": ",
									error,
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void refresh(),
										children: t("retry")
									})
								]
							}),
							loading && tasks.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: TaskPanel_module_css_default.placeholder,
								children: t("loading")
							}) : tasks.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskPanel_module_css_default.empty,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: filtered ? t("emptySearch") : t("empty") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: filtered ? t("emptySearchHint") : t("emptyHint") })]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: TaskPanel_module_css_default.list,
								children: tasks.map((task) => {
									const linked = workspaceOf(task);
									const ready = workspaceReady(linked);
									const content = contentOf(task);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
										className: TaskPanel_module_css_default.row,
										"data-priority": task.priority,
										"data-status": task.status,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: TaskPanel_module_css_default.rowLine,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: TaskPanel_module_css_default.content,
													onClick: () => openEdit(task),
													disabled: busy,
													title: content,
													"aria-label": `${t("edit")}: ${content}`,
													children: content
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TaskPanel_module_css_default.statusChip,
													"data-status": task.status,
													title: t(statusKey(task.status)),
													children: t(statusKey(task.status))
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TaskPanel_module_css_default.workspaceMeta,
													title: workspaceLabel(linked),
													children: workspaceLabel(linked)
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: TaskPanel_module_css_default.rowActions,
													children: [task.status === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: TaskPanel_module_css_default.doneState,
														children: t("done")
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: TaskPanel_module_css_default.start,
														onClick: () => void (task.status === "todo" ? startTask(task) : finishTask(task)),
														disabled: busy || task.status === "todo" && !ready,
														"aria-label": `${t(task.status === "todo" ? "start" : "finish")}: ${content}`,
														title: task.status === "todo" && !ready ? linked === null ? t("startRequiresWorkspace") : t("startWorkspaceMissing") : void 0,
														children: t(task.status === "todo" ? "start" : "finish")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: TaskPanel_module_css_default.delete,
														onClick: () => void deleteTask(task),
														disabled: busy,
														"aria-label": `${t("remove")}: ${content}`,
														title: t("remove"),
														children: "×"
													})]
												})
											]
										})
									}, task.id);
								})
							}),
							total > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskPanel_module_css_default.pager,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.pageSize,
										children: [t("perPage"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
											"aria-label": t("perPage"),
											value: String(pageSize),
											onChange: (event) => changePageSize(Number(event.target.value)),
											children: pageSizes.map((size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: size,
												children: size
											}, size))
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: TaskPanel_module_css_default.pageSummary,
										children: pageSummary
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: TaskPanel_module_css_default.pageButtons,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.textButton,
											disabled: loading || page <= 1,
											onClick: () => setPage((value) => Math.max(1, value - 1)),
											children: t("prevPage")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.textButton,
											disabled: loading || page >= pageCount,
											onClick: () => setPage((value) => Math.min(pageCount, value + 1)),
											children: t("nextPage")
										})]
									})
								]
							})
						]
					}),
					composerOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: TaskPanel_module_css_default.backdrop,
						role: "presentation",
						onMouseDown: (event) => {
							if (event.target === event.currentTarget && !busy) setComposerOpen(false);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: TaskPanel_module_css_default.dialog + " " + TaskPanel_module_css_default.dialogFixed,
							role: "dialog",
							"aria-modal": "true",
							"aria-labelledby": "task-list-dialog-title",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TaskPanel_module_css_default.dialogHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										id: "task-list-dialog-title",
										children: editing ? t("edit") : t("add")
									}), editing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: TaskPanel_module_css_default.headerActions,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.headerAction,
											onClick: () => void saveAndLaunch(false),
											disabled: busy || !canSave,
											children: t("start")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.headerAction,
											onClick: () => void saveAndLaunch(true),
											disabled: busy || !canSave || status === "done",
											children: t("finish")
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TaskPanel_module_css_default.dialogBody,
									children: [error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: TaskPanel_module_css_default.dialogError,
										role: "alert",
										children: [
											t("error"),
											": ",
											error
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
										id: "task-list-form",
										onSubmit: (event) => void save(event),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: TaskPanel_module_css_default.fullRow,
												children: [t("notesLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
													autoFocus: true,
													required: true,
													value: notes,
													maxLength: 2e4,
													rows: 5,
													placeholder: t("notesHint"),
													onChange: (event) => setNotes(event.target.value)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("workspace"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												value: workspaceId,
												onChange: (event) => setWorkspaceId(event.target.value),
												children: [
													workspaces.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "",
														children: t("noWorkspace")
													}),
													workspaceId && !workspaceOptions.has(workspaceId) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: workspaceId,
														children: workspaceId
													}),
													[...workspaceOptions].map(([id, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: id,
														children: name
													}, id))
												]
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("agent"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												value: agent,
												onChange: (event) => setAgent(event.target.value),
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "",
														children: t("defaultAgent")
													}),
													agent && !agents.some((row) => row.id === agent) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: agent,
														children: agent
													}),
													agents.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
														value: row.id,
														disabled: Boolean(row.broken),
														children: [row.name ?? row.id, row.isDefault ? ` · ${t("defaultAgent")}` : ""]
													}, row.id))
												]
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: TaskPanel_module_css_default.toggleRow + " " + TaskPanel_module_css_default.fullRow,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: TaskPanel_module_css_default.toggle,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: sendImmediately,
														onChange: (event) => setSendImmediately(event.target.checked)
													}), t("sendImmediately")]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: TaskPanel_module_css_default.toggle,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: useWorktree,
														onChange: (event) => setUseWorktree(event.target.checked)
													}), t("useWorktree")]
												})]
											}),
											useWorktree && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: TaskPanel_module_css_default.worktreeHint + " " + TaskPanel_module_css_default.fullRow + " " + (worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? TaskPanel_module_css_default.worktreeError : ""),
												role: worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? "alert" : void 0,
												children: !workspaceId ? t("startRequiresWorkspace") : worktreeProbe?.workspaceId !== workspaceId || worktreeProbe.checking ? t("worktreeChecking") : worktreeProbe.needsInit ? t("worktreeNeedsInit") : worktreeProbe.error || t("worktreeAvailable")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("priorityLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												value: priority,
												onChange: (event) => setPriority(event.target.value),
												children: priorityKeys.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: item,
													children: t(item)
												}, item))
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("status"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												value: status,
												onChange: (event) => setStatus(event.target.value),
												children: statusKeys.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: item,
													children: t(statusKey(item))
												}, item))
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("tags"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												value: tagsInput,
												onChange: (event) => setTagsInput(event.target.value),
												placeholder: t("tagsHint")
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("storyPoints"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "number",
												min: "0",
												max: "1000",
												step: "1",
												value: storyPoints,
												onChange: (event) => setStoryPoints(event.target.value)
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												className: TaskPanel_module_css_default.metaSection + " " + TaskPanel_module_css_default.fullRow,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: TaskPanel_module_css_default.fieldBlock,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("sessionId"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: TaskPanel_module_css_default.fixedValue,
															title: sessionId || t("sessionUnbound"),
															children: sessionId || t("sessionUnbound")
														})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															className: TaskPanel_module_css_default.fieldHint,
															children: t("sessionIdLocked")
														})]
													}),
													editing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("createdAt"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: TaskPanel_module_css_default.fixedValue,
														children: formattedTime(editing.createdAt)
													})] }),
													editing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("startedAt"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: TaskPanel_module_css_default.fixedValue,
														children: editing.startedAt === null ? t("notStarted") : formattedTime(editing.startedAt)
													})] }),
													editing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("completedAt"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: TaskPanel_module_css_default.fixedValue,
														children: editing.completedAt === null ? t("notCompleted") : formattedTime(editing.completedAt)
													})] })
												]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TaskPanel_module_css_default.dialogFooter,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setComposerOpen(false),
										disabled: busy,
										children: t("cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "submit",
										form: "task-list-form",
										className: TaskPanel_module_css_default.primary,
										disabled: busy || !canSave,
										children: t("save")
									})]
								})
							]
						})
					}),
					initializeTask && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: TaskPanel_module_css_default.backdrop,
						role: "presentation",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: TaskPanel_module_css_default.dialog,
							role: "dialog",
							"aria-modal": "true",
							"aria-labelledby": "task-list-init-title",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									id: "task-list-init-title",
									children: t("initializeGitTitle")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
									t("initializeGitIntro"),
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: initializeTask.workspaceTitle })
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: TaskPanel_module_css_default.initPath,
									children: initializeTask.workspacePath
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TaskPanel_module_css_default.initToolbar,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("initialCommitEntries") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: busy || initialEntriesLoading || Boolean(initialEntriesError),
											onClick: () => setSelectedEntries(selectableInitialEntries.map((entry) => entry.name)),
											children: t("selectAll")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: busy || initialEntriesLoading || Boolean(initialEntriesError),
											onClick: () => setSelectedEntries([]),
											children: t("selectNone")
										})
									]
								}),
								initialEntriesLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: TaskPanel_module_css_default.initLoading,
									children: t("initialEntriesLoading")
								}) : initialEntriesError ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: TaskPanel_module_css_default.initError,
									role: "alert",
									children: [
										initialEntriesError,
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setInitialEntriesRevision((value) => value + 1),
											children: t("retry")
										})
									]
								}) : initialEntries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: TaskPanel_module_css_default.initLoading,
									children: t("initialEntriesEmpty")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: TaskPanel_module_css_default.initEntries,
									children: initialEntries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: selectedEntries.includes(entry.name),
											disabled: busy || entry.kind === "nested_repository",
											onChange: (event) => {
												const checked = event.target.checked;
												setSelectedEntries((current) => checked ? [...current, entry.name] : current.filter((name) => name !== entry.name));
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: TaskPanel_module_css_default.initEntryName,
											title: entry.name,
											children: entry.name
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(entry.kind === "directory" ? "initialDirectory" : entry.kind === "nested_repository" ? "initialNestedRepository" : "initialFile") })
									] }) }, entry.name))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: TaskPanel_module_css_default.initWarning,
									children: t("initializeGitWarning")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TaskPanel_module_css_default.dialogActions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setInitializeTask(null),
											disabled: busy,
											children: t("cancel")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												const task = initializeTask.task;
												setInitializeTask(null);
												openEdit(task);
											},
											disabled: busy,
											children: t("changeWorkspace")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.primary,
											onClick: () => void initializeAndStart(),
											disabled: busy || initialEntriesLoading || Boolean(initialEntriesError),
											children: t("initializeAndStart")
										})
									]
								})
							]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/capture.ts
		/** @returns whether the event is Ctrl+S or Cmd+S with no other modifier. */
		function isCaptureShortcut(event) {
			if (!event.ctrlKey && !event.metaKey) return false;
			if (event.altKey || event.shiftKey) return false;
			return event.key.toLowerCase() === "s";
		}
		/** @returns whether the focused element is the composer editor or inside it. */
		function isComposerFocused(target) {
			if (target === null) return false;
			if (target.getAttribute?.("contenteditable") === "true") return true;
			const inside = target.closest?.("[contenteditable=\"true\"]");
			return inside !== null && inside !== void 0;
		}
		/**
		* Persist one task holding the draft. A successful capture empties the
		* composer; a refusal keeps the text so nothing is lost.
		* @param draft - current composer text.
		* @param deps - task writer and composer clear.
		* @returns what the control should report.
		*/
		async function captureDraft(draft, deps) {
			const notes = draft.trim();
			if (notes === "") return { kind: "empty" };
			const title = deriveTaskTitle("", notes);
			try {
				await deps.create({
					title,
					notes,
					priority: "medium",
					storyPoints: null,
					tags: [],
					workspaceId: null,
					sendImmediately: false,
					sessionId: null,
					agent: null,
					useWorktree: false
				});
			} catch (error) {
				return {
					kind: "failed",
					message: error instanceof Error ? error.message : String(error)
				};
			}
			deps.clearDraft();
			return {
				kind: "created",
				title
			};
		}
		/**
		* Consume one keydown: the composer's Ctrl+S creates a task instead of
		* reaching the browser's save dialog, every other key passes through.
		* @returns whether the shortcut owned the event.
		*/
		function handleCaptureKey(event, deps) {
			if (!isCaptureShortcut(event) || !isComposerFocused(deps.activeElement())) return false;
			event.preventDefault();
			deps.capture(deps.readDraft()).then(deps.report);
			return true;
		}
		/**
		* Route the composer's Ctrl+S to the capture during the capture phase, so the
		* editor never sees the chord.
		* @param target - the document-like keydown sink.
		* @param deps - draft reader and capture runner.
		* @returns disposer releasing the listener.
		*/
		function installCaptureShortcut(target, deps) {
			const listener = (event) => {
				handleCaptureKey(event, deps);
			};
			target.addEventListener("keydown", listener, { capture: true });
			return () => target.removeEventListener("keydown", listener, { capture: true });
		}
		//#endregion
		//#region \0dsh-css:C:\02-codespace\DeepSeek\dsh-task-list\src\client\TaskCapture.module.css.mjs
		const css = ".CI6zPG_capture{min-width:0;font:inherit;align-items:center;gap:8px;display:inline-flex}.CI6zPG_button{height:28px;font:inherit;white-space:nowrap;cursor:pointer;color:var(--dsw-alias-label-tertiary,#81858c);background:0 0;border:0;border-radius:8px;align-items:center;gap:6px;padding:0 8px;font-size:12px;line-height:18px;display:inline-flex}.CI6zPG_button:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f);color:var(--dsw-alias-label-primary,#0f1115)}.CI6zPG_button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#326dca);outline-offset:1px}.CI6zPG_key{border:1px solid var(--dsw-alias-border-l3,#ddd);font-family:var(--dsw-font-family-mono,ui-monospace, monospace);border-radius:4px;padding:0 4px;font-size:11px;line-height:16px}.CI6zPG_report{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary,#81858c);font-size:12px;overflow:hidden}.CI6zPG_report[data-tone=created]{color:var(--dsw-alias-state-business-primary,#326dca)}.CI6zPG_report[data-tone=failed]{color:var(--dsw-alias-state-error-primary,#c4314b)}";
		const tagId = "@guowenzhang/dsh-task-list/TaskCapture.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var TaskCapture_module_css_default = {
			"button": "CI6zPG_button",
			"capture": "CI6zPG_capture",
			"key": "CI6zPG_key",
			"report": "CI6zPG_report"
		};
		//#endregion
		//#region src/client/TaskCapture.tsx
		/** How long one capture result stays visible next to the control. */
		const REPORT_TIMEOUT_MS = 4e3;
		const selectDraft = (state) => state.draft;
		function asDraft(value) {
			return typeof value === "string" ? value : "";
		}
		/**
		* Composer control for Ctrl+S. Reads the draft through the session input
		* projection, writes one task through the injected face, and empties the
		* composer on success — no dialog, only a short inline report.
		*/
		function TaskCapture({ useInput, inputActions, create, t }) {
			const draft = asDraft(useInput(selectDraft));
			const [outcome, setOutcome] = (0, react.useState)(null);
			const timer = (0, react.useRef)(null);
			const latest = (0, react.useRef)({
				draft,
				inputActions,
				create
			});
			latest.current = {
				draft,
				inputActions,
				create
			};
			const report = (0, react.useCallback)((next) => {
				setOutcome(next);
				if (timer.current !== null) clearTimeout(timer.current);
				timer.current = setTimeout(() => setOutcome(null), REPORT_TIMEOUT_MS);
			}, []);
			(0, react.useEffect)(() => () => {
				if (timer.current !== null) clearTimeout(timer.current);
			}, []);
			(0, react.useEffect)(() => installCaptureShortcut(document, {
				readDraft: () => latest.current.draft,
				activeElement: () => document.activeElement,
				capture: (text) => captureDraft(text, {
					create: (request) => latest.current.create(request),
					clearDraft: () => latest.current.inputActions.setDraft("")
				}),
				report
			}), [report]);
			const run = () => {
				captureDraft(draft, {
					create,
					clearDraft: () => inputActions.setDraft("")
				}).then(report);
			};
			const message = outcome === null ? "" : outcome.kind === "created" ? t("captureCreated").replace("{title}", outcome.title) : outcome.kind === "empty" ? t("captureEmpty") : `${t("captureFailed")}: ${outcome.message}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: TaskCapture_module_css_default.capture,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: TaskCapture_module_css_default.button,
					onClick: run,
					title: t("captureHint"),
					"aria-label": t("captureTask"),
					children: [t("captureTask"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("kbd", {
						className: TaskCapture_module_css_default.key,
						children: "Ctrl+S"
					})]
				}), outcome !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: TaskCapture_module_css_default.report,
					role: "status",
					"data-tone": outcome.kind,
					children: message
				})]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/** Most recent Sessions offered in a picker; keeps one select usable. */
		const SESSION_OPTION_LIMIT = 200;
		async function worktreeRequest(method, request, gitUnavailableMessage) {
			const response = await fetch(`/worktree/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(request)
			});
			const body = await response.json().catch(() => null);
			if (!response.ok) {
				const error = body?.error;
				if (error?.code === "git_not_found" || /\bspawn\s+git\s+ENOENT\b/iu.test(error?.message ?? "")) throw new Error(gitUnavailableMessage);
				throw new Error(error?.message ?? `dsh-worktree is unavailable (${response.status})`);
			}
			return body;
		}
		async function startWorktree(cwd, agent, gitUnavailableMessage) {
			const result = await worktreeRequest("start", {
				cwd,
				...agent ? { agentPreset: agent } : {}
			}, gitUnavailableMessage);
			if (!result || typeof result.sessionId !== "string" || typeof result.workspaceId !== "string") throw new Error("dsh-worktree returned an invalid session");
			return result;
		}
		async function unwrap(call) {
			const result = await call;
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		}
		function TaskIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 20 20",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.7",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "3",
					y: "2.5",
					width: "14",
					height: "15",
					rx: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 7 1.4 1.4L10 5.8M11.5 7.2H14M6 12h2.5M11.5 12H14" })]
			});
		}
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.agentPresets",
			"workspaces",
			"sessions",
			"conversation",
			"uiWorkspace"
		];
		async function apply(ctx) {
			const off = await ctx.remote.$mount(TYPERT_REMOTE);
			ctx.effect(() => () => off(), "task-list: remote mount");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "task-list: dictionaries");
			const t = ctx.locale.bind(NS);
			const remote = () => {
				const service = ctx.get(`remote.${REMOTE_NAMESPACE}`);
				if (!service) throw new Error("taskList namespace is not mounted");
				return service;
			};
			const agentPresets = () => ctx.remote.agentPresets;
			const workspaceFor = (id) => ctx.workspaces.list.getSnapshot().items.find((item) => item.workspaceId === id);
			let sessionCache = {
				source: void 0,
				value: { items: [] }
			};
			const sessionSnapshot = () => {
				const snapshot = ctx.sessions.list.getSnapshot();
				if (sessionCache.source !== snapshot) {
					const ids = snapshot?.ids ?? [];
					const byId = snapshot?.byId ?? {};
					sessionCache = {
						source: snapshot,
						value: { items: ids.slice(0, SESSION_OPTION_LIMIT).map((id) => ({
							id,
							title: byId[id]?.displayTitle ?? id
						})) }
					};
				}
				return sessionCache.value;
			};
			const probeWorktree = async (workspaceId) => {
				const workspace = workspaceFor(workspaceId);
				if (workspace === void 0) throw new Error(t("startWorkspaceMissing"));
				if (!workspace.path) throw new Error(t("worktreeRequiresGit"));
				try {
					const result = await worktreeRequest("list", { cwd: workspace.path }, t("gitUnavailable"));
					if (!Array.isArray(result?.worktrees) || result.worktrees.length === 0) throw new Error(t("worktreeRequiresGit"));
				} catch (error) {
					if (/not a git repository/iu.test(error instanceof Error ? error.message : String(error))) throw new WorktreeNotGitError(workspace.title, workspace.path, t("worktreeRequiresGit"));
					throw error;
				}
			};
			const face = {
				list: (request) => unwrap(remote().listTasks(request)),
				create: (request) => unwrap(remote().createTask(request)),
				update: (request) => unwrap(remote().updateTask(request)),
				remove: (request) => unwrap(remote().deleteTask(request)),
				createSubtask: (request) => unwrap(remote().createSubtask(request)),
				updateSubtask: (request) => unwrap(remote().updateSubtask(request)),
				removeSubtask: (request) => unwrap(remote().deleteSubtask(request)),
				openSession: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
				sessionSnapshot,
				subscribeSessions: (listener) => ctx.sessions.list.subscribe(listener),
				listAgents: async () => {
					const result = await agentPresets().list();
					if (!result.ok) throw new Error(result.error.message);
					return result.value.presets;
				},
				probeWorktree,
				listInitialEntries: async (workspaceId) => {
					const result = await worktreeRequest("init-files", { workspaceId }, t("gitUnavailable"));
					if (!Array.isArray(result?.entries)) throw new Error("dsh-worktree returned an invalid file list");
					return result.entries;
				},
				initializeGit: async (workspaceId, selectedEntries) => {
					if ((await worktreeRequest("init", {
						workspaceId,
						selectedEntries
					}, t("gitUnavailable")))?.initialized !== true) throw new Error("dsh-worktree did not initialize the repository");
				},
				start: async (task) => {
					const workspace = task.workspaceId === null ? pickDefaultWorkspace(ctx.workspaces.list.getSnapshot().items, t("defaultWorkspaceName")) : workspaceFor(task.workspaceId);
					if (workspace === void 0) throw new Error("task workspace is unavailable");
					let sessionId;
					if (task.useWorktree) {
						await probeWorktree(workspace.workspaceId);
						sessionId = (await startWorktree(workspace.path, task.agent, t("gitUnavailable"))).sessionId;
						await ctx.sessions.refresh();
						if (!ctx.sessions.list.getSnapshot().byId[sessionId]) await ctx.sessions.refresh();
					} else sessionId = await ctx.sessions.create({ workspaceId: workspace.workspaceId });
					await ctx.sessions.using(sessionId, { source: "controllerOperation" }, async () => {
						const scope = ctx.sessions.scope(sessionId);
						if (scope === void 0) throw new Error("new session has no active scope");
						if (task.agent && !task.useWorktree) await unwrap(agentPresets().select(sessionId, task.agent));
						const content = task.notes.trim() || task.title.trim();
						const input = ctx.conversation.input.for(scope);
						input.setDraft(content);
						await unwrap(remote().updateTask({
							id: task.id,
							version: task.version,
							status: "in_progress",
							sessionId
						}));
						ctx.uiWorkspace.openSession(sessionId);
						if (task.sendImmediately) input.submit("queue", "click");
					});
				},
				workspaceSnapshot: () => ctx.workspaces.list.getSnapshot(),
				subscribeWorkspaces: (listener) => ctx.workspaces.list.subscribe(listener)
			};
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: "task-list",
				locale: NS,
				inject: () => face
			}, TaskPanel));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: "task-list",
				order: 25,
				label: () => t("nav")
			}, TaskIcon));
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "task-capture",
				order: 60,
				locale: NS,
				inject: () => ({ create: (request) => unwrap(remote().createTask(request)) })
			}, TaskCapture));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
