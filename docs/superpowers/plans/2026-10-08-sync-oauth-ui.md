# 授权优先同步设置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户已选择本会话直接实现，不使用逐项子代理/审查循环。

**Goal:** 将已确认HTML原型变为实际原生设置，接入官方OAuth及宿主凭据服务，保留现有安全手动同步。

**Architecture:** 连接配置保存非敏感身份与鉴权方式；宿主凭据服务持有grant；OAuth尝试管理器驻内存并注册固定回调路由。适配器工厂变成异步，以便每次操作解析/刷新凭据；浏览器仅接收授权URL、尝试ID与安全状态，不接收令牌。

**Tech Stack:** TypeScript、React18、现有DSH原生组件与RPC、Node crypto、已有Host WebServer/Credentials接口、SQLite事务、Vitest与现有Playwright。无新HTTP框架/ORM/独立服务。

**Spec:** `docs/superpowers/specs/2026-10-08-sync-oauth-ui-design.md`

## Global Constraints

- 原型外观与“连接/规则”两页、规则三步是已批准目标；不改既有五分支冲突逻辑、附件、会话、Agent、Worktree功能。
- 官方授权只在用户点击时发生；自动测试不动态注册真实客户端、不代用户登录/同意、不读Cookie。
- 云效中心站DCR+S256 PKCE；官方权限与用户等同、无scope限权，需可见提醒。REST OAuth鉴权未经证据确认不开放业务同步。
- TAPD身份用户态与应用项目API权限严格区分；配置应用、安装/项目授权、scope及实际测试缺一不可，不假成功。
- grant只用宿主凭据服务，任务SQLite不存access/refresh token或secret；宿主本地凭据存储不宣称加密/系统钥匙串。
- 固定插件回调路由，无独立监听；state一次消费、总期限10分钟、每次请求30秒且响应≤2MiB、禁止令牌请求重定向。
- 不绕过实际HTTP启用/所有权/预算检查；刷新同步串行、旧owner不能回写。保存/查询不自动开始任务同步。
- 数据库显式8→9迁移，旧连接按manual解释；未知未来版本拒绝，任务/附件/unknown意图保留。
- UI文案双语locales、真实原生Modal/Input/Menu/Checkbox/Tab控件；手机390px和浅深色实际Web验证。
- 不改插件包版本、不提交推送发布；不改当前桌面profile；Web重载仅用于本插件验证，避免打断当前桌面会话。

## Review Focus

1. state跨连接/重复/过期/取消回调：不能把别人的grant写入当前连接（Task2）。
2. refresh与解除连接竞态：取消/解除后迟到请求不能重新保存token（Tasks2/3）。
3. TAPD用户身份令牌用于通用更新接口：不能越过应用/项目权限条件或制造假可写（Task3）。
4. 项目/连接/步骤切换后的迟到元数据：不能覆盖新选择或允许错误规则启用（Task1）。
5. Host/client旧版本与缺credentials/WebServer：不能白屏、静默存明文或失去原manual能力（Tasks2/4）。

## 文件和共享接口

- `src/client/sync/SyncSettings.tsx`：设置外壳、页/局部视图及三步状态；新增`ConnectionSettings.tsx`、`RuleSettings.tsx`，避免一份长表单。
- `src/client/sync/Sync.module.css`、`locales.ts`：原型的卡片、紧凑表单与固定footer，复用宿主组件。
- `src/sync/oauth-types.ts`：安全DTO与仅宿主grant类型分离。
- `src/sync/oauth.ts`：官方请求、PKCE、尝试、交换/刷新/撤销本地连接。
- `src/sync/oauth-route.ts`：固定回调解析与安全响应，完全由现有WebServer注册。
- `src/sync/credential-provider.ts`：`SyncCredentialStore`适配宿主Credentials，仅本插件key空间。
- `src/sync/schema.ts`、`config-store.ts`、`dto.ts`、`validation.ts`：schema9及封闭auth配置。
- `src/sync/service.ts`、`task-service.ts`、`remote.ts`、`client/sync/face.ts`：安全授权RPC。
- `src/index.ts`、`types.ts`、`executor.ts`、`adapters/{yunxiao,tapd}.ts`：异步工厂、令牌注入与cleanup。

`ConnectionAuth` = `{mode:'manual'}` 或 `{mode:'oauth', appId?:string, appSecretRef?:string, callbackUrl?:string}`，现有业务实例ID保持不变；不得持有密钥值。

