# Prompt Builder 类型设计

本文档记录第 25 阶段的 Prompt Builder 类型边界。当前阶段只定义类型，不实现 Prompt 拼接、Prompt 预览 API、聊天接口或模型调用。

## 类型入口

- 共享入口：`packages/shared/src/prompt-builder.ts`
- 后端入口：`apps/server/src/services/prompt-builder/types.ts`

后续后端 Prompt Builder、Prompt Preview API、Chat Orchestrator 和前端 Prompt 预览页应优先从这些入口复用类型，避免在业务模块里重复声明 Prompt 结构。

## 核心结构

- `BuildPromptInput`：Prompt Builder 的统一输入，包含会话、角色、Persona、预设、模型配置安全子集、历史消息、当前用户消息和世界书上下文。
- `BuildPromptResult`：Prompt Builder 的统一输出，包含组成分段、逻辑层消息、供应商层消息、世界书命中结果、截断历史和调试信息。
- `PromptSection`：可解释的 Prompt 分段，用于预览和调试，不代表最终供应商消息的一对一结构。
- `ChatMessageLike`：业务逻辑层消息，保留消息 ID、会话 ID、状态、metadata、token 估算等项目内字段。
- `ProviderChatMessage`：供应商层消息，只保留 OpenAI-compatible Chat Completions 需要的安全字段。
- `WorldBookMatchResult`：世界书扫描结果，包含命中条目、跳过条目、扫描深度和 token 预算估算。
- `PromptPreviewResult`：Prompt 预览 API 未来可直接返回的外层结构。

## 边界约束

- `PromptModelConfigContext` 不包含 API Key、密钥片段或供应商原始响应。
- `PromptBuilderMessage` 是内部逻辑层消息，支持 `developer` 角色；`ProviderChatMessage` 是供应商层消息，默认可由 Builder 把 `developer` 内容降级合并进 `system`。
- `BuildPromptResult.finalMessages` 是供应商层消息，但由后端 Builder 产出，前端只用于预览展示。
- `BuildPromptDebugInfo` 预留 `matchedEntries`、`truncatedHistory`、`finalMessages`、`warnings`，用于后续阶段调试世界书命中和历史截断。
- 当前类型不定义具体拼接顺序算法，只通过 `PromptSection.order` 和 `sectionOrder` 表达结果顺序。

## v1 实现

第 26 阶段新增 `PromptBuilderService.build(input)`。v1 固定按以下顺序生成结果：

1. 平台基础规则：进入内部 `system`。
2. 角色卡、用户 Persona、Prompt Preset、输出约束：进入内部 `developer`。
3. 最近历史消息：保留 `system`、`user`、`assistant`，跳过其他角色并写入 warning。
4. 当前用户输入：进入内部 `user`。

默认供应商消息不直接输出 `developer` role，而是合并到首条 `system` 消息中。调用方可通过 `options.supportsDeveloperRole: true` 保留独立 developer 消息，为后续支持该角色的模型或 Gateway 适配预留空间。

v1 只做粗粒度历史裁剪：

- `options.historyLimit` 控制最多保留的历史消息条数，默认 20。
- `options.maxHistoryCharacters` 控制历史消息总字符量，默认 12000。
- 不接入 tokenizer，不做复杂 token 预算。

世界书字段当前只返回空 `WorldBookMatchResult`，用于后续阶段接入匹配算法。
