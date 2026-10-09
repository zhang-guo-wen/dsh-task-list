# Sync capabilities (implemented surface)

维护当前实现实际支持的平台能力、fixtures 来源与验证结果。这里的“已实现”指有 fixture 契约测试覆盖的行为；没有真实账号联调，不把文档证据当作生产 PASS。

## 授权优先设置（2026-10-08）

连接/规则分页与规则三步已落到原生 Web；保存不触发同步。OAuth grant 仅保存于宿主 Credentials provider，SQLite schema9仅存鉴权方式/应用 ID/密钥引用/回调 URL。当前 credentials-local 是文件权限保护的本地存储，不宣称已加密或系统钥匙串。固定 `/task-list/oauth/callback` 由宿主 WebServer 动态就绪注册；当前支持127.0.0.1 Web，不另起监听/授权中心服务。缺宿主能力明确 unavailable，保留环境变量备用。

- **云效**：[官方 OAuth 文档](https://help.aliyun.com/zh/yunxiao/developer-reference/oauth-2-0-authorization-support-documentation)支持动态公共客户端注册、authorization_code+S256 PKCE及refresh_token。随机state一次消费，10分钟尝试，交换/刷新有30秒与2MiB上限、固定官方源/端点、禁止重定向。令牌与用户等同权限，scope不能限权，未提供远端吊销API，本地解除不能称为远端吊销。**直接Projex REST接受该OAuth令牌的鉴权契约未证实，因此生产adapterFactory拒绝云效OAuth任务同步；PAT原同步路径保留。** 不能用MCP端点支持OAuth推断REST头相同。
- **TAPD用户态**：[官方文档](https://open.tapd.cn/document/api-doc/API文档/授权凭证/用户态.html)要求开放应用 ID/secret、已登记回调，code有效期5分钟；用户令牌只用于支持的用户态API，不注入 `/stories` 等通用读写。
- **TAPD项目态**：[官方文档](https://open.tapd.cn/document/api-doc/API文档/授权凭证/项目态.html)的client_credentials取得应用项目令牌；核对app_id、scope、明确项目ID与只读probe，使用Bearer。只展示核验项目，不越界公司枚举；应用需要实际安装/API许可。scope存在与只读成功不能证明每次更新权限，workflow/映射与实际响应仍须安全拒绝处理。
- **验证层次**：隔离fake HTTP验证真实协议逻辑；隔离真实NodeHTTP验证回调边界；已安装Web回调invalid-state400及设置页面检查。没有实际云效/TAPD账号、开放应用或真实任务写入，不能称为完整平台联调。

## Yunxiao 现代 Projex

实现：`src/sync/adapters/yunxiao.ts`（适配器）、`src/sync/adapters/yunxiao-codec.ts`（unknown → RemoteItem/SyncMetadata 解码器）。中心 origin `https://openapi-rdc.aliyuncs.com`，认证 header `x-yunxiao-token`（在工厂内从连接引用的环境变量解析，缺失即报 `CredentialMissing`，token 不进入任何 DTO）。

### 已实现（fixture 契约测试覆盖）

| 能力 | 路由 | 说明 |
| --- | --- | --- |
| 工作项发现 | `POST /oapi/v1/projex/organizations/{org}/workitems:search` | 按 `spaceId`+`category` 单项目搜索，固定 `orderBy=gmtCreate`/`sort=asc`；无条件筛选时省略 `conditions`（不发送空数组）；六分页 header（`x-page`/`x-total-pages`/`x-next-page`）校验，矛盾或缺失且无终止证据报 `IncompleteDiscovery`；逐项 `GET` 详情补齐字段；按映射类型 + 负责人/迭代/状态四维做有界客户端过滤（AND 维度 / OR 值；负责人或迭代**缺失或畸形**在非空过滤下报 `InvalidRemoteResponse`，显式 null 视为未分配而排除，不再静默零结果） |
| 工作项详情 | `GET /oapi/v1/projex/organizations/{org}/workitems/{id}` | 校验 `id`/`space.id`/`workitemType.id` 与请求身份一致，跨项目/跨类型/换 id 响应拒绝为 `InvalidRemoteResponse`；状态按给定规则 `readStates` 归一化为规范值，未映射报 `MappingIncompatible`（不返回 unsupported）；`gmtModified` 作为不透明 token 保留（不解析日期）；超大 id 保持字符串；`revisionToken` 为 null（无 CAS 证据） |
| 项目 | `POST .../projects:search` | 同分页 header；裸数组 |
| 成员 | `GET .../projects/{id}/members` | `userId`/`userName` 候选 |
| 迭代 | `GET .../projects/{id}/sprints` | `id`/`name` 候选 |
| 类型 | `GET .../projects/{id}/workitemTypes?category=Req|Bug|Task` | 按 id 去重 |
| 字段/状态 | `GET .../workitemTypes/{typeId}/fields`、`.../workflows` | 状态候选来自 workflow `statuses`；无状态候选时 `readStates`/`writeStates` 为空、`workflow.readOnly=true` |
| 更新 | `PUT .../workitems/{id}` | 仅写补丁字段；`subject` 平铺、`description`+`formatType`、`status` 为标量 statusId；`readOnly=false`；2xx 成功不读实体回读，非 2xx 写响应显式拒绝（404→`RemoteUnavailable`、400/422→`WorkflowRejected`、429→`WriteOutcomeUnknown` 写入结果未知需核对而非重发），不回显响应体；写前 `observed.description.roundTrip` 门禁防有损编辑 |

### 只读查询面（“更多任务”页与 RPC `listWorkitems`）

2026-10-09 用真实账号（中心版）实测，非文档推断。实现：`src/sync/query/fields.ts`（字段投影）、`src/sync/query/filters.ts`（conditions）、`src/sync/query/detail.ts`（详情区块解码）、`src/sync/adapters/yunxiao-query.ts`（list/detail 编排）。

| 能力 | 实测结论 |
| --- | --- |
| 字段选择 | 平台**没有**字段参数：15 种写法（body 数组/对象/字符串/`*`、`fieldId(s)`、`returnFields`、query 参数…）全部被静默忽略，响应字节数完全一致。因此 `fields` 是**本地投影**：只返回调用方点名的字段，`id` 恒在；`description` 属详情专属，列表请求会 `InvalidConfig` |
| 字段目录 | RPC `listWorkitemFields`：`GET /projects/{id}/workitemTypes?category=X` 取该类别的工作项类型，再逐个 `GET /projects/{id}/workitemTypes/{typeId}/fields`，按字段 id 合并（首个出现的 name/format 胜出，最多 10 个类型）。返回 `{id,name,format,required,kind,options}`，是本项目真正配置的字段（含 `priority`、`story_points`、`progress`、自定义六位/日期字段），供“表头设置”按平台名字列出；`category` 不接受逗号多值 |
| 列表字段来源 | search 已返回 `customFieldValues`（25/25 条与详情逐字段一致，仅数组顺序不同）、`labels`/`sprint`/`participants`/`assignedTo`/`status` 等；**只有 `description`（恒 `""`）与 `formatType`（恒 `null`）必须补详情** |
| `category` | 必填且不能为空（空串/缺省 400「工作项类型不能为空」）；支持逗号多值 `Req,Bug,Task`（一次拿 7908 条）；**不能带空格**（`"Req, Bug"` 静默只取 Req）、大小写敏感（`req` → 0 条） |
| 分页 | `perPage ≤ 200`；**`page × perPage ≤ 10000`**，超出 400 并提示缩小筛选范围；列表请求在发请求前就拒绝越界窗口 |
| 排序 | `orderBy` 只接受字符串（`gmtCreate`/`subject`/`status`/`priority`/`assignedTo`）；控制台那种对象形式报 400 `Invalid format for field: orderBy` |
| 详情区块 | `GET /workitems/{id}`（描述）、`/comments`、`/activities`、`/attachments`、`/relationRecords?relationType=PARENT\|SUB\|ASSOCIATED\|DEPEND_ON\|DEPENDED_BY`（缺 `relationType` 报 400）。某区块失败只记入 `sectionErrors`，其余区块照常返回 |
| 描述预填 | RPC `getWorkitemDescription`（`GET /workitems/{id}` + `include:['description']`）只返回解包后的 `{format,html,plain}`；“更多任务”行的「启动/同步」仅在设置勾选了「描述」时才调用它，一次一请求 |
| 筛选字段补充实测（2026-10-09） | `creator`（`user`/`list`，EQUALS）可用（x-total=8，逐条匹配）；`statusStage`（`statusStage`/`list` 与 `status`/`list` 均可，EQUALS）可用（x-total=83，逐条匹配）；`gmtCreate` BETWEEN 可用。**`participants`（`user`/`list` 与 `multiUser`/`list`，CONTAINS）返回 200 且 x-total=0**，而样本工作项确实带该参与人 —— 静默失效，因此界面不提供「参与人」筛选（对照：`assignedTo` 同参数可用）。筛选栏固定「1 个标题搜索 + 最多 2 个条件」，全部放进同一个 `conditionGroups` 组（AND）；可选字段在设置页勾选 |
| 描述载体 | 真实 `description` 是 **JSON 字符串** `{"htmlValue":"<article…>","jsonMLValue":[…]}`，不是 HTML；列表接口里恒为空。适配器解包后取 `htmlValue`，绝不把 JSON 外壳当正文 |
| 评论格式 | `contentFormat` 不可信：实测 25/25 为 `RICHTEXT` 但内容不是 HTML（是 Markdown 风格纯文本）；方言按内容首字符判定 |
| 关联项 | `relationRecords` 只返回 `{id, relationType, resourceType, resourceId, gmtCreate}`，**不含标题/编号**；`resourceType` 实测是类别（`Req`/`Bug`），与文档示例的 `WORKITEM` 不符；取标题需再 `GET /workitems/{id}`（`expandRelations` 有界展开） |
| 子项 | 无独立接口；用 `relationRecords?relationType=SUB`（实测与 `parentId` 反查一致）；控制台的 `scope:"child"` 开放 API 不认 |
| 附件 | `/attachments` 返回 `url`（OSS 签名，实测**约 1 分钟有效**，GET 不带 token 可下载）与 `embedUrl`（前端路径，401）；签名 URL 必须即取即用，不落库 |
| 描述内嵌图片 | **取不到**：`devops.aliyun.com/projex/api/workitem/file/url?fileIdentifier=…` 六种鉴权变体全部 401 `invalid session`；且实测 8 条带图工作项的 `/attachments` 均为 0 条，无法用附件签名 URL 绕过 |
| 与云效 MCP 的关系 | 官方托管 MCP（`https://openapi-rdc.aliyuncs.com/ai/mcp`）实测 131 个工具，与上述 REST 端点一一对应；其 `search_workitems` 的 `includeDetails` 在 REST 上**被静默忽略**，是 MCP 服务端自己补的详情请求——与插件“按需补详情”是同一做法 |

Fixtures：`tests/fixtures/sync-api/yunxiao-query-*.json` 依据上述实测响应构造（已匿名化：人名、组织/项目/工作项 id、OSS 地址均为占位值），不代表新账号的联调结果。

### 未确认 / 限制

- **Region 模式不支持**：无官方 origin 证据且 transport 仅放行中心 host；工厂对 `mode=region` 直接报 `InvalidConfig`，不猜测任意 host。
- **可选字段（priority/tags/storyPoints）禁用**：priority 读取需 field meta、labels GET 不证明 PUT tag key、points 无确切 key；`candidateFields` 为空。`OptionalFieldCandidate` DTO（`dto.ts`）与闭包校验已就位，供后续有证据时填充，控制器评审后再消费。
- **无 CAS/幂等**：`evidence` 返回 `unknown`，写效果核对属 Task 7。
- **状态转换**：公开 state 候选不证明转移可执行；写入按映射 ID，被 workflow 拒绝时报 `WorkflowRejected`。
- **filters 编码（已实测可用）**：`conditions` 为 JSON 字符串 `{"conditionGroups":[[filterObject…]]}`；**组间 OR、组内 AND、`value` 数组内 OR**。filterObject 键为 `fieldIdentifier`/`operator`/`value`/`toValue`/`className`/`format`，实测通过的组合：`assignedTo`(user/list, EQUALS|CONTAINS)、`status`(status/list)、`sprint`(sprint/list)、`workitemType`(workitemType/list)、`priority`(list/list)、`tag`(tag/multiList)、`subject`(string/input)、`gmtCreate|gmtModified|updateStatusAt`(dateTime/input, BETWEEN 需 `toValue`)。空 `conditionGroups` 等于不过滤；裸数组报 400；`advancedConditions`/`extraConditions`/`groupCondition` 被静默忽略。因此发现阶段使用服务端筛选（`ruleConditions`），不再全量拉取后客户端过滤。`assignedTo` 是官方 GetWorkitem 详情的 `{id,name}` 字段（见 [GetWorkitem](https://help.aliyun.com/zh/yunxiao/developer-reference/getworkitem)）。

### Fixtures 来源

`tests/fixtures/sync-api/yunxiao-center-*.json` 依据官方文档只读研究构造，非真实账号样本，不代表联调结果。官方链接见 `docs/superpowers/plans/2026-10-07-project-management-sync-capabilities.md` 云效现代 Projex 小节。

## TAPD 公有云

实现：`src/sync/adapters/tapd.ts`（适配器）、`src/sync/adapters/tapd-codec.ts`（unknown → RemoteItem/SyncMetadata 解码器）。origin 固定 `https://api.tapd.cn`，HTTP Basic Auth（`Authorization: Basic base64(user:password)`，在工厂内从连接引用的 `userEnv`/`passwordEnv` 解析，缺失即报 `CredentialMissing`，凭据不进入任何 DTO）。`company_id` 用于列出项目，`workspace_id` 即规则的 `projectId`；`RemoteKey.instance` 用公司 ID，`id` 全程字符串（超大数字 ID 不转 Number）。

### 已实现（fixture 契约测试覆盖）

| 能力 | 路由 | 说明 |
| --- | --- | --- |
| 列表/详情 | `GET /stories`、`/bugs`、`/tasks`（`workspace_id[&id]`） | 同一集合；响应 `data` 为 `[{Story\|Bug\|Task}]` 单键包装数组，shape 不符（对象、错误包装、非对象元素）拒绝为 `InvalidRemoteResponse`；详情 0 条报 `RemoteUnavailable`、多条报 `InvalidRemoteResponse`；`id`/`workspace_id`（存在时）与请求身份校验，跨项目拒绝；状态经 `readStates` 归一化，未映射报 `MappingIncompatible`；`modified` 作为不透明 token 保留（不解析时区），`revisionToken` 为 null |
| 标题字段 | — | Story/Task 用 `name`，Bug 用 `title`；负责人筛选字段 Story/Task 用 `owner`，Bug 用 `current_owner` |
| 更新 | `POST /stories`、`/bugs`、`/tasks` | `application/x-www-form-urlencoded`，仅写补丁字段（sparse），恒带 `workspace_id`+`id` 字符串；标题按类型字段名，描述经 `observed.description.roundTrip` 门禁后按 richtext 编码；priority→`priority_label`、tags→`label`（`\|` 连接，仅映射已有候选，不自动建标签）经 `valueMaps` 编码，未映射报 `MappingIncompatible`；状态回写经工作流门（见下）；2xx 时校验业务 `status===1` 才返回 void，非 1 按权限→`AuthDenied`、其余→`WorkflowRejected`；空体 2xx 报 `WriteOutcomeUnknown`；非 2xx 404→`RemoteUnavailable`、429→`WriteOutcomeUnknown`、其余→`WorkflowRejected`，不回显响应体 |
| 业务状态 | 顶层 `{status,info,data}` | `status` 为数字且 `1` 才成功；HTTP 200 但 `status!==1` 读路径按 `info` 静态分类：权限→`AuthDenied`、未开通→`EntitlementUnavailable`、其余→`InvalidRemoteResponse`（`info` 仅宿主侧分类用，绝不回显/入库/记日志）；写路径权限→`AuthDenied`、其余→`WorkflowRejected` |
| 分页 | 集合列表 | 实体发现用 ID cursor：首请求 `limit=200`+`order=id desc`+`page=1`，后续 `limit=200`+`order=id desc`+`cursor=<上页最后id>`（省略 `page`，能力标签 `paging:{kind:'cursor'}` 与实际请求一致）；短页终止；满页 cursor 重复/不前移/末项 id 畸形报 `IncompleteDiscovery`；单页返回超过 `limit` 报 `InvalidRemoteResponse`；不再有 page100/20000 深度截断（官方 read guide 支持 ID cursor，不静默截断 20k+1）。workflows/iterations/workitem_types 等元数据集合仍按 `page` 参数单独有界获取，与实体 cursor 分开 |
| 筛选 | 列表项客户端 | 四维 AND / 值 OR：`typeIds`（映射级，story 子类型按 `workitem_type_id` 过滤）、`statusIds`（原始 status）、`assignees`（owner/current_owner）、`iterationIds`；负责人或迭代在非空筛选下**缺失/空串/畸形**报 `InvalidRemoteResponse`，显式 null 视为无值排除，不静默置零 |
| 项目/成员/迭代 | `GET /workspaces/projects?company_id`、`/workspaces/users?workspace_id`、`/iterations?workspace_id` | 无分页裸集合；`data[{Workspace\|UserWorkspace\|Iteration}]` 解码为 Option |
| 需求类型 | `GET /workitem_types?workspace_id` | `data[{WorkitemType:{id,name,entity_type,workflow_id}}]`；story 子类型按其实际 `workitem_type_id` 枚举为 `types`，`bug`/`task` 保留粗粒度别名；`metadata.types` 与 `typeCapabilities.typeId` 用实际子类型 id（不再用粗粒度 `story`）。启用具体子类型的 read/list 要求实体 `workitem_type_id` 必填且匹配（缺失/畸形报 `InvalidRemoteResponse`，发现时其它子类型跳过） |
| 工作流 | `GET /workflows?workspace_id&system_name=story\|bugtrace` | `data[{Workflow:{id,workspace_id,system_name,is_default,type}}]`，`type` 为 `classic`/`bpm`；story 按子类型 `workflow_id` 匹配、bug 按 `is_default=1`（或唯一工作流）解析；`classic` 才开放状态回写，`bpm`/未知/歧义 `workflow:{readOnly:true}` 且 `writeStates:[]` |
| 状态候选 | `GET /workflows/status_map?workspace_id&system=story\|bug`（story 必传 `workitem_type_id`） | story/bug 的 `readStates` 来自 `status_map`（`data` 为 `{status_id:label}` 映射）；仅 task 的 `readStates` 来自 `fields status.options` |
| 字段候选 | `GET /{stories\|bugs\|tasks}/get_fields_info?workspace_id` | `data[fieldName]` 配置映射；`priority_label`→`priority`、`label`→`tags` 候选（`writable:true`，读写已接线）；读经 `valueMaps` 逆映射解码（priority 逆映射歧义/未知标签报 `MappingIncompatible`，tags 按 `\|` 拆分逆映射或恒等）；`storyPoints` 无已证字段，不出候选 |

### 副作用门与限制

- **状态回写按 classic 工作流开放，BPM 拒绝**：写 status 前经 `GET /workflows` 解析 `type`（`classic`/`bpm`）并核对 `GET /workflows/all_transitions`（story 传 `workitem_type_id`、bug 传 `system=bug`）的 current→desired 边。官方流转字段为 `StepPrevious`/`StepNext`/`Name`/`Appendfield[{FieldName,Notnull=yes|no,DefaultValue:[{Type,Value}|{Type,Field}]}]`/顶层 `AuthorizedUser`，`data` 容器畸形（只接受单对象或直接对象数组，无 `WorkflowTransition` 包装）。`classic` 且边存在且 `Appendfield` 无必填(`Notnull=yes`)/无默认(`DefaultValue` 非空数组)、顶层 `AuthorizedUser` 为空时，随附副作用旗标 `is_auto_close_task=0`（story）、`keep_owner=1`（bug）、`auto_complete_effort=0`（task，显式 0，不默认猜测）后 POST；`bpm`/未知工作流/必填字段/授权用户/边 `workflow_id` 与解析工作流不符拒绝为 `WorkflowRejected`；流转数据畸形（含字符串 `DefaultValue`）报 `InvalidRemoteResponse`（不猜合法边）。story 状态回写要求已启用子类型（`workitem_type_id` 必填且匹配）。task 无工作流 API，固定状态（open/progressing/done）+ 显式 `auto_complete_effort=0` 回写。目标状态与观测原始状态同语义时不发状态 POST。
- **可选字段 priority/tags 写已接线**：`priority`→`valueMaps.priority` 映射远程 `priority_label`，`tags`→`valueMaps.tags` 映射远程 `label` 并以 `|` 连接；仅使用已映射的已有候选，未映射报 `MappingIncompatible`；新标签不自动建资源。`storyPoints` 无已证字段，不暴露可写。
- **无 CAS/幂等**：`evidence` 返回 `unknown`，写效果核对属 Task 7。
- **通知等风险已知**：`all_transitions` 的 Inform 通知不做“恰好一次”保证，仅记录为已知平台通知风险，不发明工作流 DSL。
- **未联调**：所有 fixture 依据官方文档只读研究构造（非真实账号样本），未做实际 read/write/workflow 副作用验证；`all_transitions` 官方示例容器畸形（直接对象序列），本实现只接受单对象或直接对象数组、不猜测 `WorkflowTransition` 包装，该容器歧义已在本节保留说明；`workflow_id` 字段（用于边作用域核对）与具体 `info` 文案未联调核对（写路径畸形即 fail-closed）。

### Fixtures 来源

`tests/fixtures/sync-api/tapd-*.json` 依据官方文档只读研究构造（顶层 `{status,info,data}`、`data[{Story|Bug|Task}]` 单键包装、fields info 的 `data[fieldName]`、`workflows` 的 `data[{Workflow}]`、`status_map` 的 `data{status_id:label}`、`workitem_types` 的 `data[{WorkitemType}]`、`all_transitions` 的 `data` 为单对象或直接对象数组，字段 `StepPrevious`/`StepNext`/`Appendfield`/`AuthorizedUser`），非真实账号样本，不代表联调结果；官方链接见 `docs/superpowers/plans/2026-10-07-project-management-sync-capabilities.md` TAPD 公有云小节。
