# Tavern Lite 外部共享聊天层方案

## 1. 目标与固定语义

为现有酒馆会话和 AI 角色生成无需登录的外部分享链接。公共页面是原始聊天线程的外部访问窗口，不复制会话，也不为每个访客新建会话。

- 链接绑定一个现有 `Conversation` 或 `Companion`。
- 主站和公共页面读取相同消息记录，消息 ID、顺序、状态保持一致。
- 访客发送的消息直接写入原线程，主站产生的消息也同步到公共页面。
- 多人打开同一链接时共享同一个线程。
- 撤销链接不删除原始会话和消息。
- 公共响应不得暴露角色卡、Persona、世界书、Prompt、长期记忆原文、API Key、用户资料或其他页面入口。

## 2. 当前基础与边界

实施前先读取项目根目录 `AGENTS.md` 并核对当前代码事实：

- 已有多账号登录、root 管理员、成员 CRUD 和用户数据隔离。
- 模型供应商、供应商模型和模型链全站共享。
- 酒馆使用 `Conversation`、`Message`、`ChatService`、酒馆 `PromptBuilderService` 和 `/api/chat/stream`。
- AI 角色使用独立 `Companion`、`CompanionMessage`、`CompanionMemory`、Companion Prompt Builder 和 Companion Chat 路由。
- 两种形态不能混用数据模型、Prompt Builder 和聊天路由。
- 两种形态继续共用 `ModelGatewayService`、Prisma、SQLite 和全站模型链。
- 当前是单实例 Docker 部署，不引入 Redis、队列或微服务。

## 3. 推荐架构

新增独立公共前端，与主站同层：

```text
apps/
├── web/          # 原主站
├── share-web/    # 新增公共分享聊天页
└── server/       # 共用后端
```

`apps/share-web` 必须是独立 Vite 应用、独立构建产物、独立开发端口和独立 Docker 容器，只提供 `/s/:token`，不包含登录、侧边栏、角色列表、设置、模型、备份等主站路由。未知地址显示 share-web 自己的 404，不重定向主站。

生产建议：

```text
主站：https://tavern.example.com
分享：https://share.example.com/s/<token>
```

部署模式分两种，按是否有正式域名选择：

- **双域名模式**（有正式域名后落实）：主站和分享各用一个域名，如上。当前阶段不采用。
- **端口区分模式**（当前无域名阶段，单服务器单公网 IP）：主站与 share-web 共用同一公网 IP，靠端口区分。示例：

```text
主站：  http://<公网IP>:8080
分享：  http://<公网IP>:8081/s/<token>
```

端口区分模式约束：

- `SHARE_PUBLIC_BASE_URL` 手动配置为分享地址，如 `http://<公网IP>:8081`，不自动探测本地 IP。
- share-web 容器独占一个宿主机端口（示例 8081），主站 web 容器继续用原端口（示例 8080）。
- 宝塔/反代层把 `8081` 直接指向 share-web 容器，`8080` 继续指向主站 web 容器；两者都把 `/api/public/` 反代到 `server:3100`。
- 防火墙开放对应端口；share-web nginx 仅反代 `/api/public/`，不反代 `/api/`（见 §11）。
- 拿到正式域名后切换为双域名模式：把 `SHARE_PUBLIC_BASE_URL` 改为分享域名，宝塔改为域名反代，端口区分配置废弃。

后端仍使用 `apps/server`，新增分享管理模块和公共分享模块，不部署第二套后端或数据库。

## 4. 数据模型

新增 Prisma 模型 `ShareLink`：

```text
id
ownerUserId
targetType               conversation | companion
conversationId           nullable
companionId              nullable
tokenHash                unique
permission               chat | readonly
status                   active | revoked
expiresAt                nullable
lastAccessAt             nullable
createdAt
updatedAt
revokedAt                nullable
```

约束：

