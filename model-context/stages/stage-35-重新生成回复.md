---
stage: 35
title: "重新生成回复"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 35｜重新生成回复

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 用最后一个用户消息重新触发生成。
- 前置依赖: 阶段 34。
- 文件范围: messages/regenerate 、聊天页。
- 本阶段要做: 重新生成功能。
- 本阶段不要做: 不做分支树。
- 验收标准: 1. 可对目标回复执行重新生成 2. 会话历史不混乱 3. 流式效果与普通生成一致
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 35|重新生成回复
阶段目标: 用最后一个用户消息重新触发生成。
前置依赖: 阶段 34。
文件范围: messages/regenerate 、聊天页。
本阶段要做: 重新生成功能。
本阶段不要做: 不做分支树。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 35 阶段开发。
项目背景:
重新生成是酒馆体验中的常见操作,但第一版只做“替换最后一条 assistant 回复”的简单语义。
当前阶段:
第 35 阶段:重新生成回复
前置条件:
- 已完成:聊天流式输出、停止生成
- 当前已有目录:messages/chat 前后端模块、聊天页
- 当前已有模块:基础聊天闭环
本阶段目标:
- 支持对最近 assistant 回复执行 regenerate
- 沿用现有 chat/stream 主链路
- 保持消息历史不混乱
本阶段需要实现:
1. 明确 regenerate 的数据语义:基于最近一条用户消息,重新生成 assistant 回复
2. 在后端补足 POST /api/messages/:id/regenerate 或改为通过 chat/stream 参数触发
3. 前端在消息操作区接入“重新生成”
4. 对旧 assistant 回复做替换、归档或软删策略,选择一种并保持一致
5. 流式过程与普通发送一致
涉及文件范围:
- apps/server/src/modules/messages/*
- apps/server/src/modules/chat/*
- apps/web/src/components/ChatMessage.vue
- apps/web/src/stores/chat.ts
- apps/web/src/api/messages.ts
- apps/web/src/api/chat.ts
本阶段明确不要做:
- 不要实现分支对话树
- 不要实现多候选同时生成
- 不要重写 Prompt Builder
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- regenerate 语义清楚
- 历史消息处理一致
- 前后端接口边界清晰
验收标准:
1. 可对目标回复执行重新生成
2. 会话历史不混乱
3. 流式效果与普通生成一致
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
