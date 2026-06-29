---
stage: 30
title: "OpenAI-compatible Chat Completions 适配"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 30｜OpenAI-compatible Chat Completions 适配

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 做第一版唯一的实际 provider adapter。
- 前置依赖: 阶段 29。
- 文件范围: services/model-gateway/providers/openai-compatible/* 。
- 本阶段要做: 基于 chat/completions 的普通和流式请求。
- 本阶段不要做: 不做 Claude/Gemini/Ollama。
- 验收标准: 1. OpenAI-compatible 普通请求可用 2. OpenAI-compatible 流式请求可用 3. 返回统一内部事件格式 4. 不泄露敏感信息
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 如何测试 chat / streamChat 4. 已完成内容 5. 未完成内容 6. 风险和 TODO 聊天闭环与流式输出

## 完整阶段提示词与说明

```text
阶段 30|OpenAI-compatible Chat Completions 适配
阶段目标: 做第一版唯一的实际 provider adapter。
前置依赖: 阶段 29。
文件范围: services/model-gateway/providers/openai-compatible/* 。
本阶段要做: 基于 chat/completions 的普通和流式请求。
本阶段不要做: 不做 Claude/Gemini/Ollama。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 30 阶段开发。
项目背景:
第一版优先支持 OpenAI-compatible API,兼容 OpenAI、DeepSeek、OpenRouter、通义兼容接
口、豆包兼容接口和本地代理。
当前阶段:
第 30 阶段:OpenAI-compatible Chat Completions 适配
前置条件:
- 已完成:Model Gateway 抽象接口
- 当前已有目录:services/model-gateway/providers
- 当前已有模块:Gateway 抽象、ModelConfig
本阶段目标:
- 实现 OpenAI-compatible provider adapter
- 支持普通聊天与流式聊天
- 返回统一标准事件
本阶段需要实现:
1. 创建 openai-compatible provider adapter
2. 接收 baseUrl、apiKey、modelName、temperature、topP、maxTokens、timeout
3. 实现 testConnection
4. 实现 chat(messages, options)
5. 实现 streamChat(messages, options)
6. 解析流式 delta,转成内部统一事件
7. 错误处理与超时处理
8. 记录最小可用调用日志入口或预留
涉及文件范围:
- apps/server/src/services/model-gateway/*
- apps/server/src/services/model-gateway/providers/openai-compatible/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 Claude / Gemini / Ollama
- 不要把业务逻辑写进 provider adapter
- 不要在 adapter 中拼接 Prompt
- 不要把 apiKey 记录到日志或返回前端
- 不要引入复杂 fallback
- 不要引入非 MVP 功能
代码要求:
- provider adapter 只负责协议适配
- 流式事件解析清晰
- timeout 可配置
- 错误信息可追踪
验收标准:
1. OpenAI-compatible 普通请求可用
2. OpenAI-compatible 流式请求可用
3. 返回统一内部事件格式
4. 不泄露敏感信息
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试 chat / streamChat
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
聊天闭环与流式输出
```