- `conversationId` 和 `companionId` 必须且只能存在一个，且与 `targetType` 一致。
- 同一目标可有多条 `status: active` 链接，每条独立 token、独立权限和过期，共享同一目标线程（见 §5）；不在 `(ownerUserId, targetType, target)` 上加 unique 约束。
- 创建分享时验证目标属于当前用户。
- 普通成员只能管理自己的分享；管理员可审计和撤销全部分享。
- 原目标被删除后，链接立即失效或自动撤销。
- 通过 Prisma migration 演进，不手工改 SQLite。
- token 使用至少 32 字节安全随机数；URL 返回原始 token，数据库只存哈希。
- 原始 token 只在创建成功时返回一次，禁止用用户 ID、目标 ID 或递增 ID 充当 token。

## 5. 主站分享管理

认证接口：

```text
POST   /api/shares
GET    /api/shares
GET    /api/shares/:id
PUT    /api/shares/:id
DELETE /api/shares/:id
POST   /api/shares/bulk-revoke          # 批量撤销某目标下的全部链接
POST   /api/shares/:id/regenerate       # 撤销当前链接并生成新 token 链接
```

`GET /api/shares` 支持 `targetType`、`targetId` 过滤，按目标列出该目标下的全部链接，每条显示权限、状态、过期、最后访问时间、创建时间。

创建请求示例：

```json
{
  "targetType": "conversation",
  "targetId": "xxx",
  "permission": "chat",
  "expiresAt": null
}
```

创建响应返回 `id`、`shareUrl`、`permission`、`expiresAt`。

链接与目标的语义（实现与 UX 都必须遵守）：

- 一个目标可以有多条 `status: active` 的链接，每条独立 token、独立权限和过期，但都绑定同一个 `conversationId` / `companionId`，因此共享同一条会话线程。任意链接的访客发送的消息、owner 在主站发送的消息，全部写入同一线程，由同一把生成锁互斥。
- 「重新生成」语义固定为：撤销当前链接（置 `status: revoked` + `revokedAt`）并新建一条新 token 链接。不实现为「同一条记录换 token」，以免旧 URL 访客被静默踢出且丢失 tokenHash 审计链路。
- 「批量撤销」`POST /api/shares/bulk-revoke` 一次撤销某目标下的全部 active 链接，供 owner 快速掐断一个会话的对外分享，避免逐条撤销。
- 撤销 = 置 `status: revoked` + `revokedAt: now`，token 行不删除以保留审计；`ShareTokenGuard` 校验 `status !== active` 直接拒绝，已建立的 SSE 连接通过 §9 的 `share_revoked` 事件被踢出。
- 撤销不影响原始会话和消息，owner 主站会话照常可用；只是外部链接无法进入。

UX 默认行为：点「分享」时先查该目标是否已有 active 链接，有则默认选中第一条并展示其 `shareUrl`，同时提供「复制现有链接」和「生成新链接」两个动作，避免每次都新建导致链接膨胀。

酒馆聊天页和 AI 角色聊天页都增加“分享”按钮。弹窗必须完整支持链接列表、创建、复制、权限、过期时间、状态、撤销和重新生成，不能只实现创建按钮。

## 6. 公共接口与 Token 守卫

公共接口不使用主站 AuthGuard，新增 `ShareTokenGuard` 或等价实现：

```text
GET  /api/public/shares/:token/bootstrap
GET  /api/public/shares/:token/messages
POST /api/public/shares/:token/chat/stream
POST /api/public/shares/:token/chat/stop
POST /api/public/shares/:token/messages/:messageId/regenerate
GET  /api/public/shares/:token/events
```

公共接口只根据 token 确定目标，不接受客户端提交 `userId`、`conversationId` 或 `companionId` 来切换目标。

内部上下文：

```ts
type ShareContext = {
  shareId: string;
  ownerUserId: string;
  targetType: 'conversation' | 'companion';
  targetId: string;
  permission: 'chat' | 'readonly';
};
```

所有消息操作必须再次校验消息属于该分享目标。无效、过期和撤销 token 不应透露目标是否存在。

