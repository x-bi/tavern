# Tavern Lite

Tavern Lite 是一个轻量级 AI 酒馆 / 角色对话系统，目标是先完成个人和少量朋友可用的 Web MVP。

项目采用 Vue 3 + Vite + TypeScript + Pinia + Vue Router + Naive UI 作为前端方案，NestJS + Prisma + SQLite 作为后端方案。首版围绕角色、会话、Prompt Builder、Model Gateway、SSE 流式聊天和本地持久化构建，不做大规模 SaaS。

## MVP 范围

首版必须覆盖：

- 单用户或简单登录入口。
- 角色 CRUD、角色头像、角色卡 JSON 导入导出。
- 模型配置、OpenAI-compatible 连接测试。
- 会话与消息持久化。
- Prompt Builder v1 和 Prompt 预览。
- `POST /api/chat/stream` 流式聊天。
- 世界书关键词匹配与命中调试。
- 基础设置、备份、恢复和单机部署。

首版明确不做：

- 支付、公开市场、创作者收益。
- 多租户 SaaS、复杂后台权限、大规模审核。
- 机器人平台、TTS、图片生成、向量数据库、RAG。
- Redis、队列系统、微服务架构。
- 桌面端、小程序、移动 App、浏览器插件。

## 当前状态

当前处于第 6 阶段：Seed 数据。

已完成：

- `AGENTS.md`：长期开发约束。
- `README.md`：项目说明与范围。
- `docs/architecture.md`：高层架构与阶段路线。
- `package.json`、`pnpm-workspace.yaml`：pnpm workspace 根配置。
- `apps/web`：前端应用占位包。
- `apps/server`：NestJS 后端基础工程。
- `packages/shared`：前后端共享类型占位包。
- `prisma/schema.prisma`：Prisma SQLite datasource 与 MVP 初版数据模型。
- `prisma/seed.cjs`：默认用户、模型配置、Prompt 预设、Persona、样例角色和世界书 seed。
- `data`：本地 SQLite 数据库与运行时数据目录。

当前还没有实现业务 CRUD、聊天流、Prompt Builder 或 Model Gateway。

## 启动方式

先安装依赖：

```powershell
pnpm install
```

可运行以下命令验证 workspace、前后端入口和类型检查：

```powershell
pnpm dev
pnpm dev:web
pnpm dev:server
pnpm workspace:list
pnpm typecheck
```

说明：

- `pnpm dev:web` 启动 Vite 前端。
- `pnpm dev:server` 启动 NestJS 后端。
- `pnpm typecheck` 检查当前 TypeScript 工程。

## Prisma 与 SQLite

默认 SQLite 数据库位置：

```text
data/tavern-lite.db
```

配置入口：

```text
DATABASE_URL="file:../data/tavern-lite.db"
```

该路径由 Prisma 按 `prisma/schema.prisma` 所在目录解析，因此 `../data/tavern-lite.db` 会落到项目根目录的 `data/` 下。`data/` 是本地运行时数据目录，不提交真实数据库文件，后续备份脚本应覆盖该目录。

当前使用 Prisma 6，连接 URL 写在 `prisma/schema.prisma` 的 SQLite datasource 中，并通过 `DATABASE_URL` 配置。NestJS 运行时由 `PrismaService` 使用生成后的 `@prisma/client`。

生成 Prisma Client：

```powershell
pnpm exec prisma generate --schema prisma/schema.prisma
```

执行开发迁移：

```powershell
New-Item -ItemType File -Force data/tavern-lite.db
pnpm exec prisma migrate dev --schema prisma/schema.prisma
```

说明：当前 Windows 验证环境中，Prisma schema engine 在 SQLite 文件不存在时会返回空的 `Schema engine error`。首次迁移前先创建空文件；文件存在后 Prisma 会正常创建表和写入 migration 记录。

重置本地数据库：

```powershell
pnpm exec prisma migrate reset --schema prisma/schema.prisma
```

## Seed 数据

执行 seed：

```powershell
pnpm db:seed
```

也可以通过 Prisma seed 入口执行：

```powershell
pnpm exec prisma db seed
```

重置数据库并恢复演示数据：

```powershell
New-Item -ItemType File -Force data/tavern-lite.db
pnpm exec prisma migrate reset --schema prisma/schema.prisma
pnpm db:seed
```

seed 内容包括：

- 默认用户：`demo`
- 默认模型配置：`OpenAI-compatible Demo`
- 默认 Prompt 预设：`Balanced Roleplay`
- 默认 Persona：`Curious Traveler`
- 样例角色：`Mira, Keeper of the Lantern Archive`
- 样例世界书：`Lantern Archive Notes`，包含 2 条世界书条目

默认模型配置不包含真实 API Key，`apiKeyCiphertext` 和 `apiKeyMask` 均为空。

## 计划目录

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   └── architecture.md
├── apps/
│   ├── web/                 # Vue3 + Vite 前端，阶段 2 继续完善
│   └── server/              # NestJS 后端，阶段 3 继续完善
├── packages/
│   └── shared/              # 前后端共享类型
├── prisma/                  # Prisma schema 与 migrations
├── data/                    # 本地运行时数据，禁止提交真实数据
├── uploads/                 # 运行时上传文件，后续阶段创建且禁止提交真实文件
├── scripts/                 # 项目维护脚本
└── model-context/           # 项目资料与阶段提示词
```

## Workspace 包

| 包名             | 路径              | 当前职责                               |
| ---------------- | ----------------- | -------------------------------------- |
| `@tavern/web`    | `apps/web`        | Vue3 + Vite 前端基础工程               |
| `@tavern/server` | `apps/server`     | NestJS 后端基础工程                    |
| `@tavern/shared` | `packages/shared` | 共享 TypeScript 类型，不放业务逻辑     |

根级脚本约定：

- `pnpm dev`：并行运行前后端占位 dev 脚本。
- `pnpm dev:web`：只运行前端占位 dev 脚本。
- `pnpm dev:server`：只运行后端占位 dev 脚本。
- `pnpm typecheck`：执行各 workspace 的 TypeScript 检查。
- `pnpm lint`：执行 ESLint。
- `pnpm format:check`：检查 Prettier 格式。
- `pnpm db:seed`：写入可重复执行的本地演示数据。
- `pnpm workspace:list`：列出 workspace 包。

## 开发规则入口

所有后续开发任务先阅读 `AGENTS.md`。如果任务涉及架构、模块边界、API Key、Prompt Builder、Model Gateway、SSE 或数据库变更，必须遵守 `AGENTS.md` 中的约束。

## 文档入口

- 开发规则：[AGENTS.md](./AGENTS.md)
- 架构与路线：[docs/architecture.md](./docs/architecture.md)
- 阶段资料：[model-context/stages/README.md](./model-context/stages/README.md)
