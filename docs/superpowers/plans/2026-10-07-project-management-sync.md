# 云效 / TAPD Project Management Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有任务列表中用一个手动「同步」按钮对接云效和 TAPD，可靠导入任务并按已批准的任务级冲突规则回写。

**Architecture:** 两个平台适配器只处理官方 API 和字段能力，共用纯规划器判断五种同步分支。同步执行器复用现有 SQLite，以写前意图、数据库级运行所有权、回读语义验证和原子 CAS 提交保护远端及本地数据；UI 只接收安全 DTO，不持有凭据。

**Tech Stack:** TypeScript ESM、Node.js `^22.19.0 || >=24.0.0`、node:sqlite、fetch/AbortController、Vitest 3、React 18、Cordis/Typert RPC、DSH UI primitives、tsdown/rolldown。

**Spec:** [已批准设计及后续审查](../specs/2026-10-07-project-management-sync-design.md)。实施以该文件前 10 节及最终批准记录为规范，历史审查中“待批准”的表述已由 Final approval record 解决。

## Global Constraints

- 首期同时支持云效 Projex 公有云和 TAPD 公有云；不增加自动同步、Webhook、独立服务器、模型同步工具或第二个上传/拉取按钮。
- 两端只有一端业务变化时取变化端；两端都变化时非状态取远端、整个状态字段取本地。任务级判断，不改成逐字段合并策略。
- 筛选仅发现新任务；已关联项即使不符合筛选仍按 ID 同步。停用才停止该规则范围。
- 独立任务不发布远端，不传播删除；未确认写入永久保留必要证据。
- 复用现有任务数据库，不访问 Harness 自有会话日志/索引；保留本地工作区、Agent、会话、立即发送、Worktree、子任务与本地时间语义。
- 凭据只引用宿主环境变量，不进 SQLite、浏览器或日志；连接/规则默认停用，保存和查询不执行同步。
- 请求默认30秒，读最多3次尝试（含首次），等待≤60秒，运行预算30分钟，响应≤2MiB；结果页默认20上限100；关联扫描100条；清理≤1000行/事务。
- 完成历史保留最近30天且最多100次；基准/关联身份/未确认意图不按年龄清理。
- 页面 `max-width:960px; margin:0 auto; padding:0 clamp(24px,4vw,48px) 48px`；颜色用 `--dsw-alias-*`。≤430px原行状态/动作移次行，桌面不变；≤560px映射组纵向排列。
- 两空格、单引号、无分号、type-only imports；UI 文案统一 `src/client/locales.ts`。
- 复用0.5.0的Lexical编辑器、TaskContent、persistRichTask与附件发送流程；description以结构化content比较，notes不能作为真源。附件节点和字节始终本地保留，不上传远端、不参与业务判变；远端内容替换不能删除本地附件。
- 不引入 ORM、队列或策略框架；宿主新增parse5（锁定版本）只用于惰性解析不可信HTML为TaskContent，不执行脚本、不拉取外部资源、不用正则净化。Markdown首期按保留原源码的code块表示而非猜测转换；HTML无法无损往返的编辑报错，不静默丢结构。
- 不改包版本、不自动提交/推送/tag/npm。任务末尾 commit checkpoint 只有满足北京时间18:00后及适用确认规则时执行；未获许可只保留已验证 diff。GitHub推送窗口19:00–23:59不构成推送许可。
- 平台测试须为用户授权测试项目；fixture 通过不等于真实平台联调或实际 GUI 验收。

## Review Focus

1. 公有云API响应HTTP200但业务失败、空字段与缺字段不同：不能当零任务或清空可写字段（Tasks 1/4/5/6）。
2. 远端已写成功后崩溃、本地又改或删：恢复不能重放工作流、吞新修改或改替代任务（Tasks 2/7/8）。
3. 映射/可选字段启停改变比较范围：配置变化不应触发批量错误回写（Task 3）。
4. 极大字符串ID、跨页重复、不前进cursor及筛选外关联：不能舍入身份或静默漏任务（Tasks 1/5/6/8）。
5. 页面刷新、Host/client混版、元数据迟到与键盘焦点：查询不能发新同步，旧方法缺失不能白屏（Tasks 9/10/11）。

---

## Execution context and evidence gates

当前插件基线 HEAD `2f525cc4a6320e0ae6cd3ff7049d8245e9efe87c`（0.5.0，已fetch并快进origin/main）。计划已根据该基线重审，等待用户批准后执行。任务主数据是TaskContent，notes仅搜索投影；数据库schema5含task_attachments，create/update经writeContent自行BEGIN IMMEDIATE，不能直接嵌套旧同步事务。本会话目录是父仓库 worktree，插件本身是独立 Git 仓库；执行前用 using-git-worktrees 核对隔离范围，不能误以父仓库隔离了嵌套插件。最新规格及 TODOS 是其他审查留下的未跟踪文件，必须带入执行上下文，不覆盖、不删除、不承诺提交。

计划阶段只读核对到：

- 原 checkout 的 `node_modules/@deepseek-ai/dsh-client-ui-primitives` 0.2.0-rc.1 有真实公开 `Modal/Button/Input/Checkbox/Menu`，Modal 支持 `data-modal-autofocus`，内部 `useModalLayer` 处理 Tab/Escape/返回焦点；Button 官方 md=36px/sm=28px，不自行改变全局控件密度。
- `C:/nvm4w/nodejs/node_modules/@deepseek-ai/dsh/node_modules` 的 Gateway 使用 Client Connection 的 `/api` 拦截；Client Connection 先 Host/Origin 检查、再 browserAuth，返回401/403，允许者为 operator。没有新增细粒度租户隔离。必须在目标19387的实际Host验证同一合同，不能把全局CLI源码等同桌面进程。
- Typert `RemoteError` 支持 owner 声明的稳定 code 和 details；浏览器可以保留 error.code/details，不应沿用旧 unwrap 只抛 message。
- 当前工作副本无 node_modules；执行阶段在正确隔离插件目录运行 npm ci，不直接借其他checkout依赖修改。
- Electron app.asar不是普通目录；不要因指定虚拟路径不可 glob/read 就安装或重写宿主。只用宿主公开包合同；确需核查桌面产物时按实际ASAR工具只读读取。

能力证据见同目录 `2026-10-07-project-management-sync-capabilities.md`。未证字段/类型不猜支持；适配器只读 fixture/用户授权只读实测补齐后才能启用相应能力。两个平台仍一起实现，缺实际凭据时在交付报告标明未联调。

