---
stage: 32
title: "前端 useChatStream composable"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 32｜前端 useChatStream composable

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 把聊天流读取逻辑从页面剥离。
- 前置依赖: 阶段 31。
- 文件范围: composables/useChatStream.ts 。
- 本阶段要做: fetch streaming、SSE 帧解析、AbortController。
- 本阶段不要做: 不写页面 UI。
- 验收标准: 1. composable 可独立启动一次聊天流 2. 可正确解析 delta / done / error 3. 可中止请求 4. 页面后续可以直接接入
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 如何使用 useChatStream 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 32|前端 useChatStream composable
阶段目标: 把聊天流读取逻辑从页面剥离。
前置依赖: 阶段 31。
文件范围: composables/useChatStream.ts 。
本阶段要做: fetch streaming、SSE 帧解析、AbortController。
本阶段不要做: 不写页面 UI。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 32 阶段开发。
项目背景:
聊天流式读取逻辑必须放在 composable,而不是堆在 ChatView.vue 里。
当前阶段:
第 32 阶段:前端 useChatStream composable
前置条件:
- 已完成:后端 SSE / fetch stream 聊天接口
- 当前已有目录:apps/web/src/composables、api、stores
- 当前已有模块:聊天页 UI 骨架
本阶段目标:
- 创建 useChatStream composable
- 使用 fetch + ReadableStream 读取 text/event-stream
- 支持开始、增量回调、完成、出错、手动 abort
本阶段需要实现:
1. 新建 useChatStream.ts
2. 封装 startStream(params)
3. 使用 fetch 发起 POST /api/chat/stream
4. 使用 ReadableStream + TextDecoder 读取数据
5. 解析 event: delta / done / error
6. 提供 onDelta/onDone/onError 或返回响应式状态
7. 管理 AbortController
8. 不把业务持久状态写死在 composable 内部
涉及文件范围:
- apps/web/src/composables/useChatStream.ts
- apps/web/src/api/chat.ts
- apps/web/src/types/*
- apps/web/src/stores/chat.ts(若需要有限改动)
本阶段明确不要做:
- 不要直接修改聊天页面 UI
- 不要在 composable 里写模型配置业务
- 不要把所有消息状态都混在 composable 私有变量里
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- Composition API
- TypeScript
- composable 专注封装流式读取与中止控制
- 与 Pinia 边界清晰
验收标准:
1. composable 可独立启动一次聊天流
2. 可正确解析 delta / done / error
3. 可中止请求
4. 页面后续可以直接接入
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何使用 useChatStream
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