公共 SSE 端点（`/bootstrap`、`/messages`、`/chat/stream`、`/chat/stop`、`/regenerate`、`/events`）必须挂 `@SkipResponseWrap()` 并用 `@Res()` 写原生事件流，与现有 `POST /api/chat/stream` 一致。主站全局 `ApiResponseInterceptor` 会把普通返回包成 `{ success, data }`，不绕过会吞掉 SSE 流。

## 7. 复用现有聊天链路

禁止为分享页面重新写 Prompt 或模型调用逻辑。

酒馆分享复用：

- `ChatService`。
- 酒馆 `PromptBuilderService`。
- Conversation 生成锁。
- Message 状态机和现有 SSE 格式。

AI 角色分享复用：

- Companion Chat 编排。
- Companion Prompt Builder。
- Companion 长期记忆。
- CompanionMessage 持久化和状态逻辑。

AI 角色不能转到酒馆 `ChatService` 或酒馆 Prompt Builder。分享模块只负责验证 token、确定 owner/目标、校验权限、调用对应编排和裁剪公共响应。

复用硬约束（落地必须满足）：

- 注入现有 `ChatService` / `CompanionChatService` 单例，不要新建编排服务。生成锁（`conversationTasks`、`tasks`）存在 service 实例内，只有共用单例，主站与公共入口才会命中同一把锁，§9 的并发互斥才成立。
- 现有 `ChatService.stream(currentUser, dto, response)` 与 `CompanionChatService.stream(user, id, dto, response)` 第一参是认证用户，DTO 内带 `conversationId` / `companionId`，不能直接给公共入口调用（公共入口按 §6 不接受客户端提交目标 ID）。必须把核心生成逻辑重构出无认证内部入口，例如 `streamInternal({ targetId, ownerUserId, source, response })`，主站与公共入口都调用它。`messages`、`companion-messages` 的停止、重新生成同理重构。
- 公共响应必须经过独立 DTO 裁剪层映射，白名单输出 `messageId`、`role`、`content`、`status`、`createdAt` 等字段，禁止直接序列化 Prisma 实体。`Message.metadataJson` / `CompanionMessage.metadataJson`、`Conversation` / `Companion` 上的 `identityPrompt`、`modelFallbackGroupId`、`personaId` 等敏感关联一律不进入公共响应（见 §10）。

## 8. 公共页面权限

默认 `chat` 权限允许：

- 查看同一聊天历史。
- 发送消息并接收流式回复。
- 停止当前生成。
- 重新生成最后一条 assistant 回复。
- 自动同步主站新消息。

默认禁止：

- 编辑或删除历史消息。
- 修改角色、Companion、Persona、世界书、预设、模型或模型链。
- 查看 Prompt Preview、长期记忆原文和版本。
- 上传、导入、导出、备份、查看成员信息或跳转主站。
- 指定其他目标 ID 或使用 `X-Tavern-Act-As`。

`readonly` 只能查看和同步消息，不能发送、停止或重新生成。

## 9. 实时同步

SQLite 是唯一数据源。保留聊天请求本身的 SSE，同时增加目标级 `/events` 订阅：

- 酒馆按 `conversationId` 广播。
- AI 角色按 `companionId` 广播。
- 主站和 share-web 订阅同一目标事件。
- 事件至少包括 `message_created`、`message_updated`、`message_deleted`、`generation_started`、`delta`、`generation_done`、`generation_failed`。
- 单实例可使用进程内事件发布器，不引入 Redis 或队列。
- 断线重连必须重新请求消息列表，不能只依赖可能丢失的事件。
- 同一目标同时只允许一个生成任务，继续复用现有锁并返回稳定 409。

实施注意：

- 当前仓库没有任何事件总线（无 `@nestjs/event-emitter`、无自建 `EventBus`）。目标级 `/events` 是新建基础设施，不是复用现有能力。选择轻量进程内发布器即可，不引入 Redis 或队列；在 `ChatService` / `CompanionChatService` 的消息落库与状态变更点统一 emit 事件。
- 「任意一端发送另一端自动出现」要求主站前端也订阅同一目标事件，因此主站聊天页前端需要改造接入事件订阅，工作量与 share-web 同级，不能只改 share-web。
- owner 撤销或 token 过期后，已建立的 SSE 连接必须被踢出：在事件流中下发 `share_revoked` 事件并关闭连接，或每次消息操作重校验 token 状态。不能让已连接访客在撤销后继续读取或写入。

