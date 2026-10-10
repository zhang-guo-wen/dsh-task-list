import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { dirname, isAbsolute, join } from "node:path";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { parseFragment } from "parse5";
//#region src/sync/errors.ts
/** Troubleshooting chapter anchors shipped with the package. */
const DOC_KEYS = [
	"credentials",
	"permissions",
	"mapping",
	"content",
	"network",
	"recovery",
	"host-upgrade"
];
/**
* Fixed problem/action/docKey table for every registered error code. The
* strings are static; no upstream text, header, body, or credential value is
* ever concatenated into an error.
*/
const SYNC_ERRORS = {
	InvalidConfig: {
		problem: "The sync configuration is invalid",
		action: "Fix the configuration fields and retry",
		docKey: "mapping",
		retryable: false
	},
	CredentialMissing: {
		problem: "A required credential is not configured",
		action: "Set the referenced environment variable and restart the Host",
		docKey: "credentials",
		retryable: false
	},
	AuthDenied: {
		problem: "The platform rejected the credentials",
		action: "Check the token or account permissions",
		docKey: "permissions",
		retryable: false
	},
	EntitlementUnavailable: {
		problem: "The platform API is not available for this account",
		action: "Enable the required platform module or entitlement",
		docKey: "permissions",
		retryable: false
	},
	ReadTimeout: {
		problem: "The platform read did not finish in time",
		action: "Retry or increase the read budget",
		docKey: "network",
		retryable: true
	},
	NetworkFailure: {
		problem: "The platform request failed on the network",
		action: "Check connectivity and retry",
		docKey: "network",
		retryable: true
	},
	RateLimited: {
		problem: "The platform rate limit was reached",
		action: "Wait for the retry window and try again",
		docKey: "network",
		retryable: true
	},
	InvalidRemoteResponse: {
		problem: "The platform returned an unreadable response",
		action: "Report the malformed payload",
		docKey: "content",
		retryable: false
	},
	IncompleteDiscovery: {
		problem: "Discovery could not finish",
		action: "Retry or narrow the filter scope",
		docKey: "recovery",
		retryable: true
	},
	RemoteUnavailable: {
		problem: "The remote item is unavailable",
		action: "Keep the local task and its link",
		docKey: "recovery",
		retryable: false
	},
	UnsupportedRepresentation: {
		problem: "The remote content format is not supported losslessly",
		action: "Choose a supported field or leave it unmapped",
		docKey: "content",
		retryable: false
	},
	FieldLimit: {
		problem: "A field exceeds the supported limit",
		action: "Shorten the value or leave the field unmapped",
		docKey: "content",
		retryable: false
	},
	MappingIncompatible: {
		problem: "The status or field mapping is incompatible",
		action: "Fix the mapping for the type",
		docKey: "mapping",
		retryable: false
	},
	WorkflowRejected: {
		problem: "The platform refused the state transition",
		action: "Check required fields or the workflow rules",
		docKey: "mapping",
		retryable: false
	},
	StorageFailure: {
		problem: "The local database could not be written",
		action: "Check the database and retry",
		docKey: "recovery",
		retryable: false
	},
	WriteOutcomeUnknown: {
		problem: "The remote write outcome is unknown",
		action: "Reconcile the intent before retrying",
		docKey: "recovery",
		retryable: true
	},
	VerificationFailed: {
		problem: "The remote write did not verify",
		action: "Reconcile the intended change",
		docKey: "recovery",
		retryable: true
	},
	LocalVersionConflict: {
		problem: "The task changed locally during sync",
		action: "Refresh and retry the sync",
		docKey: "recovery",
		retryable: true
	},
	RunInterrupted: {
		problem: "The sync run was interrupted",
		action: "Restart the run to reconcile",
		docKey: "recovery",
		retryable: true
	},
	StaleOwner: {
		problem: "Another process owns this sync run",
		action: "Let the current owner finish",
		docKey: "recovery",
		retryable: true
	},
	RunNotFound: {
		problem: "The sync run was not found",
		action: "Start a new run",
		docKey: "recovery",
		retryable: false
	},
	ResultQueryFailed: {
		problem: "The run results could not be read",
		action: "Retry the query",
		docKey: "recovery",
		retryable: true
	},
	UnexpectedFailure: {
		problem: "An unexpected sync failure occurred",
		action: "Report the problem",
		docKey: "recovery",
		retryable: false
	},
	HostRestartRequired: {
		problem: "The Host must be restarted to apply credentials",
		action: "Restart the Host and retry",
		docKey: "host-upgrade",
		retryable: false
	}
};
const SCOPES = /* @__PURE__ */ new Set([
	"config",
	"connection",
	"rule",
	"item",
	"run",
	"query"
]);
const CONTROL$11 = /[\u0000-\u001f]/u;
const IDENTIFIER_LIMIT = 200;
/** Validate an optional bounded identifier: non-blank, ≤200 chars, no control characters. */
function boundIdentifier(name, value) {
	if (!value.trim() || value.length > IDENTIFIER_LIMIT || CONTROL$11.test(value)) throw new Error(`syncError ${name} must be 1-${IDENTIFIER_LIMIT} control-free characters`);
	return value;
}
/**
* Build a safe {@link SyncErrorDto} from a registered code. Only typed,
* sanitized arguments are accepted; `cause` is always the registered template
* (never a caller string), so no arbitrary upstream message or secret value
* can reach the output.
*/
function syncError(code, options = {}) {
	const definition = SYNC_ERRORS[code];
	if (!definition) throw new Error(`unknown sync error code: ${String(code)}`);
	const scope = options.scope ?? "config";
	if (!SCOPES.has(scope)) throw new Error(`invalid sync error scope: ${String(scope)}`);
	if (options.retryable !== void 0 && typeof options.retryable !== "boolean") throw new Error("syncError retryable must be a boolean");
	if (options.causePossible !== void 0 && typeof options.causePossible !== "boolean") throw new Error("syncError causePossible must be a boolean");
	const field = options.field === void 0 ? void 0 : boundIdentifier("field", options.field);
	const runId = options.runId === void 0 ? void 0 : boundIdentifier("runId", options.runId);
	const requestId = options.requestId === void 0 ? void 0 : boundIdentifier("requestId", options.requestId);
	return {
		code,
		scope,
		problem: definition.problem,
		cause: definition.problem,
		action: definition.action,
		docKey: definition.docKey,
		retryable: options.retryable ?? definition.retryable,
		...options.causePossible ? { causePossible: true } : {},
		...field !== void 0 ? { field } : {},
		...runId !== void 0 ? { runId } : {},
		...requestId !== void 0 ? { requestId } : {}
	};
}
/** Wrap a safe error DTO under the single outer `task-list/sync` RemoteError code. */
function syncRemoteError(error) {
	return new RemoteError("task-list/sync", error.problem, error);
}
//#endregion
//#region src/sync/credential-provider.ts
function key(id) {
	if (!/^[a-z0-9-]{1,100}$/u.test(id)) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "id"
	}));
	return `task-list/connection-${id}`;
}
/** Record key of one connection's user-typed credentials; separate from the OAuth grant record. */
function secretKey(id) {
	if (!/^[a-z0-9-]{1,100}$/u.test(id)) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "id"
	}));
	return `task-list/connection-${id}-secret`;
}
function invalid$3() {
	throw syncRemoteError(syncError("StorageFailure", { scope: "connection" }));
}
function decode(record) {
	if (record === void 0 || record === null) return null;
	if (typeof record !== "object" || Array.isArray(record)) invalid$3();
	const row = record;
	if (row.kind !== "grant" || !row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) invalid$3();
	const value = row.payload;
	if (value.revoked === true && Object.keys(value).length === 1) return null;
	const allowed = [
		"platform",
		"instance",
		"connectionRevision",
		"accessToken",
		"refreshToken",
		"expiresAt",
		"clientId",
		"tokenEndpoint",
		"purpose",
		"accountLabel",
		"resourceIds",
		"scopes"
	];
	if (Object.keys(value).some((field) => !allowed.includes(field))) invalid$3();
	if (value.platform !== "yunxiao") invalid$3();
	if (value.purpose !== "yunxiao-api") invalid$3();
	for (const field of [
		"accessToken",
		"clientId",
		"tokenEndpoint"
	]) if (typeof value[field] !== "string" || !String(value[field]).trim() || String(value[field]).length > 16384) invalid$3();
	if (typeof value.instance !== "string" || value.instance.length > 16384) invalid$3();
	if (value.refreshToken !== null && (typeof value.refreshToken !== "string" || !value.refreshToken.trim())) invalid$3();
	if (!Number.isSafeInteger(value.connectionRevision) || Number(value.connectionRevision) < 1 || !Number.isSafeInteger(value.expiresAt) || Number(value.expiresAt) < 0) invalid$3();
	if (value.accountLabel !== null && (typeof value.accountLabel !== "string" || value.accountLabel.length > 200)) invalid$3();
	for (const field of ["resourceIds", "scopes"]) if (!Array.isArray(value[field]) || value[field].length > 100 || value[field].some((item) => typeof item !== "string" || item.length > 200)) invalid$3();
	return value;
}
var HostSyncCredentialStore = class {
	provider;
	constructor(provider) {
		this.provider = provider;
	}
	async read(id) {
		return decode(await this.provider.readRecord(key(id)));
	}
	async modify(id, mutate) {
		return decode(await this.provider.modifyRecord(key(id), async (current) => {
			const next = await mutate(decode(current));
			return {
				kind: "grant",
				payload: next === null ? { revoked: true } : decode({
					kind: "grant",
					payload: next
				})
			};
		}));
	}
	async remove(id) {
		await this.provider.deleteRecord(key(id));
	}
};
/** Largest accepted secret; a platform token never approaches it. */
const SECRET_LIMIT = 4096;
function decodeSecret(record) {
	if (record === void 0 || record === null) return null;
	if (typeof record !== "object" || Array.isArray(record)) invalid$3();
	const row = record;
	if (row.kind !== "grant" || !row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) invalid$3();
	const value = row.payload;
	if (value.platform === "yunxiao") {
		if (Object.keys(value).some((field) => field !== "platform" && field !== "token")) invalid$3();
		if (typeof value.token !== "string" || !value.token.trim() || value.token.length > SECRET_LIMIT) invalid$3();
		return {
			platform: "yunxiao",
			token: value.token
		};
	}
	if (value.platform === "tapd") {
		if (value.user !== void 0 || value.password !== void 0) return null;
		if (Object.keys(value).some((field) => field !== "platform" && field !== "token")) invalid$3();
		if (typeof value.token !== "string" || !value.token.trim() || value.token.length > SECRET_LIMIT) invalid$3();
		return {
			platform: "tapd",
			token: value.token
		};
	}
	invalid$3();
}
/**
* User-typed credentials live in the Host credential store, never in the task
* database: the connection row keeps only non-secret configuration, and no
* read path ever returns these values to the browser. The Host stores the
* plugin-owned payload as a grant record under a separate manual-secret key.
*/
var HostManualSecretStore = class {
	provider;
	constructor(provider) {
		this.provider = provider;
	}
	async read(id) {
		return decodeSecret(await this.provider.readRecord(secretKey(id)));
	}
	async write(id, secret) {
		await this.provider.modifyRecord(secretKey(id), async () => ({
			kind: "grant",
			payload: decodeSecret({
				kind: "grant",
				payload: secret
			})
		}));
	}
	async remove(id) {
		await this.provider.deleteRecord(secretKey(id));
	}
};
//#endregion
//#region src/sync/oauth.ts
const CLOUD = "https://openapi-rdc.aliyuncs.com";
const AUTHORIZE = "https://account-devops.aliyun.com";
const OAUTH_CALLBACK_PATH = "/task-list/oauth/callback";
const ATTEMPT_MS = 6e5;
const MAX_BODY = 2097152;
function fail$8(code = "InvalidConfig") {
	throw syncRemoteError(syncError(code, { scope: "connection" }));
}
function object$1(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) fail$8("InvalidRemoteResponse");
	return value;
}
function text$3(value, max = 16384) {
	if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) fail$8("InvalidRemoteResponse");
	return value;
}
function officialEndpoint(value, kind) {
	let url;
	try {
		url = new URL(text$3(value, 2048));
	} catch {
		fail$8();
	}
	const origin = kind === "authorize" ? AUTHORIZE : CLOUD;
	const path = `/v1/oauth2/${kind === "register" ? "register" : kind === "token" ? "token" : "authorize"}`;
	if (url.origin !== origin || url.pathname !== path || url.username || url.password || url.hash || url.search) fail$8();
	return url.href;
}
function callbackOrigin(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		fail$8();
	}
	if (url.username || url.password || url.search || url.hash || url.pathname !== "/") fail$8();
	if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) fail$8();
	return url.origin;
}
/** Owns protocol state only. Secrets live in the injected Host credential provider. */
var OAuthManager = class {
	options;
	attempts = /* @__PURE__ */ new Map();
	failures = /* @__PURE__ */ new Map();
	epochs = /* @__PURE__ */ new Map();
	running = /* @__PURE__ */ new Set();
	controllers = /* @__PURE__ */ new Set();
	preparing = /* @__PURE__ */ new Set();
	withdrawing = /* @__PURE__ */ new Set();
	disposed = false;
	callbackUrl;
	constructor(options) {
		this.options = options;
		this.callbackUrl = callbackOrigin(options.callbackBaseUrl) + OAUTH_CALLBACK_PATH;
	}
	epoch(id) {
		return this.epochs.get(id) ?? 0;
	}
	track(operation) {
		this.running.add(operation);
		operation.then(() => this.running.delete(operation), () => this.running.delete(operation));
		return operation;
	}
	live(id, epoch, signal) {
		if (this.disposed || this.withdrawing.has(id) || this.epoch(id) !== epoch || signal?.aborted) fail$8("RunInterrupted");
	}
	async request(url, init, signal, beforeRequest) {
		if (this.disposed || signal?.aborted) fail$8("RunInterrupted");
		beforeRequest?.();
		const controller = new AbortController();
		this.controllers.add(controller);
		const abort = () => controller.abort();
		signal?.addEventListener("abort", abort, { once: true });
		const timer = setTimeout(abort, 3e4);
		try {
			const response = await this.options.fetch(url, {
				...init,
				redirect: "error",
				signal: controller.signal
			});
			if (!response.ok) fail$8(response.status === 400 || response.status === 401 || response.status === 403 ? "AuthDenied" : "NetworkFailure");
			const reader = response.body?.getReader();
			if (!reader) fail$8("InvalidRemoteResponse");
			const chunks = [];
			let total = 0;
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					total += value.byteLength;
					if (total > MAX_BODY) {
						await reader.cancel();
						fail$8("InvalidRemoteResponse");
					}
					chunks.push(value);
				}
			} finally {
				reader.releaseLock();
			}
			let result;
			try {
				result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
			} catch {
				fail$8("InvalidRemoteResponse");
			}
			return object$1(result);
		} catch (error) {
			if (typeof error === "object" && error !== null && "code" in error && error.code === "task-list/sync") throw error;
			if (signal?.aborted || this.disposed) fail$8("RunInterrupted");
			return fail$8("NetworkFailure");
		} finally {
			clearTimeout(timer);
			signal?.removeEventListener("abort", abort);
			this.controllers.delete(controller);
		}
	}
	begin(connection) {
		return this.track(this.beginInner(connection));
	}
	async beginInner(connection) {
		if (this.disposed || this.withdrawing.has(connection.id) || this.preparing.has(connection.id) || this.attempts.has(connection.id)) fail$8();
		if (!/^[a-z0-9-]{1,100}$/u.test(connection.id) || !Number.isInteger(connection.revision) || connection.revision < 1) fail$8();
		const controller = new AbortController();
		this.controllers.add(controller);
		this.preparing.add(connection.id);
		const epoch = this.epoch(connection.id);
		try {
			let clientId;
			let tokenEndpoint;
			let authorizationEndpoint;
			const redirectUri = this.callbackUrl;
			const verifier = randomBytes(32).toString("base64url");
			{
				const metadata = await this.request(CLOUD + "/.well-known/oauth-authorization-server", { method: "GET" }, controller.signal);
				if (metadata.issuer !== CLOUD || !Array.isArray(metadata.code_challenge_methods_supported) || !metadata.code_challenge_methods_supported.includes("S256") || !Array.isArray(metadata.token_endpoint_auth_methods_supported) || !metadata.token_endpoint_auth_methods_supported.includes("none")) fail$8();
				authorizationEndpoint = officialEndpoint(metadata.authorization_endpoint, "authorize");
				tokenEndpoint = officialEndpoint(metadata.token_endpoint, "token");
				const registerEndpoint = officialEndpoint(metadata.registration_endpoint, "register");
				this.live(connection.id, epoch, controller.signal);
				clientId = text$3((await this.request(registerEndpoint, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						client_name: "DeepSeek Harness Task List",
						redirect_uris: [redirectUri],
						grant_types: ["authorization_code", "refresh_token"],
						response_types: ["code"],
						token_endpoint_auth_method: "none"
					})
				}, controller.signal)).client_id, 512);
			}
			this.live(connection.id, epoch, controller.signal);
			const state = randomBytes(32).toString("base64url");
			const id = randomUUID();
			const expiresAt = this.options.now() + ATTEMPT_MS;
			const timer = setTimeout(() => {
				const attempt = this.attempts.get(connection.id);
				if (attempt?.id === id) {
					this.clearAttempt(attempt);
					this.failures.set(connection.id, syncError("RunInterrupted", { scope: "connection" }));
				}
			}, ATTEMPT_MS);
			timer.unref?.();
			const attempt = {
				id,
				connection: { ...connection },
				state,
				verifier,
				clientId,
				tokenEndpoint,
				redirectUri,
				expiresAt,
				controller,
				epoch,
				consumed: false,
				timer
			};
			this.attempts.set(connection.id, attempt);
			this.failures.delete(connection.id);
			const url = new URL(authorizationEndpoint);
			url.searchParams.set("response_type", "code");
			url.searchParams.set("client_id", clientId);
			url.searchParams.set("redirect_uri", redirectUri);
			url.searchParams.set("state", state);
			url.searchParams.set("code_challenge_method", "S256");
			url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
			return {
				attemptId: id,
				authorizationUrl: url.href,
				expiresAt
			};
		} finally {
			this.preparing.delete(connection.id);
			this.controllers.delete(controller);
		}
	}
	clearAttempt(attempt) {
		clearTimeout(attempt.timer);
		attempt.controller.abort();
		if (this.attempts.get(attempt.connection.id)?.id === attempt.id) this.attempts.delete(attempt.connection.id);
	}
	acceptsCallback(url) {
		const state = url.searchParams.get("state");
		return state !== null && [...this.attempts.values()].some((attempt) => attempt.state === state);
	}
	callback(url) {
		return this.track(this.callbackInner(url));
	}
	async callbackInner(url) {
		if (url.origin !== new URL(this.callbackUrl).origin || url.pathname !== "/task-list/oauth/callback" || url.href.length > 8192) fail$8();
		for (const name of [
			"state",
			"code",
			"error",
			"resource"
		]) if (url.searchParams.getAll(name).length > 1) fail$8();
		const state = url.searchParams.get("state");
		if (!state || !/^[A-Za-z0-9_-]{43}$/u.test(state)) fail$8();
		const attempt = [...this.attempts.values()].find((item) => item.state === state);
		if (!attempt || attempt.consumed || attempt.expiresAt <= this.options.now()) {
			if (attempt) this.clearAttempt(attempt);
			fail$8();
		}
		this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal);
		attempt.consumed = true;
		try {
			if (url.searchParams.has("error")) fail$8("AuthDenied");
			const code = text$3(url.searchParams.get("code"), 4096);
			const body = new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: attempt.redirectUri
			});
			const headers = { "content-type": "application/x-www-form-urlencoded" };
			body.set("client_id", attempt.clientId);
			body.set("code_verifier", attempt.verifier);
			const result = await this.request(attempt.tokenEndpoint, {
				method: "POST",
				headers,
				body: body.toString()
			}, attempt.controller.signal);
			this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal);
			const payload = result;
			const grant = this.parseGrant(payload, attempt);
			await this.options.store.modify(attempt.connection.id, async () => {
				this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal);
				return grant;
			});
			this.live(attempt.connection.id, attempt.epoch, attempt.controller.signal);
			this.failures.delete(attempt.connection.id);
		} catch (error) {
			this.failures.set(attempt.connection.id, syncError("AuthDenied", { scope: "connection" }));
			throw error;
		} finally {
			this.clearAttempt(attempt);
		}
	}
	parseGrant(payload, attempt) {
		const accessToken = text$3(payload.access_token);
		if (typeof payload.token_type !== "string" || payload.token_type.toLowerCase() !== "bearer" || typeof payload.expires_in !== "number" || !Number.isInteger(payload.expires_in) || payload.expires_in < 1 || payload.expires_in > 7776e3) fail$8("InvalidRemoteResponse");
		return {
			platform: "yunxiao",
			instance: attempt.connection.instance,
			connectionRevision: attempt.connection.revision,
			accessToken,
			refreshToken: payload.refresh_token === void 0 ? null : text$3(payload.refresh_token),
			expiresAt: this.options.now() + payload.expires_in * 1e3,
			clientId: attempt.clientId,
			tokenEndpoint: attempt.tokenEndpoint,
			purpose: "yunxiao-api",
			accountLabel: null,
			resourceIds: [],
			scopes: typeof payload.scope === "string" ? payload.scope.split(/\s+/u).filter(Boolean) : []
		};
	}
	async state(connectionId) {
		const attempt = this.attempts.get(connectionId);
		const grant = await this.options.store.read(connectionId);
		const error = this.failures.get(connectionId) ?? null;
		const live = grant !== null && grant.expiresAt > this.options.now();
		if (live && attempt !== void 0) this.clearAttempt(attempt);
		return {
			connectionId,
			status: live ? "authorized" : attempt !== void 0 ? "waiting" : grant !== null ? "expired" : error !== null ? "failed" : "signed-out",
			attemptId: live ? null : attempt?.id ?? null,
			expiresAt: live ? grant.expiresAt : attempt?.expiresAt ?? grant?.expiresAt ?? null,
			accountLabel: grant?.accountLabel ?? null,
			resourceIds: [...new Set(grant?.resourceIds ?? [])],
			error
		};
	}
	async cancel(connectionId, attemptId) {
		const attempt = this.attempts.get(connectionId);
		if (!attempt || attempt.id !== attemptId) fail$8();
		await this.disconnect(connectionId);
	}
	async disconnect(connectionId) {
		this.withdrawing.add(connectionId);
		this.epochs.set(connectionId, this.epoch(connectionId) + 1);
		const attempt = this.attempts.get(connectionId);
		if (attempt) this.clearAttempt(attempt);
		try {
			await Promise.allSettled([...this.running]);
			await this.options.store.remove(connectionId);
			this.failures.delete(connectionId);
		} finally {
			this.withdrawing.delete(connectionId);
		}
	}
	accessToken(connectionId) {
		return this.track(this.accessTokenInner(connectionId));
	}
	async accessTokenInner(connectionId) {
		const epoch = this.epoch(connectionId);
		this.live(connectionId, epoch);
		const grant = await this.options.store.modify(connectionId, async (current) => {
			this.live(connectionId, epoch);
			if (!current) fail$8("CredentialMissing");
			if (current.expiresAt > this.options.now() + 6e4) return current;
			if (current.platform !== "yunxiao" || !current.refreshToken) fail$8("AuthDenied");
			const endpoint = officialEndpoint(current.tokenEndpoint, "token");
			const body = new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: current.refreshToken,
				client_id: current.clientId
			});
			const result = await this.request(endpoint, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: body.toString()
			});
			this.live(connectionId, epoch);
			const accessToken = text$3(result.access_token);
			if (typeof result.expires_in !== "number" || !Number.isInteger(result.expires_in) || result.expires_in < 1 || result.expires_in > 7776e3 || typeof result.token_type !== "string" || result.token_type.toLowerCase() !== "bearer") fail$8("InvalidRemoteResponse");
			return {
				...current,
				accessToken,
				refreshToken: result.refresh_token === void 0 ? current.refreshToken : text$3(result.refresh_token),
				expiresAt: this.options.now() + result.expires_in * 1e3
			};
		});
		this.live(connectionId, epoch);
		if (!grant) fail$8("CredentialMissing");
		return grant.accessToken;
	}
	async dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const attempt of this.attempts.values()) this.clearAttempt(attempt);
		for (const controller of this.controllers) controller.abort();
		await Promise.allSettled([...this.running]);
	}
};
//#endregion
//#region src/sync/authorization-service.ts
/** Connection-bound protocol runners, owned and disposed by the plugin. */
var SyncAuthorizationService = class {
	options;
	disposed = false;
	managers = /* @__PURE__ */ new Map();
	constructor(options) {
		this.options = options;
	}
	connection(id) {
		const connection = this.options.config.getConnection(id);
		if (!connection) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "id"
		}));
		return connection;
	}
	/**
	* The identity an authorization is bound to. Only 云效's official
	* authorization remains, and that grant is account-scoped, so choosing or
	* fixing its organization must not throw the sign-in away. The callback check
	* and the manager's own comparison must use this one definition, or a
	* legitimate callback is rejected as stale.
	*/
	fingerprintOf(connection) {
		return JSON.stringify(connection.authentication);
	}
	async manager(connection) {
		if (this.disposed) throw syncRemoteError(syncError("RunInterrupted", { scope: "connection" }));
		if (connection.platform !== "yunxiao") throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "authentication"
		}));
		if (!this.options.store || !this.options.callbackBaseUrl) throw syncRemoteError(syncError("HostRestartRequired", { scope: "connection" }));
		const fingerprint = this.fingerprintOf(connection);
		const existing = this.managers.get(connection.id);
		if (existing?.fingerprint === fingerprint) return existing.manager;
		if (existing) {
			await existing.manager.dispose();
			await existing.manager.disconnect(connection.id);
		}
		const manager = new OAuthManager({
			store: this.options.store,
			callbackBaseUrl: this.options.callbackBaseUrl,
			fetch: globalThis.fetch,
			now: Date.now
		});
		this.managers.set(connection.id, {
			fingerprint,
			manager
		});
		return manager;
	}
	async decorate(connection) {
		if (connection.authentication?.mode !== "oauth" || connection.platform !== "yunxiao") return connection;
		const grant = await this.options.store?.read(connection.id);
		return {
			...connection,
			credentialPresent: Boolean(grant?.platform === "yunxiao" && grant.expiresAt > Date.now())
		};
	}
	/** The live 云效 access token of an authorized connection, or null when absent/expired. */
	async yunxiaoToken(connection) {
		const grant = await this.options.store?.read(connection.id);
		return grant?.platform === "yunxiao" && grant.expiresAt > Date.now() ? grant.accessToken : null;
	}
	async state({ connectionId }) {
		const connection = this.connection(connectionId);
		if (!this.options.store || !this.options.callbackBaseUrl) return {
			connectionId,
			status: "unavailable",
			attemptId: null,
			expiresAt: null,
			accountLabel: null,
			resourceIds: [],
			error: syncError("HostRestartRequired", { scope: "connection" })
		};
		return (await this.manager(connection)).state(connectionId);
	}
	async begin({ connectionId }) {
		const connection = this.connection(connectionId);
		if (connection.platform !== "yunxiao" || connection.authentication?.mode !== "oauth" || connection.mode !== "center") throw syncRemoteError(syncError("InvalidConfig", { scope: "connection" }));
		return (await this.manager(connection)).begin(oauthConnection(connection));
	}
	async cancel({ connectionId, attemptId }) {
		await (await this.manager(this.connection(connectionId))).cancel(connectionId, attemptId);
		return { ok: true };
	}
	async deleteConnection(request) {
		if (this.connection(request.id).revision !== request.revision) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "connection" }));
		if (this.options.config.listRules(request.id).length) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "id"
		}));
		const entry = this.managers.get(request.id);
		if (entry) {
			await entry.manager.dispose();
			await entry.manager.disconnect(request.id);
			this.managers.delete(request.id);
		} else if (this.options.store) await this.options.store.remove(request.id);
		this.options.config.deleteConnection(request);
	}
	async disconnect({ connectionId }) {
		const connection = this.connection(connectionId);
		this.options.config.updateConnection({
			id: connection.id,
			revision: connection.revision,
			enabled: false
		});
		for (const rule of this.options.config.listRules().filter((rule) => rule.connectionId === connectionId && rule.enabled)) this.options.config.updateRule({
			id: rule.id,
			revision: rule.revision,
			enabled: false
		});
		if (this.options.store && this.options.callbackBaseUrl) await (await this.manager(connection)).disconnect(connectionId);
		return { ok: true };
	}
	async callback(url) {
		for (const [id, entry] of this.managers) {
			if (!entry.manager.acceptsCallback(url)) continue;
			const current = this.connection(id);
			if (entry.fingerprint !== this.fingerprintOf(current)) {
				await entry.manager.dispose();
				throw syncRemoteError(syncError("InvalidConfig", { scope: "connection" }));
			}
			await entry.manager.callback(url);
			return;
		}
		throw syncRemoteError(syncError("InvalidConfig", { scope: "connection" }));
	}
	async dispose() {
		this.disposed = true;
		await Promise.all([...this.managers.values()].map((entry) => entry.manager.dispose()));
		this.managers.clear();
	}
};
/** The protocol runner only ever speaks for 云效 now; the caller checked the platform. */
function oauthConnection(connection) {
	return {
		id: connection.id,
		platform: "yunxiao",
		instance: connection.instance,
		revision: connection.revision
	};
}
//#endregion
//#region src/sync/oauth-route.ts
/** A narrow unauthenticated callback. The one-use random state is its admission proof. */
function createOAuthCallbackHandler(manager, callbackBase) {
	const expected = new URL(callbackBase);
	return async (req, res) => {
		res.setHeader("content-type", "text/html; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		res.setHeader("referrer-policy", "no-referrer");
		res.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
		res.setHeader("x-content-type-options", "nosniff");
		const reply = (status, message) => {
			res.statusCode = status;
			res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>DSH 授权结果</title><h1>${message}</h1><p>返回 DSH 查看连接状态。此页面不包含令牌或授权码。</p></html>`);
		};
		if (req.method !== "GET") {
			res.setHeader("allow", "GET");
			reply(405, "不支持此请求");
			return;
		}
		if (!req.url || req.url.length > 8192 || req.headers.host !== expected.host) {
			reply(400, "授权回调无效");
			return;
		}
		let url;
		try {
			url = new URL(req.url, expected.origin);
		} catch {
			reply(400, "授权回调无效");
			return;
		}
		if (url.origin !== expected.origin || url.pathname !== "/task-list/oauth/callback") {
			reply(400, "授权回调无效");
			return;
		}
		try {
			await manager.callback(url);
			reply(200, "授权已完成");
		} catch (error) {
			reply(400, `授权未完成或已失效（${failureCode(error)}）`);
		}
	};
}
/** The plugin's structured error code of a rejected callback, or `unknown`. */
function failureCode(error) {
	if (error !== null && typeof error === "object") {
		const details = error.details;
		if (details !== void 0 && typeof details.code === "string") return details.code;
		const code = error.code;
		if (typeof code === "string") return code;
	}
	return "unknown";
}
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
//#region src/sqlite-transaction.ts
/**
* Controlled, synchronous transaction helper for this plugin. Every database
* mutation in the plugin goes through here so nested writes never mix with a
* bare `BEGIN`/`COMMIT`.
*
* The outermost call opens a real transaction with `BEGIN IMMEDIATE`; nested
* calls open a uniquely-named `SAVEPOINT`. On error the active savepoint is
* rolled back to and then released, or the outer transaction is rolled back.
* Only generated, sanitized savepoint names are ever interpolated.
*/
const depths = /* @__PURE__ */ new WeakMap();
let savepointCounter = 0;
function isPromiseLike(value) {
	return typeof value === "object" && value !== null && typeof value.then === "function";
}
function withSqliteTransaction(db, operation) {
	const depth = depths.get(db) ?? 0;
	depths.set(db, depth + 1);
	const savepoint = `sp_${savepointCounter++}`;
	try {
		if (depth === 0) db.exec("BEGIN IMMEDIATE");
		else db.exec(`SAVEPOINT ${savepoint}`);
		const result = operation();
		if (isPromiseLike(result)) throw new Error("withSqliteTransaction callback must be synchronous and must not return a Promise");
		if (depth === 0) db.exec("COMMIT");
		else db.exec(`RELEASE SAVEPOINT ${savepoint}`);
		return result;
	} catch (error) {
		if (depth === 0) try {
			db.exec("ROLLBACK");
		} catch {}
		else {
			try {
				db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
			} catch {}
			try {
				db.exec(`RELEASE SAVEPOINT ${savepoint}`);
			} catch {}
		}
		throw error;
	} finally {
		depths.set(db, depth);
	}
}
/**
* Stable, unique serialization of a remote identity. Ids stay strings and may
* contain arbitrary non-control characters, so a JSON array is the canonical
* key rather than a delimiter join.
*/
function serializeRemoteKey(key) {
	return JSON.stringify([
		key.instance,
		key.projectId,
		key.typeId,
		key.id
	]);
}
/** The singleton ownership lock introduced in schema 7 (per-run locks are a v6-era shape). */
const RUN_LOCK_TABLE = `CREATE TABLE sync_run_lock (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK(generation >= 0),
  heartbeat_at INTEGER NOT NULL,
  lease_expires_at INTEGER NOT NULL
) STRICT;`;
const syncSchema = `
CREATE TABLE sync_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
  revision INTEGER NOT NULL CHECK(revision >= 1),
  instance TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('yunxiao', 'tapd')),
  mode TEXT CHECK(mode IS NULL OR mode IN ('center', 'region')),
  organization_id TEXT,
  region_host TEXT,
  token_env TEXT,
  company_id TEXT,
  user_env TEXT,
  password_env TEXT,
  authentication TEXT NOT NULL DEFAULT '{"mode":"manual"}',
  fill_fields TEXT
) STRICT;

CREATE TABLE sync_rules (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  connection_id TEXT NOT NULL REFERENCES sync_connections(id),
  instance TEXT NOT NULL,
  project_id TEXT NOT NULL,
  project_name TEXT,
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
  workspace_id TEXT,
  conditions TEXT NOT NULL DEFAULT '[]',
  status_write_states TEXT NOT NULL DEFAULT '{}',
  UNIQUE(instance, project_id)
) STRICT;
CREATE INDEX sync_rules_connection ON sync_rules(connection_id);

CREATE TABLE sync_links (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES sync_rules(id),
  task_id TEXT UNIQUE REFERENCES tasks(id) ON DELETE SET NULL,
  task_generation TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('yunxiao', 'tapd')),
  instance TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  number TEXT NOT NULL,
  url TEXT,
  canonical TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  last_success_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sync_links_rule_canonical ON sync_links(rule_id, canonical);
CREATE INDEX sync_links_created_at ON sync_links(created_at);

CREATE TABLE sync_baselines (
  link_id TEXT PRIMARY KEY REFERENCES sync_links(id) ON DELETE CASCADE,
  data TEXT NOT NULL
) STRICT;

CREATE TABLE sync_write_intents (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES sync_links(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  task_generation TEXT NOT NULL,
  link_revision INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK(generation >= 0),
  rule_snapshot TEXT NOT NULL,
  baseline TEXT NOT NULL,
  local_before TEXT NOT NULL,
  local_version INTEGER NOT NULL,
  remote_before TEXT NOT NULL,
  patch TEXT NOT NULL,
  expected TEXT NOT NULL,
  phase TEXT NOT NULL CHECK(phase IN ('prepared', 'dispatched', 'unknown', 'confirmed', 'cancelled')),
  error TEXT,
  confirmed_run_id TEXT,
  confirmed_owner_id TEXT,
  confirmed_generation INTEGER CHECK(confirmed_generation IS NULL OR confirmed_generation >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sync_write_intents_link ON sync_write_intents(link_id);
CREATE INDEX sync_write_intents_pending ON sync_write_intents(phase) WHERE phase IN ('prepared', 'dispatched', 'unknown');
CREATE INDEX sync_write_intents_created ON sync_write_intents(created_at);

CREATE TABLE sync_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'partial', 'failed', 'interrupted')),
  phase TEXT NOT NULL CHECK(phase IN ('discovering', 'processing', 'waiting', 'finished')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  counts_imported INTEGER NOT NULL DEFAULT 0,
  counts_pulled INTEGER NOT NULL DEFAULT 0,
  counts_pushed INTEGER NOT NULL DEFAULT 0,
  counts_merged INTEGER NOT NULL DEFAULT 0,
  counts_unchanged INTEGER NOT NULL DEFAULT 0,
  counts_failed INTEGER NOT NULL DEFAULT 0,
  counts_pending INTEGER NOT NULL DEFAULT 0,
  unprocessed_known INTEGER,
  discovery_complete INTEGER NOT NULL DEFAULT 0 CHECK(discovery_complete IN (0, 1)),
  scope_summary TEXT NOT NULL DEFAULT '',
  errors TEXT NOT NULL DEFAULT '[]'
) STRICT;
CREATE INDEX sync_runs_started ON sync_runs(started_at);

CREATE TABLE sync_run_items (
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  task_id TEXT,
  category TEXT NOT NULL CHECK(category IN ('imported', 'pulled', 'pushed', 'merged', 'unchanged', 'failed')),
  changed_fields TEXT NOT NULL,
  discarded_fields TEXT NOT NULL,
  written_back INTEGER NOT NULL CHECK(written_back IN (0, 1)),
  outside_filter INTEGER NOT NULL CHECK(outside_filter IN (0, 1)),
  error TEXT,
  pending INTEGER NOT NULL DEFAULT 0 CHECK(pending IN (0, 1)),
  PRIMARY KEY (run_id, canonical)
) STRICT;
CREATE INDEX sync_run_items_run ON sync_run_items(run_id);

CREATE TABLE sync_seen_keys (
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  PRIMARY KEY (run_id, canonical)
) STRICT;

${RUN_LOCK_TABLE}
`;
/** The legacy one-lock-per-run shape (schema 6) the v7 migration must rebuild. */
const OLD_RUN_LOCK_COLUMNS = [
	"run_id",
	"owner_id",
	"generation"
];
const NEW_RUN_LOCK_COLUMNS = [
	"id",
	"run_id",
	"owner_id",
	"generation",
	"heartbeat_at",
	"lease_expires_at"
];
const CONFIRM_AUDIT_COLUMNS = [
	"confirmed_run_id",
	"confirmed_owner_id",
	"confirmed_generation"
];
function readUserVersion(db) {
	return db.prepare("PRAGMA user_version").get().user_version;
}
function tableColumns(db, table) {
	const rows = db.prepare(`PRAGMA table_info(${table})`).all();
	return new Set(rows.map((row) => row.name));
}
function hasAll(columns, required) {
	return required.every((name) => columns.has(name));
}
/** An unrecognized table shape is a storage failure, never a heuristic drop. */
function storageShapeError(table) {
	throw syncRemoteError(syncError("StorageFailure", {
		scope: "config",
		field: table
	}));
}
/**
* Advance a schema-6 database to 7 without any heuristic data loss. Only the two
* tables whose shape changed since v6 are inspected via `PRAGMA table_info`:
* `sync_write_intents` (gains three confirmed-* audit columns) and `sync_run_lock`
* (per-run `run_id` primary key becomes the singleton `id CHECK(id = 1)`). A shape
* that is neither the exact old nor the exact new form is rejected rather than
* guessed. Old `running` runs are marked `interrupted` before the lock table is
* rebuilt (the lock role is transient; pending intents retain the original owner).
*/
function migrateV6ToV7(db) {
	const intentColumns = tableColumns(db, "sync_write_intents");
	const lockColumns = tableColumns(db, "sync_run_lock");
	const intentNew = hasAll(intentColumns, CONFIRM_AUDIT_COLUMNS);
	const intentOld = !CONFIRM_AUDIT_COLUMNS.some((name) => intentColumns.has(name));
	const lockNew = hasAll(lockColumns, NEW_RUN_LOCK_COLUMNS);
	const lockOld = hasAll(lockColumns, OLD_RUN_LOCK_COLUMNS) && !lockColumns.has("id") && !lockColumns.has("heartbeat_at") && !lockColumns.has("lease_expires_at");
	if (!intentNew && !intentOld) throw storageShapeError("sync_write_intents");
	if (!lockNew && !lockOld) throw storageShapeError("sync_run_lock");
	if (intentOld) db.exec(`ALTER TABLE sync_write_intents ADD COLUMN confirmed_run_id TEXT;
      ALTER TABLE sync_write_intents ADD COLUMN confirmed_owner_id TEXT;
      ALTER TABLE sync_write_intents ADD COLUMN confirmed_generation INTEGER CHECK(confirmed_generation IS NULL OR confirmed_generation >= 0)`);
	if (lockOld) {
		db.exec(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished' WHERE status = 'running'`);
		db.exec("ALTER TABLE sync_run_lock RENAME TO sync_run_lock_v6");
		db.exec(RUN_LOCK_TABLE);
		db.exec("DROP TABLE sync_run_lock_v6");
	}
}
/**
* Advance a schema-7 database to 8 by adding the per-item `pending` flag
* (persists whether a result left an unresolved write intent, so counter
* reconciliation is idempotent across re-records). Existing rows are backfilled
* from two sources without heuristic loss: a stored pending error code
* (`WriteOutcomeUnknown` / `VerificationFailed`) marks pending directly, and a
* still-unresolved intent for the same run+link canonical marks pending by
* correlation (the StorageFailure-at-finalize case, where the error code alone
* is not a pending code). The column is `NOT NULL DEFAULT 0` so a strict table
* gains it without rewriting rows.
*/
function migrateV7ToV8(db) {
	if (tableColumns(db, "sync_run_items").has("pending")) return;
	db.exec("ALTER TABLE sync_run_items ADD COLUMN pending INTEGER NOT NULL DEFAULT 0 CHECK(pending IN (0, 1))");
	const setPending = db.prepare("UPDATE sync_run_items SET pending = 1 WHERE run_id = ? AND canonical = ?");
	const errorRows = db.prepare("SELECT run_id, canonical, error FROM sync_run_items WHERE error IS NOT NULL").all();
	for (const row of errorRows) {
		let code = null;
		try {
			code = JSON.parse(row.error).code;
		} catch {
			code = null;
		}
		if (code === "WriteOutcomeUnknown" || code === "VerificationFailed") setPending.run(row.run_id, row.canonical);
	}
	db.exec(`UPDATE sync_run_items SET pending = 1
    WHERE EXISTS (
      SELECT 1 FROM sync_write_intents wi
      JOIN sync_links l ON l.id = wi.link_id
      WHERE l.canonical = sync_run_items.canonical
        AND wi.run_id = sync_run_items.run_id
        AND wi.phase IN ('prepared', 'dispatched', 'unknown')
    )`);
}
/** Legacy rules have no three-status mapping; disable them until the user edits them. */
function migrateV13ToV14(db) {
	if (!hasAll(tableColumns(db, "sync_rules"), ["conditions", "status_write_states"])) throw storageShapeError("sync_rules");
	db.exec(`UPDATE sync_rules SET enabled = 0 WHERE status_write_states = '{}' AND enabled = 1`);
}
/** Create or advance the sync tables to the current version; any failure rolls the whole DDL back. */
function migrateSyncSchema(db) {
	const version = readUserVersion(db);
	if (version > 14) throw new Error(`unsupported task database version: ${version}`);
	if (version === 14) return;
	if (version === 13) {
		migrateV13ToV14(db);
		db.exec(`PRAGMA user_version = 14`);
		return;
	}
	if (version < 6) db.exec(syncSchema);
	else {
		migrateV6ToV7(db);
		migrateV7ToV8(db);
		if (!tableColumns(db, "sync_connections").has("authentication")) db.exec(`ALTER TABLE sync_connections ADD COLUMN authentication TEXT NOT NULL DEFAULT '{"mode":"manual"}'`);
		if (!tableColumns(db, "sync_rules").has("project_name")) db.exec("ALTER TABLE sync_rules ADD COLUMN project_name TEXT");
		if (!tableColumns(db, "sync_connections").has("fill_fields")) db.exec("ALTER TABLE sync_connections ADD COLUMN fill_fields TEXT");
		const connectionColumns = tableColumns(db, "sync_connections");
		if (connectionColumns.has("authentication")) db.exec(`UPDATE sync_connections SET authentication = '{"mode":"manual"}' WHERE platform = 'tapd' AND authentication LIKE '%"oauth"%'`);
		if (connectionColumns.has("token_env")) db.exec(`UPDATE sync_connections SET token_env = 'TASK_LIST_TAPD_TOKEN' WHERE platform = 'tapd' AND (token_env IS NULL OR token_env = '')`);
		if (connectionColumns.has("user_env") && connectionColumns.has("password_env")) db.exec(`UPDATE sync_connections SET user_env = NULL, password_env = NULL WHERE platform = 'tapd'`);
		const ruleColumns = tableColumns(db, "sync_rules");
		if (!ruleColumns.has("conditions")) db.exec(`ALTER TABLE sync_rules ADD COLUMN conditions TEXT NOT NULL DEFAULT '[]'`);
		if (!ruleColumns.has("status_write_states")) db.exec(`ALTER TABLE sync_rules ADD COLUMN status_write_states TEXT NOT NULL DEFAULT '{}'`);
	}
	migrateV13ToV14(db);
	db.exec(`PRAGMA user_version = 14`);
}
//#endregion
//#region src/statistics.ts
const MAX_RANGE_MS = 317088e5;
const FORMAT_CACHE_LIMIT = 16;
const minuteSecondFormats = /* @__PURE__ */ new Map();
/**
* A formatter is immutable and expensive to construct, so one per zone is shared
* across the whole sweep instead of being rebuilt for every event.
* @param timeZone - IANA zone the caller bucketed in.
* @returns the cached minute/second parts formatter for that zone.
*/
function minuteSecondFormat(timeZone) {
	let format = minuteSecondFormats.get(timeZone);
	if (format === void 0) {
		format = new Intl.DateTimeFormat("en", {
			timeZone,
			minute: "numeric",
			second: "numeric"
		});
		if (minuteSecondFormats.size >= FORMAT_CACHE_LIMIT) minuteSecondFormats.clear();
		minuteSecondFormats.set(timeZone, format);
	}
	return format;
}
function currentHourStart(now, timeZone) {
	const parts = minuteSecondFormat(timeZone).formatToParts(now);
	const minute = Number(parts.find((part) => part.type === "minute").value);
	const second = Number(parts.find((part) => part.type === "second").value);
	return now - minute * 6e4 - second * 1e3 - now % 1e3;
}
/**
* Validate one request and resolve its absolute bounds.
* @param request - the raw request from the wire.
* @param now - reference instant that fixes the excluded current hour.
* @returns validated start, the effective end, and the cutoff.
* @throws when the range is absent, inverted, oversized, or the zone is unknown.
*/
function statisticsBounds(request, now) {
	if (!request || !Number.isSafeInteger(request.start) || !Number.isSafeInteger(request.end) || request.start < 0 || request.end <= request.start || request.end - request.start > MAX_RANGE_MS || typeof request.timeZone !== "string") throw new Error("Invalid statistics range");
	const cutoff = currentHourStart(now, request.timeZone);
	return {
		start: request.start,
		end: Math.min(request.end, cutoff),
		cutoff
	};
}
function usageTokens(usage) {
	if (!usage || ![usage.inputTokens, usage.outputTokens].every((value) => Number.isSafeInteger(value) && value >= 0)) return;
	const values = [
		usage.inputTokens,
		usage.outputTokens,
		usage.cacheReadTokens ?? 0,
		usage.cacheWriteTokens ?? 0
	];
	if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)) return;
	const total = values.reduce((sum, value) => sum + value, 0);
	if (!Number.isSafeInteger(total)) return;
	if (usage.totalTokens !== void 0) {
		if (!Number.isSafeInteger(usage.totalTokens) || usage.totalTokens < total) return;
		if (usage.cacheReadTokens !== void 0 && usage.cacheWriteTokens !== void 0 && usage.totalTokens !== total) return;
		return usage.totalTokens;
	}
	return total;
}
function usageOf(event) {
	if (event.type === "assistant/message" && event.data.usage) return event.data.usage;
	const stream = event.data.stream;
	if (!Array.isArray(stream)) return;
	for (let index = stream.length - 1; index >= 0; index--) {
		const chunk = stream[index]?.chunk;
		if (chunk?.type === "usage") return chunk.usage;
	}
}
/**
* Extract every range-relevant fact from one session log once, in log order.
*
* The result is independent of the requested range, so it can be persisted and
* re-folded for any later day, month, or year without reading the log again.
* @param log - inherited count and events of one session.
* @param origin - session origin header; `subagent` sessions only admit explicit human sends.
* @returns the ordered projection for that session.
*/
function projectSession(log, origin) {
	const events = [];
	const messages = /* @__PURE__ */ new Set();
	for (const event of log.events) {
		if (event.seq < log.inheritedEventCount) continue;
		if (event.type === "user/message" && !event.sourceEventSeqs?.length && event.data.source?.kind === "user" && (origin !== "subagent" || event.data.source.rpcId)) {
			const identity = event.data.source.rpcId ?? event.data.id ?? String(event.seq);
			if (!messages.has(identity)) {
				messages.add(identity);
				events.push(["p", event.time]);
			}
		}
		if (event.type === "compaction/summary") {
			const tokens = usageTokens(event.data.usage);
			events.push(tokens === void 0 ? ["u", event.time] : [
				"c",
				event.time,
				tokens
			]);
			continue;
		}
		if (event.type === "llm/retry-started") {
			events.push([
				"r",
				event.time,
				event.data.turn ?? null,
				event.data.step ?? null
			]);
			continue;
		}
		if (event.type !== "assistant/message" && event.type !== "assistant/attempt") continue;
		const tokens = usageTokens(usageOf(event));
		if (tokens === void 0) {
			events.push(["u", event.time]);
			continue;
		}
		events.push([
			"a",
			event.time,
			event.data.turn ?? null,
			event.data.step ?? null,
			tokens
		]);
	}
	return { events };
}
/**
* Whether a session ever admitted a real user message.
*
* Subagent runs, scheduled work, and abandoned records create sessions without
* starting a conversation, so they must not inflate the "new sessions" figure.
* The projection already carries the admitted prompts, so this costs one scan.
*/
function hasUserMessage(projection) {
	return projection.events.some((event) => event[0] === "p");
}
/** Fold one projected session into the hour buckets under the request's range. */
function foldProjection(projection, bucket, end) {
	let missingUsageCalls = 0;
	let last;
	for (const event of projection.events) {
		if (event[1] >= end) continue;
		switch (event[0]) {
			case "p": {
				const row = bucket(event[1]);
				if (row) row.prompts++;
				break;
			}
			case "c": {
				const row = bucket(event[1]);
				if (row) row.tokens += event[2];
				break;
			}
			case "u":
				if (bucket(event[1])) missingUsageCalls++;
				break;
			case "r":
				if (last?.turn === event[2] && last?.step === event[3]) last = void 0;
				break;
			case "a": {
				const [time, turn, step, tokens] = [
					event[1],
					event[2],
					event[3],
					event[4]
				];
				if (last && last.turn === turn && last.step === step) {
					if (last.tokens === tokens) break;
					const previous = bucket(last.time);
					if (previous) previous.tokens -= last.tokens;
				}
				const row = bucket(time);
				if (row) row.tokens += tokens;
				last = {
					turn,
					step,
					time,
					tokens
				};
				break;
			}
		}
	}
	return missingUsageCalls;
}
/**
* Fold projected sessions into one snapshot. Duplicate session ids keep their
* first occurrence, and a session created inside the excluded range contributes
* nothing at all.
* @param entries - projected sessions, newest-first order is irrelevant.
* @param request - the validated request that fixes the range.
* @param now - reference instant that fixes the cutoff.
* @returns the hour rows, totals, and missing-usage count.
*/
function aggregateStatistics(entries, request, now = Date.now(), completions = []) {
	const { end, cutoff } = statisticsBounds(request, now);
	const hours = /* @__PURE__ */ new Map();
	const bucket = (time) => {
		if (!Number.isFinite(time) || time < request.start || time >= end) return;
		const hour = currentHourStart(time, request.timeZone);
		let row = hours.get(hour);
		if (!row) {
			row = {
				hour,
				sessions: 0,
				prompts: 0,
				tokens: 0,
				completedTasks: 0,
				completedPoints: 0
			};
			hours.set(hour, row);
		}
		return row;
	};
	let missingUsageCalls = 0;
	const seen = /* @__PURE__ */ new Set();
	for (const entry of entries) {
		if (seen.has(entry.id) || entry.createdAt >= end) continue;
		seen.add(entry.id);
		const created = bucket(entry.createdAt);
		if (created && hasUserMessage(entry.projection)) created.sessions++;
		missingUsageCalls += foldProjection(entry.projection, bucket, end);
	}
	for (const completion of completions) {
		const row = bucket(completion.time);
		if (!row) continue;
		row.completedTasks++;
		row.completedPoints += completion.points;
	}
	const rows = [...hours.values()].sort((a, b) => a.hour - b.hour);
	return {
		start: request.start,
		end: request.end,
		cutoff,
		calculatedAt: now,
		timeZone: request.timeZone,
		missingUsageCalls,
		hours: rows,
		totals: rows.reduce((sum, row) => ({
			sessions: sum.sessions + row.sessions,
			prompts: sum.prompts + row.prompts,
			tokens: sum.tokens + row.tokens,
			completedTasks: sum.completedTasks + row.completedTasks,
			completedPoints: sum.completedPoints + row.completedPoints
		}), {
			sessions: 0,
			prompts: 0,
			tokens: 0,
			completedTasks: 0,
			completedPoints: 0
		})
	};
}
/**
* Validate one persisted projection payload.
* @param value - parsed JSON from the cache row.
* @returns the projection, or `undefined` when the payload is not the current shape.
*/
function readProjectionPayload(value) {
	if (typeof value !== "object" || value === null) return;
	const record = value;
	if (record.v !== 1 || !Array.isArray(record.e)) return;
	const events = [];
	for (const item of record.e) {
		if (!Array.isArray(item) || typeof item[0] !== "string" || !Number.isFinite(item[1])) return;
		const time = item[1];
		if (item[0] === "p" && item.length === 2) events.push(["p", time]);
		else if (item[0] === "c" && item.length === 3 && Number.isFinite(item[2])) events.push([
			"c",
			time,
			item[2]
		]);
		else if (item[0] === "u" && item.length === 2) events.push(["u", time]);
		else if (item[0] === "r" && item.length === 4) events.push([
			"r",
			time,
			nullableNumber(item[2]),
			nullableNumber(item[3])
		]);
		else if (item[0] === "a" && item.length === 5 && Number.isFinite(item[4])) events.push([
			"a",
			time,
			nullableNumber(item[2]),
			nullableNumber(item[3]),
			item[4]
		]);
		else return;
	}
	return { events };
}
function nullableNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
/** Serialize a projection into the cache payload shape. */
function projectionPayload(projection) {
	return JSON.stringify({
		v: 1,
		e: projection.events
	});
}
//#endregion
//#region src/statistics-store.ts
/**
* The projection cache table. It is created on every open rather than versioned
* with the task schema: the rows are rebuildable from the session corpus, so an
* older build may ignore the table and a newer one recreates it at will.
*/
const statisticsSchema = `CREATE TABLE IF NOT EXISTS statistics_sessions (
  session_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  revision TEXT,
  sealed INTEGER NOT NULL CHECK(sealed IN (0, 1)),
  payload TEXT NOT NULL,
  indexed_at INTEGER NOT NULL
) STRICT;`;
/**
* Persistent per-session projection cache.
*
* Reading a session log is by far the expensive half of a statistics sweep, so
* each session is folded into a compact projection once and re-used for every
* later range until its invalidation key changes. Unreadable or stale payload
* rows are dropped rather than repaired: the next sweep simply re-reads them.
*/
var StatisticsCacheStore = class {
	db;
	constructor(db) {
		this.db = db;
	}
	/**
	* Read every cached projection.
	* @returns rows keyed by session id, with malformed payloads already dropped.
	*/
	read() {
		const rows = this.db.prepare("SELECT session_id AS sessionId, created_at AS createdAt, revision, sealed, payload FROM statistics_sessions").all();
		const result = /* @__PURE__ */ new Map();
		const broken = [];
		for (const row of rows) {
			let projection;
			try {
				projection = readProjectionPayload(JSON.parse(row.payload));
			} catch {
				projection = void 0;
			}
			if (projection === void 0) {
				broken.push(row.sessionId);
				continue;
			}
			result.set(row.sessionId, {
				sessionId: row.sessionId,
				createdAt: row.createdAt,
				revision: row.revision,
				sealed: row.sealed === 1,
				projection
			});
		}
		if (broken.length) this.delete(broken);
		return result;
	}
	/**
	* Insert or replace a batch of session projections in one transaction.
	* @param rows - projections captured since the previous flush.
	*/
	write(rows) {
		if (rows.length === 0) return;
		withSqliteTransaction(this.db, () => {
			const statement = this.db.prepare(`INSERT INTO statistics_sessions (session_id, created_at, revision, sealed, payload, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET created_at = excluded.created_at, revision = excluded.revision,
          sealed = excluded.sealed, payload = excluded.payload, indexed_at = excluded.indexed_at`);
			const now = Date.now();
			for (const row of rows) statement.run(row.sessionId, row.createdAt, row.revision, row.sealed ? 1 : 0, projectionPayload(row.projection), now);
		});
	}
	/**
	* Drop rows whose session is no longer in the corpus.
	* @param keep - ids still present in the newest listing.
	* @returns the number of removed rows.
	*/
	prune(keep) {
		const stale = this.db.prepare("SELECT session_id AS sessionId FROM statistics_sessions").all().map((row) => row.sessionId).filter((id) => !keep.has(id));
		if (stale.length) this.delete(stale);
		return stale.length;
	}
	/** Drop every cached projection, so the next sweep re-reads all sessions. */
	clear() {
		withSqliteTransaction(this.db, () => {
			this.db.prepare("DELETE FROM statistics_sessions").run();
		});
	}
	delete(ids) {
		withSqliteTransaction(this.db, () => {
			const statement = this.db.prepare("DELETE FROM statistics_sessions WHERE session_id = ?");
			for (const id of ids) statement.run(id);
		});
	}
};
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
/** Current schema version; the store refuses anything newer. This is the sync
* migration's own version, which writes the same `user_version`, so the two can
* never drift apart. */
const schemaVersion = 14;
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
			}
			withSqliteTransaction(this.db, () => {
				if (version.user_version === 0) this.db.exec(`CREATE TABLE tasks (
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
          ${subtaskSchema}`);
				else if (version.user_version === 1) this.db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent'));
            ALTER TABLE tasks ADD COLUMN story_points INTEGER CHECK(story_points IS NULL OR story_points BETWEEN 0 AND 1000);
            ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
            ALTER TABLE tasks ADD COLUMN workspace_id TEXT;
            ALTER TABLE tasks ADD COLUMN started_at INTEGER;
            ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
            ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
            ALTER TABLE tasks ADD COLUMN session_id TEXT;
            ALTER TABLE tasks ADD COLUMN agent TEXT;
            ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
            ${subtaskSchema}`);
				else if (version.user_version === 2) this.db.exec(`ALTER TABLE tasks ADD COLUMN send_immediately INTEGER NOT NULL DEFAULT 0 CHECK(send_immediately IN (0, 1));
            ALTER TABLE tasks ADD COLUMN session_id TEXT;
            ALTER TABLE tasks ADD COLUMN agent TEXT;
            ALTER TABLE tasks ADD COLUMN use_worktree INTEGER NOT NULL DEFAULT 0 CHECK(use_worktree IN (0, 1));
            ${subtaskSchema}`);
				else if (version.user_version === 3) this.db.exec(subtaskSchema);
				if (version.user_version < 5) {
					this.db.exec(`ALTER TABLE tasks ADD COLUMN content TEXT NOT NULL DEFAULT '{"version":1,"blocks":[]}';
            CREATE TABLE task_attachments (
              id TEXT PRIMARY KEY,
              task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
              data BLOB NOT NULL
            ) STRICT;
            CREATE INDEX task_attachments_task ON task_attachments(task_id);`);
					const rows = this.db.prepare("SELECT id, notes FROM tasks").all();
					const write = this.db.prepare("UPDATE tasks SET content = ? WHERE id = ?");
					for (const row of rows) write.run(JSON.stringify(textContent(row.notes)), row.id);
				}
				if (version.user_version < schemaVersion) migrateSyncSchema(this.db);
				this.db.exec(statisticsSchema);
			});
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
	/**
	* Task completions inside one half-open instant range, for the statistics report.
	* @param from - inclusive lower bound on `completed_at`.
	* @param to - exclusive upper bound on `completed_at`.
	* @returns one entry per completed task, oldest first.
	*/
	listCompletions(from, to) {
		if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to <= from) return [];
		return this.db.prepare(`SELECT completed_at AS time, COALESCE(story_points, 0) AS points
      FROM tasks WHERE completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?
      ORDER BY completed_at`).all(from, to);
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
		return withSqliteTransaction(this.db, () => {
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
			return result;
		});
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
		const taskId = idOf(id);
		const taskVersion = versionOf(version);
		withSqliteTransaction(this.db, () => {
			const now = Date.now();
			const link = this.db.prepare("SELECT id FROM sync_links WHERE task_id = ?").get(taskId);
			if (link) {
				this.db.prepare(`UPDATE sync_write_intents SET phase = 'cancelled', task_id = NULL, updated_at = ?
          WHERE link_id = ? AND phase = 'prepared'`).run(now, link.id);
				this.db.prepare(`UPDATE sync_write_intents SET task_id = NULL, updated_at = ?
          WHERE link_id = ? AND phase IN ('dispatched', 'unknown')`).run(now, link.id);
			}
			if (this.db.prepare("DELETE FROM tasks WHERE id = ? AND version = ?").run(taskId, taskVersion).changes !== 1) throw new Error("task missing or changed; refresh and retry");
		});
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
//#region src/statistics-service.ts
/** Finished runs kept addressable for the polling client; oldest settle first. */
const MAX_RETAINED_JOBS = 8;
/** Projections per cache write, so a sweep does not fsync once per session. */
const WRITE_BATCH = 25;
/**
* Sessions read at once. Every read is dominated by per-session backend work
* (directory resolution and handle setup), so overlapping a small batch is
* safe for the seam — its own batch reader uses the same width — and shortens
* the one cold sweep that populates the cache.
*/
const READ_CONCURRENCY = 4;
function abortError$2() {
	const error = /* @__PURE__ */ new Error("The operation was aborted");
	error.name = "AbortError";
	return error;
}
/**
* A cached row may answer a listing record only when its invalidation key still
* matches. With an exact stored revision that check is exact; without one the
* only sound rule is that a session observed while closed cannot have grown.
*/
function cacheHit(row, record) {
	if (row === void 0 || row.createdAt !== record.createdAt) return false;
	if (record.revision !== void 0 && record.stored !== false) return row.revision === record.revision;
	return row.sealed && record.live === false;
}
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
/**
* Sweeps the session corpus into hourly statistics, re-using persisted
* per-session projections until their revision changes.
*
* A sweep is exposed as an addressable run so the browser can show progress and
* cancel: reading hundreds of logs is the slow half and must not look frozen.
*/
var StatisticsService = class {
	cache;
	source;
	tasks;
	jobs = /* @__PURE__ */ new Map();
	constructor(cache, source, tasks) {
		this.cache = cache;
		this.source = source;
		this.tasks = tasks;
	}
	/** Fold a request to completion and return its snapshot. */
	async calculate(request) {
		return this.sweep(request, new AbortController().signal, () => {});
	}
	/**
	* Start one background sweep.
	* @param request - the range to fold, plus an optional cache bypass.
	* @returns the id the caller polls with `get` and stops with `cancel`.
	*/
	start(request) {
		const job = {
			id: randomUUID(),
			controller: new AbortController(),
			state: {
				status: "running",
				processed: 0,
				total: 0,
				reused: 0
			}
		};
		this.remember(job);
		this.sweep(request, job.controller.signal, (progress) => {
			job.state = {
				...job.state,
				...progress
			};
		}).then((snapshot) => {
			job.state = {
				...job.state,
				status: "completed",
				snapshot
			};
		}).catch((error) => {
			job.state = job.controller.signal.aborted ? {
				...job.state,
				status: "cancelled"
			} : {
				...job.state,
				status: "failed",
				error: messageOf(error)
			};
		});
		return job.id;
	}
	/**
	* Read one run's current state.
	* @param jobId - id returned by `start`.
	* @returns the observed state, or `null` when the run is unknown or evicted.
	*/
	get(jobId) {
		return this.jobs.get(jobId)?.state ?? null;
	}
	/**
	* Ask a run to stop; the sweep checks between session reads.
	* @param jobId - id returned by `start`.
	* @returns whether a known run was asked to stop.
	*/
	cancel(jobId) {
		const job = this.jobs.get(jobId);
		if (job === void 0) return false;
		job.controller.abort();
		return true;
	}
	remember(job) {
		while (this.jobs.size >= MAX_RETAINED_JOBS) {
			const victim = [...this.jobs.values()].find((entry) => entry.state.status !== "running") ?? this.jobs.values().next().value;
			if (victim === void 0) break;
			this.jobs.delete(victim.id);
		}
		this.jobs.set(job.id, job);
	}
	/**
	* Read the corpus, refresh only what the cache cannot answer, and fold it.
	* @param request - requested range and cache policy.
	* @param signal - cancellation observed between session reads.
	* @param onProgress - called with the running counters.
	* @returns the folded snapshot.
	*/
	async sweep(request, signal, onProgress) {
		const now = Date.now();
		const bounds = statisticsBounds(request, now);
		const source = this.source();
		const listed = await source.list(signal);
		const unique = [];
		const ids = /* @__PURE__ */ new Set();
		for (const record of listed) {
			if (ids.has(record.id)) continue;
			ids.add(record.id);
			unique.push(record);
		}
		const eligible = unique.filter((record) => record.createdAt < bounds.end);
		this.cache.prune(ids);
		const cached = this.cache.read();
		const entries = [];
		const pending = [];
		for (const record of eligible) {
			const row = cached.get(record.id);
			if (request.refresh !== true && cacheHit(row, record)) {
				entries.push({
					id: record.id,
					createdAt: record.createdAt,
					projection: row.projection
				});
				continue;
			}
			pending.push(record);
		}
		const reused = entries.length;
		onProgress({
			processed: 0,
			total: pending.length,
			reused
		});
		const batch = [];
		let processed = 0;
		let cursor = 0;
		const readNext = async () => {
			for (;;) {
				if (signal.aborted) throw abortError$2();
				const index = cursor++;
				if (index >= pending.length) return;
				const record = pending[index];
				const projection = projectSession(await source.read(record, signal), record.origin);
				entries.push({
					id: record.id,
					createdAt: record.createdAt,
					projection
				});
				batch.push({
					sessionId: record.id,
					createdAt: record.createdAt,
					revision: record.revision ?? null,
					sealed: record.live === false,
					projection
				});
				processed++;
				if (batch.length >= WRITE_BATCH) this.cache.write(batch.splice(0, batch.length));
				onProgress({
					processed,
					total: pending.length,
					reused
				});
			}
		};
		const failure = (await Promise.allSettled(Array.from({ length: Math.min(READ_CONCURRENCY, pending.length) }, () => readNext()))).find((result) => result.status === "rejected");
		if (failure) throw failure.reason;
		this.cache.write(batch);
		if (signal.aborted) throw abortError$2();
		return aggregateStatistics(entries, request, now, this.tasks.listCompletions(request.start, bounds.end));
	}
};
/** Narrow an untrusted wire request to a run request; `statisticsBounds` rejects the rest. */
function statisticsRunRequest(request) {
	const value = request ?? {};
	return {
		start: value.start,
		end: value.end,
		timeZone: value.timeZone,
		refresh: value.refresh === true
	};
}
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
	let _getSyncAuthState_decorators;
	let _beginSyncAuthorization_decorators;
	let _cancelSyncAuthorization_decorators;
	let _disconnectSyncAuthorization_decorators;
	let _capabilities_decorators;
	let _calculateStatistics_decorators;
	let _startStatistics_decorators;
	let _getStatisticsRun_decorators;
	let _cancelStatistics_decorators;
	let _listTasks_decorators;
	let _createTask_decorators;
	let _updateTask_decorators;
	let _readTaskAttachments_decorators;
	let _deleteTask_decorators;
	let _createSubtask_decorators;
	let _updateSubtask_decorators;
	let _deleteSubtask_decorators;
	let _listSyncConnections_decorators;
	let _createSyncConnection_decorators;
	let _updateSyncConnection_decorators;
	let _deleteSyncConnection_decorators;
	let _listSyncOrganizations_decorators;
	let _listWorkitems_decorators;
	let _listWorkitemFields_decorators;
	let _getWorkitemDescription_decorators;
	let _listSyncRules_decorators;
	let _createSyncRule_decorators;
	let _updateSyncRule_decorators;
	let _deleteSyncRule_decorators;
	let _getSyncMetadata_decorators;
	let _testSyncConnection_decorators;
	let _startSync_decorators;
	let _getSyncRun_decorators;
	let _listSyncRuns_decorators;
	let _listSyncItemResults_decorators;
	return class TaskService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_getSyncAuthState_decorators = [Remote("getSyncAuthState")];
			_beginSyncAuthorization_decorators = [Remote("beginSyncAuthorization")];
			_cancelSyncAuthorization_decorators = [Remote("cancelSyncAuthorization")];
			_disconnectSyncAuthorization_decorators = [Remote("disconnectSyncAuthorization")];
			_capabilities_decorators = [Remote("capabilities")];
			_calculateStatistics_decorators = [Remote("calculateStatistics")];
			_startStatistics_decorators = [Remote("startStatistics")];
			_getStatisticsRun_decorators = [Remote("getStatisticsRun")];
			_cancelStatistics_decorators = [Remote("cancelStatistics")];
			_listTasks_decorators = [Remote("listTasks")];
			_createTask_decorators = [Remote("createTask")];
			_updateTask_decorators = [Remote("updateTask")];
			_readTaskAttachments_decorators = [Remote("readTaskAttachments")];
			_deleteTask_decorators = [Remote("deleteTask")];
			_createSubtask_decorators = [Remote("createSubtask")];
			_updateSubtask_decorators = [Remote("updateSubtask")];
			_deleteSubtask_decorators = [Remote("deleteSubtask")];
			_listSyncConnections_decorators = [Remote("listSyncConnections")];
			_createSyncConnection_decorators = [Remote("createSyncConnection")];
			_updateSyncConnection_decorators = [Remote("updateSyncConnection")];
			_deleteSyncConnection_decorators = [Remote("deleteSyncConnection")];
			_listSyncOrganizations_decorators = [Remote("listSyncOrganizations")];
			_listWorkitems_decorators = [Remote("listWorkitems")];
			_listWorkitemFields_decorators = [Remote("listWorkitemFields")];
			_getWorkitemDescription_decorators = [Remote("getWorkitemDescription")];
			_listSyncRules_decorators = [Remote("listSyncRules")];
			_createSyncRule_decorators = [Remote("createSyncRule")];
			_updateSyncRule_decorators = [Remote("updateSyncRule")];
			_deleteSyncRule_decorators = [Remote("deleteSyncRule")];
			_getSyncMetadata_decorators = [Remote("getSyncMetadata")];
			_testSyncConnection_decorators = [Remote("testSyncConnection")];
			_startSync_decorators = [Remote("startSync")];
			_getSyncRun_decorators = [Remote("getSyncRun")];
			_listSyncRuns_decorators = [Remote("listSyncRuns")];
			_listSyncItemResults_decorators = [Remote("listSyncItemResults")];
			__esDecorate(this, null, _getSyncAuthState_decorators, {
				kind: "method",
				name: "getSyncAuthState",
				static: false,
				private: false,
				access: {
					has: (obj) => "getSyncAuthState" in obj,
					get: (obj) => obj.getSyncAuthState
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _beginSyncAuthorization_decorators, {
				kind: "method",
				name: "beginSyncAuthorization",
				static: false,
				private: false,
				access: {
					has: (obj) => "beginSyncAuthorization" in obj,
					get: (obj) => obj.beginSyncAuthorization
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _cancelSyncAuthorization_decorators, {
				kind: "method",
				name: "cancelSyncAuthorization",
				static: false,
				private: false,
				access: {
					has: (obj) => "cancelSyncAuthorization" in obj,
					get: (obj) => obj.cancelSyncAuthorization
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _disconnectSyncAuthorization_decorators, {
				kind: "method",
				name: "disconnectSyncAuthorization",
				static: false,
				private: false,
				access: {
					has: (obj) => "disconnectSyncAuthorization" in obj,
					get: (obj) => obj.disconnectSyncAuthorization
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
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
			__esDecorate(this, null, _calculateStatistics_decorators, {
				kind: "method",
				name: "calculateStatistics",
				static: false,
				private: false,
				access: {
					has: (obj) => "calculateStatistics" in obj,
					get: (obj) => obj.calculateStatistics
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _startStatistics_decorators, {
				kind: "method",
				name: "startStatistics",
				static: false,
				private: false,
				access: {
					has: (obj) => "startStatistics" in obj,
					get: (obj) => obj.startStatistics
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getStatisticsRun_decorators, {
				kind: "method",
				name: "getStatisticsRun",
				static: false,
				private: false,
				access: {
					has: (obj) => "getStatisticsRun" in obj,
					get: (obj) => obj.getStatisticsRun
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _cancelStatistics_decorators, {
				kind: "method",
				name: "cancelStatistics",
				static: false,
				private: false,
				access: {
					has: (obj) => "cancelStatistics" in obj,
					get: (obj) => obj.cancelStatistics
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
			__esDecorate(this, null, _listSyncConnections_decorators, {
				kind: "method",
				name: "listSyncConnections",
				static: false,
				private: false,
				access: {
					has: (obj) => "listSyncConnections" in obj,
					get: (obj) => obj.listSyncConnections
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _createSyncConnection_decorators, {
				kind: "method",
				name: "createSyncConnection",
				static: false,
				private: false,
				access: {
					has: (obj) => "createSyncConnection" in obj,
					get: (obj) => obj.createSyncConnection
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _updateSyncConnection_decorators, {
				kind: "method",
				name: "updateSyncConnection",
				static: false,
				private: false,
				access: {
					has: (obj) => "updateSyncConnection" in obj,
					get: (obj) => obj.updateSyncConnection
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteSyncConnection_decorators, {
				kind: "method",
				name: "deleteSyncConnection",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteSyncConnection" in obj,
					get: (obj) => obj.deleteSyncConnection
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listSyncOrganizations_decorators, {
				kind: "method",
				name: "listSyncOrganizations",
				static: false,
				private: false,
				access: {
					has: (obj) => "listSyncOrganizations" in obj,
					get: (obj) => obj.listSyncOrganizations
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listWorkitems_decorators, {
				kind: "method",
				name: "listWorkitems",
				static: false,
				private: false,
				access: {
					has: (obj) => "listWorkitems" in obj,
					get: (obj) => obj.listWorkitems
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listWorkitemFields_decorators, {
				kind: "method",
				name: "listWorkitemFields",
				static: false,
				private: false,
				access: {
					has: (obj) => "listWorkitemFields" in obj,
					get: (obj) => obj.listWorkitemFields
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getWorkitemDescription_decorators, {
				kind: "method",
				name: "getWorkitemDescription",
				static: false,
				private: false,
				access: {
					has: (obj) => "getWorkitemDescription" in obj,
					get: (obj) => obj.getWorkitemDescription
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listSyncRules_decorators, {
				kind: "method",
				name: "listSyncRules",
				static: false,
				private: false,
				access: {
					has: (obj) => "listSyncRules" in obj,
					get: (obj) => obj.listSyncRules
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _createSyncRule_decorators, {
				kind: "method",
				name: "createSyncRule",
				static: false,
				private: false,
				access: {
					has: (obj) => "createSyncRule" in obj,
					get: (obj) => obj.createSyncRule
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _updateSyncRule_decorators, {
				kind: "method",
				name: "updateSyncRule",
				static: false,
				private: false,
				access: {
					has: (obj) => "updateSyncRule" in obj,
					get: (obj) => obj.updateSyncRule
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteSyncRule_decorators, {
				kind: "method",
				name: "deleteSyncRule",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteSyncRule" in obj,
					get: (obj) => obj.deleteSyncRule
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getSyncMetadata_decorators, {
				kind: "method",
				name: "getSyncMetadata",
				static: false,
				private: false,
				access: {
					has: (obj) => "getSyncMetadata" in obj,
					get: (obj) => obj.getSyncMetadata
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _testSyncConnection_decorators, {
				kind: "method",
				name: "testSyncConnection",
				static: false,
				private: false,
				access: {
					has: (obj) => "testSyncConnection" in obj,
					get: (obj) => obj.testSyncConnection
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _startSync_decorators, {
				kind: "method",
				name: "startSync",
				static: false,
				private: false,
				access: {
					has: (obj) => "startSync" in obj,
					get: (obj) => obj.startSync
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getSyncRun_decorators, {
				kind: "method",
				name: "getSyncRun",
				static: false,
				private: false,
				access: {
					has: (obj) => "getSyncRun" in obj,
					get: (obj) => obj.getSyncRun
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listSyncRuns_decorators, {
				kind: "method",
				name: "listSyncRuns",
				static: false,
				private: false,
				access: {
					has: (obj) => "listSyncRuns" in obj,
					get: (obj) => obj.listSyncRuns
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listSyncItemResults_decorators, {
				kind: "method",
				name: "listSyncItemResults",
				static: false,
				private: false,
				access: {
					has: (obj) => "listSyncItemResults" in obj,
					get: (obj) => obj.listSyncItemResults
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
		sync;
		statistics;
		authorization;
		constructor(ctx, store, sync, statistics, authorization) {
			super(ctx, "taskList");
			this.store = store;
			this.sync = sync;
			this.statistics = statistics;
			this.authorization = authorization;
		}
		async getSyncAuthState(request) {
			return this.authorization.state(request);
		}
		async beginSyncAuthorization(request) {
			return this.authorization.begin(request);
		}
		async cancelSyncAuthorization(request) {
			return this.authorization.cancel(request);
		}
		async disconnectSyncAuthorization(request) {
			return this.authorization.disconnect(request);
		}
		async capabilities(request) {
			return {
				version: 1,
				richText: true,
				attachments: true
			};
		}
		/** Fold the requested range to completion; the polling client uses `startStatistics` instead. */
		async calculateStatistics(request) {
			return this.statistics.calculate(statisticsRunRequest(request));
		}
		/** Start one background statistics sweep the browser can poll and cancel. */
		async startStatistics(request) {
			return { jobId: this.statistics.start(statisticsRunRequest(request)) };
		}
		/** Read the current progress, result, or failure of one sweep. */
		async getStatisticsRun(request) {
			if (typeof request?.jobId !== "string") throw new Error("invalid statistics job");
			return this.statistics.get(request.jobId);
		}
		/** Stop one running sweep. */
		async cancelStatistics(request) {
			if (typeof request?.jobId !== "string") throw new Error("invalid statistics job");
			return { cancelled: this.statistics.cancel(request.jobId) };
		}
		async listTasks(request) {
			const page = this.store.list(request ?? {});
			return {
				...page,
				items: this.sync.attachSources(page.items)
			};
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
		async listSyncConnections(request) {
			const connections = await this.sync.listSyncConnections();
			return this.authorization ? Promise.all(connections.map((connection) => this.authorization.decorate(connection))) : connections;
		}
		async createSyncConnection(request) {
			return this.sync.createSyncConnection(request);
		}
		async updateSyncConnection(request) {
			const connection = await this.sync.updateSyncConnection(request);
			return this.authorization ? this.authorization.decorate(connection) : connection;
		}
		async deleteSyncConnection(request) {
			if (this.authorization) {
				await this.authorization.deleteConnection(request);
				await this.sync.forgetSecret(request.id);
				return { deleted: true };
			}
			return this.sync.deleteSyncConnection(request);
		}
		/** Organizations a 云效 token can see; the typed token is used once and not stored. */
		async listSyncOrganizations(request) {
			return this.sync.listSyncOrganizations(request);
		}
		/** One page of remote work items, projected to the fields the caller named. */
		async listWorkitems(request) {
			return this.sync.listWorkitems(request);
		}
		/** The platform's own column catalog for one project category. */
		async listWorkitemFields(request) {
			return this.sync.listWorkitemFields(request);
		}
		/** One work item's body, for prefilling a new local task. */
		async getWorkitemDescription(request) {
			return this.sync.getWorkitemDescription(request);
		}
		async listSyncRules(request) {
			return this.sync.listSyncRules();
		}
		async createSyncRule(request) {
			return this.sync.createSyncRule(request);
		}
		async updateSyncRule(request) {
			return this.sync.updateSyncRule(request);
		}
		async deleteSyncRule(request) {
			return this.sync.deleteSyncRule(request);
		}
		async getSyncMetadata(request) {
			return this.sync.getSyncMetadata(request);
		}
		async testSyncConnection(request) {
			return this.sync.testSyncConnection(request);
		}
		async startSync(request) {
			return this.sync.startSync();
		}
		async getSyncRun(request) {
			return this.sync.getSyncRun(request);
		}
		async listSyncRuns(request) {
			return this.sync.listSyncRuns(request);
		}
		async listSyncItemResults(request) {
			return this.sync.listSyncItemResults(request);
		}
	};
})();
//#endregion
//#region src/statistics-source.ts
function notStored(error) {
	return error instanceof Error && (error.name === "SessionPersistenceNotFoundError" || /\bnot found\b/iu.test(error.message));
}
/** Read one complete stored log without taking ownership; the closers that balance a torn turn cannot affect these counts. */
async function readStored(persistence, id, signal) {
	const options = signal === void 0 ? void 0 : { signal };
	const handle = await persistence.open(id, "read", options);
	try {
		const read = await handle.read(0, void 0, options);
		return {
			inheritedEventCount: handle.inheritedEventCount,
			events: read.events
		};
	} finally {
		await handle.close();
	}
}
function sessionQuerySource(query) {
	return {
		list: async () => (await query.listSessions()).map(({ header, live }) => ({
			id: header.id,
			createdAt: header.createdAt,
			...header.origin === void 0 ? {} : { origin: header.origin },
			...live === void 0 ? {} : { live },
			stored: true
		})),
		read: (record) => query.readSession(record.id)
	};
}
function persistenceSource(persistence, fallback) {
	return {
		async list(signal) {
			return (await persistence.list(signal === void 0 ? void 0 : { signal })).map((snapshot) => ({
				id: snapshot.header.id,
				createdAt: snapshot.header.createdAt,
				...snapshot.header.origin === void 0 ? {} : { origin: snapshot.header.origin },
				...snapshot.revision === void 0 ? {} : { revision: snapshot.revision },
				stored: snapshot.sizeBytes !== void 0
			}));
		},
		async read(record, signal) {
			if (record.stored !== false) try {
				return await readStored(persistence, record.id, signal);
			} catch (error) {
				if (!notStored(error) || fallback === void 0) throw error;
			}
			if (fallback === void 0) throw new Error(`session "${record.id}" is not readable`);
			return fallback.readSession(record.id);
		}
	};
}
/**
* Resolve the best available read surface for statistics.
*
* The persistence seam is preferred: `open` resolves one session directly, while
* the query service re-lists the whole corpus for every single `readSession`,
* which turns a corpus sweep quadratic. The query service stays the fallback for
* compositions without a persistence backend.
* @param ctx - host context carrying either service.
* @returns the resolved source.
* @throws when neither service is mounted.
*/
function createStatisticsSource(ctx) {
	const query = ctx.get("sessionQuery");
	const usableQuery = query && typeof query.listSessions === "function" && typeof query.readSession === "function" ? query : void 0;
	const persistence = ctx.get("sessionPersistence");
	if (persistence && typeof persistence.list === "function" && typeof persistence.open === "function") return persistenceSource(persistence, usableQuery);
	if (usableQuery !== void 0) return sessionQuerySource(usableQuery);
	throw new Error("Session statistics require the Harness sessionQuery service (listSessions/readSession) or a session persistence backend. Reload or upgrade the host.");
}
//#endregion
//#region src/sync/dto.ts
/** Fields each platform can actually carry, in the order its editor shows them. */
const WORKITEM_FILL_FIELDS_BY_PLATFORM = {
	yunxiao: [
		"title",
		"description",
		"number",
		"status",
		"assignee",
		"sprint",
		"priority",
		"customFields",
		"source"
	],
	tapd: [
		"title",
		"description",
		"number",
		"status",
		"assignee",
		"sprint",
		"priority",
		"tags",
		"creator"
	]
};
/** What a connection pre-fills before the user has chosen anything. */
const DEFAULT_WORKITEM_FILL_FIELDS = [
	"title",
	"description",
	"number",
	"status",
	"assignee",
	"priority"
];
//#endregion
//#region src/sync/mapping.ts
/** The local statuses a rule maps; every one must carry a platform target. */
const RULE_STATUSES = [
	"todo",
	"in_progress",
	"done"
];
/**
* Whether a rule maps every local status to a platform status. A rule without a
* complete mapping cannot write back, so it is refused before it is enabled
* instead of failing item by item during a run.
*/
function statusMappingReady(statusWriteStates) {
	if (statusWriteStates === null || statusWriteStates === void 0) return false;
	return RULE_STATUSES.every((status) => typeof statusWriteStates[status] === "string" && statusWriteStates[status].trim() !== "");
}
/**
* Encode a canonical status for writing. When the observed raw status already
* maps to the target, the finer-grained raw value is preserved instead of
* collapsing it to the write target. An unmapped target is rejected rather than
* guessed.
*/
function encodeStatus(target, observedRaw, statusWriteStates) {
	const write = statusWriteStates[target];
	if (write === void 0 || write.trim() === "") throw syncRemoteError(syncError("MappingIncompatible", {
		scope: "item",
		field: "status"
	}));
	return observedRaw === write ? observedRaw : write;
}
//#endregion
//#region src/sync/query/filters.ts
/**
* className/format pairs measured with real responses (assignedTo/user+list,
* status/status+list, sprint/sprint+list, workitemType/workitemType+list,
* priority/list+list, tag/tag+multiList, subject/string+input, dates/dateTime+input).
* A wrong pair is silently ignored by the platform, so the adapter never let a
* caller pick one.
*/
const SPEC = {
	assignedTo: {
		className: "user",
		format: "list",
		operators: ["EQUALS", "CONTAINS"]
	},
	creator: {
		className: "user",
		format: "list",
		operators: ["EQUALS", "CONTAINS"]
	},
	status: {
		className: "status",
		format: "list",
		operators: ["EQUALS", "CONTAINS"]
	},
	statusStage: {
		className: "statusStage",
		format: "list",
		operators: ["EQUALS"]
	},
	sprint: {
		className: "sprint",
		format: "list",
		operators: ["CONTAINS"]
	},
	workitemType: {
		className: "workitemType",
		format: "list",
		operators: ["EQUALS", "CONTAINS"]
	},
	priority: {
		className: "list",
		format: "list",
		operators: ["EQUALS", "CONTAINS"]
	},
	tag: {
		className: "tag",
		format: "multiList",
		operators: ["CONTAINS"]
	},
	subject: {
		className: "string",
		format: "input",
		operators: ["CONTAINS"]
	},
	gmtCreate: {
		className: "dateTime",
		format: "input",
		operators: ["BETWEEN"]
	},
	gmtModified: {
		className: "dateTime",
		format: "input",
		operators: ["BETWEEN"]
	},
	updateStatusAt: {
		className: "dateTime",
		format: "input",
		operators: ["BETWEEN"]
	}
};
const MAX_GROUPS = 10;
const MAX_CONDITIONS = 20;
const MAX_VALUES = 50;
const VALUE_LIMIT = 200;
const CONTROL$10 = /[\u0000-\u001f]/u;
const DATETIME$1 = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/u;
function invalid$2(field) {
	throw syncRemoteError(syncError("InvalidConfig", {
		scope: "query",
		field
	}));
}
function checkedValue(field, value) {
	if (typeof value !== "string" || !value.trim() || value.length > VALUE_LIMIT || CONTROL$10.test(value)) invalid$2(`filters.${field}`);
	return value;
}
/**
* Build the `conditions` JSON string the search endpoint expects, or
* `undefined` when there is nothing to filter — the endpoint treats an absent
* `conditions` differently from an empty array, so callers must omit it.
*
* This is also the single validator for a stored rule query: it refuses an
* unknown field, an operator the field does not accept, and a value shape the
* platform silently ignores, so a malformed rule fails at parse time instead of
* discovering the whole project.
*/
function buildConditions(groups) {
	if (groups === void 0 || groups.length === 0) return void 0;
	if (groups.length > MAX_GROUPS) invalid$2("conditions");
	const conditionGroups = [];
	for (const group of groups) {
		if (group.length === 0) continue;
		if (group.length > MAX_CONDITIONS) invalid$2("conditions");
		const conditions = [];
		for (const condition of group) {
			const spec = SPEC[condition.field];
			if (spec === void 0) invalid$2("conditions.field");
			const operator = condition.operator ?? spec.operators[0];
			if (!spec.operators.includes(operator)) invalid$2(`conditions.operator(${condition.field})`);
			if (!Array.isArray(condition.value) || condition.value.length === 0 || condition.value.length > MAX_VALUES) invalid$2(`conditions.value(${condition.field})`);
			const value = condition.value.map((item) => checkedValue(condition.field, item));
			const entry = {
				fieldIdentifier: condition.field,
				operator,
				value,
				toValue: null,
				className: spec.className,
				format: spec.format
			};
			if (operator === "BETWEEN") {
				if (condition.value.length !== 1 || !DATETIME$1.test(value[0])) invalid$2(`conditions.value(${condition.field})`);
				const to = condition.toValue;
				if (typeof to !== "string" || !DATETIME$1.test(to)) invalid$2(`conditions.toValue(${condition.field})`);
				entry.toValue = to;
			}
			conditions.push(entry);
		}
		if (conditions.length > 0) conditionGroups.push(conditions);
	}
	if (conditionGroups.length === 0) return void 0;
	return JSON.stringify({ conditionGroups });
}
const CONDITION_FIELDS = Object.keys(SPEC).map((field) => ({
	field,
	operators: SPEC[field].operators,
	source: sourceOf(field)
}));
function sourceOf(field) {
	switch (field) {
		case "status": return "status";
		case "statusStage": return "stage";
		case "assignedTo":
		case "creator": return "user";
		case "priority": return "priority";
		case "sprint": return "sprint";
		case "workitemType": return "type";
		case "gmtCreate":
		case "gmtModified":
		case "updateStatusAt": return "date";
		default: return "text";
	}
}
Object.keys(SPEC);
//#endregion
//#region src/sync/query/fields.ts
const ID_LIMIT$6 = 200;
const TEXT_LIMIT$1 = 1e3;
/** Ids reject every control character; free text keeps tabs and newlines. */
const CONTROL$9 = /[\u0000-\u001f]/u;
const TEXT_CONTROL$1 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;
/**
* Fields a work-item list may carry. The platform returns a fixed payload for
* every search row, but callers name what they need and the adapter projects
* exactly that — so a list page never drags description bodies or comment
* threads across the wire.
*
* `description` is deliberately absent: it is detail-only content (one extra
* `GET /workitems/{id}`) and asking for it here fails closed.
*/
const LIST_FIELDS = [
	"id",
	"serialNumber",
	"subject",
	"status",
	"statusStage",
	"workitemType",
	"category",
	"space",
	"assignedTo",
	"creator",
	"modifier",
	"verifier",
	"participants",
	"trackers",
	"sprint",
	"labels",
	"versions",
	"customFields",
	"logicalStatus",
	"parentId",
	"gmtCreate",
	"gmtModified",
	"updateStatusAt"
];
/** Requested name -> key in the platform payload. */
const FIELD_KEYS = {
	id: "id",
	serialNumber: "serialNumber",
	subject: "subject",
	status: "status",
	statusStage: "statusStageId",
	workitemType: "workitemType",
	category: "categoryId",
	space: "space",
	assignedTo: "assignedTo",
	creator: "creator",
	modifier: "modifier",
	verifier: "verifier",
	participants: "participants",
	trackers: "trackers",
	sprint: "sprint",
	labels: "labels",
	versions: "versions",
	customFields: "customFieldValues",
	logicalStatus: "logicalStatus",
	parentId: "parentId",
	gmtCreate: "gmtCreate",
	gmtModified: "gmtModified",
	updateStatusAt: "updateStatusAt"
};
/** Detail-only fields that must never be requested from the list surface. */
const DETAIL_ONLY = /* @__PURE__ */ new Set([
	"description",
	"formatType",
	"comments",
	"relations",
	"activities",
	"attachments"
]);
const FIELD_SET = new Set(LIST_FIELDS);
/** The platform's placeholder id for "no parent"; the adapter reports it as null. */
const EMPTY_VALUE = "EMPTY_VALUE";
function fail$7(field) {
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field
	}));
}
function invalidConfig(field) {
	throw syncRemoteError(syncError("InvalidConfig", {
		scope: "query",
		field
	}));
}
function isPlainObject$5(value) {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
function isJsonValue$1(value) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) return value.every(isJsonValue$1);
	if (typeof value === "object") return isPlainObject$5(value) && Object.values(value).every(isJsonValue$1);
	return false;
}
function boundedText(value) {
	if (typeof value !== "string" || value.length > TEXT_LIMIT$1 || TEXT_CONTROL$1.test(value)) return null;
	return value;
}
function boundedId(value) {
	if (typeof value !== "string" || !value.trim() || value.length > ID_LIMIT$6 || CONTROL$9.test(value)) return null;
	return value;
}
/** A required string field: missing or malformed is a malformed row, never a null. */
function requiredText(value, field) {
	const text = boundedText(value);
	if (text === null || text.trim() === "") fail$7(field);
	return text;
}
/** A `{ id, name }` reference, or null when the platform reports no value. */
function reference$1(value) {
	if (value === null || value === void 0) return null;
	if (!isPlainObject$5(value)) fail$7("reference");
	const id = boundedId(value.id);
	if (id === null) fail$7("reference.id");
	return {
		id,
		name: boundedText(value.name) ?? ""
	};
}
/** A `{ id, name }` reference with the status extras the platform adds. */
function statusReference(value) {
	if (value === null || value === void 0) return null;
	if (!isPlainObject$5(value)) fail$7("status");
	const id = boundedId(value.id);
	if (id === null) fail$7("status.id");
	const name = boundedText(value.name) ?? "";
	const displayName = boundedText(value.displayName) ?? name;
	const nameEn = boundedText(value.nameEn);
	return {
		id,
		name,
		displayName,
		...nameEn === null ? {} : { nameEn }
	};
}
/** A `{ id, name, color }` label. */
function label$2(value) {
	const ref = reference$1(value);
	if (ref === null) fail$7("label");
	const color = isPlainObject$5(value) && typeof value.color === "string" && value.color.length <= 32 && !CONTROL$9.test(value.color) ? value.color : null;
	return {
		...ref,
		color
	};
}
function references(value, field) {
	if (value === null || value === void 0) return null;
	if (!Array.isArray(value)) fail$7(field);
	return value.map((item) => reference$1(item) ?? fail$7(field));
}
function labels(value) {
	if (value === null || value === void 0) return null;
	if (!Array.isArray(value)) fail$7("labels");
	return value.map((item) => label$2(item));
}
/** One `customFieldValues[]` entry, projected to the stable display shape. */
function customField(value) {
	if (!isPlainObject$5(value)) fail$7("customFieldValues");
	const fieldId = boundedId(value.fieldId);
	if (fieldId === null) fail$7("customFieldValues.fieldId");
	const values = value.values;
	if (!Array.isArray(values)) fail$7("customFieldValues.values");
	return {
		fieldId,
		fieldName: boundedText(value.fieldName) ?? "",
		fieldFormat: boundedText(value.fieldFormat) ?? "",
		values: values.map((entry) => {
			if (!isPlainObject$5(entry)) fail$7("customFieldValues.values");
			const display = boundedText(entry.displayValue) ?? "";
			return {
				identifier: boundedText(entry.identifier) ?? display,
				displayValue: display
			};
		})
	};
}
function customFields(value, only) {
	if (value === null || value === void 0) return [];
	if (!Array.isArray(value)) fail$7("customFieldValues");
	const projected = value.map((entry) => customField(entry));
	return only === null ? projected : projected.filter((entry) => only.has(entry.fieldId));
}
/** Keep only the payload's own numbers; anything else becomes null. */
function epoch$1(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function listValue(field, raw, onlyFields) {
	const value = raw[FIELD_KEYS[field]];
	switch (field) {
		case "id": return requiredText(value, "item.id");
		case "logicalStatus":
		case "serialNumber":
		case "subject": return value === void 0 ? null : requiredText(value, `item.${field}`);
		case "statusStage": return value === void 0 || value === null ? null : boundedId(value);
		case "parentId": {
			const id = value === void 0 || value === null ? null : boundedId(value);
			return id === null || id === EMPTY_VALUE ? null : id;
		}
		case "customFields": return customFields(value, onlyFields);
		case "labels": return labels(value);
		case "participants":
		case "trackers": return references(value, field);
		case "versions":
			if (value === null || value === void 0) return null;
			if (!Array.isArray(value) || !value.every(isJsonValue$1)) fail$7("versions");
			return value;
		case "status": return statusReference(value);
		case "workitemType":
		case "space":
		case "assignedTo":
		case "creator":
		case "modifier":
		case "verifier":
		case "sprint": return reference$1(value);
		case "category": return value === void 0 || value === null ? null : boundedText(value);
		case "gmtCreate":
		case "gmtModified":
		case "updateStatusAt": return epoch$1(value);
		default: fail$7("fields");
	}
}
/**
* Resolve a caller's field list. `'*'` expands to every list field; unknown or
* detail-only names fail closed rather than silently returning nothing. `id` is
* always present — it is the row identity every caller needs to key on.
*/
function resolveListFields(fields) {
	const out = ["id"];
	const seen = /* @__PURE__ */ new Set(["id"]);
	if (fields === void 0 || fields.length === 0) {
		for (const field of LIST_FIELDS) if (!seen.has(field)) {
			seen.add(field);
			out.push(field);
		}
		return out;
	}
	for (const name of fields) {
		if (name === "*") {
			for (const field of LIST_FIELDS) if (!seen.has(field)) {
				seen.add(field);
				out.push(field);
			}
			continue;
		}
		if (DETAIL_ONLY.has(name)) invalidConfig(`fields(${name})`);
		if (!FIELD_SET.has(name)) invalidConfig(`fields(${name})`);
		if (seen.has(name)) continue;
		seen.add(name);
		out.push(name);
	}
	return out;
}
/**
* Project one platform work-item row down to the requested fields. Values keep
* the platform's meaning (ids stay strings, timestamps stay epoch numbers) but
* every shape is verified, so a malformed row is reported instead of rendered.
*/
function projectWorkitem(raw, fields, options = {}) {
	if (!isPlainObject$5(raw)) fail$7("item");
	if (!isJsonValue$1(raw)) fail$7("item");
	const only = options.customFieldIds ?? null;
	const out = {};
	for (const field of fields) out[field] = listValue(field, raw, only);
	return out;
}
//#endregion
//#region src/sync/validation.ts
const CONTROL$8 = /[\u0000-\u001f]/u;
const ENV_NAME$1 = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const FORBIDDEN = /* @__PURE__ */ new Set([
	"__proto__",
	"constructor",
	"prototype"
]);
const ID_LIMIT$5 = 200;
const ENV_LIMIT$1 = 128;
new Set(DOC_KEYS);
function fail$6(scope, field) {
	throw syncRemoteError(syncError("InvalidConfig", {
		scope,
		field
	}));
}
function isPlainObject$4(value) {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
function isJsonValue(value) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) return value.every(isJsonValue);
	if (typeof value === "object") return isPlainObject$4(value) && Object.values(value).every(isJsonValue);
	return false;
}
/** Plain-object + prototype-pollution + JSON-value checks; unknown keys are checked separately. */
function parseObject(scope, value, field) {
	if (!isPlainObject$4(value)) fail$6(scope, field);
	const object = value;
	for (const key of Object.keys(object)) if (FORBIDDEN.has(key)) fail$6(scope, field);
	if (!isJsonValue(object)) fail$6(scope, field);
	return object;
}
function closedKeys(scope, object, allowed, field) {
	for (const key of Object.keys(object)) if (!allowed.has(key)) fail$6(scope, field);
}
/** Non-blank, length-bounded, control-free text; `trim=false` preserves the original identity. */
function text$2(scope, value, field, max, trim) {
	if (typeof value !== "string") fail$6(scope, field);
	const normalized = trim ? value.trim() : value;
	if (!normalized.trim() || normalized.length > max || CONTROL$8.test(normalized)) fail$6(scope, field);
	return normalized;
}
function envName(scope, value, field) {
	if (typeof value !== "string" || !ENV_NAME$1.test(value) || value.length > ENV_LIMIT$1) fail$6(scope, field);
	return value;
}
function parseConnectionAuth(value) {
	const scope = "connection";
	const auth = parseObject(scope, value, "authentication");
	if (auth.mode === "manual") {
		closedKeys(scope, auth, /* @__PURE__ */ new Set(["mode"]), "authentication");
		return { mode: "manual" };
	}
	if (auth.mode !== "oauth") fail$6(scope, "authentication");
	closedKeys(scope, auth, /* @__PURE__ */ new Set([
		"mode",
		"appId",
		"appSecretRef",
		"callbackUrl"
	]), "authentication");
	return {
		mode: "oauth",
		...auth.appId !== void 0 ? { appId: text$2(scope, auth.appId, "appId", ID_LIMIT$5, true) } : {},
		...auth.appSecretRef !== void 0 ? { appSecretRef: envName(scope, auth.appSecretRef, "appSecretRef") } : {},
		...auth.callbackUrl !== void 0 ? { callbackUrl: text$2(scope, auth.callbackUrl, "callbackUrl", 2048, true) } : {}
	};
}
new Set(LIST_FIELDS);
/**
* The verified field/operator matrix, imported from the platform request builder
* so a rule query and the wire request can never disagree about which operator a
* field accepts.
*/
const CONDITION_SPECS = new Map(CONDITION_FIELDS.map((spec) => [spec.field, spec]));
new Set(CONDITION_SPECS.keys());
const CONNECTION_BASE_KEYS = [
	"id",
	"name",
	"enabled",
	"revision",
	"credentialPresent",
	"instance",
	"platform",
	"authentication",
	"fillFields"
];
[...CONNECTION_BASE_KEYS];
[...CONNECTION_BASE_KEYS];
//#endregion
//#region src/sync/config-store.ts
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const NAME_LIMIT = 100;
const ID_LIMIT$4 = 200;
const ENV_LIMIT = 128;
const LIST_LIMIT = 100;
const CONTROL$7 = /[\u0000-\u001f]/u;
function validateName(scope, value) {
	if (!value.trim() || value.length > NAME_LIMIT) throw syncRemoteError(syncError("InvalidConfig", {
		scope,
		field: "name"
	}));
}
function validateEnvName(scope, field, value) {
	if (!ENV_NAME.test(value) || value.length > ENV_LIMIT) throw syncRemoteError(syncError("InvalidConfig", {
		scope,
		field
	}));
}
function validateId(scope, field, value) {
	if (!value.trim() || value.length > ID_LIMIT$4) throw syncRemoteError(syncError("InvalidConfig", {
		scope,
		field
	}));
}
function validateRegionHost(mode, regionHost) {
	if (mode === "region" && (!regionHost || !regionHost.trim())) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "regionHost"
	}));
}
/**
* A center organization is what reaches the API, so a normal connection must
* carry one — but a 云效 OAuth connection may be saved first and pick its
* organization from the account's own list afterwards.
*/
function validateCenterOrganizationId(mode, organizationId, oauth) {
	const malformed = organizationId !== null && organizationId !== void 0 && (organizationId.length > ID_LIMIT$4 || CONTROL$7.test(organizationId));
	if (oauth) {
		if (malformed) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "organizationId"
		}));
		return;
	}
	if (mode === "center" && (malformed || !organizationId || !organizationId.trim())) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "organizationId"
	}));
}
/** The stored rule query, through the same validator the platform request uses. */
function validateRuleQuery(conditions) {
	if (!Array.isArray(conditions)) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "rule",
		field: "conditions"
	}));
	try {
		buildConditions(conditions);
	} catch {
		throw syncRemoteError(syncError("InvalidConfig", {
			scope: "rule",
			field: "conditions"
		}));
	}
	if (conditions.length > LIST_LIMIT) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "rule",
		field: "conditions"
	}));
}
/** Refuse an incomplete status mapping: a rule that cannot write status back is not usable. */
function validateStatusMap(statusWriteStates) {
	if (!statusMappingReady(statusWriteStates ?? null)) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "rule",
		field: "statusWriteStates"
	}));
}
function parseStored$1(text, field) {
	try {
		return JSON.parse(text);
	} catch {
		throw syncRemoteError(syncError("StorageFailure", {
			scope: "config",
			field
		}));
	}
}
/**
* Stable remote-service identity. For tapd the company identifies the instance,
* for yunxiao center the organization does (official host is constant), and for
* yunxiao region the region host does. Credential env names never affect it.
*/
function instanceOf(connection) {
	if (connection.platform === "tapd") return connection.companyId ?? "";
	if (connection.mode === "region") return connection.regionHost ?? "";
	return connection.organizationId ?? "";
}
function toSafeConnection(row, env) {
	const authentication = parseConnectionAuth(parseStored$1(row.authentication, "authentication"));
	const fillFields = toFillFields(row.fill_fields, row.platform);
	if (row.platform === "yunxiao") {
		const credentialPresent = env()[row.token_env] !== void 0;
		return {
			fillFields,
			id: row.id,
			name: row.name,
			enabled: row.enabled === 1,
			revision: row.revision,
			authentication,
			credentialPresent: authentication.mode === "oauth" ? false : credentialPresent,
			instance: row.instance,
			platform: "yunxiao",
			mode: row.mode,
			organizationId: row.organization_id,
			regionHost: row.region_host,
			tokenEnv: row.token_env
		};
	}
	const credentialPresent = env()[row.token_env] !== void 0;
	return {
		fillFields,
		id: row.id,
		name: row.name,
		enabled: row.enabled === 1,
		revision: row.revision,
		authentication,
		credentialPresent: authentication.mode === "oauth" ? false : credentialPresent,
		instance: row.instance,
		platform: "tapd",
		companyId: row.company_id,
		tokenEnv: row.token_env
	};
}
/**
* The stored prefill selection normalized to the connection's platform, or the
* default set when a connection predates the column (NULL) or carries something
* unreadable. The two platforms carry different fields, so an id belonging to
* the other one is dropped rather than handed to a caller that cannot use it.
*/
function toFillFields(stored, platform) {
	const allowed = new Set(WORKITEM_FILL_FIELDS_BY_PLATFORM[platform]);
	if (stored === null) return [...DEFAULT_WORKITEM_FILL_FIELDS];
	let parsed;
	try {
		parsed = JSON.parse(stored);
	} catch {
		return [...DEFAULT_WORKITEM_FILL_FIELDS];
	}
	if (!Array.isArray(parsed)) return [...DEFAULT_WORKITEM_FILL_FIELDS];
	const kept = WORKITEM_FILL_FIELDS_BY_PLATFORM[platform].filter((field) => parsed.includes(field) && allowed.has(field));
	return kept.length > 0 ? [...kept] : [...DEFAULT_WORKITEM_FILL_FIELDS];
}
/** Refuse a selection that names a field the connection's platform cannot carry. */
function validateFillFields(platform, fields) {
	const allowed = new Set(WORKITEM_FILL_FIELDS_BY_PLATFORM[platform]);
	for (const field of fields) if (!allowed.has(field)) throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "fillFields"
	}));
}
/** The selection as stored: the platform's own order, defaults when empty. */
function storedFillFields(platform, fields) {
	const kept = WORKITEM_FILL_FIELDS_BY_PLATFORM[platform].filter((field) => fields.includes(field));
	return JSON.stringify(kept.length > 0 ? kept : DEFAULT_WORKITEM_FILL_FIELDS);
}
function toSyncRule(row) {
	const storedStates = parseStored$1(row.status_write_states, "statusWriteStates");
	const statusWriteStates = row.enabled === 0 && Object.keys(storedStates).length === 0 ? {
		todo: "",
		in_progress: "",
		done: ""
	} : storedStates;
	return {
		id: row.id,
		revision: row.revision,
		connectionId: row.connection_id,
		projectId: row.project_id,
		projectName: row.project_name ?? null,
		enabled: row.enabled === 1,
		workspaceId: row.workspace_id,
		conditions: parseStored$1(row.conditions, "conditions"),
		statusWriteStates
	};
}
var SyncConfigStore = class {
	db;
	env;
	constructor(db, env = () => process.env) {
		this.db = db;
		this.env = env;
	}
	listConnections() {
		return this.db.prepare("SELECT * FROM sync_connections ORDER BY name, id").all().map((row) => toSafeConnection(row, this.env));
	}
	getConnection(id) {
		const row = this.db.prepare("SELECT * FROM sync_connections WHERE id = ?").get(id);
		return row ? toSafeConnection(row, this.env) : null;
	}
	createConnection(input) {
		const id = randomUUID();
		validateName("connection", input.name);
		if (input.platform === "yunxiao") {
			validateEnvName("connection", "tokenEnv", input.tokenEnv);
			validateRegionHost(input.mode, input.regionHost);
			validateCenterOrganizationId(input.mode, input.organizationId, (input.authentication ?? { mode: "manual" }).mode === "oauth");
		} else validateEnvName("connection", "tokenEnv", input.tokenEnv);
		const authentication = parseConnectionAuth(input.authentication ?? { mode: "manual" });
		if (input.fillFields !== void 0) validateFillFields(input.platform, input.fillFields);
		const instance = instanceOf(input);
		withSqliteTransaction(this.db, () => {
			this.db.prepare(`INSERT INTO sync_connections
        (id, name, enabled, revision, instance, platform, mode, organization_id, region_host, token_env, company_id, user_env, password_env, authentication, fill_fields)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.name, input.enabled ? 1 : 0, instance, input.platform, input.platform === "yunxiao" ? input.mode : null, input.platform === "yunxiao" ? input.organizationId : null, input.platform === "yunxiao" ? input.regionHost : null, input.tokenEnv, input.platform === "tapd" ? input.companyId : null, null, null, JSON.stringify(authentication), storedFillFields(input.platform, input.fillFields ?? DEFAULT_WORKITEM_FILL_FIELDS));
		});
		return this.getConnection(id);
	}
	updateConnection(input) {
		const row = this.db.prepare("SELECT * FROM sync_connections WHERE id = ?").get(input.id);
		if (!row) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "id"
		}));
		if (input.name !== void 0) validateName("connection", input.name);
		if (input.tokenEnv !== void 0) validateEnvName("connection", "tokenEnv", input.tokenEnv);
		if (row.platform === "yunxiao") {
			if (input.companyId !== void 0) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "connection",
				field: "platform"
			}));
		} else if (input.mode !== void 0 || input.organizationId !== void 0 || input.regionHost !== void 0) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "platform"
		}));
		const authentication = parseConnectionAuth(input.authentication ?? parseStored$1(row.authentication, "authentication"));
		if (row.platform === "tapd" && authentication.mode === "oauth") throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "authentication"
		}));
		const name = input.name ?? row.name;
		const enabled = input.enabled === void 0 ? row.enabled === 1 : input.enabled;
		const mode = input.mode !== void 0 ? input.mode : row.mode;
		const organizationId = input.organizationId !== void 0 ? input.organizationId : row.organization_id;
		const regionHost = input.regionHost !== void 0 ? input.regionHost : row.region_host;
		const tokenEnv = input.tokenEnv !== void 0 ? input.tokenEnv : row.token_env;
		const companyId = input.companyId !== void 0 ? input.companyId : row.company_id;
		if (row.platform === "yunxiao") {
			validateRegionHost(mode, regionHost);
			validateCenterOrganizationId(mode, organizationId, authentication.mode === "oauth");
		}
		const instance = row.platform === "yunxiao" ? instanceOf({
			platform: "yunxiao",
			mode,
			organizationId,
			regionHost
		}) : instanceOf({
			platform: "tapd",
			companyId
		});
		if (instance !== row.instance) {
			if (this.db.prepare("SELECT 1 FROM sync_rules WHERE connection_id = ? LIMIT 1").get(input.id)) throw syncRemoteError(syncError("MappingIncompatible", { scope: "connection" }));
		}
		if (input.fillFields !== void 0) validateFillFields(row.platform, input.fillFields);
		const fillFields = input.fillFields === void 0 ? toFillFields(row.fill_fields, row.platform) : input.fillFields;
		withSqliteTransaction(this.db, () => {
			if (this.db.prepare(`UPDATE sync_connections SET name = ?, enabled = ?, instance = ?, mode = ?,
        organization_id = ?, region_host = ?, token_env = ?, company_id = ?, user_env = ?, password_env = ?, authentication = ?, fill_fields = ?,
        revision = revision + 1 WHERE id = ? AND revision = ?`).run(name, enabled ? 1 : 0, instance, mode, organizationId, regionHost, tokenEnv, companyId, null, null, JSON.stringify(authentication), storedFillFields(row.platform, fillFields), input.id, input.revision).changes !== 1) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "connection" }));
		});
		return this.getConnection(input.id);
	}
	deleteConnection(input) {
		const row = this.db.prepare("SELECT revision FROM sync_connections WHERE id = ?").get(input.id);
		if (!row) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "id"
		}));
		if (row.revision !== input.revision) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "connection" }));
		if (this.db.prepare("SELECT 1 FROM sync_rules WHERE connection_id = ? LIMIT 1").get(input.id)) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "id"
		}));
		withSqliteTransaction(this.db, () => {
			if (this.db.prepare("DELETE FROM sync_connections WHERE id = ? AND revision = ?").run(input.id, input.revision).changes !== 1) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "connection" }));
		});
	}
	listRules(connectionId) {
		return (connectionId === void 0 ? this.db.prepare("SELECT * FROM sync_rules ORDER BY project_id, id").all() : this.db.prepare("SELECT * FROM sync_rules WHERE connection_id = ? ORDER BY project_id, id").all(connectionId)).map(toSyncRule);
	}
	getRule(id) {
		const row = this.db.prepare("SELECT * FROM sync_rules WHERE id = ?").get(id);
		return row ? toSyncRule(row) : null;
	}
	/**
	* Cheap enabled check for the per-request gate: one join, no JSON parse of
	* filters/mappings. Returns false for a missing rule or a disabled rule or
	* connection.
	*/
	isRuleActive(ruleId) {
		const row = this.db.prepare(`SELECT r.enabled AS ruleEnabled, c.enabled AS connEnabled
      FROM sync_rules r JOIN sync_connections c ON c.id = r.connection_id WHERE r.id = ?`).get(ruleId);
		return row !== void 0 && row.ruleEnabled === 1 && row.connEnabled === 1;
	}
	/**
	* Build a per-rule enabled guard for the per-request gate. Only the compiled
	* statement is cached; every call re-reads the live rule/connection rows, so a
	* mid-run disable still takes effect before the next dispatch.
	*/
	createActiveGuard(ruleId) {
		const stmt = this.db.prepare(`SELECT r.enabled AS ruleEnabled, c.enabled AS connEnabled
      FROM sync_rules r JOIN sync_connections c ON c.id = r.connection_id WHERE r.id = ?`);
		return () => {
			const row = stmt.get(ruleId);
			if (row === void 0 || row.ruleEnabled !== 1 || row.connEnabled !== 1) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "rule",
				field: "enabled"
			}));
		};
	}
	createRule(input) {
		const connection = this.db.prepare("SELECT instance FROM sync_connections WHERE id = ?").get(input.connectionId);
		if (!connection) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "rule",
			field: "connectionId"
		}));
		validateId("rule", "projectId", input.projectId);
		validateRuleQuery(input.conditions);
		validateStatusMap(input.statusWriteStates);
		const instance = connection.instance;
		if (this.db.prepare("SELECT 1 FROM sync_rules WHERE instance = ? AND project_id = ?").get(instance, input.projectId)) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "rule",
			field: "projectId"
		}));
		const id = randomUUID();
		const columns = new Set(this.db.prepare("PRAGMA table_info(sync_rules)").all().map((column) => column.name));
		const legacy = columns.has("filters") && columns.has("mappings");
		if (columns.has("filters") !== columns.has("mappings")) throw syncRemoteError(syncError("StorageFailure", {
			scope: "rule",
			field: "schema"
		}));
		withSqliteTransaction(this.db, () => {
			this.db.prepare(`INSERT INTO sync_rules
        (id, revision, connection_id, instance, project_id, project_name, enabled, workspace_id, conditions, status_write_states${legacy ? ", filters, mappings" : ""})
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?${legacy ? ", ?, ?" : ""})`).run(id, input.connectionId, instance, input.projectId, input.projectName ?? null, input.enabled ? 1 : 0, input.workspaceId, JSON.stringify(input.conditions), JSON.stringify(input.statusWriteStates), ...legacy ? ["[]", "{}"] : []);
		});
		return this.getRule(id);
	}
	updateRule(input) {
		const row = this.db.prepare("SELECT * FROM sync_rules WHERE id = ?").get(input.id);
		if (!row) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "rule",
			field: "id"
		}));
		if (input.projectId !== void 0) validateId("rule", "projectId", input.projectId);
		const conditions = input.conditions ?? parseStored$1(row.conditions, "conditions");
		const statusWriteStates = input.statusWriteStates ?? parseStored$1(row.status_write_states, "statusWriteStates");
		if (input.conditions !== void 0) validateRuleQuery(conditions);
		if (input.statusWriteStates !== void 0) validateStatusMap(statusWriteStates);
		const projectId = input.projectId !== void 0 ? input.projectId : row.project_id;
		if (input.projectId !== void 0 && input.projectId !== row.project_id) {
			if (this.db.prepare("SELECT 1 FROM sync_rules WHERE instance = ? AND project_id = ? AND id != ?").get(row.instance, projectId, input.id)) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "rule",
				field: "projectId"
			}));
		}
		const enabled = input.enabled === void 0 ? row.enabled === 1 : input.enabled;
		if (enabled) validateStatusMap(statusWriteStates);
		const projectName = input.projectName !== void 0 ? input.projectName : row.project_name;
		const workspaceId = input.workspaceId !== void 0 ? input.workspaceId : row.workspace_id;
		withSqliteTransaction(this.db, () => {
			if (this.db.prepare(`UPDATE sync_rules SET project_id = ?, project_name = ?, enabled = ?, workspace_id = ?, conditions = ?, status_write_states = ?,
        revision = revision + 1 WHERE id = ? AND revision = ?`).run(projectId, projectName, enabled ? 1 : 0, workspaceId, JSON.stringify(conditions), JSON.stringify(statusWriteStates), input.id, input.revision).changes !== 1) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "rule" }));
		});
		return this.getRule(input.id);
	}
	deleteRule(input) {
		const row = this.db.prepare("SELECT revision FROM sync_rules WHERE id = ?").get(input.id);
		if (!row) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "rule",
			field: "id"
		}));
		if (row.revision !== input.revision) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "rule" }));
		if (this.db.prepare("SELECT 1 FROM sync_links WHERE rule_id = ? LIMIT 1").get(input.id)) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "rule",
			field: "id"
		}));
		withSqliteTransaction(this.db, () => {
			if (this.db.prepare("DELETE FROM sync_rules WHERE id = ? AND revision = ?").run(input.id, input.revision).changes !== 1) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "rule" }));
		});
	}
};
//#endregion
//#region src/sync/run-store.ts
/** A run's ownership lease: no heartbeat for this long hands the run to the next claimer. */
const SYNC_LEASE_MS = 9e4;
/** How often a live executor heartbeats; the lease is the authoritative expiry. */
const SYNC_HEARTBEAT_MS = 1e4;
const CATEGORY_COLUMN = {
	imported: "counts_imported",
	pulled: "counts_pulled",
	pushed: "counts_pushed",
	merged: "counts_merged",
	unchanged: "counts_unchanged",
	failed: "counts_failed"
};
function isPendingError(error) {
	return error !== null && (error.code === "WriteOutcomeUnknown" || error.code === "VerificationFailed");
}
function parseStored(text, field) {
	try {
		return JSON.parse(text);
	} catch {
		throw syncRemoteError(syncError("StorageFailure", {
			scope: "run",
			field
		}));
	}
}
function toSafeRun(row) {
	return {
		id: row.id,
		status: row.status,
		phase: row.phase,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		counts: {
			imported: row.counts_imported,
			pulled: row.counts_pulled,
			pushed: row.counts_pushed,
			merged: row.counts_merged,
			unchanged: row.counts_unchanged,
			failed: row.counts_failed,
			pending: row.counts_pending
		},
		unprocessedKnown: row.unprocessed_known,
		discoveryComplete: row.discovery_complete === 1,
		scopeSummary: row.scope_summary,
		errors: parseStored(row.errors, "errors")
	};
}
function toSafeItemResult(row) {
	const key = JSON.parse(row.canonical);
	return {
		key: {
			instance: key[0],
			projectId: key[1],
			typeId: key[2],
			id: key[3]
		},
		taskId: row.task_id,
		category: row.category,
		changedFields: JSON.parse(row.changed_fields),
		discardedFields: JSON.parse(row.discarded_fields),
		writtenBack: row.written_back === 1,
		outsideFilter: row.outside_filter === 1,
		error: row.error === null ? null : parseStored(row.error, "error")
	};
}
function adjustCount(db, runId, category, pending, delta) {
	const column = CATEGORY_COLUMN[category];
	if (delta === 1) {
		const pendingClause = pending ? ", counts_pending = counts_pending + 1" : "";
		db.prepare(`UPDATE sync_runs SET ${column} = ${column} + 1${pendingClause} WHERE id = ?`).run(runId);
	} else {
		const pendingClause = pending ? ", counts_pending = CASE WHEN counts_pending > 0 THEN counts_pending - 1 ELSE 0 END" : "";
		db.prepare(`UPDATE sync_runs SET ${column} = CASE WHEN ${column} > 0 THEN ${column} - 1 ELSE 0 END${pendingClause} WHERE id = ?`).run(runId);
	}
}
/** Real ownership check: the run_lock row must match the fence at commit time and the lease must not have expired. */
function assertRunFence(db, fence, now) {
	const lock = db.prepare("SELECT owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE run_id = ?").get(fence.runId);
	if (!lock || lock.ownerId !== fence.ownerId || lock.generation !== fence.generation || lock.leaseExpiresAt <= now) throw syncRemoteError(syncError("StaleOwner", {
		scope: "run",
		runId: fence.runId
	}));
}
/**
* Upsert one item result and keep the run's category counters consistent.
* Performs no ownership check; callers assert the fence around it.
*/
function recordRunItemResult(db, runId, result, pendingHint) {
	const canonical = serializeRemoteKey(result.key);
	const existing = db.prepare("SELECT category, pending, error FROM sync_run_items WHERE run_id = ? AND canonical = ?").get(runId, canonical);
	const errorJson = result.error === null ? null : JSON.stringify(result.error);
	const changedFields = JSON.stringify(result.changedFields);
	const discardedFields = JSON.stringify(result.discardedFields);
	const pending = pendingHint ?? isPendingError(result.error);
	if (existing) {
		const wasPending = existing.pending === 1;
		db.prepare(`UPDATE sync_run_items SET task_id = ?, category = ?, changed_fields = ?, discarded_fields = ?,
      written_back = ?, outside_filter = ?, error = ?, pending = ? WHERE run_id = ? AND canonical = ?`).run(result.taskId, result.category, changedFields, discardedFields, result.writtenBack ? 1 : 0, result.outsideFilter ? 1 : 0, errorJson, pending ? 1 : 0, runId, canonical);
		if (existing.category !== result.category || wasPending !== pending) {
			adjustCount(db, runId, existing.category, wasPending, -1);
			adjustCount(db, runId, result.category, pending, 1);
		}
	} else {
		db.prepare(`INSERT INTO sync_run_items (run_id, canonical, task_id, category, changed_fields, discarded_fields, written_back, outside_filter, error, pending)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(runId, canonical, result.taskId, result.category, changedFields, discardedFields, result.writtenBack ? 1 : 0, result.outsideFilter ? 1 : 0, errorJson, pending ? 1 : 0);
		adjustCount(db, runId, result.category, pending, 1);
	}
}
var SyncRunStore = class {
	db;
	clock;
	constructor(db, clock) {
		this.db = db;
		this.clock = clock;
	}
	/**
	* Claim the single active ownership slot for a sync run. When no lock exists,
	* or the previous lease has expired, a fresh run is created (the abandoned run
	* is marked `interrupted`) and the fence's generation advances monotonically.
	* When a live lock exists, the existing run id is returned with `existing` set;
	* only a fence whose owner matches the lock may write, so a second process can
	* observe but never silently continue the old owner's run.
	*/
	claimRun(ownerId, now) {
		return withSqliteTransaction(this.db, () => {
			const lock = this.db.prepare("SELECT run_id AS runId, owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE id = 1").get();
			if (lock && lock.leaseExpiresAt > now) return {
				fence: {
					runId: lock.runId,
					ownerId,
					generation: lock.generation
				},
				existing: true
			};
			let generation = 0;
			if (lock) {
				this.db.prepare(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished', finished_at = ?
          WHERE id = ? AND status = 'running'`).run(now, lock.runId);
				generation = lock.generation + 1;
			}
			const runId = randomUUID();
			this.db.prepare(`INSERT INTO sync_runs (id, status, phase, started_at) VALUES (?, 'running', 'discovering', ?)`).run(runId, now);
			this.db.prepare(`INSERT INTO sync_run_lock (id, run_id, owner_id, generation, heartbeat_at, lease_expires_at)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET run_id = excluded.run_id, owner_id = excluded.owner_id,
          generation = excluded.generation, heartbeat_at = excluded.heartbeat_at, lease_expires_at = excluded.lease_expires_at`).run(runId, ownerId, generation, now, now + SYNC_LEASE_MS);
			return {
				fence: {
					runId,
					ownerId,
					generation
				},
				existing: false
			};
		});
	}
	/** Refresh the ownership lease; returns false when the fence is stale or already expired. */
	heartbeat(fence, now) {
		return withSqliteTransaction(this.db, () => {
			const lock = this.db.prepare("SELECT owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE run_id = ?").get(fence.runId);
			if (!lock || lock.ownerId !== fence.ownerId || lock.generation !== fence.generation || lock.leaseExpiresAt <= now) return false;
			return this.db.prepare("UPDATE sync_run_lock SET heartbeat_at = ?, lease_expires_at = ? WHERE run_id = ? AND owner_id = ? AND generation = ?").run(now, now + SYNC_LEASE_MS, fence.runId, fence.ownerId, fence.generation).changes === 1;
		});
	}
	/** Assert the fence still owns the run and the lease is live; throws StaleOwner otherwise. */
	assertFence(fence) {
		assertRunFence(this.db, fence, this.clock.now());
	}
	/**
	* Build a per-run fence guard for the per-request gate. Only the compiled
	* statement is cached; every call re-reads the live lock row, so an ownership
	* loss or lease expiry that lands between requests still surfaces StaleOwner.
	*/
	createFenceGuard(fence) {
		const stmt = this.db.prepare("SELECT owner_id AS ownerId, generation, lease_expires_at AS leaseExpiresAt FROM sync_run_lock WHERE run_id = ?");
		return () => {
			const lock = stmt.get(fence.runId);
			if (!lock || lock.ownerId !== fence.ownerId || lock.generation !== fence.generation || lock.leaseExpiresAt <= this.clock.now()) throw syncRemoteError(syncError("StaleOwner", {
				scope: "run",
				runId: fence.runId
			}));
		};
	}
	/**
	* Release ownership after a stop: mark the owned run interrupted (a terminal
	* row, never an orphan `running`), then remove the lock so a later claim
	* starts a fresh run. Only the current owner's run is touched.
	*/
	revoke(fence) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			this.db.prepare(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished', finished_at = ?
        WHERE id = ? AND status = 'running'`).run(this.clock.now(), fence.runId);
			this.db.prepare("DELETE FROM sync_run_lock WHERE id = 1 AND run_id = ? AND owner_id = ? AND generation = ?").run(fence.runId, fence.ownerId, fence.generation);
		});
	}
	/**
	* Mark a run interrupted by id without a fence check; used by the heartbeat
	* loop when it detects the lease has been lost (the fence is already stale,
	* so an ownership assertion would fail).
	*/
	markInterrupted(runId) {
		withSqliteTransaction(this.db, () => {
			this.db.prepare(`UPDATE sync_runs SET status = 'interrupted', phase = 'finished', finished_at = ?
        WHERE id = ? AND status = 'running'`).run(this.clock.now(), runId);
		});
	}
	getRun(id) {
		const row = this.db.prepare("SELECT * FROM sync_runs WHERE id = ?").get(id);
		return row ? toSafeRun(row) : null;
	}
	listRuns(page = 1, pageSize = 20) {
		const safePageSize = Math.min(Math.max(1, Math.trunc(pageSize)), 100);
		const total = this.db.prepare("SELECT COUNT(*) AS total FROM sync_runs").get().total;
		const pageCount = Math.max(1, Math.ceil(total / safePageSize));
		const safePage = Math.min(Math.max(1, Math.trunc(page)), pageCount);
		return {
			items: this.db.prepare("SELECT * FROM sync_runs ORDER BY started_at DESC, id LIMIT ? OFFSET ?").all(safePageSize, (safePage - 1) * safePageSize).map(toSafeRun),
			total,
			page: safePage,
			pageSize: safePageSize
		};
	}
	listItemResults(id, page = 1, pageSize = 20) {
		const safePageSize = Math.min(Math.max(1, Math.trunc(pageSize)), 100);
		const total = this.db.prepare("SELECT COUNT(*) AS total FROM sync_run_items WHERE run_id = ?").get(id).total;
		const pageCount = Math.max(1, Math.ceil(total / safePageSize));
		const safePage = Math.min(Math.max(1, Math.trunc(page)), pageCount);
		return {
			items: this.db.prepare("SELECT * FROM sync_run_items WHERE run_id = ? ORDER BY canonical LIMIT ? OFFSET ?").all(id, safePageSize, (safePage - 1) * safePageSize).map(toSafeItemResult),
			total,
			page: safePage,
			pageSize: safePageSize
		};
	}
	setPhase(fence, phase) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			if (this.db.prepare("UPDATE sync_runs SET phase = ? WHERE id = ?").run(phase, fence.runId).changes !== 1) throw syncRemoteError(syncError("RunNotFound", {
				scope: "run",
				runId: fence.runId
			}));
		});
	}
	recordResult(fence, result, pendingHint) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			recordRunItemResult(this.db, fence.runId, result, pendingHint);
		});
	}
	markSeen(fence, key) {
		return withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			return this.db.prepare("INSERT OR IGNORE INTO sync_seen_keys (run_id, canonical) VALUES (?, ?)").run(fence.runId, serializeRemoteKey(key)).changes === 1;
		});
	}
	hasSeen(runId, key) {
		return this.db.prepare("SELECT 1 FROM sync_seen_keys WHERE run_id = ? AND canonical = ?").get(runId, serializeRemoteKey(key)) !== void 0;
	}
	finishRun(fence, status, summary) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			if (this.db.prepare(`UPDATE sync_runs SET status = ?, phase = 'finished', finished_at = ?,
        unprocessed_known = ?, discovery_complete = ?, errors = ? WHERE id = ?`).run(status, this.clock.now(), summary.unprocessedKnown, summary.discoveryComplete ? 1 : 0, JSON.stringify(summary.errors), fence.runId).changes !== 1) throw syncRemoteError(syncError("RunNotFound", {
				scope: "run",
				runId: fence.runId
			}));
			this.db.prepare("DELETE FROM sync_run_lock WHERE id = 1 AND run_id = ? AND owner_id = ? AND generation = ?").run(fence.runId, fence.ownerId, fence.generation);
		});
	}
	/**
	* Delete completed-run history bounded to `maxRows` rows per call, keeping at most 100
	* completed runs younger than 30 days. Baselines and write intents are never touched.
	*/
	pruneCompleted(now, maxRows = 1e3) {
		const cutoff = now - 2592e6;
		return withSqliteTransaction(this.db, () => {
			const candidates = this.db.prepare(`SELECT id FROM sync_runs
        WHERE status != 'running'
          AND (started_at < ? OR id NOT IN (SELECT id FROM sync_runs WHERE status != 'running' ORDER BY started_at DESC LIMIT 100))
        ORDER BY started_at ASC LIMIT ?`).all(cutoff, maxRows);
			for (const candidate of candidates) this.db.prepare("DELETE FROM sync_runs WHERE id = ?").run(candidate.id);
			return {
				removedRows: candidates.length,
				more: candidates.length >= maxRows
			};
		});
	}
};
//#endregion
//#region src/sync/description-codec.ts
const MARK_ORDER = [
	"bold",
	"italic",
	"underline",
	"code",
	"strikethrough"
];
function canonicalMarks(marks) {
	if (!marks || marks.length === 0) return void 0;
	const sorted = [...new Set(marks)].sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b));
	return sorted.length > 0 ? sorted : void 0;
}
function canonicalInline(inline) {
	const marks = canonicalMarks(inline.marks);
	const out = { text: inline.text };
	if (marks) out.marks = marks;
	if (inline.href) out.href = inline.href;
	return out;
}
function inlineSignature(inline) {
	return JSON.stringify([inline.marks ?? null, inline.href ?? null]);
}
function canonicalChildren(children) {
	const out = [];
	for (const child of children) {
		const canon = canonicalInline(child);
		const prev = out[out.length - 1];
		if (prev && inlineSignature(prev) === inlineSignature(canon)) prev.text += canon.text;
		else out.push(canon);
	}
	return out;
}
function canonicalizeTextBlock(block) {
	const out = {
		type: block.type,
		children: canonicalChildren(block.children)
	};
	if (block.level) out.level = block.level;
	if (block.indent) out.indent = block.indent;
	return out;
}
function canonicalizeCell(cell) {
	const out = { blocks: cell.blocks.map(canonicalizeTextBlock) };
	if (cell.header) out.header = true;
	if (cell.colSpan) out.colSpan = cell.colSpan;
	if (cell.rowSpan) out.rowSpan = cell.rowSpan;
	return out;
}
function canonicalizeBlock(block) {
	if (block.type === "attachment") return { ...block };
	if (block.type === "table") return {
		type: "table",
		rows: block.rows.map((row) => row.map(canonicalizeCell))
	};
	return canonicalizeTextBlock(block);
}
/** Canonical form of a content document; never mutates the input. */
function canonicalContent(content) {
	return {
		version: 1,
		blocks: content.blocks.map(canonicalizeBlock)
	};
}
/** Remove attachment nodes (local-only) from a content document. */
function stripAttachments(content) {
	return {
		version: 1,
		blocks: content.blocks.filter((block) => block.type !== "attachment")
	};
}
/** Canonical, attachment-free description snapshot used for comparison. */
function canonicalDescription(content) {
	return canonicalContent(stripAttachments(content));
}
const MARK_BY_TAG = {
	strong: "bold",
	b: "bold",
	em: "italic",
	i: "italic",
	u: "underline",
	code: "code",
	s: "strikethrough",
	strike: "strikethrough",
	del: "strikethrough"
};
/** Elements whose content must never enter the decoded draft. */
const SKIP_TAGS = /* @__PURE__ */ new Set([
	"script",
	"style",
	"img",
	"iframe",
	"object",
	"embed",
	"video",
	"audio",
	"canvas",
	"svg",
	"math",
	"template",
	"input",
	"button",
	"select",
	"textarea",
	"form",
	"link",
	"meta",
	"base",
	"source",
	"track",
	"noscript"
]);
function isElement(node) {
	return "tagName" in node;
}
function isText(node) {
	return node.nodeName === "#text";
}
function unsupported() {
	throw syncRemoteError(syncError("UnsupportedRepresentation", {
		scope: "item",
		field: "description"
	}));
}
function checkAttrs(node, ctx) {
	for (const attr of node.attrs) {
		const name = attr.name.toLowerCase();
		if (name === "style" || name.startsWith("on")) ctx.roundTrip = false;
	}
}
function hrefOf(node, ctx) {
	const href = node.attrs.find((attr) => attr.name.toLowerCase() === "href")?.value;
	if (!href) return null;
	const safe = safeLink(href);
	if (safe === void 0) {
		ctx.roundTrip = false;
		return null;
	}
	return safe;
}
function walkInlines(node, style, out, ctx) {
	if (isText(node)) {
		out.push({
			text: node.value,
			...style.marks.length ? { marks: [...style.marks] } : {},
			...style.href !== null ? { href: style.href } : {}
		});
		return;
	}
	if (!isElement(node)) return;
	checkAttrs(node, ctx);
	const tag = node.tagName;
	if (tag === "br") {
		out.push({ text: "\n" });
		return;
	}
	const mark = MARK_BY_TAG[tag];
	if (mark !== void 0) {
		const next = {
			marks: [...style.marks, mark],
			href: style.href
		};
		for (const child of node.childNodes) walkInlines(child, next, out, ctx);
		return;
	}
	if (tag === "a") {
		const href = hrefOf(node, ctx);
		const next = {
			marks: [...style.marks],
			href: href ?? style.href
		};
		for (const child of node.childNodes) walkInlines(child, next, out, ctx);
		return;
	}
	if (tag !== "span") ctx.roundTrip = false;
	for (const child of node.childNodes) walkInlines(child, style, out, ctx);
}
function collectInlines(element, ctx) {
	const out = [];
	for (const child of element.childNodes) walkInlines(child, {
		marks: [],
		href: null
	}, out, ctx);
	return out;
}
/**
* Collect the text of a `<pre>` block while skipping blocked elements (script/
* style/images/…). A `<code>` wrapper and plain text are the lossless subset;
* any other nested markup marks the representation as not lossless.
*/
function collectPreText(element, ctx) {
	let text = "";
	const walk = (node, insideCode) => {
		if (isText(node)) {
			if (!insideCode) ctx.roundTrip = false;
			text += node.value;
			return;
		}
		if (!isElement(node)) return;
		const tag = node.tagName;
		if (SKIP_TAGS.has(tag)) {
			ctx.roundTrip = false;
			return;
		}
		checkAttrs(node, ctx);
		if (tag === "code") {
			if (insideCode) {
				ctx.roundTrip = false;
				return;
			}
			for (const child of node.childNodes) walk(child, true);
			return;
		}
		ctx.roundTrip = false;
		for (const child of node.childNodes) walk(child, false);
	};
	for (const child of element.childNodes) walk(child, false);
	return text;
}
function collectListInlines(li, ctx) {
	const out = [];
	for (const child of li.childNodes) {
		if (isElement(child) && (child.tagName === "ul" || child.tagName === "ol")) continue;
		walkInlines(child, {
			marks: [],
			href: null
		}, out, ctx);
	}
	return out;
}
function collectList(node, blocks, ctx, type, indent) {
	checkAttrs(node, ctx);
	for (const child of node.childNodes) {
		if (!isElement(child) || child.tagName !== "li") continue;
		checkAttrs(child, ctx);
		blocks.push({
			type,
			indent,
			children: collectListInlines(child, ctx)
		});
		for (const liChild of child.childNodes) if (isElement(liChild) && (liChild.tagName === "ul" || liChild.tagName === "ol")) collectList(liChild, blocks, ctx, liChild.tagName === "ol" ? "ordered" : "bullet", indent + 1);
	}
}
function attrInt(el, name) {
	const raw = el.attrs.find((attr) => attr.name.toLowerCase() === name)?.value;
	if (raw === void 0) return void 0;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1 || n > 100) return void 0;
	return n;
}
function collectRow(tr, ctx) {
	const row = [];
	for (const cellEl of tr.childNodes) {
		if (!isElement(cellEl) || cellEl.tagName !== "td" && cellEl.tagName !== "th") continue;
		checkAttrs(cellEl, ctx);
		const cell = { blocks: [{
			type: "paragraph",
			children: collectInlines(cellEl, ctx)
		}] };
		if (cellEl.tagName === "th") cell.header = true;
		const colSpan = attrInt(cellEl, "colspan");
		const rowSpan = attrInt(cellEl, "rowspan");
		if (colSpan) cell.colSpan = colSpan;
		if (rowSpan) cell.rowSpan = rowSpan;
		row.push(cell);
	}
	return row;
}
function collectTable(node, ctx) {
	checkAttrs(node, ctx);
	const rows = [];
	const collectRows = (container) => {
		for (const child of container.childNodes) {
			if (!isElement(child)) continue;
			if (child.tagName === "tr") {
				checkAttrs(child, ctx);
				rows.push(collectRow(child, ctx));
			} else if (child.tagName === "tbody" || child.tagName === "thead" || child.tagName === "tfoot") {
				checkAttrs(child, ctx);
				collectRows(child);
			}
		}
	};
	collectRows(node);
	return {
		type: "table",
		rows
	};
}
function appendTopLevel(node, blocks, ctx) {
	if (isText(node)) {
		if (node.value.trim() === "") return;
		blocks.push({
			type: "paragraph",
			children: [{ text: node.value }]
		});
		return;
	}
	if (!isElement(node)) return;
	checkAttrs(node, ctx);
	const tag = node.tagName;
	switch (tag) {
		case "p":
		case "div":
		case "section":
		case "article":
		case "main":
		case "header":
		case "footer":
			blocks.push({
				type: "paragraph",
				children: collectInlines(node, ctx)
			});
			return;
		case "h1":
		case "h2":
		case "h3":
		case "h4":
		case "h5":
		case "h6":
			blocks.push({
				type: "heading",
				level: Number(tag.charAt(1)),
				children: collectInlines(node, ctx)
			});
			return;
		case "ul":
		case "ol":
			collectList(node, blocks, ctx, tag === "ol" ? "ordered" : "bullet", 0);
			return;
		case "blockquote":
			blocks.push({
				type: "quote",
				children: collectInlines(node, ctx)
			});
			return;
		case "pre":
			blocks.push({
				type: "code",
				children: [{ text: collectPreText(node, ctx) }]
			});
			return;
		case "table":
			blocks.push(collectTable(node, ctx));
			return;
		case "br":
			blocks.push({
				type: "paragraph",
				children: []
			});
			return;
		default:
			if (SKIP_TAGS.has(tag)) {
				ctx.roundTrip = false;
				return;
			}
			ctx.roundTrip = false;
			blocks.push({
				type: "paragraph",
				children: collectInlines(node, ctx)
			});
			return;
	}
}
/**
* Whether `source` is exactly one fenced code block that can be stored and
* re-emitted verbatim. The info string, fence length, line endings and body are
* all part of the stored raw source, so the only shapes we cannot delimit
* unambiguously (a body containing backticks, a closing fence shorter than the
* opening one, or trailing text after the fence) are rejected as not lossless.
*/
function singleFencedCode(source) {
	const match = /^(`{3,})([^\r\n`]*)\r?\n([\s\S]*?)\r?\n(`{3,})([ \t]*)$/u.exec(source);
	if (!match) return false;
	if (match[4].length < match[1].length) return false;
	return !match[3].includes("`");
}
/** Decode an untrusted remote description into the supported vocabulary without executing scripts. */
function decodeDescription(raw, format) {
	switch (raw.presence) {
		case "absent":
		case "unsupported":
			unsupported();
			break;
		case "null": return {
			content: {
				version: 1,
				blocks: []
			},
			roundTrip: true
		};
	}
	const source = raw.value;
	if (source === "") return {
		content: {
			version: 1,
			blocks: []
		},
		roundTrip: true
	};
	switch (format) {
		case "text": return {
			content: canonicalContent(textContent(source)),
			roundTrip: true
		};
		case "markdown":
			if (singleFencedCode(source)) return {
				content: {
					version: 1,
					blocks: [{
						type: "code",
						children: [{ text: source }]
					}]
				},
				roundTrip: true
			};
			return {
				content: canonicalContent(textContent(source)),
				roundTrip: false
			};
		case "richtext": {
			const ctx = { roundTrip: true };
			const fragment = parseFragment(source);
			const blocks = [];
			for (const child of fragment.childNodes) appendTopLevel(child, blocks, ctx);
			return {
				content: canonicalContent({
					version: 1,
					blocks
				}),
				roundTrip: ctx.roundTrip
			};
		}
		default: unsupported();
	}
}
/** Reattach the current task's local attachments after a pulled description, validating the whole document. */
function mergeLocalAttachments(remoteDescription, current) {
	const attachments = current.blocks.filter((block) => block.type === "attachment");
	return validateContent({
		version: 1,
		blocks: [...remoteDescription.blocks, ...attachments]
	});
}
//#endregion
//#region src/sync/snapshot.ts
const EMPTY = {
	version: 1,
	blocks: []
};
/**
* The one field a rule reconciles. Everything else a work item carries is packed
* into the imported task's description once and never compared again, so a
* remote edit to any other field cannot invent a local change.
*/
const RULE_FIELDS = ["status"];
/** The projection every rule uses: status only, tagged with the rule's revision. */
function projectionFor(rule) {
	return {
		fields: [...RULE_FIELDS],
		mappingRevision: rule.revision,
		normalizationVersion: 1
	};
}
/** Tags are compared after trimming and case-insensitive dedup, matching the store's own limit semantics. */
function normalizeTags(tags) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const tag of tags) {
		const normalized = tag.trim();
		const key = normalized.toLocaleLowerCase();
		if (!normalized || seen.has(key)) continue;
		seen.add(key);
		out.push(normalized);
	}
	return out;
}
/** Essential fields must be readable; an absent/unsupported title or status is an explicit failure. */
function essential(field, name) {
	if (field.presence === "value") return field.value;
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field: name
	}));
}
/** Optional fields fall back to their canonical default without ever fabricating null for absent values. */
function optional(field, fallback) {
	return field.presence === "value" ? field.value : fallback;
}
/** Canonical local snapshot: attachments stripped, marks canonicalized, tags normalized. */
function projectLocal(task, _projection) {
	return {
		title: task.title,
		status: task.status,
		priority: task.priority,
		tags: normalizeTags(task.tags),
		storyPoints: task.storyPoints,
		description: canonicalDescription(task.content)
	};
}
/**
* Canonical remote snapshot; the adapter already decoded the fields to the shared
* vocabulary. The description here is the task's own packed body at import time,
* not the platform's raw HTML, so a baseline always round-trips the local shape.
*/
function projectRemote(item, rule) {
	return {
		title: essential(item.fields.title, "title"),
		status: essential(item.fields.status, "status"),
		priority: optional(item.fields.priority, "medium"),
		tags: normalizeTags(optional(item.fields.tags, [])),
		storyPoints: optional(item.fields.storyPoints, null),
		description: canonicalDescription(optional(item.fields.description, EMPTY))
	};
}
function presenceOf(item) {
	return {
		title: item.fields.title.presence,
		description: item.fields.description.presence,
		status: item.fields.status.presence,
		priority: item.fields.priority.presence,
		tags: item.fields.tags.presence,
		storyPoints: item.fields.storyPoints.presence
	};
}
/** Build a baseline snapshot of both sides at one point in time. */
function buildBaseline(task, item, rule) {
	return {
		local: projectLocal(task, projectionFor(rule)),
		remote: projectRemote(item, rule),
		localVersion: task.version,
		localUpdatedAt: task.updatedAt,
		remoteUpdatedToken: item.updatedToken,
		rawStatus: item.rawStatus,
		projection: projectionFor(rule),
		remotePresence: presenceOf(item),
		remoteDescription: item.description
	};
}
function sameProjection(a, b) {
	return a.mappingRevision === b.mappingRevision && a.normalizationVersion === b.normalizationVersion && a.fields.length === b.fields.length && a.fields.every((field, index) => field === b.fields[index]);
}
/**
* Rebase a stored baseline onto the rule's current projection. A status-map edit
* only changes which platform status a local status targets; it never re-reads a
* stored baseline, so the remote side is refreshed from the live item instead and
* the local side keeps any pending edit.
*/
function rebaseProjection(input) {
	const { remote, baseline, rule } = input;
	const projection = projectionFor(rule);
	if (sameProjection(projection, baseline.projection)) return {
		baseline,
		initializePatch: {}
	};
	return {
		baseline: {
			...baseline,
			remote: projectRemote(remote, rule),
			projection
		},
		initializePatch: {}
	};
}
//#endregion
//#region src/sync/reconcile.ts
function deepEqual$2(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}
/**
* Reconcile an uncertain write against the platform's current state.
*
* Only the write-set (the fields the intent actually wrote) is compared, using
* the intent's recorded rule snapshot — never the current mapping. A matching
* write-set confirms the write even when a third party changed other fields. A
* value equal to the before-value does not prove "not applied" (the write could
* have been accepted then withdrawn), so only platform evidence can yield
* `proven_not_applied`; everything else stays `pending` and must not be retried
* as an ordinary write.
*/
async function reconcileIntent(intent, adapter, signal) {
	const observed = await adapter.read(intent.key, intent.ruleSnapshot, signal);
	const projected = projectRemote(observed, intent.ruleSnapshot);
	if (Object.keys(intent.patch).every((field) => {
		if (intent.patch[field] === void 0) return true;
		return deepEqual$2(projected[field], intent.expected[field]);
	})) return {
		kind: "confirmed",
		observed
	};
	const evidence = await adapter.evidence(intent, observed, signal);
	if (evidence === "applied") return {
		kind: "confirmed",
		observed
	};
	if (evidence === "not_applied_proven") return {
		kind: "proven_not_applied",
		observed
	};
	return {
		kind: "pending",
		observed
	};
}
//#endregion
//#region src/sync/link-store.ts
const realClock$1 = {
	now: () => Date.now(),
	sleep: async () => {}
};
function hasPatch$2(patch) {
	return patch.title !== void 0 || patch.description !== void 0 || patch.status !== void 0 || patch.priority !== void 0 || patch.tags !== void 0 || patch.storyPoints !== void 0;
}
function patchToUpdate(taskId, version, patch, content) {
	const request = {
		id: taskId,
		version
	};
	if (patch.title !== void 0) request.title = patch.title;
	if (content !== void 0) request.content = content;
	if (patch.status !== void 0) request.status = patch.status;
	if (patch.priority !== void 0) request.priority = patch.priority;
	if (patch.tags !== void 0) request.tags = patch.tags;
	if (patch.storyPoints !== void 0) request.storyPoints = patch.storyPoints;
	return request;
}
/**
* Import a remote item into a task: no fake title, essential fields required,
* default workspace honoured. The description is the packed work-item body the
* adapter decoded (number, platform fields and the item's own text), and the
* only synced field afterwards is the status — priority, tags and story points
* stay local, so nothing fills them from the platform.
*/
function importedTaskRequest(item, rule) {
	const fields = projectRemote(item, rule);
	return {
		title: fields.title,
		content: fields.description,
		status: fields.status,
		priority: "medium",
		tags: [],
		storyPoints: null,
		workspaceId: rule.workspaceId ?? null
	};
}
function linkOf(row) {
	return {
		id: row.id,
		key: {
			instance: row.instance,
			projectId: row.project_id,
			typeId: row.type_id,
			id: row.remote_id
		},
		ruleId: row.rule_id,
		taskId: row.task_id,
		taskGeneration: row.task_generation,
		revision: row.revision,
		baseline: row.baseline === null ? null : JSON.parse(row.baseline)
	};
}
function intentOf(row) {
	return {
		id: row.id,
		linkId: row.link_id,
		key: {
			instance: row.instance,
			projectId: row.project_id,
			typeId: row.type_id,
			id: row.remote_id
		},
		taskId: row.task_id,
		taskGeneration: row.task_generation,
		linkRevision: row.link_revision,
		fence: {
			runId: row.run_id,
			ownerId: row.owner_id,
			generation: row.generation
		},
		ruleSnapshot: JSON.parse(row.rule_snapshot),
		baseline: JSON.parse(row.baseline),
		localBefore: JSON.parse(row.local_before),
		localVersion: row.local_version,
		remoteBefore: JSON.parse(row.remote_before),
		patch: JSON.parse(row.patch),
		expected: JSON.parse(row.expected),
		phase: row.phase
	};
}
function sourceErrorOf(lastError) {
	if (lastError === null) return null;
	const error = JSON.parse(lastError);
	return {
		code: error.code,
		problem: error.problem,
		action: error.action
	};
}
const SELECT_LINK = `SELECT l.*, b.data AS baseline FROM sync_links l LEFT JOIN sync_baselines b ON b.link_id = l.id`;
const SELECT_INTENT = `SELECT wi.*, l.instance AS instance, l.project_id AS project_id, l.type_id AS type_id, l.remote_id AS remote_id
  FROM sync_write_intents wi JOIN sync_links l ON l.id = wi.link_id`;
