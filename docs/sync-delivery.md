# 云效 / TAPD 同步代码交付

## 当前状态更新（2026-10-08 凭据直填与组织下拉）

连接编辑页按反馈重做：① 去掉「返回列表」按钮，表单改为一张带边框的卡片，底部是「取消 / 保存连接」（左侧保留只读测试）；② 去掉连接名称字段（按「平台 · 组织/公司」自动生成），组织/公司 ID 不再需要手记——云效新增 `listSyncOrganizations` RPC，用官方 `GET https://openapi-rdc.aliyuncs.com/users/joinedOrgs` 列出当前令牌加入的组织并做下拉，调用失败时同一格保留手填/粘贴；TAPD 支持粘贴工作台地址自动取出公司 ID；③ 凭据改为在页面直接手写，由 `HostManualSecretStore` 存入宿主凭据存储（记录键 `task-list/connection-<id>-secret`），不写任务数据库、不回显、不再要求配环境变量，环境变量仍作为兼容回退。

验证：`npm test` 548/548、`npm run typecheck`、`npm run build` 通过；真实浏览器 fixture（Edge headless）覆盖无「返回列表」、粘贴地址解析、保存回列表与浅深色/390px。

## 旧状态更新（2026-10-08 同步入口与设置位置调整）

用户要求的三处界面调整已实现：① 任务页头部右侧只剩一块合并按钮——左半「新建任务」、右侧箭头下拉里的「同步」；② 未配置连接时点击「同步」不启动运行，只提示到设置页添加连接，任务页不再常显同步说明文字；③ 同步设置从任务列表的方案内弹窗改为宿主设置面板里的一页「任务同步」（`settings.section`，id `task-list-sync`）。

实现：新增 `src/client/sync/use-sync-panel.ts`（头部菜单与结果区共享状态，点击时才读取连接/规则范围）、`src/client/sync/SyncSection.tsx`（内联设置页，替代原 `SyncSettings.tsx` 弹窗）；`SyncControls.tsx` 改为导出 `SyncActions` 与 `SyncStatus`。新增运行时依赖声明 `@deepseek-ai/dsh-client-ui-settings`（dev + peer + `dsh.client.inject`，仅类型导入，产物中无运行时 require）。

验证：`npm test` 543/543（39 文件）通过；`npm run typecheck` 通过；`npm run build` 已更新 `lib/client.js`；真实浏览器 fixture 回归通过（头部合并按钮/菜单同步/未配置提示/内联设置页/保存/菜单 Escape 与焦点返回/浅深色/390px，Edge headless）。真实账号授权与业务写入仍未联调。

## 旧状态更新（2026-10-08 授权优先设置）

以下旧交付记录保留历史，不代表当前版本或安装状态。当前基础HEAD `2bcbab3abc8352f7a259a5de6d9a7c4377308332`、插件0.6.0、schema9，仍为未提交工作区。实际Web3082已安装链接到本工作区；本会话重载Web以加载OAuthRPC/回调，桌面profile未改变。最新完整测试498/498（35文件，13:17）；类型检查与构建通过。连接/规则两页、三步规则、默认官方授权和手动备用已实现。详细授权支持/限制以[能力矩阵](sync-capabilities.md)为准，真实平台账号授权及业务读写未联调。

## 旧交付状态（历史）

按用户“优先交付，不再增加流程”和“先交付代码，不改当前宿主”的选择，代码及构建产物保留在隔离工作区，分支 `main-905088`，基础 HEAD `2f525cc4a6320e0ae6cd3ff7049d8245e9efe87c`。未提交、合并、推送、打 tag 或发布，插件包版本仍为 0.5.0。

功能：一个手动“同步”按钮；官方公网云效 Projex / TAPD；连接与环境变量引用；项目、负责人、类型、迭代、状态过滤；双向状态映射与可选字段；五分支对比；富文本与本地附件保留；未知写入对账、跨 Host 租约、结果分页；独立外部标题和安全来源链接。数据库结构版本为 8。

## 最新验证

- `npm test`：27 个测试文件，463 个测试全部通过（2026-10-08 09:16:54，36.77 秒）。
- `npm run typecheck`：通过。
- `npm run build`：通过，已更新 `lib/index.mjs` 与 `lib/client.js`。
- `npm pack --dry-run`：9 个文件，约 273 kB；包括双语 README、许可证与能力矩阵，不包含任务数据库或凭据。
- 原生组件浏览器 fixture：设置、保存不执行、菜单优先 Escape、返回焦点、浅/深色、390px、外部独立标题与空描述保存通过。
- 既有富文本与附件浏览器回归：格式、保存重开、文件下载/移除、Ctrl+S 捕获及失败保留通过。
- 一次最终独立审查：4 项 Important 通过本会话一次测试驱动修复；未追加复审循环。修复了恢复基准吞远端独立变化、矛盾状态映射、非 Git 恢复来源丢失及只读连接失败误报成功。

