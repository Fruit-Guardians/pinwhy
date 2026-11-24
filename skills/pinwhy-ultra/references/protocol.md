# Pinwhy Ultra 协议与蜂群协作参考

本文档说明 `pinwhy-ultra` CLI 的完整命令契约、紧凑防爆用法及蜂群（Swarm）并发核查模板。示例中的 `/已确认项目` 须替换为实际项目绝对路径。

---

## 1. CLI 命令契约

### `sync` — 盘点物理底表与哈希基线

```sh
pinwhy-ultra sync --cwd "/已确认项目" [--target "/源码路径"] [--scope "src/api"] [--max-lines 320] [--include-aux] [--compact] [--json]
```

- 默认忽略 `.git`、`node_modules`、构建产物、锁文件、二进制及 >2MB 文件；**默认跳过辅助测试/快照/文档目录及文件**（如 `__tests__`/`test`/`*.test.*`/`*.snap`/`docs`/`*.md`），并在输出中报告 `skippedAux` 数量与扇区概览。仅当测试源码本身属于重点审计对象时才传 `--include-aux`。
- 超过 `--max-lines`（默认 `320`）的文件按顶层声明边界切分并计算 SHA-256 短哈希；**已有的枚举探针（`probes`）在重新 `sync` 后会完整保留**。
- 在需要脚本读取结果时，强烈建议附加 `--compact` 与 `--json`（省略全量 `slices[]`，体积可控在几百字节内）。

### `add` — 全面枚举与中途动态裂变待测探针

```sh
pinwhy-ultra add "<待测/待核目标1>" "<目标2>" [--sector "src/auth"] [--at "src/auth/login.ts:45"] [--depends-on s1] [--agent worker-1] [--cwd "/已确认项目"]
```

- 在 **Phase 0 建模期** 用于把入口路由、权限组合、边缘状态与回归项穷举进任务池；在 **Phase 1 审查实测中** 用于工蜂撞见隐藏分支时就地裂变新探针。
- `--at` 支持 `path`、`path:line` 或 `path:start-end`；省略 `--sector` 时自动由 `--at` 路径推导扇区（无 `--at` 时默认归入 `general`）。
- 新探针分配短 ID（`p1`, `p2`, ...），与文件切片共用 `next`、`done`、`reopen`、`--depends-on` 与人类追问闭环。

### `exclude` — 有据归档非范围/无需深读资产

```sh
pinwhy-ultra exclude <切片ID、文件相对路径、或整个扇区/目录前缀...> --note "明确排除理由（不少于6字符）" --cwd "/已确认项目"
```

- 将确认与本轮安全审计或上线验证无关的模块/静态大文件标记为 `excluded`，既满足覆盖清零承诺，又在台账留档“为什么排除”。
- 注意两项机制保护：
  1. 空原因或敷衍短说明仍会被打回为 `shallow(insufficient-note)`；
  2. **被 `excluded` 的项不能满足其它切片的 `--depends-on` 依赖**，人类对其发起追问也会自动重开。

### `next` — 蜂群分扇区领取任务包（只读）

```sh
pinwhy-ultra next --cwd "/已确认项目" [--budget-lines 420] [--max-slices 4] [--workers 3] [--sector "src/auth"] [--json]
```

- 同扇区内的 `probe` 探针与未读文件切片会自动聚类打包，且同一扇区内 `probe` 优先排序。
- 优先级顺序：`human-followup (人类追问) -> stale -> 阻塞下游的切片/探针 (blockingFor) -> shallow -> pending`。
- `--workers N` 一次性切出 `N` 个互不重叠的扇区包，方便并发派发给多个子 Agent。

### `done` & `reopen` & `reset`

```sh
pinwhy-ultra done <slice|probe|path:line...> --note "验证方式与核查依据" [--refs f1,fd1] [--depends-on s2,src/guard.ts] [--status cleared|flagged|excluded] --cwd "/已确认项目"
pinwhy-ultra reopen s4 p2 --reason "配置逻辑调整，需重新实测" --cwd "/已确认项目"
pinwhy-ultra reset --yes --cwd "/已确认项目"
```

- `--refs` 会严格校验节点 ID 在 `.pinwhy/events.jsonl` 中存在；带上 `--refs` 时默认状态为 `flagged`，不带时为 `cleared`。
- 若两个或多个切片/探针通过 `--depends-on` 形成互相依赖闭环（如 `p13 -> s31 -> p13`），只有闭环内所有成员均标记 `done` 后才会一同收敛（`breadthComplete=true`）。`done` / `next` / `check` 会输出非阻塞的 `dependency-cycle` 提示；若并非真正互为前提，可用回显提供的 `pinwhy-ultra done <id> --depends-on none`（保留其他依赖时传 `none,<dep>`）解除循环。
- `reset` 向 `.pinwhy/ultra/ledger.jsonl` 追加一条 `reset` 记录以清空当前投影，不擦除历史台账记录，也**绝不触碰主黑板 `.pinwhy/events.jsonl`**。

### `check`（别名 `status`）— 承诺对账与认知边界体检

```sh
pinwhy-ultra check --cwd "/已确认项目" [--target "/源码路径"] [--no-disk] [--compact] [--json]
```

成功生成报告时即使存在未清零切片或认知缺口也以退出码 `0` 返回（只报告，不阻断宿主决策）；参数非法或执行失败（如 `--cwd` 目录不存在）时仍返回非零退出码 `1`。日常建议直接运行纯文本版 `pinwhy-ultra check`，脚本消费建议加 `--compact --json`（此时返回体附带 `slicesOmitted: true`，省略 `slices[]` 明细）。

关键输出判断维度：
- `breadthComplete`：物理核心底表与全部枚举/动态新增探针均已覆核（`pending=0, stale=0, shallow=0, untrackedFiles=[], diskStaleIds=[]`）。
- `commitmentComplete`：`breadthComplete === true` 且 `gaps.unbackedVerdicts` 归零（所有 `confirmed` / `refuted` 结论均有证据支撑）。
- `allClear`：`commitmentComplete === true` 且 `openThreads`、`awakenedChains`、`unresolvedAnomalies` 均归零。注意 **`commitmentComplete=true, allClear=false` 是保留诚实外部边界的完全正当终态**。

---

## 2. 蜂群（Swarm）防爆并发模版

1. **蜂后建模期（主会话）**：
   - 运行 `pinwhy-ultra sync --cwd "/已确认项目"`，读取扇区汇总，再用 `exclude` 排除与本次任务无关的目录，最后用 `add` 一次性枚举所有模块入口、接口组合、权限/边界验证点。
2. **并发轮次（主会话只管派单，不背源码）**：
   - 跑 `pinwhy-ultra next --workers 4 --budget-lines 420 --cwd "/已确认项目"` 拿到不重叠包。
   - 对每个 `batch` 启动一个独立只读/沙箱工蜂（Subagent），只把该 `batch` 的探针清单和路径范围传给它。
   - **工蜂职责**：查看关键函数与调用关系，**能跑单测或本地验证脚本的直接实测**；发现新边界立即调 `pinwhy-ultra add`，实锤事实写 `pinwhy`，交账时逐项 `pinwhy-ultra done` 并给出实测依据，完成后立刻返回摘要并释放子 Agent 上下文。
3. **汇总与收敛（主会话）**：
   - 每波收拢后跑一次 `pinwhy-ultra check`（~120 tokens）；若仍有 `pending`/`shallow`（含中途裂变出来的新探针或人类追问），继续派发下一波工蜂，直到 `commitmentComplete=true`。
