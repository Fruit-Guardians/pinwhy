# pinwhy-code-audit

基于 Pinwhy 的代码安全审计 Skill 包，围绕具体假设、权限/边界控制核对和验证反馈组织源码审计记录。

## 设计要点

- 聚焦可验证的具体假设：明确安全边界在哪一层建立、哪些条件可区分不同解释、何时应修正实验而非直接排除问题。
- 区分实验未触达、环境报错、有效反证和有效复现，避免把失败的测试脚本误记为漏洞不存在。
- 支持变体排查与变更差分：从已知问题归纳触发条件，对照同类入口或补丁前后的调用路径。
- 只在黑板记录需要跨轮保留的关键事实、结论、前提条件与未决问题，不以节点数量衡量审计质量。

## 使用方式

入口文件为 [SKILL.md](SKILL.md)。安装到宿主的 `.agents/skills/pinwhy-code-audit/` 或 `.claude/skills/pinwhy-code-audit/` 时，需完整保留 `SKILL.md`、`references/`、`assets/` 和 `agents/` 目录。

提示词示例：

> 使用 pinwhy-code-audit 审查导出与批量接口的租户权限校验，将关键证据、前提条件和待确认问题记录到 Pinwhy。

默认仅做源码静态分析与记录；如需运行目标代码或构造复现实验，须遵守 [执行与隔离说明](references/execution.md)。

## 参考文档

| 文件 | 说明 |
| --- | --- |
| [references/workflow.md](references/workflow.md) | 切入点选择、任务拆分、复核与汇总流程 |
| [references/investigation.md](references/investigation.md) | 控制点核对、反证验证、变体与变更分析 |
| [references/techniques.md](references/techniques.md) | 常见漏洞类别与信任边界检查要点 |
| [references/execution.md](references/execution.md) | 动态验证前提、对照实验与运行隔离要求 |
| [references/records.md](references/records.md) | 节点类型、证据成熟度、关系与报告映射 |
| [references/pinwhy.md](references/pinwhy.md) | 常用 CLI 命令、批量写入与上下文恢复 |
| [assets/investigation-brief.md](assets/investigation-brief.md) | 子任务结果回传模板 |
| [assets/record-example.jsonl](assets/record-example.jsonl) | 合成审计记录示例 |
| [references/research.md](references/research.md) | 方法来源与取舍说明 |
| [evals/README.md](https://github.com/Fruit-Guardians/pinwhy/blob/main/skills/pinwhy-code-audit/evals/README.md) | 评测设计与判分标准（仅保留在源码仓库，不随 npm 包分发） |
| [evals/RESULTS.md](https://github.com/Fruit-Guardians/pinwhy/blob/main/skills/pinwhy-code-audit/evals/RESULTS.md) | 评测运行记录（历史对照见 [RESULTS-v1.md](https://github.com/Fruit-Guardians/pinwhy/blob/main/skills/pinwhy-code-audit/evals/RESULTS-v1.md)） |

## 许可

MIT
