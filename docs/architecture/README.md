# Pinwhy 仓库架构

Pinwhy 采用 **单仓库、一份 Node 内核、三个清晰隔离的产品面** 的结构。改动任何一个功能时，先看它属于哪一层与哪个产品面，再按对应边界编写。

## 总体形态

```text
pinwhy/
├── bin/                   # 可执行入口：pinwhy、pinwhy-ultra（只做启动组装）
├── lib/                   # 唯一 Node.js 运行时：CLI、SDK、HTTP、Ultra、hooks 共用一份实现
├── packages/              # 包发布模板（pinwhy-core、pinwhy-cli）；打包时从 lib/ 生成暂存产物
├── web/                   # 随 CLI 交付的实时工作台源码（workbench，不是官网）
├── public/                # web/ 的构建产物（零构建启动例外）
├── site/                  # 独立部署的产品官网（含 routes.mjs 唯一路由清单与预渲染脚本）
├── plugins/dsh-pinwhy/    # 独立的 DeepSeek Harness 宿主适配器（通过 CLI/HTTP 契约通信）
├── skills/                # 可安装的 Skill 与方法论文档包
├── scripts/               # 开发与发布工具：packaging / checks / evaluation / demos / lib
├── test/                  # 分层测试：unit / integration / contracts + helpers / fixtures
└── docs/                  # 公开文档导航（README.md）、架构（architecture/）、关键决策（decisions/）
```

## 核心运行时依赖方向（`lib/`）

`lib/` 保持无环有向图（DAG），依赖自底层向上聚合：

```text
domain/ (model.js, semantics.js, contracts.js, receipts.js, lint.js)
   ▲
   ├── storage/ (layout, event-codec, event-file, event-log, board, input, file-lock, transaction, backup)
   │      ▲
   │      └── store.js  （领域写入与读取协调层）
   │             ▲
   ├── queries/ (context, context-render, search, history, digest, snapshot)
   ├── exports/ (html, data, text, sarif, shared-paths)
   ├── ultra/   (scanner, helpers, slices, ledger, gaps, scheduler, actions, engine, cli)
   └── 顶层适配与服务：cli/ · http/ · server.js · services/ · hooks/ · release/
```

`lib/core.js` 面向 `pinwhy-core` SDK 聚合公共导出，源码唯一维护在 `lib/`；`packages/pinwhy-core/package.json` 的 `exports` 映射到 `lib/` 对应文件，内部路径拆合不破坏已公开的包入口。

## 强制边界与自动化检查

`npm run check` 内置 `npm run check:arch`（执行 [check-architecture.mjs](../../scripts/checks/check-architecture.mjs)），在本地与 CI 持续检查以下约束：

1. **领域层纯净**：[lib/domain/model.js](../../lib/domain/model.js) 不得有任何 `import`（保持 CLI、server 与浏览器共用）；`lib/domain/*.js` 不得引入 `fs`、子进程、HTTP 或任何非 `domain/` 本地模块（仅 `receipts.js` 允许 `node:crypto`）。
2. **运行时隔离**：`bin/` 与 `lib/` 不得引入 `web/`、`site/`、`plugins/`、`scripts/` 或 `test/`。
3. **工作台边界**：`web/src/` 不得直接引入 `node:*`、存储层或后端服务模块；前端按 `api/`、`canvas/`、`workspace/`、`panels/`、`scene3d/`、`components/` 分工组织。
4. **官网隔离**：`site/src/` 与 `web/src/`、`lib/`、`plugins/` 完全隔离；[site/src/routes.mjs](../../site/src/routes.mjs) 是官网路由与 SEO 元信息的唯一清单，同时驱动前端路由与静态预渲染。
5. **插件隔离**：[plugins/dsh-pinwhy/](../../plugins/dsh-pinwhy/README.md) 仅通过公开 CLI 与 HTTP 接口交互，不从根 `lib/`、`web/`、`site/` 或内部路径 `import`。
6. **零环依赖与零运行时依赖**：`bin/`+`lib/`、`web/src/`、`site/src/` 三个模块图均保持 0 循环依赖；根包 `pinwhy` 与 `pinwhy-core` 声明零运行时 `dependencies`，打包与架构检查同时自动校验 SDK 的传递依赖闭包。

## 两个刻意保留的例外

1. **根目录提交 `public/` 构建产物**：`pinwhy` 作为零运行时依赖包安装后可直接执行 `pinwhy serve` 与 `pinwhy export`，无需用户在安装期构建前端。CI（[.github/workflows/verify.yml](../../.github/workflows/verify.yml)）会在每次验证中重新运行 `npm run build` 并断言工作区 `public/` 没有漂移。
2. **`plugins/dsh-pinwhy/client/index.js` 保持未打包的惰性工厂形式**：供 DSH 宿主按其插件加载规范按需挂载内嵌工作台面板，其余插件单元代码仍按 `src/` 清晰分层。

更多背景决策见[关键架构决策](../../docs/decisions/README.md)与[工程约定](../../AGENT.md)。
