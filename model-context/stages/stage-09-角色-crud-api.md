---
stage: 9
title: "角色 CRUD API"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 9｜角色 CRUD API

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 建立角色管理最核心的后端接口。
- 前置依赖: 阶段 8。
- 文件范围: characters/* 。
- 本阶段要做: 列表、详情、创建、更新、删除、复制占位。
- 本阶段不要做: 不实现 JSON 导入导出。
- 验收标准: 角色 CRUD 全可用。
- 可能风险: 角色字段设计和表结构不一致。
- 人工检查点: firstMessage 、 exampleMessages 、 systemPrompt 等字段要完整覆盖。
- 完成后输出: 文件、接口、测试方式。

## 完整阶段提示词与说明

```text
阶段 9|角色 CRUD API
阶段目标: 建立角色管理最核心的后端接口。
前置依赖: 阶段 8。
文件范围: characters/* 。
本阶段要做: 列表、详情、创建、更新、删除、复制占位。
本阶段不要做: 不实现 JSON 导入导出。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 9 阶段开发。
项目背景:
角色是酒馆系统的核心实体。第一版需要先把角色 CRUD API 做稳,再逐步接入导入导出、头像上传和
聊天。
当前阶段:
第 9 阶段:角色 CRUD API
前置条件:
- 已完成:统一响应与错误处理
- 当前已有目录:apps/server/src/modules/characters
- 当前已有模块:Auth、Prisma、common
本阶段目标:
- 提供角色列表、详情、创建、更新、删除 API
- 角色数据字段与 schema 对齐
- 保持 DTO、Service、Controller 结构清晰
本阶段需要实现:
1. 创建 CharactersModule、Controller、Service、DTO
2. 实现 GET /api/characters
3. 实现 POST /api/characters
4. 实现 GET /api/characters/:id
5. 实现 PUT /api/characters/:id
6. 实现 DELETE /api/characters/:id
7. 预留 duplicate 能力入口但可不在本阶段实现
8. 基于 currentUser 做数据隔离
涉及文件范围:
- apps/server/src/modules/characters/*
- apps/server/src/common/*
- packages/shared/*(如需要共享类型)
本阶段明确不要做:
- 不要实现角色 JSON 导入导出
- 不要实现头像上传
- 不要实现聊天逻辑
- 不要在角色模块里硬编码 Prompt Builder 逻辑
- 不要改动无关模块
- 不要暴露 API Key
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- NestJS Module / Controller / Service / DTO
- 数据访问通过 PrismaService
- 响应统一
- 要有基础参数校验
- 代码可读可维护
验收标准:
1. 角色 CRUD API 全部可用
2. DTO 校验正常
3. 用户只能访问自己的角色
4. 响应格式统一
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: 角色 CRUD 全可用。
可能风险: 角色字段设计和表结构不一致。
人工检查点: firstMessage 、 exampleMessages 、 systemPrompt 等字段要完整覆盖。
完成后输出: 文件、接口、测试方式。
```
