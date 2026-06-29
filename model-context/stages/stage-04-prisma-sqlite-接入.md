---
stage: 4
title: "Prisma + SQLite 接入"
wave: "baseline"
wave_title: "基线与工程骨架"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 4｜Prisma + SQLite 接入

## 快速读取

- 波次: 基线与工程骨架
- 阶段目标: 将后端接到 SQLite,并让 Prisma 基础可用。
- 前置依赖: 阶段 3。
- 文件范围: prisma/* 、 apps/server/src/prisma/* 、 .env 。
- 本阶段要做: 初始化 Prisma、SQLite datasource、PrismaService、PrismaModule、基本迁移。
- 本阶段不要做: 不设计完整业务 schema。
- 验收标准: Prisma generate/migrate 正常;Nest 可连 SQLite。
- 可能风险: SQLite 路径、迁移目录混乱。
- 人工检查点: 数据库文件应位于可备份的位置。
- 完成后输出: 文件、迁移方式、验证方式、风险。

## 完整阶段提示词与说明

```text
阶段 4|Prisma + SQLite 接入
阶段目标: 将后端接到 SQLite,并让 Prisma 基础可用。
前置依赖: 阶段 3。
文件范围: prisma/* 、 apps/server/src/prisma/* 、 .env 。
本阶段要做: 初始化 Prisma、SQLite datasource、PrismaService、PrismaModule、基本迁移。
本阶段不要做: 不设计完整业务 schema。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 4 阶段开发。
项目背景:
数据库第一版使用 SQLite,ORM 使用 Prisma。目标是部署简单、备份方便、后续可迁移
PostgreSQL。
当前阶段:
第 4 阶段:Prisma + SQLite 接入
前置条件:
- 已完成:NestJS 基础工程
- 当前已有目录:apps/server、prisma
- 当前已有模块:后端基础骨架
本阶段目标:
- 接入 Prisma
- 使用 SQLite 作为 datasource
- 在 NestJS 中提供 PrismaModule 与 PrismaService
本阶段需要实现:
1. 初始化 Prisma 目录与 schema.prisma
2. 配置 SQLite datasource,数据库文件放到 data 目录或明确约定的位置
3. 创建 PrismaModule 与 PrismaService
4. 在 AppModule 中接入 PrismaModule
5. 完成一次最小迁移验证
6. 在 README 或 docs 里补充 migrate / generate 的执行说明
涉及文件范围:
- prisma/schema.prisma
- prisma/migrations/*
- apps/server/src/prisma/prisma.module.ts
- apps/server/src/prisma/prisma.service.ts
- apps/server/.env.example
- README.md 或 docs/*
本阶段明确不要做:
- 不要一次性写完整业务模型
- 不要实现 User/Character 等完整 CRUD
- 不要引入 PostgreSQL、Redis
- 不要改动前端
- 不要把数据库文件路径写死为不可配置
- 不要把 API Key 暴露到任何前端代码
- 不要硬编码 Prompt
- 不要引入支付、市场、机器人、TTS、图片生成、向量数据库
代码要求:
- 使用 PrismaService 提供数据访问
- SQLite 路径可通过环境变量配置
- 文档要写清迁移和重置方式
验收标准:
1. Prisma generate 正常
2. Prisma migrate dev 正常
3. NestJS 启动时 Prisma 连接正常
4. 数据库文件生成在约定位置
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何执行 prisma generate / migrate
4. 如何验证数据库连接
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: Prisma generate/migrate 正常;Nest 可连 SQLite。
可能风险: SQLite 路径、迁移目录混乱。
人工检查点: 数据库文件应位于可备份的位置。
完成后输出: 文件、迁移方式、验证方式、风险。
```