`SafeAuthState` = `{connectionId, status:'signed-out'|'waiting'|'authorized'|'expired'|'failed'|'unavailable', attemptId:string|null, expiresAt:number|null, accountLabel:string|null, resourceIds:string[], projectAccess:'unverified'|'ready'|'denied', error:SyncErrorDto|null}`。账号显示仅来自已验证官方返回。

`BeginAuthResult` = `{attemptId:string, authorizationUrl:string, expiresAt:number}`。URL输出仅允许官方授权页、state/challenge等非secret参数；不会携带token/verifier/client_secret。

`SyncCredentialStore` = `read(id):Promise<Grant|null>`、`modify(id,mutate):Promise<Grant|null>`、`remove(id):Promise<void>`。Grant属宿主私有类型，凭据provider的modifyRecord进行序列化；token刷新不缓存跨调用结果。

`AdapterFactory(connection,context):Promise<SyncAdapter>`，`context.beforeRequest`仍传入实际Transport。既有纯适配器可接入host-only凭据参数（保持manual函数兼容），不枚举process.env。

新增RPC：`getSyncAuthState({connectionId})`、`beginSyncAuthorization({connectionId})`、`cancelSyncAuthorization({connectionId,attemptId})`、`disconnectSyncAuthorization({connectionId})`；完整封闭输入/输出与旧Host缺方法提示。所有业务读写仍用原14方法。

## Task 1：将原型布局变成原生设置

**Files:** `SyncSettings.tsx`、新增`ConnectionSettings.tsx`/`RuleSettings.tsx`、`Sync.module.css`、`RuleFields.tsx`、`locales.ts`；测试`tests/sync-ui.spec.tsx`、`tests/sync-browser.mjs`。

- [ ] 写失败DOM测试：连接页初始不出现项目/映射长表单；选择规则页显示列表，新增后第一步只有范围；下一步仅映射；取消返回列表不执行sync。未映射不得确认启用。
- [ ] `npm test -- tests/sync-ui.spec.tsx`，Expected：新页面/步骤断言FAIL，而不是缺宿主或语法错误。
- [ ] 按原型实现卡片/局部连接表单/规则三步；沿用现有SyncFace及数据，先显示manual现有可用方式；OAuth按钮只有Task4接线后可用，不伪造授权成功。多选筛选保持原语义。重置/切页均作废元数据代际。
- [ ] 同命令Expected：PASS；构建后实际3082设置页检查桌面/390px、Tab/Escape返回焦点。验证布局阶段不创建连接或真实项目请求。
- [ ] 记录截图和阶段结果，无提交。

## Task 2：宿主grant存储与真实授权生命周期

**Files:** 新增`oauth-types.ts`/`credential-provider.ts`/`oauth.ts`/`oauth-route.ts`；测试`tests/sync-oauth.spec.ts`。

**Interfaces:** `OAuthManager.begin(connection):Promise<BeginAuthResult>`、`.state(connectionId):Promise<SafeAuthState>`、`.cancel(connectionId,attemptId):Promise<void>`、`.disconnect(connectionId):Promise<void>`、`.dispose():Promise<void>`。注入`fetch/clock/store/callbackBaseUrl/tapdAppConfig`；不在构造时网络请求。

- [ ] 写失败测试：随机32字节state与PKCE S256；callback缺/错state零token请求；正确callback一次成功、重放拒绝；重复code/state字段、过长参数、过期/取消拒绝；元数据恶意token端点拒绝；grant不出safe state；refresh并发一次，disconnect等待在途refresh且撤销代际阻止迟到保存。
- [ ] `npm test -- tests/sync-oauth.spec.ts`，Expected：新行为FAIL，测试用内存凭据store和隔离fakefetch，不读取实际凭据文件。
- [ ] 实现credentials服务结构适配（无服务明确unavailable）、固定callback路径`/task-list/oauth/callback`、10分钟尝试；request总期限30秒、body≤2MiB、HTTPS允许源/禁止redirect；state绑定连接+实例+鉴权配置revision，兑换前一次消费。referrer/cache/CSP安全回调响应无secret。
- [ ] 云效发现→DCR→官方authorize→exchange→grant保存→refresh；本地解除不声称远端吊销。TAPD应用需配置才生成授权URL，按官方grant_type交换，用户态grant标记用途不得用于普通API写入。应用项目token通过单独官方client_credentials流程获取/保存，用resource/scope及实际只读测试验证项目，不伪称等同用户。
- [ ] 同测试Expected：PASS；使用真实HTTP回调请求隔离测试验证state、重放及响应，不触发真实官方登录。

