# 云效 / TAPD 同步 API 能力证据

核对日期：2026-10-07。仅官方文档只读研究，无真实账号调用，不是联调证明。作为同目录实现计划的输入；实施时将已实现能力、fixtures来源和实测结果维护到 docs/sync-capabilities.md，不复制“已证”作为生产PASS。

## 云效现代 Projex

中心origin=https://openapi-rdc.aliyuncs.com，B=/oapi/v1/projex/organizations/{organizationId}；Region删除organizations段，使用官方实例origin。认证x-yunxiao-token，令牌权限与用户资源权限取交集。

| 能力 | 已证verb/path及数据 | 待证/执行门 |
| --- | --- | --- |
| 工作项发现 | POST B/workitems:search；body category、spaceId必需；conditions为JSON字符串；page/perPage(0–200默认20)、orderBy默认gmtCreate另有name、sort desc/asc；裸工作项数组 | 不支持多项目一次search；固定条件逐项目，末页next sentinel未证，合法total-pages或递增next才继续/结束 |
| 详情 | GET B/workitems/{id}；裸对象：id/serialNumber/subject/description/formatType/gmtModified/space/workitemType/status/assignedTo(id,name)/sprint/labels/customFieldValues | modified例为空字符串，无精度/时区保证；versions是业务发布关联不是CAS；缺字段不能默认空 |
| 项目 | POST B/projects:search；conditions字符串、page/perPage、sort/orderBy；裸数组 | 同分页头合同；extraConditions官方仅指UI ajax，不猜通用filter |
| 成员 | GET B/projects/{id}/members；query name/roleId；userId/userName/roleId/roleName裸数组 | 无文档分页；负责人用userId不是roleId |
| 迭代 | GET B/projects/{id}/sprints；status TODO/DOING/ARCHIVED、page/perPage；裸数组 | name仅curl出现参数表未列；不使用未证过滤 |
| 类型 | GET B/projects/{id}/workitemTypes?category=Req或Bug或Task；裸数组id/categoryId/enable等 | 按项目/类别，禁用类型不启用规则 |
| 字段 | GET B/projects/{projectId}/workitemTypes/{id}/fields；裸数组id/format/type/required/options | 映射候选读取/写入ID，priority读位置、标签更新key、故事点key须meta及fixture确认 |
| 状态 | GET B/projects/{projectId}/workitemTypes/{id}/workflows；对象defaultStatusId及statuses数组 | 没有transition edges；GET workitems/{id}/workflow额外tenant头文档矛盾，首期不用该接口猜鉴权 |
| 更新 | PUT B/workitems/{id}；平铺字段ID值；subject、description+formatType、status:id、priority:id；多值数组；无返回实体 | 成功body不解析JSON，必须GET回读；null/空串/[]清除、原子多字段、CAS/幂等均未证 |
| 标签候选 | GET B/projects/{id}/labels；page/perPage；裸数组id/name/color | GET字段labels与filter tag不等于已证PUT key，按meta确认 |

分页六header：x-next-page/x-page/x-per-page/x-prev-page/x-total/x-total-pages。合法x-page≥x-total-pages终止；有合法递增next继续；缺失/矛盾且无可靠终止证据报告IncompleteDiscovery。按gmtCreate固定排序没有快照一致性保证，去重不证明期间增删绝不漏项；未完成发现显式部分完成。

filters官方已示subject/status/assignedTo/creator/tag，filterObject包含fieldIdentifier/operator/value(array)/toValue/className/format。迭代/type的精确filter编码不能因GET有sprint/type就猜，meta/fixture确认或有界客户端筛选。不使用未证gmtModified增量高水位。

raw字段保留description+formatType(RICHTEXT/MARKDOWN)、customFieldValues(fieldFormat/fieldId/values identifier及displayValue)、status ID、labels ID。业务presence与规范值共同判变，审计时间不作唯一信号。workflow存在必填、角色/关系限制，公开state候选不证明转移可执行；本地优先是期望决策，不是绕过远端校验承诺。

官方链接：