## 未执行 / 使用边界

当前 DSH 的插件加载路径未改变，未重载或重启。此交付不是现有 GUI 已安装验收。真实云效/TAPD 账号、项目权限和实际回写未联调。只有用户授权的测试项目可进行真实写入。Node 22.19 最低运行时未实测；本次使用 Node 24.12。

TAPD 部分真实响应容器/权限空值仍待账号验证，未知形状保守拒绝；BPM、附加赋值和不明权限流转不写。云效区域模式未开放。远端附件不下载，本地附件不回写。未确认写入不盲目重发。

## 延后的小项

- 标签映射输入暂在失焦时提交，切换同类型规则时显示状态可进一步完善。
- 新规则重置可更彻底作废旧元数据请求；当前没有项目及完整映射不能启用。
- 部分错误用安全本地化说明加错误码，尚未完整呈现字段/操作/排障链接。
- 已知剩余任务数有时仍为未知；元数据查询无总预算但每次读取有界。
- 测试文件不全部纳入生产 TypeScript 检查；宿主源码测试配置需 `DSH_HOST_SOURCE`。
- 开发工具依赖有 4 项既有审计问题，未作未经验证的强制主版本升级。
- 语义比较中 JSON 键顺序等健壮性、旧 schema6 未知额外锁列保护及清理性能仍为维护后续项。

## 实现期间的判断与代价