## File map

- `src/sync/types.ts`：内部业务、快照、映射、适配器/执行合同。
- `src/sync/dto.ts`, `validation.ts`, `errors.ts`：安全RPC DTO、closed runtime schemas、错误及docKey。
- `src/sync/schema.ts`, `config-store.ts`, `link-store.ts`, `run-store.ts`：schema6迁移、配置、关联/基准/意图、所有权/运行结果；共用TaskStore.db，不新开业务数据库。
- `src/sqlite-transaction.ts`：同步callback短事务与嵌套SAVEPOINT，复用到现有TaskStore.writeContent与同步落地，不跨await。
- `src/sync/snapshot.ts`, `planner.ts`, `mapping.ts`, `description-codec.ts`：presence/无损格式、五分支、配置修订兼容、远端描述与TaskContent转换；保留本地附件。
- `src/sync/transport.ts`, `credentials.ts`：有界HTTPS、读重试、密钥解析/脱敏。
- `src/sync/adapters/yunxiao.ts`, `yunxiao-codec.ts`, `tapd.ts`, `tapd-codec.ts`：每平台请求与类型字段编码。
- `src/sync/reconcile.ts`, `execute-item.ts`, `executor.ts`：待确认对账、单项状态机、批次生命周期。
- `src/sync/service.ts`：一个非Cordis额外服务的协调对象，由现有TaskService方法委托。
- `src/client/sync/face.ts`, `use-sync-run.ts`, `SyncControls.tsx`, `SyncResults.tsx`, `SyncSettings.tsx`, `RuleFields.tsx`, `Sync.module.css`：浏览器合同、查询生命周期、控件、结果、设置与映射。
- `src/client/task-content.ts`：独立外部标题、保存及启动文本规则。
- 修改 `src/store.ts`, `types.ts`, `task-service.ts`, `remote.ts`, `index.ts`, `client/index.tsx`, `client/TaskPanel.tsx`, `client/TaskPanel.module.css`, `client/locales.ts`，仅接线与必要外部标题/窄屏分支。
- `tests/fixtures/sync.ts`（构造器）、`tests/fixtures/sync-api/*.json`（有来源的脱敏契约数据）、各Task命名测试；普通CI无联网。
- `docs/sync-capabilities.md`, `docs/sync-maintenance.md`, 两README、package/lock、tracked lib：实现同期更新。

## Shared interfaces (Task 1 produces)

```ts
// src/sync/types.ts
export type SyncField = 'title' | 'description' | 'status' | 'priority' | 'tags' | 'storyPoints'
export type SyncFields = Pick<TaskRecord, 'title' | 'status' | 'priority' | 'tags' | 'storyPoints'>
  & { description: TaskContent } // 无attachment节点，规范化结构而不是notes
export type SyncPatch = Partial<SyncFields>
export type RemoteKey = { instance: string; projectId: string; typeId: string; id: string }
export type FieldValue<T> = { presence: 'value'; value: T; writable: boolean }
  | { presence: 'null'; writable: boolean }
  | { presence: 'absent' | 'unsupported'; writable: false }
export type RemoteItem = {
  key: RemoteKey; number: string; url: string | null; updatedToken: string
  fields: { [K in SyncField]: FieldValue<SyncFields[K]> }
  rawStatus: string; description: { format: 'text' | 'markdown' | 'richtext'; raw: FieldValue<string>; roundTrip: boolean }
  revisionToken: string | null
}
export type SyncProjection = { fields: SyncField[]; mappingRevision: number; normalizationVersion: 1 }
export type SyncBaseline = {
  local: SyncFields; remote: SyncFields; localVersion: number; localUpdatedAt: number
  remoteUpdatedToken: string; rawStatus: string; projection: SyncProjection
  remotePresence: { [K in SyncField]: FieldValue<SyncFields[K]>['presence'] }
  remoteDescription: RemoteItem['description']
}
export type SyncPlan = {
  kind: 'import' | 'unchanged' | 'pull' | 'push' | 'merge'
  localPatch: SyncPatch; remotePatch: SyncPatch; selectedFields: SyncField[]
}
export interface SyncAdapter {
  metadata(scope: MetadataScope, signal: AbortSignal): Promise<SyncMetadata>
  discover(rule: SyncRule, signal: AbortSignal): AsyncIterable<RemoteItem[]>
  read(key: RemoteKey, signal: AbortSignal): Promise<RemoteItem>
  write(key: RemoteKey, patch: SyncPatch, observed: RemoteItem,
    rule: SyncRule, signal: AbortSignal): Promise<void>
  evidence(intent: WriteIntent, observed: RemoteItem, signal: AbortSignal): Promise<WriteEvidence>
}
export type WriteEvidence = 'applied' | 'not_applied_proven' | 'unknown'
export type RunFence = { runId: string; ownerId: string; generation: number }
```

`SyncFields`是规范业务值，不代表所有字段启用；selectedFields只包含必需和用户明确启用且可往返的字段。description是validateContent后的结构化非附件块；规范化marks排序、合并相邻同样式inline，不trim正文或忽略表格/链接。RemoteItem的原始描述、presence、format留宿主；SyncBaseline另保存remoteDescription原格式及presence、转换能力修订，不能只存安全展示副本。富文本仅格式修改也构成业务变化；只增删本地附件不构成远端description变化，文件名也不参加比较。description未改时绝不重新编码写出，未证无损能力时拒绝其本地编辑回写，但仍可同步状态等其他字段。

DTO锁定：`SafeConnection`为平台鉴别union：共有id/name/enabled/revision/credentialPresent/instance；yunxiao包含mode=center|region、organizationId、regionHost、tokenEnv；tapd包含companyId/userEnv/passwordEnv（companyId用于官方项目列表，组织身份不依赖变量名）。`SyncRule`共有id/revision/connectionId/projectId/enabled/workspaceId、filters `{assignees:string[], typeIds:string[], iterationIds:string[], statusIds:string[]}`、每类型`TypeMapping`。映射包含readStates `Record<string,TaskStatus>`、writeStates `Record<TaskStatus,string>`、optionalFields和远端字段ID/值映射；没有任意payload模板。

DTO字段长度：配置名1–100、平台ID1–200、变量名1–128且`^[A-Za-z_][A-Za-z0-9_]*$`、URL最长2048；filters各最多100个，types最多100，state候选映射最多500；Task字段复用原200 UTF16标题/20000描述/12标签×40/0–1000整数故事点约束，不改旧值语义。

