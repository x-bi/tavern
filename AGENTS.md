# Tavern Lite 开发约束

本文件是 Tavern Lite 项目的常驻开发规则，供 Codex、Claude Code 和人工开发者在后续阶段共同遵守。后续任务如未明确要求修改本文件，应把本文件视为项目边界与实现约束的来源。

## 1. 项目目标

Tavern Lite 是一个轻量级 AI 酒馆 / 角色对话 Web MVP，面向个人和少量朋友使用。

首版目标是完成一条可用闭环：

1. 创建或选择角色。
2. 配置模型与参数。
3. 创建会话并发送用户消息。
4. 后端基于角色卡、用户 Persona、世界书命中、历史消息和输出约束构建 Prompt。
5. 通过 Model Gateway 调用 OpenAI-compatible 模型。
6. 使用 `POST /api/chat/stream` 返回 SSE 格式流。
7. 保存用户消息与 assistant 回复。
8. 支持基础管理、导入导出、备份恢复和单机部署。

项目不是大规模 SaaS，不追求支付、市场、机器人、多端包装、TTS、图片生成、向量数据库或高并发架构。

## 2. 技术栈边界

首版固定技术栈：

- 前端：Vue 3、Vite、TypeScript、Pinia、Vue Router、Naive UI。
- 后端：NestJS、TypeScript、Prisma、SQLite。
- 通信：REST API + `fetch` 读取 `ReadableStream`。
- 流式格式：服务端输出 `text/event-stream` 帧，前端自行解析。
- 模型接入：OpenAI-compatible Chat Completions 优先，通过后端 Model Gateway 适配。
- 部署目标：单机 Web 服务，可在后续阶段补 Docker Compose。

未经明确任务要求，不引入以下内容：

- Redis、队列系统、向量数据库、全文检索引擎。
- 支付、公开市场、创作者收益、多租户 SaaS。
- 机器人平台、TTS、图片生成、RAG、长期记忆摘要系统。
- 桌面端、小程序、移动 App、浏览器插件。
- 大型状态机、微服务、插件市场、复杂后台权限系统。

## 3. 计划目录结构

