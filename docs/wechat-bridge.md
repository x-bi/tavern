已废弃 因为web协议 微信号无法登录网页版微信 付费token没有找到供应商 所以这个方案先废弃

# 微信个人号会话桥接设计

> 状态：待实现设计。本文不代表个人微信接入已上线。

## 1. 目标与范围

让用户只在微信中与 Tavern 角色聊天。管理者在 Tavern 管理端将一个已有会话绑定到一个微信私聊或微信群；微信收到的文本消息写入该会话，Tavern 的 assistant 回复再发送回原微信会话。

初版仅支持一个登录的个人微信号、文本消息和单机 Docker 部署。

### 1.1 初版包含

- 管理端扫码登录、展示登录状态。
- 从已有 Tavern 会话选择一个会话。
- 从已登录微信的联系人或群聊中选择一个目标并创建绑定。
- 微信文本消息同步为已绑定 Tavern 会话的 `user` 消息。
- Tavern 的 `assistant` 消息同步到绑定的微信目标。
- 私聊白名单；群聊仅在 `@机器人` 时处理。
- 消息去重、发送状态和 Docker 重启后的微信登录态恢复。

### 1.2 初版不包含

- 多微信号、多账号切换、自动加好友或群发。
- 联系人分析、历史聊天扫描、朋友圈、数据报表。
- 图片、语音、文件、红包和朋友圈消息。
- 群聊自动闲聊、微信端逐字流式输出。
- Redis、外部队列、worker 或消息分析基础设施。

## 2. 选型与边界

新建一个简单的 `wechat-bridge` 应用，直接依赖 `Wechaty`，不直接部署或耦合完整的 `wangrongding/wechat-bot`。

- `Wechaty`：只负责个人微信登录、收取消息和发送消息。
- `wechat-bridge`：只负责微信事件过滤、调用 Tavern 内部接口和投递已完成回复。
- Tavern server：唯一的会话、消息、Prompt Builder 和 Model Gateway 执行入口。

`wechat-bot` 可作为扫码、白名单和消息事件处理的参考，但其多模型调用、JSONL 聊天采集、联系人分析等能力不进入本项目。

个人微信接入使用非官方协议，存在账号警告或限制风险。部署前提是使用专用账号、低频率和严格白名单；不承诺协议或 puppet provider 对所有账号长期可用。

## 3. 总体架构

```text
微信个人号
  <-> wechat-bridge（Wechaty、登录态、微信收发）
  <-> Docker 内部网络 + 双向内部鉴权
Tavern server（绑定、会话、Prompt、模型、消息落库）
  <-> Tavern web（扫码、选择会话、选择目标、查看状态）
```

新增目录：

```text
apps/wechat-bridge/
├── src/
│   ├── main.ts
│   ├── wechat-client.ts
│   ├── tavern-client.ts
│   └── delivery-worker.ts
├── package.json
└── Dockerfile
```

bridge 是独立 Docker 容器，不能放入现有 NestJS 进程。微信连接、登录重连和会话持久化均由 bridge 管理；Tavern 业务模块不直接依赖 Wechaty。

## 4. 消息时序

### 4.1 微信进入 Tavern

```text
微信联系人发送文本
→ bridge 过滤自己发送的消息、非文本、未绑定目标和未触发的群消息
→ POST /api/internal/wechat/inbound
→ server 校验绑定与消息幂等
→ 创建 Tavern user Message
→ 复用统一生成服务构建 Prompt 并调用模型
→ assistant Message 完成后创建 WechatDelivery
→ bridge 拉取待投递项并 message.say()
→ bridge 回执投递成功
```

微信消息必须写入 `Message` 表，所以它会进入该 Tavern 会话的历史上下文，并可在管理端正常查看。

### 4.2 Tavern 管理端发起回复

管理端继续使用既有聊天页。若会话存在启用的微信绑定，assistant 消息完成后创建投递记录，由 bridge 发送到微信。

初版只同步 `assistant` 消息到微信。网页侧 `user` 消息不外发，避免管理员调试或编辑时误发给联系人。未来如确有需求，可增加明确的 `syncMode=all`，但不属于初版。

### 4.3 并发、循环与失败

- bridge 必须忽略 `message.self()`，防止自身回复再次进入模型。
- 同一 `bindingId + sourceMessageId` 只能处理一次。
- 同一会话已有生成任务时，不缓存后续微信消息；回复固定提示“上一条消息正在回复，请稍后再发”。
- 微信上不流式发送；模型完成后按段落切分并顺序发送。
- bridge 未登录或发送失败时，assistant 消息仍保留在 Tavern，投递状态显示为失败或待重试，不重新调用模型。

## 5. 数据模型

新增 Prisma 模型并通过 migration 落库：

### 5.1 `WechatBinding`

