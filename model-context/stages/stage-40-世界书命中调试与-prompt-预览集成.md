---
stage: 40
title: "世界书命中调试与 Prompt 预览集成"
wave: "content-enhancement"
wave_title: "世界书、导入导出与设置"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 40｜世界书命中调试与 Prompt 预览集成

## 快速读取

- 波次: 世界书、导入导出与设置
- 阶段目标: 让用户在预览页看见“哪些世界书命中了”。
- 前置依赖: 阶段 28、阶段 39。
- 文件范围: PromptPreview.vue 、Prompt API。
- 本阶段要做: 显示命中条目、插入顺序、预算信息。
- 本阶段不要做: 不做可视化图谱。
- 验收标准: 1. Prompt 预览能看到世界书命中详情 2. 调试信息与实际插入结果一致 3. 空状态与错误状态清晰
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 40|世界书命中调试与 Prompt 预览集成
阶段目标: 让用户在预览页看见“哪些世界书命中了”。
前置依赖: 阶段 28、阶段 39。
文件范围: PromptPreview.vue 、Prompt API。
本阶段要做: 显示命中条目、插入顺序、预算信息。
本阶段不要做: 不做可视化图谱。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 40 阶段开发。
项目背景:
世界书一旦进入 Prompt,如果没有调试可视化,后续很难定位命中错误和 Prompt 污染问题。
当前阶段:
第 40 阶段:世界书命中调试与 Prompt 预览集成
前置条件:
- 已完成:世界书关键词匹配逻辑、Prompt 预览页面
- 当前已有目录:prompts 模块、PromptPreview 前端组件
- 当前已有模块:PromptBuilder 已返回调试数据
本阶段目标:
- 在 Prompt 预览接口与页面中展示世界书命中详情
- 让用户知道哪些条目被命中、为何命中、以什么顺序插入
本阶段需要实现:
1. 扩展 prompts/preview 返回 matchedEntries 相关 debug 字段
2. 前端 PromptPreview.vue 展示“世界书命中”分区
3. 展示条目标题、关键词、priority、insertionOrder、content 摘要
4. 展示 tokenBudget/scanDepth 相关说明(如返回中有)
5. 为未命中场景给出清晰空状态
涉及文件范围:
- apps/server/src/modules/prompts/*
- apps/server/src/services/prompt-builder/*
- apps/web/src/components/PromptPreview.vue
- apps/web/src/views/prompts/PromptPreviewView.vue
- apps/web/src/api/prompts.ts
本阶段明确不要做:
- 不要实现复杂图形化可视化
- 不要在前端重复执行匹配算法
- 不要改动聊天主链路
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 调试信息清晰
- 页面可读
- 与 PromptBuilder 输出结构一致
验收标准:
1. Prompt 预览能看到世界书命中详情
2. 调试信息与实际插入结果一致
3. 空状态与错误状态清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
