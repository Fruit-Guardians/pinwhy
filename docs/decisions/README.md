# 架构决策记录（ADR）

记录仓库当前生效的关键结构取舍。

## ADR-01：单仓库单内核，不使用内部 npm workspaces

- **决定**：根目录维护唯一的 Node.js 运行时（`bin/` + `lib/`）与开发依赖，`packages/` 仅存放 `pinwhy-core` 和 `pinwhy-cli` 的发布清单模板；仅拥有独立依赖树和宿主生命周期的 `site/` 与 `plugins/dsh-pinwhy/` 保留独立 `package.json`。
- **原因**：CLI、HTTP 服务、Ultra 与 SDK 共用同一套回放、文件锁和契约代码，通过 [check-architecture.mjs](../../scripts/checks/check-architecture.mjs) 约束模块边界比拆分为多 workspace 更直接，无需维护跨包构建链。

## ADR-02：根包与 SDK 零运行时依赖，自动校验导出闭包

- **决定**：[package.json](../../package.json) 与 [packages/pinwhy-core/package.json](../../packages/pinwhy-core/package.json) 不声明运行时 `dependencies`；[pack-packages.mjs](../../scripts/packaging/pack-packages.mjs) 在打包时校验所有导出入口的传递依赖闭包，并要求 [lib/domain/model.js](../../lib/domain/model.js) 保持零导入。
- **原因**：确保 CLI 与 SDK 在受限或离线的 Node.js >= 18 环境中可直接安装运行。

## ADR-03：预构建工作台资源提交至 `public/`

- **决定**：`web/` 构建产物提交至根目录 [public/](../../public/)，由 CI 校验构建结果与仓库内容一致。
- **原因**：让用户安装 npm 包后无需本地安装 Vite 或前端工具链即可使用 `pinwhy serve` 和 `pinwhy export`。

## ADR-04：官网 `site/` 独立维护，路由集中于 `routes.mjs`

- **决定**：`site/` 不引用 `web/src/` 或 `lib/`，仅嵌入导出的静态演示页；中英文路由与页面元信息统一定义在 [site/src/routes.mjs](../../site/src/routes.mjs)，供 [router.jsx](../../site/src/router.jsx) 与 [prerender.mjs](../../site/scripts/prerender.mjs) 共用。
- **原因**：隔离官网与本地工作台的发布节奏，避免客户端路由与预渲染 HTML 出现不一致。

## ADR-05：DSH 插件通过公共 CLI / HTTP 契约集成

- **决定**：[plugins/dsh-pinwhy](../../plugins/dsh-pinwhy/README.md) 通过子进程调用 CLI、`capabilities --json` 能力探测及临时只读 HTTP 服务工作，不跨目录导入根仓库内部模块。
- **原因**：使宿主插件能够独立升级和发版，不受内核内部文件重排影响。

## ADR-06：`.pinwhy/events.jsonl` 为唯一事实源

- **决定**：所有变更经文件锁追加写入事件日志，[lib/storage/board.js](../../lib/storage/board.js) 中的 `state.json` 仅作可丢弃缓存，不一致时从事件日志完整回放重建。
- **原因**：保证进程中断或并发写入后的状态可恢复性，避免多份状态不一致。