## Task 3：连接schema9、异步鉴权与平台兼容

**Files:** `schema.ts`/`config-store.ts`/`dto.ts`/`validation.ts`/`types.ts`/`executor.ts`/`service.ts`/适配器；测试`sync-store.spec.ts`、`sync-executor.spec.ts`、适配器spec。

- [ ] 失败测试：旧schema8连接迁移manual，unknown证据/文件保留；auth配置含secret拒绝；readonly用户态TAPD不能触发`/stories`写；应用项目token验证失败不ready；OAuth过期能刷新、请求不带PAT头与OAuth头混合；enable/fence仍每fetch检查。
- [ ] 聚焦命令Expected：FAIL对应缺新增鉴权分支/迁移。
- [ ] 增加非secretauth JSON配置列显式schema9，严密旧8→9/future10拒绝。Factory Promise接口消费者都await，不能将refresh封入同步beforeRequest；token在创建适配器前解析，beforeRequest继续原fence/enable/budget。
- [ ] 云效OAuth REST鉴权必须补足官方证据（具体地址/头）与fakefetch测试后接入，否则state标记projectAccess unverified，并保留manual可用，不尝试写后再猜头。TAPD应用项目token用Bearer，用户态仅调用已证明接口获取身份，应用scope/project不合法则拒绝通用任务API。OAuth凭据只宿主参数传入，不通过env伪变量。
- [ ] 聚焦测试Expected：PASS；typecheck接口一致，旧manual全部回归不改期望以掩盖丢失。

## Task 4：授权RPC、实际UI与清理接线

**Files:** `index.ts`/`task-service.ts`/`remote.ts`/`service.ts`/`client/sync/face.ts`/连接UI/locales/package依赖注入；测试`sync-remote.spec.ts`/`sync-ui.spec.tsx`/`client-module-table.spec.ts`。

- [ ] 失败测试：授权URL仅官方/无secret；缺RPC旧Host不白屏；credentials/route不可用保留manual；TAPD无app无可点击登录/假成功；等候/取消不自动startSync；只确认真实grant提交后authorized；popup被拦显示官方链接继续。
- [ ] 命令`npm test -- tests/sync-remote.spec.ts tests/sync-ui.spec.tsx tests/client-module-table.spec.ts`，Expected：新方法/状态测试FAIL。
- [ ] 封闭RPC+browser-safe类型接入；用户点击打开官方外部页（noopener），只轮询尝试状态而非模拟授权卡；用真实组织/项目候选或明确必要ID，所有账户display证据化。TAPD管理员输入应用ID、secret引用和登记callback，不在前端存secret值。
- [ ] 卸载顺序：禁新授权→取消/await交换刷新→停止SyncExecutor→移除route→closeDB；不能迟到写入、遗留timer或callback。
- [ ] 同命令Expected：PASS；原生按钮与真实ModuleLoader边界通过，不将Credential/Node服务引入client包。

## Task 5：实际Web验收与交付

**Files:** README中英、`docs/sync-capabilities.md`、浏览器检查脚本；最后一份短交付记录。

- [ ] 完整 `npm test`、`npm run typecheck`、`npm run build`、`npm pack --dry-run` Expected全部exit0；测试读取最新builtclient，包不含grant/临时callback文件。
- [ ] 只对这一批改动做一次新上下文最终安全审查；Important/Critical由本会话一次fix pass测试RED→GREEN，不进入逐项重复review。Minors记录，不扩大任务。
- [ ] Web3082刷新新版client，必要时仅重启本会话启动的Webjob（不是桌面Host）；先检查active任务避免打断。实际页面截图与原型对照，连接/规则/三步/备用方式/错误/390px/浅深色均可用。
- [ ] 真实OAuth登录须用户本人在官方页操作；可以显示官方入口并验证回调等待，未取得授权不声称联调成功。没有TAPD应用时验收明确配置提示和拒绝，不自动注册应用。真实项目写入不属于本请求。
- [ ] 报告源码、实际UI、授权交换、业务API各自验证状态及限制，无提交推送发布。

## 计划自查

所有规格章节由上述5任务覆盖。重点竞态均有Task2/3/4测试。明确旧schema8/manual兼容、Promise工厂与beforeRequest边界、TAPD两类grant、纯client模块、真实登录由用户完成。当前缺口是云效REST OAuth鉴权的直接官方证据与TAPD实际app配置；不能以MCP支持或原型状态推断，这两个能力门保持显式。
