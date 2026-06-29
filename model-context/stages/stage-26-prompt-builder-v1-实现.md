---
stage: 26
title: "Prompt Builder v1 实现"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 26｜Prompt Builder v1 实现

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 形成一个可运行的 prompt 拼接器。
- 前置依赖: 阶段 25。
- 文件范围: PromptBuilderService 。
- 本阶段要做: 平台规则、角色、Persona、最近消息、用户输入、输出约束的拼接;先不接世界书命中。
- 本阶段不要做: 不做复杂 token 计算。
- 验收标准: 1. 能基于输入生成 finalMessages 2. 能输出调试分段 3. 逻辑不散落在聊天模块和控制器里
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 如何调用 PromptBuilderService 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 26|Prompt Builder v1 实现
阶段目标: 形成一个可运行的 prompt 拼接器。
前置依赖: 阶段 25。
文件范围: PromptBuilderService 。
本阶段要做: 平台规则、角色、Persona、最近消息、用户输入、输出约束的拼接;先不接世界书命中。
本阶段不要做: 不做复杂 token 计算。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 26 阶段开发。
项目背景:
Prompt Builder v1 的目标是先形成可以用于聊天与预览的稳定拼接结果,而不是一步到位做所有高
级特性。
当前阶段:
第 26 阶段:Prompt Builder v1 实现
前置条件:
- 已完成:Prompt Builder 类型设计
- 当前已有目录:services/prompt-builder
- 当前已有模块:角色、Persona、会话、消息、模型配置、预设
本阶段目标:
- 基于固定顺序拼接 prompt
- 输出 finalMessages 和分段调试信息
- 建立角色扮演的最小安全规则和风格规则
本阶段需要实现:
1. 创建 PromptBuilderService
2. 输入角色、Persona、最近消息、用户最新输入、预设、基础平台规则
3. 输出 finalMessages、sections、debugInfo
4. system/developer/user 三层在内部保持语义清晰
5. 若目标模型仅支持 system/user/assistant,也保留后续降级空间
6. 第一版只做粗粒度历史裁剪,可按消息条数或字符数控制
7. 不接入世界书命中逻辑,先留接口
涉及文件范围:
- apps/server/src/services/prompt-builder/*
- packages/shared/*
- docs/*
本阶段明确不要做:
- 不要接入世界书匹配算法
- 不要做复杂 tokenizer 集成
- 不要在 ChatService 里复制 Prompt 逻辑
- 不要引入供应商 SDK
- 不要把 Prompt 写死在前端
- 不要引入非 MVP 功能
代码要求:
- 逻辑集中在 PromptBuilderService
- 结果可调试
- 规则文案集中管理
- 便于后续世界书和 Prompt 预览接入
验收标准:
1. 能基于输入生成 finalMessages
2. 能输出调试分段
3. 逻辑不散落在聊天模块和控制器里
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何调用 PromptBuilderService
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
