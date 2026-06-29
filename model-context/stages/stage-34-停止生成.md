---
stage: 34
title: "停止生成"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 34｜停止生成

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 允许用户中断当前生成。
- 前置依赖: 阶段 33。
- 文件范围: useChatStream.ts 、 ChatStore 、后端中止映射。
- 本阶段要做: 前端 abort;后端释放资源。
- 本阶段不要做: 不做跨设备同步停止。
- 验收标准: 1. 点击停止后流式输出立刻终止 2. 锁被释放 3. 消息状态可解释 4. 输入框与按钮状态恢复正常
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 34|停止生成
阶段目标: 允许用户中断当前生成。
前置依赖: 阶段 33。
文件范围: useChatStream.ts 、 ChatStore 、后端中止映射。
本阶段要做: 前端 abort;后端释放资源。
本阶段不要做: 不做跨设备同步停止。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 34 阶段开发。
项目背景:
停止生成是长回复场景下必须要有的控制能力。
当前阶段:
第 34 阶段:停止生成
前置条件:
- 已完成:聊天流式输出接入
- 当前已有目录:chat composable/store/backend chat module
- 当前已有模块:stream chat 流程可用
本阶段目标:
- 实现前端“停止生成”按钮生效
- 中止当前请求
- 后端正确处理客户端断开或显式中止
本阶段需要实现:
1. 在 useChatStream 中暴露 abort 方法
2. ChatStore 记录当前可中止任务
3. ChatInput 或聊天页接入停止按钮
4. 后端在客户端断开或 abort 后执行清理逻辑
5. conversation lock 被正确释放
6. assistant 消息状态按选择策略处理为 stopped / partial / failed,并保持一致
涉及文件范围:
- apps/web/src/composables/useChatStream.ts
- apps/web/src/stores/chat.ts
- apps/web/src/components/ChatInput.vue
- apps/server/src/modules/chat/*
- packages/shared/*
本阶段明确不要做:
- 不要实现任务队列
- 不要引入 Redis 或后台 worker
- 不要实现跨标签页同步停止
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 中止逻辑单一清晰
- 锁和资源必须释放
- 前后端状态一致
验收标准:
1. 点击停止后流式输出立刻终止
2. 锁被释放
3. 消息状态可解释
4. 输入框与按钮状态恢复正常
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
