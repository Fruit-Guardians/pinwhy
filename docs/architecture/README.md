# 仓库架构

仓库包含一份共享 Node.js 内核和三个独立产品面：随 CLI 分发的本地 Web 工作台（`web/`）、产品官网（`site/`）以及 DeepSeek Harness 插件（`plugins/dsh-pinwhy/`）。

## 目录结构

```text
pinwhy/
├── bin/                   # CLI 可执行入口（pinwhy、pinwhy-ultra）
├── lib/                   # Node.js 核心运行时（CLI、SDK、HTTP、Ultra、hooks 共用）
├── packages/              # npm 包清单模板（pinwhy-core、pinwhy-cli）
├── web/                   # 本地 Web 工作台源码
├── public/                # web/ 的预构建静态资源
├── site/                  # 独立部署的产品官网
├── plugins/dsh-pinwhy/    # DeepSeek Harness 宿主插件
├── skills/                # Agent Skills（pinwhy、pinwhy-ultra、pinwhy-code-audit）
├── scripts/               # 打包、检查、评测与演示脚本
├── test/                  # 单元、集成与契约测试（unit / integration / contracts）
└── docs/                  # 架构说明、决策记录与静态文档资源
```

## 内核分层（`lib/`）

`lib/` 内部保持无环单向依赖：

```text
domain/      纯数据模型、语义规则、契约常量、回执与静态检查（无文件 I/O）
  ▲
storage/     目录布局、事件编解码、日志文件、文件锁、事务与备份
  ▲
store.js     节点、关系、游标与检查点的读写接口
  ▲
queries/     上下文裁剪、检索、历史对比、摘要与图快照
exports/     离线 HTML、文本、Mermaid 与 SARIF 导出
ultra/       文件切片扫描、台账、缺口计算与调度
cli/ · http/ · server.js · services/ · hooks/ · release/
```

`lib/core.js` 作为 `pinwhy-core` SDK 的公共导出门面，`packages/pinwhy-core/package.json` 将子路径映射到 `lib/` 对应模块。

## 自动化架构检查

`npm run check:arch`（[scripts/checks/check-architecture.mjs](../../scripts/checks/check-architecture.mjs)）在本地与 CI 强制校验以下规则：

1. **领域层隔离**：[lib/domain/model.js](../../lib/domain/model.js) 保持零 `import`；`lib/domain/*.js` 不依赖文件系统、网络、子进程或其他上层模块（仅 `receipts.js` 使用 `node:crypto`）。
2. **运行时边界**：`bin/` 与 `lib/` 不导入 `web/`、`site/`、`plugins/`、`scripts/` 或 `test/`。
3. **工作台边界**：`web/src/` 不导入 `node:*` 或后端模块；内部按 `api/`、`canvas/`、`workspace/`、`panels/`、`scene3d/`、`components/` 划分。
4. **官网隔离**：`site/src/` 与 `web/src/`、`lib/`、`plugins/` 互不导入；[site/src/routes.mjs](../../site/src/routes.mjs) 统一维护路由与 SEO 元信息，供前端路由和静态预渲染共用。
5. **插件隔离**：[plugins/dsh-pinwhy/](../../plugins/dsh-pinwhy/README.md) 仅通过公开 CLI 与 HTTP 接口通信，不直接导入根仓库源码。
6. **无循环依赖与 SDK 闭包**：`bin/`+`lib/`、`web/src/`、`site/src/` 三个依赖图均不允许循环引用；打包前自动校验 `pinwhy-core` 导出入口的传递依赖闭包。

## 例外说明

1. **提交 `public/` 构建产物**：保证 `npm install -g pinwhy` 在零运行时依赖下即可直接运行 `pinwhy serve` 与离线 HTML 导出。CI 每次执行 `npm run build` 并校验 `public/` 无未提交变更。
2. **`plugins/dsh-pinwhy/client/index.js` 保持未打包 ESM**：按 DSH 插件客户端加载规范以惰性工厂形式挂载内嵌面板。