阶段 0 只建立文档，不创建完整工程。后续阶段应按以下目录边界落地：

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   └── architecture.md
├── apps/
│   ├── web/                 # Vue3 + Vite 前端
│   └── api/                 # NestJS 后端
├── packages/
│   └── shared/              # 前后端共享类型、常量、工具
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── uploads/                 # 本地上传文件，禁止提交真实用户文件
├── scripts/                 # 构建、备份、恢复、维护脚本
└── model-context/           # 项目资料与阶段提示词，只读参考
```

目录职责必须清晰：

- `apps/web` 只写前端页面、组件、路由、状态和 API 调用封装。
- `apps/api` 只写后端模块、控制器、服务、DTO、网关、鉴权和文件服务。
- `packages/shared` 只放跨端稳定契约，不放业务实现。
- `prisma` 只放数据库 schema、migration 和 seed。
- `uploads` 只存运行时文件，提交仓库时只能保留占位说明。
- `model-context` 是参考资料，不作为运行时代码依赖。

## 4. 开发原则

- 先做最小可用闭环，再补管理能力和部署稳态。
- 每个阶段只完成当前阶段要求，不提前实现后续业务。
- 模块边界优先于一次性堆功能。
- 后端是安全边界；模型调用、API Key、Prompt Builder 都必须在后端。
- 前端不得绕过后端直接访问模型供应商。
- Prompt 构建必须可解释、可预览、可复用同一条代码路径。
- 数据模型先满足 SQLite 单机使用，不为未实现的大规模并发做过度设计。
- 新增依赖必须服务当前阶段目标，并能说明必要性。
- 不提交真实密钥、真实上传文件、个人聊天数据或供应商响应日志。

## 5. 阶段执行纪律

开发任务必须遵守阶段顺序：

1. 先冻结规则与架构文档。
2. 再初始化 monorepo、前后端基础工程。
3. 再接入 Prisma + SQLite。
4. 再做单用户入口和统一响应。
5. 再做角色、模型配置、会话消息。
6. 再做 Prompt Builder 和 Prompt 预览。
7. 再做 Model Gateway 和流式聊天。
8. 最后补世界书、导入导出、备份恢复、部署和验收。

禁止在早期阶段提前写聊天模型调用、世界书高级逻辑、部署脚本或完整 UI。

## 6. 前端代码规范

- 使用 Vue 3 Composition API 与单文件组件。
- 组件命名使用 `PascalCase.vue`。
- 页面放在 `apps/web/src/pages`。
- 通用组件放在 `apps/web/src/components`。
- API 调用封装放在 `apps/web/src/api`。
- Pinia store 命名使用 `useXxxStore`。
- composable 命名使用 `useXxx`。
- 路由只负责页面装配，不写业务请求逻辑。
- 组件中不得硬编码 Prompt 文本、模型供应商 URL 或 API Key。
- 表单字段名优先与后端 DTO 同名，避免无意义别名。
- Naive UI 作为首选组件库，不混用多个大型 UI 框架。
- 前端错误展示应来自后端统一错误结构，不解析供应商原始错误。

## 7. 后端代码规范

- 使用 NestJS module/controller/service 分层。
- 每个业务域独立模块，例如 `character`、`conversation`、`message`、`model-config`、`prompt-builder`、`model-gateway`。
- Controller 只负责 HTTP 入参、出参和状态码，不写复杂业务。
- Service 负责领域逻辑，不直接拼 HTTP 响应。
- Prisma 访问集中在 service 或 repository 风格封装中，不在 controller 中访问数据库。
- 模型供应商调用只能存在于 `model-gateway` 相关模块。
- Prompt 组装只能存在于 `prompt-builder` 相关模块。
- 上传文件读写只能存在于 uploads/asset 相关服务。
- 禁止在业务模块中散落 `fetch(providerUrl)`、`axios(providerUrl)` 或 SDK 直连模型。

## 8. DTO 与类型规范

- 后端入参必须使用 DTO，文件名使用 `*.dto.ts`。
- DTO 类命名使用 `CreateXxxDto`、`UpdateXxxDto`、`QueryXxxDto`。
- 出参类型使用明确接口或 class，不返回任意结构。
- 分页参数统一使用 `page`、`pageSize`，从 1 开始。
- 时间字段统一使用 ISO 字符串输出。
- ID 字段统一使用字符串或数字中的一种，具体以 Prisma schema 为准，禁止同一实体混用。
- 前后端共享的稳定枚举和类型放入 `packages/shared`，不从前端直接导入后端内部 DTO。
- DTO 字段变更必须同步更新前端 API 类型、README 或接口说明。

## 9. 统一响应规范

除流式接口和文件下载外，REST API 返回统一结构：

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: null | {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

约束：

- 成功响应：`success: true`，`data` 有值，`error: null`。
- 失败响应：`success: false`，`data: null`，`error.code` 必须稳定。
- 不把供应商原始错误完整透出给前端。
- 不在响应中返回 API Key、密钥片段、环境变量或系统 Prompt 全量敏感内容。
- 列表响应统一包含 `items`、`total`、`page`、`pageSize`。

## 10. SQLite 与 Prisma 约束

- 首版只使用 SQLite，不引入 PostgreSQL、MySQL 或 Redis。
- Prisma schema 是数据库结构的唯一来源。
- 数据结构变更必须通过 migration，不手工改 SQLite 表结构。
- SQLite 适合低并发，本项目不得按高并发系统设计接口语义。
- 写入聊天消息时保持短事务，避免长时间持有数据库锁。
- 会话流式生成期间需要会话级并发保护，避免同一会话同时写入多条 assistant 回复。
- 启动阶段可在后续实现中启用 WAL，但不能把 WAL 当作高并发能力。
- 原始 SQL 只在 Prisma 无法表达且有明确理由时使用，并必须局部封装。
- seed 数据不得包含真实 API Key 或私人聊天内容。

## 11. API Key 安全约束

- API Key 只能存在于后端环境变量或后端受控存储中。
- 前端不得保存、展示、拼接或上传明文 API Key，除模型配置表单的单次提交外不得持久保留。
- 后端返回模型配置时必须掩码，例如 `sk-****abcd`，不得返回明文。
- 日志、错误响应、调试信息、Prompt 预览不得包含 API Key。
- `.env.example` 只能写占位符，禁止写真实密钥。
- `.env`、SQLite 生产数据、上传文件和备份文件默认不提交仓库。
- 如果后续阶段将 API Key 写入 SQLite，必须先在文档中标明本地私有部署假设，并实现写入更新、读取调用、返回掩码三条路径的边界。

## 12. Prompt Builder 约束

Prompt Builder 是首版核心模块，必须是后端唯一 Prompt 构建入口。

输入来源：

- 平台基础规则。
- 角色卡信息。
- 用户 Persona。
- 参数预设。
- 命中的世界书条目。
- 最近历史消息。
- 当前用户输入。
- 输出格式和安全约束。

输出要求：

- 输出统一消息结构，优先兼容 OpenAI Chat Completions 的 `messages`。
- Prompt 预览 API 与聊天 API 必须复用同一条 Builder 逻辑。
- Builder 返回结果应包含可解释的组成段落，供 Prompt 预览展示。
- 世界书命中逻辑必须可调试，至少保留命中关键词、优先级、token 预算和注入位置。

禁止事项：

- 禁止在 Vue 组件中硬编码 Prompt。
- 禁止在聊天 service 中临时拼接隐藏 Prompt。
- 禁止 Prompt 预览和真实聊天使用两套不同拼装逻辑。
- 禁止把 API Key、内部错误堆栈、数据库路径注入 Prompt。

## 13. Model Gateway 约束

Model Gateway 是模型供应商调用的唯一出口。

职责：

- 接收 Prompt Builder 输出的统一消息结构。
- 根据模型配置选择 provider、base URL、model、headers 和参数。
- 适配 OpenAI-compatible Chat Completions 请求与响应。
- 将供应商错误转换为项目统一错误码。
- 对流式 delta 做统一事件输出。

禁止事项：

- 前端直接调用 OpenAI、DeepSeek、OpenRouter 或本地代理。
- 业务 service 直接调用供应商 SDK。
- 在多个模块重复实现 provider 适配。
- 将供应商原始响应结构直接泄漏给页面。

首版 provider 只要求 OpenAI-compatible。Responses API、多供应商差异优化、本地模型高级适配可后续阶段再扩展。

## 14. SSE 与聊天流规范

聊天接口固定为：

```text
POST /api/chat/stream
Content-Type: application/json
Accept: text/event-stream
```

前端必须使用 `fetch()` 发起 POST，并读取 `response.body` 的 `ReadableStream`。不要使用原生 `EventSource` 发送聊天请求，因为 `EventSource` 不适合携带 JSON 请求体。

服务端输出 SSE 格式文本帧：

```text
event: delta
data: {"text":"..."}

