import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region src/store.ts
const statuses = /* @__PURE__ */ new Set([
	"todo",
	"in_progress",
	"done"
]);
const priorities = /* @__PURE__ */ new Set([
	"low",
	"medium",
	"high",
	"urgent"
]);
const titleLimit = 200;
const notesLimit = 2e4;
function titleOf(value) {
	if (typeof value !== "string") throw new Error("title must be text");
	const title = value.trim();
	if (!title || title.length > titleLimit) throw new Error(`title must contain 1–${titleLimit} characters`);
	return title;
}
function notesOf(value) {
	if (typeof value !== "string" || value.length > notesLimit) throw new Error(`notes must contain at most ${notesLimit} characters`);
	return value;
}
function statusOf(value) {
	if (!statuses.has(value)) throw new Error("invalid task status");
	return value;
}
function priorityOf(value) {
	if (!priorities.has(value)) throw new Error("invalid task priority");
	return value;
}
function storyPointsOf(value) {
	if (value === null) return null;
	if (!Number.isSafeInteger(value) || value < 0 || value > 1e3) throw new Error("story points must be an integer from 0 to 1000");
	return value;
}
function tagsOf(value) {
	if (!Array.isArray(value) || value.length > 12) throw new Error("tags must contain at most 12 labels");
	const tags = value.map((tag) => {
		if (typeof tag !== "string") throw new Error("invalid task tag");
		const normalized = tag.trim();
		if (!normalized || normalized.length > 40) throw new Error("task tags must contain 1–40 characters");
		return normalized;
	});
	if (new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length) throw new Error("duplicate task tags");
	return tags;
}
function workspaceIdOf(value) {
	if (value === null) return null;
	if (typeof value !== "string" || !value.trim() || value.length > 200 || /[\u0000-\u001f]/u.test(value)) throw new Error("invalid workspace id");
	return value;
}
function optionalIdOf(value, field) {
	if (value === null) return null;
	if (typeof value !== "string" || !value.trim() || value.length > 200 || /[\u0000-\u001f]/u.test(value)) throw new Error(`invalid ${field}`);
	return value.trim();
}
function booleanOf(value, field) {
	if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
	return value;
}
function idOf(value) {
	if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) throw new Error("invalid task id");
	return value;
}
function versionOf(value) {
	if (!Number.isSafeInteger(value) || value < 1) throw new Error("invalid task version");
	return value;
}
const select = `SELECT id, title, notes, status, priority, story_points AS storyPoints,
  tags, workspace_id AS workspaceId, send_immediately AS sendImmediately,
  session_id AS sessionId, agent, use_worktree AS useWorktree,
  started_at AS startedAt, completed_at AS completedAt,
  version, created_at AS createdAt, updated_at AS updatedAt FROM tasks`;
