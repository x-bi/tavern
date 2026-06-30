---
stage: 19
title: "UserPersona API"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 19｜UserPersona API

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 让用户 Persona 成为一等对象。
- 前置依赖: 阶段 8。
- 文件范围: personas/* 。
- 本阶段要做: CRUD 与默认 Persona 切换。
- 本阶段不要做: 不接 Prompt Builder 具体拼接。
- 验收标准: 1. Persona CRUD 可用 2. 默认 Persona 可切换 3. 数据隔离正确
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口列表 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 19|UserPersona API
阶段目标: 让用户 Persona 成为一等对象。
前置依赖: 阶段 8。
文件范围: personas/* 。
本阶段要做: CRUD 与默认 Persona 切换。
本阶段不要做: 不接 Prompt Builder 具体拼接。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 19 阶段开发。
项目背景:
Persona 是沉浸式角色对话的重要组成部分,需要独立建模,而不是散落在聊天页本地状态里。
当前阶段:
第 19 阶段:UserPersona API
前置条件:
- 已完成:统一响应与认证
- 当前已有目录:personas 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 实现 Persona CRUD
- 支持默认 Persona 设置
- 让 Persona 后续可被 Prompt Builder 使用
本阶段需要实现:
1. 创建 PersonasModule、Controller、Service、DTO
2. 实现 GET /api/personas
3. 实现 POST /api/personas
4. 实现 PUT /api/personas/:id
5. 实现 DELETE /api/personas/:id
6. 实现 POST /api/personas/:id/set-default
涉及文件范围:
- apps/server/src/modules/personas/*
- packages/shared/*
本阶段明确不要做:
- 不要直接改聊天 Prompt 构建逻辑
- 不要实现 Persona 关联世界书
- 不要改动前端聊天页
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- Persona 字段简洁清楚
- 默认 Persona 逻辑明确
- 与 User 关联
验收标准:
1. Persona CRUD 可用
2. 默认 Persona 可切换
3. 数据隔离正确
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
