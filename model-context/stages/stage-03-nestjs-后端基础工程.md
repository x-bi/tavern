---
stage: 3
title: "NestJS 后端基础工程"
wave: "baseline"
wave_title: "基线与工程骨架"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 3｜NestJS 后端基础工程

## 快速读取

- 波次: 基线与工程骨架
- 阶段目标: 建立后端可运行骨架与配置体系。
- 前置依赖: 阶段 1。
- 文件范围: apps/server/src/* 。
- 本阶段要做: 初始化 NestJS、ConfigModule、全局前缀、CORS、基础模块、健康检查。
- 本阶段不要做: 不接数据库;不写业务 API。
- 验收标准: Nest 服务可启动;健康接口可用。
- 可能风险: 过早把 common 写成“大而全公共库”。
- 人工检查点: 检查配置与业务是否分离。
- 完成后输出: 文件、启动方式、验证方式、风险。

## 完整阶段提示词与说明

```text
阶段 3|NestJS 后端基础工程
阶段目标: 建立后端可运行骨架与配置体系。
前置依赖: 阶段 1。
文件范围: apps/server/src/* 。
本阶段要做: 初始化 NestJS、ConfigModule、全局前缀、CORS、基础模块、健康检查。
本阶段不要做: 不接数据库;不写业务 API。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 3 阶段开发。
项目背景:
这是一个基于 NestJS + TypeScript + Prisma + SQLite 的轻量后端。
目标是为后续角色、会话、聊天、Prompt Builder、Model Gateway 提供清晰模块边界。
当前阶段:
第 3 阶段:NestJS 后端基础工程
前置条件:
- 已完成:monorepo 初始化
- 当前已有目录:apps/server
- 当前已有模块:空壳目录
本阶段目标:
- 建立可启动的 NestJS 服务
- 建立 ConfigModule、环境变量加载、全局前缀、CORS、基础健康检查
- 建立 modules 与 common 目录骨架
本阶段需要实现:
1. 初始化 NestJS 应用
2. 配置 main.ts,包括全局前缀 /api、CORS、基础 ValidationPipe 占位
3. 建立 app.module.ts
4. 建立 config、common、prisma、modules 目录
5. 建立 HealthController 或 AppController 作为基础检查接口
6. 建立 .env.example 占位说明
涉及文件范围:
- apps/server/src/main.ts
- apps/server/src/app.module.ts
- apps/server/src/config/*
- apps/server/src/common/*
- apps/server/src/modules/*
- apps/server/.env.example
- package.json
本阶段明确不要做:
- 不要接入 Prisma 和数据库
- 不要实现业务模块控制器
- 不要实现 SSE、聊天、模型调用
- 不要改动前端
- 不要把 API Key 输出到日志
- 不要硬编码 Prompt
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- NestJS Module / Controller / Service 结构清晰
- 使用 TypeScript
- 配置与业务分离
- 为后续模块扩展保留入口
验收标准:
1. 后端可以启动
2. /api/health 或类似接口可返回正常状态
3. 环境变量加载正常
4. 模块与 common 目录骨架完成
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 后端启动方式
4. 如何验证健康检查接口
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: Nest 服务可启动;健康接口可用。
可能风险: 过早把 common 写成“大而全公共库”。
人工检查点: 检查配置与业务是否分离。
完成后输出: 文件、启动方式、验证方式、风险。
```