以下从持久执行记录原样提取，包含所有 `Ruling:` 决策。部分早期方案已被后续裁定替代，最终以 schema8、逐实际请求安全检查、持续心跳和当前代码为准。
- Ruling: no automatic task commits; create review packages from uncommitted tracked+untracked task changes and retain ledger instead of deleting it at finish — user has not authorized commits and midnight is outside allowed18:00+ window — cost if wrong: manual integration/review packaging rather than commit-range simplicity.
- Ruling: Task0 repairs only baseline host-source resolution before Task1; apply task10 planned configurable DSH_HOST_SOURCE resolution now, use actual source and fail clearly if absent — user explicitly approved this prerequisite — cost if wrong: test config rework, not product behavior.
- Ruling: dependency audit vulnerabilities are baseline findings, no npm audit fix --force; assess fixed compatible dependency versions during relevant package tasks and record unresolved risks for final review — major Vitest upgrade is not incidental path repair — cost if wrong: development tool risk persists until separately validated.
- Ruling: Task12 tests validate installed docKey destinations and actual npm pack contents, not exact prose/wording grep tests — TDD good-tests prohibits change-detector human-prose tests, while spec requires usable bundled troubleshooting — cost if wrong: manual documentation review instead of brittle text assertions.
- Ruling: Task1 handoff uses explicit mappings array and platform discriminator plus type-only future dependencies; no imports of modules not created until later tasks — plan Supporting contracts otherwise leave compilation timing ambiguous — cost if wrong: type shape rework before dependent tasks, no remote side effects.
- Ruling: use actual SafeRunCounts imported/pulled/pushed/merged/unchanged/failed with matching SafeItemResult categories throughout later tasks — spec mandates user categories/count semantics, not English property spelling; plan shorthand had drift — cost if wrong: small internalDTO rename before RPC release, no user behavior/remote side effects.
- Ruling: fix Task1 missing output runtime validators now; actualRPC wiring belongsTask9, but validators/contracts must exist and be tested before downstream stores — required safe-output guard cannot be deferred as types — cost if wrong: extra sharedvalidationcode rather than late security rework.
- Ruling: pruneCompleted terminal histories include partial/failed/interrupted as well as successfulcompleted (neverrunning), pendingintents/baselines excluded — spec limits finishedhistory age/count and preserves unknown-evidence rather than infinitefailedsummaryretention — cost if wrong: oldfailedsummary needs longerretention policy, actualrecoveryfactsstillpreserved.
- Ruling: Task2 finalizeItem confirms only alreadydispatched/unknown intent tied to matchinglink/revision/taskgeneration/currentrunowner; futureTask7 mayexplicitlyadoptoldpending afterevidence — preparedintent cannotprove any remoteeffect, id-onlyconfirmation violatesstoreboundary — cost if wrong: recoverytask needs explicitadoption implementation rather than loose old-runmatching.
- Ruling: Task3 replaces Task2 temporary link-store snapshot/import helpers with sharedprojectors/rule-selectedprojection, stripsattachments, rejects missingtitle and honorsruleworkspace — pureplanner needsstoragebaseline toobeyidenticalcanonicalcontracts; currenttemporaryallfields/mapping1/contentfiles helpers otherwiseloadbearingdrift — cost if wrong: scopedlink-store rework reviewedTask3, no newproductscope.
- Ruling: Task4retry backoff uses1s then2s exponentialfornon-Retry-Aftertransientreads — approvedspec§6 explicitlysays指数退避 althoughbrief/reviewtreatedfixed1sascompliant; specbindingwins — cost if wrong: oneadditional boundedsecondwait, notdifferentretrycountorwrites.
- Ruling: transport.read rejects mutating/unknownreadOnly flag upfront ratherthansingle-attemptmutation fallback; write rejectsreadOnlytrue/GET — queryoperationmustnotcausebusinesswrite, closedhostcontractsecurity — cost if wrong: adapterroutingrequirescorrection beforeenable, no unintendedremote effect.
- Ruling: SyncAdapter.read(key,rule,signal) explicitly receives stable rule mapping instead of returningunsupportedessentialstate orlast-rulecache — currentrule-freecontract cannotnormalizeTaskStatus atread-back/executor; rawGETstatusobject isn'tlocalenum — cost if wrong: alladapter/testfuturecallerssignaturechange now, beforepublicRPC/versionrelease.
- Ruling: CloudPUTstatus scalar stringperofficialUpdateWorkitem, omitoptionalconditionswhenunrestricted andapplyallfourclientfilterdimensions — workerinterpretedGETshape/emptyarrayincorrectly; bindingofficialevidence wins — cost if wrong: fixture/APIcompatibilityrework butnoactualremoteeffects becauseunwired/no credentials.
- Ruling: additive OptionalFieldCandidate/typecandidateFields closedboundedDTO accepted for settings candidates; absentfieldemptybackwards fixturecompat internalonly — dynamicIDs cannotbe rawplatformpayload — cost if wrong: optionalUIcontractadjustmentsbeforewirepublishing.
- Ruling: assignedTo.id is officially documented in fullGetWorkitem response; compressedmatrixomission cannotdemonstrate unsupportedfield — freshofficialtableevidenceaccepted, plusruntimeABSENT vsNULL restrictedfilterguard addedtoavoidfalsezero ifactualschemaomits — cost if wrong: capabilityfiltererrors ratherthansilentlyundercounting, laterrealaccountfixture mayadjustpresencehandling.
- Ruling: cloudwrite429 conservativeWriteOutcomeUnknown notRateLimited ordinaryretryableerror — no uniquenonapplicationevidencefornon-idempotentworkflow writes, commonexecutor mustreconcile notresend — cost if wrong: extrasafereadback/pending instead ofimmediatefailedretry.
- Ruling: TAPD mustqueryactualtype/workflowchain andenableordinarysafeclassicstatusupdates; blanketstate-write-disabled doesn'tfulfill approved coreobjective — metadataAPIprovidesclassic/bpm proof; unsafe/ambiguoustransitionstillreject, Taskflags explicit0 — cost if wrong: moreofflinecontracttests/liveworkflowverificationrequired, noactualremoteeffectnow.
- Ruling: TAPD/workflows querysystem_name=bugtrace, notreviewer's shorthandbug; status_map stillsystem=bug — freshofficialget_workflows doc explicitlybugtrace/story, externalreviewtextcannotoverrideAPI — cost if wrong: endpointfixturescorrection beforeliveaccount.
- Ruling: advertisedpriority/tagswritability mustactuallyworkformappedexistingcandidates, notUIofferthenreject; points remainunsupported — specconditionalfields +officialGET/POSTproven meansminimalmappedwrites within scope — cost if wrong: typedcandidateDTO/codec complexity reviewedbeforeGUI.
- Ruling: TAPDtransitiondecoder onlydocumentedStepPrevious/StepNext/Appendfield/Notnull/DefaultValue/AuthorizedUser, strictdirectobject(s)data acceptedshape withexplicitcontainerambiguity; noinventedWorkflowTransitionwrapper orlowercasealias — officialfieldkeysclear evenmalformedexamplecontainer, permission/defaultnotignored — cost if wrong: unknownlivecontainer failsclosedpendingaccountschemafix ratherthanunsafeupdate.
- Ruling: TAPD actualIDcursor continuation required afterfirstpage, withstrictnoprogressguard and20k+1offlineproof — declaredpageguardwasnotapprovedcursorcapabilitydespitepartialreviewPASS; specbindscompletesupportedpaging — cost if wrong: unsupportedendpointcursorproducesexplicitIncompleteDiscovery, not silenttruncation.
- Ruling: activeownerclaim returns existingrunId read-onlyfornon-owner, expiredrun marksinterrupted andnewmanualrun newID withgenerationadvance; lease90sheartbeat10s perwrittenbrief — historyseparatesfailedrun/newusertrigger andoldintent retainsoriginalprovenance — cost if wrong: runUIhistory/continuation semanticsadjustment beforeRPCrelease, no ordinarywrite replay.
- Ruling: DATABASEschema7 versionedforwardmigration requiredforpre-Task7v6oldandintermediatecurrentv6 shapes; no packageversionbump — 'unreleasedonlytemp' cannotskipcompatiblemigrationandfutureversionguard — cost if wrong: extraDBmigrationtests/indexDDLwork, existingdata notsilentlyclobbered.
- Ruling: replaceunsafeadoptIntent callerbaseline/resultwithasyncactualreconcileAndAdopt(intentId,fence,adapter,signal), commitfence/taskversionCAS andpreserveoriginalbaseline — remoteeffectconfirmationisnotfullfieldssync, callerproofcan'tforceconfirm/newlocaledits swallowed — cost if wrong: Task8integrationchanges/read-onlyextraobservation, no blindworkflowreplay.
- Ruling: done() settleawait andoutsideFilter optionalinternalexecutionarg accepted, neededhostlifecycle/results withoutnewpublicexecuteentry — cost if wrong: internalname/typeadjustmentonly beforeRPCrelease.
- Ruling: workerTask8'per-adapterentry/per-page≤200afterdisable' rejected; actualHTTPpreflight viaAdapterFactory(connection,context.beforeRequest)+SyncTransporteachfetchattempt andcurrentownedrule closure required — approvedspecperrequestprecheckcan'tberuledaway — cost if wrong: factorysignaturebridges/adaptersintegrationtestwork, no unsafeafter-disable requests.
- Ruling: ownedrun-only concurrent10s heartbeatwhilelongawait required; stoprevoke marksruninterrupted beforefencewithdrawal — finiteHTTPretrybudget>90s lease soinlinebatchheart doesn'tmaintainhealthyownership — cost if wrong: cancellableClockloop/test scheduler complexity, no autosync timers.
- Ruling: scale testdeadline180s is boundedhangguardnotperformanceSLA; preserveeachactualrequestfreshenable/fence checks, do notadoptreviewerper-runcache/write-onlygate suggestion — safetybindingwins, observed10k30–60+s variesmachine/load — cost if wrong: slowerCIonfailure butnoafter-disableoutboundrequests.
- Ruling: completedownedrun releasesDBlockatomicallywithterminalrecord, newmanualsync immediate; pendingHint shouldpersistperitemviaexplicitDBschema8forwardmigration(ifcolumnadded) notunversionedchange — repeatedsyncusability/countproof boundary — cost if wrong: DBmigration/testwork andrunlifecycleinterfaces beforeRPCrelease.
- Ruling: schema8pendingerror backfill mustbindbothrun_id+canonical; don'trepairalready8unknownhistorybyblindreset — one-shot7→8migration scopednegativefixture fixesfutureforward correctness, actualuserDBuntouched — cost if wrong: alreadybadintermediate8tempflags notauto-fixed until explicit evidenced repair, no falsependingclear.
- Ruling: compiledstatementfreshqueries acceptableoptimization; scale180s/prune30s testtimeouts arehangguardsnotSLA andmustretainliteralbehavior assertions — cost if wrong: hungtesttakeslonger beforefailure, productionfreshfence/enablechecks intact.
Ruling: human2026-10-08~08:25 chose优先交付不再增加流程 afterdaylong complaint; switchremainingTasks10–12 toinline executing-plans, no pertaskimplementer/reviewer/rereview loops, onefinalwholebranchreview only; preserveapprovedfunctionality/safety/no commits/API/profilechanges — reducesrepeatedcontext/idlecycles — cost if wrong: fewerfreshper-taskreviews, behaviorTDD/fullsuite+finalreview retainsgates. ExistingRPCreviewcollectedonceclosed.
