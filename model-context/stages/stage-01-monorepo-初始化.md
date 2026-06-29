---
stage: 1
title: "Monorepo 初始化"
wave: "baseline"
wave_title: "基线与工程骨架"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 1｜Monorepo 初始化

## 快速读取

- 波次: 基线与工程骨架
- 阶段目标: 建立前后端协同开发骨架。
- 前置依赖: 阶段 0。
- 文件范围: package.json 、 pnpm-workspace.yaml 、 apps/web 、 apps/server 、 packages/ * 。
- 本阶段要做: 初始化 workspace、统一 lint/format/tsconfig、定义目录。
- 本阶段不要做: 不写业务模块,不接数据库。
- 验收标准: workspace 正常;目录清晰;根脚本可运行。
- 可能风险: 过早引入过多工程化依赖。
- 人工检查点: 保证 packages/shared 只做共享类型,不放业务逻辑。
- 完成后输出: 修改文件、安装方式、验证方式、完成项、风险。

## 完整阶段提示词与说明

```text
阶段 1|Monorepo 初始化
阶段目标: 建立前后端协同开发骨架。
前置依赖: 阶段 0。
文件范围: package.json 、 pnpm-workspace.yaml 、 apps/web 、 apps/server 、 packages/
* 。
本阶段要做: 初始化 workspace、统一 lint/format/tsconfig、定义目录。
本阶段不要做: 不写业务模块,不接数据库。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 1 阶段开发。
项目背景:
这是一个基于 Vue3 + Vite + TypeScript + Pinia + Vue Router + Naive UI + NestJS
+ Prisma + SQLite 的轻量级 AI 酒馆 / 角色对话系统。
项目目标是先完成个人和少量朋友可用的 Web MVP,不做支付、市场、机器人、TTS、图片生成、向量数
据库、Redis 等非 MVP 功能。
当前阶段:
第 1 阶段:Monorepo 初始化
前置条件:
- 已完成:AGENTS.md、README、架构文档
- 当前已有目录:项目根目录与 docs
- 当前已有模块:无业务模块
本阶段目标:
- 建立 pnpm monorepo
- 建立 apps/web、apps/server、packages/shared 的目录骨架
- 建立统一 TypeScript、lint、format 规则
本阶段需要实现:
1. 初始化 pnpm workspace 和根 package.json scripts
2. 建立 apps/web、apps/server、packages/shared、data、docs 目录
3. 配置根级 tsconfig、eslint、prettier、editorconfig
4. 约定共享类型包 packages/shared 的基础导出结构
5. 补充 README 中的 monorepo 说明
涉及文件范围:
- package.json
- pnpm-workspace.yaml
- tsconfig*.json
- .editorconfig
- .gitignore
- apps/web/*
- apps/server/*
- packages/shared/*
- README.md
本阶段明确不要做:
- 不要创建具体业务模块
- 不要引入数据库和 Prisma
- 不要写角色、会话、聊天业务代码
- 不要引入未要求的大型依赖
- 不要改动与 monorepo 无关文件
- 不要把 API Key 暴露到前端
- 不要硬编码 Prompt
- 不要直接接模型供应商接口
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- 使用 TypeScript
- 目录命名清晰
- scripts 命名一致
- 为后续前后端开发保留清晰入口
验收标准:
1. pnpm install 后 workspace 可识别
2. apps/web、apps/server、packages/shared 结构存在
3. 根 scripts 可用于分别启动前后端占位工程
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何安装依赖
4. 如何验证 workspace 正常
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: workspace 正常;目录清晰;根脚本可运行。
可能风险: 过早引入过多工程化依赖。
人工检查点: 保证 packages/shared 只做共享类型,不放业务逻辑。
完成后输出: 修改文件、安装方式、验证方式、完成项、风险。
```
