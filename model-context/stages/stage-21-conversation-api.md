---
stage: 21
title: "Conversation API"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 21｜Conversation API

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 建立会话实体 CRUD 与清空能力。
- 前置依赖: 阶段 9、阶段 19。
- 文件范围: conversations/* 。
- 本阶段要做: 列表、创建、详情、更新、删除、清空。
- 本阶段不要做: 不接聊天生成。
- 验收标准: 1. 会话 CRUD 可用 2. clear 会清空消息但不误删会话本身 3. 关系字段正确
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口列表 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 21|Conversation API
阶段目标: 建立会话实体 CRUD 与清空能力。
前置依赖: 阶段 9、阶段 19。
文件范围: conversations/* 。
本阶段要做: 列表、创建、详情、更新、删除、清空。
本阶段不要做: 不接聊天生成。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 21 阶段开发。
项目背景:
Conversation 是角色聊天的容器,必须先于 ChatModule 完成。
当前阶段:
第 21 阶段:Conversation API
前置条件:
- 已完成:角色 API、Persona API
- 当前已有目录:conversations 模块占位
- 当前已有模块:Characters、Personas、Auth、Prisma
本阶段目标:
- 实现会话 CRUD
- 支持会话与角色、Persona、模型配置、预设的关联字段
- 支持清空会话
本阶段需要实现:
1. 创建 ConversationsModule、Controller、Service、DTO
2. 实现 GET /api/conversations
3. 实现 POST /api/conversations
4. 实现 GET /api/conversations/:id
5. 实现 PUT /api/conversations/:id
6. 实现 DELETE /api/conversations/:id
7. 实现 POST /api/conversations/:id/clear
涉及文件范围:
- apps/server/src/modules/conversations/*
- packages/shared/*
本阶段明确不要做:
- 不要生成消息内容
- 不要实现聊天流式接口
- 不要在会话模块里硬编码 Prompt 逻辑
- 不要改动无关模块
- 不要暴露 API Key
- 不要引入非 MVP 功能
代码要求:
- 会话与角色/User/Persona 的关系清晰
- 有基础校验与错误处理
- 响应统一
验收标准:
1. 会话 CRUD 可用
2. clear 会清空消息但不误删会话本身
3. 关系字段正确
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
