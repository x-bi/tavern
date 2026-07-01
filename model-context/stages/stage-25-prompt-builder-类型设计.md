---
stage: 25
title: "Prompt Builder 类型设计"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 25｜Prompt Builder 类型设计

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 先把 Prompt Builder 所需类型收敛清楚。
- 前置依赖: 阶段 21、阶段 22、阶段 19、阶段 37 前的世界书字段已在 schema 中。
- 文件范围: services/prompt-builder/types.ts 、 packages/shared/* 。
- 本阶段要做: 定义 BuildPromptInput 、 BuildPromptResult 、 PromptSection 、 WorldBookMatchResult 等。
- 本阶段不要做: 不拼 prompt。
- 验收标准: 1. Prompt Builder 核心类型齐全 2. 类型可被后端服务与前端预览共用 3. 命名清晰、一眼可懂
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 类型说明 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 25|Prompt Builder 类型设计
阶段目标: 先把 Prompt Builder 所需类型收敛清楚。
前置依赖: 阶段 21、阶段 22、阶段 19、阶段 37 前的世界书字段已在 schema 中。
文件范围: services/prompt-builder/types.ts 、 packages/shared/* 。
本阶段要做: 定义 BuildPromptInput 、 BuildPromptResult 、 PromptSection 、
WorldBookMatchResult 等。
本阶段不要做: 不拼 prompt。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 25 阶段开发。
项目背景:
Prompt Builder 是核心模块,先把类型设计独立出来,能显著降低后续实现失控风险。
当前阶段:
第 25 阶段:Prompt Builder 类型设计
前置条件:
- 已完成:角色、Persona、会话、消息、模型配置、预设基础实体
- 当前已有目录:services/prompt-builder 或等价目录、packages/shared
- 当前已有模块:相关数据表与 API
本阶段目标:
- 定义 Prompt Builder 的输入输出类型
- 明确消息、分段、命中世界书、调试信息的数据结构
- 为 Prompt 预览和聊天接口共用类型
本阶段需要实现:
1. 定义 ChatMessageLike、PromptSection、BuildPromptInput、BuildPromptResult、
WorldBookMatchResult、PromptPreviewResult 等类型
2. 区分逻辑层消息与供应商层消息
3. 预留调试字段,例如 matchedEntries、truncatedHistory、finalMessages
4. 放到共享位置,方便 PromptsModule、ChatModule、前端 Prompt 预览共用
涉及文件范围:
- apps/server/src/services/prompt-builder/*
- packages/shared/*
- docs/*
本阶段明确不要做:
- 不要实现真正的 Prompt 拼接
- 不要调用模型
- 不要改动聊天接口
- 不要把类型散落到多个无关文件
- 不要暴露 API Key
- 不要硬编码 Prompt 到组件或 Controller
- 不要引入非 MVP 功能
代码要求:
- TypeScript 类型清晰
- 区分内部消息结构与对外 provider 消息结构
- 便于后续测试
验收标准:
1. Prompt Builder 核心类型齐全
2. 类型可被后端服务与前端预览共用
3. 命名清晰、一眼可懂
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 类型说明
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