`SyncErrorDto`包含code（错误注册表名）、scope `config|connection|rule|item|run|query`、field可选、problem、cause（可标possible）、action、docKey、retryable、runId/requestId可选；不含stack/header/body/凭据。注册`task-list/sync` RemoteError details=`SyncErrorDto`，code在details内区分业务原因；`SyncMetadata`含带id/label候选与逐类型读/写/格式/分页/工作流能力及只读权限声明。`MetadataScope={connectionId:string;projectId?:string;typeId?:string}`；候选`Option={id:string;label:string}`；metadata属性projects/members/iterations/types均Option[]，typeCapabilities包含typeId/fields/readStates/writeStates及UnsupportedRepresentation原因。`TypeMapping={typeId:string;category:string;readStates:Record<string,TaskStatus>;writeStates:Record<TaskStatus,string>;optionalFields:('priority'|'tags'|'storyPoints')[];fieldIds:Partial<Record<SyncField,string>>;valueMaps:Partial<Record<'priority'|'tags',Record<string,string>>>}`；一个enabled rule按其每类型mapping读取，category不得由名称猜。

`SafeRun`包含id/status `running|completed|partial|failed|interrupted`、phase `discovering|processing|waiting|finished`、timestamps、counts六互斥类+pending/unprocessedKnown、discoveryComplete、范围摘要和safe errors。发现未完成时未处理总数允许null，不编造百分比。`SafeItemResult`含key/taskId|null、类别、changedFields、取舍字段名、是否回写、outsideFilter、safe error，不含内容正文。`Page<T>` items/total/page/pageSize；公开DTO不含WriteIntent/RemoteItem/baseline。

### Supporting contracts (Task 1 types, Task 2/4/7/8 implementations)

- `SyncLink={id:string;key:RemoteKey;ruleId:string;taskId:string|null;taskGeneration:string;revision:number;baseline:SyncBaseline|null}`。
- `PrepareIntent={fence:RunFence;link:SyncLink;task:TaskRecord;observed:RemoteItem;rule:SyncRule;plan:SyncPlan}`。
- `WriteIntent={id:string;linkId:string;key:RemoteKey;taskId:string|null;taskGeneration:string;linkRevision:number;fence:RunFence;ruleSnapshot:SyncRule;baseline:SyncBaseline;localBefore:SyncFields;localVersion:number;remoteBefore:RemoteItem;patch:SyncPatch;expected:SyncFields;phase:'prepared'|'dispatched'|'unknown'|'confirmed'|'cancelled'}`。仅存同步必要字段，remoteBefore.description允许raw，不保存平台整对象/凭据/附件字节。
- `FinalizeItem={fence:RunFence;linkId:string;linkRevision:number;taskGeneration:string;expectedTaskVersion:number;localPatch:SyncPatch;observed:RemoteItem;baseline:SyncBaseline;intentId:string|null;result:SafeItemResult}`；localPatch.description在同一事务由mergeLocalAttachments合并当前附件并转UpdateTaskRequest.content，notes由现有TaskStore投影，不独立赋值。
- `HostCredentials={kind:'yunxiao';token:string}|{kind:'tapd';user:string;password:string}`仅宿主不导出browser；`HostRequest={url:URL;method:'GET'|'POST'|'PUT';headers:Record<string,string>;body?:string;readOnly:boolean}`仅adapter构造。`SyncTransport`读取返回`{value:unknown;headers:Headers;status:number}`，保留云效分页头，codec从value解析；写返回同形或value=null，不猜PUT必须204。
- `ReconcileResult={kind:'confirmed'|'proven_not_applied'|'pending';observed:RemoteItem;error?:SyncErrorDto}`；not_applied_proven必须平台唯一操作证据，不能由读到旧值推导。
- `Clock={now():number;sleep(ms:number,signal:AbortSignal):Promise<void>}`；`AdapterFactory=(connection:SafeConnection)=>SyncAdapter`。`ItemExecution={fence:RunFence;rule:SyncRule;key:RemoteKey;tasks:TaskStore;config:SyncConfigStore;links:SyncLinkStore;runs:SyncRunStore;adapter:SyncAdapter;clock:Clock;signal:AbortSignal}`。
- `SyncMethod`为14个新增方法字符串union；`SyncRequest`为方法鉴别union，每项request按DTO锁定。定义完整集合，不使用Record<string,unknown>绕过closed schemas。

### Task 1: Closed contracts, fixtures and typed errors

**Files:** Create `src/sync/types.ts`, `dto.ts`, `validation.ts`, `errors.ts`; `tests/fixtures/sync.ts`, `tests/sync-contract.spec.ts`。
**Interfaces:** Produces全部Shared interfaces；`parseSyncRequest(method: SyncMethod, value: unknown): SyncRequest`、`syncRemoteError(error: SyncErrorDto): RemoteError<'task-list/sync'>`；fixture `local(overrides?:Partial<TaskRecord>)`, `remote(overrides?:Partial<RemoteItem>)`, `baseline(overrides?:Partial<SyncBaseline>)`, `rule(overrides?:Partial<SyncRule>)`, `fakeAdapter()`（读写可控spy）。

- [ ] **1. Write failing tests**：`rejects raw secrets urls payload unknown keys and nonplain objects`，对startSync的非空对象、原型污染键、非法pageSize101/非整数、invalid env、filters101和缺revision拒绝；合法创建返回默认disabled。`keeps giant IDs as strings`断言`'1152921504606846976123'`原样；`never serializes secrets in safe errors`遍历结构输出无伪密钥。
- [ ] **2. Run red**：`npm test -- tests/sync-contract.spec.ts`；预期缺模块/validator或断言失败，不是环境依赖失败。
- [ ] **3. Implement contracts**：使用closed plain-object解析，拒绝未知字段和非JSON值，不使用TS cast作校验。固定前述错误表和docKey白名单，safe output也校验。完整SyncMethod为规格列出的14个方法（connections4/rules4/metadata2/runs4），不增加raw操作入口。
- [ ] **4. Run green**：上述测试及`npm run typecheck`通过；fixtures是代码构造器，不联网。把所有错误码映射到problem/action/docKey测试表，不漏注册表的失败路径。
- [ ] **5. Commit checkpoint**：只在获准时暂存本任务文件，建议`feat: define safe project sync contracts`；否则记录diff等待，不创建WIP提交。

