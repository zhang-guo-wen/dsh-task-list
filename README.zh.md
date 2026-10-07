# DSH 任务列表

[English](<README.md>) | 中文

在 DeepSeek Harness 内集中管理任务，把待办、暂存消息和 AI 会话放在同一个工作流里。

## 解决了什么问题

任务原本散落在笔记、聊天记录或其他工具里，开始处理时还要切换应用、查找上下文，再把内容复制到 Harness。

本插件把任务管理直接带进 Harness：

- **集中管理任务**：在侧边栏「任务列表」中查看待办、进行中和已完成任务，按工作区筛选、搜索和分页浏览。
- **从任务直接发起会话**：点击「启动」，在所选工作区创建会话，自动带入任务内容和附件；可指定 Agent，或选择使用 Worktree。
- **暂存未发送的消息**：在对话输入框按 `Ctrl+S`（macOS 为 `Cmd+S`），把文字、图片和文件存成任务，稍后再处理。默认关联当前会话，保存成功后清空已保存的输入，并在页面顶部提示；失败时保留输入。
- **保留任务上下文**：支持富文本、附件、优先级、标签、故事点和会话关联，并记录创建、开始与完成时间。

**后续计划**：打通云效、TAPD 等项目任务管理软件，让项目任务与 Harness 内的处理流程衔接。当前版本尚未提供这些集成或第三方任务同步。

## 截图

![Harness 内的任务列表：状态筛选、工作区筛选、搜索与启动/完成操作](<docs/screenshots/task-list.jpg>)

任务列表展示任务内容、状态和所属工作区，可直接点击「启动」或「完成」。截图由实际使用界面提供，具体外观以安装版本为准。

## 安装

### 环境要求

- 已安装 DeepSeek Harness **0.2.0-rc.1 或更新版本**，Web 端提供工作区控制器。
- 安装到运行 Web 界面的 **`web` profile**。
- Node.js **`^22.19.0` 或 `>=24.0.0`**（使用内置 `node:sqlite`）。
- 仅在启用「使用 Worktree」时，需要在同一 profile 安装并启用 **`@guowenzhang/dsh-worktree` 1.x 或 2.x**。

### 从 npm 安装

使用已安装的 Harness CLI：

```sh
dsh plugin --profile web add @guowenzhang/dsh-task-list
```

包地址：[@guowenzhang/dsh-task-list](https://www.npmjs.com/package/@guowenzhang/dsh-task-list)。

安装后重启对应的 Harness 宿主并刷新页面，点击侧边栏「任务列表」。如果 Web 界面运行在其他 profile，请将命令中的 `web` 替换为实际 profile 名称。

### 最短使用流程

1. 点击「新建任务」，填写内容，按需选择工作区、Agent 和启动选项，然后保存。标题自动从内容生成，无需单独填写。
2. 点击「启动」创建会话。默认只把内容和附件填入输入框，供你检查；开启「立即发送」后才会直接发送。
3. 处理结束后点击「完成」。也可在编辑弹窗中调整状态、选择或清除关联会话。
4. 暂时不想发送的消息，在对话输入框按 `Ctrl+S` / `Cmd+S` 存为任务。

### 本地开发安装

在本仓库目录执行：

```sh
npm ci
npm run typecheck
npm test
npm run build
dsh plugin --profile web add 'link:/absolute/path/to/dsh-task-list'
```

将链接路径替换为本机绝对路径；Windows 示例为 `link:C:/path/to/dsh-task-list`。修改后重新构建并刷新页面；宿主代码变化还需重载插件或重启宿主。维护说明见 [AGENTS.md](https://github.com/zhang-guo-wen/dsh-task-list/blob/main/AGENTS.md)。

## 注意事项

- **数据保存在本地**：任务和附件使用插件独立的 SQLite 数据库，默认位于 `<DSH_HOME>/task-list/tasks.sqlite`（通常为 `~/.dsh/task-list/tasks.sqlite`）。不会直接修改 Harness 会话日志或查询索引，也不自动同步单会话的 `todo/write` 清单。可在 Cordis 配置中用 `file` 指定其他绝对路径。
- **升级前备份**：数据库会自动迁移，迁移后旧版插件不能打开。运行中请用 SQLite 备份 API 或 `VACUUM INTO`；停止 DSH 后可复制数据库及可能存在的 WAL 侧文件。升级后重启宿主，避免旧代码导致富文本或附件保存失败。
- **附件有限额**：最多 8 个，单个不超过 10 MiB，总计不超过 20 MiB。删除任务会同时删除其附件和子任务数据；只有文件名、未保存文件字节的历史附件需重新添加。
- **富文本不是完整 Office 导入**：粘贴网页或 Word 正文可保留常见格式、链接和表格，不保留完整字体、颜色和分页布局。外部网址或 Word 内部路径引用的图片不会自动下载，需手动添加；添加文档附件不会自动解析正文。
- **启动会新建会话**：启动后自动关联新会话并转为「进行中」；编辑弹窗允许再次启动已开始或已完成的任务，也会新建会话并替换关联。「立即发送」默认关闭，未关联工作区时使用默认工作区；已删除的工作区需重新选择。
- **Worktree 会操作 Git**：需要 Worktree 插件与 Git 工作区。非 Git 目录会提示更换工作区或确认「初始化并启动」，后者会创建 Git 仓库和首次提交，并将未选项目加入根目录 `.gitignore`。多个仓库的上层目录应改选具体仓库，操作前确认路径和文件选择。
- **子任务界面暂不可用**：当前版本保留子任务数据，但不在列表或编辑弹窗中展示、编辑。
- **卸载不删除任务数据**：执行下方命令只移除插件，已有数据库仍保留。

```sh
dsh plugin --profile web remove @guowenzhang/dsh-task-list
```

## 许可证

本插件采用 **Apache License 2.0**，详见 [LICENSE](<LICENSE>)。

浏览器构建包含采用 MIT 许可证的 Lexical，第三方声明见 [THIRD_PARTY_NOTICES.md](<THIRD_PARTY_NOTICES.md>)。
