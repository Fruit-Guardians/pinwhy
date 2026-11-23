# 关键架构决策（ADR 索引）

这里记录长期生效的结构与边界取舍，帮助后续维护者理解"为什么这样放"，避免重复推翻或意外绕过约束。

## ADR-01：单仓库单内核，不把内部目录拆成 npm workspaces

- **决定**：保持根仓库一份 Node 运行时（`bin/` + `lib/`）与统一开发依赖，`packages/` 只放 `pinwhy-core` 与 `pinwhy-cli` 的包清单模板；只有需要独立版本、独立依赖矩阵与独立宿主生命周期的 `site/` 与 `plugins/dsh-pinwhy/` 拥有各自的 `package.json`。
- **原因**：CLI、HTTP 服务、Ultra 扫描与 `pinwhy-core` SDK 共享同一套状态回放、文件锁与契约实现。拆成内部工作区会强行制造跨包边界与第二份兼容层，而不拆工作区同样能通过[架构检查脚本](../../scripts/checks/check-architecture.mjs)守住模块边界。

## ADR-02：根产品与核心 SDK 保持零运行时依赖，自动校验闭包

- **决定**：[package.json](../../package.json) 与 [pinwhy-core 清单](../../packages/pinwhy-core/package.json) 不声明运行时 `dependencies`；[pack-packages.mjs](../../scripts/packaging/pack-packages.mjs) 在打包阶段自动计算所有导出入口的传递依赖闭包，确保无漏打包文件且 [lib/domain/model.js](../../lib/domain/model.js) 保持零导入。
- **原因**：Pinwhy CLI 与 SDK 需要在干净、受限的 Node >= 18 环境与跨平台宿主沙箱中零配置启动，不能因为遗漏内部依赖或引入第三方运行库而破坏离线安装。

## ADR-03：工作台构建产物提交至 `public/` 并由 CI 校验新鲜度

- **决定**：保留构建后的工作台静态资产在仓库根目录 [public/](../../public/)，由 `web/` 经 `npm run build` 单向生成，并在 CI 中校验 `git status --porcelain public/` 为空。
- **原因**：`pinwhy serve` 与 `pinwhy export` 必须直接随 npm 安装包立即可用，不要求目标环境预装 Vite 或前端构建链。

## ADR-04：官网 `site/` 独立于工作台，路由与 SEO 集中于 `routes.mjs`

- **决定**：`site/` 仅在静态演示 HTML 上集成工作台效果，源码不引入 `web/src/` 或 `lib/`；中英文 6 条页面路由、标题、描述、OG 图与选择器统一定义在 [site/src/routes.mjs](../../site/src/routes.mjs)，同时供给 [router.jsx](../../site/src/router.jsx) 与 [prerender.mjs](../../site/scripts/prerender.mjs)。
- **原因**：官网与随产品交付的工作台演化节奏和浏览器运行假设完全不同，统一路由清单可杜绝新增页面或改路径时客户端导航与静态 SEO 输出漂移。

## ADR-05：DSH 插件通过公共 CLI/HTTP 契约接入，保留 `client/index.js` 惰性入口

- **决定**：[plugins/dsh-pinwhy](../../plugins/dsh-pinwhy/README.md) 仅通过子进程 CLI 调用、`capabilities --json` 能力探测及本地 HTTP 接口集成，严禁跨目录 `import` 根仓库内部实现；[client/index.js](../../plugins/dsh-pinwhy/client/index.js) 继续以未打包惰性工厂形式交付。
- **原因**：保证宿主插件可以独立发版、独立卸载、在宿主升级时不被仓库内部重构破坏。

## ADR-06：`.pinwhy/events.jsonl` 为唯一事实源，`state.json` 仅为可恢复缓存

- **决定**：所有写操作经文件锁与事务日志追加写入，[board.js](../../lib/storage/board.js) 缓存仅用于加速，并在检测到缓存落后或损坏时由日志完整回放重建。
- **原因**：确保中断、崩溃或并发重试后不丢记录，也杜绝第二份权威状态出现。详情原则见 [AGENT.md](../../AGENT.md)。