event: done
data: {"messageId":"..."}

event: error
data: {"code":"MODEL_ERROR","message":"..."}
```

事件约束：

- `delta`：增量文本。
- `done`：生成完成，并返回最终消息 ID 或必要元数据。
- `error`：生成失败，返回统一错误码。
- `ping`：可选心跳事件，用于保持连接。

流式写入约束：

- 用户消息应在调用模型前落库。
- assistant 回复可先以内存累积，完成后一次性落库；如后续改为增量落库，必须处理失败和重复写入。
- 停止生成必须能关闭上游请求，并保存可解释状态。
- 同一会话同一时间只允许一个生成任务。

## 15. 文件上传规范

首版上传范围仅限角色头像、角色卡导入和备份恢复需要的文件。

约束：

- 上传入口必须在后端。
- 前端不得直接写文件系统。
- 上传目录默认为 `uploads/`，真实文件不得提交仓库。
- 文件名必须由后端生成，禁止直接信任用户上传文件名。
- 必须校验文件大小、扩展名和 MIME 类型。
- 头像类文件限制为常见图片格式，角色卡导入限制为 JSON。
- 文件访问必须通过后端静态资源或受控接口，不暴露任意路径读取。
- 删除角色或资产时，后续阶段需要定义文件清理策略，避免孤儿文件无限增长。

## 16. 模块命名约定

建议业务模块命名：

- `auth`：单用户入口或简单登录。
- `character`：角色 CRUD、角色卡导入导出。
- `asset` 或 `uploads`：头像和文件资产。
- `model-config`：模型配置、连接测试。
- `prompt-preset`：参数和 Prompt 预设。
- `persona`：用户 Persona。
- `conversation`：会话。
- `message`：消息。
- `prompt-builder`：Prompt 构建和预览。
- `model-gateway`：模型供应商适配。
- `chat`：聊天编排和流式接口。
- `worldbook`：世界书、条目和命中调试。
- `backup`：导入导出、备份恢复。
- `settings`：本地设置。

命名必须保持单数或复数一致；后端模块目录推荐使用小写短横线。

## 17. 禁止提交内容

禁止提交：

- `.env`、真实 API Key、cookie、token。
- 真实用户聊天记录、真实角色私密数据。
- 运行时 SQLite 数据库文件。
- 真实上传文件和备份包。
- `node_modules`、构建产物、缓存目录。
- 供应商完整错误响应日志。
- 与当前阶段无关的大规模生成代码。

## 18. 验收与汇报格式

每次任务完成后，回复必须包含以下内容，除非用户明确要求只给极简结论：

1. 修改文件列表。
2. 新增文件列表。
3. 如何查看或验证。
4. 覆盖了哪些规则或功能点。
5. 仍需补充的规则或缺口。
6. 风险和 TODO。

如果运行了命令，需要说明命令和结果。若未运行测试，也要明确说明未运行的原因。

## 19. 当前阶段边界

第 0 阶段只允许新增或修改：

- `AGENTS.md`
- `README.md`
- `docs/architecture.md`

本阶段不创建 `apps/web`、`apps/api`、`prisma/schema.prisma`、业务组件、接口、数据库、依赖配置或启动脚本。

