# 贡献指南

提交改动前请先阅读 [AGENT.md](AGENT.md) 与 [仓库架构](docs/architecture/README.md)。文档索引见 [docs/README.md](docs/README.md)。

## 环境要求

- **运行环境**：已发布的 CLI 与预构建工作台支持 **Node.js >= 18**，根包与 `pinwhy-core` 保持零运行时第三方依赖。
- **开发环境**：源码构建依赖 Vite 8，需要 **Node.js `^20.19.0 || >=22.12.0`**（推荐使用 Node.js 24）。不要将前端依赖、校验库或宿主 SDK 放入根包 `dependencies`。

<a id="local-development"></a>

## 本地开发

安装依赖并在临时目录生成合成演示数据（不要在开发模式下连接真实项目的 `.pinwhy/`）：

```sh
npm ci
node scripts/demos/demo.js /tmp/pinwhy-dev-demo
```

在两个终端中分别启动后端 API 服务与前端开发服务器：

```sh
# 终端 1：后端 API / SSE 服务（默认端口 4333）
node bin/pinwhy.js serve --cwd /tmp/pinwhy-dev-demo

# 终端 2：Vite 开发服务器（默认 http://127.0.0.1:5173）
PINWHY_CWD=/tmp/pinwhy-dev-demo npm run dev
```

- `web/` 为工作台源码，`public/` 为构建产物。修改前端后需执行 `npm run build` 并一并提交更新后的 `public/`。
- `skills/pinwhy/methods/INDEX.md` 由 `node scripts/checks/method-index.mjs --write` 自动生成，请勿手动编辑。

## 检查与测试

```sh
npm run check
npm test
npm run build
npm run verify:package
```

- `npm run check`：依次执行 `check:types`（TypeScript / JSDoc）、`check:arch`（模块分层、无环依赖与 SDK 闭包）、`lint`（Biome）、`check:docs`（本地与打包文档链接/锚点）和 `check:publish`（隐私与发布内容扫描）。
- `npm test`：使用 Node 内置测试运行器执行 `test/unit/`、`test/integration/` 与 `test/contracts/`。
- 修改工作台、审计视图或导出逻辑时，补充运行浏览器与导出验证：

```sh
npx playwright install chromium
npm run verify:viewer
npm run verify:audit
npm run verify:exports
```

- 修改恢复逻辑时运行：`npm run evaluate:recovery` 与 `npm run verify:recovery`。
- 修改 DSH 插件时，按 [插件测试说明](plugins/dsh-pinwhy/README.md#测试) 在 `plugins/dsh-pinwhy/` 目录运行检查与测试。

## 契约与兼容规则

- CLI 参数、`--json` 输出 schema、HTTP 接口与事件格式通过 `capabilities --json`、`lib/domain/contracts.js` 和契约测试维护。
- 修改外部可见行为时，先更新契约或行为测试，再修改实现与文档。
- 事件格式与 JSON schema 遵循向后兼容原则：新增可选字段不升 `EVENT_VERSION`；仅当旧版本回放会产生错误投影或字段语义不兼容时才升级版本。
- 注释只解释“为什么不能换做法”（兼容约束、所有权边界、顺序依赖、中断恢复与副作用），在规则归属处写一次并由测试锁住；不设注释率要求，命名清楚的逻辑不加重复注释，过时的保证须同步修正。

## 隐私检查

- 测试、截图、导出样本与演示脚本只能使用合成数据，严禁提交真实项目 `.pinwhy/`、个人绝对路径、密钥或本地宿主配置（`.claude/`、`.agents/` 等）。
- 建议启用本地 Git 钩子自动拦截违规提交与推送：

```sh
git config core.hooksPath .githooks
```

## 打包与发版

```sh
npm run pack:packages
npm run verify:npm-packages
```

`pack:packages` 会在 `dist/npm/` 生成四个发布包（`pinwhy-core`、`pinwhy`、`pinwhy-cli`、`dsh-pinwhy`）及校验清单。验证通过后按以下顺序发布，确保 `pinwhy-cli` 对同版本 `pinwhy` 的依赖可解析：

1. `pinwhy-core`
2. `pinwhy`
3. `pinwhy-cli`
4. `dsh-pinwhy`（按需独立发版）

跨平台与多 Node 版本矩阵验证定义见 `.github/workflows/verify.yml`；源码版本目录安装说明见 [README 升级章节](README.md#release)（配置迁移参考见 [README](README.md#upgrade)）。