### Task 2: Schema6 and transactional sync persistence

**Files:** Create `src/sync/schema.ts`, `config-store.ts`, `link-store.ts`, `run-store.ts`, `src/sqlite-transaction.ts`; Modify `src/store.ts`, `src/types.ts`；Test `tests/sync-store.spec.ts`, `tests/sqlite-transaction.spec.ts`, `tests/store.spec.ts`。
**Interfaces:** `migrateSyncSchema(db:DatabaseSync):void`；`SyncConfigStore(db)` connections/rules CRUD（更新删除id+revision）；`SyncLinkStore(db,tasks)`的`importItem(item,rule,fence):TaskRecord`、`prepareIntent(input:PrepareIntent):WriteIntent`、`markDispatched(intentId,fence):void`、`finalizeItem(input:FinalizeItem):void`、`listLinked(ruleId,afterKey:string|null,limit:number):SyncLink[]`、`getPending(key):WriteIntent|null`；`SyncRunStore(db)`运行/结果分页、seen-key去重、清理。

- [ ] **1. Write failing tests**：`migrates 0..5 atomically to 6 preserving rich content attachment bytes subtasks and versions`，故障后schema及旧行不变；future7拒绝。真实v5库包含加粗、链接、表格及附件字节，迁移后逐一原样核对。`enforces both unique identities across credential rotation`；重复project配置失败；有引用connection/rule删失败但可disable。`rolls back task baseline intent result together`向finalize中各SQL注入失败，四类记录全回滚。
- [ ] **2. Run red**：`npm test -- tests/sync-store.spec.ts tests/store.spec.ts`。
- [ ] **3. Implement migration/stores**：保留现有0–4→5的content/attachment迁移，然后同一启动事务增同步表到6；v5直接到6，新库创建现有表后到6；任何阶段失败整个迁移回滚。DDL拆到schema而不复制Task表。增STRICT表sync_connections/rules/links/baselines/write_intents/runs/run_items/seen_keys/run_lock，unique(task_id)及canonical key；link task FK为SET NULL而非删证据cascade，保存task_generation；索引rule+canonical、run+item、created_at、pending phase。新增`withSqliteTransaction<T>(db:DatabaseSync, operation:()=>T):T`，用该db的受控嵌套计数：最外层BEGIN IMMEDIATE/COMMIT，内层唯一SAVEPOINT/RELEASE，错误ROLLBACK TO再RELEASE；拒绝Promise返回callback并回滚，不跨await。把TaskStore.writeContent现有BEGIN/COMMIT改为此助手，原行/附件校验与清理不变；同步finalize外层调用tasks.update内层后继续写baseline/intent/result，外层错误必须同时撤销附件变动。所有本插件事务都由此助手管理，不混裸BEGIN。TaskStore.delete同一事务cancel未派发意图、detach已派发证据再删除任务、附件及子任务，旧callback按generation拒绝。TaskRecord加可选只读`source` DTO（宿主批量注入，不接受客户端创建关联）。
- [ ] **4. Run green**：两DB连接CAS、delete prepared/dispatched/unknown、same-key未确认阻止重导入、已清结下一次可重导入、非法metadata长度失败均通过。完成历史30天且≤100run、≤1000行小事务、unknown及baseline永不清理；用fake dates验证。旧schema断言更新到6，同时保留真实v4/v5迁移fixture。额外运行`npm test -- tests/sqlite-transaction.spec.ts`：嵌套savepoint失败不提交内层、外层失败撤销内容及附件字节、独立CRUD原子性、不得产生cannot start transaction within transaction；async callback拒绝。同步只状态变化时content JSON及附件字节完全不变。
- [ ] **5. Commit checkpoint**：建议`feat: persist sync baselines and write recovery intents`，遵守全局提交门。

### Task 3: Snapshots, mapping revisions and pure five-branch planner

**Files:** Create `src/sync/snapshot.ts`, `mapping.ts`, `planner.ts`, `description-codec.ts`；Modify `package.json`, `package-lock.json`（parse5作为打包宿主使用的固定依赖）；Test `tests/sync-content.spec.ts`, `sync-planner.spec.ts`。
**Interfaces:** `projectLocal(task:TaskRecord, projection:SyncProjection):SyncFields`；`projectRemote(item:RemoteItem, rule:SyncRule):SyncFields`；`rebaseProjection(input:{task:TaskRecord; remote:RemoteItem; baseline:SyncBaseline; rule:SyncRule}):{baseline:SyncBaseline; initializePatch:SyncPatch}`；`planSync(input:{local:TaskRecord|null; remote:RemoteItem; baseline:SyncBaseline|null; rule:SyncRule}):SyncPlan`；`encodeStatus(target:TaskStatus,observed:RemoteItem,mapping:TypeMapping):string`。

- [ ] **1. Write failing five-branch assertions**：fixtures构造可读的local/baseline/remote。断言`planSync({local:null,...}).kind==='import'`；unchanged的remotePatch为空；仅remote描述变化pull；仅local描述变化push；local描述变化+remote状态done时merge的localPatch.description等于远端结构化非附件内容且remotePatch.status等于本地todo。再测local只会话/工作区变化不push、同timestamp内容变化能识别、时钟大小不影响决策。
- [ ] **2. Run red**：`npm test -- tests/sync-planner.spec.ts tests/sync-content.spec.ts`。
- [ ] **3. Implement pure mapping/planner**：仅比较selectedFields规范快照；同时变化是任务级，非状态全取远端。状态回写保留语义已一致的最新细分状态。presence absent/unsupported不能落为null/empty。`decodeDescription(raw:FieldValue<string>,format):{content:TaskContent;roundTrip:boolean}`用parse5惰性HTML AST映射现有paragraph/heading/list/quote/code/table及允许marks/link，不执行脚本；移除脚本节点不等于可无损回写，包含未支持语义、远端图片或样式等时roundTrip=false且明确说明。`encodeDescription(content:TaskContent,rawFormat):string`仅对已证可编码结构执行，拒绝本地附件进入payload；text保持精确换行，markdown保留源码code块、若用户改成其它结构先报UnsupportedRepresentation，不依contentMarkdown猜无损。`mergeLocalAttachments(remoteDescription:TaskContent,current:TaskContent):TaskContent`保留current全部本地附件节点并按原附件顺序置正文之后，校验总结构与长度后写入；内容超限整项失败，不删除附件求通过。原始description、格式、presence始终进入基准，不把安全展示副本回写。tags比较按既有大小写/去重限制规范化，映射值不在候选时报MappingIncompatible。
- [ ] **4. Run green**：测试标题200UTF16/201、描述20000/20001、12/13标签、故事点0/1000/1001；新字段启用从remote初始化、保留原待同步编辑；禁用停止传播；换map不构成业务变化、无法安全解释暂停；多数状态归一且唯一回写目标、未知状态拒绝、不同字段各自编辑仍remote取其他字段。格式缺失/null/空描述分别断言不静默清空。加粗或href变化但contentText相同也push；marks数组顺序变化不push；附件单独增加/删除/改名不push；pull/merge保留附件字节及节点，不把附件名送远端；HTML未知节点/images不被静默当可无损，脚本/事件/javascript href不执行，表格span及内容上限保持现有validateContent限制。描述替换与原附件合并后超过20000/1M结构时报错且原任务完整。
- [ ] **5. Commit checkpoint**：建议`feat: plan baseline-aware bidirectional task sync`。

