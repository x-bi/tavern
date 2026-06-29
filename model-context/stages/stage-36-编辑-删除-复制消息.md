---
stage: 36
title: "编辑、删除、复制消息"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 36｜编辑、删除、复制消息

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 提升基础聊天可操作性。
- 前置依赖: 阶段 22、阶段 33。
- 文件范围: ChatMessage.vue 、 messages API 。
- 本阶段要做: 编辑用户消息、删除消息、复制消息。
- 本阶段不要做: 不做版本树。
- 验收标准: 1. 用户消息可编辑 2. 消息可删除 3. 消息可复制 4. 列表状态同步正确
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO 世界书、角色卡与数据进出

## 完整阶段提示词与说明

```text
阶段 36|编辑、删除、复制消息
阶段目标: 提升基础聊天可操作性。
前置依赖: 阶段 22、阶段 33。
文件范围: ChatMessage.vue 、 messages API 。
本阶段要做: 编辑用户消息、删除消息、复制消息。
本阶段不要做: 不做版本树。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 36 阶段开发。
项目背景:
消息级操作是聊天页基础体验的一部分,尤其是编辑用户消息和复制回复。
当前阶段:
第 36 阶段:编辑 / 删除 / 复制消息
前置条件:
- 已完成:Message API、聊天流式输出接入
- 当前已有目录:聊天组件、messages 模块
- 当前已有模块:聊天闭环已可用
本阶段目标:
- 支持编辑用户消息
- 支持删除消息
- 支持复制消息内容
本阶段需要实现:
1. 在 ChatMessage.vue 增加操作菜单
2. 对用户消息支持编辑并调用 PUT /api/messages/:id
3. 对消息支持删除并调用 DELETE /api/messages/:id
4. 对任意消息支持复制到剪贴板
5. 前端删除或编辑后刷新或局部更新消息列表
涉及文件范围:
- apps/web/src/components/ChatMessage.vue
- apps/web/src/stores/chat.ts
- apps/web/src/api/messages.ts
- apps/server/src/modules/messages/*(若需补充校验)
本阶段明确不要做:
- 不要实现消息分支树
- 不要自动在编辑后立即 regenerate
- 不要实现富文本编辑器
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 操作按钮简洁
- 编辑态与展示态分离
- 错误反馈清晰
验收标准:
1. 用户消息可编辑
2. 消息可删除
3. 消息可复制
4. 列表状态同步正确
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
世界书、角色卡与数据进出
```