var SyncLinkStore = class {
	db;
	tasks;
	clock;
	constructor(db, tasks, clock = realClock$1) {
		this.db = db;
		this.tasks = tasks;
		this.clock = clock;
	}
	platformOf(ruleId) {
		const row = this.db.prepare("SELECT c.platform AS platform FROM sync_connections c JOIN sync_rules r ON r.connection_id = c.id WHERE r.id = ?").get(ruleId);
		if (!row) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "item",
			field: "ruleId"
		}));
		return row.platform;
	}
	getLink(key) {
		const row = this.db.prepare(`${SELECT_LINK} WHERE l.canonical = ?`).get(serializeRemoteKey(key));
		return row ? linkOf(row) : null;
	}
	getLinkByTask(taskId) {
		const row = this.db.prepare(`${SELECT_LINK} WHERE l.task_id = ?`).get(taskId);
		return row ? linkOf(row) : null;
	}
	listLinked(ruleId, afterKey, limit) {
		const bounded = Math.min(Math.max(1, Math.trunc(limit)), 100);
		return this.db.prepare(`${SELECT_LINK} WHERE l.rule_id = ? AND l.canonical > ? ORDER BY l.canonical LIMIT ?`).all(ruleId, afterKey ?? "", bounded).map(linkOf);
	}
	importItem(item, rule, fence) {
		assertRunFence(this.db, fence, this.clock.now());
		const canonical = serializeRemoteKey(item.key);
		if (this.getPending(item.key)) throw syncRemoteError(syncError("WriteOutcomeUnknown", {
			scope: "item",
			retryable: true
		}));
		const existing = this.getLink(item.key);
		if (existing && existing.taskId !== null) return this.tasks.get(existing.taskId);
		return withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			const task = this.tasks.create(importedTaskRequest(item, rule));
			const taskGeneration = randomUUID();
			const now = this.clock.now();
			const baseline = buildBaseline(task, item, rule);
			const platform = this.platformOf(rule.id);
			if (existing) {
				this.db.prepare(`UPDATE sync_links SET task_id = ?, task_generation = ?, number = ?, url = ?,
          revision = revision + 1, updated_at = ? WHERE id = ?`).run(task.id, taskGeneration, item.number, item.url, now, existing.id);
				this.db.prepare("DELETE FROM sync_baselines WHERE link_id = ?").run(existing.id);
				this.db.prepare("INSERT INTO sync_baselines (link_id, data) VALUES (?, ?)").run(existing.id, JSON.stringify(baseline));
			} else {
				const id = randomUUID();
				this.db.prepare(`INSERT INTO sync_links (id, rule_id, task_id, task_generation, platform, instance, project_id, type_id, remote_id, number, url, canonical, revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(id, rule.id, task.id, taskGeneration, platform, item.key.instance, item.key.projectId, item.key.typeId, item.key.id, item.number, item.url, canonical, now, now);
				this.db.prepare("INSERT INTO sync_baselines (link_id, data) VALUES (?, ?)").run(id, JSON.stringify(baseline));
			}
			return task;
		});
	}
	prepareIntent(input) {
		const id = randomUUID();
		const now = this.clock.now();
		const baseline = input.link.baseline ?? buildBaseline(input.task, input.observed, input.rule);
		const projection = projectionFor(input.rule);
		const localBefore = projectLocal(input.task, projection);
		const expected = {
			...projectRemote(input.observed, input.rule),
			...input.plan.remotePatch
		};
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, input.fence, this.clock.now());
			this.db.prepare(`INSERT INTO sync_write_intents (id, link_id, task_id, task_generation, link_revision, run_id, owner_id, generation, rule_snapshot, baseline, local_before, local_version, remote_before, patch, expected, phase, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`).run(id, input.link.id, input.link.taskId, input.link.taskGeneration, input.link.revision, input.fence.runId, input.fence.ownerId, input.fence.generation, JSON.stringify(input.rule), JSON.stringify(baseline), JSON.stringify(localBefore), input.task.version, JSON.stringify(input.observed), JSON.stringify(input.plan.remotePatch), JSON.stringify(expected), now, now);
		});
		return this.getIntent(id);
	}
	getIntent(id) {
		const row = this.db.prepare(`${SELECT_INTENT} WHERE wi.id = ?`).get(id);
		return row ? intentOf(row) : null;
	}
	markDispatched(intentId, fence) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			if (this.db.prepare(`UPDATE sync_write_intents SET phase = 'dispatched', updated_at = ?
        WHERE id = ? AND run_id = ? AND owner_id = ? AND generation = ? AND phase = 'prepared'`).run(this.clock.now(), intentId, fence.runId, fence.ownerId, fence.generation).changes !== 1) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "item",
				field: "intentId"
			}));
		});
	}
	recordUnknown(intentId, fence, error) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			if (this.db.prepare(`UPDATE sync_write_intents SET phase = 'unknown', error = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND owner_id = ? AND generation = ? AND phase IN ('prepared', 'dispatched')`).run(JSON.stringify(error), this.clock.now(), intentId, fence.runId, fence.ownerId, fence.generation).changes !== 1) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "item",
				field: "intentId"
			}));
		});
	}
	/**
	* Cancel a prepared/dispatched intent after a definitive write rejection
	* (e.g. a platform 4xx). Unlike {@link recordUnknown}, the intent leaves the
	* pending set, so it is never re-reconciled as an uncertain outcome. The
	* rejection error is retained for the link's last_error.
	*/
	cancelIntent(intentId, fence, error) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			if (this.db.prepare(`UPDATE sync_write_intents SET phase = 'cancelled', error = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND owner_id = ? AND generation = ? AND phase IN ('prepared', 'dispatched')`).run(JSON.stringify(error), this.clock.now(), intentId, fence.runId, fence.ownerId, fence.generation).changes !== 1) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "item",
				field: "intentId"
			}));
		});
	}
	getPending(key) {
		const row = this.db.prepare(`${SELECT_INTENT} WHERE l.canonical = ? AND wi.phase IN ('prepared', 'dispatched', 'unknown')
      ORDER BY wi.created_at DESC LIMIT 1`).get(serializeRemoteKey(key));
		return row ? intentOf(row) : null;
	}
	listPending(ruleId, afterId, limit) {
		const bounded = Math.min(Math.max(1, Math.trunc(limit)), 100);
		return this.db.prepare(`${SELECT_INTENT} WHERE l.rule_id = ? AND wi.phase IN ('prepared', 'dispatched', 'unknown')
      AND wi.id > ? ORDER BY wi.id LIMIT ?`).all(ruleId, afterId ?? "", bounded).map(intentOf);
	}
	finalizeItem(input) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, input.fence, this.clock.now());
			const link = this.db.prepare("SELECT * FROM sync_links WHERE id = ?").get(input.linkId);
			if (!link) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "item",
				field: "linkId"
			}));
			if (link.revision !== input.linkRevision || link.task_generation !== input.taskGeneration) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
			const taskId = link.task_id;
			if (taskId !== null && hasPatch$2(input.localPatch)) {
				const task = this.tasks.get(taskId);
				if (!task) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
				if (task.version !== input.expectedTaskVersion) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
				const content = input.localPatch.description === void 0 ? void 0 : mergeLocalAttachments(input.localPatch.description, task.content);
				this.tasks.update(patchToUpdate(taskId, task.version, input.localPatch, content));
			}
			const now = this.clock.now();
			this.db.prepare(`INSERT INTO sync_baselines (link_id, data) VALUES (?, ?)
        ON CONFLICT(link_id) DO UPDATE SET data = excluded.data`).run(input.linkId, JSON.stringify(input.baseline));
			if (input.intentId !== null) {
				const intent = this.db.prepare(`SELECT link_id AS linkId, task_id AS taskId, task_generation AS taskGeneration,
          link_revision AS linkRevision, run_id AS runId, owner_id AS ownerId, generation
          FROM sync_write_intents WHERE id = ?`).get(input.intentId);
				if (!intent) throw syncRemoteError(syncError("LocalVersionConflict", {
					scope: "item",
					field: "intentId"
				}));
				if (intent.runId !== input.fence.runId || intent.ownerId !== input.fence.ownerId || intent.generation !== input.fence.generation) throw syncRemoteError(syncError("StaleOwner", {
					scope: "run",
					runId: input.fence.runId
				}));
				if (intent.linkId !== input.linkId || intent.linkRevision !== input.linkRevision || intent.taskGeneration !== input.taskGeneration || intent.taskId !== taskId) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
				if (this.db.prepare(`UPDATE sync_write_intents SET phase = 'confirmed', error = NULL, updated_at = ?
          WHERE id = ? AND link_id = ? AND link_revision = ? AND task_generation = ? AND task_id IS ?
            AND run_id = ? AND owner_id = ? AND generation = ? AND phase IN ('dispatched', 'unknown')`).run(now, input.intentId, input.linkId, input.linkRevision, input.taskGeneration, taskId, input.fence.runId, input.fence.ownerId, input.fence.generation).changes !== 1) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
			}
			const success = input.result.error === null;
			this.db.prepare(`UPDATE sync_links SET revision = revision + 1, last_success_at = ?, last_error = ?, updated_at = ? WHERE id = ?`).run(success ? now : link.last_success_at, success ? null : JSON.stringify(input.result.error), now, input.linkId);
			recordRunItemResult(this.db, input.fence.runId, {
				...input.result,
				taskId
			});
		});
	}
	/**
	* Reconcile a pending intent dispatched by a different (now-expired) run and,
	* when the remote effect is actually confirmed by read-only observation, adopt
	* it under the current fence. The read runs entirely outside any DB transaction;
	* only the confirm is a short fenced transaction. The original write provenance
	* and baseline are preserved unchanged, and the recorded result is derived from
	* the observed effect — never from caller-supplied baseline/result input, so a
	* fabricated confirmation cannot reach the store.
	*/
	async reconcileAndAdopt(intentId, fence, adapter, signal) {
		assertRunFence(this.db, fence, this.clock.now());
		const state = this.readAdoptionState(intentId, fence);
		this.assertRuleEnabled(state.ruleId);
		const result = await reconcileIntent(state.intent, adapter, signal);
		if (result.kind !== "confirmed") return result;
		this.confirmReconciled(intentId, fence, state);
		return result;
	}
	readAdoptionState(intentId, fence) {
		const intent = this.getIntent(intentId);
		if (!intent) throw syncRemoteError(syncError("LocalVersionConflict", {
			scope: "item",
			field: "intentId"
		}));
		if (intent.phase !== "dispatched" && intent.phase !== "unknown") throw syncRemoteError(syncError("LocalVersionConflict", {
			scope: "item",
			field: "intentId"
		}));
		if (intent.fence.runId === fence.runId) throw syncRemoteError(syncError("StaleOwner", {
			scope: "run",
			runId: fence.runId
		}));
		const link = this.db.prepare("SELECT rule_id AS ruleId FROM sync_links WHERE id = ?").get(intent.linkId);
		if (!link) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "item",
			field: "linkId"
		}));
		let taskVersion = null;
		if (intent.taskId !== null) {
			const task = this.tasks.get(intent.taskId);
			if (!task) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
			taskVersion = task.version;
		}
		return {
			intent,
			ruleId: link.ruleId,
			taskVersion
		};
	}
	assertRuleEnabled(ruleId) {
		const row = this.db.prepare(`SELECT r.enabled AS ruleEnabled, c.enabled AS connEnabled
      FROM sync_rules r JOIN sync_connections c ON c.id = r.connection_id WHERE r.id = ?`).get(ruleId);
		if (!row || row.ruleEnabled !== 1 || row.connEnabled !== 1) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "rule",
			field: "enabled"
		}));
	}
	/** Short fenced transaction: re-verify fence/CAS, then record the confirmed adoption. */
	confirmReconciled(intentId, fence, state) {
		withSqliteTransaction(this.db, () => {
			assertRunFence(this.db, fence, this.clock.now());
			const row = this.db.prepare(`SELECT link_id AS linkId, task_id AS taskId, task_generation AS taskGeneration,
        link_revision AS linkRevision, run_id AS runId, owner_id AS ownerId, generation, phase
        FROM sync_write_intents WHERE id = ?`).get(intentId);
			if (!row) throw syncRemoteError(syncError("LocalVersionConflict", {
				scope: "item",
				field: "intentId"
			}));
			if (row.phase !== "dispatched" && row.phase !== "unknown") throw syncRemoteError(syncError("LocalVersionConflict", {
				scope: "item",
				field: "intentId"
			}));
			if (row.runId === fence.runId) throw syncRemoteError(syncError("StaleOwner", {
				scope: "run",
				runId: fence.runId
			}));
			const link = this.db.prepare("SELECT id, revision, task_generation AS taskGeneration, task_id AS taskId FROM sync_links WHERE id = ?").get(row.linkId);
			if (!link) throw syncRemoteError(syncError("InvalidConfig", {
				scope: "item",
				field: "linkId"
			}));
			if (link.revision !== row.linkRevision || link.taskGeneration !== row.taskGeneration || link.taskId !== row.taskId) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
			if (row.taskId !== null) {
				const task = this.tasks.get(row.taskId);
				if (!task || task.version !== state.taskVersion) throw syncRemoteError(syncError("LocalVersionConflict", { scope: "item" }));
			}
			const now = this.clock.now();
			if (this.db.prepare(`UPDATE sync_write_intents SET phase = 'confirmed', error = NULL, updated_at = ?,
        confirmed_run_id = ?, confirmed_owner_id = ?, confirmed_generation = ?
        WHERE id = ? AND phase IN ('dispatched', 'unknown')
          AND run_id = ? AND owner_id = ? AND generation = ? AND link_revision = ? AND task_generation = ?`).run(now, fence.runId, fence.ownerId, fence.generation, intentId, row.runId, row.ownerId, row.generation, row.linkRevision, row.taskGeneration).changes !== 1) throw syncRemoteError(syncError("LocalVersionConflict", {
				scope: "item",
				field: "intentId"
			}));
			recordRunItemResult(this.db, fence.runId, {
				key: state.intent.key,
				taskId: row.taskId,
				category: "pushed",
				changedFields: Object.keys(state.intent.patch),
				discardedFields: [],
				writtenBack: true,
				outsideFilter: false,
				error: null
			});
			this.db.prepare("UPDATE sync_links SET last_error = NULL, updated_at = ? WHERE id = ?").run(now, row.linkId);
		});
	}
	attachSources(tasks) {
		if (tasks.length === 0) return tasks;
		const ids = tasks.map((task) => task.id);
		const rows = this.db.prepare(`SELECT task_id AS taskId, platform, project_id AS projectId, type_id AS typeId,
      remote_id AS remoteId, number, url, last_success_at AS lastSuccess, last_error AS lastError
      FROM sync_links WHERE task_id IN (${ids.map(() => "?").join(", ")})`).all(...ids);
		const byTask = new Map(rows.map((row) => [row.taskId, row]));
		return tasks.map((task) => {
			const source = byTask.get(task.id);
			if (!source) return task;
			return {
				...task,
				source: {
					platform: source.platform,
					projectId: source.projectId,
					typeId: source.typeId,
					remoteId: source.remoteId,
					number: source.number,
					url: source.url,
					lastSuccess: source.lastSuccess,
					error: sourceErrorOf(source.lastError)
				}
			};
		});
	}
};
//#endregion
//#region src/sync/planner.ts
function isReadable(field, value) {
	if (field === "title" || field === "status") return value.presence === "value";
	return value.presence === "value" || value.presence === "null";
}
function selectedFields(item, fields) {
	return fields.filter((field) => isReadable(field, item.fields[field]));
}
function deepEqual$1(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}
function setField(patch, field, value) {
	patch[field] = value;
}
function hasPatch$1(patch) {
	return patch.title !== void 0 || patch.description !== void 0 || patch.status !== void 0 || patch.priority !== void 0 || patch.tags !== void 0 || patch.storyPoints !== void 0;
}
/**
* Decide the task-level action for one linked item. Only the canonical snapshots of
* selected fields are compared; timestamps never drive the decision. The selected
* set is the rule's own projection — today just the status — so the only patch a
* plan can carry is a status the local task changed after the last sync.
*/
function planSync(input) {
	const { local, remote, baseline, rule } = input;
	const projection = projectionFor(rule);
	const selected = selectedFields(remote, projection.fields);
	if (local === null) return {
		kind: "import",
		localPatch: {},
		remotePatch: {},
		selectedFields: selected
	};
	const localFields = projectLocal(local, projection);
	const remoteFields = projectRemote(remote, rule);
	if (baseline === null) {
		const localPatch = {};
		const remotePatch = {};
		for (const field of selected) if (field === "status") {
			if (!deepEqual$1(localFields.status, remoteFields.status)) setField(remotePatch, "status", localFields.status);
		} else if (!deepEqual$1(remoteFields[field], localFields[field])) setField(localPatch, field, remoteFields[field]);
		return {
			kind: hasPatch$1(localPatch) || hasPatch$1(remotePatch) ? "merge" : "unchanged",
			localPatch,
			remotePatch,
			selectedFields: selected
		};
	}
	const localChanged = selected.filter((field) => !deepEqual$1(localFields[field], baseline.local[field]));
	const remoteChanged = selected.filter((field) => !deepEqual$1(remoteFields[field], baseline.remote[field]));
	if (localChanged.length === 0 && remoteChanged.length === 0) return {
		kind: "unchanged",
		localPatch: {},
		remotePatch: {},
		selectedFields: selected
	};
	const remotePatch = {};
	if (localChanged.includes("status")) setField(remotePatch, "status", localFields.status);
	return {
		kind: hasPatch$1(remotePatch) ? "push" : "unchanged",
		localPatch: {},
		remotePatch,
		selectedFields: selected
	};
}
//#endregion
//#region src/sync/execute-item.ts
/** Re-read/re-plan at most this many times before a write before reporting instability. */
const MAX_REPLANS = 3;
function deepEqual(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}
function hasPatch(patch) {
	return patch.title !== void 0 || patch.description !== void 0 || patch.status !== void 0 || patch.priority !== void 0 || patch.tags !== void 0 || patch.storyPoints !== void 0;
}
function isUncertainWrite(code) {
	return code === "WriteOutcomeUnknown" || code === "VerificationFailed";
}
const CONNECTION_FATAL$1 = /* @__PURE__ */ new Set([
	"AuthDenied",
	"RateLimited",
	"EntitlementUnavailable"
]);
function isConnectionFatal$1(code) {
	return CONNECTION_FATAL$1.has(code);
}
function isAbortError$2(err) {
	return typeof err === "object" && err !== null && err.name === "AbortError";
}
/** Extract a safe DTO from a thrown value, never echoing a raw message/header/body. */
function errorDto$2(err, scope = "item") {
	if (err !== null && typeof err === "object") {
		const e = err;
		if (e.code === "task-list/sync" && e.details && typeof e.details.code === "string") return e.details;
		if (typeof e.code === "string" && SYNC_ERRORS[e.code] !== void 0 && typeof e.problem === "string" && typeof e.action === "string") return e;
		if (isAbortError$2(err)) return syncError("RunInterrupted", { scope: "run" });
	}
	return syncError("UnexpectedFailure", { scope });
}
function raise(code, scope = "item", field) {
	throw syncRemoteError(syncError(code, {
		scope,
		...field !== void 0 ? { field } : {}
	}));
}
/** The rule must still be enabled under a live connection before any adapter request. */
function assertEnabled(config, rule) {
	const current = config.getRule(rule.id);
	if (current === null || !current.enabled) raise("InvalidConfig", "rule", "enabled");
	const connection = config.getConnection(current.connectionId);
	if (connection === null || !connection.enabled) raise("InvalidConfig", "connection", "enabled");
}
function mergePatch(a, b) {
	const out = { ...a };
	for (const field of Object.keys(b)) if (b[field] !== void 0) out[field] = b[field];
	return out;
}
function applyOptionalPatch(task, patch) {
	return {
		...task,
		priority: patch.priority ?? task.priority,
		tags: patch.tags ?? task.tags,
		storyPoints: patch.storyPoints ?? task.storyPoints
	};
}
function resultFor(key, taskId, category, changedFields, writtenBack, outsideFilter, error) {
	return {
		key,
		taskId,
		category,
		changedFields,
		discardedFields: [],
		writtenBack,
		outsideFilter,
		error
	};
}
function finalBaseline(task, localPatch, observed, rule) {
	const base = buildBaseline(task, observed, rule);
	if (!hasPatch(localPatch)) return base;
	return {
		...base,
		local: {
			...base.local,
			...localPatch
		},
		localVersion: task.version + 1
	};
}
function sameRemotePatch(a, b) {
	const fields = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const field of fields) {
		if (a[field] === void 0 && b[field] === void 0) continue;
		if (!deepEqual(a[field] ?? null, b[field] ?? null)) return false;
	}
	return true;
}
/**
* Wrap an adapter so a per-request gate runs before every high-level
* read/write/evidence/metadata call. `discover` (an async generator) is not
* wrapped here: its per-page fetches are gated by the transport's injected
* `beforeRequest` seam instead.
*/
function gatedAdapter(adapter, beforeRequest) {
	if (beforeRequest === void 0) return adapter;
	const gate = () => {
		beforeRequest();
	};
	return {
		metadata: (scope, signal) => {
			gate();
			return adapter.metadata(scope, signal);
		},
		discover: (rule, signal) => adapter.discover(rule, signal),
		read: (key, rule, signal) => {
			gate();
			return adapter.read(key, rule, signal);
		},
		write: (key, patch, observed, rule, signal) => {
			gate();
			return adapter.write(key, patch, observed, rule, signal);
		},
		evidence: (intent, observed, signal) => {
			gate();
			return adapter.evidence(intent, observed, signal);
		}
	};
}
/**
* Baseline that acknowledges the pending write-set as already applied on the
* remote, so a later plan never re-sends the old patch. Shared by the same-run
* confirm and the old-run adoption path.
*/
function acknowledgedBaseline(link, pending, observed, rule) {
	const base = link.baseline ?? pending.baseline;
	const acknowledged = {};
	for (const field of Object.keys(pending.patch)) acknowledged[field] = pending.expected[field];
	return {
		...base,
		remote: {
			...base.remote,
			...acknowledged
		}
	};
}
async function stabilizeWrite(input, task, baseline) {
	let observed = await input.adapter.read(input.key, input.rule, input.signal);
	let plan = planSync({
		local: task,
		remote: observed,
		baseline,
		rule: input.rule
	});
	for (let changes = 0; changes < MAX_REPLANS; changes += 1) {
		if (!hasPatch(plan.remotePatch)) return {
			observed,
			plan
		};
		const latest = await input.adapter.read(input.key, input.rule, input.signal);
		const latestPlan = planSync({
			local: task,
			remote: latest,
			baseline,
			rule: input.rule
		});
		if (sameRemotePatch(latestPlan.remotePatch, plan.remotePatch) && latestPlan.kind === plan.kind) return {
			observed: latest,
			plan: latestPlan
		};
		observed = latest;
		plan = latestPlan;
	}
	const current = input.tasks.get(task.id);
	if (current === null || current.version !== task.version) raise("LocalVersionConflict", "item");
	raise("RemoteUnavailable", "item");
}
function verifyWrite(intent, observed) {
	const projected = projectRemote(observed, intent.ruleSnapshot);
	return Object.keys(intent.patch).every((field) => {
		if (intent.patch[field] === void 0) return true;
		return deepEqual(projected[field], intent.expected[field]);
	});
}
/** The single-item sync pipeline; returns a recorded result and throws only run/storage-fatal errors. */
async function executeItem(input) {
	const { key, links, runs, fence, outsideFilter = false } = input;
	try {
		return await executeItemInner({
			...input,
			adapter: gatedAdapter(input.adapter, input.beforeRequest)
		});
	} catch (err) {
		const dto = errorDto$2(err);
		if (dto.code === "StaleOwner" || dto.code === "StorageFailure" || dto.code === "RunInterrupted" || isConnectionFatal$1(dto.code)) throw syncRemoteError(dto);
		const failed = resultFor(key, links.getLink(key)?.taskId ?? null, "failed", [], false, outsideFilter, dto);
		runs.recordResult(fence, failed);
		return failed;
	}
}
async function executeItemInner(input) {
	const { fence, rule, key, tasks, config, links, runs, adapter, outsideFilter = false } = input;
	const signal = input.signal;
	runs.assertFence(fence);
	assertEnabled(config, rule);
	const observed = await adapter.read(key, rule, signal);
	const pending = links.getPending(key);
	if (pending !== null) return reconcilePending(input, pending, observed);
	const link = links.getLink(key);
	const task = link !== null && link.taskId !== null ? tasks.get(link.taskId) : null;
	if (task === null) {
		const result = resultFor(key, links.importItem(observed, rule, fence).id, "imported", projectionFor(rule).fields, false, outsideFilter, null);
		runs.recordResult(fence, result);
		return result;
	}
	return processLinked(input, link, task, observed);
}
async function reconcilePending(input, pending, observed) {
	const { fence, key, links, runs, adapter, rule } = input;
	const patchFields = Object.keys(pending.patch);
	if (pending.fence.runId === fence.runId) {
		const result = await reconcileIntent(pending, adapter, input.signal);
		if (result.kind !== "confirmed") {
			const failed = resultFor(key, pending.taskId, "failed", [], false, false, syncError("WriteOutcomeUnknown", { scope: "item" }));
			runs.recordResult(fence, failed);
			return failed;
		}
		const link = links.getLink(key);
		const ackBaseline = acknowledgedBaseline(link, pending, result.observed, rule);
		try {
			links.finalizeItem({
				fence,
				linkId: link.id,
				linkRevision: link.revision,
				taskGeneration: link.taskGeneration,
				expectedTaskVersion: pending.localVersion,
				localPatch: {},
				observed: result.observed,
				baseline: ackBaseline,
				intentId: pending.id,
				result: resultFor(key, pending.taskId, "pushed", patchFields, true, false, null)
			});
			return resultFor(key, pending.taskId, "pushed", patchFields, true, false, null);
		} catch (err) {
			const dto = errorDto$2(err);
			if (dto.code === "StaleOwner") throw syncRemoteError(dto);
			return planAfterAck(input, pending, result.observed);
		}
	}
	const adopted = await links.reconcileAndAdopt(pending.id, fence, adapter, input.signal);
	if (adopted.kind !== "confirmed") {
		const failed = resultFor(key, pending.taskId, "failed", [], false, false, syncError("WriteOutcomeUnknown", { scope: "item" }));
		runs.recordResult(fence, failed);
		return failed;
	}
	return planAfterAck(input, pending, adopted.observed);
}
/** After an acknowledged old write, acknowledge the write-set in the baseline and plan the remaining edit. */
async function planAfterAck(input, pending, observed) {
	const { key, links, tasks, rule } = input;
	const link = links.getLink(key);
	const task = link.taskId !== null ? tasks.get(link.taskId) : null;
	const patchFields = Object.keys(pending.patch);
	if (task === null) return resultFor(key, null, "pushed", patchFields, true, false, null);
	const ackBaseline = acknowledgedBaseline(link, pending, observed, rule);
	if (planSync({
		local: task,
		remote: observed,
		baseline: ackBaseline,
		rule
	}).kind === "unchanged") return resultFor(key, task.id, "pushed", patchFields, true, false, null);
	return processLinked(input, link, task, observed, ackBaseline);
}
async function processLinked(input, link, task, observed, baselineOverride = null) {
	const { fence, rule, key, tasks, links, runs, adapter, outsideFilter = false } = input;
	let baseline = baselineOverride ?? link.baseline;
	let initializePatch = {};
	if (baseline !== null) {
		const rebased = rebaseProjection({
			task,
			remote: observed,
			baseline,
			rule
		});
		baseline = rebased.baseline;
		initializePatch = rebased.initializePatch;
	}
	const planningTask = hasPatch(initializePatch) ? applyOptionalPatch(task, initializePatch) : task;
	const plan = planSync({
		local: planningTask,
		remote: observed,
		baseline,
		rule
	});
	if (!hasPatch(plan.remotePatch)) {
		const localPatch = mergePatch(initializePatch, plan.localPatch);
		const category = plan.kind === "merge" ? "merged" : plan.kind === "unchanged" ? "unchanged" : "pulled";
		const changed = plan.selectedFields.filter((f) => (localPatch[f] ?? plan.remotePatch[f]) !== void 0);
		const result = resultFor(key, task.id, category, changed, false, outsideFilter, null);
		links.finalizeItem({
			fence,
			linkId: link.id,
			linkRevision: link.revision,
			taskGeneration: link.taskGeneration,
			expectedTaskVersion: task.version,
			localPatch,
			observed,
			baseline: finalBaseline(task, localPatch, observed, rule),
			intentId: null,
			result
		});
		return result;
	}
	const settled = await stabilizeWrite(input, planningTask, baseline);
	return performWrite(input, link, task, settled.observed, settled.plan, initializePatch, baseline);
}
async function performWrite(input, link, task, observed, plan, initializePatch, baseline) {
	const { fence, rule, key, tasks, config, links, runs, adapter, outsideFilter = false } = input;
	const current = tasks.get(task.id);
	if (current === null || current.version !== task.version) raise("LocalVersionConflict", "item");
	let intent;
	try {
		intent = links.prepareIntent({
			fence,
			link,
			task: current,
			observed,
			rule,
			plan
		});
	} catch (err) {
		const dto = errorDto$2(err);
		if (dto.code === "StaleOwner") throw syncRemoteError(dto);
		const failed = resultFor(key, task.id, "failed", [], false, outsideFilter, syncError("StorageFailure", { scope: "item" }));
		runs.recordResult(fence, failed);
		return failed;
	}
	try {
		assertEnabled(config, rule);
		runs.assertFence(fence);
	} catch (err) {
		const dto = errorDto$2(err);
		if (dto.code === "StaleOwner") throw syncRemoteError(dto);
		links.cancelIntent(intent.id, fence, dto);
		const failed = resultFor(key, task.id, "failed", [], false, outsideFilter, dto);
		runs.recordResult(fence, failed);
		return failed;
	}
	if (tasks.get(task.id)?.version !== current.version) {
		links.cancelIntent(intent.id, fence, syncError("LocalVersionConflict", { scope: "item" }));
		const failed = resultFor(key, task.id, "failed", [], false, outsideFilter, syncError("LocalVersionConflict", { scope: "item" }));
		runs.recordResult(fence, failed);
		return failed;
	}
	links.markDispatched(intent.id, fence);
	try {
		await adapter.write(key, plan.remotePatch, observed, rule, input.signal);
	} catch (err) {
		const dto = errorDto$2(err);
		if (dto.code === "StaleOwner" || dto.code === "RunInterrupted") throw syncRemoteError(dto);
		if (isUncertainWrite(dto.code) || dto.code === "InvalidConfig") links.recordUnknown(intent.id, fence, dto);
		else links.cancelIntent(intent.id, fence, dto);
		const failed = resultFor(key, task.id, "failed", [], false, outsideFilter, dto);
		runs.recordResult(fence, failed, links.getPending(key) !== null);
		return failed;
	}
	const writtenBack = await adapter.read(key, rule, input.signal);
	if (!verifyWrite(intent, writtenBack)) {
		const dto = syncError("VerificationFailed", { scope: "item" });
		links.recordUnknown(intent.id, fence, dto);
		const failed = resultFor(key, task.id, "failed", [], false, outsideFilter, dto);
		runs.recordResult(fence, failed);
		return failed;
	}
	const localPatch = mergePatch(initializePatch, plan.localPatch);
	const category = plan.kind === "merge" ? "merged" : "pushed";
	const changed = plan.selectedFields.filter((f) => (plan.remotePatch[f] ?? localPatch[f]) !== void 0);
	const result = resultFor(key, task.id, category, changed, true, outsideFilter, null);
	try {
		links.finalizeItem({
			fence,
			linkId: link.id,
			linkRevision: link.revision,
			taskGeneration: link.taskGeneration,
			expectedTaskVersion: current.version,
			localPatch,
			observed: writtenBack,
			baseline: finalBaseline(current, localPatch, writtenBack, rule),
			intentId: intent.id,
			result
		});
		return result;
	} catch (err) {
		const dto = errorDto$2(err);
		if (dto.code === "StaleOwner") throw syncRemoteError(dto);
		if (dto.code === "LocalVersionConflict") {
			const failed = resultFor(key, task.id, "failed", [], false, outsideFilter, dto);
			runs.recordResult(fence, failed);
			return failed;
		}
		const failed = resultFor(key, task.id, "failed", [], false, outsideFilter, syncError("StorageFailure", { scope: "item" }));
		runs.recordResult(fence, failed, links.getPending(key) !== null);
		return failed;
	}
}
//#endregion
//#region src/sync/executor.ts
/** Whole-run wall-clock budget; a manual sync may not run past this. */
const RUN_BUDGET_MS = 18e5;
/** Discovery pages and linked scans are bounded to this many per chunk. */
const LINK_SCAN_LIMIT = 100;
const CONNECTION_FATAL = /* @__PURE__ */ new Set([
	"AuthDenied",
	"RateLimited",
	"EntitlementUnavailable"
]);
const RUN_FATAL = /* @__PURE__ */ new Set([
	"StaleOwner",
	"RunInterrupted",
	"StorageFailure"
]);
function isConnectionFatal(code) {
	return CONNECTION_FATAL.has(code);
}
function isRunFatal(code) {
	return RUN_FATAL.has(code);
}
function isAbortError$1(err) {
	return typeof err === "object" && err !== null && err.name === "AbortError";
}
function errorDto$1(err) {
	if (err !== null && typeof err === "object") {
		const e = err;
		if (e.code === "task-list/sync" && e.details && typeof e.details.code === "string") return e.details;
		if (typeof e.code === "string" && SYNC_ERRORS[e.code] !== void 0 && typeof e.problem === "string" && typeof e.action === "string") return e;
		if (isAbortError$1(err)) return syncError("RunInterrupted", { scope: "run" });
	}
	return syncError("UnexpectedFailure", { scope: "run" });
}
/** Yield the event loop so long synchronous SQLite loops never starve other work. */
function yieldLoop() {
	return new Promise((resolve) => setImmediate(resolve));
}
/**
* Host-side manual sync executor. `start()` claims the singleton run lock and
* returns the run id immediately; the run proceeds on its own AbortController
* (never tied to a browser connection) and the host holds the settled promise.
* An already-live lock returns `existing: true` without starting work or
* heartbeating. `stop()` revokes the fence (marking the run interrupted), aborts
* the run, and awaits it. A concurrent heartbeat loop renews the ownership lease
* while the run awaits long reads/writes, so a healthy slow request never fenced
* out as a false zombie.
*/
var SyncExecutor = class {
	tasks;
	config;
	links;
	runs;
	adapterFactory;
	clock;
	ownerId = randomUUID();
	fence = null;
	controller = null;
	runPromise = null;
	ownsRun = false;
	constructor(options) {
		this.tasks = options.tasks;
		this.config = options.config;
		this.links = options.links;
		this.runs = options.runs;
		this.adapterFactory = options.adapterFactory;
		this.clock = options.clock;
	}
	start() {
		const claim = this.runs.claimRun(this.ownerId, this.clock.now());
		if (claim.existing) return {
			runId: claim.fence.runId,
			existing: true
		};
		const controller = new AbortController();
		this.fence = claim.fence;
		this.ownsRun = true;
		this.controller = controller;
		this.runPromise = this.runRun(claim.fence, controller);
		return {
			runId: claim.fence.runId,
			existing: false
		};
	}
	/** Resolves when the current run settles; never rejects. */
	done() {
		return this.runPromise ?? Promise.resolve();
	}
	/** Stop the owned run: mark it interrupted and release the lock, then abort and await. */
	async stop() {
		if (!this.ownsRun) {
			this.fence = null;
			this.runPromise = null;
			this.controller = null;
			return;
		}
		const fence = this.fence;
		const controller = this.controller;
		const promise = this.runPromise;
		this.fence = null;
		this.ownsRun = false;
		this.runPromise = null;
		this.controller = null;
		if (fence !== null) try {
			this.runs.revoke(fence);
		} catch {}
		controller?.abort();
		if (promise !== null) await promise.catch(() => {});
	}
	/**
	* Per-request gate bound to one rule. Re-checked before every HTTP attempt via
	* the transport, and before every high-level adapter call via `executeItem`'s
	* wrapped proxy. A throwing guard surfaces its own safe error and is never
	* re-mapped to a transient failure.
	*/
	gateFor(rule, fence, signal, startedAt) {
		const assertFence = this.runs.createFenceGuard(fence);
		const assertActive = this.config.createActiveGuard(rule.id);
		return () => {
			if (signal.aborted) throw syncRemoteError(syncError("RunInterrupted", {
				scope: "run",
				runId: fence.runId
			}));
			if (this.clock.now() - startedAt > RUN_BUDGET_MS) throw syncRemoteError(syncError("RunInterrupted", {
				scope: "run",
				runId: fence.runId
			}));
			assertFence();
			assertActive();
		};
	}
	async runRun(fence, controller) {
		const heartbeatAbort = new AbortController();
		const heartbeat = this.heartbeatLoop(fence, controller, heartbeatAbort.signal);
		try {
			await this.runSync(fence, controller.signal);
		} catch {} finally {
			heartbeatAbort.abort();
			await heartbeat.catch(() => {});
			if (this.controller === controller) {
				this.controller = null;
				this.ownsRun = false;
				this.fence = null;
			}
		}
	}
	/** Renew the lease on a concurrent timer; abort the run when ownership is lost. */
	async heartbeatLoop(fence, controller, signal) {
		try {
			for (;;) {
				await this.clock.sleep(SYNC_HEARTBEAT_MS, signal);
				if (this.runs.heartbeat(fence, this.clock.now())) continue;
				this.runs.markInterrupted(fence.runId);
				controller.abort();
				return;
			}
		} catch (err) {
			if (isAbortError$1(err)) return;
			this.runs.markInterrupted(fence.runId);
			controller.abort();
		}
	}
	async runSync(fence, signal) {
		const startedAt = this.clock.now();
		const errors = [];
		let discoveryComplete = true;
		let unprocessedKnown = 0;
		let status = "completed";
		const overBudget = () => this.clock.now() - startedAt > RUN_BUDGET_MS;
		try {
			this.runs.setPhase(fence, "discovering");
			const connections = this.config.listConnections();
			for (const connection of connections) {
				if (signal.aborted || overBudget()) {
					discoveryComplete = false;
					unprocessedKnown = null;
					break;
				}
				if (!connection.enabled) continue;
				const rules = this.config.listRules(connection.id);
				for (const rule of rules) {
					if (signal.aborted || overBudget()) {
						discoveryComplete = false;
						unprocessedKnown = null;
						break;
					}
					if (!rule.enabled) continue;
					const gate = this.gateFor(rule, fence, signal, startedAt);
					const adapter = await this.adapterFactory(connection, {
						beforeRequest: gate,
						projectId: rule.projectId
					});
					const outcome = await this.processRule(connection, rule, adapter, fence, signal, startedAt, gate);
					if (!outcome.discoveryComplete) {
						discoveryComplete = false;
						unprocessedKnown = null;
					}
					errors.push(...outcome.errors);
					if (outcome.connectionStopped) break;
				}
			}
			if (errors.length > 0 || !discoveryComplete) status = "partial";
		} catch (err) {
			const dto = errorDto$1(err);
			errors.push(dto);
			discoveryComplete = false;
			unprocessedKnown = null;
			status = dto.code === "RunInterrupted" ? "partial" : "failed";
		} finally {
			this.runs.finishRun(fence, status, {
				discoveryComplete,
				unprocessedKnown,
				errors
			});
		}
	}
	async processRule(connection, rule, adapter, fence, signal, startedAt, gate) {
		const errors = [];
		let discoveryComplete = true;
		const overBudget = () => this.clock.now() - startedAt > RUN_BUDGET_MS;
		try {
			for await (const batch of adapter.discover(rule, signal)) {
				if (signal.aborted) break;
				for (const item of batch) {
					if (signal.aborted || overBudget()) {
						discoveryComplete = false;
						return {
							discoveryComplete,
							errors,
							connectionStopped: false
						};
					}
					if (!this.runs.markSeen(fence, item.key)) continue;
					const outcome = await this.runItem(fence, rule, item.key, adapter, false, signal, gate);
					if (outcome.connectionStopped) {
						if (outcome.error) errors.push(outcome.error);
						return {
							discoveryComplete,
							errors,
							connectionStopped: true
						};
					}
				}
				await yieldLoop();
			}
		} catch (err) {
			const dto = errorDto$1(err);
			if (isRunFatal(dto.code)) throw err;
			errors.push(dto);
			discoveryComplete = false;
			if (isConnectionFatal(dto.code)) return {
				discoveryComplete,
				errors,
				connectionStopped: true
			};
		}
		let afterKey = null;
		for (;;) {
			if (signal.aborted || overBudget()) {
				discoveryComplete = false;
				return {
					discoveryComplete,
					errors,
					connectionStopped: false
				};
			}
			const page = this.links.listLinked(rule.id, afterKey, LINK_SCAN_LIMIT);
			if (page.length === 0) break;
			for (const link of page) {
				if (signal.aborted || overBudget()) {
					discoveryComplete = false;
					return {
						discoveryComplete,
						errors,
						connectionStopped: false
					};
				}
				if (this.runs.hasSeen(fence.runId, link.key)) continue;
				this.runs.markSeen(fence, link.key);
				const outcome = await this.runItem(fence, rule, link.key, adapter, true, signal, gate);
				if (outcome.connectionStopped) {
					if (outcome.error) errors.push(outcome.error);
					return {
						discoveryComplete,
						errors,
						connectionStopped: true
					};
				}
			}
			afterKey = serializeRemoteKey(page[page.length - 1].key);
			await yieldLoop();
		}
		return {
			discoveryComplete,
			errors,
			connectionStopped: false
		};
	}
	async runItem(fence, rule, key, adapter, outsideFilter, signal, gate) {
		try {
			await executeItem({
				fence,
				rule,
				key,
				tasks: this.tasks,
				config: this.config,
				links: this.links,
				runs: this.runs,
				adapter,
				clock: this.clock,
				signal,
				outsideFilter,
				beforeRequest: gate
			});
			return {
				connectionStopped: false,
				error: null
			};
		} catch (err) {
			const dto = errorDto$1(err);
			if (isRunFatal(dto.code)) throw syncRemoteError(dto);
			const failed = {
				key,
				taskId: this.links.getLink(key)?.taskId ?? null,
				category: "failed",
				changedFields: [],
				discardedFields: [],
				writtenBack: false,
				outsideFilter,
				error: dto
			};
			this.runs.recordResult(fence, failed);
			const connectionStopped = isConnectionFatal(dto.code);
			return {
				connectionStopped,
				error: connectionStopped ? dto : null
			};
		}
	}
};
//#endregion
//#region src/sync/service.ts
/** Extract a safe DTO from a thrown value; a raw message, header or body is never echoed. */
function errorDto(error) {
	if (error !== null && typeof error === "object") {
		const e = error;
		if (e.code === "task-list/sync" && e.details && typeof e.details.code === "string") return e.details;
	}
	return syncError("UnexpectedFailure", { scope: "connection" });
}
/**
* Host-side manual sync service. The 14 public methods are the business
* surface the TaskService delegates to, each returning a closed Safe DTO.
* Runs are owned by the executor; metadata/test are explicit read-only actions
* that build an adapter through the injected factory with a no-op gate — a
* disabled connection is still an allowed read.
*/
var SyncService = class {
	tasks;
	config;
	links;
	runs;
	executor;
	adapterFactory;
	secrets;
	organizations;
	tapdOrganizations;
	oauthToken;
	queryFactory;
	constructor(options) {
		this.tasks = options.tasks;
		this.config = options.config;
		this.links = options.links;
		this.runs = options.runs;
		this.executor = options.executor;
		this.adapterFactory = options.adapterFactory;
		this.secrets = options.secrets;
		this.organizations = options.organizations;
		this.tapdOrganizations = options.tapdOrganizations;
		this.oauthToken = options.oauthToken;
		this.queryFactory = options.queryFactory;
	}
	/** The live store, or undefined while the Host's credentials service is absent. */
	secretStore() {
		return this.secrets?.();
	}
	/**
	* A typed credential makes a manual connection usable exactly as an exported
	* environment variable does; OAuth connections keep the grant-based answer.
	*/
	async decorate(connection) {
		if (connection.authentication?.mode === "oauth" || connection.credentialPresent) return connection;
		const stored = await this.secretStore()?.read(connection.id);
		return stored === void 0 || stored === null || stored.platform !== connection.platform ? connection : {
			...connection,
			credentialPresent: true
		};
	}
	async listSyncConnections() {
		return Promise.all(this.config.listConnections().map((connection) => this.decorate(connection)));
	}
	/** Store a typed credential before the connection answers as usable. */
	async storeSecret(id, request) {
		if (request.secret === void 0) return;
		const store = this.secretStore();
		if (store === void 0) throw syncRemoteError(syncError("HostRestartRequired", {
			scope: "connection",
			field: "secret"
		}));
		if (request.secret.platform !== request.platform) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "secret"
		}));
		await store.write(id, request.secret);
	}
	async createSyncConnection(request) {
		const created = this.config.createConnection(request);
		await this.storeSecret(created.id, request);
		return this.decorate(created);
	}
	async updateSyncConnection(request) {
		const updated = this.config.updateConnection(request);
		await this.storeSecret(updated.id, {
			...request.secret === void 0 ? {} : { secret: request.secret },
			platform: updated.platform
		});
		return this.decorate(updated);
	}
	async deleteSyncConnection(request) {
		this.config.deleteConnection(request);
		await this.forgetSecret(request.id);
		return { deleted: true };
	}
	/** Drop one connection's typed credential; the OAuth path owns the grant record itself. */
	async forgetSecret(id) {
		await this.secretStore()?.remove(id);
	}
	/**
	* List the organizations a personal access token belongs to. The token is
	* either the one just typed in the editor or the connection's stored one; it
	* is never persisted by this call. A TAPD token answers with the account's
	* own organization, so its editor never has to ask for the company by hand.
	*/
	async listSyncOrganizations(request) {
		let token = request.token;
		let platform = request.platform;
		if (request.connectionId !== void 0) {
			const connection = this.config.getConnection(request.connectionId);
			platform = platform ?? connection?.platform;
		}
		if (token === void 0 && request.connectionId !== void 0) {
			const stored = await this.secretStore()?.read(request.connectionId);
			token = stored != null && (platform === void 0 || stored.platform === platform) ? stored.token : await this.oauthToken?.(request.connectionId) ?? void 0;
		}
		if (token === void 0 || !token.trim()) throw syncRemoteError(syncError("CredentialMissing", {
			scope: "connection",
			field: "token"
		}));
		const lister = platform === "tapd" ? this.tapdOrganizations : this.organizations;
		if (lister === void 0) throw syncRemoteError(syncError("HostRestartRequired", {
			scope: "connection",
			field: "secret"
		}));
		return lister(token);
	}
	listSyncRules() {
		return this.config.listRules();
	}
	createSyncRule(request) {
		return this.config.createRule(request);
	}
	updateSyncRule(request) {
		return this.config.updateRule(request);
	}
	deleteSyncRule(request) {
		this.config.deleteRule(request);
		return { deleted: true };
	}
	async getSyncMetadata(scope) {
		const connection = this.requireConnection(scope.connectionId);
		return (await this.adapterFactory(connection, {
			beforeRequest: () => {},
			...scope.projectId ? { projectId: scope.projectId } : {}
		})).metadata(scope, new AbortController().signal);
	}
	async testSyncConnection(scope) {
		const credentialPresent = (await this.decorate(this.requireConnection(scope.connectionId))).credentialPresent;
		try {
			return {
				ok: true,
				credentialPresent,
				readOnly: (await this.getSyncMetadata(scope)).readOnly
			};
		} catch (error) {
			return {
				ok: false,
				credentialPresent,
				error: errorDto(error)
			};
		}
	}
	startSync() {
		return this.executor.start();
	}
	getSyncRun(request) {
		return this.runs.getRun(request.id);
	}
	listSyncRuns(request) {
		return this.runs.listRuns(request.page, request.pageSize);
	}
	listSyncItemResults(request) {
		return this.runs.listItemResults(request.id, request.page, request.pageSize);
	}
	/**
	* One page of remote work items, projected to exactly the requested fields.
	* Filtering and sorting happen on the platform (verified `conditions` and
	* `orderBy`), so nothing is fetched only to be discarded locally.
	*/
	async listWorkitems(request) {
		const connection = this.requireConnection(request.connectionId);
		if (this.queryFactory === void 0) throw syncRemoteError(syncError("HostRestartRequired", {
			scope: "query",
			field: "queryFactory"
		}));
		const query = await this.queryFactory(connection);
		const conditions = request.conditions?.map((group) => group.map((condition) => ({
			field: condition.field,
			...condition.operator === void 0 ? {} : { operator: condition.operator },
			value: condition.value,
			...condition.toValue === void 0 || condition.toValue === null ? {} : { toValue: condition.toValue }
		})));
		const page = await query.listWorkitems({
			projectId: request.projectId,
			categories: request.categories,
			page: request.page,
			perPage: request.perPage,
			fields: request.fields,
			customFieldIds: request.customFieldIds,
			orderBy: request.orderBy,
			sort: request.sort,
			...conditions === void 0 ? {} : { conditions }
		}, new AbortController().signal);
		return {
			items: page.items,
			page: page.page,
			perPage: page.perPage,
			total: page.total,
			totalPages: page.totalPages,
			fields: [...page.fields]
		};
	}
	/**
	* One work item's body, unwrapped from the platform's JSON carrier. This is
	* the single detail request the "create a task from a work item" flow needs:
	* every other field already comes from the list projection.
	*/
	async getWorkitemDescription(request) {
		const connection = this.requireConnection(request.connectionId);
		if (this.queryFactory === void 0) throw syncRemoteError(syncError("HostRestartRequired", {
			scope: "query",
			field: "queryFactory"
		}));
		return { description: (await (await this.queryFactory(connection)).getWorkitem({
			projectId: request.projectId,
			id: request.id,
			include: ["description"],
			fields: ["id"]
		}, new AbortController().signal)).description };
	}
	/**
	* Every selectable field of one project category — or of a comma-joined set
	* of them — so the caller can offer the platform's own column catalog (native
	* fields and custom fields alike) while a category-free list is shown.
	*/
	async listWorkitemFields(request) {
		const connection = this.requireConnection(request.connectionId);
		if (this.queryFactory === void 0) throw syncRemoteError(syncError("HostRestartRequired", {
			scope: "query",
			field: "queryFactory"
		}));
		return (await this.queryFactory(connection)).listFields({
			projectId: request.projectId,
			categories: request.categories
		}, new AbortController().signal);
	}
	/** Attach the current page's sync-source badges in one batch, never a platform request. */
	attachSources(tasks) {
		return this.links.attachSources(tasks);
	}
	requireConnection(connectionId) {
		const connection = this.config.getConnection(connectionId);
		if (connection === null) throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "id"
		}));
		return connection;
	}
};
//#endregion
//#region src/sync/transport.ts
/** Official, evidenced HTTPS origins only. Region instances have no documented
* origin pattern in the capability evidence, so no region host is allowlisted. */
const ALLOWED_HOSTNAMES = /* @__PURE__ */ new Set(["openapi-rdc.aliyuncs.com", "api.tapd.cn"]);
const READ_MAX_ATTEMPTS = 3;
const READ_TIMEOUT_MS = 3e4;
const MAX_BODY_BYTES = 2097152;
const MAX_RETRY_AFTER_MS = 6e4;
const RETRY_BASE_DELAY_MS = 1e3;
const REQUEST_ID_HEADERS = ["x-request-id", "request-id"];
const CONTROL$6 = /[\u0000-\u001f]/u;
const REQUEST_ID_LIMIT = 200;
/** An internal, retry-aware failure; the safe DTO is surfaced to the executor
* only when the transport stops retrying. */
var TransportFailure = class extends Error {
	dto;
	retryable;
	retryAfterMs;
	constructor(dto, retryable, retryAfterMs) {
		super(dto.code);
		this.dto = dto;
		this.retryable = retryable;
		this.retryAfterMs = retryAfterMs;
		this.name = "TransportFailure";
	}
};
function abortError$1() {
	return new DOMException("The operation was aborted", "AbortError");
}
function isAbortError(err) {
	return typeof err === "object" && err !== null && err.name === "AbortError";
}
function hasPathTraversal(pathname) {
	return pathname.split("/").some((segment) => {
		if (segment === "") return false;
		try {
			return decodeURIComponent(segment) === "..";
		} catch {
			return true;
		}
	});
}
function clampDelay(ms) {
	return Math.min(Math.max(0, ms), MAX_RETRY_AFTER_MS);
}
/** Exponential read backoff for transient failures without a Retry-After:
* 1s before the second attempt, 2s before the third, bounded at 60s. */
function retryDelay(attemptNo) {
	return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attemptNo - 1), MAX_RETRY_AFTER_MS);
}
function parseRetryAfter(headers, nowMs) {
	const raw = headers.get("retry-after");
	if (raw === null) return void 0;
	const value = raw.trim();
	if (value === "") return void 0;
	if (/^\d+$/.test(value)) {
		const seconds = Number(value);
		if (Number.isFinite(seconds)) return clampDelay(seconds * 1e3);
		return;
	}
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return void 0;
	return clampDelay(parsed - nowMs);
}
function safeRequestId(headers) {
	for (const name of REQUEST_ID_HEADERS) {
		const value = headers.get(name);
		if (value !== null) {
			const trimmed = value.trim();
			if (trimmed !== "" && trimmed.length <= REQUEST_ID_LIMIT && !CONTROL$6.test(trimmed)) return trimmed;
			return;
		}
	}
}
function concat(chunks, total) {
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}
const decoder = new TextDecoder();
/**
* Bounded HTTPS transport for the platform adapters. A {@link HostRequest} is
* built by the host-side adapter (never through RPC), so the transport only
* enforces the origin boundary and the read/write budget. Reads retry a
* bounded set of transient failures; writes are issued exactly once and an
* uncertain outcome is reported as `WriteOutcomeUnknown`.
*/
var SyncTransport = class {
	fetch;
	clock;
	beforeRequest;
	constructor(options) {
		this.fetch = options.fetch;
		this.clock = options.clock;
		this.beforeRequest = options.beforeRequest;
	}
	async read(request, signal) {
		this.validateMode(request, "read");
		this.validateUrl(request.url);
		return this.execute(request, signal, "read");
	}
	async write(request, signal) {
		this.validateMode(request, "write");
		this.validateUrl(request.url);
		return this.execute(request, signal, "write");
	}
	validateMode(request, mode) {
		const reject = (field) => {
			throw syncRemoteError(syncError("InvalidConfig", {
				scope: "connection",
				field
			}));
		};
		const { method } = request;
		if (method !== "GET" && method !== "POST" && method !== "PUT") reject("method");
		if (typeof request.readOnly !== "boolean") reject("readOnly");
		if (mode === "read") {
			if (method === "PUT") reject("method");
			if (!request.readOnly) reject("readOnly");
		} else {
			if (method === "GET") reject("method");
			if (request.readOnly) reject("readOnly");
		}
	}
	validateUrl(url) {
		const reject = () => {
			throw syncRemoteError(syncError("InvalidConfig", {
				scope: "connection",
				field: "url"
			}));
		};
		if (url.protocol !== "https:") reject();
		if (url.username !== "" || url.password !== "") reject();
		if (url.port !== "") reject();
		if (url.hash !== "") reject();
		if (!ALLOWED_HOSTNAMES.has(url.hostname.toLowerCase())) reject();
		if (hasPathTraversal(url.pathname)) reject();
	}
	async execute(request, signal, mode) {
		const maxAttempts = mode === "read" ? READ_MAX_ATTEMPTS : 1;
		let retryAfterMs = 0;
		for (let attemptNo = 1;; attemptNo++) {
			if (signal.aborted) throw abortError$1();
			if (retryAfterMs > 0) {
				await this.clock.sleep(retryAfterMs, signal);
				retryAfterMs = 0;
			}
			this.beforeRequest?.();
			try {
				return await this.attempt(request, signal, mode);
			} catch (err) {
				if (err instanceof TransportFailure) {
					if (!err.retryable || attemptNo >= maxAttempts) throw syncRemoteError(err.dto);
					retryAfterMs = err.retryAfterMs ?? retryDelay(attemptNo);
					continue;
				}
				throw err;
			}
		}
	}
	async attempt(request, signal, mode) {
		const timeoutCode = mode === "read" ? "ReadTimeout" : "WriteOutcomeUnknown";
		const timeoutScope = mode === "read" ? "connection" : "item";
		const attemptController = new AbortController();
		const onAbort = () => attemptController.abort();
		if (signal.aborted) throw abortError$1();
		signal.addEventListener("abort", onAbort, { once: true });
		try {
			const deadline = this.clock.now() + READ_TIMEOUT_MS;
			const timeoutFailure = new TransportFailure(syncError(timeoutCode, { scope: timeoutScope }), false);
			const work = (async () => {
				const response = await this.fetch(request.url, this.fetchInit(request, attemptController.signal));
				return await this.handleResponse(response, mode);
			})();
			return await this.raceAttempt(work, deadline, () => attemptController.abort(), timeoutFailure);
		} catch (err) {
			if (err instanceof TransportFailure) throw err;
			if (isAbortError(err)) throw abortError$1();
			return this.networkFailure(mode);
		} finally {
			signal.removeEventListener("abort", onAbort);
		}
	}
	networkFailure(mode) {
		if (mode === "write") throw new TransportFailure(syncError("WriteOutcomeUnknown", { scope: "item" }), false);
		throw new TransportFailure(syncError("NetworkFailure", { scope: "connection" }), true);
	}
	raceAttempt(work, deadline, onTimeout, timeoutFailure) {
		return new Promise((resolve, reject) => {
			let settled = false;
			const timeoutController = new AbortController();
			const settle = (fn) => {
				if (settled) return;
				settled = true;
				timeoutController.abort();
				fn();
			};
			work.then((result) => settle(() => resolve(result)), (err) => settle(() => reject(err)));
			const remaining = Math.max(0, deadline - this.clock.now());
			this.clock.sleep(remaining, timeoutController.signal).then(() => settle(() => {
				onTimeout();
				reject(timeoutFailure);
			}), () => {});
		});
	}
	fetchInit(request, signal) {
		return {
			method: request.method,
			headers: new Headers(request.headers),
			signal,
			redirect: "error",
			...request.body !== void 0 ? { body: request.body } : {}
		};
	}
	async handleResponse(response, mode) {
		const status = response.status;
		const requestId = safeRequestId(response.headers);
		const scope = "connection";
		const itemScope = "item";
		if (status === 401 || status === 403) throw new TransportFailure(syncError("AuthDenied", {
			scope,
			...requestId !== void 0 ? { requestId } : {}
		}), false);
		if (status >= 300 && status <= 399) {
			if (mode === "write") throw new TransportFailure(syncError("WriteOutcomeUnknown", {
				scope: itemScope,
				...requestId !== void 0 ? { requestId } : {}
			}), false);
			throw new TransportFailure(syncError("InvalidRemoteResponse", { scope: itemScope }), false);
		}
		if (mode === "read") {
			if (status === 429) {
				const retryAfterMs = parseRetryAfter(response.headers, this.clock.now());
				throw new TransportFailure(syncError("RateLimited", {
					scope,
					...requestId !== void 0 ? { requestId } : {}
				}), true, retryAfterMs);
			}
			if (status >= 500 && status <= 599) throw new TransportFailure(syncError("NetworkFailure", {
				scope,
				...requestId !== void 0 ? { requestId } : {}
			}), true);
			if (status >= 200 && status <= 299) return this.readSuccessBody(response);
			return this.readBestEffortBody(response);
		}
		if (status >= 200 && status <= 299) return this.readWriteBody(response);
		if (status >= 500 && status <= 599) throw new TransportFailure(syncError("WriteOutcomeUnknown", {
			scope: itemScope,
			...requestId !== void 0 ? { requestId } : {}
		}), false);
		return this.readBestEffortBody(response);
	}
	async readSuccessBody(response) {
		const text = decoder.decode(await this.readBody(response.body, "InvalidRemoteResponse"));
		if (text.trim() === "") throw new TransportFailure(syncError("InvalidRemoteResponse", { scope: "item" }), false);
		const value = parseJson(text);
		if (value === void 0) throw new TransportFailure(syncError("InvalidRemoteResponse", { scope: "item" }), false);
		return {
			value,
			headers: response.headers,
			status: response.status
		};
	}
	async readWriteBody(response) {
		const text = decoder.decode(await this.readBody(response.body, "WriteOutcomeUnknown"));
		if (text.trim() === "") return {
			value: null,
			headers: response.headers,
			status: response.status
		};
		const value = parseJson(text);
		if (value === void 0) throw new TransportFailure(syncError("WriteOutcomeUnknown", { scope: "item" }), false);
		return {
			value,
			headers: response.headers,
			status: response.status
		};
	}
	async readBestEffortBody(response) {
		const text = decoder.decode(await this.readBody(response.body, "InvalidRemoteResponse"));
		if (text.trim() === "") return {
			value: null,
			headers: response.headers,
			status: response.status
		};
		const value = parseJson(text);
		return {
			value: value === void 0 ? null : value,
			headers: response.headers,
			status: response.status
		};
	}
	async readBody(body, overflowCode) {
		if (!body) return /* @__PURE__ */ new Uint8Array(0);
		const reader = body.getReader();
		const chunks = [];
		let total = 0;
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value) {
					total += value.byteLength;
					if (total > MAX_BODY_BYTES) {
						await reader.cancel().catch(() => {});
						throw new TransportFailure(syncError(overflowCode, { scope: "item" }), false);
					}
					chunks.push(value);
				}
			}
		} finally {
			reader.releaseLock();
		}
		return concat(chunks, total);
	}
};
function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
//#endregion
//#region src/sync/workitem-packer.ts
const LABELS$1 = [
	["status", "Status"],
	["assignee", "Assignee"],
	["creator", "Creator"],
	["created", "Created"],
	["updated", "Updated"],
	["type", "Type"],
	["sprint", "Sprint"],
	["priority", "Priority"],
	["labels", "Labels"]
];
function text$1(value) {
	return typeof value === "string" ? value.trim() : "";
}
function referenceName(value) {
	if (typeof value !== "object" || value === null) return "";
	const record = value;
	const name = typeof record.displayName === "string" && record.displayName !== "" ? record.displayName : record.name;
	return typeof name === "string" ? name : "";
}
function namesOf(value) {
	if (!Array.isArray(value)) return "";
	return value.map((entry) => referenceName(entry)).filter((name) => name !== "").join(", ");
}
/** `{ name, value }` for every custom field the row carries, in platform order. */
function customFieldsOf(value) {
	if (!Array.isArray(value)) return [];
	const out = [];
	for (const entry of value) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry;
		const name = text$1(record.fieldName);
		const values = Array.isArray(record.values) ? record.values.flatMap((item) => typeof item === "object" && item !== null && typeof item.displayValue === "string" ? [item.displayValue] : []) : [];
		if (name === "" || values.length === 0) continue;
		out.push({
			name,
			value: values.join(", ")
		});
	}
	return out;
}
/**
* Read the display values out of one raw work-item row. Timestamps are epoch
* milliseconds in the platform payload; an absent or non-numeric one is skipped
* rather than shown as a wrong date.
*/
function displayFieldsOf(raw, format) {
	const row = typeof raw === "object" && raw !== null ? raw : {};
	const stamp = (value) => {
		const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
		return numeric === null ? "" : format(numeric);
	};
	return {
		number: text$1(row.serialNumber) || (typeof row.serialNumber === "number" ? String(row.serialNumber) : ""),
		status: referenceName(row.status),
		assignee: referenceName(row.assignedTo),
		creator: referenceName(row.creator),
		created: stamp(row.gmtCreate),
		updated: stamp(row.gmtModified),
		type: referenceName(row.workitemType),
		sprint: referenceName(row.sprint),
		priority: "",
		labels: namesOf(row.labels ?? row.tags),
		custom: customFieldsOf(row.customFieldValues)
	};
}
/** A timestamp as a date-time string; the platform's own values are epoch ms. */
function formatTimestamp(timestamp) {
	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(timestamp);
}
function paragraph(text) {
	return {
		type: "paragraph",
		children: [{ text }]
	};
}
/**
* Build the description: the number and subject as the heading-shaped first
* line (so a task title still reads), then the labelled row values, then the
* work item's own body as plain text.
*/
function packWorkitemDescription(raw, body) {
	const display = displayFieldsOf(raw, formatTimestamp);
	const blocks = [];
	const subject = text$1((typeof raw === "object" && raw !== null ? raw : {}).subject);
	const heading = display.number === "" ? subject : subject === "" ? display.number : `${display.number} ${subject}`;
	if (heading !== "") blocks.push({
		type: "heading",
		level: 3,
		children: [{ text: heading }]
	});
	const meta = [];
	const priority = display.custom.find((entry) => entry.name === "优先级" || entry.name === "priority");
	const resolved = {
		...display,
		priority: priority?.value ?? ""
	};
	for (const [field, label] of LABELS$1) {
		const value = resolved[field];
		if (value !== "") meta.push(`${label}: ${value}`);
	}
	for (const entry of resolved.custom) {
		if (entry === priority) continue;
		meta.push(`${entry.name}: ${entry.value}`);
	}
	if (meta.length > 0) blocks.push(paragraph(meta.join("\n")));
	const trimmed = body.trim();
	if (trimmed !== "") blocks.push(paragraph(trimmed));
	return {
		version: 1,
		blocks
	};
}
//#endregion
//#region src/sync/adapters/yunxiao-codec.ts
const ID_LIMIT$3 = 200;
const TITLE_LIMIT$1 = 1e3;
const LABEL_LIMIT$1 = 100;
const CONTROL$5 = /[\u0000-\u001f]/u;
function fail$5(field) {
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field
	}));
}
function isPlainObject$3(value) {
	return typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function idString$1(value, field) {
	if (typeof value !== "string" || !value.trim() || value.length > ID_LIMIT$3 || CONTROL$5.test(value)) fail$5(field);
	return value;
}
/** Extract an id from either a plain string or an object carrying `id`; ids stay strings, never numbers. */
function extractId(value, field) {
	if (value === void 0 || value === null) return void 0;
	if (typeof value === "string") return idString$1(value, field);
	if (isPlainObject$3(value)) {
		const id = value.id;
		if (typeof id === "string") return idString$1(id, field);
	}
	fail$5(field);
}
function textValue$1(value, field, max) {
	if (typeof value !== "string" || !value.trim() || value.length > max || CONTROL$5.test(value)) fail$5(field);
	return value;
}
function label$1(value, fallback) {
	if (typeof value === "string" && value.trim() && value.length <= LABEL_LIMIT$1 && !CONTROL$5.test(value)) return value;
	return fallback;
}
/** `formatType` is RICHTEXT or MARKDOWN; anything else falls back to richtext rather than inventing a format. */
function normalizeFormat(formatType) {
	if (typeof formatType === "string" && formatType.toUpperCase() === "MARKDOWN") return "markdown";
	return "richtext";
}
/**
* Resolve the local status of one platform status id: the rule's write mapping
* read backwards. An id no local status maps to is a mapping incompatibility —
* never silently cast to a `TaskStatus` or defaulted to `todo`.
*/
function statusForRaw(raw, statusWriteStates) {
	for (const status of [
		"todo",
		"in_progress",
		"done"
	]) if (statusWriteStates[status] === raw) return status;
	throw syncRemoteError(syncError("MappingIncompatible", {
		scope: "item",
		field: "status"
	}));
}
/**
* Decode one bare Yunxiao work item into the shared vocabulary. The identity
* fields (id, space.id, workitemType.id) are verified against the requested key
* so a malformed cross-project response is never rebound to a different item.
* `gmtModified` is kept as an opaque string (no date parsing) and there is no
* revision token (no documented CAS). Optional fields stay absent: only the
* status is ever written back, so nothing else is compared.
*/
function decodeWorkitem(raw, ctx) {
	if (!isPlainObject$3(raw)) fail$5("item");
	if (extractId(raw.id, "item.id") !== ctx.id) fail$5("item.id");
	if (extractId(raw.space, "item.space") !== ctx.projectId) fail$5("item.space");
	if (extractId(raw.workitemType, "item.workitemType") !== ctx.typeId) fail$5("item.workitemType");
	const number = typeof raw.serialNumber === "string" ? raw.serialNumber : typeof raw.serialNumber === "number" ? String(raw.serialNumber) : "";
	const updatedToken = typeof raw.gmtModified === "string" ? raw.gmtModified : "";
	const title = textValue$1(raw.subject, "item.subject", TITLE_LIMIT$1);
	const statusId = extractId(raw.status, "item.status");
	if (statusId === void 0) fail$5("item.status");
	const statusField = {
		presence: "value",
		value: statusForRaw(statusId, ctx.statusWriteStates),
		writable: true
	};
	const format = normalizeFormat(raw.formatType);
	let decodedBody = {
		version: 1,
		blocks: []
	};
	let descriptionRaw;
	let roundTrip;
	if (typeof raw.description === "string") {
		descriptionRaw = {
			presence: "value",
			value: raw.description,
			writable: true
		};
		const decoded = decodeDescription(descriptionRaw, format);
		decodedBody = decoded.content;
		roundTrip = decoded.roundTrip;
	} else if (raw.description === null) {
		descriptionRaw = {
			presence: "null",
			writable: true
		};
		roundTrip = true;
	} else {
		descriptionRaw = {
			presence: "absent",
			writable: false
		};
		roundTrip = false;
	}
	const packed = packWorkitemDescription(raw, contentText(decodedBody));
	return {
		key: {
			instance: ctx.instance,
			projectId: ctx.projectId,
			typeId: ctx.typeId,
			id: ctx.id
		},
		number,
		url: null,
		updatedToken,
		fields: {
			title: {
				presence: "value",
				value: title,
				writable: true
			},
			description: {
				presence: "value",
				value: packed,
				writable: true
			},
			status: statusField,
			priority: {
				presence: "absent",
				writable: false
			},
			tags: {
				presence: "absent",
				writable: false
			},
			storyPoints: {
				presence: "absent",
				writable: false
			}
		},
		rawStatus: statusId,
		description: {
			format,
			raw: descriptionRaw,
			roundTrip
		},
		revisionToken: null
	};
}
/** Decode a search summary's identity, verifying it belongs to the requested project. */
function decodeSearchIdentity(raw, projectId) {
	if (!isPlainObject$3(raw)) fail$5("item");
	const id = extractId(raw.id, "item.id");
	const spaceId = extractId(raw.space, "item.space");
	const typeId = extractId(raw.workitemType, "item.workitemType");
	if (id === void 0 || typeId === void 0 || spaceId !== projectId) fail$5("item");
	return {
		id,
		typeId
	};
}
/** Decode a bare array of `{ [idKey]: string, [labelKey]: string }` into options. */
function decodeOptionList(raw, idKey, labelKey) {
	if (!Array.isArray(raw)) fail$5("options");
	return raw.map((item) => {
		if (!isPlainObject$3(item)) fail$5("option");
		const id = idString$1(item[idKey], "option.id");
		return {
			id,
			label: label$1(item[labelKey], id)
		};
	});
}
/** Decode a workflow `{ statuses: [{ id, name }] }` into status options. */
function decodeWorkflowStatuses(raw) {
	if (!isPlainObject$3(raw)) fail$5("workflow");
	if (!Array.isArray(raw.statuses)) fail$5("workflow.statuses");
	return decodeOptionList(raw.statuses, "id", "name");
}
//#endregion
//#region src/sync/credentials.ts
/**
* Resolve the host-side credentials a connection references. Both platforms
* carry a personal access token, so only the exact environment variable name
* recorded on the connection is read — the env record is never enumerated, and
* no credential value is exported to the browser. A missing or blank variable
* raises a safe `CredentialMissing` error before any request is issued.
*/
function resolveCredentials(connection, env) {
	const token = env[connection.tokenEnv];
	if (token === void 0 || token.trim() === "") throw syncRemoteError(syncError("CredentialMissing", {
		scope: "connection",
		field: "tokenEnv"
	}));
	return connection.platform === "yunxiao" ? {
		kind: "yunxiao",
		token
	} : {
		kind: "tapd",
		token
	};
}
//#endregion
//#region src/sync/adapters/yunxiao.ts
const PAGE_SIZE$1 = 200;
/** The three 云效 work-item categories a project-wide query covers. */
const CATEGORIES$1 = "Req,Bug,Task";
function fail$4(field) {
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field
	}));
}
function headerInt$1(headers, name) {
	const raw = headers.get(name);
	if (raw === null) return void 0;
	const value = raw.trim();
	if (!/^\d+$/.test(value)) return void 0;
	const n = Number(value);
	return Number.isSafeInteger(n) && n >= 0 ? n : void 0;
}
/**
* Resolve the next page number from the six documented pagination headers, or
* `null` when the response proves termination (`x-page >= x-total-pages`). A
* repeated/non-increasing page or an absence of any reliable termination
* evidence reports IncompleteDiscovery rather than silently truncating.
*/
function nextPage(headers, currentPage) {
	const page = headerInt$1(headers, "x-page");
	const totalPages = headerInt$1(headers, "x-total-pages");
	const next = headerInt$1(headers, "x-next-page");
	if (page !== void 0 && totalPages !== void 0 && page >= totalPages) return null;
	if (next !== void 0 && next > currentPage) return next;
	throw syncRemoteError(syncError("IncompleteDiscovery", { scope: "connection" }));
}
/**
* Official 云效 endpoint listing the organizations one credential can see. The
* standard-proprietary family is the one that answers here (same origin and
* `x-yunxiao-token` header as every Projex call); the Alibaba Cloud OpenAPI
* name of the same operation does not exist on this host and redirects away.
*/
const ORGANIZATIONS_URL = "https://openapi-rdc.aliyuncs.com/oapi/v1/platform/organizations";
/**
* Decode the organization list. The envelope differs between the documented
* OpenAPI shape and the standard-proprietary one this host serves, so every
* known carrier of the array is accepted and only `id`/`name` pairs survive.
*/
function decodeOrganizations(raw) {
	const rows = organizationRows(raw);
	if (rows === null) fail$4("organizations");
	return rows.map((row) => {
		if (typeof row !== "object" || row === null || Array.isArray(row)) fail$4("organizations");
		const value = row;
		const id = value.id;
		if (typeof id === "string" && id.trim()) return {
			id: id.trim(),
			name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : id.trim()
		};
		if (typeof id === "number" && Number.isSafeInteger(id)) return {
			id: String(id),
			name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : String(id)
		};
		fail$4("organizations");
	});
}
/** The row array of one organization response, or null when the body carries none. */
function organizationRows(raw) {
	if (Array.isArray(raw)) return raw;
	if (typeof raw !== "object" || raw === null) return null;
	const body = raw;
	for (const key of [
		"organizations",
		"result",
		"content",
		"data",
		"items"
	]) {
		const value = body[key];
		if (Array.isArray(value)) return value;
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			const nested = value;
			for (const inner of [
				"organizations",
				"content",
				"data",
				"items"
			]) if (Array.isArray(nested[inner])) return nested[inner];
		}
	}
	return null;
}
/**
* List the organizations a 云效 personal access token can see. The token is
* used for this one request and never stored or returned.
*/
async function listYunxiaoOrganizations(token, transport, signal) {
	if (!token.trim()) throw syncRemoteError(syncError("CredentialMissing", {
		scope: "connection",
		field: "token"
	}));
	return decodeOrganizations((await transport.read({
		url: new URL(ORGANIZATIONS_URL),
		method: "GET",
		headers: { "x-yunxiao-token": token },
		readOnly: true
	}, signal)).value);
}
/**
* Build a Yunxiao (modern Projex) adapter for one center connection. The token
* is the Host-resolved credential when one was typed in the settings page, and
* otherwise the referenced environment variable; either way a missing
* credential fails before any network request and the token never enters a DTO.
* Region mode has no documented origin in the transport allowlist, so it is
* rejected explicitly rather than guessing a host.
*/
function createYunxiaoAdapter(connection, transport, env = process.env, stored) {
	if (connection.platform !== "yunxiao") throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "platform"
	}));
	if (connection.mode === "region") throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "regionHost"
	}));
	const credentials = stored ?? resolveCredentials(connection, env);
	if (credentials.kind !== "yunxiao") throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "platform"
	}));
	const token = credentials.token;
	const instance = connection.organizationId;
	const base = `https://openapi-rdc.aliyuncs.com/oapi/v1/projex/organizations/${encodeURIComponent(instance)}`;
	const url = (path) => new URL(`${base}${path}`);
	const auth = (extra = {}) => ({
		"x-yunxiao-token": token,
		...extra
	});
	async function fetchDetailRaw(key, signal) {
		return (await transport.read({
			url: url(`/workitems/${encodeURIComponent(key.id)}`),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value;
	}
	async function readDetail(key, statusWriteStates, signal) {
		return decodeWorkitem(await fetchDetailRaw(key, signal), {
			instance,
			projectId: key.projectId,
			typeId: key.typeId,
			id: key.id,
			statusWriteStates
		});
	}
	async function listOptions(path, idKey, labelKey, signal) {
		return decodeOptionList((await transport.read({
			url: url(path),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value, idKey, labelKey);
	}
	async function searchProjects(signal) {
		const out = [];
		let page = 1;
		for (;;) {
			const response = await transport.read({
				url: url("/projects:search"),
				method: "POST",
				headers: auth({ "content-type": "application/json" }),
				body: JSON.stringify({
					page,
					perPage: PAGE_SIZE$1
				}),
				readOnly: true
			}, signal);
			if (!Array.isArray(response.value)) fail$4("projects");
			out.push(...decodeOptionList(response.value, "id", "name"));
			const next = nextPage(response.headers, page);
			if (next === null) break;
			page = next;
		}
		return out;
	}
	async function listTypes(projectId, signal) {
		const out = [];
		for (const category of CATEGORIES$1.split(",")) {
			const response = await transport.read({
				url: url(`/projects/${encodeURIComponent(projectId)}/workitemTypes?category=${category}`),
				method: "GET",
				headers: auth(),
				readOnly: true
			}, signal);
			if (!Array.isArray(response.value)) fail$4("types");
			out.push(...response.value);
		}
		return out;
	}
	async function typeCapability(projectId, typeId, signal) {
		await transport.read({
			url: url(`/projects/${encodeURIComponent(projectId)}/workitemTypes/${encodeURIComponent(typeId)}/fields`),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal);
		const statuses = decodeWorkflowStatuses((await transport.read({
			url: url(`/projects/${encodeURIComponent(projectId)}/workitemTypes/${encodeURIComponent(typeId)}/workflows`),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value);
		return {
			typeId,
			fields: [
				"title",
				"description",
				"status"
			],
			readStates: statuses,
			writeStates: statuses,
			representation: {
				format: "richtext",
				roundTrip: true
			},
			paging: { kind: "page" },
			workflow: statuses.length ? { readOnly: false } : { readOnly: true },
			candidateFields: []
		};
	}
	return {
		async metadata(scope, signal) {
			const projects = await searchProjects(signal);
			let members = [];
			let iterations = [];
			let types = [];
			let typeCapabilities = [];
			if (scope.projectId !== void 0) {
				members = await listOptions(`/projects/${encodeURIComponent(scope.projectId)}/members`, "userId", "userName", signal);
				iterations = await listOptions(`/projects/${encodeURIComponent(scope.projectId)}/sprints`, "id", "name", signal);
				const rawTypes = await listTypes(scope.projectId, signal);
				const uniqueTypes = [];
				const seenTypeIds = /* @__PURE__ */ new Set();
				for (const item of rawTypes) {
					const typeId = item.id;
					if (typeof typeId === "string" && !seenTypeIds.has(typeId)) {
						seenTypeIds.add(typeId);
						uniqueTypes.push(item);
					}
				}
				types = decodeOptionList(uniqueTypes, "id", "name");
				const targets = scope.typeId !== void 0 ? uniqueTypes.filter((item) => item.id === scope.typeId) : uniqueTypes;
				for (const item of targets) {
					const typeId = item.id;
					if (typeof typeId === "string") typeCapabilities.push(await typeCapability(scope.projectId, typeId, signal));
				}
			}
			return {
				connectionId: scope.connectionId,
				credentialPresent: true,
				readOnly: false,
				projects,
				members,
				iterations,
				types,
				typeCapabilities
			};
		},
		/**
		* Discover every work item the rule's query selects. The query is applied by
		* the platform (`conditions`), so a rule that names 负责人/迭代/状态/类型 never
		* fetches the project's whole backlog; every returned item is then read once
		* because the packed task description needs its body and its own fields
		* (the search summary carries neither).
		*/
		async *discover(rule, signal) {
			const conditions = buildConditions(rule.conditions);
			let page = 1;
			for (;;) {
				const response = await transport.read({
					url: url("/workitems:search"),
					method: "POST",
					headers: auth({ "content-type": "application/json" }),
					body: JSON.stringify({
						category: CATEGORIES$1,
						spaceId: rule.projectId,
						page,
						perPage: PAGE_SIZE$1,
						orderBy: "gmtCreate",
						sort: "asc",
						...conditions === void 0 ? {} : { conditions }
					}),
					readOnly: true
				}, signal);
				if (!Array.isArray(response.value)) fail$4("search");
				const next = nextPage(response.headers, page);
				const batch = [];
				for (const raw of response.value) {
					const { id, typeId } = decodeSearchIdentity(raw, rule.projectId);
					const key = {
						instance,
						projectId: rule.projectId,
						typeId,
						id
					};
					batch.push(await readDetail(key, rule.statusWriteStates, signal));
				}
				yield batch;
				if (next === null) break;
				page = next;
			}
		},
		async read(key, rule, signal) {
			return readDetail(key, rule.statusWriteStates, signal);
		},
		/**
		* Write back the one field a rule owns: the status, as the rule's own map
		* decides. Every other patch key is a configuration error, never a silent
		* write attempt.
		*/
		async write(key, patch, observed, rule, signal) {
			for (const field of Object.keys(patch)) if (field !== "status" && patch[field] !== void 0) throw syncRemoteError(syncError("MappingIncompatible", {
				scope: "item",
				field
			}));
			if (patch.status === void 0) return;
			const body = { status: encodeStatus(patch.status, observed.rawStatus, rule.statusWriteStates) };
			const result = await transport.write({
				url: url(`/workitems/${encodeURIComponent(key.id)}`),
				method: "PUT",
				headers: auth({ "content-type": "application/json" }),
				body: JSON.stringify(body),
				readOnly: false
			}, signal);
			if (result.status >= 200 && result.status <= 299) return;
			if (result.status === 404) throw syncRemoteError(syncError("RemoteUnavailable", { scope: "item" }));
			if (result.status === 429) throw syncRemoteError(syncError("WriteOutcomeUnknown", { scope: "item" }));
			throw syncRemoteError(syncError("WorkflowRejected", { scope: "item" }));
		},
		async evidence(_intent, _observed, _signal) {
			return "unknown";
		}
	};
}
//#endregion
//#region src/sync/query/detail.ts
const ID_LIMIT$2 = 200;
const TEXT_LIMIT = 2e3;
const CONTENT_LIMIT = 2e5;
/** Ids reject every control character; free text keeps tabs and newlines. */
const CONTROL$4 = /[\u0000-\u001f]/u;
const TEXT_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;
/** Sections a detail read may bring back; each one costs its own request. */
const DETAIL_SECTIONS = [
	"description",
	"comments",
	"relations",
	"activities",
	"attachments"
];
/** Relation kinds the platform exposes through `relationRecords`. */
const RELATION_TYPES = [
	"PARENT",
	"SUB",
	"ASSOCIATED",
	"DEPEND_ON",
	"DEPENDED_BY"
];
function fail$3(field) {
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field
	}));
}
function isPlainObject$2(value) {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
function idField(value, field) {
	if (typeof value !== "string" || !value.trim() || value.length > ID_LIMIT$2 || CONTROL$4.test(value)) fail$3(field);
	return value;
}
function textField(value, field, limit = TEXT_LIMIT) {
	if (typeof value !== "string" || value.length > limit || TEXT_CONTROL.test(value)) fail$3(field);
	return value;
}
function optionalText(value, field, limit = TEXT_LIMIT) {
	return value === null || value === void 0 ? null : textField(value, field, limit);
}
function user(value, field) {
	if (value === null || value === void 0) return null;
	if (!isPlainObject$2(value)) fail$3(field);
	return {
		id: idField(value.id, `${field}.id`),
		name: optionalText(value.name, `${field}.name`, 100) ?? ""
	};
}
function epoch(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function stripHtml(html) {
	return (html.length > CONTENT_LIMIT ? html.slice(0, CONTENT_LIMIT) : html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, " ").replace(/<[^>]*>/gu, " ").replace(/&nbsp;/gu, " ").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, "\"").replace(/&#39;/gu, "'").replace(/&amp;/gu, "&").replace(/[ \t\u00a0]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();
}
/**
* Unwrap the platform's description carrier. The live service returns a JSON
* string of the form `{"htmlValue":"<article…>","jsonMLValue":[…]}` whenever the
* body was written as rich text; a hand-written fixture of plain HTML does not
* exist in production, so both shapes are accepted and neither is guessed at.
*/
function unpackDescription(raw, formatType) {
	if (raw === null || raw === void 0) return null;
	const source = textField(raw, "description", CONTENT_LIMIT);
	if (source === "") return null;
	const format = typeof formatType === "string" && formatType.toUpperCase() === "MARKDOWN" ? "markdown" : "richtext";
	if (source.trimStart().startsWith("{")) {
		let parsed;
		try {
			parsed = JSON.parse(source);
		} catch {
			parsed = void 0;
		}
		if (isPlainObject$2(parsed)) {
			const html = parsed.htmlValue;
			if (typeof html === "string" && html.length <= CONTENT_LIMIT) return {
				format: "richtext",
				html,
				plain: stripHtml(html)
			};
			const markdown = parsed.markdownValue;
			if (typeof markdown === "string" && markdown.length <= CONTENT_LIMIT) return {
				format: "markdown",
				html: null,
				plain: markdown
			};
		}
		fail$3("description");
	}
	if (format === "markdown") return {
		format,
		html: null,
		plain: source
	};
	return {
		format,
		html: source,
		plain: stripHtml(source)
	};
}
function projectComments(raw) {
	if (raw === null || raw === void 0) return [];
	if (!Array.isArray(raw)) fail$3("comments");
	return raw.map((entry) => {
		if (!isPlainObject$2(entry)) fail$3("comments");
		const content = textField(entry.content, "comments.content", CONTENT_LIMIT);
		return {
			id: idField(entry.id, "comments.id"),
			content,
			format: content.trimStart().startsWith("<") ? "html" : "markdown",
			contentFormat: optionalText(entry.contentFormat, "comments.contentFormat", 32),
			parentId: entry.parentId === null || entry.parentId === void 0 ? null : idField(entry.parentId, "comments.parentId"),
			top: entry.top === true,
			user: user(entry.user, "comments.user"),
			gmtCreate: epoch(entry.gmtCreate),
			gmtModified: epoch(entry.gmtModified)
		};
	});
}
/** Project one relation list; a record claiming another type is a mismatch, not a silent pass. */
function projectRelationRecords(raw, expected) {
	if (raw === null || raw === void 0) return [];
	if (!Array.isArray(raw)) fail$3("relationRecords");
	return raw.map((entry) => {
		if (!isPlainObject$2(entry)) fail$3("relationRecords");
		if (textField(entry.relationType, "relationRecords.relationType", 32) !== expected) fail$3("relationRecords.relationType");
		return {
			relationType: expected,
			resourceType: optionalText(entry.resourceType, "relationRecords.resourceType", 32),
			resourceId: idField(entry.resourceId, "relationRecords.resourceId"),
			gmtCreate: epoch(entry.gmtCreate)
		};
	});
}
function activityValues(value) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!isPlainObject$2(entry)) return [];
		const display = optionalText(entry.displayValue, "activities.values.displayValue", TEXT_LIMIT);
		if (display === null) return [];
		return [{
			identifier: optionalText(entry.identifier, "activities.values.identifier", ID_LIMIT$2) ?? display,
			displayValue: display
		}];
	});
}
function projectActivities(raw) {
	if (raw === null || raw === void 0) return [];
	if (!Array.isArray(raw)) fail$3("activities");
	return raw.map((entry) => {
		if (!isPlainObject$2(entry)) fail$3("activities");
		const property = isPlainObject$2(entry.property) ? {
			propertyType: optionalText(entry.property.propertyType, "activities.property.propertyType", 32),
			propertyId: optionalText(entry.property.propertyId, "activities.property.propertyId", ID_LIMIT$2),
			propertyName: optionalText(entry.property.propertyName, "activities.property.propertyName", 100)
		} : null;
		const related = isPlainObject$2(entry.relatedResource) ? {
			resourceType: optionalText(entry.relatedResource.resourceType, "activities.relatedResource.resourceType", 32),
			resourceId: idField(entry.relatedResource.resourceId, "activities.relatedResource.resourceId")
		} : null;
		return {
			eventId: typeof entry.eventId === "number" && Number.isSafeInteger(entry.eventId) ? entry.eventId : null,
			eventType: textField(entry.eventType, "activities.eventType", 64),
			eventTime: epoch(entry.eventTime),
			operator: user(entry.operator, "activities.operator"),
			property,
			actionType: optionalText(entry.actionType, "activities.actionType", 32),
			oldValue: activityValues(entry.oldValue),
			newValue: activityValues(entry.newValue),
			relatedResource: related
		};
	});
}
function signedExpiry(url) {
	if (url === null) return null;
	const match = /[?&]Expires=(\d+)/u.exec(url);
	return match ? Number(match[1]) * 1e3 : null;
}
function projectAttachments(raw) {
	if (raw === null || raw === void 0) return [];
	if (!Array.isArray(raw)) fail$3("attachments");
	return raw.map((entry) => {
		if (!isPlainObject$2(entry)) fail$3("attachments");
		const url = optionalText(entry.url, "attachments.url", 4e3);
		return {
			id: idField(entry.id, "attachments.id"),
			fileId: idField(entry.fileId, "attachments.fileId"),
			fileName: optionalText(entry.fileName, "attachments.fileName", 500) ?? "",
			suffix: optionalText(entry.suffix, "attachments.suffix", 32),
			size: typeof entry.size === "number" && Number.isFinite(entry.size) ? entry.size : null,
			creator: user(entry.creator, "attachments.creator"),
			gmtCreate: epoch(entry.gmtCreate),
			url,
			urlExpiresAt: signedExpiry(url),
			embedUrl: optionalText(entry.embedUrl, "attachments.embedUrl", 4e3)
		};
	});
}
const ORDER_FIELDS = [
	"gmtCreate",
	"subject",
	"status",
	"priority",
	"assignedTo"
];
const CATEGORY = /^[A-Za-z]+(?:,[A-Za-z]+)*$/u;
const ID_LIMIT$1 = 200;
const CONTROL$3 = /[\u0000-\u001f]/u;
function invalid$1(field) {
	throw syncRemoteError(syncError("InvalidConfig", {
		scope: "query",
		field
	}));
}
function fail$2(field) {
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field
	}));
}
function identifier$1(value, field) {
	if (typeof value !== "string" || !value.trim() || value.length > ID_LIMIT$1 || CONTROL$3.test(value)) invalid$1(field);
	return value;
}
const FIELD_NAME_LIMIT = 100;
const FIELD_FORMAT_LIMIT = 32;
const FIELD_OPTION_LIMIT = 200;
const MAX_TYPES = 10;
function sectionError(error, section) {
	if (error !== null && typeof error === "object") {
		const candidate = error;
		if (candidate.code === "task-list/sync" && candidate.details && typeof candidate.details.code === "string") return {
			section,
			error: candidate.details
		};
	}
	return {
		section,
		error: syncError("UnexpectedFailure", { scope: "item" })
	};
}
function headerInt(headers, name) {
	const raw = headers.get(name);
	if (raw === null) return void 0;
	const value = raw.trim();
	if (!/^\d+$/u.test(value)) return void 0;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : void 0;
}
function isPlainObject$1(value) {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
/** Sections to read: omitted means description only; an unknown name fails closed. */
function detailSections(include) {
	if (include === void 0 || include.length === 0) return ["description"];
	for (const section of include) if (!DETAIL_SECTIONS.includes(section)) invalid$1("include");
	return [...new Set(include)];
}
/**
* Decode one description into the plugin's own content vocabulary, so the
* browser renders validated blocks instead of injecting remote HTML. Rich text
* goes through the same lossless decoder the sync path uses; plain/markdown
* bodies become paragraphs. An undecodable body keeps the text but loses the
* structure rather than failing the whole detail read.
*/
function describeWorkitem(raw) {
	const view = unpackDescription(raw.description, raw.formatType);
	if (view === null) return null;
	let content;
	if (view.format === "richtext" && view.html !== null) try {
		content = decodeDescription({
			presence: "value",
			value: view.html,
			writable: false
		}, "richtext").content;
	} catch {
		content = null;
	}
	else content = textContent(view.plain);
	return {
		...view,
		content
	};
}
/**
* Read-only query surface over the same connection/credential plumbing as the
* sync adapter. `listWorkitems` is one search request and takes a field
* projection; `getWorkitem` is the detail read that alone can carry the body,
* comments, relations, activity and attachments.
*/
function createYunxiaoQuery(connection, transport, env = process.env, stored) {
	if (connection.platform !== "yunxiao") invalid$1("platform");
	if (connection.mode === "region") invalid$1("regionHost");
	const credentials = stored ?? resolveCredentials(connection, env);
	if (credentials.kind !== "yunxiao") invalid$1("platform");
	const token = credentials.token;
	const instance = connection.organizationId;
	const base = `https://openapi-rdc.aliyuncs.com/oapi/v1/projex/organizations/${encodeURIComponent(instance)}`;
	const url = (path) => new URL(`${base}${path}`);
	const auth = (extra = {}) => ({
		"x-yunxiao-token": token,
		...extra
	});
	let requests = 0;
	const read = async (path, init, signal) => {
		requests += 1;
		const response = await transport.read({
			url: url(path),
			method: init.method,
			headers: auth(init.body === void 0 ? {} : { "content-type": "application/json" }),
			...init.body === void 0 ? {} : { body: init.body },
			readOnly: true
		}, signal);
		return {
			value: response.value,
			headers: response.headers
		};
	};
	async function listWorkitems(request, signal) {
		if (!CATEGORY.test(request.categories) || request.categories.split(",").some((part) => part.trim() === "")) invalid$1("categories");
		const page = request.page ?? 1;
		const perPage = request.perPage ?? 50;
		if (!Number.isSafeInteger(page) || page < 1) invalid$1("page");
		if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 200) invalid$1("perPage");
		if (page * perPage > 1e4) invalid$1("page");
		const orderBy = request.orderBy ?? "gmtCreate";
		if (!ORDER_FIELDS.includes(orderBy)) invalid$1("orderBy");
		const sort = request.sort ?? "desc";
		if (sort !== "asc" && sort !== "desc") invalid$1("sort");
		const spaceType = request.spaceType ?? "Project";
		if (spaceType !== "Project" && spaceType !== "Program") invalid$1("spaceType");
		const fields = resolveListFields(request.fields);
		const customFieldIds = request.customFieldIds === void 0 || request.customFieldIds.length === 0 ? null : new Set(request.customFieldIds.map((id) => identifier$1(id, "customFieldIds")));
		const conditions = buildConditions(request.conditions);
		const body = {
			category: request.categories,
			spaceId: identifier$1(request.projectId, "projectId"),
			spaceType,
			page,
			perPage,
			orderBy,
			sort
		};
		if (conditions !== void 0) body.conditions = conditions;
		const before = requests;
		const response = await read("/workitems:search", {
			method: "POST",
			body: JSON.stringify(body)
		}, signal);
		if (!Array.isArray(response.value)) fail$2("search");
		const items = response.value.map((row) => projectWorkitem(row, fields, { customFieldIds }));
		const total = headerInt(response.headers, "x-total") ?? null;
		return {
			items,
			page,
			perPage,
			total,
			totalPages: headerInt(response.headers, "x-total-pages") ?? (total === null ? null : Math.max(1, Math.ceil(total / perPage))),
			fields,
			requestCount: requests - before
		};
	}
	async function getWorkitem(request, signal) {
		const id = identifier$1(request.id, "id");
		const projectId = identifier$1(request.projectId, "projectId");
		const sections = detailSections(request.include);
		const want = (section) => sections.includes(section);
		const relationTypes = request.relationTypes === void 0 || request.relationTypes.length === 0 ? RELATION_TYPES : request.relationTypes.filter((type) => {
			if (!RELATION_TYPES.includes(type)) invalid$1("relationTypes");
			return true;
		});
		const expandLimit = request.expandLimit ?? 20;
		if (!Number.isSafeInteger(expandLimit) || expandLimit < 0 || expandLimit > 100) invalid$1("expandLimit");
		const fields = resolveListFields(request.fields);
		const before = requests;
		const raw = await read(`/workitems/${encodeURIComponent(id)}`, { method: "GET" }, signal);
		if (!isPlainObject$1(raw.value)) fail$2("item");
		const space = raw.value.space;
		const spaceId = isPlainObject$1(space) && typeof space.id === "string" ? space.id : null;
		if (raw.value.id !== id || spaceId !== null && spaceId !== projectId) fail$2("item");
		const item = projectWorkitem(raw.value, fields);
		const description = want("description") ? describeWorkitem(raw.value) : null;
		const sectionErrors = [];
		let comments;
		if (want("comments")) try {
			comments = projectComments((await read(`/workitems/${encodeURIComponent(id)}/comments`, { method: "GET" }, signal)).value);
		} catch (error) {
			sectionErrors.push(sectionError(error, "comments"));
		}
		let activities;
		if (want("activities")) try {
			activities = projectActivities((await read(`/workitems/${encodeURIComponent(id)}/activities`, { method: "GET" }, signal)).value);
		} catch (error) {
			sectionErrors.push(sectionError(error, "activities"));
		}
		let attachments;
		if (want("attachments")) try {
			attachments = projectAttachments((await read(`/workitems/${encodeURIComponent(id)}/attachments`, { method: "GET" }, signal)).value);
		} catch (error) {
			sectionErrors.push(sectionError(error, "attachments"));
		}
		let relations;
		if (want("relations")) {
			relations = [];
			let expanded = 0;
			for (const relationType of relationTypes) try {
				const group = {
					relationType,
					records: projectRelationRecords((await read(`/workitems/${encodeURIComponent(id)}/relationRecords?relationType=${relationType}`, { method: "GET" }, signal)).value, relationType).map((record) => ({
						...record,
						item: null
					}))
				};
				if (request.expandRelations === true) for (const record of group.records) {
					if (expanded >= expandLimit) break;
					expanded += 1;
					try {
						const related = await read(`/workitems/${encodeURIComponent(record.resourceId)}`, { method: "GET" }, signal);
						record.item = isPlainObject$1(related.value) ? projectWorkitem(related.value, fields) : null;
					} catch {
						record.item = null;
					}
				}
				relations.push(group);
			} catch (error) {
				sectionErrors.push(sectionError(error, "relations"));
			}
		}
		return {
			item,
			description,
			...comments === void 0 ? {} : { comments },
			...relations === void 0 ? {} : { relations },
			...activities === void 0 ? {} : { activities },
			...attachments === void 0 ? {} : { attachments },
			sectionErrors,
			requestCount: requests - before
		};
	}
	/**
	* Every selectable field of the requested category set, read from the
	* platform's own config and merged across their work-item types (a
	* project-wide field picker needs one list, and reading only the first type
	* would hide fields another type adds). The joined set is tried in one request
	* first; when the platform refuses it, every category is read on its own, so a
	* single-value-only deployment still yields a full catalog. First occurrence
	* wins for name/format, and reading stops once `MAX_TYPES` types have been read
	* in total.
	*/
	async function listFields(request, signal) {
		const projectId = identifier$1(request.projectId, "projectId");
		const categories = request.categories.split(",");
		if (!CATEGORY.test(request.categories) || categories.some((part) => part.trim() === "")) invalid$1("categories");
		const merged = /* @__PURE__ */ new Map();
		let typesRead = 0;
		const readCategory = async (category) => {
			const types = await read(`/projects/${encodeURIComponent(projectId)}/workitemTypes?category=${category}`, { method: "GET" }, signal);
			if (!Array.isArray(types.value)) fail$2("workitemTypes");
			for (const entry of types.value) {
				if (typesRead >= MAX_TYPES) break;
				if (!isPlainObject$1(entry)) fail$2("workitemTypes");
				const typeId = bounded(entry.id, ID_LIMIT$1);
				if (typeId === null) fail$2("workitemTypes.id");
				typesRead += 1;
				const response = await read(`/projects/${encodeURIComponent(projectId)}/workitemTypes/${encodeURIComponent(typeId)}/fields`, { method: "GET" }, signal);
				if (!Array.isArray(response.value)) fail$2("fields");
				for (const raw of response.value) {
					if (!isPlainObject$1(raw)) fail$2("fields");
					const id = bounded(raw.id, ID_LIMIT$1);
					if (id === null || id === "" || merged.has(id)) continue;
					const options = [];
					if (Array.isArray(raw.options)) for (const option of raw.options.slice(0, FIELD_OPTION_LIMIT)) {
						if (!isPlainObject$1(option)) continue;
						const optionId = bounded(option.id, ID_LIMIT$1);
						if (optionId === null) continue;
						options.push({
							id: optionId,
							label: bounded(option.displayValue, FIELD_NAME_LIMIT) ?? bounded(option.value, FIELD_NAME_LIMIT) ?? optionId
						});
					}
					merged.set(id, {
						id,
						name: bounded(raw.name, FIELD_NAME_LIMIT) ?? id,
						format: bounded(raw.format, FIELD_FORMAT_LIMIT) ?? "",
						required: raw.required === true,
						kind: bounded(raw.type, FIELD_FORMAT_LIMIT) ?? "",
						options
					});
				}
			}
		};
		if (categories.length === 1) {
			await readCategory(categories[0]);
			return [...merged.values()];
		}
		try {
			await readCategory(request.categories);
		} catch (error) {
			if (signal.aborted) throw error;
			merged.clear();
			typesRead = 0;
			for (const category of categories) {
				if (typesRead >= MAX_TYPES) break;
				await readCategory(category);
			}
		}
		return [...merged.values()];
	}
	return {
		listWorkitems,
		getWorkitem,
		listFields
	};
}
function bounded(value, limit) {
	return typeof value === "string" && value.length <= limit && !CONTROL$3.test(value) ? value : null;
}
//#endregion
//#region src/sync/adapters/tapd-codec.ts
const ID_LIMIT = 200;
const TITLE_LIMIT = 1e3;
const LABEL_LIMIT = 100;
const CONTROL$2 = /[\u0000-\u001f]/u;
function fail$1(field) {
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field
	}));
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function idString(value, field) {
	if (typeof value !== "string" || !value.trim() || value.length > ID_LIMIT || CONTROL$2.test(value)) fail$1(field);
	return value;
}
function textValue(value, field, max) {
	if (typeof value !== "string" || !value.trim() || value.length > max || CONTROL$2.test(value)) fail$1(field);
	return value;
}
function label(value, fallback) {
	if (typeof value === "string" && value.trim() && value.length <= LABEL_LIMIT && !CONTROL$2.test(value)) return value;
	return fallback;
}
/** A documented boolean flag string/number; `1` is truthy, `0` is false, anything else is malformed. */
function boolFlag(value, field) {
	if (value === "1" || value === 1) return true;
	if (value === "0" || value === 0) return false;
	fail$1(field);
}
const AUTH_HINT = /permission|auth|credential|token|无权|权限|认证|登录|凭证|密码|账号/i;
const ENTITLEMENT_HINT = /entitlement|commercial|not\s+enabled|未开通|商业|试用|开通|模块/i;
/** Read business failure: permission → AuthDenied, entitlement → EntitlementUnavailable, else InvalidRemoteResponse. */
function classifyReadBusinessError(info) {
	if (AUTH_HINT.test(info)) return "AuthDenied";
	if (ENTITLEMENT_HINT.test(info)) return "EntitlementUnavailable";
	return "InvalidRemoteResponse";
}
/** Write business failure: permission → AuthDenied, otherwise the write was rejected (WorkflowRejected). */
function classifyWriteBusinessError(info) {
	if (AUTH_HINT.test(info)) return "AuthDenied";
	return "WorkflowRejected";
}
/** TAPD wraps every payload as `{ status, info, data }`; status is a number and 1 means success. */
function decodeEnvelope(raw, field = "envelope") {
	if (!isPlainObject(raw)) fail$1(field);
	const status = raw.status;
	if (typeof status !== "number" || !Number.isFinite(status)) fail$1(`${field}.status`);
	const data = raw.data;
	if (data === null || typeof data !== "object") fail$1(`${field}.data`);
	return {
		status,
		data,
		info: typeof raw.info === "string" ? raw.info : ""
	};
}
function assertReadSuccess(status, info) {
	if (status !== 1) throw syncRemoteError(syncError(classifyReadBusinessError(info), { scope: "connection" }));
}
/**
* Decode a read collection: `data` is an array of single-key wrappers
* `{ Story: {...} }` (or Bug/Task/Workspace/UserWorkspace/Iteration). A business
* status !== 1 on a read is classified (permission/entitlement/param), never
* reported as an empty result set.
*/
function decodeCollection(raw, type) {
	const { status, data, info } = decodeEnvelope(raw, "collection");
	assertReadSuccess(status, info);
	if (!Array.isArray(data)) fail$1("collection.data");
	return data.map((wrapper) => {
		if (!isPlainObject(wrapper)) fail$1("collection.item");
		const item = wrapper[type];
		if (!isPlainObject(item)) fail$1(`collection.${type}`);
		return item;
	});
}
/** Decode a `data` object whose keys are field names mapping to field configs. */
function decodeFieldMap(raw) {
	const { status, data, info } = decodeEnvelope(raw, "fields");
	assertReadSuccess(status, info);
	if (!isPlainObject(data)) fail$1("fields.data");
	return data;
}
/** The type-specific title/owner fields for the three TAPD collections, keyed by category. */
const TAPD_CATEGORY_FIELDS = {
	story: {
		title: "name",
		owner: "owner"
	},
	bug: {
		title: "title",
		owner: "current_owner"
	},
	task: {
		title: "name",
		owner: "owner"
	}
};
const TAPD_COLLECTION = {
	story: "stories",
	bug: "bugs",
	task: "tasks"
};
const TAPD_WRAPPER = {
	story: "Story",
	bug: "Bug",
	task: "Task"
};
/** The workflows `system_name` for the workflow list; bugs use `bugtrace`, not `bug`. */
const TAPD_WORKFLOW_SYSTEM_NAME = {
	story: "story",
	bug: "bugtrace",
	task: void 0
};
/** The `system` parameter for status_map and all_transitions; bugs use `bug`. */
const TAPD_WORKFLOW_SYSTEM = {
	story: "story",
	bug: "bug",
	task: void 0
};
/**
* Decode one Story/Bug/Task object into the shared vocabulary. Identity fields
* (id, workspace_id when present) are verified against the requested key, ids
* stay strings, `modified` is kept as an opaque token, and the raw status is
* inverted through the rule's own status map (unmapped → MappingIncompatible).
*/
function decodeTapdItem(raw, ctx) {
	if (!isPlainObject(raw)) fail$1("item");
	const id = idString(raw.id, "item.id");
	if (ctx.id !== void 0 && id !== ctx.id) fail$1("item.id");
	const workspaceId = raw.workspace_id;
	if (workspaceId !== void 0 && (typeof workspaceId !== "string" || workspaceId !== ctx.projectId)) fail$1("item.workspace_id");
	const { title: titleField } = TAPD_CATEGORY_FIELDS[ctx.category];
	const title = textValue(raw[titleField], `item.${titleField}`, TITLE_LIMIT);
	if (typeof raw.status !== "string" || !raw.status.trim() || raw.status.length > ID_LIMIT || CONTROL$2.test(raw.status)) fail$1("item.status");
	const statusId = raw.status;
	const mappedStatus = statusForRaw(statusId, ctx.statusWriteStates);
	const updatedToken = typeof raw.modified === "string" ? raw.modified : "";
	let descriptionRaw;
	let roundTrip;
	let body = "";
	if (raw.description === void 0) {
		descriptionRaw = {
			presence: "absent",
			writable: false
		};
		roundTrip = false;
	} else if (raw.description === null) {
		descriptionRaw = {
			presence: "null",
			writable: true
		};
		roundTrip = true;
	} else if (typeof raw.description === "string") {
		descriptionRaw = {
			presence: "value",
			value: raw.description,
			writable: true
		};
		const decoded = decodeDescription(descriptionRaw, "text");
		roundTrip = decoded.roundTrip;
		body = contentText(decoded.content);
	} else fail$1("item.description");
	const packed = packWorkitemDescription(raw, body);
	return {
		key: {
			instance: ctx.instance,
			projectId: ctx.projectId,
			typeId: ctx.typeId,
			id
		},
		number: id,
		url: null,
		updatedToken,
		fields: {
			title: {
				presence: "value",
				value: title,
				writable: true
			},
			description: {
				presence: "value",
				value: packed,
				writable: true
			},
			status: {
				presence: "value",
				value: mappedStatus,
				writable: true
			},
			priority: {
				presence: "absent",
				writable: false
			},
			tags: {
				presence: "absent",
				writable: false
			},
			storyPoints: {
				presence: "absent",
				writable: false
			}
		},
		rawStatus: statusId,
		description: {
			format: "text",
			raw: descriptionRaw,
			roundTrip
		},
		revisionToken: null
	};
}
/** Extract and validate the id from a raw collection item for cursor tracking. */
function decodeTapdItemId(raw) {
	if (!isPlainObject(raw)) fail$1("item.id");
	return idString(raw.id, "item.id");
}
/** Decode a bare option collection (`Workspace`/`UserWorkspace`/`Iteration`). */
function decodeOptionCollection(raw, type, idKey, labelKey, keep) {
	const out = [];
	for (const item of decodeCollection(raw, type)) {
		if (!isPlainObject(item)) fail$1("option");
		if (keep !== void 0 && !keep(item)) continue;
		const id = idString(item[idKey], "option.id");
		out.push({
			id,
			label: label(item[labelKey], id)
		});
	}
	return out;
}
/** Read the status options from a fields-info map's `status.options` object. */
function decodeStatusOptions(fieldMap) {
	const status = fieldMap.status;
	if (!isPlainObject(status)) return [];
	const options = status.options;
	if (!isPlainObject(options)) return [];
	const out = [];
	for (const [key, value] of Object.entries(options)) if (typeof value === "string" && value.trim() && !CONTROL$2.test(value)) out.push({
		id: key,
		label: value
	});
	return out;
}
/** Whether a fields-info map exposes a field config under `name`. */
function hasFieldConfig(fieldMap, name) {
	return isPlainObject(fieldMap[name]);
}
/** Decode `GET /workflows/status_map` — `data` is a `{status_id: label}` map. */
function decodeStatusMap(raw) {
	const { status, data, info } = decodeEnvelope(raw, "status_map");
	assertReadSuccess(status, info);
	if (!isPlainObject(data)) fail$1("status_map.data");
	const out = [];
	for (const [key, value] of Object.entries(data)) if (typeof value === "string" && value.trim() && !CONTROL$2.test(value)) out.push({
		id: key,
		label: value
	});
	return out;
}
/** Decode `GET /workflows` — `data[{Workflow:{id,workspace_id,system_name,is_default,type}}]`. */
function decodeWorkflows(raw) {
	return decodeCollection(raw, "Workflow").map((item) => {
		if (!isPlainObject(item)) fail$1("workflow");
		const id = idString(item.id, "workflow.id");
		const systemName = textValue(item.system_name, "workflow.system_name", ID_LIMIT);
		const isDefault = boolFlag(item.is_default, "workflow.is_default");
		const type = item.type;
		if (type !== "classic" && type !== "bpm") fail$1("workflow.type");
		return {
			id,
			systemName,
			isDefault,
			type
		};
	});
}
/** Decode `GET /workitem_types` — `data[{WorkitemType:{id,name,entity_type,workflow_id}}]`. */
function decodeWorkitemTypes(raw) {
	return decodeCollection(raw, "WorkitemType").map((item) => {
		if (!isPlainObject(item)) fail$1("workitem_type");
		const id = idString(item.id, "workitem_type.id");
		const name = label(item.name, id);
		const entityType = textValue(item.entity_type, "workitem_type.entity_type", ID_LIMIT);
		const rawWorkflowId = item.workflow_id;
		let workflowId = null;
		if (rawWorkflowId !== void 0 && rawWorkflowId !== null && rawWorkflowId !== "") {
			if (typeof rawWorkflowId !== "string" || !rawWorkflowId.trim()) fail$1("workitem_type.workflow_id");
			workflowId = rawWorkflowId;
		}
		return {
			id,
			name,
			entityType,
			workflowId
		};
	});
}
/**
* Whether a transition edge demands additional fields or permissions we cannot
* prove are satisfied. A top-level `AuthorizedUser` (流转权限设置) that is
* non-empty, or any `Appendfield` entry that is mandatory (`Notnull=yes`) or
* writes a default (`DefaultValue` non-empty), fails closed as unsupported —
* the simplest safe rule refuses any value/default we cannot supply from a
* controlled patch. An absent/empty `Appendfield` means no additional fields.
*/
function transitionRequiresUnsupported(item) {
	const authorizedUser = item.AuthorizedUser;
	let unsupported = authorizedUser !== void 0 && authorizedUser !== null && authorizedUser !== "";
	const appendField = item.Appendfield;
	if (appendField === void 0) return unsupported;
	if (!Array.isArray(appendField)) fail$1("transition.Appendfield");
	for (const entry of appendField) {
		if (!isPlainObject(entry)) fail$1("transition.Appendfield.item");
		const notNull = entry.Notnull;
		if (notNull !== void 0) {
			if (notNull !== "yes" && notNull !== "no") fail$1("transition.Appendfield.Notnull");
			if (notNull === "yes") unsupported = true;
		}
		const defaultValue = entry.DefaultValue;
		if (defaultValue !== void 0) {
			if (!Array.isArray(defaultValue)) fail$1("transition.Appendfield.DefaultValue");
			if (defaultValue.length > 0) unsupported = true;
		}
	}
	return unsupported;
}
/**
* Decode `GET /workflows/all_transitions`. The documented sample `data`
* container is malformed (a bare object sequence), so `data` is accepted only
* as a single transition object or an array of direct transition objects.
* A `WorkflowTransition`-style wrapper is not documented and fails closed
* rather than being guessed-unwrapped. Fields are the documented keys
* (`StepPrevious`/`StepNext`/`Appendfield`/`AuthorizedUser`); `Notnull` is
* `yes`/`no` and `DefaultValue` is an array of `{Type,Value}`/`{Type,Field}`.
*/
function decodeTransitions(raw) {
	const { status, data, info } = decodeEnvelope(raw, "all_transitions");
	assertReadSuccess(status, info);
	return (Array.isArray(data) ? data : [data]).map((item) => {
		if (!isPlainObject(item)) fail$1("transition");
		const source = idString(item.StepPrevious, "transition.StepPrevious");
		const target = idString(item.StepNext, "transition.StepNext");
		let workflowId = null;
		if (item.workflow_id !== void 0 && item.workflow_id !== null && item.workflow_id !== "") {
			if (typeof item.workflow_id !== "string" || !item.workflow_id.trim()) fail$1("transition.workflow_id");
			workflowId = item.workflow_id;
		}
		return {
			source,
			target,
			workflowId,
			requiresUnsupported: transitionRequiresUnsupported(item)
		};
	});
}
//#endregion
//#region src/sync/adapters/tapd-query.ts
const CATEGORIES = [
	"story",
	"bug",
	"task"
];
const LABELS = {
	story: "需求",
	bug: "缺陷",
	task: "任务"
};
const MAX_PER_PAGE = 200;
const MAX_RESULT_WINDOW = 1e4;
const CONTROL$1 = /[\u0000-\u001f]/u;
const QUERY_SYNTAX = /[|;,<>~]/u;
const FIELD = /^[A-Za-z][A-Za-z0-9_]*$/u;
function invalid(field) {
	throw syncRemoteError(syncError("InvalidConfig", {
		scope: "query",
		field
	}));
}
function fail(field) {
	throw syncRemoteError(syncError("InvalidRemoteResponse", {
		scope: "item",
		field
	}));
}
function object(value) {
	return typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function identifier(value, field) {
	if (typeof value !== "string" || !value.trim() || value.length > 200 || CONTROL$1.test(value)) invalid(field);
	return value;
}
function numericId(value, field) {
	const id = identifier(value, field);
	if (!/^\d+$/u.test(id)) invalid(field);
	return id;
}
function categories(value) {
	const parts = value.split(",");
	if (parts.length === 0 || parts.some((part) => !CATEGORIES.includes(part))) invalid("categories");
	return [...new Set(parts)];
}
function text(value, field, limit = 1e3) {
	if (value === void 0 || value === null || value === "") return null;
	if (typeof value !== "string" || value.length > limit || CONTROL$1.test(value)) fail(field);
	return value;
}
function reference(value, field) {
	const id = text(value, field, 200);
	return id === null || id === "0" ? null : {
		id,
		name: id
	};
}
function date(value, field, remote = false) {
	const reject = () => remote ? fail(field) : invalid(field);
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/u.test(value)) return reject();
	const normalized = value.replace("T", " ");
	const stamp = Date.parse(normalized.replace(" ", "T") + (normalized.length === 10 ? "T00:00:00Z" : "Z"));
	if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, normalized.length).replace("T", " ") !== normalized) return reject();
	return normalized;
}
/**
* TAPD URL parameters are ANDed. A value set is ORed only where documented.
* There is no verified cross-field OR/group parameter on these endpoints: never
* flatten groups, overwrite repeated fields, or silently drop unknown filters.
* Date ranges use from~to, per the official API's 使用必读 (2025-06-18).
*/
function filters(groups, category) {
	if (groups === void 0 || groups.length === 0) return [];
	if (groups.length !== 1 || groups[0].length === 0 || groups[0].length > 20) invalid("conditions");
	const used = /* @__PURE__ */ new Set();
	return groups[0].map((condition) => {
		const field = condition.field;
		const param = {
			status: "status",
			assignedTo: TAPD_CATEGORY_FIELDS[category].owner,
			creator: category === "bug" ? "reporter" : "creator",
			priority: "priority_label",
			sprint: "iteration_id",
			subject: TAPD_CATEGORY_FIELDS[category].title,
			gmtCreate: "created",
			gmtModified: "modified",
			...category === "story" ? { workitemType: "workitem_type_id" } : {}
		}[field];
		if (param === void 0 || used.has(param)) invalid(`conditions.field(${field})`);
		used.add(param);
		if (!Array.isArray(condition.value) || condition.value.length < 1 || condition.value.length > 50) invalid(`conditions.value(${field})`);
		const values = condition.value.map((value) => identifier(value, `conditions.value(${field})`));
		const operator = condition.operator ?? (field === "subject" ? "CONTAINS" : field === "gmtCreate" || field === "gmtModified" ? "BETWEEN" : "EQUALS");
		if (field === "gmtCreate" || field === "gmtModified") {
			if (operator !== "BETWEEN" || values.length !== 1) invalid(`conditions.operator(${field})`);
			const from = date(values[0], `conditions.value(${field})`);
			const to = date(condition.toValue, `conditions.toValue(${field})`);
			if (from.length !== to.length || from > to) invalid(`conditions.toValue(${field})`);
			return {
				param,
				encoded: `${from}~${to}`,
				matches: (raw) => {
					const value = date(raw[param], param, true).slice(0, from.length);
					return value >= from && value <= to;
				}
			};
		}
		if (condition.toValue !== void 0 && condition.toValue !== null) invalid(`conditions.toValue(${field})`);
		if (values.some((value) => QUERY_SYNTAX.test(value))) invalid(`conditions.value(${field})`);
		if (field === "subject") {
			if (operator !== "CONTAINS") invalid(`conditions.operator(${field})`);
			return {
				param,
				encoded: `LIKE_OR<${values.join("|")}>`,
				matches: (raw) => {
					const value = text(raw[param], param);
					return value !== null && values.some((part) => value.includes(part));
				}
			};
		}
		if (field === "assignedTo" || field === "creator" || field === "priority") {
			if (operator !== "EQUALS" || values.length !== 1) invalid(`conditions.operator(${field})`);
			return {
				param,
				encoded: `EQ<${values[0]}>`,
				matches: (raw) => text(raw[param], param, 200) === values[0]
			};
		}
		if (operator !== "EQUALS" && operator !== "CONTAINS") invalid(`conditions.operator(${field})`);
		return {
			param,
			encoded: values.join("|"),
			matches: (raw) => {
				const value = text(raw[param], param, 200);
				return value !== null && values.includes(value);
			}
		};
	});
}
function nativeMap(category) {
	return {
		id: "id",
		[TAPD_CATEGORY_FIELDS[category].title]: "subject",
		status: "status",
		[TAPD_CATEGORY_FIELDS[category].owner]: "assignedTo",
		[category === "bug" ? "reporter" : "creator"]: "creator",
		workspace_id: "space",
		iteration_id: "sprint",
		label: "labels",
		created: "gmtCreate",
		modified: "gmtModified",
		...category === "story" ? {
			workitem_type_id: "workitemType",
			parent_id: "parentId"
		} : {}
	};
}
/** Read-only PAT/Bearer query surface, reusing TAPD's already-used collections and codecs. */
function createTapdQuery(connection, transport, env = process.env, stored) {
	if (connection.platform !== "tapd") invalid("platform");
	if (connection.authentication?.mode === "oauth") invalid("authentication");
	const credentials = stored ?? resolveCredentials(connection, env);
	if (credentials.kind !== "tapd") invalid("platform");
	if (!credentials.token.trim()) throw syncRemoteError(syncError("CredentialMissing", {
		scope: "connection",
		field: "token"
	}));
	async function read(path, params, signal) {
		const url = new URL(`https://api.tapd.cn${path}`);
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
		return (await transport.read({
			url,
			method: "GET",
			headers: { authorization: `Bearer ${credentials.token}` },
			readOnly: true
		}, signal)).value;
	}
	async function fieldMap(projectId, category, signal) {
		return decodeFieldMap(await read(`/${TAPD_COLLECTION[category]}/get_fields_info`, { workspace_id: projectId }, signal));
	}
	function row(raw, category, projectId) {
		if (!object(raw)) fail("item");
		decodeTapdItemId(raw);
		if (raw.workspace_id !== void 0 && raw.workspace_id !== projectId) fail("workspace_id");
		return raw;
	}
	function project(raw, category, projectId, fields, configs, only) {
		const mapping = nativeMap(category);
		const reverse = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [value, key]));
		const out = {};
		for (const field of fields) {
			const key = reverse[field];
			const value = key === void 0 ? void 0 : raw[key];
			switch (field) {
				case "id":
				case "serialNumber":
					out[field] = decodeTapdItemId(raw);
					break;
				case "subject":
					out[field] = text(value, field) ?? fail(field);
					break;
				case "category":
					out[field] = category;
					break;
				case "space":
					out[field] = {
						id: projectId,
						name: projectId
					};
					break;
				case "workitemType":
					out[field] = reference(value, field) ?? {
						id: category,
						name: LABELS[category]
					};
					break;
				case "status":
					out[field] = reference(value, field);
					break;
				case "assignedTo":
				case "creator":
				case "sprint":
					out[field] = reference(value, field);
					break;
				case "labels":
					out[field] = (text(value, field) ?? "").split("|").filter(Boolean).map((id) => ({
						id,
						name: id,
						color: null
					}));
					break;
				case "gmtCreate":
				case "gmtModified":
					out[field] = value === void 0 || value === null || value === "" ? null : date(value, field, true);
					break;
				case "parentId":
					out[field] = value === "0" ? null : text(value, field, 200);
					break;
				case "customFields": {
					const custom = [];
					for (const [id, config] of Object.entries(configs)) {
						if (mapping[id] !== void 0 || id === "description" || !FIELD.test(id)) continue;
						const fieldId = id === "priority_label" ? "priority" : id;
						if (only !== null && !only.has(fieldId)) continue;
						const source = raw[id];
						if (source === void 0 || source === null || source === "") continue;
						const display = typeof source === "number" && Number.isFinite(source) ? String(source) : text(source, id);
						if (display === null) continue;
						custom.push({
							fieldId,
							fieldName: object(config) ? text(config.label, id) ?? fieldId : fieldId,
							fieldFormat: object(config) ? text(config.html_type, id, 32) ?? "" : "",
							values: [{
								identifier: display,
								displayValue: display
							}]
						});
					}
					out[field] = custom;
					break;
				}
				default: out[field] = null;
			}
		}
		return out;
	}
	async function listWorkitems(request, signal) {
		let selected = categories(request.categories);
		let typeValues = [];
		const conditions = request.conditions;
		if (conditions?.some((group) => group.some((item) => item.field === "workitemType"))) {
			if (conditions.length !== 1 || conditions[0].filter((item) => item.field === "workitemType").length !== 1) invalid("conditions.workitemType");
			const type = conditions[0].find((item) => item.field === "workitemType");
			if ((type.operator ?? "EQUALS") !== "EQUALS" || type.toValue != null || !Array.isArray(type.value) || type.value.length < 1 || type.value.length > 50) invalid("conditions.workitemType");
			typeValues = type.value.map((value) => identifier(value, "conditions.workitemType"));
			if (typeValues.some((value) => !CATEGORIES.includes(value) && !/^\d+$/u.test(value))) invalid("conditions.workitemType");
			selected = selected.filter((part) => typeValues.includes(part) || part === "story" && typeValues.some((value) => /^\d+$/u.test(value)));
		}
		const category = selected[0] ?? categories(request.categories)[0];
		const conditionsFor = (part) => {
			if (typeValues.length === 0) return conditions;
			const rest = conditions[0].filter((item) => item.field !== "workitemType");
			const subtypeIds = part === "story" && !typeValues.includes("story") ? typeValues.filter((value) => /^\d+$/u.test(value)) : [];
			return rest.length || subtypeIds.length ? [[...rest, ...subtypeIds.length ? [{
				field: "workitemType",
				operator: "EQUALS",
				value: subtypeIds
			}] : []]] : void 0;
		};
		const projectId = numericId(request.projectId, "projectId");
		const page = request.page ?? 1;
		const perPage = request.perPage ?? 50;
		if (!Number.isSafeInteger(page) || page < 1 || page * perPage > MAX_RESULT_WINDOW) invalid("page");
		if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) invalid("perPage");
		if (request.spaceType !== void 0 && request.spaceType !== "Project") invalid("spaceType");
		const order = {
			gmtCreate: "created",
			subject: TAPD_CATEGORY_FIELDS[category].title,
			status: "status",
			priority: "priority_label",
			assignedTo: TAPD_CATEGORY_FIELDS[category].owner
		}[request.orderBy ?? "gmtCreate"];
		if (order === void 0) invalid("orderBy");
		const sort = request.sort ?? "desc";
		if (sort !== "asc" && sort !== "desc") invalid("sort");
		const fields = resolveListFields(request.fields);
		const only = request.customFieldIds === void 0 || request.customFieldIds.length === 0 ? null : new Set(request.customFieldIds.map((id) => identifier(id, "customFieldIds")));
		if (selected.length === 0) {
			filters(conditionsFor(category), category);
			return {
				items: [],
				page,
				perPage,
				total: 0,
				totalPages: 1,
				fields,
				requestCount: 0
			};
		}
		if (selected.length > 1) {
			if ((request.orderBy ?? "gmtCreate") !== "gmtCreate") invalid("orderBy");
			const window = page * perPage;
			const plans = selected.map((part) => ({
				part,
				checked: filters(conditionsFor(part), part)
			}));
			const merged = [];
			let total = 0;
			let requestCount = 0;
			for (const { part, checked } of plans) {
				const params = { workspace_id: projectId };
				for (const filter of checked) params[filter.param] = filter.encoded;
				const collection = TAPD_COLLECTION[part];
				const count = decodeFieldMap(await read(`/${collection}/count`, params, signal)).count;
				requestCount++;
				if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) fail("count");
				total += count;
				if (!Number.isSafeInteger(total)) fail("count");
				const configs = fields.includes("customFields") ? await fieldMap(projectId, part, signal) : {};
				if (fields.includes("customFields")) requestCount++;
				const remoteFields = /* @__PURE__ */ new Set([
					"id",
					"workspace_id",
					"created",
					...Object.keys(nativeMap(part)),
					...checked.map((filter) => filter.param)
				]);
				if (fields.includes("customFields")) {
					for (const key of Object.keys(configs)) if (key !== "description" && FIELD.test(key) && (only === null || only.has(key === "priority_label" ? "priority" : key))) remoteFields.add(key);
				}
				const ids = /* @__PURE__ */ new Set();
				const wanted = Math.min(count, window);
				for (let offset = 0; offset < wanted; offset += MAX_PER_PAGE) {
					const limit = MAX_PER_PAGE;
					const rows = decodeCollection(await read(`/${collection}`, {
						...params,
						page: String(Math.floor(offset / MAX_PER_PAGE) + 1),
						limit: String(limit),
						order: `created ${sort}`,
						fields: [...remoteFields].join(",")
					}, signal), TAPD_WRAPPER[part]);
					requestCount++;
					if (rows.length !== Math.min(limit, count - offset)) fail("page");
					for (const raw of rows.slice(0, wanted - offset)) {
						const value = row(raw, part, projectId);
						const id = decodeTapdItemId(value);
						if (ids.has(id)) fail("item.id");
						ids.add(id);
						for (const filter of checked) if (!filter.matches(value)) fail(`filters.${filter.param}`);
						merged.push({
							item: project(value, part, projectId, fields, configs, only),
							created: date(value.created, "created", true),
							id,
							category: part
						});
					}
				}
			}
			merged.sort((a, b) => {
				const compared = a.created < b.created ? -1 : a.created > b.created ? 1 : 0;
				if (compared !== 0) return sort === "asc" ? compared : -compared;
				const categoryOrder = selected.indexOf(a.category) - selected.indexOf(b.category);
				if (categoryOrder !== 0) return categoryOrder;
				return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
			});
			return {
				items: merged.slice((page - 1) * perPage, window).map((entry) => entry.item),
				page,
				perPage,
				total,
				totalPages: Math.max(1, Math.ceil(total / perPage)),
				fields,
				requestCount
			};
		}
		const checkedFilters = filters(conditionsFor(category), category);
		const params = { workspace_id: projectId };
		for (const filter of checkedFilters) params[filter.param] = filter.encoded;
		const configs = fields.includes("customFields") ? await fieldMap(projectId, category, signal) : {};
		const remoteFields = /* @__PURE__ */ new Set([
			"id",
			"workspace_id",
			...Object.keys(nativeMap(category)),
			...checkedFilters.map((filter) => filter.param)
		]);
		if (fields.includes("customFields")) {
			for (const key of Object.keys(configs)) if (key !== "description" && FIELD.test(key) && (only === null || only.has(key === "priority_label" ? "priority" : key))) remoteFields.add(key);
		}
		const collection = TAPD_COLLECTION[category];
		const rawItems = decodeCollection(await read(`/${collection}`, {
			...params,
			page: String(page),
			limit: String(perPage),
			order: `${order} ${sort}`,
			fields: [...remoteFields].join(",")
		}, signal), TAPD_WRAPPER[category]);
		if (rawItems.length > perPage) fail("page");
		const ids = /* @__PURE__ */ new Set();
		const items = rawItems.map((raw) => {
			const value = row(raw, category, projectId);
			const id = decodeTapdItemId(value);
			if (ids.has(id)) fail("item.id");
			ids.add(id);
			for (const filter of checkedFilters) if (!filter.matches(value)) fail(`filters.${filter.param}`);
			return project(value, category, projectId, fields, configs, only);
		});
		const count = decodeFieldMap(await read(`/${collection}/count`, params, signal)).count;
		if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) fail("count");
		return {
			items,
			page,
			perPage,
			total: count,
			totalPages: Math.max(1, Math.ceil(count / perPage)),
			fields,
			requestCount: fields.includes("customFields") ? 3 : 2
		};
	}
	async function getWorkitem(request, signal) {
		const projectId = numericId(request.projectId, "projectId");
		const id = numericId(request.id, "id");
		if (request.include?.some((section) => section !== "description") || request.expandRelations === true || request.relationTypes !== void 0) invalid("include");
		const fields = resolveListFields(request.fields);
		let found = null;
		for (const category of CATEGORIES) {
			const rows = decodeCollection(await read(`/${TAPD_COLLECTION[category]}`, {
				workspace_id: projectId,
				id,
				limit: "2",
				fields: ["description", ...Object.keys(nativeMap(category))].join(",")
			}, signal), TAPD_WRAPPER[category]);
			if (rows.length > 1) fail("detail");
			if (rows.length === 0) continue;
			const raw = row(rows[0], category, projectId);
			if (raw.id !== id || found !== null) fail("item.id");
			found = {
				raw,
				category
			};
		}
		if (found === null) throw syncRemoteError(syncError("RemoteUnavailable", {
			scope: "item",
			field: "id"
		}));
		const source = found.raw.description;
		let description = null;
		if (source !== void 0 && source !== null && source !== "") {
			if (typeof source !== "string" || source.length > 2e5) fail("description");
			if (/<\/?[A-Za-z][^>]*>/u.test(source)) {
				const decoded = decodeDescription({
					presence: "value",
					value: source,
					writable: false
				}, "richtext");
				description = {
					format: "richtext",
					html: source,
					plain: contentText(decoded.content),
					content: decoded.content
				};
			} else description = {
				format: "text",
				html: null,
				plain: source,
				content: textContent(source)
			};
		}
		return {
			item: project(found.raw, found.category, projectId, fields, {}, null),
			description,
			sectionErrors: [],
			requestCount: 3
		};
	}
	async function listFields(request, signal) {
		const projectId = numericId(request.projectId, "projectId");
		const selected = categories(request.categories);
		const merged = /* @__PURE__ */ new Map();
		for (const category of selected) {
			const configs = await fieldMap(projectId, category, signal);
			const mapping = nativeMap(category);
			for (const [remoteId, config] of Object.entries(configs)) {
				if (!FIELD.test(remoteId) || remoteId.length > 200 || !object(config)) fail("fields");
				if (remoteId === "description") continue;
				const id = mapping[remoteId] ?? (remoteId === "priority_label" ? "priority" : remoteId);
				const options = object(config.options) ? Object.entries(config.options).slice(0, 200).map(([key, value]) => ({
					id: text(key, "fields.options.id", 200) ?? fail("fields.options.id"),
					label: text(value, "fields.options.label", 100) ?? key
				})) : [];
				const previous = merged.get(id);
				if (previous) {
					const known = new Set(previous.options.map((option) => option.id));
					for (const option of options) if (!known.has(option.id) && previous.options.length < 200) {
						known.add(option.id);
						previous.options.push(option);
					}
					previous.required = previous.required || config.required === true || config.required === 1 || config.required === "1";
					continue;
				}
				merged.set(id, {
					id,
					name: text(config.label, "fields.label", 100) ?? id,
					format: text(config.html_type, "fields.format", 32) ?? "",
					required: config.required === true || config.required === 1 || config.required === "1",
					kind: mapping[remoteId] === void 0 ? "CustomField" : "NativeField",
					options
				});
			}
		}
		return [...merged.values()];
	}
	return {
		listWorkitems,
		getWorkitem,
		listFields
	};
}
//#endregion
//#region src/sync/adapters/tapd.ts
const PAGE_SIZE = 200;
const ORIGIN = "https://api.tapd.cn";
/**
* Only documented collection fields are evaluated. Do not flatten AND/OR groups
* into URL parameters: duplicate fields overwrite each other, bug field names
* differ, and an ignored parameter would silently widen imports. The local
* predicate also serves the read-only TAPD query surface.
* Docs: https://o.tapd.tencent.com/document/api-doc/API文档/api_reference/{story,bug,task}/
*/
const CONDITION_OPERATORS = {
	category: ["EQUALS", "CONTAINS"],
	workitemType: ["EQUALS", "CONTAINS"],
	assignedTo: ["EQUALS", "CONTAINS"],
	creator: ["EQUALS", "CONTAINS"],
	status: ["EQUALS", "CONTAINS"],
	sprint: ["CONTAINS"],
	priority: ["EQUALS", "CONTAINS"],
	tag: ["CONTAINS"],
	subject: ["CONTAINS"],
	gmtCreate: ["BETWEEN"],
	gmtModified: ["BETWEEN"]
};
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/u;
const CONTROL = /[\u0000-\u001f]/u;
function invalidCondition(field) {
	throw syncRemoteError(syncError("InvalidConfig", {
		scope: "rule",
		field
	}));
}
/** Compare platform wall-clock dates without guessing a browser/host timezone. */
function dateValue(value, endOfDay = false) {
	const match = DATETIME.exec(value);
	if (!match) return null;
	const [, year, month, day, hour, minute, second] = match;
	const stamp = /* @__PURE__ */ new Date(`${year}-${month}-${day}T${hour ?? "00"}:${minute ?? "00"}:${second ?? "00"}Z`);
	if (!Number.isFinite(stamp.getTime()) || stamp.toISOString().slice(0, 19) !== `${year}-${month}-${day}T${hour ?? "00"}:${minute ?? "00"}:${second ?? "00"}`) return null;
	return `${year}-${month}-${day} ${hour ?? (endOfDay ? "23" : "00")}:${minute ?? (endOfDay ? "59" : "00")}:${second ?? (endOfDay ? "59" : "00")}`;
}
function compileTapdConditions(groups) {
	if (!Array.isArray(groups) || groups.length > 10) invalidCondition("conditions");
	const compiled = groups.filter((group) => {
		if (!Array.isArray(group) || group.length > 20) invalidCondition("conditions");
		return group.length > 0;
	}).map((group) => group.map((condition) => {
		if (!condition || typeof condition.field !== "string") invalidCondition("conditions.field");
		const field = condition.field;
		const operators = CONDITION_OPERATORS[field];
		if (!operators) invalidCondition(`conditions.${field}`);
		const operator = condition.operator ?? operators[0];
		if (!operators.includes(operator)) invalidCondition(`conditions.operator(${field})`);
		if (!Array.isArray(condition.value) || condition.value.length === 0 || condition.value.length > 50 || condition.value.some((value) => typeof value !== "string" || !value.trim() || value.length > 200 || CONTROL.test(value))) invalidCondition(`conditions.value(${field})`);
		const values = [...condition.value];
		const type = field === "category" || field === "workitemType";
		if (type && !values.every(isTapdCategory)) invalidCondition(`conditions.value(${field})`);
		let from = null;
		let to = null;
		if (operator === "BETWEEN") {
			if (values.length !== 1 || typeof condition.toValue !== "string") invalidCondition(`conditions.value(${field})`);
			from = dateValue(values[0]);
			to = dateValue(condition.toValue, true);
			if (from === null || to === null || from > to) invalidCondition(`conditions.value(${field})`);
		} else if (condition.toValue !== void 0) invalidCondition(`conditions.toValue(${field})`);
		return {
			field,
			values,
			type,
			from,
			to
		};
	}));
	const relevantGroups = (category) => compiled.filter((group) => group.every((condition) => !condition.type || condition.values.includes(category)));
	return {
		categories: TAPD_CATEGORIES.filter((category) => compiled.length === 0 || relevantGroups(category).length > 0),
		matches(category, raw) {
			if (compiled.length === 0) return true;
			if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw syncRemoteError(syncError("InvalidRemoteResponse", {
				scope: "item",
				field: "item"
			}));
			const row = raw;
			return relevantGroups(category).map((group) => group.map((condition) => {
				if (condition.type) return true;
				const { field, values, from, to } = condition;
				const remoteField = field === "assignedTo" ? TAPD_CATEGORY_FIELDS[category].owner : field === "subject" ? TAPD_CATEGORY_FIELDS[category].title : field === "creator" ? category === "bug" ? "reporter" : "creator" : {
					status: "status",
					sprint: "iteration_id",
					priority: "priority_label",
					tag: "label",
					gmtCreate: "created",
					gmtModified: "modified"
				}[field];
				const value = row[remoteField];
				if (value === void 0 || value !== null && typeof value !== "string" || typeof value === "string" && CONTROL.test(value)) throw syncRemoteError(syncError("InvalidRemoteResponse", {
					scope: "item",
					field: remoteField
				}));
				if (value === null || value === "") return false;
				if (from !== null && to !== null) {
					const date = dateValue(value);
					if (date === null) throw syncRemoteError(syncError("InvalidRemoteResponse", {
						scope: "item",
						field: remoteField
					}));
					return date >= from && date <= to;
				}
				if (field === "subject") return values.some((candidate) => value.includes(candidate));
				const entries = field === "assignedTo" || field === "creator" ? value.split(";").map((entry) => entry.trim()) : field === "tag" ? value.split("|").map((entry) => entry.trim()) : [value];
				return values.some((candidate) => entries.includes(candidate));
			}).every(Boolean)).some(Boolean);
		}
	};
}
function categoryOfKey(key) {
	if (isTapdCategory(key.typeId)) return key.typeId;
	throw syncRemoteError(syncError("InvalidConfig", {
		scope: "item",
		field: "typeId"
	}));
}
/** The three collections a TAPD rule can target, in the platform's own order. */
const TAPD_CATEGORIES = [
	"story",
	"bug",
	"task"
];
/** TAPD's own names for them, as its own UI shows them. */
const TAPD_TYPE_LABELS = {
	story: "需求",
	bug: "缺陷",
	task: "任务"
};
function isTapdCategory(value) {
	return value === "story" || value === "bug" || value === "task";
}
/**
* Build a TAPD (public cloud) adapter for one connection. The personal access
* token is resolved from the Host credential store or the referenced
* environment variable inside the factory, so a missing credential fails before
* any request and the credential never enters a DTO. The token travels as
* `Authorization: Bearer`, exactly as WorkBuddy's TAPD connector uses it, and
* only `https://api.tapd.cn` is used.
*/
/**
* List the organizations a TAPD personal access token belongs to. Verified live
* on 2026-10-10: `/workspaces/projects` demands a `company_id`, while
* `/workspaces/user_participant_projects` answers with no parameter at all and
* includes the account's organization as a row whose `category` is
* `organization`. So the company never has to be typed in by hand.
*/
async function listTapdOrganizations(token, transport, signal) {
	if (!token.trim()) throw syncRemoteError(syncError("CredentialMissing", {
		scope: "connection",
		field: "token"
	}));
	return decodeOptionCollection((await transport.read({
		url: new URL(`${ORIGIN}/workspaces/user_participant_projects`),
		method: "GET",
		headers: { authorization: `Bearer ${token}` },
		readOnly: true
	}, signal)).value, "Workspace", "id", "name", (item) => item.category === "organization").map((option) => ({
		id: option.id,
		name: option.label
	}));
}
function createTapdAdapter(connection, transport, env = process.env, storedCredential) {
	if (connection.platform !== "tapd") throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "platform"
	}));
	const credentials = storedCredential ?? resolveCredentials(connection, env);
	if (credentials.kind !== "tapd") throw syncRemoteError(syncError("InvalidConfig", {
		scope: "connection",
		field: "tokenEnv"
	}));
	const instance = connection.companyId;
	const authorization = "Bearer " + credentials.token;
	const url = (path, params = {}) => {
		const built = new URL(`${ORIGIN}${path}`);
		for (const [key, value] of Object.entries(params)) built.searchParams.set(key, value);
		return built;
	};
	const auth = (extra = {}) => ({
		authorization,
		...extra
	});
	const collectionFor = (category) => TAPD_COLLECTION[category];
	const wrapperFor = (category) => TAPD_WRAPPER[category];
	async function listProjects(signal) {
		return decodeOptionCollection((await transport.read({
			url: url("/workspaces/user_participant_projects"),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value, "Workspace", "id", "name", (item) => item.category !== "organization");
	}
	async function fetchFieldMap(projectId, category, signal) {
		return decodeFieldMap((await transport.read({
			url: url(`/${collectionFor(category)}/get_fields_info`, { workspace_id: projectId }),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value);
	}
	async function fetchWorkitemTypes(projectId, signal) {
		return decodeWorkitemTypes((await transport.read({
			url: url("/workitem_types", { workspace_id: projectId }),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value);
	}
	async function fetchWorkflows(projectId, category, signal) {
		const systemName = TAPD_WORKFLOW_SYSTEM_NAME[category];
		if (systemName === void 0) return [];
		return decodeWorkflows((await transport.read({
			url: url("/workflows", {
				workspace_id: projectId,
				system_name: systemName
			}),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value);
	}
	async function fetchStatusMap(projectId, category, workitemTypeId, signal) {
		const system = TAPD_WORKFLOW_SYSTEM[category];
		if (system === void 0) return [];
		const params = {
			workspace_id: projectId,
			system
		};
		if (category === "story") params.workitem_type_id = workitemTypeId;
		return decodeStatusMap((await transport.read({
			url: url("/workflows/status_map", params),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value);
	}
	async function fetchTransitions(projectId, category, workitemTypeId, signal) {
		const system = TAPD_WORKFLOW_SYSTEM[category];
		if (system === void 0) return [];
		const params = {
			workspace_id: projectId,
			system
		};
		if (category === "story") params.workitem_type_id = workitemTypeId;
		return decodeTransitions((await transport.read({
			url: url("/workflows/all_transitions", params),
			method: "GET",
			headers: auth(),
			readOnly: true
		}, signal)).value);
	}
	/** Resolve the workflow that gates a category's status writes; null means unknown/ambiguous. */
	function resolveWorkflow(category, workflowId, workflows) {
		if (category === "story") {
			if (workflowId === null) return null;
			return workflows.find((w) => w.id === workflowId) ?? null;
		}
		if (workflowId !== null) {
			const match = workflows.find((w) => w.id === workflowId);
			if (match) return match;
		}
		const defaults = workflows.filter((w) => w.isDefault);
		if (defaults.length === 1) return defaults[0];
		if (defaults.length === 0 && workflows.length === 1) return workflows[0];
		return null;
	}
	async function capability(projectId, category, fieldMap, workflows, signal) {
		const candidateFields = [];
		if (hasFieldConfig(fieldMap, "priority_label")) candidateFields.push({
			field: "priority",
			remoteId: "priority_label",
			format: "priority",
			writable: true
		});
		if (hasFieldConfig(fieldMap, "label")) candidateFields.push({
			field: "tags",
			remoteId: "label",
			format: "label",
			writable: true
		});
		let readStates;
		let workflow = { readOnly: true };
		let writeStates = [];
		if (category === "story") {
			const storyTypes = (await fetchWorkitemTypes(projectId, signal)).filter((type) => type.entityType === "story");
			const statusMaps = await Promise.all(storyTypes.map((type) => fetchStatusMap(projectId, category, type.id, signal)));
			const labels = /* @__PURE__ */ new Map();
			const conflicts = /* @__PURE__ */ new Set();
			for (const options of statusMaps) for (const option of options) {
				const previous = labels.get(option.id);
				if (previous !== void 0 && previous !== option.label) conflicts.add(option.id);
				else labels.set(option.id, option.label);
			}
			readStates = [...labels].filter(([id]) => !conflicts.has(id)).map(([id, label]) => ({
				id,
				label
			}));
			if (storyTypes.length > 0 && storyTypes.every((type) => resolveWorkflow(category, type.workflowId, workflows)?.type === "classic")) {
				workflow = { readOnly: false };
				writeStates = readStates.filter((option) => statusMaps.every((map) => map.some((state) => state.id === option.id)));
			}
		} else {
			readStates = category === "task" ? decodeStatusOptions(fieldMap) : await fetchStatusMap(projectId, category, category, signal);
			if (category === "task") {
				workflow = { readOnly: false };
				writeStates = readStates;
			} else {
				const resolved = resolveWorkflow(category, null, workflows);
				if (resolved !== null && resolved.type === "classic") {
					workflow = { readOnly: false };
					writeStates = readStates;
				}
			}
		}
		return {
			typeId: category,
			fields: [
				"title",
				"description",
				"status"
			],
			readStates,
			writeStates,
			representation: {
				format: "text",
				roundTrip: true
			},
			paging: { kind: "page" },
			workflow,
			candidateFields
		};
	}
	/** Gate a real status transition on a classic workflow plus a known safe edge; tasks skip the workflow API. */
	async function gateStatusWrite(key, category, currentRaw, targetRaw, signal) {
		if (category === "task") return;
		let workitemTypeId = category;
		let workflowId = null;
		if (category === "story") {
			const stories = decodeCollection((await transport.read({
				url: url("/stories", {
					workspace_id: key.projectId,
					id: key.id
				}),
				method: "GET",
				headers: auth(),
				readOnly: true
			}, signal)).value, "Story");
			if (stories.length !== 1 || decodeTapdItemId(stories[0]) !== key.id) throw syncRemoteError(syncError("WorkflowRejected", {
				scope: "item",
				field: "status"
			}));
			const raw = stories[0];
			if (raw.workspace_id !== key.projectId || raw.status !== currentRaw) throw syncRemoteError(syncError("WorkflowRejected", {
				scope: "item",
				field: "status"
			}));
			const subtype = raw.workitem_type_id;
			if (typeof subtype !== "string" || !subtype.trim() || CONTROL.test(subtype)) throw syncRemoteError(syncError("WorkflowRejected", {
				scope: "item",
				field: "workitem_type_id"
			}));
			const matches = (await fetchWorkitemTypes(key.projectId, signal)).filter((type) => type.id === subtype && type.entityType === "story");
			if (matches.length !== 1 || matches[0].workflowId === null) throw syncRemoteError(syncError("WorkflowRejected", {
				scope: "item",
				field: "workitem_type_id"
			}));
			workitemTypeId = subtype;
			workflowId = matches[0].workflowId;
		}
		const workflows = await fetchWorkflows(key.projectId, category, signal);
		const workflow = resolveWorkflow(category, workflowId, workflows);
		if (workflow === null || workflow.type !== "classic" || category === "story" && workflows.filter((w) => w.id === workflow.id).length !== 1) throw syncRemoteError(syncError("WorkflowRejected", {
			scope: "item",
			field: "status"
		}));
		if (category === "story") {
			const states = await fetchStatusMap(key.projectId, category, workitemTypeId, signal);
			if (!states.some((state) => state.id === currentRaw) || !states.some((state) => state.id === targetRaw)) throw syncRemoteError(syncError("WorkflowRejected", {
				scope: "item",
				field: "status"
			}));
		}
		const edges = (await fetchTransitions(key.projectId, category, workitemTypeId, signal)).filter((t) => t.source === currentRaw && t.target === targetRaw);
		const edge = edges[0];
		if (edge === void 0 || category === "story" && edges.length !== 1 || edge.requiresUnsupported || edge.workflowId !== null && edge.workflowId !== workflow.id) throw syncRemoteError(syncError("WorkflowRejected", {
			scope: "item",
			field: "status"
		}));
	}
	return {
		async metadata(scope, signal) {
			const projects = await listProjects(signal);
			let members = [];
			let iterations = [];
			let types = [];
			let typeCapabilities = [];
			if (scope.projectId !== void 0) {
				members = decodeOptionCollection((await transport.read({
					url: url("/workspaces/users", { workspace_id: scope.projectId }),
					method: "GET",
					headers: auth(),
					readOnly: true
				}, signal)).value, "UserWorkspace", "user", "name");
				iterations = decodeOptionCollection((await transport.read({
					url: url("/iterations", {
						workspace_id: scope.projectId,
						limit: String(PAGE_SIZE),
						page: "1",
						order: "id asc"
					}),
					method: "GET",
					headers: auth(),
					readOnly: true
				}, signal)).value, "Iteration", "id", "name");
				types = TAPD_CATEGORIES.map((category) => ({
					id: category,
					label: TAPD_TYPE_LABELS[category]
				}));
				const targets = scope.typeId !== void 0 && isTapdCategory(scope.typeId) ? [scope.typeId] : TAPD_CATEGORIES;
				for (const category of targets) {
					const fieldMap = await fetchFieldMap(scope.projectId, category, signal);
					const workflows = category === "task" ? [] : await fetchWorkflows(scope.projectId, category, signal);
					typeCapabilities.push(await capability(scope.projectId, category, fieldMap, workflows, signal));
				}
			}
			return {
				connectionId: scope.connectionId,
				credentialPresent: true,
				readOnly: false,
				projects,
				members,
				iterations,
				types,
				typeCapabilities
			};
		},
		async *discover(rule, signal) {
			const filter = compileTapdConditions(rule.conditions);
			for (const category of filter.categories) {
				const seen = /* @__PURE__ */ new Set();
				let previousLast = null;
				for (let page = 1;; page += 1) {
					if (page > 1e4) throw syncRemoteError(syncError("IncompleteDiscovery", {
						scope: "connection",
						field: "page"
					}));
					const rawItems = decodeCollection((await transport.read({
						url: url(`/${collectionFor(category)}`, {
							workspace_id: rule.projectId,
							limit: String(PAGE_SIZE),
							page: String(page),
							order: "id desc"
						}),
						method: "GET",
						headers: auth(),
						readOnly: true
					}, signal)).value, wrapperFor(category));
					if (rawItems.length > PAGE_SIZE) throw syncRemoteError(syncError("InvalidRemoteResponse", {
						scope: "connection",
						field: "page"
					}));
					const batch = [];
					let last = null;
					for (const rawItem of rawItems) {
						const id = decodeTapdItemId(rawItem);
						if (!/^\d+$/u.test(id)) throw syncRemoteError(syncError("InvalidRemoteResponse", {
							scope: "item",
							field: "id"
						}));
						const numericId = BigInt(id);
						if (last !== null && numericId > last) throw syncRemoteError(syncError("IncompleteDiscovery", {
							scope: "connection",
							field: "order"
						}));
						last = numericId;
						if (seen.has(id)) continue;
						seen.add(id);
						if (!filter.matches(category, rawItem)) continue;
						batch.push(decodeTapdItem(rawItem, {
							instance,
							projectId: rule.projectId,
							typeId: category,
							category,
							statusWriteStates: rule.statusWriteStates
						}));
					}
					if (last !== null && previousLast !== null && last >= previousLast) throw syncRemoteError(syncError("IncompleteDiscovery", {
						scope: "connection",
						field: "page"
					}));
					yield batch;
					if (rawItems.length < PAGE_SIZE) break;
					previousLast = last;
				}
			}
		},
		async read(key, rule, signal) {
			const category = categoryOfKey(key);
			const rawItems = decodeCollection((await transport.read({
				url: url(`/${collectionFor(category)}`, {
					workspace_id: key.projectId,
					id: key.id
				}),
				method: "GET",
				headers: auth(),
				readOnly: true
			}, signal)).value, wrapperFor(category));
			if (rawItems.length === 0) throw syncRemoteError(syncError("RemoteUnavailable", {
				scope: "item",
				field: "id"
			}));
			if (rawItems.length > 1) throw syncRemoteError(syncError("InvalidRemoteResponse", {
				scope: "item",
				field: "detail"
			}));
			return decodeTapdItem(rawItems[0], {
				instance,
				projectId: key.projectId,
				typeId: category,
				category,
				id: key.id,
				statusWriteStates: rule.statusWriteStates
			});
		},
		/**
		* Write back the one field a rule owns: the status, as the rule's own map
		* decides. Every other patch key is a configuration error, never a silent
		* write attempt — the same contract 云效's adapter implements.
		*/
		async write(key, patch, observed, rule, signal) {
			for (const field of Object.keys(patch)) if (field !== "status" && patch[field] !== void 0) throw syncRemoteError(syncError("MappingIncompatible", {
				scope: "item",
				field
			}));
			if (patch.status === void 0) return;
			const category = categoryOfKey(key);
			const targetRaw = encodeStatus(patch.status, observed.rawStatus, rule.statusWriteStates);
			if (targetRaw === observed.rawStatus) return;
			await gateStatusWrite(key, category, observed.rawStatus, targetRaw, signal);
			const body = {
				workspace_id: key.projectId,
				id: key.id,
				status: targetRaw
			};
			if (category === "story") body.is_auto_close_task = "0";
			else if (category === "task") body.auto_complete_effort = "0";
			else body.keep_owner = "1";
			const response = await transport.write({
				url: url(`/${collectionFor(category)}/update`),
				method: "POST",
				headers: auth({ "content-type": "application/x-www-form-urlencoded" }),
				body: new URLSearchParams(body).toString(),
				readOnly: false
			}, signal);
			if (response.status >= 200 && response.status <= 299) {
				if (response.value === null) throw syncRemoteError(syncError("WriteOutcomeUnknown", { scope: "item" }));
				const envelope = decodeEnvelope(response.value, "write");
				if (envelope.status !== 1) throw syncRemoteError(syncError(classifyWriteBusinessError(envelope.info), { scope: "item" }));
				return;
			}
			if (response.status === 404) throw syncRemoteError(syncError("RemoteUnavailable", { scope: "item" }));
			if (response.status === 429) throw syncRemoteError(syncError("WriteOutcomeUnknown", { scope: "item" }));
			throw syncRemoteError(syncError("WorkflowRejected", { scope: "item" }));
		},
		async evidence(_intent, _observed, _signal) {
			return "unknown";
		}
	};
}
//#endregion
//#region src/index.ts
const name = "task-list";
const inject = [];
const Config = z.object({
	file: z.string().description("Optional absolute task SQLite path"),
	dshHome: z.string().description("Harness data home override")
});
function abortError() {
	return new DOMException("The operation was aborted", "AbortError");
}
/** Real wall clock whose `sleep` rejects on abort, so heartbeat and retry backoff settle on stop. */
const realClock = {
	now: () => Date.now(),
	sleep: (ms, signal) => {
		if (signal.aborted) return Promise.reject(abortError());
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				signal.removeEventListener("abort", onAbort);
				resolve();
			}, ms);
			function onAbort() {
				clearTimeout(timer);
				reject(abortError());
			}
			signal.addEventListener("abort", onAbort, { once: true });
		});
	}
};
function apply(ctx, config = {}) {
	if (config.file && !isAbsolute(config.file)) throw new Error("task-list file path must be absolute");
	const store = new TaskStore(config.file ?? join(resolveDshHome(config.dshHome), "task-list", "tasks.sqlite"));
	const configStore = new SyncConfigStore(store.db);
	const authOptions = {
		config: configStore,
		store: null,
		callbackBaseUrl: null,
		resolveSecret: async (ref) => {
			const credentials = ctx.get("credentials");
			return credentials?.resolve ? (await credentials.resolve(ref))?.value ?? null : process.env[ref] ?? null;
		}
	};
	const authorization = new SyncAuthorizationService(authOptions);
	const secrets = { store: null };
	const authFiber = ctx.inject(["credentials", "webServer"], (authCtx) => {
		const credentials = authCtx.get("credentials");
		const webServer = authCtx.get("webServer");
		if (typeof credentials?.readRecord !== "function" || typeof credentials?.modifyRecord !== "function" || typeof credentials?.deleteRecord !== "function" || webServer.host !== "127.0.0.1") return;
		authOptions.store = new HostSyncCredentialStore(credentials);
		secrets.store = new HostManualSecretStore(credentials);
		authOptions.callbackBaseUrl = `http://127.0.0.1:${webServer.port}`;
		const off = webServer.register({
			kind: "exact",
			path: OAUTH_CALLBACK_PATH,
			handler: createOAuthCallbackHandler(authorization, authOptions.callbackBaseUrl)
		});
		authCtx.effect(() => () => {
			off();
			authOptions.store = null;
			authOptions.callbackBaseUrl = null;
			secrets.store = null;
		});
	});
	const links = new SyncLinkStore(store.db, store, realClock);
	const runs = new SyncRunStore(store.db, realClock);
	const adapterFactory = async (connection, context) => {
		if (connection.authentication?.mode === "oauth") {
			if (connection.platform !== "yunxiao") throw syncRemoteError(syncError("InvalidConfig", {
				scope: "connection",
				field: "authentication"
			}));
			context.beforeRequest();
			const token = await authorization.yunxiaoToken(connection);
			if (token === null) throw syncRemoteError(syncError("CredentialMissing", {
				scope: "connection",
				field: "authentication"
			}));
			return createYunxiaoAdapter(connection, new SyncTransport({
				fetch: globalThis.fetch,
				clock: realClock,
				beforeRequest: context.beforeRequest
			}), void 0, {
				kind: "yunxiao",
				token
			});
		}
		const transport = new SyncTransport({
			fetch: globalThis.fetch,
			clock: realClock,
			beforeRequest: context.beforeRequest
		});
		const stored = secrets.store ? await secrets.store.read(connection.id) : null;
		if (connection.platform === "tapd") return createTapdAdapter(connection, transport, {}, stored?.platform === "tapd" ? {
			kind: "tapd",
			token: stored.token
		} : void 0);
		if (connection.platform !== "yunxiao") throw syncRemoteError(syncError("InvalidConfig", {
			scope: "connection",
			field: "platform"
		}));
		return createYunxiaoAdapter(connection, transport, void 0, stored?.platform === "yunxiao" ? {
			kind: "yunxiao",
			token: stored.token
		} : void 0);
	};
	const executor = new SyncExecutor({
		tasks: store,
		config: configStore,
		links,
		runs,
		adapterFactory,
		clock: realClock
	});
	const queryFactory = async (connection) => {
		const transport = new SyncTransport({
			fetch: globalThis.fetch,
			clock: realClock,
			beforeRequest: () => {}
		});
		if (connection.authentication?.mode === "oauth") {
			if (connection.platform !== "yunxiao") throw syncRemoteError(syncError("InvalidConfig", {
				scope: "query",
				field: "authentication"
			}));
			const token = await authorization.yunxiaoToken(connection);
			if (token === null) throw syncRemoteError(syncError("CredentialMissing", {
				scope: "connection",
				field: "authentication"
			}));
			return createYunxiaoQuery(connection, transport, void 0, {
				kind: "yunxiao",
				token
			});
		}
		const stored = secrets.store ? await secrets.store.read(connection.id) : null;
		if (connection.platform === "tapd") return createTapdQuery(connection, transport, void 0, stored?.platform === "tapd" ? {
			kind: "tapd",
			token: stored.token
		} : void 0);
		if (connection.platform !== "yunxiao") throw syncRemoteError(syncError("InvalidConfig", {
			scope: "query",
			field: "platform"
		}));
		return createYunxiaoQuery(connection, transport, void 0, stored?.platform === "yunxiao" ? {
			kind: "yunxiao",
			token: stored.token
		} : void 0);
	};
	const sync = new SyncService({
		tasks: store,
		config: configStore,
		links,
		runs,
		executor,
		adapterFactory,
		secrets: () => secrets.store ?? void 0,
		organizations: async (token) => listYunxiaoOrganizations(token, new SyncTransport({
			fetch: globalThis.fetch,
			clock: realClock,
			beforeRequest: () => {}
		}), AbortSignal.timeout(3e4)),
		tapdOrganizations: async (token) => listTapdOrganizations(token, new SyncTransport({
			fetch: globalThis.fetch,
			clock: realClock,
			beforeRequest: () => {}
		}), AbortSignal.timeout(3e4)),
		oauthToken: async (id) => {
			const connection = configStore.getConnection(id);
			return connection === null ? null : authorization.yunxiaoToken(connection);
		},
		queryFactory
	});
	const statistics = new StatisticsService(new StatisticsCacheStore(store.db), () => createStatisticsSource(ctx), store);
	ctx.effect(() => async () => {
		await authorization.dispose();
		await executor.stop();
		await authFiber.dispose();
		store.close();
	}, "task-list: SQLite close");
	new TaskService(ctx, store, sync, statistics, authorization);
}
//#endregion
export { Config, TaskStore, apply, inject, name };