### Task 4: Bounded HTTPS transport and credentials

**Files:** Create `src/sync/transport.ts`, `credentials.ts`；Test `tests/sync-transport.spec.ts`。
**Interfaces:** `resolveCredentials(connection:SafeConnection,env:Record<string,string|undefined>):HostCredentials`仅宿主；`SyncTransport({fetch,clock})`的`read(request:HostRequest,signal:AbortSignal):Promise<{value:unknown;headers:Headers;status:number}>`/`write(request:HostRequest,signal:AbortSignal):Promise<{value:unknown;headers:Headers;status:number}>`。HostRequest由适配器构造verb/path/headers/body，不能从RPC传入；`Clock`有now()/sleep(ms,signal)，fakeclock用于测试。

- [ ] **1. Write failing tests**：缺变量零请求；redirect不跟随且不泄认证；官方域外/用户名URL/IP/非HTTPS拒绝；数字与HTTP-date Retry-After≤60s，最多3次读，30sabort，流式2MiB+1拒绝；HTTP200非JSON不当成功；write超时只一次请求并产生WriteOutcomeUnknown。
- [ ] **2. Run red**：`npm test -- tests/sync-transport.spec.ts`。
- [ ] **3. Implement**：Node fetch redirect='error'，流式计字节后才JSON解析；明确GET及现代云效只读POST search可读重试，写不自动重试。读取瞬时网络/5xx/429有限退避，401/403直接连接失败；每次sleep/request遵守signal和运行剩余预算。错误只存安全code/requestId，禁止复制response info全文。Region主机根据能力文档官方合法模式校验，未证明域不启用。
- [ ] **4. Run green**：伪密钥出现在header/上游错误/异常message/正文时本地输出全不包含；跨域redirect、body过大且无Content-Length、有chunk分割均通过。30分钟预算交给executor但transport要尊重父signal。
- [ ] **5. Commit checkpoint**：建议`feat: bound and secure project platform requests`。

### Task 5: Yunxiao modern Projex adapter

**Files:** Create `src/sync/adapters/yunxiao.ts`, `yunxiao-codec.ts`；`tests/fixtures/sync-api/yunxiao-*.json`（中心/Region读写），`tests/sync-yunxiao.spec.ts`；Update `docs/sync-capabilities.md`。
**Interfaces:** `createYunxiaoAdapter(connection:SafeConnection,transport:SyncTransport):SyncAdapter`；codec接受unknown并输出RemoteItem/SyncMetadata；类型字段配置驱动optional fields，不硬编码priority/tags/storypoints ID。

- [ ] **1. Write failing fixture tests**：POST workitems:search限定spaceId单项目、负责人/type/sprint/state映射及分页header；GET详情gmtModified字符串保持token，超大ID保留；PUT仅必要补丁且description伴formatType；204/空body写成功不冒充read实体；字段缺失/无state候选导致能力禁用。
- [ ] **2. Run red**：`npm test -- tests/sync-yunxiao.spec.ts`。
- [ ] **3. Implement adapter**：按能力证据的现代路由构建center org与region不含org路径；项目projects:search，迭代projects/{id}/sprints，成员members、types?category、fields候选。discover固定查询和排序，依据返回分页标记终止；重复页/无进展报IncompleteDiscovery。工作项详情按id，列表不足字段读详情；必需字段非法拒绝。状态转换仅已证可写工作流，不依显示名称猜ID。`evidence`只能按实际写字段语义匹配或官方操作证据确认，没证据返回unknown。
- [ ] **4. Run green**：中心/Region合同、分页边界及空页/错误header、不支持字段、富文本无损/不支持回写、401/403、迁移可识别时报需处理、0原子条件支持时无承诺均通过；更新matrix记录每能力的fixture日期和实际联调未完成。
- [ ] **5. Commit checkpoint**：建议`feat: adapt Yunxiao Projex task APIs`。

### Task 6: TAPD story/bug/task adapter

**Files:** Create `src/sync/adapters/tapd.ts`, `tapd-codec.ts`；`tests/fixtures/sync-api/tapd-*.json`, `tests/sync-tapd.spec.ts`；Update `docs/sync-capabilities.md`。
**Interfaces:** `createTapdAdapter(connection:SafeConnection,transport:SyncTransport):SyncAdapter`；三种type分别编码，不混用状态字段候选和更新副作用。

- [ ] **1. Write failing tests**：Basic认证，GET集合+workspace_id/id详情，POST集合update；status≠1的HTTP200业务失败；data外层Story/Bug/Task数组不符合shape拒绝；limit≤200固定order=id desc、串行cursor、重复cursor报不完整；三个类型priority_label和label按各自候选，故事点只有经证能力支持。
- [ ] **2. Run red**：`npm test -- tests/sync-tapd.spec.ts`。
- [ ] **3. Implement adapter**：只用api.tapd.cn官方；ID不转Number，modified字符串opaque token不依Date猜时区。通过官方各类型fields info加载候选；过滤维度用官方参数实现，无可靠服务端过滤时有界客户端筛选并报告发现完整性。metadata projects/members/iterations按证据。显式阻止并行工作流状态重置等不安全流程；不发is_auto_close_task=1或auto_complete_effort=1，不默许关闭关联任务/补工时；bugs状态改动保留owner能力按证据设keep_owner，若不能保证只改同步字段就禁对应转换。
- [ ] **4. Run green**：空/null/缺字段、超限、商业API未开通、未知状态、工作流必填/副作用拒绝、page深度20000后cursor、20k+1项完整覆盖或明确unsupported、第三方回撤写值不证明原写未发生均通过。不能靠忽略flags就宣称无副作用，需测试/官方可证明确。
- [ ] **5. Commit checkpoint**：建议`feat: adapt TAPD requirements bugs and tasks`。