function taskOf(row) {
	return {
		...row,
		tags: tagsOf(JSON.parse(row.tags)),
		sendImmediately: row.sendImmediately === 1,
		useWorktree: row.useWorktree === 1
	};
}
var TaskStore = class {
	file;
	db;
	constructor(file) {
		this.file = file;
		mkdirSync(dirname(file), {
			recursive: true,
			mode: 448
		});
		this.db = new DatabaseSync(file);
		try {
			this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
			const version = this.db.prepare("PRAGMA user_version").get();
			if (version.user_version > 3) throw new Error(`unsupported task database version: ${version.user_version}`);
			if (version.user_version === 0) {
				if (this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().length) throw new Error("task database has unrecognized tables");
				this.db.exec(`BEGIN;
          CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'done')),
            priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
            story_points INTEGER CHECK(story_points IS NULL OR story_points BETWEEN 0 AND 1000),
            tags TEXT NOT NULL DEFAULT '[]',
            workspace_id TEXT,
            send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1)),
            session_id TEXT,
            agent TEXT,
            use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1)),
            started_at INTEGER,
            completed_at INTEGER,
            version INTEGER NOT NULL CHECK(version >= 1),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          ) STRICT;
          CREATE INDEX tasks_status_updated ON tasks(status, updated_at DESC);
          PRAGMA user_version = 3;
          COMMIT;
        `);
			} else if (version.user_version === 1) this.db.exec(`BEGIN;
          ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent'));
          ALTER TABLE tasks ADD COLUMN story_points INTEGER CHECK(story_points IS NULL OR story_points BETWEEN 0 AND 1000);
          ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
          ALTER TABLE tasks ADD COLUMN workspace_id TEXT;
          ALTER TABLE tasks ADD COLUMN started_at INTEGER;
          ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
          ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
          ALTER TABLE tasks ADD COLUMN session_id TEXT;
          ALTER TABLE tasks ADD COLUMN agent TEXT;
          ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
          PRAGMA user_version = 3;
          COMMIT;
        `);
			else if (version.user_version === 2) this.db.exec(`BEGIN;
          ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
          ALTER TABLE tasks ADD COLUMN session_id TEXT;
          ALTER TABLE tasks ADD COLUMN agent TEXT;
          ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
          PRAGMA user_version = 3;
          COMMIT;
        `);
		} catch (error) {
			try {
				this.db.exec("ROLLBACK");
			} catch {}
			this.db.close();
			throw error;
		}
	}
	close() {
		this.db.close();
	}
	list(status) {
		if (status !== void 0) return this.db.prepare(`${select} WHERE status = ? ORDER BY updated_at DESC, id`).all(statusOf(status)).map(taskOf);
		return this.db.prepare(`${select} ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, updated_at DESC, id`).all().map(taskOf);
	}
	get(id) {
		const row = this.db.prepare(`${select} WHERE id = ?`).get(idOf(id));
		return row ? taskOf(row) : null;
	}
	create(input) {
		const id = randomUUID();
		const now = Date.now();
		this.db.prepare(`INSERT INTO tasks
      (id, title, notes, status, priority, story_points, tags, workspace_id,
       send_immediately, session_id, agent, use_worktree, version, created_at, updated_at)
      VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(id, titleOf(input?.title), notesOf(input?.notes ?? ""), priorityOf(input?.priority ?? "medium"), storyPointsOf(input?.storyPoints ?? null), JSON.stringify(tagsOf(input?.tags ?? [])), workspaceIdOf(input?.workspaceId ?? null), booleanOf(input?.sendImmediately ?? false, "send immediately") ? 1 : 0, optionalIdOf(input?.sessionId ?? null, "session id"), optionalIdOf(input?.agent ?? null, "agent"), booleanOf(input?.useWorktree ?? false, "use worktree") ? 1 : 0, now, now);
		return this.get(id);
	}
	update(input) {
		const id = idOf(input?.id);
		const version = versionOf(input?.version);
		const current = this.get(id);
		if (!current) throw new Error("task not found");
		if (current.version !== version) throw new Error("task changed; refresh and retry");
		const title = input.title === void 0 ? current.title : titleOf(input.title);
		const notes = input.notes === void 0 ? current.notes : notesOf(input.notes);
		const status = input.status === void 0 ? current.status : statusOf(input.status);
		const priority = input.priority === void 0 ? current.priority : priorityOf(input.priority);
		const storyPoints = input.storyPoints === void 0 ? current.storyPoints : storyPointsOf(input.storyPoints);
		const tags = input.tags === void 0 ? current.tags : tagsOf(input.tags);
		const workspaceId = input.workspaceId === void 0 ? current.workspaceId : workspaceIdOf(input.workspaceId);
		const sendImmediately = input.sendImmediately === void 0 ? current.sendImmediately : booleanOf(input.sendImmediately, "send immediately");
		const sessionId = input.sessionId === void 0 ? current.sessionId : optionalIdOf(input.sessionId, "session id");
		const agent = input.agent === void 0 ? current.agent : optionalIdOf(input.agent, "agent");
		const useWorktree = input.useWorktree === void 0 ? current.useWorktree : booleanOf(input.useWorktree, "use worktree");
		const now = Date.now();
		const startedAt = status === "in_progress" && current.startedAt === null ? now : current.startedAt;
		const completedAt = status === current.status ? current.completedAt : status === "done" ? now : null;
		if (this.db.prepare(`UPDATE tasks SET title = ?, notes = ?, status = ?, priority = ?, story_points = ?,
      tags = ?, workspace_id = ?, send_immediately = ?, session_id = ?, agent = ?, use_worktree = ?,
      started_at = ?, completed_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(title, notes, status, priority, storyPoints, JSON.stringify(tags), workspaceId, sendImmediately ? 1 : 0, sessionId, agent, useWorktree ? 1 : 0, startedAt, completedAt, now, id, version).changes !== 1) throw new Error("task changed; refresh and retry");
		return this.get(id);
	}
	delete(id, version) {
		if (this.db.prepare("DELETE FROM tasks WHERE id = ? AND version = ?").run(idOf(id), versionOf(version)).changes !== 1) throw new Error("task missing or changed; refresh and retry");
	}
};
//#endregion
//#region src/task-service.ts
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
let TaskService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _listTasks_decorators;
	let _createTask_decorators;
	let _updateTask_decorators;
	let _deleteTask_decorators;
	return class TaskService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_listTasks_decorators = [Remote("listTasks")];
			_createTask_decorators = [Remote("createTask")];
			_updateTask_decorators = [Remote("updateTask")];
			_deleteTask_decorators = [Remote("deleteTask")];
			__esDecorate(this, null, _listTasks_decorators, {
				kind: "method",
				name: "listTasks",
				static: false,
				private: false,
				access: {
					has: (obj) => "listTasks" in obj,
					get: (obj) => obj.listTasks
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _createTask_decorators, {
				kind: "method",
				name: "createTask",
				static: false,
				private: false,
				access: {
					has: (obj) => "createTask" in obj,
					get: (obj) => obj.createTask
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _updateTask_decorators, {
				kind: "method",
				name: "updateTask",
				static: false,
				private: false,
				access: {
					has: (obj) => "updateTask" in obj,
					get: (obj) => obj.updateTask
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteTask_decorators, {
				kind: "method",
				name: "deleteTask",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteTask" in obj,
					get: (obj) => obj.deleteTask
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		store = __runInitializers(this, _instanceExtraInitializers);
		constructor(ctx, store) {
			super(ctx, "taskList");
			this.store = store;
		}
		async listTasks(request) {
			return this.store.list(request?.status);
		}
		async createTask(request) {
			return this.store.create(request);
		}
		async updateTask(request) {
			return this.store.update(request);
		}
		async deleteTask(request) {
			this.store.delete(request?.id, request?.version);
			return { deleted: true };
		}
	};
})();
//#endregion
//#region src/index.ts
const name = "task-list";
const inject = [];
const Config = z.object({
	file: z.string().description("Optional absolute task SQLite path"),
	dshHome: z.string().description("Harness data home override")
});
function apply(ctx, config = {}) {
	if (config.file && !isAbsolute(config.file)) throw new Error("task-list file path must be absolute");
	const store = new TaskStore(config.file ?? join(resolveDshHome(config.dshHome), "task-list", "tasks.sqlite"));
	ctx.effect(() => () => store.close(), "task-list: SQLite close");
	new TaskService(ctx, store);
}
//#endregion
export { Config, TaskStore, apply, inject, name };