| 字段                      | 说明                        |
| ------------------------- | --------------------------- |
| `id`                      | 主键                        |
| `userId`                  | Tavern 所属用户             |
| `conversationId`          | 已绑定会话；初版唯一        |
| `targetType`              | `direct` 或 `room`          |
| `targetId`                | Wechaty 联系人或群聊稳定 ID |
| `targetName`              | 仅用于管理端显示            |
| `isEnabled`               | 是否接收与投递              |
| `groupMentionOnly`        | 群聊是否必须 @ 机器人       |
| `createdAt` / `updatedAt` | 审计时间                    |

初版须保证一个 `conversationId` 只绑定一个微信目标；同一个微信目标也不能被多个绑定重复消费。

### 5.2 `WechatInboundReceipt`

| 字段              | 说明            |
| ----------------- | --------------- |
| `id`              | 主键            |
| `bindingId`       | 所属绑定        |
| `sourceMessageId` | 微信原始消息 ID |
| `receivedAt`      | 接收时间        |

对 `(bindingId, sourceMessageId)` 建立唯一约束。它只用于防重复，不保存完整原始聊天内容。

### 5.3 `WechatDelivery`

| 字段                   | 说明                        |
| ---------------------- | --------------------------- |
| `id`                   | 主键                        |
| `bindingId`            | 目标绑定                    |
| `messageId`            | 对应 Tavern assistant 消息  |
| `content`              | 待发送的最终文本            |
| `status`               | `pending`、`sent`、`failed` |
| `attemptCount`         | 已尝试次数                  |
| `sentAt` / `lastError` | 投递结果                    |

该表是轻量的投递状态记录，不引入独立队列服务。bridge 重启后可继续处理 `pending` 项。

微信来源的现有 `Message.metadataJson` 应加入：

```json
{
  "source": "wechat",
  "bindingId": "...",
  "sourceMessageId": "..."
}
```

## 6. 接口契约

### 6.1 管理端 API

以下接口使用现有 Tavern 登录鉴权：

```text
GET    /api/wechat/status
POST   /api/wechat/scan/start
GET    /api/wechat/targets?type=direct|room
GET    /api/wechat/bindings
POST   /api/wechat/bindings
PATCH  /api/wechat/bindings/:id
DELETE /api/wechat/bindings/:id
```

创建绑定请求：

```json
{
  "conversationId": "cm...",
  "targetType": "direct",
  "targetId": "wechat-contact-id",
  "targetName": "张三",
  "groupMentionOnly": false
}
```

管理端只显示二维码/登录状态、联系人或群选择、绑定列表和启停/解绑操作。不直接接触微信凭据或 session 文件。

### 6.2 bridge 调用 server

bridge 使用 Docker 内部地址调用 server，并携带 `BRIDGE_TO_SERVER_TOKEN`：

```text
POST /api/internal/wechat/inbound
GET  /api/internal/wechat/deliveries/next
POST /api/internal/wechat/deliveries/:id/ack
POST /api/internal/wechat/deliveries/:id/fail
```

### 6.3 server 调用 bridge

server 仅经 Docker 内网访问 bridge，并携带 `SERVER_TO_BRIDGE_TOKEN`：

```text
GET /internal/status
GET /internal/qr-code
GET /internal/targets
```

bridge 容器不映射宿主机端口，避免这些内部接口暴露到公网。

## 7. 聊天模块改造

现有 `ChatService.stream()` 同时承担会话锁、消息持久化、模型流式生成和 Express SSE 输出。微信 bridge 不能伪造浏览器 SSE 请求。

实施时抽出 `ChatGenerationService`：

```text
ChatController.stream()
  → ChatGenerationService.generate(..., onDelta)
  → SSE 输出给网页

WechatChannelService.handleInbound()
  → ChatGenerationService.generate(...)
  → 完成后创建 WechatDelivery
```

该服务必须继续复用既有的 `PromptBuilderService` 与 `ModelGatewayService`，不得在微信模块复制 Prompt，也不得直接调用模型供应商。

微信入站的幂等记录与 user/assistant 占位消息创建应在短事务内完成；模型调用必须在事务外执行。会话级锁沿用既有聊天锁，保证同一会话同一时间只有一个生成任务。

## 8. Docker 与配置

`docker-compose.yml` 新增：

```yaml
wechat-bridge:
  build:
    context: .
    dockerfile: apps/wechat-bridge/Dockerfile
  restart: unless-stopped
  depends_on:
    - server
  environment:
    TAVERN_INTERNAL_URL: http://server:3100/api
    BRIDGE_TO_SERVER_TOKEN: ${BRIDGE_TO_SERVER_TOKEN}
    SERVER_TO_BRIDGE_TOKEN: ${SERVER_TO_BRIDGE_TOKEN}
    WECHATY_PUPPET: ${WECHATY_PUPPET}
    WECHATY_PUPPET_TOKEN: ${WECHATY_PUPPET_TOKEN:-}
  volumes:
    - ./data/wechat-bridge:/app/data
```

约束：

- `server` 和 `wechat-bridge` 不向宿主机发布端口；仅 `web` 对外。
- `data/wechat-bridge/` 保存微信登录态，必须加入 `.gitignore`。
- 双向内部 token、puppet token 和微信登录态不得进入数据库、前端、普通日志或 Prompt。
- 扫码二维码只能通过受保护的管理端接口取得。