### Task 7: Database-level ownership and write-intent reconciliation

**Files:** Create `src/sync/reconcile.ts`；Modify `run-store.ts`, `link-store.ts`；Test `tests/sync-ownership.spec.ts`, `sync-recovery.spec.ts`。
**Interfaces:** run-store `claimRun(ownerId:string,now:number):{fence:RunFence;existing:boolean}`、`heartbeat(fence,now):boolean`、`assertFence(fence):void`、`revoke(fence):void`；`reconcileIntent(intent:WriteIntent,adapter:SyncAdapter,signal):Promise<ReconcileResult>`，结果kind `confirmed|proven_not_applied|pending`附最新观察和只对写字段验证的证据。

- [ ] **1. Write failing tests**：两真实DB句柄start只一runId；10秒heartbeat、90秒lease失效使旧owner任何派发/commit被拒绝；过期接管先对账、不重复write；prepared意图取消不会请求；write已应用、第三方改非写字段仍按write-set确认；第三方回撤或不等于前/后值时unknown持续pending。
- [ ] **2. Run red**：`npm test -- tests/sync-ownership.spec.ts tests/sync-recovery.spec.ts`。
- [ ] **3. Implement fence/reconciliation**：run_lock singleton事务取得owner+generation，过期旧run标interrupted；lease失效先封锁旧代际，不能仅因过期重新dispatch旧意图。派发前记录dispatched阶段（即使进程在HTTP前死也按可能已写保守处理），验证effect只比较实际写字段。回读等于写前值不证明not_applied；无平台证据保留pending并只读对账。禁用不请求；stop先revoke，再abort，不用abort结果断言撤销远端。
- [ ] **4. Run green**：意图落库失败write=0；旧owner迟到response不落库；删除保留detached generation、同键阻重导入、平台语义确认后释放但当前run不立即新建；map改后旧意图用旧修订；未知无强制确认入口，所有状态转移测试通过。
- [ ] **5. Commit checkpoint**：建议`feat: fence sync runs and reconcile uncertain writes`。

### Task 8: Item execution and bounded manual batches

**Files:** Create `src/sync/execute-item.ts`, `executor.ts`；Test `tests/sync-executor.spec.ts`, `sync-scale.spec.ts`。
**Interfaces:** `executeItem(input:ItemExecution):Promise<SafeItemResult>`，ItemExecution含fence/rule/key/stores/adapter/clock/signal；`SyncExecutor({tasks,config,links,runs,adapterFactory,clock})`有`start():{runId:string;existing:boolean}`、`stop():Promise<void>`；start快速返回，宿主自持执行Promise且处理所有rejection，不依浏览器连接signal保持运行。

- [ ] **1. Write failing integration tests**：五分支真实SQLite+fakeAdapter；每次write前intent已存，回写前再read并重算；成功后task+baseline+intent+result同事务；每个checkpoint崩溃重开库后下一次手动运行不重播原副作用。远端接受后本地新描述+远端另一字段修改，恢复保留新local修改及完整remote观察。
- [ ] **2. Run red**：`npm test -- tests/sync-executor.spec.ts tests/sync-scale.spec.ts`。
- [ ] **3. Implement execute pipeline**：read→pending对账→rebase→plan→若write先re-read/re-plan（最多3次变化重新规划，仍不稳定报LocalVersionConflict/RemoteUnavailable具体原因，不循环）→prepare意图→派发前检查当前enabled/fence/local generation→write→回读write-set→finalize。CAS失败不换version重用旧补丁，保留原baseline/意图再对账规划。批次按连接串行、发现页≤200、关联keyset100、SQLite seen_keys去重，不装全量实体。写入本地只用本次快照验证的版本；新import默认workspace用规则，agent/立即发送/Worktree原默认。
- [ ] **4. Verify integration green**：停用即时阻止后续请求、普通配置下一轮生效、认证/429额度导致连接停而其他连接继续、预算30分钟partial、发现错误不等同零项、out-of-filter关联仍处理、空发现仍关联、独立任务无请求；未知pending不进行普通回写。counts互斥，pending属于失败子计数，已知未处理和未知总数分别报告。
- [ ] **5. Verify scale**：1k/10k模拟详情流保持单页内存、请求数可核对、unchanged写=0、数据库来源批量查询而非每任务N次、cleanup让出事件循环；记录耗时/heap/事务最大时间，不硬编码虚假性能目标。故障注入存储busy/不可写及shutdown阶段，任何存储失败不发送新远端写。
- [ ] **6. Commit checkpoint**：建议`feat: execute recoverable manual project task sync`。

### Task 9: DSH RPC service wiring and mixed-version handling

**Files:** Create `src/sync/service.ts`, `src/client/sync/face.ts`；Modify `task-service.ts`, `remote.ts`, `index.ts`, `client/index.tsx`, `client/TaskPanel.tsx` TaskFace；Test `tests/sync-remote.spec.ts`, `tests/client-apply.spec.ts`。
**Interfaces:** `SyncService({tasks,config,links,runs,executor,adapterFactory})`公开methods与规格一致。Connections/rules CRUD返回Safe DTO，metadata/test只读；startSync({})返回runId/existing；getSyncRun({id})、listSyncRuns(page)、listSyncItemResults({id,page,pageSize})。`SyncFace`映射同名methods为Promise业务值，`unwrapSync`保留结构化RemoteError；listTasks一次批量attachSource当前页，不发平台请求。

- [ ] **1. Write failing tests**：14methods与descriptor列表一致，codec和Host都closed验证；合法create disabled、revision冲突、unsafe dto零请求；query/test/save调用write=0/start=0；错误code/details到client不丢；缺method转成HostRestartRequired且旧CRUD保持可用；Safe DTO没有raw/env值/baseline/intent。
- [ ] **2. Run red**：`npm test -- tests/sync-remote.spec.ts tests/client-apply.spec.ts`。
- [ ] **3. Implement wiring**：现有TaskService委托SyncService，不另注册公网或任意代理。新codec严格parse、旧CRUD签名不变；使用RemoteError<'task-list/sync'>细节，翻译由client locale完成。Host apply按正确依赖生命周期创建，effect cleanup同步revoke/abort并跟踪执行结束后关db，禁止先关闭db造成迟到落库。不要用新源元数据请求Platform做listTasks。
- [ ] **4. Run green & actual admission check**：用已安装Host临时只读测试验证未认证401/不可信Origin403、授权RPC可达且匿名write=0，不获取/回显用户浏览器cookie；桌面本地IPC如适用记录受信operator边界。目标Host无法核对时验收留缺口，不编造安全结论。
- [ ] **5. Commit checkpoint**：建议`feat: expose safe manual sync through taskList RPC`。

