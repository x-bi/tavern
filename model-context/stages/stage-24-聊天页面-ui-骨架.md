---
stage: 24
title: "聊天页面 UI 骨架"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 24｜聊天页面 UI 骨架

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 先把聊天页壳子和消息区域搭出来。
- 前置依赖: 阶段 23。
- 文件范围: ChatRoom.vue 、 ChatMessage.vue 、 ChatInput.vue 、 ChatView.vue 。
- 本阶段要做: 静态 UI、消息列表展示、输入框、工具栏占位。
- 本阶段不要做: 不接流。
- 验收标准: 1. 聊天页骨架可打开 2. 历史消息可正常显示 3. 输入区与操作区布局稳定
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO Prompt 构建与模型网关

## 完整阶段提示词与说明

```text
阶段 24|聊天页面 UI 骨架
阶段目标: 先把聊天页壳子和消息区域搭出来。
前置依赖: 阶段 23。
文件范围: ChatRoom.vue 、 ChatMessage.vue 、 ChatInput.vue 、 ChatView.vue 。
本阶段要做: 静态 UI、消息列表展示、输入框、工具栏占位。
本阶段不要做: 不接流。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 24 阶段开发。
项目背景:
聊天页面是核心交互场景,但在接入流式聊天前,先建立稳定 UI 骨架更容易控制复杂度。
当前阶段:
第 24 阶段:聊天页面 UI 骨架
前置条件:
- 已完成:会话列表页、Message API
- 当前已有目录:views/chat、components、stores
- 当前已有模块:会话与消息基础能力
本阶段目标:
- 构建聊天页静态骨架
- 展示历史消息
- 提供输入区和常用操作按钮占位
本阶段需要实现:
1. 创建 ChatRoom.vue、ChatMessage.vue、ChatInput.vue、ChatView.vue
2. 聊天页加载会话消息列表
3. 展示用户消息与 assistant 消息的不同样式
4. 输入框、发送按钮、停止按钮、重新生成按钮、复制按钮放置占位
5. 右侧或顶部展示角色信息/模型/预设切换区域占位
6. 实现自动滚动到底部的基础逻辑占位
涉及文件范围:
- apps/web/src/components/ChatRoom.vue
- apps/web/src/components/ChatMessage.vue
- apps/web/src/components/ChatInput.vue
- apps/web/src/views/chat/ChatView.vue
- apps/web/src/stores/chat.ts
- apps/web/src/api/messages.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现流式聊天
- 不要实现 Prompt 预览弹窗
- 不要把复杂状态都写在 ChatView.vue
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 组件拆分清晰
- 样式能支持后续流式更新
- 聊天页不直接承担所有业务逻辑
验收标准:
1. 聊天页骨架可打开
2. 历史消息可正常显示
3. 输入区与操作区布局稳定
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
Prompt 构建与模型网关
```
