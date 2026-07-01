---
stage: 27
title: "Prompt 预览 API"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 27｜Prompt 预览 API

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 让前端能请求“最终发送给模型的 messages”。
- 前置依赖: 阶段 26。
- 文件范围: prompts/* 。
- 本阶段要做: POST /api/prompts/preview 。
- 本阶段不要做: 不调用模型。
- 验收标准: 1. Prompt 预览接口可调用 2. 返回完整且可读的 messages 3. 不会泄露 apiKey 等敏感配置
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口示例 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 27|Prompt 预览 API
阶段目标: 让前端能请求“最终发送给模型的 messages”。
前置依赖: 阶段 26。
文件范围: prompts/* 。
本阶段要做: POST /api/prompts/preview 。
本阶段不要做: 不调用模型。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 27 阶段开发。
项目背景:
Prompt 预览是酒馆系统的重要可解释性功能,能帮助调试角色设定、Persona 和后续世界书命中。
当前阶段:
第 27 阶段:Prompt 预览 API
前置条件:
- 已完成:Prompt Builder v1
- 当前已有目录:prompts 模块占位
- 当前已有模块:PromptBuilderService
本阶段目标:
- 提供 Prompt 预览接口
- 返回 finalMessages 与分段调试信息
- 不触发模型生成
本阶段需要实现:
1. 创建 PromptsModule、Controller、Service
2. 实现 POST /api/prompts/preview
3. 接收 conversationId 或角色/Persona/用户输入等必要参数
4. 调用 PromptBuilderService
5. 返回 sections、finalMessages、historyTrimInfo 等调试数据
6. 对敏感信息进行脱敏处理
涉及文件范围:
- apps/server/src/modules/prompts/*
- apps/server/src/services/prompt-builder/*
- packages/shared/*
本阶段明确不要做:
- 不要调用模型供应商
- 不要实现聊天流式接口
- 不要把 API Key 暴露给前端
- 不要在 Controller 里硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 返回结构清晰
- 便于前端渲染分区信息
- 脱敏敏感配置
验收标准:
1. Prompt 预览接口可调用
2. 返回完整且可读的 messages
3. 不会泄露 apiKey 等敏感配置
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口示例
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
