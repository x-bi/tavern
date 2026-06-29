---
stage: 31
title: "后端 SSE / fetch stream 聊天接口"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 31｜后端 SSE / fetch stream 聊天接口

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 打通 MVP 的真正聊天入口。
- 前置依赖: 阶段 21、阶段 22、阶段 26、阶段 30。
- 文件范围: chat/* 。
- 本阶段要做: POST /api/chat/stream ,流式输出、会话锁、保存消息、失败标记、AbortController。
- 本阶段不要做: 不做 WebSocket;不做 Redis 锁。
- 验收标准: POST /api/chat/stream 能流式返回并保存消息。
- 可能风险: 普通 JSON 拦截器影响 SSE;消息重复保存;锁未释放。
- 人工检查点: 核查锁释放、异常分支、客户端断开后的清理。
- 完成后输出: 文件、示例请求、测试方式、风险。

## 完整阶段提示词与说明

```text
阶段 31|后端 SSE / fetch stream 聊天接口
阶段目标: 打通 MVP 的真正聊天入口。
前置依赖: 阶段 21、阶段 22、阶段 26、阶段 30。
文件范围: chat/* 。
本阶段要做: POST /api/chat/stream ,流式输出、会话锁、保存消息、失败标记、AbortController。
本阶段不要做: 不做 WebSocket;不做 Redis 锁。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 31 阶段开发。
项目背景:
这是 Tavern Lite MVP 的核心后端接口。要求使用 POST /api/chat/stream 接收请求体,响应
使用 text/event-stream 按增量输出,前端将用 fetch + ReadableStream 读取。
当前阶段:
第 31 阶段:后端 SSE / fetch stream 聊天接口
前置条件:
- 已完成:Conversation API、Message API、Prompt Builder v1、Model Gateway 抽象、
OpenAI-compatible 适配
- 当前已有目录:apps/server/src/modules/chat、services/prompt-builder、services/
model-gateway
- 当前已有模块:会话、消息、Prompt 预览、模型配置
本阶段目标:
- 创建 ChatModule、ChatController、ChatService
- 实现 POST /api/chat/stream
- 使用 Response 写入 text/event-stream
- 输出 event: delta / event: done / event: error
- 使用 AbortController 或等价机制支持停止生成
- 一次请求内:先保存用户消息,流完成后保存 assistant 消息,失败时标记 assistant message
status = failed
- 使用 conversation lock 防止同一会话并发生成
- 第一版不使用 Redis,只用内存 Map 实现锁
本阶段需要实现:
1. 创建 ChatModule、ChatController、ChatService
2. 定义 chat request DTO,至少包含 conversationId、userMessage、modelConfigId(或
使用会话默认)、presetId(可选)
3. 在 ChatService 中先加载会话、角色、Persona、最近消息、预设、模型配置
4. 调用 PromptBuilderService 构建 finalMessages
5. 调用 ModelGatewayService.streamChat
6. 用 Response 设置 text/event-stream、cache-control、connection 等必要头
7. 在流式过程中向客户端写入:
- event: delta
- data: {"text":"...","messageId":"..."}
- 空行
8. 在流结束时写入:
- event: done
- data: {"messageId":"...","finishReason":"stop"}
9. 出错时写入:
- event: error
- data: {"code":"...","message":"..."}
10. 用户消息在调用模型前保存
11. assistant 消息可先创建为 streaming 状态,流完成后更新为 completed 并写入完整内容;
或者在完成后创建,但请说明选择并保持一致
12. 若流式失败,assistant 消息要标记 failed,并保存错误摘要
13. 对同一 conversationId 做并发锁,锁实现使用内存 Map,不要引入 Redis
14. 为后续停止生成预留 abort map 或 request task map
15. 严禁在 ChatService 里硬编码 Prompt;必须通过 PromptBuilderService 获取
16. 严禁在 ChatService 里直接调用 OpenAI / DeepSeek / OpenRouter;必须通过
ModelGatewayService
17. 不要实现 WebSocket
18. 不要实现多会话并发调度系统
涉及文件范围:
- apps/server/src/modules/chat/*
- apps/server/src/modules/messages/*
- apps/server/src/modules/conversations/*
- apps/server/src/services/prompt-builder/*
- apps/server/src/services/model-gateway/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 WebSocket
- 不要引入 Redis 锁
- 不要实现群聊
- 不要在聊天模块里复制 Prompt 拼接逻辑
- 不要实现支付、市场、审核、机器人、TTS、图片生成、向量数据库
- 不要暴露 API Key 到前端或日志
- 不要改动无关页面模块
代码要求:
- 使用 TypeScript
- 后端使用 NestJS Module / Controller / Service / DTO 结构
- 数据访问通过 PrismaService
- API 返回统一格式;SSE 接口除外,SSE 使用标准事件帧
- 需要基础错误处理
- 需要保证代码可读、可维护
- 所有流式事件命名清楚
- 聊天模块必须可单元测试或至少具备清晰的可测边界
验收标准:
1. POST /api/chat/stream 可正常返回 text/event-stream
2. 前端可读取 delta / done / error 三类事件
3. 用户消息会在请求前保存
4. assistant 完整消息会在流完成后持久化
5. 出错时 assistant 消息被标记 failed
6. 同一会话不能并发生成
7. 聊天服务没有硬编码 Prompt,也没有直接调用供应商接口
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口请求示例
4. 如何启动后端并测试流式接口
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: POST /api/chat/stream 能流式返回并保存消息。
可能风险: 普通 JSON 拦截器影响 SSE;消息重复保存;锁未释放。
人工检查点: 核查锁释放、异常分支、客户端断开后的清理。
完成后输出: 文件、示例请求、测试方式、风险。
```