- [SearchWorkitems](https://help.aliyun.com/zh/yunxiao/developer-reference/searchworkitems)
- [GetWorkitem](https://help.aliyun.com/zh/yunxiao/developer-reference/getworkitem)
- [SearchProjects](https://help.aliyun.com/zh/yunxiao/developer-reference/searchprojects)
- [Members](https://help.aliyun.com/zh/yunxiao/developer-reference/listprojectmembers)
- [Sprints](https://help.aliyun.com/zh/yunxiao/developer-reference/listsprints)
- [Types](https://help.aliyun.com/zh/yunxiao/developer-reference/listworkitemtypes)
- [Fields](https://help.aliyun.com/zh/yunxiao/developer-reference/getworkitemtypefieldconfig)
- [Type workflow](https://help.aliyun.com/zh/yunxiao/developer-reference/getworkitemworkflow-get-a-list-of-the-status-of-the-work-item)
- [Update](https://help.aliyun.com/zh/yunxiao/developer-reference/updateworkitem)
- [Labels](https://help.aliyun.com/zh/yunxiao/developer-reference/listlabels)
- [Domain](https://help.aliyun.com/zh/yunxiao/developer-reference/service-access-point-domain)
- [Workflow constraints](https://help.aliyun.com/zh/yunxiao/user-guide/workflow-status-flow-restriction-rules)
- [Error codes](https://help.aliyun.com/zh/yunxiao/developer-reference/error-code-center)

中心→Region有官方工单迁移，但没有已证old/new workitem映射或ID不变保证。实例身份改变、space/type失配可报需处理，不按编号/标题自动合并。读前GET→PUT→GET无CAS，残余竞态必须说明。

## TAPD 公有云

origin=https://api.tapd.cn，HTTP Basic Auth。JSON/form POST；GET URL encode。顶层{status,info,data}，数字status=1才成功。company_id是列出项目的必需参数，连接必须保存公司ID（不是API用户名），项目workspace_id单独保存。

| 能力 | Story | Bug | Task |
| --- | --- | --- | --- |
| list/detail | GET /stories?workspace_id[&id]；data[{Story}] | GET /bugs同参数；data[{Bug}] | GET /tasks同参数；data[{Task}]意图明确，官方例JSON畸形需fixture/只读核对 |
| update | POST /stories id+workspace_id；data.Story | POST /bugs；data.Bug | POST /tasks；data.Task |
| 标题/负责人 | name/owner | title/current_owner | name/owner |
| fields | GET /stories/get_fields_info?workspace_id | GET /bugs/get_fields_info?workspace_id[&all_options=1] | GET /tasks/get_fields_info?workspace_id |
| state | workflow/status_map system=story+workitem_type_id | workflow/status_map system=bug | fields status.options：open/progressing/done |
| priority_label | 读写已证，按meta候选 | 读写已证 | 读写已证 |
| label | 读写已证，多值竖线 | 读写已证 | 读写已证 |
| 迭代 | iteration_id读写已证，首期仅筛选 | GET已证，POST未列，首期不写 | iteration_id读写已证，首期仅筛选 |
| storyPoints | exact字段未证，size=规模不猜等价 | exact字段未证，不用size替代 | 无已证对应字段，不用effort替代 |

fields返回data[fieldName]配置，不是业务对象；含html_type/options/pure_options/readonly。description三类rich_edit，样例有null、HTML、空白字符串；Markdown协议/null清除/回读规范未证，保留absent/null/empty/whitespace及raw HTML，浏览器仅安全文本。仅格式已证可往返时开放描述回写，其余提供明确UnsupportedRepresentation，不能静默变文本。

| 共享元数据/证据 | 请求及响应 |
| --- | --- |
| 项目 | GET /workspaces/projects?company_id；category可选，无分页；data[{Workspace}] |
| 成员 | GET /workspaces/users?workspace_id；data[{UserWorkspace}]，无分页 |
| 迭代 | GET /iterations?workspace_id&limit&page&order；data[{Iteration}] |
| 需求类型 | GET /workitem_types?workspace_id；data[{WorkitemType}] workflow_id，绑定状态流程 |
| 工作流 | GET /workflows?workspace_id&system_name=story或bugtrace；data[{Workflow}] type classic/bpm |
| 状态 | GET /workflows/status_map?workspace_id&system=story或bug；story workitem_type_id必传 |
| 流转 | GET /workflows/all_transitions 同system；Appendfield/AuthorizedUser/通知等；示例容器畸形未证，不能猜合法transition |
| 历史 | GET /story_changes?workspace_id&story_id(max100)、/task_changes?workspace_id&task_id(max100)、/bug_changes?workspace_id&bug_id(max200)；仅辅助归因，不能唯一证明某次请求 |

通用分页limit≤200、page*limit≤20000，固定order=id asc/desc、filter、limit；cursor=上一页最后id，串行。bugs必须显式ID排序。若对应接口没有可靠cursor支持且范围超过上限则报告不完整，不静默截断为成功。modified样例YYYY-MM-DD HH:mm:ss无offset，仅证样例秒级，时区/真实精度/单调未证；原始字符串比较+业务快照，不new Date猜时区。

重要副作用门：

- Story并行流程写status会重置节点，未明确安全许可时拒绝状态回写；is_auto_close_task=1关闭关联任务，默认0，明确不启用。
- Task auto_complete_effort=1在done补齐工时，默认未证；必须明确关闭且验证，不能仅省略就保证无影响。
- Bug keep_owner=1用于保留处理人；按权限/流程核对其它赋值或通知条件，不能承诺纯状态setter。
- label不存在会自动创建。仅可映射已有候选；新标签值不自动创建平台资源。
- 无已证idempotency/CAS/ETag/唯一operation evidence；回读目标只能确认当前受控字段语义，不证明通知恰执行一次。未知写入不重发。
- 短长ID转换API不是迁移old/new映射；空详情不能区分权限/删除/迁移，不猜关联。

官方链接：

- [使用必读/分页](https://open.tapd.cn/document/api-doc/API文档/使用必读.html)
- [Basic auth](https://open.tapd.cn/document/api-doc/API文档/API配置指引.html)
- [Story get](https://open.tapd.cn/document/api-doc/API文档/api_reference/story/get_stories.html) / [update](https://open.tapd.cn/document/api-doc/API文档/api_reference/story/update_story.html) / [fields](https://open.tapd.cn/document/api-doc/API文档/api_reference/story/get_story_fields_info.html)
- [Bug get](https://open.tapd.cn/document/api-doc/API文档/api_reference/bug/get_bugs.html) / [update](https://open.tapd.cn/document/api-doc/API文档/api_reference/bug/update_bug.html) / [fields](https://open.tapd.cn/document/api-doc/API文档/api_reference/bug/get_bug_fields_info.html)
- [Task get](https://open.tapd.cn/document/api-doc/API文档/api_reference/task/get_tasks.html) / [update](https://open.tapd.cn/document/api-doc/API文档/api_reference/task/update_task.html) / [fields](https://open.tapd.cn/document/api-doc/API文档/api_reference/task/get_task_fields_info.html)
- [Projects](https://open.tapd.cn/document/api-doc/API文档/api_reference/workspace/projects.html) / [members](https://open.tapd.cn/document/api-doc/API文档/api_reference/workspace/users.html) / [iterations](https://open.tapd.cn/document/api-doc/API文档/api_reference/iteration/get_iterations.html)
- [Transitions](https://open.tapd.cn/document/api-doc/API文档/api_reference/workflow/get_workflow_all_transitions.html) / [workflow types](https://open.tapd.cn/document/api-doc/API文档/api_reference/workflow/get_workflows.html)
- [Priority](https://open.tapd.cn/document/api-doc/API文档/subject/custom_priority/)

## 实施前/验收门的处理

1. 文档容器明确处用官方脱敏fixture；畸形或缺省语义有疑问处记录待只读账号核验，不伪造真实sample。
2. 时间不作为增量高水位，不必等待时区证据才做全量同步；所有ID用字符串。
3. 精确状态/可选字段候选由实际项目metadata驱动，未证可回写字段不启用。必需字段若该类型不能安全回写，显示能力限制，不宣称完整双向支持。
4. Unknown只能语义确认或可信唯一操作证据恢复，没有证据继续pending；不给“强制成功”入口。
5. 类型/域/组织迁移不自动重绑。页面说明筛选只发现，范围仍含已关联项。
6. 只有授权测试项目可验证实际read/write/workflow副作用；fixture绿和API文档存在均不能写成已完成联调。
