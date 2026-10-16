window.__ModuleLoader__.load({
	id: "@guowenzhang/dsh-task-list",
	chunk: "client.StatisticsCalendar.js",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/statistics-calendar.ts
		function periodValue(period, now = /* @__PURE__ */ new Date()) {
			const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
			return period === "year" ? String(now.getFullYear()) : period === "month" ? month : `${month}-${String(now.getDate()).padStart(2, "0")}`;
		}
		function periodRequest(period, value) {
			if (!(period === "year" ? /^\d{4}$/ : period === "month" ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(value)) throw new Error("Invalid statistics period");
			const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
			const start = new Date(year, month - 1, day);
			if (year < 1970 || year > 9998 || start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) throw new Error("Invalid statistics period");
			const end = new Date(start);
			if (period === "year") end.setFullYear(year + 1);
			else if (period === "month") end.setMonth(month);
			else end.setDate(day + 1);
			return {
				start: start.getTime(),
				end: end.getTime(),
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
			};
		}
		/**
		* Medium cell colour: one day of this many tokens, scaled to whatever bucket a
		* view draws. An absolute anchor keeps a busy hour, day, and month comparable
		* across views, which a maximum-relative scale cannot do.
		*/
		const MEDIUM_DAY_TOKENS = 6e8;
		/** Ratios of the bucket's medium value; 1x lands in the middle band. */
		const BANDS = [
			.5,
			1.5,
			3
		];
		/** Medium token count for one cell of the given view. */
		function mediumTokens(period) {
			if (period === "day") return MEDIUM_DAY_TOKENS / 24;
			if (period === "month") return MEDIUM_DAY_TOKENS;
			return MEDIUM_DAY_TOKENS * 30;
		}
		/**
		* Heat level of one cell.
		* @param tokens - tokens recorded in the bucket.
		* @param period - view the bucket belongs to.
		* @returns 0 for an empty bucket, else 1 through 4.
		*/
		function heatLevel(tokens, period) {
			if (!(tokens > 0)) return 0;
			const ratio = tokens / mediumTokens(period);
			if (ratio < BANDS[0]) return 1;
			if (ratio < BANDS[1]) return 2;
			if (ratio < BANDS[2]) return 3;
			return 4;
		}
		const exactCount$1 = new Intl.NumberFormat();
		/**
		* Compact magnitude for large counters: `79.7M`, `1.48B`. A value below a
		* million stays exact, so ordinary counts never become unreadable fractions.
		* @param value - raw counter value.
		* @returns the display text for one counter.
		*/
		function compactNumber(value) {
			const magnitude = Math.abs(value);
			if (magnitude < 1e6) return exactCount$1.format(value);
			const billions = magnitude >= 1e9;
			const scaled = value / (billions ? 1e9 : 1e6);
			return `${Number(scaled.toFixed(billions ? 2 : 1))}${billions ? "B" : "M"}`;
		}
		function emptyCell(label, start, excluded) {
			return {
				label,
				start,
				excluded,
				sessions: 0,
				prompts: 0,
				tokens: 0,
				completedTasks: 0,
				completedPoints: 0
			};
		}
		/**
		* Cells for one view in draw order.
		*
		* A month view starts with one `null` per weekday before its first day, so the
		* cells line up under a Monday-first weekday header.
		* @param snapshot - folded report.
		* @param period - view to lay out.
		* @param dayLabel - how a month cell names its day of month, e.g. `1号`.
		* @returns cells, with month padding entries as `null`.
		*/
		function calendarCells(snapshot, period, dayLabel = String) {
			const first = new Date(snapshot.start);
			if (period === "day") return applyHours(Array.from({ length: 24 }, (_, hour) => {
				const date = new Date(first);
				date.setHours(hour, 0, 0, 0);
				return emptyCell(`${String(hour).padStart(2, "0")}:00`, date.getTime(), date.getTime() >= snapshot.cutoff || date.getHours() !== hour);
			}), snapshot, "day");
			if (period === "month") {
				const lead = (first.getDay() + 6) % 7;
				const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
				const blanks = Array.from({ length: lead }, () => null);
				const cells = Array.from({ length: days }, (_, index) => {
					const date = new Date(first.getFullYear(), first.getMonth(), index + 1);
					return emptyCell(dayLabel(index + 1), date.getTime(), date.getTime() >= snapshot.cutoff);
				});
				return [...blanks, ...applyHours(cells, snapshot, "month")];
			}
			const year = first.getFullYear();
			return applyHours(Array.from({ length: 12 }, (_, index) => {
				const date = new Date(year, index, 1);
				return emptyCell(`${index + 1}月`, date.getTime(), date.getTime() >= snapshot.cutoff);
			}), snapshot, "year");
		}
		/** Week rows a month grid needs: five for most months, six when the month starts late. */
		function calendarWeeks(snapshot) {
			const first = new Date(snapshot.start);
			const lead = (first.getDay() + 6) % 7;
			const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
			return Math.ceil((lead + days) / 7);
		}
		/**
		* Sum the report's hour rows into their cells.
		*
		* Wall-clock fields decide the target so both occurrences of a DST hour share
		* one day cell.
		*/
		function applyHours(cells, snapshot, period) {
			const format = new Intl.DateTimeFormat("en", {
				timeZone: snapshot.timeZone,
				month: "numeric",
				day: "numeric",
				hour: "numeric",
				hourCycle: "h23"
			});
			for (const row of snapshot.hours) {
				if (row.hour < snapshot.start || row.hour >= snapshot.end || row.hour >= snapshot.cutoff) continue;
				const parts = format.formatToParts(row.hour);
				const field = period === "day" ? "hour" : period === "month" ? "day" : "month";
				const cell = cells[Number(parts.find((part) => part.type === field).value) - (period === "day" ? 0 : 1)];
				if (!cell || cell.excluded) continue;
				cell.sessions += row.sessions;
				cell.prompts += row.prompts;
				cell.tokens += row.tokens;
				cell.completedTasks += row.completedTasks;
				cell.completedPoints += row.completedPoints;
			}
			return cells;
		}
		//#endregion
		//#region \0dsh-css:C:\02-codespace\DeepSeek\.agents\worktree\main-183401\dsh-task-list\src\client\StatisticsCalendar.module.css.mjs
		const css = ".tRmaJa_view{flex-direction:column;flex:1;min-height:0;line-height:1.45;display:flex}.tRmaJa_header{flex:none;justify-content:space-between;align-items:center;gap:16px;margin-bottom:10px;display:flex}.tRmaJa_header h1,.tRmaJa_header .tRmaJa_title{margin:0;font-size:20px;font-weight:500;line-height:28px}.tRmaJa_header h1:focus{outline:none}.tRmaJa_toolbar{flex-wrap:wrap;flex:none;align-items:center;gap:10px;margin-bottom:12px;display:flex}.tRmaJa_periods{flex:none}.tRmaJa_stepper{align-items:center;gap:4px;display:inline-flex}.tRmaJa_toolbar input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);height:32px;color:inherit;font:var(--dsw-font-xs-13);padding:0 9px}.tRmaJa_toolbar input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.tRmaJa_progress{text-align:right;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;flex:96px;margin-left:4px;overflow:hidden}.tRmaJa_error{font:var(--dsw-font-xs-13);color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;flex:none;margin:0 0 8px}.tRmaJa_totals{flex:none;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:12px;display:grid}.tRmaJa_total{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);flex-direction:column;gap:2px;padding:8px 12px;display:flex}.tRmaJa_totalLabel{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}.tRmaJa_totalValue{font-variant-numeric:tabular-nums;letter-spacing:-.02em;font-size:20px;font-weight:600;line-height:24px}.tRmaJa_calendar{flex-direction:column;min-height:0;display:flex}.tRmaJa_weekdays{flex:none;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-bottom:5px;display:grid}.tRmaJa_weekdays span{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center}.tRmaJa_grid{flex:none;align-content:start;gap:6px;display:grid}.tRmaJa_grid[data-period=day]{grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:auto}.tRmaJa_grid[data-period=month]{grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:auto}.tRmaJa_grid[data-period=year]{grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:auto;gap:10px}.tRmaJa_cell{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);text-align:left;font-variant-numeric:tabular-nums;font:var(--dsw-font-xxs-12);flex-direction:column;gap:3px;padding:8px 11px;display:flex}.tRmaJa_cell:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.tRmaJa_cellHead{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:baseline;display:flex}.tRmaJa_cellHead b{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);font-weight:600}.tRmaJa_cellBody{gap:3px;display:grid}.tRmaJa_group{grid-template-columns:minmax(0,1fr) max-content;align-items:baseline;gap:1px 8px;display:grid}.tRmaJa_group+.tRmaJa_group{border-top:.5px solid var(--dsw-alias-border-l3);margin-top:3px;padding-top:4px}.tRmaJa_stat{display:contents}.tRmaJa_statLabel{color:var(--dsw-alias-label-tertiary);font-style:normal;font:var(--dsw-font-xxs-12)}.tRmaJa_statValue{color:var(--dsw-alias-label-primary);text-align:right;font-size:15px;font-weight:600;line-height:20px}.tRmaJa_blank{border-radius:var(--dsw-radius-md)}.tRmaJa_grid[data-period=year] .tRmaJa_cell{gap:3px;padding:9px 12px}.tRmaJa_grid[data-period=year] .tRmaJa_cellHead b{font-size:14px;line-height:20px}.tRmaJa_grid[data-period=year] .tRmaJa_group{column-gap:10px}.tRmaJa_grid[data-period=year] .tRmaJa_statLabel{font:var(--dsw-font-xxs-12)}.tRmaJa_grid[data-period=year] .tRmaJa_statValue{font-size:15px;line-height:20px}.tRmaJa_grid[data-period=month] .tRmaJa_cell{gap:2px;padding:5px 9px}.tRmaJa_grid[data-period=month] .tRmaJa_cellHead{font-size:11px;line-height:15px}.tRmaJa_grid[data-period=month] .tRmaJa_cellHead b{font-size:12px;line-height:16px}.tRmaJa_grid[data-period=month] .tRmaJa_group{column-gap:7px}.tRmaJa_grid[data-period=month] .tRmaJa_group+.tRmaJa_group{margin-top:1px;padding-top:2px}.tRmaJa_grid[data-period=month] .tRmaJa_statLabel{font-size:11px;line-height:15px}.tRmaJa_grid[data-period=month] .tRmaJa_statValue{font-size:13px;line-height:18px}.tRmaJa_cell[data-excluded]{background:0 0;border-style:dashed}.tRmaJa_cell[data-excluded] .tRmaJa_cellHead b,.tRmaJa_cell[data-excluded] .tRmaJa_statLabel,.tRmaJa_cell[data-excluded] .tRmaJa_statValue{color:var(--dsw-alias-label-tertiary)}.tRmaJa_cell[data-level=\"1\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, var(--dsw-alias-bg-base));border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 22%, var(--dsw-alias-border-l3))}.tRmaJa_cell[data-level=\"2\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 26%, var(--dsw-alias-bg-base));border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 34%, var(--dsw-alias-border-l3))}.tRmaJa_cell[data-level=\"3\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 46%, var(--dsw-alias-bg-base));border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 52%, var(--dsw-alias-border-l3))}.tRmaJa_cell[data-level=\"4\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 72%, var(--dsw-alias-bg-base));border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 76%, var(--dsw-alias-border-l3))}.tRmaJa_cell[data-level=\"4\"] .tRmaJa_cellHead,.tRmaJa_cell[data-level=\"4\"] .tRmaJa_cellHead b,.tRmaJa_cell[data-level=\"4\"] .tRmaJa_statLabel,.tRmaJa_cell[data-level=\"4\"] .tRmaJa_statValue{color:var(--dsw-alias-label-primary-foreground)}.tRmaJa_cell[data-level=\"4\"] .tRmaJa_group+.tRmaJa_group{border-top-color:color-mix(in srgb, var(--dsw-alias-label-primary-foreground) 32%, transparent)}.tRmaJa_legend{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);flex:none;justify-content:flex-end;align-items:center;gap:6px;margin-top:8px;display:flex}.tRmaJa_swatch{border-radius:var(--dsw-radius-xs);border:.5px solid var(--dsw-alias-border-l3);width:13px;height:13px;display:block}.tRmaJa_swatch[data-level=\"0\"]{background:var(--dsw-alias-bg-base)}.tRmaJa_swatch[data-level=\"1\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, var(--dsw-alias-bg-base))}.tRmaJa_swatch[data-level=\"2\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 26%, var(--dsw-alias-bg-base))}.tRmaJa_swatch[data-level=\"3\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 46%, var(--dsw-alias-bg-base))}.tRmaJa_swatch[data-level=\"4\"]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 72%, var(--dsw-alias-bg-base))}.tRmaJa_swatch[data-excluded]{background:0 0;border-style:dashed}.tRmaJa_tip{z-index:30;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);min-width:158px;box-shadow:var(--dsw-elevation-panel);font:var(--dsw-font-xxs-12);pointer-events:none;border:0;padding:9px 11px;position:fixed}.tRmaJa_tipHead{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px;display:flex}.tRmaJa_tipHead b{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);font-weight:600}.tRmaJa_tipGroup{grid-template-columns:max-content 1fr;gap:2px 14px;display:grid}.tRmaJa_tipGroup+.tRmaJa_tipGroup{border-top:.5px solid var(--dsw-alias-border-l3);margin-top:5px;padding-top:5px}.tRmaJa_tipLabel{color:var(--dsw-alias-label-tertiary);font-style:normal}.tRmaJa_tipValue{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}@media (width<=900px){.tRmaJa_totals{grid-template-columns:repeat(3,minmax(0,1fr))}.tRmaJa_grid[data-period=day]{grid-template-columns:repeat(4,minmax(0,1fr))}.tRmaJa_grid[data-period=year]{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (pointer:coarse){.tRmaJa_toolbar input{min-height:44px;font-size:16px;line-height:22px}.tRmaJa_stepper button{min-width:44px;min-height:44px}}";
		const tagId = "@guowenzhang/dsh-task-list/StatisticsCalendar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var StatisticsCalendar_module_css_default = {
			"blank": "tRmaJa_blank",
			"calendar": "tRmaJa_calendar",
			"cell": "tRmaJa_cell",
			"cellBody": "tRmaJa_cellBody",
			"cellHead": "tRmaJa_cellHead",
			"error": "tRmaJa_error",
			"grid": "tRmaJa_grid",
			"group": "tRmaJa_group",
			"header": "tRmaJa_header",
			"legend": "tRmaJa_legend",
			"periods": "tRmaJa_periods",
			"progress": "tRmaJa_progress",
			"stat": "tRmaJa_stat",
			"statLabel": "tRmaJa_statLabel",
			"statValue": "tRmaJa_statValue",
			"stepper": "tRmaJa_stepper",
			"swatch": "tRmaJa_swatch",
			"tip": "tRmaJa_tip",
			"tipGroup": "tRmaJa_tipGroup",
			"tipHead": "tRmaJa_tipHead",
			"tipLabel": "tRmaJa_tipLabel",
			"tipValue": "tRmaJa_tipValue",
			"title": "tRmaJa_title",
			"toolbar": "tRmaJa_toolbar",
			"total": "tRmaJa_total",
			"totalLabel": "tRmaJa_totalLabel",
			"totalValue": "tRmaJa_totalValue",
			"totals": "tRmaJa_totals",
			"view": "tRmaJa_view",
			"weekdays": "tRmaJa_weekdays"
		};
		//#endregion
		//#region src/client/StatisticsCalendar.tsx
		/** Two families: session activity, then delivery from the task store. */
		const GROUPS = [[
			{
				key: "sessions",
				label: "statisticsSessions",
				short: "statisticsShortSessions"
			},
			{
				key: "prompts",
				label: "statisticsPrompts",
				short: "statisticsShortPrompts"
			},
			{
				key: "tokens",
				label: "statisticsTokens",
				short: "statisticsShortTokens"
			}
		], [{
			key: "completedTasks",
			label: "statisticsTasks",
			short: "statisticsShortTasks"
		}, {
			key: "completedPoints",
			label: "statisticsPoints",
			short: "statisticsShortPoints"
		}]];
		const METRICS = GROUPS.flat();
		/** Drawn in every heat cell; every other metric appears while its card is hovered. */
		const ALWAYS_SHOWN = ["prompts", "tokens"];
		const periodKeys = {
			day: "statisticsDay",
			month: "statisticsMonth",
			year: "statisticsYear"
		};
		/** Period switch order; the id base also names its tabs and the panel they own. */
		const PERIODS = [
			"day",
			"month",
			"year"
		];
		const PERIOD_ID = "statistics-period";
		/** Delay before a period or date change reloads, so typing a year runs once. */
		const RELOAD_DEBOUNCE_MS = 200;
		/** How long the pointer must rest on a cell before its hover card opens. */
		const TIP_SHOW_DELAY_MS = 400;
		const exactCount = new Intl.NumberFormat();
		function aborted(error) {
			return error instanceof Error && error.name === "AbortError";
		}
		function metricText(key, value) {
			const safe = Number.isFinite(value) ? value : 0;
			return key === "tokens" ? compactNumber(safe) : exactCount.format(safe);
		}
		/** Calendar anchor of a period value, so a step keeps the same day or month. */
		function anchorOf(value) {
			return /^\d{4}/.test(value) ? /* @__PURE__ */ new Date(`${value.slice(0, 4)}-${value.slice(5, 7) || "01"}-${value.slice(8, 10) || "01"}T00:00:00`) : /* @__PURE__ */ new Date();
		}
		/** The same anchor stepped one period forward or back. */
		function stepAnchor(value, period, direction) {
			const anchor = anchorOf(value);
			if (period === "day") anchor.setDate(anchor.getDate() + direction);
			else if (period === "month") anchor.setMonth(anchor.getMonth() + direction);
			else anchor.setFullYear(anchor.getFullYear() + direction);
			return anchor;
		}
		function StatisticsCalendar({ calculate, close, t }) {
			const [period, setPeriod] = (0, react.useState)("day");
			const [value, setValue] = (0, react.useState)(() => periodValue("day"));
			const [result, setResult] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [progress, setProgress] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [tip, setTip] = (0, react.useState)(null);
			const generation = (0, react.useRef)(0);
			const control = (0, react.useRef)(null);
			const heading = (0, react.useRef)(null);
			const tipTimer = (0, react.useRef)(null);
			const tipOpen = (0, react.useRef)(false);
			const tipCell = (0, react.useRef)(null);
			const run = async (refresh) => {
				let request;
				try {
					request = periodRequest(period, value);
				} catch {
					return;
				}
				control.current?.abort();
				const active = new AbortController();
				control.current = active;
				const current = ++generation.current;
				setBusy(true);
				setError("");
				setProgress(null);
				setTip(null);
				try {
					const snapshot = await calculate(request, {
						refresh,
						signal: active.signal,
						onProgress: (next) => {
							if (generation.current === current) setProgress(next);
						}
					});
					if (generation.current === current) setResult({
						period,
						snapshot
					});
				} catch (failure) {
					if (generation.current === current) setError(aborted(failure) ? t("statisticsCancelled") : failure instanceof Error ? failure.message : String(failure));
				} finally {
					if (control.current === active) control.current = null;
					if (generation.current === current) setBusy(false);
				}
			};
			(0, react.useEffect)(() => {
				heading.current?.focus();
				return () => {
					generation.current++;
					control.current?.abort();
					cancelTipTimer();
				};
			}, []);
			(0, react.useEffect)(() => {
				const timer = setTimeout(() => {
					run(false);
				}, RELOAD_DEBOUNCE_MS);
				return () => clearTimeout(timer);
			}, [period, value]);
			const valid = (() => {
				try {
					periodRequest(period, value);
					return true;
				} catch {
					return false;
				}
			})();
			const canStepForward = valid && stepAnchor(value, period, 1).getTime() <= Date.now();
			const stepLabel = (direction) => t(direction < 0 ? "statisticsPrev" : "statisticsNext").replace("{unit}", t(period === "month" ? "statisticsUnitMonth" : periodKeys[period]));
			const step = (direction) => {
				if (direction > 0 && !canStepForward) return;
				setValue(periodValue(period, stepAnchor(value, period, direction)));
				closeTip();
			};
			const view = result?.period ?? period;
			const snapshot = result?.snapshot ?? null;
			const cells = snapshot ? calendarCells(snapshot, view, (day) => t("statisticsDayOfMonth").replace("{day}", String(day))) : [];
			const weeks = snapshot && view === "month" ? calendarWeeks(snapshot) : 5;
			const shown = new Set(ALWAYS_SHOWN);
			const columns = view === "day" ? 6 : view === "month" ? 7 : 6;
			const weekdays = t("statisticsWeekdays").split(",");
			const progressText = busy ? `${t("statisticsCalculating")}${progress && progress.total > 0 ? ` · ${t("statisticsProgress").replace("{processed}", exactCount.format(progress.processed)).replace("{total}", exactCount.format(progress.total))}` : ""}` : "";
			const placeTip = (cell, target) => {
				const rect = target.getBoundingClientRect();
				tipCell.current = cell.start;
				tipOpen.current = true;
				setTip({
					cell,
					x: rect.left + rect.width / 2,
					top: rect.top,
					bottom: rect.bottom,
					below: rect.top < 200
				});
			};
			const cancelTipTimer = () => {
				if (tipTimer.current === null) return;
				window.clearTimeout(tipTimer.current);
				tipTimer.current = null;
			};
			const closeTip = () => {
				cancelTipTimer();
				tipCell.current = null;
				if (!tipOpen.current) return;
				tipOpen.current = false;
				setTip(null);
			};
			const scheduleTip = (cell, target) => {
				cancelTipTimer();
				if (tipOpen.current) {
					placeTip(cell, target);
					return;
				}
				tipTimer.current = window.setTimeout(() => {
					tipTimer.current = null;
					if (target.isConnected) placeTip(cell, target);
				}, TIP_SHOW_DELAY_MS);
			};
			const hoverCell = (event) => {
				const target = event.target.closest("[data-cell]");
				if (target === null) return;
				const cell = cells[Number(target.dataset.index)];
				if (!cell) return;
				if (tipOpen.current && tipCell.current === cell.start) return;
				scheduleTip(cell, target);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: StatisticsCalendar_module_css_default.view,
				"aria-labelledby": "task-statistics-title",
				"aria-busy": busy,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: StatisticsCalendar_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							id: "task-statistics-title",
							className: StatisticsCalendar_module_css_default.title,
							ref: heading,
							tabIndex: -1,
							children: t("statisticsTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: close,
							children: t("statisticsClose")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StatisticsCalendar_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedControl, {
								id: PERIOD_ID,
								value: period,
								label: t("statisticsPeriod"),
								className: StatisticsCalendar_module_css_default.periods,
								disabled: busy,
								options: PERIODS.map((item) => ({
									value: item,
									label: t(periodKeys[item])
								})),
								onChange: (next) => {
									setPeriod(next);
									setValue(periodValue(next, anchorOf(value)));
									closeTip();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StatisticsCalendar_module_css_default.stepper,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										size: "sm",
										"aria-label": stepLabel(-1),
										disabled: busy || !valid,
										onClick: () => step(-1),
										children: "←"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: period === "day" ? "date" : period === "month" ? "month" : "number",
										"aria-label": t("statisticsDate"),
										value,
										min: period === "day" ? "1970-01-01" : period === "month" ? "1970-01" : "1970",
										max: period === "day" ? "9998-12-31" : period === "month" ? "9998-12" : "9998",
										disabled: busy,
										onChange: (event) => {
											setValue(event.target.value);
											closeTip();
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										size: "sm",
										"aria-label": stepLabel(1),
										disabled: busy || !canStepForward,
										onClick: () => step(1),
										children: "→"
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								disabled: busy || !valid,
								onClick: () => void run(true),
								children: t("statisticsRefresh")
							}),
							busy && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								onClick: () => control.current?.abort(),
								children: t("statisticsCancel")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StatisticsCalendar_module_css_default.progress,
								role: "status",
								children: progressText
							})
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: StatisticsCalendar_module_css_default.error,
						role: "alert",
						children: [
							t("error"),
							": ",
							error
						]
					}),
					snapshot && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: StatisticsCalendar_module_css_default.totals,
							role: "group",
							"aria-label": t("statisticsMetric"),
							children: METRICS.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StatisticsCalendar_module_css_default.total,
								"data-metric": item.key,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StatisticsCalendar_module_css_default.totalLabel,
									children: t(item.label)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StatisticsCalendar_module_css_default.totalValue,
									children: metricText(item.key, snapshot.totals[item.key])
								})]
							}, item.key))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StatisticsCalendar_module_css_default.calendar,
							role: "tabpanel",
							id: `${PERIOD_ID}-${period}-panel`,
							"aria-labelledby": `${PERIOD_ID}-${period}`,
							children: [view === "month" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: StatisticsCalendar_module_css_default.weekdays,
								"aria-hidden": "true",
								children: weekdays.map((day) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"data-weekday": true,
									children: day
								}, day))
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: StatisticsCalendar_module_css_default.grid,
								"data-period": view,
								"data-columns": columns,
								"data-weeks": view === "month" ? weeks : void 0,
								role: "group",
								"aria-label": t("statisticsDay"),
								onMouseOver: hoverCell,
								onMouseLeave: closeTip,
								children: cells.map((cell, index) => {
									if (!cell) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: StatisticsCalendar_module_css_default.blank,
										"data-blank": true,
										"aria-hidden": "true"
									}, `blank-${index}`);
									const summary = GROUPS.map((group) => group.filter((item) => shown.has(item.key)).map((item) => `${t(item.short)}: ${metricText(item.key, cell[item.key])}`).join(" · ")).filter(Boolean).join(" · ");
									const label = `${t("statisticsTitle")} ${cell.label} · ${cell.excluded ? t("statisticsExcluded") : summary}`;
									const level = cell.excluded ? void 0 : heatLevel(cell.tokens, view);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: StatisticsCalendar_module_css_default.cell,
										tabIndex: 0,
										"data-cell": true,
										"data-index": index,
										"data-level": level,
										"data-excluded": cell.excluded || void 0,
										"aria-label": label,
										onFocus: (event) => placeTip(cell, event.currentTarget),
										onBlur: closeTip,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: StatisticsCalendar_module_css_default.cellHead,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: cell.label })
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: StatisticsCalendar_module_css_default.cellBody,
											children: GROUPS.map((group, groupIndex) => {
												const metrics = group.filter((item) => shown.has(item.key));
												if (metrics.length === 0) return null;
												return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: StatisticsCalendar_module_css_default.group,
													children: metrics.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: StatisticsCalendar_module_css_default.stat,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", {
															className: StatisticsCalendar_module_css_default.statLabel,
															children: t(item.short)
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
															className: StatisticsCalendar_module_css_default.statValue,
															children: cell.excluded ? "—" : metricText(item.key, cell[item.key])
														})]
													}, item.key))
												}, groupIndex);
											})
										})]
									}, cell.start);
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StatisticsCalendar_module_css_default.legend,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statisticsLess") }),
								[
									0,
									1,
									2,
									3,
									4
								].map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StatisticsCalendar_module_css_default.swatch,
									"data-level": level
								}, level)),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statisticsMore") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StatisticsCalendar_module_css_default.swatch,
									"data-excluded": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statisticsExcluded") })
							]
						})
					] }),
					tip && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StatisticsCalendar_module_css_default.tip,
						role: "tooltip",
						style: {
							top: tip.below ? tip.bottom : tip.top,
							left: tip.x,
							transform: `translate(-50%, ${tip.below ? "8px" : "calc(-100% - 8px)"})`
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StatisticsCalendar_module_css_default.tipHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: tip.cell.label }), tip.cell.excluded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("statisticsExcluded") })]
						}), GROUPS.map((group, groupIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: StatisticsCalendar_module_css_default.tipGroup,
							children: group.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", {
								className: StatisticsCalendar_module_css_default.tipLabel,
								children: t(item.label)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
								className: StatisticsCalendar_module_css_default.tipValue,
								children: tip.cell.excluded ? "—" : metricText(item.key, tip.cell[item.key])
							})] }, item.key))
						}, groupIndex))]
					})
				]
			});
		}
		//#endregion
		exports.StatisticsCalendar = StatisticsCalendar;
		return module.exports;
	}
});
