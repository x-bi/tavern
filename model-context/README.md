# Tavern Lite 模型上下文总览

## 用途

本目录把两个 PDF 解析成长期可复用的 Markdown 知识包，供 Codex、Claude Code 或其他模型在后续开发中按需读取。

## 源文件

- `轻量级 AI 酒馆方案深度研究与实施报告.pdf`: 总体方案、范围收敛、架构取舍、路线图、风险与验收。
- `Tavern Lite 分阶段开发提示词总表与落地执行章.pdf`: 0-50 阶段的可执行开发提示词与验收要求。

## 首版硬目标

- 做轻量级、自托管、Web 优先的 AI 酒馆 / 角色对话系统。
- 首版闭环聚焦: 角色卡、会话、消息、Prompt Builder v1、Prompt 预览、OpenAI-compatible 模型配置、流式聊天、关键词世界书、导入导出、备份恢复与基础部署。
- 技术栈基线: Vue3 + Vite + TypeScript + Pinia + Vue Router + Naive UI；NestJS + Prisma + SQLite。
- 开发方式: 分阶段小步推进，每个阶段只改可控边界，必须声明依赖、文件范围、不做事项、验收标准和风险。

## 明确不进入 MVP 的内容

- 支付、公开市场、复杂后台、多租户 SaaS、大规模审核。
- 插件市场、机器人接入、TTS、图片生成、RAG、向量数据库、Redis。
- 群聊、复杂分支剧情、长期记忆摘要、脚本系统、多端原生包装。
- 前端保存或暴露 API Key；业务代码直接调用供应商 SDK；聊天接口绕过 Prompt Builder。

## 核心工程不变量

- Prompt Builder 是唯一 Prompt 组装入口；Prompt 预览与真实聊天必须复用同一条构建路径。
- Model Gateway 是唯一模型供应商适配入口；聊天服务和前端页面不直接耦合具体 provider。
- SQLite 适合首版低并发自托管；需要短事务、会话级锁、WAL、分页加载和备份恢复路径。
- 世界书首版只做关键词触发、scan depth、token budget、priority、命中调试，不做复杂递归或向量召回。
- 流式聊天使用 `POST /chat/stream` + fetch stream / SSE 语义，必须支持停止生成、失败回退、保存 assistant 回复。

## 推荐读取顺序

1. `README.md`
2. `overall-plan/00-executive-summary.md`
3. `overall-plan/01-project-scope.md`
4. `overall-plan/03-revised-architecture.md`
5. `stages/stage-index.md`
6. 当前要执行的 `stages/stage-XX-*.md`

## 阶段波次

| 阶段范围 | wave | 含义 |
|---|---|---|
| 00-08 | `baseline` | 基线与工程骨架 |
| 09-24 | `core-entities` | 核心实体与首批页面 |
| 25-36 | `chat-loop` | Prompt Builder、Model Gateway 与聊天闭环 |
| 37-45 | `content-enhancement` | 世界书、导入导出与设置 |
| 46-50 | `deploy-and-acceptance` | 部署、备份、回归与 MVP 验收 |

## 阶段索引

| 阶段 | 标题 | 波次 |
|---:|---|---|
| 00 | 项目规则冻结与 AGENTS.md 初始化 | 基线与工程骨架 |
| 01 | Monorepo 初始化 | 基线与工程骨架 |
| 02 | Vue3 前端基础工程 | 基线与工程骨架 |
| 03 | NestJS 后端基础工程 | 基线与工程骨架 |
| 04 | Prisma + SQLite 接入 | 基线与工程骨架 |
| 05 | 数据库 schema 初版 | 基线与工程骨架 |
| 06 | Seed 数据 | 基线与工程骨架 |
| 07 | 单用户模式与简单登录 | 基线与工程骨架 |
| 08 | 统一 API 响应与错误处理 | 基线与工程骨架 |
| 09 | 角色 CRUD API | 核心实体与首批页面 |
| 10 | 角色列表页 | 核心实体与首批页面 |
| 11 | 角色创建与编辑页 | 核心实体与首批页面 |
| 12 | 角色详情页 | 核心实体与首批页面 |
| 13 | 角色头像上传 | 核心实体与首批页面 |
| 14 | ModelConfig API | 核心实体与首批页面 |
| 15 | 模型配置页面 | 核心实体与首批页面 |
| 16 | 模型连接测试 | 核心实体与首批页面 |
| 17 | PromptPreset API | 核心实体与首批页面 |
| 18 | 参数预设页面 | 核心实体与首批页面 |
| 19 | UserPersona API | 核心实体与首批页面 |
| 20 | Persona 设置页面 | 核心实体与首批页面 |
| 21 | Conversation API | 核心实体与首批页面 |
| 22 | Message API | 核心实体与首批页面 |
| 23 | 会话列表页 | 核心实体与首批页面 |
| 24 | 聊天页面 UI 骨架 | 核心实体与首批页面 |
| 25 | Prompt Builder 类型设计 | Prompt Builder、Model Gateway 与聊天闭环 |
| 26 | Prompt Builder v1 实现 | Prompt Builder、Model Gateway 与聊天闭环 |
| 27 | Prompt 预览 API | Prompt Builder、Model Gateway 与聊天闭环 |
| 28 | Prompt 预览页面 | Prompt Builder、Model Gateway 与聊天闭环 |
| 29 | Model Gateway 抽象接口 | Prompt Builder、Model Gateway 与聊天闭环 |
| 30 | OpenAI-compatible Chat Completions 适配 | Prompt Builder、Model Gateway 与聊天闭环 |
| 31 | 后端 SSE / fetch stream 聊天接口 | Prompt Builder、Model Gateway 与聊天闭环 |
| 32 | 前端 useChatStream composable | Prompt Builder、Model Gateway 与聊天闭环 |
| 33 | 聊天流式输出接入 | Prompt Builder、Model Gateway 与聊天闭环 |
| 34 | 停止生成 | Prompt Builder、Model Gateway 与聊天闭环 |
| 35 | 重新生成回复 | Prompt Builder、Model Gateway 与聊天闭环 |
| 36 | 编辑、删除、复制消息 | Prompt Builder、Model Gateway 与聊天闭环 |
| 37 | WorldBook API | 世界书、导入导出与设置 |
| 38 | WorldBook 编辑页面 | 世界书、导入导出与设置 |
| 39 | 世界书关键词匹配逻辑 | 世界书、导入导出与设置 |
| 40 | 世界书命中调试与 Prompt 预览集成 | 世界书、导入导出与设置 |
| 41 | 角色卡 JSON 导入 | 世界书、导入导出与设置 |
| 42 | 角色卡 JSON 导出 | 世界书、导入导出与设置 |
| 43 | 数据备份导出 | 世界书、导入导出与设置 |
| 44 | 数据恢复导入 | 世界书、导入导出与设置 |
| 45 | 设置页 | 世界书、导入导出与设置 |
| 46 | Docker Compose 部署 | 部署、备份、回归与 MVP 验收 |
| 47 | 生产环境静态资源托管 | 部署、备份、回归与 MVP 验收 |
| 48 | SQLite 与 uploads 备份脚本 | 部署、备份、回归与 MVP 验收 |
| 49 | 回归测试与修复 | 部署、备份、回归与 MVP 验收 |
| 50 | MVP 验收清单 | 部署、备份、回归与 MVP 验收 |
