# 任务关系 / 审批中 / 拓扑画布 — 共享设计契约（本文件是分工依据）

目标：`dsh-task-list` 插件新增三项能力。

1. **父子关系、依赖关系**：任务可有父任务，可「等待」其他任务完成。
2. **新增状态「审批中」**（`approving`）。
3. **展示方式**：列表之外的画布视图——拓扑图（父子/依赖边）+ 卡片；简洁状态总览；显示任务由哪个会话 / 哪个机器人（Agent preset）处理。

## 已完成的前置（Lead 已落地，勿重复修改）

`src/types.ts` 已扩写，**唯一接口事实来源**，包含：

- `TaskStatus = 'todo' | 'in_progress' | 'approving' | 'done'`
- `TASK_STATUSES`（四个，全量顺序）、`RULE_STATUSES`（三个，仅同步映射用；`approving` 不参与远端映射）
- `TaskRecord.parentId: string | null`、`TaskRecord.blockingIds: string[]`
- `TaskRelation`、`TaskGraphNode`、`TaskGraph`、`TaskGraphRequest`、`MAX_GRAPH_NODES = 400`
- `TaskOverview { counts: Record<TaskStatus, number>; total; blocked; sessionIds: string[] }`
- `CreateTaskRequest` / `UpdateTaskRequest` 增加 `parentId?`、`blockingIds?`
- `GetTaskGraphRequest { rootId?, includeDescendants?, includeAncestors?, includeBlockers?, maxNodes? }`

## 语义约定（两端必须一致）

- `parentId`：分解树上的父任务；一个任务最多一个父任务。删除父任务时子任务 `parent_id` 置 NULL（不级联删除）。
- `blockingIds`：**本任务等待的任务**。语义是「这些任务 `done` 之后本任务才不被阻塞」。方向在 UI 上一律画成 `等待者 → 被等待者`。
- 派生阻塞：`blocked = status !== 'done' && blockingIds.some(id => 该任务不存在或 status !== 'done')`。
- 环禁止：父链不得成环；`blockingIds` 闭包不得包含自身（直接或间接）。违反时抛错，错误文案：父关系 `task hierarchy would contain a cycle`，依赖 `task dependency would contain a cycle`。
- 自引用（`parentId === id`、`blockingIds` 含自身）同样拒绝。
- 同步：`RULE_STATUSES` 仍是三个；`approving` 的任务不参与远端状态回写（推送时跳过状态、不报错）。
- 已有测试里 `{ todo, in_progress, done }` 形态的 `statusWriteStates` 必须继续有效。

## 文件归属（严格，避免并发写冲突）

### A：host-data（数据层）

- `src/store.ts`、`src/task-service.ts`、`src/remote.ts`、`src/sync/mapping.ts`
- `tests/store.spec.ts`、`tests/remote-contract.spec.ts`
- 新增：`tests/task-graph.spec.ts`（数据层回归）

### B：canvas-view（视图层，只新建文件）

- 新增：`src/client/TaskCanvas.tsx`、`src/client/TaskCanvas.module.css`
- 新增：`src/client/TaskBoard.tsx`、`src/client/TaskBoard.module.css`
- 新增：`src/client/task-graph-layout.ts`（纯函数布局）、`src/client/task-graph-layout.spec.ts`
- 新增：`tests/task-canvas.spec.tsx`、`tests/task-board.spec.tsx`

### C：panel-integration（Lead 自己）

- `src/client/TaskPanel.tsx`、`src/client/TaskPanel.module.css`、`src/client/locales.ts`
- `src/client/index.tsx`（face 桥接：`taskGraph`、`taskOverview` 远程调用）
- `tests/panel-layout.spec.ts`、`tests/task-pagination.spec.tsx`、新增 `tests/task-views.spec.tsx`

改动别的归属文件前先告知 Lead。`tests/browser-fixture.tsx` 由 Lead 负责补齐新字段。

## B 的组件接口（Lead 按此接线，签名不得改）

`src/client/TaskCanvas.tsx`：

```tsx
import type { TaskGraph, TaskGraphNode, TaskRecord, TaskStatus } from '../types.ts'
import type { TaskKey } from './locales.ts'

/** 会话/机器人信息，用于「谁在处理这个任务」。 */
export interface TaskExecutionInfo {
  title: string
  /** Agent preset id（机器人）。 */
  agent: string | null
  running: boolean
  archived: boolean
}

export interface TaskCanvasProps {
  graph: TaskGraph
  t: (key: TaskKey) => string
  /** 双击卡片 / 点「编辑」：打开该任务。 */
  onOpen(task: TaskRecord): void
  /** 点击会话徽标：打开该会话。 */
  onOpenSession?(sessionId: string): void
  /** 会话 id → 执行信息；缺省表示会话已不可用。 */
  executionOf?(sessionId: string): TaskExecutionInfo | undefined
  /** 顶部状态过滤；空集合表示不过滤。 */
  statusFilter?: readonly TaskStatus[]
  /** 画布为空（无节点）时展示空态。 */
  empty?: boolean
}

export function TaskCanvas(props: TaskCanvasProps): JSX.Element
```

