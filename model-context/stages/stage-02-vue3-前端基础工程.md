---
stage: 2
title: "Vue3 前端基础工程"
wave: "baseline"
wave_title: "基线与工程骨架"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 2｜Vue3 前端基础工程

## 快速读取

- 波次: 基线与工程骨架
- 阶段目标: 建立前端可运行工程与基础布局。
- 前置依赖: 阶段 1。
- 文件范围: apps/web/src/* 。
- 本阶段要做: Vite + Vue3 + TS + Pinia + Router + Naive UI,建立 AppLayout、基础路由、HTTP 客户端占 位。
- 本阶段不要做: 不实现具体业务页逻辑。
- 验收标准: 前端可启动;路由完整;布局存在。
- 可能风险: 页面壳写得过重,后续难拆。
- 人工检查点: 组件中不能夹带角色/聊天业务逻辑。
- 完成后输出: 文件、启动方式、验证方式、剩余工作。

## 完整阶段提示词与说明

```text
阶段 2|Vue3 前端基础工程
阶段目标: 建立前端可运行工程与基础布局。
前置依赖: 阶段 1。
文件范围: apps/web/src/* 。
本阶段要做: Vite + Vue3 + TS + Pinia + Router + Naive UI,建立 AppLayout、基础路由、HTTP 客户端占
位。
本阶段不要做: 不实现具体业务页逻辑。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 2 阶段开发。
项目背景:
这是一个基于 Vue3 + Vite + TypeScript + Pinia + Vue Router + Naive UI 的前端,服
务于轻量级 AI 酒馆系统。
目标是先完成可维护的 Web MVP 前端骨架。
当前阶段:
第 2 阶段:Vue3 前端基础工程
前置条件:
- 已完成:monorepo 初始化
- 当前已有目录:apps/web
- 当前已有模块:前端空壳目录
本阶段目标:
- 建立可启动的 Vue3 前端工程
- 接入 Vue Router、Pinia、Naive UI
- 建立 layouts、views、components、api、stores、composables、types、utils、styles
的目录骨架
本阶段需要实现:
1. 初始化 Vite + Vue3 + TypeScript 工程并接入 Pinia、Vue Router、Naive UI
2. 建立 App.vue 与 AppLayout.vue
3. 建立基础路由:登录入口、角色、会话、聊天、模型、预设、Persona、世界书、Prompt 预览、设
置、备份导入导出
4. 建立 api/http.ts 占位封装
5. 建立全局样式与基础页面空壳
6. 建立基础 not-found 页和 loading/error 占位组件
涉及文件范围:
- apps/web/src/main.ts
- apps/web/src/App.vue
- apps/web/src/layouts/*
- apps/web/src/router/*
- apps/web/src/views/*
- apps/web/src/components/*
- apps/web/src/api/http.ts
- apps/web/src/stores/*
- apps/web/src/composables/*
- apps/web/src/types/*
- apps/web/src/styles/*
本阶段明确不要做:
- 不要实现实际业务接口调用
- 不要实现角色 CRUD 页面细节
- 不要实现聊天流式逻辑
- 不要接入模型供应商
- 不要引入大型 UI 之外的新依赖
- 不要把 API Key 写入前端
- 不要硬编码 Prompt
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- Vue3 Composition API
- TypeScript
- Pinia
- Vue Router
- Naive UI
- 页面与组件目录清晰
- 组件只做展示壳,不塞业务规则
验收标准:
1. 前端可以启动
2. 路由能切换到各个占位页面
3. 基础布局与导航存在
4. 目录结构适合后续逐阶段填充
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 前端启动方式
4. 如何验证路由与布局正常
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: 前端可启动;路由完整;布局存在。
可能风险: 页面壳写得过重,后续难拆。
人工检查点: 组件中不能夹带角色/聊天业务逻辑。
完成后输出: 文件、启动方式、验证方式、剩余工作。
```