### Task 10: Native settings and one-button results UI

**Files:** Create `src/client/sync/use-sync-run.ts`, `src/client/sync/SyncControls.tsx`, `src/client/sync/SyncResults.tsx`, `src/client/sync/SyncSettings.tsx`, `src/client/sync/RuleFields.tsx`, `src/client/sync/Sync.module.css`；Modify `src/client/TaskPanel.tsx`, `src/client/locales.ts`, `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/host-primitives.ts`, `tests/build-browser-fixture.mjs`；Test `tests/sync-ui.spec.tsx`, `sync-results.spec.ts`。
**Interfaces:** components consume `SyncFace`, typed translator和workspace choices；`useSyncRun(face)`产生run/items/queryError/start/refreshResults，组件unmount只停查询不cancel Host；sessionStorage仅记runId辅助回连，不存密钥或task内容，最新run以宿主list为准。

- [ ] **1. Write failing DOM tests**：复用现有react-dom18与浏览器fixture，新增dev-only对应types、@testing-library/react/user-event和jsdom（锁文件固定）；仅本spec用jsdom其余Node保持。现有tests/host-primitives.ts依赖硬编码兄弟宿主源码路径，先改为显式DSH_HOST_SOURCE路径解析并检查；缺失时明确HostFixtureUnavailable，不造模拟控件绕过测试。扩展真实源码桥接Modal/Input/Checkbox/Menu，取得合法宿主源码后再做DOM及实际浏览器验收。一个名称“同步”按钮，click一次start、多click无第二start；离开再回来query同id不start；pending/发现不完整/全无变化/未启用范围各显示明确文案；unknown总数不显示百分比。
- [ ] **2. Run red**：`npm test -- tests/sync-ui.spec.tsx tests/sync-results.spec.ts`。UI primitives测试解析CSS由Vite支持，不能mock Modal掉焦点行为后宣称通过。
- [ ] **3. Implement native UI**：明确peer+dev dependency `@deepseek-ai/dsh-client-ui-primitives >=0.2.0-rc.1`并读取实际export，使用真实Modal(open/onClose/title/closeLabel/footer)、data-modal-autofocus、Button、Input、Checkbox/Menu候选；无Select导出时用宿主Menu+Checkbox候选组合，不造同名Select。设置按四组，元数据请求generation保护、项目/type变化重新校验、无credential/map禁止启用；Save不sync，Test显式read。状态读取候选多对一与写目标分开展示。范围说明是所有enabled规则而非列表filter；compact toolbar下结果，成功merge可展开字段取舍但不显示旧正文。
- [ ] **4. Run green**：keyboard Tab闭环/Escape/menu优先/关闭回触发器、label+error描述、首非法field定位，迟到候选不覆盖新项目，HTTP失败不显示为空；错误code本地化和docKey锚点白名单；查询断连只重连，混版提示可见；polite只阶段/完成，errors alert。保持中文/英文key集合一致。结果默认20上限100并可翻页。
- [ ] **5. Verify dependency/build boundary**：client renderer能提供UI primitives公开模块（添加package client.inject的模块声明若实际loader需要，按真实合同而非猜）；npm run typecheck/build和ModuleLoader handoff继续通过，不另起Vite服务替代实际GUI。
- [ ] **6. Commit checkpoint**：建议`feat: add native sync settings progress and results`。

### Task 11: External title, launch content and responsive source rows

**Files:** Create `src/client/task-content.ts`；Modify `client/TaskPanel.tsx`, `client/TaskPanel.module.css`, `client/index.tsx`, `locales.ts`；Test `tests/task-content.spec.ts`, `task-title.spec.ts`, `client-apply.spec.ts`, `panel-layout.spec.ts`, `sync-ui.spec.tsx`。
**Interfaces:** `taskDraft(task:TaskRecord):string`消费现有contentMarkdown(task.content)而不是notes；`taskEditPayload(task:TaskRecord|null,title:string,content:TaskContent,uploads:TaskAttachmentUpload[]):Pick<UpdateTaskRequest,'title'|'content'|'attachments'>`保留富文本和上传字节。外部mode由安全source非空决定，不由tags/标题前缀猜。外部draft为title.trim()+空行+正文Markdown（正文空则title）；原本地维持0.5.0的contentMarkdown/document fallback及files-only草稿为空规则。TaskPanel外部空正文不可fallback为textContent(title)，避免把标题写进description。

- [ ] **1. Write failing tests**：external title保持独立、状态/完成/启动不derive；外部空description合法title必填，本地任务保持0.5.0现有可保存内容规则（纯附件可保存并由文件名派生标题）与50codepoint派生；draft精确`'远端标题\n\n描述'`，description为空只有title；旧客户端launch步骤与Agent/Worktree更新顺序不变，恶意task文字只是draft不变成system指令。
- [ ] **2. Run red**：`npm test -- tests/task-content.spec.ts tests/task-title.spec.ts tests/client-apply.spec.ts tests/panel-layout.spec.ts tests/sync-ui.spec.tsx`。
- [ ] **3. Implement focused branches**：TaskPanel外部编辑显示独立title并复用现有持久化动作，来源在内容次级行不增加固定列，edit信息只读来源编号/安全URL/同步时间错误。sourceURL只允许官方http(s)且noopener noreferrer。空标题/长度超限保留草稿报错；safe text展示raw HTML不执行脚本。启动只替换文本选择函数，保留0.5.0的附件读取先于session创建、createDrafts/addAttachments、失败releaseDraftAttachments、workspace/session/agent/input/update/open/submit顺序。继续用TaskContentEditor和persistRichTask能力检查，不改成notes-only保存。外部仅状态变化不得重编码正文，附件可正常加删但始终本地，不向平台传字节。
- [ ] **4. Run green**：固定960/clamp CSS回归，≤430px状态和动作次行、≤560px映射纵向；desktop旧列不变。source很长Unicode/英文及200%缩放不横向溢出；描述空时列表标题可见。保留原capture/工作区/子任务测试，不通过删旧assert掩盖回归。
- [ ] **5. Commit checkpoint**：建议`feat: preserve external task titles and narrow row readability`。