要求：

- 纯 SVG + HTML 卡片（`<foreignObject>` 或绝对定位 div 层 + SVG 边层），**不引入任何图形库**（包内只有 lexical / parse5，禁止新增依赖）。
- 边：父子边（实线）、等待边（虚线，箭头指向被等待任务）。被阻塞的任务节点标记阻塞态。
- 卡片内容：状态芯片、标题（截断）、优先级、工作区、会话/机器人徽标、被阻塞提示。点击卡片标题打开任务。
- 交互：滚轮缩放、拖拽平移、「适应窗口」按钮、`+/-/重置` 键盘可达按钮；默认缩放 1，范围 0.4–2。
- 布局用 `task-graph-layout.ts` 的纯函数：按父链分层（根在左），层间距固定，同层按依赖顺序排列，同一父节点的子任务相邻；返回 `{ nodes: [{ id, x, y, width, height }], width, height }`。纯函数、可测试、无 DOM。
- 无障碍：卡片是 `button`/可聚焦元素；缩放平移按钮是原生 `button`；`prefers-reduced-motion` 关闭过渡。
- 所有可见文案取 `t()`，不得硬编码中文/英文；`aria-label` 同样。
- 样式按仓库「插件 UI 规范」：颜色只用 `--dsw-alias-*`，圆角用 `--dsw-radius-*`，字号行高成对，动效 150–200ms 且带 `prefers-reduced-motion` 关闭；不写浅/深色选择器。

`src/client/TaskBoard.tsx`：

```tsx
export interface TaskBoardProps {
  graph: TaskGraph
  overview: TaskOverview
  t: (key: TaskKey) => string
  onOpen(task: TaskRecord): void
  onOpenSession?(sessionId: string): void
  executionOf?(sessionId: string): TaskExecutionInfo | undefined
}

export function TaskBoard(props: TaskBoardProps): JSX.Element
```

要求：

- 顶部：各状态计数（`overview.counts`）、阻塞数、关联会话数；点击计数可切换状态过滤（可选，实现即可）。
- 主体：简洁的状态卡片列表（每状态一列或每状态一组），卡片显示状态、标题、父子/依赖摘要、执行会话 + 机器人。
- 执行区：按会话聚合「正在处理哪些任务」，显示会话标题、机器人 preset、`running` 徽标，点击打开会话。
- 同上的样式、i18n、无障碍要求。

## 需要新增的 locales key（Lead 负责写进 `src/client/locales.ts`）

B 只能使用这些 key，缺 key 会编译失败 —— 先按下面名单写代码，Lead 会在同一轮补齐：

`approving`（审批中）、`viewList`、`viewCanvas`、`viewBoard`、`viewLabel`、`canvasTitle`、`canvasFit`、`canvasZoomIn`、`canvasZoomOut`、`canvasReset`、`canvasEmpty`、`canvasEmptyHint`、`canvasTruncated`、`blockedLabel`、`blockedBy`、`blocks`、`parentTask`、`childTasks`、`noParent`、`dependencies`、`dependenciesHint`、`addDependency`、`removeDependency`、`dependencyDone`、`dependencyPending`、`overviewTitle`、`overviewRunning`、`overviewSessions`、`overviewBlocked`、`executionTitle`、`executionAgent`、`executionNoAgent`、`executionRunning`、`executionIdle`、`executionNone`、`openTask`、`openSessionAction`、`approveTask`、`rejectTask`、`approvingHint`

## 验收

- `npm run typecheck`、`npm test`、`npm run build` 全绿（Lead 最终统一跑）。
- A：迁移旧库（user_version 14 → 15）不丢数据；环拒绝；`blockingIds` 往返；`graph()` 的截断与三种 scope；`overview()` 计数正确。
- B：布局纯函数单测（分层、同父相邻、无重叠）；组件渲染测试覆盖状态芯片、阻塞标记、会话/机器人徽标、空态、缩放按钮。
- C：列表/画布/卡片切换；筛选含「审批中」；composer 能设父任务与依赖并保存；画布数据经 RPC 拉取。

## 证据要求

只报实际跑过的命令与结果。UI 无法在真实宿主点开验证时，明确写「未实测」，不得把 CSS/单测当成真实点击证据。
