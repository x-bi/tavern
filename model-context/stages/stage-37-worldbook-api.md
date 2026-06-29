---
stage: 37
title: "WorldBook API"
wave: "content-enhancement"
wave_title: "世界书、导入导出与设置"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 37｜WorldBook API

## 快速读取

- 波次: 世界书、导入导出与设置
- 阶段目标: 建立世界书与条目 CRUD。
- 前置依赖: 阶段 8。
- 文件范围: world-books/* 。
- 本阶段要做: 世界书和条目管理接口。
- 本阶段不要做: 不实现匹配逻辑。
- 验收标准: 1. 世界书 CRUD 可用 2. 条目 CRUD 可用 3. 字段覆盖 scanDepth / tokenBudget / priority 等核心项
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口列表 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 37|WorldBook API
阶段目标: 建立世界书与条目 CRUD。
前置依赖: 阶段 8。
文件范围: world-books/* 。
本阶段要做: 世界书和条目管理接口。
本阶段不要做: 不实现匹配逻辑。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 37 阶段开发。
项目背景:
世界书是酒馆系统的关键增量上下文机制,但应该先把数据管理接口建好,再做匹配与插入逻辑。
当前阶段:
第 37 阶段:WorldBook API
前置条件:
- 已完成:统一响应、认证、schema
- 当前已有目录:world-books 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 提供世界书和世界书条目的 CRUD
- 支持基础字段:keywords、content、priority、enabled、scanDepth、tokenBudget、
insertionOrder
- 支持与角色的关联字段预留
本阶段需要实现:
1. 创建 WorldBooksModule、Controller、Service、DTO
2. 实现 GET /api/world-books
3. 实现 POST /api/world-books
4. 实现 GET /api/world-books/:id
5. 实现 PUT /api/world-books/:id
6. 实现 DELETE /api/world-books/:id
7. 实现 POST /api/world-books/:id/entries
8. 实现 PUT /api/world-book-entries/:id
9. 实现 DELETE /api/world-book-entries/:id
涉及文件范围:
- apps/server/src/modules/world-books/*
- packages/shared/*
本阶段明确不要做:
- 不要实现关键词匹配
- 不要在 API 模块里拼接 Prompt
- 不要实现多本世界书复杂合并策略
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 世界书与条目结构清晰
- DTO 覆盖核心字段
- 响应统一
验收标准:
1. 世界书 CRUD 可用
2. 条目 CRUD 可用
3. 字段覆盖 scanDepth / tokenBudget / priority 等核心项
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
