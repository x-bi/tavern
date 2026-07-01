---
stage: 33
title: "聊天流式输出接入"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 33｜聊天流式输出接入

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 把 useChatStream 接到聊天页。
- 前置依赖: 阶段 24、阶段 32。
- 文件范围: chat.ts store 、 ChatView.vue 、 ChatRoom.vue 。
- 本阶段要做: 发送消息、显示 streaming assistant、完成后刷新。
- 本阶段不要做: 不做停止/重生。
- 验收标准: 1. 用户发送消息后可看到 assistant 流式输出 2. 流结束后消息状态正确 3. 页面不会因一次失败而卡死 4. 组件与 store 分工清晰
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 33|聊天流式输出接入
阶段目标: 把 useChatStream 接到聊天页。
前置依赖: 阶段 24、阶段 32。
文件范围: chat.ts store 、 ChatView.vue 、 ChatRoom.vue 。
本阶段要做: 发送消息、显示 streaming assistant、完成后刷新。
本阶段不要做: 不做停止/重生。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 33 阶段开发。
项目背景:
这是 MVP 聊天闭环的关键一跃:用户发送消息后,前端能看到流式增长的 assistant 回复。
当前阶段:
第 33 阶段:聊天流式输出接入
前置条件:
- 已完成:聊天页面骨架、useChatStream composable
- 当前已有目录:views/chat、components、stores、composables
- 当前已有模块:后端 chat/stream 接口、前端消息展示骨架
本阶段目标:
- 从聊天页发起流式请求
- 在消息列表中显示 streaming assistant 消息
- 流完成后与后端保存结果对齐
本阶段需要实现:
1. 在 ChatStore 中加入 sending/isStreaming/streamingMessage 等状态
2. 聊天页发送用户输入时调用 useChatStream
3. 增量更新当前 assistant 消息内容
4. done 后刷新会话消息或将 streaming 结果替换为最终消息
5. error 时提示失败并恢复输入状态
6. 自动滚动到底部
涉及文件范围:
- apps/web/src/stores/chat.ts
- apps/web/src/views/chat/ChatView.vue
- apps/web/src/components/ChatRoom.vue
- apps/web/src/components/ChatInput.vue
- apps/web/src/composables/useChatStream.ts
- apps/web/src/api/chat.ts
本阶段明确不要做:
- 不要实现停止生成
- 不要实现重新生成
- 不要实现编辑/删除消息按钮逻辑
- 不要把所有流式解析逻辑塞回组件
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- Store 管共享状态
- composable 管流式请求
- 组件管展示
- 错误和 loading 状态清晰
验收标准:
1. 用户发送消息后可看到 assistant 流式输出
2. 流结束后消息状态正确
3. 页面不会因一次失败而卡死
4. 组件与 store 分工清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
