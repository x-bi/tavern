---
title: "建议版目标与架构"
source_pdf: "轻量级 AI 酒馆方案深度研究与实施报告.pdf"
---

# 建议版目标与架构

必要修订与建议版方案
必须修订的地方
本报告建议只做“必要修订”,不改变文件大方向。关键修订如下:
是
否
改
原始设想 建议修订 原因
变
方
向
首版同时覆盖研究、产
把“实施工程”与“文档资产”拆开:
品、Prompt、模型适
代码首发只做 MVP 闭环,Codex 否则会出现“文档先于产品”的交付
配、部署、Codex 提 否
提示词/AGENTS 可与代码并行产 失衡。
示词、AGENTS 等大
出,但不阻塞首发
而全内容
v1 仅正式发布单用户模式;多用
当前用户规模不需要;Agnai 类型
首版默认同时支持单用 户保留 User 维度、JWT 骨架与
否 复杂度不适合首发。
户与轻量多用户 数据隔离字段,但不开启共享/管
理逻辑
保留 POST /api/chat/
stream ,但前端使用 fetch + Nest 的 @Sse() 示例与
POST /api/chat/
ReadableStream 解析 EventSource 配套,原生
stream + 原生 SSE / 否
text/event-stream ;不要 EventSource 只基于 URL 建立单向
EventSource 混用
用原生 EventSource 发送聊天请 连接;聊天需要请求体。 32
求
OpenAI 官方重点推进
v1 就把 Responses /
v1 内部规范以“统一消息结构 + Responses,但 DeepSeek 与
Chat Completions /
Chat Completions 适配层”为主, 否 OpenRouter 的主路径都仍非常贴
多供应商差异全部等权
Responses 适配层作为 Phase 2 近 Chat Completions;先保兼容
适配
面再扩展。 35
这是最小但完整的角色扮演提示
Prompt Builder 一开 v1 只做平台规则 + 角色卡 +
链。Chub/Kobold 的 scan depth /
始做长期记忆/摘要/高 Persona + 命中的世界书 + 最近 否
token budget / World Info 已足以
级递归世界书 历史 + 用户输入 + 输出约束
支持首版。 31
首版追求绝对轻量,但
同时加入插件、Bot 首版只做目录边界与接口占位, 预留可以,提前施工会稀释主线。
否
Gateway、PWA、多 不写业务实现
端包装预留实现
建议版目标产品定义
基于上述修订,建议把首版产品定义收敛为:
Tavern Lite:一个基于 Vue 3 + NestJS + Prisma + SQLite 的轻量自托管 AI 角色对话系统,面
向个人与小范围朋友使用,支持角色卡、会话管理、Prompt 预览、关键词世界书、OpenAI-
compatible 模型配置与流式聊天,并以清晰模块边界支持后续由 Codex 分阶段继续开发。
推荐的前后端主方案
前端建议采用 Vue 3 + Vite + TypeScript + Pinia + Vue Router + Naive UI。Vue 官方对完整应用推荐
Composition API + SFC;Pinia 在 TS、state 共享、debug 和更简洁 API 方面都优于继续新建 Vuex 风格复杂
结构;Naive UI 官方 README 直接强调它是 Vue 3 组件库,具备完备组件、可主题化、TypeScript 编写与较
快的数据组件,对聊天产品需要的大量表单、抽屉、模态框、表格与暗色主题更合适。Element Plus 也完全可
用,但它更偏后台/表单管理风格;若目标是“聊天优先、风格自定义优先”,Naive UI 更合拍。 37
后端建议采用 NestJS + Prisma + SQLite + fetch/SSE 格式流。Nest 原生提供模块化结构、CORS、文件上
传、静态资源与 SSE 支持;SQLite 适合单机单文件部署与简化备份;Prisma 则使 SQLite → PostgreSQL 的未
来迁移更可控。数据库建议启动时开启 WAL,并把聊天写入设计为“短事务 + 会话级锁 + 分页拉取 + 后台归档
点预留”。 38
下面的建议版架构图与文件方向一致,但把首版边界收紧了:
Vue3WebApp
REST+fetchstream
NestJSAPI
Auth/UserMode PromptPreviewModule ModelConfigModule Uploads/StaticAssets Prisma ChatOrchestrator
SQLite PromptBuilder ModelGateway
CharacterModule Conversa M ti o o d n u & le Message WorldBookModule Persona/Preset Open P A r I o -c v o id m e p rs atible
OpenAI/DeepSeek/
OpenRouter/LocalProxy