## 9. 实施顺序

1. 建立 `apps/wechat-bridge`，验证 Docker 内扫码、登录和重启后登录态恢复。
2. 新增 Prisma migration 与 server `wechat` 模块：绑定 CRUD、内部 token 鉴权。
3. 抽取 `ChatGenerationService`，让网页 SSE 和微信入站复用同一生成链。
4. 实现微信入站、去重、assistant 投递记录和 bridge 回执。
5. 增加管理端登录状态和绑定页。
6. 更新 Compose、`.env.example`、README 部署说明。
7. 使用专用测试号做端到端验证。

## 10. 验收标准

- 容器启动后可扫码；重启 bridge 后不要求重复扫码。
- 管理端可将一个已有 Tavern 会话绑定到一个联系人或群聊。
- 微信文本仅创建一条对应 `user` 消息和一条 assistant 回复。
- 管理端可看到微信来信及回复；它们参与下一轮 Prompt 历史。
- assistant 回复会发送到正确的微信目标。
- 重复投递同一微信消息不重复调用模型或发送回复。
- bridge 短暂重启后，未投递的 assistant 回复可继续处理。
- 群聊未 @ 机器人时不调用模型。
- 密钥、微信登录态和联系人数据不会出现在网页、Git 或普通日志中。

## 11. 后续扩展

以下能力必须在初版稳定后单独立项：

- 多账号和多绑定策略。
- 图片、语音、文件消息。
- 人工发送确认与管理员消息外发。
- 群聊更多触发规则。
- 更细的重试策略、投递历史和运行监控。

## 12. 开发执行补充

本节是实施时的固定上下文；与前文存在歧义时，以本节的触发规则和阶段边界为准。

### 12.1 私聊与群聊触发规则

- 支持已绑定的微信**私聊**和**群聊**。
- 私聊：目标存在启用的 `WechatBinding` 时，收到非本人发送的文本消息即触发 Tavern 生成；不要求 `@机器人`。
- 群聊：目标存在启用的 `WechatBinding` 时，只有文本消息明确 `@` 已登录微信号才触发；未 `@` 的群消息直接忽略，不创建 Tavern `Message`、不调用模型，也不发送“正在回复”之类的提示。
- 初版群聊的 `groupMentionOnly` 固定为 `true`，管理端不提供关闭它的入口；私聊不使用该字段。
- 触发群聊消息后，bridge 应使用 Wechaty 的提及语义判断，而不是仅靠字符串匹配；写入 Tavern 前移除用于触发的 `@机器人` 前缀，保留其余用户正文。
- 私聊和群聊都继续执行白名单、绑定启用状态、`message.self()` 过滤、文本类型校验与 `(bindingId, sourceMessageId)` 去重。

### 12.2 推荐分步实施

1. **P0：Puppet 可行性验证（阻断门）**
   - 确定一个实际可用的 Wechaty Puppet provider 与 token，使用专用测试号。
   - 仅验证 Docker 内扫码、登录态恢复、私聊/群聊收文本、私聊/群聊发文本与 `@` 识别。
   - 未通过时停止，不进入 Tavern 数据库、聊天模块和管理端改造。

2. **P1：抽离统一生成链**
   - 从 `ChatService.stream()` 抽出 `ChatGenerationService.generate()`；网页 SSE 只负责转发 delta。
   - 保持现有会话锁、消息占位、Prompt Builder、Model Gateway、模型回退与停止生成行为不变。
   - 先回归网页聊天，验证完成、失败和中止状态后再接入微信。

3. **P2：微信绑定与内部契约**
   - 新增 Prisma migration、`wechat` server 模块、绑定 CRUD、内部双向 token 鉴权及 bridge 状态/二维码/目标列表代理。
   - 落地 `WechatBinding`、`WechatInboundReceipt`、`WechatDelivery`，并同步逻辑备份导入导出契约。
   - 此阶段不调用模型，不发送微信消息。

4. **P3：微信入站生成**
   - 实现私聊直接触发、群聊仅 `@` 触发、短事务幂等记录、会话并发忙碌提示和统一生成链调用。
   - 微信来源的 `user`/`assistant` 消息必须正常落入既有 `Message` 历史。
   - 此阶段可先只创建 `WechatDelivery`，不要求 bridge 真正投递。

5. **P4：可靠投递与回执**
   - bridge 拉取待投递 assistant 回复，按段落顺序发送，并回执成功或失败。
   - delivery 需要 `processing` 租约、有限重试和最终失败状态；目标是“不重复调用模型、至少一次投递”，不承诺跨崩溃的严格一次微信发送。

6. **P5：管理端、部署与端到端验收**
   - 增加扫码状态、联系人/群选择、绑定列表、启停和失败状态展示。
   - 更新 Compose、`.env.example`、`.gitignore`、README；使用专用测试号完成私聊和群聊的端到端验收。
