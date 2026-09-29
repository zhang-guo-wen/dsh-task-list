# dsh-task-list

Independent DeepSeek Harness plugin. Host source is in `src/`, browser source in `src/client/`, and installable output in `lib/`. Rebuild `lib/` after source changes. Keep the task database separate from Harness-owned files; use only DSH services for UI and RPC integration. Put all visible copy in `src/client/locales.ts`. Run `npm run typecheck`, `npm test`, and `npm run build` after behavior changes.
