---
stage: 38
title: "WorldBook 编辑页面"
wave: "content-enhancement"
wave_title: "世界书、导入导出与设置"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 38｜WorldBook 编辑页面

## 快速读取

- 波次: 世界书、导入导出与设置
- 阶段目标: 落地世界书管理 UI。
- 前置依赖: 阶段 37。
- 文件范围: WorldBookEditor.vue 、 WorldBookView.vue 。
- 本阶段要做: 世界书列表、条目编辑。
- 本阶段不要做: 不做命中调试。
- 验收标准: 1. 世界书页可管理世界书和条目 2. 条目字段完整可编辑 3. 页面结构适合后续加入命中调试
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 38|WorldBook 编辑页面
阶段目标: 落地世界书管理 UI。
前置依赖: 阶段 37。
文件范围: WorldBookEditor.vue 、 WorldBookView.vue 。
本阶段要做: 世界书列表、条目编辑。
本阶段不要做: 不做命中调试。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 38 阶段开发。
项目背景:
世界书编辑体验直接影响后续 Prompt Builder 命中效果,需要先把管理界面做出来。
当前阶段:
第 38 阶段:WorldBook 编辑页面
前置条件:
- 已完成:WorldBook API
- 当前已有目录:views/world-books、components、api、stores
- 当前已有模块:前端基础页面骨架
本阶段目标:
- 实现世界书列表与编辑页
- 支持条目增删改
- 清晰展示 keywords、content、priority、enabled 等字段
本阶段需要实现:
1. 创建 WorldBookEditor.vue
2. 创建世界书列表页和编辑页
3. 接入 world-books API
4. 支持条目列表、创建、编辑、删除
5. 支持 scanDepth / tokenBudget 等世界书级字段编辑
6. 支持启用/禁用条目
涉及文件范围:
- apps/web/src/components/WorldBookEditor.vue
- apps/web/src/views/world-books/WorldBookView.vue
- apps/web/src/api/worldBooks.ts
- apps/web/src/stores/worldBook.ts
本阶段明确不要做:
- 不要实现命中调试面板
- 不要接入 PromptBuilderService
- 不要在前端实现正式匹配逻辑
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 编辑器结构清晰
- 条目表单可维护
- 长文本输入体验友好
验收标准:
1. 世界书页可管理世界书和条目
2. 条目字段完整可编辑
3. 页面结构适合后续加入命中调试
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