### Task 12: Documentation, build and real acceptance

**Files:** Modify `README.md`, `README.zh.md`, `package.json`files；Create `docs/sync-capabilities.md`（由适配器任务维护）、`docs/sync-maintenance.md`, `docs/sync-acceptance.md`；rebuild tracked `lib/`。
**Interfaces:** docKey只指README随包固定锚点（credentials/permissions/mapping/content/network/recovery/host-upgrade）；维护者矩阵及DTO docs随包`files`显式含docs/sync-*.md而不包含内部spec/plans或测试项目数据。

- [ ] **1. Write failing docs/pack tests**：`tests/sync-docs.spec.ts`逐docKey中英文README都有对应锚点，两平台都有read-only setup→mapping→enable→Sync完整例，package.files不夹spec/密钥/fixture，既有0.5.0说明不声称已发布本次同步新版本。
- [ ] **2. Run red**：`npm test -- tests/sync-docs.spec.ts`。
- [ ] **3. Implement docs**：实际checkout相对安装例；PowerShell遮蔽输入→Host环境变量继承，存在性仅boolean，nativeHost需完全退出父进程后再开、远程Host在Host机器设置。TAPD商业API开通/权限、云效令牌读写、读取不证明写权限、状态/筛选/覆盖规则；维护者写unknown证据/停用/安全反馈模板、迁移备份+WAL、向前修复优先与旧库恢复代价，远端已接受写不被恢复库撤销。无“强制成功/忽略pending”入口。
- [ ] **4. Run fresh verification**：在当前隔离插件目录执行`npm run typecheck`、`npm test`、`npm run build`、`npm pack --dry-run`；记录实际退出码及套件结果。核对Node22.19及24兼容（用已有runtime，不自动改PATH或重装），不能用Node26专属API。重新git diff/check/HEAD核对、检查lib来源、凭据扫描（只报告有无命中，不输出内容）。
- [ ] **5. Review whole branch**：requesting-code-review获取独立review，按receiving-code-review核对意见、补回归重跑；安全、恢复、接口一致性为阻断项。verification-before-completion后才能声明实现/测试通过，未真实验收时写清。
- [ ] **6. Verify actual GUI**：正确安装构建到现有Host，先安全备份用户任务库；宿主改动需Host重载/重启，页面刷新现有http://127.0.0.1:19387，不创建替代server，不承诺HMR。若重启会中断当前任务先与用户安排；浅深色、390/430/560/960px、200%缩放、焦点键盘、长error/source、双标签点击、离开面板回连、现有start/done/Worktree真实点击。保存截图与脱敏验收表，只报告实际结果。
- [ ] **7. Verify authorized platforms**：向用户获取测试项目授权而不是让用户在聊天贴密钥；分别云效和TAPD各承诺类型做read/import/local-only/remote-only/both/repeat，核对远端历史及状态、副作用、repeat额外write=0。没有权限/凭据时记录“未联调”，不写PASS。记录主动setup目标≤5min（前置账户安装等待另计），run耗时/项数/额外writes，不能以估计冒充测量。
- [ ] **8. Handoff/integration checkpoint**：finishing-a-development-branch提供合并/保留选择，不自动提交或推送；若用户批准提交，在许可时间仅暂存相关源码/lib/docs。交付完整结果：已实现、自动化证据、实际GUI/平台结果、未完成证据与限制，不把fixture绿色等同生产可用。

## Concrete red-test examples

Task 2（真实SQLite数据库）：

```ts
it('rolls back attachment and baseline writes with the outer transaction', () => {
  const before = tasks.get(task.id)!
  expect(() => withSqliteTransaction(tasks.db, () => {
    tasks.update({ id: before.id, version: before.version, content: changedContent })
    throw new Error('injected baseline failure')
  })).toThrow('injected baseline failure')
  expect(tasks.get(task.id)).toEqual(before)
  expect(tasks.readAttachments(task.id, before.version)).toEqual(beforeUploads)
})
```

Task 3（固定三方fixture，base状态todo、remote状态done、local仅改description）：

```ts
it('uses remote description but local status for both-side changes', () => {
  const result = planSync({ local: editedLocal, remote: changedRemote, baseline: base, rule: mapping })
  expect(result.kind).toBe('merge')
  expect(result.localPatch.description).toEqual(remoteContent)
  expect(result.remotePatch).toEqual({ status: 'todo' })
})
it('detects formatting changes without plain-text changes', () => {
  expect(contentText(plainContent)).toBe(contentText(boldContent))
  expect(planSync({ local: boldLocal, remote: originalRemote, baseline: base, rule: mapping }).kind).toBe('push')
})
```

这些变量由各test本地fixtures生成，并显式保存beforeUploads；不要依赖外部真实库。其余task的具名断言和边界值按各自步骤实施。

## Plan self-review and handoff

执行顺序1→2→3→4→5→6→7→8→9→10→11→12，默认单写入会话；平台任务5/6的只读研究可独立，但类型/迁移/执行器/RPC/构建不得多会话并发写。每task先RED/GREEN再review，任务间不重复定义合同。

覆盖检查：规格§1–3由1/3/5/6/8/10实现；§4由2/7；§5由3/5/6/11；§6由4/7/8；§7由9/10/11；§8由4/5/6/9；§9–10由各测试及12。五项Review Focus均已给出所属测试。平台版本条件写/日期精度/迁移检测及实际Host模块可用性未证处是显式能力门，不凭推断启用。

本次重基自审：已修正schema5→6、TaskContent真源与格式-only变化、附件保留/不传播、writeContent嵌套事务、原0.5.0附件启动/失败释放、纯附件本地任务、TAPD companyId、transport分页header与基准presence合同。现有规格的纯文本假设以本计划的0.5.0适配为准，不改变用户已批准的同步方向或冲突规则。任何平台无法无损回写处显示能力限制，不自行扩大字段/文件同步。

计划完成不等于功能完成。用户需要审阅本文并选择 Native（本会话顺序实施、末尾独立review）或 Subagent-driven（逐任务新实现者及新reviewer，控制器顺序集成）。选择前不修改产品代码、不安装产品依赖、不实际写远端。
