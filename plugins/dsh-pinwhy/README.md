# dsh-pinwhy

[Pinwhy](https://github.com/Fruit-Guardians/pinwhy) 的 DeepSeek Harness（DSH）插件，源码位于 `plugins/dsh-pinwhy/`。插件通过子进程调用独立安装的 `pinwhy` CLI，不内嵌内核或复制 Skill。

## 环境要求

- DeepSeek Harness：`>=0.2.2-rc.2 <1.0.0`
- Node.js：`^22.19.0 || >=24.0.0`
- 已独立安装的 `pinwhy` CLI（通过 `pinwhy capabilities --json` 校验能力声明）

## 功能概览

- **11 个原生工具**：覆盖诊断、状态读取、上下文恢复、节点读写、有向连边、游标移动、检查点、结构化检索（`pinwhy_search`）和原子批量写入（`pinwhy_batch`）。
- **内嵌只读画板**：在 DSH 左侧导航或会话顶部菜单打开「Pinwhy 画板」，通过临时只读服务（`serve --read-only --ephemeral`）加载通用（2D / 2.5D）、审计与 Ultra 覆盖面视图及历史检查点，跟随宿主主题和语言设置，并支持将选中节点作为引用插入当前会话草稿。
- **动态 Skill 加载**：直接读取 CLI 声明的 `resources.skill` 目录，不维护第二份 Skill 副本。
- **宿主写策略校验**：写入前校验 `capabilities.writeTargets` 真实路径与宿主 `sandboxPolicy`，不绕过只读或工作区边界。

## 安装与配置

### 1. 安装 Pinwhy CLI

参考 [主仓库文档](https://github.com/Fruit-Guardians/pinwhy#quick-start) 安装 `pinwhy`（支持 `npm install -g pinwhy` 或 `release install`）。

### 2. 安装 DSH 插件

```sh
dsh plugin --profile web add /path/to/pinwhy/plugins/dsh-pinwhy
```

也可在 `plugins/dsh-pinwhy` 目录执行 `npm pack` 后从 `.tgz` 安装。

### 3. 初始化并启用项目

插件默认 `projects: []`，不会自动初始化任何目录。先初始化目标项目：

```sh
pinwhy init --cwd /path/to/your-project --json
```

在 DSH「插件 → Pinwhy · 外置黑板 → 配置」中添加工作区，或通过 patch 文件应用：

```yaml
- id: pinwhy
  config:
    projects:
      - workspace: /path/to/your-project
        boardRoot: /path/to/your-project
```

```sh
dsh web --patch /path/to/pinwhy-project.patch.yml
```

## 配置项

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `projects` | `[]` | 显式启用的项目列表，每项包含 `workspace` 与可选 `boardRoot` |
| `autoDiscover` | `false` | 未配置 `projects` 时，是否向上查找已存在的 `.pinwhy` 目录（不自动初始化） |
| `runtimeCli` | 默认安装路径 | `pinwhy.js` 绝对路径 |
| `nodeExecutable` | `process.execPath` | Node 可执行文件路径 |
| `timeoutMs` | `10000` | 单次 CLI 调用超时（`50`–`120000` ms） |
| `maxOutputBytes` | `1048576` | 单次输出上限（`1024`–`16777216` bytes） |

写入作者标识固定为 `dsh:<session.id>`。

## 工具列表

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `pinwhy_diagnose` | 无 | 只读检查 CLI、黑板状态与宿主写策略，返回 `pinwhy.diagnostics.v1` |
| `pinwhy_status` | 无 | 查询黑板与查看器状态 |
| `pinwhy_context` | `budget`, `depth`, `focus`, `since`, `asOf`, `agentId`（可选） | 读取 `pinwhy.context.v2` 只读恢复上下文 |
| `pinwhy_node_get` | `id`, `asOf`（可选） | 读取单个节点与关联边 |
| `pinwhy_node_add` | `type`, `title`, `to`, `relateHere`, `relation`, `label`, `reason`, `requestId`, `rejectTruncation` 等 | 创建节点（默认不移动游标、不自动连边） |
| `pinwhy_node_patch` | `id`, `clear`, `requestId`, `rejectTruncation` 及待修改字段 | 更新或清空指定字段 |
| `pinwhy_link` | `from`, `to`, `relation`, `label`, `requestId`, `rejectTruncation` | 创建有向边 |
| `pinwhy_cursor` | `id`, `reason`, `requestId`（可选） | 移动当前会话游标或清空（`none`） |
| `pinwhy_checkpoint` | `summary`, `trigger`, `requestId`, `rejectTruncation` | 记录交接检查点 |
| `pinwhy_search` | `query`, `type`, `types`, `status`, `severity`, `confidence`, `relation`, `relatedTo`, `groupBy`, `asOf`, `tags`, `limit` | 只读搜索与分组检索 |
| `pinwhy_batch` | `operations`, `requestId`, `rejectTruncation`（可选） | 原子执行多条写入操作 |

## 测试

在 `plugins/dsh-pinwhy/` 目录下运行：

```sh
npm run check
PINWHY_TEST_CLI=/path/to/pinwhy/bin/pinwhy.js npm test
```

需要本地 DSH 环境或浏览器环境的附加检查：

```sh
npm run verify:profile
npm run verify:settings
PINWHY_TEST_CLI=/path/to/pinwhy/bin/pinwhy.js npm run verify:viewer
npm run verify:e2e   # 会使用本地 DSH 配置发送真实模型请求
```

桌面端附带运行时验证（macOS 示例）：

```sh
DSH_RUNTIME_MANIFEST='/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/package.json' \
ELECTRON_RUN_AS_NODE=1 \
'/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness' \
scripts/verify-dsh.mjs
```

## 卸载

```sh
dsh plugin --profile web remove dsh-pinwhy
```

卸载插件不会删除项目内的 `.pinwhy/` 数据或独立安装的 `pinwhy` CLI。

## 许可

[MIT](LICENSE)
