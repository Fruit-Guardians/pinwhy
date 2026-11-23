---
name: pinwhy-ultra
description: 当用户明确要求使用 Ultra 模式进行代码审计、项目上线前全量测试、或复杂系统的蜂群式全范围摸排时使用。通过先分析建模与全面枚举待测项（probes），再派蜂群并发审查实测并在循环中动态裂变补充，确保范围全覆盖、能测尽测、上下文不膨胀且保留诚实边界。
license: MIT
compatibility: 需要可调用的 pinwhy 与 pinwhy-ultra CLI；保持主黑板（.pinwhy/events.jsonl）与覆盖台账（.pinwhy/ultra/ledger.jsonl）严格分离。
metadata:
  version: "2.0"
  category: "ultra-harness"
---

# Pinwhy Ultra — 建模枚举、蜂群实测与覆盖收敛 Harness

Pinwhy Ultra 是面向代码审计与上线前全量测试的轻量确定性底座（Harness）。核心原则：**全量 ≠ 逐行背代码**——而是先看清系统版图、全面枚举出所有要审和要测的对象，再像蜂群（Swarm）一样分包深入研究并动手实测；途中撞见新分支或隐藏机制，当场裂变补充进待测池，直到整张网收敛。

它维护两层独立存储：
- **主黑板（`.pinwhy/events.jsonl`）**：只存高信号发现、架构原语、实测结果、问题与诚实未知边界；
- **Ultra 台账（`.pinwhy/ultra/ledger.jsonl`）**：只管物理模块底表（`slices`）、枚举探针池（`probes`）、依赖前提（`dependsOn`）与人类现场追问（`humanFollowups`）。

## 启用时机

仅当用户明确要求 **Ultra 模式**、**全量安全审计**、或**上线前全面测试摸排**时启用；普通日常任务不主动启用。使用前确认已初始化或经授权初始化黑板（`pinwhy init`）。

## 防上下文爆炸铁律

- **日常巡检默认用文本或紧凑模式**：主协调者只跑 `pinwhy-ultra check`、`pinwhy-ultra next` 或加 `--compact --json`；**不要高频对大型仓库跑无 `--compact` 的 `check --json` / `sync --json`**（会把整张 `slices[]` 全表吐进上下文）。
- **工蜂短生命周期隔离**：超过 ~1,500 行的项目，优先把 `pinwhy-ultra next --workers N` 领到的同扇区小包交给独立子 Agent（只看核心代码与相关入口并实测，完成后交账即销毁）；单会话环境则每 3–4 波执行 `checkpoint` 并压缩上下文，随后只用 `pinwhy digest` + `pinwhy-ultra check` 恢复现场。

---

## 三阶段蜂群闭环

### Phase 0 · 建模与全面枚举（Model & Enumerate）

先建系统模型和待测版图，再动手测细节：

1. **扫出物理核心底表**：
   ```sh
   pinwhy-ultra sync --cwd "/已确认项目"
   ```
   `sync` 默认跳过单测（`__tests__`/`*.test.*`）、快照（`.snap`）和文档（`.md`），仅在确需纳管测试源码本身时才传 `--include-aux`。
2. **明确范围边界（有据排除，绝不静默跳过）**：
   先通览 `sync` 返回的扇区分布与入口结构。对于确认与本轮目标无关的大体积静态契约、样本目录或遗留模块，用 `exclude` 明确声明理由归档：
   ```sh
   pinwhy-ultra exclude scripts/samples --note "静态演示数据，无运行时解析入口" --cwd "/已确认项目"
   ```
3. **全面枚举初始待审 / 待测探针（`add`）**：
   根据架构模型把“真正需要审与测的东西”穷举成具体的探针项（接口端点、CLI 子命令、权限角色 × 操作矩阵、文件上传/序列化边界、并发与异常恢复等）：
   ```sh
   pinwhy-ultra add \
     "实测 HTTP 网关 missing Notion-Token 时是否回退 ENV 凭证" \
     "验证 64 字符工具名二次截断在 CallTool 查表是否 404" \
     --sector scripts --at scripts/start-server.ts:134 --cwd "/已确认项目"
   ```

### Phase 1 · 蜂群分包审查、实测与动态裂变（Swarm Probe, Test & Expand）

1. **分扇区并发派单（Coordinator）**：
   ```sh
   pinwhy-ultra next --workers 3 --budget-lines 420 --cwd "/已确认项目"
   ```
   同扇区的待测探针与未读代码切片会自动聚在一包，优先级依次为：`human-followup (人类追问) -> stale -> 被依赖卡住的阻塞项 (blockingFor) -> shallow -> pending`。
2. **深度核查 + 主动实测（Workers）**：
   - 不要求逐行精读无害样板或重复分支；但对关键路径必须跟踪调用链，并**在安全可控条件下优先运行单测、起本地服务或写最小复现脚本实测**，用实际输入输出代替猜测。
   - **三类交账方式**：
     1. **确认无害 / 实测通过**：`pinwhy-ultra done <id...> --note "已单测/curl 验证通过：具体结论"`（只写台账，不往主黑板灌水）。
     2. **存在校验前提**：用 `--depends-on <slice|path>` 显式挂靠前置切片；遇到跨模块急迫线索当场追完再一并交账，确保绕出去永远回得来。
     3. **实锤线索 / 原语 / 漏洞**：先用 `pinwhy` 写入主黑板，再通过 `pinwhy-ultra done <id> --refs <nodeId>` 关联。
   - **动态裂变补充（随时 `add`）**：
     工蜂审查或测试过程中一旦发现新的隐藏入口、状态开关、边缘路径或衍生回归点，**立刻调用 `pinwhy-ultra add` 追加新探针到对应扇区**，让后续波次接力测透。
   - **优先回应人类追问（`human-followup`）**：
     人类在工作台对任何切片或探针补充提问后，该项会立即弹回 `shallow(human-followup)`。务必复核人类给出的假设前提并用 `--refs` 回应销账。

### Phase 2 · 对账收敛与定性纪律（Check & Honest Boundaries）

每波结束后跑轻量对账：

```sh
pinwhy-ultra check --cwd "/已确认项目"
```

- **定性纪律（禁止跳步）**：对于依赖特定部署前提或业务意图的现象（例如“配置缺省环境变量回退”、“上游三方库行为未见源码”），只能记录带明确前提的 `observation` 或 `hypothesis`，**严禁在未核实设计意图/运行时条件前直接定性为 `confirmed finding`**。
- **区分两层完成状态**：
  - `commitmentComplete === true`：所有物理 `core` 模块均已覆盖或有据排除、初始及中途裂变出的全部 `probes` 均已实测/核清、无无证据支撑的孤证裁定；
  - `allClear === false`：**完全允许作为严谨调查的正当终态**——代表存在受限于外部环境或缺失凭据的诚实开放边界（`openThreads` / `awakenedChains` / `humanSignals`），如实向人类交付即可。
