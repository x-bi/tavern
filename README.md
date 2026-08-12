# Tavern Lite

Tavern Lite 是一个轻量级 AI 酒馆 / 角色对话系统，目标是先完成个人和少量朋友可用的 Web MVP。

项目采用 Vue 3 + Vite + TypeScript + Pinia + Vue Router + Naive UI 作为前端方案，NestJS + Prisma + SQLite 作为后端方案。首版围绕角色、会话、Context Engine、Model Gateway、SSE 流式聊天和本地持久化构建，不做大规模 SaaS。

## MVP 范围

首版必须覆盖：

- 单用户或简单登录入口。
- 角色 CRUD、角色头像、角色卡 JSON 导入导出。
- 模型链配置、OpenAI-compatible 连接测试。
- 会话与消息持久化。
- Context Engine 和 Prompt 预览。
- `POST /api/chat/stream` 流式聊天。
- 世界书关键词匹配与命中调试。
- 基础设置、备份、恢复和单机部署。

首版明确不做：

- 支付、公开市场、创作者收益。
- 多租户 SaaS、复杂后台权限、大规模审核。
- 官方机器人平台、群聊机器人、TTS、自动生图、图生图、图片编辑、向量数据库、RAG。普通 QQ 个人号私聊同步作为可选外部入口已实现。
- Redis、队列系统、微服务架构。
- 桌面端、小程序、移动 App、浏览器插件。

## 当前状态

酒馆角色对话 MVP 主体已实现，处于功能完善与验收阶段。

已完成：

- `AGENTS.md`：项目唯一开发规则与架构说明（合并自原 `docs/architecture.md`）。
- `README.md`：项目说明与启动方式。
- `docs/conversation-long-term-memory.md`：独立 AI 角色长期陪伴设计。
- `package.json`、`pnpm-workspace.yaml`：pnpm workspace 根配置。
- `apps/web`：Vue3 + Vite 前端。
- `apps/server`：NestJS 后端，已落地 auth、characters、models、conversations、messages、personas、presets、world-books、prompts、chat、assets、content-packs、backups、settings、health、qq-bridge 等模块。
- `packages/shared`：前后端共享类型。
- `prisma/schema.prisma`：Prisma SQLite datasource 与数据模型。
- `prisma/seed.cjs`：默认用户、模型链、Prompt 预设、Persona、样例角色和世界书 seed。
- `data`：本地 SQLite 数据库与运行时数据目录。

已实现的核心闭环：模型链配置与连接测试、角色与会话消息管理、Context Engine 与 Prompt 预览、Model Gateway、SSE 流式聊天、停止 / 重新生成 / 消息编辑删除、手动聊天场景生图、世界书匹配与运行态管理、导入导出与备份恢复。独立 AI 角色形态也已落地首版闭环：角色即唯一长期关系线程，使用隔离的数据模型、上下文构建、聊天路由和可选长期记忆。普通 QQ 个人号可通过 NapCat 把一个好友一对一绑定到酒馆会话或 AI 角色，并同步同一份聊天记录；见 `docs/qq-personal-account-bridge.md`。

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
- 默认模型链：`Default Demo Model Chain`
- 默认 Prompt 预设：`Balanced Roleplay`
- 默认 Persona：`Curious Traveler`
- 样例角色：`Mira, Keeper of the Lantern Archive`
- 样例世界书：`Lantern Archive Notes`，包含 2 条世界书条目

默认模型链使用占位模型，不包含真实 API Key，`apiKeyCiphertext` 和 `apiKeyMask` 均为空。

## 旧数据归属与 Docker 升级

项目从原单用户 `demo` 升级为多账号后，旧角色、会话、AI 角色、Persona、世界书、预设、模型配置、资产和用户设置需要归属到管理员 `root`。迁移前必须备份 `data/` 和 `uploads/`。

本地迁移：

```powershell
Copy-Item data/tavern-lite.db "data/tavern-lite.before-user-migration.db"
pnpm db:migrate-legacy-admin -- --source=demo --target=root
```

Docker 使用宿主目录 `./data:/app/data` 和 `./uploads:/app/uploads` 持久化，因此重建镜像不会删除旧数据。升级步骤：

```bash
docker compose down
cp -a data "data.backup-$(date +%Y%m%d-%H%M%S)"
cp -a uploads "uploads.backup-$(date +%Y%m%d-%H%M%S)"
docker compose up -d --build
```

首次使用新版本时先用 `.env` 中的 `root` 登录一次，让管理员账号写入数据库，再执行：

```bash
docker compose exec server pnpm db:migrate-legacy-admin -- --source=demo --target=root
```

迁移脚本在单个数据库事务中更新归属，成功后禁用旧 `demo` 账号；重复执行不会重复搬运数据。若 root 已存在同名模型供应商、模型链、Prompt 预设或 Persona，脚本会在写入前终止，要求先处理同名数据。

## 项目目录

```text
.
├── AGENTS.md
├── README.md
├── docs/                     # 当前架构、运维与验收文档
├── apps/
│   ├── web/                 # Vue3 + Vite 主站前端
│   ├── share-web/           # 独立公共分享前端
│   └── server/              # NestJS 后端
├── packages/
│   └── shared/              # 前后端共享类型
├── prisma/                  # Prisma schema 与 migrations
├── data/                    # 本地运行时数据，禁止提交真实数据
├── uploads/                 # 运行时上传文件，禁止提交真实文件
└── scripts/                 # 项目维护与验证脚本
```

## Workspace 包

| 包名             | 路径              | 当前职责                           |
| ---------------- | ----------------- | ---------------------------------- |
| `@tavern/web`    | `apps/web`        | Vue3 + Vite 前端基础工程           |
| `@tavern/server` | `apps/server`     | NestJS 后端基础工程                |
| `@tavern/shared` | `packages/shared` | 共享 TypeScript 类型，不放业务逻辑 |

根级脚本约定：

- `pnpm dev`：并行运行主站前端与后端开发服务。
- `pnpm dev:web`：只运行主站 Vite 开发服务。
- `pnpm dev:server`：只运行 NestJS 后端开发服务。
- `pnpm typecheck`：执行各 workspace 的 TypeScript 检查。
- `pnpm lint`：执行 ESLint。
- `pnpm format:check`：检查 Prettier 格式。
- `pnpm db:seed`：写入可重复执行的本地演示数据。
- `pnpm workspace:list`：列出 workspace 包。

## 开发规则入口

所有后续开发任务先阅读 `AGENTS.md`。`AGENTS.md` 是项目唯一的开发规则与架构说明来源（已合并原 `docs/architecture.md`）。如果任务涉及架构、模块边界、API Key、Context Engine、Model Gateway、SSE、数据库变更或 AI 角色形态，必须遵守 `AGENTS.md` 中的约束。

## 文档入口

- 开发规则与架构：[AGENTS.md](./AGENTS.md)
- AI 角色长期陪伴设计：[docs/conversation-long-term-memory.md](./docs/conversation-long-term-memory.md)
- Context Engine 当前落地约束：[docs/tavern-codex-full-implementation-instructions.md](./docs/tavern-codex-full-implementation-instructions.md)
- Context Engine 不变量验收：[docs/context-engine-invariant-matrix.md](./docs/context-engine-invariant-matrix.md)
