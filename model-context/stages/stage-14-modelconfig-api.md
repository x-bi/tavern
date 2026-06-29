---
stage: 14
title: "ModelConfig API"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 14｜ModelConfig API

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 建立模型配置实体与后端 CRUD。
- 前置依赖: 阶段 8。
- 文件范围: models/* 。
- 本阶段要做: baseUrl 、 apiKey 、 providerName 、 modelName 、生成参数 CRUD。
- 本阶段不要做: 不写真实连接测试。
- 验收标准: 1. 模型配置 CRUD 可用 2. apiKey 不会在响应中明文泄露 3. 字段完整覆盖 MVP 需求
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口列表 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 14|ModelConfig API
阶段目标: 建立模型配置实体与后端 CRUD。
前置依赖: 阶段 8。
文件范围: models/* 。
本阶段要做: baseUrl 、 apiKey 、 providerName 、 modelName 、生成参数 CRUD。
本阶段不要做: 不写真实连接测试。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 14 阶段开发。
项目背景:
模型配置是 Prompt Builder 和聊天接口的前置依赖,需要先建立统一模型配置实体。
当前阶段:
第 14 阶段:ModelConfig API
前置条件:
- 已完成:统一响应、基础认证、数据库 schema
- 当前已有目录:models 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 提供模型配置 CRUD
- 安全保存 baseUrl、providerName、modelName、apiKey、temperature、topP、
maxTokens、timeout 等
- 不让业务代码直接依赖具体供应商
本阶段需要实现:
1. 创建 ModelsModule、Controller、Service、DTO
2. 实现 GET /api/model-configs
3. 实现 POST /api/model-configs
4. 实现 GET /api/model-configs/:id
5. 实现 PUT /api/model-configs/:id
6. 实现 DELETE /api/model-configs/:id
7. API 返回时对 apiKey 做脱敏处理
涉及文件范围:
- apps/server/src/modules/models/*
- apps/server/src/common/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 testConnection
- 不要实现 Model Gateway
- 不要在业务模块中直接使用这些配置发请求
- 不要把 apiKey 明文返回给前端
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- DTO 清晰
- apiKey 存储与返回分离
- 响应统一
- 用户数据隔离
验收标准:
1. 模型配置 CRUD 可用
2. apiKey 不会在响应中明文泄露
3. 字段完整覆盖 MVP 需求
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
