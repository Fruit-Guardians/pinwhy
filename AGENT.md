# AGENT.md

Pinwhy 的核心设计约束。改动仓库代码时按以下优先级执行。

## 核心约束

### 1. `.pinwhy/events.jsonl` 是唯一事实源

- 所有状态变更以追加事件写入 `.pinwhy/events.jsonl`，支持完整回放。
- `state.json` 仅为加速读取的本地缓存；缓存落后或损坏时必须由事件日志完整重建，写缓存失败不得导致已落盘事件报错。
- CLI 摘要、`context`、HTTP 快照与前端视图均为事件日志之上的只读投影，不得引入第二套权威存储。
- 跨进程写锁使用原子目录与唯一持有者标记；不抢占存活进程锁。回放遇到损坏行时跳过并计数，通过 `lint` 报告，不静默丢弃。

### 2. 显式图模型与正交属性

- 逻辑层（`node` / `edge`）、游标层（`cursor` / `trail`）与活动层（`activity`）相互独立。
- `severity`、`status`、`confidence` 三个字段正交存储（字符串或 `null`），不由节点类型或其他字段推断。
- 节点类型和关系名称不构成状态机；未知类型与自定义关系必须原样保存。

### 3. 只读恢复，不干预 Agent 决策

- 系统只记录和呈现已有数据，不替 Agent 推断边、打分或决定下一步。
- `lint` 始终以退出码 `0` 返回，仅做报告，不阻断操作。
- `context` 输出固定保留 `readOnly: true`、`prescriptive: false`、`nextStepSelection: "agent-controlled"`。
- 创建节点默认不自动连边、不自动移动游标；仅在显式传入 `--enter`、`--relate-here` 或 `--to` 时生效，默认关系为 `related-to`。
- Hook 与后台服务均为可选组件；未安装时 CLI 的核心读写、检查点与导出功能保持完整可用。

## 分层边界

| 层级 | 目录 / 文件 | 职责与边界 |
| --- | --- | --- |
| 事件日志 | `.pinwhy/events.jsonl` | 唯一事实源，仅追加写入 |
| 内核 | `bin/`、`lib/` | 唯一写入入口；零第三方运行时依赖，不导入宿主或前端代码 |
| 公开契约 | CLI 参数、`--json` schema、`lib/domain/contracts.js`、`skills/` | 兼容新增不升版本；修改语义或删除字段须升版本 |
| 宿主适配 | Skill / Hook、`plugins/dsh-pinwhy/` | 通过公开 CLI / HTTP 契约调用内核，不复制内核或 Skill 源码 |
| 视图呈现 | `web/`、`public/`、离线导出 | 事件日志投影；浏览、筛选、切换模式与时间轴均不写入事件 |

### 关键模块约定

- **SDK 与领域模型**：`lib/domain/model.js` 保持零 `import` 且不依赖 Node 专有 API，供 CLI、服务端与浏览器共用。`lib/core.js` 聚合 `pinwhy-core` 根导出；打包时由 `scripts/packaging/pack-packages.mjs` 从 `lib/` 生成发布包，不维护第二份实现。
- **可选 Ultra 台账**：`bin/pinwhy-ultra.js` 与 `lib/ultra/*` 管理文件切片覆盖台账（`.pinwhy/ultra/ledger.jsonl`），不写入或替代 `.pinwhy/events.jsonl`，详见 [Ultra 协议说明](skills/pinwhy-ultra/references/protocol.md)。
- **Web 协作写入**：工作台编辑仅提交变更字段并在写锁内校验基准（冲突保留草稿，不自动覆盖）。每次写请求携带幂等 `requestId`，结果不确定时先核对日志回执再重试。

## 安全与隐私

- `pinwhy init` 自动在 `.pinwhy/` 下写入 `.gitignore`（`*`），防止敏感调查记录误入版本库。
- 公开仓库中的测试、演示与截图只允许使用合成数据；不得提交真实任务记录、个人绝对路径或凭据。
- 提交或推送前运行 `npm run check:publish`（可通过 `git config core.hooksPath .githooks` 启用提交与推送钩子）。
- 本地 HTTP 写接口必须保留三项校验：loopback `Host` 校验、同 `Origin` + `application/json` 校验、`256KB` 请求体上限；`--read-only` 与离线导出保持纯只读。
- 原始工具活动采集默认关闭；显式开启时默认启用脱敏。

## 相关文档

[README](README.md) · [文档目录](docs/README.md) · [仓库架构](docs/architecture/README.md) · [架构决策](docs/decisions/README.md) · [贡献指南](CONTRIBUTING.md) · [DSH 插件](plugins/dsh-pinwhy/README.md) · [界面说明](design/UI_SYSTEM.md)