## 10. 地址与安全隔离

- share-web 是独立前端包，分享域名只提供 share-web。
- 分享域名只将 `/api/public/*` 代理到 server，不提供主站页面和管理 API。
- share-web 不读取主站 access token、sessionStorage 或管理状态。
- token 只绑定一个资源；修改 query、目标 ID 或 URL 不能访问其他资源。
- 未匹配路径返回 share-web 自己的 404。
- 公共响应不能包含 API Key、密码哈希、系统 Prompt、内部路径、完整用户信息或长期记忆原文。
- 配置 CSP、Referrer-Policy 和基础限流。
- 分享访问地址跨域调用 `/api/public/*` 属于跨域请求，后端 `CORS_ORIGINS` 必须包含分享访问地址：双域名模式下为分享域名（如 `https://share.example.com`），端口区分模式下为 `http://<公网IP>:8081`（带端口）。否则公共页面无法请求公共接口。该项与 §11 部署配置一并设置。
- `ShareTokenGuard` 不得与主站 `AuthGuard` 混用：公共 controller 完全不挂 `AuthGuard`，确保 `X-Tavern-Act-As` 等主站切号头在公共链路不被解析。

## 11. Docker 与宝塔

新增：

```text
Dockerfile.share-web
apps/share-web/nginx.conf
```

`docker-compose.yml` 增加 `share-web` 服务，并增加：

```env
# 双域名模式（有正式域名后）：
# SHARE_PUBLIC_BASE_URL=https://share.example.com
# 端口区分模式（当前无域名阶段）：
SHARE_PUBLIC_BASE_URL=http://<公网IP>:8081
```

`docker-compose.yml` 中 `share-web` 服务示例（端口区分模式）：

```yaml
share-web:
  build:
    context: .
    dockerfile: Dockerfile.share-web
  image: tavern-share-web:latest
  container_name: tavern-share-web
  restart: unless-stopped
  ports:
    # 宿主 8081 -> 容器 80。主站 web 继续用 8080。
    - "8081:80"
  depends_on:
    - server
```

宝塔/反代层（端口区分模式）：`8081` 直接指向 share-web 容器，`8080` 继续指向主站 web 容器；两者都把 `/api/public/` 反代到 `server:3100`。双域名模式下改为域名反代，端口映射废弃。继续复用原 `data` 和 `uploads` 挂载，不建立第二个 SQLite，也不把数据库复制到 share-web。

部署易漏点：

- `share-web` 的 nginx 只能反代 `/api/public/`，绝不能反代整个 `/api/`，否则公共域名/端口会暴露主站管理 API。
- `CORS_ORIGINS` 必须在 `.env` / compose 中追加分享访问地址；端口区分模式下追加 `http://<公网IP>:8081`，双域名模式下追加分享域名（见 §10）。
- 端口区分模式下，`SHARE_PUBLIC_BASE_URL` 必须包含端口（如 `:8081`），否则生成的链接缺端口打不开；`CORS_ORIGINS` 也要带同样端口。
- 防火墙/安全组开放 8081 端口。
- `API_PREFIX=api` 已全局生效，公共接口路径 `/api/public/shares/:token/...` 由全局前缀自动补 `/api`，无需额外处理。
- 落地后需同步更新项目根目录 `AGENTS.md` 的目录树（§3）与前端模块说明（§6），新增 `apps/share-web` 属于项目边界变更。

## 12. 实施顺序

