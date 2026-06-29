# 分阶段提示词索引

本索引来自分阶段提示词 PDF。每个阶段文件都包含 front matter、快速读取字段和完整阶段提示词。

| 阶段 | 标题 | 波次 | 前置依赖 | 文件范围 |
|---:|---|---|---|---|
| 00 | [项目规则冻结与 AGENTS.md 初始化](stage-00-项目规则冻结与-agents-md-初始化.md) | 基线与工程骨架 | 无。 | AGENTS.md 、 README.md 、 docs/architecture.md 、项目根目录。 |
| 01 | [Monorepo 初始化](stage-01-monorepo-初始化.md) | 基线与工程骨架 | 阶段 0。 | package.json 、 pnpm-workspace.yaml 、 apps/web 、 apps/server 、 packages/ * 。 |
| 02 | [Vue3 前端基础工程](stage-02-vue3-前端基础工程.md) | 基线与工程骨架 | 阶段 1。 | apps/web/src/* 。 |
| 03 | [NestJS 后端基础工程](stage-03-nestjs-后端基础工程.md) | 基线与工程骨架 | 阶段 1。 | apps/server/src/* 。 |
| 04 | [Prisma + SQLite 接入](stage-04-prisma-sqlite-接入.md) | 基线与工程骨架 | 阶段 3。 | prisma/* 、 apps/server/src/prisma/* 、 .env 。 |
| 05 | [数据库 schema 初版](stage-05-数据库-schema-初版.md) | 基线与工程骨架 | 阶段 4。 | prisma/schema.prisma 。 |
| 06 | [Seed 数据](stage-06-seed-数据.md) | 基线与工程骨架 | 阶段 5。 | prisma/seed.* 、 package.json 。 |
| 07 | [单用户模式与简单登录](stage-07-单用户模式与简单登录.md) | 基线与工程骨架 | 阶段 6。 | apps/server/src/modules/auth/* 、 users/* 。 |
| 08 | [统一 API 响应与错误处理](stage-08-统一-api-响应与错误处理.md) | 基线与工程骨架 | 阶段 7。 | apps/server/src/common/* 。 |
| 09 | [角色 CRUD API](stage-09-角色-crud-api.md) | 核心实体与首批页面 | 阶段 8。 | characters/* 。 |
| 10 | [角色列表页](stage-10-角色列表页.md) | 核心实体与首批页面 | 阶段 2、阶段 9。 | apps/web/src/views/characters/* 、 stores/* 、 api/* 。 |
| 11 | [角色创建与编辑页](stage-11-角色创建与编辑页.md) | 核心实体与首批页面 | 阶段 10。 | views/characters/* 、 components/CharacterEditor.vue 。 |
| 12 | [角色详情页](stage-12-角色详情页.md) | 核心实体与首批页面 | 阶段 11。 | CharacterDetailView.vue 。 |
| 13 | [角色头像上传](stage-13-角色头像上传.md) | 核心实体与首批页面 | 阶段 11、阶段 12。 | assets/* 、 AvatarUploader.vue 、角色表单。 |
| 14 | [ModelConfig API](stage-14-modelconfig-api.md) | 核心实体与首批页面 | 阶段 8。 | models/* 。 |
| 15 | [模型配置页面](stage-15-模型配置页面.md) | 核心实体与首批页面 | 阶段 14。 | ModelConfigForm.vue 、 ModelConfigView.vue 。 |
| 16 | [模型连接测试](stage-16-模型连接测试.md) | 核心实体与首批页面 | 阶段 15。 | models/* 、模型页面。 |
| 17 | [PromptPreset API](stage-17-promptpreset-api.md) | 核心实体与首批页面 | 阶段 8。 | presets/* 。 |
| 18 | [参数预设页面](stage-18-参数预设页面.md) | 核心实体与首批页面 | 阶段 17。 | PromptPresetForm.vue 、 PresetView.vue 。 |
| 19 | [UserPersona API](stage-19-userpersona-api.md) | 核心实体与首批页面 | 阶段 8。 | personas/* 。 |
| 20 | [Persona 设置页面](stage-20-persona-设置页面.md) | 核心实体与首批页面 | 阶段 19。 | PersonaEditor.vue 、 PersonaView.vue 。 |
| 21 | [Conversation API](stage-21-conversation-api.md) | 核心实体与首批页面 | 阶段 9、阶段 19。 | conversations/* 。 |
| 22 | [Message API](stage-22-message-api.md) | 核心实体与首批页面 | 阶段 21。 | messages/* 。 |
| 23 | [会话列表页](stage-23-会话列表页.md) | 核心实体与首批页面 | 阶段 21、阶段 22。 | ConversationList.vue 、 ConversationView.vue 。 |
| 24 | [聊天页面 UI 骨架](stage-24-聊天页面-ui-骨架.md) | 核心实体与首批页面 | 阶段 23。 | ChatRoom.vue 、 ChatMessage.vue 、 ChatInput.vue 、 ChatView.vue 。 |
| 25 | [Prompt Builder 类型设计](stage-25-prompt-builder-类型设计.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 21、阶段 22、阶段 19、阶段 37 前的世界书字段已在 schema 中。 | services/prompt-builder/types.ts 、 packages/shared/* 。 |
| 26 | [Prompt Builder v1 实现](stage-26-prompt-builder-v1-实现.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 25。 | PromptBuilderService 。 |
| 27 | [Prompt 预览 API](stage-27-prompt-预览-api.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 26。 | prompts/* 。 |
| 28 | [Prompt 预览页面](stage-28-prompt-预览页面.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 27。 | PromptPreview.vue 、 PromptPreviewView.vue 。 |
| 29 | [Model Gateway 抽象接口](stage-29-model-gateway-抽象接口.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 14。 | services/model-gateway/* 。 |
| 30 | [OpenAI-compatible Chat Completions 适配](stage-30-openai-compatible-chat-completions-适配.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 29。 | services/model-gateway/providers/openai-compatible/* 。 |
| 31 | [后端 SSE / fetch stream 聊天接口](stage-31-后端-sse-fetch-stream-聊天接口.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 21、阶段 22、阶段 26、阶段 30。 | chat/* 。 |
| 32 | [前端 useChatStream composable](stage-32-前端-usechatstream-composable.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 31。 | composables/useChatStream.ts 。 |
| 33 | [聊天流式输出接入](stage-33-聊天流式输出接入.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 24、阶段 32。 | chat.ts store 、 ChatView.vue 、 ChatRoom.vue 。 |
| 34 | [停止生成](stage-34-停止生成.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 33。 | useChatStream.ts 、 ChatStore 、后端中止映射。 |
| 35 | [重新生成回复](stage-35-重新生成回复.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 34。 | messages/regenerate 、聊天页。 |
| 36 | [编辑、删除、复制消息](stage-36-编辑-删除-复制消息.md) | Prompt Builder、Model Gateway 与聊天闭环 | 阶段 22、阶段 33。 | ChatMessage.vue 、 messages API 。 |
| 37 | [WorldBook API](stage-37-worldbook-api.md) | 世界书、导入导出与设置 | 阶段 8。 | world-books/* 。 |
| 38 | [WorldBook 编辑页面](stage-38-worldbook-编辑页面.md) | 世界书、导入导出与设置 | 阶段 37。 | WorldBookEditor.vue 、 WorldBookView.vue 。 |
| 39 | [世界书关键词匹配逻辑](stage-39-世界书关键词匹配逻辑.md) | 世界书、导入导出与设置 | 阶段 26、阶段 37。 | PromptBuilderService 、 world-book-matcher 。 |
| 40 | [世界书命中调试与 Prompt 预览集成](stage-40-世界书命中调试与-prompt-预览集成.md) | 世界书、导入导出与设置 | 阶段 28、阶段 39。 | PromptPreview.vue 、Prompt API。 |
| 41 | [角色卡 JSON 导入](stage-41-角色卡-json-导入.md) | 世界书、导入导出与设置 | 阶段 9、阶段 11。 | characters/import 、前端导入入口。 |
| 42 | [角色卡 JSON 导出](stage-42-角色卡-json-导出.md) | 世界书、导入导出与设置 | 阶段 41。 | characters/export 。 |
| 43 | [数据备份导出](stage-43-数据备份导出.md) | 世界书、导入导出与设置 | 阶段 42。 | backups/export 、设置/备份页。 |
| 44 | [数据恢复导入](stage-44-数据恢复导入.md) | 世界书、导入导出与设置 | 阶段 43。 | backups/import 。 |
| 45 | [设置页](stage-45-设置页.md) | 世界书、导入导出与设置 | 阶段 15、阶段 18、阶段 20、阶段 44。 | SettingView.vue 。 |
| 46 | [Docker Compose 部署](stage-46-docker-compose-部署.md) | 部署、备份、回归与 MVP 验收 | 阶段 45。 | docker-compose.yml 、Dockerfiles。 |
| 47 | [生产环境静态资源托管](stage-47-生产环境静态资源托管.md) | 部署、备份、回归与 MVP 验收 | 阶段 46。 | ServeStatic 或 Nginx 配置。 |
| 48 | [SQLite 与 uploads 备份脚本](stage-48-sqlite-与-uploads-备份脚本.md) | 部署、备份、回归与 MVP 验收 | 阶段 46、阶段 47。 | scripts/backup.* 、 scripts/restore.* 。 |
| 49 | [回归测试与修复](stage-49-回归测试与修复.md) | 部署、备份、回归与 MVP 验收 | 阶段 48。 | tests/* 、修复点相关文件。 |
| 50 | [MVP 验收清单](stage-50-mvp-验收清单.md) | 部署、备份、回归与 MVP 验收 | 阶段 49。 | docs/mvp-checklist.md 、 README.md 。 |
