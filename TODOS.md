# Deferred work from project-management sync review

These items are not implementation authorization. Added by /autoplan on 2026-10-07 at HEAD 4083365. The sync feature is implemented; these separately scoped follow-ups remain deferred.

## P2: Linked-task lifecycle and scale
- What: Evaluate explicit retirement/unlink behavior only after measuring accumulated linked inventory and request duration.
- Why: Discovery filters intentionally do not remove existing links. Completed/out-of-filter items can increase every manual run's request count.
- Pros: Better long-term scope control and predictable run time.
- Cons: Changes the user's continuous-linked-sync semantics and requires new UX/data lifecycle rules; must obtain separate approval.
- Context: Current proposal fetches each enabled rule's linked items by ID. Do not implement implicit completed-task retirement. Begin with real and simulated 1k/10k volume/request measurements.
- Effort: human 1–3 days / AI 3–6 hours after requirements; estimate only.
- Depends on: Approved sync implementation, live usage measurements, explicit user direction.

## P3: Shareable redacted diagnostics
- What: Consider export of run/phase/error codes without secrets or task contents.
- Why: Local results and logs help the owner, but sharing raw logs can leak credentials or descriptions.
- Pros: Faster support reproduction and safer issue reports.
- Cons: New file/export/privacy surface; no export endpoint in this feature.
- Context: Sync specification requires safe structured results and retained unknown write evidence. Never export intents, environment values, raw payloads, or task descriptions by default.
- Effort: human 1 day / AI 2 hours; estimate only.
- Depends on: Stable error taxonomy, retention policy and privacy review.

## P2: Existing task dialog focus regression
- What: Verify and address Tab escape in the pre-existing editor while using native host focus handling for new sync settings.
- Why: Same-day QA reported focus leaving the modal.
- Pros: Predictable keyboard operation and accessible composition.
- Cons: Existing dialog migration can affect save/start/complete interaction; guard with real keyboard tests.
- Context: Existing TaskPanel uses a custom dialog; this is an observed prior QA report, not reverified in this review. New sync settings must not duplicate this behavior. A general editor replacement is not automatic scope.
- Effort: human 0.5–1 day / AI 1–3 hours.
- Depends on: Actual host Dialog API inspection and explicit scope approval if replacing existing editor.

## Approved scope: Existing narrow task rows
- What: At 390/430px place status/actions in a secondary row, preserving desktop width and layout. Accepted at the final specification gate on 2026-10-07; carry into the detailed implementation plan.
- Why: Prior QA reported fixed status/action columns compressing the content to 56/96px.
- Pros: Long external titles and source information remain readable.
- Cons: Changes old responsive behavior; approved explicitly as Taste 24, not silently included.
- Context: New source must be a secondary content line, not a new fixed column. Taste 24 is accepted; include it in the detailed implementation plan and retain regression tests.
- Effort: human 0.5 day / AI 1–2 hours.
- Depends on: Detailed implementation plan approval and browser test at 390/430px plus 960px desktop.

## P2: Existing direct-delete safety
- What: Separately decide confirmation or undo for the existing row delete action.
- Why: Prior QA reported immediate removal without confirmation or undo.
- Pros: Reduces accidental local data loss.
- Cons: New user-facing interaction; not part of the confirmed one-button sync contract.
- Context: Sync deletion-in-flight recovery must be handled now at storage level regardless of whether this UX TODO is accepted. No remote delete propagation. Do not add per-sync-item confirmation under this TODO.
- Effort: human 0.5–1 day / AI 1–2 hours.
- Depends on: Separate user UX decision and real delete interaction tests.

## P3: Flaky subtask ordering test (recorded 2026-10-08, unrelated to any current change)

- What: Make subtask order deterministic when two rows are created inside the same millisecond.
- Why: `tests/store.spec.ts > subtasks > stores rows per task and returns them with the task` fails intermittently. Measured on 2026-10-08: 52/300 (17.3%) consecutive `createSubtask` calls share one `created_at`, and of those, 24 returned in the wrong order — an overall flake rate near 8%, matching the observed one-in-a-dozen failures.
- Pros: Removes a random CI and local test failure; subtasks then always come back in insertion order, which is what the UI and the test already assume.
- Cons: Changes the tie-break of a user-visible list order; a locked rowid is not portable if the table were ever rebuilt by a migration.
- Context: `selectSubtask` orders with `ORDER BY created_at, id`, and `id` is a random UUID, so a millisecond tie is resolved randomly. `ORDER BY created_at, rowid` preserves insertion order because `subtasks.id` is a TEXT primary key and the table still carries an implicit monotonic rowid. This is pre-existing behavior, not introduced by the statistics work; it was only surfaced while running the suite repeatedly.
- Effort: human 0.5 hour / AI 10 minutes including a repeated-run check; estimate only.
- Depends on: Explicit approval, because it changes list ordering semantics outside the statistics scope. Declined on 2026-10-08 to keep the statistics change narrowly scoped.
