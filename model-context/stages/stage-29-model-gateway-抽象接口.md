---
stage: 29
title: "Model Gateway 抽象接口"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 29｜Model Gateway 抽象接口

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 让业务代码只依赖统一网关接口,不依赖供应商。
- 前置依赖: 阶段 14。
- 文件范围: services/model-gateway/* 。
- 本阶段要做: 定义 chat 、 streamChat 、 testConnection 抽象。
- 本阶段不要做: 不接任何具体 provider。
- 验收标准: 1. Gateway 抽象接口清晰 2. 后续 provider 能按接口接入 3. 业务模块不会与供应商强耦合
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口说明 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 29|Model Gateway 抽象接口
阶段目标: 让业务代码只依赖统一网关接口,不依赖供应商。
前置依赖: 阶段 14。
文件范围: services/model-gateway/* 。
本阶段要做: 定义 chat 、 streamChat 、 testConnection 抽象。
本阶段不要做: 不接任何具体 provider。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 29 阶段开发。
项目背景:
业务代码不能直接调用 OpenAI、DeepSeek、OpenRouter 等供应商接口,必须通过统一 Model
Gateway 执行。
当前阶段:
第 29 阶段:Model Gateway 抽象接口
前置条件:
- 已完成:ModelConfig API、Prompt Builder v1
- 当前已有目录:services/model-gateway
- 当前已有模块:ModelConfig、Prompts
本阶段目标:
- 定义统一模型网关接口
- 屏蔽供应商差异
- 为 chat / streamChat / testConnection 提供抽象
本阶段需要实现:
1. 创建 ModelGatewayService 或等价抽象
2. 定义模型消息类型与 provider options 类型
3. 定义 testConnection(config)、chat(messages, options)、streamChat(messages,
options)
4. 定义标准化流事件结构
5. 提供 provider registry 或 adapter registry 的扩展点
6. 当前阶段只写接口和内部基础工具,不接具体供应商
涉及文件范围:
- apps/server/src/services/model-gateway/*
- packages/shared/*
- docs/*
本阶段明确不要做:
- 不要实现 OpenAI-compatible 适配
- 不要在聊天模块里直接 fetch 某个供应商
- 不要实现 fallback、多供应商负载均衡
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 抽象清晰
- 可扩展到 OpenAI-compatible / Claude / Gemini / Ollama
- 业务模块只依赖接口
验收标准:
1. Gateway 抽象接口清晰
2. 后续 provider 能按接口接入
3. 业务模块不会与供应商强耦合
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口说明
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
