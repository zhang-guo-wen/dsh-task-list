import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
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
//#endregion
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
const subtaskNotesLimit = 2e3;
/** Current schema version; the store refuses anything newer. */
const schemaVersion = 5;
/** Newest rows first inside each status group, with a stable id tie-break. */
const taskOrder = "ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, updated_at DESC, id";
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
function subtaskNotesOf(value) {
	if (typeof value !== "string") throw new Error("subtask content must be text");
	const notes = value.trim();
	if (!notes || notes.length > subtaskNotesLimit) throw new Error(`subtask content must contain 1–${subtaskNotesLimit} characters`);
	return notes;
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
function queryOf(value) {
	if (value === void 0 || value === null) return "";
	if (typeof value !== "string") throw new Error("search query must be text");
	const query = value.trim();
	if (query.length > 200) throw new Error(`search query must contain at most 200 characters`);
	return query;
}
function pageOf(value) {
	if (value === void 0 || value === null) return 1;
	if (!Number.isSafeInteger(value) || value < 1) throw new Error("page must be a positive integer");
	return value;
}
function pageSizeOf(value) {
	if (value === void 0 || value === null) return 20;
	if (!Number.isSafeInteger(value) || value < 1 || value > 100) throw new Error(`page size must be an integer from 1 to 100`);
	return value;
}
/**
* Wrap a literal search phrase for a `LIKE … ESCAPE '\'` comparison.
* @param query - non-empty phrase already trimmed by the caller.
* @returns the phrase with SQL wildcards escaped and `%` around it.
*/
function likePattern(query) {
	return `%${query.replace(/[\\%_]/gu, (match) => `\\${match}`)}%`;
}
const select = `SELECT id, title, notes, content, status, priority, story_points AS storyPoints,
  tags, workspace_id AS workspaceId, send_immediately AS sendImmediately,
  session_id AS sessionId, agent, use_worktree AS useWorktree,
  started_at AS startedAt, completed_at AS completedAt,
  version, created_at AS createdAt, updated_at AS updatedAt FROM tasks`;
const selectSubtask = `SELECT id, task_id AS taskId, notes, status, session_id AS sessionId,
  version, created_at AS createdAt, updated_at AS updatedAt FROM subtasks`;
function storedContentOf(row) {
	const content = validateContent(JSON.parse(row.content));
	return content.blocks.length === 0 && row.notes ? textContent(row.notes) : content;
}
function taskOf(row) {
	return {
		...row,
		content: storedContentOf(row),
		tags: tagsOf(JSON.parse(row.tags)),
		sendImmediately: row.sendImmediately === 1,
		useWorktree: row.useWorktree === 1,
		subtasks: []
	};
}
function subtaskOf(row) {
	return {
		...row,
		status: statusOf(row.status)
	};
}
/** Schema objects added by version 4. */
const subtaskSchema = `CREATE TABLE subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
  session_id TEXT,
  version INTEGER NOT NULL CHECK(version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX subtasks_task_created ON subtasks(task_id, created_at);`;
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
			if (version.user_version > schemaVersion) throw new Error(`unsupported task database version: ${version.user_version}`);
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
          ${subtaskSchema}
          PRAGMA user_version = 4;
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
          ${subtaskSchema}
          PRAGMA user_version = 4;
          COMMIT;
        `);
			else if (version.user_version === 2) this.db.exec(`BEGIN;
          ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
          ALTER TABLE tasks ADD COLUMN session_id TEXT;
          ALTER TABLE tasks ADD COLUMN agent TEXT;
          ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
          ${subtaskSchema}
          PRAGMA user_version = 4;
          COMMIT;
        `);
			else if (version.user_version === 3) this.db.exec(`BEGIN;
          ${subtaskSchema}
          PRAGMA user_version = 4;
          COMMIT;
        `);
			if (version.user_version < 5) {
				this.db.exec(`BEGIN;
          ALTER TABLE tasks ADD COLUMN content TEXT NOT NULL DEFAULT '{"version":1,"blocks":[]}';
          CREATE TABLE task_attachments (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            data BLOB NOT NULL
          ) STRICT;
          CREATE INDEX task_attachments_task ON task_attachments(task_id);`);
				const rows = this.db.prepare("SELECT id, notes FROM tasks").all();
				const write = this.db.prepare("UPDATE tasks SET content = ? WHERE id = ?");
				for (const row of rows) write.run(JSON.stringify(textContent(row.notes)), row.id);
				this.db.exec(`PRAGMA user_version = ${schemaVersion}; COMMIT;`);
			}
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
	/**
	* Read one filtered, searched, ordered page of tasks.
	* @param request - optional status, literal search phrase, workspace filter, and paging.
	* @returns the page rows, the unpaged match count, and the clamped page bounds.
	*/
	list(request = {}) {
		const conditions = [];
		const parameters = [];
		if (request.status !== void 0) {
			conditions.push("status = ?");
			parameters.push(statusOf(request.status));
		}
		if (request.workspaceId !== void 0) {
			const workspaceId = workspaceIdOf(request.workspaceId);
			if (request.includeUnassigned) conditions.push("(workspace_id = ? OR workspace_id IS NULL)");
			else conditions.push("workspace_id = ?");
			parameters.push(workspaceId);
		} else if (request.includeUnassigned) conditions.push("workspace_id IS NULL");
		const query = queryOf(request.query);
		if (query) {
			conditions.push(`(title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\' OR session_id LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM subtasks sub WHERE sub.task_id = tasks.id
          AND (sub.notes LIKE ? ESCAPE '\\' OR sub.session_id LIKE ? ESCAPE '\\')))`);
			const pattern = likePattern(query);
			parameters.push(pattern, pattern, pattern, pattern, pattern);
		}
		const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
		const counted = this.db.prepare(`SELECT COUNT(*) AS total FROM tasks${where}`).get(...parameters);
		const pageSize = pageSizeOf(request.pageSize);
		const pageCount = Math.max(1, Math.ceil(counted.total / pageSize));
		const page = Math.min(pageOf(request.page), pageCount);
		const rows = this.db.prepare(`${select}${where} ${taskOrder} LIMIT ? OFFSET ?`).all(...parameters, pageSize, (page - 1) * pageSize);
		return {
			items: this.attachSubtasks(rows.map(taskOf)),
			total: counted.total,
			page,
			pageSize
		};
	}
	get(id) {
		const row = this.db.prepare(`${select} WHERE id = ?`).get(idOf(id));
		return row ? this.attachSubtasks([taskOf(row)])[0] : null;
	}
	/** Rows of one task, oldest first. */
	listSubtasks(taskId) {
		return this.db.prepare(`${selectSubtask} WHERE task_id = ? ORDER BY created_at, id`).all(idOf(taskId)).map(subtaskOf);
	}
	getSubtask(id) {
		const row = this.db.prepare(`${selectSubtask} WHERE id = ?`).get(idOf(id));
		return row ? subtaskOf(row) : null;
	}
	/** Load every row of the given tasks with one query, preserving task order. */
	attachSubtasks(tasks) {
		if (tasks.length === 0) return tasks;
		const ids = tasks.map((task) => task.id);
		const rows = this.db.prepare(`${selectSubtask} WHERE task_id IN (${ids.map(() => "?").join(", ")}) ORDER BY created_at, id`).all(...ids);
		const grouped = /* @__PURE__ */ new Map();
		for (const row of rows) {
			const list = grouped.get(row.taskId);
			if (list) list.push(subtaskOf(row));
			else grouped.set(row.taskId, [subtaskOf(row)]);
		}
		return tasks.map((task) => ({
			...task,
			subtasks: grouped.get(task.id) ?? []
		}));
	}
	create(input) {
		const id = randomUUID();
		const now = Date.now();
		const status = statusOf(input?.status ?? "todo");
		const content = validateContent(input?.content ?? textContent(notesOf(input?.notes ?? "")));
		return this.writeContent(id, content, input?.attachments ?? [], () => {
			this.db.prepare(`INSERT INTO tasks
      (id, title, notes, content, status, priority, story_points, tags, workspace_id,
       send_immediately, session_id, agent, use_worktree, started_at, completed_at, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(id, titleOf(input?.title), contentText(content), JSON.stringify(content), status, priorityOf(input?.priority ?? "medium"), storyPointsOf(input?.storyPoints ?? null), JSON.stringify(tagsOf(input?.tags ?? [])), workspaceIdOf(input?.workspaceId ?? null), booleanOf(input?.sendImmediately ?? false, "send immediately") ? 1 : 0, optionalIdOf(input?.sessionId ?? null, "session id"), optionalIdOf(input?.agent ?? null, "agent"), booleanOf(input?.useWorktree ?? false, "use worktree") ? 1 : 0, status === "in_progress" ? now : null, status === "done" ? now : null, now, now);
			return this.get(id);
		});
	}
	update(input) {
		const id = idOf(input?.id);
		const version = versionOf(input?.version);
		const current = this.db.prepare(`${select} WHERE id = ?`).get(id);
		if (!current) throw new Error("task not found");
		if (current.version !== version) throw new Error("task changed; refresh and retry");
		const title = input.title === void 0 ? current.title : titleOf(input.title);
		const content = validateContent(input.content ?? (input.notes === void 0 ? storedContentOf(current) : textContent(notesOf(input.notes))));
		const notes = contentText(content);
		const status = input.status === void 0 ? current.status : statusOf(input.status);
		const priority = input.priority === void 0 ? current.priority : priorityOf(input.priority);
		const storyPoints = input.storyPoints === void 0 ? current.storyPoints : storyPointsOf(input.storyPoints);
		const tags = input.tags === void 0 ? tagsOf(JSON.parse(current.tags)) : tagsOf(input.tags);
		const workspaceId = input.workspaceId === void 0 ? current.workspaceId : workspaceIdOf(input.workspaceId);
		const sendImmediately = input.sendImmediately === void 0 ? current.sendImmediately === 1 : booleanOf(input.sendImmediately, "send immediately");
		const sessionId = input.sessionId === void 0 ? current.sessionId : optionalIdOf(input.sessionId, "session id");
		const agent = input.agent === void 0 ? current.agent : optionalIdOf(input.agent, "agent");
		const useWorktree = input.useWorktree === void 0 ? current.useWorktree === 1 : booleanOf(input.useWorktree, "use worktree");
		const now = Date.now();
		const startedAt = status === "in_progress" && current.startedAt === null ? now : current.startedAt;
		const completedAt = status === current.status ? current.completedAt : status === "done" ? now : null;
		return this.writeContent(id, content, input.attachments ?? [], () => {
			if (this.db.prepare(`UPDATE tasks SET title = ?, notes = ?, content = ?, status = ?, priority = ?, story_points = ?,
      tags = ?, workspace_id = ?, send_immediately = ?, session_id = ?, agent = ?, use_worktree = ?,
      started_at = ?, completed_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(title, notes, JSON.stringify(content), status, priority, storyPoints, JSON.stringify(tags), workspaceId, sendImmediately ? 1 : 0, sessionId, agent, useWorktree ? 1 : 0, startedAt, completedAt, now, id, version).changes !== 1) throw new Error("task changed; refresh and retry");
			return this.get(id);
		});
	}
	/** One transaction covers the row, attachment bytes, and removal of unreferenced bytes. */
	writeContent(id, content, uploads, write) {
		if (!Array.isArray(uploads) || uploads.length > 8) throw new Error("invalid attachment uploads");
		const referenced = contentAttachments(content);
		const pending = /* @__PURE__ */ new Map();
		for (const upload of uploads) {
			const node = referenced.find((block) => block.id === upload?.id);
			if (!node || pending.has(upload.id) || typeof upload.data !== "string" || upload.data.length > Math.ceil(10485760 / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(upload.data)) throw new Error("invalid attachment upload");
			const data = Buffer.from(upload.data, "base64");
			if (data.length !== node.bytes) throw new Error("attachment size mismatch");
			pending.set(upload.id, data);
		}
		this.db.exec("BEGIN IMMEDIATE");
		try {
			for (const node of referenced) {
				const existing = this.db.prepare("SELECT task_id AS taskId, length(data) AS bytes FROM task_attachments WHERE id = ?").get(node.id);
				if (existing && (existing.taskId !== id || pending.has(node.id))) throw new Error("attachment belongs to another task or is immutable");
				if (!existing && !pending.has(node.id)) throw new Error("attachment bytes missing");
				if (existing && existing.bytes !== node.bytes) throw new Error("attachment size mismatch");
			}
			const result = write();
			for (const [attachmentId, data] of pending) this.db.prepare("INSERT INTO task_attachments (id, task_id, data) VALUES (?, ?, ?)").run(attachmentId, id, data);
			const keep = new Set(referenced.map((node) => node.id));
			const rows = this.db.prepare("SELECT id FROM task_attachments WHERE task_id = ?").all(id);
			for (const row of rows) if (!keep.has(row.id)) this.db.prepare("DELETE FROM task_attachments WHERE id = ?").run(row.id);
			this.db.exec("COMMIT");
			return result;
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}
	readAttachments(id, version) {
		const task = this.get(idOf(id));
		if (!task) throw new Error("task not found");
		if (task.version !== versionOf(version)) throw new Error("task changed; refresh and retry");
		return contentAttachments(task.content).map((node) => {
			const row = this.db.prepare("SELECT data FROM task_attachments WHERE id = ? AND task_id = ?").get(node.id, id);
			if (!row) throw new Error("attachment bytes missing");
			return {
				id: node.id,
				data: Buffer.from(row.data).toString("base64")
			};
		});
	}
	delete(id, version) {
		if (this.db.prepare("DELETE FROM tasks WHERE id = ? AND version = ?").run(idOf(id), versionOf(version)).changes !== 1) throw new Error("task missing or changed; refresh and retry");
	}
	createSubtask(input) {
		const taskId = idOf(input?.taskId);
		if (this.db.prepare("SELECT 1 FROM tasks WHERE id = ?").get(taskId) === void 0) throw new Error("task not found");
		const id = randomUUID();
		const now = Date.now();
		this.db.prepare(`INSERT INTO subtasks (id, task_id, notes, status, session_id, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)`).run(id, taskId, subtaskNotesOf(input?.notes), statusOf(input?.status ?? "todo"), optionalIdOf(input?.sessionId ?? null, "session id"), now, now);
		return this.getSubtask(id);
	}
	updateSubtask(input) {
		const id = idOf(input?.id);
		const version = versionOf(input?.version);
		const current = this.getSubtask(id);
		if (!current) throw new Error("subtask not found");
		if (current.version !== version) throw new Error("subtask changed; refresh and retry");
		const notes = input.notes === void 0 ? current.notes : subtaskNotesOf(input.notes);
		const status = input.status === void 0 ? current.status : statusOf(input.status);
		const sessionId = input.sessionId === void 0 ? current.sessionId : optionalIdOf(input.sessionId, "session id");
		if (this.db.prepare(`UPDATE subtasks SET notes = ?, status = ?, session_id = ?,
      version = version + 1, updated_at = ? WHERE id = ? AND version = ?`).run(notes, status, sessionId, Date.now(), id, version).changes !== 1) throw new Error("subtask changed; refresh and retry");
		return this.getSubtask(id);
	}
	deleteSubtask(id, version) {
		if (this.db.prepare("DELETE FROM subtasks WHERE id = ? AND version = ?").run(idOf(id), versionOf(version)).changes !== 1) throw new Error("subtask missing or changed; refresh and retry");
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
	let _capabilities_decorators;
	let _listTasks_decorators;
	let _createTask_decorators;
	let _updateTask_decorators;
	let _readTaskAttachments_decorators;
	let _deleteTask_decorators;
	let _createSubtask_decorators;
	let _updateSubtask_decorators;
	let _deleteSubtask_decorators;
	return class TaskService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_capabilities_decorators = [Remote("capabilities")];
			_listTasks_decorators = [Remote("listTasks")];
			_createTask_decorators = [Remote("createTask")];
			_updateTask_decorators = [Remote("updateTask")];
			_readTaskAttachments_decorators = [Remote("readTaskAttachments")];
			_deleteTask_decorators = [Remote("deleteTask")];
			_createSubtask_decorators = [Remote("createSubtask")];
			_updateSubtask_decorators = [Remote("updateSubtask")];
			_deleteSubtask_decorators = [Remote("deleteSubtask")];
			__esDecorate(this, null, _capabilities_decorators, {
				kind: "method",
				name: "capabilities",
				static: false,
				private: false,
				access: {
					has: (obj) => "capabilities" in obj,
					get: (obj) => obj.capabilities
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
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
			__esDecorate(this, null, _readTaskAttachments_decorators, {
				kind: "method",
				name: "readTaskAttachments",
				static: false,
				private: false,
				access: {
					has: (obj) => "readTaskAttachments" in obj,
					get: (obj) => obj.readTaskAttachments
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
			__esDecorate(this, null, _createSubtask_decorators, {
				kind: "method",
				name: "createSubtask",
				static: false,
				private: false,
				access: {
					has: (obj) => "createSubtask" in obj,
					get: (obj) => obj.createSubtask
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _updateSubtask_decorators, {
				kind: "method",
				name: "updateSubtask",
				static: false,
				private: false,
				access: {
					has: (obj) => "updateSubtask" in obj,
					get: (obj) => obj.updateSubtask
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteSubtask_decorators, {
				kind: "method",
				name: "deleteSubtask",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteSubtask" in obj,
					get: (obj) => obj.deleteSubtask
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
		async capabilities(request) {
			return {
				version: 1,
				richText: true,
				attachments: true
			};
		}
		async listTasks(request) {
			return this.store.list(request ?? {});
		}
		async createTask(request) {
			return this.store.create(request);
		}
		async updateTask(request) {
			return this.store.update(request);
		}
		async readTaskAttachments(request) {
			return this.store.readAttachments(request?.id, request?.version);
		}
		async deleteTask(request) {
			this.store.delete(request?.id, request?.version);
			return { deleted: true };
		}
		async createSubtask(request) {
			return this.store.createSubtask(request);
		}
		async updateSubtask(request) {
			return this.store.updateSubtask(request);
		}
		async deleteSubtask(request) {
			this.store.deleteSubtask(request?.id, request?.version);
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
