window.__ModuleLoader__.load({
	id: "@guowenzhang/dsh-task-list",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __defProp = Object.defineProperty;
		var __exportAll = (all, no_symbols) => {
			let target = {};
			for (var name in all) __defProp(target, name, {
				get: all[name],
				enumerable: true
			});
			if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
			return target;
		};
		//#endregion
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
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
				"capabilities",
				"listTasks",
				"createTask",
				"updateTask",
				"deleteTask",
				"readTaskAttachments",
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
			editorPlaceholder: "描述任务，或粘贴网页、文档内容…",
			editorPasteHint: "支持富文本粘贴 · 拖入文件添加附件",
			editorCharacterCount: "{count} / 20000 字",
			formatUndo: "撤销",
			formatRedo: "重做",
			pasteImagesOmitted: "粘贴内容中的外部图片未保存，请复制图片或添加图片附件。",
			formatToolbar: "文字格式",
			formatBold: "加粗",
			formatItalic: "斜体",
			formatUnderline: "下划线",
			formatBullet: "无序列表",
			formatOrdered: "有序列表",
			formatHeading: "标题",
			formatParagraph: "正文",
			attachments: "附件",
			addAttachment: "添加附件",
			removeAttachment: "移除附件",
			downloadAttachment: "下载附件",
			attachmentReading: "读取中…",
			attachmentMissing: "附件数据缺失",
			contentTooLong: "内容最多 20000 字，请缩短后再保存",
			attachmentLimit: "最多 8 个附件，单个不超过 10 MiB，总计不超过 20 MiB；支持拖放和粘贴文件。",
			captureBusy: "输入框正在发送或保存，请稍后再保存任务",
			storageUpgradeRequired: "任务宿主尚未加载新版富文本附件存储，或保存校验失败。请重载任务列表插件或重启 DSH；输入内容和附件已保留。",
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
			sessionId: "关联会话",
			sessionIdHint: "可选择已有会话；启动任务会新建会话并更新关联",
			sessionUntitled: "未命名会话",
			sessionUnavailable: "会话已不存在或暂不可用",
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
			captureHint: "Ctrl+S：把输入框文字、文件和图片一起存为任务，成功后清空",
			captureCreated: "已创建任务：{title}",
			captureEmpty: "输入框没有文字或附件",
			captureFailed: "创建任务失败"
		};
		const en$4 = {
			nav: "Tasks",
			title: "Task list",
			subtitle: "Keep work in one place and track its progress.",
			add: "New task",
			notesLabel: "Content (required)",
			notesHint: "The first 50 characters become the task title",
			save: "Save",
			cancel: "Cancel",
			editorPlaceholder: "Describe the task, or paste web or document content…",
			editorPasteHint: "Paste rich text · Drop files to attach",
			editorCharacterCount: "{count} / 20000 characters",
			formatUndo: "Undo",
			formatRedo: "Redo",
			pasteImagesOmitted: "External images in pasted content were not saved. Copy the image or attach its file.",
			formatToolbar: "Text formatting",
			formatBold: "Bold",
			formatItalic: "Italic",
			formatUnderline: "Underline",
			formatBullet: "Bullets",
			formatOrdered: "Numbered list",
			formatHeading: "Heading",
			formatParagraph: "Paragraph",
			attachments: "Attachments",
			addAttachment: "Add attachment",
			removeAttachment: "Remove attachment",
			downloadAttachment: "Download attachment",
			attachmentReading: "Reading…",
			attachmentMissing: "Attachment data is missing",
			contentTooLong: "Content is limited to 20000 characters; shorten it before saving",
			attachmentLimit: "Up to 8 attachments, 10 MiB each and 20 MiB total. Drop or paste files to attach.",
			captureBusy: "The composer is sending or saving; try again after it finishes",
			storageUpgradeRequired: "The task Host has not loaded rich-text attachment storage, or save verification failed. Reload the task plugin or restart DSH; composer content and attachments are retained.",
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
			sessionId: "Linked session",
			sessionIdHint: "Choose an existing session; starting the task creates and links a new session",
			sessionUntitled: "Untitled session",
			sessionUnavailable: "Session deleted or unavailable",
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
			captureHint: "Ctrl+S: save composer text, files, and images as a task; clear only after success",
			captureCreated: "Task created: {title}",
			captureEmpty: "The composer has no text or attachments",
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
		const blockTypes = /* @__PURE__ */ new Set([
			"paragraph",
			"heading",
			"bullet",
			"ordered",
			"quote",
			"code"
		]);
		const marks = /* @__PURE__ */ new Set([
			"bold",
			"italic",
			"underline",
			"code",
			"strikethrough"
		]);
		function safeLink(value) {
			if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020]/u.test(value)) return;
			try {
				const url = new URL(value);
				if ([
					"https:",
					"http:",
					"mailto:"
				].includes(url.protocol)) return value;
			} catch {}
		}
		function textContent(text) {
			return {
				version: 1,
				blocks: text.split("\n").map((line) => ({
					type: "paragraph",
					children: [{ text: line }]
				}))
			};
		}
		function validateText(block) {
			if (!block || !blockTypes.has(block.type) || !Array.isArray(block.children) || block.children.length > 2e4) throw new Error("invalid text block");
			const children = block.children.map((child) => {
				if (!child || typeof child.text !== "string" || child.text.length > 2e4) throw new Error("invalid content text");
				if (child.marks !== void 0 && (!Array.isArray(child.marks) || child.marks.length > 5 || child.marks.some((mark) => !marks.has(mark)))) throw new Error("invalid text marks");
				if (child.href !== void 0 && !safeLink(child.href)) throw new Error("invalid content link");
				return {
					text: child.text,
					...child.marks?.length ? { marks: [...new Set(child.marks)] } : {},
					...child.href ? { href: child.href } : {}
				};
			});
			if (block.level !== void 0 && (!Number.isInteger(block.level) || block.level < 1 || block.level > 6)) throw new Error("invalid heading level");
			if (block.indent !== void 0 && (!Number.isInteger(block.indent) || block.indent < 0 || block.indent > 12)) throw new Error("invalid list indent");
			return {
				type: block.type,
				children,
				...block.level ? { level: block.level } : {},
				...block.indent ? { indent: block.indent } : {}
			};
		}
		/** A bounded, explicit vocabulary; never persist arbitrary HTML, styles or executable URLs. */
		function validateContent(value) {
			const doc = value;
			if (!doc || doc.version !== 1 || !Array.isArray(doc.blocks) || doc.blocks.length > 2e3) throw new Error("invalid task content");
			let bytes = 0;
			let attachments = 0;
			let cells = 0;
			const ids = /* @__PURE__ */ new Set();
			const blocks = doc.blocks.map((block) => {
				if (!block || typeof block !== "object") throw new Error("invalid content block");
				if (block.type === "attachment") {
					if (typeof block.id !== "string" || !/^[0-9a-f-]{36}$/i.test(block.id) || ids.has(block.id) || typeof block.name !== "string" || !block.name.trim() || block.name.length > 255 || /[\u0000-\u001f]/u.test(block.name) || typeof block.mediaType !== "string" || block.mediaType.length > 200 || !/^[\w.+-]+\/[\w.+-]+$/u.test(block.mediaType) || !Number.isSafeInteger(block.bytes) || block.bytes < 0 || block.bytes > 10485760) throw new Error("invalid task attachment");
					ids.add(block.id);
					bytes += block.bytes;
					attachments++;
					return {
						type: "attachment",
						id: block.id,
						name: block.name,
						mediaType: block.mediaType,
						bytes: block.bytes
					};
				}
				if (block.type === "table") {
					if (!Array.isArray(block.rows) || block.rows.length > 100) throw new Error("invalid content table");
					return {
						type: "table",
						rows: block.rows.map((row) => {
							if (!Array.isArray(row) || row.length > 50 || (cells += row.length) > 500) throw new Error("table cell limit exceeded");
							return row.map((cell) => {
								if (!cell || !Array.isArray(cell.blocks) || cell.blocks.length > 100) throw new Error("invalid table cell");
								for (const span of [cell.colSpan, cell.rowSpan]) if (span !== void 0 && (!Number.isInteger(span) || span < 1 || span > 100)) throw new Error("invalid table span");
								return {
									blocks: cell.blocks.map(validateText),
									...cell.header ? { header: true } : {},
									...cell.colSpan ? { colSpan: cell.colSpan } : {},
									...cell.rowSpan ? { rowSpan: cell.rowSpan } : {}
								};
							});
						})
					};
				}
				return validateText(block);
			});
			if (attachments > 8 || bytes > 20971520) throw new Error("task attachment limit exceeded");
			const result = {
				version: 1,
				blocks
			};
			if (contentText(result).length > 2e4) throw new Error("content must contain at most 20000 characters");
			if (JSON.stringify(result).length > 1e6) throw new Error("content structure limit exceeded");
			return result;
		}
		const plainText = (block) => block.children.map((child) => child.text).join("");
		/** Search/title projection includes filenames, not JSON syntax or attachment bytes. */
		function contentText(content) {
			return content.blocks.map((block) => block.type === "attachment" ? block.name : block.type === "table" ? block.rows.map((row) => row.map((cell) => cell.blocks.map(plainText).join("\n")).join("	")).join("\n") : plainText(block)).join("\n");
		}
		function contentAttachments(content) {
			return content.blocks.filter((block) => block.type === "attachment");
		}
		function markdownText(block) {
			const text = block.children.map((child) => {
				let text = child.text;
				for (const mark of child.marks ?? []) if (mark === "bold") text = `**${text}**`;
				else if (mark === "italic") text = `*${text}*`;
				else if (mark === "code") text = `\`${text}\``;
				else if (mark === "strikethrough") text = `~~${text}~~`;
				return child.href ? `[${text}](${child.href})` : text;
			}).join("");
			if (block.type === "heading") return `${"#".repeat(block.level ?? 2)} ${text}`;
			if (block.type === "bullet") return `${"  ".repeat(block.indent ?? 0)}- ${text}`;
			if (block.type === "ordered") return `${"  ".repeat(block.indent ?? 0)}1. ${text}`;
			if (block.type === "quote") return `> ${text}`;
			if (block.type === "code") return `\`\`\`\n${text}\n\`\`\``;
			return text;
		}
		/** Preserve supported formatting in the text-only host composer; files travel separately. */
		function contentMarkdown(content) {
			return content.blocks.filter((block) => block.type !== "attachment").map((block) => {
				if (block.type !== "table") return markdownText(block);
				const rows = block.rows.map((row) => `| ${row.map((cell) => cell.blocks.map(markdownText).join("<br>").replace(/\|/gu, "\\|")).join(" | ")} |`);
				if (rows.length) rows.splice(1, 0, `| ${block.rows[0].map(() => "---").join(" | ")} |`);
				return rows.join("\n");
			}).join("\n");
		}
		//#endregion
		//#region src/client/rich-text.ts
		const escape = (text) => text.replace(/[&<>"']/gu, (char) => ({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		})[char]);
		function textHtml(block) {
			const tag = block.type === "heading" ? `h${block.level ?? 2}` : {
				paragraph: "p",
				bullet: "ul",
				ordered: "ol",
				quote: "blockquote",
				code: "pre"
			}[block.type];
			let text = block.children.map((child) => {
				let html = escape(child.text).replace(/\n/gu, "<br>");
				for (const mark of child.marks ?? []) {
					const tag = {
						bold: "strong",
						italic: "em",
						underline: "u",
						code: "code",
						strikethrough: "s"
					}[mark];
					html = `<${tag}>${html}</${tag}>`;
				}
				return child.href && safeLink(child.href) ? `<a href="${escape(child.href)}">${html}</a>` : html;
			}).join("") || "<br>";
			if (block.type === "bullet" || block.type === "ordered") {
				text = `<li>${text}</li>`;
				for (let depth = 0; depth < (block.indent ?? 0); depth++) text = `<li><${tag}>${text}</${tag}></li>`;
			}
			return `<${tag}>${text}</${tag}>`;
		}
		function contentHtml(content) {
			return content.blocks.filter((block) => block.type !== "attachment").map((block) => {
				if (block.type !== "table") return textHtml(block);
				return `<table><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => {
					const tag = cell.header ? "th" : "td";
					return `<${tag} colspan="${cell.colSpan ?? 1}" rowspan="${cell.rowSpan ?? 1}">${cell.blocks.map(textHtml).join("")}</${tag}>`;
				}).join("")}</tr>`).join("")}</tbody></table>`;
			}).join("");
		}
		/** Build a new allowlisted document. Never insert untrusted clipboard HTML into the live DOM. */
		function sanitizeClipboardHtml(html) {
			const source = new DOMParser().parseFromString(html.slice(0, 2e6), "text/html");
			const target = document.implementation.createHTMLDocument("");
			const allowed = /* @__PURE__ */ new Set([
				"P",
				"DIV",
				"BR",
				"H1",
				"H2",
				"H3",
				"H4",
				"H5",
				"H6",
				"STRONG",
				"B",
				"EM",
				"I",
				"U",
				"S",
				"STRIKE",
				"CODE",
				"PRE",
				"BLOCKQUOTE",
				"UL",
				"OL",
				"LI",
				"A",
				"TABLE",
				"TBODY",
				"THEAD",
				"TFOOT",
				"TR",
				"TD",
				"TH",
				"SPAN"
			]);
			const blocked = /* @__PURE__ */ new Set([
				"SCRIPT",
				"STYLE",
				"IFRAME",
				"OBJECT",
				"EMBED",
				"SVG",
				"MATH",
				"LINK",
				"META",
				"NOSCRIPT"
			]);
			let count = 0;
			const copy = (node, parent) => {
				if (++count > 1e4) return;
				if (node.nodeType === 3) {
					parent.appendChild(target.createTextNode(node.textContent ?? ""));
					return;
				}
				if (!(node instanceof HTMLElement) || blocked.has(node.tagName) || node.tagName === "IMG") return;
				const element = allowed.has(node.tagName) ? target.createElement(node.tagName.toLowerCase()) : target.createElement("span");
				if (node.tagName === "A") {
					const href = safeLink(node.getAttribute("href"));
					if (href) element.setAttribute("href", href);
				}
				if (node.tagName === "TD" || node.tagName === "TH") for (const key of ["colspan", "rowspan"]) {
					const span = Number(node.getAttribute(key));
					if (Number.isInteger(span) && span > 0 && span <= 100) element.setAttribute(key, String(span));
				}
				let inner = element;
				const style = node.style;
				for (const [active, tag] of [
					[style.fontWeight === "bold" || Number(style.fontWeight) >= 600, "strong"],
					[style.fontStyle === "italic", "em"],
					[style.textDecoration.includes("underline"), "u"],
					[style.textDecoration.includes("line-through"), "s"]
				]) if (active) {
					const wrapper = target.createElement(tag);
					inner.appendChild(wrapper);
					inner = wrapper;
				}
				for (const child of node.childNodes) copy(child, inner);
				parent.appendChild(element);
			};
			for (const node of source.body.childNodes) copy(node, target.body);
			return {
				document: target,
				omittedImages: source.querySelector("img") !== null
			};
		}
		async function fileUpload(file) {
			const bytes = new Uint8Array(await file.arrayBuffer());
			let binary = "";
			for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
			return btoa(binary);
		}
		function attachmentFile(node, data) {
			const binary = atob(data);
			return new File([Uint8Array.from(binary, (char) => char.charCodeAt(0))], node.name, { type: node.mediaType });
		}
		//#endregion
		//#region node_modules/lexical/dist/Lexical.prod.mjs
		var Lexical_prod_exports = /* @__PURE__ */ __exportAll({
			$addUpdateTag: () => Al,
			$applyNodeReplacement: () => Wl,
			$assumeActiveEditor: () => gi,
			$caretFromPoint: () => tu,
			$caretRangeFromSelection: () => ru,
			$cloneWithProperties: () => Dc,
			$cloneWithPropertiesEphemeral: () => Fc,
			$comparePointCaretNext: () => Ya,
			$copyNode: () => Rl,
			$create: () => Vc,
			$createChildrenArray: () => Yc,
			$createLineBreakNode: () => qi,
			$createNodeSelection: () => Pr,
			$createParagraphNode: () => es,
			$createPoint: () => or,
			$createRangeSelection: () => Fr,
			$createRangeSelectionFromDom: () => Ir,
			$createTabNode: () => tr,
			$createTextNode: () => Go,
			$extendCaretToRange: () => ja,
			$findMatchingParent: () => qc,
			$formatText: () => _r,
			$fullReconcile: () => pi,
			$generateNodesFromRawText: () => qr,
			$getAdjacentChildCaret: () => Wa,
			$getAdjacentNode: () => kl,
			$getAdjacentSiblingOrParentSiblingCaret: () => gu,
			$getCaretInDirection: () => fu,
			$getCaretRange: () => Va,
			$getCaretRangeInDirection: () => du,
			$getCharacterOffsets: () => yr,
			$getChildCaret: () => Ba,
			$getChildCaretAtIndex: () => hu,
			$getChildCaretOrSelf: () => Ra,
			$getCollapsedCaretRange: () => Ja,
			$getCommonAncestor: () => Za,
			$getCommonAncestorResultBranchOrder: () => Ga,
			$getDOMSlot: () => kc,
			$getDOMTextNode: () => wc,
			$getDocument: () => Zl,
			$getEditor: () => vc,
			$getEditorDOMRenderConfig: () => Tc,
			$getNearestNodeFromDOMNode: () => Zs,
			$getNearestRootOrShadowRoot: () => Kl,
			$getNodeByKey: () => Ys,
			$getNodeByKeyOrThrow: () => Ul,
			$getNodeFromDOMNode: () => Gs,
			$getPreviousSelection: () => zr,
			$getRoot: () => nl,
			$getSelection: () => Kr,
			$getSiblingCaret: () => Ia,
			$getSlot: () => sa,
			$getSlotFrame: () => oa,
			$getSlotHost: () => ea,
			$getSlotNameWithinHost: () => na,
			$getSlotNames: () => ia,
			$getState: () => xt$7,
			$getStateChange: () => Ct$7,
			$getTextContent: () => Yr,
			$getTextNodeOffset: () => Ka,
			$getTextPointCaret: () => La,
			$getTextPointCaretSlice: () => za,
			$getWritableNodeState: () => bt$7,
			$hasAncestor: () => Fl,
			$hasUpdateTag: () => Ml,
			$insertNodeToNearestRootAtCaret: () => mu,
			$insertNodes: () => Jr,
			$isBlockElementNode: () => Ar,
			$isChildCaret: () => Aa,
			$isDecoratorNode: () => Ki,
			$isEditorState: () => Ui,
			$isElementDOMSlot: () => Ec,
			$isElementNode: () => Pi,
			$isExtendableTextPointCaret: () => uu,
			$isInlineElementOrDecoratorNode: () => Ll,
			$isInlineFormattable: () => Ro,
			$isLeafNode: () => $s,
			$isLexicalNode: () => po$1,
			$isLineBreakNode: () => Yi,
			$isNodeCaret: () => Oa,
			$isNodeSelection: () => dr,
			$isParagraphNode: () => ns,
			$isRangeSelection: () => ur,
			$isRootNode: () => Bi,
			$isRootOrShadowRoot: () => Bl,
			$isSelectionCapturedInDecoratorInput: () => Os,
			$isShadowRootNode: () => zl,
			$isSiblingCaret: () => Ma,
			$isSlotChild: () => Zc,
			$isSlotHost: () => Qc,
			$isTabNode: () => er,
			$isTextNode: () => Xo,
			$isTextPointCaret: () => wa,
			$isTextPointCaretSlice: () => Ha,
			$isTokenOrSegmented: () => Ks,
			$isTokenOrTab: () => Ls,
			$markSlotEditable: () => Bc,
			$needsBlockCursorBeside: () => Hl,
			$nodesOfType: () => vl,
			$normalizeCaret: () => au,
			$normalizeSelection__EXPERIMENTAL: () => It$5,
			$onUpdate: () => Dl,
			$parseSerializedNode: () => vi,
			$removeFromParent: () => Hs,
			$removeSlot: () => ya,
			$removeTextFromCaretRange: () => cu,
			$rewindSiblingCaret: () => iu,
			$selectAll: () => xl,
			$setCompositionKey: () => Vs,
			$setDirectionFromDOM: () => Ic,
			$setFormatFromDOM: () => Lc,
			$setPointFromCaret: () => eu,
			$setSelection: () => ol,
			$setSelectionFromCaretRange: () => nu,
			$setSlot: () => pa,
			$setState: () => St$7,
			$setTextFormat: () => gr,
			$splitAtPointCaretNext: () => yu,
			$splitNode: () => uc,
			$updateDOMSelection: () => jr,
			$updateRangeSelectionFromCaretRange: () => ou,
			ArtificialNode__DO_NOT_USE: () => ji,
			BEFORE_INPUT_COMMAND: () => ze$2,
			BLUR_COMMAND: () => Mn$3,
			CAN_REDO_COMMAND: () => En$3,
			CAN_UNDO_COMMAND: () => wn$3,
			CAN_USE_BEFORE_INPUT: () => s,
			CAN_USE_DOM: () => n,
			CLEAR_EDITOR_COMMAND: () => bn$3,
			CLEAR_HISTORY_COMMAND: () => Nn$3,
			CLICK_COMMAND: () => Ke$2,
			COLLABORATION_TAG: () => vo$1,
			COMMAND_PRIORITY_BEFORE_CRITICAL: () => -4,
			COMMAND_PRIORITY_BEFORE_EDITOR: () => -8,
			COMMAND_PRIORITY_BEFORE_HIGH: () => -5,
			COMMAND_PRIORITY_BEFORE_LOW: () => -7,
			COMMAND_PRIORITY_BEFORE_NORMAL: () => -6,
			COMMAND_PRIORITY_CRITICAL: () => 4,
			COMMAND_PRIORITY_EDITOR: () => 0,
			COMMAND_PRIORITY_HIGH: () => 3,
			COMMAND_PRIORITY_LOW: () => 1,
			COMMAND_PRIORITY_NORMAL: () => 2,
			COMPOSITION_END_COMMAND: () => We$2,
			COMPOSITION_END_TAG: () => wo$1,
			COMPOSITION_START_COMMAND: () => Re$2,
			COMPOSITION_START_TAG: () => Eo,
			CONTROLLED_TEXT_INSERTION_COMMAND: () => je$2,
			COPY_COMMAND: () => vn$3,
			CUT_COMMAND: () => Tn$1,
			CUT_TAG: () => "cut",
			DEFAULT_EDITOR_DOM_CONFIG: () => ps,
			DELETE_CHARACTER_COMMAND: () => $e$2,
			DELETE_LINE_COMMAND: () => Ye$2,
			DELETE_WORD_COMMAND: () => qe$2,
			DRAGEND_COMMAND: () => Sn$3,
			DRAGOVER_COMMAND: () => Cn$3,
			DRAGSTART_COMMAND: () => xn$3,
			DROP_COMMAND: () => yn$3,
			DecoratorNode: () => Li,
			ElementNode: () => Fi,
			FOCUS_COMMAND: () => On$3,
			FORMAT_ELEMENT_COMMAND: () => mn$3,
			FORMAT_TEXT_COMMAND: () => Ge$2,
			HISTORIC_TAG: () => yo$1,
			HISTORY_MERGE_TAG: () => xo,
			HISTORY_PUSH_TAG: () => mo$1,
			INDENT_CONTENT_COMMAND: () => _n$2,
			INPUT_COMMAND: () => Be$2,
			INSERT_LINE_BREAK_COMMAND: () => Ue$2,
			INSERT_PARAGRAPH_COMMAND: () => He$2,
			INSERT_TAB_COMMAND: () => gn$3,
			INTERNAL_$isBlock: () => Sc,
			IS_ALL_FORMATTING: () => k$1,
			IS_ANDROID: () => c$1,
			IS_ANDROID_CHROME: () => f$1,
			IS_APPLE: () => r,
			IS_APPLE_WEBKIT: () => d,
			IS_BOLD: () => 1,
			IS_CHROME: () => u,
			IS_CODE: () => 16,
			IS_FIREFOX: () => i,
			IS_HIGHLIGHT: () => 128,
			IS_IOS: () => l,
			IS_ITALIC: () => 2,
			IS_SAFARI: () => a,
			IS_STRIKETHROUGH: () => 4,
			IS_SUBSCRIPT: () => 32,
			IS_SUPERSCRIPT: () => 64,
			IS_UNDERLINE: () => 8,
			KEY_ARROW_DOWN_COMMAND: () => ln$3,
			KEY_ARROW_LEFT_COMMAND: () => on$3,
			KEY_ARROW_RIGHT_COMMAND: () => en$3,
			KEY_ARROW_UP_COMMAND: () => sn$3,
			KEY_BACKSPACE_COMMAND: () => un$3,
			KEY_DELETE_COMMAND: () => dn$3,
			KEY_DOWN_COMMAND: () => tn$3,
			KEY_ENTER_COMMAND: () => cn$3,
			KEY_ESCAPE_COMMAND: () => fn$3,
			KEY_MODIFIER_COMMAND: () => An$2,
			KEY_SPACE_COMMAND: () => an$3,
			KEY_TAB_COMMAND: () => hn$3,
			LineBreakNode: () => Ji,
			MOVE_TO_END: () => nn$3,
			MOVE_TO_START: () => rn$3,
			NODE_STATE_DIRECT: () => _t$6,
			NODE_STATE_KEY: () => "$",
			NODE_STATE_LATEST: () => pt$7,
			OUTDENT_CONTENT_COMMAND: () => pn$3,
			PASTE_COMMAND: () => Je$2,
			PASTE_TAG: () => Co$1,
			ParagraphNode: () => Zi,
			REDO_COMMAND: () => Ze$2,
			REMOVE_TEXT_COMMAND: () => Ve$2,
			RootNode: () => zi,
			SELECTION_CHANGE_COMMAND: () => Ie$2,
			SELECTION_INSERT_CLIPBOARD_NODES_COMMAND: () => Le$2,
			SELECT_ALL_COMMAND: () => kn$3,
			SET_TEXT_FORMAT_COMMAND: () => Xe$2,
			SKIP_COLLAB_TAG: () => To,
			SKIP_DOM_SELECTION_TAG: () => bo$1,
			SKIP_SCROLL_INTO_VIEW_TAG: () => ko,
			SKIP_SELECTION_FOCUS_TAG: () => No$1,
			TEXT_TYPE_TO_FORMAT: () => z$2,
			TabNode: () => Zo,
			TextNode: () => Wo,
			UNDO_COMMAND: () => Qe$2,
			addClassNamesToElement: () => bu,
			buildImportMap: () => uo$1,
			configExtension: () => Cu,
			createCommand: () => Pe$2,
			createEditor: () => ys,
			createRefCountedRegistry: () => Dn$3,
			createSharedNodeState: () => vt$7,
			createState: () => mt$7,
			declarePeerDependency: () => Su,
			defineExtension: () => xu,
			findAllLexicalElementsDeep: () => Xl,
			flipDirection: () => ka,
			getActiveElement: () => lc,
			getActiveElementDeep: () => cc,
			getComposedEventTarget: () => ac,
			getComposedStaticRange: () => tc,
			getDOMOwnerDocument: () => Ol,
			getDOMSelection: () => Jl,
			getDOMSelectionFromTarget: () => Vl,
			getDOMSelectionPoints: () => nc,
			getDOMSelectionRange: () => ec,
			getDOMSelectionRangeAndPoints: () => oc,
			getDOMShadowRoots: () => Gl,
			getDOMTextNode: () => Rs,
			getDeclaredSlots: () => da,
			getEditorPropertyFromDOMNode: () => Ps,
			getNearestEditorFromDOMNode: () => Fs,
			getParentElement: () => wl,
			getRegisteredNode: () => Es,
			getRegisteredNodeOrThrow: () => Ns,
			getRegisteredSubtypeMap: () => Jc,
			getRootOwnerDocument: () => Ql,
			getStaticNodeConfig: () => Hc,
			getStyleObjectFromCSS: () => Mo,
			getTextDirection: () => Is,
			getTransformSetFromKlass: () => _s,
			isBlockDomNode: () => Cc,
			isCurrentlyReadOnlyMode: () => ui,
			isDOMCapturingSelection: () => Rc,
			isDOMDocumentNode: () => Bs,
			isDOMNode: () => _c,
			isDOMShadowRoot: () => ql,
			isDOMTextNode: () => zs,
			isDOMUnmanaged: () => zc,
			isDocumentFragment: () => pc,
			isExactShortcutMatch: () => _l,
			isHTMLAnchorElement: () => fc,
			isHTMLElement: () => gc,
			isHTMLTableCellElement: () => hc,
			isHTMLTableRowElement: () => dc,
			isInlineDomNode: () => mc,
			isLastChildInBlockNode: () => Xi,
			isLexicalEditor: () => Ds,
			isModifierMatch: () => gl,
			isOnlyChildInBlockNode: () => Gi,
			isSelectionCapturedInDecoratorInput: () => Ms,
			isSelectionWithinEditor: () => As,
			iterStaticNodeConfigChain: () => jc,
			makeStepwiseIterator: () => qa,
			mergeRegister: () => Eu,
			mountSlotContainer: () => bc,
			normalizeClassNames: () => ku,
			registerEventListener: () => Fn$2,
			registerEventListeners: () => wu,
			removeClassNamesFromElement: () => Nu,
			removeFromParent: () => js,
			resetRandomKey: () => bs,
			safeCast: () => vu,
			setDOMStyleFromCSS: () => Fo,
			setDOMStyleObject: () => Do,
			setDOMUnmanaged: () => Kc,
			setNodeIndentFromDOM: () => Pc,
			shallowMergeConfig: () => Tu,
			stopLexicalPropagation: () => io$1,
			toggleTextFormatType: () => Ws,
			tokenizeRawText: () => Vr,
			unmountSlotContainer: () => Nc
		});
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function t(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			throw n.search = o.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		function e(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			n.search = o.toString(), console.warn(`Minified Lexical warning #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		const n = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
		const o = n && "documentMode" in document ? document.documentMode : null;
		const r = n && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
		const i = n && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
		const s = !(!n || !("InputEvent" in window) || o) && "getTargetRanges" in new window.InputEvent("input");
		const l = n && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
		const c$1 = n && /Android/.test(navigator.userAgent);
		const a = n && /Version\/[\d.]+.*Safari/.test(navigator.userAgent) && !c$1;
		const u = n && /^(?=.*Chrome).*/i.test(navigator.userAgent);
		const f$1 = n && c$1 && u;
		const d = n && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && r && !u;
		const h$1 = 0;
		const g$1 = 1;
		const _$1 = 2;
		const k$1 = 2047;
		const b$2 = 1;
		const N = 2;
		const E$1 = 3;
		const w = 4;
		const O$2 = 5;
		const M$2 = 6;
		const A$1 = a || l || d ? "\xA0" : "​";
		const D$2 = "\n\n";
		const F$1 = i ? "\xA0" : A$1;
		const P = "֑-߿יִ-﷽ﹰ-ﻼ";
		const I$1 = "A-Za-zÀ-ÖØ-öø-ʸ̀-֐ࠀ-῿‎Ⰰ-﬜︀-﹯﻽-￿";
		const L$1 = new RegExp("^[^" + I$1 + "]*[" + P + "]");
		const K = new RegExp("^[^" + P + "]*[" + I$1 + "]");
		const z$2 = {
			bold: 1,
			capitalize: 1024,
			code: 16,
			highlight: 128,
			italic: 2,
			lowercase: 256,
			strikethrough: 4,
			subscript: 32,
			superscript: 64,
			underline: 8,
			uppercase: 512
		};
		const B$1 = {
			directionless: 1,
			unmergeable: 2
		};
		const R$1 = {
			center: 2,
			end: 6,
			justify: 4,
			left: 1,
			right: 3,
			start: 5
		};
		const W$1 = {
			[N]: "center",
			[M$2]: "end",
			[w]: "justify",
			[b$2]: "left",
			[E$1]: "right",
			[O$2]: "start"
		};
		const $$1 = {
			normal: 0,
			segmented: 2,
			token: 1
		};
		const U$1 = {
			[h$1]: "normal",
			[_$1]: "segmented",
			[g$1]: "token"
		};
		const j$2 = "$config";
		function J$1() {
			return vc()._blockCursorElement;
		}
		function V$2(t) {
			return null !== t && 1 === t.nodeType && t.hasAttribute("data-lexical-slot");
		}
		var q$2 = class q$2 {
			element;
			before;
			after;
			constructor(t, e, n) {
				this.element = t, this.before = e || null, this.after = n || null;
			}
			withBefore(t) {
				return new q$2(this.element, t, this.after);
			}
			withAfter(t) {
				return new q$2(this.element, this.before, t);
			}
			withElement(t) {
				return this.element === t ? this : new q$2(t, this.before, this.after);
			}
			insertChild(e) {
				const n = this.getInsertionAnchor();
				return null !== n && n.parentElement !== this.element && t(357), this.element.insertBefore(e, n), this;
			}
			removeChild(e) {
				return e.parentElement !== this.element && t(358), this.element.removeChild(e), this;
			}
			replaceChild(e, n) {
				return n.parentElement !== this.element && t(359), this.element.replaceChild(e, n), this;
			}
			getFirstChild() {
				const t = this.getFirstChildAnchor(), e = t ? t.nextSibling : this.element.firstChild;
				return e === this.getInsertionAnchor() ? null : e;
			}
			getFirstChildAnchor() {
				return this.after;
			}
			resolveLeafPosition(t, e, n) {
				if (this.element === t) return e === t && 0 === n ? "before" : "after";
				const o = Y$2(t, this.element);
				if (null === o) return "after";
				const r = Array.prototype.indexOf.call(t.childNodes, o);
				if (r < 0) return "after";
				if (e === t) return n <= r ? "before" : "after";
				const i = Y$2(t, e);
				if (null === i) return "after";
				const s = Array.prototype.indexOf.call(t.childNodes, i);
				return s >= 0 && s <= r ? "before" : "after";
			}
			getInsertionAnchor() {
				return this.before;
			}
		};
		function Y$2(t, e) {
			let n = e;
			for (; null !== n && n.parentNode !== t;) n = n.parentNode;
			return n;
		}
		var G$2 = class G$2 extends q$2 {
			withBefore(t) {
				return new G$2(this.element, t, this.after);
			}
			withAfter(t) {
				return new G$2(this.element, this.before, t);
			}
			withElement(t) {
				return this.element === t ? this : new G$2(t, this.before, this.after);
			}
			getInsertionAnchor() {
				return super.getInsertionAnchor() || this.getManagedLineBreak();
			}
			getFirstChildAnchor() {
				let t = super.getFirstChildAnchor(), e = t ? t.nextSibling : this.element.firstChild;
				for (; V$2(e);) t = e, e = e.nextSibling;
				const n = t ? t.nextSibling : this.element.firstChild;
				return null !== n && n === J$1() ? n : t;
			}
			getManagedLineBreak() {
				return this.element.__lexicalLineBreak || null;
			}
			setManagedLineBreak(t) {
				if (this.element.__lexicalLastChildKind = t, null === t) this.removeManagedLineBreak();
				else {
					const e = "decorator" === t && (d || l || a);
					this.insertManagedLineBreak(e);
				}
			}
			removeManagedLineBreak() {
				const t = this.getManagedLineBreak();
				if (t) {
					const e = this.element, n = "IMG" === t.nodeName ? t.nextSibling : null;
					n && e.removeChild(n), e.removeChild(t), e.__lexicalLineBreak = void 0;
				}
			}
			insertManagedLineBreak(t) {
				const e = this.getManagedLineBreak();
				if (e) {
					if (t === ("IMG" === e.nodeName)) return;
					this.removeManagedLineBreak();
				}
				const n = this.element, o = this.before, r = Zl().createElement("br");
				if (r.setAttribute("data-lexical-managed-linebreak", "true"), n.insertBefore(r, o), t) {
					const t = Zl().createElement("img");
					t.setAttribute("data-lexical-managed-linebreak", "true"), t.style.setProperty("display", "inline", "important"), t.style.setProperty("border", "0px", "important"), t.style.setProperty("margin", "0px", "important"), t.alt = "", n.insertBefore(t, r), n.__lexicalLineBreak = t;
				} else n.__lexicalLineBreak = r;
			}
			getFirstChildOffset() {
				const t = this.getFirstChild(), e = this.getInsertionAnchor();
				let n = 0;
				for (let o = this.element.firstChild; null !== o && o !== t && o !== e; o = o.nextSibling) n++;
				return n;
			}
			resolveChildIndex(t, e, n, o) {
				if (n === this.element) {
					const e = this.getFirstChildOffset(), n = J$1(), r = this.element.childNodes, i = Math.min(o, r.length);
					let s = 0;
					for (let t = e; t < i; t++) r[t] !== n && s++;
					return [t, Math.min(s, t.getChildrenSize())];
				}
				const r = X$2(e, n);
				r.push(o);
				const i = X$2(e, this.element);
				let s = t.getIndexWithinParent();
				for (let t = 0; t < i.length; t++) {
					const e = r[t], n = i[t];
					if (void 0 === e || e < n) break;
					if (e > n) {
						s += 1;
						break;
					}
				}
				return [t.getParentOrThrow(), s];
			}
		};
		function X$2(e, n) {
			const o = [];
			let r = n;
			for (; r !== e && null !== r; r = r.parentNode) {
				let t = 0;
				for (let e = r.previousSibling; null !== e; e = e.previousSibling) t++;
				o.push(t);
			}
			return r !== e && t(225), o.reverse();
		}
		let Q$2;
		try {
			Q$2 = "0.49.0+prod.esm";
		} catch (t) {}
		const Z$3 = Q$2 ?? "\"<unknown>+source\"";
		var tt$2 = class {
			_front = /* @__PURE__ */ new Set();
			_back = /* @__PURE__ */ new Set();
			_cache;
			get size() {
				return this._front.size + this._back.size;
			}
			addBack(t) {
				return delete this._cache, this._front.has(t) || this._back.add(t), this;
			}
			addFront(t) {
				return delete this._cache, this._back.has(t) || this._front.add(t), this;
			}
			delete(t) {
				return delete this._cache, this._front.delete(t) || this._back.delete(t);
			}
			toArray() {
				const t = Array.from(this._front).reverse();
				for (const e of this._back) t.push(e);
				return t;
			}
			toReadonlyArray() {
				return this._cache = this._cache || this.toArray(), this._cache;
			}
			[Symbol.iterator]() {
				return this.toReadonlyArray()[Symbol.iterator]();
			}
		};
		const et$3 = null;
		function nt$5(t, e = 1e3) {
			return t instanceof ot$5 ? t.clone() : t.size < e ? new Map(t) : new ot$5().init(new Map(t), void 0, t.size);
		}
		var ot$5 = class ot$5 {
			_mutable = !1;
			_old = void 0;
			_nursery = void 0;
			_size = 0;
			clone() {
				return this._mutable = !1, new ot$5().init(this._old, this._nursery, this._size);
			}
			init(t, e, n) {
				return this._old = t, this._nursery = e, this._size = n, this;
			}
			get size() {
				return this._size;
			}
			has(t) {
				return void 0 !== this.get(t);
			}
			getWithTombstone(t) {
				const e = this._nursery && this._nursery.get(t);
				return void 0 !== e ? e : this._old && this._old.get(t);
			}
			get(t) {
				const e = this.getWithTombstone(t);
				return e === et$3 ? void 0 : e;
			}
			shouldCompact() {
				return void 0 !== this._nursery && 2 * this._nursery.size > this._size;
			}
			getNursery() {
				return this._mutable && this._nursery || (this.compact(), this._nursery = new Map(this._nursery), this._mutable = !0), this._nursery;
			}
			compact(t = !1) {
				if (this._nursery && this._nursery.size > 0 && (t || this.shouldCompact())) {
					const t = new Map(this._old);
					for (const [e, n] of this._nursery) n !== et$3 ? t.set(e, n) : t.delete(e);
					this._old = t, this._nursery = void 0;
				}
				return this._mutable = !1, this;
			}
			set(t, e) {
				const n = this.getWithTombstone(t);
				if (n === e) return this;
				const o = this.getNursery();
				return n !== et$3 && void 0 !== n || (this._size++, n === et$3 && o.delete(t)), o.set(t, e), this;
			}
			delete(t) {
				const e = this.has(t);
				return e && (this.getNursery().set(t, et$3), this._size--), e;
			}
			getOrInsert(t, e) {
				const n = this.get(t);
				return void 0 !== n ? n : (this.set(t, e), e);
			}
			getOrInsertComputed(t, e) {
				const n = this.get(t);
				if (void 0 !== n) return n;
				const o = e(t);
				return this.set(t, o), o;
			}
			clear() {
				this._mutable = !1, this._old = void 0, this._nursery = void 0, this._size = 0;
			}
			*keys() {
				for (const t of this.entries()) yield t[0];
			}
			*values() {
				for (const t of this.entries()) yield t[1];
			}
			*entries() {
				const t = this._nursery, e = this._old;
				if (e) for (const n of e) {
					const e = n[0], o = t ? t.get(e) : void 0;
					o !== et$3 && (void 0 !== o && (n[1] = o), yield n);
				}
				if (t) for (const n of t) n[1] === et$3 || e && e.has(n[0]) || (yield n);
			}
			forEach(t, e) {
				void 0 !== e && (t = t.bind(e));
				for (const [e, n] of this.entries()) t(n, e, this);
			}
			get [Symbol.toStringTag]() {
				return "GenMap";
			}
			[Symbol.iterator]() {
				return this.entries();
			}
		};
		function rt$5(t, e, n, o, r, i) {
			if (Pi(t)) {
				let s = t.getFirstChild();
				for (; null !== s;) {
					const t = s.__key;
					s.__parent === e && ((Pi(s) || Qc(s) && null !== s.__slots) && rt$5(s, t, n, o, r, i), n.has(t) || i.delete(t), r.push(t)), s = s.getNextSibling();
				}
			}
			for (const s of Qc(t) && null !== t.__slots ? t.__slots.values() : []) {
				const t = o.get(s);
				void 0 !== t && Zc(t) && t.__slotHost === e && ((Pi(t) || Qc(t) && null !== t.__slots) && rt$5(t, s, n, o, r, i), n.has(s) || i.delete(s), r.push(s));
			}
		}
		let it$5 = !1;
		let st$5 = 0;
		function lt$5(t) {
			st$5 = t.timeStamp;
		}
		function ct$5(t, e, n) {
			const o = "BR" === t.nodeName, r = e.__lexicalLineBreak;
			return r && (t === r || o && t.previousSibling === r) || o && void 0 !== Qs(t, n);
		}
		function at$5(t, e, n) {
			const o = Jl(Il(n)), r = o && nc(o, n._rootElement);
			let i = null, s = null;
			null !== r && r.anchorNode === t && (i = r.anchorOffset, s = r.focusOffset);
			const l = t.nodeValue;
			null !== l && fl(e, l, i, s, !1);
		}
		function ut$5(t, e, n) {
			if (ur(t)) {
				const e = t.anchor.getNode();
				if (e.is(n) && t.format !== e.getFormat()) return !1;
			}
			return zs(e) && n.isAttached();
		}
		function ft$6(t, e, n) {
			for (let o = t; o && !zc(o); o = wl(o)) {
				const t = Qs(o, e);
				if (void 0 !== t) {
					const e = Ys(t, n);
					if (e) return Ki(e) || !gc(o) ? void 0 : [o, e];
				}
			}
		}
		function dt$7(t, e, n) {
			it$5 = !0;
			const o = performance.now() - st$5 > 100;
			try {
				Ai(t, () => {
					const r = Kr() || function(t) {
						return t.read("latest", () => {
							const t = Kr();
							return null !== t ? t.clone() : null;
						});
					}(t), s = /* @__PURE__ */ new Map(), l = t._editorState, c = t._blockCursorElement;
					let a = !1, u = "";
					for (let n = 0; n < e.length; n++) {
						const f = e[n], d = f.type, h = f.target, g = ft$6(h, t, l);
						if (!g) continue;
						const [_, p] = g;
						if ("characterData" === d) o && Xo(p) && zs(h) && ut$5(r, h, p) && at$5(h, p, t);
						else if ("childList" === d) {
							a = !0;
							const e = f.addedNodes;
							for (let n = 0; n < e.length; n++) {
								const o = e[n], r = Gs(o), s = o.parentNode;
								if (!(null == s || o === c || null !== r || ct$5(o, s, t) || t._slotsUsed && gc(o) && o.hasAttribute("data-lexical-slot") || zc(o))) {
									if (i) {
										const t = (gc(o) ? o.innerText : null) || o.nodeValue;
										t && (u += t);
									}
									s.removeChild(o);
								}
							}
							const n = f.removedNodes, o = n.length;
							if (o > 0) {
								let e = 0;
								for (let r = 0; r < o; r++) {
									const o = n[r];
									(ct$5(o, h, t) || c === o) && (h.appendChild(o), e++);
								}
								o !== e && s.set(_, p);
							}
						}
					}
					if (s.size > 0) for (const [e, n] of s) n.reconcileObservedMutation(e, t);
					const f = n.takeRecords();
					if (f.length > 0) {
						for (let e = 0; e < f.length; e++) {
							const n = f[e], o = n.addedNodes, r = n.target;
							for (let e = 0; e < o.length; e++) {
								const n = o[e], i = n.parentNode;
								null == i || "BR" !== n.nodeName || ct$5(n, r, t) || i.removeChild(n);
							}
						}
						n.takeRecords();
					}
					null !== r && (a && ol(r), i && bl(t) && r.insertRawText(u));
				});
			} finally {
				it$5 = !1;
			}
		}
		function ht$7(t) {
			const e = t._observer;
			if (null !== e) dt$7(t, e.takeRecords(), e);
		}
		function gt$6(t) {
			(function(t) {
				0 === st$5 && Il(t).addEventListener("textInput", lt$5, !0);
			})(t), t._observer = new MutationObserver((e, n) => {
				dt$7(t, e, n);
			});
		}
		const _t$6 = "direct";
		const pt$7 = "latest";
		var yt$6 = class {
			key;
			parse;
			unparse;
			isEqual;
			defaultValue;
			resetOnCopyNode;
			constructor(t, e) {
				this.key = t, this.parse = e.parse.bind(e), this.unparse = (e.unparse || wt$6).bind(e), this.isEqual = (e.isEqual || Object.is).bind(e), this.defaultValue = this.parse(void 0), this.resetOnCopyNode = e.resetOnCopyNode || !1;
			}
		};
		function mt$7(t, e) {
			return new yt$6(t, e);
		}
		function xt$7(t, e, n = pt$7) {
			const o = (n === "latest" ? t.getLatest() : t).__state;
			return o ? o.getValue(e) : e.defaultValue;
		}
		function Ct$7(t, e, n) {
			const o = xt$7(t, n, _t$6), r = xt$7(e, n, _t$6);
			return n.isEqual(o, r) ? null : [o, r];
		}
		function St$7(t, e, n) {
			let o;
			if (fi(), "function" == typeof n) {
				const r = t.getLatest(), i = xt$7(r, e);
				if (o = n(i), e.isEqual(i, o)) return r;
			} else o = n;
			const r = t.getWritable();
			return bt$7(r).updateFromKnown(e, o), r;
		}
		function vt$7(t) {
			const e = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set();
			for (const { ownNodeConfig: o } of jc("function" == typeof t ? t : t.replace)) if (o && o.stateConfigs) for (const t of o.stateConfigs) {
				let o;
				"stateConfig" in t ? (o = t.stateConfig, t.flat && n.add(o.key)) : o = t, e.set(o.key, o);
			}
			return {
				flatKeys: n,
				sharedConfigMap: e
			};
		}
		const Tt$8 = /* @__PURE__ */ new Set([
			"__proto__",
			"constructor",
			"prototype"
		]);
		var kt$6 = class kt$6 {
			node;
			knownState;
			unknownState;
			sharedNodeState;
			size;
			constructor(t, e, n = void 0, o = /* @__PURE__ */ new Map(), r = void 0) {
				this.node = t, this.sharedNodeState = e, this.unknownState = n, this.knownState = o;
				const { sharedConfigMap: i } = this.sharedNodeState, s = void 0 !== r ? r : function(t, e, n) {
					let o = n.size;
					if (e) for (const r in e) {
						const e = t.get(r);
						e && n.has(e) || o++;
					}
					return o;
				}(i, n, o);
				this.size = s;
			}
			getValue(t) {
				const e = this.knownState.get(t);
				if (void 0 !== e) return e;
				this.sharedNodeState.sharedConfigMap.set(t.key, t);
				let n = t.defaultValue;
				if (this.unknownState && t.key in this.unknownState) {
					const e = this.unknownState[t.key];
					void 0 !== e && (n = t.parse(e)), this.updateFromKnown(t, n);
				}
				return n;
			}
			getInternalState() {
				return [this.unknownState, this.knownState];
			}
			toJSON() {
				const t = { ...this.unknownState }, e = {};
				for (const [e, n] of this.knownState) e.isEqual(n, e.defaultValue) ? delete t[e.key] : t[e.key] = e.unparse(n);
				for (const n of this.sharedNodeState.flatKeys) n in t && (e[n] = t[n], delete t[n]);
				return Et$6(t) && (e.$ = t), e;
			}
			getWritable(t) {
				if (this.node === t) return this;
				const { sharedNodeState: e, unknownState: n } = this, o = new Map(this.knownState);
				return new kt$6(t, e, function(t, e, n) {
					let o;
					if (n) for (const [r, i] of Object.entries(n)) {
						if (Tt$8.has(r)) continue;
						const n = t.get(r);
						n ? e.has(n) || e.set(n, n.parse(i)) : (o = o || {}, o[r] = i);
					}
					return o;
				}(e.sharedConfigMap, o, n), o, this.size);
			}
			resetOnCopyNode() {
				for (const t of this.knownState.keys()) t.resetOnCopyNode && this.knownState.set(t, t.defaultValue);
				return this;
			}
			updateFromKnown(t, e) {
				const n = t.key;
				this.sharedNodeState.sharedConfigMap.set(n, t);
				const { knownState: o, unknownState: r } = this;
				o.has(t) || r && n in r || (r && (delete r[n], this.unknownState = Et$6(r)), this.size++), o.set(t, e);
			}
			updateFromUnknown(t, e) {
				if (Tt$8.has(t)) return;
				const n = this.sharedNodeState.sharedConfigMap.get(t);
				n ? this.updateFromKnown(n, n.parse(e)) : (this.unknownState = this.unknownState || {}, t in this.unknownState || this.size++, this.unknownState[t] = e);
			}
			updateFromJSON(t) {
				const { knownState: e } = this;
				for (const t of e.keys()) e.set(t, t.defaultValue);
				if (this.size = e.size, this.unknownState = void 0, t) for (const [e, n] of Object.entries(t)) this.updateFromUnknown(e, n);
			}
		};
		function bt$7(t) {
			const e = t.getWritable(), n = e.__state ? e.__state.getWritable(e) : new kt$6(e, Nt$7(e));
			return e.__state = n, n;
		}
		function Nt$7(t) {
			return t.__state ? t.__state.sharedNodeState : Ns(vc(), t.getType()).sharedNodeState;
		}
		function Et$6(t) {
			if (t) for (const e in t) return t;
		}
		function wt$6(t) {
			return t;
		}
		function Ot$7(t, e, n) {
			for (const [o, r] of e.knownState) {
				if (t.has(o.key)) continue;
				t.add(o.key);
				const e = n ? n.getValue(o) : o.defaultValue;
				if (e !== r && !o.isEqual(e, r)) return !0;
			}
			return !1;
		}
		function Mt$6(t, e, n) {
			const { unknownState: o } = e, r = n ? n.unknownState : void 0;
			if (o) for (const [e, n] of Object.entries(o)) {
				if (t.has(e)) continue;
				t.add(e);
				if (n !== (r ? r[e] : void 0)) return !0;
			}
			return !1;
		}
		function At$7(t, e) {
			const n = t.__state;
			return n && n.node === t ? n.getWritable(e) : n;
		}
		function Dt$6(t, e) {
			const n = t.__mode, o = t.__format, r = t.__style, i = e.__mode, s = e.__format, l = e.__style, c = t.__state, a = e.__state;
			return (null === n || n === i) && (null === o || o === s) && (null === r || r === l) && (null === t.__state || c === a || function(t, e) {
				if (t === e) return !0;
				const n = /* @__PURE__ */ new Set();
				return !(t && Ot$7(n, t, e) || e && Ot$7(n, e, t) || t && Mt$6(n, t, e) || e && Mt$6(n, e, t));
			}(c, a));
		}
		function Ft$6(t, e) {
			const n = t.mergeWithSibling(e), o = _i()._normalizedNodes;
			return o.add(t.__key), o.add(e.__key), n;
		}
		function Pt$7(t) {
			let e, n, o = t;
			if ("" !== o.__text || !o.isSimpleText() || o.isUnmergeable()) {
				for (; null !== (e = o.getPreviousSibling()) && Xo(e) && e.isSimpleText() && !e.isUnmergeable();) {
					if ("" !== e.__text) {
						if (Dt$6(e, o)) {
							o = Ft$6(e, o);
							break;
						}
						break;
					}
					e.remove();
				}
				for (; null !== (n = o.getNextSibling()) && Xo(n) && n.isSimpleText() && !n.isUnmergeable();) {
					if ("" !== n.__text) {
						if (Dt$6(o, n)) {
							o = Ft$6(o, n);
							break;
						}
						break;
					}
					n.remove();
				}
			} else o.remove();
		}
		function It$5(t) {
			return Lt$6(t.anchor), Lt$6(t.focus), t;
		}
		function Lt$6(t) {
			for (; "element" === t.type;) {
				const e = t.getNode(), n = t.offset;
				let o, r;
				if (n === e.getChildrenSize() ? (o = e.getChildAtIndex(n - 1), r = !0) : (o = e.getChildAtIndex(n), r = !1), Xo(o)) {
					t.set(o.__key, r ? o.getTextContentSize() : 0, "text", !0);
					break;
				}
				if (!Pi(o)) break;
				t.set(o.__key, r ? o.getChildrenSize() : 0, "element", !0);
			}
		}
		const Kt$7 = Symbol.for("@lexical/CachedTextSize");
		function zt$6(e, n) {
			return ee$5.read(() => {
				let o = 0, r = e;
				for (let e = 0; e < n && null !== r; e++) {
					const i = te$5.get(r);
					if (void 0 === i && t(345, r), Pi(i)) {
						const s = ne$4.get(r);
						if (void 0 !== s && Pi(s) && s.__parent !== i.__parent) o += i.getTextContentSize();
						else {
							const e = oe$4.get(r), n = e && e.__lexicalTextContent;
							"string" != typeof n && t(346, i.getType()), o += n.length;
						}
						e < n - 1 && !i.isInline() && (o += 2);
					} else {
						const e = i[Kt$7];
						void 0 === e && t(347, i.getType(), r), o += e;
					}
					r = i.__next;
				}
				return o;
			}, { editor: $t$7 });
		}
		function Bt$6(t) {
			Pi(t) || void 0 === t[Kt$7] && (t[Kt$7] = Xo(t) ? t.__text.length : t.getTextContentSize());
		}
		const Rt$7 = 4;
		let Wt$5;
		let $t$7;
		let Ut$6;
		let Ht$5 = "";
		let jt$5 = null;
		let Jt$5 = null;
		let Vt$5 = null;
		function qt$6() {
			return {
				firstTextKey: Vt$5,
				format: jt$5,
				style: Jt$5
			};
		}
		function Yt$5(t) {
			null !== t.firstTextKey && (jt$5 = t.format, Jt$5 = t.style, Vt$5 = t.firstTextKey);
		}
		function Gt$5(e) {
			if (null !== Vt$5) return;
			const n = e.__lexicalFirstTextKey;
			if (void 0 === n && t(348), null === n) return;
			const o = ne$4.get(n);
			Xo(o) && (jt$5 = o.getFormat(), Jt$5 = o.getStyle(), Vt$5 = n);
		}
		let Xt$5;
		let Qt$5;
		let Zt$5;
		let te$5;
		let ee$5;
		let ne$4;
		let oe$4;
		let re$4;
		let ie$4;
		let se$4;
		let le$3 = !1;
		let ce$3 = !1;
		function ae$2(t, e) {
			const n = te$5.get(t), o = ne$4.has(t);
			if (null !== e) {
				const n = Fe$2(t);
				n.parentNode === e && e.removeChild(n);
			}
			if (!o) {
				if ($t$7._keyToDOMMap.delete(t), Pi(n)) {
					const t = Yc(n, te$5);
					ue$2(t, 0, t.length - 1, null);
				}
				if (void 0 !== n) {
					for (const t of xe$2(n).values()) {
						const e = Se$2(t);
						ae$2(t, null), null !== e && e.remove();
					}
					Sl(ie$4, Ut$6, Xt$5, n, "destroyed");
				}
			}
		}
		function ue$2(t, e, n, o) {
			for (let r = e; r <= n; ++r) {
				const e = t[r];
				void 0 !== e && ae$2(e, o);
			}
		}
		function fe$2(t, e) {
			t.setProperty("text-align", e);
		}
		const de$2 = "40px";
		function he$2(t, e) {
			const n = Wt$5.theme.indent;
			if ("string" == typeof n) {
				const o = t.classList.contains(n);
				e > 0 && !o ? t.classList.add(n) : e < 1 && o && t.classList.remove(n);
			}
			t.style.setProperty("padding-inline-start", 0 === e ? "" : `calc(${e} * var(--lexical-indent-base-value, ${de$2}))`);
		}
		function ge$2(t, e) {
			const n = t.style;
			0 === e ? fe$2(n, "") : 1 === e ? fe$2(n, "left") : 2 === e ? fe$2(n, "center") : 3 === e ? fe$2(n, "right") : 4 === e ? fe$2(n, "justify") : 5 === e ? fe$2(n, "start") : 6 === e && fe$2(n, "end");
		}
		function _e$2(t, e) {
			const n = function(t) {
				const e = t.__dir;
				if (null !== e) return e;
				if (Bi(t)) return null;
				const n = t.getParent();
				return null === n || Bl(n) && null === n.__dir ? "auto" : null;
			}(e);
			null !== n ? t.dir = n : t.removeAttribute("dir");
		}
		function pe$2(t) {
			const e = Zl().createElement("div");
			return e.setAttribute("data-lexical-slot", t), e.style.display = "none", e;
		}
		function ye$2(t, e, n) {
			e || "false" === t.contentEditable ? Bc(n, $t$7) : n.removeAttribute("contenteditable");
		}
		function me$2(t, e, n) {
			const o = Ht$5, r = qt$6();
			Ht$5 = "";
			let i = "";
			const s = Ki(t);
			for (const [o, r] of n) {
				const n = pe$2(o);
				ye$2(e, s, n), e.appendChild(n), Ht$5 = "";
				const l = qt$6();
				Te$2(r, kc(t, n, $t$7)), Yt$5(l), Ce$2(t, o, e, n), i += Ht$5;
			}
			return Yt$5(r), Ht$5 = o, i;
		}
		function xe$2(t) {
			return Qc(t) && null !== t.__slots ? t.__slots : Xc;
		}
		function Ce$2(t, e, n, o) {
			const r = se$4.$getSlotTargetElement(t, e, n, $t$7);
			null !== r && (o.parentElement !== r && r.appendChild(o), o.style.display = "");
		}
		function Se$2(t) {
			const e = oe$4.get(t);
			return void 0 !== e ? e.parentElement : null;
		}
		function ve$2(t, e, n) {
			const o = xe$2(t), r = xe$2(e);
			for (const [t, e] of o) if (!r.has(t)) {
				const t = Se$2(e);
				ae$2(e, null), null !== t && t.remove();
			}
			const i = Ht$5, s = qt$6();
			let l = "", c = null;
			const a = Ki(e);
			for (const [t, i] of r) {
				const r = o.get(t);
				let s = void 0 !== r ? Se$2(r) : null;
				Ht$5 = "";
				const u = qt$6();
				if (null === s) {
					s = pe$2(t);
					let o = null;
					for (const t of n.children) if (!t.hasAttribute("data-lexical-slot")) {
						o = t;
						break;
					}
					n.insertBefore(s, o), Te$2(i, kc(e, s, $t$7));
				} else r === i ? we$2(i, s) : (void 0 !== r && ae$2(r, s), Te$2(i, kc(e, s, $t$7)));
				if (Yt$5(u), ye$2(n, a, s), Ce$2(e, t, n, s), l += Ht$5, s.parentElement === n) {
					const t = null === c ? n.firstChild : c.nextSibling;
					t !== s && n.insertBefore(s, t), c = s;
				}
			}
			return Yt$5(s), Ht$5 = i, l;
		}
		function Te$2(e, n) {
			const o = ne$4.get(e);
			if (void 0 === o && t(60), null !== n) {
				const t = te$5.get(e);
				if (void 0 !== t) {
					const r = oe$4.get(e);
					if (void 0 !== r) {
						const i = Zc(t) ? t.__slotHost : null, s = Zc(o) ? o.__slotHost : null, l = t.__parent !== o.__parent || i !== s, c = null !== s && r.parentElement !== n.element;
						if (l || c) return n.insertChild(r), we$2(e, n.element);
					}
				}
			}
			const r = se$4.$createDOM(o, $t$7);
			if (function(t, e, n) {
				const o = n._keyToDOMMap;
				Xs(e, n, t), o.set(t, e);
			}(e, r, $t$7), Xo(o) ? r.setAttribute("data-lexical-text", "true") : Ki(o) && (r.setAttribute("data-lexical-decorator", "true"), Kc(r, { captureSelection: !0 })), Pi(o)) {
				const t = o.__indent, e = o.__size;
				_e$2(r, o), 0 !== t && he$2(r, t);
				const n = xe$2(o), i = n.size > 0 ? me$2(o, r, n) : "";
				if (0 === e) r.__lexicalTextContent = i, r.__lexicalFirstTextKey = null, Ht$5 += i, n.size > 0 && (r.__lexicalSlotTextLength = i.length);
				else {
					const t = Ht$5, s = e - 1;
					if (ke$2(Yc(o, ne$4), o, 0, s, kc(o, r, $t$7)), "" !== i) {
						const e = r.__lexicalTextContent || "";
						r.__lexicalTextContent = i + e, Ht$5 = t + i + e;
					}
					n.size > 0 && (r.__lexicalSlotTextLength = i.length);
				}
				const s = o.__format;
				0 !== s && ge$2(r, s), o.isInline() || be$2(null, o, r);
			} else {
				const t = o.getTextContent();
				if (Ki(o)) {
					const t = o.decorate($t$7, Wt$5);
					null !== t && Oe$2(e, t), r.contentEditable = "false";
					const n = xe$2(o);
					n.size > 0 && me$2(o, r, n);
				}
				Ht$5 += t;
			}
			return null !== n && n.insertChild(r), se$4.$decorateDOM(o, null, r, $t$7), Bt$6(o), Sl(ie$4, Ut$6, Xt$5, o, "created"), r;
		}
		function ke$2(e, n, o, r, i) {
			const s = Ht$5, l = qt$6();
			Ht$5 = "", jt$5 = null, Jt$5 = null, Vt$5 = null;
			let c = o;
			for (; c <= r; ++c) {
				const t = qt$6();
				Te$2(e[c], i);
				const n = ne$4.get(e[c]);
				null !== n && Xo(n) ? null === jt$5 && (jt$5 = n.getFormat(), Jt$5 = n.getStyle(), Vt$5 = n.__key) : Pi(n) && c < r && !n.isInline() && (Ht$5 += D$2), Yt$5(t);
			}
			const a = $t$7._keyToDOMMap.get(n.__key);
			void 0 === a && t(349, n.__key), a.__lexicalTextContent = Ht$5, a.__lexicalFirstTextKey = Vt$5, Ht$5 = s + Ht$5, Yt$5(l);
		}
		function be$2(t, e, n) {
			const o = kc(e, n, $t$7), r = o.element.__lexicalLastChildKind ?? null, i = function(t, e) {
				if (t) {
					const n = t.__last;
					if (n) {
						const t = e.get(n);
						if (t) return Yi(t) ? "line-break" : Ki(t) && t.isInline() ? "decorator" : null;
					}
					return xe$2(t).size > 0 ? null : "empty";
				}
				return null;
			}(e, ne$4);
			r !== i && o.setManagedLineBreak(i);
		}
		function Ne$2(e, n, o) {
			var r;
			jt$5 = null, Jt$5 = null, Vt$5 = null, function(e, n, o) {
				const r = Ht$5, i = e.__size, s = n.__size;
				Ht$5 = "";
				const l = o.element, c = $t$7._keyToDOMMap.get(n.__key);
				void 0 === c && t(351, n.__key);
				const a = s - i;
				if (!le$3 && Math.abs(a) <= 1 && i >= Rt$7 && e.__first === n.__first && (0 !== a || !$t$7._cloneNotNeeded.has(e.__key))) {
					const i = c.__lexicalTextContent, u = re$4.get(e.__key);
					if (!le$3 && "string" == typeof i && void 0 !== u) {
						const s = function(t, e) {
							const n = e.size;
							if (0 === n || n >= t.__size) return null;
							let o = t.__last, r = null, i = 0;
							for (; null !== o && i < n;) {
								if (!e.has(o)) return null;
								r = o;
								const t = ne$4.get(o);
								if (void 0 === t) return null;
								o = t.__prev, i++;
							}
							if (i !== n) return null;
							if (null !== o && e.has(o)) return null;
							return r;
						}(n, u);
						if (null !== s) {
							const f = u.size;
							if (0 === a) {
								const e = zt$6(s, f);
								let o = s, a = 0;
								for (; null !== o && a < f;) {
									const t = ne$4.get(o);
									if (void 0 === t) break;
									const e = qt$6();
									we$2(o, l), Xo(t) && null === jt$5 && (jt$5 = t.getFormat(), Jt$5 = t.getStyle(), Vt$5 = t.__key), Yt$5(e), o = t.__next, a++;
								}
								let d = "";
								for (o = s, a = 0; null !== o && a < f;) {
									const e = ne$4.get(o);
									if (void 0 === e) break;
									let n;
									if (Pi(e)) {
										const r = $t$7._keyToDOMMap.get(o), i = r && r.__lexicalTextContent;
										"string" != typeof i && t(352, e.getType()), n = i;
									} else n = e.getTextContent();
									d += n, a < f - 1 && Pi(e) && !e.isInline() && (d += D$2), o = e.__next, a++;
								}
								const h = c.__lexicalSlotTextLength || 0, g = h > 0 ? i.slice(h) : i, _ = g.slice(0, g.length - e) + d;
								c.__lexicalTextContent = _, Ht$5 = r + _, Ee$2(n, c, u);
								return;
							}
							if (function(e, n, o, r, i, s, l, c) {
								if (1 !== c && -1 !== c) return !1;
								if (l !== (1 === c ? 2 : 1)) return !1;
								const u = l - c;
								let f = e.__last;
								for (let t = 0; t < u - 1; t++) {
									if (null === f) return !1;
									const t = te$5.get(f);
									if (void 0 === t) return !1;
									f = t.__prev;
								}
								if (null === f) return !1;
								const d = ne$4.get(s), h = te$5.get(f);
								if (void 0 === d || void 0 === h) return !1;
								if (d.__prev !== h.__prev) return !1;
								const g = [];
								let _ = s;
								for (let t = 0; t < l; t++) {
									if (null === _) return !1;
									g.push(_);
									const t = ne$4.get(_);
									_ = t ? t.__next : null;
								}
								const p = [];
								_ = f;
								for (let t = 0; t < u; t++) {
									if (null === _) return !1;
									p.push(_);
									const t = te$5.get(_);
									_ = t ? t.__next : null;
								}
								const y = new Set(p), m = new Set(g), x = [];
								let C = 0, S = 0;
								for (; C < u && S < l;) if (g[S] === p[C]) x.push({
									key: g[S],
									kind: "reconcile"
								}), C++, S++;
								else if (m.has(p[C])) {
									if (y.has(g[S])) return !1;
									x.push({
										key: g[S],
										kind: "create",
										nextIndex: S
									}), S++;
								} else x.push({
									key: p[C],
									kind: "destroy"
								}), C++;
								for (; C < u;) x.push({
									key: p[C++],
									kind: "destroy"
								});
								for (; S < l;) x.push({
									key: g[S],
									kind: "create",
									nextIndex: S
								}), S++;
								const v = zt$6(f, u);
								for (const t of x) {
									const e = qt$6();
									if ("reconcile" === t.kind) we$2(t.key, o.element);
									else if ("destroy" === t.kind) ae$2(t.key, o.element);
									else {
										let e = null;
										for (let n = t.nextIndex + 1; n < l; n++) {
											const t = $t$7._keyToDOMMap.get(g[n]);
											if (void 0 !== t) {
												e = t;
												break;
											}
										}
										Te$2(t.key, o.withBefore(e ?? o.before));
									}
									if ("destroy" !== t.kind) {
										const e = ne$4.get(t.key);
										e && Xo(e) && null === jt$5 && (jt$5 = e.getFormat(), Jt$5 = e.getStyle(), Vt$5 = e.__key);
									}
									Yt$5(e);
								}
								let T = "";
								for (let e = 0; e < l; e++) {
									const n = ne$4.get(g[e]);
									if (void 0 === n) return !1;
									let o;
									if (Pi(n)) {
										const r = $t$7._keyToDOMMap.get(g[e]), i = r && r.__lexicalTextContent;
										"string" != typeof i && t(350, n.getType()), o = i;
									} else o = n.getTextContent();
									T += o, e < l - 1 && Pi(n) && !n.isInline() && (T += D$2);
								}
								const k = r.__lexicalSlotTextLength || 0, b = k > 0 ? i.slice(k) : i;
								return r.__lexicalTextContent = b.slice(0, b.length - v) + T, !0;
							}(e, 0, o, c, i, s, f, a)) {
								const e = c.__lexicalTextContent;
								"string" != typeof e && t(353), Ht$5 = r + e, Ee$2(n, c, u);
								return;
							}
						}
					}
					if (0 === a) {
						let n = e.__first, o = 0;
						for (; null !== n;) {
							const e = ne$4.get(n);
							if (void 0 === e) break;
							const r = le$3 || Zt$5.has(n) || Qt$5.has(n), i = qt$6();
							if (r) we$2(n, l);
							else {
								let o, r;
								if (Pi(e)) {
									r = oe$4.get(n);
									const i = r && r.__lexicalTextContent;
									"string" != typeof i && t(354, e.getType()), o = i;
								} else o = e.getTextContent();
								Ht$5 += o, void 0 !== r && Gt$5(r);
							}
							Xo(e) ? null === jt$5 && (jt$5 = e.getFormat(), Jt$5 = e.getStyle(), Vt$5 = e.__key) : Pi(e) && o < s - 1 && !e.isInline() && (Ht$5 += D$2), Yt$5(i), n = e.__next, o++;
						}
						c.__lexicalTextContent = Ht$5, c.__lexicalFirstTextKey = Vt$5, Ht$5 = r + Ht$5;
						return;
					}
				}
				if (1 === i && 1 === s) {
					const t = e.__first, r = n.__first;
					if (t === r) we$2(t, l);
					else {
						const e = Fe$2(t), n = Te$2(r, null);
						try {
							e.parentNode === l ? l.replaceChild(n, e) : o.insertChild(n);
						} catch (o) {
							if ("object" == typeof o && null != o) {
								const i = `${o.toString()} Parent: ${l.tagName}, new child: {tag: ${n.tagName} key: ${r}}, old child: {tag: ${e.tagName}, key: ${t}}.`;
								throw new Error(i);
							}
							throw o;
						}
						ae$2(t, null);
					}
					const i = ne$4.get(r);
					Xo(i) && null === jt$5 && (jt$5 = i.getFormat(), Jt$5 = i.getStyle(), Vt$5 = i.__key);
				} else {
					const r = Yc(e, te$5), c = Yc(n, ne$4);
					if (r.length !== i && t(227), c.length !== s && t(228), 0 === i) 0 !== s && ke$2(c, n, 0, s - 1, o);
					else if (0 === s) {
						if (0 !== i) {
							const t = null == o.after && null == o.before && 0 === xe$2(n).size && null == o.element.__lexicalLineBreak;
							ue$2(r, 0, i - 1, t ? null : l), t && (l.textContent = "");
						}
					} else (function(t, e, n, o, r, i) {
						const s = o - 1, l = r - 1;
						let c, a, u = i.getFirstChild(), f = 0, d = 0;
						for (; f <= s && d <= l;) {
							const t = e[f], o = n[d], r = qt$6();
							if (t === o) u = Me$2(we$2(o, i.element)), f++, d++;
							else {
								if (void 0 === a && (a = Ae$2(n, d)), void 0 === c) c = Ae$2(e, f);
								else if (!c.has(t)) {
									f++, Yt$5(r);
									continue;
								}
								if (!a.has(t)) {
									u = Me$2(Fe$2(t)), ae$2(t, i.element), f++, c.delete(t), Yt$5(r);
									continue;
								}
								if (c.has(o)) {
									const t = El($t$7, o);
									t !== u && i.withBefore(u ?? i.before).insertChild(t), u = Me$2(we$2(o, i.element)), f++, d++;
								} else Te$2(o, i.withBefore(u ?? i.before)), d++;
							}
							const s = ne$4.get(o);
							null !== s && Xo(s) ? null === jt$5 && (jt$5 = s.getFormat(), Jt$5 = s.getStyle(), Vt$5 = s.__key) : Pi(s) && d <= l && !s.isInline() && (Ht$5 += D$2), Yt$5(r);
						}
						const h = f > s, g = d > l;
						if (h && !g) {
							const e = n[l + 1], o = void 0 === e ? null : $t$7.getElementByKey(e);
							ke$2(n, t, d, l, i.withBefore(o ?? i.before));
						} else g && !h && ue$2(e, f, s, i.element);
					})(n, r, c, i, s, o);
				}
				c.__lexicalTextContent = Ht$5, c.__lexicalFirstTextKey = Vt$5, Ht$5 = r + Ht$5;
			}(e, n, kc(n, o, $t$7)), Bl(n) || (r = n, null == jt$5 || jt$5 === r.__textFormat || ce$3 || r.setTextFormat(jt$5), function(t) {
				null == Jt$5 || Jt$5 === t.__textStyle || ce$3 || t.setTextStyle(Jt$5);
			}(n));
		}
		function Ee$2(t, e, n) {
			const o = e.__lexicalFirstTextKey;
			if (null != o) {
				const e = t.__key;
				let r = o;
				for (; null !== r;) {
					const t = ne$4.get(r);
					if (void 0 === t) {
						r = null;
						break;
					}
					if (t.__parent === e) break;
					r = t.__parent;
				}
				if (null !== r && !n.has(r)) {
					const t = ne$4.get(o);
					if (Xo(t)) return jt$5 = t.getFormat(), void (Jt$5 = t.getStyle());
				}
			}
			e.__lexicalFirstTextKey = Vt$5;
		}
		function we$2(e, n) {
			const o = te$5.get(e);
			let r = ne$4.get(e);
			void 0 !== o && void 0 !== r || t(61);
			const i = le$3 || Zt$5.has(e) || Qt$5.has(e), s = El($t$7, e);
			if (o === r && !i) {
				let e;
				if (Pi(o)) {
					const n = s.__lexicalTextContent;
					"string" != typeof n && t(355, o.getType()), e = n, Gt$5(s);
				} else e = o.getTextContent();
				return Ht$5 += e, s;
			}
			if (o !== r && i && Sl(ie$4, Ut$6, Xt$5, r, "updated"), se$4.$updateDOM(r, o, s, $t$7)) {
				const o = Te$2(e, null);
				return null === n && t(62), n.replaceChild(o, s), ae$2(e, null), o;
			}
			if (Pi(o)) {
				Pi(r) || t(334, e);
				const n = r.__indent;
				(le$3 || n !== o.__indent) && he$2(s, n);
				const l = r.__format;
				(le$3 || l !== o.__format) && ge$2(s, l);
				const c = i && (xe$2(r).size > 0 || xe$2(o).size > 0) ? ve$2(o, r, s) : "";
				if (i) {
					const t = Ht$5;
					if (Ne$2(o, r, s), Bi(r) || r.isInline() || be$2(0, r, s), "" !== c) {
						const e = s.__lexicalTextContent || "";
						s.__lexicalTextContent = c + e, Ht$5 = t + c + e, s.__lexicalSlotTextLength = c.length;
					} else (xe$2(r).size > 0 || xe$2(o).size > 0) && (s.__lexicalSlotTextLength = 0);
				} else {
					const e = s.__lexicalTextContent;
					"string" != typeof e && t(356, o.getType()), Ht$5 += e, Gt$5(s);
				}
				if ((le$3 || r.__dir !== o.__dir || r.__parent !== o.__parent) && (_e$2(s, r), Bi(r) && !le$3)) {
					for (const t of r.getChildren()) if (Pi(t)) _e$2(El($t$7, t.getKey()), t);
				}
			} else {
				const t = r.getTextContent();
				if (Ki(r)) {
					const t = r.decorate($t$7, Wt$5);
					null !== t && Oe$2(e, t), i && (xe$2(r).size > 0 || xe$2(o).size > 0) && ve$2(o, r, s);
				}
				Ht$5 += t;
			}
			if (!ce$3 && Bi(r)) {
				const t = r.getLatest();
				if (t.__cachedText !== Ht$5) {
					const e = t.getWritable();
					e.__cachedText = Ht$5, r = e;
				}
			}
			return se$4.$decorateDOM(r, o, s, $t$7), Bt$6(r), s;
		}
		function Oe$2(t, e) {
			let n = $t$7._pendingDecorators;
			const o = $t$7._decorators;
			if (null === n) {
				if (o[t] === e) return;
				n = tl($t$7);
			}
			n[t] = e;
		}
		function Me$2(t) {
			let e = t.nextSibling;
			return null !== e && e === $t$7._blockCursorElement && (e = e.nextSibling), e;
		}
		function Ae$2(t, e) {
			const n = /* @__PURE__ */ new Set();
			for (let o = e; o < t.length; o++) n.add(t[o]);
			return n;
		}
		function De$2(t, e, n, o, r, i) {
			Ht$5 = "", jt$5 = null, Jt$5 = null, Vt$5 = null, le$3 = 2 === o, $t$7 = n, Wt$5 = n._config, se$4 = n._config.dom || ps, Ut$6 = n._nodes, Xt$5 = $t$7._listeners.mutation, Qt$5 = r, Zt$5 = i, te$5 = t._nodeMap, ee$5 = t, ne$4 = e._nodeMap, ce$3 = e._readOnly, oe$4 = nt$5(n._keyToDOMMap), re$4 = function() {
				const t = /* @__PURE__ */ new Map(), e = (e) => {
					for (const n of e) {
						const e = ne$4.get(n);
						if (void 0 === e) continue;
						const o = e.__parent;
						if (null === o) continue;
						let r = t.get(o);
						void 0 === r && (r = /* @__PURE__ */ new Set(), t.set(o, r)), r.add(n);
					}
				};
				return e(Qt$5.keys()), e(Zt$5), t;
			}();
			const s = /* @__PURE__ */ new Map();
			return ie$4 = s, we$2("root", null), $t$7 = void 0, Ut$6 = void 0, Qt$5 = void 0, Zt$5 = void 0, te$5 = void 0, ee$5 = void 0, ne$4 = void 0, Wt$5 = void 0, oe$4 = void 0, re$4 = void 0, ie$4 = void 0, se$4 = ps, s;
		}
		function Fe$2(e) {
			const n = oe$4.get(e);
			return void 0 === n && t(75, e), n;
		}
		function Pe$2(t) {
			return { type: t };
		}
		const Ie$2 = /* @__PURE__ */ Pe$2("SELECTION_CHANGE_COMMAND");
		const Le$2 = /* @__PURE__ */ Pe$2("SELECTION_INSERT_CLIPBOARD_NODES_COMMAND");
		const Ke$2 = /* @__PURE__ */ Pe$2("CLICK_COMMAND");
		const ze$2 = /* @__PURE__ */ Pe$2("BEFORE_INPUT_COMMAND");
		const Be$2 = /* @__PURE__ */ Pe$2("INPUT_COMMAND");
		const Re$2 = /* @__PURE__ */ Pe$2("COMPOSITION_START_COMMAND");
		const We$2 = /* @__PURE__ */ Pe$2("COMPOSITION_END_COMMAND");
		const $e$2 = /* @__PURE__ */ Pe$2("DELETE_CHARACTER_COMMAND");
		const Ue$2 = /* @__PURE__ */ Pe$2("INSERT_LINE_BREAK_COMMAND");
		const He$2 = /* @__PURE__ */ Pe$2("INSERT_PARAGRAPH_COMMAND");
		const je$2 = /* @__PURE__ */ Pe$2("CONTROLLED_TEXT_INSERTION_COMMAND");
		const Je$2 = /* @__PURE__ */ Pe$2("PASTE_COMMAND");
		const Ve$2 = /* @__PURE__ */ Pe$2("REMOVE_TEXT_COMMAND");
		const qe$2 = /* @__PURE__ */ Pe$2("DELETE_WORD_COMMAND");
		const Ye$2 = /* @__PURE__ */ Pe$2("DELETE_LINE_COMMAND");
		const Ge$2 = /* @__PURE__ */ Pe$2("FORMAT_TEXT_COMMAND");
		const Xe$2 = /* @__PURE__ */ Pe$2("SET_TEXT_FORMAT_COMMAND");
		const Qe$2 = /* @__PURE__ */ Pe$2("UNDO_COMMAND");
		const Ze$2 = /* @__PURE__ */ Pe$2("REDO_COMMAND");
		const tn$3 = /* @__PURE__ */ Pe$2("KEYDOWN_COMMAND");
		const en$3 = /* @__PURE__ */ Pe$2("KEY_ARROW_RIGHT_COMMAND");
		const nn$3 = /* @__PURE__ */ Pe$2("MOVE_TO_END");
		const on$3 = /* @__PURE__ */ Pe$2("KEY_ARROW_LEFT_COMMAND");
		const rn$3 = /* @__PURE__ */ Pe$2("MOVE_TO_START");
		const sn$3 = /* @__PURE__ */ Pe$2("KEY_ARROW_UP_COMMAND");
		const ln$3 = /* @__PURE__ */ Pe$2("KEY_ARROW_DOWN_COMMAND");
		const cn$3 = /* @__PURE__ */ Pe$2("KEY_ENTER_COMMAND");
		const an$3 = /* @__PURE__ */ Pe$2("KEY_SPACE_COMMAND");
		const un$3 = /* @__PURE__ */ Pe$2("KEY_BACKSPACE_COMMAND");
		const fn$3 = /* @__PURE__ */ Pe$2("KEY_ESCAPE_COMMAND");
		const dn$3 = /* @__PURE__ */ Pe$2("KEY_DELETE_COMMAND");
		const hn$3 = /* @__PURE__ */ Pe$2("KEY_TAB_COMMAND");
		const gn$3 = /* @__PURE__ */ Pe$2("INSERT_TAB_COMMAND");
		const _n$2 = /* @__PURE__ */ Pe$2("INDENT_CONTENT_COMMAND");
		const pn$3 = /* @__PURE__ */ Pe$2("OUTDENT_CONTENT_COMMAND");
		const yn$3 = /* @__PURE__ */ Pe$2("DROP_COMMAND");
		const mn$3 = /* @__PURE__ */ Pe$2("FORMAT_ELEMENT_COMMAND");
		const xn$3 = /* @__PURE__ */ Pe$2("DRAGSTART_COMMAND");
		const Cn$3 = /* @__PURE__ */ Pe$2("DRAGOVER_COMMAND");
		const Sn$3 = /* @__PURE__ */ Pe$2("DRAGEND_COMMAND");
		const vn$3 = /* @__PURE__ */ Pe$2("COPY_COMMAND");
		const Tn$1 = /* @__PURE__ */ Pe$2("CUT_COMMAND");
		const kn$3 = /* @__PURE__ */ Pe$2("SELECT_ALL_COMMAND");
		const bn$3 = /* @__PURE__ */ Pe$2("CLEAR_EDITOR_COMMAND");
		const Nn$3 = /* @__PURE__ */ Pe$2("CLEAR_HISTORY_COMMAND");
		const En$3 = /* @__PURE__ */ Pe$2("CAN_REDO_COMMAND");
		const wn$3 = /* @__PURE__ */ Pe$2("CAN_UNDO_COMMAND");
		const On$3 = /* @__PURE__ */ Pe$2("FOCUS_COMMAND");
		const Mn$3 = /* @__PURE__ */ Pe$2("BLUR_COMMAND");
		const An$2 = /* @__PURE__ */ Pe$2("KEY_MODIFIER_COMMAND");
		function Dn$3(t) {
			const e = /* @__PURE__ */ new Map();
			return {
				dispose() {
					for (const t of e.values()) t.dispose();
					e.clear();
				},
				register(n, o) {
					let r = e.get(n);
					void 0 === r && (r = {
						dispose: t(n, o),
						holders: /* @__PURE__ */ new Set()
					}, e.set(n, r));
					const i = () => {
						const t = e.get(n);
						t && t.holders.delete(i) && 0 === t.holders.size && (e.delete(n), t.dispose());
					};
					return r.holders.add(i), i;
				}
			};
		}
		function Fn$2(t, e, n, o) {
			return t.addEventListener(e, n, o), t.removeEventListener.bind(t, e, n, o);
		}
		const Pn$1 = Object.freeze({});
		const In$2 = [
			["keydown", function(t, e) {
				const n = e._inputState;
				n.lastKeyDownTimeStamp = t.timeStamp, n.lastKeyCode = t.key, "Backspace" !== t.key && Jn$1(n);
				if (e.isComposing()) return;
				Nl(e, tn$3, t);
			}],
			["pointerdown", function(t, e) {
				const n = ac(t), o = t.pointerType;
				_c(n) && "touch" !== o && "pen" !== o && 0 === t.button && Ai(e, () => {
					Rc(n, e) || (e._inputState.isSelectionChangeFromMouseDown = !0);
				});
			}],
			["compositionstart", function(t, e) {
				Nl(e, Re$2, t);
			}],
			["compositionend", function(t, e) {
				const n = e._inputState;
				i ? n.compositionPhase = "ending-firefox" : l || !a && !d ? Nl(e, We$2, t) : (n.compositionPhase = "ending-safari", n.compositionEndData = t.data);
			}],
			["input", function(t, e) {
				t.stopPropagation();
				const n = e._inputState;
				Jn$1(n), Ai(e, () => {
					qn$1(t, e) || e.dispatchCommand(Be$2, t);
				}, { event: t }), n.unprocessedBeforeInputData = null;
			}],
			["click", function(t, e) {
				Ai(e, () => {
					const n = Kr(), o = Jl(Il(e)), r = zr();
					if (o) {
						if (ur(n)) {
							const t = n.anchor, e = t.getNode();
							"element" === t.type && 0 === t.offset && n.isCollapsed() && !Bi(e) && 1 === nl().getChildrenSize() && e.getTopLevelElementOrThrow().isEmpty() && null !== r && n.is(r) && (o.removeAllRanges(), n.dirty = !0);
						} else if ("touch" === t.pointerType || "pen" === t.pointerType) {
							const n = nc(o, e._rootElement).anchorNode;
							if (gc(n) || zs(n)) ol(Lr(r, o, e, t));
						}
					}
					if (i && null !== o && 0 === o.rangeCount) {
						const n = e._rootElement;
						if (null !== n && t.target === n) {
							const i = t.clientY;
							let s = n.childNodes.length;
							for (let t = 0; t < n.childNodes.length; t++) {
								const e = n.childNodes[t];
								if (gc(e)) {
									const n = e.getBoundingClientRect();
									if (i <= (n.top + n.bottom) / 2) {
										s = t;
										break;
									}
								}
							}
							o.setBaseAndExtent(n, s, n, s);
							const l = Lr(r, o, e, t);
							null !== l ? ol(l) : o.removeAllRanges();
						}
					}
					Nl(e, Ke$2, t);
				});
			}],
			["cut", Pn$1],
			["copy", Pn$1],
			["dragstart", Pn$1],
			["dragover", Pn$1],
			["dragend", Pn$1],
			["paste", Pn$1],
			["focus", Pn$1],
			["blur", Pn$1],
			["drop", Pn$1]
		];
		s && In$2.push(["beforeinput", (t, e) => function(t, e) {
			const n = t.inputType;
			if ("deleteCompositionText" === n || i && bl(e)) return;
			if ("insertCompositionText" === n) return;
			Ai(e, () => {
				qn$1(t, e) || Nl(e, ze$2, t);
			}, { event: t });
		}(t, e)]);
		const Ln$1 = /* @__PURE__ */ new WeakMap();
		const Kn$1 = /* @__PURE__ */ new WeakMap();
		const zn$1 = Dn$3((t) => (t.addEventListener("selectionchange", ro$1), () => t.removeEventListener("selectionchange", ro$1)));
		function Bn$1(t, e, n, o, r, i) {
			const l = t.anchor, c = t.focus, a = l.getNode(), u = _i();
			let f;
			if (void 0 !== i) f = i;
			else {
				const t = Jl(Il(u));
				f = null !== t ? nc(t, u._rootElement) : null;
			}
			const d = null !== f ? f.anchorNode : null, h = l.key, g = u.getElementByKey(h), _ = n.length;
			return h !== c.key || !Xo(a) || (!r && (!s || u._inputState.lastBeforeInputInsertTextTimeStamp < o + 50) || a.isDirty() && _ < 2 || sl(n)) && l.offset !== c.offset && !a.isComposing() || Ks(a) || a.isDirty() && _ > 1 || (r || !s) && null !== g && !a.isComposing() && d !== wc(a, g, u) || null !== f && null !== e && (!e.collapsed || e.startContainer !== f.anchorNode || e.startOffset !== f.anchorOffset) || !a.isComposing() && (a.getFormat() !== t.format || a.getStyle() !== t.style) || function(t, e) {
				if (e.isSegmented()) return !0;
				if (!t.isCollapsed()) return !1;
				const n = t.anchor.offset, o = e.getParentOrThrow(), r = Ls(e);
				return 0 === n ? !e.canInsertTextBefore() || !o.canInsertTextBefore() && !e.isComposing() || r || function(t) {
					const e = t.getPreviousSibling();
					return (Xo(e) || Pi(e) && e.isInline()) && !e.canInsertTextAfter();
				}(e) : n === e.getTextContentSize() && (!e.canInsertTextAfter() || !o.canInsertTextAfter() && !e.isComposing() || r);
			}(t, a);
		}
		function Rn$2(t, e) {
			return zs(t) && null !== t.nodeValue && 0 !== e && e !== t.nodeValue.length;
		}
		function Wn$1(e, n, o) {
			const { anchorNode: r, anchorOffset: i, focusNode: s, focusOffset: l } = nc(e, n._rootElement), c = n._inputState;
			c.isSelectionChangeFromDOMUpdate && (c.isSelectionChangeFromDOMUpdate = !1, Rn$2(r, i) && Rn$2(s, l) && !c.postDeleteSelectionToRestore) || Ai(n, () => {
				if (!o) return void ol(null);
				if (!As(n, r, s)) return;
				let a = Kr();
				if (c.postDeleteSelectionToRestore && ur(a) && a.isCollapsed()) {
					const t = a.anchor, e = c.postDeleteSelectionToRestore.anchor;
					(t.key === e.key && t.offset === e.offset + 1 || 1 === t.offset && e.getNode().is(t.getNode().getPreviousSibling())) && (a = c.postDeleteSelectionToRestore.clone(), ol(a));
				}
				if (c.postDeleteSelectionToRestore = null, ur(a)) {
					const o = a.anchor, u = o.getNode();
					if (a.isCollapsed()) {
						"Range" === e.type && r === s && (a.dirty = !0);
						const i = Il(n).event, l = i ? i.timeStamp : performance.now(), { format: f, style: d, offset: h, key: g, timeStamp: _ } = c.collapsedSelectionFormat, p = nl(), y = !1 === n.isComposing() && "" === p.getTextContent();
						if (l < _ + 200 && o.offset === h && o.key === g) $n$2(a, f, d);
						else if ("text" === o.type) Xo(u) || t(141), Un$1(a, u);
						else if ("element" === o.type && !y) {
							Pi(u) || t(259);
							const e = o.getNode();
							e.isEmpty() ? function(t, e) {
								$n$2(t, e.getTextFormat(), e.getTextStyle());
							}(a, e) : $n$2(a, a.format, "");
						}
					} else {
						const t = o.key, e = a.focus.key, n = a.getNodes(), r = n.length, s = a.isBackward(), c = s ? l : i, u = s ? i : l, f = s ? e : t, d = s ? t : e;
						let h = 2047, g = !1;
						for (let t = 0; t < r; t++) {
							const e = n[t], o = e.getTextContentSize();
							if (Xo(e) && 0 !== o && !(0 === t && e.__key === f && c === o || t === r - 1 && e.__key === d && 0 === u) && (g = !0, h &= e.getFormat(), 0 === h)) break;
						}
						a.format = g ? h : 0;
					}
				}
				Nl(n, Ie$2);
			});
		}
		function $n$2(t, e, n) {
			t.format === e && t.style === n || (t.format = e, t.style = n, t.dirty = !0);
		}
		function Un$1(t, e) {
			$n$2(t, e.getFormat(), e.getStyle());
		}
		function Hn$1(t) {
			if (!t.getTargetRanges) return null;
			const e = t.getTargetRanges();
			return 0 === e.length ? null : e[0];
		}
		function jn$1(t) {
			const { lastKeyCode: e } = _i()._inputState;
			if (null == t || t.length <= 1 || null == e) return;
			const n = 1 === e.length ? e : "Enter" === e ? "\n" : "Tab" === e ? "	" : null;
			if (!n) return;
			const o = Kr();
			if (!ur(o) || !o.isCollapsed()) return;
			const r = o.anchor.getNode();
			if (!Xo(r)) return;
			const { offset: i } = o.anchor;
			if (r.getTextContentSize() === i) {
				const t = r.getNextSibling();
				if ("\n" === n) {
					if (Yi(t)) t.selectEnd();
					else if (!t) {
						const t = qc(r, Ar), e = t && t.getNextSibling();
						Pi(e) && e.selectStart();
					}
				} else "	" === n ? er(t) && t.selectEnd() : Xo(t) && t.getTextContent()[0] === n && t.select(1, 1);
			} else r.getTextContent()[i] === n && r.select(i + 1, i + 1);
		}
		function Jn$1(t) {
			t.isInsertTextAfterHandledSelectionCommand = !1, null !== t.handledSelectionCommandTimeoutId && (clearTimeout(t.handledSelectionCommandTimeoutId), t.handledSelectionCommandTimeoutId = null);
		}
		function Vn$1(t) {
			Jn$1(t), t.isInsertTextAfterHandledSelectionCommand = !0, t.handledSelectionCommandTimeoutId = setTimeout(() => Jn$1(t), 0);
		}
		function qn$1(t, e) {
			const n = ac(t);
			if (gc(n) && Rc(n, e)) return !0;
			const o = e.getRootElement();
			if (null === o) return !1;
			const r = cc(o.ownerDocument);
			return null !== r && o.contains(r) && Rc(r, e);
		}
		function Yn$1(e) {
			const n = e.inputType, o = Hn$1(e), r = _i(), i = r._inputState, s = Kr();
			if ("insertText" === n && e.data && i.isInsertTextAfterHandledSelectionCommand) {
				if (Jn$1(i), e.preventDefault(), ur(s) && !s.isCollapsed()) {
					const t = s.isBackward() ? s.anchor : s.focus;
					s.anchor.set(t.key, t.offset, t.type), s.focus.set(t.key, t.offset, t.type);
				}
				return !0;
			}
			if ("deleteContentBackward" === n) {
				if (null === s) {
					const t = zr();
					if (!ur(t)) return !0;
					ol(t.clone());
				}
				if (ur(s)) {
					const n = s.anchor.key === s.focus.key;
					if (function(t, e) {
						return "MediaLast" === t.lastKeyCode && e < t.lastKeyDownTimeStamp + 30;
					}(i, e.timeStamp) && r.isComposing() && n) {
						if (Vs(null), i.lastKeyDownTimeStamp = 0, setTimeout(() => {
							Ai(r, () => {
								Vs(null);
							});
						}, 30), ur(s)) {
							const e = s.anchor.getNode();
							e.markDirty(), Xo(e) || t(142), Un$1(s, e);
						}
					} else {
						if (Vs(null), l && null !== o && !o.collapsed && (s.applyDOMRange(o), !s.isCollapsed())) return e.preventDefault(), s.removeText(), !0;
						e.preventDefault();
						const t = s.anchor.getNode(), c = t.getTextContent(), a = t.canInsertTextAfter(), u = 0 === s.anchor.offset && s.focus.offset === c.length;
						let d = f$1 && n && !u && a;
						if (d && s.isCollapsed() && (d = !Ki(kl(s.anchor, !0))), !d) {
							Nl(r, $e$2, !0);
							const t = Kr();
							f$1 && ur(t) && t.isCollapsed() && (i.postDeleteSelectionToRestore = t, setTimeout(() => i.postDeleteSelectionToRestore = null));
						}
					}
					return !0;
				}
			}
			if (!ur(s)) return !0;
			const c = e.data;
			null !== i.unprocessedBeforeInputData && ul(!1, r, i.unprocessedBeforeInputData), s.dirty && null === i.unprocessedBeforeInputData || !s.isCollapsed() || Bi(s.anchor.getNode()) || null === o || s.applyDOMRange(o), i.unprocessedBeforeInputData = null;
			const a = s.anchor, u = s.focus, d = a.getNode(), h = u.getNode();
			if ("insertText" === n || "insertTranspose" === n) {
				if ("\n" === c) e.preventDefault(), Nl(r, Ue$2, !1);
				else if (c === D$2) e.preventDefault(), Nl(r, He$2);
				else if (null == c && e.dataTransfer) {
					const t = e.dataTransfer.getData("text/plain");
					e.preventDefault(), s.insertRawText(t);
				} else null != c && Bn$1(s, o, c, e.timeStamp, !0) ? (e.preventDefault(), Nl(r, je$2, c), jn$1(c)) : i.unprocessedBeforeInputData = c;
				return i.lastBeforeInputInsertTextTimeStamp = e.timeStamp, !0;
			}
			switch (e.preventDefault(), n) {
				case "insertFromYank":
				case "insertFromDrop":
				case "insertReplacementText":
					Nl(r, je$2, e);
					jn$1((e.dataTransfer ? e.dataTransfer.getData("text/plain") : null) ?? e.data);
					break;
				case "insertFromComposition": {
					const t = i.hadOrphanedCompositionEvents;
					i.hadOrphanedCompositionEvents = !1;
					const n = r._compositionKey;
					Vs(null), t || Nl(r, je$2, e), Zn$1(n);
					break;
				}
				case "insertLineBreak":
					Vs(null), Nl(r, Ue$2, !1);
					break;
				case "insertParagraph":
					Vs(null), i.isInsertLineBreak && !l ? (i.isInsertLineBreak = !1, Nl(r, Ue$2, !1)) : Nl(r, He$2);
					break;
				case "insertFromPaste":
				case "insertFromPasteAsQuotation":
					Nl(r, Je$2, e);
					break;
				case "deleteByComposition":
					(function(t, e) {
						return t !== e || Pi(t) || Pi(e) || !Ls(t) || !Ls(e);
					})(d, h) && Nl(r, Ve$2, e);
					break;
				case "deleteByDrag":
					Al(No$1), Nl(r, Ve$2, e);
					break;
				case "deleteByCut":
					Nl(r, Ve$2, e);
					break;
				case "deleteContent":
					Nl(r, $e$2, !1);
					break;
				case "deleteWordBackward":
					Nl(r, qe$2, !0);
					break;
				case "deleteWordForward":
					Nl(r, qe$2, !1);
					break;
				case "deleteHardLineBackward":
				case "deleteSoftLineBackward":
					Nl(r, Ye$2, !0);
					break;
				case "deleteContentForward":
				case "deleteHardLineForward":
				case "deleteSoftLineForward":
					Nl(r, Ye$2, !1);
					break;
				case "formatStrikeThrough":
					Nl(r, Ge$2, "strikethrough");
					break;
				case "formatBold":
					Nl(r, Ge$2, "bold");
					break;
				case "formatItalic":
					Nl(r, Ge$2, "italic");
					break;
				case "formatUnderline":
					Nl(r, Ge$2, "underline");
					break;
				case "historyUndo":
					Nl(r, Qe$2);
					break;
				case "historyRedo": Nl(r, Ze$2);
			}
			return !0;
		}
		function Gn$1(t) {
			const e = _i(), n = e._inputState, o = Kr(), r = t.data, l = Hn$1(t);
			let c = !1;
			if (null != r && ur(o)) {
				const a = Jl(Il(e)), u = null !== a ? nc(a, e._rootElement) : null, d = "insertCompositionText" === t.inputType && "ending-firefox" !== n.compositionPhase && !e.isComposing();
				d && (n.hadOrphanedCompositionEvents = !0);
				const h = o.anchor.getNode(), g = "insertCompositionText" === t.inputType && "ending-firefox" !== n.compositionPhase && e.isComposing() && Xo(h) && Ks(h);
				if (!d && !g && Bn$1(o, l, r, t.timeStamp, !1, u)) {
					if (c = !0, "ending-firefox" === n.compositionPhase) {
						const t = to$1(e, r);
						if (n.compositionPhase = "idle", t) return Al(wo$1), rl(), !0;
					}
					const l = o.anchor.getNode();
					if (null === a || null === u) return !0;
					const d = o.isBackward(), h = d ? o.anchor.offset : o.focus.offset, g = d ? o.focus.offset : o.anchor.offset;
					s && !o.isCollapsed() && Xo(l) && null !== u.anchorNode && l.getTextContent().slice(0, h) + r + l.getTextContent().slice(h + g) === al(u.anchorNode) || Nl(e, je$2, r);
					const _ = r.length;
					i && _ > 1 && "insertCompositionText" === t.inputType && !e.isComposing() && (o.anchor.offset -= _, o._cachedNodes = null, o._cachedIsBackward = null), f$1 && e.isComposing() && (n.lastKeyDownTimeStamp = 0, Vs(null));
				}
			}
			if (!c) ul(!1, e, null !== r ? r : void 0), "ending-firefox" === n.compositionPhase && (to$1(e, r || void 0), Al("composition-end"), n.compositionPhase = "idle");
			return rl(), !0;
		}
		function Xn$1(t) {
			const e = _i(), n = e._inputState, o = Kr();
			if (ur(o) && !e.isComposing()) {
				n.compositionPhase = "composing", n.hadOrphanedCompositionEvents = !1;
				const r = o.anchor, i = o.anchor.getNode();
				if (Vs(r.key), Al("composition-start"), t.timeStamp < n.lastKeyDownTimeStamp + 30 || "element" === r.type || !o.isCollapsed() || !f$1 && (i.getFormat() !== o.format || Xo(i) && i.getStyle() !== o.style) || Xo(i) && (Ks(i) || 0 === r.offset && !i.canInsertTextBefore() || r.offset === i.getTextContentSize() && !i.canInsertTextAfter())) {
					Nl(e, je$2, F$1);
					const t = Kr();
					ur(t) && Vs(t.anchor.key);
				}
			}
			return !0;
		}
		function Qn$1(t) {
			const e = _i();
			return e._inputState.compositionPhase = "idle", to$1(e, t.data), Al(wo$1), !0;
		}
		function Zn$1(t) {
			if (null === t) return;
			const e = Ys(t);
			if (!Xo(e) || "text" === e.getType() || Ks(e) || !e.isAttached()) return;
			const n = Kr(), o = ur(n) && n.anchor.key === t ? n.anchor.offset : null, r = Go(e.getTextContent());
			if (r.setFormat(e.getFormat()), r.setStyle(e.getStyle()), e.replace(r), null !== o) {
				const t = Math.min(o, r.getTextContentSize());
				r.select(t, t);
			}
		}
		function to$1(t, e) {
			const n = t._compositionKey;
			if (Vs(null), null !== n && null != e) {
				if ("" === e) {
					const e = Ys(n), o = t.getElementByKey(n), r = null !== o && Xo(e) ? wc(e, o, t) : null;
					if (null !== r && null !== r.nodeValue && Xo(e)) {
						const n = Jl(Il(t)), o = n && nc(n, t._rootElement);
						let i = null, s = null;
						null !== o && o.anchorNode === r && (i = o.anchorOffset, s = o.focusOffset), fl(e, r.nodeValue, i, s, !0);
					}
					return Zn$1(n), !1;
				}
				if ("\n" === e[e.length - 1]) {
					const e = Kr();
					if (ur(e) || dr(e)) {
						if (ur(e)) {
							const t = e.focus;
							e.anchor.set(t.key, t.offset, t.type);
						}
						return Nl(t, cn$3, null), Zn$1(n), !1;
					}
				}
				const o = Ys(n);
				if (null !== o && Xo(o) && Ks(o)) {
					o.markDirty();
					const t = Kr(), r = o.getTextContentSize(), i = ur(t) && t.anchor.key === n ? t.anchor.offset : r;
					return o.select(i, i).insertText(e), !0;
				}
			}
			return ul(!0, t, e), Zn$1(n), !1;
		}
		function eo$1(t) {
			const e = _i(), n = e._inputState;
			if (null == t.key) return !0;
			if ("ending-safari" === n.compositionPhase) {
				const o = ml(t);
				if (o && Ai(e, () => {
					to$1(e, n.compositionEndData);
				}), n.compositionPhase = "idle", n.compositionEndData = "", o) return !0;
			}
			if (function(t) {
				return _l(t, "ArrowRight", { shiftKey: "any" });
			}(t)) Nl(e, en$3, t);
			else if (function(t) {
				return _l(t, "ArrowRight", {
					...pl,
					shiftKey: "any"
				});
			}(t)) Nl(e, nn$3, t);
			else if (function(t) {
				return _l(t, "ArrowLeft", { shiftKey: "any" });
			}(t)) Nl(e, on$3, t);
			else if (function(t) {
				return _l(t, "ArrowLeft", {
					...pl,
					shiftKey: "any"
				});
			}(t)) Nl(e, rn$3, t);
			else if (function(t) {
				return _l(t, "ArrowUp", {
					altKey: "any",
					shiftKey: "any"
				});
			}(t)) Nl(e, sn$3, t);
			else if (function(t) {
				return _l(t, "ArrowDown", {
					altKey: "any",
					shiftKey: "any"
				});
			}(t)) Nl(e, ln$3, t);
			else if (function(t) {
				return _l(t, "Enter", {
					altKey: "any",
					ctrlKey: "any",
					metaKey: "any",
					shiftKey: !0
				});
			}(t)) n.isInsertLineBreak = !0, Nl(e, cn$3, t);
			else if (function(t) {
				return " " === t.key;
			}(t)) Nl(e, an$3, t);
			else if (function(t) {
				return r && _l(t, "o", { ctrlKey: !0 });
			}(t)) t.preventDefault(), n.isInsertLineBreak = !0, Nl(e, Ue$2, !0);
			else if (function(t) {
				return _l(t, "Enter", {
					altKey: "any",
					ctrlKey: "any",
					metaKey: "any"
				});
			}(t)) n.isInsertLineBreak = !1, Nl(e, cn$3, t);
			else if (function(t) {
				return _l(t, "Backspace", { shiftKey: "any" }) || r && _l(t, "h", { ctrlKey: !0 });
			}(t)) ml(t) ? Nl(e, un$3, t) && Vn$1(n) : (t.preventDefault(), Nl(e, $e$2, !0));
			else if (function(t) {
				return "Escape" === t.key;
			}(t)) Nl(e, fn$3, t);
			else if (function(t) {
				return _l(t, "Delete", {}) || r && _l(t, "d", { ctrlKey: !0 });
			}(t)) !function(t) {
				return "Delete" === t.key;
			}(t) ? (t.preventDefault(), Nl(e, $e$2, !1)) : Nl(e, dn$3, t);
			else if (function(t) {
				return _l(t, "Backspace", yl);
			}(t)) t.preventDefault(), Nl(e, qe$2, !0);
			else if (function(t) {
				return _l(t, "Delete", yl);
			}(t)) t.preventDefault(), Nl(e, qe$2, !1);
			else if (function(t) {
				return r && _l(t, "Backspace", { metaKey: !0 });
			}(t)) t.preventDefault(), Nl(e, Ye$2, !0);
			else if (function(t) {
				return r && (_l(t, "Delete", { metaKey: !0 }) || _l(t, "k", { ctrlKey: !0 }));
			}(t)) t.preventDefault(), Nl(e, Ye$2, !1);
			else if (function(t) {
				return _l(t, "b", pl);
			}(t)) t.preventDefault(), Nl(e, Ge$2, "bold");
			else if (function(t) {
				return _l(t, "u", pl);
			}(t)) t.preventDefault(), Nl(e, Ge$2, "underline");
			else if (function(t) {
				return _l(t, "i", pl);
			}(t)) t.preventDefault(), Nl(e, Ge$2, "italic");
			else if (function(t) {
				return _l(t, "Tab", { shiftKey: "any" });
			}(t)) Nl(e, hn$3, t);
			else if (function(t) {
				return _l(t, "z", pl);
			}(t)) t.preventDefault(), Nl(e, Qe$2);
			else if (function(t) {
				if (r) return _l(t, "z", {
					metaKey: !0,
					shiftKey: !0
				});
				return _l(t, "y", { ctrlKey: !0 }) || _l(t, "z", {
					ctrlKey: !0,
					shiftKey: !0
				});
			}(t)) t.preventDefault(), Nl(e, Ze$2);
			else {
				const o = e._editorState._selection;
				!function(t) {
					return _l(t, "a", pl);
				}(t) ? null === o || ur(o) || (!function(t) {
					return _l(t, "c", pl);
				}(t) ? function(t) {
					return _l(t, "x", pl);
				}(t) && (t.preventDefault(), Nl(e, Tn$1, t)) : (t.preventDefault(), Nl(e, vn$3, t))) : (t.preventDefault(), Nl(e, kn$3, t) && Vn$1(n));
			}
			return function(t) {
				return t.ctrlKey || t.shiftKey || t.altKey || t.metaKey;
			}(t) && e.dispatchCommand(An$2, t), !0;
		}
		function no$1(t) {
			let e = t.__lexicalEventHandles;
			return void 0 === e && (e = [], t.__lexicalEventHandles = e), e;
		}
		const oo$1 = /* @__PURE__ */ new Map();
		function ro$1(t) {
			const e = Vl(t.target);
			if (null === e) return;
			const n = Ol(t.target);
			let o = null, r = null;
			const i = null !== n ? Kn$1.get(n) : void 0;
			if (null !== n) {
				if (void 0 !== i) {
					const t = i.editors;
					let n = i.hasShadowEditor;
					if (void 0 === n) {
						n = !1;
						for (const e of t) if (null !== e._rootElement && ql(e._rootElement.getRootNode())) {
							n = !0;
							break;
						}
						i.hasShadowEditor = n;
					}
					if (n) {
						let n = null, i = null;
						for (const s of t) {
							const t = s._rootElement;
							if (null === t) continue;
							const l = nc(e, t).anchorNode;
							if (null !== l && Fs(l) === s) {
								if (ql(t.getRootNode())) {
									o = s, r = l;
									break;
								}
								null === n && (n = s, i = l);
							}
						}
						null === o && null !== n && (o = n, r = i);
					} else {
						const t = e.anchorNode;
						null === t || gc(t) && null !== t.shadowRoot || (o = Fs(t), null !== o && (r = t));
					}
				}
				if (null === o) {
					const t = cc(n);
					o = null !== t ? Fs(t) : null;
				}
			}
			if (null === o) return;
			if (o._inputState.isSelectionChangeFromMouseDown) {
				if (void 0 !== i) for (const t of i.editors) t._inputState.isSelectionChangeFromMouseDown = !1;
				Ai(o, () => {
					const n = zr(), i = r ?? nc(e, o._rootElement).anchorNode;
					if (gc(i) || zs(i)) ol(Lr(n, e, o, t));
				});
			}
			const s = ll(o), l = s[s.length - 1], c = l._key, a = oo$1.get(c), u = a || l;
			u !== o && Wn$1(e, u, !1), Wn$1(e, o, !0), o !== l ? oo$1.set(c, o) : a && oo$1.delete(c);
		}
		function io$1(t) {
			t._lexicalHandled = !0;
		}
		function so$1(t) {
			return !0 === t._lexicalHandled;
		}
		function co$1(e) {
			const n = Ln$1.get(e);
			if (void 0 === n) return void 0;
			const o = Kn$1.get(n);
			if (void 0 === o) return void 0;
			Ln$1.delete(e);
			const r = Ps(e);
			Ds(r) ? (function(t) {
				if (null !== t._parentEditor) {
					const e = ll(t), n = e[e.length - 1]._key;
					oo$1.get(n) === t && oo$1.delete(n);
				} else oo$1.delete(t._key);
			}(r), o.editors.delete(r), o.hasShadowEditor = void 0, e.__lexicalEditor = null) : r && t(198);
			const i = no$1(e);
			for (let t = 0; t < i.length; t++) i[t]();
			e.__lexicalEventHandles = [];
		}
		function ao$1(e, n, o) {
			fi();
			const r = e.__key, i = e.getParent();
			if (null === i) return void (null !== ta(e) && t(367, r, String(ta(e))));
			const s = function(t) {
				const e = Kr();
				if (!ur(e) || !Pi(t)) return e;
				const { anchor: n, focus: o } = e, r = n.getNode(), i = o.getNode();
				Fl(r, t) && n.set(t.__key, 0, "element");
				Fl(i, t) && o.set(t.__key, 0, "element");
				return e;
			}(e);
			let l = !1;
			if (ur(s) && n) {
				const t = s.anchor, n = s.focus;
				t.key === r && (Wr(t, e, i, e.getPreviousSibling(), e.getNextSibling()), l = !0), n.key === r && (Wr(n, e, i, e.getPreviousSibling(), e.getNextSibling()), l = !0);
			} else dr(s) && n && e.isSelected() && e.selectPrevious();
			if (ur(s) && n && !l) {
				const t = e.getIndexWithinParent();
				Hs(e), Br(s, i, t, -1);
			} else Hs(e);
			o || Bl(i) || i.canBeEmpty() || !i.isEmpty() || ao$1(i, n), n && s && Bi(i) && i.isEmpty() && i.selectEnd();
		}
		function uo$1(t) {
			return t;
		}
		const fo$1 = Symbol.for("ephemeral");
		function ho$1(t) {
			return t[fo$1] || !1;
		}
		const go$1 = {
			configurable: !0,
			enumerable: !1,
			value: void 0,
			writable: !0
		};
		var _o$1 = class {
			__type;
			__key;
			__parent;
			__prev;
			__next;
			__state;
			[Kt$7];
			static getType() {
				const { ownNodeType: e } = Hc(this);
				return void 0 === e && t(64, this.name), e;
			}
			static clone(e) {
				t(65, this.name);
			}
			$config() {
				return {};
			}
			config(t, e) {
				const n = e.extends || Gc(this.constructor);
				return Object.assign(e, { extends: n }), "string" == typeof t && Object.assign(e, { type: t }), { [t]: e };
			}
			afterCloneFrom(t) {
				this.__key === t.__key ? (this.__parent = t.__parent, this.__next = t.__next, this.__prev = t.__prev, this.__state = t.__state) : t.__state && (this.__state = t.__state.getWritable(this));
			}
			resetOnCopyNodeFrom(t) {
				this.__state && (this.__state = this.__state.getWritable(this).resetOnCopyNode());
			}
			static importDOM;
			constructor(t) {
				this.__type = this.constructor.getType(), this.__parent = null, this.__prev = null, this.__next = null, Object.defineProperty(this, "__state", go$1), Object.defineProperty(this, Kt$7, go$1), Us(this, t);
			}
			getType() {
				return this.__type;
			}
			isInline() {
				t(137, this.constructor.name);
			}
			isAttached() {
				let t = this.__key;
				for (; null !== t;) {
					if ("root" === t) return !0;
					const e = Ys(t);
					if (null === e) break;
					t = null !== e.__parent ? e.__parent : ta(e);
				}
				return !1;
			}
			isSelected(t) {
				const e = t || Kr();
				if (null == e) return !1;
				const n = e.getNodes().some((t) => t.__key === this.__key);
				if (Xo(this)) return n;
				if (ur(e) && "element" === e.anchor.type && "element" === e.focus.type) {
					if (e.isCollapsed()) return !1;
					const t = this.getParent();
					if (Ki(this) && this.isInline() && t) {
						const n = e.isBackward() ? e.focus : e.anchor;
						if (t.is(n.getNode()) && n.offset === t.getChildrenSize() && this.is(t.getLastChild())) return !1;
					}
				}
				return n;
			}
			getKey() {
				return this.__key;
			}
			getIndexWithinParent() {
				const t = this.getParent();
				if (null === t) return -1;
				let e = t.getFirstChild(), n = 0;
				for (; null !== e;) {
					if (this.is(e)) return n;
					n++, e = e.getNextSibling();
				}
				return -1;
			}
			getParent() {
				const t = this.getLatest().__parent;
				return null === t ? null : Ys(t);
			}
			getParentOrThrow() {
				const e = this.getParent();
				return null === e && t(66, this.__key), e;
			}
			getTopLevelElement() {
				let e = this;
				for (; null !== e;) {
					const n = e.getParent();
					if (Bl(n) || null !== ta(e)) return Pi(e) || e === this && Ki(e) || t(194), e;
					e = n;
				}
				return null;
			}
			getTopLevelElementOrThrow() {
				const e = this.getTopLevelElement();
				return null === e && t(67, this.__key), e;
			}
			getParents() {
				const t = [];
				let e = this.getParent();
				for (; null !== e;) t.push(e), e = e.getParent();
				return t;
			}
			getParentKeys() {
				const t = [];
				let e = this.getParent();
				for (; null !== e;) t.push(e.__key), e = e.getParent();
				return t;
			}
			getPreviousSibling() {
				const t = this.getLatest().__prev;
				return null === t ? null : Ys(t);
			}
			getPreviousSiblings() {
				const t = [], e = this.getParent();
				if (null === e) return t;
				let n = e.getFirstChild();
				for (; null !== n && !n.is(this);) t.push(n), n = n.getNextSibling();
				return t;
			}
			getNextSibling() {
				const t = this.getLatest().__next;
				return null === t ? null : Ys(t);
			}
			getNextSiblings() {
				const t = [];
				let e = this.getNextSibling();
				for (; null !== e;) t.push(e), e = e.getNextSibling();
				return t;
			}
			getCommonAncestor(t) {
				const e = Pi(this) ? this : this.getParent(), n = Pi(t) ? t : t.getParent(), o = e && n ? Za(e, n) : null;
				return o ? o.commonAncestor : null;
			}
			is(t) {
				return null != t && this.__key === t.__key;
			}
			isBefore(e) {
				const n = Za(this, e);
				return null !== n && ("descendant" === n.type || ("branch" === n.type ? -1 === Ga(n) : ("same" !== n.type && "ancestor" !== n.type && t(279), !1)));
			}
			isParentOf(t) {
				return Fl(t, this);
			}
			getNodesBetween(e) {
				const n = this.isBefore(e), o = [], r = /* @__PURE__ */ new Set();
				let i = this;
				for (; null !== i;) {
					const s = i.__key;
					if (r.has(s) || (r.add(s), o.push(i)), i === e) break;
					const l = Pi(i) ? n ? i.getFirstChild() : i.getLastChild() : null;
					if (null !== l) {
						i = l;
						continue;
					}
					const c = n ? i.getNextSibling() : i.getPreviousSibling();
					if (null !== c) {
						i = c;
						continue;
					}
					const a = i.getParentOrThrow();
					if (r.has(a.__key) || o.push(a), a === e) break;
					let u = null, f = a;
					do {
						if (null === f && t(68), u = n ? f.getNextSibling() : f.getPreviousSibling(), f = f.getParent(), null === f) break;
						null !== u || r.has(f.__key) || o.push(f);
					} while (null === u);
					i = u;
				}
				return n || o.reverse(), o;
			}
			isDirty() {
				const t = _i()._dirtyLeaves;
				return null !== t && t.has(this.__key);
			}
			getLatest() {
				if (ho$1(this)) return this;
				const e = Ys(this.__key);
				return null === e && t(113), e;
			}
			getWritable() {
				if (ho$1(this)) return this;
				fi();
				const t = hi(), e = _i(), n = t._nodeMap, o = this.__key, r = this.getLatest(), i = e._cloneNotNeeded, s = Kr();
				if (null !== s && s.setCachedNodes(null), i.has(o)) return Js(r), r;
				const l = Dc(r);
				return i.add(o), Js(l), n.set(o, l), l;
			}
			getTextContent() {
				return ha(this);
			}
			getTextContentSize() {
				return this.getTextContent().length;
			}
			createDOM(e, n) {
				t(70);
			}
			updateDOM(e, n, o) {
				t(71);
			}
			getDOMSlot(t) {
				return new q$2(t);
			}
			exportDOM(t) {
				return { element: this.createDOM(t._config, t) };
			}
			exportJSON() {
				const t = this.__state ? this.__state.toJSON() : void 0;
				return {
					type: this.__type,
					version: 1,
					...t
				};
			}
			static importJSON(e) {
				t(18, this.name);
			}
			updateFromJSON(t) {
				return function(t, e) {
					const n = t.getWritable(), o = e.$;
					let r = o;
					for (const t of Nt$7(n).flatKeys) t in e && (void 0 !== r && r !== o || (r = { ...o }), r[t] = e[t]);
					return (n.__state || r) && bt$7(t).updateFromJSON(r), n;
				}(this, t);
			}
			static transform() {
				return null;
			}
			remove(t) {
				ao$1(this, !0, t);
			}
			replace(e, n) {
				fi();
				let o = Kr();
				null !== o && (o = o.clone()), $l(this, e);
				const r = this.getLatest(), i = this.__key, s = e.__key, l = e.getWritable(), c = this.getParentOrThrow().getWritable(), a = c.__size, u = l.getParent(), f = null !== u ? l.getIndexWithinParent() : -1;
				Hs(l), null !== u && ur(o) && Br(o, u, f, -1);
				const d = r.getPreviousSibling(), h = r.getNextSibling(), g = r.__prev, _ = r.__next, p = r.__parent;
				if (ao$1(r, !1, !0), null === d) c.__first = s;
				else d.getWritable().__next = s;
				if (l.__prev = g, null === h) c.__last = s;
				else h.getWritable().__prev = s;
				l.__next = _, l.__parent = p, c.__size = a;
				let y = 0;
				n && (Pi(this) && Pi(l) || t(139), y = l.getChildrenSize(), l.splice(y, 0, this.getChildren()));
				const m = ia(this);
				if (m.length > 0) {
					Qc(this) && Qc(l) || t(368, this.__key, l.__key);
					for (const t of m) {
						const e = sa(this, t);
						null !== e && (ya(this, t), pa(l, t, e));
					}
				}
				if (ur(o)) {
					ol(o);
					const t = o.anchor, e = o.focus;
					t.key === i && (n && "element" === t.type ? t.set(l.__key, y + t.offset, "element") : ir(t, l)), e.key === i && (n && "element" === e.type ? e.set(l.__key, y + e.offset, "element") : ir(e, l));
				}
				return qs() === i && Vs(s), l;
			}
			insertAfter(t, e = !0) {
				fi(), $l(this, t);
				const n = this.getWritable(), o = t.getWritable();
				this.getParentOrThrow();
				const r = o.getParent(), i = Kr();
				let s = !1, l = !1;
				if (null !== r) {
					const n = t.getIndexWithinParent();
					if (ur(i)) {
						const t = r.__key, e = i.anchor, o = i.focus;
						s = "element" === e.type && e.key === t && e.offset === n + 1, l = "element" === o.type && o.key === t && o.offset === n + 1;
					}
					Hs(o), e && ur(i) && Br(i, r, n, -1);
				} else Hs(o);
				const c = this.getNextSibling(), a = this.getParentOrThrow().getWritable(), u = o.__key, f = n.__next;
				if (null === c) a.__last = u;
				else c.getWritable().__prev = u;
				if (a.__size++, n.__next = u, o.__next = f, o.__prev = n.__key, o.__parent = n.__parent, e && ur(i)) {
					const t = this.getIndexWithinParent();
					Br(i, a, t + 1);
					const e = a.__key;
					s && i.anchor.set(e, t + 2, "element"), l && i.focus.set(e, t + 2, "element");
				}
				return t;
			}
			insertBefore(t, e = !0) {
				fi(), $l(this, t);
				const n = this.getWritable(), o = t.getWritable();
				this.getParentOrThrow();
				const r = o.__key, i = Kr(), s = o.getParent(), l = null !== s ? o.getIndexWithinParent() : -1;
				Hs(o), null !== s && e && ur(i) && Br(i, s, l, -1);
				const c = this.getPreviousSibling(), a = this.getParentOrThrow().getWritable(), u = n.__prev, f = this.getIndexWithinParent();
				if (null === c) a.__first = r;
				else c.getWritable().__next = r;
				if (a.__size++, n.__prev = r, o.__prev = u, o.__next = n.__key, o.__parent = n.__parent, e && ur(i)) Br(i, this.getParentOrThrow(), f);
				return t;
			}
			isParentRequired() {
				return !1;
			}
			createParentElementNode() {
				return es();
			}
			selectStart() {
				return this.selectPrevious();
			}
			selectEnd() {
				return this.selectNext(0, 0);
			}
			selectPrevious(t, e) {
				fi();
				const n = ea(this);
				if (null !== n) return n.selectPrevious(t, e);
				const o = this.getPreviousSibling(), r = this.getParentOrThrow();
				if (null === o) return r.select(0, 0);
				if (Pi(o)) return o.select();
				if (!Xo(o)) {
					const t = o.getIndexWithinParent() + 1;
					return r.select(t, t);
				}
				return o.select(t, e);
			}
			selectNext(t, e) {
				fi();
				const n = ea(this);
				if (null !== n) return n.selectNext(t, e);
				const o = this.getNextSibling(), r = this.getParentOrThrow();
				if (null === o) return r.select();
				if (Pi(o)) return o.select(0, 0);
				if (!Xo(o)) {
					const t = o.getIndexWithinParent();
					return r.select(t, t);
				}
				return o.select(t, e);
			}
			markDirty() {
				this.getWritable();
			}
			reconcileObservedMutation(t, e) {
				this.markDirty();
			}
		};
		function po$1(t) {
			return t instanceof _o$1;
		}
		const yo$1 = "historic";
		const mo$1 = "history-push";
		const xo = "history-merge";
		const Co$1 = "paste";
		const vo$1 = "collaboration";
		const To = "skip-collab";
		const ko = "skip-scroll-into-view";
		const bo$1 = "skip-dom-selection";
		const No$1 = "skip-selection-focus";
		const Eo = "composition-start";
		const wo$1 = "composition-end";
		const Oo = "!important";
		function Mo(t) {
			const e = {};
			if (!t) return e;
			let n = "", o = "", r = null, i = !1, s = !1, l = !1, c = 0;
			const a = t.length;
			let u = -1;
			for (let f = 0; f < a; f++) {
				const a = t[f];
				if (i) "*" === a && "/" === t[f + 1] && (i = !1, f++);
				else if (s) -1 === u && (u = f), s = !1;
				else if (null === r) if ("/" !== a || "*" !== t[f + 1]) if ("\"" !== a && "'" !== a) if ("(" !== a) if (")" !== a) if (l || ":" !== a || 0 !== c) {
					if (";" === a && 0 === c) {
						-1 !== u && (l ? o += t.slice(u, f) : n += t.slice(u, f), u = -1);
						const r = n.trim(), i = o.trim();
						"" !== r && "" !== i && (e[r] = i), n = "", o = "", l = !1;
						continue;
					}
					-1 === u && (u = f);
				} else -1 !== u && (n += t.slice(u, f), u = -1), l = !0;
				else -1 === u && (u = f), c = Math.max(0, c - 1);
				else -1 === u && (u = f), c++;
				else -1 === u && (u = f), r = a;
				else -1 !== u && (l ? o += t.slice(u, f) : n += t.slice(u, f), u = -1), i = !0, f++;
				else -1 === u && (u = f), "\\" === a ? s = !0 : a === r && (r = null);
			}
			-1 !== u && (l ? o += t.slice(u, a) : n += t.slice(u, a));
			const f = n.trim(), d = o.trim();
			return "" !== f && "" !== d && (e[f] = d), e;
		}
		function Ao(t, e, n) {
			const o = n.trimEnd(), r = o.length - 10;
			r >= 0 && o.slice(r).toLowerCase() === Oo ? t.setProperty(e, o.slice(0, r).trim(), "important") : t.setProperty(e, n, "");
		}
		function Do(t, e) {
			for (const n in e) {
				const o = e[n];
				null == o ? t.removeProperty(n) : Ao(t, n, o);
			}
		}
		function Fo(t, e, n = "") {
			if (e === n) return;
			const o = Mo(n), r = Mo(e);
			for (const e in r) delete o[e], Ao(t, e, r[e]);
			for (const e in o) t.removeProperty(e);
		}
		function Po(t, e) {
			return 16 & e ? "code" : e & 128 ? "mark" : 32 & e ? "sub" : 64 & e ? "sup" : null;
		}
		function Io(t, e) {
			return 1 & e ? "strong" : 2 & e ? "em" : "span";
		}
		function Lo(t, e, n, o, r) {
			const i = o.classList;
			let s = Cl(r, "base");
			void 0 !== s && i.add(...s), s = Cl(r, "underlineStrikethrough");
			let l = !1;
			const c = 8 & e && 4 & e;
			void 0 !== s && (8 & n && 4 & n ? (l = !0, c || i.add(...s)) : c && i.remove(...s));
			for (const t in z$2) {
				const o = z$2[t];
				if (s = Cl(r, t), void 0 !== s) if (n & o) {
					if (l && ("underline" === t || "strikethrough" === t)) {
						e & o && i.remove(...s);
						continue;
					}
					(0 === (e & o) || c && "underline" === t || "strikethrough" === t) && i.add(...s);
				} else e & o && i.remove(...s);
			}
		}
		function Ko(t, e, n) {
			const o = n.isComposing(), r = t + (o ? A$1 : ""), s = vc(), l = Tc(s).$getDOMSlot(n, e, s), c = l.getFirstChild();
			if (null === c || c.nodeType !== Node.TEXT_NODE) return void l.insertChild(Zl().createTextNode(r));
			const a = c, u = a.nodeValue;
			if (u !== r) if (o || i) {
				const [t, e, n] = function(t, e) {
					const n = t.length, o = e.length;
					let r = 0, i = 0;
					for (; r < n && r < o && t[r] === e[r];) r++;
					for (; i + r < n && i + r < o && t[n - i - 1] === e[o - i - 1];) i++;
					return [
						r,
						n - r - i,
						e.slice(r, o - i)
					];
				}(u, r);
				0 !== e && a.deleteData(t, e), a.insertData(t, n);
			} else a.nodeValue = r;
		}
		function zo(t, e, n, o, r, i) {
			Ko(r, t, e);
			const s = i.theme.text;
			void 0 !== s && Lo(0, 0, o, t, s);
		}
		function Bo(t, e) {
			const n = Zl().createElement(e);
			return n.appendChild(t), n;
		}
		function Ro(t) {
			return null != t && !0 === t.__isInlineFormattable;
		}
		var Wo = class extends _o$1 {
			__text;
			__format;
			__style;
			__mode;
			__detail;
			get __isInlineFormattable() {
				return !0;
			}
			$config() {
				return this.config("text", { importDOM: {
					"#text": () => ({
						conversion: Jo,
						priority: 0
					}),
					b: () => ({
						conversion: Uo,
						priority: 0
					}),
					code: () => ({
						conversion: Yo,
						priority: 0
					}),
					em: () => ({
						conversion: Yo,
						priority: 0
					}),
					i: () => ({
						conversion: Yo,
						priority: 0
					}),
					mark: () => ({
						conversion: Yo,
						priority: 0
					}),
					s: () => ({
						conversion: Yo,
						priority: 0
					}),
					span: () => ({
						conversion: $o,
						priority: 0
					}),
					strong: () => ({
						conversion: Yo,
						priority: 0
					}),
					sub: () => ({
						conversion: Yo,
						priority: 0
					}),
					sup: () => ({
						conversion: Yo,
						priority: 0
					}),
					u: () => ({
						conversion: Yo,
						priority: 0
					})
				} });
			}
			afterCloneFrom(t) {
				super.afterCloneFrom(t), this.__text = t.__text, this.__format = t.__format, this.__style = t.__style, this.__mode = t.__mode, this.__detail = t.__detail;
			}
			constructor(t = "", e) {
				super(e), this.__text = t, this.__format = 0, this.__style = "", this.__mode = 0, this.__detail = 0;
			}
			getFormat() {
				return this.getLatest().__format;
			}
			getDetail() {
				return this.getLatest().__detail;
			}
			getMode() {
				const t = this.getLatest();
				return U$1[t.__mode];
			}
			getStyle() {
				return this.getLatest().__style;
			}
			isToken() {
				return 1 === this.getLatest().__mode;
			}
			isComposing() {
				return this.__key === qs();
			}
			isSegmented() {
				return 2 === this.getLatest().__mode;
			}
			isDirectionless() {
				return !!(1 & this.getLatest().__detail);
			}
			isUnmergeable() {
				return !!(2 & this.getLatest().__detail);
			}
			hasFormat(t) {
				const e = z$2[t];
				return 0 !== (this.getFormat() & e);
			}
			isSimpleText() {
				return "text" === this.__type && 0 === this.__mode;
			}
			getTextContent() {
				return this.getLatest().__text;
			}
			getFormatFlags(t, e) {
				return Ws(this.getLatest().__format, t, e);
			}
			canHaveFormat() {
				return !0;
			}
			isInline() {
				return !0;
			}
			createDOM(t, e) {
				const n = this.__format, o = Po(0, n), r = Io(0, n), i = null === o ? r : o, s = Zl().createElement(i);
				let l = s;
				this.hasFormat("code") && s.setAttribute("spellcheck", "false"), null !== o && (l = Zl().createElement(r), s.appendChild(l));
				zo(l, this, 0, n, this.__text, t);
				const c = this.__style;
				return "" !== c && Fo(s.style, c), s;
			}
			updateDOM(e, n, o) {
				const r = this.__text, i = e.__format, s = this.__format, l = Po(0, i), c = Po(0, s), a = Io(0, i), u = Io(0, s);
				if ((null === l ? a : l) !== (null === c ? u : c)) return !0;
				if (l === c && a !== u) {
					const e = n.firstChild;
					e ?? t(48);
					const i = Zl().createElement(u);
					return zo(i, this, 0, s, r, o), n.replaceChild(i, e), !1;
				}
				let f = n;
				null !== c && null !== l && (f = n.firstChild, f ?? t(49)), Ko(r, f, this);
				const d = o.theme.text;
				void 0 !== d && i !== s && Lo(0, i, s, f, d);
				const h = e.__style, g = this.__style;
				return h !== g && Fo(n.style, g, h), !1;
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setTextContent(t.text).setFormat(t.format).setDetail(t.detail).setMode(t.mode).setStyle(t.style);
			}
			exportDOM(e) {
				let { element: n } = super.exportDOM(e);
				return gc(n) || t(132), n.style.whiteSpace = "pre-wrap", this.hasFormat("lowercase") ? n.style.textTransform = "lowercase" : this.hasFormat("uppercase") ? n.style.textTransform = "uppercase" : this.hasFormat("capitalize") && (n.style.textTransform = "capitalize"), this.hasFormat("bold") && (n = Bo(n, "b")), this.hasFormat("italic") && (n = Bo(n, "i")), this.hasFormat("strikethrough") && (n = Bo(n, "s")), this.hasFormat("underline") && (n = Bo(n, "u")), { element: n };
			}
			exportJSON() {
				return {
					detail: this.getDetail(),
					format: this.getFormat(),
					mode: this.getMode(),
					style: this.getStyle(),
					text: this.getTextContent(),
					...super.exportJSON()
				};
			}
			selectionTransform(t, e) {}
			setFormat(t) {
				const e = this.getWritable();
				return e.__format = "string" == typeof t ? z$2[t] : t, e;
			}
			setDetail(t) {
				const e = this.getWritable();
				return e.__detail = "string" == typeof t ? B$1[t] : t, e;
			}
			setStyle(t) {
				const e = this.getWritable();
				return e.__style = t, e;
			}
			toggleFormat(t) {
				const e = Ws(this.getFormat(), t, null);
				return this.setFormat(e);
			}
			toggleDirectionless() {
				const t = this.getWritable();
				return t.__detail ^= 1, t;
			}
			toggleUnmergeable() {
				const t = this.getWritable();
				return t.__detail ^= 2, t;
			}
			setMode(t) {
				const e = $$1[t];
				if (this.__mode === e) return this;
				const n = this.getWritable();
				return n.__mode = e, n;
			}
			setTextContent(t) {
				if (this.__text === t) return this;
				const e = this.getWritable();
				return e.__text = t, e;
			}
			select(t, e) {
				fi();
				let n = t, o = e;
				const r = Kr(), i = this.getTextContent(), s = this.__key;
				if ("string" == typeof i) {
					const t = i.length;
					void 0 === n && (n = t), void 0 === o && (o = t);
				} else n = 0, o = 0;
				if (!ur(r)) return Dr(s, n, s, o, "text", "text");
				{
					const t = qs();
					t !== r.anchor.key && t !== r.focus.key || Vs(s), r.setTextNodeRange(this, n, this, o);
				}
				return r;
			}
			selectStart() {
				return this.select(0, 0);
			}
			selectEnd() {
				const t = this.getTextContentSize();
				return this.select(t, t);
			}
			spliceText(t, e, n, o) {
				const r = this.getWritable(), i = r.__text, s = n.length;
				let l = t;
				l < 0 && (l = s + l, l < 0 && (l = 0));
				const c = Kr();
				if (o && ur(c)) {
					const e = t + s;
					c.setTextNodeRange(r, e, r, e);
				}
				return r.__text = i.slice(0, l) + n + i.slice(l + e), r;
			}
			canInsertTextBefore() {
				return !0;
			}
			canInsertTextAfter() {
				return !0;
			}
			splitText(...t) {
				fi();
				const e = this.getLatest(), n = e.getTextContent();
				if ("" === n) return [];
				const o = e.__key, r = qs(), i = n.length;
				t.sort((t, e) => t - e), t.push(i);
				const s = [], l = t.length;
				for (let e = 0, o = 0; e < i && o <= l; o++) {
					const r = t[o];
					r > e && (s.push(n.slice(e, r)), e = r);
				}
				const c = s.length;
				if (1 === c) return [e];
				const a = s[0], u = e.getParent();
				let f;
				const d = e.getFormat(), h = e.getStyle(), g = e.__detail;
				let _ = !1, p = null, y = null;
				const m = Kr();
				if (ur(m)) {
					const [t, e] = m.isBackward() ? [m.focus, m.anchor] : [m.anchor, m.focus];
					"text" === t.type && t.key === o && (p = t), "text" === e.type && e.key === o && (y = e);
				}
				e.isSegmented() ? (f = Go(a), f.__format = d, f.__style = h, f.__detail = g, f.__state = At$7(e, f), _ = !0) : f = e.setTextContent(a);
				const x = [f];
				for (let t = 1; t < c; t++) {
					const n = Go(s[t]);
					n.__format = d, n.__style = h, n.__detail = g, n.__state = At$7(e, n);
					const i = n.__key;
					r === o && Vs(i), x.push(n);
				}
				const C = p ? p.offset : null, S = y ? y.offset : null;
				let v = 0;
				for (const t of x) {
					if (!p && !y) break;
					const e = v + t.getTextContentSize();
					if (null !== p && null !== C && C <= e && C >= v && (p.set(t.getKey(), C - v, "text"), C < e && (p = null)), null !== y && null !== S && S <= e && S >= v) {
						y.set(t.getKey(), S - v, "text");
						break;
					}
					v = e;
				}
				if (null !== u) {
					(function(t) {
						const e = t.getPreviousSibling(), n = t.getNextSibling();
						null !== e && Js(e);
						null !== n && Js(n);
					})(this);
					const t = u.getWritable(), e = this.getIndexWithinParent();
					_ ? (t.splice(e, 0, x), this.remove()) : t.splice(e, 1, x), ur(m) && Br(m, u, e, c - 1);
				}
				return x;
			}
			mergeWithSibling(e) {
				const n = e === this.getPreviousSibling();
				n || e === this.getNextSibling() || t(50);
				const o = this.__key, r = e.__key, i = this.__text, s = i.length;
				qs() === r && Vs(o);
				const l = Kr();
				if (ur(l)) {
					const t = l.anchor, i = l.focus;
					null !== t && t.key === r && $r(t, n, o, e, s), null !== i && i.key === r && $r(i, n, o, e, s);
				}
				const c = e.__text, a = n ? c + i : i + c;
				this.setTextContent(a);
				const u = this.getWritable();
				return e.remove(), u;
			}
			isTextEntity() {
				return !1;
			}
		};
		function $o(t) {
			return {
				forChild: Qo(t.style),
				node: null
			};
		}
		function Uo(t) {
			const e = t, n = "normal" === e.style.fontWeight;
			return {
				forChild: Qo(e.style, n ? void 0 : "bold"),
				node: null
			};
		}
		const Ho = /* @__PURE__ */ new WeakMap();
		function jo(t) {
			if (!gc(t)) return !1;
			if ("PRE" === t.nodeName) return !0;
			const e = t.style.whiteSpace;
			return "string" == typeof e && e.startsWith("pre");
		}
		function Jo(e) {
			const n = e;
			null === e.parentElement && t(129);
			let o = n.textContent || "";
			if (null !== function(t) {
				let e, n = t.parentNode;
				const o = [t];
				for (; null !== n && void 0 === (e = Ho.get(n)) && !jo(n);) o.push(n), n = n.parentNode;
				const r = void 0 === e ? n : e;
				for (let t = 0; t < o.length; t++) Ho.set(o[t], r);
				return r;
			}(n)) return { node: qr(o) };
			if (o = o.replace(/\r/g, "").replace(/[ \t\n]+/g, " "), "" === o) return { node: null };
			if (" " === o[0]) {
				let t = n, e = !0;
				for (; null !== t && null !== (t = Vo(t, !1));) {
					const n = t.textContent || "";
					if (n.length > 0) {
						/[ \t\n]$/.test(n) && (o = o.slice(1)), e = !1;
						break;
					}
				}
				e && (o = o.slice(1));
			}
			if (" " === o[o.length - 1]) {
				let t = n, e = !0;
				for (; null !== t && null !== (t = Vo(t, !0));) if ((t.textContent || "").replace(/^( |\t|\r?\n)+/, "").length > 0) {
					e = !1;
					break;
				}
				e && (o = o.slice(0, o.length - 1));
			}
			return "" === o ? { node: null } : { node: Go(o) };
		}
		function Vo(t, e) {
			let n = t;
			for (;;) {
				let t;
				for (; null === (t = e ? n.nextSibling : n.previousSibling);) {
					const t = n.parentElement;
					if (null === t) return null;
					n = t;
				}
				if (n = t, gc(n)) {
					const t = n.style.display;
					if ("" === t && !mc(n) || "" !== t && !t.startsWith("inline")) return null;
				}
				let o = n;
				for (; null !== (o = e ? n.firstChild : n.lastChild);) n = o;
				if (zs(n)) return n;
				if ("BR" === n.nodeName) return null;
			}
		}
		const qo = {
			code: "code",
			em: "italic",
			i: "italic",
			mark: "highlight",
			s: "strikethrough",
			strong: "bold",
			sub: "subscript",
			sup: "superscript",
			u: "underline"
		};
		function Yo(t) {
			const e = qo[t.nodeName.toLowerCase()];
			return void 0 === e ? { node: null } : {
				forChild: Qo(t.style, e),
				node: null
			};
		}
		function Go(t = "") {
			return Wl(new Wo(t));
		}
		function Xo(t) {
			return t instanceof Wo;
		}
		function Qo(t, e) {
			const n = t.fontWeight, o = t.textDecoration.split(" "), r = "700" === n || "bold" === n, i = o.includes("line-through"), s = "italic" === t.fontStyle, l = o.includes("underline"), c = t.verticalAlign;
			return (t) => Xo(t) || Ro(t) ? (r && !t.hasFormat("bold") && t.toggleFormat("bold"), i && !t.hasFormat("strikethrough") && t.toggleFormat("strikethrough"), s && !t.hasFormat("italic") && t.toggleFormat("italic"), l && !t.hasFormat("underline") && t.toggleFormat("underline"), "sub" !== c || t.hasFormat("subscript") || t.toggleFormat("subscript"), "super" !== c || t.hasFormat("superscript") || t.toggleFormat("superscript"), e && !t.hasFormat(e) && t.toggleFormat(e), t) : t;
		}
		var Zo = class extends Wo {
			$config() {
				return this.config("tab", { extends: Wo });
			}
			constructor(t = void 0) {
				super("	", t), this.__detail = 2;
			}
			createDOM(t) {
				const e = super.createDOM(t), n = Cl(t.theme, "tab");
				if (void 0 !== n) e.classList.add(...n);
				return e;
			}
			setTextContent(t) {
				return super.setTextContent("	");
			}
			spliceText(e, n, o, r) {
				return "" === o && 0 === n || "	" === o && 1 === n || t(286), this;
			}
			setDetail(e) {
				return 2 !== e && t(127), this;
			}
			setMode(e) {
				return "normal" !== e && t(128), this;
			}
			canInsertTextBefore() {
				return !1;
			}
			canInsertTextAfter() {
				return !1;
			}
		};
		function tr() {
			return Wl(new Zo());
		}
		function er(t) {
			return t instanceof Zo;
		}
		var nr = class {
			key;
			offset;
			type;
			_selection;
			constructor(t, e, n) {
				this._selection = null, this.key = t, this.offset = e, this.type = n;
			}
			is(t) {
				return this.key === t.key && this.offset === t.offset && this.type === t.type;
			}
			isBefore(t) {
				if (this.key === t.key) return this.offset < t.offset;
				return Ya(au(tu(this, "next")), au(tu(t, "next"))) < 0;
			}
			getNode() {
				const e = Ys(this.key);
				return null === e && t(20), e;
			}
			set(t, e, n, o) {
				const r = this._selection, i = this.key;
				o && this.key === t && this.offset === e && this.type === n || (this.key = t, this.offset = e, this.type = n, ui() || (qs() === i && Vs(t), null !== r && (r.setCachedNodes(null), ur(r) && (r._cachedIsBackward = null), r.dirty = !0)));
			}
		};
		function or(t, e, n) {
			return new nr(t, e, n);
		}
		function rr(t, e) {
			let n = e.__key, o = t.offset, r = "element";
			if (Xo(e)) {
				r = "text";
				const t = e.getTextContentSize();
				o > t && (o = t);
			} else if (!Pi(e)) {
				const t = e.getNextSibling();
				if (Xo(t)) n = t.__key, o = 0, r = "text";
				else {
					const t = e.getParent();
					t && (n = t.__key, o = e.getIndexWithinParent() + 1);
				}
			}
			t.set(n, o, r);
		}
		function ir(t, e) {
			if (Pi(e)) {
				const n = e.getLastDescendant();
				Pi(n) || Xo(n) ? rr(t, n) : rr(t, e);
			} else rr(t, e);
		}
		function sr(t, e, n, o) {
			const r = t.getNode(), i = r.getChildAtIndex(t.offset), s = Go();
			if (s.setFormat(n), s.setStyle(o), ns(i)) i.splice(0, 0, [s]);
			else if (null !== i) {
				const t = Bl(r) ? es().append(s) : s;
				i.insertBefore(t);
			} else if (Bl(r)) {
				const t = r.getLastChild();
				Pi(t) && !t.isInline() && t.isEmpty() ? t.append(s) : r.append(es().append(s));
			} else r.append(s);
			t.is(e) && e.set(s.__key, 0, "text"), t.set(s.__key, 0, "text");
		}
		function lr(e, n, o, r) {
			const i = e.anchor.getNode();
			Xo(i) || t(398);
			const s = e.anchor.offset, l = Go(n);
			l.setFormat(o), l.setStyle(r);
			const c = i.getParentOrThrow();
			if (0 === s) c.isInline() && !i.__prev ? c.insertBefore(l) : i.insertBefore(l, !1);
			else if (s === i.getTextContentSize()) c.isInline() && !i.__next ? c.insertAfter(l) : i.insertAfter(l, !1);
			else {
				const [t] = i.splitText(s);
				t.insertAfter(l, !1);
			}
			"" === i.getTextContent() && i.isAttached() && i.remove(), l.selectEnd(), l.isComposing() && "text" === e.anchor.type && e.anchor.set(e.anchor.key, e.anchor.offset - n.length, e.anchor.type);
		}
		var cr = class cr {
			_nodes;
			_cachedNodes;
			dirty;
			constructor(t) {
				this._cachedNodes = null, this._nodes = t, this.dirty = !1;
			}
			getCachedNodes() {
				return this._cachedNodes;
			}
			setCachedNodes(t) {
				this._cachedNodes = t;
			}
			is(t) {
				if (!dr(t)) return !1;
				const e = this._nodes, n = t._nodes;
				return e.size === n.size && Array.from(e).every((t) => n.has(t));
			}
			isCollapsed() {
				return !1;
			}
			isBackward() {
				return !1;
			}
			getStartEndPoints() {
				return null;
			}
			add(t) {
				this.dirty = !0, this._nodes.add(t), this._cachedNodes = null;
			}
			delete(t) {
				this.dirty = !0, this._nodes.delete(t), this._cachedNodes = null;
			}
			clear() {
				this.dirty = !0, this._nodes.clear(), this._cachedNodes = null;
			}
			has(t) {
				return this._nodes.has(t);
			}
			clone() {
				return new cr(new Set(this._nodes));
			}
			extract() {
				return this.getNodes();
			}
			insertRawText(t) {}
			insertText() {}
			insertNodes(t) {
				const e = this.getNodes().filter((t) => null === ta(t)), n = e.length;
				if (0 === n) return;
				const o = e[n - 1];
				let r;
				if (Xo(o)) r = o.select();
				else {
					const t = o.getIndexWithinParent() + 1;
					r = o.getParentOrThrow().select(t, t);
				}
				r.insertNodes(t);
				for (let t = 0; t < n; t++) e[t].remove();
			}
			getNodes() {
				const t = this._cachedNodes;
				if (null !== t) return t;
				const e = this._nodes, n = [];
				for (const t of e) {
					const e = Ys(t);
					null !== e && n.push(e);
				}
				return ui() || (this._cachedNodes = n), n;
			}
			getTextContent() {
				const t = this.getNodes();
				let e = "";
				for (let n = 0; n < t.length; n++) e += t[n].getTextContent();
				return e;
			}
			deleteNodes() {
				const t = this.getNodes().filter((t) => null === ta(t));
				if ((Kr() || zr()) === this && t[0]) {
					const e = Ia(t[0], "next");
					nu(Va(e, e));
				}
				for (const e of t) e.remove();
				ar();
			}
		};
		function ar() {
			const t = nl();
			if (t.isEmpty()) {
				const e = es();
				t.append(e), e.select();
			}
		}
		function ur(t) {
			return t instanceof fr;
		}
		var fr = class fr {
			format;
			style;
			anchor;
			focus;
			_cachedNodes;
			_cachedIsBackward;
			dirty;
			constructor(t, e, n, o) {
				this.anchor = t, this.focus = e, t._selection = this, e._selection = this, this._cachedNodes = null, this._cachedIsBackward = null, this.format = n, this.style = o, this.dirty = !1;
			}
			getCachedNodes() {
				return this._cachedNodes;
			}
			setCachedNodes(t) {
				this._cachedNodes = t;
			}
			is(t) {
				return !!ur(t) && this.anchor.is(t.anchor) && this.focus.is(t.focus) && this.format === t.format && this.style === t.style;
			}
			isCollapsed() {
				return this.anchor.is(this.focus);
			}
			getNodes() {
				const t = this._cachedNodes;
				if (null !== t) return t;
				const e = function(t) {
					const e = [], [n, o] = t.getTextSlices();
					n && e.push(n.caret.origin);
					const r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
					for (const n of t) if (Aa(n)) {
						const { origin: t } = n;
						0 === e.length ? r.add(t) : (i.add(t), e.push(t));
					} else {
						const { origin: t } = n;
						Pi(t) && i.has(t) || e.push(t);
					}
					o && e.push(o.caret.origin);
					if (Ma(t.focus) && Pi(t.focus.origin) && null === t.focus.getNodeAtCaret()) for (let n = Ba(t.focus.origin, "previous"); Aa(n) && r.has(n.origin) && !n.origin.isEmpty() && n.origin.is(e[e.length - 1]); n = Wa(n)) r.delete(n.origin), e.pop();
					for (; e.length > 1;) {
						const t = e[e.length - 1];
						if (!Pi(t) || i.has(t) || t.isEmpty() || r.has(t)) break;
						e.pop();
					}
					if (0 === e.length && t.isCollapsed()) {
						const n = au(t.anchor), o = au(t.anchor.getFlipped()), r = (t) => wa(t) ? t.origin : t.getNodeAtCaret(), i = r(n) || r(o) || (t.anchor.getNodeAtCaret() ? n.origin : o.origin);
						e.push(i);
					}
					return e;
				}(du(ru(this), "next"));
				return ui() || (this._cachedNodes = e), e;
			}
			setTextNodeRange(t, e, n, o) {
				return this.anchor.set(t.__key, e, "text"), this.focus.set(n.__key, o, "text"), this;
			}
			getTextContent() {
				const t = this.getNodes();
				if (0 === t.length) return "";
				const e = t[0], n = t[t.length - 1], o = this.anchor, r = this.focus, i = o.isBefore(r), [s, l] = yr(this);
				let c = "", a = !0;
				for (let u = 0; u < t.length; u++) {
					const f = t[u];
					if (Pi(f) && !f.isInline()) {
						a || (c += "\n");
						let t = "";
						for (const e of ia(f)) {
							const n = sa(f, e);
							null !== n && (t += n.getTextContent());
						}
						"" !== t ? (c += t, a = !1) : a = !f.isEmpty();
					} else if (a = !1, Xo(f)) {
						let t = f.getTextContent();
						f === e ? f === n ? "element" === o.type && "element" === r.type && r.offset !== o.offset || (t = s < l ? t.slice(s, l) : t.slice(l, s)) : t = i ? t.slice(s) : t.slice(l) : f === n && (t = i ? t.slice(0, l) : t.slice(0, s)), c += t;
					} else !Ki(f) && !Yi(f) || f === n && this.isCollapsed() || (c += f.getTextContent());
				}
				return c;
			}
			applyDOMRange(t) {
				const e = _i(), n = e.getEditorState()._selection, o = Mr(t.startContainer, t.startOffset, t.endContainer, t.endOffset, e, n);
				if (null === o) return;
				const [r, i, s] = o;
				this.anchor.set(r.key, r.offset, r.type, !0), this.focus.set(i.key, i.offset, i.type, !0), s && (this.dirty = !0), It$5(this);
			}
			clone() {
				const t = this.anchor, e = this.focus;
				return new fr(or(t.key, t.offset, t.type), or(e.key, e.offset, e.type), this.format, this.style);
			}
			toggleFormat(t) {
				this.format = Ws(this.format, t, null), this.dirty = !0;
			}
			setFormat(t) {
				this.format = t, this.dirty = !0;
			}
			setStyle(t) {
				this.style = t, this.dirty = !0;
			}
			hasFormat(t) {
				const e = z$2[t];
				return 0 !== (this.format & e);
			}
			insertRawText(t) {
				this.insertNodes(qr(t));
			}
			insertText(e) {
				let n = this.format, o = this.style;
				if (!this.isCollapsed()) {
					const t = (this.focus.isBefore(this.anchor) ? this.focus : this.anchor).getNode();
					if (Xo(t) && (n = t.getFormat(), o = t.getStyle()), this.removeText(), this.format = n, this.style = o, "" === e) return;
					if (null === qs()) return "element" === this.anchor.type && sr(this.anchor, this.focus, n, o), void lr(this, e, n, o);
				}
				"element" === this.anchor.type && sr(this.anchor, this.focus, n, o);
				const r = this.anchor.getNode();
				Xo(r) || t(398);
				const i = this.anchor.offset, s = r.getParentOrThrow(), l = r.getTextContentSize();
				if (Ks(r) || 0 === i && (!r.canInsertTextBefore() || !s.canInsertTextBefore() && !r.__prev) || i === l && (!r.canInsertTextAfter() || !s.canInsertTextAfter() && !r.__next)) {
					if (r.isSegmented() && 0 !== i && i !== l) {
						if (null !== qs()) r.setMode("normal").setFormat(n).setStyle(o);
						else {
							const t = Go(r.getTextContent());
							t.setFormat(n), t.setStyle(o), r.replace(t), t.select(i, i);
						}
						"" !== e && this.insertText(e);
						return;
					}
					if ("" === e) return;
					if (0 === i) {
						const t = r.getPreviousSibling();
						if (Xo(t) && t.canInsertTextAfter() && !Ks(t)) t.select();
						else {
							const t = Go();
							t.setFormat(n), t.setStyle(o), s.canInsertTextBefore() ? r.insertBefore(t) : s.insertBefore(t), t.select();
						}
						this.insertText(e);
						return;
					}
					if (i === l) {
						const t = r.getNextSibling();
						if (Xo(t) && t.canInsertTextBefore() && !Ks(t)) t.select(0, 0);
						else {
							const t = Go();
							t.setFormat(n), t.setStyle(o), s.canInsertTextAfter() ? r.insertAfter(t) : s.insertAfter(t), t.select(0, 0);
						}
						this.insertText(e);
						return;
					}
					const t = Go(e);
					t.setFormat(n), t.setStyle(o), r.replace(t), t.select();
					return;
				}
				if ("" === e) return;
				const c = s.isInline() && 0 === i && !r.__prev, a = s.isInline() && i === l && !r.__next, u = r.getFormat() !== n || r.getStyle() !== o;
				if (c || a || u) {
					if ("" !== r.getTextContent() || c || a) return void lr(this, e, n, o);
					r.setFormat(n), r.setStyle(o);
				}
				r.spliceText(i, 0, e, !0), r.isComposing() && "text" === this.anchor.type && this.anchor.set(this.anchor.key, this.anchor.offset - e.length, this.anchor.type);
			}
			removeText() {
				const t = Kr() === this;
				ou(this, cu(ru(this))), t && Kr() !== this && ol(this);
			}
			formatText(t, e = null) {
				_r(this, t, e);
			}
			insertNodes(e) {
				if (0 === e.length) return;
				this.isCollapsed() || this.removeText();
				const n = this.anchor.getNode();
				if ("element" === this.anchor.type && Pi(n) && null !== ta(n)) {
					let o = n.isShadowRoot() ? n.getFirstChild() ?? n.append(es()).getFirstChild() : n.getFirstChild();
					if (n.isShadowRoot() && null !== o && !Pi(o)) {
						const t = es();
						o.insertBefore(t), o = t;
					}
					if (null !== o) {
						o.selectStart();
						const n = Kr();
						return ur(n) || t(369), n.insertNodes(e);
					}
				}
				if ("element" === this.anchor.type && Bl(n)) {
					const t = ti(e), o = t.getLastDescendant();
					n.splice(this.anchor.offset, 0, t.getChildren()), null !== o && o.selectEnd();
					return;
				}
				let o = (this.isBackward() ? this.focus : this.anchor).getNode(), r = qc(o, Sc);
				const i = e[e.length - 1];
				if (Pi(r) && "__language" in r) {
					if ("__language" in e[0]) this.insertText(e[0].getTextContent());
					else {
						const t = Xr(this);
						r.splice(t, 0, e), i.selectEnd();
					}
					return;
				}
				if (!e.some((t) => (Pi(t) || Ki(t)) && !t.isInline())) {
					Pi(r) || t(211, o.constructor.name, o.getType());
					const n = Xr(this);
					r.splice(n, 0, e), i.selectEnd();
					return;
				}
				if (Pi(r) && null !== ta(r)) {
					const t = Xr(this), n = Gr(e);
					r.splice(t, 0, n);
					const o = n[n.length - 1];
					void 0 !== o ? o.selectEnd() : r.select(t, t);
					return;
				}
				if (null === r) {
					const t = ti(e), n = t.getLastDescendant();
					let o = tu(this.anchor, "next");
					for (const e of t.getChildren()) o = mu(e, o);
					null !== n && n.selectEnd();
					return;
				}
				if (Pi(r) && !r.isParentRequired() && !Bl(r.getParentOrThrow())) {
					const t = Xr(this), n = Gr(e);
					r.splice(t, 0, n);
					const o = n[n.length - 1];
					void 0 !== o ? o.selectEnd() : r.select(t, t);
					return;
				}
				const s = ti(e), l = s.getLastDescendant(), c = s.getChildren(), a = !Pi(r) || !r.isEmpty() ? this.insertParagraph() : null;
				a && !r.isAttached() && (o = this.anchor.getNode(), r = qc(o, Sc));
				const u = c[c.length - 1];
				let f = c[0];
				var d;
				Pi(d = f) && Sc(d) && !d.isEmpty() && Pi(r) && (!r.isEmpty() || r.canMergeWhenEmpty()) && (Pi(r) || t(211, o.constructor.name, o.getType()), r.append(...f.getChildren()), f = c[1]), f && (null === r && t(212, o.constructor.name, o.getType()), function(e, n) {
					const o = n.getParentOrThrow().getLastChild();
					let r = n;
					const i = [n];
					for (; r !== o;) r.getNextSibling() || t(140), r = r.getNextSibling(), i.push(r);
					let s = e;
					for (const t of i) s = s.insertAfter(t);
				}(r, f));
				const h = qc(l, Sc);
				a && Pi(h) && (a.canMergeWhenEmpty() || Sc(u)) && (h.append(...a.getChildren()), a.remove()), Pi(r) && r.isEmpty() && r.remove(), l.selectEnd();
				const g = Pi(r) ? r.getLastChild() : null;
				Yi(g) && h !== r && g.remove();
			}
			insertParagraph() {
				const e = this.anchor.getNode();
				if ("element" === this.anchor.type && Bl(e)) {
					const t = es();
					return e.splice(this.anchor.offset, 0, [t]), t.select(), t;
				}
				const n = Xr(this), o = qc(this.anchor.getNode(), Sc);
				if (null !== o && null !== ta(o)) return null;
				Pi(o) || t(213);
				const r = o.getChildAtIndex(n), i = r ? [r, ...r.getNextSiblings()] : [], s = o.insertNewAfter(this, !1);
				return s ? (s.append(...i), s.selectStart(), s) : null;
			}
			insertLineBreak(t) {
				const e = qi();
				if (this.insertNodes([e]), t) {
					const t = e.getParentOrThrow(), n = e.getIndexWithinParent();
					t.select(n, n);
				}
			}
			extract() {
				const t = [...this.getNodes()], e = t.length;
				let n = t[0], o = t[e - 1];
				const [r, i] = yr(this), s = this.isBackward(), [l, c] = s ? [this.focus, this.anchor] : [this.anchor, this.focus], [a, u] = s ? [i, r] : [r, i];
				if (0 === e) return [];
				if (1 === e) {
					if (Xo(n) && !this.isCollapsed()) {
						const t = n.splitText(a, u), e = 0 === a ? t[0] : t[1];
						return e ? (l.set(e.getKey(), 0, "text"), c.set(e.getKey(), e.getTextContentSize(), "text"), [e]) : [];
					}
					return [n];
				}
				if (Xo(n) && (a === n.getTextContentSize() ? t.shift() : 0 !== a && ([, n] = n.splitText(a), t[0] = n, l.set(n.getKey(), 0, "text"))), Xo(o)) {
					const e = o.getTextContent().length;
					0 === u ? t.pop() : u !== e && ([o] = o.splitText(u), t[t.length - 1] = o, c.set(o.getKey(), o.getTextContentSize(), "text"));
				}
				return t;
			}
			modify(t, e, n) {
				if (ei(this, t, e, n)) return;
				const o = "move" === t, r = _i(), i = Jl(Il(r));
				if (!i) return;
				const s = r._blockCursorElement, l = r._rootElement, c = this.focus.getNode();
				null === l || null === s || !Pi(c) || c.isInline() || c.canBeEmpty() || jl(s, r, l);
				const a = El(r, this.focus.key);
				let u = a;
				if ("text" === this.focus.type && (u = Xo(c) ? wc(c, a, r) : null), this.dirty) {
					const t = El(r, this.anchor.key);
					let e = t;
					if ("text" === this.anchor.type) {
						const n = this.anchor.getNode();
						e = Xo(n) ? wc(n, t, r) : null;
					}
					e && u && Ur(i, e, this.anchor.offset, u, this.focus.offset);
				}
				if ("character" === n && Xo(c) && c.isUnmergeable()) {
					if (e ? 0 === this.focus.offset : this.focus.offset === c.getTextContentSize()) {
						const t = Ia(c, e ? "previous" : "next").getNodeAtCaret();
						if (Xo(t)) {
							if (!o) {
								const n = t.getTextContentSize();
								e ? this.focus.set(t.__key, n - 1, "text") : this.focus.set(t.__key, 1, "text"), this.dirty = !0;
								return;
							}
							{
								const n = r.getElementByKey(t.getKey()), o = n ? wc(t, n, r) : null;
								if (o) {
									const t = e ? o.length : 0;
									Ur(i, o, t, o, t);
								}
							}
						}
					}
				}
				if (Cr(i, t, e ? "backward" : "forward", n), i.rangeCount > 0) {
					const t = tc(i, r._rootElement), n = t || i.getRangeAt(0), s = this.anchor.getNode(), l = Bi(s) ? s : Kl(s);
					if (this.applyDOMRange(n), this.dirty = !0, !o) {
						Sr(this, e, l);
						(t ? "backward" !== i.direction : i.anchorNode === n.startContainer && i.anchorOffset === n.startOffset) || xr(this);
					}
				}
				"lineboundary" === n && ei(this, t, e, n, "decorators");
			}
			forwardDeletion(t, e, n) {
				if (!n && ("element" === t.type && Pi(e) && t.offset === e.getChildrenSize() || "text" === t.type && t.offset === e.getTextContentSize())) {
					const t = e.getParent(), n = e.getNextSibling() || (null === t ? null : t.getNextSibling());
					if (Pi(n) && n.isShadowRoot()) return !0;
				}
				return !1;
			}
			deleteCharacter(t) {
				const e = this.isCollapsed();
				if (this.isCollapsed()) {
					const e = this.anchor;
					let n = e.getNode();
					if (this.forwardDeletion(e, n, t)) return;
					const o = ja(tu(e, t ? "previous" : "next"));
					if (o.getTextSlices().every((t) => null === t || 0 === t.distance)) {
						let t = { type: "initial" };
						for (const e of o.iterNodeCarets("shadowRoot")) if (Aa(e)) if (e.origin.isInline());
						else {
							if (e.origin.isShadowRoot()) {
								if ("merge-block" === t.type) break;
								if (Pi(o.anchor.origin) && o.anchor.origin.isEmpty()) {
									const t = au(e);
									ou(this, Va(t, t)), o.anchor.origin.remove();
								}
								return;
							}
							"merge-next-block" !== t.type && "merge-block" !== t.type || (t = {
								block: t.block,
								caret: e,
								type: "merge-block"
							});
						}
						else {
							if ("merge-block" === t.type) break;
							if (Ma(e)) {
								if (Pi(e.origin)) {
									if (e.origin.isInline()) {
										if (!e.origin.isParentOf(o.anchor.origin)) break;
									} else t = {
										block: e.origin,
										type: "merge-next-block"
									};
									continue;
								}
								if (Ki(e.origin)) {
									if (e.origin.isIsolated());
									else if (ia(e.origin).length > 0) {
										if (Pi(o.anchor.origin) && o.anchor.origin.isEmpty()) {
											o.anchor.origin.remove();
											const t = Pr();
											t.add(e.origin.getKey()), ol(t);
										}
									} else if ("merge-next-block" === t.type && (e.origin.isKeyboardSelectable() || !e.origin.isInline()) && Pi(o.anchor.origin) && o.anchor.origin.isEmpty()) {
										o.anchor.origin.remove();
										const t = Pr();
										t.add(e.origin.getKey()), ol(t);
									} else e.origin.remove();
									return;
								}
								break;
							}
						}
						if ("merge-block" === t.type) {
							const { caret: e, block: n } = t;
							if (ia(n).length > 0) return;
							return e.origin.isEmpty() && !n.isEmpty() && e.origin.getParent() === n.getParent() ? void e.origin.remove(!0) : (ou(this, Va(!e.origin.isEmpty() && n.isEmpty() ? iu(Ia(n, e.direction)) : o.anchor, e)), this.removeText());
						}
						for (let t = e.getNode(); null !== t;) {
							if (null !== ta(t)) return;
							if (Pi(t) && t.isShadowRoot()) break;
							t = t.getParent();
						}
					}
					const r = this.focus;
					if (vr(this, t, "character"), this.isCollapsed()) {
						if (t && 0 === e.offset && mr(this, e.getNode())) return;
					} else {
						const o = "text" === r.type ? r.getNode() : null;
						if (n = "text" === e.type ? e.getNode() : null, null !== o && o.isSegmented()) {
							const e = r.offset, i = o.getTextContentSize();
							if (o.is(n) || t && e !== i || !t && 0 !== e) return void kr(o, t, e);
						} else if (null !== n && n.isSegmented()) {
							const r = e.offset, i = n.getTextContentSize();
							if (n.is(o) || t && 0 !== r || !t && r !== i) return void kr(n, t, r);
						}
						(function(t, e) {
							const n = t.anchor, o = t.focus, r = n.getNode();
							if (r === o.getNode() && "text" === n.type && "text" === o.type) {
								const t = n.offset, i = o.offset, s = t < i, l = s ? t : i, c = s ? i : t, a = c - 1;
								if (l !== a) (function(t) {
									return !(sl(t) || Tr(t));
								})(r.getTextContent().slice(l, c)) && (e ? o.set(o.key, a, o.type) : n.set(n.key, a, n.type));
							}
						})(this, t);
					}
				}
				if (this.removeText(), t && !e && this.isCollapsed() && "element" === this.anchor.type && 0 === this.anchor.offset) {
					const t = this.anchor.getNode();
					t.isEmpty() && Bi(t.getParent()) && null === t.getPreviousSibling() && mr(this, t), ar();
				}
			}
			deleteLine(t) {
				const e = Er(this.anchor);
				if (null !== e && Ki(ea(e))) return this.isCollapsed() || this.focus.set(this.anchor.key, this.anchor.offset, this.anchor.type), void this.deleteCharacter(t);
				if (this.isCollapsed() && vr(this, t, "lineboundary"), this.isCollapsed()) this.deleteCharacter(t);
				else qc(this.anchor.getNode(), Sc) !== qc(this.focus.getNode(), Sc) ? (this.focus.set(this.anchor.key, this.anchor.offset, this.anchor.type), this.deleteCharacter(t)) : this.removeText();
			}
			deleteWord(t) {
				if (this.isCollapsed()) {
					const e = this.anchor, n = e.getNode();
					if (this.forwardDeletion(e, n, t)) return;
					vr(this, t, "word");
				}
				this.isCollapsed() ? this.deleteCharacter(t) : this.removeText();
			}
			isBackward() {
				const t = this._cachedIsBackward;
				if (null !== t) return t;
				const e = this.focus.isBefore(this.anchor);
				return ui() || (this._cachedIsBackward = e), e;
			}
			getStartEndPoints() {
				return [this.anchor, this.focus];
			}
		};
		function dr(t) {
			return t instanceof cr;
		}
		function hr(t, e) {
			if (dr(t)) {
				for (const n of t.getNodes()) Ro(n) && n.setFormat(e(n.getFormat()));
				return;
			}
			if (t.isCollapsed()) return t.setFormat(e(t.format)), void Vs(null);
			const n = [];
			for (const o of t.getNodes()) Xo(o) ? n.push(o) : Pi(o) ? o.setTextFormat(e(o.getTextFormat())) : Ro(o) && o.setFormat(e(o.getFormat()));
			const o = n.length;
			if (0 === o) return t.setFormat(e(t.format)), void Vs(null);
			const r = t.anchor, i = t.focus, s = t.isBackward(), l = s ? i : r, c = s ? r : i;
			let a = 0, u = n[0], f = "element" === l.type ? 0 : l.offset;
			if ("text" === l.type && f === u.getTextContentSize() && (a = 1, u = n[1], f = 0), null == u) return;
			const d = o - 1;
			let h = n[d];
			const g = "text" === c.type ? c.offset : h.getTextContentSize();
			if (u.is(h)) {
				if (f === g) return;
				const n = e(u.getFormat());
				if (Ks(u) || 0 === f && g === u.getTextContentSize()) u.setFormat(n);
				else {
					const t = u.splitText(f, g), e = 0 === f ? t[0] : t[1];
					e.setFormat(n), "text" === l.type && l.set(e.__key, 0, "text"), "text" === c.type && c.set(e.__key, g - f, "text");
				}
				t.format = n;
				return;
			}
			0 === f || Ks(u) || ([, u] = u.splitText(f), f = 0);
			const _ = e(u.getFormat());
			u.setFormat(_);
			const p = e(h.getFormat());
			g > 0 && (g === h.getTextContentSize() || Ks(h) || ([h] = h.splitText(g)), h.setFormat(p));
			for (let t = a + 1; t < d; t++) {
				const o = n[t];
				o.setFormat(e(o.getFormat()));
			}
			"text" === l.type && l.set(u.__key, f, "text"), "text" === c.type && c.set(h.__key, g, "text"), t.format = _ | p;
		}
		function gr(t, e) {
			const n = [];
			for (const [t, o] of Object.entries(e)) "boolean" == typeof o && n.push([t, o]);
			0 !== n.length && hr(t, (t) => {
				for (const [e, o] of n) t = Ws(t, e, o ? z$2[e] : 0);
				return t;
			});
		}
		function _r(t, e, n = null) {
			const o = null === n && ur(t) ? Ws(t.format, e, null) : n;
			hr(t, (t) => Ws(t, e, o));
		}
		function pr(t) {
			const e = t.offset;
			if ("text" === t.type) return e;
			const n = t.getNode();
			return e === n.getChildrenSize() ? n.getTextContent().length : 0;
		}
		function yr(t) {
			const e = t.getStartEndPoints();
			if (null === e) return [0, 0];
			const [n, o] = e;
			return "element" === n.type && "element" === o.type && n.key === o.key && n.offset === o.offset ? [0, 0] : [pr(n), pr(o)];
		}
		function mr(t, e) {
			for (let n = e; n; n = n.getParent()) {
				if (Pi(n)) {
					if (n.collapseAtStart(t)) return !0;
					if (Bl(n)) break;
				}
				if (n.getPreviousSibling()) break;
			}
			return !1;
		}
		function xr(t) {
			const e = t.focus, n = t.anchor, o = n.key, r = n.offset, i = n.type;
			n.set(e.key, e.offset, e.type, !0), e.set(o, r, i, !0);
		}
		function Cr(t, e, n, o) {
			t.modify(e, n, o);
		}
		function Sr(t, e, n) {
			const o = t.getNodes(), r = o.filter((t) => Fl(t, n));
			if (0 === r.length || r.length === o.length) return !1;
			const i = e ? r[0] : r[r.length - 1], s = Pi(i) ? i : i.getParentOrThrow();
			return e ? s.selectStart() : s.selectEnd(), !0;
		}
		function vr(t, e, n) {
			if (ei(t, "extend", e, n)) return;
			const o = _i(), r = Jl(Il(o));
			if (!r || "function" != typeof r.modify) return;
			const i = o._blockCursorElement, s = o._rootElement, l = t.anchor, c = t.focus.getNode();
			null === s || null === i || !Pi(c) || c.isInline() || c.canBeEmpty() || jl(i, o, s);
			const a = (t) => {
				const e = t.getNode(), n = o.getElementByKey(t.key);
				return null !== n && "text" === t.type && Xo(e) ? wc(e, n, o) : n;
			}, u = l.getNode(), f = a(l);
			if (null === f) return;
			const d = l.offset, h = t.isCollapsed(), g = t.focus, _ = h ? f : a(g);
			if (null === _) return;
			const p = g.offset;
			if (Ur(r, _, p, _, p), Cr(r, "move", e ? "backward" : "forward", n), 0 === r.rangeCount) return;
			const y = tc(r, s) || r.getRangeAt(0), m = y.startContainer, x = y.startOffset;
			if (h && "character" === n && "text" === l.type && Xo(u) && u.isUnmergeable()) {
				if (d === (e ? 0 : u.getTextContentSize())) {
					const n = Ia(u, e ? "previous" : "next").getNodeAtCaret();
					if (Xo(n)) {
						const o = e ? n.getTextContentSize() - 1 : 1;
						t.focus.set(n.__key, o, "text"), t.dirty = !0;
						return;
					}
				}
			}
			if (h && "character" === n && "text" === l.type) {
				const n = e ? 0 : u.getTextContentSize(), o = m === f ? x : d !== n ? n : -1;
				if (o >= 0) return void (o !== d && (t.focus.set(l.key, o, "text"), t.dirty = !0));
			}
			const [C, S, v, T] = e ? [
				m,
				x,
				f,
				d
			] : [
				f,
				d,
				m,
				x
			], k = Bi(u) ? u : Kl(u);
			t.applyDOMRange({
				collapsed: !1,
				endContainer: v,
				endOffset: T,
				startContainer: C,
				startOffset: S
			}), t.dirty = !0, !Sr(t, e, k) && e && xr(t), "lineboundary" === n && ei(t, "extend", e, n, "decorators");
		}
		const Tr = (() => {
			try {
				const t = new RegExp("\\p{Emoji}", "u"), e = t.test.bind(t);
				if (e("❤️") && e("#️⃣") && e("👍")) return e;
			} catch (t) {}
			return () => !1;
		})();
		function kr(t, e, n) {
			const o = t, r = o.getTextContent().split(/(?=\s)/g), i = r.length;
			let s = 0, l = 0;
			for (let t = 0; t < i; t++) {
				const o = t === i - 1;
				if (l = s, s += r[t].length, e && s === n || s > n || o) {
					r.splice(t, 1), o && (l = void 0);
					break;
				}
			}
			const c = r.join("").trim();
			"" === c ? o.remove() : (o.setTextContent(c), o.select(l, l));
		}
		function br(e, n, o, r) {
			let i, s = n, l = !1;
			if (gc(e)) {
				let c = !1;
				const a = e.childNodes, u = a.length, f = r._blockCursorElement;
				s === u && u > 0 && (c = !0, s = u - 1), void 0 !== Qs(e, r) || Rc(e, r) || (l = !0);
				let d = a[s], h = !1;
				if (d === f) d = a[s + 1], h = !0;
				else if (null !== f) {
					const t = f.parentNode;
					if (e === t) n > Array.prototype.indexOf.call(t.children, f) && s--;
				}
				if (i = il(d), Xo(i)) s = Ka(i, c ? "next" : "previous");
				else {
					let a = il(e);
					if (null === a) return null;
					if (Pi(a)) {
						const l = r.getElementByKey(a.getKey());
						null === l && t(214);
						const u = kc(a, l, r);
						[a, s] = u.resolveChildIndex(a, l, e, n), Pi(a) || t(215), c && s >= a.getChildrenSize() && (s = Math.max(0, a.getChildrenSize() - 1));
						let f = a.getChildAtIndex(s);
						if (Pi(f) && function(t, e, n) {
							const o = t.getParent();
							return null === n || null === o || !o.canBeEmpty() || o !== n.getNode();
						}(f, 0, o)) {
							const t = c ? f.getLastDescendant() : f.getFirstDescendant();
							null === t ? a = f : (f = t, a = Pi(f) ? f : f.getParentOrThrow()), s = 0;
						}
						Xo(f) ? (i = f, a = null, s = Ka(f, c ? "next" : "previous")) : f !== a && c && !h && (Pi(a) || t(216), s = Math.min(a.getChildrenSize(), s + 1));
					} else {
						const t = ea(a), o = null !== t ? t : a, i = o.getIndexWithinParent(), l = r.getElementByKey(a.getKey());
						let c = "after";
						if (null !== l && il(e) === a) {
							const t = kc(a, l, r);
							t.element !== l ? c = t.resolveLeafPosition(l, e, n) : 0 === n && Ki(a) && (c = "before");
						}
						s = "before" === c ? i : i + 1, a = o.getParentOrThrow();
					}
					if (Pi(a)) return [or(a.__key, s, "element"), l];
				}
			} else i = il(e);
			return Xo(i) ? [or(i.__key, Ka(i, s, "clamp"), "text"), l] : null;
		}
		function Nr(t, e, n) {
			const o = t.offset, r = t.getNode();
			if (0 === o) {
				const o = r.getPreviousSibling(), i = r.getParent();
				if (e) {
					if ((n || !e) && null === o && Pi(i) && i.isInline()) {
						const e = i.getPreviousSibling();
						Xo(e) && t.set(e.__key, e.getTextContent().length, "text");
					}
				} else Pi(o) && !n && o.isInline() ? t.set(o.__key, o.getChildrenSize(), "element") : Xo(o) && !r.isUnmergeable() && t.set(o.__key, o.getTextContent().length, "text");
			} else if (o === r.getTextContent().length) {
				const o = r.getNextSibling(), i = r.getParent();
				if (e && Pi(o) && o.isInline()) t.set(o.__key, 0, "element");
				else if ((n || e) && null === o && Pi(i) && i.isInline() && !i.canInsertTextAfter() && i.getTextContentSize() > 1) {
					const e = i.getNextSibling();
					Xo(e) && t.set(e.__key, 0, "text");
				}
			}
		}
		function Er(t) {
			const e = Ys(t.key);
			return null === e ? null : oa(e);
		}
		function wr(t, e, n) {
			const o = Er(t), r = Er(e);
			if (o === r || null !== o && null !== r && o.is(r)) return !1;
			const i = n(o, r);
			if (null !== o) return Pi(o) ? e.set(o.getKey(), i ? o.getChildrenSize() : 0, "element") : e.set(o.getKey(), i ? o.getTextContentSize() : 0, "text"), !0;
			const s = ea(r);
			if (null === s) return !1;
			const l = s.getParent();
			if (null === l) return !1;
			const c = s.getIndexWithinParent();
			return e.set(l.getKey(), i ? c + 1 : c, "element"), !0;
		}
		function Or(t) {
			const e = wr(t.anchor, t.focus, (e, n) => function(t, e, n, o) {
				if (null !== n && null !== o) {
					const t = ea(n), e = ea(o);
					if (null !== t && t.is(e)) {
						for (const e of ra(t).values()) {
							if (e === n.getKey()) return !0;
							if (e === o.getKey()) return !1;
						}
						return !0;
					}
					return null === t || null === e || t.isBefore(e);
				}
				if (null !== n) {
					const t = ea(n), o = Ys(e.key);
					return null === t || null === o || !(!t.is(o) && !t.isParentOf(o)) || t.isBefore(o);
				}
				const r = ea(o), i = Ys(t.key);
				return null !== r && null !== i && !r.is(i) && !r.isParentOf(i) && i.isBefore(r);
			}(t.anchor, t.focus, e, n));
			return e && (t.dirty = !0), e;
		}
		function Mr(t, e, n, o, r, i) {
			if (null === t || null === n || !As(r, t, n)) return null;
			const s = br(t, e, ur(i) ? i.anchor : null, r);
			if (null === s) return null;
			const l = br(n, o, ur(i) ? i.focus : null, r);
			if (null === l) return null;
			const [c, a] = s, [u, f] = l;
			if ("element" === c.type && "element" === u.type) {
				const e = il(t), o = il(n);
				if (Ki(e) && Ki(o)) return null;
			}
			const d = r._slotsUsed && wr(c, u, () => 0 !== (t.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING));
			return function(t, e) {
				if ("text" === t.type && "text" === e.type) {
					const n = t.isBefore(e), o = t.is(e);
					Nr(t, n, o), Nr(e, !n, o), o && e.set(t.key, t.offset, t.type);
				}
			}(c, u), [
				c,
				u,
				a || f || d
			];
		}
		function Ar(t) {
			return Pi(t) && !t.isInline();
		}
		function Dr(t, e, n, o, r, i) {
			const s = hi(), l = new fr(or(t, e, r), or(n, o, i), 0, "");
			return l.dirty = !0, s._selection = l, l;
		}
		function Fr() {
			return new fr(or("root", 0, "element"), or("root", 0, "element"), 0, "");
		}
		function Pr() {
			return new cr(/* @__PURE__ */ new Set());
		}
		function Ir(t, e) {
			return Lr(null, t, e, null);
		}
		function Lr(t, e, n, o) {
			const r = n._window;
			if (null === r) return null;
			const i = o || r.event, s = i ? i.type : void 0, l = "selectionchange" === s, c = !it$5 && (l || "beforeinput" === s || "compositionstart" === s || "compositionend" === s || "click" === s && i && 3 === i.detail || "drop" === s || void 0 === s);
			let a, u, f, d;
			if (ur(t) && !c) return t.clone();
			{
				if (null === e) return null;
				const o = nc(e, n._rootElement);
				if (a = o.anchorNode, u = o.focusNode, f = o.anchorOffset, d = o.focusOffset, (l || void 0 === s) && ur(t) && !As(n, a, u)) return t.clone();
			}
			const h = Mr(a, f, u, d, n, t);
			if (null === h) return null;
			const [g, _, p] = h;
			let y = 0, m = "";
			if (ur(t)) {
				const e = t.anchor;
				if (g.key === e.key) y = t.format, m = t.style;
				else {
					const t = g.getNode();
					Xo(t) ? (y = t.getFormat(), m = t.getStyle()) : Pi(t) && (y = t.getTextFormat(), m = t.getTextStyle());
				}
			}
			const x = new fr(g, _, y, m);
			return p && (x.dirty = !0), x;
		}
		function Kr() {
			return hi()._selection;
		}
		function zr() {
			return _i()._editorState._selection;
		}
		function Br(t, e, n, o = 1) {
			const r = t.anchor, i = t.focus, s = r.getNode(), l = i.getNode();
			if (!e.is(s) && !e.is(l)) return;
			const c = e.__key;
			if (t.isCollapsed()) {
				const e = r.offset;
				if (n <= e && o > 0 || n < e && o < 0) {
					const n = Math.max(0, e + o);
					r.set(c, n, "element"), i.set(c, n, "element"), Rr(t);
				}
			} else {
				const s = t.isBackward(), l = s ? i : r, a = l.getNode(), u = s ? r : i, f = u.getNode();
				if (e.is(a)) {
					const t = l.offset;
					(n <= t && o > 0 || n < t && o < 0) && l.set(c, Math.max(0, t + o), "element");
				}
				if (e.is(f)) {
					const t = u.offset;
					(n <= t && o > 0 || n < t && o < 0) && u.set(c, Math.max(0, t + o), "element");
				}
			}
			Rr(t);
		}
		function Rr(t) {
			const e = t.anchor, n = e.offset, o = t.focus, r = o.offset, i = e.getNode(), s = o.getNode();
			if (t.isCollapsed()) {
				if (!Pi(i)) return;
				const t = i.getChildrenSize(), r = n >= t, s = r ? i.getChildAtIndex(t - 1) : i.getChildAtIndex(n);
				if (Xo(s)) {
					let t = 0;
					r && (t = s.getTextContentSize()), e.set(s.__key, t, "text"), o.set(s.__key, t, "text");
				}
				return;
			}
			if (Pi(i)) {
				const t = i.getChildrenSize(), o = n >= t, r = o ? i.getChildAtIndex(t - 1) : i.getChildAtIndex(n);
				if (Xo(r)) {
					let t = 0;
					o && (t = r.getTextContentSize()), e.set(r.__key, t, "text");
				}
			}
			if (Pi(s)) {
				const t = s.getChildrenSize(), e = r >= t, n = e ? s.getChildAtIndex(t - 1) : s.getChildAtIndex(r);
				if (Xo(n)) {
					let t = 0;
					e && (t = n.getTextContentSize()), o.set(n.__key, t, "text");
				}
			}
		}
		function Wr(t, e, n, o, r) {
			let i = null, s = 0, l = null;
			null !== o ? (i = o.__key, Xo(o) ? (s = o.getTextContentSize(), l = "text") : Pi(o) && (s = o.getChildrenSize(), l = "element")) : null !== r && (i = r.__key, Xo(r) ? l = "text" : Pi(r) && (l = "element")), null !== i && null !== l ? t.set(i, s, l) : (s = e.getIndexWithinParent(), -1 === s && (s = n.getChildrenSize()), t.set(n.__key, s, "element"));
		}
		function $r(t, e, n, o, r) {
			"text" === t.type ? t.set(n, t.offset + (e ? 0 : r), "text") : t.offset > o.getIndexWithinParent() && t.set(t.key, t.offset - 1, "element");
		}
		function Ur(t, e, n, o, r) {
			try {
				t.setBaseAndExtent(e, n, o, r);
			} catch (t) {}
		}
		function Hr(t, e, n) {
			const o = El(t, e.getKey());
			if (Pi(e)) {
				const r = kc(e, o, t);
				return [r.element, n + r.getFirstChildOffset()];
			}
			return [o, n];
		}
		function jr(t, e, n, o, r, s) {
			const l = s.getRootNode(), c = Bs(l) || ql(l) ? cc(l) : null;
			if (r.has("collaboration") && c !== s || null !== c && Os(c, c)) return;
			const a = nc(o, s);
			let u;
			if (!ur(e)) return void (null !== t && As(n, a.anchorNode, a.focusNode) && o.removeAllRanges());
			const f = e.anchor, d = e.focus, h = f.getNode(), g = d.getNode(), [_, p] = Hr(n, h, f.offset), [y, m] = Hr(n, g, d.offset), x = e.format, C = e.style, S = e.isCollapsed();
			let v = _, T = y, k = !1;
			if ("text" === f.type ? (v = Xo(h) ? wc(h, _, n) : null, k = h.getFormat() !== x || h.getStyle() !== C) : ur(t) && "text" === t.anchor.type && (k = !0), "text" === d.type && (T = Xo(g) ? wc(g, y, n) : null), null !== v && null !== T) {
				if (S && (null === t || k || ur(t) && (t.format !== x || t.style !== C)) && function(t, e, n, o, r, i) {
					t._inputState.collapsedSelectionFormat = {
						format: e,
						key: r,
						offset: o,
						style: n,
						timeStamp: i
					};
				}(n, x, C, p, f.key, performance.now()), ("Range" !== o.type || !S) && a.anchorOffset === p && a.focusOffset === m && a.anchorNode === v && a.focusNode === T) {
					if (null === c || !s.contains(c)) {
						const t = null !== c ? Fs(c) : null;
						null !== t && t !== n || r.has("skip-selection-focus") || s.focus({ preventScroll: !0 });
					}
					if ("element" !== f.type) return;
				}
				if (Ur(o, v, p, T, m), i && e.isCollapsed() && null !== s && !r.has("skip-selection-focus")) {
					const t = lc(s);
					if (null === t || !s.contains(t)) {
						const t = cc(s.ownerDocument), e = null !== t ? Fs(t) : null;
						null !== e && e !== n || s.focus({ preventScroll: !0 });
					}
				}
				if (!r.has("skip-scroll-into-view") && e.isCollapsed() && null !== s && s === lc(s)) {
					const t = ur(e) && "element" === e.anchor.type ? v.childNodes[p] || null : (void 0 === u && (u = ec(o, s)), u);
					if (null !== t) {
						let e;
						if (zs(t)) {
							const n = t.ownerDocument.createRange();
							n.selectNode(t), e = n.getBoundingClientRect();
						} else e = t.getBoundingClientRect();
						(function(t, e, n) {
							const o = Ol(n), r = Pl(o);
							if (null === o || null === r) return;
							const i = n.getBoundingClientRect();
							if (e.bottom < i.top) return;
							let { top: s, bottom: l } = e, c = 0, a = 0, u = n;
							for (; null !== u;) {
								const e = u === o.body;
								if (e) {
									const e = r.visualViewport;
									if (e) {
										const t = e.offsetTop;
										c = t, a = t + e.height;
									} else c = 0, a = Il(t).innerHeight;
									const n = r.getComputedStyle(o.documentElement), i = parseFloat(n.scrollPaddingTop), s = parseFloat(n.scrollPaddingBottom);
									isFinite(i) && (c += i), isFinite(s) && (a -= s);
								} else {
									const t = u === n ? i : u.getBoundingClientRect();
									c = t.top, a = t.bottom;
								}
								let f = 0;
								if (s < c ? f = -(c - s) : l > a && (f = l - a), 0 !== f) if (e) r.scrollBy(0, f);
								else {
									const t = u.scrollTop;
									u.scrollTop += f;
									const e = u.scrollTop - t;
									s -= e, l -= e;
								}
								if (e) break;
								u = wl(u);
							}
						})(n, e, s);
					}
				}
				(function(t) {
					t._inputState.isSelectionChangeFromDOMUpdate = !0;
				})(n);
			}
		}
		function Jr(t) {
			let e = Kr() || zr();
			null === e && (e = nl().selectEnd()), e.insertNodes(t);
		}
		function Vr(t, e) {
			for (const n of t.split(/(\r?\n|\t)/)) "\n" === n || "\r\n" === n ? e.linebreak() : "	" === n ? e.tab() : "" !== n && e.text(n);
		}
		function qr(t) {
			const e = [];
			return Vr(t, {
				linebreak: () => e.push(qi()),
				tab: () => e.push(tr()),
				text: (t) => e.push(Go(t))
			}), e;
		}
		function Yr() {
			const t = Kr();
			return null === t ? "" : t.getTextContent();
		}
		function Gr(t) {
			const e = [];
			for (const n of t) Yi(n) || (!Pi(n) && !Ki(n) || n.isInline() ? e.push(n) : Pi(n) && e.push(...Gr(n.getChildren())));
			return e;
		}
		function Xr(e) {
			let n = e;
			e.isCollapsed() || n.removeText();
			const o = Kr();
			ur(o) && (n = o), ur(n) || t(161);
			const r = n.anchor;
			let i = r.getNode(), s = r.offset;
			for (; !Sc(i) && null === ta(i);) {
				const t = i;
				if ([i, s] = Qr(i, s), t.is(i)) break;
			}
			return s;
		}
		function Qr(t, e) {
			const n = t.getParent();
			if (!n) {
				const t = es();
				return nl().append(t), t.select(), [nl(), 0];
			}
			if (Xo(t)) {
				const o = t.splitText(e);
				if (0 === o.length) return [n, t.getIndexWithinParent()];
				const r = 0 === e ? 0 : 1;
				return [n, o[0].getIndexWithinParent() + r];
			}
			if (!Pi(t) || 0 === e) return [n, t.getIndexWithinParent()];
			const o = t.getChildAtIndex(e);
			if (o) {
				const n = new fr(or(t.__key, e, "element"), or(t.__key, e, "element"), 0, ""), r = t.insertNewAfter(n);
				r && r.append(o, ...o.getNextSiblings());
			}
			return [n, t.getIndexWithinParent() + 1];
		}
		function Zr(t) {
			return Yi(t) || Ll(t) || Xo(t) || t.isParentRequired();
		}
		function ti(t) {
			const e = es();
			let n = null;
			for (let o = 0; o < t.length; o++) {
				const r = t[o];
				if (Zr(r)) {
					if (null === n) {
						n = r.createParentElementNode(), e.append(n);
						const i = t[o + 1];
						if (Yi(r) && (void 0 === i || !Zr(i))) continue;
					}
					n.append(r);
				} else e.append(r), n = null;
			}
			return e;
		}
		function ei(t, e, n, o, r = "decorators-and-blocks") {
			if ("move" === e && "character" === o && !t.isCollapsed()) {
				const [e, o] = n === t.isBackward() ? [t.focus, t.anchor] : [t.anchor, t.focus];
				return o.set(e.key, e.offset, e.type), !0;
			}
			const i = tu(t.focus, n ? "previous" : "next"), s = "lineboundary" === o, l = "move" === e;
			let c = i, a = "decorators-and-blocks" === r;
			if (!uu(c)) {
				for (const t of c) {
					a = !1;
					const { origin: e } = t;
					if (!Ki(e) || e.isIsolated() || (c = t, !s || !e.isInline())) break;
				}
				if (a) for (const t of ja(i).iterNodeCarets("extend" === e ? "shadowRoot" : "root")) {
					if (Aa(t)) t.origin.isInline() || (c = t);
					else {
						if (Pi(t.origin)) continue;
						Ki(t.origin) && !t.origin.isInline() && (c = t);
					}
					break;
				}
			}
			if (c === i) return !1;
			if (l && !s && Ki(c.origin) && c.origin.isKeyboardSelectable()) {
				const t = Pr();
				return t.add(c.origin.getKey()), ol(t), !0;
			}
			return c = au(c), l && eu(t.anchor, c), eu(t.focus, c), a || !s;
		}
		let ni = null;
		let oi = null;
		let ri = !1;
		let ii = !1;
		let si = !1;
		const li = /* @__PURE__ */ new Set();
		let ci = 0;
		const ai = {
			characterData: !0,
			childList: !0,
			subtree: !0
		};
		function ui() {
			return ri || null !== ni && ni._readOnly;
		}
		function fi() {
			ri && t(13);
		}
		function di() {
			ci > 99 && t(14);
		}
		function hi() {
			return null === ni && t(195, yi()), ni;
		}
		function gi(t) {
			null !== hi() && null === oi && (oi = t), oi !== t && e(378);
		}
		function _i() {
			return null === oi && t(337, yi()), oi;
		}
		function pi() {
			_i()._dirtyType = 2;
		}
		function yi() {
			let t = 0;
			const e = /* @__PURE__ */ new Set(), n = Cs.version;
			if ("undefined" != typeof window) for (const o of Xl(document)) {
				const r = Ps(o);
				if (Ds(r)) t++;
				else if (r) {
					let t = String(r.constructor.version || "<0.17.1");
					t === n && (t += " (separately built, likely a bundler configuration issue)"), e.add(t);
				}
			}
			let o = ` Detected on the page: ${t} compatible editor(s) with version ${n}`;
			return e.size && (o += ` and incompatible editors with versions ${Array.from(e).join(", ")}`), o;
		}
		function mi() {
			return oi;
		}
		function xi(t, e, n) {
			const o = e.__type, r = Ns(t, o);
			let i = n.get(o);
			void 0 === i && (i = Array.from(r.transforms), n.set(o, i));
			const s = i.length;
			for (let t = 0; t < s && (i[t](e), e.isAttached()); t++);
		}
		function Ci(t, e) {
			return void 0 !== t && t.__key !== e && t.isAttached();
		}
		function Si(t, e) {
			if (!e) return;
			const n = t._updateTags;
			let o = e;
			Array.isArray(e) || (o = [e]);
			for (const t of o) n.add(t);
		}
		function vi(t) {
			return Ti(t, _i()._nodes);
		}
		function Ti(e, n) {
			const o = e.type, r = n.get(o);
			void 0 === r && t(17, o);
			const i = r.klass;
			e.type !== i.getType() && t(18, i.name);
			const s = i.importJSON(e), l = e.children;
			if (Pi(s) && Array.isArray(l)) for (let t = 0; t < l.length; t++) {
				const e = Ti(l[t], n);
				s.append(e);
			}
			const c = e.$slots;
			if (c) {
				Qc(s) || t(379, i.name);
				for (const t in c) pa(s, t, Ti(c[t], n));
			}
			return s;
		}
		function ki(t, e, n) {
			const o = ni, r = ri, i = oi;
			ni = e, ri = !0, oi = t;
			try {
				return n();
			} finally {
				ni = o, ri = r, oi = i;
			}
		}
		function bi(t, e) {
			const n = si;
			si = !0;
			try {
				(function(t, e) {
					const n = t._pendingEditorState, o = t._rootElement, r = t._headless || null === o;
					if (null === n) return void (!t._updating && t._deferred.length > 0 && wi(t, t._deferred));
					const i = t._editorState, s = i._selection, l = n._selection, c = 0 !== t._dirtyType, a = ni, u = ri, f = oi, d = t._updating, h = t._observer;
					let g = null;
					if (t._pendingEditorState = null, t._editorState = n, !r && c && null !== h) {
						oi = t, ni = n, ri = !1, t._updating = !0;
						try {
							const e = t._dirtyType, o = t._dirtyElements, r = t._dirtyLeaves;
							h.disconnect(), g = De$2(i, n, t, e, o, r);
						} catch (e) {
							if (e instanceof Error && t._onError(e), ii) throw e;
							gs(t, null, o, n), gt$6(t), t._dirtyType = 2, ii = !0, bi(t, i), ii = !1;
							return;
						} finally {
							h.observe(o, ai), t._updating = d, ni = a, ri = u, oi = f;
						}
					}
					n._readOnly || (n._readOnly = !0);
					const _ = t._dirtyLeaves, p = t._dirtyElements, y = t._normalizedNodes, m = t._updateTags;
					c && (t._dirtyType = 0, t._cloneNotNeeded.clear(), t._dirtyLeaves = /* @__PURE__ */ new Set(), t._dirtyElements = /* @__PURE__ */ new Map(), t._normalizedNodes = /* @__PURE__ */ new Set());
					t._updateTags = /* @__PURE__ */ new Set(), function(t, e) {
						const n = t._decorators;
						let o = t._pendingDecorators || n;
						const r = e._nodeMap;
						let i;
						for (i in o) r.has(i) || (o === n && (o = tl(t)), delete o[i]);
					}(t, n);
					const x = r ? null : Jl(Il(t));
					if (t._editable && null !== x && (c || null === l || l.dirty || !l.is(s)) && null !== o && !m.has("skip-dom-selection")) {
						oi = t, ni = n;
						try {
							if (null !== h && h.disconnect(), c || null === l || l.dirty) {
								const e = t._blockCursorElement;
								null !== e && jl(e, t, o), jr(s, l, t, x, m, o);
							}
							(function(t, e, n) {
								let o = t._blockCursorElement;
								if (ur(n) && n.isCollapsed() && "element" === n.anchor.type && e.contains(lc(e))) {
									const r = n.anchor, i = r.getNode(), s = r.offset;
									let l = !1, c = null;
									if (s === i.getChildrenSize()) Hl(i.getChildAtIndex(s - 1)) && (l = !0);
									else {
										const e = i.getChildAtIndex(s);
										if (null !== e && Hl(e)) {
											const n = e.getPreviousSibling();
											(null === n || Hl(n)) && (l = !0, c = t.getElementByKey(e.__key));
										}
									}
									if (l) {
										const n = kc(i, t.getElementByKey(i.__key), t).element;
										null === o && (t._blockCursorElement = o = function(t) {
											const e = t.theme, n = Zl().createElement("div");
											n.contentEditable = "false", n.setAttribute("data-lexical-cursor", "true");
											let o = e.blockCursor;
											if (void 0 !== o) {
												if ("string" == typeof o) o = e.blockCursor = ku(o);
												void 0 !== o && n.classList.add(...o);
											}
											return n;
										}(t._config)), e.style.caretColor = "transparent", null === c ? n.appendChild(o) : n.insertBefore(o, c);
										return;
									}
								}
								null !== o && jl(o, t, e);
							})(t, o, l);
						} finally {
							null !== h && h.observe(o, ai), oi = f, ni = a;
						}
					}
					null !== g && function(t, e, n, o, r) {
						const i = Array.from(t._listeners.mutation), s = i.length;
						for (let t = 0; t < s; t++) {
							const [s, l] = i[t];
							for (const t of l) {
								const i = e.get(t);
								void 0 !== i && s(i, {
									dirtyLeaves: o,
									prevEditorState: r,
									updateTags: n
								});
							}
						}
					}(t, g, m, _, i);
					ur(l) || null === l || null !== s && s.is(l) || t.dispatchCommand(Ie$2);
					const C = t._pendingDecorators;
					null !== C && (t._decorators = C, t._pendingDecorators = null, Ni("decorator", t, !0, C));
					if (function(t, e, n) {
						const o = el(e), r = el(n);
						o !== r && Ni("textcontent", t, !0, r);
					}(t, e || i, n), Ni("update", t, !0, {
						dirtyElements: p,
						dirtyLeaves: _,
						editorState: n,
						mutatedNodes: g,
						normalizedNodes: y,
						prevEditorState: e || i,
						tags: m
					}), !d) wi(t, t._deferred);
					(function(t) {
						const e = t._updates;
						if (0 === e.length) return void (t._cascadeCount = 0);
						if (function(t) {
							if (li.has(t)) return;
							li.add(t), setTimeout(() => {
								li.delete(t), t._cascadeCount = 0;
							}, 0);
						}(t), t._cascadeCount++ > 99) return t._updates = [], t._cascadeCount = 0, void t._onWarn(/* @__PURE__ */ new Error(`One or more update listeners are endlessly enqueueing more updates. May have encountered infinite recursion caused by update listeners that trigger additional updates without a stop condition. Editor namespace: ${t._config.namespace}`));
						const n = e.shift();
						if (n) {
							const [e, o] = n;
							Mi(t, e, o);
						}
					})(t);
				})(t, e);
			} finally {
				si = n;
			}
		}
		function Ni(t, e, n, ...o) {
			const r = e._updating;
			e._updating = n;
			try {
				const n = e._listeners[t], r = Array.from(n);
				for (const [t, e] of r) {
					e && e();
					const r = t(...o);
					n.has(t) ? n.set(t, r) : r && r();
				}
			} finally {
				e._updating = r;
			}
		}
		function Ei(t, e, n, o) {
			const r = ll(t);
			let i;
			if (!si) for (let t = 0; t < r.length; t++) r[t]._updating || (r[t]._cascadeCount = 0);
			for (let t = 4; t >= 0; t--) for (let s = 0; s < r.length; s++) {
				const l = r[s];
				if (s > 0 && l._updating) {
					i = l;
					break;
				}
				const c = l._commands.get(e);
				if (void 0 !== c) {
					const e = c[t];
					if (e.size > 0) {
						let t = !1;
						if (Ai(l, () => {
							for (const r of e) if (r(n, o)) return void (t = !0);
						}), t) return t;
					}
				}
			}
			return i && i.update(() => {
				Ei(i, e, n, o);
			}), !1;
		}
		function wi(t, e) {
			if (t._deferred = [], 0 !== e.length) {
				const n = t._updating;
				t._updating = !0;
				try {
					for (let t = 0; t < e.length; t++) e[t]();
				} finally {
					t._updating = n;
				}
			}
		}
		function Oi(e, n) {
			const o = e._updates;
			let r = n || !1;
			for (; 0 !== o.length;) {
				const n = o.shift();
				if (n) {
					const [o, i] = n, s = e._pendingEditorState;
					let l;
					void 0 !== i && (l = i.onUpdate, i.skipTransforms && (r = !0), i.discrete && (null === s && t(191), s._flushSync = !0), l && e._deferred.push(l), Si(e, i.tag)), null == s ? Mi(e, o, i) : o();
				}
			}
			return r;
		}
		function Mi(e, n, o) {
			const r = e._updateTags;
			let i, s = !1, l = !1;
			void 0 !== o && (i = o.onUpdate, Si(e, o.tag), s = o.skipTransforms || !1, l = o.discrete || !1), i && e._deferred.push(i);
			const c = e._editorState;
			let a = e._pendingEditorState, u = !1;
			(null === a || a._readOnly) && (a = e._pendingEditorState = Ri(a || c), u = !0), a._flushSync = l;
			const f = ni, d = ri, h = oi, g = e._updating;
			ni = a, ri = !1, e._updating = !0, oi = e;
			const _ = e._headless || null === e.getRootElement();
			vs(null);
			try {
				u && (_ ? null !== c._selection && (a._selection = c._selection.clone()) : a._selection = function(t, e) {
					const n = t.getEditorState()._selection, o = Jl(Il(t));
					return ur(n) || null == n ? Lr(n, o, t, e) : n.clone();
				}(e, o && o.event || null));
				const r = e._compositionKey;
				n(), s = Oi(e, s), function(t, e) {
					const n = e.getEditorState()._selection, o = t._selection;
					if (ur(o)) {
						const t = o.anchor, e = o.focus;
						let r;
						if ("text" === t.type && (r = t.getNode(), r.selectionTransform(n, o)), "text" === e.type) {
							const t = e.getNode();
							r !== t && t.selectionTransform(n, o);
						}
					}
				}(a, e), 0 !== e._dirtyType && (s ? function(t, e) {
					const n = e._dirtyLeaves, o = t._nodeMap;
					for (const t of n) {
						const e = o.get(t);
						Xo(e) && e.isAttached() && e.isSimpleText() && !e.isUnmergeable() && Pt$7(e);
					}
				}(a, e) : function(t, e) {
					const n = e._dirtyLeaves, o = e._dirtyElements, r = t._nodeMap, i = qs(), s = /* @__PURE__ */ new Map();
					let l = n, c = l.size, a = o, u = a.size;
					for (; c > 0 || u > 0;) {
						if (c > 0) {
							e._dirtyLeaves = /* @__PURE__ */ new Set();
							for (const t of l) {
								const o = r.get(t);
								Xo(o) && o.isAttached() && o.isSimpleText() && !o.isUnmergeable() && Pt$7(o), void 0 !== o && Ci(o, i) && xi(e, o, s), n.add(t);
							}
							if (l = e._dirtyLeaves, c = l.size, c > 0) {
								ci++;
								continue;
							}
						}
						e._dirtyLeaves = /* @__PURE__ */ new Set(), e._dirtyElements = /* @__PURE__ */ new Map(), a.delete("root") && a.set("root", !0);
						for (const t of a) {
							const n = t[0], l = t[1];
							if (o.set(n, l), !l) continue;
							const c = r.get(n);
							void 0 !== c && Ci(c, i) && xi(e, c, s);
						}
						l = e._dirtyLeaves, c = l.size, a = e._dirtyElements, u = a.size, ci++;
					}
					e._dirtyLeaves = n, e._dirtyElements = o;
				}(a, e), Oi(e), function(t, e, n, o) {
					const r = t._nodeMap, i = e._nodeMap, s = [];
					for (const [t] of o) {
						const e = i.get(t);
						void 0 !== e && (e.isAttached() || (Pi(e) && rt$5(e, t, r, i, s, o), r.has(t) || o.delete(t), s.push(t)));
					}
					for (const t of n) {
						const e = i.get(t);
						void 0 === e || e.isAttached() || (Qc(e) && null !== e.__slots && rt$5(e, t, r, i, s, n), r.has(t) || n.delete(t), s.push(t));
					}
					for (const t of s) i.delete(t);
					const l = _i(), c = l._compositionKey;
					null === c || i.has(c) || (l._compositionKey = null);
				}(c, a, e._dirtyLeaves, e._dirtyElements));
				r !== e._compositionKey && (a._flushSync = !0);
				const i = a._selection;
				if (ur(i)) {
					e._slotsUsed && Or(i);
					const n = a._nodeMap, o = i.anchor.key, r = i.focus.key;
					void 0 !== n.get(o) && void 0 !== n.get(r) || t(19);
				} else dr(i) && 0 === i._nodes.size && (a._selection = null);
			} catch (t) {
				t instanceof Error && e._onError(t), e._pendingEditorState = c, e._dirtyType = 2, e._cloneNotNeeded.clear(), e._dirtyLeaves = /* @__PURE__ */ new Set(), e._dirtyElements.clear(), bi(e);
				return;
			} finally {
				ni = f, ri = d, oi = h, e._updating = g, ci = 0;
			}
			0 !== e._dirtyType || e._deferred.length > 0 || function(t, e) {
				const n = e.getEditorState()._selection, o = t._selection;
				if (null !== o) {
					if (o.dirty || !o.is(n)) return !0;
				} else if (null !== n) return !0;
				return !1;
			}(a, e) ? a._flushSync ? (a._flushSync = !1, bi(e)) : u && ws(() => {
				bi(e);
			}) : (a._flushSync = !1, u && (r.clear(), e._deferred = [], e._pendingEditorState = null));
		}
		function Ai(t, e, n) {
			oi === t && void 0 === n ? ui() ? Mi(t, e, n) : e() : Mi(t, e, n);
		}
		function Di(t) {
			if (Bl(t)) {
				let e = null;
				for (const n of t.getChildren()) e = n.isInline() ? (e || n.replace(n.createParentElementNode())).append(n) : null;
			}
		}
		var Fi = class extends _o$1 {
			__first;
			__last;
			__size;
			__format;
			__style;
			__indent;
			__dir;
			__textFormat;
			__textStyle;
			__slotHost;
			__slots;
			$config() {
				return this.config(Symbol.for("ElementNode"), {
					$transform: Di,
					extends: _o$1
				});
			}
			constructor(t) {
				super(t), this.__first = null, this.__last = null, this.__size = 0, this.__format = 0, this.__style = "", this.__indent = 0, this.__dir = null, this.__textFormat = 0, this.__textStyle = "", this.__slotHost = null, this.__slots = null;
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__key === e.__key && (this.__first = e.__first, this.__last = e.__last, this.__size = e.__size, this.__slotHost = e.__slotHost, null !== this.__slotHost && null !== this.__parent && t(384, this.__key, String(this.__slotHost), String(this.__parent)), this.__slots = e.__slots), this.__indent = e.__indent, this.__format = e.__format, this.__style = e.__style, this.__dir = e.__dir, this.__textFormat = e.__textFormat, this.__textStyle = e.__textStyle;
			}
			getFormat() {
				return this.getLatest().__format;
			}
			getFormatType() {
				const t = this.getFormat();
				return W$1[t] || "";
			}
			getStyle() {
				return this.getLatest().__style;
			}
			getIndent() {
				return this.getLatest().__indent;
			}
			getChildren() {
				const t = [];
				let e = this.getFirstChild();
				for (; null !== e;) t.push(e), e = e.getNextSibling();
				return t;
			}
			getChildrenKeys() {
				const t = [];
				let e = this.getFirstChild();
				for (; null !== e;) t.push(e.__key), e = e.getNextSibling();
				return t;
			}
			getChildrenSize() {
				return this.getLatest().__size;
			}
			isEmpty() {
				return 0 === this.getChildrenSize() && 0 === ia(this).length;
			}
			isDirty() {
				const t = _i()._dirtyElements;
				return null !== t && t.has(this.__key);
			}
			isLastChild() {
				const t = this.getLatest(), e = this.getParentOrThrow().getLastChild();
				return null !== e && e.is(t);
			}
			getAllTextNodes() {
				const t = [];
				for (const e of ia(this)) {
					const n = sa(this, e);
					Pi(n) && t.push(...n.getAllTextNodes());
				}
				let e = this.getFirstChild();
				for (; null !== e;) {
					if (Xo(e) && t.push(e), Pi(e)) {
						const n = e.getAllTextNodes();
						t.push(...n);
					}
					e = e.getNextSibling();
				}
				return t;
			}
			getFirstDescendant() {
				let t = this.getFirstChild();
				for (; Pi(t);) {
					const e = t.getFirstChild();
					if (null === e) break;
					t = e;
				}
				return t;
			}
			getLastDescendant() {
				let t = this.getLastChild();
				for (; Pi(t);) {
					const e = t.getLastChild();
					if (null === e) break;
					t = e;
				}
				return t;
			}
			getDescendantByIndex(t) {
				const e = this.getChildren(), n = e.length;
				if (t >= n) {
					const t = e[n - 1];
					return Pi(t) && t.getLastDescendant() || t || null;
				}
				const o = e[t];
				return Pi(o) && o.getFirstDescendant() || o || null;
			}
			getFirstChild() {
				const t = this.getLatest().__first;
				return null === t ? null : Ys(t);
			}
			getFirstChildOrThrow() {
				const e = this.getFirstChild();
				return null === e && t(45, this.__key), e;
			}
			getLastChild() {
				const t = this.getLatest().__last;
				return null === t ? null : Ys(t);
			}
			getLastChildOrThrow() {
				const e = this.getLastChild();
				return null === e && t(96, this.__key), e;
			}
			getChildAtIndex(t) {
				const e = this.getChildrenSize();
				let n, o;
				if (t < e / 2) {
					for (n = this.getFirstChild(), o = 0; null !== n && o <= t;) {
						if (o === t) return n;
						n = n.getNextSibling(), o++;
					}
					return null;
				}
				for (n = this.getLastChild(), o = e - 1; null !== n && o >= t;) {
					if (o === t) return n;
					n = n.getPreviousSibling(), o--;
				}
				return null;
			}
			getTextContent() {
				let t = ha(this);
				const e = this.getChildren(), n = e.length;
				for (let o = 0; o < n; o++) {
					const r = e[o];
					t += r.getTextContent(), Pi(r) && o !== n - 1 && !r.isInline() && (t += D$2);
				}
				return t;
			}
			getTextContentSize() {
				let t = function(t) {
					let e = 0;
					for (const n of ia(t)) {
						const o = sa(t, n);
						null !== o && (e += o.getTextContentSize());
					}
					return e;
				}(this);
				const e = this.getChildren(), n = e.length;
				for (let o = 0; o < n; o++) {
					const r = e[o];
					t += r.getTextContentSize(), Pi(r) && o !== n - 1 && !r.isInline() && (t += 2);
				}
				return t;
			}
			getDirection() {
				return this.getLatest().__dir;
			}
			getTextFormat() {
				return this.getLatest().__textFormat;
			}
			hasFormat(t) {
				if ("" !== t) {
					const e = R$1[t];
					return 0 !== (this.getFormat() & e);
				}
				return !1;
			}
			hasTextFormat(t) {
				const e = z$2[t];
				return 0 !== (this.getTextFormat() & e);
			}
			getFormatFlags(t, e) {
				return Ws(this.getLatest().__textFormat, t, e);
			}
			getTextStyle() {
				return this.getLatest().__textStyle;
			}
			select(t, e) {
				fi();
				const n = Kr();
				let o = t, r = e;
				const i = this.getChildrenSize();
				if (!this.canBeEmpty()) {
					if (0 === t && 0 === e) {
						const t = this.getFirstChild();
						if (Xo(t) || Pi(t)) return t.select(0, 0);
					} else if (!(void 0 !== t && t !== i || void 0 !== e && e !== i)) {
						const t = this.getLastChild();
						if (Xo(t) || Pi(t)) return t.select();
					}
				}
				void 0 === o && (o = i), void 0 === r && (r = i);
				const s = this.__key;
				return ur(n) ? (n.anchor.set(s, o, "element"), n.focus.set(s, r, "element"), n.dirty = !0, n) : Dr(s, o, s, r, "element", "element");
			}
			selectStart() {
				const t = this.getFirstDescendant();
				return t ? t.selectStart() : this.select();
			}
			selectEnd() {
				const t = this.getLastDescendant();
				return t ? t.selectEnd() : this.select();
			}
			clear() {
				const t = this.getWritable();
				return this.getChildren().forEach((t) => t.remove()), t;
			}
			append(...t) {
				return this.splice(this.getChildrenSize(), 0, t);
			}
			setDirection(t) {
				const e = this.getWritable();
				return e.__dir = t, e;
			}
			setFormat(t) {
				return this.getWritable().__format = "" !== t && R$1[t] || 0, this;
			}
			setStyle(t) {
				return this.getWritable().__style = t || "", this;
			}
			setTextFormat(t) {
				const e = this.getWritable();
				return e.__textFormat = t, e;
			}
			setTextStyle(t) {
				const e = this.getWritable();
				return e.__textStyle = t, e;
			}
			setIndent(t) {
				return this.getWritable().__indent = t, this;
			}
			splice(e, n, o) {
				ho$1(this) && t(324, this.__key, this.__type);
				const r = this.getChildrenSize(), i = this.getWritable();
				e + n <= r || t(226, String(e), String(n), String(r));
				for (const t of o);
				const s = i.__key, l = [], c = [], a = this.getChildAtIndex(e + n);
				let u = null, f = r - n + o.length;
				if (0 !== e) if (e === r) u = this.getLastChild();
				else {
					const t = this.getChildAtIndex(e);
					null !== t && (u = t.getPreviousSibling());
				}
				if (n > 0) {
					let e = null === u ? this.getFirstChild() : u.getNextSibling();
					for (let o = 0; o < n; o++) {
						null === e && t(100);
						const n = e.getNextSibling(), o = e.__key;
						Hs(e.getWritable()), c.push(o), e = n;
					}
				}
				let d = u;
				for (const e of o) {
					null !== d && e.is(d) && (u = d = d.getPreviousSibling());
					const n = e.getWritable();
					n.__parent === s && f--, Hs(n);
					const o = e.__key;
					if (null === d) i.__first = o, n.__prev = null;
					else {
						const t = d.getWritable();
						t.__next = o, n.__prev = t.__key;
					}
					e.__key === s && t(76), n.__parent = s, l.push(o), d = e;
				}
				if (e + n === r) {
					if (null !== d) d.getWritable().__next = null, i.__last = d.__key;
				} else if (null !== a) {
					const t = a.getWritable();
					if (null !== d) {
						const e = d.getWritable();
						t.__prev = d.__key, e.__next = a.__key;
					} else t.__prev = null;
				}
				if (i.__size = f, c.length) {
					const t = Kr();
					if (ur(t)) {
						const e = new Set(c), n = new Set(l), { anchor: o, focus: r } = t;
						Ii(o, e, n) && Wr(o, o.getNode(), this, u, a), Ii(r, e, n) && Wr(r, r.getNode(), this, u, a), 0 !== f || this.canBeEmpty() || Bl(this) || this.remove();
					}
				}
				return i;
			}
			getDOMSlot(t) {
				return new G$2(t);
			}
			exportDOM(t) {
				const { element: e } = super.exportDOM(t);
				if (gc(e)) {
					const t = this.getIndent();
					t > 0 && (e.style.paddingInlineStart = 40 * t + "px", e.setAttribute("data-lexical-indent", String(t)));
					const n = this.getDirection();
					n && (e.dir = n);
				}
				return { element: e };
			}
			exportJSON() {
				const t = {
					children: [],
					direction: this.getDirection(),
					format: this.getFormatType(),
					indent: this.getIndent(),
					...super.exportJSON()
				}, e = this.getTextFormat(), n = this.getTextStyle();
				return 0 === e && "" === n || Bl(this) || this.getChildren().some(Xo) || (0 !== e && (t.textFormat = e), "" !== n && (t.textStyle = n)), t;
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setFormat(t.format).setIndent(t.indent).setDirection(t.direction).setTextFormat(t.textFormat || 0).setTextStyle(t.textStyle || "");
			}
			insertNewAfter(t, e) {
				return null;
			}
			canIndent() {
				return !0;
			}
			collapseAtStart(t) {
				return !1;
			}
			excludeFromCopy(t) {
				return !1;
			}
			canReplaceWith(t) {
				return !0;
			}
			canInsertAfter(t) {
				return !0;
			}
			canBeEmpty() {
				return !0;
			}
			canInsertTextBefore() {
				return !0;
			}
			canInsertTextAfter() {
				return !0;
			}
			isInline() {
				return !1;
			}
			isShadowRoot() {
				return !1;
			}
			canMergeWith(t) {
				return !1;
			}
			extractWithChild(t, e, n) {
				return !1;
			}
			canMergeWhenEmpty() {
				return !1;
			}
			reconcileObservedMutation(t, e) {
				const n = kc(this, t, e);
				let o = n.getFirstChild();
				for (let t = this.getFirstChild(); t; t = t.getNextSibling()) {
					const r = e.getElementByKey(t.getKey());
					null !== r && (null == o ? (n.insertChild(r), o = r) : o !== r && n.replaceChild(r, o), o = o.nextSibling);
				}
			}
		};
		function Pi(t) {
			return t instanceof Fi;
		}
		function Ii(t, e, n) {
			let o = t.getNode();
			for (; o;) {
				const t = o.__key;
				if (e.has(t) && !n.has(t)) return !0;
				o = o.getParent();
			}
			return !1;
		}
		var Li = class extends _o$1 {
			__slotHost;
			__slots;
			constructor(t) {
				super(t), this.__slotHost = null, this.__slots = null;
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__key === e.__key && (this.__slotHost = e.__slotHost, null !== this.__slotHost && null !== this.__parent && t(383, this.__key, String(this.__slotHost), String(this.__parent)), this.__slots = e.__slots);
			}
			decorate(t, e) {
				return null;
			}
			isIsolated() {
				return !1;
			}
			isInline() {
				return !0;
			}
			isKeyboardSelectable() {
				return !0;
			}
		};
		function Ki(t) {
			return t instanceof Li;
		}
		var zi = class extends Fi {
			__cachedText;
			$config() {
				return this.config("root", { extends: Fi });
			}
			constructor() {
				super("root"), this.__cachedText = null;
			}
			getTopLevelElementOrThrow() {
				t(51);
			}
			getTextContent() {
				const t = this.__cachedText;
				return null === t || !ui() && 0 !== _i()._dirtyType ? super.getTextContent() : t;
			}
			remove() {
				t(52);
			}
			replace(e) {
				t(53);
			}
			insertBefore(e) {
				t(54);
			}
			insertAfter(e) {
				t(55);
			}
			updateDOM(t, e) {
				return !1;
			}
			splice(e, n, o) {
				for (const e of o) Pi(e) || Ki(e) || t(282);
				return super.splice(e, n, o);
			}
			static importJSON(t) {
				return nl().updateFromJSON(t);
			}
			collapseAtStart() {
				return !0;
			}
		};
		function Bi(t) {
			return t instanceof zi;
		}
		function Ri(t) {
			return new Hi(nt$5(t._nodeMap), null, t._slotsUsed);
		}
		function Wi() {
			return new Hi(/* @__PURE__ */ new Map([["root", new zi()]]), null, !1);
		}
		function $i(e) {
			const n = e.exportJSON(), o = e.constructor;
			if (n.type !== o.getType() && t(130, o.name), Pi(e)) {
				const r = n.children;
				Array.isArray(r) || t(59, o.name);
				const i = e.getChildren();
				for (let t = 0; t < i.length; t++) {
					const e = $i(i[t]);
					r.push(e);
				}
			}
			const r = ia(e);
			if (r.length > 0) {
				const i = {};
				for (const n of r) {
					const r = sa(e, n);
					null === r && t(366, o.name, n), i[n] = $i(r);
				}
				n.$slots = i;
			}
			return n;
		}
		function Ui(t) {
			return t instanceof Hi;
		}
		var Hi = class Hi {
			_nodeMap;
			_selection;
			_flushSync;
			_readOnly;
			_parsed;
			_slotsUsed;
			constructor(t, e = null, n = !1) {
				this._nodeMap = t, this._selection = e || null, this._flushSync = !1, this._readOnly = !1, this._parsed = !1, this._slotsUsed = n;
			}
			isEmpty() {
				return 1 === this._nodeMap.size && null === this._selection;
			}
			read(t, e) {
				return ki(e && e.editor || null, this, t);
			}
			clone(t) {
				const e = new Hi(this._nodeMap, void 0 === t ? this._selection : t, this._slotsUsed);
				return e._readOnly = !0, e;
			}
			toJSON() {
				return ki(null, this, () => ({ root: $i(nl()) }));
			}
		};
		var ji = class extends Fi {
			$config() {
				return this.config("artificial", { extends: Fi });
			}
			createDOM(t) {
				return Zl().createElement("div");
			}
		};
		var Ji = class extends _o$1 {
			$config() {
				return this.config("linebreak", { importDOM: { br: (t) => Gi(t) || Xi(t) ? null : {
					conversion: Vi,
					priority: 0
				} } });
			}
			getTextContent() {
				return "\n";
			}
			createDOM() {
				return Zl().createElement("br");
			}
			updateDOM() {
				return !1;
			}
			isInline() {
				return !0;
			}
		};
		function Vi(t) {
			return { node: qi() };
		}
		function qi() {
			return Wl(new Ji());
		}
		function Yi(t) {
			return t instanceof Ji;
		}
		function Gi(t) {
			const e = t.parentElement;
			if (null !== e && Cc(e)) {
				const n = e.firstChild;
				if (n === t || n.nextSibling === t && Qi(n)) {
					const n = e.lastChild;
					if (n === t || n.previousSibling === t && Qi(n)) return !0;
				}
			}
			return !1;
		}
		function Xi(t) {
			const e = t.parentElement;
			if (null !== e && Cc(e)) {
				const n = e.firstChild;
				if (n === t || n.nextSibling === t && Qi(n)) return !1;
				const o = e.lastChild;
				if (o === t || o.previousSibling === t && Qi(o)) return !0;
			}
			return !1;
		}
		function Qi(t) {
			return zs(t) && /^( |\t|\r?\n)+$/.test(t.textContent || "");
		}
		var Zi = class extends Fi {
			$config() {
				return this.config("paragraph", {
					extends: Fi,
					importDOM: { p: () => ({
						conversion: ts,
						priority: 0
					}) }
				});
			}
			createDOM(t) {
				const e = Zl().createElement("p"), n = Cl(t.theme, "paragraph");
				if (void 0 !== n) e.classList.add(...n);
				return e;
			}
			updateDOM(t, e, n) {
				return !1;
			}
			exportDOM(t) {
				const { element: e } = super.exportDOM(t);
				if (gc(e)) {
					this.isEmpty() && e.append(Zl().createElement("br"));
					const t = this.getFormatType();
					t && (e.style.textAlign = t);
				}
				return { element: e };
			}
			exportJSON() {
				const t = super.exportJSON();
				if (void 0 === t.textFormat || void 0 === t.textStyle) {
					const e = this.getChildren().find(Xo);
					e ? (t.textFormat = e.getFormat(), t.textStyle = e.getStyle()) : (t.textFormat = this.getTextFormat(), t.textStyle = this.getTextStyle());
				}
				return t;
			}
			insertNewAfter(t, e) {
				const n = es();
				n.setTextFormat(t.format), n.setTextStyle(t.style);
				const o = this.getDirection();
				return n.setDirection(o), n.setFormat(this.getFormatType()), n.setStyle(this.getStyle()), this.insertAfter(n, e), n;
			}
			collapseAtStart() {
				const t = this.getChildren();
				if (0 === t.length || Xo(t[0]) && "" === t[0].getTextContent().trim()) {
					if (null !== this.getNextSibling()) return this.selectNext(), this.remove(), !0;
					if (null !== this.getPreviousSibling()) return this.selectPrevious(), this.remove(), !0;
				}
				return !1;
			}
		};
		function ts(t) {
			const e = es();
			if (Lc(e, t), Pc(t, e), "" === e.getFormatType()) {
				const n = t.getAttribute("align");
				n && n && n in R$1 && e.setFormat(n);
			}
			return Ic(e, t), { node: e };
		}
		function es() {
			return Wl(new Zi());
		}
		function ns(t) {
			return t instanceof Zi;
		}
		function os(t) {
			console.warn(t);
		}
		function gs(t, e, n, o, r) {
			const i = t._keyToDOMMap;
			i.clear(), t._editorState = Wi(), t._pendingEditorState = o, t._compositionKey = null, t._dirtyType = 0, t._cloneNotNeeded.clear(), t._dirtyLeaves = /* @__PURE__ */ new Set(), t._dirtyElements.clear(), t._normalizedNodes = /* @__PURE__ */ new Set(), r && r.preserveUpdateQueue || (t._updateTags = /* @__PURE__ */ new Set(), t._updates = [], t._cascadeCount = 0), t._blockCursorElement = null, null !== t._inputState.handledSelectionCommandTimeoutId && clearTimeout(t._inputState.handledSelectionCommandTimeoutId), t._inputState = {
				collapsedSelectionFormat: {
					format: 0,
					key: "root",
					offset: 0,
					style: "",
					timeStamp: 0
				},
				compositionEndData: "",
				compositionPhase: "idle",
				hadOrphanedCompositionEvents: !1,
				handledSelectionCommandTimeoutId: null,
				isInsertLineBreak: !1,
				isInsertTextAfterHandledSelectionCommand: !1,
				isSelectionChangeFromDOMUpdate: !1,
				isSelectionChangeFromMouseDown: !1,
				lastBeforeInputInsertTextTimeStamp: 0,
				lastKeyCode: null,
				lastKeyDownTimeStamp: 0,
				postDeleteSelectionToRestore: null,
				unprocessedBeforeInputData: null
			};
			const s = t._observer;
			null !== s && (s.disconnect(), t._observer = null), null !== e && (e.textContent = "", function(t, e) {
				const n = `__lexicalKey_${e._key}`;
				delete t[n];
			}(e, t)), null !== n && (n.textContent = "", i.set("root", n), Xs(n, t, "root"));
		}
		function _s(t) {
			const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
			for (const { klass: o, ownNodeConfig: r } of jc(t)) {
				const t = o.transform;
				if (!n.has(t)) {
					n.add(t);
					const r = o.transform();
					r && e.add(r);
				}
				if (r) {
					const t = r.$transform;
					t && e.add(t);
				}
			}
			return e;
		}
		const ps = {
			$createDOM: (t, e) => t.createDOM(e._config, e),
			$decorateDOM: (t, e, n, o) => {},
			$exportDOM: (t, e) => {
				const n = Es(e, t.getType());
				return n && void 0 !== n.exportDOM ? n.exportDOM(e, t) : t.exportDOM(e);
			},
			$extractWithChild: (t, e, n, o, r) => Pi(t) && t.extractWithChild(e, n, o),
			$getDOMSlot: (t, e, n) => t.getDOMSlot(e),
			$getSlotTargetElement: (t, e, n, o) => null,
			$shouldExclude: (t, e, n) => Pi(t) && t.excludeFromCopy("html"),
			$shouldInclude: (t, e, n) => !e || t.isSelected(e),
			$updateDOM: (t, e, n, o) => t.updateDOM(e, n, o._config)
		};
		function ys(e) {
			const n = e || {}, o = mi(), r = n.theme || {}, i = void 0 === e ? o : n.parentEditor || null, s = n.disableEvents || !1, l = Wi(), c = n.namespace || (null !== i ? i._config.namespace : cl()), a = n.editorState, u = [
				zi,
				Wo,
				Ji,
				Zo,
				Zi,
				ji,
				...n.nodes || []
			], { onError: f, onWarn: d, html: h } = n, g = void 0 === n.editable || n.editable;
			let _;
			if (void 0 === e && null !== o) _ = o._nodes;
			else {
				_ = /* @__PURE__ */ new Map();
				for (let e = 0; e < u.length; e++) {
					let o = u[e], r = null, i = null;
					if (o && "object" == typeof o) {
						const t = o;
						o = t.replace, r = t.with, i = t.withKlass || null;
					}
					if ("function" != typeof o || !o.prototype || !(o === _o$1 || o.prototype instanceof _o$1)) {
						let r = "<unknown>";
						try {
							r = JSON.parse(Z$3);
						} catch (t) {}
						t(365, String(e - u.length + (n.nodes ? n.nodes.length : 0)), "function" == typeof o ? `${o.name}${"function" == typeof o.getType ? ` (type ${String(o.getType())})` : ""}` : String(o), String(r));
					}
					Hc(o);
					const s = o.getType(), l = _s(o);
					_.set(s, {
						exportDOM: h && h.export ? h.export.get(o) : void 0,
						klass: o,
						replace: r,
						replaceWithKlass: i,
						sharedNodeState: vt$7(u[e]),
						transforms: l
					});
				}
			}
			const p = new Cs(l, i, _, {
				disableEvents: s,
				dom: {
					...ps,
					...e && e.dom
				},
				namespace: c,
				theme: r
			}, f || console.error, d || os, function(t, e) {
				const n = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), r = (t) => {
					Object.keys(t).forEach((e) => {
						let o = n.get(e);
						void 0 === o && (o = [], n.set(e, o)), o.push(t[e]);
					});
				};
				return t.forEach((t) => {
					const e = t.klass.importDOM;
					if (null == e || o.has(e)) return;
					o.add(e);
					const n = e.call(t.klass);
					null !== n && r(n);
				}), e && r(e), n;
			}(_, h ? h.import : void 0), g, e);
			return void 0 !== a && (p._pendingEditorState = a, p._dirtyType = 2), function(t) {
				t.registerCommand(ze$2, Yn$1, 0), t.registerCommand(Be$2, Gn$1, 0), t.registerCommand(Re$2, Xn$1, 0), t.registerCommand(We$2, Qn$1, 0), t.registerCommand(tn$3, eo$1, 0);
			}(p), p;
		}
		function ms(t, e) {
			const n = t.get(e);
			t.delete(e), n && n();
		}
		function xs(t, e, n) {
			return t.set(e, n), ms.bind(null, t, e);
		}
		var Cs = class {
			static version;
			_headless;
			_parentEditor;
			_rootElement;
			_editorState;
			_pendingEditorState;
			_compositionKey;
			_deferred;
			_keyToDOMMap;
			_updates;
			_updating;
			_cascadeCount;
			_listeners;
			_commands;
			_nodes;
			_decorators;
			_pendingDecorators;
			_config;
			_dirtyType;
			_cloneNotNeeded;
			_dirtyLeaves;
			_dirtyElements;
			_normalizedNodes;
			_updateTags;
			_observer;
			_key;
			_onError;
			_onWarn;
			_htmlConversions;
			_window;
			_editable;
			_blockCursorElement;
			_slotsUsed;
			_inputState;
			_createEditorArgs;
			constructor(t, e, n, o, r, i, s, l, c) {
				this._createEditorArgs = c, this._parentEditor = e, this._rootElement = null, this._editorState = t, this._pendingEditorState = null, this._compositionKey = null, this._deferred = [], this._keyToDOMMap = new ot$5(), this._updates = [], this._updating = !1, this._cascadeCount = 0, this._listeners = {
					decorator: /* @__PURE__ */ new Map(),
					editable: /* @__PURE__ */ new Map(),
					mutation: /* @__PURE__ */ new Map(),
					root: /* @__PURE__ */ new Map(),
					textcontent: /* @__PURE__ */ new Map(),
					update: /* @__PURE__ */ new Map()
				}, this._commands = /* @__PURE__ */ new Map(), this._config = o, this._nodes = n, this._decorators = {}, this._pendingDecorators = null, this._dirtyType = 0, this._cloneNotNeeded = /* @__PURE__ */ new Set(), this._dirtyLeaves = /* @__PURE__ */ new Set(), this._dirtyElements = /* @__PURE__ */ new Map(), this._normalizedNodes = /* @__PURE__ */ new Set(), this._updateTags = /* @__PURE__ */ new Set(), this._observer = null, this._key = cl(), this._onError = r, this._onWarn = i, this._htmlConversions = s, this._editable = l, this._headless = null !== e && e._headless, this._window = null, this._blockCursorElement = null, this._slotsUsed = !1, this._inputState = {
					collapsedSelectionFormat: {
						format: 0,
						key: "root",
						offset: 0,
						style: "",
						timeStamp: 0
					},
					compositionEndData: "",
					compositionPhase: "idle",
					hadOrphanedCompositionEvents: !1,
					handledSelectionCommandTimeoutId: null,
					isInsertLineBreak: !1,
					isInsertTextAfterHandledSelectionCommand: !1,
					isSelectionChangeFromDOMUpdate: !1,
					isSelectionChangeFromMouseDown: !1,
					lastBeforeInputInsertTextTimeStamp: 0,
					lastKeyCode: null,
					lastKeyDownTimeStamp: 0,
					postDeleteSelectionToRestore: null,
					unprocessedBeforeInputData: null
				};
			}
			isComposing() {
				return null != this._compositionKey;
			}
			registerUpdateListener(t) {
				return xs(this._listeners.update, t);
			}
			registerEditableListener(t) {
				return xs(this._listeners.editable, t);
			}
			registerDecoratorListener(t) {
				return xs(this._listeners.decorator, t);
			}
			registerTextContentListener(t) {
				return xs(this._listeners.textcontent, t);
			}
			registerRootListener(t) {
				const e = this._listeners.root;
				return Eu(xs(e, t, t(this._rootElement, null) || void 0), () => function(t, e, n) {
					const o = t.get(e);
					o && o(), t.set(e, e(...n) || void 0);
				}(e, t, [null, this._rootElement]));
			}
			registerCommand(e, n, o) {
				void 0 === o && t(35);
				const r = this._commands;
				r.has(e) || r.set(e, [
					new tt$2(),
					new tt$2(),
					new tt$2(),
					new tt$2(),
					new tt$2()
				]);
				const i = r.get(e);
				void 0 === i && t(36, String(e));
				const s = function(t) {
					return 7 & t;
				}(o), l = i[s];
				return s !== o ? l.addFront(n) : l.addBack(n), () => {
					l.delete(n), i.every((t) => 0 === t.size) && r.delete(e);
				};
			}
			registerMutationListener(t, e, n) {
				const o = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(t)).klass, r = this._listeners.mutation;
				let i = r.get(e);
				void 0 === i && (i = /* @__PURE__ */ new Set(), r.set(e, i)), i.add(o);
				const s = n && n.skipInitialization;
				return void 0 !== s && s || this.initializeMutationListener(e, o), () => {
					i.delete(o), 0 === i.size && r.delete(e);
				};
			}
			getRegisteredNode(e) {
				const n = this._nodes.get(e.getType());
				return void 0 === n && t(37, e.name), n;
			}
			resolveRegisteredNodeAfterReplacements(t) {
				for (; t.replaceWithKlass;) t = this.getRegisteredNode(t.replaceWithKlass);
				return t;
			}
			initializeMutationListener(t, e) {
				const n = this._editorState, o = Ac(n).get(e.getType());
				if (!o) return;
				const r = /* @__PURE__ */ new Map();
				for (const t of o.keys()) r.set(t, "created");
				r.size > 0 && t(r, {
					dirtyLeaves: /* @__PURE__ */ new Set(),
					prevEditorState: n,
					updateTags: /* @__PURE__ */ new Set(["registerMutationListener"])
				});
			}
			registerNodeTransformToKlass(t, e) {
				const n = this.getRegisteredNode(t);
				return n.transforms.add(e), n;
			}
			registerNodeTransform(t, e) {
				const n = this.registerNodeTransformToKlass(t, e), o = [n], r = n.replaceWithKlass;
				if (null != r) {
					const t = this.registerNodeTransformToKlass(r, e);
					o.push(t);
				}
				return function(t, e) {
					const n = Ac(t.getEditorState()), o = [];
					for (const t of e) {
						const e = n.get(t);
						e && o.push(e);
					}
					if (0 === o.length) return;
					t.update(() => {
						for (const t of o) for (const e of t.keys()) {
							const t = Ys(e);
							t && t.markDirty();
						}
					}, null === t._pendingEditorState ? { tag: xo } : void 0);
				}(this, o.map((t) => t.klass.getType())), () => {
					o.forEach((t) => t.transforms.delete(e));
				};
			}
			hasNode(t) {
				return this._nodes.has(t.getType());
			}
			hasNodes(t) {
				return t.every(this.hasNode.bind(this));
			}
			dispatchCommand(t, ...e) {
				return Nl(this, t, ...e);
			}
			getDecorators() {
				return this._decorators;
			}
			getRootElement() {
				return this._rootElement;
			}
			getKey() {
				return this._key;
			}
			setRootElement(t) {
				const e = this._rootElement;
				if (t !== e) {
					const n = Cl(this._config.theme, "root"), o = this._pendingEditorState || this._editorState;
					if (this._rootElement = t, gs(this, e, t, o, { preserveUpdateQueue: !0 }), null !== e && (this._config.disableEvents || co$1(e), null != n && e.classList.remove(...n)), null !== t) {
						const e = Pl(t), o = t.style;
						o.userSelect = "text", o.whiteSpace = "pre-wrap", o.wordBreak = "break-word", t.setAttribute("data-lexical-editor", "true"), this._window = e, this._dirtyType = 2, gt$6(this), this._updateTags.add(xo), bi(this), this._config.disableEvents || function(t, e) {
							const n = t.ownerDocument;
							Ln$1.set(t, n);
							let o = Kn$1.get(n);
							void 0 === o && (o = {
								editors: /* @__PURE__ */ new Set(),
								hasShadowEditor: void 0
							}, Kn$1.set(n, o)), o.editors.add(e), o.hasShadowEditor = void 0, t.__lexicalEditor = e;
							const r = no$1(t);
							r.push(zn$1.register(n));
							for (let n = 0; n < In$2.length; n++) {
								const [o, i] = In$2[n], s = "function" == typeof i ? (t) => {
									so$1(t) || (io$1(t), (e.isEditable() || "click" === o) && i(t, e));
								} : (t) => {
									if (so$1(t)) return;
									io$1(t);
									const n = e.isEditable();
									switch (o) {
										case "cut": return n && Nl(e, Tn$1, t);
										case "copy": return Nl(e, vn$3, t);
										case "paste": return n && Nl(e, Je$2, t);
										case "dragstart": return n && Nl(e, xn$3, t);
										case "dragover": return n && Nl(e, Cn$3, t);
										case "dragend": return n && Nl(e, Sn$3, t);
										case "focus": return n && Nl(e, On$3, t);
										case "blur": return n && Nl(e, Mn$3, t);
										case "drop": return n && Nl(e, yn$3, t);
									}
								};
								r.push(Fn$2(t, o, s));
							}
						}(t, this), null != n && t.classList.add(...n);
					} else this._window = null, this._updateTags.add(xo), bi(this);
					Ni("root", this, !1, t, e);
				}
			}
			getElementByKey(t) {
				return this._keyToDOMMap.get(t) || null;
			}
			getEditorState() {
				return this._editorState;
			}
			setEditorState(e, n) {
				e.isEmpty() && t(38);
				let o = e;
				o._readOnly && (o = Ri(e), o._selection = e._selection ? e._selection.clone() : null), ht$7(this);
				const r = this._pendingEditorState, i = void 0 !== n ? n.tag : null;
				null === r || r.isEmpty() || (null != i && this._updateTags.add(i), bi(this)), this._pendingEditorState = o, this._dirtyType = 2, this._dirtyElements.set("root", !1), this._compositionKey = null, this._slotsUsed = this._slotsUsed || e._slotsUsed, Ai(this, () => {
					if (i && this._updateTags.add(i), e._parsed) for (const [t, e] of o._nodeMap.entries()) Pi(e) ? this._dirtyElements.set(t, !0) : this._dirtyLeaves.add(t);
				}, { discrete: !this._updating || void 0 });
			}
			parseEditorState(t, e) {
				return function(t, e, n) {
					const o = Wi(), r = ni, i = ri, s = oi, l = e._dirtyElements, c = e._dirtyLeaves, a = e._cloneNotNeeded, u = e._dirtyType;
					e._dirtyElements = /* @__PURE__ */ new Map(), e._dirtyLeaves = /* @__PURE__ */ new Set(), e._cloneNotNeeded = /* @__PURE__ */ new Set(), e._dirtyType = 0, ni = o, ri = !1, oi = e, vs(null);
					try {
						const r = e._nodes;
						Ti(t.root, r), n && n(), o._readOnly = !0, o._parsed = !0;
					} catch (t) {
						t instanceof Error && e._onError(t);
					} finally {
						e._dirtyElements = l, e._dirtyLeaves = c, e._cloneNotNeeded = a, e._dirtyType = u, ni = r, ri = i, oi = s;
					}
					return o;
				}("string" == typeof t ? JSON.parse(t) : t, this, e);
			}
			read(...t) {
				const [e, n] = 1 === t.length ? ["force-commit", t[0]] : t;
				"force-commit" === e && bi(this);
				return ("pending" === e ? this._pendingEditorState || this._editorState : this.getEditorState()).read(n, { editor: this });
			}
			update(t, e) {
				(function(t, e, n) {
					t._updating ? t._updates.push([e, n]) : Mi(t, e, n);
				})(this, t, e);
			}
			focus(t, e = {}) {
				const n = this._rootElement;
				null !== n && (n.setAttribute("autocapitalize", "off"), Ai(this, () => {
					const o = Kr(), r = nl();
					null !== o ? o.dirty || ol(o.clone()) : 0 !== r.getChildrenSize() && ("rootStart" === e.defaultSelection ? r.selectStart() : r.selectEnd()), Al("focus"), Dl(() => {
						n.removeAttribute("autocapitalize"), t && t();
					});
				}), null === this._pendingEditorState && n.removeAttribute("autocapitalize"));
			}
			blur() {
				const t = this._rootElement;
				null !== t && t.blur();
				const e = Jl(this._window);
				null !== e && e.removeAllRanges();
			}
			isEditable() {
				return this._editable;
			}
			setEditable(t) {
				this._editable !== t && (this._editable = t, Ni("editable", this, !0, t), this._slotsUsed && this.update(() => pi()));
			}
			toJSON() {
				return { editorState: this._editorState.toJSON() };
			}
		};
		Cs.version = Z$3;
		let Ss = null;
		function vs(t) {
			Ss = t;
		}
		const Ts = Symbol("INTERNAL_SKIP_AFTER_CLONE_FROM");
		let ks = 1;
		function bs() {
			ks = 1;
		}
		function Ns(e, n) {
			const o = Es(e, n);
			return void 0 === o && t(30, n), o;
		}
		function Es(t, e) {
			return t._nodes.get(e);
		}
		const ws = "function" == typeof queueMicrotask ? queueMicrotask : (t) => {
			Promise.resolve().then(t);
		};
		function Os(t, e) {
			const n = void 0 !== e ? e : (() => {
				const e = t.getRootNode();
				return Bs(e) || ql(e) ? cc(e) : null;
			})();
			if (!gc(n)) return !1;
			if (n.hasAttribute("data-lexical-slot")) return !1;
			const o = Zs(n), r = n.nodeName;
			return po$1(o) && ("INPUT" === r || "TEXTAREA" === r || "true" === n.contentEditable && null == Ps(n));
		}
		const Ms = Os;
		function As(t, e, n) {
			const o = t.getRootElement();
			if (!o) return !1;
			try {
				if (!e || !o.contains(e) || !o.contains(n)) return !1;
			} catch (t) {
				return !1;
			}
			return Fs(e) === t && t.read("latest", () => !Os(e));
		}
		function Ds(t) {
			return t instanceof Cs;
		}
		function Fs(t) {
			let e = t;
			for (; null != e;) {
				const t = Ps(e);
				if (Ds(t)) return t;
				e = wl(e);
			}
			return null;
		}
		function Ps(t) {
			return t ? t.__lexicalEditor : null;
		}
		function Is(t) {
			return L$1.test(t) ? "rtl" : K.test(t) ? "ltr" : null;
		}
		function Ls(t) {
			return er(t) || t.isToken();
		}
		function Ks(t) {
			return Ls(t) || t.isSegmented();
		}
		function zs(t) {
			return _c(t) && 3 === t.nodeType;
		}
		function Bs(t) {
			return _c(t) && 9 === t.nodeType;
		}
		function Rs(t) {
			let e = t;
			for (; null != e;) {
				if (zs(e)) return e;
				e = e.firstChild;
			}
			return null;
		}
		function Ws(t, e, n) {
			const o = z$2[e];
			if (null !== n && (t & o) === (n & o)) return t;
			let r = t ^ o;
			return "subscript" === e ? r &= ~z$2.superscript : "superscript" === e ? r &= ~z$2.subscript : "lowercase" === e ? (r &= ~z$2.uppercase, r &= ~z$2.capitalize) : "uppercase" === e ? (r &= ~z$2.lowercase, r &= ~z$2.capitalize) : "capitalize" === e && (r &= ~z$2.lowercase, r &= ~z$2.uppercase), r;
		}
		function $s(t) {
			return Xo(t) || Yi(t) || Ki(t);
		}
		function Us(t, e) {
			const n = function() {
				const t = Ss;
				return Ss = null, t;
			}();
			if (null != (e = e || n && n.__key)) return void (t.__key = e);
			fi(), di();
			const o = _i(), r = hi(), i = "" + ks++;
			r._nodeMap.set(i, t), Pi(t) ? o._dirtyElements.set(i, !0) : o._dirtyLeaves.add(i), o._cloneNotNeeded.add(i), 0 === o._dirtyType && (o._dirtyType = 1), t.__key = i;
		}
		function Hs(e) {
			null !== ta(e) && t(380, e.__key, String(ta(e)));
			const n = e.getParent();
			if (null !== n) {
				const t = e.getWritable(), o = n.getWritable(), r = e.getPreviousSibling(), i = e.getNextSibling(), s = null !== i ? i.__key : null, l = null !== r ? r.__key : null, c = null !== r ? r.getWritable() : null, a = null !== i ? i.getWritable() : null;
				null === r && (o.__first = s), null === i && (o.__last = l), null !== c && (c.__next = s), null !== a && (a.__prev = l), t.__prev = null, t.__next = null, t.__parent = null, o.__size--;
			}
		}
		const js = Hs;
		function Js(e) {
			di(), ho$1(e) && t(323, e.__key, e.__type);
			const n = e.getLatest(), o = null !== n.__parent ? n.__parent : Zc(n) ? n.__slotHost : null, r = hi(), i = _i(), s = r._nodeMap, l = i._dirtyElements;
			null !== o && function(t, e, n) {
				let o = t;
				for (; null !== o;) {
					if (n.has(o)) return;
					const t = e.get(o);
					if (void 0 === t) break;
					n.set(o, !1), o = null !== t.__parent ? t.__parent : Zc(t) ? t.__slotHost : null;
				}
			}(o, s, l);
			const c = n.__key;
			0 === i._dirtyType && (i._dirtyType = 1), Pi(e) ? l.set(c, !0) : i._dirtyLeaves.add(c);
		}
		function Vs(t) {
			fi();
			const e = _i(), n = e._compositionKey;
			if (t !== n) {
				if (e._compositionKey = t, null !== n) {
					const t = Ys(n);
					null !== t && t.getWritable();
				}
				if (null !== t) {
					const e = Ys(t);
					null !== e && e.getWritable();
				}
			}
		}
		function qs() {
			if (ui()) return null;
			return _i()._compositionKey;
		}
		function Ys(t, e) {
			const n = (e || hi())._nodeMap.get(t);
			return void 0 === n ? null : n;
		}
		function Gs(t, e) {
			const n = Qs(t, _i());
			return void 0 !== n ? Ys(n, e) : null;
		}
		function Xs(t, e, n) {
			t[`__lexicalKey_${e._key}`] = n;
		}
		function Qs(t, e) {
			return t[`__lexicalKey_${e._key}`];
		}
		function Zs(t, e) {
			let n = t;
			for (; null != n;) {
				const t = Gs(n, e);
				if (null !== t) return t;
				n = wl(n);
			}
			return null;
		}
		function tl(t) {
			const e = t._decorators, n = Object.assign({}, e);
			return t._pendingDecorators = n, n;
		}
		function el(t) {
			return t.read(() => nl().getTextContent());
		}
		function nl() {
			return hi()._nodeMap.get("root");
		}
		function ol(t) {
			fi();
			const e = hi();
			null !== t && (t.dirty = !0, t.setCachedNodes(null), ur(t) && _i()._slotsUsed && Or(t)), e._selection = t;
		}
		function rl() {
			fi();
			ht$7(_i());
		}
		function il(t) {
			const e = function(t, e) {
				let n = t;
				for (; null != n;) {
					const t = Qs(n, e);
					if (void 0 !== t) return t;
					n = wl(n);
				}
				return null;
			}(t, _i());
			return null === e ? null : Ys(e);
		}
		function sl(t) {
			return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(t);
		}
		function ll(t) {
			const e = [];
			for (let n = t; null !== n; n = n._parentEditor) e.push(n);
			return e;
		}
		function cl() {
			return Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 5);
		}
		function al(t) {
			return zs(t) ? t.nodeValue : null;
		}
		function ul(t, e, n) {
			const o = Jl(Il(e));
			if (null === o) return;
			const r = nc(o, e._rootElement), i = r.anchorNode;
			let { anchorOffset: s, focusOffset: l } = r;
			if (null !== i) {
				let e = al(i);
				const o = Zs(i);
				if (null !== e && Xo(o)) {
					if ((e === A$1 || e === F$1) && n) {
						const t = n.length;
						e = n, s = t, l = t;
					}
					null !== e && fl(o, e, s, l, t);
				}
			}
		}
		function fl(t, e, n, o, r) {
			let i = t;
			if (i.isAttached() && (r || !i.isDirty())) {
				const s = i.isComposing();
				if (i.isToken() && s) return;
				let c = e;
				if ((s || r) && (e.endsWith(A$1) && (c = e.slice(0, -A$1.length)), r)) {
					const t = F$1;
					let e;
					for (; -1 !== (e = c.indexOf(t));) c = c.slice(0, e) + c.slice(e + t.length), null !== n && n > e && (n = Math.max(e, n - t.length)), null !== o && o > e && (o = Math.max(e, o - t.length));
				}
				const u = i.getTextContent();
				if (r || c !== u) {
					const e = Kr();
					if ("" === c) {
						if (Vs(null), a || l || d) i.remove();
						else {
							const t = _i();
							dl(i, "", e), setTimeout(() => {
								t.update(() => {
									i.isAttached() && "" === i.getTextContent() && i.remove();
								});
							}, 20);
						}
						return;
					}
					const r = i.getParent(), u = zr(), f = i.getTextContentSize(), h = qs(), g = i.getKey();
					if (i.isToken() && !s || null !== h && g === h && !s || ur(u) && (null !== r && !r.canInsertTextBefore() && 0 === u.anchor.offset || u.anchor.key === t.__key && 0 === u.anchor.offset && !i.canInsertTextBefore() && !s || u.focus.key === t.__key && u.focus.offset === f && !i.canInsertTextAfter() && !s)) return void i.markDirty();
					if (!ur(e) || null === n || null === o) return void dl(i, c, e);
					if (e.setTextNodeRange(i, n, i, o), i.isSegmented()) {
						const t = Go(i.getTextContent());
						i.replace(t), i = t;
					}
					dl(i, c, e);
				}
			}
		}
		function dl(t, e, n) {
			if (t.setTextContent(e), ur(n)) {
				const e = t.getKey();
				let o = !1;
				for (const r of ["anchor", "focus"]) {
					const i = n[r];
					"text" === i.type && i.key === e && (i.offset = Ka(t, i.offset, "clamp"), o = !0);
				}
				o && (n._cachedNodes = null, n._cachedIsBackward = null);
			}
		}
		function hl(t, e, n) {
			const o = e[n] || !1;
			return "any" === o || o === t[n];
		}
		function gl(t, e) {
			return hl(t, e, "altKey") && hl(t, e, "ctrlKey") && hl(t, e, "shiftKey") && hl(t, e, "metaKey");
		}
		function _l(t, e, n) {
			if (!gl(t, n)) return !1;
			if (t.key.toLowerCase() === e.toLowerCase()) return !0;
			if (e.length > 1) return !1;
			if (1 === t.key.length && t.key.charCodeAt(0) <= 127) return !1;
			if (t.code.startsWith("Digit") && /^\d$/.test(e)) return t.code === `Digit${e}`;
			const o = "Key" + e.toUpperCase();
			return t.code === o;
		}
		const pl = {
			ctrlKey: !r,
			metaKey: r
		};
		const yl = {
			altKey: r,
			ctrlKey: !r
		};
		function ml(t) {
			return "Backspace" === t.key;
		}
		function xl(t) {
			const e = nl();
			if (ur(t)) {
				const e = t.anchor, n = t.focus, o = e.getNode();
				if (Bi(o)) return e.set(o.getKey(), 0, "element"), n.set(o.getKey(), o.getChildrenSize(), "element"), It$5(t), t;
				const r = o.getTopLevelElementOrThrow(), i = r.getParent();
				if (null === i) return Pi(r) && (e.set(r.getKey(), 0, "element"), n.set(r.getKey(), r.getChildrenSize(), "element"), It$5(t)), t;
				const s = i;
				return e.set(s.getKey(), 0, "element"), n.set(s.getKey(), s.getChildrenSize(), "element"), It$5(t), t;
			}
			{
				const t = e.select(0, e.getChildrenSize());
				return ol(It$5(t)), t;
			}
		}
		function Cl(t, e) {
			void 0 === t.__lexicalClassNameCache && (t.__lexicalClassNameCache = {});
			const n = t.__lexicalClassNameCache, o = n[e];
			if (void 0 !== o) return o;
			const r = t[e];
			if ("string" == typeof r) {
				const t = ku(r);
				return n[e] = t, t;
			}
			return r;
		}
		function Sl(e, n, o, r, i) {
			if (0 === o.size) return;
			const s = r.__type, l = r.__key, c = n.get(s);
			void 0 === c && t(33, s);
			const a = c.klass;
			let u = e.get(a);
			void 0 === u && (u = /* @__PURE__ */ new Map(), e.set(a, u));
			const f = u.get(l), d = "destroyed" === f && "created" === i;
			(void 0 === f || d) && u.set(l, d ? "updated" : i);
		}
		function vl(t) {
			const e = t.getType(), n = hi();
			if (n._readOnly) {
				const t = Ac(n).get(e);
				return t ? Array.from(t.values()) : [];
			}
			const o = n._nodeMap, r = [];
			for (const [, n] of o) n instanceof t && n.__type === e && n.isAttached() && r.push(n);
			return r;
		}
		function Tl(t, e, n) {
			const o = t.getParent();
			let r = n, i = t;
			return null !== o && (e && 0 === n ? (r = i.getIndexWithinParent(), i = o) : e || n !== i.getChildrenSize() || (r = i.getIndexWithinParent() + 1, i = o)), i.getChildAtIndex(e ? r - 1 : r);
		}
		function kl(t, e) {
			const n = t.offset;
			if ("element" === t.type) return Tl(t.getNode(), e, n);
			{
				const o = t.getNode();
				if (e && 0 === n || !e && n === o.getTextContentSize()) {
					const t = e ? o.getPreviousSibling() : o.getNextSibling();
					return null === t ? Tl(o.getParentOrThrow(), e, o.getIndexWithinParent() + (e ? 0 : 1)) : t;
				}
			}
			return null;
		}
		function bl(t) {
			const e = Il(t).event, n = e && e.inputType;
			return "insertFromPaste" === n || "insertFromPasteAsQuotation" === n;
		}
		function Nl(t, e, ...n) {
			return Ei(t, e, n[0], t);
		}
		function El(e, n) {
			const o = e._keyToDOMMap.get(n);
			return void 0 === o && t(75, n), o;
		}
		function wl(t) {
			const e = t.assignedSlot || t.parentElement;
			if (null !== e) return e;
			const n = t.parentNode;
			return ql(n) ? n.host : null;
		}
		function Ol(t) {
			return Bs(t) ? t : gc(t) ? t.ownerDocument : null;
		}
		function Ml(t) {
			return _i()._updateTags.has(t);
		}
		function Al(t) {
			fi();
			_i()._updateTags.add(t);
		}
		function Dl(t) {
			fi();
			_i()._deferred.push(t);
		}
		function Fl(t, e) {
			let n = t.getParent();
			for (; null !== n;) {
				if (n.is(e)) return !0;
				n = n.getParent();
			}
			return !1;
		}
		function Pl(t) {
			const e = Ol(t);
			return e ? e.defaultView : null;
		}
		function Il(e) {
			const n = e._window;
			return null === n && t(78), n;
		}
		function Ll(t) {
			return Pi(t) && t.isInline() || Ki(t) && t.isInline();
		}
		function Kl(t) {
			let e = t.getLatest();
			for (; null !== e;) {
				if (null !== ta(e) && Pi(e)) return e;
				const t = e.getParentOrThrow();
				if (Bl(t)) return t;
				e = t;
			}
			return e;
		}
		function zl(t) {
			return Pi(t) && t.isShadowRoot();
		}
		function Bl(t) {
			return Bi(t) || zl(t);
		}
		function Rl(t, e = !1) {
			const n = t.constructor.clone(t, Ts);
			return Us(n, null), n.afterCloneFrom(t), e || n.resetOnCopyNodeFrom(t), n;
		}
		function Wl(e) {
			const n = _i(), o = e.getType(), r = Es(n, o);
			void 0 === r && t(200, e.constructor.name, o);
			const { replace: i, replaceWithKlass: s } = r;
			if (null !== i) {
				const n = i(e), r = n.constructor;
				return null !== s ? n instanceof s || t(201, s.name, s.getType(), r.name, r.getType(), e.constructor.name, o) : n instanceof e.constructor && r !== e.constructor || t(202, r.name, r.getType(), e.constructor.name, o), n.__key === e.__key && t(203, e.constructor.name, o, r.name, r.getType()), n;
			}
			return e;
		}
		function $l(e, n) {
			!Bi(e.getParent()) || Pi(n) || Ki(n) || t(99);
		}
		function Ul(e) {
			const n = Ys(e);
			return null === n && t(63, e), n;
		}
		function Hl(t) {
			if (!t || t.isInline()) return !1;
			if (Ki(t)) return !0;
			if (Pi(t)) {
				if (t.isShadowRoot()) {
					const e = t.getParent();
					return !(Pi(e) && e.isShadowRoot());
				}
				return !t.canBeEmpty();
			}
			return !1;
		}
		function jl(t, e, n) {
			n.style.removeProperty("caret-color"), e._blockCursorElement = null;
			const o = t.parentElement;
			null !== o && o.removeChild(t);
		}
		function Jl(t) {
			return n ? (t || window).getSelection() : null;
		}
		function Vl(t) {
			const e = Pl(t);
			return e ? e.getSelection() : null;
		}
		function ql(t) {
			return pc(t) && "host" in t;
		}
		const Yl = [];
		function Gl(t) {
			const e = t.getRootNode();
			if (e === t || !ql(e)) return Yl;
			const n = [e];
			let o = e.host;
			for (;;) {
				const t = o.getRootNode();
				if (t === o || !ql(t)) break;
				n.push(t), o = t.host;
			}
			return n;
		}
		function* Xl(t) {
			const e = [t];
			let n;
			for (; n = e.pop();) {
				yield* n.querySelectorAll("[data-lexical-editor=\"true\"]");
				const t = (Bs(n) ? n : n.ownerDocument).createTreeWalker(n, NodeFilter.SHOW_ELEMENT);
				let o;
				for (; o = t.nextNode();) o.shadowRoot && e.push(o.shadowRoot);
			}
		}
		function Ql(t) {
			return null !== t ? t.ownerDocument : document;
		}
		function Zl() {
			const t = mi();
			return Ql(null !== t ? t._rootElement : null);
		}
		function tc(t, e) {
			if (null === e || "function" != typeof t.getComposedRanges) return null;
			const n = Gl(e);
			if (0 === n.length) return null;
			const o = t.getComposedRanges;
			try {
				const e = o.call(t, { shadowRoots: n })[0];
				if (void 0 !== e) return e;
			} catch (t) {}
			try {
				const e = o.apply(t, n)[0];
				if (void 0 !== e) return e;
			} catch (t) {}
			return null;
		}
		function ec(t, e) {
			const n = tc(t, e);
			if (null !== n) {
				const t = rc(n);
				if (null !== t) return t;
			}
			return t.rangeCount > 0 ? t.getRangeAt(0) : null;
		}
		function nc(t, e) {
			const n = tc(t, e);
			return null === n ? t : ic(n, sc(t));
		}
		function oc(t, e) {
			const n = tc(t, e);
			if (null === n) return {
				points: t,
				range: t.rangeCount > 0 ? t.getRangeAt(0) : null
			};
			const o = rc(n) ?? (t.rangeCount > 0 ? t.getRangeAt(0) : null);
			return {
				points: ic(n, sc(t)),
				range: o
			};
		}
		function rc(t) {
			const e = t.startContainer.ownerDocument;
			if (null === e) return null;
			const n = e.createRange();
			try {
				return n.setStart(t.startContainer, t.startOffset), n.setEnd(t.endContainer, t.endOffset), n;
			} catch (t) {
				return null;
			}
		}
		function ic(t, e) {
			const { startContainer: n, startOffset: o, endContainer: r, endOffset: i } = t;
			return "backward" === e ? {
				anchorNode: r,
				anchorOffset: i,
				direction: e,
				focusNode: n,
				focusOffset: o
			} : {
				anchorNode: n,
				anchorOffset: o,
				direction: e,
				focusNode: r,
				focusOffset: i
			};
		}
		function sc(t) {
			return t.direction;
		}
		function lc(t) {
			const e = t.getRootNode();
			return Bs(e) || ql(e) ? e.activeElement : null;
		}
		function cc(t) {
			let e = t.activeElement;
			for (; null !== e && null !== e.shadowRoot;) {
				const t = e.shadowRoot.activeElement;
				if (null === t) break;
				e = t;
			}
			return e;
		}
		function ac(t) {
			const e = t.target;
			if (null !== e && gc(e) && null !== e.shadowRoot && "function" == typeof t.composedPath) {
				const e = t.composedPath();
				if (e.length > 0) return e[0];
			}
			return e;
		}
		function uc(e, n) {
			let o = e.getChildAtIndex(n);
			o ??= e, Bl(e) && t(102);
			const r = (e) => {
				const n = e.getParentOrThrow(), i = Bl(n), s = e !== o || i ? Rl(e) : e;
				if (i) return Pi(e) && Pi(s) || t(133), e.insertAfter(s), [
					e,
					s,
					s
				];
				{
					const [t, o, i] = r(n), l = e.getNextSiblings();
					return i.append(s, ...l), [
						t,
						o,
						s
					];
				}
			}, [i, s] = r(o);
			return [i, s];
		}
		function fc(t) {
			return gc(t) && "A" === t.tagName;
		}
		function dc(t) {
			return gc(t) && "TR" === t.tagName;
		}
		function hc(t) {
			return gc(t) && ("TD" === t.tagName || "TH" === t.tagName);
		}
		function gc(t) {
			return _c(t) && 1 === t.nodeType;
		}
		function _c(t) {
			return "object" == typeof t && null !== t && "nodeType" in t && "number" == typeof t.nodeType;
		}
		function pc(t) {
			return _c(t) && 11 === t.nodeType;
		}
		const yc = /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/i;
		function mc(t) {
			return !(!gc(t) || !t.style.display.startsWith("inline")) || yc.test(t.nodeName);
		}
		const xc = /^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/i;
		function Cc(t) {
			return (!gc(t) || !t.style.display.startsWith("inline")) && xc.test(t.nodeName);
		}
		function Sc(t) {
			if (Ki(t) && !t.isInline()) return !0;
			if (!Pi(t) || Bl(t)) return !1;
			const e = t.getFirstChild(), n = null === e || Yi(e) || Xo(e) || e.isInline();
			return !t.isInline() && !1 !== t.canBeEmpty() && n;
		}
		function vc() {
			return _i();
		}
		function Tc(t = vc()) {
			return t._config.dom || ps;
		}
		function kc(e, n, o = vc()) {
			const r = Tc(o).$getDOMSlot(e, n, o);
			return Pi(e) && (Ec(r) || t(344, e.getKey(), e.getType())), r;
		}
		function bc(t, e, n, o) {
			const r = t.read("latest", () => {
				const o = Ys(e);
				return null !== o ? function(t, e, n = vc()) {
					const o = sa(t, e);
					if (null === o) return null;
					const r = n.getElementByKey(o.getKey());
					return null !== r ? r.parentElement : null;
				}(o, n, t) : null;
			});
			return null !== r && (r.parentElement !== o && o.appendChild(r), r.style.display = ""), r;
		}
		function Nc(t, e, n) {
			n.style.display = "none";
			const o = t.getElementByKey(e);
			null !== o && n.parentElement !== o && o.insertBefore(n, o.firstChild);
		}
		function Ec(t) {
			return t instanceof G$2;
		}
		function wc(t, e, n = vc()) {
			return Rs(kc(t, e, n).element);
		}
		const Oc = /* @__PURE__ */ new WeakMap();
		const Mc = /* @__PURE__ */ new Map();
		function Ac(e) {
			if (!e._readOnly && e.isEmpty()) return Mc;
			e._readOnly || t(192);
			let n = Oc.get(e);
			return n || (n = function(t) {
				const e = /* @__PURE__ */ new Map();
				for (const [n, o] of t._nodeMap) {
					const t = o.__type;
					let r = e.get(t);
					r || (r = /* @__PURE__ */ new Map(), e.set(t, r)), r.set(n, o);
				}
				return e;
			}(e), Oc.set(e, n)), n;
		}
		function Dc(t) {
			const e = t.constructor.clone(t, Ts);
			return e.afterCloneFrom(t), e;
		}
		function Fc(t) {
			return (e = Dc(t))[fo$1] = !0, e;
			var e;
		}
		function Pc(t, e) {
			const n = t.getAttribute("data-lexical-indent");
			if (null !== n) {
				const t = parseInt(n, 10);
				if (Number.isFinite(t) && t >= 0) return void e.setIndent(t);
			}
			const o = parseInt(t.style.paddingInlineStart, 10) || 0, r = Math.round(o / 40);
			e.setIndent(r);
		}
		function Ic(t, e) {
			const n = e.getAttribute("dir");
			return "ltr" === n || "rtl" === n ? t.setDirection(n) : t;
		}
		function Lc(t, e) {
			const n = e.style.textAlign;
			return n && n in R$1 ? t.setFormat(n) : t;
		}
		function Kc(t, e) {
			t.__lexicalUnmanaged = !0, e && void 0 !== e.captureSelection && (t.__lexicalCapturedSelection = e.captureSelection);
		}
		function zc(t) {
			return !0 === t.__lexicalUnmanaged;
		}
		function Bc(t, e = vc()) {
			const n = e.isEditable();
			t.contentEditable = n ? "true" : "false", n ? t.__lexicalEditor = e : delete t.__lexicalEditor;
		}
		function Rc(t, e) {
			let n = t;
			for (; null != n;) {
				if (!0 === n.__lexicalCapturedSelection) return !0;
				if (gc(n) && n.hasAttribute("data-lexical-slot")) return !1;
				if (void 0 !== Qs(n, e)) return !1;
				n = wl(n);
			}
			return !1;
		}
		function Wc(t, e) {
			return function(t, e) {
				return Object.prototype.hasOwnProperty.call(t, e);
			}(t, e) && t[e] !== _o$1[e];
		}
		const $c = /* @__PURE__ */ new WeakMap();
		const Uc = Symbol("lexical.synthesizedGetType");
		function Hc(e) {
			const n = $c.get(e);
			if (n) return n;
			const o = null != e.prototype && j$2 in e.prototype ? e.prototype[j$2]() : void 0, r = function(e) {
				if (!(e === _o$1 || e.prototype instanceof _o$1)) {
					let n = "<unknown>", o = "<unknown>";
					try {
						n = e.getType();
					} catch (t) {}
					try {
						Cs.version && (o = JSON.parse(Cs.version));
					} catch (t) {}
					t(290, e.name, n, o);
				}
				return e === Li || e === Fi || e === _o$1;
			}(e), i = !r && Wc(e, "getType") ? e.getType : void 0, s = i && !(Uc in i) ? i.call(e) : void 0;
			let l, c = s;
			if (o) if (s) l = o[s];
			else {
				for (const [t, e] of Object.entries(o)) c = t, l = e;
				if (!l) for (const t of Object.getOwnPropertySymbols(o)) {
					const e = o[t];
					if (e) {
						l = e;
						break;
					}
				}
			}
			if (!r && c) {
				if (!Wc(e, "getType")) {
					const t = e, n = function() {
						return this !== t ? _o$1.getType.call(this) : c;
					};
					n[Uc] = !0, e.getType = n;
				}
				if (Wc(e, "clone") || (e.clone = (t, n) => {
					vs(t);
					const o = new e();
					return n !== Ts && o.afterCloneFrom(t), o;
				}), Wc(e, "importJSON") || (e.importJSON = l && l.$importJSON || ((t) => new e().updateFromJSON(t))), !Wc(e, "importDOM") && l) {
					const { importDOM: t } = l;
					t && (e.importDOM = () => t);
				}
			}
			const a = {
				klass: e,
				ownNodeConfig: l,
				ownNodeType: c
			};
			return $c.set(e, a), a;
		}
		function* jc(t) {
			for (let e = t; e && (e === _o$1 || po$1(e.prototype));) {
				const t = Hc(e);
				yield t, e = t.ownNodeConfig && t.ownNodeConfig.extends || Gc(e);
			}
		}
		function Jc(t) {
			const e = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map();
			for (const o of t) {
				const { ownNodeType: t } = Hc(o);
				t && (n.set(t, o), e.set(t, /* @__PURE__ */ new Set()));
			}
			for (const [t, o] of n) for (const { ownNodeType: n } of jc(o)) {
				const o = n && e.get(n);
				o && o.add(t);
			}
			return e;
		}
		function Vc(t) {
			const e = vc();
			fi();
			return new (e.resolveRegisteredNodeAfterReplacements(e.getRegisteredNode(t))).klass();
		}
		const qc = (t, e) => {
			let n = t;
			for (; null != n && !Bi(n);) {
				if (e(n)) return n;
				n = n.getParent();
			}
			return null;
		};
		function Yc(e, n) {
			const o = [];
			let r = e.__first;
			for (; null !== r;) {
				const e = null === n ? Ys(r) : n.get(r);
				e ?? t(174), o.push(r), r = e.__next;
			}
			return o;
		}
		function Gc(t) {
			const e = Object.getPrototypeOf(t);
			if ("function" == typeof e && e !== Function.prototype) return e;
			const n = t.prototype && Object.getPrototypeOf(t.prototype);
			return n ? n.constructor : null;
		}
		const Xc = /* @__PURE__ */ new Map();
		function Qc(t) {
			return Pi(t) || Ki(t);
		}
		function Zc(t) {
			return Pi(t) || Ki(t);
		}
		function ta(t) {
			const e = t.getLatest();
			return Zc(e) ? e.__slotHost : null;
		}
		function ea(e) {
			const n = ta(e);
			if (null === n) return null;
			const o = Ys(n);
			return Pi(o) || Ki(o) || t(370), o;
		}
		function na(t) {
			const e = ea(t);
			if (null === e) return null;
			const n = t.getLatest().__key;
			for (const [t, o] of ra(e)) if (o === n) return t;
			return null;
		}
		function oa(t) {
			let e = t.getLatest();
			for (; null !== e;) {
				if (null !== ta(e)) return e;
				e = e.getParent();
			}
			return null;
		}
		function ra(t) {
			const e = t.getLatest();
			return Qc(e) && null !== e.__slots ? e.__slots : Xc;
		}
		function ia(t) {
			return Array.from(ra(t).keys());
		}
		function sa(t, e) {
			const n = ra(t).get(e);
			return void 0 === n ? null : Ys(n);
		}
		const la = [
			"__proto__",
			"constructor",
			"prototype"
		];
		const ca = Symbol("slotMapOwner");
		function aa(t) {
			let e = t.__slots;
			return null !== e && e[ca] === t || (e = new Map(e), e[ca] = t, t.__slots = e), e;
		}
		const ua = /* @__PURE__ */ new WeakMap();
		const fa = [];
		function da(t) {
			for (const { ownNodeConfig: e } of jc(t)) {
				const t = e && e.slots;
				if (t) return t;
			}
			return fa;
		}
		function ha(t) {
			let e = "";
			for (const n of ia(t)) {
				const o = sa(t, n);
				null !== o && (e += o.getTextContent());
			}
			return e;
		}
		function ga(t, e, n) {
			const o = n.get(t), r = n.get(e);
			return void 0 !== o ? void 0 !== r ? o - r : -1 : void 0 !== r ? 1 : t < e ? -1 : t > e ? 1 : 0;
		}
		function _a(e) {
			const n = e.__slots;
			if (null === n || n.size < 2) return;
			const o = function(e) {
				let n = ua.get(e);
				if (void 0 === n) {
					const o = da(e), r = /* @__PURE__ */ new Map();
					for (const n of o) la.includes(n) && t(371, e.name, n), r.has(n) && t(372, e.name, n), r.set(n, r.size);
					n = r, ua.set(e, n);
				}
				return n;
			}(e.constructor);
			let r = null, i = !0;
			for (const t of n.keys()) {
				if (null !== r && ga(r, t, o) > 0) {
					i = !1;
					break;
				}
				r = t;
			}
			if (i) return;
			const s = Array.from(n).sort(([t], [e]) => ga(t, e, o));
			n.clear();
			for (const [t, e] of s) n.set(t, e);
		}
		function pa(e, n, o) {
			"__proto__" !== n && "constructor" !== n && "prototype" !== n || t(373, n);
			const r = e.getLatest();
			if (null !== r.__slots && r.__slots.get(n) === o.getLatest().__key) return r;
			(!Pi(o) && !Ki(o) || o.isInline()) && t(374, o.__key);
			const i = e.getWritable(), s = aa(i), l = s.get(n);
			void 0 !== l && xa(l);
			const c = o.getWritable(), a = ea(c);
			if (null !== a) {
				const t = na(c);
				null !== t && aa(a.getWritable()).delete(t), c.__slotHost = null;
			}
			return Hs(c), c.__slotHost = i.__key, s.set(n, c.__key), _a(i), function() {
				const t = vc();
				t._slotsUsed = !0, t._pendingEditorState && (t._pendingEditorState._slotsUsed = !0);
			}(), i;
		}
		function ya(t, e) {
			const n = t.getWritable();
			if (null === n.__slots) return n;
			const o = n.__slots.get(e);
			return void 0 !== o && (xa(o), aa(n).delete(e)), n;
		}
		function xa(e) {
			const n = Ys(e);
			if (null === n) return;
			const o = n.getWritable();
			Zc(o) || t(377, e), o.__slotHost = null, o.remove();
		}
		const Ca = {
			next: "previous",
			previous: "next"
		};
		var Sa = class {
			origin;
			constructor(t) {
				this.origin = t;
			}
			[Symbol.iterator]() {
				return qa({
					hasNext: Ma,
					initial: this.getAdjacentCaret(),
					map: (t) => t,
					step: (t) => t.getAdjacentCaret()
				});
			}
			getAdjacentCaret() {
				return Ia(this.getNodeAtCaret(), this.direction);
			}
			getSiblingCaret() {
				return Ia(this.origin, this.direction);
			}
			remove() {
				const t = this.getNodeAtCaret();
				return t && t.remove(), this;
			}
			replaceOrInsert(t, e) {
				const n = this.getNodeAtCaret();
				return t.is(this.origin) || t.is(n) || (null === n ? this.insert(t) : n.replace(t, e)), this;
			}
			splice(e, n, o = "next") {
				const r = o === this.direction ? n : Array.from(n).reverse();
				let i = this;
				const s = this.getParentAtCaret(), l = /* @__PURE__ */ new Map();
				for (let t = i.getAdjacentCaret(); null !== t && l.size < e; t = t.getAdjacentCaret()) {
					const e = t.origin.getWritable();
					l.set(e.getKey(), e);
				}
				for (const e of r) {
					if (l.size > 0) {
						const n = i.getNodeAtCaret();
						if (n) if (l.delete(n.getKey()), l.delete(e.getKey()), n.is(e) || i.origin.is(e));
						else {
							const t = e.getParent();
							t && t.is(s) && e.remove(), n.replace(e);
						}
						else null === n && t(263, Array.from(l).join(" "));
					} else i.insert(e);
					i = Ia(e, this.direction);
				}
				for (const t of l.values()) t.remove();
				return this;
			}
		};
		var va = class va extends Sa {
			type = "child";
			getLatest() {
				const t = this.origin.getLatest();
				return t === this.origin ? this : Ba(t, this.direction);
			}
			getParentCaret(t = "root") {
				return Ia(ba(this.getParentAtCaret(), t), this.direction);
			}
			getFlipped() {
				const t = ka(this.direction);
				return Ia(this.getNodeAtCaret(), t) || Ba(this.origin, t);
			}
			getParentAtCaret() {
				return this.origin;
			}
			getChildCaret() {
				return this;
			}
			isSameNodeCaret(t) {
				return t instanceof va && this.direction === t.direction && this.origin.is(t.origin);
			}
			isSamePointCaret(t) {
				return this.isSameNodeCaret(t);
			}
		};
		const Ta = {
			root: Bi,
			shadowRoot: Bl
		};
		function ka(t) {
			return Ca[t];
		}
		function ba(t, e = "root") {
			return null === t || Ta[e](t) ? null : null === ta(t) ? t : null;
		}
		var Na = class Na extends Sa {
			type = "sibling";
			getLatest() {
				const t = this.origin.getLatest();
				return t === this.origin ? this : Ia(t, this.direction);
			}
			getSiblingCaret() {
				return this;
			}
			getParentAtCaret() {
				return this.origin.getParent();
			}
			getChildCaret() {
				return Pi(this.origin) ? Ba(this.origin, this.direction) : null;
			}
			getParentCaret(t = "root") {
				return Ia(ba(this.getParentAtCaret(), t), this.direction);
			}
			getFlipped() {
				const t = ka(this.direction);
				return Ia(this.getNodeAtCaret(), t) || Ba(this.origin.getParentOrThrow(), t);
			}
			isSamePointCaret(t) {
				return t instanceof Na && this.direction === t.direction && this.origin.is(t.origin);
			}
			isSameNodeCaret(t) {
				return (t instanceof Na || t instanceof Ea) && this.direction === t.direction && this.origin.is(t.origin);
			}
		};
		var Ea = class Ea extends Sa {
			type = "text";
			offset;
			constructor(t, e) {
				super(t), this.offset = e;
			}
			getLatest() {
				const t = this.origin.getLatest();
				return t === this.origin ? this : La(t, this.direction, this.offset);
			}
			getParentAtCaret() {
				return this.origin.getParent();
			}
			getChildCaret() {
				return null;
			}
			getParentCaret(t = "root") {
				return Ia(ba(this.getParentAtCaret(), t), this.direction);
			}
			getFlipped() {
				return La(this.origin, ka(this.direction), this.offset);
			}
			isSamePointCaret(t) {
				return t instanceof Ea && this.direction === t.direction && this.origin.is(t.origin) && this.offset === t.offset;
			}
			isSameNodeCaret(t) {
				return (t instanceof Na || t instanceof Ea) && this.direction === t.direction && this.origin.is(t.origin);
			}
			getSiblingCaret() {
				return Ia(this.origin, this.direction);
			}
		};
		function wa(t) {
			return t instanceof Ea;
		}
		function Oa(t) {
			return t instanceof Sa;
		}
		function Ma(t) {
			return t instanceof Na;
		}
		function Aa(t) {
			return t instanceof va;
		}
		const Da = {
			next: class extends Ea {
				direction = "next";
				getNodeAtCaret() {
					return this.origin.getNextSibling();
				}
				insert(t) {
					return this.origin.insertAfter(t), this;
				}
			},
			previous: class extends Ea {
				direction = "previous";
				getNodeAtCaret() {
					return this.origin.getPreviousSibling();
				}
				insert(t) {
					return this.origin.insertBefore(t), this;
				}
			}
		};
		const Fa = {
			next: class extends Na {
				direction = "next";
				getNodeAtCaret() {
					return this.origin.getNextSibling();
				}
				insert(t) {
					return this.origin.insertAfter(t), this;
				}
			},
			previous: class extends Na {
				direction = "previous";
				getNodeAtCaret() {
					return this.origin.getPreviousSibling();
				}
				insert(t) {
					return this.origin.insertBefore(t), this;
				}
			}
		};
		const Pa = {
			next: class extends va {
				direction = "next";
				getNodeAtCaret() {
					return this.origin.getFirstChild();
				}
				insert(t) {
					return this.origin.splice(0, 0, [t]), this;
				}
			},
			previous: class extends va {
				direction = "previous";
				getNodeAtCaret() {
					return this.origin.getLastChild();
				}
				insert(t) {
					return this.origin.splice(this.origin.getChildrenSize(), 0, [t]), this;
				}
			}
		};
		function Ia(t, e) {
			return t ? new Fa[e](t) : null;
		}
		function La(t, e, n) {
			return t ? new Da[e](t, Ka(t, n)) : null;
		}
		function Ka(t, n, o = "error") {
			const r = t.getTextContentSize();
			let i = "next" === n ? r : "previous" === n ? 0 : n;
			return (i < 0 || i > r) && ("clamp" !== o && e(284, String(n), String(r), t.getKey()), i = i < 0 ? 0 : r), i;
		}
		function za(t, e) {
			return new Ua(t, e);
		}
		function Ba(t, e) {
			return Pi(t) ? new Pa[e](t) : null;
		}
		function Ra(t) {
			return t && t.getChildCaret() || t;
		}
		function Wa(t) {
			return t && Ra(t.getAdjacentCaret());
		}
		var $a = class $a {
			type = "node-caret-range";
			direction;
			anchor;
			focus;
			constructor(t, e, n) {
				this.anchor = t, this.focus = e, this.direction = n;
			}
			getLatest() {
				const t = this.anchor.getLatest(), e = this.focus.getLatest();
				return t === this.anchor && e === this.focus ? this : new $a(t, e, this.direction);
			}
			isCollapsed() {
				return this.anchor.isSamePointCaret(this.focus);
			}
			getTextSlices() {
				const t = (t) => {
					const e = this[t].getLatest();
					return wa(e) ? function(t, e) {
						const { direction: n, origin: o } = t;
						return za(t, Ka(o, "focus" === e ? ka(n) : n) - t.offset);
					}(e, t) : null;
				}, e = t("anchor"), n = t("focus");
				if (e && n) {
					const { caret: t } = e, { caret: o } = n;
					if (t.isSameNodeCaret(o)) return [za(t, o.offset - t.offset), null];
				}
				return [e, n];
			}
			iterNodeCarets(t = "root") {
				const e = wa(this.anchor) ? this.anchor.getSiblingCaret() : this.anchor.getLatest(), n = this.focus.getLatest(), o = wa(n), r = (e) => e.isSameNodeCaret(n) ? null : Wa(e) || e.getParentCaret(t);
				return qa({
					hasNext: (t) => null !== t && !(o && n.isSameNodeCaret(t)),
					initial: e.isSameNodeCaret(n) ? null : r(e),
					map: (t) => t,
					step: r
				});
			}
			[Symbol.iterator]() {
				return this.iterNodeCarets("root");
			}
		};
		var Ua = class {
			type = "slice";
			caret;
			distance;
			constructor(t, e) {
				this.caret = t, this.distance = e;
			}
			getSliceIndices() {
				const { distance: t, caret: { offset: e } } = this, n = e + t;
				return n < e ? [n, e] : [e, n];
			}
			getTextContent() {
				const [t, e] = this.getSliceIndices();
				return this.caret.origin.getTextContent().slice(t, e);
			}
			getTextContentSize() {
				return Math.abs(this.distance);
			}
			removeTextSlice() {
				const { caret: { origin: t, direction: e } } = this, [n, o] = this.getSliceIndices(), r = t.getTextContent();
				return La(t.setTextContent(r.slice(0, n) + r.slice(o)), e, n);
			}
		};
		function Ha(t) {
			return t instanceof Ua;
		}
		function ja(t) {
			return Va(t, Ia(nl(), t.direction));
		}
		function Ja(t) {
			return Va(t, t);
		}
		function Va(e, n) {
			return e.direction !== n.direction && t(265), new $a(e, n, e.direction);
		}
		function qa(t) {
			const { initial: e, hasNext: n, step: o, map: r } = t;
			let i = e;
			return {
				[Symbol.iterator]() {
					return this;
				},
				next() {
					if (!n(i)) return {
						done: !0,
						value: void 0
					};
					const t = {
						done: !1,
						value: r(i)
					};
					return i = o(i), t;
				}
			};
		}
		function Ya(e, n) {
			const o = Za(e.origin, n.origin);
			switch (null === o && t(275, e.origin.getKey(), n.origin.getKey()), o.type) {
				case "same": {
					const t = "text" === e.type, o = "text" === n.type;
					return t && o ? function(t, e) {
						return Math.sign(t - e);
					}(e.offset, n.offset) : e.type === n.type ? 0 : t ? -1 : o ? 1 : "child" === e.type ? -1 : 1;
				}
				case "ancestor": return "child" === e.type ? -1 : 1;
				case "descendant": return "child" === n.type ? 1 : -1;
				case "branch": return Ga(o);
			}
		}
		function Ga(t) {
			const { a: e, b: n } = t, o = e.__key, r = n.__key;
			let i = e, s = n;
			for (; i && s; i = i.getNextSibling(), s = s.getNextSibling()) {
				if (i.__key === r) return -1;
				if (s.__key === o) return 1;
			}
			return null === i ? 1 : -1;
		}
		function Xa(t, e) {
			return e.is(t);
		}
		function Qa(t) {
			return Pi(t) ? [t.getLatest(), null] : [t.getParent(), t.getLatest()];
		}
		function Za(e, n) {
			if (e.is(n)) return {
				commonAncestor: e,
				type: "same"
			};
			const o = /* @__PURE__ */ new Map();
			for (let [t, n] = Qa(e); t; n = t, t = t.getParent()) o.set(t, n);
			for (let [r, i] = Qa(n); r; i = r, r = r.getParent()) {
				const s = o.get(r);
				if (void 0 !== s) return null === s ? (Xa(e, r) || t(276), {
					commonAncestor: r,
					type: "ancestor"
				}) : null === i ? (Xa(n, r) || t(277), {
					commonAncestor: r,
					type: "descendant"
				}) : ((Pi(s) || Xa(e, s)) && (Pi(i) || Xa(n, i)) && r.is(s.getParent()) && r.is(i.getParent()) || t(278), {
					a: s,
					b: i,
					commonAncestor: r,
					type: "branch"
				});
			}
			return null;
		}
		function tu(e, n) {
			const { type: o, key: r, offset: i } = e, s = Ul(e.key);
			return "text" === o ? (Xo(s) || t(266, s.getType(), r), La(s, n, i)) : (Pi(s) || t(267, s.getType(), r), hu(s, e.offset, n));
		}
		function eu(e, n) {
			const { origin: o, direction: r } = n, i = "next" === r;
			wa(n) ? e.set(o.getKey(), n.offset, "text") : Ma(n) ? Xo(o) ? e.set(o.getKey(), Ka(o, r), "text") : e.set(o.getParentOrThrow().getKey(), o.getIndexWithinParent() + (i ? 1 : 0), "element") : (Aa(n) && Pi(o) || t(268), e.set(o.getKey(), i ? 0 : o.getChildrenSize(), "element"));
		}
		function nu(t) {
			const e = Kr(), n = ur(e) ? e : Fr();
			return ou(n, t), ol(n), n;
		}
		function ou(t, e) {
			eu(t.anchor, e.anchor), eu(t.focus, e.focus);
		}
		function ru(t) {
			const { anchor: e, focus: n } = t, o = tu(e, "next"), r = tu(n, "next"), i = Ya(o, r) <= 0 ? "next" : "previous";
			return Va(fu(o, i), fu(r, i));
		}
		function iu(t) {
			const { direction: e, origin: n } = t, o = Ia(n, ka(e)).getNodeAtCaret();
			return o ? Ia(o, e) : Ba(n.getParentOrThrow(), e);
		}
		function su(t, e = "root") {
			const n = [t];
			for (let o = Aa(t) ? t.getParentCaret(e) : t.getSiblingCaret(); null !== o; o = o.getParentCaret(e)) n.push(iu(o));
			return n;
		}
		function lu(t) {
			return !!t && t.origin.isAttached();
		}
		function cu(e, n = "removeEmptySlices") {
			if (e.isCollapsed()) return e;
			const o = "root", r = "next";
			let i = n;
			const s = du(e, r), l = su(s.anchor, o), c = su(s.focus.getFlipped(), o), a = /* @__PURE__ */ new Set(), u = [];
			for (const t of s.iterNodeCarets(o)) if (Aa(t)) a.add(t.origin.getKey());
			else if (Ma(t)) {
				const { origin: e } = t;
				Pi(e) && !a.has(e.getKey()) || u.push(e);
			}
			const f = /* @__PURE__ */ new Set();
			for (const t of u) {
				const e = t.getParent();
				null === e || a.has(e.getKey()) || f.add(e), Hs(t);
			}
			for (const t of f) !t.canBeEmpty() && !Bl(t) && t.isEmpty() && t.isAttached() && t.remove();
			for (const t of s.getTextSlices()) {
				if (!t) continue;
				const { origin: e } = t.caret, n = e.getTextContentSize(), o = iu(Ia(e, r)), s = e.getMode();
				if (Math.abs(t.distance) === n && "removeEmptySlices" === i || "token" === s && 0 !== t.distance) o.remove();
				else if (0 !== t.distance) {
					i = "removeEmptySlices";
					let e = t.removeTextSlice();
					const n = t.caret.origin;
					if ("segmented" === s) {
						const t = e.origin, n = Go(t.getTextContent()).setStyle(t.getStyle()).setFormat(t.getFormat());
						o.replaceOrInsert(n), e = La(n, r, e.offset);
					}
					n.is(l[0].origin) && (l[0] = e), n.is(c[0].origin) && (c[0] = e.getFlipped());
				}
			}
			let d, h;
			for (const t of l) if (lu(t)) {
				d = au(t);
				break;
			}
			for (const t of c) if (lu(t)) {
				h = au(t);
				break;
			}
			const g = function(t, e, n) {
				if (!t || !e) return null;
				const o = t.getParentAtCaret(), r = e.getParentAtCaret();
				if (!o || !r) return null;
				const i = o.getParents().reverse();
				i.push(o);
				const s = r.getParents().reverse();
				s.push(r);
				const l = Math.min(i.length, s.length);
				let c = 0;
				for (; c < l && i[c] === s[c]; c++);
				const a = (t, e) => {
					let n;
					for (let o = c; o < t.length; o++) {
						const r = t[o];
						if (Bl(r)) return;
						!n && e(r) && (n = r);
					}
					return n;
				}, u = a(i, Sc), f = u && a(s, (t) => n.has(t.getKey()) && Sc(t));
				if (f && ia(f).length > 0) return null;
				return u && f ? [u, f] : null;
			}(d, h, a);
			if (g) {
				const [t, e] = g;
				Ba(t, "previous").splice(0, e.getChildren());
				let n = e.getParent();
				for (e.remove(!0); n && n.isEmpty();) {
					const t = n;
					n = n.getParent(), t.remove(!0);
				}
			} else if (h) {
				const t = function(t) {
					if (Aa(t)) {
						const e = t.origin;
						if (Sc(e)) return e;
					} else {
						const e = t.getParentAtCaret();
						if (e && Sc(e)) return e;
					}
					return null;
				}(h), e = t && t.getParent(), n = t && t.getParents().findLast(zl);
				if (t && e && !Bi(e) && t.isEmpty() && a.has(t.getKey()) && 0 === ia(t).length && (!n || a.has(n.getKey()))) {
					t.remove(!0);
					let n = e;
					for (; n && !Bi(n) && n.isEmpty();) {
						const t = n.getParent();
						if (t && Bi(t) && t.getChildrenSize() <= 1) break;
						const e = n;
						n = t, e.remove(!0);
					}
				}
			}
			const _ = [
				d,
				h,
				...l,
				...c
			].find(lu);
			if (_) return Ja(fu(au(_), e.direction));
			t(269, JSON.stringify(l.map((t) => t.origin.__key)));
		}
		function au(t) {
			const e = function(t) {
				let e = t;
				for (; Aa(e);) {
					const t = Wa(e);
					if (!Aa(t)) break;
					e = t;
				}
				return e;
			}(t.getLatest()), { direction: n } = e;
			if (Xo(e.origin)) return wa(e) ? e : La(e.origin, n, n);
			const o = e.getAdjacentCaret();
			return Ma(o) && Xo(o.origin) ? La(o.origin, n, ka(n)) : e;
		}
		function uu(t) {
			return wa(t) && t.offset !== Ka(t.origin, t.direction);
		}
		function fu(t, e) {
			return t.direction === e ? t : t.getFlipped();
		}
		function du(t, e) {
			return t.direction === e ? t : Va(fu(t.focus, e), fu(t.anchor, e));
		}
		function hu(t, e, n) {
			let o = Ba(t, "next");
			for (let t = 0; t < e; t++) {
				const t = o.getAdjacentCaret();
				if (null === t) break;
				o = t;
			}
			return fu(o, n);
		}
		function gu(t, e = "root") {
			let n = 0, o = t, r = Wa(o);
			for (; null === r;) {
				if (n--, r = o.getParentCaret(e), !r) return null;
				o = r, r = Wa(o);
			}
			return r && [r, n];
		}
		function _u(e) {
			const { origin: n, offset: o, direction: r } = e;
			if (o === Ka(n, r)) return e.getSiblingCaret();
			if (o === Ka(n, ka(r))) return iu(e.getSiblingCaret());
			const [i] = n.splitText(o);
			return Xo(i) || t(281), fu(Ia(i, "next"), r);
		}
		function pu(t, e) {
			return !0;
		}
		function yu(t, { $copyElementNode: e = Rl, $splitTextPointCaretNext: n = _u, rootMode: o = "shadowRoot", $shouldSplit: r = pu, removeEmptyDestination: i = !1 } = {}) {
			if (wa(t)) return n(t);
			const s = t.getParentCaret(o);
			if (s) {
				const { origin: n } = s;
				if (Aa(t)) {
					const t = iu(s);
					if (i && n.isEmpty()) return n.remove(), t;
					if (!n.canBeEmpty() || !r(n, "first")) return t;
				}
				const o = function(t) {
					const e = [];
					for (let n = t.getAdjacentCaret(); n; n = n.getAdjacentCaret()) e.push(n.origin);
					return e;
				}(t);
				(o.length > 0 || !i && n.canBeEmpty() && r(n, "last")) && s.insert(e(n).splice(0, 0, o));
			}
			return s;
		}
		function mu(e, n, o) {
			let r = fu(n, "next");
			wa(r) && (0 === r.offset ? r = Ia(r.origin, "previous").getFlipped() : r.offset === r.origin.getTextContentSize() && (r = Ia(r.origin, "next"))), r.origin.is(e) && (Ma(r) || t(342, e.getKey(), e.getType()), r = iu(r)), (e.is(r.getNodeAtCaret()) || e.is(r.getFlipped().getNodeAtCaret())) && e.remove(!0);
			for (let t = r; t; t = yu(t, o)) r = t;
			return wa(r) && t(283), r.insert(e.isInline() ? es().append(e) : e), fu(Ia(e.getLatest(), "next"), n.direction);
		}
		function xu(t) {
			return t;
		}
		function Cu(...t) {
			return t;
		}
		function Su(t, e) {
			return [t, e];
		}
		function vu(t) {
			return t;
		}
		function Tu(t, e) {
			if (!e || t === e) return t;
			for (const n in e) if (t[n] !== e[n]) return {
				...t,
				...e
			};
			return t;
		}
		function ku(...t) {
			const e = [];
			for (const n of t) if (n && "string" == typeof n) for (const [t] of n.matchAll(/\S+/g)) e.push(t);
			return e;
		}
		function bu(t, ...e) {
			const n = ku(...e);
			n.length > 0 && t.classList.add(...n);
		}
		function Nu(t, ...e) {
			const n = ku(...e);
			n.length > 0 && t.classList.remove(...n);
		}
		function Eu(...t) {
			return () => {
				for (let e = t.length - 1; e >= 0; e--) t[e]();
				t.length = 0;
			};
		}
		function wu(t, e, n) {
			return Eu(...Object.entries(e).map(([e, o]) => Fn$2(t, e, o, n)));
		}
		//#endregion
		//#region node_modules/lexical/dist/Lexical.mjs
		const mod$11 = Lexical_prod_exports;
		const $addUpdateTag = mod$11.$addUpdateTag;
		const $applyNodeReplacement = mod$11.$applyNodeReplacement;
		const $assumeActiveEditor = mod$11.$assumeActiveEditor;
		const $caretFromPoint = mod$11.$caretFromPoint;
		const $caretRangeFromSelection = mod$11.$caretRangeFromSelection;
		const $cloneWithProperties$1 = mod$11.$cloneWithProperties;
		const $cloneWithPropertiesEphemeral = mod$11.$cloneWithPropertiesEphemeral;
		const $comparePointCaretNext = mod$11.$comparePointCaretNext;
		const $copyNode = mod$11.$copyNode;
		const $create = mod$11.$create;
		mod$11.$createChildrenArray;
		const $createLineBreakNode = mod$11.$createLineBreakNode;
		const $createNodeSelection = mod$11.$createNodeSelection;
		const $createParagraphNode = mod$11.$createParagraphNode;
		const $createPoint = mod$11.$createPoint;
		const $createRangeSelection = mod$11.$createRangeSelection;
		const $createRangeSelectionFromDom = mod$11.$createRangeSelectionFromDom;
		const $createTabNode = mod$11.$createTabNode;
		const $createTextNode = mod$11.$createTextNode;
		const $extendCaretToRange = mod$11.$extendCaretToRange;
		const $findMatchingParent$1 = mod$11.$findMatchingParent;
		const $formatText = mod$11.$formatText;
		const $fullReconcile = mod$11.$fullReconcile;
		const $generateNodesFromRawText = mod$11.$generateNodesFromRawText;
		const $getAdjacentChildCaret = mod$11.$getAdjacentChildCaret;
		mod$11.$getAdjacentNode;
		const $getAdjacentSiblingOrParentSiblingCaret$1 = mod$11.$getAdjacentSiblingOrParentSiblingCaret;
		const $getCaretInDirection = mod$11.$getCaretInDirection;
		const $getCaretRange = mod$11.$getCaretRange;
		const $getCaretRangeInDirection = mod$11.$getCaretRangeInDirection;
		const $getCharacterOffsets = mod$11.$getCharacterOffsets;
		const $getChildCaret = mod$11.$getChildCaret;
		const $getChildCaretAtIndex = mod$11.$getChildCaretAtIndex;
		const $getChildCaretOrSelf = mod$11.$getChildCaretOrSelf;
		const $getCollapsedCaretRange = mod$11.$getCollapsedCaretRange;
		mod$11.$getCommonAncestor;
		mod$11.$getCommonAncestorResultBranchOrder;
		const $getDOMSlot = mod$11.$getDOMSlot;
		const $getDOMTextNode = mod$11.$getDOMTextNode;
		const $getDocument = mod$11.$getDocument;
		const $getEditor = mod$11.$getEditor;
		const $getEditorDOMRenderConfig = mod$11.$getEditorDOMRenderConfig;
		const $getNearestNodeFromDOMNode = mod$11.$getNearestNodeFromDOMNode;
		mod$11.$getNearestRootOrShadowRoot;
		const $getNodeByKey = mod$11.$getNodeByKey;
		const $getNodeByKeyOrThrow = mod$11.$getNodeByKeyOrThrow;
		const $getNodeFromDOMNode = mod$11.$getNodeFromDOMNode;
		const $getPreviousSelection = mod$11.$getPreviousSelection;
		const $getRoot = mod$11.$getRoot;
		const $getSelection = mod$11.$getSelection;
		const $getSiblingCaret = mod$11.$getSiblingCaret;
		const $getSlot = mod$11.$getSlot;
		const $getSlotFrame = mod$11.$getSlotFrame;
		const $getSlotHost = mod$11.$getSlotHost;
		mod$11.$getSlotNameWithinHost;
		const $getSlotNames = mod$11.$getSlotNames;
		const $getState = mod$11.$getState;
		mod$11.$getStateChange;
		mod$11.$getTextContent;
		mod$11.$getTextNodeOffset;
		const $getTextPointCaret = mod$11.$getTextPointCaret;
		mod$11.$getTextPointCaretSlice;
		mod$11.$getWritableNodeState;
		const $hasAncestor = mod$11.$hasAncestor;
		mod$11.$hasUpdateTag;
		const $insertNodeToNearestRootAtCaret$1 = mod$11.$insertNodeToNearestRootAtCaret;
		const $insertNodes = mod$11.$insertNodes;
		const $isBlockElementNode = mod$11.$isBlockElementNode;
		const $isChildCaret = mod$11.$isChildCaret;
		const $isDecoratorNode = mod$11.$isDecoratorNode;
		const $isEditorState = mod$11.$isEditorState;
		mod$11.$isElementDOMSlot;
		const $isElementNode = mod$11.$isElementNode;
		const $isExtendableTextPointCaret = mod$11.$isExtendableTextPointCaret;
		const $isInlineElementOrDecoratorNode = mod$11.$isInlineElementOrDecoratorNode;
		mod$11.$isInlineFormattable;
		const $isLeafNode = mod$11.$isLeafNode;
		const $isLexicalNode = mod$11.$isLexicalNode;
		const $isLineBreakNode = mod$11.$isLineBreakNode;
		mod$11.$isNodeCaret;
		const $isNodeSelection = mod$11.$isNodeSelection;
		const $isParagraphNode = mod$11.$isParagraphNode;
		const $isRangeSelection = mod$11.$isRangeSelection;
		const $isRootNode = mod$11.$isRootNode;
		const $isRootOrShadowRoot = mod$11.$isRootOrShadowRoot;
		const $isSelectionCapturedInDecoratorInput = mod$11.$isSelectionCapturedInDecoratorInput;
		const $isShadowRootNode = mod$11.$isShadowRootNode;
		const $isSiblingCaret = mod$11.$isSiblingCaret;
		mod$11.$isSlotChild;
		const $isSlotHost = mod$11.$isSlotHost;
		const $isTabNode = mod$11.$isTabNode;
		const $isTextNode = mod$11.$isTextNode;
		const $isTextPointCaret = mod$11.$isTextPointCaret;
		mod$11.$isTextPointCaretSlice;
		const $isTokenOrSegmented = mod$11.$isTokenOrSegmented;
		mod$11.$isTokenOrTab;
		mod$11.$markSlotEditable;
		const $needsBlockCursorBeside = mod$11.$needsBlockCursorBeside;
		mod$11.$nodesOfType;
		const $normalizeCaret = mod$11.$normalizeCaret;
		const $normalizeSelection__EXPERIMENTAL = mod$11.$normalizeSelection__EXPERIMENTAL;
		mod$11.$onUpdate;
		const $parseSerializedNode = mod$11.$parseSerializedNode;
		mod$11.$removeFromParent;
		mod$11.$removeSlot;
		const $removeTextFromCaretRange = mod$11.$removeTextFromCaretRange;
		const $rewindSiblingCaret = mod$11.$rewindSiblingCaret;
		const $selectAll$1 = mod$11.$selectAll;
		mod$11.$setCompositionKey;
		const $setDirectionFromDOM = mod$11.$setDirectionFromDOM;
		const $setFormatFromDOM = mod$11.$setFormatFromDOM;
		const $setPointFromCaret = mod$11.$setPointFromCaret;
		const $setSelection = mod$11.$setSelection;
		const $setSelectionFromCaretRange = mod$11.$setSelectionFromCaretRange;
		mod$11.$setSlot;
		const $setState = mod$11.$setState;
		const $setTextFormat = mod$11.$setTextFormat;
		const $splitAtPointCaretNext = mod$11.$splitAtPointCaretNext;
		const $splitNode$1 = mod$11.$splitNode;
		const $updateDOMSelection = mod$11.$updateDOMSelection;
		mod$11.$updateRangeSelectionFromCaretRange;
		const ArtificialNode__DO_NOT_USE = mod$11.ArtificialNode__DO_NOT_USE;
		mod$11.BEFORE_INPUT_COMMAND;
		mod$11.BLUR_COMMAND;
		const CAN_REDO_COMMAND = mod$11.CAN_REDO_COMMAND;
		const CAN_UNDO_COMMAND = mod$11.CAN_UNDO_COMMAND;
		const CAN_USE_BEFORE_INPUT$1 = mod$11.CAN_USE_BEFORE_INPUT;
		const CAN_USE_DOM$1 = mod$11.CAN_USE_DOM;
		const CLEAR_EDITOR_COMMAND = mod$11.CLEAR_EDITOR_COMMAND;
		const CLEAR_HISTORY_COMMAND = mod$11.CLEAR_HISTORY_COMMAND;
		const CLICK_COMMAND = mod$11.CLICK_COMMAND;
		mod$11.COLLABORATION_TAG;
		const COMMAND_PRIORITY_BEFORE_CRITICAL = mod$11.COMMAND_PRIORITY_BEFORE_CRITICAL;
		const COMMAND_PRIORITY_BEFORE_EDITOR = mod$11.COMMAND_PRIORITY_BEFORE_EDITOR;
		mod$11.COMMAND_PRIORITY_BEFORE_HIGH;
		mod$11.COMMAND_PRIORITY_BEFORE_LOW;
		mod$11.COMMAND_PRIORITY_BEFORE_NORMAL;
		const COMMAND_PRIORITY_CRITICAL = mod$11.COMMAND_PRIORITY_CRITICAL;
		const COMMAND_PRIORITY_EDITOR = mod$11.COMMAND_PRIORITY_EDITOR;
		const COMMAND_PRIORITY_HIGH = mod$11.COMMAND_PRIORITY_HIGH;
		const COMMAND_PRIORITY_LOW = mod$11.COMMAND_PRIORITY_LOW;
		mod$11.COMMAND_PRIORITY_NORMAL;
		mod$11.COMPOSITION_END_COMMAND;
		const COMPOSITION_END_TAG = mod$11.COMPOSITION_END_TAG;
		const COMPOSITION_START_COMMAND = mod$11.COMPOSITION_START_COMMAND;
		const COMPOSITION_START_TAG = mod$11.COMPOSITION_START_TAG;
		const CONTROLLED_TEXT_INSERTION_COMMAND = mod$11.CONTROLLED_TEXT_INSERTION_COMMAND;
		const COPY_COMMAND = mod$11.COPY_COMMAND;
		const CUT_COMMAND = mod$11.CUT_COMMAND;
		const CUT_TAG = mod$11.CUT_TAG;
		const DEFAULT_EDITOR_DOM_CONFIG = mod$11.DEFAULT_EDITOR_DOM_CONFIG;
		const DELETE_CHARACTER_COMMAND = mod$11.DELETE_CHARACTER_COMMAND;
		const DELETE_LINE_COMMAND = mod$11.DELETE_LINE_COMMAND;
		const DELETE_WORD_COMMAND = mod$11.DELETE_WORD_COMMAND;
		mod$11.DRAGEND_COMMAND;
		const DRAGOVER_COMMAND = mod$11.DRAGOVER_COMMAND;
		const DRAGSTART_COMMAND = mod$11.DRAGSTART_COMMAND;
		const DROP_COMMAND = mod$11.DROP_COMMAND;
		const DecoratorNode = mod$11.DecoratorNode;
		const ElementNode = mod$11.ElementNode;
		const FOCUS_COMMAND = mod$11.FOCUS_COMMAND;
		const FORMAT_ELEMENT_COMMAND = mod$11.FORMAT_ELEMENT_COMMAND;
		const FORMAT_TEXT_COMMAND = mod$11.FORMAT_TEXT_COMMAND;
		const HISTORIC_TAG = mod$11.HISTORIC_TAG;
		const HISTORY_MERGE_TAG = mod$11.HISTORY_MERGE_TAG;
		const HISTORY_PUSH_TAG = mod$11.HISTORY_PUSH_TAG;
		const INDENT_CONTENT_COMMAND = mod$11.INDENT_CONTENT_COMMAND;
		mod$11.INPUT_COMMAND;
		const INSERT_LINE_BREAK_COMMAND = mod$11.INSERT_LINE_BREAK_COMMAND;
		const INSERT_PARAGRAPH_COMMAND = mod$11.INSERT_PARAGRAPH_COMMAND;
		const INSERT_TAB_COMMAND = mod$11.INSERT_TAB_COMMAND;
		const INTERNAL_$isBlock = mod$11.INTERNAL_$isBlock;
		mod$11.IS_ALL_FORMATTING;
		const IS_ANDROID$1 = mod$11.IS_ANDROID;
		const IS_ANDROID_CHROME$1 = mod$11.IS_ANDROID_CHROME;
		const IS_APPLE$1 = mod$11.IS_APPLE;
		const IS_APPLE_WEBKIT$1 = mod$11.IS_APPLE_WEBKIT;
		const IS_BOLD = mod$11.IS_BOLD;
		const IS_CHROME$1 = mod$11.IS_CHROME;
		const IS_CODE = mod$11.IS_CODE;
		const IS_FIREFOX$1 = mod$11.IS_FIREFOX;
		const IS_HIGHLIGHT = mod$11.IS_HIGHLIGHT;
		const IS_IOS$1 = mod$11.IS_IOS;
		const IS_ITALIC = mod$11.IS_ITALIC;
		const IS_SAFARI$1 = mod$11.IS_SAFARI;
		const IS_STRIKETHROUGH = mod$11.IS_STRIKETHROUGH;
		const IS_SUBSCRIPT = mod$11.IS_SUBSCRIPT;
		const IS_SUPERSCRIPT = mod$11.IS_SUPERSCRIPT;
		const IS_UNDERLINE = mod$11.IS_UNDERLINE;
		const KEY_ARROW_DOWN_COMMAND = mod$11.KEY_ARROW_DOWN_COMMAND;
		const KEY_ARROW_LEFT_COMMAND = mod$11.KEY_ARROW_LEFT_COMMAND;
		const KEY_ARROW_RIGHT_COMMAND = mod$11.KEY_ARROW_RIGHT_COMMAND;
		const KEY_ARROW_UP_COMMAND = mod$11.KEY_ARROW_UP_COMMAND;
		const KEY_BACKSPACE_COMMAND = mod$11.KEY_BACKSPACE_COMMAND;
		const KEY_DELETE_COMMAND = mod$11.KEY_DELETE_COMMAND;
		mod$11.KEY_DOWN_COMMAND;
		const KEY_ENTER_COMMAND = mod$11.KEY_ENTER_COMMAND;
		const KEY_ESCAPE_COMMAND = mod$11.KEY_ESCAPE_COMMAND;
		mod$11.KEY_MODIFIER_COMMAND;
		const KEY_SPACE_COMMAND = mod$11.KEY_SPACE_COMMAND;
		const KEY_TAB_COMMAND = mod$11.KEY_TAB_COMMAND;
		const LineBreakNode = mod$11.LineBreakNode;
		const MOVE_TO_END = mod$11.MOVE_TO_END;
		const MOVE_TO_START = mod$11.MOVE_TO_START;
		mod$11.NODE_STATE_DIRECT;
		mod$11.NODE_STATE_KEY;
		mod$11.NODE_STATE_LATEST;
		const OUTDENT_CONTENT_COMMAND = mod$11.OUTDENT_CONTENT_COMMAND;
		const PASTE_COMMAND = mod$11.PASTE_COMMAND;
		const PASTE_TAG = mod$11.PASTE_TAG;
		const ParagraphNode = mod$11.ParagraphNode;
		const REDO_COMMAND = mod$11.REDO_COMMAND;
		const REMOVE_TEXT_COMMAND = mod$11.REMOVE_TEXT_COMMAND;
		const RootNode = mod$11.RootNode;
		const SELECTION_CHANGE_COMMAND = mod$11.SELECTION_CHANGE_COMMAND;
		const SELECTION_INSERT_CLIPBOARD_NODES_COMMAND = mod$11.SELECTION_INSERT_CLIPBOARD_NODES_COMMAND;
		const SELECT_ALL_COMMAND = mod$11.SELECT_ALL_COMMAND;
		const SET_TEXT_FORMAT_COMMAND = mod$11.SET_TEXT_FORMAT_COMMAND;
		mod$11.SKIP_COLLAB_TAG;
		const SKIP_DOM_SELECTION_TAG = mod$11.SKIP_DOM_SELECTION_TAG;
		const SKIP_SCROLL_INTO_VIEW_TAG = mod$11.SKIP_SCROLL_INTO_VIEW_TAG;
		const SKIP_SELECTION_FOCUS_TAG = mod$11.SKIP_SELECTION_FOCUS_TAG;
		const TEXT_TYPE_TO_FORMAT = mod$11.TEXT_TYPE_TO_FORMAT;
		const TabNode = mod$11.TabNode;
		const TextNode = mod$11.TextNode;
		const UNDO_COMMAND = mod$11.UNDO_COMMAND;
		const addClassNamesToElement$1 = mod$11.addClassNamesToElement;
		const buildImportMap = mod$11.buildImportMap;
		const configExtension$1 = mod$11.configExtension;
		const createCommand = mod$11.createCommand;
		const createEditor = mod$11.createEditor;
		mod$11.createRefCountedRegistry;
		mod$11.createSharedNodeState;
		const createState = mod$11.createState;
		const declarePeerDependency$1 = mod$11.declarePeerDependency;
		const defineExtension$1 = mod$11.defineExtension;
		const findAllLexicalElementsDeep = mod$11.findAllLexicalElementsDeep;
		const flipDirection = mod$11.flipDirection;
		const getActiveElement = mod$11.getActiveElement;
		const getActiveElementDeep = mod$11.getActiveElementDeep;
		const getComposedEventTarget = mod$11.getComposedEventTarget;
		mod$11.getComposedStaticRange;
		mod$11.getDOMOwnerDocument;
		const getDOMSelection = mod$11.getDOMSelection;
		mod$11.getDOMSelectionFromTarget;
		const getDOMSelectionPoints = mod$11.getDOMSelectionPoints;
		const getDOMSelectionRange = mod$11.getDOMSelectionRange;
		mod$11.getDOMSelectionRangeAndPoints;
		const getDOMShadowRoots = mod$11.getDOMShadowRoots;
		const getDOMTextNode = mod$11.getDOMTextNode;
		mod$11.getDeclaredSlots;
		const getEditorPropertyFromDOMNode = mod$11.getEditorPropertyFromDOMNode;
		const getNearestEditorFromDOMNode = mod$11.getNearestEditorFromDOMNode;
		const getParentElement = mod$11.getParentElement;
		mod$11.getRegisteredNode;
		mod$11.getRegisteredNodeOrThrow;
		const getRegisteredSubtypeMap = mod$11.getRegisteredSubtypeMap;
		const getRootOwnerDocument = mod$11.getRootOwnerDocument;
		const getStaticNodeConfig = mod$11.getStaticNodeConfig;
		const getStyleObjectFromCSS$1 = mod$11.getStyleObjectFromCSS;
		mod$11.getTextDirection;
		mod$11.getTransformSetFromKlass;
		const isBlockDomNode$1 = mod$11.isBlockDomNode;
		const isCurrentlyReadOnlyMode = mod$11.isCurrentlyReadOnlyMode;
		mod$11.isDOMCapturingSelection;
		const isDOMDocumentNode = mod$11.isDOMDocumentNode;
		const isDOMNode = mod$11.isDOMNode;
		const isDOMShadowRoot = mod$11.isDOMShadowRoot;
		const isDOMTextNode = mod$11.isDOMTextNode;
		mod$11.isDOMUnmanaged;
		const isDocumentFragment = mod$11.isDocumentFragment;
		const isExactShortcutMatch = mod$11.isExactShortcutMatch;
		const isHTMLAnchorElement$1 = mod$11.isHTMLAnchorElement;
		const isHTMLElement$1 = mod$11.isHTMLElement;
		mod$11.isHTMLTableCellElement;
		const isHTMLTableRowElement = mod$11.isHTMLTableRowElement;
		const isInlineDomNode$1 = mod$11.isInlineDomNode;
		const isLastChildInBlockNode = mod$11.isLastChildInBlockNode;
		const isLexicalEditor = mod$11.isLexicalEditor;
		mod$11.isModifierMatch;
		const isOnlyChildInBlockNode = mod$11.isOnlyChildInBlockNode;
		mod$11.isSelectionCapturedInDecoratorInput;
		const isSelectionWithinEditor = mod$11.isSelectionWithinEditor;
		const iterStaticNodeConfigChain = mod$11.iterStaticNodeConfigChain;
		const makeStepwiseIterator = mod$11.makeStepwiseIterator;
		const mergeRegister$1 = mod$11.mergeRegister;
		mod$11.mountSlotContainer;
		const normalizeClassNames = mod$11.normalizeClassNames;
		const registerEventListener = mod$11.registerEventListener;
		const registerEventListeners = mod$11.registerEventListeners;
		const removeClassNamesFromElement$1 = mod$11.removeClassNamesFromElement;
		mod$11.removeFromParent;
		mod$11.resetRandomKey;
		const safeCast$1 = mod$11.safeCast;
		const setDOMStyleFromCSS = mod$11.setDOMStyleFromCSS;
		mod$11.setDOMStyleObject;
		const setDOMUnmanaged = mod$11.setDOMUnmanaged;
		const setNodeIndentFromDOM = mod$11.setNodeIndentFromDOM;
		const shallowMergeConfig$1 = mod$11.shallowMergeConfig;
		const stopLexicalPropagation = mod$11.stopLexicalPropagation;
		const toggleTextFormatType = mod$11.toggleTextFormatType;
		const tokenizeRawText = mod$11.tokenizeRawText;
		mod$11.unmountSlotContainer;
		//#endregion
		//#region node_modules/@lexical/selection/dist/LexicalSelection.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalSelection_prod_exports = /* @__PURE__ */ __exportAll({
			$addNodeStyle: () => D$1,
			$cloneWithProperties: () => $cloneWithProperties$1,
			$copyBlockFormatIndent: () => W,
			$ensureForwardRangeSelection: () => V$1,
			$forEachSelectedTextNode: () => H$2,
			$getComputedStyleForElement: () => R,
			$getComputedStyleForParent: () => O$1,
			$getSelectionStyleValueForProperty: () => ie$3,
			$isAtEdgeOfElement: () => X$1,
			$isAtNodeEnd: () => M$1,
			$isParentElementRTL: () => oe$3,
			$isParentRTL: () => _,
			$moveCaretSelection: () => ne$3,
			$moveCharacter: () => le$2,
			$patchStyleText: () => j$1,
			$selectAll: () => $selectAll$1,
			$setBlocksType: () => q$1,
			$shouldOverrideDefaultCharacterSelection: () => te$4,
			$sliceSelectedTextNodeContent: () => L,
			$trimTextContentFromAnchor: () => $,
			$wrapNodes: () => Q$1,
			createDOMRange: () => b$1,
			createRectsFromDOMRange: () => z$1,
			getCSSFromStyleObject: () => A,
			getStyleObjectFromCSS: () => se$3,
			trimTextContentFromAnchor: () => ce$2
		});
		function B(e, ...t) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", e);
			for (const e of t) o.append("v", e);
			throw n.search = o.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		function k(e) {
			let t = e;
			for (; null != t;) {
				if (t.nodeType === Node.TEXT_NODE) return t;
				t = t.firstChild;
			}
			return null;
		}
		function F(e) {
			const t = e.parentNode;
			if (null == t) throw new Error("Should never happen");
			return [t, Array.from(t.childNodes).indexOf(e)];
		}
		function b$1(n, o, l, r, i) {
			const s = o.getKey(), c = r.getKey(), f = getRootOwnerDocument(n.getRootElement()).createRange();
			let u = n.getElementByKey(s), g = n.getElementByKey(c), a = l, d = i;
			if ($isTextNode(o) && (u = k(u)), $isTextNode(r) && (g = k(g)), void 0 === o || void 0 === r || null === u || null === g) return null;
			"BR" === u.nodeName && ([u, a] = F(u)), "BR" === g.nodeName && ([g, d] = F(g));
			const p = u.firstChild;
			u === g && null != p && "BR" === p.nodeName && 0 === a && 0 === d && (d = 1);
			try {
				f.setStart(u, a), f.setEnd(g, d);
			} catch (e) {
				return null;
			}
			return !f.collapsed || a === d && s === c || (f.setStart(g, d), f.setEnd(u, a)), f;
		}
		function z$1(e, t) {
			const n = e.getRootElement();
			if (null === n) return [];
			const o = n.getBoundingClientRect(), l = getComputedStyle(n), r = parseFloat(l.paddingLeft) + parseFloat(l.paddingRight), i = Array.from(t.getClientRects());
			let s, c = i.length;
			i.sort((e, t) => {
				const n = e.top - t.top;
				return Math.abs(n) <= 3 ? e.left - t.left : n;
			});
			for (let e = 0; e < c; e++) {
				const t = i[e], n = s && s.top <= t.top && s.top + s.height > t.top && s.left + s.width > t.left, l = t.width + r === o.width;
				n || l ? (i.splice(e--, 1), c--) : s = t;
			}
			return i;
		}
		function A(e) {
			let t = "";
			for (const n in e) n && (t += `${n}: ${e[n]};`);
			return t;
		}
		function R(e) {
			const t = $getEditor().getElementByKey(e.getKey());
			if (null === t) return null;
			const o = t.ownerDocument.defaultView;
			return null === o ? null : o.getComputedStyle(t);
		}
		function O$1(e) {
			return R($isRootNode(e) ? e : e.getParentOrThrow());
		}
		function _(e) {
			const t = O$1(e);
			return null !== t && "rtl" === t.direction;
		}
		function L(e, t, n = "self") {
			const o = e.getStartEndPoints();
			if (t.isSelected(e) && !$isTokenOrSegmented(t) && null !== o) {
				const [l, r] = o, i = e.isBackward(), s = l.getNode(), c = r.getNode(), g = t.is(s), a = t.is(c);
				if (g || a) {
					const [o, l] = $getCharacterOffsets(e), r = s.is(c), g = t.is(i ? c : s), a = t.is(i ? s : c);
					let d, p = 0;
					if (r) p = o > l ? l : o, d = o > l ? o : l;
					else if (g) p = i ? l : o, d = void 0;
					else if (a) p = 0, d = i ? o : l;
					const h = t.__text.slice(p, d);
					h !== t.__text && ("clone" === n && (t = $cloneWithPropertiesEphemeral(t)), t.__text = h);
				}
			}
			return t;
		}
		function M$1(e) {
			if ("text" === e.type) return e.offset === e.getNode().getTextContentSize();
			const t = e.getNode();
			return $isElementNode(t) || B(177), e.offset === t.getChildrenSize();
		}
		function $(e, n, l) {
			let i = n.getNode(), s = l;
			if ($isElementNode(i)) {
				const e = i.getDescendantByIndex(n.offset);
				null !== e && (i = e);
			}
			for (; s > 0 && null !== i;) {
				if ($isElementNode(i)) {
					const e = i.getLastDescendant();
					null !== e && (i = e);
				}
				let l = i.getPreviousSibling(), f = 0;
				if (null === l) {
					let e = i.getParentOrThrow(), t = e.getPreviousSibling();
					for (; null === t;) {
						if (e = e.getParent(), null === e) {
							l = null;
							break;
						}
						t = e.getPreviousSibling();
					}
					null !== e && (f = e.isInline() ? 0 : 2, l = t);
				}
				let u = i.getTextContent();
				"" === u && $isElementNode(i) && !i.isInline() && (u = "\n\n");
				const p = u.length;
				if (!$isTextNode(i) || s >= p) {
					const e = i.getParent();
					i.remove(), null == e || 0 !== e.getChildrenSize() || $isRootNode(e) || e.remove(), s -= p + f, i = l;
				} else {
					const o = i.getKey(), l = e.read("latest", () => {
						const e = $getNodeByKey(o);
						return $isTextNode(e) && e.isSimpleText() ? e.getTextContent() : null;
					}), c = p - s, f = u.slice(0, c);
					if (null !== l && l !== u) {
						const e = $getPreviousSelection();
						let t = i;
						if (i.isSimpleText()) i.setTextContent(l);
						else {
							const e = $createTextNode(l);
							i.replace(e), t = e;
						}
						if ($isRangeSelection(e) && e.isCollapsed()) {
							const n = e.anchor.offset;
							t.select(n, n);
						}
					} else if (i.isSimpleText()) {
						const e = n.key === o;
						let t = n.offset;
						t < s && (t = p);
						const l = e ? t - s : 0, r = e ? t : c;
						if (e && 0 === l) {
							const [e] = i.splitText(l, r);
							e.remove();
						} else {
							const [, e] = i.splitText(l, r);
							e.remove();
						}
					} else {
						const e = $createTextNode(f);
						i.replace(e);
					}
					s = 0;
				}
			}
		}
		const D$1 = () => {};
		function U(e, n) {
			($isRangeSelection(e) ? e.isCollapsed() : $isTextNode(e) || $isElementNode(e)) || B(280);
			const o = getStyleObjectFromCSS$1($isRangeSelection(e) ? e.style : $isTextNode(e) ? e.getStyle() : e.getTextStyle()), l = A(Object.entries(n).reduce((t, [n, l]) => ("function" == typeof l ? t[n] = l(o[n], e) : null === l ? delete t[n] : t[n] = l, t), { ...o }));
			$isRangeSelection(e) || $isTextNode(e) ? e.setStyle(l) : e.setTextStyle(l);
		}
		function j$1(e, t) {
			if ($isRangeSelection(e) && e.isCollapsed()) {
				U(e, t);
				const n = e.anchor.getNode();
				$isElementNode(n) && n.isEmpty() && U(n, t);
			}
			H$2((e) => {
				U(e, t);
			});
			const n = e.getNodes();
			if (n.length > 0) {
				const e = /* @__PURE__ */ new Set();
				for (const o of n) {
					if (!$isElementNode(o) || !o.canBeEmpty() || 0 !== o.getChildrenSize()) continue;
					const n = o.getKey();
					e.has(n) || (e.add(n), U(o, t));
				}
			}
		}
		function H$2(e) {
			const n = $getSelection();
			if (!n) return;
			const o = /* @__PURE__ */ new Map(), c = (e) => o.get(e.getKey()) || [0, e.getTextContentSize()];
			if ($isRangeSelection(n)) for (const e of $caretRangeFromSelection(n).getTextSlices()) e && o.set(e.caret.origin.getKey(), e.getSliceIndices());
			const f = n.getNodes();
			for (const n of f) {
				if (!$isTextNode(n) || !n.canHaveFormat()) continue;
				const [o, l] = c(n);
				if (l !== o) if ($isTokenOrSegmented(n) || 0 === o && l === n.getTextContentSize()) e(n);
				else e(n.splitText(o, l)[0 === o ? 0 : 1]);
			}
			$isRangeSelection(n) && "text" === n.anchor.type && "text" === n.focus.type && n.anchor.key === n.focus.key && V$1(n);
		}
		function V$1(e) {
			if (e.isBackward()) {
				const { anchor: t, focus: n } = e, { key: o, offset: l, type: r } = t;
				t.set(n.key, n.offset, n.type), n.set(o, l, r);
			}
		}
		function W(e, t) {
			const n = e.getFormatType(), o = e.getIndent();
			n !== t.getFormatType() && t.setFormat(n), o !== t.getIndent() && t.setIndent(o);
		}
		function X$1(e, t, n) {
			let o = $caretFromPoint(e, n);
			if ($isExtendableTextPointCaret(o)) return !1;
			for (; o; o = o.getParentCaret()) {
				const e = o.getParentAtCaret();
				if (!e || o.getNodeAtCaret()) return !1;
				if (t.is(e)) return !0;
			}
			return !1;
		}
		function q$1(e, t, n = W) {
			if (!e) return;
			const o = e.getStartEndPoints();
			let l = !1, r = null;
			const i = /* @__PURE__ */ new Map();
			if (o) {
				const [t, n] = o, s = $findMatchingParent$1(t.getNode(), INTERNAL_$isBlock);
				r = $findMatchingParent$1(n.getNode(), INTERNAL_$isBlock);
				const f = e.isBackward() ? "previous" : "next";
				l = $isElementNode(r) && !r.is(s) && function(e, t, n) {
					const o = e.getNode();
					return (!$isElementNode(o) || !o.isEmpty()) && X$1(e, t, n);
				}(n, r, flipDirection(f)), $isElementNode(s) && i.set(s.getKey(), s), $isElementNode(r) && !l && i.set(r.getKey(), r);
			}
			for (const t of e.getNodes()) if ($isElementNode(t) && INTERNAL_$isBlock(t)) {
				if (l && t.is(r)) continue;
				i.set(t.getKey(), t);
			} else if (!o) {
				const e = $findMatchingParent$1(t, INTERNAL_$isBlock);
				$isElementNode(e) && i.set(e.getKey(), e);
			}
			for (const e of i.values()) {
				const o = t();
				n(e, o), e.replace(o, !0);
			}
		}
		function G$1(e) {
			return e.getNode().isAttached();
		}
		function J(e) {
			let t = e;
			for (; null !== t && !$isRootOrShadowRoot(t);) {
				const e = t.getLatest(), n = t.getParent();
				0 === e.getChildrenSize() && t.remove(!0), t = n;
			}
		}
		function Q$1(e, t, n = null) {
			const o = e.getStartEndPoints(), l = o ? o[0] : null, r = e.getNodes(), i = r.length;
			if (null !== l && (0 === i || 1 === i && "element" === l.type && 0 === l.getNode().getChildrenSize())) {
				const e = "text" === l.type ? l.getNode().getParentOrThrow() : l.getNode(), o = e.getChildren();
				let r = t();
				r.setFormat(e.getFormatType()), r.setIndent(e.getIndent()), o.forEach((e) => r.append(e)), n && (r = n.append(r)), e.replace(r);
				return;
			}
			let s = null, c = [];
			for (let o = 0; o < i; o++) {
				const l = r[o];
				$isRootOrShadowRoot(l) ? (Y$1(e, c, c.length, t, n), c = [], s = l) : null === s || null !== s && $hasAncestor(l, s) ? c.push(l) : (Y$1(e, c, c.length, t, n), c = [l]);
			}
			Y$1(e, c, c.length, t, n);
		}
		function Y$1(e, t, n, o, l = null) {
			if (0 === t.length) return;
			const i = t[0], s = /* @__PURE__ */ new Map(), f = [], u = $isElementNode(i) ? i : i.getParentOrThrow();
			let g = u.isInline() ? u.getParentOrThrow() : u, d = !1;
			for (; null !== g;) {
				const e = g.getPreviousSibling();
				if (null !== e) {
					g = e, d = !0;
					break;
				}
				if (g = g.getParentOrThrow(), $isRootOrShadowRoot(g)) break;
			}
			const p = /* @__PURE__ */ new Set();
			for (let e = 0; e < n; e++) {
				const n = t[e];
				$isElementNode(n) && 0 === n.getChildrenSize() && p.add(n.getKey());
			}
			const h = /* @__PURE__ */ new Set();
			for (let e = 0; e < n; e++) {
				const n = t[e];
				let l = n.getParent();
				if (null !== l && l.isInline() && (l = l.getParent()), null !== l && $isLeafNode(n) && !h.has(n.getKey())) {
					const e = l.getKey();
					if (void 0 === s.get(e)) {
						const t = o();
						t.setFormat(l.getFormatType()), t.setIndent(l.getIndent()), f.push(t), s.set(e, t);
						const n = l.getChildren();
						t.splice(t.getChildrenSize(), 0, n);
						for (const e of n) if (h.add(e.getKey()), $isElementNode(e)) for (const t of e.getChildrenKeys()) h.add(t);
						J(l);
					}
				} else if (p.has(n.getKey())) {
					$isElementNode(n) || B(179);
					const e = o();
					e.setFormat(n.getFormatType()), e.setIndent(n.getIndent()), f.push(e), n.remove(!0);
				}
			}
			if (null !== l) for (let e = 0; e < f.length; e++) {
				const t = f[e];
				l.append(t);
			}
			let y = null;
			if ($isRootOrShadowRoot(g)) if (d) if (null !== l) g.insertAfter(l);
			else for (let e = f.length - 1; e >= 0; e--) {
				const t = f[e];
				g.insertAfter(t);
			}
			else {
				const e = g, t = e.getFirstChild();
				if ($isElementNode(t) && (g = t), null === t) if (l) e.append(l);
				else for (let t = 0; t < f.length; t++) {
					const n = f[t];
					e.append(n), y = n;
				}
				else if (null !== l) t.insertBefore(l);
				else for (let e = 0; e < f.length; e++) {
					const n = f[e];
					t.insertBefore(n), y = n;
				}
			}
			else if (l) g.insertAfter(l);
			else for (let e = f.length - 1; e >= 0; e--) {
				const t = f[e];
				g.insertAfter(t), y = t;
			}
			const m = $getPreviousSelection();
			$isRangeSelection(m) && G$1(m.anchor) && G$1(m.focus) ? $setSelection(m.clone()) : null !== y ? y.selectEnd() : e.dirty = !0;
		}
		function Z$2(e) {
			const t = ee$4(e);
			return null !== t && "vertical-rl" === t.writingMode;
		}
		function ee$4(e) {
			const t = e.anchor.getNode();
			return $isElementNode(t) ? R(t) : O$1(t);
		}
		function te$4(e, n) {
			let o = Z$2(e) ? !n : n;
			oe$3(e) && (o = !o);
			const l = $caretFromPoint(e.focus, o ? "previous" : "next");
			if ($isExtendableTextPointCaret(l)) return !1;
			if ($isTextPointCaret(l) && !$isTabNode(l.origin) && l.origin.isUnmergeable()) {
				const e = l.getNodeAtCaret();
				if ($isTextNode(e) && !$isTabNode(e)) return !0;
			}
			for (const e of $extendCaretToRange(l)) {
				if ($isChildCaret(e)) return !e.origin.isInline();
				if (!$isElementNode(e.origin)) {
					if ($isDecoratorNode(e.origin)) return !0;
					break;
				}
			}
			return !1;
		}
		function ne$3(e, t, n, o) {
			e.modify(t ? "extend" : "move", n, o);
		}
		function oe$3(e) {
			const t = ee$4(e);
			return null !== t && "rtl" === t.direction;
		}
		function le$2(e, t, n) {
			const o = oe$3(e);
			let l;
			l = Z$2(e) || o ? !n : n, ne$3(e, t, l, "character");
		}
		function re$3(e, t, n) {
			const o = e.getStyle(), l = getStyleObjectFromCSS$1(o);
			return null !== l && l[t] || n;
		}
		function ie$3(e, n, o = "") {
			let l = null;
			const i = e.getNodes();
			let s, c;
			if ($isRangeSelection(e)) {
				if (e.isCollapsed() && "" !== e.style) {
					const t = getStyleObjectFromCSS$1(e.style);
					if (null !== t && n in t) return t[n];
				}
				const { anchor: o, focus: l } = e, r = e.isBackward(), i = r ? l.getNode() : o.getNode(), f = r ? o.getNode() : l.getNode(), u = r ? l.offset : o.offset, g = r ? o.offset : l.offset;
				$isTextNode(i) && u === i.getTextContentSize() && (s = i), 0 === g && (c = f);
			}
			for (let e = 0; e < i.length; e++) {
				const r = i[e];
				if ($isTextNode(r) && !r.is(0 === e ? s : c)) {
					const e = re$3(r, n, o);
					if (null === l) l = e;
					else if (l !== e) {
						l = "";
						break;
					}
				}
			}
			return null === l ? o : l;
		}
		const se$3 = getStyleObjectFromCSS$1;
		const ce$2 = $;
		//#endregion
		//#region node_modules/@lexical/selection/dist/LexicalSelection.mjs
		const mod$10 = LexicalSelection_prod_exports;
		mod$10.$addNodeStyle;
		mod$10.$cloneWithProperties;
		mod$10.$copyBlockFormatIndent;
		mod$10.$ensureForwardRangeSelection;
		mod$10.$forEachSelectedTextNode;
		mod$10.$getComputedStyleForElement;
		mod$10.$getComputedStyleForParent;
		mod$10.$getSelectionStyleValueForProperty;
		const $isAtEdgeOfElement = mod$10.$isAtEdgeOfElement;
		mod$10.$isAtNodeEnd;
		mod$10.$isParentElementRTL;
		const $isParentRTL = mod$10.$isParentRTL;
		mod$10.$moveCaretSelection;
		const $moveCharacter = mod$10.$moveCharacter;
		mod$10.$patchStyleText;
		mod$10.$selectAll;
		const $setBlocksType = mod$10.$setBlocksType;
		const $shouldOverrideDefaultCharacterSelection = mod$10.$shouldOverrideDefaultCharacterSelection;
		const $sliceSelectedTextNodeContent = mod$10.$sliceSelectedTextNodeContent;
		mod$10.$trimTextContentFromAnchor;
		mod$10.$wrapNodes;
		mod$10.createDOMRange;
		const createRectsFromDOMRange = mod$10.createRectsFromDOMRange;
		mod$10.getCSSFromStyleObject;
		mod$10.getStyleObjectFromCSS;
		mod$10.trimTextContentFromAnchor;
		//#endregion
		//#region node_modules/@lexical/utils/dist/LexicalUtils.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalUtils_prod_exports = /* @__PURE__ */ __exportAll({
			$descendantsMatching: () => Wt$4,
			$dfs: () => dt$6,
			$dfsIterator: () => pt$6,
			$dfsWithSlots: () => ht$6,
			$dfsWithSlotsIterator: () => mt$6,
			$filter: () => Kt$6,
			$findMatchingParent: () => $findMatchingParent$1,
			$firstToLastIterator: () => Xt$4,
			$getAdjacentCaret: () => at$4,
			$getAdjacentSiblingOrParentSiblingCaret: () => $getAdjacentSiblingOrParentSiblingCaret$1,
			$getDepth: () => Ct$6,
			$getNearestBlockElementAncestorOrThrow: () => It$4,
			$getNearestNodeOfType: () => _t$5,
			$getNextRightPreorderNode: () => xt$6,
			$getNextSiblingOrParentSibling: () => wt$5,
			$handleIndentAndOutdent: () => $t$6,
			$insertFirst: () => Ht$4,
			$insertNodeIntoLeaf: () => Ot$6,
			$insertNodeToNearestRoot: () => Bt$5,
			$insertNodeToNearestRootAtCaret: () => $insertNodeToNearestRootAtCaret$1,
			$isAtEndOfNode: () => ee$3,
			$isAtStartOfNode: () => te$3,
			$isBlockFullySelected: () => Lt$5,
			$isEditorIsNestedEditor: () => jt$4,
			$lastToFirstIterator: () => Gt$4,
			$onEscapeDown: () => Zt$4,
			$onEscapeUp: () => Qt$4,
			$restoreEditorState: () => Dt$5,
			$reverseDfs: () => gt$5,
			$reverseDfsIterator: () => St$6,
			$reverseDfsWithSlots: () => Nt$6,
			$reverseDfsWithSlotsIterator: () => At$6,
			$splitNode: () => $splitNode$1,
			$unwrapAndFilterDescendants: () => zt$5,
			$unwrapNode: () => qt$5,
			$wrapNodeInElement: () => Tt$7,
			CAN_USE_BEFORE_INPUT: () => CAN_USE_BEFORE_INPUT$1,
			CAN_USE_DOM: () => CAN_USE_DOM$1,
			IS_ANDROID: () => IS_ANDROID$1,
			IS_ANDROID_CHROME: () => IS_ANDROID_CHROME$1,
			IS_APPLE: () => IS_APPLE$1,
			IS_APPLE_WEBKIT: () => IS_APPLE_WEBKIT$1,
			IS_CHROME: () => IS_CHROME$1,
			IS_FIREFOX: () => IS_FIREFOX$1,
			IS_IOS: () => IS_IOS$1,
			IS_SAFARI: () => IS_SAFARI$1,
			addClassNamesToElement: () => addClassNamesToElement$1,
			calculateZoomLevel: () => Ut$5,
			dedupeSelectionRects: () => tt$1,
			eventFiles: () => Ft$5,
			getScrollParent: () => ut$4,
			isBlockDomNode: () => isBlockDomNode$1,
			isHTMLAnchorElement: () => isHTMLAnchorElement$1,
			isHTMLElement: () => isHTMLElement$1,
			isInlineDomNode: () => isInlineDomNode$1,
			isMimeType: () => ct$4,
			makeStateWrapper: () => Jt$4,
			markSelection: () => lt$4,
			mediaFileReader: () => ft$5,
			mergeRegister: () => mergeRegister$1,
			objectKlassEquals: () => Mt$5,
			positionNodeOnRange: () => ot$4,
			registerNestedElementResolver: () => Pt$6,
			removeClassNamesFromElement: () => removeClassNamesFromElement$1,
			selectionAlwaysOnDisplay: () => st$4
		});
		function Z$1(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			throw n.search = o.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		function tt$1(t) {
			const e = (t, e) => e.left >= t.left - 1 && e.top >= t.top - 1 && e.right <= t.right + 1 && e.bottom <= t.bottom + 1, n = [];
			for (const o of Array.from(t)) if (!(o.width < .5 || o.height < .5 || n.some((t) => e(o, t)))) {
				for (let t = n.length - 1; t >= 0; t--) e(n[t], o) && n.splice(t, 1);
				n.push(o);
			}
			return n;
		}
		function et$2(t) {
			return `${t}px`;
		}
		const nt$4 = {
			attributes: !0,
			characterData: !0,
			childList: !0,
			subtree: !0
		};
		function ot$4(e, r, i) {
			let l = null, s = null, u = null, c = [];
			const f = getRootOwnerDocument(e.getRootElement()).createElement("div");
			function d() {
				null === l && Z$1(182), null === s && Z$1(183);
				const { left: o, top: u } = s.getBoundingClientRect(), d = tt$1(createRectsFromDOMRange(e, r));
				var a, g;
				f.isConnected || (g = f, (a = s).insertBefore(g, a.firstChild));
				let p = !1;
				for (let t = 0; t < d.length; t++) {
					const e = d[t], r = c[t] || getRootOwnerDocument(l).createElement("div"), i = r.style;
					"absolute" !== i.position && (i.position = "absolute", p = !0);
					const s = et$2(e.left - o);
					i.left !== s && (i.left = s, p = !0);
					const a = et$2(e.top - u);
					i.top !== a && (r.style.top = a, p = !0);
					const g = et$2(e.width);
					i.width !== g && (r.style.width = g, p = !0);
					const h = et$2(e.height);
					i.height !== h && (r.style.height = h, p = !0), r.parentNode !== f && (f.append(r), p = !0), c[t] = r;
				}
				for (; c.length > d.length;) c.pop()?.remove();
				p && i(c);
			}
			function a() {
				s = null, l = null, null !== u && u.disconnect(), u = null, f.remove();
				for (const t of c) t.remove();
				c = [];
			}
			f.style.position = "relative";
			const g = e.registerRootListener(function t() {
				const n = e.getRootElement();
				if (null === n) return a();
				const r = n.parentElement;
				if (!isHTMLElement$1(r)) return a();
				a(), l = n, s = r, u = new MutationObserver((n) => {
					const o = e.getRootElement(), r = o && o.parentElement;
					if (o !== l || r !== s) return t();
					for (const t of n) if (!f.contains(t.target)) return d();
				}), u.observe(r, nt$4), d();
			});
			return () => {
				g(), a();
			};
		}
		function rt$4(t, e, n, o) {
			if ("text" !== e.type && $isElementNode(n)) {
				const r = $getDOMSlot(n, o, t);
				return [r.element, r.getFirstChildOffset() + e.offset];
			}
			return [($isTextNode(n) ? $getDOMTextNode(n, o, t) : getDOMTextNode(o)) || o, e.offset];
		}
		function it$4(t) {
			for (const e of t) {
				const t = e.style;
				"Highlight" !== t.background && (t.background = "Highlight"), "HighlightText" !== t.color && (t.color = "HighlightText"), t.marginTop !== et$2(-1.5) && (t.marginTop = et$2(-1.5)), t.paddingTop !== et$2(4) && (t.paddingTop = et$2(4)), t.paddingBottom !== et$2(0) && (t.paddingBottom = et$2(0));
			}
		}
		function lt$4(t, e = it$4) {
			let n = null, o = null, s = null, u = null, c = null, f = null, d = () => {};
			function a(r) {
				r.read(() => {
					const r = $getSelection();
					if (!$isRangeSelection(r)) return n = null, s = null, u = null, f = null, d(), void (d = () => {});
					const [a, g] = function(t) {
						const e = t.getStartEndPoints();
						return t.isBackward() ? [e[1], e[0]] : e;
					}(r), p = a.getNode(), h = p.getKey(), m = a.offset, y = g.getNode(), v = y.getKey(), E = g.offset, w = t.getElementByKey(h), C = t.getElementByKey(v), x = null === n || w !== o || m !== s || h !== n.getKey(), S = null === u || C !== c || E !== f || v !== u.getKey();
					if ((x || S) && null !== w && null !== C) {
						const n = function(t, e, n, o, r, i, l) {
							const s = (t._window ? t._window.document : document).createRange();
							return s.setStart(...rt$4(t, e, n, o)), s.setEnd(...rt$4(t, r, i, l)), s;
						}(t, a, p, w, g, y, C);
						d(), d = ot$4(t, n, e);
					}
					n = p, o = w, s = m, u = y, c = C, f = E;
				}, { editor: t });
			}
			return a(t.getEditorState()), mergeRegister$1(t.registerUpdateListener(({ editorState: t }) => a(t)), () => {
				d();
			});
		}
		function st$4(t, e) {
			let n = null;
			const o = () => {
				const o = t.getRootElement(), r = null !== o ? o.ownerDocument.defaultView : null, i = null !== r ? r.getSelection() : null, l = null !== i ? getDOMSelectionPoints(i, o).anchorNode : null;
				null !== l && null !== o && o.contains(l) ? null !== n && (n(), n = null) : null === n && (n = lt$4(t, e));
			};
			return t.registerRootListener((t) => {
				if (t) {
					const e = t.ownerDocument, i = mergeRegister$1(registerEventListener(e, "selectionchange", o), () => {
						null !== n && n();
					});
					return o(), i;
				}
			});
		}
		function ut$4(t, e) {
			const n = t.ownerDocument, o = n.defaultView || window;
			let r = o.getComputedStyle(t);
			const i = "absolute" === r.position, l = e ? /(auto|scroll|hidden)/ : /(auto|scroll)/;
			if ("fixed" === r.position) return n.body;
			for (let e = t; e = getParentElement(e);) if (r = o.getComputedStyle(e), (!i || "static" !== r.position) && l.test(r.overflow + r.overflowY + r.overflowX)) return e;
			return n.body;
		}
		function ct$4(t, e) {
			for (const n of e) if (t.type.startsWith(n)) return !0;
			return !1;
		}
		function ft$5(t, e) {
			const n = t[Symbol.iterator]();
			return new Promise((t, o) => {
				const r = [], i = () => {
					const { done: l, value: s } = n.next();
					if (l) return t(r);
					const u = new FileReader();
					u.addEventListener("error", o), u.addEventListener("load", () => {
						const t = u.result;
						"string" == typeof t && r.push({
							file: s,
							result: t
						}), i();
					}), ct$4(s, e) ? u.readAsDataURL(s) : i();
				};
				i();
			});
		}
		function dt$6(t, e) {
			return Array.from(pt$6(t, e));
		}
		function at$4(t) {
			return t ? t.getAdjacentCaret() : null;
		}
		function gt$5(t, e) {
			return Array.from(St$6(t, e));
		}
		function pt$6(t, e) {
			return Et$5("next", t, e);
		}
		function ht$6(t, e) {
			return Array.from(mt$6(t, e));
		}
		function* mt$6(t, e) {
			for (const n of Et$5("next", t, e)) {
				yield n;
				const { node: t, depth: o } = n;
				if ($isSlotHost(t) && !t.is(e)) for (const e of $getSlotNames(t)) {
					const n = $getSlot(t, e);
					null !== n && (yield* yt$5(n, o + 1));
				}
			}
		}
		function* yt$5(t, e) {
			yield {
				depth: e,
				node: t
			};
			const n = e + 1;
			if ($isSlotHost(t)) for (const e of $getSlotNames(t)) {
				const o = $getSlot(t, e);
				null !== o && (yield* yt$5(o, n));
			}
			if ($isElementNode(t)) for (const e of t.getChildren()) yield* yt$5(e, n);
		}
		function vt$6(t, e) {
			const n = $getAdjacentSiblingOrParentSiblingCaret$1($getSiblingCaret(t, e));
			return n && n[0];
		}
		function Et$5(t, e, n) {
			const o = $getRoot(), r = e || o, i = $isElementNode(r) ? $getChildCaret(r, t) : $getSiblingCaret(r, t), l = Ct$6(r), u = n ? $getAdjacentChildCaret($getChildCaretOrSelf($getSiblingCaret(n, t))) || vt$6(n, t) : vt$6(r, t);
			let c = l;
			return makeStepwiseIterator({
				hasNext: (t) => null !== t,
				initial: i,
				map: (t) => ({
					depth: c,
					node: t.origin
				}),
				step: (t) => {
					if (t.isSameNodeCaret(u)) return null;
					$isChildCaret(t) && c++;
					const e = $getAdjacentSiblingOrParentSiblingCaret$1(t);
					return !e || e[0].isSameNodeCaret(u) ? null : (c += e[1], e[0]);
				}
			});
		}
		function wt$5(t) {
			const e = $getAdjacentSiblingOrParentSiblingCaret$1($getSiblingCaret(t, "next"));
			return e && [e[0].origin, e[1]];
		}
		function Ct$6(t) {
			let e = -1;
			for (let n = t; null !== n; n = n.getParent() ?? $getSlotHost(n)) e++;
			return e;
		}
		function xt$6(t) {
			const e = $getChildCaretOrSelf($getSiblingCaret(t, "previous")), n = $getAdjacentSiblingOrParentSiblingCaret$1(e, "root");
			return n && n[0].origin;
		}
		function St$6(t, e) {
			return Et$5("previous", t, e);
		}
		function Nt$6(t, e) {
			return Array.from(At$6(t, e));
		}
		function* At$6(t, e) {
			const n = [];
			for (const o of Et$5("previous", t, e)) {
				for (; n.length > 0 && o.depth <= n[n.length - 1].depth;) {
					const t = n.pop();
					yield* bt$6(t.node, t.depth + 1);
				}
				yield o;
				const { node: t, depth: r } = o;
				$isSlotHost(t) && $getSlotNames(t).length > 0 && !t.is(e) && n.push({
					depth: r,
					node: t
				});
			}
			for (; n.length > 0;) {
				const t = n.pop();
				yield* bt$6(t.node, t.depth + 1);
			}
		}
		function* bt$6(t, e) {
			const n = $getSlotNames(t);
			for (let o = n.length - 1; o >= 0; o--) {
				const r = $getSlot(t, n[o]);
				null !== r && (yield* Rt$6(r, e));
			}
		}
		function* Rt$6(t, e) {
			yield {
				depth: e,
				node: t
			};
			const n = e + 1;
			if ($isElementNode(t)) {
				const e = t.getChildren();
				for (let t = e.length - 1; t >= 0; t--) yield* Rt$6(e[t], n);
			}
			$isSlotHost(t) && (yield* bt$6(t, n));
		}
		function _t$5(t, e) {
			let n = t;
			for (; null != n;) {
				if (n instanceof e) return n;
				n = n.getParent();
			}
			return null;
		}
		function It$4(t) {
			const e = $findMatchingParent$1(t, (t) => $isElementNode(t) && !t.isInline());
			return $isElementNode(e) || Z$1(4, t.__key), e;
		}
		function Lt$5(t, e) {
			const n = $getCaretRangeInDirection($isRangeSelection(e) ? $caretRangeFromSelection(e) : e, "next"), o = $getSlotFrame(n.anchor.origin), r = $getSlotFrame(t.getLatest());
			if (null === o ? null !== r : !o.is(r)) return !1;
			const i = $normalizeCaret($getChildCaret(t, "next")), s = $getCaretInDirection($normalizeCaret($getChildCaret(t, "previous")), "next");
			return $comparePointCaretNext(n.anchor, i) <= 0 && $comparePointCaretNext(n.focus, s) >= 0;
		}
		function Pt$6(t, e, n, o) {
			const r = (t) => t instanceof e;
			return t.registerNodeTransform(e, (t) => {
				const e = ((t) => {
					const e = t.getChildren();
					for (let t = 0; t < e.length; t++) {
						const n = e[t];
						if (r(n)) return null;
					}
					let n = t, o = t;
					for (; null !== n;) if (o = n, n = n.getParent(), r(n)) return {
						child: o,
						parent: n
					};
					return null;
				})(t);
				if (null !== e) {
					const { child: r, parent: i } = e;
					if (r.is(t)) {
						o(i, t);
						const e = r.getNextSiblings(), l = e.length;
						if (i.insertAfter(r), 0 !== l) {
							const t = n(i);
							r.insertAfter(t);
							for (let n = 0; n < l; n++) t.append(e[n]);
						}
						i.canBeEmpty() || 0 !== i.getChildrenSize() || i.remove();
					}
				}
			});
		}
		function Dt$5(t, e) {
			const n = /* @__PURE__ */ new Map(), o = t._pendingEditorState;
			for (const [t, o] of e._nodeMap) n.set(t, $cloneWithProperties$1(o));
			o && (o._nodeMap = n), $fullReconcile();
			const r = e._selection;
			$setSelection(null === r ? null : r.clone());
		}
		function Bt$5(t) {
			const e = $getSelection() || $getPreviousSelection();
			let n;
			if ($isRangeSelection(e)) n = $caretFromPoint(e.focus, "next");
			else {
				if (null != e) {
					const t = e.getNodes(), o = t[t.length - 1];
					o && (n = $getSiblingCaret(o, "next"));
				}
				n = n || $getChildCaret($getRoot(), "previous").getFlipped().insert($createParagraphNode());
			}
			const o = $insertNodeToNearestRootAtCaret$1(t, n), r = $getAdjacentChildCaret(o), s = $isChildCaret(r) ? $normalizeCaret(r) : o;
			return $setSelectionFromCaretRange($getCollapsedCaretRange(s)), t.getLatest();
		}
		function Ot$6(t) {
			const e = $getSelection();
			if (!$isRangeSelection(e)) return void (e && e.insertNodes([t]));
			const n = $caretRangeFromSelection(e);
			let o = $getCaretRangeInDirection($removeTextFromCaretRange(n), "next").anchor;
			if ($isTextPointCaret(o)) {
				const t = $splitAtPointCaretNext(o);
				if (!t) return;
				o = t;
			}
			const r = o.getFlipped();
			r.insert(t), $setSelectionFromCaretRange($getCaretRange(r, r));
		}
		function Tt$7(t, e) {
			const n = e();
			return t.replace(n), n.append(t), n;
		}
		function Mt$5(t, e) {
			return null !== t && Object.getPrototypeOf(t).constructor.name === e.name;
		}
		function Ft$5(t) {
			let e = null;
			if (Mt$5(t, DragEvent) ? e = t.dataTransfer : Mt$5(t, ClipboardEvent) && (e = t.clipboardData), null === e) return [
				!1,
				[],
				!1
			];
			const n = e.types, o = n.includes("Files"), r = n.includes("text/html") || n.includes("text/plain");
			return [
				o,
				Array.from(e.files),
				r
			];
		}
		function Kt$6(t, e) {
			const n = [];
			for (let o = 0; o < t.length; o++) {
				const r = e(t[o]);
				null !== r && n.push(r);
			}
			return n;
		}
		function $t$6(t) {
			const e = $getSelection();
			if (!$isRangeSelection(e)) return !1;
			const n = /* @__PURE__ */ new Set(), o = e.getNodes();
			for (let e = 0; e < o.length; e++) {
				const r = o[e], i = r.getKey();
				if (n.has(i)) continue;
				const l = $findMatchingParent$1(r, (t) => $isElementNode(t) && !t.isInline());
				if (null === l) continue;
				const u = l.getKey();
				l.canIndent() && !n.has(u) && (n.add(u), t(l));
			}
			return n.size > 0;
		}
		function Ht$4(t, e) {
			$getChildCaret(t, "next").insert(e);
		}
		let kt$5 = !(IS_FIREFOX$1 || !CAN_USE_DOM$1) && void 0;
		function Ut$5(t, e = !1) {
			let n = 1;
			if (function() {
				if (void 0 === kt$5) {
					const t = document.createElement("div");
					t.style.position = "absolute", t.style.opacity = "0", t.style.width = "100px", t.style.left = "-1000px", document.body.appendChild(t);
					const e = t.getBoundingClientRect();
					t.style.setProperty("zoom", "2"), kt$5 = t.getBoundingClientRect().width === e.width, document.body.removeChild(t);
				}
				return kt$5;
			}() || e) {
				const e = t && t.ownerDocument.defaultView || window;
				for (; t;) n *= Number(e.getComputedStyle(t).getPropertyValue("zoom")), t = getParentElement(t);
			}
			return n;
		}
		function jt$4(t) {
			return null !== t._parentEditor;
		}
		function zt$5(t, e) {
			return Vt$4(t, e, null);
		}
		function Vt$4(t, e, n) {
			let o = !1;
			for (const r of Gt$4(t)) e(r) ? null !== n && n(r) : (o = !0, $isElementNode(r) && Vt$4(r, e, n || ((t) => r.insertAfter(t))), r.remove());
			return o;
		}
		function Wt$4(t, e) {
			const n = [], o = Array.from(t).reverse();
			for (let t = o.pop(); void 0 !== t; t = o.pop()) if (e(t)) n.push(t);
			else if ($isElementNode(t)) for (const e of Gt$4(t)) o.push(e);
			return n;
		}
		function Xt$4(t) {
			return Yt$4($getChildCaret(t, "next"));
		}
		function Gt$4(t) {
			return Yt$4($getChildCaret(t, "previous"));
		}
		function Yt$4(t) {
			return makeStepwiseIterator({
				hasNext: $isSiblingCaret,
				initial: t.getAdjacentCaret(),
				map: (t) => t.origin.getLatest(),
				step: (t) => t.getAdjacentCaret()
			});
		}
		function qt$5(t) {
			$rewindSiblingCaret($getSiblingCaret(t, "next")).splice(1, t.getChildren());
		}
		function Jt$4(t) {
			const e = (e) => $getState(e, t), n = (e, n) => $setState(e, t, n);
			return {
				$get: e,
				$set: n,
				accessors: [e, n],
				makeGetterMethod: () => function() {
					return e(this);
				},
				makeSetterMethod: () => function(t) {
					return n(this, t);
				},
				stateConfig: t
			};
		}
		function Qt$4(t, e) {
			const n = $getSelection();
			if ($isRangeSelection(n) && n.isCollapsed()) {
				const o = $findMatchingParent$1(n.anchor.getNode(), t);
				if (o) {
					const t = o.getParent();
					if (null !== t && t.getFirstChild() === o && te$3(n.anchor, o)) return o.insertBefore($createParagraphNode()).selectEnd(), e && e.preventDefault(), !0;
				}
			}
			return !1;
		}
		function Zt$4(t, e) {
			const n = $getSelection();
			if ($isRangeSelection(n) && n.isCollapsed()) {
				const o = $findMatchingParent$1(n.anchor.getNode(), t);
				if (o) {
					const t = o.getParent();
					if (null !== t && t.getLastChild() === o && ee$3(n.anchor, o)) return o.insertAfter($createParagraphNode()).selectEnd(), e && e.preventDefault(), !0;
				}
			}
			return !1;
		}
		function te$3(t, n) {
			return $isAtEdgeOfElement(t, n, "previous");
		}
		function ee$3(t, n) {
			return $isAtEdgeOfElement(t, n, "next");
		}
		//#endregion
		//#region node_modules/@lexical/utils/dist/LexicalUtils.mjs
		const mod$9 = LexicalUtils_prod_exports;
		const $descendantsMatching = mod$9.$descendantsMatching;
		const $dfs = mod$9.$dfs;
		mod$9.$dfsIterator;
		mod$9.$dfsWithSlots;
		mod$9.$dfsWithSlotsIterator;
		mod$9.$filter;
		mod$9.$findMatchingParent;
		mod$9.$firstToLastIterator;
		mod$9.$getAdjacentCaret;
		mod$9.$getAdjacentSiblingOrParentSiblingCaret;
		mod$9.$getDepth;
		const $getNearestBlockElementAncestorOrThrow = mod$9.$getNearestBlockElementAncestorOrThrow;
		const $getNearestNodeOfType = mod$9.$getNearestNodeOfType;
		mod$9.$getNextRightPreorderNode;
		mod$9.$getNextSiblingOrParentSibling;
		const $handleIndentAndOutdent = mod$9.$handleIndentAndOutdent;
		const $insertFirst = mod$9.$insertFirst;
		mod$9.$insertNodeIntoLeaf;
		const $insertNodeToNearestRoot = mod$9.$insertNodeToNearestRoot;
		mod$9.$insertNodeToNearestRootAtCaret;
		mod$9.$isAtEndOfNode;
		mod$9.$isAtStartOfNode;
		const $isBlockFullySelected = mod$9.$isBlockFullySelected;
		mod$9.$isEditorIsNestedEditor;
		mod$9.$lastToFirstIterator;
		mod$9.$onEscapeDown;
		mod$9.$onEscapeUp;
		mod$9.$restoreEditorState;
		mod$9.$reverseDfs;
		mod$9.$reverseDfsIterator;
		mod$9.$reverseDfsWithSlots;
		mod$9.$reverseDfsWithSlotsIterator;
		mod$9.$splitNode;
		const $unwrapAndFilterDescendants = mod$9.$unwrapAndFilterDescendants;
		mod$9.$unwrapNode;
		mod$9.$wrapNodeInElement;
		mod$9.CAN_USE_BEFORE_INPUT;
		mod$9.CAN_USE_DOM;
		mod$9.IS_ANDROID;
		mod$9.IS_ANDROID_CHROME;
		mod$9.IS_APPLE;
		mod$9.IS_APPLE_WEBKIT;
		mod$9.IS_CHROME;
		mod$9.IS_FIREFOX;
		mod$9.IS_IOS;
		mod$9.IS_SAFARI;
		mod$9.addClassNamesToElement;
		const calculateZoomLevel = mod$9.calculateZoomLevel;
		mod$9.dedupeSelectionRects;
		const eventFiles$1 = mod$9.eventFiles;
		mod$9.getScrollParent;
		mod$9.isBlockDomNode;
		mod$9.isHTMLAnchorElement;
		mod$9.isHTMLElement;
		mod$9.isInlineDomNode;
		mod$9.isMimeType;
		mod$9.makeStateWrapper;
		mod$9.markSelection;
		mod$9.mediaFileReader;
		mod$9.mergeRegister;
		const objectKlassEquals = mod$9.objectKlassEquals;
		mod$9.positionNodeOnRange;
		mod$9.registerNestedElementResolver;
		mod$9.removeClassNamesFromElement;
		const selectionAlwaysOnDisplay = mod$9.selectionAlwaysOnDisplay;
		//#endregion
		//#region node_modules/@lexical/extension/dist/LexicalExtension.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalExtension_prod_exports = /* @__PURE__ */ __exportAll({
			$applyFormatToDom: () => we$1,
			$createHorizontalRuleNode: () => pn$2,
			$defaultShouldInsertAfter: () => he$1,
			$getExtensionDependency: () => cn$2,
			$getExtensionOutput: () => an$2,
			$getPeerDependency: () => dn$2,
			$isDecoratorTextNode: () => Ee$1,
			$isHorizontalRuleNode: () => mn$2,
			AutoFocusExtension: () => de$1,
			ClearEditorExtension: () => fe$1,
			ClickAfterLastBlockExtension: () => pe$1,
			DecoratorTextExtension: () => Re$1,
			DecoratorTextNode: () => ye$1,
			EditorStateExtension: () => De$1,
			HorizontalRuleExtension: () => vn$2,
			HorizontalRuleNode: () => hn$2,
			IMEExtension: () => xn$2,
			INSERT_HORIZONTAL_RULE_COMMAND: () => fn$2,
			InitialStateExtension: () => Je$1,
			LexicalBuilder: () => nn$2,
			NestedEditorExtension: () => yn$2,
			NodeSelectionDataSelectedExtension: () => En$2,
			NodeSelectionExtension: () => un$2,
			NormalizeInlineElementsExtension: () => Sn$2,
			NormalizeTripleClickSelectionExtension: () => Nn$2,
			PreventSelectAllExtension: () => Rn$1,
			RootElementExtension: () => Cn$2,
			SelectBlockExtension: () => Dn$2,
			SelectionAlwaysOnDisplayExtension: () => In$1,
			TabIndentationExtension: () => kn$2,
			WatchEditableExtension: () => _n$1,
			applyFormatFromStyle: () => be$1,
			applyFormatToDom: () => Se$1,
			batch: () => jt$3,
			buildEditorFromExtensions: () => Ye$1,
			computed: () => ne$2,
			configExtension: () => configExtension$1,
			declarePeerDependency: () => declarePeerDependency$1,
			defineExtension: () => defineExtension$1,
			effect: () => ce$1,
			getExtensionDependencyFromEditor: () => on$2,
			getKnownTypesAndNodes: () => me$1,
			getPeerDependencyFromEditor: () => sn$2,
			getPeerDependencyFromEditorOrThrow: () => rn$2,
			namedSignals: () => ae$1,
			registerClearEditor: () => ue$1,
			registerTabIndentation: () => Mn$2,
			safeCast: () => safeCast$1,
			shallowMergeConfig: () => shallowMergeConfig$1,
			signal: () => Yt$3,
			untracked: () => Ut$4,
			watchedSignal: () => Ce$1
		});
		const Kt$5 = Symbol.for("preact-signals");
		function $t$5() {
			if (Bt$4 > 1) return void Bt$4--;
			let t, e = !1;
			for (function() {
				let t = Wt$3;
				for (Wt$3 = void 0; void 0 !== t;) t.S.v === t.v && (t.S.i = t.i), t = t.o;
			}(); void 0 !== zt$4;) {
				let n = zt$4;
				for (zt$4 = void 0, Vt$3++; void 0 !== n;) {
					const i = n.u;
					if (n.u = void 0, n.f &= -3, !(8 & n.f) && qt$4(n)) try {
						n.c();
					} catch (n) {
						e || (t = n, e = !0);
					}
					n = i;
				}
			}
			if (Vt$3 = 0, Bt$4--, e) throw t;
		}
		function jt$3(t) {
			if (Bt$4 > 0) return t();
			Zt$3 = ++Gt$3, Bt$4++;
			try {
				return t();
			} finally {
				$t$5();
			}
		}
		let Tt$6;
		let zt$4;
		function Ut$4(t) {
			const e = Tt$6;
			Tt$6 = void 0;
			try {
				return t();
			} finally {
				Tt$6 = e;
			}
		}
		let Wt$3;
		let Bt$4 = 0;
		let Vt$3 = 0;
		let Gt$3 = 0;
		let Zt$3 = 0;
		let Ht$3 = 0;
		function Jt$3(t) {
			if (void 0 === Tt$6) return;
			let e = t.n;
			return void 0 === e || e.t !== Tt$6 ? (e = {
				i: 0,
				S: t,
				p: Tt$6.s,
				n: void 0,
				t: Tt$6,
				e: void 0,
				x: void 0,
				r: e
			}, void 0 !== Tt$6.s && (Tt$6.s.n = e), Tt$6.s = e, t.n = e, 32 & Tt$6.f && t.S(e), e) : -1 === e.i ? (e.i = 0, void 0 !== e.n && (e.n.p = e.p, void 0 !== e.p && (e.p.n = e.n), e.p = Tt$6.s, e.n = void 0, Tt$6.s.n = e, Tt$6.s = e), e) : void 0;
		}
		function Xt$3(t, e) {
			this.v = t, this.i = 0, this.n = void 0, this.t = void 0, this.l = 0, this.W = null == e ? void 0 : e.watched, this.Z = null == e ? void 0 : e.unwatched, this.name = null == e ? void 0 : e.name;
		}
		function Yt$3(t, e) {
			return new Xt$3(t, e);
		}
		function qt$4(t) {
			for (let e = t.s; void 0 !== e; e = e.n) if (e.S.i !== e.i || !e.S.h() || e.S.i !== e.i) return !0;
			return !1;
		}
		function Qt$3(t) {
			for (let e = t.s; void 0 !== e; e = e.n) {
				const n = e.S.n;
				if (void 0 !== n && (e.r = n), e.S.n = e, e.i = -1, void 0 === e.n) {
					t.s = e;
					break;
				}
			}
		}
		function te$2(t) {
			let e, n = t.s;
			for (; void 0 !== n;) {
				const t = n.p;
				-1 === n.i ? (n.S.U(n), void 0 !== t && (t.n = n.n), void 0 !== n.n && (n.n.p = t)) : e = n, n.S.n = n.r, void 0 !== n.r && (n.r = void 0), n = t;
			}
			t.s = e;
		}
		function ee$2(t, e) {
			Xt$3.call(this, void 0), this.x = t, this.s = void 0, this.g = Ht$3 - 1, this.f = 4, this.W = null == e ? void 0 : e.watched, this.Z = null == e ? void 0 : e.unwatched, this.name = null == e ? void 0 : e.name;
		}
		function ne$2(t, e) {
			return new ee$2(t, e);
		}
		function ie$2(t) {
			const e = t.m;
			if (t.m = void 0, "function" == typeof e) {
				Bt$4++;
				const n = Tt$6;
				Tt$6 = void 0;
				try {
					e();
				} catch (e) {
					throw t.f &= -2, t.f |= 8, oe$2(t), e;
				} finally {
					Tt$6 = n, $t$5();
				}
			}
		}
		function oe$2(t) {
			for (let e = t.s; void 0 !== e; e = e.n) e.S.U(e);
			t.x = void 0, t.s = void 0, ie$2(t);
		}
		function se$2(t) {
			if (Tt$6 !== this) throw new Error("Out-of-order effect");
			te$2(this), Tt$6 = t, this.f &= -2, 8 & this.f && oe$2(this), $t$5();
		}
		function re$2(t, e) {
			this.x = t, this.m = void 0, this.s = void 0, this.u = void 0, this.f = 32, this.name = null == e ? void 0 : e.name;
		}
		function ce$1(t, e) {
			const n = new re$2(t, e);
			try {
				n.c();
			} catch (t) {
				throw n.d(), t;
			}
			const i = n.d.bind(n);
			return i[Symbol.dispose] = i, i;
		}
		function ae$1(t, e = {}) {
			const n = {};
			for (const i in t) {
				const o = e[i];
				n[i] = Yt$3(void 0 === o ? t[i] : o);
			}
			return n;
		}
		Xt$3.prototype.brand = Kt$5, Xt$3.prototype.h = function() {
			return !0;
		}, Xt$3.prototype.S = function(t) {
			const e = this.t;
			e !== t && void 0 === t.e && (t.x = e, this.t = t, void 0 !== e ? e.e = t : Ut$4(() => {
				var t;
				null == (t = this.W) || t.call(this);
			}));
		}, Xt$3.prototype.U = function(t) {
			if (void 0 !== this.t) {
				const e = t.e, n = t.x;
				void 0 !== e && (e.x = n, t.e = void 0), void 0 !== n && (n.e = e, t.x = void 0), t === this.t && (this.t = n, void 0 === n && Ut$4(() => {
					var t;
					null == (t = this.Z) || t.call(this);
				}));
			}
		}, Xt$3.prototype.subscribe = function(t) {
			return ce$1(() => {
				const e = this.value, n = Tt$6;
				Tt$6 = void 0;
				try {
					t(e);
				} finally {
					Tt$6 = n;
				}
			}, { name: "sub" });
		}, Xt$3.prototype.valueOf = function() {
			return this.value;
		}, Xt$3.prototype.toString = function() {
			return this.value + "";
		}, Xt$3.prototype.toJSON = function() {
			return this.value;
		}, Xt$3.prototype.peek = function() {
			const t = Tt$6;
			Tt$6 = void 0;
			try {
				return this.value;
			} finally {
				Tt$6 = t;
			}
		}, Object.defineProperty(Xt$3.prototype, "value", {
			get() {
				const t = Jt$3(this);
				return void 0 !== t && (t.i = this.i), this.v;
			},
			set(t) {
				if (t !== this.v) {
					if (Vt$3 > 100) throw new Error("Cycle detected");
					(function(t) {
						0 !== Bt$4 && 0 === Vt$3 && t.l !== Zt$3 && (t.l = Zt$3, Wt$3 = {
							S: t,
							v: t.v,
							i: t.i,
							o: Wt$3
						});
					})(this), this.v = t, this.i++, Ht$3++, Bt$4++;
					try {
						for (let t = this.t; void 0 !== t; t = t.x) t.t.N();
					} finally {
						$t$5();
					}
				}
			}
		}), ee$2.prototype = new Xt$3(), ee$2.prototype.h = function() {
			if (this.f &= -3, 1 & this.f) return !1;
			if (32 == (36 & this.f)) return !0;
			if (this.f &= -5, this.g === Ht$3) return !0;
			if (this.g = Ht$3, this.f |= 1, this.i > 0 && !qt$4(this)) return this.f &= -2, !0;
			const t = Tt$6;
			try {
				Qt$3(this), Tt$6 = this;
				const t = this.x();
				(16 & this.f || this.v !== t || 0 === this.i) && (this.v = t, this.f &= -17, this.i++);
			} catch (t) {
				this.v = t, this.f |= 16, this.i++;
			}
			return Tt$6 = t, te$2(this), this.f &= -2, !0;
		}, ee$2.prototype.S = function(t) {
			if (void 0 === this.t) {
				this.f |= 36;
				for (let t = this.s; void 0 !== t; t = t.n) t.S.S(t);
			}
			Xt$3.prototype.S.call(this, t);
		}, ee$2.prototype.U = function(t) {
			if (void 0 !== this.t && (Xt$3.prototype.U.call(this, t), void 0 === this.t)) {
				this.f &= -33;
				for (let t = this.s; void 0 !== t; t = t.n) t.S.U(t);
			}
		}, ee$2.prototype.N = function() {
			if (!(2 & this.f)) {
				this.f |= 6;
				for (let t = this.t; void 0 !== t; t = t.x) t.t.N();
			}
		}, Object.defineProperty(ee$2.prototype, "value", { get() {
			if (1 & this.f) throw new Error("Cycle detected");
			const t = Jt$3(this);
			if (this.h(), void 0 !== t && (t.i = this.i), 16 & this.f) throw this.v;
			return this.v;
		} }), re$2.prototype.c = function() {
			const t = this.S();
			try {
				if (8 & this.f) return;
				if (void 0 === this.x) return;
				const t = this.x();
				"function" == typeof t && (this.m = t);
			} finally {
				t();
			}
		}, re$2.prototype.S = function() {
			if (1 & this.f) throw new Error("Cycle detected");
			this.f |= 1, this.f &= -9, ie$2(this), Qt$3(this), Bt$4++;
			const t = Tt$6;
			return Tt$6 = this, se$2.bind(this, t);
		}, re$2.prototype.N = function() {
			2 & this.f || (this.f |= 2, this.u = zt$4, zt$4 = this);
		}, re$2.prototype.d = function() {
			this.f |= 8, 1 & this.f || oe$2(this);
		}, re$2.prototype.dispose = function() {
			this.d();
		};
		const de$1 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({
				defaultSelection: "rootEnd",
				disabled: !1
			}),
			name: "@lexical/extension/AutoFocus",
			register(t, e, i) {
				const o = i.getOutput();
				return ce$1(() => o.disabled.value ? void 0 : t.registerRootListener((e) => {
					t.focus(() => {
						const t = null !== e ? getActiveElement(e) : null;
						null === e || null !== t && e.contains(t) || e.focus({ preventScroll: !0 });
					}, { defaultSelection: o.defaultSelection.peek() });
				}));
			}
		});
		function le$1() {
			const t = $getRoot(), e = $getSelection(), n = $createParagraphNode();
			t.clear(), t.append(n), null !== e && n.select(), $isRangeSelection(e) && (e.format = 0);
		}
		function ue$1(t, e = le$1) {
			return t.registerCommand(CLEAR_EDITOR_COMMAND, () => (e(), !0), COMMAND_PRIORITY_EDITOR);
		}
		const fe$1 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({ $onClear: le$1 }),
			name: "@lexical/extension/ClearEditor",
			register(t, e, n) {
				const { $onClear: i } = n.getOutput();
				return ce$1(() => ue$1(t, i.value));
			}
		});
		function he$1(t) {
			return !!$isDecoratorNode(t) || !(!$isElementNode(t) || !t.isShadowRoot());
		}
		function ge$1(t, e, n, i) {
			return !!t.isEditable() && n.target === e && t.read("latest", () => {
				const e = $getRoot().getLastChild();
				if (null === e) return !1;
				const o = t.getElementByKey(e.getKey());
				return null !== o && !(n.clientY <= o.getBoundingClientRect().bottom) && i(e);
			});
		}
		const pe$1 = /* @__PURE__ */ defineExtension$1({
			build: (t, e) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({
				$shouldInsertAfter: he$1,
				disabled: !1
			}),
			name: "@lexical/ClickAfterLastBlock",
			register: (t, e, n) => ce$1(() => {
				const e = n.getOutput();
				if (!e.disabled.value) return t.registerRootListener((n) => {
					if (null === n) return;
					return registerEventListeners(n, {
						click: (i) => {
							ge$1(t, n, i, e.$shouldInsertAfter.peek()) && (i.preventDefault(), stopLexicalPropagation(i), t.update(() => {
								const t = $getRoot().getLastChild();
								if (null === t) return;
								if (!e.$shouldInsertAfter.peek()(t)) return;
								const n = $createParagraphNode();
								t.insertAfter(n), n.select();
							}));
						},
						mousedown: (i) => {
							ge$1(t, n, i, e.$shouldInsertAfter.peek()) && i.preventDefault();
						}
					}, !0);
				});
			})
		});
		function me$1(t) {
			const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
			for (const i of ve$1(t)) {
				const t = "function" == typeof i ? i : i.replace;
				getStaticNodeConfig(t), e.add(t.getType()), n.add(t);
			}
			return {
				nodes: n,
				types: e
			};
		}
		function ve$1(t) {
			return ("function" == typeof t.nodes ? t.nodes() : t.nodes) || [];
		}
		const xe$1 = /* @__PURE__ */ createState("format", { parse: (t) => "number" == typeof t ? t : 0 });
		var ye$1 = class extends DecoratorNode {
			get __isInlineFormattable() {
				return !0;
			}
			$config() {
				return this.config("decorator-text", {
					extends: DecoratorNode,
					stateConfigs: [{
						flat: !0,
						stateConfig: xe$1
					}]
				});
			}
			getFormat(t) {
				return $getState(this, xe$1, t);
			}
			getFormatFlags(t, e) {
				return toggleTextFormatType(this.getFormat(), t, e);
			}
			hasFormat(t) {
				const e = TEXT_TYPE_TO_FORMAT[t];
				return 0 !== (this.getFormat() & e);
			}
			setFormat(t) {
				return $setState(this, xe$1, t);
			}
			toggleFormat(t) {
				const e = this.getFormat(), n = toggleTextFormatType(e, t, null);
				return this.setFormat(n);
			}
			isInline() {
				return !0;
			}
			createDOM(t, e) {
				return $getDocument().createElement("span");
			}
		};
		function Ee$1(t) {
			return t instanceof ye$1;
		}
		function be$1(t, e, n) {
			const i = e.fontWeight, o = e.textDecoration.split(" "), s = "700" === i || "bold" === i, r = o.includes("line-through"), c = "italic" === e.fontStyle, a = o.includes("underline"), d = e.verticalAlign;
			return s && !t.hasFormat("bold") && t.toggleFormat("bold"), r && !t.hasFormat("strikethrough") && t.toggleFormat("strikethrough"), c && !t.hasFormat("italic") && t.toggleFormat("italic"), a && !t.hasFormat("underline") && t.toggleFormat("underline"), "sub" !== d || t.hasFormat("subscript") || t.toggleFormat("subscript"), "super" !== d || t.hasFormat("superscript") || t.toggleFormat("superscript"), n && !t.hasFormat(n) && t.toggleFormat(n), t;
		}
		function Se$1(t, e, n = Oe$1) {
			let i = e;
			for (const [e, o] of Object.entries(n)) t.hasFormat(o) && (i = Ne$1(i, e));
			return i;
		}
		const we$1 = Se$1;
		function Ne$1(t, e) {
			const n = t.ownerDocument.createElement(e);
			return n.appendChild(t), n;
		}
		const Oe$1 = {
			b: "bold",
			code: "code",
			em: "italic",
			i: "italic",
			mark: "highlight",
			s: "strikethrough",
			strong: "bold",
			sub: "subscript",
			sup: "superscript",
			u: "underline"
		};
		const Re$1 = /* @__PURE__ */ defineExtension$1({
			name: "@lexical/extension/DecoratorText",
			nodes: () => [ye$1]
		});
		function Ce$1(t, e) {
			let n;
			return Yt$3(t(), {
				unwatched() {
					n && (n(), n = void 0);
				},
				watched() {
					this.value = t(), n = e(this);
				}
			});
		}
		const De$1 = /* @__PURE__ */ defineExtension$1({
			build: (t) => Ce$1(() => t.getEditorState(), (e) => t.registerUpdateListener((t) => {
				e.value = t.editorState;
			})),
			name: "@lexical/extension/EditorState"
		});
		function Ie$1(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), i = new URLSearchParams();
			i.append("code", t);
			for (const t of e) i.append("v", t);
			throw n.search = i.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		let Fe$1;
		try {
			Fe$1 = "0.49.0+prod.esm";
		} catch (t) {}
		const Me$1 = Fe$1 ?? "\"<unknown>+source\"";
		const ke$1 = /* @__PURE__ */ new Set([
			"__proto__",
			"constructor",
			"prototype"
		]);
		function _e$1(t, e) {
			if (t && e && !Array.isArray(e) && "object" == typeof t && "object" == typeof e) {
				const n = t, i = e;
				for (const t in i) !ke$1.has(t) && Object.prototype.hasOwnProperty.call(i, t) && (n[t] = _e$1(n[t], i[t]));
				return t;
			}
			return e;
		}
		const Ae$1 = 0;
		const Pe$1 = 1;
		const Le$1 = 2;
		const Ke$1 = 3;
		const $e$1 = 4;
		const je$1 = 5;
		const Te$1 = 6;
		const ze$1 = 7;
		function Ue$1(t) {
			return t.id === Ae$1;
		}
		function We$1(t) {
			return t.id === Le$1;
		}
		function Be$1(t) {
			return function(t) {
				return t.id === Pe$1;
			}(t) || Ie$1(305, String(t.id), String(Pe$1)), Object.assign(t, { id: Le$1 });
		}
		const Ve$1 = /* @__PURE__ */ new Set();
		var Ge$1 = class {
			builder;
			configs;
			_dependency;
			_peerNameSet;
			extension;
			state;
			_signal;
			constructor(t, e) {
				this.builder = t, this.extension = e, this.configs = /* @__PURE__ */ new Set(), this.state = { id: Ae$1 };
			}
			mergeConfigs() {
				let t = this.extension.config || {};
				const e = this.extension.mergeConfig ? this.extension.mergeConfig.bind(this.extension) : shallowMergeConfig$1;
				for (const n of this.configs) t = e(t, n);
				return t;
			}
			init(t) {
				const e = this.state;
				We$1(e) || Ie$1(306, String(e.id));
				const n = {
					getDependency: this.getInitDependency.bind(this),
					getDirectDependentNames: this.getDirectDependentNames.bind(this),
					getPeer: this.getInitPeer.bind(this),
					getPeerNameSet: this.getPeerNameSet.bind(this)
				}, i = {
					...n,
					getDependency: this.getDependency.bind(this),
					getInitResult: this.getInitResult.bind(this),
					getPeer: this.getPeer.bind(this)
				}, o = function(t, e, n) {
					return Object.assign(t, {
						config: e,
						id: Ke$1,
						registerState: n
					});
				}(e, this.mergeConfigs(), n);
				let s;
				this.state = o, this.extension.init && (s = this.extension.init(t, o.config, n)), this.state = function(t, e, n) {
					return Object.assign(t, {
						id: $e$1,
						initResult: e,
						registerState: n
					});
				}(o, s, i);
			}
			build(t) {
				const e = this.state;
				let n;
				e.id !== $e$1 && Ie$1(307, String(e.id), String(je$1)), this.extension.build && (n = this.extension.build(t, e.config, e.registerState));
				const i = {
					...e.registerState,
					getOutput: () => n,
					getSignal: this.getSignal.bind(this)
				};
				this.state = function(t, e, n) {
					return Object.assign(t, {
						id: je$1,
						output: e,
						registerState: n
					});
				}(e, n, i);
			}
			register(t, e) {
				this._signal = e;
				const n = this.state;
				n.id !== je$1 && Ie$1(308, String(n.id), String(je$1));
				const i = this.extension.register && this.extension.register(t, n.config, n.registerState);
				return this.state = function(t) {
					return Object.assign(t, { id: Te$1 });
				}(n), () => {
					const t = this.state;
					t.id !== ze$1 && Ie$1(309, String(n.id), String(ze$1)), this.state = function(t) {
						return Object.assign(t, { id: je$1 });
					}(t), i && i();
				};
			}
			afterRegistration(t) {
				const e = this.state;
				let n;
				return e.id !== Te$1 && Ie$1(310, String(e.id), String(Te$1)), this.extension.afterRegistration && (n = this.extension.afterRegistration(t, e.config, e.registerState)), this.state = function(t) {
					return Object.assign(t, { id: ze$1 });
				}(e), n;
			}
			getSignal() {
				return void 0 === this._signal && Ie$1(311), this._signal;
			}
			getInitResult() {
				void 0 === this.extension.init && Ie$1(312, this.extension.name);
				const t = this.state;
				return function(t) {
					return t.id >= $e$1;
				}(t) || Ie$1(313, String(t.id), String($e$1)), t.initResult;
			}
			getInitPeer(t) {
				const e = this.builder.extensionNameMap.get(t);
				return e ? e.getExtensionInitDependency() : void 0;
			}
			getExtensionInitDependency() {
				const t = this.state;
				return function(t) {
					return t.id >= Ke$1;
				}(t) || Ie$1(314, String(t.id), String(Ke$1)), { config: t.config };
			}
			getPeer(t) {
				const e = this.builder.extensionNameMap.get(t);
				return e ? e.getExtensionDependency() : void 0;
			}
			getInitDependency(t) {
				const e = this.builder.getExtensionRep(t);
				return void 0 === e && Ie$1(315, this.extension.name, t.name), e.getExtensionInitDependency();
			}
			getDependency(t) {
				const e = this.builder.getExtensionRep(t);
				return void 0 === e && Ie$1(315, this.extension.name, t.name), e.getExtensionDependency();
			}
			getState() {
				const t = this.state;
				return function(t) {
					return t.id >= ze$1;
				}(t) || Ie$1(316, String(t.id), String(ze$1)), t;
			}
			getDirectDependentNames() {
				return this.builder.incomingEdges.get(this.extension.name) || Ve$1;
			}
			getPeerNameSet() {
				let t = this._peerNameSet;
				return t || (t = new Set((this.extension.peerDependencies || []).map(([t]) => t)), this._peerNameSet = t), t;
			}
			getExtensionDependency() {
				if (!this._dependency) {
					const t = this.state;
					(function(t) {
						return t.id >= je$1;
					})(t) || Ie$1(317, this.extension.name), this._dependency = {
						config: t.config,
						init: t.initResult,
						output: t.output
					};
				}
				return this._dependency;
			}
		};
		const Ze$1 = { tag: HISTORY_MERGE_TAG };
		function He$1() {
			const t = $getRoot();
			t.isEmpty() && t.append($createParagraphNode());
		}
		const Je$1 = /* @__PURE__ */ defineExtension$1({
			config: /* @__PURE__ */ safeCast$1({
				setOptions: Ze$1,
				updateOptions: Ze$1
			}),
			init: ({ $initialEditorState: t = He$1 }) => ({
				$initialEditorState: t,
				initialized: !1
			}),
			afterRegistration(t, { updateOptions: e, setOptions: n }, i) {
				const o = i.getInitResult();
				if (!o.initialized) {
					o.initialized = !0;
					const { $initialEditorState: i } = o;
					if ($isEditorState(i)) t.setEditorState(i, n);
					else if ("function" == typeof i) t.update(() => {
						i(t);
					}, e);
					else if (i && ("string" == typeof i || "object" == typeof i)) {
						const e = t.parseEditorState(i);
						t.setEditorState(e, n);
					}
				}
				return () => {};
			},
			name: "@lexical/extension/InitialState",
			nodes: [
				RootNode,
				TextNode,
				LineBreakNode,
				TabNode,
				ParagraphNode
			]
		});
		const Xe$1 = Symbol.for("@lexical/extension/LexicalBuilder");
		function Ye$1(...t) {
			return nn$2.fromExtensions(t).buildEditor();
		}
		function qe$1() {}
		function Qe$1(t) {
			throw t;
		}
		function tn$2(t) {
			return Array.isArray(t) ? t : [t];
		}
		const en$2 = Me$1;
		var nn$2 = class nn$2 {
			roots;
			extensionNameMap;
			outgoingConfigEdges;
			incomingEdges;
			conflicts;
			_sortedExtensionReps;
			PACKAGE_VERSION;
			constructor(t) {
				this.outgoingConfigEdges = /* @__PURE__ */ new Map(), this.incomingEdges = /* @__PURE__ */ new Map(), this.extensionNameMap = /* @__PURE__ */ new Map(), this.conflicts = /* @__PURE__ */ new Map(), this.PACKAGE_VERSION = en$2, this.roots = t;
				for (const e of t) this.addExtension(e);
			}
			static fromExtensions(t) {
				const e = [tn$2(Je$1)];
				for (const n of t) e.push(tn$2(n));
				return new nn$2(e);
			}
			static maybeFromEditor(t) {
				const e = t[Xe$1];
				return e && (e.PACKAGE_VERSION !== en$2 && Ie$1(292, e.PACKAGE_VERSION, en$2), e instanceof nn$2 || Ie$1(293)), e;
			}
			static fromEditor(t) {
				const e = nn$2.maybeFromEditor(t);
				return void 0 === e && Ie$1(294), e;
			}
			constructEditor() {
				const { $initialEditorState: t, onError: e, onWarn: n, ...i } = this.buildCreateEditorArgs(), o = Object.assign(createEditor({
					...i,
					...e ? { onError: (t) => {
						e(t, o);
					} } : {},
					...n ? { onWarn: (t) => {
						n(t, o);
					} } : {}
				}), { [Xe$1]: this });
				for (const t of this.sortedExtensionReps()) t.build(o);
				return o;
			}
			buildEditor() {
				let t = qe$1;
				function e() {
					try {
						t();
					} finally {
						t = qe$1;
					}
				}
				const n = Object.assign(this.constructEditor(), {
					dispose: e,
					[Symbol.dispose]: e
				});
				return t = mergeRegister$1(this.registerEditor(n), () => n.setRootElement(null)), n;
			}
			hasExtensionByName(t) {
				return this.extensionNameMap.has(t);
			}
			getExtensionRep(t) {
				const e = this.extensionNameMap.get(t.name);
				if (e) return e.extension !== t && Ie$1(295, t.name), e;
			}
			addEdge(t, e, n) {
				const i = this.outgoingConfigEdges.get(t);
				i ? i.set(e, n) : this.outgoingConfigEdges.set(t, /* @__PURE__ */ new Map([[e, n]]));
				const o = this.incomingEdges.get(e);
				o ? o.add(t) : this.incomingEdges.set(e, /* @__PURE__ */ new Set([t]));
			}
			addExtension(t) {
				void 0 !== this._sortedExtensionReps && Ie$1(296);
				const [n] = tn$2(t);
				"string" != typeof n.name && Ie$1(297, typeof n.name);
				let i = this.extensionNameMap.get(n.name);
				if (void 0 !== i && i.extension !== n && Ie$1(298, n.name), !i) {
					i = new Ge$1(this, n), this.extensionNameMap.set(n.name, i);
					const t = this.conflicts.get(n.name);
					"string" == typeof t && Ie$1(299, n.name, t);
					for (const t of n.conflictsWith || []) this.extensionNameMap.has(t) && Ie$1(299, n.name, t), this.conflicts.set(t, n.name);
					for (const t of n.dependencies || []) {
						const e = tn$2(t);
						this.addEdge(n.name, e[0].name, e.slice(1)), this.addExtension(e);
					}
					for (const [t, e] of n.peerDependencies || []) this.addEdge(n.name, t, e ? [e] : []);
				}
			}
			sortedExtensionReps() {
				if (this._sortedExtensionReps) return this._sortedExtensionReps;
				const t = [], e = (n, i) => {
					let o = n.state;
					if (We$1(o)) return;
					const s = n.extension.name;
					var r;
					Ue$1(o) || Ie$1(300, s, i || "[unknown]"), Ue$1(r = o) || Ie$1(304, String(r.id), String(Ae$1)), o = Object.assign(r, { id: Pe$1 }), n.state = o;
					const c = this.outgoingConfigEdges.get(s);
					if (c) for (const t of c.keys()) {
						const n = this.extensionNameMap.get(t);
						n && e(n, s);
					}
					o = Be$1(o), n.state = o, t.push(n);
				};
				for (const t of this.extensionNameMap.values()) Ue$1(t.state) && e(t);
				for (const e of t) for (const [t, n] of this.outgoingConfigEdges.get(e.extension.name) || []) if (n.length > 0) {
					const e = this.extensionNameMap.get(t);
					if (e) for (const t of n) e.configs.add(t);
				}
				for (const [t, ...e] of this.roots) if (e.length > 0) {
					const n = this.extensionNameMap.get(t.name);
					void 0 === n && Ie$1(301, t.name);
					for (const t of e) n.configs.add(t);
				}
				return this._sortedExtensionReps = t, this._sortedExtensionReps;
			}
			registerEditor(t) {
				const e = this.sortedExtensionReps(), n = new AbortController(), i = [() => n.abort()], o = n.signal;
				for (const n of e) {
					const e = n.register(t, o);
					e && i.push(e);
				}
				for (const n of e) {
					const e = n.afterRegistration(t);
					e && i.push(e);
				}
				return mergeRegister$1(...i);
			}
			buildCreateEditorArgs() {
				const t = {}, e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), o = {}, s = {}, r = this.sortedExtensionReps();
				for (const c of r) {
					const { extension: r } = c;
					if (void 0 !== r.onError && (t.onError = r.onError), void 0 !== r.onWarn && (t.onWarn = r.onWarn), void 0 !== r.disableEvents && (t.disableEvents = r.disableEvents), void 0 !== r.parentEditor && (t.parentEditor = r.parentEditor), void 0 !== r.editable && (t.editable = r.editable), void 0 !== r.namespace && (t.namespace = r.namespace), void 0 !== r.$initialEditorState && (t.$initialEditorState = r.$initialEditorState), r.nodes) for (const t of ve$1(r)) {
						if ("function" != typeof t) {
							const e = n.get(t.replace);
							e && Ie$1(302, r.name, t.replace.name, e.extension.name), n.set(t.replace, c);
						}
						e.add(t);
					}
					if (r.html) {
						if (r.html.export) for (const [t, e] of r.html.export.entries()) i.set(t, e);
						r.html.import && Object.assign(o, r.html.import);
					}
					r.theme && _e$1(s, r.theme);
				}
				Object.keys(s).length > 0 && (t.theme = s), e.size && (t.nodes = [...e]);
				const c = Object.keys(o).length > 0, a = i.size > 0;
				(c || a) && (t.html = {}, c && (t.html.import = o), a && (t.html.export = i));
				for (const e of r) e.init(t);
				return t.onError || (t.onError = Qe$1), t;
			}
		};
		function on$2(t, e) {
			const n = nn$2.fromEditor(t).getExtensionRep(e);
			return void 0 === n && Ie$1(303, e.name), n.getExtensionDependency();
		}
		function sn$2(t, e) {
			const n = nn$2.maybeFromEditor(t);
			if (!n) return;
			const i = n.extensionNameMap.get(e);
			return i ? i.getExtensionDependency() : void 0;
		}
		function rn$2(t, e) {
			const n = sn$2(t, e);
			return void 0 === n && Ie$1(291, e), n;
		}
		function cn$2(t) {
			return on$2($getEditor(), t);
		}
		function an$2(t) {
			return cn$2(t).output;
		}
		function dn$2(t) {
			return sn$2($getEditor(), t);
		}
		const ln$2 = /* @__PURE__ */ new Set();
		const un$2 = /* @__PURE__ */ defineExtension$1({
			build(t, e, n) {
				const i = n.getDependency(De$1).output, o = Yt$3({ watchedNodeKeys: /* @__PURE__ */ new Map() }), s = Ce$1(() => {}, () => ce$1(() => {
					const t = s.peek(), { watchedNodeKeys: e } = o.value;
					let n, c = !1;
					i.value.read(() => {
						if ($getSelection()) for (const [i, o] of e.entries()) {
							if (0 === o.size) {
								e.delete(i);
								continue;
							}
							const s = $getNodeByKey(i), r = s && s.isSelected() || !1;
							c = c || r !== (!!t && t.has(i)), r && (n = n || /* @__PURE__ */ new Set(), n.add(i));
						}
					}), !c && n && t && n.size === t.size || (s.value = n);
				}));
				return { watchNodeKey: function(t) {
					const e = ne$2(() => (s.value || ln$2).has(t)), { watchedNodeKeys: n } = o.peek();
					let i = n.get(t);
					const r = void 0 !== i;
					return i = i || /* @__PURE__ */ new Set(), i.add(e), r || (n.set(t, i), o.value = { watchedNodeKeys: n }), e;
				} };
			},
			dependencies: [De$1],
			name: "@lexical/extension/NodeSelection"
		});
		const fn$2 = /* @__PURE__ */ createCommand("INSERT_HORIZONTAL_RULE_COMMAND");
		var hn$2 = class extends DecoratorNode {
			$config() {
				return this.config("horizontalrule", { importDOM: { hr: () => ({
					conversion: gn$2,
					priority: 0
				}) } });
			}
			exportDOM() {
				return { element: $getDocument().createElement("hr") };
			}
			createDOM(t) {
				const e = $getDocument().createElement("hr");
				return addClassNamesToElement$1(e, t.theme.hr), e;
			}
			getTextContent() {
				return "\n";
			}
			isInline() {
				return !1;
			}
			updateDOM() {
				return !1;
			}
		};
		function gn$2() {
			return { node: pn$2() };
		}
		function pn$2() {
			return $create(hn$2);
		}
		function mn$2(t) {
			return t instanceof hn$2;
		}
		const vn$2 = /* @__PURE__ */ defineExtension$1({
			dependencies: [De$1, un$2],
			name: "@lexical/extension/HorizontalRule",
			nodes: () => [hn$2],
			register(t, e, n) {
				const { watchNodeKey: i } = n.getDependency(un$2).output, s = Yt$3({ nodeSelections: /* @__PURE__ */ new Map() }), c = t._config.theme.hrSelected ?? "selected";
				return mergeRegister$1(t.registerCommand(fn$2, (t) => {
					const e = $getSelection();
					if (!$isRangeSelection(e)) return !1;
					if (null !== e.focus.getNode()) {
						const t = pn$2();
						$insertNodeToNearestRoot(t);
					}
					return !0;
				}, COMMAND_PRIORITY_EDITOR), t.registerCommand(CLICK_COMMAND, (t) => {
					if (isDOMNode(t.target)) {
						const e = $getNodeFromDOMNode(t.target);
						if (mn$2(e)) return function(t, e = !1) {
							const n = $getSelection(), i = t.isSelected(), o = t.getKey();
							let s;
							e && $isNodeSelection(n) ? s = n : (s = $createNodeSelection(), $setSelection(s)), i ? s.delete(o) : s.add(o);
						}(e, t.shiftKey), !0;
					}
					return !1;
				}, COMMAND_PRIORITY_LOW), t.registerMutationListener(hn$2, (e, n) => {
					jt$3(() => {
						let n = !1;
						const { nodeSelections: o } = s.peek();
						for (const [s, r] of e.entries()) if ("destroyed" === r) o.delete(s), n = !0;
						else {
							const e = o.get(s), r = t.getElementByKey(s);
							e ? e.domNode.value = r : (n = !0, o.set(s, {
								domNode: Yt$3(r),
								selectedSignal: i(s)
							}));
						}
						n && (s.value = { nodeSelections: o });
					});
				}), ce$1(() => {
					const t = [];
					for (const { domNode: e, selectedSignal: n } of s.value.nodeSelections.values()) t.push(ce$1(() => {
						const t = e.value;
						if (t) n.value ? addClassNamesToElement$1(t, c) : removeClassNamesFromElement$1(t, c);
					}));
					return mergeRegister$1(...t);
				}));
			}
		});
		const xn$2 = /* @__PURE__ */ defineExtension$1({
			build: (t) => ({
				composingTextNode: Yt$3(null),
				compositionKey: Yt$3(null)
			}),
			name: "@lexical/extension/IME",
			register(t, e, n) {
				const { compositionKey: i, composingTextNode: o } = n.getOutput(), s = t.registerCommand(COMPOSITION_START_COMMAND, () => {
					const t = $getSelection();
					return $isRangeSelection(t) && (i.value = t.anchor.key), !1;
				}, COMMAND_PRIORITY_BEFORE_EDITOR), c = ce$1(() => {
					const e = i.value;
					o.value = null !== e ? t.read("latest", () => {
						const t = $getNodeByKey(e);
						return $isTextNode(t) ? t : null;
					}) : null;
				}), d = t.registerUpdateListener(({ tags: t, editorState: e }) => {
					t.has(COMPOSITION_START_TAG) && e.read(() => {
						const t = $getSelection();
						if (!$isRangeSelection(t)) return;
						const e = t.anchor.getNode();
						$isTextNode(e) && (o.value = e);
					});
				}), l = t.registerRootListener((t) => {
					if (null === t) return void (i.value = null);
					return registerEventListener(t, "compositionend", () => {
						i.value = null;
					});
				});
				return mergeRegister$1(s, c, d, l);
			}
		});
		const yn$2 = /* @__PURE__ */ defineExtension$1({
			build: (t, e) => ae$1({ inheritEditableFromParent: e.inheritEditableFromParent }),
			config: /* @__PURE__ */ safeCast$1({
				$getParentEditor: function() {
					const t = $getEditor();
					return nn$2.fromEditor(t), t;
				},
				inheritEditableFromParent: !1
			}),
			init: (t, e, n) => {
				const i = e.$getParentEditor();
				t.parentEditor = i, t.theme = t.theme || i._config.theme;
			},
			name: "@lexical/extension/NestedEditor",
			register: (t, e, n) => ce$1(() => {
				const e = t._parentEditor;
				if (e && n.getOutput().inheritEditableFromParent.value) return t.setEditable(e.isEditable()), e.registerEditableListener(t.setEditable.bind(t));
			})
		});
		const En$2 = /* @__PURE__ */ defineExtension$1({
			config: /* @__PURE__ */ safeCast$1({
				attribute: "data-selected",
				nodes: []
			}),
			init(t, e) {
				const n = /* @__PURE__ */ new Set(), i = getRegisteredSubtypeMap(me$1(t).nodes);
				for (const t of e.nodes) {
					const e = t.getType(), o = i.get(e);
					void 0 === o && Ie$1(339, t.name, e), n.add(e);
					for (const t of o) n.add(t);
				}
				return { matchTypes: n };
			},
			mergeConfig: (t, e) => shallowMergeConfig$1(t, {
				...e,
				...e.nodes && { nodes: [...t.nodes, ...e.nodes] }
			}),
			name: "@lexical/extension/NodeSelectionDataSelected",
			register(t, e, n) {
				const { attribute: i } = e, { matchTypes: o } = n.getInitResult(), s = /* @__PURE__ */ new Map(), c = (e) => {
					const n = /* @__PURE__ */ new Set();
					e.read(() => {
						const t = $getSelection();
						if ($isNodeSelection(t)) for (const e of t.getNodes()) o.has(e.getType()) && n.add(e.getKey());
					});
					for (const [t, e] of s) n.has(t) || (e.removeAttribute(i), s.delete(t));
					for (const e of n) {
						const n = t.getElementByKey(e);
						null !== n && (n.setAttribute(i, "true"), s.set(e, n));
					}
				};
				c(t.getEditorState());
				const a = t.registerUpdateListener(({ editorState: t }) => c(t));
				return () => {
					a();
					for (const t of s.values()) t.removeAttribute(i);
					s.clear();
				};
			}
		});
		function bn$2(t) {
			$isElementNode(t) && t.isInline() && t.isEmpty() && t.remove();
		}
		const Sn$2 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({ disabled: !1 }),
			name: "@lexical/NormalizeInlineElements",
			register: (t, e, n) => {
				const i = n.getOutput();
				return ce$1(() => {
					if (!i.disabled.value) {
						const e = [];
						for (const { klass: n, transforms: i } of t._nodes.values()) n.prototype instanceof ElementNode && n.prototype.isInline !== ElementNode.prototype.isInline && (i.add(bn$2), e.push(() => i.delete(bn$2)));
						return () => e.forEach((t) => t());
					}
				});
			}
		});
		const wn$2 = /* @__PURE__ */ new Set([SKIP_SELECTION_FOCUS_TAG, SKIP_SCROLL_INTO_VIEW_TAG]);
		const Nn$2 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({
				$fixFocusOverselection: function() {
					const t = $getSelection();
					if ($isRangeSelection(t) && !t.isCollapsed()) {
						const e = $getCaretRangeInDirection($caretRangeFromSelection(t), "next");
						let n = e.focus;
						for ($isTextPointCaret(n) && e.anchor.origin !== n.origin && 0 === n.offset && (n = $rewindSiblingCaret(n.getSiblingCaret())), $isSiblingCaret(n) && e.anchor.origin !== n.origin && $isLineBreakNode(n.origin) && (n = $rewindSiblingCaret(n)); $isChildCaret(n) && e.anchor.origin !== n.origin;) n = $rewindSiblingCaret($getSiblingCaret(n.origin, "next"));
						if ($isSiblingCaret(n) && $isElementNode(n.origin) && (n = $normalizeCaret($getChildCaret(n.origin, "previous")).getFlipped()), n = $normalizeCaret(n), !n.isSamePointCaret(e.focus)) {
							const t = $setSelectionFromCaretRange($getCaretRange(e.anchor, n)), i = $getEditor().getRootElement(), o = i && getDOMSelection(i.ownerDocument.defaultView);
							o && $updateDOMSelection($getPreviousSelection(), t, $getEditor(), o, wn$2, i);
						}
					}
				},
				dateNow: Date.now,
				disabled: !1,
				thresholdMsec: 100
			}),
			name: "@lexical/NormalizeTripleClickSelection",
			register: (t, e, n) => ce$1(() => {
				const e = n.getOutput();
				if (!e.disabled.value) return t.registerRootListener((n) => {
					if (!n) return;
					let i = 0;
					const o = (t) => {
						if (t ? 3 === t.detail : i > 0) {
							const n = e.dateNow.peek()();
							i = t && "mousedown" === t.type || n - i <= e.thresholdMsec.peek() ? n : 0;
						}
						return i;
					};
					return mergeRegister$1(t.registerCommand(SELECTION_CHANGE_COMMAND, () => (o(null) && (i = 0, e.$fixFocusOverselection.peek()()), !1), COMMAND_PRIORITY_BEFORE_CRITICAL), registerEventListeners(n, {
						mousedown: o,
						mouseup: o
					}, !0));
				});
			})
		});
		function On$2(t) {
			const e = t.target;
			isExactShortcutMatch(t, "a", {
				ctrlKey: !IS_APPLE$1,
				metaKey: IS_APPLE$1
			}) && isHTMLElement$1(e) && ("INPUT" === e.tagName || "TEXTAREA" === e.tagName) && e.addEventListener("keydown", stopLexicalPropagation, { once: !0 });
		}
		const Rn$1 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({ disabled: !1 }),
			name: "@lexical/extension/PreventSelectAll",
			register: (t, e, n) => {
				const i = n.getOutput();
				return ce$1(() => {
					if (!i.disabled.value) return t.registerRootListener((t) => {
						if (t) return registerEventListener(t, "keydown", On$2, !0);
					});
				});
			}
		});
		const Cn$2 = /* @__PURE__ */ defineExtension$1({
			build: (t) => Ce$1(() => t.getRootElement(), (e) => t.registerRootListener((t) => {
				e.value = t;
			})),
			name: "@lexical/extension/RootElement"
		});
		const Dn$2 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({
				cascadeSelection: !1,
				disabled: !1
			}),
			dependencies: [Rn$1],
			name: "@lexical/extension/SelectBlock",
			register: (t, e, n) => {
				const i = n.getOutput(), o = n.getDependency(Rn$1).output;
				return mergeRegister$1(ce$1(() => {
					o.disabled.value = i.disabled.value;
				}), ce$1(() => {
					if (!i.disabled.value) return t.registerCommand(SELECT_ALL_COMMAND, (e, n) => {
						if (n !== t) {
							if (!i.cascadeSelection.peek()) return !1;
							return !!n.read("pending", () => {
								const t = $getSelection();
								return $isRangeSelection(t) && $isBlockFullySelected($getRoot(), t);
							}) && ($selectAll$1(), !0);
						}
						const o = $getSelection();
						if ($isNodeSelection(o)) {
							const t = o.getNodes(), e = t[0];
							if (!e) return !1;
							const n = e.getTopLevelElement();
							return !n || $isRootNode(n) || n.is(e) || t.length > 1 && (c = n, !t.every((t) => c.is(t.getTopLevelElement()))) ? $selectAll$1() : $isElementNode(n) && n.select(0, n.getChildrenSize()), !0;
						}
						var c;
						if (!$isRangeSelection(o)) return !1;
						const d = o.anchor.getNode(), u = d.getTopLevelElement();
						if (u && u.is(o.focus.getNode().getTopLevelElement()) && !$isBlockFullySelected(u, o)) return u.select(0, u.getChildrenSize()), !0;
						let f = $getSlotFrame(d);
						for (; null !== f;) {
							if ($isElementNode(f) && !$isBlockFullySelected(f, o)) return f.select(0, f.getChildrenSize()), !0;
							const t = $getSlotHost(f);
							f = null === t ? null : $getSlotFrame(t);
						}
						return $isBlockFullySelected($getRoot(), o) || $selectAll$1(), !0;
					}, COMMAND_PRIORITY_LOW);
				}));
			}
		});
		const In$1 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({
				disabled: !1,
				onReposition: void 0
			}),
			name: "@lexical/utils/SelectionAlwaysOnDisplay",
			register: (t, e, n) => {
				const i = n.getOutput();
				return ce$1(() => {
					if (!i.disabled.value) return selectionAlwaysOnDisplay(t, i.onReposition.value);
				});
			}
		});
		function Fn$1(t) {
			return t.canIndent();
		}
		function Mn$2(t, e, n = Fn$1) {
			return mergeRegister$1(t.registerCommand(KEY_TAB_COMMAND, (e) => {
				const n = $getSelection();
				if (!$isRangeSelection(n)) return !1;
				e.preventDefault();
				const i = function(t) {
					if (t.getNodes().filter((t) => $isBlockElementNode(t) && t.canIndent()).length > 0) return !0;
					const e = t.anchor, n = t.focus, i = n.isBefore(e) ? n : e, o = i.getNode(), s = $getNearestBlockElementAncestorOrThrow(o);
					if (s.canIndent()) {
						const t = s.getKey();
						let e = $createRangeSelection();
						if (e.anchor.set(t, 0, "element"), e.focus.set(t, 0, "element"), e = $normalizeSelection__EXPERIMENTAL(e), e.anchor.is(i)) return !0;
					}
					return !1;
				}(n) ? e.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND : INSERT_TAB_COMMAND;
				return t.dispatchCommand(i);
			}, COMMAND_PRIORITY_EDITOR), t.registerCommand(INDENT_CONTENT_COMMAND, () => {
				const t = "number" == typeof e ? e : e ? e.peek() : null, i = $getSelection();
				if (!$isRangeSelection(i)) return !1;
				const o = "function" == typeof n ? n : n.peek();
				return $handleIndentAndOutdent((e) => {
					if (o(e)) {
						const n = e.getIndent() + 1;
						(!t || n < t) && e.setIndent(n);
					}
				});
			}, COMMAND_PRIORITY_CRITICAL));
		}
		const kn$2 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => ae$1(e),
			config: /* @__PURE__ */ safeCast$1({
				$canIndent: Fn$1,
				disabled: !1,
				maxIndent: null
			}),
			name: "@lexical/extension/TabIndentation",
			register(t, e, n) {
				const { disabled: i, maxIndent: o, $canIndent: s } = n.getOutput();
				return ce$1(() => {
					if (!i.value) return Mn$2(t, o, s);
				});
			}
		});
		const _n$1 = /* @__PURE__ */ defineExtension$1({
			build: (t) => Ce$1(() => t.isEditable(), (e) => t.registerEditableListener((t) => {
				e.value = t;
			})),
			name: "@lexical/extension/WatchEditable"
		});
		//#endregion
		//#region node_modules/@lexical/extension/dist/LexicalExtension.mjs
		const mod$8 = LexicalExtension_prod_exports;
		mod$8.$applyFormatToDom;
		const $createHorizontalRuleNode = mod$8.$createHorizontalRuleNode;
		mod$8.$defaultShouldInsertAfter;
		mod$8.$getExtensionDependency;
		const $getExtensionOutput = mod$8.$getExtensionOutput;
		const $getPeerDependency = mod$8.$getPeerDependency;
		mod$8.$isDecoratorTextNode;
		mod$8.$isHorizontalRuleNode;
		mod$8.AutoFocusExtension;
		mod$8.ClearEditorExtension;
		mod$8.ClickAfterLastBlockExtension;
		mod$8.DecoratorTextExtension;
		mod$8.DecoratorTextNode;
		mod$8.EditorStateExtension;
		const HorizontalRuleExtension = mod$8.HorizontalRuleExtension;
		const HorizontalRuleNode = mod$8.HorizontalRuleNode;
		mod$8.IMEExtension;
		mod$8.INSERT_HORIZONTAL_RULE_COMMAND;
		mod$8.InitialStateExtension;
		mod$8.LexicalBuilder;
		mod$8.NestedEditorExtension;
		mod$8.NodeSelectionDataSelectedExtension;
		mod$8.NodeSelectionExtension;
		const NormalizeInlineElementsExtension = mod$8.NormalizeInlineElementsExtension;
		const NormalizeTripleClickSelectionExtension = mod$8.NormalizeTripleClickSelectionExtension;
		mod$8.PreventSelectAllExtension;
		mod$8.RootElementExtension;
		mod$8.SelectBlockExtension;
		mod$8.SelectionAlwaysOnDisplayExtension;
		mod$8.TabIndentationExtension;
		mod$8.WatchEditableExtension;
		mod$8.applyFormatFromStyle;
		mod$8.applyFormatToDom;
		const batch = mod$8.batch;
		mod$8.buildEditorFromExtensions;
		mod$8.computed;
		const configExtension = mod$8.configExtension;
		mod$8.declarePeerDependency;
		mod$8.defineExtension;
		const effect = mod$8.effect;
		mod$8.getExtensionDependencyFromEditor;
		const getKnownTypesAndNodes = mod$8.getKnownTypesAndNodes;
		const getPeerDependencyFromEditor = mod$8.getPeerDependencyFromEditor;
		mod$8.getPeerDependencyFromEditorOrThrow;
		const namedSignals = mod$8.namedSignals;
		mod$8.registerClearEditor;
		mod$8.registerTabIndentation;
		mod$8.safeCast;
		mod$8.shallowMergeConfig;
		const signal = mod$8.signal;
		mod$8.untracked;
		const watchedSignal = mod$8.watchedSignal;
		//#endregion
		//#region node_modules/@lexical/html/dist/LexicalHtml.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalHtml_prod_exports = /* @__PURE__ */ __exportAll({
			$appendNodeToHTML: () => An$1,
			$distributeInlineWrapper: () => Re,
			$generateDOMFromNodes: () => Dn$1,
			$generateDOMFromRoot: () => wn$1,
			$generateHtmlFromNodes: () => On$1,
			$generateNodesFromDOM: () => kn$1,
			$generateNodesFromDOMViaExtension: () => xn$1,
			$getImportContextValue: () => Ee,
			$getRenderContextValue: () => wt$4,
			$getSessionDOMRenderConfig: () => Nt$5,
			$inlineStylesFromStyleSheets: () => gt$4,
			$isBlockLevel: () => We,
			$propagateTextAlignToBlockChildren: () => Fe,
			$setRenderContextValue: () => Mt$4,
			$updateRenderContextValue: () => At$5,
			$withImportContext: () => Ie,
			$withRenderContext: () => Et$4,
			BlockSchema: () => Pe,
			CoreImportExtension: () => Sn$1,
			CoreImportRules: () => nn$1,
			DOMImportExtension: () => yn$1,
			DOMRenderExtension: () => oe$1,
			HorizontalRuleImportExtension: () => vn$1,
			HorizontalRuleImportRules: () => $n$1,
			ImportOverlays: () => Me,
			ImportSource: () => ve,
			ImportSourceDataTransfer: () => Ce,
			ImportTextFormat: () => be,
			ImportTextStyle: () => ke,
			ImportWhitespaceConfig: () => Oe,
			InlineSchema: () => je,
			NestedBlockSchema: () => ze,
			RenderContextExport: () => kt$4,
			RenderContextRoot: () => bt$5,
			RootSchema: () => _e,
			contextUpdater: () => at$3,
			contextValue: () => ft$4,
			createImportState: () => $e,
			createRenderState: () => Ct$5,
			defaultIsInline: () => we,
			defaultPreservesWhitespace: () => De,
			defineImportRule: () => Se,
			defineOverlayRules: () => fn$1,
			domOverride: () => It$3,
			isElementOfTag: () => he,
			parseSelector: () => xe,
			sel: () => Cn$1
		});
		function nt$3(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			throw n.search = o.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		let ot$3;
		function rt$3(t, e) {
			const { key: n } = e;
			return t && n in t ? t[n] : e.defaultValue;
		}
		function st$3(t) {
			return ot$3 && ot$3.editor === t ? ot$3 : void 0;
		}
		function it$3(t, e) {
			const n = st$3(e);
			return n && n[t];
		}
		function ct$3(t, e) {
			if ("cfg" in e) {
				const { cfg: n, updater: o } = e;
				return [n, o(rt$3(t, n))];
			}
			return e;
		}
		function lt$3(t, e) {
			let n = e;
			for (const o of t) {
				const [t, r] = ct$3(n, o), s = t.key;
				if (n === e && rt$3(n, t) === r) continue;
				const i = n === e || void 0 === n ? ut$3(e) : n;
				i[s] = r, n = i;
			}
			return n;
		}
		function ut$3(t) {
			return Object.create(t || null);
		}
		function ft$4(t, e) {
			return [t, e];
		}
		function at$3(t, e) {
			return {
				cfg: t,
				updater: e
			};
		}
		function dt$5(t, n, o, r = $getEditor()) {
			const s = ot$3, i = st$3(r);
			try {
				return ot$3 = {
					...i,
					editor: r,
					[t]: n
				}, o();
			} finally {
				ot$3 = s;
			}
		}
		function pt$5(t, n = () => {}) {
			return (o, r = $getEditor()) => (e) => {
				const s = st$3(r), i = s && s[t], c = lt$3(o, i || n(r));
				return c && c !== i ? dt$5(t, c, e, r) : e();
			};
		}
		function ht$5(t, e, o, r) {
			return Object.assign(createState(Symbol(e), {
				isEqual: r,
				parse: o
			}), { [t]: !0 });
		}
		const gt$4 = (t, e, n) => {
			mt$5(t), n();
		};
		function mt$5(t) {
			if (!isDOMDocumentNode(t)) return;
			const e = t;
			if (null === e.querySelector("style")) return;
			const n = /* @__PURE__ */ new Map();
			function s(t) {
				let e = n.get(t);
				if (void 0 === e) {
					e = /* @__PURE__ */ new Set();
					for (let n = 0; n < t.style.length; n++) e.add(t.style[n]);
					n.set(t, e);
				}
				return e;
			}
			try {
				for (const t of Array.from(e.styleSheets)) {
					let n;
					try {
						n = t.cssRules;
					} catch (t) {
						continue;
					}
					for (const t of Array.from(n)) {
						if (!objectKlassEquals(t, CSSStyleRule)) continue;
						let n;
						try {
							n = e.querySelectorAll(t.selectorText);
						} catch (t) {
							continue;
						}
						for (const e of Array.from(n)) {
							if (!isHTMLElement$1(e)) continue;
							const n = s(e);
							for (let o = 0; o < t.style.length; o++) {
								const r = t.style[o];
								n.has(r) || e.style.setProperty(r, t.style.getPropertyValue(r), t.style.getPropertyPriority(r));
							}
						}
					}
				}
			} catch (t) {}
		}
		const yt$4 = "@lexical/html/DOM";
		const xt$5 = Symbol.for("@lexical/html/DOMExportContext");
		const St$5 = "@lexical/html/DOMImport";
		const $t$4 = Symbol.for("@lexical/html/DOMImportContext");
		const vt$5 = () => !0;
		function Ct$5(t, e, n) {
			return ht$5(xt$5, t, e, n);
		}
		const bt$5 = /* @__PURE__ */ Ct$5("root", Boolean);
		const kt$4 = /* @__PURE__ */ Ct$5("isExport", Boolean);
		function Dt$4(t) {
			const e = getPeerDependencyFromEditor(t, yt$4);
			return e ? e.output.defaults : void 0;
		}
		function wt$4(t, n = $getEditor()) {
			return rt$3(function(t) {
				return it$3(xt$5, t) || Dt$4(t);
			}(n), t);
		}
		function Ot$5(t) {
			const e = getPeerDependencyFromEditor(t, yt$4);
			return e ? e.output.runtime : void 0;
		}
		function Mt$4(t, n, o = $getEditor()) {
			const r = Ot$5(o);
			r && r.setContextValue(t, n);
		}
		function At$5(t, n, o = $getEditor()) {
			const r = Ot$5(o);
			r && r.setContextValue(t, n(rt$3(r.editorContext, t)));
		}
		function Nt$5(t = $getEditor()) {
			const n = Ot$5(t);
			return n ? n.getSessionConfig() : $getEditorDOMRenderConfig(t);
		}
		const Et$4 = pt$5(xt$5, Dt$4);
		function It$3(t, e, n) {
			return {
				...e,
				...n,
				nodes: t
			};
		}
		function Wt$2(t) {
			return (e) => e instanceof t;
		}
		function Rt$5(t, { nodes: e }) {
			if ("*" === e) return vt$5;
			let n = {};
			const o = [];
			for (const r of e) if ("getType" in r) {
				const e = r.getType();
				if (n) {
					const o = t.get(e);
					void 0 === o && nt$3(339, r.name, e);
					for (const t of o) n[t] = !0;
				}
				o.push(Wt$2(r));
			} else n = void 0, o.push(r);
			return n || (1 === o.length ? o[0] : (t) => {
				for (const e of o) if (e(t)) return !0;
				return !1;
			});
		}
		function Ft$4(t) {
			return (e, n, o) => t(e, o);
		}
		function Tt$5(t) {
			return (e, n, o, r) => t(e, n, r);
		}
		function Pt$5(t) {
			return (e, n, o, r, s) => t(e, n, o, s);
		}
		function jt$2(t) {
			return (e, n, o, r, s, i) => t(e, n, o, r, i);
		}
		function zt$3(t, e) {
			return (n, o) => {
				const r = () => t(n, o), s = e(n);
				return s ? s(n, r, o) : r();
			};
		}
		function _t$4(t, e) {
			return (n, o, r) => {
				const s = () => t(n, o, r), i = e(n);
				return i ? i(n, o, s, r) : s();
			};
		}
		const Lt$4 = _t$4;
		const Ut$3 = Tt$5;
		function Bt$3(t, e) {
			return (n, o, r, s) => {
				const i = () => t(n, o, r, s), c = e(n);
				return c ? c(n, o, r, i, s) : i();
			};
		}
		function Vt$2(t, e) {
			return (n, o, r, s, i) => {
				const c = () => t(n, o, r, s, i), l = e(n);
				return l ? l(n, o, r, s, c, i) : c();
			};
		}
		function qt$3(t, e) {
			return (n, o, r, s) => {
				t(n, o, r, s);
				const i = e(n);
				i && i(n, o, r, s);
			};
		}
		function Gt$2(t, e, n, o, r) {
			let s = n[e];
			for (const n of t[e]) if ("function" == typeof n[0]) {
				const [t, e] = n;
				s = o(s, (n) => t(n) && e || void 0);
			} else {
				const t = n[1], e = {};
				for (const n in t) {
					const r = t[n];
					r && (e[n] = r.reduce((t, e) => o(t, () => e), s));
				}
				s = o(s, (t) => {
					const n = e[t.getType()];
					return n && r(n);
				});
			}
			n[e] = s;
		}
		function Ht$2(t, e, n, o) {
			if (!o) return;
			const r = t[e];
			if ("function" == typeof n) r.push([n, o]);
			else {
				const t = r[r.length - 1];
				let e;
				t && "types" === t[0] ? e = t[1] : (e = {}, r.push(["types", e]));
				for (const t in n) {
					const n = e[t] || [];
					e[t] = n, n.push(o);
				}
			}
		}
		function Jt$2(t) {
			return "*" === t.nodes;
		}
		function Qt$2(t, e) {
			const n = getRegisteredSubtypeMap(getKnownTypesAndNodes(t).nodes), o = {
				$createDOM: [],
				$decorateDOM: [],
				$exportDOM: [],
				$extractWithChild: [],
				$getDOMSlot: [],
				$getSlotTargetElement: [],
				$shouldExclude: [],
				$shouldInclude: [],
				$updateDOM: []
			};
			for (const t of function(t) {
				const e = [], n = [], o = [];
				for (const r of t) if (Jt$2(r)) e.push(r);
				else if (Array.isArray(r.nodes)) for (const t of r.nodes) $isLexicalNode(t.prototype) ? o.push(1 === r.nodes.length ? r : {
					...r,
					nodes: [t]
				}) : n.push(1 === r.nodes.length ? r : {
					...r,
					nodes: [t]
				});
				const r = /* @__PURE__ */ new Map(), s = (t) => {
					let e = r.get(t);
					if (void 0 === e) {
						e = -1;
						for (const n of iterStaticNodeConfigChain(t)) e++;
						r.set(t, e);
					}
					return e;
				};
				return o.sort((t, e) => s(t.nodes[0]) - s(e.nodes[0])), [
					...o,
					...n,
					...e
				];
			}(e)) {
				const e = Rt$5(n, t);
				for (const n in o) Ht$2(o, n, e, t[n]);
			}
			return o;
		}
		function Kt$4(t) {
			return t;
		}
		function Yt$2(t, { overrides: e }) {
			const n = Qt$2(t, e), o = {
				...DEFAULT_EDITOR_DOM_CONFIG,
				...t.dom
			};
			return Gt$2(n, "$createDOM", o, zt$3, Ft$4), Gt$2(n, "$exportDOM", o, zt$3, Ft$4), Gt$2(n, "$extractWithChild", o, Vt$2, jt$2), Gt$2(n, "$getDOMSlot", o, Lt$4, Ut$3), Gt$2(n, "$shouldExclude", o, _t$4, Tt$5), Gt$2(n, "$shouldInclude", o, _t$4, Tt$5), Gt$2(n, "$getSlotTargetElement", o, Bt$3, Pt$5), Gt$2(n, "$updateDOM", o, Bt$3, Pt$5), Gt$2(n, "$decorateDOM", o, qt$3, Kt$4), o;
		}
		function Zt$2(t) {
			return { get: (e) => rt$3(t, e) };
		}
		function Xt$2(t) {
			const e = Object.create(null);
			return lt$3(t, e) || e;
		}
		function te$1(t, e) {
			const n = Zt$2(e);
			return t.filter((t) => !(t.disabledForEditor && t.disabledForEditor(n)));
		}
		function ee$1(t) {
			if ("*" === t.nodes) return () => !0;
			const e = t.nodes.map((t) => {
				const e = t;
				return $isLexicalNode(e.prototype) ? (t) => t instanceof e : t;
			});
			return (t) => e.some((e) => e(t));
		}
		var ne$1 = class {
			editor;
			initialEditorConfig;
			overrides;
			editorContext;
			hasSessionGates;
			installed;
			sessionCache = /* @__PURE__ */ new Map();
			constructor(t, e, n, o) {
				this.editor = t, this.initialEditorConfig = e, this.overrides = n, this.editorContext = o, this.installed = te$1(n, o), this.hasSessionGates = n.some((t) => t.disabledForSession);
			}
			setContextValue(t, e) {
				const n = this.installed;
				this.editorContext[t.key] = e;
				const o = te$1(this.overrides, this.editorContext);
				if (function(t, e) {
					if (t.length !== e.length) return !1;
					for (let n = 0; n < t.length; n++) if (t[n] !== e[n]) return !1;
					return !0;
				}(n, o)) return;
				const r = function(t, e) {
					const n = new Set(t), o = new Set(e), r = [];
					for (const e of t) o.has(e) || r.push(e);
					for (const t of e) n.has(t) || r.push(t);
					return r;
				}(n, o);
				this.installed = o, this.sessionCache.clear();
				const s = Yt$2(this.initialEditorConfig, { overrides: o });
				this.editor._config.dom = s;
				const i = function(t) {
					const e = [];
					for (const n of t) (n.$createDOM || n.$getDOMSlot || n.$decorateDOM) && e.push(ee$1(n));
					return 0 === e.length ? null : (t) => e.some((e) => e(t));
				}(r);
				if (!i) return;
				const c = s.$updateDOM;
				s.$updateDOM = (t, e, n, o) => !!i(t) || c(t, e, n, o), this.editor.update($fullReconcile, { discrete: !0 }), s.$updateDOM = c;
			}
			getSessionConfig() {
				const t = this.editor._config.dom || DEFAULT_EDITOR_DOM_CONFIG;
				if (!this.hasSessionGates) return t;
				const e = Zt$2(it$3(xt$5, this.editor) || this.editorContext), n = [], o = [];
				if (this.installed.forEach((t, r) => {
					t.disabledForSession && t.disabledForSession(e) ? n.push(String(r)) : o.push(t);
				}), 0 === n.length) return t;
				const r = n.join(",");
				let s = this.sessionCache.get(r);
				return s || (s = Yt$2(this.initialEditorConfig, { overrides: o }), this.sessionCache.set(r, s)), s;
			}
		};
		const oe$1 = /* @__PURE__ */ defineExtension$1({
			build(t, e, n) {
				const { initialEditorConfig: o } = n.getInitResult(), r = Xt$2(e.contextDefaults);
				return {
					defaults: r,
					runtime: new ne$1(t, o, e.overrides, r)
				};
			},
			config: {
				contextDefaults: [],
				overrides: []
			},
			html: { export: /* @__PURE__ */ new Map([[RootNode, () => {
				const t = $getDocument().createElement("div");
				return t.role = "textbox", { element: t };
			}]]) },
			init(t, e) {
				const n = {
					dom: t.dom,
					nodes: t.nodes
				}, o = Xt$2(e.contextDefaults);
				return t.dom = Yt$2(t, { overrides: te$1(e.overrides, o) }), { initialEditorConfig: n };
			},
			mergeConfig(t, e) {
				const n = shallowMergeConfig$1(t, e);
				for (const o of ["overrides", "contextDefaults"]) e[o] && (n[o] = [...t[o], ...e[o]]);
				return n;
			},
			name: yt$4
		});
		const re$1 = Symbol.for("@lexical/html/SelectorImpl");
		function se$1(t, e) {
			const n = {
				kind: "element",
				predicate: (o = e, 0 === o.length ? isHTMLElement$1 : 1 === o.length ? o[0] : (t, e) => {
					for (const n of o) if (!n(t, e)) return !1;
					return !0;
				}),
				tags: t
			};
			var o;
			const s = (n) => se$1(t, [...e, n]);
			return {
				[re$1]: n,
				attr: (t, e, n) => s(le(t, e, n)),
				classAll: (...t) => s(ce(t)),
				classAny: (...t) => s(function(t) {
					const e = ie$1(t);
					if (0 === e.length) return () => !1;
					return (t) => {
						if (!isHTMLElement$1(t)) return !1;
						const n = t.classList;
						for (const t of e) if (n.contains(t)) return !0;
						return !1;
					};
				}(t)),
				styleAny: (t, e, n) => s(function(t, e, n) {
					if ("string" == typeof e) return (n) => isHTMLElement$1(n) && n.style.getPropertyValue(t) === e;
					if (e instanceof RegExp) {
						const o = n && n.capture, s = e;
						return (e, n) => {
							if (!isHTMLElement$1(e)) return !1;
							const i = e.style.getPropertyValue(t);
							if (!i) return !1;
							const c = i.match(s);
							return null !== c && (void 0 !== o && (n[o] = c), !0);
						};
					}
					nt$3(362, JSON.stringify(t));
				}(t, e, n))
			};
		}
		function ie$1(t) {
			const e = [];
			for (const n of t) n && e.push(n);
			return e;
		}
		function ce(t) {
			const e = ie$1(t);
			return 0 === e.length ? () => !0 : (t) => {
				if (!isHTMLElement$1(t)) return !1;
				const n = t.classList;
				for (const t of e) if (!n.contains(t)) return !1;
				return !0;
			};
		}
		function le(t, e, n) {
			if (!0 === e) return (e) => isHTMLElement$1(e) && e.hasAttribute(t);
			if ("string" == typeof e) return (n) => isHTMLElement$1(n) && n.getAttribute(t) === e;
			if (e instanceof RegExp) {
				const o = n && n.capture, s = e;
				return (e, n) => {
					if (!isHTMLElement$1(e)) return !1;
					const i = e.getAttribute(t);
					if (null == i) return !1;
					const c = i.match(s);
					return null !== c && (void 0 !== o && (n[o] = c), !0);
				};
			}
			nt$3(361, JSON.stringify(t));
		}
		const ue = {
			kind: "text",
			predicate: isDOMTextNode,
			tags: /* @__PURE__ */ new Set()
		};
		const fe = { [re$1]: ue };
		const ae = {
			kind: "comment",
			predicate: (t) => 8 === t.nodeType,
			tags: /* @__PURE__ */ new Set()
		};
		const de = { [re$1]: ae };
		const pe = {
			any: () => se$1(/* @__PURE__ */ new Set(), []),
			comment: () => de,
			tag(...t) {
				t.length > 0 || nt$3(363);
				const e = /* @__PURE__ */ new Set();
				for (const n of t) e.add(n.toUpperCase());
				return se$1(e, []);
			},
			text: () => fe
		};
		function he(t, e) {
			return isHTMLElement$1(t) && t.nodeName === e.toUpperCase();
		}
		const ge = /[A-Za-z0-9_-]/;
		var me = class {
			constructor(t, e) {
				this.source = t, this.pos = e;
			}
			peek(t = 0) {
				return this.source[this.pos + t] || "";
			}
			consume() {
				return this.source[this.pos++] || "";
			}
			eof() {
				return this.pos >= this.source.length;
			}
			skipWhitespace() {
				for (; !this.eof() && /\s/.test(this.peek());) this.pos++;
			}
			readIdent() {
				const t = this.pos;
				for (; !this.eof() && ge.test(this.peek());) this.pos++;
				return this.source.slice(t, this.pos);
			}
			readQuoted() {
				const t = this.consume();
				this.assert("\"" === t || "'" === t, "expected quote");
				const e = this.pos;
				for (; !this.eof() && this.peek() !== t;) "\\" === this.peek() ? this.pos += 2 : this.pos++;
				this.assert(!this.eof(), "unterminated string");
				const n = this.source.slice(e, this.pos);
				return this.pos++, n.replace(/\\(.)/g, "$1");
			}
			assert(t, e) {
				t || nt$3(364, String(this.pos + 1), e, this.source);
			}
		};
		function ye(t) {
			const e = /* @__PURE__ */ new Set(), n = [], o = [];
			if (t.skipWhitespace(), "*" === t.peek()) t.consume();
			else if (ge.test(t.peek())) {
				const n = t.readIdent();
				n && e.add(n.toUpperCase());
			}
			for (; !t.eof();) {
				const e = t.peek();
				if ("." === e) {
					t.consume();
					const e = t.readIdent();
					t.assert("" !== e, "expected class name after \".\""), o.push(e);
				} else if ("#" === e) {
					t.consume();
					const e = t.readIdent();
					t.assert("" !== e, "expected id after \"#\""), n.push(le("id", e));
				} else {
					if ("[" !== e) break;
					{
						t.consume(), t.skipWhitespace();
						const e = t.readIdent();
						t.assert("" !== e, "expected attribute name after \"[\""), t.skipWhitespace();
						let o = !0;
						if ("=" === t.peek()) {
							t.consume(), t.skipWhitespace();
							const e = t.peek();
							"\"" === e || "'" === e ? o = t.readQuoted() : (o = t.readIdent(), t.assert("" !== o, "expected attribute value")), t.skipWhitespace();
						}
						t.assert("]" === t.peek(), "expected \"]\""), t.consume(), n.push(le(e, o));
					}
				}
			}
			return o.length > 0 && n.push(ce(o)), {
				predicates: n,
				tags: e
			};
		}
		function xe(t) {
			const e = new me(t, 0), n = [];
			for (;;) {
				const t = ye(e);
				if (n.push(t), e.skipWhitespace(), e.eof()) break;
				e.assert("," === e.peek(), "expected \",\" (selector lists are the only supported combinator)"), e.consume(), e.skipWhitespace();
			}
			if (1 === n.length) return se$1(n[0].tags, n[0].predicates);
			const o = /* @__PURE__ */ new Set();
			if (n.every((t) => t.tags.size > 0)) for (const t of n) for (const e of t.tags) o.add(e);
			return se$1(o, [(t, e) => {
				for (const o of n) {
					const n = t.nodeName;
					if (o.tags.size > 0 && !o.tags.has(n)) continue;
					let r = !0;
					for (const n of o.predicates) if (!n(t, e)) {
						r = !1;
						break;
					}
					if (r) return !0;
				}
				return !1;
			}]);
		}
		function Se(t) {
			return t;
		}
		function $e(t, e, n) {
			return ht$5($t$4, t, e, n);
		}
		const ve = /* @__PURE__ */ $e("importSource", () => "unknown");
		const Ce = /* @__PURE__ */ $e("importSourceDataTransfer", () => null);
		const be = /* @__PURE__ */ $e("textFormat", () => 0);
		const ke = /* @__PURE__ */ $e("textStyle", () => ({}));
		function De(t) {
			if (!isHTMLElement$1(t)) return !1;
			if ("PRE" === t.nodeName) return !0;
			const e = t.style.whiteSpace;
			return "string" == typeof e && e.startsWith("pre");
		}
		function we(t) {
			if (isDOMTextNode(t)) return !0;
			if (!isHTMLElement$1(t)) return !1;
			const e = t.style.display;
			return e ? e.startsWith("inline") : !isBlockDomNode$1(t) && isInlineDomNode$1(t);
		}
		const Oe = /* @__PURE__ */ $e("whitespaceConfig", () => ({
			isInline: we,
			preservesWhitespace: De
		}));
		const Me = /* @__PURE__ */ $e("importOverlays", () => []);
		var Ae = class {
			constructor(t) {
				this.record = t;
			}
			get(t) {
				return rt$3(this.record, t);
			}
			set(t, e) {
				this.record[t.key] = e;
			}
			update(t, e) {
				this.record[t.key] = e(rt$3(this.record, t));
			}
			has(t) {
				return Object.prototype.hasOwnProperty.call(this.record, t.key);
			}
		};
		function Ne(t) {
			const e = getPeerDependencyFromEditor(t, St$5);
			return e ? e.output.defaults : void 0;
		}
		function Ee(t, n = $getEditor()) {
			return rt$3(function(t) {
				return it$3($t$4, t) || Ne(t);
			}(n), t);
		}
		const Ie = pt$5($t$4, Ne);
		function We(t) {
			return $isBlockElementNode(t) || $isDecoratorNode(t) && !t.isInline();
		}
		function Re(t, e) {
			const n = [];
			let o = [];
			const r = () => {
				0 !== o.length && (n.push(e().splice(0, 0, o)), o = []);
			};
			for (const s of t) if (We(s)) {
				if (r(), $isElementNode(s)) {
					const t = Re(s.getChildren(), e);
					s.splice(0, s.getChildrenSize(), t);
				}
				n.push(s);
			} else o.push(s);
			return r(), n;
		}
		function Fe(t, e) {
			if (!isHTMLElement$1(e)) return t;
			const n = e.style.textAlign;
			if (!Be(n)) return t;
			for (const e of t) $isBlockElementNode(e) && "" === e.getFormatType() && e.setFormat(n);
			return t;
		}
		function Te(t, e, n) {
			1 === t.length && $isLineBreakNode(t[0]) && (t = []);
			const o = $createParagraphNode();
			if (isHTMLElement$1(n)) {
				const t = n.style.textAlign;
				Be(t) && o.setFormat(t);
			}
			return [o.splice(0, 0, t)];
		}
		const Pe = {
			$accepts: We,
			$packageRun: Te,
			name: "BlockSchema"
		};
		const je = {
			$accepts: (t) => !We(t),
			name: "InlineSchema"
		};
		const ze = {
			$accepts: We,
			$packageRun: (t) => t,
			name: "NestedBlockSchema"
		};
		const _e = {
			$accepts: We,
			$packageRun: Te,
			name: "RootSchema"
		};
		const Le = pe;
		const Ue = /* @__PURE__ */ new Set([
			"center",
			"end",
			"justify",
			"left",
			"right",
			"start"
		]);
		function Be(t) {
			return Ue.has(t);
		}
		const Ve = {
			B: { fontWeight: "bold" },
			EM: { fontStyle: "italic" },
			I: { fontStyle: "italic" },
			S: { textDecoration: "line-through" },
			STRONG: { fontWeight: "bold" },
			SUB: { verticalAlign: "sub" },
			SUP: { verticalAlign: "super" },
			U: { textDecoration: "underline" }
		};
		const qe = {
			CODE: IS_CODE,
			MARK: IS_HIGHLIGHT
		};
		const Ge = /* @__PURE__ */ new Set([
			"font-weight",
			"font-style",
			"text-decoration",
			"vertical-align"
		]);
		const He = /* @__PURE__ */ Se({
			$import: (t, e) => {
				const n = t.get(be), o = Ve[e.nodeName], r = function(t) {
					return {
						fontStyle: t.style.fontStyle,
						fontWeight: t.style.fontWeight,
						textDecoration: t.style.textDecoration,
						verticalAlign: t.style.verticalAlign
					};
				}(e), s = o ? (i = o, {
					fontStyle: (c = r).fontStyle || i.fontStyle,
					fontWeight: c.fontWeight || i.fontWeight,
					textDecoration: c.textDecoration || i.textDecoration,
					verticalAlign: c.verticalAlign || i.verticalAlign
				}) : r;
				var i, c;
				let l = (u = n, f = function(t) {
					let e = 0, n = 0;
					const { fontWeight: o, fontStyle: r, textDecoration: s, verticalAlign: i } = t;
					if ("700" === o || "bold" === o ? e |= IS_BOLD : "normal" !== o && "400" !== o || (n |= IS_BOLD), "italic" === r ? e |= IS_ITALIC : "normal" === r && (n |= IS_ITALIC), s) {
						const t = s.split(" ");
						t.includes("underline") && (e |= IS_UNDERLINE), t.includes("line-through") && (e |= IS_STRIKETHROUGH), t.includes("none") && (n |= IS_UNDERLINE | IS_STRIKETHROUGH);
					}
					return "sub" === i ? (e |= IS_SUBSCRIPT, n |= IS_SUPERSCRIPT) : "super" === i ? (e |= IS_SUPERSCRIPT, n |= IS_SUBSCRIPT) : "baseline" === i && (n |= IS_SUBSCRIPT | IS_SUPERSCRIPT), {
						clear: n,
						set: e
					};
				}(s), u & ~f.clear | f.set);
				var u, f;
				const a = qe[e.nodeName];
				return a && (l |= a), l === n ? t.$importChildren(e) : t.$importChildren(e, { context: [ft$4(be, l)] });
			},
			match: Le.tag("b", "strong", "em", "i", "code", "mark", "s", "sub", "sup", "u", "span"),
			name: "@lexical/html/inline-format"
		});
		function Je(t, e, n) {
			let o = t;
			for (;;) {
				let t = null;
				for (; null === (t = e ? o.nextSibling : o.previousSibling);) {
					const t = o.parentNode;
					if (null === t) return null;
					o = t;
				}
				if (o = t, !n.isInline(o)) return null;
				let r = o;
				for (; null !== (r = e ? o.firstChild : o.lastChild);) o = r;
				if (isDOMTextNode(o)) return o;
				if ("BR" === o.nodeName) return null;
			}
		}
		function Qe(t, e) {
			return 0 !== e && $isTextNode(t) ? t.setFormat(e) : t;
		}
		function Ke(t, e) {
			if ($isTextNode(t)) {
				const n = function(t) {
					let e = "";
					for (const n in t) Ge.has(n) || (e += `${n}: ${t[n]}; `);
					return e.trimEnd();
				}(e);
				"" !== n && t.setStyle(n);
			}
			return t;
		}
		const Ye = /* @__PURE__ */ Se({
			$import: (t, e) => {
				const n = t.get(be), o = t.get(ke), r = t.get(Oe);
				if (function(t, e) {
					let n = t.parentNode;
					for (; null !== n;) {
						if (e.preservesWhitespace(n)) return !0;
						n = n.parentNode;
					}
					return !1;
				}(e, r)) {
					const t = $generateNodesFromRawText(e.textContent || "");
					for (const e of t) Qe(e, n), Ke(e, o);
					return t;
				}
				const s = function(t, e) {
					let n = (t.textContent || "").replace(/\r/g, "").replace(/[ \t\n]+/g, " ");
					if (0 === n.length) return "";
					if (" " === n[0]) {
						let o = t, r = !0;
						for (; null !== o && null !== (o = Je(o, !1, e));) {
							const t = o.textContent || "";
							if (t.length > 0) {
								/[ \t\n]$/.test(t) && (n = n.slice(1)), r = !1;
								break;
							}
						}
						r && (n = n.slice(1));
					}
					if (n.length > 0 && " " === n[n.length - 1]) {
						let o = t, r = !0;
						for (; null !== o && null !== (o = Je(o, !0, e));) if ((o.textContent || "").replace(/^( |\t|\r?\n)+/, "").length > 0) {
							r = !1;
							break;
						}
						r && (n = n.slice(0, -1));
					}
					return n;
				}(e, r);
				if ("" === s) return [];
				const i = $createTextNode(s);
				return Qe(i, n), Ke(i, o), [i];
			},
			match: Le.text(),
			name: "@lexical/html/#text"
		});
		const Ze = /* @__PURE__ */ Se({
			$import: () => [],
			match: Le.tag("script", "style"),
			name: "@lexical/html/script-style-ignore"
		});
		const Xe = /* @__PURE__ */ Se({
			$import: (t, e) => isOnlyChildInBlockNode(e) || isLastChildInBlockNode(e) ? [] : [$createLineBreakNode()],
			match: Le.tag("br"),
			name: "@lexical/html/br"
		});
		const tn$1 = /* @__PURE__ */ Se({
			$import: (t, e) => {
				const n = $createParagraphNode();
				if ($setFormatFromDOM(n, e), setNodeIndentFromDOM(e, n), "" === n.getFormatType()) {
					const t = e.getAttribute("align");
					t && Be(t) && n.setFormat(t);
				}
				return $setDirectionFromDOM(n, e), [n.splice(0, 0, t.$importChildren(e))];
			},
			match: Le.tag("p"),
			name: "@lexical/html/p"
		});
		const en$1 = /* @__PURE__ */ Se({
			$import: (t, n, o) => $getEditor().hasNode(HorizontalRuleNode) ? [$createHorizontalRuleNode()] : o(),
			match: Le.tag("hr"),
			name: "@lexical/html/hr"
		});
		const nn$1 = [
			Ze,
			tn$1,
			en$1,
			/* @__PURE__ */ Se({
				$import: (t, e, n) => isBlockDomNode$1(e) ? Fe(t.$importChildren(e, { schema: Pe }), e) : n(),
				match: Le.any(),
				name: "@lexical/html/transparent-block"
			}),
			Ye,
			Xe,
			He
		];
		function on$1(t, e) {
			const n = [];
			let o = 0, r = 0;
			for (; o < t.length && r < e.length;) t[o] <= e[r] ? n.push(t[o++]) : n.push(e[r++]);
			for (; o < t.length;) n.push(t[o++]);
			for (; r < e.length;) n.push(e[r++]);
			return n;
		}
		function rn$1(t) {
			const e = [], n = /* @__PURE__ */ new Map(), o = [], r = [], s = [], i = /* @__PURE__ */ new Set();
			t.forEach((t, c) => {
				const l = function(t) {
					const e = t[re$1];
					return void 0 === e && nt$3(360), e;
				}(t.match), u = t.name || function(t, e) {
					if ("text" === t.kind) return `#text@${e}`;
					if ("comment" === t.kind) return `#comment@${e}`;
					if (0 === t.tags.size) return `*@${e}`;
					return `${Array.from(t.tags).join(",").toLowerCase()}@${e}`;
				}(l, c);
				if (t.name && i.add(t.name), e.push({
					$import: t.$import,
					name: u,
					predicate: l.predicate
				}), "text" === l.kind) r.push(c);
				else if ("comment" === l.kind) s.push(c);
				else if (0 === l.tags.size) o.push(c);
				else for (const t of l.tags) {
					let e = n.get(t);
					e || (e = [], n.set(t, e)), e.push(c);
				}
			});
			const c = /* @__PURE__ */ new Map();
			if (0 === o.length) for (const [t, e] of n) c.set(t, e);
			else for (const [t, e] of n) c.set(t, on$1(e, o));
			return {
				byTag: c,
				commentIndices: s,
				rules: e,
				textIndices: r,
				wildcardIndices: o
			};
		}
		function sn$1(t, e) {
			return isDOMTextNode(e) ? t.textIndices : 8 === e.nodeType ? t.commentIndices : isHTMLElement$1(e) ? t.byTag.get(e.nodeName) || t.wildcardIndices : cn$1;
		}
		const cn$1 = Object.freeze([]);
		function ln$1(t) {
			const e = [];
			for (const n of t) if (un$1(n)) for (const t of n.rules) e.push(t);
			else e.push(n);
			return e;
		}
		function un$1(t) {
			return "object" == typeof t && null !== t && "__type" in t && "CompiledOverlayRules" === t.__type;
		}
		function fn$1(t) {
			const e = ln$1(t);
			return {
				__type: "CompiledOverlayRules",
				dispatch: rn$1(e),
				rules: e
			};
		}
		const an$1 = Object.freeze({});
		function dn$1(t, e) {
			return {
				$importChildren: (e, n) => function(t, e, n) {
					const o = n && n.rules ? n.rules.dispatch : void 0;
					o && t.overlays.push(o);
					try {
						const o = () => pn$1(t, e, n);
						return n && n.context ? Ie(n.context, t.editor)(o) : o();
					} finally {
						o && t.overlays.pop();
					}
				}(t, e, n),
				$importOne: (e, n) => hn$1(t, e, n),
				captures: e,
				get: (e) => Ee(e, t.editor),
				session: t.session
			};
		}
		function pn$1(t, e, n) {
			const o = n && n.$onChild, r = [];
			for (const n of Array.from(e.childNodes)) {
				const e = hn$1(t, n, void 0);
				for (const t of e) {
					const e = o ? o(t) : t;
					null != e && r.push(e);
				}
			}
			const s = n && n.$after ? n.$after(r) : r, i = n && n.schema;
			return i ? function(t, e, n, o) {
				const r = [];
				let s = null;
				const i = () => {
					if (null === s) return;
					const e = s;
					if (s = null, t.$packageRun) {
						const s = t.$packageRun(e, n, o);
						if (s.length > 0) {
							for (const t of s) r.push(t);
							return;
						}
					}
					if ("hoist" === t.onReject) for (const t of e) r.push(t);
				};
				for (const o of e) t.$accepts(o, n) ? (i(), r.push(o)) : (null === s && (s = []), s.push(o));
				return i(), t.$finalize ? t.$finalize(r, n) : r;
			}(i, s, null, e) : s;
		}
		function hn$1(t, e, n) {
			const o = () => function(t, e) {
				const n = function(t, e) {
					const n = [];
					for (let o = t.overlays.length - 1; o >= 0; o--) {
						const r = t.overlays[o], s = sn$1(r, e);
						s.length > 0 && n.push({
							dispatch: r,
							indices: s
						});
					}
					const o = sn$1(t.dispatch, e);
					o.length > 0 && n.push({
						dispatch: t.dispatch,
						indices: o
					});
					return n;
				}(t, e);
				if (0 === n.length) return gn$1(t, e);
				let o = 0, r = 0;
				const s = () => {
					for (; o < n.length;) {
						const { dispatch: i, indices: c } = n[o];
						for (; r < c.length;) {
							const n = c[r++], o = i.rules[n], l = {};
							if (o.predicate(e, l)) {
								const n = dn$1(t, 0 === Object.keys(l).length ? an$1 : l);
								try {
									return o.$import(n, e, s);
								} catch (t) {
									throw t;
								}
							}
						}
						o++, r = 0;
					}
					return gn$1(t, e);
				};
				return s();
			}(t, e);
			return n && n.context ? Ie(n.context, t.editor)(o) : o();
		}
		function gn$1(t, e) {
			if (0 === e.childNodes.length) return [];
			const n = [];
			for (const o of Array.from(e.childNodes)) {
				const e = hn$1(t, o, void 0);
				for (const t of e) n.push(t);
			}
			return n;
		}
		const mn$1 = /* @__PURE__ */ Se({
			$import: (t, e) => t.$importChildren(e),
			match: pe.any(),
			name: "@lexical/html/default-hoist"
		});
		const yn$1 = /* @__PURE__ */ defineExtension$1({
			build(t, e) {
				const n = rn$1(ln$1(e.rules)), r = lt$3(e.contextDefaults, void 0), s = e.preprocess;
				return {
					$generateNodesFromDOM: (e, i) => {
						const c = it$3($t$4, t) || r, l = i && i.context ? lt$3(i.context, c) : c, u = void 0 !== l && l !== c ? l : Object.create(c || null), f = new Ae(u), a = { session: f };
						return function(t, e, n) {
							let o = t.length - 1;
							const r = () => {
								for (; o >= 0;) return void (0, t[o--])(e, n, r);
							};
							r();
						}(i && i.preprocess ? [...s, ...i.preprocess] : s, e, a), dt$5($t$4, u, () => function(t, e, n, r) {
							return pn$1({
								dispatch: t,
								editor: e,
								overlays: r.get(Me).map((t) => t.dispatch),
								session: r
							}, isDOMDocumentNode(n) ? n.body : n, { schema: _e });
						}(n, t, e, f), t);
					},
					defaults: r
				};
			},
			config: {
				contextDefaults: [],
				preprocess: [gt$4],
				rules: [mn$1]
			},
			mergeConfig: (t, e) => shallowMergeConfig$1(t, {
				...e,
				...e.contextDefaults && { contextDefaults: [...t.contextDefaults, ...e.contextDefaults] },
				...e.preprocess && { preprocess: [...t.preprocess, ...e.preprocess] },
				...e.rules && { rules: [...e.rules, ...t.rules] }
			}),
			name: St$5
		});
		function xn$1(t, e) {
			return $getExtensionOutput(yn$1).$generateNodesFromDOM(t, e);
		}
		const Sn$1 = /* @__PURE__ */ defineExtension$1({
			dependencies: [/* @__PURE__ */ configExtension$1(yn$1, { rules: nn$1 })],
			name: "@lexical/html/CoreImport"
		});
		const $n$1 = [en$1];
		const vn$1 = /* @__PURE__ */ defineExtension$1({
			dependencies: [HorizontalRuleExtension, Sn$1],
			name: "@lexical/html/HorizontalRuleImport"
		});
		const Cn$1 = {
			any: pe.any,
			comment: pe.comment,
			css: xe,
			tag: pe.tag,
			text: pe.text
		};
		const bn$1 = /* @__PURE__ */ new Set(["STYLE", "SCRIPT"]);
		function kn$1(t, e) {
			mt$5(e);
			const n = isDOMDocumentNode(e) ? e.body.childNodes : e.childNodes, r = [], s = [];
			for (const e of n) if (!bn$1.has(e.nodeName)) {
				const n = Nn$1(e, t, s, !1);
				if (null !== n) for (const t of n) r.push(t);
			}
			return function(t) {
				for (const e of t) e.getParent() && e.getNextSibling() instanceof ArtificialNode__DO_NOT_USE && e.insertAfter($createLineBreakNode());
				for (const e of t) {
					const t = e.getParent();
					t && t.splice(e.getIndexWithinParent(), 1, e.getChildren());
				}
			}(s), r;
		}
		function Dn$1(t, n = null, o = $getEditor()) {
			return Et$4([ft$4(kt$4, !0)], o)(() => {
				const e = $getRoot(), r = Nt$5(o), s = $isRangeSelection(n) ? $getSlotFrame(n.anchor.getNode()) : null, i = t.append.bind(t);
				for (const t of ($isElementNode(s) ? s : e).getChildren()) Mn$1(o, t, i, n, r);
				return t;
			});
		}
		function wn$1(t, n = $getRoot()) {
			const o = $getEditor();
			return Et$4([ft$4(kt$4, !0), ft$4(bt$5, !0)], o)(() => {
				const e = Nt$5(o), r = t.append.bind(t);
				return Mn$1(o, n, r, null, e), t;
			});
		}
		function On$1(t, e = null) {
			return ("undefined" == typeof document || "undefined" == typeof window && void 0 === global.window) && nt$3(338), $assumeActiveEditor(t), Dn$1($getDocument().createElement("div"), e, t).innerHTML;
		}
		function Mn$1(e, n, o, i = null, c = $getEditorDOMRenderConfig(e)) {
			let l = c.$shouldInclude(n, i, e);
			const u = c.$shouldExclude(n, i, e);
			let f = n;
			null !== i && $isTextNode(n) && (f = $sliceSelectedTextNodeContent(i, n, "clone"));
			const { element: d, after: p, append: g, $getChildNodes: m } = c.$exportDOM(f, e);
			if (!d) return !1;
			const y = $getDocument().createDocumentFragment(), S = m ? m() : $isElementNode(f) ? f.getChildren() : [], $ = l && $isNodeSelection(i) && $isElementNode(n) ? null : i, v = y.append.bind(y);
			for (const t of S) {
				const o = Mn$1(e, t, v, $, c);
				!l && o && c.$extractWithChild(n, t, i, "html", e) && (l = !0);
			}
			if (l && !u) {
				if ((isHTMLElement$1(d) || isDocumentFragment(d)) && (g ? g(y) : d.append(y)), o(d), p) {
					const t = p.call(f, d);
					t && (isDocumentFragment(d) ? d.replaceChildren(t) : d.replaceWith(t));
				}
			} else o(y);
			return l;
		}
		function An$1(t, e, n, o = null) {
			return Mn$1(t, e, n.append.bind(n), o, Nt$5(t));
		}
		function Nn$1(t, e, n, o, r = /* @__PURE__ */ new Map(), s) {
			const i = [];
			if (bn$1.has(t.nodeName)) return i;
			let c = null;
			const l = function(t, e) {
				const { nodeName: n } = t, o = e._htmlConversions.get(n.toLowerCase());
				let r = null;
				if (void 0 !== o) for (const e of o) {
					const n = e(t);
					null !== n && (null === r || (r.priority || 0) <= (n.priority || 0)) && (r = n);
				}
				return null !== r ? r.conversion : null;
			}(t, e), u = l ? l(t) : null;
			let f = null;
			if (null !== u) {
				f = u.after;
				const e = u.node;
				if (c = Array.isArray(e) ? e[e.length - 1] : e, null !== c) {
					for (const [, t] of r) if (c = t(c, s), !c) break;
					c && i.push(...Array.isArray(e) ? e : [c]);
				}
				null != u.forChild && r.set(t.nodeName, u.forChild);
			}
			const a = t.childNodes;
			let d = [];
			const p = (null == c || !$isRootOrShadowRoot(c)) && (null != c && $isBlockElementNode(c) || o);
			for (let t = 0; t < a.length; t++) d.push(...Nn$1(a[t], e, n, p, new Map(r), c));
			if (null != f && (d = f(d)), isBlockDomNode$1(t) && (d = En$1(t, d, p ? () => {
				const t = new ArtificialNode__DO_NOT_USE();
				return n.push(t), t;
			} : $createParagraphNode)), null == c) if (d.length > 0) for (const t of d) i.push(t);
			else isBlockDomNode$1(t) && function(t) {
				if (null == t.nextSibling || null == t.previousSibling) return !1;
				return isInlineDomNode$1(t.nextSibling) && isInlineDomNode$1(t.previousSibling);
			}(t) && i.push($createLineBreakNode());
			else $isElementNode(c) && c.append(...d);
			return i;
		}
		function En$1(t, e, n) {
			const o = t.style.textAlign, r = [];
			let s = [];
			for (let t = 0; t < e.length; t++) {
				const i = e[t];
				if ($isBlockElementNode(i)) o && !i.getFormat() && i.setFormat(o), r.push(i);
				else if (s.push(i), t === e.length - 1 || t < e.length - 1 && $isBlockElementNode(e[t + 1])) {
					const t = n();
					t.setFormat(o), t.append(...s), r.push(t), s = [];
				}
			}
			return r;
		}
		//#endregion
		//#region node_modules/@lexical/html/dist/LexicalHtml.mjs
		const mod$7 = LexicalHtml_prod_exports;
		mod$7.$appendNodeToHTML;
		const $distributeInlineWrapper = mod$7.$distributeInlineWrapper;
		mod$7.$generateDOMFromNodes;
		mod$7.$generateDOMFromRoot;
		const $generateHtmlFromNodes = mod$7.$generateHtmlFromNodes;
		const $generateNodesFromDOM = mod$7.$generateNodesFromDOM;
		const $generateNodesFromDOMViaExtension = mod$7.$generateNodesFromDOMViaExtension;
		mod$7.$getImportContextValue;
		mod$7.$getRenderContextValue;
		mod$7.$getSessionDOMRenderConfig;
		mod$7.$inlineStylesFromStyleSheets;
		const $isBlockLevel = mod$7.$isBlockLevel;
		const $propagateTextAlignToBlockChildren = mod$7.$propagateTextAlignToBlockChildren;
		mod$7.$setRenderContextValue;
		mod$7.$updateRenderContextValue;
		mod$7.$withImportContext;
		mod$7.$withRenderContext;
		const BlockSchema = mod$7.BlockSchema;
		const CoreImportExtension = mod$7.CoreImportExtension;
		mod$7.CoreImportRules;
		const DOMImportExtension = mod$7.DOMImportExtension;
		mod$7.DOMRenderExtension;
		mod$7.HorizontalRuleImportExtension;
		mod$7.HorizontalRuleImportRules;
		mod$7.ImportOverlays;
		const ImportSource = mod$7.ImportSource;
		const ImportSourceDataTransfer = mod$7.ImportSourceDataTransfer;
		const ImportTextFormat = mod$7.ImportTextFormat;
		const ImportTextStyle = mod$7.ImportTextStyle;
		mod$7.ImportWhitespaceConfig;
		mod$7.InlineSchema;
		mod$7.NestedBlockSchema;
		mod$7.RenderContextExport;
		mod$7.RenderContextRoot;
		mod$7.RootSchema;
		mod$7.contextUpdater;
		const contextValue = mod$7.contextValue;
		mod$7.createImportState;
		mod$7.createRenderState;
		mod$7.defaultIsInline;
		mod$7.defaultPreservesWhitespace;
		const defineImportRule = mod$7.defineImportRule;
		mod$7.defineOverlayRules;
		mod$7.domOverride;
		const isElementOfTag = mod$7.isElementOfTag;
		mod$7.parseSelector;
		const sel = mod$7.sel;
		//#endregion
		//#region node_modules/@lexical/clipboard/dist/LexicalClipboard.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalClipboard_prod_exports = /* @__PURE__ */ __exportAll({
			$exportMimeTypeFromSelection: () => At$4,
			$generateJSONFromSelectedNodes: () => wt$3,
			$generateNodesFromSerializedNodes: () => $t$3,
			$getClipboardDataFromSelection: () => Rt$4,
			$getHtmlContent: () => pt$4,
			$getLexicalContent: () => dt$4,
			$handlePlainTextDrop: () => bt$4,
			$handleRichTextDrop: () => Tt$4,
			$insertDataTransferForPlainText: () => mt$4,
			$insertDataTransferForRichText: () => gt$3,
			$insertGeneratedNodes: () => Mt$3,
			$writeDragSourceToDataTransfer: () => xt$4,
			ClipboardDOMImportExtension: () => ft$3,
			ClipboardImportExtension: () => at$2,
			DEFAULT_IMPORT_MIME_TYPE: () => lt$2,
			DEFAULT_IMPORT_MIME_TYPE_PRIORITY: () => ot$2,
			GetClipboardDataExtension: () => Kt$3,
			caretFromPoint: () => et$1,
			copyToClipboard: () => Dt$3,
			setLexicalClipboardDataTransfer: () => St$4
		});
		function et$1(r, i, l = null) {
			const c = getRootOwnerDocument(l), s = l ? getDOMShadowRoots(l) : [], u = null !== l && s.length > 0;
			if (u && "function" == typeof c.caretPositionFromPoint) {
				const t = c.caretPositionFromPoint(r, i, { shadowRoots: s });
				if (null !== t && function(t, e) {
					for (let n = t; null !== n;) {
						if (n === e) return !0;
						n = getParentElement(n);
					}
					return !1;
				}(t.offsetNode, l)) return {
					node: t.offsetNode,
					offset: t.offset
				};
			}
			if (u) {
				const t = l.getRootNode();
				if (isDOMShadowRoot(t)) {
					const e = t.elementFromPoint(r, i);
					if (null !== e && l.contains(e)) {
						const t = function(t, e, n, o) {
							const r = o.createRange(), i = (t) => e < t.top ? t.top - e : e > t.bottom ? e - t.bottom : 0, l = (e) => t < e.left ? e.left - t : t > e.right ? t - e.right : 0, c = o.createTreeWalker(n, NodeFilter.SHOW_TEXT);
							let s = null, u = 1 / 0, a = 1 / 0;
							for (let t = c.nextNode(); t; t = c.nextNode()) {
								r.selectNodeContents(t);
								for (const e of r.getClientRects()) {
									const n = i(e), o = l(e);
									(n < u || n === u && o < a) && (u = n, a = o, s = t);
								}
							}
							if (null === s) return null;
							let f = 0, p = 1 / 0, d = 1 / 0;
							for (let e = 0; e <= s.length; e++) {
								r.setStart(s, e), r.collapse(!0);
								const n = r.getBoundingClientRect(), o = i(n), l = Math.abs(t - n.left);
								(o < p || o === p && l < d) && (p = o, d = l, f = e);
							}
							return {
								node: s,
								offset: f
							};
						}(r, i, e, c);
						if (null !== t) return t;
					}
				}
			}
			if ("function" == typeof c.caretRangeFromPoint) {
				const t = c.caretRangeFromPoint(r, i);
				return null === t ? null : {
					node: t.startContainer,
					offset: t.startOffset
				};
			}
			if ("function" == typeof c.caretPositionFromPoint) {
				const t = c.caretPositionFromPoint(r, i);
				return null === t ? null : {
					node: t.offsetNode,
					offset: t.offset
				};
			}
			return null;
		}
		function nt$2(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			throw n.search = o.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		const ot$2 = {
			"application/x-lexical-editor": 0,
			"text/html": 10,
			"text/plain": 20,
			"text/uri-list": 30
		};
		function rt$2(t) {
			if (window.trustedTypes && window.trustedTypes.createPolicy) return window.trustedTypes.createPolicy("lexical", { createHTML: (t) => t }).createHTML(t);
			return t;
		}
		const it$2 = (t, e) => {
			if (!$isRangeSelection(e)) return e.insertRawText(t), !0;
			const n = (t) => {
				const e = $getSelection();
				$isRangeSelection(e) && t(e);
			};
			return tokenizeRawText(t, {
				linebreak: () => n((t) => t.insertParagraph()),
				tab: () => n((t) => t.insertNodes([$createTabNode()])),
				text: (t) => n((e) => e.insertText(t))
			}), !0;
		};
		const lt$2 = {
			"application/x-lexical-editor": [(t, e, n) => {
				try {
					const n = $getEditor(), o = JSON.parse(t);
					if (o && o.namespace === n._config.namespace && Array.isArray(o.nodes)) return Mt$3(n, $t$3(o.nodes), e), !0;
				} catch (t) {
					console.error(t);
				}
				return n();
			}],
			"text/html": [(t, e, n) => {
				try {
					const n = $getEditor(), o = new DOMParser().parseFromString(rt$2(t), "text/html");
					return Mt$3(n, $generateNodesFromDOM(n, o), e), !0;
				} catch (t) {
					return console.error(t), n();
				}
			}],
			"text/plain": [it$2],
			"text/uri-list": [it$2]
		};
		function ct$2(t, e, n, o) {
			if (!t) return !1;
			const r = (i) => !!t[i] && t[i](e, n, r.bind(null, i - 1), o);
			return r(t.length - 1);
		}
		function st$2(t, e, n) {
			const o = e.getData("text/plain");
			for (const r of function(t) {
				return Object.keys(t.$importMimeType).filter((e) => void 0 !== t.$importMimeType[e]).sort((e, n) => {
					const o = t.priority[e], r = t.priority[n];
					return void 0 === o && void 0 === r ? e < n ? -1 : e > n ? 1 : 0 : void 0 === o ? 1 : void 0 === r ? -1 : o - r;
				});
			}(t)) {
				const i = e.getData(r);
				if (i && ("text/html" !== r || i !== o) && ct$2(t.$importMimeType[r], i, n, e)) return !0;
			}
			return !1;
		}
		const ut$2 = {
			$importMimeType: lt$2,
			$insertDataTransfer: (t, e) => st$2({
				$importMimeType: lt$2,
				priority: ot$2
			}, t, e),
			priority: ot$2
		};
		const at$2 = /* @__PURE__ */ defineExtension$1({
			build: (t, e) => ({
				$importMimeType: e.$importMimeType,
				$insertDataTransfer: (t, n) => st$2(e, t, n),
				priority: e.priority
			}),
			config: /* @__PURE__ */ safeCast$1({
				$importMimeType: lt$2,
				priority: ot$2
			}),
			mergeConfig(t, e) {
				const n = shallowMergeConfig$1(t, e);
				if (e.$importMimeType) {
					const o = { ...t.$importMimeType };
					for (const [t, n] of Object.entries(e.$importMimeType)) if (n) {
						const e = o[t];
						o[t] = e ? [...e, ...n] : n;
					}
					n.$importMimeType = o;
				}
				return e.priority && (n.priority = {
					...t.priority,
					...e.priority
				}), n;
			},
			name: "@lexical/clipboard/Import"
		});
		const ft$3 = /* @__PURE__ */ defineExtension$1({
			dependencies: [CoreImportExtension, /* @__PURE__ */ configExtension(at$2, { $importMimeType: { "text/html": [(t, e, n, o) => {
				const r = new DOMParser().parseFromString(rt$2(t), "text/html"), l = $generateNodesFromDOMViaExtension(r, { context: [contextValue(ImportSource, "paste"), contextValue(ImportSourceDataTransfer, o)] });
				return Mt$3($getEditor(), l, e), !0;
			}] } })],
			name: "@lexical/clipboard/DOMImport"
		});
		function pt$4(t, e = $getSelection()) {
			return e ?? nt$2(166), $isRangeSelection(e) && e.isCollapsed() || 0 === e.getNodes().length ? "" : $generateHtmlFromNodes(t, e);
		}
		function dt$4(t, e = $getSelection()) {
			return e ?? nt$2(166), $isRangeSelection(e) && e.isCollapsed() || 0 === e.getNodes().length ? null : JSON.stringify(wt$3(t, e));
		}
		function mt$4(t, e) {
			const n = t.getData("text/plain") || t.getData("text/uri-list");
			null != n && e.insertRawText(n);
		}
		function gt$3(t, e, n) {
			(function() {
				const t = $getPeerDependency(at$2.name);
				return t ? t.output : ut$2;
			})().$insertDataTransfer(t, e);
		}
		const yt$3 = "application/x-lexical-drag";
		function xt$4(t, e) {
			const n = { editorKey: e.getKey() };
			t.setData(yt$3, JSON.stringify(n));
		}
		function ht$4(t, e, n) {
			const o = t.dataTransfer;
			if (null === o) return !1;
			const r = function(t) {
				const e = t.getData(yt$3);
				if (!e) return null;
				let n;
				try {
					n = JSON.parse(e);
				} catch (t) {
					return null;
				}
				return null !== (o = n) && "object" == typeof o && "editorKey" in o && "string" == typeof o.editorKey ? n : null;
				var o;
			}(o);
			if (null === r) return !1;
			const i = function(t, e) {
				const n = et$1(t.clientX, t.clientY, e.getRootElement());
				if (null === n) return null;
				const o = $getNearestNodeFromDOMNode(n.node);
				if (null === o) return null;
				if ($isTextNode(o)) return $getTextPointCaret(o, "next", n.offset);
				if ($isElementNode(o)) return $getChildCaretAtIndex(o, n.offset, "next");
				const r = o.getParent();
				return null === r ? null : $getChildCaretAtIndex(r, o.getIndexWithinParent() + 1, "next");
			}(t, e);
			if (null === i) return !1;
			const l = $splitAtPointCaretNext(i);
			if (null === l) return !1;
			const c = r.editorKey === e.getKey(), u = $getSelection();
			if (c) {
				if (!$isRangeSelection(u) || u.isCollapsed()) return !1;
				if (function(t, e) {
					const { anchor: n, focus: o } = $getCaretRangeInDirection($caretRangeFromSelection(e), "next");
					return $comparePointCaretNext(n, t) < 0 && $comparePointCaretNext(t, o) < 0;
				}(i, u)) return t.preventDefault(), !0;
				u.removeText();
			}
			if (!l.origin.isAttached()) return t.preventDefault(), !0;
			if (n(o, $setSelectionFromCaretRange($getCollapsedCaretRange(l)), e), !c) {
				const t = e.getRootElement(), n = t ? t.ownerDocument : null, o = n ? function(t, e) {
					for (const n of findAllLexicalElementsDeep(e)) {
						const e = getEditorPropertyFromDOMNode(n);
						if (isLexicalEditor(e) && e.getKey() === t && isHTMLElement$1(n)) return n;
					}
					return null;
				}(r.editorKey, n) : null;
				null !== o && o.dispatchEvent(new InputEvent("beforeinput", {
					bubbles: !0,
					cancelable: !0,
					inputType: "deleteByDrag"
				}));
			}
			return t.preventDefault(), !0;
		}
		function Tt$4(t, e) {
			return ht$4(t, e, gt$3);
		}
		function bt$4(t, e) {
			return ht$4(t, e, (t, e) => mt$4(t, e));
		}
		function Mt$3(t, e, n) {
			t.dispatchCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, {
				nodes: e,
				selection: n
			}) || (n.insertNodes(e), function(t) {
				if ($isRangeSelection(t) && t.isCollapsed()) {
					const e = t.anchor;
					let n = null;
					const o = $caretFromPoint(e, "previous");
					if (o) if ($isTextPointCaret(o)) n = o.origin;
					else {
						const t = $getCaretRange(o, $getChildCaret($getRoot(), "next").getFlipped());
						for (const e of t) {
							if ($isTextNode(e.origin)) {
								n = e.origin;
								break;
							}
							if ($isElementNode(e.origin) && !e.origin.isInline()) break;
						}
					}
					if (n && $isTextNode(n)) {
						const e = n.getFormat(), o = n.getStyle();
						t.format === e && t.style === o || (t.format = e, t.style = o, t.dirty = !0);
					}
				}
			}(n));
		}
		function vt$4(t, e, n, o = []) {
			let r = null === e || n.isSelected(e);
			const i = $isElementNode(n) && n.excludeFromCopy("html");
			let l = n;
			null !== e && $isTextNode(l) && (l = $sliceSelectedTextNodeContent(e, l, "clone"));
			const c = $isElementNode(l) ? l.getChildren() : [], s = function(t) {
				const e = t.exportJSON(), n = t.constructor;
				if (e.type !== n.getType() && nt$2(58, n.name), $isElementNode(t)) {
					const t = e.children;
					Array.isArray(t) || nt$2(59, n.name);
				}
				return e;
			}(l);
			$isTextNode(l) && 0 === l.getTextContentSize() && (r = !1);
			const u = r && $isNodeSelection(e) && $isElementNode(n) ? null : e;
			for (let o = 0; o < c.length; o++) {
				const i = c[o], l = vt$4(t, u, i, s.children);
				!r && $isElementNode(n) && l && n.extractWithChild(i, e, "clone") && (r = !0);
			}
			if (r && !i) {
				const e = $getSlotNames(l);
				if (e.length > 0) {
					const n = {};
					for (const o of e) {
						const e = $getSlot(l, o);
						null === e && nt$2(366, l.constructor.name, o);
						const r = [];
						vt$4(t, null, e, r), 1 === r.length && r[0].type === e.getType() || nt$2(385, o, l.constructor.name, String(r.length), String(r.length > 0 ? r[0].type : "none")), n[o] = r[0];
					}
					s.$slots = n;
				}
			}
			if (r && !i) o.push(s);
			else if (Array.isArray(s.children)) for (let t = 0; t < s.children.length; t++) {
				const e = s.children[t];
				o.push(e);
			}
			return r;
		}
		function wt$3(t, e) {
			const n = [], o = $getRoot(), r = $isRangeSelection(e) ? e.anchor.getNode() : $isNodeSelection(e) ? e.getNodes()[0] ?? null : null, i = null !== r ? $getSlotFrame(r) : null, l = ($isElementNode(i) ? i : o).getChildren();
			for (let o = 0; o < l.length; o++) vt$4(t, e, l[o], n);
			return {
				namespace: t._config.namespace,
				nodes: n
			};
		}
		function $t$3(t) {
			const e = [];
			for (const n of t) e.push($parseSerializedNode(n));
			return e;
		}
		let Ct$4 = null;
		async function Dt$3(t, e, n) {
			if (null !== Ct$4) return !1;
			if (null !== e) return new Promise((o, r) => {
				t.update(() => {
					o(Nt$4(t, e, n));
				});
			});
			const o = t.getRootElement(), r = t._window || window, i = r.document, l = getDOMSelection(r);
			if (null === o || null === l) return !1;
			const c = i.createElement("span");
			c.style.position = "fixed", c.style.top = "-1000px", c.append(i.createTextNode("#")), o.append(c);
			const s = i.createRange();
			return s.setStart(c, 0), s.setEnd(c, 1), l.removeAllRanges(), l.addRange(s), new Promise((e, o) => {
				const l = t.registerCommand(COPY_COMMAND, (o) => (objectKlassEquals(o, ClipboardEvent) && (l(), null !== Ct$4 && (r.clearTimeout(Ct$4), Ct$4 = null), e(Nt$4(t, o, n))), !0), COMMAND_PRIORITY_CRITICAL);
				Ct$4 = r.setTimeout(() => {
					l(), Ct$4 = null, e(!1);
				}, 50), i.execCommand("copy"), c.remove();
			});
		}
		function Nt$4(t, e, n) {
			if (void 0 === n) {
				const e = getDOMSelection(t._window), o = $getSelection();
				if (!o || o.isCollapsed()) return !1;
				if (!e) return !1;
				const r = getDOMSelectionPoints(e, t.getRootElement()), i = r.anchorNode, l = r.focusNode;
				if (null !== i && null !== l && !isSelectionWithinEditor(t, i, l)) return !1;
				n = Rt$4(o);
			}
			e.preventDefault();
			const o = e.clipboardData;
			return null !== o && (St$4(o, n), !0);
		}
		const Pt$4 = [["text/html", pt$4], ["application/x-lexical-editor", dt$4]];
		function Rt$4(t = $getSelection()) {
			return function(t, e) {
				const n = { "text/plain": "" };
				for (const [o, r] of Object.entries(t)) if (r) {
					const t = Et$3(r, e);
					null !== t && (n[o] = t);
				}
				return n;
			}(Ot$4(), t);
		}
		function St$4(t, e) {
			for (const [n] of Pt$4) void 0 === e[n] && t.setData(n, "");
			for (const n in e) {
				const o = e[n];
				void 0 !== o && t.setData(n, o);
			}
		}
		function Ot$4(t = $getEditor()) {
			const e = getPeerDependencyFromEditor(t, Kt$3.name);
			return e ? e.output : Ft$3;
		}
		const Ft$3 = {
			"application/x-lexical-editor": [(t, e) => t ? dt$4($getEditor(), t) : e()],
			"text/html": [(t, e) => t ? pt$4($getEditor(), t) : e()],
			"text/plain": [(t, e) => t ? t.getTextContent() : e()]
		};
		function Et$3(t, e) {
			const n = (o) => t[o] ? t[o](e, n.bind(null, o - 1)) : null;
			return n(t.length - 1);
		}
		function At$4(t, e = $getSelection()) {
			return Et$3(Ot$4()[t] || [], e);
		}
		const Kt$3 = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => e.$exportMimeType,
			config: /* @__PURE__ */ safeCast$1({ $exportMimeType: Ft$3 }),
			mergeConfig(t, e) {
				const n = shallowMergeConfig$1(t, e);
				if (e.$exportMimeType) {
					const o = { ...t.$exportMimeType };
					for (const [t, n] of Object.entries(e.$exportMimeType)) if (n) {
						const e = o[t];
						o[t] = e ? [...e, ...n] : n;
					}
					n.$exportMimeType = o;
				}
				return n;
			},
			name: "@lexical/clipboard/GetClipboardData"
		});
		//#endregion
		//#region node_modules/@lexical/clipboard/dist/LexicalClipboard.mjs
		const mod$6 = LexicalClipboard_prod_exports;
		mod$6.$exportMimeTypeFromSelection;
		mod$6.$generateJSONFromSelectedNodes;
		mod$6.$generateNodesFromSerializedNodes;
		const $getClipboardDataFromSelection = mod$6.$getClipboardDataFromSelection;
		mod$6.$getHtmlContent;
		mod$6.$getLexicalContent;
		mod$6.$handlePlainTextDrop;
		const $handleRichTextDrop = mod$6.$handleRichTextDrop;
		mod$6.$insertDataTransferForPlainText;
		const $insertDataTransferForRichText = mod$6.$insertDataTransferForRichText;
		mod$6.$insertGeneratedNodes;
		const $writeDragSourceToDataTransfer = mod$6.$writeDragSourceToDataTransfer;
		mod$6.ClipboardDOMImportExtension;
		mod$6.ClipboardImportExtension;
		mod$6.DEFAULT_IMPORT_MIME_TYPE;
		mod$6.DEFAULT_IMPORT_MIME_TYPE_PRIORITY;
		mod$6.GetClipboardDataExtension;
		const caretFromPoint = mod$6.caretFromPoint;
		const copyToClipboard = mod$6.copyToClipboard;
		const setLexicalClipboardDataTransfer = mod$6.setLexicalClipboardDataTransfer;
		//#endregion
		//#region node_modules/@lexical/dragon/dist/LexicalDragon.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalDragon_prod_exports = /* @__PURE__ */ __exportAll({
			DragonExtension: () => h,
			installDragonSupport: () => g,
			registerDragonSupport: () => b
		});
		const c = {
			bold: "bold",
			italic: "italic",
			strikeThrough: "strikethrough",
			subscript: "subscript",
			superscript: "superscript",
			underline: "underline"
		};
		const f = Symbol.for("@lexical/dragon/WindowState");
		function g(e = function() {
			return "undefined" != typeof window ? window : void 0;
		}()) {
			return e ? p(e, Symbol("@lexical/dragon/globalInstall"), void 0) : () => {};
		}
		function p(e, t, n) {
			const i = function(e) {
				let t = e[f];
				return void 0 === t && (t = {
					dispose: () => {},
					editors: /* @__PURE__ */ new Map(),
					installs: /* @__PURE__ */ new Set()
				}, e[f] = t), t;
			}(e);
			if (0 === i.installs.size) {
				const t = x.bind(e);
				e.addEventListener("message", t, !0), i.dispose = () => {
					e.removeEventListener("message", t, !0);
				};
			}
			if (i.installs.add(t), n) {
				const e = i.editors.get(n) || /* @__PURE__ */ new Set();
				e.add(t), i.editors.set(n, e);
			}
			return m.bind(null, e, i, t, n);
		}
		function m(e, t, n, i) {
			if (i) {
				const e = t.editors.get(i);
				e && e.delete(n) && 0 === e.size && t.editors.delete(i);
			}
			t.installs.delete(n) && 0 === t.installs.size && (t.dispose(), delete e[f]);
		}
		function y(e) {
			return e && e.ownerDocument.defaultView;
		}
		function b(n) {
			const i = watchedSignal(() => y(n.getRootElement()), (e) => n.registerRootListener((t) => {
				e.value = y(t);
			}));
			return effect(() => {
				const e = i.value;
				if (e) return p(e, Symbol("@lexical/dragon/editorInstall"), n);
			});
		}
		function x(e) {
			if (e.origin !== this.location.origin) return;
			const t = function(e) {
				const t = e[f];
				if (void 0 === t) return null;
				const n = getEditorPropertyFromDOMNode(getActiveElementDeep(e.document));
				return isLexicalEditor(n) && t.editors.has(n) ? n : null;
			}(this);
			if (null === t) return;
			const n = e.data;
			if ("string" == typeof n) {
				let r;
				try {
					r = JSON.parse(n);
				} catch (e) {
					return;
				}
				if (r && "nuanria_messaging" === r.protocol && "request" === r.type) {
					const n = r.payload;
					if (n && "makeChanges" === n.functionId) {
						const r = n.args;
						if (Array.isArray(r)) {
							const [n, l, a, d, u, f] = r;
							if (![
								n,
								l,
								d,
								u
							].every(Number.isFinite) || "string" != typeof a && -1 !== a) return;
							t.update(() => {
								const t = $getSelection();
								if ($isRangeSelection(t)) {
									const i = t.anchor;
									let o = i.getNode(), r = 0, g = 0;
									if ($isTextNode(o) && n >= 0 && l >= 0 && (r = n, g = n + l, t.setTextNodeRange(o, r, o, g)), "string" != typeof a || r === g && "" === a || (t.insertRawText(a), o = i.getNode()), $isTextNode(o)) {
										const e = o.getTextContentSize();
										r = Math.min(Math.max(d, 0), e), g = d < 0 || u < 0 ? r : Math.min(d + u, e), t.setTextNodeRange(o, r, o, g);
									}
									if ("string" == typeof f && u > 0 && !t.isCollapsed()) {
										const e = c[f];
										void 0 !== e && t.formatText(e);
									}
									e.stopImmediatePropagation();
								}
							});
						}
					}
				}
			}
		}
		const h = /* @__PURE__ */ defineExtension$1({
			build: (e, t, i) => namedSignals(t),
			config: /* @__PURE__ */ safeCast$1({ disabled: "undefined" == typeof window }),
			name: "@lexical/dragon",
			register: (e, n, i) => effect(() => i.getOutput().disabled.value ? void 0 : b(e))
		});
		//#endregion
		//#region node_modules/@lexical/dragon/dist/LexicalDragon.mjs
		const mod$5 = LexicalDragon_prod_exports;
		const DragonExtension = mod$5.DragonExtension;
		mod$5.installDragonSupport;
		mod$5.registerDragonSupport;
		//#endregion
		//#region node_modules/@lexical/rich-text/dist/LexicalRichText.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalRichText_prod_exports = /* @__PURE__ */ __exportAll({
			$createHeadingNode: () => kt$3,
			$createQuoteNode: () => bt$3,
			$isHeadingNode: () => Kt$2,
			$isQuoteNode: () => St$3,
			DRAG_DROP_PASTE: () => vt$3,
			HeadingNode: () => Tt$3,
			QuoteNode: () => Nt$3,
			RichTextExtension: () => yt$2,
			RichTextImportExtension: () => xt$3,
			RichTextImportRules: () => ht$3,
			ShadowRootQuoteRule: () => mt$3,
			eventFiles: () => eventFiles$1,
			quoteShadowRootState: () => Dt$2,
			registerRichText: () => qt$2
		});
		const dt$3 = /* @__PURE__ */ defineImportRule({
			$import: (e, t) => {
				const n = kt$3(t.nodeName.toLowerCase());
				return setNodeIndentFromDOM(t, n), $setFormatFromDOM(n, t), $setDirectionFromDOM(n, t), [n.splice(0, 0, e.$importChildren(t))];
			},
			match: sel.tag("h1", "h2", "h3", "h4", "h5", "h6"),
			name: "@lexical/rich-text/heading"
		});
		const pt$3 = /* @__PURE__ */ defineImportRule({
			$import: (e, t) => {
				const n = bt$3();
				return $setFormatFromDOM(n, t), setNodeIndentFromDOM(t, n), $setDirectionFromDOM(n, t), [n.splice(0, 0, e.$importChildren(t))];
			},
			match: sel.tag("blockquote"),
			name: "@lexical/rich-text/blockquote"
		});
		const mt$3 = /* @__PURE__ */ defineImportRule({
			$import: (e, t) => {
				const n = bt$3({ shadowRoot: !0 });
				return $setFormatFromDOM(n, t), setNodeIndentFromDOM(t, n), $setDirectionFromDOM(n, t), [n.splice(0, 0, e.$importChildren(t, { schema: BlockSchema }))];
			},
			match: sel.tag("blockquote"),
			name: "@lexical/rich-text/blockquote-shadow-root"
		});
		const ht$3 = [
			dt$3,
			pt$3,
			/* @__PURE__ */ defineImportRule({
				$import: (e, t, n) => {
					const r = t.firstChild;
					return r && isHTMLElement$1(o = r) && "SPAN" === o.nodeName && "26pt" === o.style.fontSize ? e.$importChildren(t) : n();
					var o;
				},
				match: sel.tag("p"),
				name: "@lexical/rich-text/google-docs-title-p"
			}),
			/* @__PURE__ */ defineImportRule({
				$import: (e, t, n) => "26pt" !== t.style.fontSize ? n() : [kt$3("h1").splice(0, 0, e.$importChildren(t))],
				match: sel.tag("span"),
				name: "@lexical/rich-text/google-docs-title-span"
			})
		];
		function Ct$3(e, t) {
			return e && null !== t ? shallowMergeConfig$1(e, t) : t;
		}
		const yt$2 = /* @__PURE__ */ defineExtension$1({
			build: (e, t) => namedSignals(t),
			config: /* @__PURE__ */ safeCast$1({ escapeFormatTriggers: {
				capitalize: {
					enter: !0,
					space: !0,
					tab: !0
				},
				lowercase: {
					enter: !0,
					space: !0,
					tab: !0
				},
				uppercase: {
					enter: !0,
					space: !0,
					tab: !0
				}
			} }),
			conflictsWith: ["@lexical/plain-text"],
			dependencies: [
				DragonExtension,
				NormalizeInlineElementsExtension,
				NormalizeTripleClickSelectionExtension,
				CoreImportExtension,
				/* @__PURE__ */ configExtension$1(DOMImportExtension, { rules: ht$3 })
			],
			mergeConfig: function(e, t) {
				const n = shallowMergeConfig$1(e, t);
				return t.escapeFormatTriggers && (n.escapeFormatTriggers = function(e, t) {
					const n = shallowMergeConfig$1(e, t);
					for (const r of Object.keys(t)) n[r] = Ct$3(e[r], t[r]);
					return n;
				}(e.escapeFormatTriggers, t.escapeFormatTriggers)), n;
			},
			name: "@lexical/rich-text",
			nodes: () => [Tt$3, Nt$3],
			register: (e, t, n) => effect(() => qt$2(e, n.getOutput().escapeFormatTriggers))
		});
		const xt$3 = /* @__PURE__ */ defineExtension$1({
			dependencies: [yt$2],
			name: "@lexical/rich-text/Import"
		});
		const vt$3 = /* @__PURE__ */ createCommand("DRAG_DROP_PASTE_FILE");
		const Dt$2 = /* @__PURE__ */ createState("shadowRoot", { parse: Boolean });
		var Nt$3 = class extends ElementNode {
			$config() {
				return this.config("quote", {
					extends: ElementNode,
					importDOM: { blockquote: () => ({
						conversion: _t$3,
						priority: 0
					}) },
					stateConfigs: [{
						flat: !0,
						stateConfig: Dt$2
					}]
				});
			}
			isShadowRoot() {
				return $getState(this, Dt$2);
			}
			setIsShadowRoot(e) {
				return $setState(this, Dt$2, e);
			}
			createDOM(e) {
				const t = $getDocument().createElement("blockquote");
				return addClassNamesToElement$1(t, e.theme.quote), t;
			}
			updateDOM(e, t, n) {
				return !1;
			}
			exportDOM(e) {
				const { element: t } = super.exportDOM(e);
				if (isHTMLElement$1(t)) {
					this.isEmpty() && t.append($getDocument().createElement("br"));
					const e = this.getFormatType();
					e && (t.style.textAlign = e);
					const n = this.getDirection();
					n && (t.dir = n);
				}
				return { element: t };
			}
			exportJSON() {
				return super.exportJSON();
			}
			static importJSON(e) {
				return bt$3().updateFromJSON(e);
			}
			insertNewAfter(e, t) {
				const n = $createParagraphNode(), r = this.getDirection();
				return n.setDirection(r), this.insertAfter(n, t), n;
			}
			collapseAtStart() {
				if (this.isShadowRoot()) {
					for (const e of this.getChildren()) this.insertBefore(e);
					return this.remove(), !0;
				}
				const e = $createParagraphNode();
				return this.getChildren().forEach((t) => e.append(t)), this.replace(e), !0;
			}
			canMergeWhenEmpty() {
				return !0;
			}
		};
		function bt$3(e) {
			const t = $applyNodeReplacement(new Nt$3());
			return e && e.shadowRoot ? t.setIsShadowRoot(!0) : t;
		}
		function St$3(e) {
			return e instanceof Nt$3;
		}
		var Tt$3 = class extends ElementNode {
			__tag;
			$config() {
				return this.config("heading", {
					extends: ElementNode,
					importDOM: {
						h1: () => ({
							conversion: Ot$3,
							priority: 0
						}),
						h2: () => ({
							conversion: Ot$3,
							priority: 0
						}),
						h3: () => ({
							conversion: Ot$3,
							priority: 0
						}),
						h4: () => ({
							conversion: Ot$3,
							priority: 0
						}),
						h5: () => ({
							conversion: Ot$3,
							priority: 0
						}),
						h6: () => ({
							conversion: Ot$3,
							priority: 0
						}),
						p: (e) => {
							const t = e.firstChild;
							return null !== t && wt$2(t) ? {
								conversion: () => ({ node: null }),
								priority: 3
							} : null;
						},
						span: (e) => wt$2(e) ? {
							conversion: () => ({ node: kt$3("h1") }),
							priority: 3
						} : null
					}
				});
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__tag = e.__tag;
			}
			constructor(e = "h1", t) {
				super(t), this.__tag = e;
			}
			getTag() {
				return this.getLatest().__tag;
			}
			setTag(e) {
				const t = this.getWritable();
				return t.__tag = e, t;
			}
			createDOM(e) {
				const t = this.__tag, n = $getDocument().createElement(t), r = e.theme.heading;
				if (void 0 !== r) {
					const e = r[t];
					addClassNamesToElement$1(n, e);
				}
				return n;
			}
			updateDOM(e, t, n) {
				return e.__tag !== this.__tag;
			}
			exportDOM(e) {
				const { element: t } = super.exportDOM(e);
				if (isHTMLElement$1(t)) {
					this.isEmpty() && t.append($getDocument().createElement("br"));
					const e = this.getFormatType();
					e && (t.style.textAlign = e);
					const n = this.getDirection();
					n && (t.dir = n);
				}
				return { element: t };
			}
			updateFromJSON(e) {
				return super.updateFromJSON(e).setTag(e.tag);
			}
			exportJSON() {
				return {
					...super.exportJSON(),
					tag: this.getTag()
				};
			}
			insertNewAfter(e, t = !0) {
				const n = e ? e.anchor.offset : 0, r = this.getLastDescendant(), o = !r || e && e.anchor.key === r.getKey() && n === r.getTextContentSize() || !e ? $createParagraphNode() : kt$3(this.getTag()), i = this.getDirection();
				if (o.setDirection(i), this.insertAfter(o, t), 0 === n && !this.isEmpty() && e) {
					const e = $createParagraphNode();
					e.select(), this.replace(e, !0);
				}
				return o;
			}
			collapseAtStart() {
				if (this.isEmpty()) {
					const e = $createParagraphNode();
					this.getChildren().forEach((t) => e.append(t)), this.replace(e);
				}
				return !0;
			}
			extractWithChild() {
				return !0;
			}
		};
		function wt$2(e) {
			return "span" === e.nodeName.toLowerCase() && "26pt" === e.style.fontSize;
		}
		function Ot$3(e) {
			const t = e.nodeName.toLowerCase();
			let n = null;
			return "h1" !== t && "h2" !== t && "h3" !== t && "h4" !== t && "h5" !== t && "h6" !== t || (n = kt$3(t), setNodeIndentFromDOM(e, n), $setFormatFromDOM(n, e), $setDirectionFromDOM(n, e)), { node: n };
		}
		function _t$3(e) {
			const t = bt$3();
			return $setFormatFromDOM(t, e), setNodeIndentFromDOM(e, t), $setDirectionFromDOM(t, e), { node: t };
		}
		function kt$3(e = "h1") {
			return $applyNodeReplacement(new Tt$3(e));
		}
		function Kt$2(e) {
			return e instanceof Tt$3;
		}
		function Et$2(e) {
			const t = $getNearestNodeFromDOMNode(e);
			return $isDecoratorNode(t);
		}
		function Ft$2(e, t, n, r) {
			let o = !1, i = null;
			if (e.isCollapsed() && "text" === e.anchor.type) {
				const t = e.anchor.getNode();
				if ($isTextNode(t)) {
					i = t;
					const r = e.anchor.offset, s = r === t.getTextContentSize() && null === t.getNextSibling(), a = 0 === r && null === t.getPreviousSibling();
					o = "end" === n && s || "start" === n && a || "both" === n && (s || a);
				}
			}
			let s = !1;
			for (const [n, a] of Object.entries(r)) {
				if (null == a || !a[t]) continue;
				const r = n;
				if (a.onlyAtBoundary) {
					if (!(o && i && $isTextNode(i) && i.hasFormat(r))) continue;
					s = !0;
				}
				e.hasFormat(r) && e.toggleFormat(r);
			}
			s && e.setStyle("");
		}
		const It$2 = {
			capitalize: {
				enter: !0,
				space: !0,
				tab: !0
			},
			lowercase: {
				enter: !0,
				space: !0,
				tab: !0
			},
			uppercase: {
				enter: !0,
				space: !0,
				tab: !0
			}
		};
		function Rt$3(e, t) {
			return function(e, t) {
				if (!e.isCollapsed()) return !1;
				const n = $caretFromPoint(e.focus, t), r = $findMatchingParent$1(n.origin, $isShadowRootNode);
				if (!r) return !1;
				const o = e.focus.getNode();
				if (!r.is(o) && !$hasAncestor(o, r)) return !1;
				const i = $getCaretRange(n, $getSiblingCaret(r, t));
				if (i.getTextSlices().some((e) => e && e.getTextContentSize() > 0)) return !1;
				const s = $getCaretRange(i.anchor.getSiblingCaret(), i.focus);
				let a = s.anchor.origin;
				for (const e of s) {
					if (!$isSiblingCaret(e) || !e.origin.is(a.getParent())) return !1;
					a = e.origin;
				}
				let c = r;
				for (const e of $extendCaretToRange($getSiblingCaret(r, t))) {
					if (!e.origin.is(c.getParent())) {
						if ($needsBlockCursorBeside(e.origin)) {
							const e = $getSiblingCaret(c, t);
							return $setSelectionFromCaretRange($getCaretRange(e, e)), !0;
						}
						break;
					}
					if (!$isShadowRootNode(e.origin)) break;
					c = e.origin;
				}
				return !1;
			}(e, t) || function(e, t) {
				if (!e.isCollapsed() || "element" !== e.anchor.type) return !1;
				const n = $caretFromPoint(e.anchor, t).getNodeAtCaret();
				return !(!$isShadowRootNode(n) || n.isInline() || ($setSelectionFromCaretRange($getCollapsedCaretRange($normalizeCaret($getChildCaret(n, t)))), 0));
			}(e, t);
		}
		function At$3(e) {
			return $isDecoratorNode(e) && !e.isInline() && !e.isIsolated() && e.isKeyboardSelectable();
		}
		function Pt$3(e) {
			const t = $createNodeSelection();
			t.add(e), $setSelection(t);
		}
		function zt$2(e, t) {
			if (!e.isCollapsed()) return !1;
			const n = e.focus, r = n.getNode(), o = t ? "previous" : "next", i = $caretFromPoint(n, o);
			if ("element" === n.type && $isElementNode(r) && $isRootOrShadowRoot(r)) {
				const e = i.getNodeAtCaret();
				return !(null === e || !At$3(e)) && (Pt$3(e.__key), !0);
			}
			const s = $findMatchingParent$1($isElementNode(r) ? r : r.getParentOrThrow(), (e) => $isElementNode(e) && !e.isInline() && $isRootOrShadowRoot(e.getParent()));
			if (null === s) return !1;
			const a = $getSiblingCaret(s, o).getNodeAtCaret();
			if (null === a || !At$3(a)) return !1;
			if (0 === s.getTextContentSize()) return Pt$3(a.__key), !0;
			const c = $getEditor().getRootElement();
			if (null === c) return !1;
			const l = getDOMSelection(c.ownerDocument.defaultView);
			if (null === l || 0 === l.rangeCount) return !1;
			const u = l.anchorNode, f = l.anchorOffset, g = l.focusNode, d = l.focusOffset;
			l.modify("move", t ? "backward" : "forward", "line");
			const p = l.anchorNode, m = l.anchorOffset;
			if (null === p) return Mt$2(l, u, f, g, d), !1;
			const h = $getNearestNodeFromDOMNode(p);
			if (Mt$2(l, u, f, g, d), null === h) return !1;
			if (p === u && m === f) return Pt$3(a.__key), !0;
			return !h.is(s) && !$hasAncestor(h, s) && (Pt$3(a.__key), !0);
		}
		function Mt$2(e, t, n, r, o) {
			null !== t && null !== r && e.setBaseAndExtent(t, n, r, o);
		}
		function $t$2(e, n) {
			if (!e.isCollapsed()) return !1;
			const r = e.focus.getNode(), o = $findMatchingParent$1($isElementNode(r) ? r : r.getParentOrThrow(), (e) => $isElementNode(e) && !e.isInline());
			if (null === o) return !1;
			const i = $getEditor(), s = i.getRootElement();
			if (null === s) return !1;
			const a = s.ownerDocument.defaultView;
			if (null === a) return !1;
			let c = !1;
			for (const e of o.getChildren()) if ($isElementNode(e) && e.isInline()) {
				const t = i.getElementByKey(e.getKey());
				if (null !== t) {
					const e = a.getComputedStyle(t).display;
					if ("inline-grid" === e || "inline-flex" === e) {
						c = !0;
						break;
					}
				}
			}
			if (!c) return !1;
			const l = $getSiblingCaret(o, n ? "previous" : "next").getNodeAtCaret();
			if (null === l || !$isElementNode(l)) {
				if (n) {
					const e = o.getFirstDescendant();
					$isTextNode(e) ? e.select(0, 0) : o.select(0, 0);
				} else {
					const e = o.getLastDescendant();
					if ($isTextNode(e)) {
						const t = e.getTextContentSize();
						e.select(t, t);
					} else {
						const e = o.getChildrenSize();
						o.select(e, e);
					}
				}
				return !0;
			}
			const u = i.getElementByKey(l.getKey());
			if (null === u) return !1;
			const f = getDOMSelection(a);
			if (null === f || 0 === f.rangeCount) return !1;
			const g = f.getRangeAt(0).cloneRange();
			g.collapse(!0);
			const d = g.getBoundingClientRect(), p = u.getBoundingClientRect(), m = p.top + p.height / 2;
			if (d.height > 0) {
				const n = caretFromPoint(d.left, m, s);
				if (null !== n && u.contains(n.node)) {
					const t = s.ownerDocument.createRange();
					return t.setStart(n.node, n.offset), t.collapse(!0), e.applyDOMRange(t), e.dirty = !0, !0;
				}
			}
			const h = n ? l.getLastDescendant() : l.getFirstDescendant();
			if ($isTextNode(h)) {
				const e = n ? h.getTextContentSize() : 0;
				h.select(e, e);
			} else {
				const e = l.getChildrenSize();
				l.select(n ? e : 0, n ? e : 0);
			}
			return !0;
		}
		function Lt$3(e, t) {
			const n = $getSiblingCaret(e, t), r = n.getAdjacentCaret();
			null !== r && $isElementNode(r.origin) && !r.origin.isInline() && r.origin.isShadowRoot() ? $setSelectionFromCaretRange($getCollapsedCaretRange(n)) : "next" === t ? e.selectNext(0, 0) : e.selectPrevious();
		}
		function Bt$2(e, t, n) {
			n.preventDefault(), n.stopPropagation();
			const r = e.getNodes();
			if (0 === r.length) return !0;
			const o = r.map((e) => $getSiblingCaret(e, "next")).sort($comparePointCaretNext), i = (t ? o[0] : o[o.length - 1]).origin, s = $findMatchingParent$1(i, (e) => e !== i && $isElementNode(e) && !e.isInline()) ?? $getRoot(), a = t ? 0 : s.getChildrenSize();
			return s.select(a, a), !0;
		}
		function qt$2(a, c = signal(It$2)) {
			return mergeRegister$1(a.registerCommand(CLICK_COMMAND, () => {
				const e = $getSelection();
				return $isNodeSelection(e) ? (e.clear(), !0) : ($isRangeSelection(e) && Ft$2(e, "click", "both", c.peek()), !1);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(DELETE_CHARACTER_COMMAND, (e) => {
				const t = $getSelection();
				return $isRangeSelection(t) ? (t.deleteCharacter(e), !0) : !!$isNodeSelection(t) && (t.deleteNodes(), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(DELETE_WORD_COMMAND, (e) => {
				const t = $getSelection();
				return !!$isRangeSelection(t) && (t.deleteWord(e), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(DELETE_LINE_COMMAND, (e) => {
				const t = $getSelection();
				return !!$isRangeSelection(t) && (t.deleteLine(e), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(CONTROLLED_TEXT_INSERTION_COMMAND, (t) => {
				const n = $getSelection();
				if ("string" == typeof t) null !== n && n.insertText(t);
				else {
					if (null === n) return !1;
					const r = t.dataTransfer;
					if (null != r) $insertDataTransferForRichText(r, n, a);
					else if ($isRangeSelection(n)) {
						const e = t.data;
						return e && n.insertText(e), !0;
					}
				}
				return !0;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(REMOVE_TEXT_COMMAND, () => {
				const e = $getSelection();
				return !!$isRangeSelection(e) && (e.removeText(), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(FORMAT_TEXT_COMMAND, (e) => {
				const t = $getSelection();
				return !(!$isRangeSelection(t) && !$isNodeSelection(t)) && ($formatText(t, e), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(SET_TEXT_FORMAT_COMMAND, (e) => {
				const t = $getSelection();
				return !(!$isRangeSelection(t) && !$isNodeSelection(t)) && ($setTextFormat(t, e), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(FORMAT_ELEMENT_COMMAND, (e) => {
				const t = $getSelection();
				if (!$isRangeSelection(t) && !$isNodeSelection(t)) return !1;
				const n = t.getNodes();
				for (const t of n) {
					const n = $findMatchingParent$1(t, (e) => $isElementNode(e) && !e.isInline());
					null !== n && n.setFormat(e);
				}
				return !0;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(INSERT_LINE_BREAK_COMMAND, (e) => {
				const t = $getSelection();
				return !!$isRangeSelection(t) && (t.insertLineBreak(e), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
				const e = $getSelection();
				return !!$isRangeSelection(e) && (e.insertParagraph(), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(INSERT_TAB_COMMAND, () => {
				const e = $createTabNode(), t = $getSelection();
				return $isRangeSelection(t) && (e.setFormat(t.format), e.setStyle(t.style)), $insertNodes([e]), !0;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(INDENT_CONTENT_COMMAND, () => $handleIndentAndOutdent((e) => {
				const t = e.getIndent();
				e.setIndent(t + 1);
			}), COMMAND_PRIORITY_EDITOR), a.registerCommand(OUTDENT_CONTENT_COMMAND, () => $handleIndentAndOutdent((e) => {
				const t = e.getIndent();
				t > 0 && e.setIndent(Math.max(0, t - 1));
			}), COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_ARROW_UP_COMMAND, (e) => {
				const t = $getSelection();
				if ($isNodeSelection(t)) {
					const n = t.getNodes();
					if (n.length > 0) return e.preventDefault(), Lt$3(n[0], "previous"), !0;
				} else if ($isRangeSelection(t)) {
					if (function(e) {
						const t = e.focus;
						return "root" === t.key && 0 === t.offset;
					}(t)) return e.preventDefault(), !0;
					if (!e.shiftKey && Rt$3(t, "previous")) return e.preventDefault(), !0;
					if (!e.shiftKey && zt$2(t, !0)) return e.preventDefault(), !0;
					if (!e.shiftKey && $t$2(t, !0)) return e.preventDefault(), !0;
				}
				return !1;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_ARROW_DOWN_COMMAND, (e) => {
				const t = $getSelection();
				if ($isNodeSelection(t)) {
					const n = t.getNodes();
					if (n.length > 0) return e.preventDefault(), Lt$3(n[0], "next"), !0;
				} else if ($isRangeSelection(t)) {
					if (function(e) {
						const t = e.focus;
						return "root" === t.key && t.offset === $getRoot().getChildrenSize();
					}(t)) return e.preventDefault(), !0;
					if (!e.shiftKey && Rt$3(t, "next")) return e.preventDefault(), !0;
					if (!e.shiftKey && zt$2(t, !1)) return e.preventDefault(), !0;
					if (!e.shiftKey && $t$2(t, !1)) return e.preventDefault(), !0;
				}
				return !1;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_ARROW_LEFT_COMMAND, (e) => {
				const t = $getSelection();
				if ($isNodeSelection(t)) {
					const n = t.getNodes();
					if (n.length > 0) return e.preventDefault(), Lt$3(n[0], $isParentRTL(n[0]) ? "next" : "previous"), !0;
				}
				if (!$isRangeSelection(t)) return !1;
				if (!e.shiftKey && Rt$3(t, $isParentRTL(t.anchor.getNode()) ? "next" : "previous")) return e.preventDefault(), !0;
				if (e.shiftKey || Ft$2(t, "arrow", "start", c.peek()), $shouldOverrideDefaultCharacterSelection(t, !0)) {
					const n = e.shiftKey;
					return e.preventDefault(), $moveCharacter(t, n, !0), !0;
				}
				return !1;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_ARROW_RIGHT_COMMAND, (e) => {
				const t = $getSelection();
				if ($isNodeSelection(t)) {
					const n = t.getNodes();
					if (n.length > 0) return e.preventDefault(), Lt$3(n[0], $isParentRTL(n[0]) ? "previous" : "next"), !0;
				}
				if (!$isRangeSelection(t)) return !1;
				if (!e.shiftKey && Rt$3(t, $isParentRTL(t.anchor.getNode()) ? "previous" : "next")) return e.preventDefault(), !0;
				if (e.shiftKey || Ft$2(t, "arrow", "end", c.peek()), $shouldOverrideDefaultCharacterSelection(t, !1)) {
					const n = e.shiftKey;
					return e.preventDefault(), $moveCharacter(t, n, !1), !0;
				}
				return !1;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_BACKSPACE_COMMAND, (e) => {
				const t = $getSelection();
				if (!$isNodeSelection(t) && Et$2(e.target)) return !1;
				if ($isRangeSelection(t)) {
					if (function(e) {
						if (!e.isCollapsed()) return !1;
						const { anchor: t } = e;
						if (0 !== t.offset) return !1;
						const n = t.getNode();
						if ($isRootNode(n)) return !1;
						const r = $getNearestBlockElementAncestorOrThrow(n);
						return r.getIndent() > 0 && (r.is(n) || n.is(r.getFirstDescendant()));
					}(t)) return e.preventDefault(), a.dispatchCommand(OUTDENT_CONTENT_COMMAND);
					if (IS_IOS$1 && CAN_USE_BEFORE_INPUT$1) return !1;
				} else if (!$isNodeSelection(t)) return !1;
				return e.preventDefault(), a.dispatchCommand(DELETE_CHARACTER_COMMAND, !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_DELETE_COMMAND, (e) => {
				const t = $getSelection();
				return !(!$isNodeSelection(t) && Et$2(e.target)) && !(!$isRangeSelection(t) && !$isNodeSelection(t)) && (e.preventDefault(), a.dispatchCommand(DELETE_CHARACTER_COMMAND, !1));
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_ENTER_COMMAND, (e) => {
				let t = $getSelection();
				if ($isNodeSelection(t)) {
					const e = t.getNodes();
					1 === e.length && $isDecoratorNode(e[0]) && !e[0].isInline() && (t = e[0].selectNext());
				}
				if (!$isRangeSelection(t)) return !1;
				if (Ft$2(t, "enter", "both", c.peek()), null !== e) {
					if ((IS_IOS$1 || IS_SAFARI$1 || IS_APPLE_WEBKIT$1) && CAN_USE_BEFORE_INPUT$1) return !1;
					if (e.preventDefault(), e.shiftKey) return a.dispatchCommand(INSERT_LINE_BREAK_COMMAND, !1);
				}
				return a.dispatchCommand(INSERT_PARAGRAPH_COMMAND);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_ESCAPE_COMMAND, () => {
				const e = $getSelection();
				return !!$isRangeSelection(e) && (a.blur(), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(DROP_COMMAND, (e) => {
				const [, r] = eventFiles$1(e);
				if (r.length > 0) {
					const n = e.clientX, o = e.clientY, i = caretFromPoint(n, o, a.getRootElement());
					if (null !== i) {
						const { offset: e, node: t } = i, n = $getNearestNodeFromDOMNode(t);
						if (null !== n) {
							const t = $createRangeSelection();
							if ($isTextNode(n)) t.anchor.set(n.getKey(), e, "text"), t.focus.set(n.getKey(), e, "text");
							else {
								const e = n.getParentOrThrow().getKey(), r = n.getIndexWithinParent() + 1;
								t.anchor.set(e, r, "element"), t.focus.set(e, r, "element");
							}
							const r = $normalizeSelection__EXPERIMENTAL(t);
							$setSelection(r);
						}
						a.dispatchCommand(vt$3, r);
					}
					return e.preventDefault(), !0;
				}
				return $handleRichTextDrop(e, a);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(DRAGSTART_COMMAND, (e) => {
				const [t] = eventFiles$1(e), n = $getSelection();
				return !(t && !$isRangeSelection(n)) && ($isRangeSelection(n) && !n.isCollapsed() && null !== e.dataTransfer && (setLexicalClipboardDataTransfer(e.dataTransfer, $getClipboardDataFromSelection(n)), $writeDragSourceToDataTransfer(e.dataTransfer, a)), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(DRAGOVER_COMMAND, (e) => {
				const [n] = eventFiles$1(e), r = $getSelection();
				if (n && !$isRangeSelection(r)) return !1;
				const o = e.clientX, i = e.clientY, s = caretFromPoint(o, i, a.getRootElement());
				if (null !== s) {
					const t = $getNearestNodeFromDOMNode(s.node);
					$isDecoratorNode(t) && e.preventDefault();
				}
				return !0;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(SELECT_ALL_COMMAND, () => {
				const e = $getSelection();
				return $selectAll$1($isRangeSelection(e) && null !== $getSlotFrame(e.anchor.getNode()) ? e : null), !0;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(COPY_COMMAND, (e) => (copyToClipboard(a, objectKlassEquals(e, ClipboardEvent) ? e : null), !0), COMMAND_PRIORITY_EDITOR), a.registerCommand(CUT_COMMAND, (e) => (async function(e, t) {
				await copyToClipboard(t, objectKlassEquals(e, ClipboardEvent) ? e : null), t.update(() => {
					const e = $getSelection();
					$isRangeSelection(e) ? e.removeText() : $isNodeSelection(e) && e.getNodes().forEach((e) => e.remove());
				}, { tag: CUT_TAG });
			}(e, a), !0), COMMAND_PRIORITY_EDITOR), a.registerCommand(PASTE_COMMAND, (t) => {
				const [, n, r] = eventFiles$1(t);
				if (n.length > 0 && !r) return a.dispatchCommand(vt$3, n), !0;
				if (isDOMNode(t.target) && $isSelectionCapturedInDecoratorInput(t.target)) return !1;
				return null !== $getSelection() && (function(t, n) {
					t.preventDefault(), n.update(() => {
						const r = $getSelection(), o = objectKlassEquals(t, InputEvent) || objectKlassEquals(t, KeyboardEvent) ? null : t.clipboardData;
						null != o && null !== r && $insertDataTransferForRichText(o, r, n);
					}, { tag: PASTE_TAG });
				}(t, a), !0);
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_SPACE_COMMAND, () => {
				const e = $getSelection();
				return $isRangeSelection(e) && Ft$2(e, "space", "both", c.peek()), !1;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(KEY_TAB_COMMAND, () => {
				const e = $getSelection();
				return $isRangeSelection(e) && Ft$2(e, "tab", "both", c.peek()), !1;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(MOVE_TO_END, (e) => {
				const t = $getSelection();
				if ($isNodeSelection(t)) return Bt$2(t, !1, e);
				if (!$isRangeSelection(t)) return !1;
				const { anchor: n } = t;
				if ("element" !== n.type || 0 !== n.offset) return !1;
				const r = n.getNode();
				if (!$isElementNode(r)) return !1;
				const o = r.getFirstChild();
				if (!$isDecoratorNode(o) || !o.isInline()) return !1;
				const i = r.getKey(), s = r.selectEnd();
				return e.shiftKey && s.anchor.set(i, 0, "element"), e.preventDefault(), e.stopPropagation(), !0;
			}, COMMAND_PRIORITY_EDITOR), a.registerCommand(MOVE_TO_START, (e) => {
				const t = $getSelection();
				if ($isNodeSelection(t)) return Bt$2(t, !0, e);
				if (!$isRangeSelection(t)) return !1;
				const { anchor: n, focus: r } = t, o = $findMatchingParent$1(r.getNode(), (e) => $isElementNode(e) && !e.isInline());
				if (null === o) return !1;
				const i = o.getFirstChild();
				if (!$isDecoratorNode(i) || !i.isInline()) return !1;
				if ($findMatchingParent$1(n.getNode(), (e) => $isElementNode(e) && !e.isInline()) !== o) return !1;
				const s = o.getKey();
				return ("element" !== r.type || r.key !== s || 0 !== r.offset) && (t.focus.set(s, 0, "element"), e.shiftKey || t.anchor.set(s, 0, "element"), e.preventDefault(), e.stopPropagation(), !0);
			}, COMMAND_PRIORITY_EDITOR));
		}
		//#endregion
		//#region node_modules/@lexical/rich-text/dist/LexicalRichText.mjs
		const mod$4 = LexicalRichText_prod_exports;
		const $createHeadingNode = mod$4.$createHeadingNode;
		mod$4.$createQuoteNode;
		const $isHeadingNode = mod$4.$isHeadingNode;
		const $isQuoteNode = mod$4.$isQuoteNode;
		mod$4.DRAG_DROP_PASTE;
		const HeadingNode = mod$4.HeadingNode;
		const QuoteNode = mod$4.QuoteNode;
		mod$4.RichTextExtension;
		mod$4.RichTextImportExtension;
		mod$4.RichTextImportRules;
		mod$4.ShadowRootQuoteRule;
		mod$4.eventFiles;
		mod$4.quoteShadowRootState;
		const registerRichText = mod$4.registerRichText;
		//#endregion
		//#region node_modules/@lexical/history/dist/LexicalHistory.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalHistory_prod_exports = /* @__PURE__ */ __exportAll({
			HistoryExtension: () => H$1,
			SharedHistoryExtension: () => I,
			createEmptyHistoryState: () => z,
			registerHistory: () => O
		});
		function E(t, e, n, o, r) {
			if (null === t || 0 === n.size && 0 === o.size && !r) return 0;
			const a = e._selection, i = t._selection;
			if (r) return 1;
			if (!($isRangeSelection(a) && $isRangeSelection(i) && i.isCollapsed() && a.isCollapsed())) return 0;
			const l = function(t, e, n) {
				const o = t._nodeMap, r = [];
				for (const t of e) {
					const e = o.get(t);
					void 0 !== e && r.push(e);
				}
				for (const [t, e] of n) {
					if (!e) continue;
					const n = o.get(t);
					void 0 === n || $isRootNode(n) || r.push(n);
				}
				return r;
			}(e, n, o);
			if (0 === l.length) return 0;
			if (l.length > 1) {
				const n = e._nodeMap, o = n.get(a.anchor.key), r = n.get(i.anchor.key);
				return o && r && !t._nodeMap.has(o.__key) && $isTextNode(o) && 1 === o.__text.length && 1 === a.anchor.offset ? 2 : 0;
			}
			const s = l[0], u = t._nodeMap.get(s.__key);
			if (!$isTextNode(u) || !$isTextNode(s) || u.__mode !== s.__mode) return 0;
			const d = u.__text, c = s.__text;
			if (d === c) return 0;
			const p = a.anchor, f = i.anchor;
			if (p.key !== f.key || "text" !== p.type) return 0;
			const h = p.offset, m = f.offset, g = c.length - d.length;
			return 1 === g && m === h - 1 ? 2 : -1 === g && m === h + 1 ? 3 : -1 === g && m === h ? 4 : 0;
		}
		function D(t, e, n) {
			let o = n(), r = 0, a = o, i = 0, l = null;
			return (s, u, d, c, p, f) => {
				const h = n();
				if (f.has(COMPOSITION_START_TAG) && (a = o, i = r, l = s), f.has(HISTORIC_TAG)) return r = 0, o = h, 2;
				f.has(COMPOSITION_END_TAG) && l && (o = a, r = i, s = l);
				const m = f.has(PASTE_TAG) || f.has(CUT_TAG) ? 0 : E(s, u, c, p, t.isComposing()), w = (() => {
					const n = null === d || d.editor === t, a = f.has(HISTORY_PUSH_TAG);
					if (!a && n && f.has(HISTORY_MERGE_TAG)) return 0;
					if (1 === m) return 2;
					if (null === s) return 1;
					const i = u._selection;
					if (!(c.size > 0 || p.size > 0)) return null !== i ? 0 : 2;
					const l = "number" == typeof e ? e : e.peek();
					if (!1 === a && 0 !== m && m === r && h < o + l && n) return 0;
					if (1 === c.size) {
						if (function(t, e, n) {
							const o = e._nodeMap.get(t), r = n._nodeMap.get(t), a = e._selection, i = n._selection;
							return !($isRangeSelection(a) && $isRangeSelection(i) && "element" === a.anchor.type && "element" === a.focus.type && "text" === i.anchor.type && "text" === i.focus.type || !$isTextNode(o) || !$isTextNode(r) || o.__parent !== r.__parent) && JSON.stringify(e.read(() => o.exportJSON())) === JSON.stringify(n.read(() => r.exportJSON()));
						}(Array.from(c)[0], s, u)) return 0;
					}
					return 1;
				})();
				return o = h, r = m, w;
			};
		}
		function M(t, e) {
			t.undoStack = [], t.redoStack = [], t.current = null, e && e(t);
		}
		function O(t, e, n, o = Date.now, r, f = null) {
			const h = D(t, n, o), m = () => {
				r && r(e);
			};
			return m(), mergeRegister$1(t.registerCommand(UNDO_COMMAND, () => (function(t, e, n) {
				const o = e.redoStack, r = e.undoStack;
				if (0 !== r.length) {
					const a = e.current, i = r.pop();
					null !== a && (o.push(a), t.dispatchCommand(CAN_REDO_COMMAND, !0)), 0 === r.length && t.dispatchCommand(CAN_UNDO_COMMAND, !1), e.current = i || null, n && n(e), i && i.editor.setEditorState(i.editorState, { tag: HISTORIC_TAG });
				}
			}(t, e, r), !0), COMMAND_PRIORITY_EDITOR), t.registerCommand(REDO_COMMAND, () => (function(t, e, n) {
				const o = e.redoStack, r = e.undoStack;
				if (0 !== o.length) {
					const a = e.current;
					null !== a && (r.push(a), t.dispatchCommand(CAN_UNDO_COMMAND, !0));
					const i = o.pop();
					0 === o.length && t.dispatchCommand(CAN_REDO_COMMAND, !1), e.current = i || null, n && n(e), i && i.editor.setEditorState(i.editorState, { tag: HISTORIC_TAG });
				}
			}(t, e, r), !0), COMMAND_PRIORITY_EDITOR), t.registerCommand(CLEAR_EDITOR_COMMAND, () => (M(e, r), !1), COMMAND_PRIORITY_EDITOR), t.registerCommand(CLEAR_HISTORY_COMMAND, () => (M(e, r), t.dispatchCommand(CAN_REDO_COMMAND, !1), t.dispatchCommand(CAN_UNDO_COMMAND, !1), !0), COMMAND_PRIORITY_EDITOR), t.registerUpdateListener(({ editorState: n, prevEditorState: o, dirtyLeaves: r, dirtyElements: a, tags: i }) => {
				const l = e.current, s = e.redoStack, u = e.undoStack, d = null === l ? null : l.editorState;
				if (null !== l && n === d) return;
				const g = h(o, n, l, r, a, i);
				if (1 === g) {
					if (0 !== s.length && (e.redoStack = [], t.dispatchCommand(CAN_REDO_COMMAND, !1)), null !== l) {
						u.push({ ...l });
						const e = "number" == typeof f || null === f ? f : f.peek();
						null !== e && u.length > e && u.splice(0, u.length - e), t.dispatchCommand(CAN_UNDO_COMMAND, !0);
					}
				} else if (2 === g) return;
				e.current = {
					editor: t,
					editorState: n
				}, m();
			}));
		}
		function z() {
			return {
				current: null,
				redoStack: [],
				undoStack: []
			};
		}
		const H$1 = /* @__PURE__ */ defineExtension$1({
			build: (t, { delay: e, createInitialHistoryState: o, disabled: r, maxDepth: a, now: i }, l) => ({
				...namedSignals({
					delay: e,
					disabled: r,
					historyState: o(t),
					maxDepth: a,
					now: i
				}),
				...l.getInitResult()
			}),
			config: /* @__PURE__ */ safeCast$1({
				createInitialHistoryState: z,
				delay: 300,
				disabled: "undefined" == typeof window,
				maxDepth: null,
				now: Date.now
			}),
			init: () => ({
				canRedo: signal(!1),
				canUndo: signal(!1)
			}),
			name: "@lexical/history/History",
			register: (e, n, r) => {
				const { canUndo: a, canRedo: i } = r.getInitResult(), l = r.getOutput(), s = (t) => batch(() => {
					a.value = null != t && t.undoStack.length > 0, i.value = null != t && t.redoStack.length > 0;
				});
				return effect(() => {
					if (!l.disabled.value) return O(e, l.historyState.value, l.delay, () => l.now.peek()(), s, l.maxDepth);
					s(null);
				});
			}
		});
		const I = /* @__PURE__ */ defineExtension$1({
			build: (t, { disabled: e, parentEditor: o }) => namedSignals({
				disabled: e,
				parentEditor: o || t._parentEditor
			}),
			config: /* @__PURE__ */ safeCast$1({
				disabled: !1,
				parentEditor: null
			}),
			dependencies: [/* @__PURE__ */ configExtension$1(H$1, { disabled: !0 })],
			name: "@lexical/history/SharedHistory",
			register: (e, n, a) => effect(() => {
				const { disabled: t, parentEditor: e } = a.getOutput();
				if (!t.value) {
					const { output: t } = a.getDependency(H$1), n = function(t) {
						return t ? getPeerDependencyFromEditor(t, H$1.name) : null;
					}(e.value);
					if (!n) return;
					const i = n.output;
					batch(() => {
						t.delay.value = i.delay.value, t.historyState.value = i.historyState.value, t.now.value = i.now.value, t.disabled.value = i.disabled.value;
					});
				}
			})
		});
		//#endregion
		//#region node_modules/@lexical/history/dist/LexicalHistory.mjs
		const mod$3 = LexicalHistory_prod_exports;
		mod$3.HistoryExtension;
		mod$3.SharedHistoryExtension;
		const createEmptyHistoryState = mod$3.createEmptyHistoryState;
		const registerHistory = mod$3.registerHistory;
		//#endregion
		//#region node_modules/@lexical/list/dist/LexicalList.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalList_prod_exports = /* @__PURE__ */ __exportAll({
			$createListItemNode: () => At$2,
			$createListNode: () => Mt$1,
			$getListDepth: () => ht$2,
			$handleListInsertParagraph: () => xt$2,
			$insertList: () => _t$2,
			$isListItemNode: () => Ot$2,
			$isListNode: () => $t$1,
			$removeList: () => bt$2,
			CheckListExtension: () => se,
			INSERT_CHECK_LIST_COMMAND: () => Rt$2,
			INSERT_ORDERED_LIST_COMMAND: () => te,
			INSERT_UNORDERED_LIST_COMMAND: () => Zt$1,
			ListExtension: () => ie,
			ListImportExtension: () => oe,
			ListImportRules: () => Qt$1,
			ListItemNode: () => Nt$2,
			ListNode: () => It$1,
			ListSchema: () => Gt$1,
			REMOVE_LIST_COMMAND: () => ee,
			UPDATE_LIST_START_COMMAND: () => Yt$1,
			registerCheckList: () => Kt$1,
			registerList: () => ne,
			registerListStrictIndentTransform: () => re
		});
		function gt$2(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
			r.append("code", t);
			for (const t of e) r.append("v", t);
			throw n.search = r.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		function ht$2(t) {
			let e = 1, n = t.getParent();
			for (; null != n;) {
				if (Ot$2(n)) {
					const t = n.getParent();
					if ($t$1(t)) {
						e++, n = t.getParent();
						continue;
					}
					gt$2(40);
				}
				return e;
			}
			return e;
		}
		function ft$2(t) {
			const e = t.getParent();
			$t$1(e) || gt$2(40);
			let n = e, r = e;
			for (; null !== r;) r = r.getParent(), $t$1(r) && (n = r);
			return n;
		}
		function dt$2(t) {
			let e = [];
			const n = t.getChildren().filter(Ot$2);
			for (let t = 0; t < n.length; t++) {
				const r = n[t], i = r.getFirstChild();
				$t$1(i) ? e = e.concat(dt$2(i)) : e.push(r);
			}
			return e;
		}
		function pt$2(t) {
			return Ot$2(t) && $t$1(t.getFirstChild());
		}
		function mt$2(t, e) {
			return Ot$2(t) && (0 === e.length || 1 === e.length && t.is(e[0]) && 0 === t.getChildrenSize());
		}
		function _t$2(t) {
			const e = $getSelection();
			if (null !== e) {
				let n = e.getNodes();
				if ($isRangeSelection(e)) {
					const [r] = e.getStartEndPoints(), i = r.getNode(), l = i.getParent();
					if ($isRootOrShadowRoot(i)) {
						const t = i.getFirstChild();
						if (t) n = t.selectStart().getNodes();
						else {
							const t = $createParagraphNode();
							i.append(t), n = t.select().getNodes();
						}
					} else if (mt$2(i, n)) {
						const e = Mt$1(t);
						if ($isRootOrShadowRoot(l)) {
							i.replace(e);
							const t = At$2();
							$isElementNode(i) && (t.setFormat(i.getFormatType()), t.setIndent(i.getIndent())), e.append(t);
						} else if (Ot$2(i)) {
							const t = i.getParentOrThrow();
							yt$1(e, t.getChildren()), t.replace(e);
						}
						return;
					}
				}
				const i = /* @__PURE__ */ new Set();
				for (let e = 0; e < n.length; e++) {
					const r = n[e];
					if ($isElementNode(r) && r.isEmpty() && !Ot$2(r) && !i.has(r.getKey())) {
						Ct$2(r, t);
						continue;
					}
					let o = $isLeafNode(r) ? r.getParent() : Ot$2(r) && r.isEmpty() ? r : null;
					for (; null != o;) {
						const e = o.getKey();
						if ($t$1(o)) {
							if (!i.has(e)) {
								const n = Mt$1(t);
								yt$1(n, o.getChildren()), o.replace(n), i.add(e);
							}
							break;
						}
						{
							const n = o.getParent();
							if ($isRootOrShadowRoot(n) && !i.has(e)) {
								i.add(e), Ct$2(o, t);
								break;
							}
							o = n;
						}
					}
				}
			}
		}
		function yt$1(t, e) {
			t.splice(t.getChildrenSize(), 0, e);
		}
		function Ct$2(t, e) {
			if ($t$1(t)) return t;
			const i = t.getPreviousSibling(), s = t.getNextSibling(), o = At$2();
			let l;
			if (yt$1(o, t.getChildren()), $t$1(i) && e === i.getListType()) i.append(o), $t$1(s) && e === s.getListType() && (yt$1(i, s.getChildren()), s.remove()), l = i;
			else if ($t$1(s) && e === s.getListType()) s.getFirstChildOrThrow().insertBefore(o), l = s;
			else {
				const n = Mt$1(e);
				n.append(o), t.replace(n), l = n;
			}
			o.setFormat(t.getFormatType()), o.setIndent(t.getIndent());
			const c = $getSelection();
			return $isRangeSelection(c) && (l.getKey() === c.anchor.key && c.anchor.set(o.getKey(), c.anchor.offset, "element"), l.getKey() === c.focus.key && c.focus.set(o.getKey(), c.focus.offset, "element")), t.remove(), l;
		}
		function kt$2(t, e) {
			const n = t.getLastChild(), r = e.getFirstChild();
			n && r && pt$2(n) && pt$2(r) && (kt$2(n.getFirstChild(), r.getFirstChild()), r.remove());
			const i = e.getChildren();
			i.length > 0 && t.append(...i), e.remove();
		}
		function bt$2() {
			const e = $getSelection();
			if ($isRangeSelection(e)) {
				const n = /* @__PURE__ */ new Set(), r = e.getNodes(), i = e.anchor.getNode();
				if (mt$2(i, r)) n.add(ft$2(i));
				else for (let e = 0; e < r.length; e++) {
					const i = r[e];
					if ($isLeafNode(i)) {
						const e = $getNearestNodeOfType(i, Nt$2);
						null != e && n.add(ft$2(e));
					}
				}
				for (const t of n) {
					let n = t;
					const r = dt$2(t);
					for (const t of r) {
						const r = $createParagraphNode().setTextStyle(e.style).setTextFormat(e.format);
						yt$1(r, t.getChildren()), n.insertAfter(r), n = r, t.__key === e.anchor.key && $setPointFromCaret(e.anchor, $normalizeCaret($getChildCaret(r, "next"))), t.__key === e.focus.key && $setPointFromCaret(e.focus, $normalizeCaret($getChildCaret(r, "next"))), t.remove();
					}
					t.remove();
				}
			}
		}
		function St$2(t) {
			const e = "check" !== t.getListType();
			let n = t.getStart();
			for (const r of t.getChildren()) Ot$2(r) && (r.getValue() !== n && r.setValue(n), e && null != r.getLatest().__checked && r.setChecked(void 0), $t$1(r.getFirstChild()) || n++);
		}
		function Tt$2(t) {
			const e = /* @__PURE__ */ new Set();
			if (pt$2(t) || e.has(t.getKey())) return;
			const n = t.getParent(), r = t.getNextSibling(), i = t.getPreviousSibling();
			if (pt$2(r) && pt$2(i)) {
				const n = i.getFirstChild();
				if ($t$1(n)) {
					n.append(t);
					const i = r.getFirstChild();
					if ($t$1(i)) yt$1(n, i.getChildren()), r.remove(), e.add(r.getKey());
				}
			} else if (pt$2(r)) {
				const e = r.getFirstChild();
				if ($t$1(e)) {
					const n = e.getFirstChild();
					null !== n && n.insertBefore(t);
				}
			} else if (pt$2(i)) {
				const e = i.getFirstChild();
				$t$1(e) && e.append(t);
			} else if ($t$1(n)) {
				const e = $copyNode(t), s = $copyNode(n);
				e.append(s), s.append(t), i ? i.insertAfter(e) : r ? r.insertBefore(e) : n.append(e);
			}
		}
		function vt$2(t) {
			if (pt$2(t)) return;
			const e = t.getParent(), n = e ? e.getParent() : void 0;
			if ($t$1(n ? n.getParent() : void 0) && Ot$2(n) && $t$1(e)) {
				const r = e ? e.getFirstChild() : void 0, i = e ? e.getLastChild() : void 0;
				if (t.is(r)) n.insertBefore(t), e.isEmpty() && n.remove();
				else if (t.is(i)) n.insertAfter(t), e.isEmpty() && n.remove();
				else {
					const r = $copyNode(t), i = $copyNode(e);
					r.append(i), t.getPreviousSiblings().forEach((t) => i.append(t));
					const s = $copyNode(t), o = $copyNode(e);
					s.append(o), yt$1(o, t.getNextSiblings()), n.insertBefore(r), n.insertAfter(s), n.replace(t);
				}
			}
		}
		function xt$2(t = !1) {
			const e = $getSelection();
			if (!$isRangeSelection(e) || !e.isCollapsed()) return !1;
			const c = e.anchor.getNode();
			let a = null;
			if (Ot$2(c) && 0 === c.getChildrenSize()) a = c;
			else if ($isTextNode(c)) {
				const t = c.getParent();
				Ot$2(t) && t.getChildren().every((t) => $isTextNode(t) && "" === t.getTextContent().trim()) && (a = t);
			}
			if (null === a) return !1;
			const u = ft$2(a), g = a.getParent();
			$t$1(g) || gt$2(40);
			const h = g.getParent();
			let f;
			if ($isRootOrShadowRoot(h)) f = $createParagraphNode(), u.insertAfter(f);
			else {
				if (!Ot$2(h)) return !1;
				f = $copyNode(h), h.insertAfter(f);
			}
			f.setTextStyle(e.style).setTextFormat(e.format).select();
			const d = a.getNextSiblings();
			if (d.length > 0) {
				const e = t ? function(t, e) {
					return t.getStart() + e.getIndexWithinParent();
				}(g, a) : 1, n = $copyNode(g).setStart(e);
				if (Ot$2(f)) {
					const t = $copyNode(f);
					t.append(n), f.insertAfter(t);
				} else f.insertAfter(n);
				n.append(...d);
			}
			return function(t) {
				let e = t;
				for (; null == e.getNextSibling() && null == e.getPreviousSibling();) {
					const t = e.getParent();
					if (null == t || !Ot$2(t) && !$t$1(t)) break;
					e = t;
				}
				e.remove();
			}(a), !0;
		}
		var Nt$2 = class extends ElementNode {
			__value;
			__checked;
			$config() {
				return this.config("listitem", {
					$transform: (t) => {
						const e = t.getParent();
						if ($t$1(e)) "check" !== e.getListType() && null != t.getChecked() && t.setChecked(void 0);
						else if (e) {
							const n = t.createParentElementNode();
							$t$1(n) || gt$2(340);
							const r = [t];
							for (const e of ["previous", "next"]) {
								r.reverse();
								for (const { origin: n } of $getSiblingCaret(t, e)) {
									if (!Ot$2(n)) break;
									r.push(n);
								}
							}
							t.insertBefore(n), n.splice(0, 0, r), $isRootOrShadowRoot(e) || ($insertNodeToNearestRootAtCaret$1(n, $rewindSiblingCaret($getSiblingCaret(n, "next")), {
								$shouldSplit: () => !1,
								removeEmptyDestination: !0
							}), e.isEmpty() && e.isAttached() && e.remove());
						}
					},
					extends: ElementNode,
					importDOM: buildImportMap({ li: () => ({
						conversion: Pt$2,
						priority: 0
					}) })
				});
			}
			constructor(t = 1, e = void 0, n) {
				super(n), this.__value = void 0 === t ? 1 : t, this.__checked = e;
			}
			afterCloneFrom(t) {
				super.afterCloneFrom(t), this.__value = t.__value, this.__checked = t.__checked;
			}
			createDOM(t) {
				const e = $getDocument().createElement("li");
				return this.updateListItemDOM(null, e, t), e;
			}
			updateListItemDOM(t, e, n) {
				(function(t, e) {
					const n = e.getParent();
					!$t$1(n) || "check" !== n.getListType() || $t$1(e.getFirstChild()) ? (t.removeAttribute("role"), t.removeAttribute("tabIndex"), t.removeAttribute("aria-checked")) : (t.setAttribute("role", "checkbox"), t.setAttribute("tabIndex", "-1"), t.setAttribute("aria-checked", e.getChecked() ? "true" : "false"));
				})(e, this), e.value = this.__value, function(t, e, n) {
					const r = e.list;
					if (!r) return;
					const i = r.listitem, s = r.nested && r.nested.listitem, o = n.getParent(), l = $t$1(o) && "check" === o.getListType(), c = n.getChecked(), a = n.getChildren().some((t) => $t$1(t)), u = [];
					void 0 !== r.listitemChecked && u.push(r.listitemChecked);
					void 0 !== r.listitemUnchecked && u.push(r.listitemUnchecked);
					void 0 !== s && u.push(...normalizeClassNames(s));
					u.length > 0 && removeClassNamesFromElement$1(t, ...u);
					const g = [];
					void 0 !== i && g.push(...normalizeClassNames(i));
					if (l) {
						const t = c ? r.listitemChecked : r.listitemUnchecked;
						void 0 !== t && g.push(t);
					}
					void 0 !== s && a && g.push(...normalizeClassNames(s));
					g.length > 0 && addClassNamesToElement$1(t, ...g);
				}(e, n.theme, this);
				const r = t ? t.__style : "", i = this.__style;
				r !== i && setDOMStyleFromCSS(e.style, i, r), function(t, e, n) {
					const r = e.__textStyle, i = n ? n.__textStyle : "";
					if (null !== n && i === r) return;
					const s = getStyleObjectFromCSS$1(r);
					for (const e in s) t.style.setProperty(`--listitem-marker-${e}`, s[e]);
					if ("" !== i) for (const e in getStyleObjectFromCSS$1(i)) e in s || t.style.removeProperty(`--listitem-marker-${e}`);
				}(e, this, t);
			}
			updateDOM(t, e, n) {
				const r = e;
				return this.updateListItemDOM(t, r, n), !1;
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setValue(t.value).setChecked(t.checked);
			}
			exportDOM(t) {
				const e = this.createDOM(t._config), n = this.getFormatType();
				n && (e.style.textAlign = n);
				const r = this.getDirection();
				return r && (e.dir = r), pt$2(this) ? {
					after(t) {
						if (isHTMLElement$1(t)) {
							const e = t.previousElementSibling;
							if (isHTMLElement$1(e) && "LI" === e.nodeName) {
								for (; t.firstChild;) e.append(t.firstChild);
								t.remove();
							}
						}
						return t;
					},
					element: e
				} : { element: e };
			}
			exportJSON() {
				return {
					...super.exportJSON(),
					checked: this.getChecked(),
					value: this.getValue()
				};
			}
			append(...t) {
				for (let e = 0; e < t.length; e++) {
					const n = t[e];
					if ($isElementNode(n) && this.canMergeWith(n)) {
						const t = n.getChildren();
						this.append(...t), n.remove();
					} else super.append(n);
				}
				return this;
			}
			replace(t, e) {
				if (Ot$2(t)) return super.replace(t);
				this.setIndent(0);
				const i = this.getParentOrThrow();
				if (!$t$1(i)) return t;
				if (i.__first === this.getKey()) i.insertBefore(t);
				else if (i.__last === this.getKey()) i.insertAfter(t);
				else {
					const e = $copyNode(i);
					let n = this.getNextSibling();
					for (; n;) {
						const t = n;
						n = n.getNextSibling(), e.append(t);
					}
					i.insertAfter(t), t.insertAfter(e);
				}
				const s = this.__key;
				let o = 0;
				if (e && ($isElementNode(t) || gt$2(139), o = t.getChildrenSize(), t.splice(o, 0, this.getChildren())), e && $isElementNode(t)) {
					const e = $getSelection();
					if ($isRangeSelection(e)) for (const n of e.getStartEndPoints()) n.key === s && "element" === n.type && n.set(t.getKey(), o + n.offset, "element");
				}
				return this.remove(), 0 === i.getChildrenSize() && i.remove(), t;
			}
			insertAfter(t, e = !0) {
				const n = this.getParentOrThrow();
				if ($t$1(n) || gt$2(39), Ot$2(t)) return super.insertAfter(t, e);
				const r = this.getNextSiblings();
				if (n.insertAfter(t, e), 0 !== r.length) {
					const i = $copyNode(n);
					r.forEach((t) => i.append(t)), t.insertAfter(i, e);
				}
				return t;
			}
			remove(t) {
				const e = this.getPreviousSibling(), n = this.getNextSibling();
				super.remove(t), e && n && pt$2(e) && pt$2(n) && (kt$2(e.getFirstChild(), n.getFirstChild()), n.remove());
			}
			resetOnCopyNodeFrom(t) {
				super.resetOnCopyNodeFrom(t), t.getChecked() && this.setChecked(!1);
			}
			insertNewAfter(t, e = !0) {
				const n = $copyNode(this);
				return this.insertAfter(n, e), n;
			}
			collapseAtStart(t) {
				if (pt$2(this)) return !1;
				const e = this.getParentOrThrow();
				if (Ot$2(e.getParentOrThrow())) return vt$2(this), !0;
				const n = $createParagraphNode().append(...this.getChildren()), r = this.getNextSiblings();
				if (r.length > 0) {
					const t = $copyNode(e);
					t.append(...r), e.insertAfter(t);
				}
				return e.insertAfter(n), this.remove(), 0 === e.getChildrenSize() && e.remove(), n.selectStart(), !0;
			}
			getValue() {
				return this.getLatest().__value;
			}
			setValue(t) {
				const e = this.getWritable();
				return e.__value = t, e;
			}
			getChecked() {
				const t = this.getLatest();
				let e;
				const n = this.getParent();
				return $t$1(n) && (e = n.getListType()), "check" === e ? Boolean(t.__checked) : void 0;
			}
			setChecked(t) {
				const e = this.getWritable();
				return e.__checked = t, e;
			}
			toggleChecked() {
				const t = this.getWritable();
				return t.setChecked(!t.__checked);
			}
			getIndent() {
				const t = this.getParent();
				if (null === t || !this.isAttached()) return this.getLatest().__indent;
				let e = t.getParentOrThrow(), n = 0;
				for (; Ot$2(e);) e = e.getParentOrThrow().getParentOrThrow(), n++;
				return n;
			}
			setIndent(t) {
				"number" != typeof t && gt$2(117), (t = Math.floor(t)) >= 0 || gt$2(199);
				let e = this.getIndent();
				for (; e !== t;) e < t ? (Tt$2(this), e++) : (vt$2(this), e--);
				return this;
			}
			canInsertAfter(t) {
				return Ot$2(t);
			}
			canReplaceWith(t) {
				return Ot$2(t);
			}
			canMergeWith(t) {
				return Ot$2(t) || $isParagraphNode(t);
			}
			extractWithChild(t, e) {
				if (!$isRangeSelection(e)) return !1;
				const n = e.anchor.getNode(), i = e.focus.getNode();
				return this.isParentOf(n) && this.isParentOf(i) && this.getTextContent().length === e.getTextContent().length;
			}
			isParentRequired() {
				return !0;
			}
			createParentElementNode() {
				return Mt$1("bullet");
			}
			canMergeWhenEmpty() {
				return !0;
			}
		};
		function Pt$2(t) {
			if (t.classList.contains("task-list-item")) {
				for (const e of t.children) if ("INPUT" === e.tagName) return Lt$2(e);
			}
			if (t.classList.contains("joplin-checkbox")) {
				for (const e of t.children) if (e.classList.contains("checkbox-wrapper") && e.children.length > 0 && "INPUT" === e.children[0].tagName) return Lt$2(e.children[0]);
			}
			const e = t.getAttribute("aria-checked"), n = At$2("true" === e || "false" !== e && void 0);
			return $setFormatFromDOM(n, t), {
				after: Ft$1.bind(null, n),
				node: $setDirectionFromDOM(n, t)
			};
		}
		function Lt$2(t) {
			if (!("checkbox" === t.getAttribute("type"))) return { node: null };
			const e = At$2(t.hasAttribute("checked"));
			return {
				after: Ft$1.bind(null, e),
				node: e
			};
		}
		function Ft$1(t, e) {
			const n = e[0];
			return 1 === e.length && $isParagraphNode(n) && !t.getFormatType() && n.getFormatType() ? (t.setFormat(n.getFormatType()), n.getChildren()) : e;
		}
		function At$2(t) {
			return $applyNodeReplacement(new Nt$2(void 0, t));
		}
		function Ot$2(t) {
			return t instanceof Nt$2;
		}
		var It$1 = class extends ElementNode {
			__tag;
			__start;
			__listType;
			$config() {
				return this.config("list", {
					$transform: (t) => {
						(function(t) {
							const e = t.getNextSibling();
							$t$1(e) && t.getListType() === e.getListType() && kt$2(t, e);
						})(t), St$2(t);
					},
					extends: ElementNode,
					importDOM: buildImportMap({
						ol: () => ({
							conversion: Dt$1,
							priority: 0
						}),
						ul: () => ({
							conversion: Dt$1,
							priority: 0
						})
					})
				});
			}
			constructor(t = "number", e = 1, n) {
				super(n);
				const r = wt$1[t] || t;
				this.__listType = r, this.__tag = "number" === r ? "ol" : "ul", this.__start = e;
			}
			afterCloneFrom(t) {
				super.afterCloneFrom(t), this.__listType = t.__listType, this.__tag = t.__tag, this.__start = t.__start;
			}
			getTag() {
				return this.getLatest().__tag;
			}
			setListType(t) {
				const e = this.getWritable();
				return e.__listType = t, e.__tag = "number" === t ? "ol" : "ul", e;
			}
			getListType() {
				return this.getLatest().__listType;
			}
			getStart() {
				return this.getLatest().__start;
			}
			setStart(t) {
				const e = this.getWritable();
				return e.__start = t, e;
			}
			createDOM(t, e) {
				const n = this.__tag, r = $getDocument().createElement(n);
				return 1 !== this.__start && r.setAttribute("start", String(this.__start)), r.__lexicalListType = this.__listType, Et$1(r, t.theme, this), r;
			}
			updateDOM(t, e, n) {
				return t.__tag !== this.__tag || t.__listType !== this.__listType || (Et$1(e, n.theme, this), t.__start !== this.__start && e.setAttribute("start", String(this.__start)), !1);
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setListType(t.listType).setStart(t.start);
			}
			exportDOM(t) {
				const e = this.createDOM(t._config, t);
				return isHTMLElement$1(e) && (1 !== this.__start && e.setAttribute("start", String(this.__start)), "check" === this.__listType && e.setAttribute("__lexicalListType", "check")), { element: e };
			}
			exportJSON() {
				return {
					...super.exportJSON(),
					listType: this.getListType(),
					start: this.getStart(),
					tag: this.getTag()
				};
			}
			canBeEmpty() {
				return !1;
			}
			canIndent() {
				return !1;
			}
			splice(t, e, n) {
				let r = n;
				for (let t = 0; t < n.length; t++) {
					const e = n[t];
					Ot$2(e) || (r === n && (r = [...n]), r[t] = this.createListItemNode().append(!$isElementNode(e) || $t$1(e) || e.isInline() ? e : $createTextNode(e.getTextContent())));
				}
				return super.splice(t, e, r);
			}
			extractWithChild(t) {
				return Ot$2(t);
			}
			createListItemNode() {
				return At$2();
			}
		};
		function Et$1(t, e, n) {
			const r = [], i = [], s = e.list;
			if (void 0 !== s) {
				const t = s[`${n.__tag}Depth`] || [], e = ht$2(n) - 1, o = e % t.length, l = t[o], c = s[n.__tag];
				let a;
				const u = s.nested, g = s.checklist;
				if (void 0 !== u && u.list && (a = u.list), void 0 !== c && r.push(c), void 0 !== g && "check" === n.__listType && r.push(g), void 0 !== l) {
					r.push(...normalizeClassNames(l));
					for (let e = 0; e < t.length; e++) e !== o && i.push(n.__tag + e);
				}
				if (void 0 !== a) {
					const t = normalizeClassNames(a);
					e > 1 ? r.push(...t) : i.push(...t);
				}
			}
			i.length > 0 && removeClassNamesFromElement$1(t, ...i), r.length > 0 && addClassNamesToElement$1(t, ...r);
		}
		function Dt$1(t) {
			let e;
			if (function(t) {
				return isHTMLElement$1(t) && "ol" === t.nodeName.toLowerCase();
			}(t)) {
				const n = t.start;
				e = Mt$1("number", n);
			} else e = function(t) {
				if ("check" === t.getAttribute("__lexicallisttype") || t.classList.contains("contains-task-list") || "1" === t.getAttribute("data-is-checklist")) return !0;
				for (const e of t.childNodes) if (isHTMLElement$1(e) && e.hasAttribute("aria-checked")) return !0;
				return !1;
			}(t) ? Mt$1("check") : Mt$1("bullet");
			return $setDirectionFromDOM(e, t), {
				after: (t) => function(t, e) {
					const n = e.createListItemNode.bind(e), r = [];
					for (let e = 0; e < t.length; e++) {
						const i = t[e];
						if (Ot$2(i)) {
							r.push(i);
							const t = i.getChildren();
							t.length > 1 && t.forEach((t) => {
								$t$1(t) && r.push(n().append(t));
							});
						} else r.push(n().append(i));
					}
					return r;
				}(t, e),
				node: e
			};
		}
		const wt$1 = {
			ol: "number",
			ul: "bullet"
		};
		function Mt$1(t = "number", e = 1) {
			return $applyNodeReplacement(new It$1(t, e));
		}
		function $t$1(t) {
			return t instanceof It$1;
		}
		const Rt$2 = /* @__PURE__ */ createCommand("INSERT_CHECK_LIST_COMMAND");
		function Kt$1(t, e) {
			const i = e && e.disableTakeFocusOnClick || !1, s = "boolean" == typeof i ? () => i : i.peek.bind(i), o = (t) => {
				const e = t.target;
				if (!isHTMLElement$1(e)) return !1;
				const n = e.__lexicalCheckListLastHandled;
				return void 0 !== n && t.timeStamp - n < 500;
			}, l = (t) => {
				const e = t.target;
				isHTMLElement$1(e) && (e.__lexicalCheckListLastHandled = t.timeStamp);
			}, a = (t) => {
				o(t) || (l(t), Wt$1(t, s()));
			}, u = (t) => {
				"touch" === t.pointerType && (o(t) || (l(t), Wt$1(t, s())));
			}, g = (t) => {
				(function(t, e) {
					Bt$1(t, () => {
						t.preventDefault(), e && t.stopPropagation();
					});
				})(t, s());
			};
			return mergeRegister$1(t.registerCommand(Rt$2, () => (_t$2("check"), !0), COMMAND_PRIORITY_LOW), t.registerCommand(KEY_ARROW_DOWN_COMMAND, (e) => Jt$1(e, t, !1), COMMAND_PRIORITY_LOW), t.registerCommand(KEY_ARROW_UP_COMMAND, (e) => Jt$1(e, t, !0), COMMAND_PRIORITY_LOW), t.registerCommand(KEY_ESCAPE_COMMAND, () => {
				if (null != Ut$2(t)) return t.getRootElement()?.focus(), !0;
				return !1;
			}, COMMAND_PRIORITY_LOW), t.registerCommand(KEY_SPACE_COMMAND, (e) => {
				const n = Ut$2(t);
				return !(null == n || !t.isEditable()) && (t.update(() => {
					const t = $getNearestNodeFromDOMNode(n);
					Ot$2(t) && (e.preventDefault(), t.toggleChecked());
				}), !0);
			}, COMMAND_PRIORITY_LOW), t.registerCommand(KEY_ARROW_LEFT_COMMAND, (e) => t.read("latest", () => {
				const i = $getSelection();
				if ($isRangeSelection(i) && i.isCollapsed()) {
					const { anchor: n } = i, r = "element" === n.type;
					if (r || 0 === n.offset) {
						const i = n.getNode(), s = $findMatchingParent$1(i, (t) => $isElementNode(t) && !t.isInline());
						if (Ot$2(s)) {
							const n = s.getParent();
							if ($t$1(n) && "check" === n.getListType() && (r || s.getFirstDescendant() === i)) {
								const n = t.getElementByKey(s.__key);
								if (null != n && getActiveElement(n) !== n) return n.focus(), e.preventDefault(), !0;
							}
						}
					}
				}
				return !1;
			}), COMMAND_PRIORITY_LOW), t.registerRootListener((t) => {
				if (null !== t) return mergeRegister$1(registerEventListeners(t, {
					click: a,
					pointerup: u
				}), registerEventListeners(t, {
					mousedown: g,
					pointerdown: g
				}, { capture: !0 }), registerEventListener(t, "touchstart", g, {
					capture: !0,
					passive: !1
				}));
			}));
		}
		function Bt$1(t, n) {
			const r = t.target;
			if (!isHTMLElement$1(r)) return;
			const i = r.firstChild;
			if (isHTMLElement$1(i) && ("UL" === i.tagName || "OL" === i.tagName)) return;
			const s = r.parentNode;
			if (!s || "check" !== s.__lexicalListType) return;
			let o = null, l = null;
			if ("clientX" in t) o = t.clientX;
			else if ("touches" in t) {
				const e = t.touches;
				e.length > 0 && (o = e[0].clientX, l = "touch");
			}
			if (null == o) return;
			const c = r.getBoundingClientRect(), a = o / calculateZoomLevel(r), u = r.ownerDocument.defaultView, g = u ? u.getComputedStyle(r, "::before") : { width: "0px" }, h = parseFloat(g.width), f = "touch" === l || "pointerType" in t && "touch" === t.pointerType ? 32 : 0;
			("rtl" === r.dir ? a < c.right + f && a > c.right - h - f : a > c.left - f && a < c.left + h + f) && n();
		}
		function Wt$1(t, e) {
			Bt$1(t, () => {
				if (isHTMLElement$1(t.target)) {
					const n = t.target, r = getNearestEditorFromDOMNode(n);
					null != r && r.isEditable() && r.update(() => {
						const t = $getNearestNodeFromDOMNode(n);
						Ot$2(t) && (e ? ($addUpdateTag(SKIP_SELECTION_FOCUS_TAG), $addUpdateTag(SKIP_DOM_SELECTION_TAG)) : n.focus(), t.toggleChecked());
					});
				}
			});
		}
		function Ut$2(t) {
			const e = t.getRootElement(), n = e ? getActiveElement(e) : null;
			return isHTMLElement$1(n) && "LI" === n.tagName && null != n.parentNode && "check" === n.parentNode.__lexicalListType ? n : null;
		}
		function Jt$1(t, e, n) {
			const r = Ut$2(e);
			return null != r && e.update(() => {
				const i = $getNearestNodeFromDOMNode(r);
				if (!Ot$2(i)) return;
				const s = function(t, e) {
					let n = e ? t.getPreviousSibling() : t.getNextSibling(), r = t;
					for (; null == n && Ot$2(r);) r = r.getParentOrThrow().getParent(), null != r && (n = e ? r.getPreviousSibling() : r.getNextSibling());
					for (; Ot$2(n);) {
						const t = e ? n.getLastChild() : n.getFirstChild();
						if (!$t$1(t)) return n;
						n = e ? t.getLastChild() : t.getFirstChild();
					}
					return null;
				}(i, n);
				if (null != s) {
					s.selectStart();
					const n = e.getElementByKey(s.__key);
					null != n && (t.preventDefault(), setTimeout(() => {
						n.focus();
					}, 0));
				}
			}), !1;
		}
		function Vt$1(t) {
			const e = [];
			for (const n of t) if (Ot$2(n)) {
				e.push(n);
				const t = n.getChildren();
				if (t.length > 1) for (const n of t) $t$1(n) && e.push(At$2().append(n));
			} else e.push(At$2().append(n));
			return e;
		}
		const qt$1 = /* @__PURE__ */ defineImportRule({
			$import: (t, e) => {
				let n;
				var r;
				return isElementOfTag(e, "ol") ? n = Mt$1("number", e.start) : n = (r = e).matches("[__lexicallisttype=\"check\"], .contains-task-list, [data-is-checklist=\"1\"]") || null !== r.querySelector(":scope > [aria-checked]") ? Mt$1("check") : Mt$1("bullet"), $setDirectionFromDOM(n, e), [n.splice(0, 0, $propagateTextAlignToBlockChildren(Vt$1(t.$importChildren(e)), e))];
			},
			match: sel.tag("ol", "ul"),
			name: "@lexical/list/list"
		});
		function zt$1(t, e) {
			if (1 !== e.length) return e;
			const n = e[0];
			return $isParagraphNode(n) && !t.getFormatType() && n.getFormatType() ? (t.setFormat(n.getFormatType()), n.getChildren()) : e;
		}
		function jt$1(t) {
			const e = (t) => $isBlockLevel(t) && !$t$1(t);
			if (!t.some(e)) return t;
			const n = [];
			let r = [];
			const i = () => {
				r.length > 0 && (n.push(r), r = []);
			};
			for (const s of t) e(s) ? (i(), n.push($isElementNode(s) ? s.getChildren() : [s])) : r.push(s);
			i();
			const s = [];
			for (const t of n) s.length > 0 && s.push($createLineBreakNode()), s.push(...t);
			return s;
		}
		const Ht$1 = /* @__PURE__ */ defineImportRule({
			$import: (t, e) => {
				const n = e.getAttribute("aria-checked"), r = At$2("true" === n || "false" !== n && void 0);
				return $setFormatFromDOM(r, e), $setDirectionFromDOM(r, e), [r.splice(0, 0, jt$1(zt$1(r, t.$importChildren(e))))];
			},
			match: sel.tag("li"),
			name: "@lexical/list/li"
		});
		function Xt$1(t, e, n) {
			const r = isElementOfTag(n, "input") ? n : n.querySelector("input[type=\"checkbox\"]");
			if (!r || "checkbox" !== r.getAttribute("type")) return [];
			const i = At$2(r.hasAttribute("checked"));
			return $setFormatFromDOM(i, e), $setDirectionFromDOM(i, e), [i.splice(0, 0, jt$1(zt$1(i, t.$importChildren(e))))];
		}
		const Gt$1 = {
			$accepts: (t) => Ot$2(t) || $t$1(t),
			$packageRun: (t) => [At$2().splice(0, 0, t)],
			name: "ListSchema"
		};
		const Qt$1 = [
			/* @__PURE__ */ defineImportRule({
				$import: (t, e, n) => {
					const r = e.querySelector(":scope > input[type=\"checkbox\"]");
					return r ? Xt$1(t, e, r) : n();
				},
				match: sel.tag("li").classAll("task-list-item"),
				name: "@lexical/list/li-task-list-item"
			}),
			/* @__PURE__ */ defineImportRule({
				$import: (t, e, n) => {
					const r = e.querySelector(":scope > .checkbox-wrapper");
					if (!r) return n();
					const i = r.querySelector(":scope > input[type=\"checkbox\"]");
					return i ? Xt$1(t, e, i) : n();
				},
				match: sel.tag("li").classAll("joplin-checkbox"),
				name: "@lexical/list/li-joplin-checkbox"
			}),
			qt$1,
			Ht$1
		];
		const Yt$1 = /* @__PURE__ */ createCommand("UPDATE_LIST_START_COMMAND");
		const Zt$1 = /* @__PURE__ */ createCommand("INSERT_UNORDERED_LIST_COMMAND");
		const te = /* @__PURE__ */ createCommand("INSERT_ORDERED_LIST_COMMAND");
		const ee = /* @__PURE__ */ createCommand("REMOVE_LIST_COMMAND");
		function ne(t, e) {
			return mergeRegister$1(t.registerCommand(te, () => (_t$2("number"), !0), COMMAND_PRIORITY_LOW), t.registerCommand(Yt$1, (t) => {
				const { listNodeKey: e, newStart: n } = t, r = $getNodeByKey(e);
				return !!$t$1(r) && ("number" === r.getListType() && (r.setStart(n), St$2(r)), !0);
			}, COMMAND_PRIORITY_LOW), t.registerCommand(Zt$1, () => (_t$2("bullet"), !0), COMMAND_PRIORITY_LOW), t.registerCommand(ee, () => (bt$2(), !0), COMMAND_PRIORITY_LOW), t.registerCommand(INSERT_PARAGRAPH_COMMAND, () => xt$2(!!(e && e.restoreNumbering)), COMMAND_PRIORITY_LOW), t.registerCommand(KEY_BACKSPACE_COMMAND, (t) => {
				const e = $getSelection();
				if (!$isRangeSelection(e) || !e.isCollapsed()) return !1;
				const { anchor: i } = e;
				if (0 !== i.offset) return !1;
				let s = i.getNode();
				for (; !Ot$2(s);) {
					if (null !== s.getPreviousSibling()) return !1;
					const t = s.getParent();
					if (null === t) return !1;
					s = t;
				}
				return !(!Ot$2(s) || !s.collapseAtStart(e)) && (t.preventDefault(), !0);
			}, COMMAND_PRIORITY_BEFORE_EDITOR), t.registerNodeTransform(Nt$2, (t) => {
				const e = t.getFirstChild();
				if (e) {
					if ($isTextNode(e)) {
						const n = e.getStyle(), r = e.getFormat();
						t.getTextStyle() !== n && t.setTextStyle(n), t.getTextFormat() !== r && t.setTextFormat(r);
					}
				} else {
					const e = $getSelection();
					$isRangeSelection(e) && (e.style !== t.getTextStyle() || e.format !== t.getTextFormat()) && e.isCollapsed() && t.is(e.anchor.getNode()) && t.setTextStyle(e.style).setTextFormat(e.format);
				}
			}), t.registerNodeTransform(TextNode, (t) => {
				const e = t.getParent();
				if (Ot$2(e) && t.is(e.getFirstChild())) {
					const n = t.getStyle(), r = t.getFormat();
					n === e.getTextStyle() && r === e.getTextFormat() || e.setTextStyle(n).setTextFormat(r);
				}
			}));
		}
		function re(t) {
			const e = (t) => {
				const e = t.getParent();
				if ($t$1(t.getFirstChild()) || !$t$1(e)) return;
				const n = $findMatchingParent$1(t, (t) => Ot$2(t) && $t$1(t.getParent()) && Ot$2(t.getPreviousSibling()));
				if (null === n && t.getIndent() > 0) t.setIndent(0);
				else if (Ot$2(n)) {
					const r = n.getPreviousSibling();
					if (Ot$2(r)) {
						const i = function(t) {
							let e = t, n = e.getFirstChild();
							for (; $t$1(n);) {
								const t = n.getLastChild();
								if (!Ot$2(t)) break;
								e = t, n = e.getFirstChild();
							}
							return e;
						}(r).getParent();
						if ($t$1(i)) {
							const n = ht$2(i);
							n + 1 < ht$2(e) && t.setIndent(n);
						}
					}
				}
			};
			return t.registerNodeTransform(It$1, (t) => {
				const n = [t];
				for (; n.length > 0;) {
					const t = n.shift();
					if ($t$1(t)) {
						for (const r of t.getChildren()) if (Ot$2(r)) {
							e(r);
							const t = r.getFirstChild();
							$t$1(t) && n.push(t);
						}
					}
				}
			});
		}
		const ie = /* @__PURE__ */ defineExtension$1({
			build: (t, e, n) => namedSignals(e),
			config: /* @__PURE__ */ safeCast$1({
				hasStrictIndent: !1,
				shouldPreserveNumbering: !1
			}),
			dependencies: [CoreImportExtension, /* @__PURE__ */ configExtension$1(DOMImportExtension, { rules: Qt$1 })],
			name: "@lexical/list/List",
			nodes: () => [It$1, Nt$2],
			register(t, e, n) {
				const r = n.getOutput();
				return mergeRegister$1(effect(() => ne(t, { restoreNumbering: r.shouldPreserveNumbering.value })), effect(() => r.hasStrictIndent.value ? re(t) : void 0));
			}
		});
		const se = /* @__PURE__ */ defineExtension$1({
			build: (t, e) => namedSignals(e),
			config: /* @__PURE__ */ safeCast$1({ disableTakeFocusOnClick: !1 }),
			dependencies: [ie],
			name: "@lexical/list/CheckList",
			register: (t, e, n) => Kt$1(t, n.getOutput())
		});
		const oe = /* @__PURE__ */ defineExtension$1({
			dependencies: [ie],
			name: "@lexical/list/Import"
		});
		//#endregion
		//#region node_modules/@lexical/list/dist/LexicalList.mjs
		const mod$2 = LexicalList_prod_exports;
		mod$2.$createListItemNode;
		mod$2.$createListNode;
		mod$2.$getListDepth;
		mod$2.$handleListInsertParagraph;
		mod$2.$insertList;
		const $isListItemNode = mod$2.$isListItemNode;
		const $isListNode = mod$2.$isListNode;
		mod$2.$removeList;
		mod$2.CheckListExtension;
		mod$2.INSERT_CHECK_LIST_COMMAND;
		const INSERT_ORDERED_LIST_COMMAND = mod$2.INSERT_ORDERED_LIST_COMMAND;
		const INSERT_UNORDERED_LIST_COMMAND = mod$2.INSERT_UNORDERED_LIST_COMMAND;
		mod$2.ListExtension;
		mod$2.ListImportExtension;
		mod$2.ListImportRules;
		const ListItemNode = mod$2.ListItemNode;
		const ListNode = mod$2.ListNode;
		mod$2.ListSchema;
		mod$2.REMOVE_LIST_COMMAND;
		mod$2.UPDATE_LIST_START_COMMAND;
		mod$2.registerCheckList;
		const registerList = mod$2.registerList;
		mod$2.registerListStrictIndentTransform;
		//#endregion
		//#region node_modules/@lexical/link/dist/LexicalLink.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalLink_prod_exports = /* @__PURE__ */ __exportAll({
			$createAutoLinkNode: () => tt,
			$createLinkNode: () => V,
			$isAutoLinkNode: () => et,
			$isLinkNode: () => X,
			$toggleLink: () => it$1,
			AutoLinkExtension: () => Ot$1,
			AutoLinkNode: () => Y,
			ClickableLinkExtension: () => ft$1,
			LinkExtension: () => at$1,
			LinkImportExtension: () => ct$1,
			LinkImportRules: () => ot$1,
			LinkNode: () => Z,
			TOGGLE_LINK_COMMAND: () => nt$1,
			autoLinkEmailMatcher: () => _t$1,
			autoLinkUrlMatcher: () => pt$1,
			createLinkMatcherWithRegExp: () => dt$1,
			formatUrl: () => lt$1,
			registerAutoLink: () => Rt$1,
			registerClickableLink: () => gt$1,
			registerLink: () => ut$1
		});
		const j = /* @__PURE__ */ new Set([
			"http:",
			"https:",
			"mailto:",
			"sms:",
			"tel:"
		]);
		var Z = class extends ElementNode {
			__url;
			__target;
			__rel;
			__title;
			$config() {
				return this.config("link", {
					extends: ElementNode,
					importDOM: { a: () => ({
						conversion: Q,
						priority: 1
					}) }
				});
			}
			constructor(t = "", e = {}, n) {
				super(n);
				const { target: r = null, rel: i = null, title: s = null } = e;
				this.__url = t, this.__target = r, this.__rel = i, this.__title = s;
			}
			afterCloneFrom(t) {
				super.afterCloneFrom(t), this.__url = t.__url, this.__rel = t.__rel, this.__target = t.__target, this.__title = t.__title;
			}
			createDOM(t) {
				const e = $getDocument().createElement("a");
				return this.updateLinkDOM(null, e, t), addClassNamesToElement$1(e, t.theme.link), e;
			}
			updateLinkDOM(t, e, n) {
				if (isHTMLAnchorElement$1(e)) {
					t && t.__url === this.__url || (e.href = this.sanitizeUrl(this.__url));
					for (const n of [
						"target",
						"rel",
						"title"
					]) {
						const r = `__${n}`, i = this[r];
						t && t[r] === i || (i ? e[n] = i : e.removeAttribute(n));
					}
				}
			}
			updateDOM(t, e, n) {
				return this.updateLinkDOM(t, e, n), !1;
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setURL(t.url).setRel(t.rel || null).setTarget(t.target || null).setTitle(t.title || null);
			}
			sanitizeUrl(t) {
				const e = t;
				t = lt$1(t);
				try {
					const e = new URL(lt$1(t));
					if (!j.has(e.protocol)) return "about:blank";
				} catch (t) {
					const n = e.replace(/[\u0000-\u001F\u007F\s]/g, "").match(/^([a-z][a-z0-9+.-]*):/i);
					if (null != n && !j.has(`${n[1].toLowerCase()}:`)) return "about:blank";
				}
				return t;
			}
			exportJSON() {
				return {
					...super.exportJSON(),
					rel: this.getRel(),
					target: this.getTarget(),
					title: this.getTitle(),
					url: this.getURL()
				};
			}
			getURL() {
				return this.getLatest().__url;
			}
			setURL(t) {
				const e = this.getWritable();
				return e.__url = t, e;
			}
			getTarget() {
				return this.getLatest().__target;
			}
			setTarget(t) {
				const e = this.getWritable();
				return e.__target = t, e;
			}
			getRel() {
				return this.getLatest().__rel;
			}
			setRel(t) {
				const e = this.getWritable();
				return e.__rel = t, e;
			}
			getTitle() {
				return this.getLatest().__title;
			}
			setTitle(t) {
				const e = this.getWritable();
				return e.__title = t, e;
			}
			insertNewAfter(t, e = !0) {
				const n = $copyNode(this);
				return this.insertAfter(n, e), n;
			}
			canInsertTextBefore() {
				return !1;
			}
			canInsertTextAfter() {
				return !1;
			}
			canBeEmpty() {
				return !1;
			}
			isInline() {
				return !0;
			}
			extractWithChild(t, e, n) {
				if (!$isRangeSelection(e)) return !1;
				const r = e.anchor.getNode(), i = e.focus.getNode();
				return (this.is(r) || this.isParentOf(r)) && (this.is(i) || this.isParentOf(i)) && e.getTextContent().length > 0;
			}
			isEmailURI() {
				return this.__url.startsWith("mailto:");
			}
			isWebSiteURI() {
				return this.__url.startsWith("https://") || this.__url.startsWith("http://");
			}
			shouldMergeAdjacentLink(t) {
				return this.getType() === t.getType() && this.__url === t.__url && this.__target === t.__target && this.__rel === t.__rel && this.__title === t.__title;
			}
		};
		function H(t) {
			const e = $caretFromPoint(t, "next");
			return [e, e.getFlipped()];
		}
		function G(t, e) {
			for (const n of e) if (n.origin.isAttached()) {
				const e = $normalizeCaret(n);
				$setPointFromCaret(t, e);
				return;
			}
		}
		function q(t) {
			const e = $getSelection();
			let n = null, r = null;
			function i() {
				$isRangeSelection(e) && (G(e.anchor, n), G(e.focus, r), $normalizeSelection__EXPERIMENTAL(e));
			}
			$isRangeSelection(e) && (n = H(e.anchor), r = H(e.focus));
			let s = !1;
			for (const e of $getChildCaret(t, "next")) {
				const n = e.origin;
				if ($isElementNode(n) && !n.isInline()) {
					const r = n.getChildren();
					if (r.length > 0) {
						const e = $copyNode(t);
						e.append(...r), n.append(e), s = !0;
					}
					$insertNodeToNearestRootAtCaret$1(n, $rewindSiblingCaret(e), { $shouldSplit: () => !1 });
				}
			}
			function u(t, e, n) {
				const [r, i] = t, s = (t) => $isSiblingCaret(t) && t.origin.is(e);
				if (!s(r) && !s(i)) return t;
				const l = $normalizeCaret($getChildCaret(n, "next"));
				return [l, l.getFlipped()];
			}
			if (t.isAttached()) {
				const e = t.getPreviousSibling();
				if (X(e) && e.shouldMergeAdjacentLink(t)) return n && (n = u(n, e, t)), r && (r = u(r, e, t)), e.append(...t.getChildren()), t.remove(), void i();
				const l = t.getNextSibling();
				X(l) && t.shouldMergeAdjacentLink(l) && (n && (n = u(n, t, l)), r && (r = u(r, t, l)), t.append(...l.getChildren()), l.remove(), s = !0);
			}
			if (s) {
				if (!t.canBeEmpty() && t.isEmpty()) {
					const e = t.getParent();
					t.remove(), e && e.isEmpty() && e.remove();
				}
				i();
			}
		}
		function Q(t) {
			let e = null;
			if (isHTMLAnchorElement$1(t)) {
				const n = t.textContent;
				(null !== n && "" !== n || t.children.length > 0) && (e = V(t.getAttribute("href") || "", {
					rel: t.getAttribute("rel"),
					target: t.getAttribute("target"),
					title: t.getAttribute("title")
				}));
			}
			return { node: e };
		}
		function V(t = "", e) {
			return $applyNodeReplacement(new Z(t, e));
		}
		function X(t) {
			return t instanceof Z;
		}
		var Y = class extends Z {
			__isUnlinked;
			constructor(t = "", e = {}, n) {
				super(t, e, n), this.__isUnlinked = void 0 !== e.isUnlinked && null !== e.isUnlinked && e.isUnlinked;
			}
			afterCloneFrom(t) {
				super.afterCloneFrom(t), this.__isUnlinked = t.__isUnlinked;
			}
			$config() {
				return this.config("autolink", { extends: Z });
			}
			shouldMergeAdjacentLink(t) {
				return !1;
			}
			getIsUnlinked() {
				return this.__isUnlinked;
			}
			setIsUnlinked(t) {
				const e = this.getWritable();
				return e.__isUnlinked = t, e;
			}
			createDOM(t) {
				return this.__isUnlinked ? $getDocument().createElement("span") : super.createDOM(t);
			}
			updateDOM(t, e, n) {
				return super.updateDOM(t, e, n) || t.__isUnlinked !== this.__isUnlinked;
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setIsUnlinked(t.isUnlinked || !1);
			}
			exportJSON() {
				return {
					...super.exportJSON(),
					isUnlinked: this.__isUnlinked
				};
			}
			insertNewAfter(t, e = !0) {
				const n = tt(this.__url, {
					isUnlinked: this.__isUnlinked,
					rel: this.__rel,
					target: this.__target,
					title: this.__title
				});
				return this.insertAfter(n, e), n;
			}
		};
		function tt(t = "", e) {
			return $applyNodeReplacement(new Y(t, e));
		}
		function et(t) {
			return t instanceof Y;
		}
		const nt$1 = /* @__PURE__ */ createCommand("TOGGLE_LINK_COMMAND");
		function rt$1(t, e) {
			if ("element" === t.type) {
				const n = t.getNode();
				$isElementNode(n) || function(t, ...e) {
					const n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
					r.append("code", t);
					for (const t of e) r.append("v", t);
					throw n.search = r.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
				}(252);
				return n.getChildren()[t.offset + e] || null;
			}
			return null;
		}
		function it$1(t, e = {}) {
			let n;
			if (t && "object" == typeof t) {
				const { url: r, ...i } = t;
				n = r, e = {
					...i,
					...e
				};
			} else n = t;
			const { target: r, title: i } = e, s = void 0 === e.rel ? "noreferrer" : e.rel, u = $getSelection();
			if (null === u || !$isRangeSelection(u) && !$isNodeSelection(u)) return;
			if ($isNodeSelection(u)) {
				const t = u.getNodes();
				if (0 === t.length) return;
				t.forEach((t) => {
					if (null === n) {
						const e = $findMatchingParent$1(t, (t) => !et(t) && X(t));
						e && (e.insertBefore(t), 0 === e.getChildren().length && e.remove());
					} else {
						const e = $findMatchingParent$1(t, (t) => !et(t) && X(t));
						if (e) e.setURL(n), void 0 !== r && e.setTarget(r), void 0 !== s && e.setRel(s);
						else {
							const e = V(n, {
								rel: s,
								target: r
							});
							t.insertBefore(e), e.append(t);
						}
					}
				});
				return;
			}
			if (u.isCollapsed() && null === n) for (const t of u.getNodes()) {
				const e = $findMatchingParent$1(t, (t) => !et(t) && X(t));
				null !== e && (e.getParentOrThrow().splice(e.getIndexWithinParent(), 0, e.getChildren()), e.remove());
				return;
			}
			const a = u.extract();
			if (null === n) {
				const t = /* @__PURE__ */ new Set();
				a.forEach((e) => {
					const n = $findMatchingParent$1(e, (t) => !et(t) && X(t));
					if (null !== n) {
						const e = n.getKey();
						if (t.has(e)) return;
						(function(t, e) {
							const n = new Set(e.filter((e) => t.isParentOf(e)).map((t) => t.getKey())), r = t.getChildren(), i = (r) => n.has(r.getKey()) || $isElementNode(r) && e.some((e) => t.isParentOf(e) && r.isParentOf(e)), s = r.filter(i);
							if (s.length === r.length) return r.forEach((e) => t.insertBefore(e)), void t.remove();
							const o = r.findIndex(i), u = r.findLastIndex(i), a = 0 === o, c = u === r.length - 1;
							if (a) s.forEach((e) => t.insertBefore(e));
							else if (c) for (let e = s.length - 1; e >= 0; e--) t.insertAfter(s[e]);
							else {
								for (let e = s.length - 1; e >= 0; e--) t.insertAfter(s[e]);
								const e = r.slice(u + 1);
								if (e.length > 0) {
									const n = $copyNode(t);
									s[s.length - 1].insertAfter(n), e.forEach((t) => n.append(t));
								}
							}
						})(n, a), t.add(e);
					}
				});
				return;
			}
			const p = /* @__PURE__ */ new Set(), m = (t) => {
				p.has(t.getKey()) || (p.add(t.getKey()), t.setURL(n), void 0 !== r && t.setTarget(r), void 0 !== s && t.setRel(s), void 0 !== i && t.setTitle(i));
			};
			if (1 === a.length) {
				const t = a[0], e = $findMatchingParent$1(t, X);
				if (null !== e) return m(e);
			}
			(function(t) {
				const e = $getSelection();
				if (!$isRangeSelection(e)) return t();
				const n = $normalizeSelection__EXPERIMENTAL(e), r = n.isBackward(), i = rt$1(n.anchor, r ? -1 : 0), s = rt$1(n.focus, r ? 0 : -1);
				t();
				if (i || s) {
					const t = $getSelection();
					if ($isRangeSelection(t)) {
						const e = t.clone();
						if (i) {
							const t = i.getParent();
							t && e.anchor.set(t.getKey(), i.getIndexWithinParent() + (r ? 1 : 0), "element");
						}
						if (s) {
							const t = s.getParent();
							t && e.focus.set(t.getKey(), s.getIndexWithinParent() + (r ? 0 : 1), "element");
						}
						$setSelection($normalizeSelection__EXPERIMENTAL(e));
					}
				}
			})(() => {
				let t = null;
				for (const e of a) {
					if (!e.isAttached()) continue;
					const l = $findMatchingParent$1(e, X);
					if (l) {
						m(l);
						continue;
					}
					if ($isElementNode(e)) {
						if (!e.isInline()) continue;
						if (X(e)) {
							if (!(et(e) || null !== t && t.getParentOrThrow().isParentOf(e))) {
								m(e), t = e;
								continue;
							}
							for (const t of e.getChildren()) e.insertBefore(t);
							e.remove();
							continue;
						}
					}
					const o = e.getPreviousSibling();
					X(o) && o.is(t) ? o.append(e) : (t = V(n, {
						rel: s,
						target: r,
						title: i
					}), e.insertAfter(t), t.append(e));
				}
			});
		}
		const st$1 = /^\+?[0-9\s()-]{5,}$/;
		function lt$1(t) {
			return t.match(/^[a-z][a-z0-9+.-]*:/i) || t.match(/^[/#.]/) ? t : t.includes("@") ? `mailto:${t}` : st$1.test(t) ? `tel:${t}` : `https://${t}`;
		}
		const ot$1 = [/* @__PURE__ */ defineImportRule({
			$import: (t, e) => {
				if (!e.textContent && 0 === e.children.length) return [];
				const n = e.getAttribute("href") || "", r = {
					rel: e.getAttribute("rel"),
					target: e.getAttribute("target"),
					title: e.getAttribute("title")
				};
				return $distributeInlineWrapper(t.$importChildren(e), () => V(n, r));
			},
			match: sel.tag("a"),
			name: "@lexical/link/a"
		})];
		function ut$1(t, n) {
			return mergeRegister$1(t.registerNodeTransform(Z, q), t.registerCommand(nt$1, (t) => {
				const e = n.validateUrl.peek(), r = n.attributes.peek();
				if (null === t) return it$1(null), !0;
				if ("string" == typeof t) return !(void 0 !== e && !e(t)) && (it$1(t, r), !0);
				{
					const { url: e, target: n, rel: i, title: s } = t;
					return it$1(e, {
						...r,
						rel: i,
						target: n,
						title: s
					}), !0;
				}
			}, COMMAND_PRIORITY_EDITOR), effect(() => {
				const e = n.validateUrl.value;
				if (!e) return;
				const r = n.attributes.value;
				return t.registerCommand(PASTE_COMMAND, (n) => {
					const i = $getSelection();
					if (!$isRangeSelection(i) || i.isCollapsed() || !objectKlassEquals(n, ClipboardEvent)) return !1;
					if (null === n.clipboardData) return !1;
					const s = n.clipboardData.getData("text");
					if (!e(s)) return !1;
					return !i.getNodes().some((t) => $isElementNode(t) || $isTextNode(t) && !t.isSimpleText()) && (t.dispatchCommand(nt$1, {
						...r,
						url: s
					}), n.preventDefault(), !0);
				}, COMMAND_PRIORITY_LOW);
			}));
		}
		const at$1 = /* @__PURE__ */ defineExtension$1({
			build: (e, n, r) => namedSignals(n),
			config: {
				attributes: void 0,
				validateUrl: void 0
			},
			dependencies: [CoreImportExtension, /* @__PURE__ */ configExtension$1(DOMImportExtension, { rules: ot$1 })],
			mergeConfig(t, e) {
				const n = shallowMergeConfig$1(t, e);
				return t.attributes && (n.attributes = shallowMergeConfig$1(t.attributes, n.attributes)), n;
			},
			name: "@lexical/link/Link",
			nodes: () => [Z],
			register: (t, e, n) => ut$1(t, n.getOutput())
		});
		const ct$1 = /* @__PURE__ */ defineExtension$1({
			dependencies: [at$1],
			name: "@lexical/link/Import"
		});
		function gt$1(t, e, n = {}) {
			const r = (n) => {
				const r = n.target;
				if (!isDOMNode(r)) return;
				const i = getNearestEditorFromDOMNode(r);
				if (null === i) return;
				let l = null, u = null, a = !1;
				if (i.update(() => {
					const t = $getNearestNodeFromDOMNode(r);
					if (null !== t) {
						const n = $findMatchingParent$1(t, $isElementNode);
						if (!e.disabled.peek()) if (X(n)) a = et(n) && n.getIsUnlinked(), l = n.sanitizeUrl(n.getURL()), u = n.getTarget();
						else {
							const t = function(t, e) {
								let n = t;
								for (; null != n;) {
									if (e(n)) return n;
									n = n.parentNode;
								}
								return null;
							}(r, isHTMLAnchorElement$1);
							null !== t && (l = t.href, u = t.target);
						}
					}
				}), null === l || "" === l || a) return;
				const g = t.read("latest", $getSelection);
				if ($isRangeSelection(g) && !g.isCollapsed()) return void n.preventDefault();
				const d = "auxclick" === n.type && 1 === n.button;
				window.open(l, e.newTab.peek() || d || n.metaKey || n.ctrlKey || "_blank" === u ? "_blank" : "_self"), n.preventDefault();
			}, i = (t) => {
				1 === t.button && r(t);
			};
			return t.registerRootListener((t) => {
				if (t) return registerEventListeners(t, {
					click: r,
					mouseup: i
				}, n);
			});
		}
		const ft$1 = /* @__PURE__ */ defineExtension$1({
			build: (e, n, r) => namedSignals(n),
			config: /* @__PURE__ */ safeCast$1({
				disabled: !1,
				newTab: !1
			}),
			dependencies: [at$1],
			name: "@lexical/link/ClickableLink",
			register: (t, e, n) => gt$1(t, n.getOutput())
		});
		function dt$1(t, e = (t) => t) {
			return (n) => {
				const r = t.exec(n);
				return null === r ? null : {
					index: r.index,
					length: r[0].length,
					text: r[0],
					url: e(r[0])
				};
			};
		}
		const ht$1 = /((https?:\/\/(www\.)?)|(www\.))[-\p{L}\p{N}@:%._+~#=]{1,256}\.[\p{L}\p{N}]{1,6}(?:[-\p{L}\p{N}()@:%_+.~#?&//=]*[\p{L}\p{N}()@_~#?&//=])?/u;
		const pt$1 = (t) => {
			const e = ht$1.exec(t);
			if (null === e) return null;
			let n = e[0], r = 0;
			for (const t of n) "(" === t ? r++ : ")" === t && r--;
			for (; r < 0 && n.endsWith(")");) n = n.slice(0, -1), r++;
			return {
				index: e.index,
				length: n.length,
				text: n,
				url: n.startsWith("http") ? n : `https://${n}`
			};
		};
		const _t$1 = dt$1(/(([^<>()[\]\\.,;:\s@"]{1,64}(\.[^<>()[\]\\.,;:\s@"]{1,64}){0,63})|(".{1,255}"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]{1,63}\.){1,127}[a-zA-Z]{2,63}))/, (t) => `mailto:${t}`);
		function mt$1(t, e) {
			for (let n = 0; n < e.length; n++) {
				const r = e[n](t);
				if (r) return r;
			}
			return null;
		}
		const xt$1 = /[.,;\s]/;
		function bt$1(t, e) {
			return e.test(t);
		}
		function kt$1(t, e) {
			return bt$1(t[t.length - 1], e);
		}
		function Ut$1(t, e) {
			return bt$1(t[0], e);
		}
		function vt$1(t, e) {
			let n = t.getPreviousSibling();
			return $isElementNode(n) && (n = n.getLastDescendant()), null === n || $isLineBreakNode(n) || $isTextNode(n) && kt$1(n.getTextContent(), e);
		}
		function Tt$1(t, e) {
			let n = t.getNextSibling();
			return $isElementNode(n) && (n = n.getFirstDescendant()), null === n || $isLineBreakNode(n) || $isTextNode(n) && Ut$1(n.getTextContent(), e);
		}
		function Ct$1(t, e, n, r, i) {
			if (!(t > 0 ? bt$1(r[t - 1], n) : vt$1(i[0], n))) return !1;
			return e < r.length ? bt$1(r[e], n) : Tt$1(i[i.length - 1], n);
		}
		function Lt$1(t, e, n) {
			const r = [], i = [], s = [];
			let l = 0, o = 0;
			const u = [...t];
			for (; u.length > 0;) {
				const t = u[0], a = t.getTextContent().length, c = o;
				o + a <= e ? (r.push(t), l += a) : c >= n ? s.push(t) : i.push(t), o += a, u.shift();
			}
			return [
				l,
				r,
				i,
				s
			];
		}
		function St$1(t, e, n, r) {
			const i = tt(r.url, r.attributes);
			if (1 === t.length) {
				let s, l = t[0];
				0 === e ? [s, l] = l.splitText(n) : [, s, l] = l.splitText(e, n);
				const o = $createTextNode(r.text);
				return o.setFormat(s.getFormat()), o.setDetail(s.getDetail()), o.setStyle(s.getStyle()), i.append(o), s.replace(i), l;
			}
			if (t.length > 1) {
				const r = t[0];
				let s, l = r.getTextContent().length;
				0 === e ? s = r : [, s] = r.splitText(e);
				const u = [];
				let a;
				for (let e = 1; e < t.length; e++) {
					const r = t[e], i = r.getTextContent().length, s = l;
					if (s < n) if (l + i <= n) u.push(r);
					else {
						const [t, e] = r.splitText(n - s);
						u.push(t), a = e;
					}
					l += i;
				}
				const f = $getSelection(), d = f ? f.getNodes().find($isTextNode) : void 0, h = $createTextNode(s.getTextContent());
				return h.setFormat(s.getFormat()), h.setDetail(s.getDetail()), h.setStyle(s.getStyle()), i.append(h, ...u), d && d === s && ($isRangeSelection(f) ? h.select(f.anchor.offset, f.focus.offset) : $isNodeSelection(f) && h.select(0, h.getTextContent().length)), s.replace(i), a;
			}
		}
		function At$1(t, e, n, r) {
			const i = t.getChildren(), s = i.length;
			for (let e = 0; e < s; e++) {
				const r = i[e];
				if (!$isTextNode(r) || !r.isSimpleText()) return Pt$1(t), void n(null, t.getURL());
			}
			const l = t.getTextContent(), o = mt$1(l, e);
			if (null === o || o.text !== l) return Pt$1(t), void n(null, t.getURL());
			if (!vt$1(t, r) || !Tt$1(t, r)) return Pt$1(t), void n(null, t.getURL());
			const u = t.getURL();
			if (u !== o.url && (t.setURL(o.url), n(o.url, u)), o.attributes) {
				const e = t.getRel();
				e !== o.attributes.rel && (t.setRel(o.attributes.rel || null), n(o.attributes.rel || null, e));
				const r = t.getTarget();
				r !== o.attributes.target && (t.setTarget(o.attributes.target || null), n(o.attributes.target || null, r));
			}
		}
		function Pt$1(t) {
			const e = t.getChildren();
			for (let n = e.length - 1; n >= 0; n--) t.insertAfter(e[n]);
			return t.remove(), e.map((t) => t.getLatest());
		}
		const Nt$1 = {
			changeHandlers: [],
			excludeParents: [],
			matchers: [],
			separatorRegex: xt$1
		};
		function Rt$1(t, e = Nt$1) {
			const { matchers: n, changeHandlers: r, excludeParents: i, separatorRegex: s = xt$1 } = e, l = (t, e) => {
				for (const n of r) n(t, e);
			};
			return mergeRegister$1(t.registerNodeTransform(TextNode, (t) => {
				const e = t.getParentOrThrow(), r = t.getPreviousSibling();
				if (et(e)) At$1(e, n, l, s);
				else if (!X(e) && !i.some((t) => t(e))) {
					if (t.isSimpleText() && (Ut$1(t.getTextContent(), s) || !et(r))) (function(t, e, n, r) {
						for (const e of t) {
							const t = e.getParent();
							if (et(t) && !t.getIsUnlinked()) return;
						}
						let i = [...t];
						const s = i.map((t) => t.getTextContent()).join("");
						let l, o = s, u = 0;
						for (; (l = mt$1(o, e)) && null !== l;) {
							const t = l.index, e = t + l.length;
							if (Ct$1(u + t, u + e, r, s, i)) {
								const [r, , s, a] = Lt$1(i, u + t, u + e);
								let c = !1;
								for (const t of s) {
									const e = t.getParent();
									if (et(e) && !e.getIsUnlinked()) {
										c = !0;
										break;
									}
								}
								if (c) {
									u += e, o = o.substring(e);
									continue;
								}
								const g = St$1(s, u + t - r, u + e - r, l);
								i = g ? [g, ...a] : a, n(l.url, null), u = 0;
							} else u += e;
							o = o.substring(e);
						}
					})(function(t) {
						const e = [t];
						let n = t.getNextSibling();
						for (; null !== n && $isTextNode(n) && n.isSimpleText() && (e.push(n), !/[\s]/.test(n.getTextContent()));) n = n.getNextSibling();
						return e;
					}(t), n, l, s);
					(function(t, e, n, r) {
						const i = t.getParent(), s = t.getPreviousSibling(), l = t.getNextSibling(), o = t.getTextContent();
						if (!et(i) || i.getIsUnlinked()) {
							if (et(s) && !s.getIsUnlinked() && s.is(t.getPreviousSibling()) && t.getParent() === s.getParent()) {
								if (!Ut$1(o, r)) return Pt$1(s), void n(null, s.getURL());
								if (u = o, s.isEmailURI() ? /^\.[a-zA-Z]{2,}/.test(u) : /^\.[a-zA-Z0-9]{1,}/.test(u)) {
									const i = s.getTextContent() + o, l = mt$1(i, e);
									null !== l && l.text === i && (s.append(t), At$1(s, e, n, r), n(null, s.getURL()));
								}
							}
							var u;
							!et(l) || l.getIsUnlinked() || kt$1(o, r) || l.is(t.getNextSibling()) && t.getParent() === l.getParent() && (Pt$1(l), n(null, l.getURL()));
						}
					})(t, n, l, s);
				}
			}), t.registerCommand(nt$1, (t) => {
				const e = $getSelection();
				if (null !== t || !$isRangeSelection(e)) return !1;
				return e.extract().forEach((t) => {
					const e = t.getParent();
					et(e) && (e.setIsUnlinked(!e.getIsUnlinked()), e.markDirty());
				}), !1;
			}, COMMAND_PRIORITY_LOW));
		}
		const Ot$1 = /* @__PURE__ */ defineExtension$1({
			config: Nt$1,
			dependencies: [at$1],
			mergeConfig(t, e) {
				const n = shallowMergeConfig$1(t, e);
				for (const r of [
					"matchers",
					"changeHandlers",
					"excludeParents"
				]) {
					const i = e[r];
					Array.isArray(i) && (n[r] = [...t[r], ...i]);
				}
				return n;
			},
			name: "@lexical/link/AutoLink",
			nodes: [Y],
			register: Rt$1
		});
		//#endregion
		//#region node_modules/@lexical/link/dist/LexicalLink.mjs
		const mod$1 = LexicalLink_prod_exports;
		mod$1.$createAutoLinkNode;
		mod$1.$createLinkNode;
		mod$1.$isAutoLinkNode;
		const $isLinkNode = mod$1.$isLinkNode;
		mod$1.$toggleLink;
		mod$1.AutoLinkExtension;
		mod$1.AutoLinkNode;
		mod$1.ClickableLinkExtension;
		mod$1.LinkExtension;
		mod$1.LinkImportExtension;
		mod$1.LinkImportRules;
		const LinkNode = mod$1.LinkNode;
		mod$1.TOGGLE_LINK_COMMAND;
		mod$1.autoLinkEmailMatcher;
		mod$1.autoLinkUrlMatcher;
		mod$1.createLinkMatcherWithRegExp;
		mod$1.formatUrl;
		mod$1.registerAutoLink;
		mod$1.registerClickableLink;
		mod$1.registerLink;
		//#endregion
		//#region node_modules/@lexical/table/dist/LexicalTable.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		var LexicalTable_prod_exports = /* @__PURE__ */ __exportAll({
			$computeTableCellRectBoundary: () => Yt,
			$computeTableMap: () => It,
			$computeTableMapSkipCellCheck: () => Ut,
			$createTableCellNode: () => it,
			$createTableNode: () => ao,
			$createTableNodeWithDimensions: () => pt,
			$createTableRowNode: () => ft,
			$createTableSelection: () => on,
			$createTableSelectionFrom: () => ln,
			$deleteTableColumn: () => Kt,
			$deleteTableColumnAtSelection: () => Wt,
			$deleteTableColumn__EXPERIMENTAL: () => $t,
			$deleteTableRowAtSelection: () => kt,
			$deleteTableRow__EXPERIMENTAL: () => Mt,
			$findCellNode: () => Bn,
			$findTableNode: () => Dn,
			$getElementForTableNode: () => io,
			$getNodeTriplet: () => Xt,
			$getTableAndElementByKey: () => sn,
			$getTableCellNodeFromLexicalNode: () => mt,
			$getTableCellNodeRect: () => Vt,
			$getTableColumnIndexFromTableCellNode: () => bt,
			$getTableNodeFromLexicalNodeOrThrow: () => _t,
			$getTableRowIndexFromTableCellNode: () => St,
			$getTableRowNodeFromTableCellNodeOrThrow: () => Ct,
			$insertTableColumn: () => Ft,
			$insertTableColumnAtNode: () => Et,
			$insertTableColumnAtSelection: () => At,
			$insertTableColumn__EXPERIMENTAL: () => Ot,
			$insertTableRow: () => Nt,
			$insertTableRowAtNode: () => Rt,
			$insertTableRowAtSelection: () => xt,
			$insertTableRow__EXPERIMENTAL: () => Tt,
			$isScrollableTablesActive: () => oo,
			$isSimpleTable: () => qt,
			$isStickyScrollbarActive: () => lo,
			$isTableCellNode: () => ct,
			$isTableNode: () => uo,
			$isTableRowNode: () => gt,
			$isTableSelection: () => nn,
			$mergeCells: () => Ht,
			$moveTableColumn: () => Jt,
			$moveTableRow: () => jt,
			$removeTableRowAtIndex: () => yt,
			$setTableColumnIsHeader: () => Zt,
			$setTableRowIsHeader: () => Qt,
			$unmergeCell: () => Dt,
			$unmergeCellNode: () => Pt,
			INSERT_TABLE_COMMAND: () => at,
			TableCellHeaderStates: () => ot,
			TableCellNode: () => lt,
			TableExtension: () => No,
			TableImportExtension: () => vo,
			TableImportRules: () => yo,
			TableNode: () => so,
			TableObserver: () => an,
			TableRowNode: () => ht,
			TableRowSchema: () => wo,
			TableSchema: () => bo,
			applyTableHandlers: () => yn,
			getDOMCellFromTarget: () => Tn,
			getTableElement: () => pn,
			getTableObserverFromTableElement: () => xn,
			registerTableCellUnmergeTransform: () => Co,
			registerTablePlugin: () => So,
			registerTableSelectionObserver: () => _o,
			setScrollableTablesActive: () => ro
		});
		const nt = /^(\d+(?:\.\d+)?)px$/;
		const ot = {
			BOTH: 3,
			COLUMN: 2,
			NO_STATUS: 0,
			ROW: 1
		};
		var lt = class extends ElementNode {
			__colSpan;
			__rowSpan;
			__headerState;
			__width;
			__backgroundColor;
			__verticalAlign;
			$config() {
				return this.config("tablecell", {
					extends: ElementNode,
					importDOM: {
						td: () => ({
							conversion: st,
							priority: 0
						}),
						th: () => ({
							conversion: st,
							priority: 0
						})
					}
				});
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__rowSpan = e.__rowSpan, this.__backgroundColor = e.__backgroundColor, this.__verticalAlign = e.__verticalAlign, this.__colSpan = e.__colSpan, this.__headerState = e.__headerState, this.__width = e.__width;
			}
			updateFromJSON(e) {
				return super.updateFromJSON(e).setHeaderStyles(e.headerState).setColSpan(e.colSpan || 1).setRowSpan(e.rowSpan || 1).setWidth(e.width || void 0).setBackgroundColor(e.backgroundColor || null).setVerticalAlign(e.verticalAlign || void 0);
			}
			constructor(e = ot.NO_STATUS, t = 1, n, o) {
				super(o), this.__colSpan = t, this.__rowSpan = 1, this.__headerState = e, this.__width = n, this.__backgroundColor = null, this.__verticalAlign = void 0;
			}
			createDOM(e) {
				const o = $getDocument().createElement(this.getTag());
				return this.__width && (o.style.width = `${this.__width}px`), this.__colSpan > 1 && (o.colSpan = this.__colSpan), this.__rowSpan > 1 && (o.rowSpan = this.__rowSpan), null !== this.__backgroundColor && (o.style.backgroundColor = this.__backgroundColor), rt(this.__verticalAlign) && (o.style.verticalAlign = this.__verticalAlign), addClassNamesToElement$1(o, e.theme.tableCell, this.hasHeader() && e.theme.tableCellHeader), o;
			}
			exportDOM(e) {
				const t = super.exportDOM(e);
				if (isHTMLElement$1(t.element)) {
					const e = t.element;
					e.setAttribute("data-temporary-table-cell-lexical-key", this.getKey()), e.style.border = "1px solid black", this.__colSpan > 1 && (e.colSpan = this.__colSpan), this.__rowSpan > 1 && (e.rowSpan = this.__rowSpan), e.style.width = `${this.getWidth() || 75}px`, e.style.verticalAlign = this.getVerticalAlign() || "top", e.style.textAlign = "start", null === this.__backgroundColor && this.hasHeader() && (e.style.backgroundColor = "#f2f3f5");
				}
				return t;
			}
			exportJSON() {
				return {
					...super.exportJSON(),
					...rt(this.__verticalAlign) && { verticalAlign: this.__verticalAlign },
					backgroundColor: this.getBackgroundColor(),
					colSpan: this.__colSpan,
					headerState: this.__headerState,
					rowSpan: this.__rowSpan,
					width: this.getWidth()
				};
			}
			getColSpan() {
				return this.getLatest().__colSpan;
			}
			setColSpan(e) {
				const t = this.getWritable();
				return t.__colSpan = e, t;
			}
			getRowSpan() {
				return this.getLatest().__rowSpan;
			}
			setRowSpan(e) {
				const t = this.getWritable();
				return t.__rowSpan = e, t;
			}
			getTag() {
				return this.hasHeader() ? "th" : "td";
			}
			setHeaderStyles(e, t = ot.BOTH) {
				const n = this.getWritable();
				return n.__headerState = e & t | n.__headerState & ~t, n;
			}
			getHeaderStyles() {
				return this.getLatest().__headerState;
			}
			setWidth(e) {
				const t = this.getWritable();
				return t.__width = e, t;
			}
			getWidth() {
				return this.getLatest().__width;
			}
			getBackgroundColor() {
				return this.getLatest().__backgroundColor;
			}
			setBackgroundColor(e) {
				const t = this.getWritable();
				return t.__backgroundColor = e, t;
			}
			getVerticalAlign() {
				return this.getLatest().__verticalAlign;
			}
			setVerticalAlign(e) {
				const t = this.getWritable();
				return t.__verticalAlign = e || void 0, t;
			}
			toggleHeaderStyle(e) {
				const t = this.getWritable();
				return (t.__headerState & e) === e ? t.__headerState -= e : t.__headerState += e, t;
			}
			hasHeaderState(e) {
				return (this.getHeaderStyles() & e) === e;
			}
			hasHeader() {
				return this.getLatest().__headerState !== ot.NO_STATUS;
			}
			updateDOM(e) {
				return e.__headerState !== this.__headerState || e.__width !== this.__width || e.__colSpan !== this.__colSpan || e.__rowSpan !== this.__rowSpan || e.__backgroundColor !== this.__backgroundColor || e.__verticalAlign !== this.__verticalAlign;
			}
			isShadowRoot() {
				return !0;
			}
			collapseAtStart() {
				return !0;
			}
			canBeEmpty() {
				return !1;
			}
			canIndent() {
				return !1;
			}
		};
		function rt(e) {
			return "middle" === e || "bottom" === e;
		}
		function st(e) {
			const t = e, n = e.nodeName.toLowerCase();
			let c;
			nt.test(t.style.width) && (c = parseFloat(t.style.width));
			let a = ot.NO_STATUS;
			if ("th" === n) {
				const e = t.getAttribute("scope");
				if ("col" === e) a = ot.COLUMN;
				else if ("row" === e) a = ot.ROW;
				else {
					const e = t.parentElement, n = isHTMLElement$1(e) && "tr" === e.nodeName.toLowerCase() && isHTMLElement$1(e.parentElement) && ("thead" === e.parentElement.nodeName.toLowerCase() || 0 === e.rowIndex), l = 0 === t.cellIndex;
					n && (a |= ot.ROW), l && (a |= ot.COLUMN), a === ot.NO_STATUS && (a = ot.ROW);
				}
			}
			const u = it(a, t.colSpan, c);
			u.__rowSpan = t.rowSpan;
			const h = t.style.backgroundColor;
			"" !== h && (u.__backgroundColor = h);
			const d = t.style.verticalAlign;
			rt(d) && (u.__verticalAlign = d);
			const f = t.style, g = (f && f.textDecoration || "").split(" "), p = "700" === f.fontWeight || "bold" === f.fontWeight, m = g.includes("line-through"), C = "italic" === f.fontStyle, _ = g.includes("underline"), S = f.color;
			return {
				after: (e) => {
					const t = [];
					let n = null;
					const o = () => {
						if (n) {
							const e = n.getFirstChild();
							$isLineBreakNode(e) && 1 === n.getChildrenSize() && e.remove();
						}
					};
					for (const c of e) if ($isInlineElementOrDecoratorNode(c) || $isTextNode(c) || $isLineBreakNode(c)) {
						if ($isTextNode(c) && (p && c.toggleFormat("bold"), m && c.toggleFormat("strikethrough"), C && c.toggleFormat("italic"), _ && c.toggleFormat("underline"), S)) {
							const e = c.getStyle();
							e.includes("color:") || c.setStyle(e + `color: ${S};`);
						}
						n ? n.append(c) : (n = $createParagraphNode().append(c), t.push(n));
					} else t.push(c), o(), n = null;
					return o(), 0 === t.length && t.push($createParagraphNode()), t;
				},
				node: u
			};
		}
		function it(e = ot.NO_STATUS, t = 1, n) {
			return $applyNodeReplacement(new lt(e, t, n));
		}
		function ct(e) {
			return e instanceof lt;
		}
		const at = /* @__PURE__ */ createCommand("INSERT_TABLE_COMMAND");
		function ut(e, ...t) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", e);
			for (const e of t) o.append("v", e);
			throw n.search = o.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		var ht = class extends ElementNode {
			__height;
			$config() {
				return this.config("tablerow", {
					extends: ElementNode,
					importDOM: { tr: () => ({
						conversion: dt,
						priority: 0
					}) }
				});
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__height = e.__height;
			}
			updateFromJSON(e) {
				return super.updateFromJSON(e).setHeight(e.height);
			}
			constructor(e = void 0, t) {
				super(t), this.__height = e;
			}
			exportJSON() {
				const e = this.getHeight();
				return {
					...super.exportJSON(),
					...void 0 === e ? void 0 : { height: e }
				};
			}
			createDOM(e) {
				const o = $getDocument().createElement("tr");
				return this.__height && (o.style.height = `${this.__height}px`), addClassNamesToElement$1(o, e.theme.tableRow), o;
			}
			extractWithChild(e, t, n) {
				return "html" === n;
			}
			isShadowRoot() {
				return !0;
			}
			setHeight(e) {
				const t = this.getWritable();
				return t.__height = e, t;
			}
			getHeight() {
				return this.getLatest().__height;
			}
			updateDOM(e) {
				return e.__height !== this.__height;
			}
			canBeEmpty() {
				return !1;
			}
			canIndent() {
				return !1;
			}
		};
		function dt(e) {
			const t = e;
			let n;
			return nt.test(t.style.height) && (n = parseFloat(t.style.height)), {
				after: (e) => $descendantsMatching(e, ct),
				node: ft(n)
			};
		}
		function ft(e) {
			return $applyNodeReplacement(new ht(e));
		}
		function gt(e) {
			return e instanceof ht;
		}
		function pt(e, t, n = !0) {
			const o = ao();
			for (let l = 0; l < e; l++) {
				const e = ft();
				for (let o = 0; o < t; o++) {
					let t = ot.NO_STATUS;
					"object" == typeof n ? (0 === l && n.rows && (t |= ot.ROW), 0 === o && n.columns && (t |= ot.COLUMN)) : n && (0 === l && (t |= ot.ROW), 0 === o && (t |= ot.COLUMN));
					const r = it(t), s = $createParagraphNode();
					s.append($createTextNode()), r.append(s), e.append(r);
				}
				o.append(e);
			}
			return o;
		}
		function mt(e) {
			const t = $findMatchingParent$1(e, (e) => ct(e));
			return ct(t) ? t : null;
		}
		function Ct(e) {
			const t = $findMatchingParent$1(e, (e) => gt(e));
			if (gt(t)) return t;
			throw new Error("Expected table cell to be inside of table row.");
		}
		function _t(e) {
			const t = $findMatchingParent$1(e, (e) => uo(e));
			if (uo(t)) return t;
			throw new Error("Expected table cell to be inside of table.");
		}
		function St(e) {
			const t = Ct(e);
			return _t(t).getChildren().findIndex((e) => e.is(t));
		}
		function bt(e) {
			return Ct(e).getChildren().findIndex((t) => t.is(e));
		}
		function wt(e, t) {
			const n = _t(e), { x: o, y: l } = n.getCordsFromCellNode(e, t);
			return {
				above: n.getCellNodeFromCords(o, l - 1, t),
				below: n.getCellNodeFromCords(o, l + 1, t),
				left: n.getCellNodeFromCords(o - 1, l, t),
				right: n.getCellNodeFromCords(o + 1, l, t)
			};
		}
		function yt(e, t) {
			const n = e.getChildren();
			if (t >= n.length || t < 0) throw new Error("Expected table cell to be inside of table row.");
			return n[t].remove(), e;
		}
		function Nt(e, t, n = !0, o, l) {
			const r = e.getChildren();
			if (t >= r.length || t < 0) throw new Error("Table row target index out of range");
			const s = r[t];
			if (!gt(s)) throw new Error("Row before insertion index does not exist.");
			for (let e = 0; e < o; e++) {
				const e = s.getChildren(), t = e.length, o = ft();
				for (let n = 0; n < t; n++) {
					const t = e[n];
					ct(t) || ut(12);
					const { above: r, below: s } = wt(t, l);
					let c = ot.NO_STATUS;
					const a = r && r.getWidth() || s && s.getWidth() || void 0;
					(r && r.hasHeaderState(ot.COLUMN) || s && s.hasHeaderState(ot.COLUMN)) && (c |= ot.COLUMN);
					const u = it(c, 1, a);
					u.append($createParagraphNode()), o.append(u);
				}
				n ? s.insertAfter(o) : s.insertBefore(o);
			}
			return e;
		}
		const vt = (e, t) => e === ot.BOTH || e === t ? t : ot.NO_STATUS;
		function xt(e = !0) {
			const t = $getSelection();
			$isRangeSelection(t) || nn(t) || ut(188);
			const n = t.anchor.getNode(), o = t.focus.getNode(), [l] = Xt(n), [r, , s] = Xt(o), [, i, c] = It(s, r, l), { startRow: a } = c, { startRow: u } = i;
			return e ? Rt(a + l.__rowSpan > u + r.__rowSpan ? l : r, !0) : Rt(u < a ? r : l, !1);
		}
		const Tt = xt;
		function Rt(e, t = !0) {
			const [, , n] = Xt(e), [o, l] = It(n, e, e), r = o[0].length, { startRow: s } = l;
			let c = null;
			if (t) {
				const t = s + e.__rowSpan - 1, l = o[t], a = ft();
				for (let e = 0; e < r; e++) {
					const { cell: n, startRow: o } = l[e];
					if (o + n.__rowSpan - 1 <= t) {
						const t = l[e].cell.__headerState, n = vt(t, ot.COLUMN);
						a.append(it(n).append($createParagraphNode()));
					} else n.setRowSpan(n.__rowSpan + 1);
				}
				const u = n.getChildAtIndex(t);
				gt(u) || ut(256), u.insertAfter(a), c = a;
			} else {
				const e = s, t = o[e], l = ft();
				for (let n = 0; n < r; n++) {
					const { cell: o, startRow: r } = t[n];
					if (r === e) {
						const e = t[n].cell.__headerState, o = vt(e, ot.COLUMN);
						l.append(it(o).append($createParagraphNode()));
					} else o.setRowSpan(o.__rowSpan + 1);
				}
				const a = n.getChildAtIndex(e);
				gt(a) || ut(257), a.insertBefore(l), c = l;
			}
			return c;
		}
		function Ft(e, t, n = !0, o, l) {
			const r = e.getChildren(), s = [];
			for (let e = 0; e < r.length; e++) {
				const n = r[e];
				if (gt(n)) for (let e = 0; e < o; e++) {
					const e = n.getChildren();
					if (t >= e.length || t < 0) throw new Error("Table column target index out of range");
					const o = e[t];
					ct(o) || ut(12);
					const { left: r, right: c } = wt(o, l);
					let a = ot.NO_STATUS;
					(r && r.hasHeaderState(ot.ROW) || c && c.hasHeaderState(ot.ROW)) && (a |= ot.ROW);
					const u = it(a);
					u.append($createParagraphNode()), s.push({
						newTableCell: u,
						targetCell: o
					});
				}
			}
			return s.forEach(({ newTableCell: e, targetCell: t }) => {
				n ? t.insertAfter(e) : t.insertBefore(e);
			}), e;
		}
		function At(e = !0) {
			const t = $getSelection();
			$isRangeSelection(t) || nn(t) || ut(188);
			const n = t.anchor.getNode(), o = t.focus.getNode(), [l] = Xt(n), [r, , s] = Xt(o), [, i, c] = It(s, r, l), { startColumn: a } = c, { startColumn: u } = i;
			return e ? Et(a + l.__colSpan > u + r.__colSpan ? l : r, !0) : Et(u < a ? r : l, !1);
		}
		const Ot = At;
		function Et(e, t = !0, n = !0) {
			const [, , o] = Xt(e), [l, r] = It(o, e, e), s = l.length, { startColumn: c } = r, a = t ? c + e.__colSpan - 1 : c - 1, u = o.getFirstChild();
			gt(u) || ut(120);
			let h = null;
			function d(e = ot.NO_STATUS) {
				const t = it(e).append($createParagraphNode());
				return null === h && (h = t), t;
			}
			let f = u;
			e: for (let e = 0; e < s; e++) {
				if (0 !== e) {
					const e = f.getNextSibling();
					gt(e) || ut(121), f = e;
				}
				const t = l[e], n = t[a < 0 ? 0 : a].cell.__headerState, o = vt(n, ot.ROW);
				if (a < 0) {
					zt(f, d(o));
					continue;
				}
				const { cell: r, startColumn: s, startRow: i } = t[a];
				if (s + r.__colSpan - 1 <= a) {
					let n = r, l = i, s = a;
					for (; l !== e && n.__rowSpan > 1;) {
						if (s -= r.__colSpan, !(s >= 0)) {
							f.append(d(o));
							continue e;
						}
						{
							const { cell: e, startRow: o } = t[s];
							n = e, l = o;
						}
					}
					n.insertAfter(d(o));
				} else r.setColSpan(r.__colSpan + 1);
			}
			null !== h && n && Lt(h);
			const g = o.getColWidths();
			if (g) {
				const e = [...g], t = a < 0 ? 0 : a, n = e[t];
				e.splice(t, 0, n), o.setColWidths(e);
			}
			return h;
		}
		function Kt(e, t) {
			const n = e.getChildren();
			for (let e = 0; e < n.length; e++) {
				const o = n[e];
				if (gt(o)) {
					const e = o.getChildren();
					if (t >= e.length || t < 0) throw new Error("Table column target index out of range");
					e[t].remove();
				}
			}
			return e;
		}
		function kt() {
			const e = $getSelection();
			$isRangeSelection(e) || nn(e) || ut(188);
			const [t, n] = e.isBackward() ? [e.focus.getNode(), e.anchor.getNode()] : [e.anchor.getNode(), e.focus.getNode()], [o, , l] = Xt(t), [r] = Xt(n), [s, i, c] = It(l, o, r), { startRow: a } = i, { startRow: u } = c, f = u + r.__rowSpan - 1;
			if (s.length === f - a + 1) return void l.remove();
			const g = s[0].length, p = s[f + 1], m = l.getChildAtIndex(f + 1);
			for (let e = f; e >= a; e--) {
				for (let t = g - 1; t >= 0; t--) {
					const { cell: n, startRow: o, startColumn: l } = s[e][t];
					if (l === t) {
						if (o < a || o + n.__rowSpan - 1 > f) {
							const e = Math.max(o, a), t = Math.min(n.__rowSpan + o - 1, f), l = e <= t ? t - e + 1 : 0;
							n.setRowSpan(n.__rowSpan - l);
						}
						if (o >= a && o + n.__rowSpan - 1 > f && e === f) {
							gt(m) || ut(387);
							let o = null;
							for (let n = 0; n < t; n++) {
								const t = p[n], l = t.cell;
								t.startRow === e + 1 && (o = l), l.__colSpan > 1 && (n += l.__colSpan - 1);
							}
							null === o ? zt(m, n) : o.insertAfter(n);
						}
					}
				}
				const t = l.getChildAtIndex(e);
				gt(t) || ut(206, String(e)), t.remove();
			}
			if (void 0 !== p) {
				const { cell: e } = p[0];
				Lt(e);
			} else {
				const { cell: t } = s[a - 1][0];
				Lt(t);
			}
		}
		const Mt = kt;
		function Wt() {
			const e = $getSelection();
			$isRangeSelection(e) || nn(e) || ut(188);
			const t = e.anchor.getNode(), n = e.focus.getNode(), [o, , l] = Xt(t), [r] = Xt(n), [s, i, c] = It(l, o, r), { startColumn: a } = i, { startRow: u, startColumn: f } = c, g = Math.min(a, f), p = Math.max(a + o.__colSpan - 1, f + r.__colSpan - 1), m = p - g + 1;
			if (s[0].length === p - g + 1) return l.selectPrevious(), void l.remove();
			const C = s.length;
			for (let e = 0; e < C; e++) for (let t = g; t <= p; t++) {
				const { cell: n, startColumn: o } = s[e][t];
				if (o < g) {
					if (t === g) {
						const e = g - o;
						n.setColSpan(n.__colSpan - Math.min(m, n.__colSpan - e));
					}
				} else if (o + n.__colSpan - 1 > p) {
					if (t === p) {
						const e = p - o + 1;
						n.setColSpan(n.__colSpan - e);
					}
				} else n.remove();
			}
			const _ = s[u], S = a > f ? _[a + o.__colSpan] : _[f + r.__colSpan];
			if (void 0 !== S) {
				const { cell: e } = S;
				Lt(e);
			} else {
				const { cell: t } = f < a ? _[f - 1] : _[a - 1];
				Lt(t);
			}
			const b = l.getColWidths();
			if (b) {
				const e = [...b];
				e.splice(g, m), l.setColWidths(e);
			}
		}
		const $t = Wt;
		function Lt(e) {
			const t = e.getFirstDescendant();
			null == t ? e.selectStart() : t.getParentOrThrow().selectStart();
		}
		function zt(e, t) {
			const n = e.getFirstChild();
			null !== n ? n.insertBefore(t) : e.append(t);
		}
		function Ht(e) {
			if (0 === e.length) return null;
			const [n] = Ut(_t(e[0]), null, null);
			let o = 1 / 0, l = -1 / 0, r = 1 / 0, s = -1 / 0;
			const c = /* @__PURE__ */ new Set();
			for (const t of n) for (const n of t) {
				if (!n || !n.cell) continue;
				const t = n.cell.getKey();
				if (!c.has(t) && e.some((e) => e.is(n.cell))) {
					c.add(t);
					const e = n.startRow, i = n.startColumn, a = n.cell.__rowSpan || 1, u = n.cell.__colSpan || 1;
					o = Math.min(o, e), l = Math.max(l, e + a - 1), r = Math.min(r, i), s = Math.max(s, i + u - 1);
				}
			}
			if (o === 1 / 0 || r === 1 / 0) return null;
			const a = l - o + 1, u = s - r + 1, h = n[o][r];
			if (!h.cell) return null;
			const d = h.cell;
			d.setColSpan(u), d.setRowSpan(a);
			const f = /* @__PURE__ */ new Set([d.getKey()]);
			for (let e = o; e <= l; e++) for (let t = r; t <= s; t++) {
				const o = n[e][t];
				if (!o.cell) continue;
				const l = o.cell, r = l.getKey();
				if (!f.has(r)) {
					f.add(r);
					Bt(l) || d.append(...l.getChildren()), l.remove();
				}
			}
			return 0 === d.getChildrenSize() && d.append($createParagraphNode()), d;
		}
		function Bt(e) {
			if (1 !== e.getChildrenSize()) return !1;
			const t = e.getFirstChildOrThrow();
			return !(!$isParagraphNode(t) || !t.isEmpty());
		}
		function Dt() {
			const e = $getSelection();
			$isRangeSelection(e) || nn(e) || ut(188);
			const t = e.anchor.getNode(), n = $findMatchingParent$1(t, ct);
			return ct(n) || ut(148), Pt(n);
		}
		function Pt(e) {
			const [t, n, o] = Xt(e), l = t.__colSpan, r = t.__rowSpan;
			if (1 === l && 1 === r) return;
			const [s, c] = It(o, t, t), { startColumn: a, startRow: u } = c, h = t.__headerState & ot.COLUMN, d = Array.from({ length: l }, (e, t) => {
				let n = h;
				for (let e = 0; 0 !== n && e < s.length; e++) n &= s[e][t + a].cell.__headerState;
				return n;
			}), f = t.__headerState & ot.ROW, g = Array.from({ length: r }, (e, t) => {
				let n = f;
				for (let e = 0; 0 !== n && e < s[0].length; e++) n &= s[t + u][e].cell.__headerState;
				return n;
			});
			if (l > 1) {
				for (let e = 1; e < l; e++) t.insertAfter(it(d[e] | g[0]).append($createParagraphNode()));
				t.setColSpan(1);
			}
			if (r > 1) {
				let e;
				for (let t = 1; t < r; t++) {
					const o = u + t, r = s[o];
					e = (e || n).getNextSibling(), gt(e) || ut(125);
					let c = null;
					for (let e = 0; e < a; e++) {
						const t = r[e], n = t.cell;
						t.startRow === o && (c = n), n.__colSpan > 1 && (e += n.__colSpan - 1);
					}
					if (null === c) for (let n = l - 1; n >= 0; n--) zt(e, it(d[n] | g[t]).append($createParagraphNode()));
					else for (let e = l - 1; e >= 0; e--) c.insertAfter(it(d[e] | g[t]).append($createParagraphNode()));
				}
				t.setRowSpan(1);
			}
		}
		function It(e, t, n) {
			const [o, l, r] = Ut(e, t, n);
			return null === l && ut(207), null === r && ut(208), [
				o,
				l,
				r
			];
		}
		function Ut(e, t, n) {
			const o = [];
			let l = null, r = null;
			function s(e) {
				let t = o[e];
				return void 0 === t && (o[e] = t = []), t;
			}
			const i = e.getChildren();
			for (let e = 0; e < i.length; e++) {
				const o = i[e];
				gt(o) || ut(209);
				const c = s(e);
				for (let a = o.getFirstChild(), u = 0; null != a; a = a.getNextSibling()) {
					for (ct(a) || ut(147); void 0 !== c[u];) u++;
					const o = {
						cell: a,
						startColumn: u,
						startRow: e
					}, { __rowSpan: h, __colSpan: d } = a;
					for (let t = 0; t < h && !(e + t >= i.length); t++) {
						const n = s(e + t);
						for (let e = 0; e < d; e++) n[u + e] = o;
					}
					null !== t && null === l && t.is(a) && (l = o), null !== n && null === r && n.is(a) && (r = o);
				}
			}
			return [
				o,
				l,
				r
			];
		}
		function Xt(e) {
			let t;
			if (e instanceof lt) t = e;
			else if ("__type" in e) {
				const n = $findMatchingParent$1(e, ct);
				ct(n) || ut(148), t = n;
			} else {
				const n = $findMatchingParent$1(e.getNode(), ct);
				ct(n) || ut(148), t = n;
			}
			const n = t.getParent();
			gt(n) || ut(149);
			const o = n.getParent();
			return uo(o) || ut(210), [
				t,
				n,
				o
			];
		}
		function Yt(e, t, n) {
			let o, l = Math.min(t.startColumn, n.startColumn), r = Math.min(t.startRow, n.startRow), s = Math.max(t.startColumn + t.cell.__colSpan - 1, n.startColumn + n.cell.__colSpan - 1), i = Math.max(t.startRow + t.cell.__rowSpan - 1, n.startRow + n.cell.__rowSpan - 1);
			do {
				o = !1;
				for (let t = 0; t < e.length; t++) for (let n = 0; n < e[0].length; n++) {
					const c = e[t][n];
					if (!c) continue;
					const a = c.startColumn + c.cell.__colSpan - 1, u = c.startRow + c.cell.__rowSpan - 1, h = c.startColumn <= s && a >= l, d = c.startRow <= i && u >= r;
					if (h && d) {
						const e = Math.min(l, c.startColumn), t = Math.max(s, a), n = Math.min(r, c.startRow), h = Math.max(i, u);
						e === l && t === s && n === r && h === i || (l = e, s = t, r = n, i = h, o = !0);
					}
				}
			} while (o);
			return {
				maxColumn: s,
				maxRow: i,
				minColumn: l,
				minRow: r
			};
		}
		function qt(e) {
			const t = e.getChildren();
			let n = null;
			for (const e of t) {
				if (!gt(e)) return !1;
				if (null === n && (n = e.getChildrenSize()), e.getChildrenSize() !== n) return !1;
				const t = e.getChildren();
				for (const e of t) if (!ct(e) || 1 !== e.getRowSpan() || 1 !== e.getColSpan()) return !1;
			}
			return (n || 0) > 0;
		}
		function Jt(e, t, n) {
			if (t === n) return;
			const o = e.getColumnCount();
			if (t < 0 || t >= o || n < 0 || n >= o) return;
			if (!qt(e)) return;
			e.getChildren().filter(gt).forEach((e) => {
				const o = e.getChildren(), [l] = o.splice(t, 1);
				o.splice(n, 0, l), e.splice(0, o.length, o);
			});
			const l = e.getColWidths();
			if (l && l.length === o) {
				const o = [...l], [r] = o.splice(t, 1);
				o.splice(n, 0, r), e.setColWidths(o);
			}
		}
		function jt(e, t, n) {
			if (t === n) return;
			const o = e.getChildren().filter(gt), l = o.length;
			if (t < 0 || t >= l || n < 0 || n >= l) return;
			if (!qt(e)) return;
			const r = o[t], s = o[n];
			n > t ? s.insertAfter(r) : s.insertBefore(r);
		}
		function Vt(e) {
			const [t, , n] = Xt(e), o = n.getChildren().filter(gt), l = o.length, r = o[0].getChildren().length, s = new Array(l);
			for (let e = 0; e < l; e++) s[e] = new Array(r);
			for (let e = 0; e < l; e++) {
				const n = o[e].getChildren().filter(ct);
				let l = 0;
				for (let o = 0; o < n.length; o++) {
					for (; s[e][l];) l++;
					const r = n[o], i = r.__rowSpan || 1, c = r.__colSpan || 1;
					for (let t = 0; t < i; t++) for (let n = 0; n < c; n++) s[e + t][l + n] = r;
					if (t === r) return {
						colSpan: c,
						columnIndex: l,
						rowIndex: e,
						rowSpan: i
					};
					l += c;
				}
			}
			return null;
		}
		function Gt(e, t) {
			const n = t.getStartEndPoints(), o = nn(t);
			if (null === n) return !1;
			const [l, s] = n, [c, a, u] = Xt(l), h = $findMatchingParent$1(s.getNode(), (e) => ct(e));
			if (!(ct(c) && ct(h) && gt(a) && uo(u))) return !1;
			const [d, g, p] = It(u, c, h), [m] = Ut(e, null, null), C = d.length, _ = C > 0 ? d[0].length : 0;
			let S = g.startRow, b = g.startColumn, w = m.length, y = w > 0 ? m[0].length : 0;
			if (o) {
				const e = Yt(d, g, p), t = e.maxRow - e.minRow + 1, n = e.maxColumn - e.minColumn + 1;
				S = e.minRow, b = e.minColumn, w = Math.min(w, t), y = Math.min(y, n);
			}
			let N = !1;
			const v = Math.min(C, S + w) - 1, x = Math.min(_, b + y) - 1, T = /* @__PURE__ */ new Set();
			for (let e = S; e <= v; e++) for (let t = b; t <= x; t++) {
				const n = d[e][t];
				T.has(n.cell.getKey()) || 1 === n.cell.__rowSpan && 1 === n.cell.__colSpan || (Pt(n.cell), T.add(n.cell.getKey()), N = !0);
			}
			let [R] = Ut(u.getWritable(), null, null);
			const F = w - C + S;
			for (let e = 0; e < F; e++) Rt(R[C - 1][0].cell);
			const A = y - _ + b;
			for (let e = 0; e < A; e++) Et(R[0][_ - 1].cell, !0, !1);
			[R] = Ut(u.getWritable(), null, null);
			for (let e = S; e < S + w; e++) for (let t = b; t < b + y; t++) {
				const n = e - S, o = t - b, l = m[n][o];
				if (l.startRow !== n || l.startColumn !== o) continue;
				const s = l.cell;
				if (1 !== s.__rowSpan || 1 !== s.__colSpan) {
					const n = [], o = Math.min(e + s.__rowSpan, S + w) - 1, l = Math.min(t + s.__colSpan, b + y) - 1;
					for (let r = e; r <= o; r++) for (let e = t; e <= l; e++) {
						const t = R[r][e];
						n.push(t.cell);
					}
					Ht(n), N = !0;
				}
				const { cell: c } = R[e][t], a = s.getBackgroundColor();
				null != a && c.setBackgroundColor(a);
				const u = c.getChildren();
				s.getChildren().forEach((e) => {
					if ($isTextNode(e)) $createParagraphNode().append(e), c.append(e);
					else c.append(e);
				}), u.forEach((e) => e.remove());
			}
			if (o && N) {
				const [e] = Ut(u.getWritable(), null, null);
				e[g.startRow][g.startColumn].cell.selectEnd();
			}
			return !0;
		}
		function Qt(e, t, n) {
			const [o] = Ut(e, null, null);
			t >= 0 && t < o.length || ut(396, String(t));
			const l = o[t], r = n ? ot.ROW : ot.NO_STATUS, s = /* @__PURE__ */ new Set();
			for (let e = 0; e < l.length; e++) {
				const t = l[e];
				null != t && (s.has(t.cell) || (s.add(t.cell), t.cell.setHeaderStyles(r, ot.ROW)));
			}
		}
		function Zt(e, t, n) {
			const [o] = Ut(e, null, null);
			o.length > 0 && t >= 0 && t < o[0].length || ut(397, String(t));
			const l = n ? ot.COLUMN : ot.NO_STATUS, r = /* @__PURE__ */ new Set();
			for (let e = 0; e < o.length; e++) {
				const n = o[e][t];
				null != n && (r.has(n.cell) || (r.add(n.cell), n.cell.setHeaderStyles(l, ot.COLUMN)));
			}
		}
		function en(e) {
			const [[t, n, o, l], [r, s, i, c]] = ["anchor", "focus"].map((t) => {
				const n = e[t].getNode(), o = $findMatchingParent$1(n, ct);
				ct(o) || ut(238, t, n.getKey(), n.getType());
				const l = o.getParent();
				gt(l) || ut(239, t);
				const r = l.getParent();
				return uo(r) || ut(240, t), [
					n,
					o,
					l,
					r
				];
			});
			return l.is(c) || ut(241), {
				anchorCell: n,
				anchorNode: t,
				anchorRow: o,
				anchorTable: l,
				focusCell: s,
				focusNode: r,
				focusRow: i,
				focusTable: c
			};
		}
		var tn = class tn {
			tableKey;
			anchor;
			focus;
			_cachedNodes;
			dirty;
			constructor(e, t, n) {
				this.anchor = t, this.focus = n, t._selection = this, n._selection = this, this._cachedNodes = null, this.dirty = !1, this.tableKey = e;
			}
			getStartEndPoints() {
				return [this.anchor, this.focus];
			}
			isValid() {
				if ("root" === this.tableKey || "root" === this.anchor.key || "element" !== this.anchor.type || "root" === this.focus.key || "element" !== this.focus.type) return !1;
				const e = $getNodeByKey(this.tableKey), t = $getNodeByKey(this.anchor.key), n = $getNodeByKey(this.focus.key);
				return null !== e && null !== t && null !== n;
			}
			isBackward() {
				return this.focus.isBefore(this.anchor);
			}
			getCachedNodes() {
				return this._cachedNodes;
			}
			setCachedNodes(e) {
				this._cachedNodes = e;
			}
			is(e) {
				return nn(e) && this.tableKey === e.tableKey && this.anchor.is(e.anchor) && this.focus.is(e.focus);
			}
			set(e, t, n) {
				this.dirty = this.dirty || e !== this.tableKey || t !== this.anchor.key || n !== this.focus.key, this.tableKey = e, this.anchor.key = t, this.focus.key = n, this._cachedNodes = null;
			}
			clone() {
				return new tn(this.tableKey, $createPoint(this.anchor.key, this.anchor.offset, this.anchor.type), $createPoint(this.focus.key, this.focus.offset, this.focus.type));
			}
			isCollapsed() {
				return !1;
			}
			extract() {
				return this.getNodes();
			}
			insertRawText(e) {
				if ("" === e) return;
				const t = (e.endsWith("\n") ? e.slice(0, -1) : e).split("\n").map((e) => e.split("	")), n = ao();
				for (const e of t) {
					const t = ft();
					for (const n of e) {
						const e = it(ot.NO_STATUS), o = $createParagraphNode();
						n && o.append($createTextNode(n)), e.append(o), t.append(e);
					}
					n.append(t);
				}
				const { anchorCell: o } = en(this);
				Gt(n, o.select(0, o.getChildrenSize()));
			}
			insertText() {}
			hasFormat(e) {
				let t = 0;
				this.getNodes().filter(ct).forEach((e) => {
					const n = e.getFirstChild();
					$isParagraphNode(n) && (t |= n.getTextFormat());
				});
				const n = TEXT_TYPE_TO_FORMAT[e];
				return 0 !== (t & n);
			}
			insertNodes(e) {
				const t = this.focus.getNode();
				$isElementNode(t) || ut(151);
				$normalizeSelection__EXPERIMENTAL(t.select(0, t.getChildrenSize())).insertNodes(e);
			}
			getShape() {
				const { anchorCell: e, focusCell: t } = en(this), n = Vt(e);
				null === n && ut(153);
				const o = Vt(t);
				null === o && ut(155);
				const l = Math.min(n.columnIndex, o.columnIndex), r = Math.max(n.columnIndex + n.colSpan - 1, o.columnIndex + o.colSpan - 1), s = Math.min(n.rowIndex, o.rowIndex), i = Math.max(n.rowIndex + n.rowSpan - 1, o.rowIndex + o.rowSpan - 1);
				return {
					fromX: Math.min(l, r),
					fromY: Math.min(s, i),
					toX: Math.max(l, r),
					toY: Math.max(s, i)
				};
			}
			getNodes() {
				if (!this.isValid()) return [];
				const e = this._cachedNodes;
				if (null !== e) return e;
				const { anchorTable: t, anchorCell: n, focusCell: o } = en(this), l = o.getParents()[1];
				if (l !== t) {
					if (t.isParentOf(o)) {
						const e = l.getParent();
						e ?? ut(159), this.set(this.tableKey, o.getKey(), e.getKey());
					} else {
						const e = t.getParent();
						e ?? ut(158), this.set(this.tableKey, e.getKey(), o.getKey());
					}
					return this.getNodes();
				}
				const [r, s, i] = It(t, n, o), { minColumn: c, maxColumn: a, minRow: u, maxRow: h } = Yt(r, s, i), d = /* @__PURE__ */ new Map([[t.getKey(), t]]);
				let f = null;
				for (let e = u; e <= h; e++) for (let t = c; t <= a; t++) {
					const { cell: n } = r[e][t], o = n.getParent();
					gt(o) || ut(160), o !== f && (d.set(o.getKey(), o), f = o), d.has(n.getKey()) || rn(n, (e) => {
						d.set(e.getKey(), e);
					});
				}
				const g = Array.from(d.values());
				return isCurrentlyReadOnlyMode() || (this._cachedNodes = g), g;
			}
			getTextContent() {
				const e = this.getNodes().filter((e) => ct(e));
				let t = "";
				for (let n = 0; n < e.length; n++) {
					const o = e[n], l = o.__parent, r = (e[n + 1] || {}).__parent;
					t += o.getTextContent() + (r !== l ? "\n" : "	");
				}
				return t;
			}
		};
		function nn(e) {
			return e instanceof tn;
		}
		function on() {
			return new tn("root", $createPoint("root", 0, "element"), $createPoint("root", 0, "element"));
		}
		function ln(e, t, n) {
			e.getKey(), t.getKey(), n.getKey();
			const o = $getSelection(), l = nn(o) ? o.clone() : new tn("root", $createPoint("root", 0, "element"), $createPoint("root", 0, "element"));
			return l.set(e.getKey(), t.getKey(), n.getKey()), l;
		}
		function rn(e, t) {
			const n = [[e]];
			for (let e = n.at(-1); void 0 !== e && n.length > 0; e = n.at(-1)) {
				const o = e.pop();
				void 0 === o ? n.pop() : !1 !== t(o) && $isElementNode(o) && n.push(o.getChildren());
			}
		}
		function sn(e, t = $getEditor()) {
			const n = $getNodeByKey(e);
			uo(n) || ut(231, e);
			const o = pn(n, t.getElementByKey(e));
			return null === o && ut(232, e), {
				tableElement: o,
				tableNode: n
			};
		}
		var cn = class {
			observers;
			nextFocus;
			shouldCheckSelectionForTable;
			constructor() {
				this.observers = /* @__PURE__ */ new Map(), this.nextFocus = null, this.shouldCheckSelectionForTable = null;
			}
			setNextFocus(e) {
				this.nextFocus = e;
			}
			getAndClearNextFocus() {
				const { nextFocus: e } = this;
				return null !== e && (this.nextFocus = null), e;
			}
			setShouldCheckSelectionForTable(e) {
				this.shouldCheckSelectionForTable = e;
			}
			getAndClearShouldCheckSelectionForTable() {
				const { shouldCheckSelectionForTable: e } = this;
				return e ? (this.shouldCheckSelectionForTable = null, e) : null;
			}
			removeObserver(e) {
				const t = this.observers.get(e);
				return void 0 !== t && (t[0].removeListeners(), this.observers.delete(e), !0);
			}
			removeAllObservers() {
				for (const e of Array.from(this.observers.keys())) this.removeObserver(e);
			}
			$getTableNodesAndObservers() {
				const e = [];
				for (const [t, [n]] of Array.from(this.observers.entries())) {
					const o = $getNodeByKey(t);
					uo(o) ? e.push([o, n]) : this.removeObserver(t);
				}
				return e;
			}
		};
		var an = class {
			focusX;
			focusY;
			listenersToRemove;
			table;
			isHighlightingCells;
			anchorX;
			anchorY;
			tableNodeKey;
			anchorCell;
			focusCell;
			anchorCellNodeKey;
			focusCellNodeKey;
			editor;
			tableSelection;
			hasHijackedSelectionStyles;
			isSelecting;
			pointerType;
			abortController;
			listenerOptions;
			constructor(e, t) {
				this.isHighlightingCells = !1, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.listenersToRemove = /* @__PURE__ */ new Set(), this.tableNodeKey = t, this.editor = e, this.table = {
					columns: 0,
					domRows: [],
					rows: 0
				}, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = !1, this.isSelecting = !1, this.pointerType = null, this.abortController = new AbortController(), this.listenerOptions = { signal: this.abortController.signal }, this.trackTable();
			}
			getTable() {
				return this.table;
			}
			removeListeners() {
				this.abortController.abort("removeListeners"), Array.from(this.listenersToRemove).forEach((e) => e()), this.listenersToRemove.clear();
			}
			$lookup() {
				return sn(this.tableNodeKey, this.editor);
			}
			trackTable() {
				const e = new MutationObserver((e) => {
					this.editor.read("latest", () => {
						let t = !1;
						for (let n = 0; n < e.length; n++) {
							const o = e[n].target.nodeName;
							if ("TABLE" === o || "TBODY" === o || "THEAD" === o || "TR" === o) {
								t = !0;
								break;
							}
						}
						if (!t) return;
						const { tableNode: n, tableElement: o } = this.$lookup();
						this.table = Fn(n, o);
					});
				});
				this.editor.read("latest", () => {
					const { tableNode: t, tableElement: n } = this.$lookup();
					this.table = Fn(t, n), e.observe(n, {
						attributes: !0,
						childList: !0,
						subtree: !0
					});
				});
			}
			$clearHighlight(e = !0) {
				const t = this.editor;
				this.isHighlightingCells = !1, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = !1, this.$enableHighlightStyle();
				const { tableNode: n, tableElement: o } = this.$lookup();
				An(t, Fn(n, o), null), e && null !== $getSelection() && ($setSelection(null), t.dispatchCommand(SELECTION_CHANGE_COMMAND));
			}
			$enableHighlightStyle() {
				const e = this.editor, { tableElement: t } = this.$lookup();
				removeClassNamesFromElement$1(t, e._config.theme.tableSelection), t.classList.remove("disable-selection"), this.hasHijackedSelectionStyles = !1;
			}
			$disableHighlightStyle() {
				const { tableElement: e } = this.$lookup();
				addClassNamesToElement$1(e, this.editor._config.theme.tableSelection), this.hasHijackedSelectionStyles = !0;
			}
			$updateTableTableSelection(e) {
				if (null !== e) {
					e.tableKey !== this.tableNodeKey && ut(233, e.tableKey, this.tableNodeKey);
					const t = this.editor;
					this.tableSelection = e, this.isHighlightingCells = !0, this.$disableHighlightStyle(), this.updateDOMSelection(), An(t, this.table, this.tableSelection);
				} else this.$clearHighlight();
			}
			updateDOMSelection() {
				if (null !== this.anchorCell && null !== this.focusCell) {
					const e = getDOMSelection(this.editor._window);
					e && e.rangeCount > 0 && e.removeAllRanges();
				}
			}
			$setFocusCellForSelection(e, t = !1) {
				const n = this.editor, { tableNode: o } = this.$lookup(), l = e.x, r = e.y;
				if (this.focusCell = e, !this.isHighlightingCells) (t || this.anchorX !== l || this.anchorY !== r || null != this.tableSelection && null != this.anchorCellNodeKey) && (this.isHighlightingCells = !0, this.$disableHighlightStyle());
				if (-1 !== this.focusX && -1 !== this.focusY && l === this.focusX && r === this.focusY) return !1;
				if (this.focusX = l, this.focusY = r, this.isHighlightingCells) {
					const s = Jn(o, e.elem);
					if (null != this.tableSelection && null != this.anchorCellNodeKey) {
						let e = s;
						if (null === e && t && (e = o.getCellNodeFromCords(l, r, this.table)), null !== e) {
							const t = this.$getAnchorTableCellOrThrow();
							return this.focusCellNodeKey = e.getKey(), this.tableSelection = ln(o, t, e), $setSelection(this.tableSelection), n.dispatchCommand(SELECTION_CHANGE_COMMAND), An(n, this.table, this.tableSelection), !0;
						}
					}
				}
				return !1;
			}
			$getAnchorTableCell() {
				const e = this.anchorCellNodeKey ? $getNodeByKey(this.anchorCellNodeKey) : null;
				return ct(e) ? e : null;
			}
			$getAnchorTableCellOrThrow() {
				const e = this.$getAnchorTableCell();
				return null === e && ut(234), e;
			}
			$getFocusTableCell() {
				const e = this.focusCellNodeKey ? $getNodeByKey(this.focusCellNodeKey) : null;
				return ct(e) ? e : null;
			}
			$getFocusTableCellOrThrow() {
				const e = this.$getFocusTableCell();
				return null === e && ut(235), e;
			}
			$setAnchorCellForSelection(e) {
				this.isHighlightingCells = !1, this.anchorCell = e, this.anchorX = e.x, this.anchorY = e.y, this.focusX = -1, this.focusY = -1, this.focusCell = null, this.focusCellNodeKey = null;
				const { tableNode: t } = this.$lookup(), n = Jn(t, e.elem);
				if (null !== n) {
					const e = n.getKey();
					null != this.tableSelection ? (this.tableSelection = this.tableSelection.clone(), this.tableSelection.set(t.getKey(), e, e)) : this.tableSelection = ln(t, n, n), this.anchorCellNodeKey = e;
				}
			}
			$formatCells(e) {
				const t = $getSelection();
				nn(t) || ut(236);
				const n = $createRangeSelection(), o = n.anchor, l = n.focus, r = t.getNodes().filter(ct);
				r.length > 0 || ut(237);
				const s = r[0].getFirstChild(), i = $isParagraphNode(s) ? s.getFormatFlags(e, null) : null;
				r.forEach((t) => {
					o.set(t.getKey(), 0, "element"), l.set(t.getKey(), t.getChildrenSize(), "element"), n.formatText(e, i);
				}), $setSelection(t), this.editor.dispatchCommand(SELECTION_CHANGE_COMMAND);
			}
			$clearText() {
				const { editor: e } = this, t = $getNodeByKey(this.tableNodeKey);
				if (!uo(t)) throw new Error("Expected TableNode.");
				const n = $getSelection();
				nn(n) || ut(253);
				const o = n.getNodes().filter(ct), l = t.getFirstChild(), r = t.getLastChild();
				if (o.length > 0 && null !== l && null !== r && gt(l) && gt(r) && o[0] === l.getFirstChild() && o[o.length - 1] === r.getLastChild()) {
					t.selectPrevious();
					const n = t.getParent();
					t.remove(), $isRootNode(n) && n.isEmpty() && e.dispatchCommand(INSERT_PARAGRAPH_COMMAND);
					return;
				}
				o.forEach((e) => {
					if ($isElementNode(e)) {
						const t = $createParagraphNode(), n = $createTextNode();
						t.append(n), e.append(t), e.getChildren().forEach((e) => {
							e !== t && e.remove();
						});
					}
				}), An(e, this.table, null), $setSelection(null), e.dispatchCommand(SELECTION_CHANGE_COMMAND);
			}
		};
		const un = "__lexicalTableSelection";
		function hn(e) {
			const t = $getNodeByKeyOrThrow(e);
			return uo(t) || ut(386, e), t;
		}
		const dn = 40;
		function fn(e, t, n) {
			const o = (e) => Math.max(1, Math.ceil(Math.min(dn, e) / dn * 18));
			return e <= t + dn ? -o(t + dn - e) : e >= n - dn ? o(e - (n - dn)) : 0;
		}
		function gn(e) {
			return isHTMLElement$1(e) && "TABLE" === e.nodeName;
		}
		function pn(e, t) {
			if (!t) return t;
			const n = gn(t) ? t : t.querySelector("table");
			return gn(n) || ut(341, e.constructor.name, e.getType(), e.getKey(), t.nodeName), n;
		}
		function mn(e) {
			return e._window;
		}
		function Cn(e, t) {
			for (let n = t, o = null; null !== n; n = n.getParent()) {
				if (e.is(n)) return o;
				ct(n) && (o = n);
			}
			return null;
		}
		const _n = [
			[KEY_ARROW_DOWN_COMMAND, "down"],
			[KEY_ARROW_UP_COMMAND, "up"],
			[KEY_ARROW_LEFT_COMMAND, "backward"],
			[KEY_ARROW_RIGHT_COMMAND, "forward"]
		];
		const Sn = [
			DELETE_WORD_COMMAND,
			DELETE_LINE_COMMAND,
			DELETE_CHARACTER_COMMAND
		];
		const bn = [KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND];
		function wn(e, t) {
			return e.registerRootListener((n) => {
				if (null === n) return;
				const o = e._window;
				if (null === o) return;
				return registerEventListener(o, "pointerdown", (o) => {
					const l = getComposedEventTarget(o);
					if (0 !== o.button || !isDOMNode(l) || !n.contains(l)) return;
					const r = function(e) {
						const t = Tn(e);
						if (null === t) return null;
						let n = t.elem;
						for (; null != n;) {
							if ("TABLE" === n.nodeName && un in n && n[un]) return {
								cellElement: t,
								tableElement: n,
								tableObserver: n[un]
							};
							n = n.parentNode;
						}
						return null;
					}(l);
					e.update(() => {
						if (nn($getSelection())) {
							for (const [e] of t.observers.values()) e.$clearHighlight(!1);
							$setSelection(null), e.dispatchCommand(SELECTION_CHANGE_COMMAND);
						}
						if (!r) return;
						const { tableObserver: n, tableElement: l, cellElement: s } = r;
						(function(e, t, n, o, l, r) {
							const s = e._window;
							if (!s) return;
							const i = (n) => {
								if (l.isSelecting) return;
								l.isSelecting = !0, null !== n && null === l.anchorCell && e.update(() => {
									l.$setAnchorCellForSelection(n);
								});
								let i = t.clientX, c = t.clientY, a = null;
								const u = () => {
									l.isSelecting = !1, null !== a && (s.cancelAnimationFrame(a), a = null), s.removeEventListener("pointerup", S), s.removeEventListener("pointermove", b);
								}, h = (e, t) => {
									const n = o.getRootNode();
									if (!isDOMDocumentNode(n) && !isDOMShadowRoot(n)) return null;
									for (const l of n.elementsFromPoint(e, t)) {
										const e = Rn(o, l);
										if (e) return e;
									}
									return null;
								}, d = (t, n) => {
									null === l.anchorCell && e.update(() => {
										l.$setAnchorCellForSelection(t);
									}), null !== l.focusCell && t.elem === l.focusCell.elem || (r.setNextFocus({
										focusCell: t,
										override: n,
										tableKey: l.tableNodeKey
									}), e.dispatchCommand(SELECTION_CHANGE_COMMAND));
								}, f = (e) => {
									for (let t = o.parentElement; t; t = t.parentElement) if ("x" === e ? t.scrollWidth > t.clientWidth : t.scrollHeight > t.clientHeight) {
										const n = s.getComputedStyle(t), o = "x" === e ? n.overflowX : n.overflowY;
										if ("auto" === o || "scroll" === o) return t;
									}
									return null;
								}, g = (e, t, n) => {
									let o, l;
									if (null === e) o = 0, l = "x" === n ? s.innerWidth : s.innerHeight;
									else {
										const t = e.getBoundingClientRect();
										o = "x" === n ? t.left : t.top, l = "x" === n ? t.right : t.bottom;
									}
									const r = fn(t, o, l);
									if (0 === r) return !1;
									if (null === e) {
										const e = "x" === n ? s.scrollX : s.scrollY;
										return s.scrollBy("x" === n ? r : 0, "x" === n ? 0 : r), ("x" === n ? s.scrollX : s.scrollY) !== e;
									}
									if ("x" === n) {
										const t = e.scrollLeft;
										return e.scrollLeft += r, e.scrollLeft !== t;
									}
									const i = e.scrollTop;
									return e.scrollTop += r, e.scrollTop !== i;
								}, p = (e, t) => {
									let n = i, o = c;
									if (null === e) n = Math.min(Math.max(n, 1), s.innerWidth - 1);
									else {
										const t = e.getBoundingClientRect();
										n = Math.min(Math.max(n, t.left + 1), t.right - 1);
									}
									if (null === t) o = Math.min(Math.max(o, 1), s.innerHeight - 1);
									else {
										const e = t.getBoundingClientRect();
										o = Math.min(Math.max(o, e.top + 1), e.bottom - 1);
									}
									return [n, o];
								}, m = () => {
									const e = f("x");
									if (null !== e) {
										const t = e.getBoundingClientRect();
										if (0 !== fn(i, t.left, t.right)) return !0;
									}
									const t = f("y"), n = null === t ? 0 : t.getBoundingClientRect().top, o = null === t ? s.innerHeight : t.getBoundingClientRect().bottom;
									return 0 !== fn(c, n, o);
								}, C = () => {
									if (a = null, !l.isSelecting) return;
									const e = f("x"), t = f("y"), n = null !== e && g(e, i, "x"), o = g(t, c, "y");
									if (n || o) {
										const [n, o] = p(e, t), l = h(n, o);
										l && d(l, !1), a = s.requestAnimationFrame(C);
									}
								}, _ = () => {
									null === a && "touch" !== l.pointerType && m() && (a = s.requestAnimationFrame(C));
								}, S = () => {
									u();
								}, b = (e) => {
									if (!((e) => !(1 & ~e.buttons))(e) && l.isSelecting) return void u();
									const t = getComposedEventTarget(e);
									if (!isDOMNode(t)) return;
									i = e.clientX, c = e.clientY;
									let n = null;
									const r = !(IS_FIREFOX$1 || o.contains(t));
									n = r ? Rn(o, t) : h(e.clientX, e.clientY), n && d(n, r), _();
								};
								s.addEventListener("pointerup", S, l.listenerOptions), s.addEventListener("pointermove", b, l.listenerOptions);
							};
							l.pointerType = t.pointerType;
							const c = hn(l.tableNodeKey), a = $getPreviousSelection();
							if (IS_FIREFOX$1 && t.shiftKey && $n(a, c) && ($isRangeSelection(a) || nn(a))) {
								const e = a.anchor.getNode(), o = Cn(c, a.anchor.getNode());
								if (o) l.$setAnchorCellForSelection(qn(l, o)), l.$setFocusCellForSelection(n), Un(t);
								else (c.isBefore(e) ? c.selectStart() : c.selectEnd()).anchor.set(a.anchor.key, a.anchor.offset, a.anchor.type);
							} else "touch" !== t.pointerType && l.$setAnchorCellForSelection(n);
							i(n);
						})(e, o, s, l, n, t);
					});
				});
			});
		}
		function yn(e, t, n, o, l) {
			const r = n.getRootElement(), s = mn(n);
			null !== r && null !== s || ut(246);
			const i = new an(n, e.getKey()), c = pn(e, t);
			(function(e, t) {
				null !== xn(e) && ut(205);
				e[un] = t;
			})(c, i), i.listenersToRemove.add(() => function(e, t) {
				xn(e) === t && delete e[un];
			}(c, i));
			i.listenersToRemove.add(registerEventListener(c, "mousedown", (e) => {
				const t = getComposedEventTarget(e);
				if (e.detail >= 3 && isDOMNode(t)) null !== Tn(t) && e.preventDefault();
			}, i.listenerOptions));
			for (const [t, o] of _n) i.listenersToRemove.add(n.registerCommand(t, (t) => In(n, t, o, e, i, l), COMMAND_PRIORITY_HIGH));
			i.listenersToRemove.add(n.registerCommand(KEY_ESCAPE_COMMAND, (t) => {
				const n = $getSelection();
				if (nn(n)) {
					const o = Cn(e, n.focus.getNode());
					if (null !== o) return Un(t), o.selectEnd(), !0;
				}
				return !1;
			}, COMMAND_PRIORITY_HIGH));
			const a = () => {
				const t = $getSelection();
				return !!$n(t, e) && !!nn(t) && (i.$clearText(), !0);
			};
			for (const e of Sn) i.listenersToRemove.add(n.registerCommand(e, a, COMMAND_PRIORITY_HIGH));
			const g = (t) => {
				const n = $getSelection();
				if (!nn(n) && !$isRangeSelection(n)) return !1;
				const o = e.isParentOf(n.anchor.getNode());
				if (o !== e.isParentOf(n.focus.getNode())) {
					const t = o ? "anchor" : "focus", l = o ? "focus" : "anchor", { key: r, offset: s, type: i } = n[l];
					return e[n[t].isBefore(n[l]) ? "selectPrevious" : "selectNext"]()[l].set(r, s, i), !1;
				}
				return !!$n(n, e) && !!nn(n) && (t && (t.preventDefault(), t.stopPropagation()), i.$clearText(), !0);
			};
			for (const e of bn) i.listenersToRemove.add(n.registerCommand(e, g, COMMAND_PRIORITY_HIGH));
			i.listenersToRemove.add(n.registerCommand(CUT_COMMAND, (e) => {
				const t = $getSelection();
				if (t) {
					if (!nn(t) && !$isRangeSelection(t)) return !1;
					copyToClipboard(n, objectKlassEquals(e, ClipboardEvent) ? e : null, $getClipboardDataFromSelection(t));
					const o = g(e);
					return $isRangeSelection(t) ? (t.removeText(), !0) : o;
				}
				return !1;
			}, COMMAND_PRIORITY_HIGH));
			const p = r.ownerDocument;
			return i.listenersToRemove.add(registerEventListener(p, "paste", (t) => {
				if (t.defaultPrevented) return;
				n.read("latest", () => {
					const t = $getSelection();
					return r.contains(p.activeElement) && nn(t) && $n(t, e);
				}) && (t.preventDefault(), n.dispatchCommand(PASTE_COMMAND, t));
			})), i.listenersToRemove.add(registerEventListener(p, "copy", (t) => {
				if (t.defaultPrevented) return;
				const o = getComposedEventTarget(t);
				if (o === r || isDOMNode(o) && r.contains(o)) return;
				n.read("latest", () => {
					const t = $getSelection();
					return r.contains(getActiveElement(r)) && nn(t) && $n(t, e);
				}) && (t.preventDefault(), n.dispatchCommand(COPY_COMMAND, t));
			})), i.listenersToRemove.add(n.registerCommand(FORMAT_TEXT_COMMAND, (t) => {
				const n = $getSelection();
				return !!$n(n, e) && !!nn(n) && (i.$formatCells(t), !0);
			}, COMMAND_PRIORITY_HIGH)), i.listenersToRemove.add(n.registerCommand(FORMAT_ELEMENT_COMMAND, (t) => {
				const n = $getSelection();
				if (!nn(n) || !$n(n, e)) return !1;
				const o = n.anchor.getNode(), l = n.focus.getNode();
				if (!ct(o) || !ct(l)) return !1;
				const [r, s, i] = It(e, o, l), c = Math.max(s.startRow + s.cell.__rowSpan - 1, i.startRow + i.cell.__rowSpan - 1), a = Math.max(s.startColumn + s.cell.__colSpan - 1, i.startColumn + i.cell.__colSpan - 1), u = Math.min(s.startRow, i.startRow), d = Math.min(s.startColumn, i.startColumn);
				if (0 === u && 0 === d && c === r.length - 1 && a === r[0].length - 1) return e.setFormat(t), !0;
				const f = /* @__PURE__ */ new Set();
				for (let e = u; e <= c; e++) for (let n = d; n <= a; n++) {
					const o = r[e][n].cell;
					if (f.has(o)) continue;
					f.add(o), o.setFormat(t);
					const l = o.getChildren();
					for (let e = 0; e < l.length; e++) {
						const n = l[e];
						$isElementNode(n) && !n.isInline() && n.setFormat(t);
					}
				}
				return !0;
			}, COMMAND_PRIORITY_HIGH)), i.listenersToRemove.add(n.registerCommand(CONTROLLED_TEXT_INSERTION_COMMAND, (t) => {
				const o = $getSelection();
				if (!$n(o, e)) return !1;
				if (nn(o)) return i.$clearHighlight(), !1;
				if ($isRangeSelection(o)) {
					if (!ct($findMatchingParent$1(o.anchor.getNode(), (e) => ct(e)))) return !1;
					if ("string" == typeof t) {
						const l = Yn(n, o, e);
						if (l) return Xn(l, e, [$createTextNode(t)]), !0;
					}
				}
				return !1;
			}, COMMAND_PRIORITY_HIGH)), o && i.listenersToRemove.add(n.registerCommand(KEY_TAB_COMMAND, (t) => {
				const n = $getSelection();
				if (!$isRangeSelection(n) || !n.isCollapsed() || !$n(n, e)) return !1;
				const o = Bn(n.anchor.getNode());
				return !(null === o || !e.is(Dn(o))) && (Un(t), function(e, t) {
					const n = "next" === t ? "getNextSibling" : "getPreviousSibling", o = "next" === t ? "getFirstChild" : "getLastChild", l = e[n]();
					if ($isElementNode(l)) return l.selectEnd();
					const r = $findMatchingParent$1(e, gt);
					null === r && ut(247);
					for (let e = r[n](); gt(e); e = e[n]()) {
						const t = e[o]();
						if ($isElementNode(t)) return t.selectEnd();
					}
					const s = $findMatchingParent$1(r, uo);
					null === s && ut(248);
					"next" === t ? s.selectNext() : s.selectPrevious();
				}(o, t.shiftKey ? "previous" : "next"), !0);
			}, COMMAND_PRIORITY_HIGH)), i.listenersToRemove.add(n.registerCommand(FOCUS_COMMAND, (t) => e.isSelected(), COMMAND_PRIORITY_HIGH)), i.listenersToRemove.add(n.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
				const t = $getSelection();
				if (!$isRangeSelection(t) || !t.isCollapsed() || !$n(t, e)) return !1;
				const o = Yn(n, t, e);
				return !!o && (Xn(o, e), !0);
			}, COMMAND_PRIORITY_HIGH)), i;
		}
		function Nn(e, t) {
			const n = $getSelection(), o = $getPreviousSelection(), l = e.getAndClearNextFocus();
			if (null !== l) {
				const { tableKey: t, focusCell: o } = l, r = e.observers.get(t);
				r || ut(335, t);
				const [s] = r;
				if (nn(n) && n.tableKey === s.tableNodeKey) return (o.x !== s.focusX || o.y !== s.focusY) && (s.$setFocusCellForSelection(o), !0);
				if (null !== s.anchorCell && null !== s.anchorCellNodeKey && o.elem !== s.anchorCell.elem && null !== s.tableSelection) return s.$setFocusCellForSelection(o, !0), !0;
			}
			const r = e.getAndClearShouldCheckSelectionForTable();
			if (r && $isRangeSelection(o) && $isRangeSelection(n) && n.isCollapsed()) {
				const e = $getNodeByKey(r);
				if (uo(e)) {
					const t = n.anchor.getNode(), o = e.getFirstChild(), l = Bn(t);
					if (null !== l && gt(o)) {
						const t = o.getFirstChild();
						if (ct(t) && e.is($findMatchingParent$1(l, (n) => n.is(e) || n.is(t)))) return t.selectStart(), !0;
					}
				}
			}
			nn(n) && function(e, t) {
				const n = mn(e), o = $getPreviousSelection();
				if (!t.is(o)) return;
				const l = hn(t.tableKey), r = getDOMSelection(n), s = r && getDOMSelectionPoints(r, e.getRootElement());
				if (r && s && s.anchorNode && s.focusNode) {
					const n = $getNearestNodeFromDOMNode(s.focusNode), o = n && !l.isParentOf(n), i = $getNearestNodeFromDOMNode(s.anchorNode), c = i && l.isParentOf(i);
					if (o && c && r.rangeCount > 0) {
						const n = $createRangeSelectionFromDom(r, e);
						n && (n.anchor.set(l.getKey(), t.isBackward() ? l.getChildrenSize() : 0, "element"), r.removeAllRanges(), $setSelection(n));
					}
				}
			}(t, n), $isRangeSelection(n) && function(e, t) {
				const n = $getPreviousSelection(), { anchor: o, focus: l } = e, r = o.getNode(), s = l.getNode(), i = Bn(r), c = Bn(s), a = i ? Dn(i) : null, u = c ? Dn(c) : null, h = e.isBackward(), f = i && c && a && u && a.is(u), g = u && (!a || a.isParentOf(u)), p = a && (!u || u.isParentOf(a));
				if (g) {
					const t = e.clone(), [n] = It(u, c, c), o = n[0][0].cell, l = n[n.length - 1].at(-1).cell;
					t.focus.set(h ? o.getKey() : l.getKey(), h ? 0 : l.getChildrenSize(), "element"), $setSelection(t);
				} else if (p) {
					const t = e.clone(), [n] = It(a, i, i), o = n[0][0].cell, l = n[n.length - 1].at(-1).cell;
					t.anchor.set(h ? l.getKey() : o.getKey(), h ? l.getChildrenSize() : 0, "element"), $setSelection(t);
				} else if (f) {
					const o = t.observers.get(a.getKey());
					o || ut(335, a.getKey());
					const [l] = o;
					if (i.is(c) || (l.$setAnchorCellForSelection(qn(l, i)), l.$setFocusCellForSelection(qn(l, c), !0)), "touch" === l.pointerType && l.isSelecting && e.isCollapsed() && $isRangeSelection(n) && n.isCollapsed()) {
						const e = Bn(n.anchor.getNode());
						e && !e.is(c) && (l.$setAnchorCellForSelection(qn(l, e)), l.$setFocusCellForSelection(qn(l, c), !0), l.pointerType = null);
					}
				}
			}(n, e);
			for (const [n, o] of e.$getTableNodesAndObservers()) vn(t, n, o);
			return !1;
		}
		function vn(e, t, n) {
			const o = $getSelection(), l = $getPreviousSelection();
			o && !o.is(l) && (nn(o) || nn(l)) && n.tableSelection && !n.tableSelection.is(l) && (nn(o) && o.tableKey === n.tableNodeKey ? n.$updateTableTableSelection(o) : !nn(o) && nn(l) && l.tableKey === n.tableNodeKey && n.$updateTableTableSelection(null)), n.hasHijackedSelectionStyles && !t.isSelected() ? function(e, t) {
				t.$enableHighlightStyle(), On(t.table, (t) => {
					const n = t.elem;
					t.highlighted = !1, Hn(e, t), n.getAttribute("style") || n.removeAttribute("style");
				});
			}(e, n) : !n.hasHijackedSelectionStyles && t.isSelected() && function(e, t) {
				t.$disableHighlightStyle(), On(t.table, (t) => {
					t.highlighted = !0, zn(e, t);
				});
			}(e, n);
		}
		function xn(e) {
			return e[un] || null;
		}
		function Tn(e) {
			let t = e;
			for (; null != t;) {
				const e = t.nodeName;
				if ("TD" === e || "TH" === e) {
					const e = t._cell;
					return void 0 === e ? null : e;
				}
				t = t.parentNode;
			}
			return null;
		}
		function Rn(e, t) {
			if (!e.contains(t)) return null;
			let n = null;
			for (let o = t; null != o; o = o.parentNode) {
				if (o === e) return n;
				const t = o.nodeName;
				"TD" !== t && "TH" !== t || (n = o._cell || null);
			}
			return null;
		}
		function Fn(e, t) {
			const n = [], o = {
				columns: 0,
				domRows: n,
				rows: 0
			};
			let l = pn(e, t).querySelector("tr"), r = 0, s = 0;
			for (n.length = 0; null != l;) {
				const e = l.nodeName;
				if ("TD" === e || "TH" === e) {
					const e = {
						elem: l,
						hasBackgroundColor: "" !== l.style.backgroundColor,
						highlighted: !1,
						x: r,
						y: s
					};
					l._cell = e;
					let t = n[s];
					void 0 === t && (t = n[s] = []), t[r] = e;
				} else {
					const e = l.firstChild;
					if (null != e) {
						l = e;
						continue;
					}
				}
				const t = l.nextSibling;
				if (null != t) {
					r++, l = t;
					continue;
				}
				const o = l.parentNode;
				if (null != o) {
					const e = o.nextSibling;
					if (null == e) break;
					s++, r = 0, l = e;
				}
			}
			return o.columns = r + 1, o.rows = s + 1, o;
		}
		function An(e, t, n) {
			const o = new Set(n ? n.getNodes() : []);
			On(t, (t, n) => {
				const l = t.elem;
				o.has(n) ? (t.highlighted = !0, zn(e, t)) : (t.highlighted = !1, Hn(e, t), l.getAttribute("style") || l.removeAttribute("style"));
			});
		}
		function On(e, t) {
			const { domRows: n } = e;
			for (let e = 0; e < n.length; e++) {
				const o = n[e];
				if (o) for (let n = 0; n < o.length; n++) {
					const l = o[n];
					if (!l) continue;
					const r = $getNearestNodeFromDOMNode(l.elem);
					null !== r && t(l, r, {
						x: n,
						y: e
					});
				}
			}
		}
		const En = (e, t, n, o, l) => {
			const r = "forward" === l;
			switch (l) {
				case "backward":
				case "forward": return n !== (r ? e.table.columns - 1 : 0) ? Ln(t.getCellNodeFromCordsOrThrow(n + (r ? 1 : -1), o, e.table), r) : o !== (r ? e.table.rows - 1 : 0) ? Ln(t.getCellNodeFromCordsOrThrow(r ? 0 : e.table.columns - 1, o + (r ? 1 : -1), e.table), r) : r ? t.selectNext() : t.selectPrevious(), !0;
				case "up": return 0 !== o ? Ln(t.getCellNodeFromCordsOrThrow(n, o - 1, e.table), !1) : t.selectPrevious(), !0;
				case "down": return o !== e.table.rows - 1 ? Ln(t.getCellNodeFromCordsOrThrow(n, o + 1, e.table), !0) : t.selectNext(), !0;
				default: return !1;
			}
		};
		function Kn(e, t) {
			let n, o;
			if (t.startColumn === e.minColumn) n = "minColumn";
			else {
				if (t.startColumn + t.cell.__colSpan - 1 !== e.maxColumn) return null;
				n = "maxColumn";
			}
			if (t.startRow === e.minRow) o = "minRow";
			else {
				if (t.startRow + t.cell.__rowSpan - 1 !== e.maxRow) return null;
				o = "maxRow";
			}
			return [n, o];
		}
		function kn([e, t]) {
			return ["minColumn" === e ? "maxColumn" : "minColumn", "minRow" === t ? "maxRow" : "minRow"];
		}
		function Mn(e, t, [n, o]) {
			const l = t[o], r = e[l];
			void 0 === r && ut(250, o, String(l));
			const s = t[n], i = r[s];
			return void 0 === i && ut(250, n, String(s)), i;
		}
		function Wn(e, t, n, o, l) {
			const r = Yt(t, n, o), { topSpan: i, leftSpan: c, bottomSpan: a, rightSpan: u } = function(e, t) {
				const { minColumn: n, maxColumn: o, minRow: l, maxRow: r } = t;
				let s = 1, i = 1, c = 1, a = 1;
				const u = e[l], h = e[r];
				for (let e = n; e <= o; e++) s = Math.max(s, u[e].cell.__rowSpan), a = Math.max(a, h[e].cell.__rowSpan);
				for (let t = l; t <= r; t++) i = Math.max(i, e[t][n].cell.__colSpan), c = Math.max(c, e[t][o].cell.__colSpan);
				return {
					bottomSpan: a,
					leftSpan: i,
					rightSpan: c,
					topSpan: s
				};
			}(t, r), [d, f] = kn(function(e, t) {
				const n = Kn(e, t);
				return null === n && ut(249, t.cell.getKey()), n;
			}(r, n));
			let g = r[d], p = r[f];
			"forward" === l ? g += "maxColumn" === d ? 1 : c : "backward" === l ? g -= "minColumn" === d ? 1 : u : "down" === l ? p += "maxRow" === f ? 1 : i : "up" === l && (p -= "minRow" === f ? 1 : a);
			const m = t[p];
			if (void 0 === m) return !1;
			const C = m[g];
			if (void 0 === C) return !1;
			const [_, S] = function(e, t, n) {
				const o = Yt(e, t, n), l = Kn(o, t);
				if (l) return [Mn(e, o, l), Mn(e, o, kn(l))];
				const r = Kn(o, n);
				if (r) return [Mn(e, o, kn(r)), Mn(e, o, r)];
				const s = ["minColumn", "minRow"];
				return [Mn(e, o, s), Mn(e, o, kn(s))];
			}(t, n, C), b = qn(e, _.cell), w = qn(e, S.cell);
			return e.$setAnchorCellForSelection(b), e.$setFocusCellForSelection(w, !0), !0;
		}
		function $n(e, t) {
			if ($isRangeSelection(e) || nn(e)) {
				const n = t.isParentOf(e.anchor.getNode()), o = t.isParentOf(e.focus.getNode());
				return n && o;
			}
			return !1;
		}
		function Ln(e, t) {
			t ? e.selectStart() : e.selectEnd();
		}
		function zn(e, t) {
			const o = t.elem, l = e._config.theme;
			ct($getNearestNodeFromDOMNode(o)) || ut(131), addClassNamesToElement$1(o, l.tableCellSelected);
		}
		function Hn(e, t) {
			const n = t.elem;
			ct($getNearestNodeFromDOMNode(n)) || ut(131);
			const o = e._config.theme;
			removeClassNamesFromElement$1(n, o.tableCellSelected);
		}
		function Bn(e) {
			const t = $findMatchingParent$1(e, ct);
			return ct(t) ? t : null;
		}
		function Dn(e) {
			const t = $findMatchingParent$1(e, uo);
			return uo(t) ? t : null;
		}
		function Pn(e, t, n, o, l, r, s) {
			const i = $caretFromPoint(n.focus, l ? "previous" : "next");
			if ($isExtendableTextPointCaret(i)) return !1;
			let c = i;
			for (const e of $extendCaretToRange(i).iterNodeCarets("shadowRoot")) {
				if (!$isSiblingCaret(e) || !$isElementNode(e.origin)) return !1;
				c = e;
			}
			const a = c.getParentAtCaret();
			if (!ct(a)) return !1;
			const u = a, h = function(e) {
				for (const t of $extendCaretToRange(e).iterNodeCarets("root")) {
					const { origin: n } = t;
					if (ct(n)) {
						if ($isChildCaret(t)) return $getChildCaret(n, e.direction);
					} else if (!gt(n)) break;
				}
				return null;
			}($getSiblingCaret(u, c.direction)), d = $findMatchingParent$1(u, uo);
			if (!d || !d.is(r)) return !1;
			const g = e.getElementByKey(u.getKey()), p = Tn(g);
			if (!g || !p) return !1;
			if (s.table = io(e, d), h) if ("extend" === o) {
				const t = Tn(e.getElementByKey(h.origin.getKey()));
				if (!t) return !1;
				s.$setAnchorCellForSelection(p), s.$setFocusCellForSelection(t, !0);
			} else {
				const e = $normalizeCaret(h);
				$setPointFromCaret(n.anchor, e), $setPointFromCaret(n.focus, e);
			}
			else if ("extend" === o) s.$setAnchorCellForSelection(p), s.$setFocusCellForSelection(p, !0);
			else {
				const e = function(e) {
					const t = $getAdjacentChildCaret(e);
					return $isChildCaret(t) ? $normalizeCaret(t) : e;
				}($getSiblingCaret(d, i.direction));
				$setPointFromCaret(n.anchor, e), $setPointFromCaret(n.focus, e);
			}
			return Un(t), !0;
		}
		function In(e, t, n, o, l, s) {
			if (("up" === n || "down" === n) && function(e) {
				const t = e.getRootElement();
				if (!t) return !1;
				return t.hasAttribute("aria-controls") && "typeahead-menu" === t.getAttribute("aria-controls");
			}(e)) return !1;
			const i = $getSelection();
			if (!$n(i, o)) {
				if ($isRangeSelection(i)) {
					if ("backward" === n) {
						if (i.focus.offset > 0) return !1;
						const e = function(e) {
							for (let t = e, n = e; null !== n; t = n, n = n.getParent()) if ($isElementNode(n)) {
								if (n !== t && n.getFirstChild() !== t) return null;
								if (!n.isInline()) return n;
							}
							return null;
						}(i.focus.getNode());
						if (!e) return !1;
						const n = e.getPreviousSibling();
						return !!uo(n) && (Un(t), t.shiftKey ? i.focus.set(n.getParentOrThrow().getKey(), n.getIndexWithinParent(), "element") : n.selectEnd(), !0);
					}
					if (t.shiftKey && ("up" === n || "down" === n)) {
						const e = i.focus.getNode();
						if (!i.isCollapsed() && ("up" === n && !i.isBackward() || "down" === n && i.isBackward())) {
							let l = $findMatchingParent$1(e, (e) => uo(e));
							if (ct(l) && (l = $findMatchingParent$1(l, uo)), l !== o) return !1;
							if (!l) return !1;
							const s = "down" === n ? l.getNextSibling() : l.getPreviousSibling();
							if (!s) return !1;
							let c = 0;
							"up" === n && $isElementNode(s) && (c = s.getChildrenSize());
							let a = s;
							if ("up" === n && $isElementNode(s)) a = s.getLastChild() || s, c = $isTextNode(a) ? a.getTextContentSize() : 0;
							const u = i.clone();
							return u.focus.set(a.getKey(), c, $isTextNode(a) ? "text" : "element"), $setSelection(u), Un(t), !0;
						}
						if ($isRootOrShadowRoot(e)) {
							const e = "up" === n ? i.getNodes()[i.getNodes().length - 1] : i.getNodes()[0];
							if (e) {
								if (null !== Cn(o, e)) {
									const e = o.getFirstDescendant(), t = o.getLastDescendant();
									if (!e || !t) return !1;
									const [n] = Xt(e), [r] = Xt(t), s = o.getCordsFromCellNode(n, l.table), i = o.getCordsFromCellNode(r, l.table), c = o.getDOMCellFromCordsOrThrow(s.x, s.y, l.table), a = o.getDOMCellFromCordsOrThrow(i.x, i.y, l.table);
									return l.$setAnchorCellForSelection(c), l.$setFocusCellForSelection(a, !0), !0;
								}
							}
							return !1;
						}
						{
							let o = $findMatchingParent$1(e, (e) => $isElementNode(e) && !e.isInline());
							if (ct(o) && (o = $findMatchingParent$1(o, uo)), !o) return !1;
							const r = "down" === n ? o.getNextSibling() : o.getPreviousSibling();
							if (uo(r) && l.tableNodeKey === r.getKey()) {
								const e = r.getFirstDescendant(), o = r.getLastDescendant();
								if (!e || !o) return !1;
								const [l] = Xt(e), [s] = Xt(o), c = i.clone();
								return c.focus.set(("up" === n ? l : s).getKey(), "up" === n ? 0 : s.getChildrenSize(), "element"), Un(t), $setSelection(c), !0;
							}
						}
					}
				}
				return "down" === n && oo(e) && s.setShouldCheckSelectionForTable(o.getKey()), !1;
			}
			if ($isRangeSelection(i)) {
				if ("backward" === n || "forward" === n) return Pn(e, t, i, t.shiftKey ? "extend" : "move", "backward" === n, o, l);
				if (i.isCollapsed()) {
					const { anchor: r, focus: c } = i, a = $findMatchingParent$1(r.getNode(), ct), u = $findMatchingParent$1(c.getNode(), ct);
					if (!ct(a) || !a.is(u)) return !1;
					const h = Dn(a);
					if (h !== o && null != h) {
						const o = pn(h, e.getElementByKey(h.getKey()));
						if (null != o) return l.table = Fn(h, o), In(e, t, n, h, l, s);
					}
					const d = e.getElementByKey(a.__key), g = e.getElementByKey(r.key);
					if (null == g || null == d) return !1;
					let p;
					if ("element" === r.type) p = g.getBoundingClientRect();
					else {
						const t = getDOMSelection(mn(e));
						if (null === t || 0 === t.rangeCount) return !1;
						const n = getDOMSelectionRange(t, e.getRootElement());
						if (null === n) return !1;
						p = n.getBoundingClientRect();
					}
					const m = "up" === n ? a.getFirstChild() : a.getLastChild();
					if (null == m) return !1;
					const C = e.getElementByKey(m.__key);
					if (null == C) return !1;
					const _ = C.getBoundingClientRect();
					if ("up" === n ? _.top > p.top - p.height : p.bottom + p.height > _.bottom) {
						Un(t);
						const e = o.getCordsFromCellNode(a, l.table);
						if (!t.shiftKey) return En(l, o, e.x, e.y, n);
						{
							const t = o.getDOMCellFromCordsOrThrow(e.x, e.y, l.table);
							l.$setAnchorCellForSelection(t), l.$setFocusCellForSelection(t, !0);
						}
						return !0;
					}
				}
			} else if (nn(i)) {
				const { anchor: r, focus: s, tableKey: c } = i;
				if (c !== o.getKey()) return !1;
				const a = $findMatchingParent$1(r.getNode(), ct), u = $findMatchingParent$1(s.getNode(), ct), [h] = i.getNodes();
				uo(h) || ut(251);
				const d = pn(h, e.getElementByKey(h.getKey()));
				if (!ct(a) || !ct(u) || !uo(h) || null == d) return !1;
				l.$updateTableTableSelection(i);
				const g = Fn(h, d), p = o.getCordsFromCellNode(a, g), m = o.getDOMCellFromCordsOrThrow(p.x, p.y, g);
				if (l.$setAnchorCellForSelection(m), Un(t), t.shiftKey) {
					const [e, t, r] = It(o, a, u);
					return Wn(l, e, t, r, n);
				}
				return u.selectEnd(), !0;
			}
			return !1;
		}
		function Un(e) {
			e.preventDefault(), e.stopImmediatePropagation(), e.stopPropagation();
		}
		function Xn(e, t, n) {
			const o = $createParagraphNode();
			"first" === e ? t.insertBefore(o) : t.insertAfter(o), o.append(...n || []), o.selectEnd();
		}
		function Yn(e, t, n) {
			const o = n.getParent();
			if (!o) return;
			const l = getDOMSelection(mn(e));
			if (!l) return;
			const r = getDOMSelectionPoints(l, e.getRootElement()).anchorNode, s = e.getElementByKey(o.getKey()), i = pn(n, e.getElementByKey(n.getKey()));
			if (!r || !s || !i || !s.contains(r) || i.contains(r)) return;
			const c = $findMatchingParent$1(t.anchor.getNode(), (e) => ct(e));
			if (!c) return;
			const a = $findMatchingParent$1(c, (e) => uo(e));
			if (!uo(a) || !a.is(n)) return;
			const [u, h] = It(n, c, c), d = u[0][0], g = u[u.length - 1][u[0].length - 1], { startRow: p, startColumn: m } = h, C = p === d.startRow && m === d.startColumn, _ = p === g.startRow && m === g.startColumn;
			return C ? "first" : _ ? "last" : void 0;
		}
		function qn(e, t) {
			const { tableNode: n } = e.$lookup(), o = n.getCordsFromCellNode(t, e.table);
			return n.getDOMCellFromCordsOrThrow(o.x, o.y, e.table);
		}
		function Jn(e, t, n) {
			return Cn(e, $getNearestNodeFromDOMNode(t, n));
		}
		function jn(e) {
			return isHTMLElement$1(e) && "DIV" === e.nodeName;
		}
		function Vn(e, n, o) {
			let l = e.querySelector(":scope > colgroup");
			if (!o) return void (l && l.remove());
			l || (l = $getDocument().createElement("colgroup"), setDOMUnmanaged(l), e.insertBefore(l, e.firstChild));
			const r = [];
			for (let e = 0; e < n; e++) {
				const n = $getDocument().createElement("col"), l = o[e];
				l && (n.style.width = `${l}px`), r.push(n);
			}
			l.replaceChildren(...r);
		}
		function Gn(e, t, o) {
			if (!t.theme.tableAlignment) return;
			const l = [], r = [];
			for (const e of ["center", "right"]) {
				const n = t.theme.tableAlignment[e];
				n && (e === o ? r : l).push(n);
			}
			removeClassNamesFromElement$1(e, ...l), addClassNamesToElement$1(e, ...r);
		}
		const Qn = /* @__PURE__ */ new WeakSet();
		function Zn(e) {
			const { scrollable: t, scrollbar: n, tableElement: o } = e;
			if (0 === n.classList.length && 0 === function(e) {
				const t = e.style.display;
				e.style.display = "";
				const n = e.offsetHeight - e.clientHeight;
				return e.style.display = t, n;
			}(n)) return Qn.add(n), n.style.display = "none", t.style.scrollbarWidth = "auto", () => {};
			const l = () => {
				n.scrollLeft !== t.scrollLeft && (n.scrollLeft = t.scrollLeft);
			}, r = () => {
				t.scrollLeft !== n.scrollLeft && (t.scrollLeft = n.scrollLeft);
			};
			t.addEventListener("scroll", l, { passive: !0 }), n.addEventListener("scroll", r, { passive: !0 });
			let s = null;
			"undefined" != typeof ResizeObserver && (s = new ResizeObserver(() => {
				eo(t, n);
			}), s.observe(t), s.observe(o));
			return eo(t, n), () => {
				t.removeEventListener("scroll", l), n.removeEventListener("scroll", r), s && s.disconnect();
			};
		}
		function eo(e, t) {
			if (Qn.has(t)) return;
			const n = t.firstElementChild;
			if (!n || !isHTMLElement$1(n) || !e.isConnected) return;
			const l = e.ownerDocument.defaultView;
			if (!l) return void (t.style.display = "none");
			const r = l.getComputedStyle(e).overflowX, s = "auto" === r || "scroll" === r, i = e.scrollWidth, c = e.clientWidth, a = i + "px";
			n.style.width !== a && (n.style.width = a);
			const u = s && i > c;
			t.style.display = u ? "" : "none";
		}
		function to(e) {
			if (!e.hasAttribute("data-lexical-sticky-scrollbar")) return null;
			const t = e.firstElementChild;
			if (!jn(t)) return null;
			const n = t.querySelector(":scope > table");
			if (!gn(n)) return null;
			const o = t.nextElementSibling;
			return jn(o) ? {
				scrollable: t,
				scrollbar: o,
				tableElement: n
			} : null;
		}
		const no = /* @__PURE__ */ new WeakSet();
		function oo(e = $getEditor()) {
			return no.has(e);
		}
		function lo(e = $getEditor()) {
			const t = getPeerDependencyFromEditor(e, "@lexical/table/Table");
			return !!t && t.output.hasStickyScrollbar.peek() && t.output.hasHorizontalScroll.peek();
		}
		function ro(e, t) {
			t ? no.add(e) : no.delete(e);
		}
		var so = class extends ElementNode {
			__rowStriping = !1;
			__frozenColumnCount = 0;
			__frozenRowCount = 0;
			__colWidths = void 0;
			$config() {
				return this.config("table", {
					extends: ElementNode,
					importDOM: { table: () => ({
						conversion: co,
						priority: 1
					}) }
				});
			}
			getColWidths() {
				return this.getLatest().__colWidths;
			}
			setColWidths(e) {
				const t = this.getWritable();
				return t.__colWidths = e, t;
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__colWidths = e.__colWidths, this.__rowStriping = e.__rowStriping, this.__frozenColumnCount = e.__frozenColumnCount, this.__frozenRowCount = e.__frozenRowCount;
			}
			updateFromJSON(e) {
				return super.updateFromJSON(e).setRowStriping(e.rowStriping || !1).setFrozenColumns(e.frozenColumnCount || 0).setFrozenRows(e.frozenRowCount || 0).setColWidths(e.colWidths);
			}
			exportJSON() {
				return {
					...super.exportJSON(),
					colWidths: this.getColWidths(),
					frozenColumnCount: this.__frozenColumnCount ? this.__frozenColumnCount : void 0,
					frozenRowCount: this.__frozenRowCount ? this.__frozenRowCount : void 0,
					rowStriping: this.__rowStriping ? this.__rowStriping : void 0
				};
			}
			extractWithChild(e, t, n) {
				return "html" === n;
			}
			getDOMSlot(e) {
				const t = gn(e) ? e : e.querySelector("table");
				return gn(t) || ut(229), super.getDOMSlot(e).withElement(t).withAfter(t.querySelector(":scope > colgroup"));
			}
			createDOM(e, o) {
				const l = $getDocument().createElement("table");
				this.__style && setDOMStyleFromCSS(l.style, this.__style);
				if (this.getColWidths()) {
					const e = $getDocument().createElement("colgroup");
					l.appendChild(e), setDOMUnmanaged(e);
				}
				if (addClassNamesToElement$1(l, e.theme.table), this.updateTableElement(null, l, e), oo(o)) {
					const r = lo(o), s = function(e, o, l) {
						const r = $getDocument().createElement("div"), s = o.theme.tableScrollableWrapper;
						return s ? addClassNamesToElement$1(r, s) : r.style.overflowX = "auto", l && (r.style.scrollbarWidth = "none"), r.appendChild(e), r;
					}(l, e, r);
					if (this.updateTableWrapper(null, s, l, e), r) {
						const o = function(e) {
							const o = $getDocument(), l = o.createElement("div"), r = e.theme.tableStickyScrollbar;
							r ? addClassNamesToElement$1(l, r) : (l.style.position = "sticky", l.style.bottom = "0", l.style.overflowX = "scroll", l.style.overflowY = "hidden"), l.style.display = "none", l.setAttribute("aria-hidden", "true"), l.tabIndex = -1;
							const s = o.createElement("div");
							return s.style.height = "1px", s.style.width = "0px", l.appendChild(s), l;
						}(e), l = $getDocument().createElement("div");
						return l.setAttribute("data-lexical-sticky-scrollbar", "true"), l.appendChild(s), l.appendChild(o), setDOMUnmanaged(o), l;
					}
					return s;
				}
				return l;
			}
			updateTableWrapper(e, t, o, l) {
				this.__frozenColumnCount !== (e ? e.__frozenColumnCount : 0) && function(e, t, o, l) {
					l > 0 ? (addClassNamesToElement$1(e, o.theme.tableFrozenColumn), t.setAttribute("data-lexical-frozen-column", "true")) : (removeClassNamesFromElement$1(e, o.theme.tableFrozenColumn), t.removeAttribute("data-lexical-frozen-column"));
				}(t, o, l, this.__frozenColumnCount), this.__frozenRowCount !== (e ? e.__frozenRowCount : 0) && function(e, t, o, l) {
					l > 0 ? (addClassNamesToElement$1(e, o.theme.tableFrozenRow), t.setAttribute("data-lexical-frozen-row", "true")) : (removeClassNamesFromElement$1(e, o.theme.tableFrozenRow), t.removeAttribute("data-lexical-frozen-row"));
				}(t, o, l, this.__frozenRowCount);
			}
			updateTableElement(e, t, o) {
				this.__style !== (e ? e.__style : "") && setDOMStyleFromCSS(t.style, this.__style, e ? e.__style : ""), this.__rowStriping !== (!!e && e.__rowStriping) && function(e, t, o) {
					o ? (addClassNamesToElement$1(e, t.theme.tableRowStriping), e.setAttribute("data-lexical-row-striping", "true")) : (removeClassNamesFromElement$1(e, t.theme.tableRowStriping), e.removeAttribute("data-lexical-row-striping"));
				}(t, o, this.__rowStriping);
				const l = e ? e.getColumnCount() : 0, r = e ? e.__colWidths : void 0;
				this.getColumnCount() === l && this.getColWidths() === r || Vn(t, this.getColumnCount(), this.getColWidths()), Gn(t, o, this.getFormatType());
			}
			updateDOM(e, t, n) {
				const o = pn(this, t);
				if (t === o === oo()) return !0;
				if (jn(t)) {
					if (t.hasAttribute("data-lexical-sticky-scrollbar") !== lo()) return !0;
					const l = o.parentElement;
					jn(l) && this.updateTableWrapper(e, l, o, n);
				}
				return this.updateTableElement(e, o, n), !1;
			}
			scaleDOMColWidths(e, t) {
				const n = this.getColWidths();
				if (!n) return;
				Vn(pn(this, e), this.getColumnCount(), n.map((e) => e * t));
			}
			exportDOM(e) {
				const n = super.exportDOM(e), { element: l } = n;
				return {
					after: (l) => {
						if (n.after && (l = n.after(l)), !gn(l) && isHTMLElement$1(l) && (l = l.querySelector("table")), !gn(l)) return null;
						Gn(l, e._config, this.getFormatType());
						const [r] = Ut(this, null, null), s = /* @__PURE__ */ new Map();
						for (const e of r) for (const t of e) {
							const e = t.cell.getKey();
							s.has(e) || s.set(e, {
								colSpan: t.cell.getColSpan(),
								startColumn: t.startColumn
							});
						}
						const i = /* @__PURE__ */ new Set();
						for (const e of l.querySelectorAll(":scope > tr > [data-temporary-table-cell-lexical-key]")) {
							const t = e.getAttribute("data-temporary-table-cell-lexical-key");
							if (t) {
								const n = s.get(t);
								if (e.removeAttribute("data-temporary-table-cell-lexical-key"), n) {
									s.delete(t);
									for (let e = 0; e < n.colSpan; e++) i.add(e + n.startColumn);
								}
							}
						}
						const c = l.querySelector(":scope > colgroup");
						if (c) {
							const e = Array.from(l.querySelectorAll(":scope > colgroup > col")).filter((e, t) => i.has(t));
							c.replaceChildren(...e);
						}
						const a = l.querySelectorAll(":scope > tr");
						if (a.length > 0) {
							const e = $getDocument().createElement("tbody");
							for (const t of a) e.appendChild(t);
							l.append(e);
						}
						return l;
					},
					element: !gn(l) && isHTMLElement$1(l) ? l.querySelector("table") : l
				};
			}
			canBeEmpty() {
				return !1;
			}
			isShadowRoot() {
				return !0;
			}
			getCordsFromCellNode(e, t) {
				const { rows: n, domRows: o } = t;
				for (let t = 0; t < n; t++) {
					const n = o[t];
					if (null != n) for (let o = 0; o < n.length; o++) {
						const l = n[o];
						if (null == l) continue;
						const { elem: r } = l, s = Jn(this, r);
						if (null !== s && e.is(s)) return {
							x: o,
							y: t
						};
					}
				}
				throw new Error("Cell not found in table.");
			}
			getDOMCellFromCords(e, t, n) {
				const { domRows: o } = n, l = o[t];
				if (null == l) return null;
				const r = l[e < l.length ? e : l.length - 1];
				return null == r ? null : r;
			}
			getDOMCellFromCordsOrThrow(e, t, n) {
				const o = this.getDOMCellFromCords(e, t, n);
				if (!o) throw new Error("Cell not found at cords.");
				return o;
			}
			getCellNodeFromCords(e, t, n) {
				const o = this.getDOMCellFromCords(e, t, n);
				if (null == o) return null;
				const l = $getNearestNodeFromDOMNode(o.elem);
				return ct(l) ? l : null;
			}
			getCellNodeFromCordsOrThrow(e, t, n) {
				const o = this.getCellNodeFromCords(e, t, n);
				if (!o) throw new Error("Node at cords not TableCellNode.");
				return o;
			}
			getRowStriping() {
				return Boolean(this.getLatest().__rowStriping);
			}
			setRowStriping(e) {
				const t = this.getWritable();
				return t.__rowStriping = e, t;
			}
			setFrozenColumns(e) {
				const t = this.getWritable();
				return t.__frozenColumnCount = e, t;
			}
			getFrozenColumns() {
				return this.getLatest().__frozenColumnCount;
			}
			setFrozenRows(e) {
				const t = this.getWritable();
				return t.__frozenRowCount = e, t;
			}
			getFrozenRows() {
				return this.getLatest().__frozenRowCount;
			}
			canSelectBefore() {
				return !0;
			}
			canIndent() {
				return !1;
			}
			getColumnCount() {
				const e = this.getFirstChild();
				if (!gt(e)) return 0;
				let t = 0;
				return e.getChildren().forEach((e) => {
					ct(e) && (t += e.getColSpan());
				}), t;
			}
		};
		function io(e, t) {
			const n = e.getElementByKey(t.getKey());
			return null === n && ut(230), Fn(t, n);
		}
		function co(e) {
			const t = ao();
			e.hasAttribute("data-lexical-row-striping") && t.setRowStriping(!0), e.hasAttribute("data-lexical-frozen-column") && t.setFrozenColumns(1), e.hasAttribute("data-lexical-frozen-row") && t.setFrozenRows(1);
			const n = e.querySelector(":scope > colgroup");
			if (n) {
				let e = [];
				for (const t of n.querySelectorAll(":scope > col")) {
					let n = t.style.width || "";
					if (!nt.test(n) && (n = t.getAttribute("width") || "", !/^\d+$/.test(n))) {
						e = void 0;
						break;
					}
					e.push(parseFloat(n));
				}
				e && t.setColWidths(e);
			}
			return {
				after: (e) => $descendantsMatching(e, gt),
				node: t
			};
		}
		function ao() {
			return $applyNodeReplacement(new so());
		}
		function uo(e) {
			return e instanceof so;
		}
		function ho(e) {
			gt(e.getParent()) ? e.isEmpty() && e.append($createParagraphNode()) : e.remove();
		}
		function fo(e) {
			uo(e.getParent()) ? $unwrapAndFilterDescendants(e, ct) : e.remove();
		}
		function go(e) {
			$unwrapAndFilterDescendants(e, gt);
			const [t] = Ut(e, null, null), n = t.reduce((e, t) => Math.max(e, t.length), 0), o = e.getChildren();
			for (let e = 0; e < t.length; ++e) {
				const l = o[e];
				if (!l) continue;
				gt(l) || ut(254, l.constructor.name, l.getType());
				const r = t[e].reduce((e, t) => t ? 1 + e : e, 0);
				if (r !== n) for (let e = r; e < n; ++e) {
					const e = it();
					e.append($createParagraphNode()), l.append(e);
				}
			}
			const l = e.getColWidths(), r = e.getColumnCount();
			if (l && l.length !== r) {
				let t;
				if (r < l.length) t = l.slice(0, r);
				else if (l.length > 0) {
					const e = l[l.length - 1];
					t = [...l, ...Array(r - l.length).fill(e)];
				}
				e.setColWidths(t);
			}
		}
		function po(e) {
			if (e.detail < 3 || !isDOMNode(e.target)) return !1;
			const t = $getNearestNodeFromDOMNode(e.target);
			if (null === t) return !1;
			const n = $findMatchingParent$1(t, (e) => $isElementNode(e) && !e.isInline());
			if (null === n) return !1;
			return !!ct(n.getParent()) && (n.select(0), !0);
		}
		function mo() {
			const e = $getSelection();
			if (!$isRangeSelection(e)) return !1;
			const t = Dn(e.anchor.getNode());
			if (null === t) return !1;
			const n = $getRoot();
			if (!n.is(t.getParent()) || 1 !== n.getChildrenSize()) return !1;
			const [o] = Ut(t, null, null);
			if (0 === o.length || 0 === o[0].length) return !1;
			const l = o[0][0];
			if (!l || !l.cell) return !1;
			const r = o[o.length - 1], s = r[r.length - 1];
			if (!s || !s.cell) return !1;
			const i = ln(t, l.cell, s.cell);
			return $setSelection(i), !0;
		}
		function Co(e) {
			return e.registerNodeTransform(lt, (e) => {
				if (e.getColSpan() > 1 || e.getRowSpan() > 1) {
					const [, , t] = Xt(e), [n] = It(t, e, e), o = n.length, l = n[0].length;
					let r = t.getFirstChild();
					gt(r) || ut(175);
					const s = [];
					for (let e = 0; e < o; e++) {
						0 !== e && (r = r.getNextSibling(), gt(r) || ut(175));
						let t = null;
						for (let o = 0; o < l; o++) {
							const l = n[e][o], i = l.cell;
							if (l.startRow === e && l.startColumn === o) t = i, s.push(i);
							else if (i.getColSpan() > 1 || i.getRowSpan() > 1) {
								ct(i) || ut(176);
								const e = it(i.__headerState);
								null !== t ? t.insertAfter(e) : $insertFirst(r, e);
							}
						}
					}
					for (const e of s) e.setColSpan(1), e.setRowSpan(1);
				}
			});
		}
		function _o(e, t = !0) {
			const n = new cn(), o = (o, l, r) => {
				const s = pn(o, r), i = yn(o, s, e, t, n);
				n.observers.set(l, [i, s]);
			};
			return mergeRegister$1(wn(e, n), e.registerCommand(SELECTION_CHANGE_COMMAND, () => Nn(n, e), COMMAND_PRIORITY_HIGH), e.registerMutationListener(so, (t) => {
				e.read("latest", () => {
					for (const [e, l] of t) {
						const t = n.observers.get(e);
						if ("created" === l || "updated" === l) {
							const { tableNode: l, tableElement: r } = sn(e);
							void 0 === t ? o(l, e, r) : r !== t[1] && (n.removeObserver(e), o(l, e, r));
						} else "destroyed" === l && n.removeObserver(e);
					}
				});
			}, { skipInitialization: !1 }), () => {
				n.removeAllObservers();
			});
		}
		function So(e, t) {
			e.hasNodes([so]) || ut(255);
			const { hasNestedTables: n = signal(!1) } = t ?? {};
			return mergeRegister$1(e.registerCommand(at, (e) => function({ rows: e, columns: t, includeHeaders: n }, o) {
				const l = $getSelection() || $getPreviousSelection();
				if (!l || !$isRangeSelection(l)) return !1;
				if (!o && Dn(l.anchor.getNode())) return !1;
				const s = pt(Number(e), Number(t), n);
				$insertNodeToNearestRoot(s);
				const i = s.getFirstDescendant();
				return $isTextNode(i) && i.select(), !0;
			}(e, n.peek()), COMMAND_PRIORITY_EDITOR), e.registerCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, (t, o) => e === o && function(e, t) {
				const { nodes: n, selection: o } = e;
				if (!n.some((e) => uo(e) || $dfs(e).some((e) => uo(e.node)))) {
					if (nn(o)) {
						let e = "", t = !1;
						for (const o of n) {
							const n = $isElementNode(o) && !o.isInline();
							e.length > 0 && (n || t) && (e += "\n"), e += o.getTextContent(), t = n;
						}
						return o.insertRawText(e), !0;
					}
					return !1;
				}
				const l = nn(o), r = $isRangeSelection(o);
				if (!(r && null !== $findMatchingParent$1(o.anchor.getNode(), (e) => ct(e)) && null !== $findMatchingParent$1(o.focus.getNode(), (e) => ct(e)) || l)) return !1;
				if (1 === n.length && uo(n[0])) return Gt(n[0], o);
				if (r && t.peek() && !function(e) {
					if (nn(e) && !e.focus.getNode().is(e.anchor.getNode())) return !0;
					if ($isRangeSelection(e) && ct(e.anchor.getNode()) && !e.anchor.getNode().is(e.focus.getNode())) return !0;
					return !1;
				}(o)) return !1;
				return !0;
			}(t, n), COMMAND_PRIORITY_EDITOR), e.registerCommand(SELECT_ALL_COMMAND, mo, COMMAND_PRIORITY_LOW), e.registerCommand(CLICK_COMMAND, po, COMMAND_PRIORITY_EDITOR), e.registerNodeTransform(so, go), e.registerNodeTransform(ht, fo), e.registerNodeTransform(lt, ho));
		}
		const bo = {
			$accepts: gt,
			$packageRun: (e) => e.every(ct) ? [ft().splice(0, 0, e)] : [],
			name: "TableSchema"
		};
		const wo = {
			$accepts: ct,
			name: "TableRowSchema"
		};
		const yo = [
			/* @__PURE__ */ defineImportRule({
				$import: (e, t) => {
					const n = ao();
					t.hasAttribute("data-lexical-row-striping") && n.setRowStriping(!0), t.hasAttribute("data-lexical-frozen-column") && n.setFrozenColumns(1), t.hasAttribute("data-lexical-frozen-row") && n.setFrozenRows(1);
					const o = t.querySelector(":scope > colgroup");
					if (o) {
						let e = [];
						for (const t of o.querySelectorAll(":scope > col")) {
							let n = t.style.width || "";
							if (!nt.test(n) && (n = t.getAttribute("width") || "", !/^\d+$/.test(n))) {
								e = void 0;
								break;
							}
							e.push(parseFloat(n));
						}
						e && n.setColWidths(e);
					}
					return [n.splice(0, 0, $descendantsMatching(e.$importChildren(t), gt))];
				},
				match: sel.tag("table"),
				name: "@lexical/table/table"
			}),
			/* @__PURE__ */ defineImportRule({
				$import: (e, t) => [ft(nt.test(t.style.height) ? parseFloat(t.style.height) : void 0).splice(0, 0, $descendantsMatching(e.$importChildren(t), ct))],
				match: sel.tag("tr"),
				name: "@lexical/table/tr"
			}),
			/* @__PURE__ */ defineImportRule({
				$import: (e, t) => {
					const n = "TH" === t.nodeName, o = nt.test(t.style.width) ? parseFloat(t.style.width) : void 0;
					let c = ot.NO_STATUS;
					if (n) {
						const e = t.getAttribute("scope");
						if ("col" === e) c = ot.COLUMN;
						else if ("row" === e) c = ot.ROW;
						else {
							const e = t.parentElement, n = isHTMLTableRowElement(e) && (e.parentElement && "THEAD" === e.parentElement.nodeName || 0 === e.rowIndex), o = 0 === t.cellIndex;
							n && (c |= ot.ROW), o && (c |= ot.COLUMN), c === ot.NO_STATUS && (c = ot.ROW);
						}
					}
					const a = it(c, t.colSpan, o);
					a.__rowSpan = t.rowSpan;
					const u = t.style.backgroundColor;
					"" !== u && (a.__backgroundColor = u);
					const h = t.style.verticalAlign;
					(function(e) {
						return "middle" === e || "bottom" === e;
					})(h) && (a.__verticalAlign = h);
					const d = e.get(ImportTextFormat), f = d | function(e) {
						let t = 0;
						const n = e.fontWeight;
						"700" !== n && "bold" !== n || (t |= IS_BOLD), "italic" === e.fontStyle && (t |= IS_ITALIC);
						const o = (e.textDecoration || "").split(" ");
						return o.includes("underline") && (t |= IS_UNDERLINE), o.includes("line-through") && (t |= IS_STRIKETHROUGH), t;
					}(t.style), g = e.get(ImportTextStyle), p = t.style.color, m = p ? {
						...g,
						color: p
					} : g, C = [];
					f !== d && C.push(contextValue(ImportTextFormat, f)), m !== g && C.push(contextValue(ImportTextStyle, m));
					const _ = function(e) {
						const t = [];
						let n = null;
						const o = () => {
							if (null !== n) {
								const e = n.getFirstChild();
								$isLineBreakNode(e) && 1 === n.getChildrenSize() && e.remove();
							}
						};
						for (const c of e) $isInlineElementOrDecoratorNode(c) || $isTextNode(c) || $isLineBreakNode(c) ? null !== n ? n.append(c) : (n = $createParagraphNode().append(c), t.push(n)) : (o(), n = null, t.push(c));
						return o(), 0 === t.length && t.push($createParagraphNode()), t;
					}(e.$importChildren(t, { context: C })), S = n ? _ : $propagateTextAlignToBlockChildren(_, t);
					return [a.splice(0, 0, S)];
				},
				match: sel.tag("td", "th"),
				name: "@lexical/table/cell"
			})
		];
		const No = /* @__PURE__ */ defineExtension$1({
			build: (e, t, n) => namedSignals(t),
			config: /* @__PURE__ */ safeCast$1({
				hasCellBackgroundColor: !0,
				hasCellMerge: !0,
				hasHorizontalScroll: !0,
				hasNestedTables: !1,
				hasStickyScrollbar: !1,
				hasTabHandler: !0
			}),
			dependencies: [CoreImportExtension, /* @__PURE__ */ configExtension$1(DOMImportExtension, { rules: yo })],
			name: "@lexical/table/Table",
			nodes: () => [
				so,
				ht,
				lt
			],
			register(e, t, n) {
				const l = n.getOutput();
				let r = !1;
				return mergeRegister$1(effect(() => {
					const t = l.hasHorizontalScroll.value, n = l.hasStickyScrollbar.value && t, o = oo(e);
					o !== t && ro(e, t), o === t && r === n || e.update($fullReconcile), r = n;
				}), So(e, l), effect(() => _o(e, l.hasTabHandler.value)), effect(() => {
					if (l.hasStickyScrollbar.value && l.hasHorizontalScroll.value) return e.registerRootListener((t) => {
						if (t) return function(e) {
							const t = /* @__PURE__ */ new Map();
							return mergeRegister$1(() => {
								for (const { cleanup: e } of t.values()) e();
								t.clear();
							}, e.registerMutationListener(so, (n) => {
								for (const [l, r] of n) {
									const n = t.get(l);
									if ("destroyed" === r) {
										n && (n.cleanup(), t.delete(l));
										continue;
									}
									const s = e.getElementByKey(l), i = s && isHTMLElement$1(s) ? to(s) : null;
									n && i && n.parts.scrollable === i.scrollable && n.parts.scrollbar === i.scrollbar && n.parts.tableElement === i.tableElement ? eo(i.scrollable, i.scrollbar) : (n && (n.cleanup(), t.delete(l)), i && t.set(l, {
										cleanup: Zn(i),
										parts: i
									}));
								}
							}, { skipInitialization: !1 }));
						}(e);
					});
				}), effect(() => l.hasCellMerge.value ? void 0 : Co(e)), effect(() => l.hasCellBackgroundColor.value ? void 0 : e.registerNodeTransform(lt, (e) => {
					null !== e.getBackgroundColor() && e.setBackgroundColor(null);
				})));
			}
		});
		const vo = /* @__PURE__ */ defineExtension$1({
			dependencies: [No],
			name: "@lexical/table/Import"
		});
		//#endregion
		//#region node_modules/@lexical/table/dist/LexicalTable.mjs
		const mod = LexicalTable_prod_exports;
		mod.$computeTableCellRectBoundary;
		mod.$computeTableMap;
		mod.$computeTableMapSkipCellCheck;
		mod.$createTableCellNode;
		mod.$createTableNode;
		mod.$createTableNodeWithDimensions;
		mod.$createTableRowNode;
		mod.$createTableSelection;
		mod.$createTableSelectionFrom;
		mod.$deleteTableColumn;
		mod.$deleteTableColumnAtSelection;
		mod.$deleteTableColumn__EXPERIMENTAL;
		mod.$deleteTableRowAtSelection;
		mod.$deleteTableRow__EXPERIMENTAL;
		mod.$findCellNode;
		mod.$findTableNode;
		mod.$getElementForTableNode;
		mod.$getNodeTriplet;
		mod.$getTableAndElementByKey;
		mod.$getTableCellNodeFromLexicalNode;
		mod.$getTableCellNodeRect;
		mod.$getTableColumnIndexFromTableCellNode;
		mod.$getTableNodeFromLexicalNodeOrThrow;
		mod.$getTableRowIndexFromTableCellNode;
		mod.$getTableRowNodeFromTableCellNodeOrThrow;
		mod.$insertTableColumn;
		mod.$insertTableColumnAtNode;
		mod.$insertTableColumnAtSelection;
		mod.$insertTableColumn__EXPERIMENTAL;
		mod.$insertTableRow;
		mod.$insertTableRowAtNode;
		mod.$insertTableRowAtSelection;
		mod.$insertTableRow__EXPERIMENTAL;
		mod.$isScrollableTablesActive;
		mod.$isSimpleTable;
		mod.$isStickyScrollbarActive;
		const $isTableCellNode = mod.$isTableCellNode;
		const $isTableNode = mod.$isTableNode;
		const $isTableRowNode = mod.$isTableRowNode;
		mod.$isTableSelection;
		mod.$mergeCells;
		mod.$moveTableColumn;
		mod.$moveTableRow;
		mod.$removeTableRowAtIndex;
		mod.$setTableColumnIsHeader;
		mod.$setTableRowIsHeader;
		mod.$unmergeCell;
		mod.$unmergeCellNode;
		mod.INSERT_TABLE_COMMAND;
		mod.TableCellHeaderStates;
		const TableCellNode = mod.TableCellNode;
		mod.TableExtension;
		mod.TableImportExtension;
		mod.TableImportRules;
		const TableNode = mod.TableNode;
		mod.TableObserver;
		const TableRowNode = mod.TableRowNode;
		mod.TableRowSchema;
		mod.TableSchema;
		mod.applyTableHandlers;
		mod.getDOMCellFromTarget;
		mod.getTableElement;
		mod.getTableObserverFromTableElement;
		mod.registerTableCellUnmergeTransform;
		const registerTablePlugin = mod.registerTablePlugin;
		const registerTableSelectionObserver = mod.registerTableSelectionObserver;
		mod.setScrollableTablesActive;
		//#endregion
		//#region src/client/lexical-content.ts
		/** Translate Lexical's node tree to our editor-independent persistence vocabulary. */
		function $readTaskBlocks() {
			const inline = (node, href) => {
				if ($isTextNode(node)) {
					const marks = [
						"bold",
						"italic",
						"underline",
						"code",
						"strikethrough"
					].filter((mark) => node.hasFormat(mark));
					return [{
						text: node.getTextContent(),
						...marks.length ? { marks } : {},
						...href ? { href } : {}
					}];
				}
				if ($isLineBreakNode(node)) return [{ text: "\n" }];
				if ($isLinkNode(node)) return node.getChildren().flatMap((child) => inline(child, safeLink(node.getURL())));
				if ($isElementNode(node) && !$isListNode(node)) return node.getChildren().flatMap((child) => inline(child, href));
				return [];
			};
			const textBlocks = (node, indent = 0) => {
				if ($isListNode(node)) return node.getChildren().flatMap((child) => {
					if (!$isListItemNode(child)) return [];
					const children = child.getChildren().filter((child) => !$isListNode(child)).flatMap((child) => inline(child));
					return [...children.length ? [{
						type: node.getListType() === "number" ? "ordered" : "bullet",
						children,
						...indent ? { indent } : {}
					}] : [], ...child.getChildren().filter($isListNode).flatMap((child) => textBlocks(child, indent + 1))];
				});
				return [{
					type: $isHeadingNode(node) ? "heading" : $isQuoteNode(node) ? "quote" : "paragraph",
					children: inline(node),
					...$isHeadingNode(node) ? { level: Number(node.getTag().slice(1)) } : {}
				}];
			};
			return $getRoot().getChildren().flatMap((node) => {
				if (!$isTableNode(node)) return textBlocks(node);
				return [{
					type: "table",
					rows: node.getChildren().filter($isTableRowNode).map((row) => row.getChildren().filter($isTableCellNode).map((cell) => ({
						blocks: cell.getChildren().flatMap((child) => textBlocks(child)),
						...cell.hasHeader() ? { header: true } : {},
						...cell.getColSpan() > 1 ? { colSpan: cell.getColSpan() } : {},
						...cell.getRowSpan() > 1 ? { rowSpan: cell.getRowSpan() } : {}
					})))
				}];
			});
		}
		//#endregion
		//#region \0dsh-css:C:\02-codespace\DeepSeek\dsh-task-list\src\client\TaskContentEditor.module.css.mjs
		const css = ".jbJWYG_wrapper{min-width:0;color:var(--dsw-alias-label-primary);margin-top:8px}.jbJWYG_surface{border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);border-radius:12px;transition:border-color .15s}.jbJWYG_surface:focus-within,.jbJWYG_surface[data-dragging]{border-color:var(--dsw-alias-state-business-primary)}.jbJWYG_toolbar{border-bottom:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-tint,var(--dsw-alias-bg-base));border-radius:12px 12px 0 0;align-items:center;gap:6px;padding:8px 10px;display:flex}.jbJWYG_toolGroup{flex:none;align-items:center;gap:2px;display:flex}.jbJWYG_toolGroup+.jbJWYG_toolGroup{border-left:1px solid var(--dsw-alias-border-l3);padding-left:6px}.jbJWYG_toolbar .jbJWYG_toolButton,.jbJWYG_toolbar .jbJWYG_attachButton,.jbJWYG_attachments .jbJWYG_removeButton{width:30px;height:30px;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));border-radius:6px;flex:none;padding:0}.jbJWYG_toolbar .jbJWYG_toolButton[aria-pressed=true]{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}.jbJWYG_toolbar .jbJWYG_attachButton{margin-left:auto}.jbJWYG_toolbar button:focus-visible,.jbJWYG_attachments button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.jbJWYG_picker{display:none}.jbJWYG_canvas{position:relative}.jbJWYG_editor{box-sizing:border-box;overflow-wrap:anywhere;white-space:pre-wrap;outline:none;min-height:168px;max-height:320px;padding:18px 18px 22px;font-size:14px;line-height:1.8;overflow:auto}.jbJWYG_placeholder{color:var(--dsw-alias-label-tertiary);pointer-events:none;font-size:14px;line-height:1.8;position:absolute;top:18px;left:18px;right:18px}.jbJWYG_editorFooter{border-top:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:center;gap:12px;padding:8px 14px;font-size:11px;line-height:18px;display:flex}.jbJWYG_editorFooter span:first-child{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.jbJWYG_editorFooter span:last-child{font-variant-numeric:tabular-nums;flex:none}.jbJWYG_bold{font-weight:650}.jbJWYG_italic{font-style:italic}.jbJWYG_underline{text-decoration:underline}.jbJWYG_strike{text-decoration:line-through}.jbJWYG_code{background:var(--dsw-alias-interactive-bg-hover);border-radius:4px;padding:1px 4px;font-family:monospace;font-size:.92em}.jbJWYG_editor p{margin:0 0 8px}.jbJWYG_editor p:last-child{margin-bottom:0}.jbJWYG_editor :is(h1,h2,h3,h4,h5,h6){margin:16px 0 10px;font-weight:650;line-height:1.4}.jbJWYG_editor :is(h1,h2,h3,h4,h5,h6):first-child{margin-top:0}.jbJWYG_editor h1{font-size:24px}.jbJWYG_editor h2{font-size:20px}.jbJWYG_editor h3{font-size:17px}.jbJWYG_editor ul,.jbJWYG_editor ol{margin:8px 0;padding-left:24px}.jbJWYG_editor li{margin:4px 0}.jbJWYG_editor blockquote{border-left:3px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l3));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));margin:12px 0;padding:4px 12px}.jbJWYG_editor table{border-collapse:collapse;min-width:100%;margin:12px 0;font-size:13px}.jbJWYG_editor td,.jbJWYG_editor th{border:1px solid var(--dsw-alias-border-l3);vertical-align:top;min-width:48px;padding:8px 10px}.jbJWYG_editor th{background:var(--dsw-alias-interactive-bg-hover);font-weight:600}.jbJWYG_editor a{color:var(--dsw-alias-state-business-primary);text-underline-offset:3px;text-decoration:underline}.jbJWYG_attachments{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 0;padding:0;list-style:none;display:grid}.jbJWYG_attachments li{border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);border-radius:10px;align-items:center;gap:10px;min-width:0;padding:10px;display:flex}.jbJWYG_fileIcon{flex:none;justify-content:center;align-items:center;width:32px;display:flex}.jbJWYG_fileInfo{text-align:left;min-width:0;color:inherit;font:inherit;cursor:pointer;background:0 0;border:0;flex-direction:column;flex:1;gap:3px;padding:0;display:flex}.jbJWYG_fileName{text-overflow:ellipsis;white-space:nowrap;width:100%;font-size:13px;font-weight:500;overflow:hidden}.jbJWYG_fileInfo:hover .jbJWYG_fileName{color:var(--dsw-alias-state-business-primary)}.jbJWYG_fileInfo small{color:var(--dsw-alias-label-tertiary);font-size:11px}.jbJWYG_hint,.jbJWYG_error{margin:8px 0 0;font-size:11px;line-height:1.6}.jbJWYG_hint{color:var(--dsw-alias-label-tertiary)}.jbJWYG_error{color:var(--dsw-alias-label-error)}@media (width<=560px){.jbJWYG_toolbar{flex-wrap:wrap;gap:6px;padding:6px}.jbJWYG_toolbar .jbJWYG_toolButton,.jbJWYG_toolbar .jbJWYG_attachButton{width:28px;height:28px}.jbJWYG_attachments{grid-template-columns:minmax(0,1fr)}}@media (prefers-reduced-motion:reduce){.jbJWYG_surface{transition:none}}";
		const tagId = "@guowenzhang/dsh-task-list/TaskContentEditor.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var TaskContentEditor_module_css_default = {
			"attachButton": "jbJWYG_attachButton",
			"attachments": "jbJWYG_attachments",
			"bold": "jbJWYG_bold",
			"canvas": "jbJWYG_canvas",
			"code": "jbJWYG_code",
			"editor": "jbJWYG_editor",
			"editorFooter": "jbJWYG_editorFooter",
			"error": "jbJWYG_error",
			"fileIcon": "jbJWYG_fileIcon",
			"fileInfo": "jbJWYG_fileInfo",
			"fileName": "jbJWYG_fileName",
			"hint": "jbJWYG_hint",
			"italic": "jbJWYG_italic",
			"picker": "jbJWYG_picker",
			"placeholder": "jbJWYG_placeholder",
			"removeButton": "jbJWYG_removeButton",
			"strike": "jbJWYG_strike",
			"surface": "jbJWYG_surface",
			"toolButton": "jbJWYG_toolButton",
			"toolGroup": "jbJWYG_toolGroup",
			"toolbar": "jbJWYG_toolbar",
			"underline": "jbJWYG_underline",
			"wrapper": "jbJWYG_wrapper"
		};
		//#endregion
		//#region src/client/EditorIcon.tsx
		/** Formatting glyphs not provided by the host icon catalog. */
		function EditorIcon({ name }) {
			let artwork;
			switch (name) {
				case "bold":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 3h5a3.5 3.5 0 0 1 0 7H6m0 0h6a3.5 3.5 0 0 1 0 7H6V3" });
					break;
				case "italic":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 3h7M4 17h7M12.5 3l-5 14" });
					break;
				case "underline":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 3v6a5 5 0 0 0 10 0V3M4 17h12" });
					break;
				case "bullet":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 5h10M7 10h10M7 15h10" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: "3",
							cy: "5",
							r: ".7"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: "3",
							cy: "10",
							r: ".7"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: "3",
							cy: "15",
							r: ".7"
						})
					] });
					break;
				case "ordered":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 5h9M8 10h9M8 15h9M3 3v4M2 3h1M2 10c0-2 3-2 3 0 0 1-3 2-3 3h3M2 15h3l-2 2h2" }) });
					break;
				case "undo":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m7 4-4 4 4 4M3 8h8a5 5 0 0 1 0 10" });
					break;
				case "redo":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m13 4 4 4-4 4M17 8H9a5 5 0 0 0 0 10" });
					break;
				case "heading":
					artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 4v12M12 4v12M4 10h8M16 10v6M15 11l1-1" });
					break;
				default: artwork = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 4v13M16 4v13M12 4H8a4 4 0 0 0 0 8h4M11 4h7" });
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "18",
				height: "18",
				viewBox: "0 0 20 20",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.65",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: artwork
			});
		}
		//#endregion
		//#region src/client/TaskContentEditor.tsx
		const toolbarGroups = [
			[["undo", "formatUndo"], ["redo", "formatRedo"]],
			[["paragraph", "formatParagraph"], ["heading", "formatHeading"]],
			[
				["bold", "formatBold"],
				["italic", "formatItalic"],
				["underline", "formatUnderline"]
			],
			[["bullet", "formatBullet"], ["ordered", "formatOrdered"]]
		];
		function TaskContentEditor({ value, uploads, onChange, readAttachments, onBusy, onValid, disabled, t }) {
			const editor = (0, react.useRef)(null);
			const picker = (0, react.useRef)(null);
			const lexical = (0, react.useRef)(null);
			const readingRef = (0, react.useRef)(false);
			const [error, setError] = (0, react.useState)("");
			const [notice, setNotice] = (0, react.useState)("");
			const [reading, setReading] = (0, react.useState)(false);
			const [activeFormats, setActiveFormats] = (0, react.useState)([]);
			const [history, setHistory] = (0, react.useState)({
				undo: false,
				redo: false
			});
			const [empty, setEmpty] = (0, react.useState)(true);
			const [dragging, setDragging] = (0, react.useState)(false);
			const latest = (0, react.useRef)({
				value,
				uploads,
				onChange,
				onValid,
				onBusy,
				disabled,
				t
			});
			latest.current = {
				value,
				uploads,
				onChange,
				onValid,
				onBusy,
				disabled,
				t
			};
			const attachments = contentAttachments(value);
			(0, react.useEffect)(() => {
				const instance = createEditor({
					namespace: "task-list-rich-text",
					nodes: [
						HeadingNode,
						QuoteNode,
						ListNode,
						ListItemNode,
						LinkNode,
						TableNode,
						TableRowNode,
						TableCellNode
					],
					theme: { text: {
						bold: TaskContentEditor_module_css_default.bold,
						italic: TaskContentEditor_module_css_default.italic,
						underline: TaskContentEditor_module_css_default.underline,
						strikethrough: TaskContentEditor_module_css_default.strike,
						code: TaskContentEditor_module_css_default.code
					} },
					onError: (failure) => {
						setError(failure.message);
						latest.current.onValid(false);
					}
				});
				lexical.current = instance;
				instance.setRootElement(editor.current);
				const cleanups = [
					registerRichText(instance),
					registerList(instance),
					registerTablePlugin(instance),
					registerTableSelectionObserver(instance)
				];
				instance.update(() => {
					const root = $getRoot();
					root.clear();
					const parsed = new DOMParser().parseFromString(contentHtml(latest.current.value), "text/html");
					const nodes = $generateNodesFromDOM(instance, parsed);
					root.append(...nodes.length ? nodes : [$createParagraphNode()]);
					root.selectEnd();
				}, { discrete: true });
				cleanups.push(registerHistory(instance, createEmptyHistoryState(), 300, void 0, void 0, 100));
				cleanups.push(instance.registerCommand(CAN_UNDO_COMMAND, (enabled) => {
					setHistory((current) => ({
						...current,
						undo: enabled
					}));
					return false;
				}, COMMAND_PRIORITY_LOW));
				cleanups.push(instance.registerCommand(CAN_REDO_COMMAND, (enabled) => {
					setHistory((current) => ({
						...current,
						redo: enabled
					}));
					return false;
				}, COMMAND_PRIORITY_LOW));
				const readSelection = () => {
					setEmpty($getRoot().getTextContent().length === 0);
					const selection = $getSelection();
					if (!$isRangeSelection(selection)) return;
					const active = [
						"bold",
						"italic",
						"underline"
					].filter((format) => selection.hasFormat(format));
					let node = selection.anchor.getNode();
					let block = "paragraph";
					while (node.getParent()) {
						if ($isListNode(node)) {
							block = node.getListType() === "number" ? "ordered" : "bullet";
							break;
						}
						if ($isHeadingNode(node)) block = "heading";
						node = node.getParent();
					}
					setActiveFormats([...active, block]);
				};
				instance.getEditorState().read(readSelection);
				cleanups.push(instance.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
					editorState.read(readSelection);
					if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
					const current = latest.current;
					try {
						const content = validateContent({
							version: 1,
							blocks: [...editorState.read($readTaskBlocks), ...contentAttachments(current.value)]
						});
						current.onChange(content, current.uploads);
						current.onValid(true);
						setError("");
					} catch {
						setError(current.t("contentTooLong"));
						current.onValid(false);
					}
				}));
				cleanups.push(instance.registerCommand(PASTE_COMMAND, (event) => {
					if (!(event instanceof ClipboardEvent) || !event.clipboardData) return false;
					event.preventDefault();
					const html = event.clipboardData.getData("text/html");
					if (html) {
						const safe = sanitizeClipboardHtml(html);
						$insertNodes($generateNodesFromDOM(instance, safe.document));
						if (safe.omittedImages && !event.clipboardData.files.length) setNotice(latest.current.t("pasteImagesOmitted"));
					} else {
						const selection = $getSelection();
						if ($isRangeSelection(selection)) selection.insertRawText(event.clipboardData.getData("text/plain"));
					}
					if (event.clipboardData.files.length) addFiles([...event.clipboardData.files]);
					return true;
				}, COMMAND_PRIORITY_HIGH));
				instance.focus();
				return () => {
					cleanups.reverse().forEach((off) => off());
					instance.setRootElement(null);
					lexical.current = null;
				};
			}, []);
			(0, react.useEffect)(() => {
				lexical.current?.setEditable(!disabled && !reading);
			}, [disabled, reading]);
			const addFiles = async (files) => {
				if (latest.current.disabled || readingRef.current) return;
				readingRef.current = true;
				setReading(true);
				latest.current.onBusy(true);
				setError("");
				try {
					const existing = contentAttachments(latest.current.value);
					if (existing.length + files.length > 8 || files.some((file) => file.size > 10485760) || existing.reduce((sum, node) => sum + node.bytes, 0) + files.reduce((sum, file) => sum + file.size, 0) > 20971520) throw new Error(t("attachmentLimit"));
					const added = await Promise.all(files.map(async (file) => {
						const id = crypto.randomUUID();
						return {
							node: {
								type: "attachment",
								id,
								name: file.name,
								mediaType: file.type || "application/octet-stream",
								bytes: file.size
							},
							upload: {
								id,
								data: await fileUpload(file)
							}
						};
					}));
					const current = latest.current;
					const content = validateContent({
						version: 1,
						blocks: [...current.value.blocks, ...added.map((item) => item.node)]
					});
					current.onChange(content, [...current.uploads, ...added.map((item) => item.upload)]);
				} catch (failure) {
					setError(failure instanceof Error ? failure.message : String(failure));
				} finally {
					readingRef.current = false;
					setReading(false);
					latest.current.onBusy(false);
				}
			};
			const download = async (id) => {
				try {
					const node = attachments.find((node) => node.id === id);
					const upload = uploads.find((upload) => upload.id === id) ?? (await readAttachments()).find((upload) => upload.id === id);
					if (!upload) throw new Error(t("attachmentMissing"));
					const url = URL.createObjectURL(attachmentFile(node, upload.data));
					const link = document.createElement("a");
					link.href = url;
					link.download = node.name;
					link.click();
					setTimeout(() => URL.revokeObjectURL(url), 1e3);
				} catch (failure) {
					setError(failure instanceof Error ? failure.message : String(failure));
				}
			};
			const command = (name) => {
				const instance = lexical.current;
				if (!instance) return;
				instance.focus();
				if ([
					"bold",
					"italic",
					"underline"
				].includes(name)) instance.dispatchCommand(FORMAT_TEXT_COMMAND, name);
				else if (name === "bullet") instance.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, void 0);
				else if (name === "ordered") instance.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, void 0);
				else if (name === "undo") instance.dispatchCommand(UNDO_COMMAND, void 0);
				else if (name === "redo") instance.dispatchCommand(REDO_COMMAND, void 0);
				else instance.update(() => {
					const selection = $getSelection();
					if ($isRangeSelection(selection)) $setBlocksType(selection, () => name === "heading" ? $createHeadingNode("h2") : $createParagraphNode());
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: TaskContentEditor_module_css_default.wrapper,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TaskContentEditor_module_css_default.surface,
						"data-dragging": dragging || void 0,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskContentEditor_module_css_default.toolbar,
								role: "toolbar",
								"aria-label": t("formatToolbar"),
								children: [toolbarGroups.map((group, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: TaskContentEditor_module_css_default.toolGroup,
									children: group.map(([name, key]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t(key),
										side: "top",
										portal: true,
										delayMs: 250,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											className: TaskContentEditor_module_css_default.toolButton,
											"aria-label": t(key),
											...name === "undo" || name === "redo" ? {} : { "aria-pressed": activeFormats.includes(name) },
											disabled: disabled || reading || name === "undo" && !history.undo || name === "redo" && !history.redo,
											onMouseDown: (event) => event.preventDefault(),
											onClick: () => command(name),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EditorIcon, { name })
										})
									}, name))
								}, index)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("addAttachment"),
									side: "top",
									portal: true,
									delayMs: 250,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										size: "sm",
										className: TaskContentEditor_module_css_default.attachButton,
										"aria-label": t("addAttachment"),
										disabled: disabled || reading,
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPaperclipOutlineRegular, { size: 18 }),
										onClick: () => picker.current?.click()
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: picker,
								className: TaskContentEditor_module_css_default.picker,
								type: "file",
								multiple: true,
								tabIndex: -1,
								"aria-label": t("addAttachment"),
								onChange: (event) => {
									addFiles([...event.target.files ?? []]);
									event.target.value = "";
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskContentEditor_module_css_default.canvas,
								children: [empty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: TaskContentEditor_module_css_default.placeholder,
									children: t("editorPlaceholder")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									ref: editor,
									className: TaskContentEditor_module_css_default.editor,
									contentEditable: !disabled && !reading,
									suppressContentEditableWarning: true,
									role: "textbox",
									"aria-multiline": "true",
									"aria-required": "true",
									"aria-label": t("notesLabel"),
									"data-placeholder": t("notesHint"),
									onDragOver: (event) => {
										if (event.dataTransfer.types.includes("Files")) {
											event.preventDefault();
											setDragging(true);
										}
									},
									onDragLeave: () => setDragging(false),
									onDrop: (event) => {
										event.preventDefault();
										setDragging(false);
										if (event.dataTransfer.files.length) addFiles([...event.dataTransfer.files]);
										else {
											const text = event.dataTransfer.getData("text/plain");
											lexical.current?.update(() => {
												const selection = $getSelection();
												if ($isRangeSelection(selection)) selection.insertRawText(text);
											});
										}
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskContentEditor_module_css_default.editorFooter,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: reading ? t("attachmentReading") : t("editorPasteHint") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("editorCharacterCount").replace("{count}", String(contentText({
									...value,
									blocks: value.blocks.filter((block) => block.type !== "attachment")
								}).length)) })]
							})
						]
					}),
					attachments.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: TaskContentEditor_module_css_default.attachments,
						"aria-label": t("attachments"),
						children: attachments.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TaskContentEditor_module_css_default.fileIcon,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
									path: node.name,
									size: 28
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TaskContentEditor_module_css_default.fileInfo,
								title: t("downloadAttachment"),
								"aria-label": node.name,
								onClick: () => void download(node.id),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: TaskContentEditor_module_css_default.fileName,
									children: node.name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
									(0, _deepseek_ai_dsh_client_ui_primitives.fileSizeText)(node.bytes),
									" · ",
									t("downloadAttachment")
								] })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("removeAttachment"),
								side: "top",
								portal: true,
								delayMs: 250,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									className: TaskContentEditor_module_css_default.removeButton,
									disabled: disabled || reading,
									"aria-label": `${t("removeAttachment")}: ${node.name}`,
									onClick: () => {
										onChange({
											...value,
											blocks: value.blocks.filter((block) => block.type !== "attachment" || block.id !== node.id)
										}, uploads.filter((upload) => upload.id !== node.id));
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 16 })
								})
							})
						] }, node.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: TaskContentEditor_module_css_default.hint,
						children: t("attachmentLimit")
					}),
					notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: TaskContentEditor_module_css_default.hint,
						children: notice
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: TaskContentEditor_module_css_default.error,
						children: error
					})
				]
			});
		}
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
		function TaskPanel({ list, create, update, remove, readAttachments, start, probeWorktree, listInitialEntries, initializeGit, listAgents, workspaceSnapshot, subscribeWorkspaces, sessionSnapshot, subscribeSessions, t }) {
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
			const [content, setContent] = (0, react.useState)(() => textContent(""));
			const [uploads, setUploads] = (0, react.useState)([]);
			const [attachmentBusy, setAttachmentBusy] = (0, react.useState)(false);
			const [contentValid, setContentValid] = (0, react.useState)(true);
			const notes = contentText(content);
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
			const sessionState = (0, react.useSyncExternalStore)(subscribeSessions, sessionSnapshot);
			const sessionNames = new Map(sessionState.items.map((row) => [row.id, row.title]));
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
				setContent(textContent(""));
				setUploads([]);
				setAttachmentBusy(false);
				setContentValid(true);
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
				setContent(task.content?.blocks.length ? task.content : textContent(task.notes.trim() || task.title));
				setUploads([]);
				setAttachmentBusy(false);
				setContentValid(true);
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
					content,
					attachments: uploads,
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
				if (busy || attachmentBusy || !contentValid || !derivedTitle) return;
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
				if (busy || attachmentBusy || !contentValid || !derivedTitle || editing === null) return;
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
			const canSave = Boolean(derivedTitle) && !attachmentBusy && contentValid;
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
							if (event.target === event.currentTarget && !busy && !attachmentBusy) setComposerOpen(false);
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
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: TaskPanel_module_css_default.fullRow,
												children: [t("notesLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskContentEditor, {
													value: content,
													uploads,
													onChange: (content, uploads) => {
														setContent(content);
														setUploads(uploads);
													},
													readAttachments: () => editing ? readAttachments({
														id: editing.id,
														version: editing.version
													}) : Promise.resolve([]),
													disabled: busy,
													onBusy: setAttachmentBusy,
													onValid: setContentValid,
													t
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
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("sessionId"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															value: sessionId,
															disabled: busy,
															onChange: (event) => setSessionId(event.target.value),
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "",
																	children: t("noSession")
																}),
																sessionId && !sessionNames.has(sessionId) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: sessionId,
																	children: t("sessionUnavailable")
																}),
																sessionState.items.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: row.id,
																	children: row.title
																}, row.id))
															]
														})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															className: TaskPanel_module_css_default.fieldHint,
															children: t("sessionIdHint")
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
										disabled: busy || attachmentBusy,
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
			if (target === null || target.closest?.("[role=\"dialog\"]")) return false;
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
			const text = draft.trim();
			if (text === "" && !deps.hasAttachments) return { kind: "empty" };
			let title;
			try {
				if (deps.hasAttachments && !deps.captureAttachments) throw new Error("attachment capture is unavailable");
				const captured = await deps.captureAttachments?.() ?? {
					blocks: [],
					uploads: []
				};
				if (deps.hasAttachments && (captured.blocks.length === 0 || captured.uploads.length === 0)) throw new Error("attachment bytes missing");
				const content = validateContent({
					version: 1,
					blocks: [...textContent(text).blocks, ...captured.blocks]
				});
				const notes = contentText(content);
				title = deriveTaskTitle("", notes);
				await deps.create({
					title,
					notes,
					content,
					attachments: captured.uploads,
					priority: "medium",
					storyPoints: null,
					tags: [],
					workspaceId: null,
					sendImmediately: false,
					sessionId: deps.sessionId ?? null,
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
			deps.clearAttachments?.();
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
		//#region src/client/TaskCapture.tsx
		/** Full-opacity hold; the host Toast owns its fade and dismissal timer. */
		const REPORT_HOLD_MS = 3e3;
		const selectInput = (state) => state;
		function asDraft(value) {
			return typeof value === "string" ? value : "";
		}
		/**
		* Parked: the visible Save as task button is intentionally removed. Restore
		* the button in this component if requested; keep the Ctrl+S listener mounted.
		* Reads the draft through the session input projection and reports captures.
		*/
		function TaskCapture({ useInput, inputActions, sessionId, create, captureAttachments, releaseAttachment, t }) {
			const input = useInput(selectInput);
			const draft = asDraft(input?.draft);
			const [notice, setNotice] = (0, react.useState)(null);
			const sequence = (0, react.useRef)(0);
			const latest = (0, react.useRef)({
				draft,
				input,
				inputActions,
				sessionId,
				create,
				captureAttachments,
				releaseAttachment,
				t
			});
			latest.current = {
				draft,
				input,
				inputActions,
				sessionId,
				create,
				captureAttachments,
				releaseAttachment,
				t
			};
			const capturing = (0, react.useRef)(false);
			const report = (0, react.useCallback)((outcome) => {
				setNotice({
					outcome,
					seq: ++sequence.current
				});
			}, []);
			(0, react.useEffect)(() => installCaptureShortcut(document, {
				readDraft: () => latest.current.draft,
				activeElement: () => document.activeElement,
				capture: async (text) => {
					const snapshot = latest.current;
					if (capturing.current || snapshot.input?.phase && snapshot.input.phase !== "plain") return {
						kind: "failed",
						message: snapshot.t("captureBusy")
					};
					capturing.current = true;
					const ids = [...snapshot.input?.attachmentIds ?? []];
					try {
						return await captureDraft(text, {
							create: snapshot.create,
							sessionId: snapshot.sessionId,
							hasAttachments: ids.length > 0,
							...ids.length ? { captureAttachments: () => snapshot.captureAttachments(ids) } : {},
							clearDraft: () => {
								if (latest.current.inputActions === snapshot.inputActions && latest.current.input?.phase === snapshot.input?.phase && latest.current.draft === text && latest.current.input?.draftRev === snapshot.input?.draftRev) snapshot.inputActions.setDraft("");
							},
							clearAttachments: () => {
								if (latest.current.inputActions !== snapshot.inputActions || latest.current.input?.phase !== snapshot.input?.phase) return;
								for (const id of ids) {
									snapshot.inputActions.removeAttachment(id);
									snapshot.releaseAttachment(id);
								}
							}
						});
					} finally {
						capturing.current = false;
					}
				},
				report
			}), [report]);
			if (notice === null) return null;
			const { outcome, seq } = notice;
			const message = outcome.kind === "created" ? t("captureCreated").replace("{title}", outcome.title) : outcome.kind === "empty" ? t("captureEmpty") : `${t("captureFailed")}: ${outcome.message}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: message,
				...outcome.kind === "created" ? { tone: "success" } : {},
				holdMs: REPORT_HOLD_MS,
				onDone: () => setNotice((current) => current?.seq === seq ? null : current)
			}, seq);
		}
		//#endregion
		//#region src/client/task-persistence.ts
		/** Do not write with a new browser payload against a stale Host that silently ignores it. */
		async function persistRichTask(content, capabilities, write, readAttachments, unavailableMessage) {
			if (!content) return write();
			let support;
			try {
				support = await capabilities();
			} catch {
				throw new Error(unavailableMessage);
			}
			if (support?.version !== 1 || support.richText !== true || support.attachments !== true) throw new Error(unavailableMessage);
			const saved = await write();
			if (JSON.stringify(saved.content) !== JSON.stringify(content)) throw new Error(unavailableMessage);
			const expected = contentAttachments(content);
			if (expected.length) {
				const uploads = await readAttachments(saved);
				if (uploads.length !== expected.length || expected.some((node) => !uploads.some((upload) => upload.id === node.id))) throw new Error(unavailableMessage);
			}
			return saved;
		}
		//#endregion
		//#region src/client/index.tsx
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
				en: en$4
			}), "task-list: dictionaries");
			const t = ctx.locale.bind(NS);
			const remote = () => {
				const service = ctx.get(`remote.${REMOTE_NAMESPACE}`);
				if (!service) throw new Error("taskList namespace is not mounted");
				return service;
			};
			const conversation = () => ctx.conversation;
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
						value: { items: ids.map((id) => ({
							id,
							title: byId[id]?.displayTitle?.trim() || t("sessionUntitled")
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
				readAttachments: (request) => unwrap(remote().readTaskAttachments(request)),
				create: (request) => persistRichTask(request.content, () => unwrap(remote().capabilities({})), () => unwrap(remote().createTask(request)), (task) => unwrap(remote().readTaskAttachments({
					id: task.id,
					version: task.version
				})), t("storageUpgradeRequired")),
				update: (request) => persistRichTask(request.content, () => unwrap(remote().capabilities({})), () => unwrap(remote().updateTask(request)), (task) => unwrap(remote().readTaskAttachments({
					id: task.id,
					version: task.version
				})), t("storageUpgradeRequired")),
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
					const document = task.content?.blocks.length ? task.content : textContent(task.notes.trim() || task.title.trim());
					const nodes = contentAttachments(document);
					const uploads = nodes.length ? await unwrap(remote().readTaskAttachments({
						id: task.id,
						version: task.version
					})) : [];
					const files = nodes.map((node) => {
						const upload = uploads.find((upload) => upload.id === node.id);
						if (!upload) throw new Error(t("attachmentMissing"));
						return attachmentFile(node, upload.data);
					});
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
						const content = contentMarkdown(document).trim() || (files.length ? "" : task.title.trim());
						const input = ctx.conversation.input.for(scope);
						const drafts = files.length ? conversation().createDrafts(sessionId, files) : [];
						try {
							if (drafts.length && !input.addAttachments(drafts.map((draft) => draft.id))) throw new Error(t("captureBusy"));
							input.setDraft(content);
							await unwrap(remote().updateTask({
								id: task.id,
								version: task.version,
								status: "in_progress",
								sessionId
							}));
						} catch (error) {
							for (const draft of drafts) input.removeAttachment(draft.id);
							if (drafts.length) conversation().releaseDraftAttachments(drafts);
							throw error;
						}
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
				inject: (sessionId) => ({
					sessionId,
					create: (request) => face.create(request),
					captureAttachments: async (ids) => {
						const drafts = conversation().resolveDraftAttachments(ids);
						if (drafts.length !== ids.length) throw new Error(t("attachmentMissing"));
						if (drafts.length > 8 || drafts.some((draft) => draft.file.size > 10485760) || drafts.reduce((sum, draft) => sum + draft.file.size, 0) > 20971520) throw new Error(t("attachmentLimit"));
						const items = await Promise.all(drafts.map(async (draft) => {
							const id = crypto.randomUUID();
							return {
								node: {
									type: "attachment",
									id,
									name: draft.file.name,
									mediaType: draft.file.type || "application/octet-stream",
									bytes: draft.file.size
								},
								upload: {
									id,
									data: await fileUpload(draft.file)
								}
							};
						}));
						return {
							blocks: items.map((item) => item.node),
							uploads: items.map((item) => item.upload)
						};
					},
					releaseAttachment: (id) => conversation().releaseDraftAttachment(id)
				})
			}, TaskCapture));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