1. 检查当前 Conversation、Companion、聊天流、锁和消息操作。
2. 增加 `ShareLink` 和 migration。
3. 完成认证态分享管理 CRUD。
4. 完成 token 哈希、过期、撤销和目标范围校验。
5. 重构 `ChatService` 与 `CompanionChatService`，暴露无认证内部入口（`streamInternal` 等），主站与公共入口共用同一单例和同一把锁；这是第 7 步的前置。
6. 完成公共 bootstrap/messages API 与公共响应 DTO 裁剪层。
7. 分别复用酒馆和 Companion 聊天流接入公共入口。
8. 新建进程内事件总线，在消息落库与状态变更点 emit 事件，实现目标级 `/events` 同步；同时改造主站聊天页前端订阅。
9. 在两个主站聊天页面增加完整分享管理弹窗。
10. 先决定 `useChatStream` 等 composable 是提升到 `packages/shared` 还是 share-web 复制，再新建完整 `apps/share-web`。
11. 增加 Docker 和宝塔部署配置（含 `CORS_ORIGINS` 追加分享域名、share-web nginx 仅反代 `/api/public/`）。
12. 同步更新项目根目录 `AGENTS.md` 目录树与前端模块说明。
13. 完成接口、权限、并发、页面和 Docker 回归验证。

不要只完成数据表或创建接口。接口、主站分享管理、独立 share-web、同步、撤销和部署必须一起完成后再停止。

## 13. 验收标准

- Conversation 和 Companion 都能生成分享链接。
- 无需登录即可打开链接，公共页面没有主站导航。
- 修改 URL 不能进入主站或其他会话。
- 公共页面与主站显示相同消息 ID 和顺序。
- 任意一端发送后，另一端自动出现新消息。
- AI 角色继续使用原长期记忆；酒馆继续使用角色卡、Persona、世界书和原 Prompt Builder。
- 普通成员不能分享其他用户资源，公共接口不能读取其他目标。
- `readonly` 不能发送消息，撤销和过期立即失效。
- 同一目标并发生成被阻止。
- API Key、密码、系统 Prompt 和长期记忆原文不进入公共响应。
- Prisma migration、前后端类型检查、Docker 构建和浏览器桌面/窄屏验证通过。
- 资源边界明确：面向少量朋友、不追求高并发。多访客长连接（`/events` 与聊天流 SSE）在 SQLite 单机 + Node 单进程下受 fd 与内存约束，验收时不按高并发指标考核，与项目定位一致。

## 14. 实施易漏点核对表

集中收录落地时最易踩坑或返工的点，逐条对照对应章节：

- 公共 SSE 端点挂 `@SkipResponseWrap()` + `@Res()`，绕过全局响应包装（§6）。
- 注入同一 `ChatService` / `CompanionChatService` 单例，共用生成锁（§7）。
- 重构出无认证内部入口 `streamInternal`，主站与公共共用（§7、§12 第 5 步）。
- 公共响应走独立 DTO 裁剪层，白名单字段，不序列化 Prisma 实体与 metadata（§7、§10）。
- 同一目标多链接共享同一会话线程；「重新生成」=撤销旧+建新，不换 token；提供批量撤销接口（§5）。
- `share_revoked` 踢出已连接访客（§5、§9）。
- 事件总线为新建基础设施；主站前端同步改造；`share_revoked` 踢出已连接访客（§9）。
- `CORS_ORIGINS` 追加分享访问地址，端口区分模式带端口（§10、§11）。
- 端口区分模式下 `SHARE_PUBLIC_BASE_URL` 含端口，防火墙开放对应端口（§11）。
- 公共 controller 不挂 `AuthGuard`，避免 `X-Tavern-Act-As` 被解析（§10）。
- share-web nginx 仅反代 `/api/public/`，不反代 `/api/`（§11）。
- 前置决定 `useChatStream` 复用方式再建 share-web（§12 第 10 步）。
- 同步更新 `AGENTS.md` 目录树与前端模块说明（§11、§12 第 12 步）。
- 资源边界按少量朋友定位，不按高并发验收（§13）。

## 15. 新会话指令

新会话直接发送：

```text
读取 D:\tavern\docs\external-shared-chat-plan.md 和项目根目录 AGENTS.md，检查当前代码事实后，按文档完整落地外部共享聊天层。不要只实现一部分；接口、主站分享管理、独立 share-web、同步、权限、撤销、Docker 配置和回归验证全部完成后再停止。
```
