---
stage: 5
title: "数据库 schema 初版"
wave: "baseline"
wave_title: "基线与工程骨架"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 5｜数据库 schema 初版

## 快速读取

- 波次: 基线与工程骨架
- 阶段目标: 建立一版足以支撑 MVP 的完整数据模型。
- 前置依赖: 阶段 4。
- 文件范围: prisma/schema.prisma 。
- 本阶段要做: 建 User、Character、Conversation、Message、WorldBook、WorldBookEntry、 ModelConfig、PromptPreset、UserPersona、Asset、AppSetting、ModelCallLog。
- 本阶段不要做: 不做高级优化,不上复杂索引策略。
- 验收标准: schema 覆盖 MVP;迁移成功;关系正确。
- 可能风险: 把未来功能全塞进去。
- 人工检查点: 检查 JSON 字段是否只用于非高频查询数据。
- 完成后输出: 模型说明、迁移方式、风险。

## 完整阶段提示词与说明

```text
阶段 5|数据库 schema 初版
阶段目标: 建立一版足以支撑 MVP 的完整数据模型。
前置依赖: 阶段 4。
文件范围: prisma/schema.prisma 。
本阶段要做: 建 User、Character、Conversation、Message、WorldBook、WorldBookEntry、
ModelConfig、PromptPreset、UserPersona、Asset、AppSetting、ModelCallLog。
本阶段不要做: 不做高级优化,不上复杂索引策略。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 5 阶段开发。
项目背景:
MVP 需要完整但不过度设计的数据库模型,支持角色管理、会话、消息、Prompt Builder、世界书、
模型配置、上传资源、设置与调用日志。
当前阶段:
第 5 阶段:数据库 schema 初版
前置条件:
- 已完成:Prisma + SQLite 接入
- 当前已有目录:prisma
- 当前已有模块:Prisma 基础
本阶段目标:
- 完成 MVP 所需核心表
- 预留少量后续扩展字段,但不引入复杂多租户和商业字段
- 保持对 PostgreSQL 未来迁移友好
本阶段需要实现:
1. 设计 User、Character、Conversation、Message、WorldBook、WorldBookEntry、
ModelConfig、PromptPreset、UserPersona、Asset、AppSetting、ModelCallLog
2. 需要 createdAt、updatedAt,必要处可加 deletedAt
3. 对角色、会话、消息、世界书、模型配置建立合理索引
4. exampleMessages、metadata 等可用 Json 或 String,做出清晰选择并注释
5. 生成迁移
涉及文件范围:
- prisma/schema.prisma
- prisma/migrations/*
本阶段明确不要做:
- 不要实现所有可选表的完整业务逻辑
- 不要设计多租户组织空间
- 不要加入支付、市场、审核、收益系统相关字段
- 不要加入向量库相关字段
- 不要把 schema 写得过度复杂
- 不要改动前端
- 不要暴露 API Key 到前端
- 不要硬编码 Prompt
代码要求:
- 字段命名清晰
- 关系明确
- 尽量避免只适用于 PostgreSQL 的特性
- 迁移可执行
验收标准:
1. schema 能覆盖 MVP 所需实体
2. migrate 成功
3. 核心关系正确
4. 没有明显超纲字段
完成后请输出:
1. 修改文件列表
2. 新增迁移列表
3. 模型说明简表
4. 如何执行迁移
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: schema 覆盖 MVP;迁移成功;关系正确。
可能风险: 把未来功能全塞进去。
人工检查点: 检查 JSON 字段是否只用于非高频查询数据。
完成后输出: 模型说明、迁移方式、风险。
```
