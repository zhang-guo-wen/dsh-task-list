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
				"deleteTask"
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
			titleLabel: "任务标题",
			notesLabel: "描述",
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
			startedAt: "开始时间",
			completedAt: "完成时间",
			sendImmediately: "立即发送",
			sessionId: "会话 ID",
			sessionIdHint: "启动后自动绑定",
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
			start: "启动",
			finish: "完成",
			startRequiresWorkspace: "请先为任务选择工作区",
			startWorkspaceMissing: "关联的工作区已不存在",
			edit: "编辑",
			remove: "删除",
			removeConfirm: "确定删除这项任务？",
			refresh: "刷新",
			loading: "加载中…",
			error: "操作失败",
			retry: "重试"
		};
		const en = {
			nav: "Tasks",
			title: "Task list",
			subtitle: "Keep work in one place and track its progress.",
			add: "New task",
			titleLabel: "Task title",
			notesLabel: "Description",
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
			startedAt: "Started",
			completedAt: "Completed",
			sendImmediately: "Send immediately",
			sessionId: "Session ID",
			sessionIdHint: "Bound automatically on start",
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
			start: "Start",
			finish: "Complete",
			startRequiresWorkspace: "Choose a workspace for this task first",
			startWorkspaceMissing: "The linked workspace is no longer available",
			edit: "Edit",
			remove: "Delete",
			removeConfirm: "Delete this task?",
			refresh: "Refresh",
			loading: "Loading…",
			error: "Action failed",
			retry: "Retry"
		};
		//#endregion
		//#region \0dsh-css:C:\02-codespace\DeepSeek\dsh-task-list\src\client\TaskPanel.module.css.mjs
		const css = ".yCgN3W_page{scrollbar-gutter:stable;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-bg-base,#fff);font-family:var(--dsw-font-family,system-ui, sans-serif);font-size:14px;line-height:1.6;overflow:auto}.yCgN3W_inner{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}.yCgN3W_header{justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px;padding-top:28px;display:flex}.yCgN3W_header h1{flex:1;min-width:0;margin:0;font-size:20px;font-weight:500;line-height:28px}.yCgN3W_primary,.yCgN3W_filter,.yCgN3W_selected,.yCgN3W_textButton,.yCgN3W_cardFooter button,.yCgN3W_dialogActions button{font:inherit;cursor:pointer}.yCgN3W_primary{background:var(--dsw-alias-label-primary,#0f1115);height:32px;color:var(--dsw-alias-bg-base,#fff);white-space:nowrap;border:0;border-radius:16px;padding:0 12px;font-size:13px;line-height:20px}.yCgN3W_primary:hover{opacity:.86}.yCgN3W_toolbar{flex-direction:column;align-items:stretch;gap:14px;display:flex}.yCgN3W_filters{flex-wrap:wrap;align-items:center;gap:8px 12px;display:flex}.yCgN3W_filter,.yCgN3W_selected{height:28px;color:var(--dsw-alias-label-tertiary,#81858c);white-space:nowrap;background:0 0;border:0;border-radius:14px;align-items:center;padding:0 10px;font-size:14px;line-height:22px;display:inline-flex}.yCgN3W_filter:hover,.yCgN3W_selected{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.yCgN3W_selected{color:var(--dsw-alias-label-primary,#0f1115)}.yCgN3W_toolbarRight{align-items:center;gap:8px;display:flex}.yCgN3W_toolbar select,.yCgN3W_dialog select{font:inherit;border:1px solid var(--dsw-alias-border-l3,#ddd);height:36px;color:inherit;background:var(--dsw-alias-bg-base,#fff);border-radius:12px;padding:0 10px}.yCgN3W_toolbar select{flex:1;min-width:0}.yCgN3W_toolbar select:hover,.yCgN3W_dialog select:hover{border-color:var(--dsw-alias-border-l2,#b8bbc0)}.yCgN3W_toolbar select:focus-visible,.yCgN3W_dialog select:focus-visible{outline-color:var(--dsw-alias-state-business-primary,#326dca)}.yCgN3W_textButton,.yCgN3W_dialogActions button{border:1px solid var(--dsw-alias-border-l3,#ddd);color:inherit;background:0 0}.yCgN3W_textButton{border-radius:12px;height:36px;padding:0 12px;font-size:13px}.yCgN3W_textButton:hover,.yCgN3W_dialogActions button:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.yCgN3W_grid{grid-template-columns:repeat(auto-fill,minmax(280px,320px));gap:18px;margin:18px 0 0;padding:0;list-style:none;display:grid}.yCgN3W_card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#ddd);border-top:3px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-base,#fff);border-radius:12px;flex-direction:column;gap:12px;min-width:0;min-height:250px;padding:18px 18px 16px;transition:border-color .18s,box-shadow .18s,transform .18s;display:flex;position:relative;box-shadow:0 3px 12px #0000000a}.yCgN3W_card:hover,.yCgN3W_card:focus-within{transform:translateY(-2px);box-shadow:0 10px 26px #00000015}.yCgN3W_card[data-priority=low]{border-top-color:#8293a4}.yCgN3W_card[data-priority=medium]{border-top-color:#4b87bd}.yCgN3W_card[data-priority=high]{border-top-color:#dd9230}.yCgN3W_card[data-priority=urgent]{border-top-color:#d64e4e}.yCgN3W_cardOpen{border-radius:inherit;cursor:pointer;background:0 0;border:0;width:100%;position:absolute;inset:0}.yCgN3W_cardOpen:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#326dca);outline-offset:2px}.yCgN3W_delete{z-index:1;width:28px;height:28px;color:var(--dsw-alias-label-tertiary,#81858c);font:inherit;cursor:pointer;opacity:0;pointer-events:none;background:0 0;border:0;border-radius:6px;padding:0;font-size:20px;line-height:1;position:absolute;top:8px;right:8px}.yCgN3W_card:hover .yCgN3W_delete,.yCgN3W_card:focus-within .yCgN3W_delete{opacity:1;pointer-events:auto}.yCgN3W_delete:hover,.yCgN3W_delete:focus-visible{color:#b74242;background:#f8dede}.yCgN3W_card h2{text-overflow:ellipsis;white-space:nowrap;margin:0;padding-right:24px;font-size:15px;font-weight:500;line-height:23px;overflow:hidden}.yCgN3W_completed{opacity:.72}.yCgN3W_notes{min-height:7.5em;color:var(--dsw-alias-label-tertiary,#81858c);white-space:pre-wrap;overflow-wrap:anywhere;-webkit-line-clamp:5;-webkit-box-orient:vertical;margin:0;font-size:13px;line-height:1.5;display:-webkit-box;overflow:hidden}.yCgN3W_cardFooter{border-top:1px solid var(--dsw-alias-border-l3,#ddd);justify-content:space-between;align-items:center;gap:10px;margin-top:auto;padding-top:12px;display:flex}.yCgN3W_workspaceMeta{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary,#81858c);font-size:12px;overflow:hidden}.yCgN3W_cardFooter .yCgN3W_start{z-index:1;background:var(--dsw-alias-label-primary,#0f1115);min-height:30px;color:var(--dsw-alias-bg-base,#fff);white-space:nowrap;border:0;border-radius:15px;flex:none;padding:5px 14px;font-size:13px;position:relative}.yCgN3W_cardFooter .yCgN3W_start:hover{opacity:.86}.yCgN3W_doneState{background:var(--dsw-alias-interactive-bg-hover,#2631480f);color:var(--dsw-alias-label-tertiary,#81858c);border-radius:14px;flex:none;padding:4px 10px;font-size:12px}.yCgN3W_placeholder{color:var(--dsw-alias-label-tertiary,#81858c);padding:28px 4px}.yCgN3W_empty{color:var(--dsw-alias-label-tertiary,#81858c);flex-direction:column;align-items:center;gap:8px;padding:48px 20px;display:flex}.yCgN3W_empty strong{color:var(--dsw-alias-label-primary,#0f1115)}.yCgN3W_error{color:#a32929;background:#fff0f0;border-radius:8px;margin-top:16px;padding:12px}.yCgN3W_error button{cursor:pointer;color:inherit;background:0 0;border:0;text-decoration:underline}.yCgN3W_backdrop{z-index:1000;background:#0008;place-items:center;padding:20px;display:grid;position:fixed;inset:0}.yCgN3W_dialog{box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);width:min(100%,560px);max-height:90vh;color:var(--dsw-alias-label-primary,#0f1115);border-radius:12px;padding:20px 24px;overflow:auto;box-shadow:0 18px 54px #0003}.yCgN3W_dialog h2{margin:0 0 16px;font-size:20px}.yCgN3W_dialog form{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px;display:grid}.yCgN3W_dialog label{flex-direction:column;gap:8px;min-width:0;display:flex}.yCgN3W_full{grid-column:1/-1}.yCgN3W_dialog input,.yCgN3W_dialog textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#ddd);width:100%;color:inherit;font:inherit;background:0 0;border-radius:8px;padding:10px}.yCgN3W_dialog select{width:100%}.yCgN3W_dialog .yCgN3W_toggle{cursor:pointer;flex-direction:row;align-items:center;gap:8px;display:flex}.yCgN3W_dialog .yCgN3W_toggle input{width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary,#326dca);margin:0;padding:0}.yCgN3W_worktreeHint{color:var(--dsw-alias-label-tertiary,#81858c);grid-column:1/-1;margin:-4px 0 0;font-size:12px}.yCgN3W_worktreeError{color:#a32929}.yCgN3W_initPath{overflow-wrap:anywhere;background:var(--dsw-alias-interactive-bg-hover,#2631480f);border-radius:8px;padding:8px 10px;font-size:12px}.yCgN3W_initToolbar{align-items:center;gap:8px;margin-top:16px;font-size:13px;display:flex}.yCgN3W_initToolbar strong{flex:1;font-weight:500}.yCgN3W_initToolbar button,.yCgN3W_initError button{color:var(--dsw-alias-state-business-primary,#326dca);font:inherit;cursor:pointer;background:0 0;border:0}.yCgN3W_initToolbar button:disabled{opacity:.5;cursor:default}.yCgN3W_initEntries{border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:8px;max-height:240px;margin:8px 0;padding:0;list-style:none;overflow:auto}.yCgN3W_initEntries li+li{border-top:1px solid var(--dsw-alias-border-l2,#eee)}.yCgN3W_initEntries label{cursor:pointer;flex-direction:row;align-items:center;gap:8px;min-width:0;padding:8px 10px;display:flex}.yCgN3W_initEntries input{width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary,#326dca);flex:none;margin:0;padding:0}.yCgN3W_initEntries input:disabled{cursor:default}.yCgN3W_initEntryName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13px;overflow:hidden}.yCgN3W_initEntries small{color:var(--dsw-alias-label-tertiary,#81858c);white-space:nowrap;font-size:11px}.yCgN3W_initLoading,.yCgN3W_initError{color:var(--dsw-alias-label-tertiary,#81858c);margin:8px 0;font-size:12px}.yCgN3W_initError{color:var(--dsw-alias-label-error,#a32929)}.yCgN3W_initWarning{color:var(--dsw-alias-label-tertiary,#81858c);font-size:13px}.yCgN3W_readOnlyTimes{color:var(--dsw-alias-label-tertiary,#81858c);flex-direction:column;gap:6px;font-size:12px;display:flex}.yCgN3W_dialogActions{justify-content:flex-end;gap:8px;display:flex}.yCgN3W_dialogActions button{border-radius:16px;height:32px;padding:0 12px;font-size:13px}.yCgN3W_dialogActions .yCgN3W_primary{background:var(--dsw-alias-label-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff);border:0}.yCgN3W_dialogActions .yCgN3W_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#252b35);color:var(--dsw-alias-label-primary-foreground,#fff)}.yCgN3W_dialogActions .yCgN3W_primary:hover:disabled{background:var(--dsw-alias-label-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff)}button:disabled,select:disabled{opacity:.5;cursor:default}@media (hover:none){.yCgN3W_delete{opacity:1;pointer-events:auto}}@media (width<=760px){.yCgN3W_inner{padding:0 24px 48px}.yCgN3W_grid{grid-template-columns:1fr}.yCgN3W_card{width:100%;max-width:320px}}@media (prefers-reduced-motion:reduce){.yCgN3W_card{transition:none}.yCgN3W_card:hover,.yCgN3W_card:focus-within{transform:none}}@media (width<=460px){.yCgN3W_dialog form{grid-template-columns:1fr}}";
		const tagId = "@guowenzhang/dsh-task-list/TaskPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var TaskPanel_module_css_default = {
			"backdrop": "yCgN3W_backdrop",
			"card": "yCgN3W_card",
			"cardFooter": "yCgN3W_cardFooter",
			"cardOpen": "yCgN3W_cardOpen",
			"completed": "yCgN3W_completed",
			"delete": "yCgN3W_delete",
			"dialog": "yCgN3W_dialog",
			"dialogActions": "yCgN3W_dialogActions",
			"doneState": "yCgN3W_doneState",
			"empty": "yCgN3W_empty",
			"error": "yCgN3W_error",
			"filter": "yCgN3W_filter",
			"filters": "yCgN3W_filters",
			"full": "yCgN3W_full",
			"grid": "yCgN3W_grid",
			"header": "yCgN3W_header",
			"initEntries": "yCgN3W_initEntries",
			"initEntryName": "yCgN3W_initEntryName",
			"initError": "yCgN3W_initError",
			"initLoading": "yCgN3W_initLoading",
			"initPath": "yCgN3W_initPath",
			"initToolbar": "yCgN3W_initToolbar",
			"initWarning": "yCgN3W_initWarning",
			"inner": "yCgN3W_inner",
			"notes": "yCgN3W_notes",
			"page": "yCgN3W_page",
			"placeholder": "yCgN3W_placeholder",
			"primary": "yCgN3W_primary",
			"readOnlyTimes": "yCgN3W_readOnlyTimes",
			"selected": "yCgN3W_selected",
			"start": "yCgN3W_start",
			"textButton": "yCgN3W_textButton",
			"toggle": "yCgN3W_toggle",
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
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function formattedTime(timestamp) {
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(timestamp);
		}
		function TaskPanel({ list, create, update, remove, start, probeWorktree, listInitialEntries, initializeGit, listAgents, workspaceSnapshot, subscribeWorkspaces, t }) {
			const [tasks, setTasks] = (0, react.useState)([]);
			const [filter, setFilter] = (0, react.useState)("all");
			const [workspaceFilter, setWorkspaceFilter] = (0, react.useState)("all");
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [editing, setEditing] = (0, react.useState)(null);
			const [composerOpen, setComposerOpen] = (0, react.useState)(false);
			const [title, setTitle] = (0, react.useState)("");
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
			const workspaces = (0, react.useSyncExternalStore)(subscribeWorkspaces, workspaceSnapshot).items;
			const workspaceNames = new Map(workspaces.map((row) => [row.workspaceId, row.title]));
			const refresh = (0, react.useCallback)(async () => {
				const current = ++generation.current;
				setLoading(true);
				try {
					const rows = await list({});
					if (mounted.current && generation.current === current) {
						setTasks(rows);
						setError("");
					}
				} catch (failure) {
					if (mounted.current && generation.current === current) setError(errorText(failure));
				} finally {
					if (mounted.current && generation.current === current) setLoading(false);
				}
			}, [list]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				refresh();
				return () => {
					mounted.current = false;
					generation.current++;
				};
			}, [refresh]);
			(0, react.useEffect)(() => {
				let active = true;
				listAgents().then((rows) => {
					if (active) setAgents(rows);
				}).catch((failure) => {
					if (active) setError(errorText(failure));
				});
				return () => {
					active = false;
				};
			}, [listAgents]);
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
				setTitle("");
				setNotes("");
				setStatus("todo");
				setPriority("medium");
				setStoryPoints("");
				setTagsInput("");
				setWorkspaceId("");
				setSendImmediately(false);
				setSessionId("");
				setAgent("");
				setUseWorktree(false);
				setComposerOpen(true);
			};
			const openEdit = (task) => {
				setEditing(task);
				setTitle(task.title);
				setNotes(task.notes);
				setStatus(task.status);
				setPriority(task.priority);
				setStoryPoints(task.storyPoints === null ? "" : String(task.storyPoints));
				setTagsInput(task.tags.join(", "));
				setWorkspaceId(task.workspaceId ?? "");
				setSendImmediately(task.sendImmediately);
				setSessionId(task.sessionId ?? "");
				setAgent(task.agent ?? "");
				setUseWorktree(task.useWorktree);
				setComposerOpen(true);
			};
			const save = async (event) => {
				event.preventDefault();
				if (busy || !title.trim()) return;
				setBusy(true);
				setError("");
				const fields = {
					title,
					notes,
					priority,
					storyPoints: storyPoints === "" ? null : Number(storyPoints),
					tags: tagsInput.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean),
					workspaceId: workspaceId || null,
					sendImmediately,
					sessionId: sessionId.trim() || null,
					agent: agent || null,
					useWorktree
				};
				try {
					if (editing) await update({
						id: editing.id,
						version: editing.version,
						status,
						...fields
					});
					else await create(fields);
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
			const deleteTask = async (task) => {
				if (busy || !window.confirm(t("removeConfirm"))) return;
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
			const visible = tasks.filter((task) => (filter === "all" || task.status === filter) && (workspaceFilter === "all" || workspaceFilter === "none" && task.workspaceId === null || workspaceFilter.startsWith("ws:") && task.workspaceId === workspaceFilter.slice(3))).sort((left, right) => statusKeys.indexOf(left.status) - statusKeys.indexOf(right.status) || right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
			const selectableInitialEntries = initialEntries.filter((entry) => entry.kind !== "nested_repository");
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
										onClick: () => setFilter(item),
										children: t(item === "in_progress" ? "inProgress" : item)
									}, item))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TaskPanel_module_css_default.toolbarRight,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										"aria-label": t("workspace"),
										value: workspaceFilter,
										onChange: (event) => setWorkspaceFilter(event.target.value),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "all",
												children: t("allWorkspaces")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "none",
												children: t("noWorkspace")
											}),
											[...workspaceOptions].map(([id, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: `ws:${id}`,
												children: name
											}, id))
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: TaskPanel_module_css_default.textButton,
										onClick: () => void refresh(),
										disabled: loading,
										children: t("refresh")
									})]
								})]
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
							}) : visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TaskPanel_module_css_default.empty,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("empty") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("emptyHint") })]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: TaskPanel_module_css_default.grid,
								children: visible.map((task) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									className: TaskPanel_module_css_default.card,
									"data-priority": task.priority,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.cardOpen,
											onClick: () => openEdit(task),
											disabled: busy,
											"aria-label": `${t("edit")}: ${task.title}`
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: TaskPanel_module_css_default.delete,
											onClick: () => void deleteTask(task),
											disabled: busy,
											"aria-label": `${t("remove")}: ${task.title}`,
											title: t("remove"),
											children: "×"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
											className: task.status === "done" ? TaskPanel_module_css_default.completed : "",
											title: task.title,
											children: task.title
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: TaskPanel_module_css_default.notes,
											children: task.notes
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: TaskPanel_module_css_default.cardFooter,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: TaskPanel_module_css_default.workspaceMeta,
												title: task.workspaceId ? workspaceNames.get(task.workspaceId) ?? task.workspaceId : t("noWorkspace"),
												children: task.workspaceId ? workspaceNames.get(task.workspaceId) ?? task.workspaceId : t("noWorkspace")
											}), task.status === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: TaskPanel_module_css_default.doneState,
												children: t("done")
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: TaskPanel_module_css_default.start,
												onClick: () => void (task.status === "todo" ? startTask(task) : finishTask(task)),
												disabled: busy || task.status === "todo" && (!task.workspaceId || !workspaceNames.has(task.workspaceId)),
												"aria-label": `${t(task.status === "todo" ? "start" : "finish")}: ${task.title}`,
												title: task.status === "todo" ? !task.workspaceId ? t("startRequiresWorkspace") : !workspaceNames.has(task.workspaceId) ? t("startWorkspaceMissing") : void 0 : void 0,
												children: t(task.status === "todo" ? "start" : "finish")
											})]
										})
									]
								}, task.id))
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
							className: TaskPanel_module_css_default.dialog,
							role: "dialog",
							"aria-modal": "true",
							"aria-labelledby": "task-list-dialog-title",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								id: "task-list-dialog-title",
								children: editing ? t("edit") : t("add")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
								onSubmit: (event) => void save(event),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.full,
										children: [t("titleLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											autoFocus: true,
											value: title,
											maxLength: 200,
											onChange: (event) => setTitle(event.target.value),
											required: true
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.full,
										children: [t("notesLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											value: notes,
											maxLength: 2e4,
											rows: 3,
											onChange: (event) => setNotes(event.target.value)
										})]
									}),
									editing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("status"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										value: status,
										onChange: (event) => setStatus(event.target.value),
										children: statusKeys.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: item,
											children: t(item === "in_progress" ? "inProgress" : item)
										}, item))
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("priorityLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										value: priority,
										onChange: (event) => setPriority(event.target.value),
										children: priorityKeys.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: item,
											children: t(item)
										}, item))
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("storyPoints"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										max: "1000",
										step: "1",
										value: storyPoints,
										onChange: (event) => setStoryPoints(event.target.value)
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.full,
										children: [t("tags"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											value: tagsInput,
											onChange: (event) => setTagsInput(event.target.value),
											placeholder: t("tagsHint")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.full,
										children: [t("workspace"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											value: workspaceId,
											onChange: (event) => setWorkspaceId(event.target.value),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "",
												children: t("noWorkspace")
											}), [...workspaceOptions].map(([id, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: id,
												children: name
											}, id))]
										})]
									}),
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.full,
										children: [t("sessionId"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											value: sessionId,
											maxLength: 200,
											onChange: (event) => setSessionId(event.target.value),
											placeholder: t("sessionIdHint")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.toggle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: sendImmediately,
											onChange: (event) => setSendImmediately(event.target.checked)
										}), t("sendImmediately")]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: TaskPanel_module_css_default.toggle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: useWorktree,
											onChange: (event) => setUseWorktree(event.target.checked)
										}), t("useWorktree")]
									}),
									useWorktree && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: TaskPanel_module_css_default.worktreeHint + " " + (worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? TaskPanel_module_css_default.worktreeError : ""),
										role: worktreeProbe?.workspaceId === workspaceId && worktreeProbe.error ? "alert" : void 0,
										children: !workspaceId ? t("startRequiresWorkspace") : worktreeProbe?.workspaceId !== workspaceId || worktreeProbe.checking ? t("worktreeChecking") : worktreeProbe.needsInit ? t("worktreeNeedsInit") : worktreeProbe.error || t("worktreeAvailable")
									}),
									editing && (editing.startedAt !== null || editing.completedAt !== null) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: TaskPanel_module_css_default.full + " " + TaskPanel_module_css_default.readOnlyTimes,
										children: [editing.startedAt !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("startedAt"),
											": ",
											formattedTime(editing.startedAt)
										] }), editing.completedAt !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("completedAt"),
											": ",
											formattedTime(editing.completedAt)
										] })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: TaskPanel_module_css_default.dialogActions + " " + TaskPanel_module_css_default.full,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setComposerOpen(false),
											disabled: busy,
											children: t("cancel")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "submit",
											className: TaskPanel_module_css_default.primary,
											disabled: busy || !title.trim(),
											children: t("save")
										})]
									})
								]
							})]
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
					const workspace = workspaceFor(task.workspaceId);
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
						const draft = [task.title.trim(), task.notes.trim()].filter(Boolean).join("\n\n");
						const input = ctx.conversation.input.for(scope);
						input.setDraft(draft);
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
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
