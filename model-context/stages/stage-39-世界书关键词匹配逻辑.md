---
stage: 39
title: "世界书关键词匹配逻辑"
wave: "content-enhancement"
wave_title: "世界书、导入导出与设置"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 39｜世界书关键词匹配逻辑

## 快速读取

- 波次: 世界书、导入导出与设置
- 阶段目标: 把世界书真正插入 Prompt Builder。
- 前置依赖: 阶段 26、阶段 37。
- 文件范围: PromptBuilderService 、 world-book-matcher 。
- 本阶段要做: 基于最近消息和最新输入做关键词匹配、优先级排序、budget 限制。
- 本阶段不要做: 不做递归匹配和 regex 高级特性。
- 验收标准: 1. 世界书可根据关键词命中 2. 命中内容进入 Prompt 3. debug 信息能查看命中条目 4. 未命中时不会污染 Prompt
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 如何测试命中逻辑 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 39|世界书关键词匹配逻辑
阶段目标: 把世界书真正插入 Prompt Builder。
前置依赖: 阶段 26、阶段 37。
文件范围: PromptBuilderService 、 world-book-matcher 。
本阶段要做: 基于最近消息和最新输入做关键词匹配、优先级排序、budget 限制。
本阶段不要做: 不做递归匹配和 regex 高级特性。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 39 阶段开发。
项目背景:
世界书的价值不在管理界面,而在于按关键词动态插入 Prompt。
当前阶段:
第 39 阶段:世界书关键词匹配逻辑
前置条件:
- 已完成:Prompt Builder v1、WorldBook API
- 当前已有目录:services/prompt-builder、world-books 模块
- 当前已有模块:PromptBuilderService、WorldBook 数据结构
本阶段目标:
- 实现世界书关键词命中
- 将命中结果按 priority / insertionOrder / tokenBudget 处理后插入 Prompt
- 返回调试信息
本阶段需要实现:
1. 创建 world book matcher(可独立函数或服务)
2. 扫描用户最新输入和最近 N 条消息
3. 支持 keywords 基础匹配,第一版只做大小写不敏感普通词匹配
4. 支持 enabled、priority、insertionOrder、scanDepth、tokenBudget
5. 命中后将 content 作为独立 PromptSection 插入 PromptBuilder 结果
6. 在 debug 信息中返回 matchedEntries
涉及文件范围:
- apps/server/src/services/prompt-builder/*
- apps/server/src/modules/world-books/*
- packages/shared/*
本阶段明确不要做:
- 不要实现复杂 regex
- 不要实现递归触发
- 不要实现向量检索
- 不要把匹配逻辑写到前端
- 不要暴露 API Key
- 不要硬编码 Prompt 到聊天控制器
- 不要引入非 MVP 功能
代码要求:
- 匹配逻辑独立可测
- PromptBuilderService 只调用 matcher,不内嵌大量分支
- token 控制可先粗粒度实现
验收标准:
1. 世界书可根据关键词命中
2. 命中内容进入 Prompt
3. debug 信息能查看命中条目
4. 未命中时不会污染 Prompt
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试命中逻辑
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
