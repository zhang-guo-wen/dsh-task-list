# DSH 任务列表

DeepSeek Harness Web 的原生任务列表插件：侧边栏增加「任务列表」，以卡片显示任务，支持优先级、故事点、标签和工作区，也可新建、编辑、筛选、切换状态和删除。点击卡片可编辑，右上角悬停显示删除按钮；卡片底部显示工作区与启动按钮。默认按待办、进行中、已完成排序。任务保存在插件独立的 SQLite 文件，不直接修改 Harness 会话日志或查询索引。

## 环境要求

- DeepSeek Harness 0.2.0-rc.1 或更新版本，且 Web 端提供工作区控制器
- Web profile
- Node.js `^22.19.0` 或 `>=24.0.0`（使用 `node:sqlite`）
- 启用「使用 Worktree」时，Web profile 还需安装并启用 `@guowenzhang/dsh-worktree` 1.x

## 从本目录构建安装

```powershell
cd C:\02-codespace\DeepSeek\dsh-task-list
npm ci
npm run typecheck
npm test
npm run build
dsh plugin --profile web add 'link:C:/02-codespace/DeepSeek/dsh-task-list'
```

重启 `dsh web` 并刷新浏览器，然后点击侧边栏「任务列表」。浏览器代码修改后重建并刷新；宿主代码修改后还需重启 Host。卸载命令：`dsh plugin --profile web remove @guowenzhang/dsh-task-list`。卸载不会删除任务数据。

默认数据库路径是 `<DSH_HOME>/task-list/tasks.sqlite`（通常为 `~/.dsh/task-list/tasks.sqlite`）。Cordis 配置可通过 `file` 指定其他绝对路径。插件启用 SQLite WAL 模式，任务更新带版本号，过期编辑会被拒绝。运行中备份请使用 SQLite 备份 API 或 `VACUUM INTO`；DSH 停止后复制 `tasks.sqlite` 以及可能存在的 WAL 侧文件。旧版数据库会在启动时自动迁移，原有任务状态保留，新增卡片字段使用默认值。

任务提供「待办」「进行中」「已完成」三态。第一次转入「进行中」时自动记录实际开始时间；转入「已完成」时记录实际完成时间。重新打开任务会清除完成时间，保留首次开始时间。旧任务的历史时间不会被推测填入。工作区选项取自 Harness 工作区列表，也可选择不关联工作区。

任务可设置 Agent、会话 ID、「立即发送」和「使用 Worktree」。「立即发送」默认关闭。点击待办任务的「启动」，会在关联的工作区创建新会话，将标题与描述填入对话输入框，自动绑定新会话 ID，并把状态改为「进行中」；开启「立即发送」后还会直接发送这段内容。选择 Agent 时会在首条消息前应用对应预设。启用 Worktree 时，通过 `dsh-worktree` 从所选工作区创建独立工作树和会话；任务的工作区字段仍指向原工作区。编辑表单会提示所选工作区尚未初始化 Git，但仍允许先保存任务。若点击启动时发现工作区不是 Git 仓库，会弹窗提供「更换工作区」或「初始化并启动」；弹窗只列出首层文件和目录，支持全选、全不选；勾选的目录及内容进入首次提交，未勾选项加入根目录 `.gitignore`，原有规则会保留。独立的嵌套 Git 仓库不可勾选。确认后会创建 `.git`、首次提交和 Worktree。如果所选目录只是多个仓库的上层目录，通常应改选具体 Git 工作区。启动前须先关联工作区。进行中任务显示「完成」按钮，点击后状态改为「已完成」；已完成任务显示只读状态。任务列表不镜像单会话的 `todo/write` 清单。

## 开发

`src/store.ts` 负责 SQLite 表结构、输入校验和读写；`src/task-service.ts` 通过 DSH 远程服务暴露宿主操作；`src/client/` 注册原生面板。数据库发现未知表或未来版本时会拒绝打开，不覆盖数据。行为测试使用临时 SQLite 文件。

```powershell
npm run typecheck
npm test
npm run build
```
