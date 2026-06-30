---
stage: 23
title: "会话列表页"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 23｜会话列表页

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 前端能查看并切换会话。
- 前置依赖: 阶段 21、阶段 22。
- 文件范围: ConversationList.vue 、 ConversationView.vue 。
- 本阶段要做: 列表、创建、删除、清空。
- 本阶段不要做: 不做聊天流。
- 验收标准: 1. 会话列表能正常展示 2. 新建、删除、清空动作可用 3. 可跳转聊天页
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 23|会话列表页
阶段目标: 前端能查看并切换会话。
前置依赖: 阶段 21、阶段 22。
文件范围: ConversationList.vue 、 ConversationView.vue 。
本阶段要做: 列表、创建、删除、清空。
本阶段不要做: 不做聊天流。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 23 阶段开发。
项目背景:
会话列表页负责组织聊天入口,必须先于聊天页功能完善。
当前阶段:
第 23 阶段:会话列表页
前置条件:
- 已完成:Conversation API、Message API
- 当前已有目录:views/conversations、components、api、stores
- 当前已有模块:角色相关页面
本阶段目标:
- 实现会话列表查看与切换
- 接入创建、删除、清空会话动作
- 为聊天页路由跳转做铺垫
本阶段需要实现:
1. 创建 ConversationList.vue
2. 创建会话列表页或侧栏使用的视图组件
3. 接入 conversations API
4. 展示标题、关联角色、更新时间
5. 支持新建、删除、清空会话
6. 点击会话进入聊天页路由
涉及文件范围:
- apps/web/src/components/ConversationList.vue
- apps/web/src/views/conversations/ConversationView.vue
- apps/web/src/api/conversations.ts
- apps/web/src/stores/conversation.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现消息流式渲染
- 不要实现重新生成
- 不要把 Prompt 预览塞进会话列表
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 列表可维护
- 状态管理清晰
- 页面与数据获取分离
验收标准:
1. 会话列表能正常展示
2. 新建、删除、清空动作可用
3. 可跳转聊天页
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
