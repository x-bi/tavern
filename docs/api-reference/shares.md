← [返回目录](./README.md)

# 认证态分享 (shares) / 公共分享 (public-shares)

## POST /api/shares
- **鉴权**：`AuthGuard`
- **说明**：创建分享链接（对所管理目标创建）。
- **请求体**（`CreateShareDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | targetType | `'conversation' \| 'companion'` | 是 | `@IsIn` |
  | targetId | string | 是 | `@IsString` |
  | permission | `'chat' \| 'readonly'` | 是 | `@IsIn` |
  | expiresAt | string \| null | 否 | `@IsISO8601`；过期时间，可空 |

## GET /api/shares
- **鉴权**：`AuthGuard`
- **说明**：列出当前用户管理的分享。
- **查询参数**：

  | 字段 | 类型 | 必填 | 说明 |
  |---|---|---|---|
  | targetType | `'conversation' \| 'companion'` | 否 | 按目标类型过滤 |
  | targetId | string | 否 | 按目标 ID 过滤 |

## GET /api/shares/events
- **鉴权**：`AuthGuard`；先校验当前用户对该目标有管理权；`@SkipResponseWrap()`
- **说明**：SSE 同步流，订阅当前用户管理的某目标实时事件。
- **查询参数**：`targetType`（必填）、`targetId`（必填）
- **响应**：SSE 流，响应头 `Content-Type: text/event-stream; charset=utf-8`、`Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no`。事件：`connected {}`、各 target 事件透传、`ping { at }`（每 15s）。客户端断开自动取消订阅。

## POST /api/shares/bulk-revoke
- **鉴权**：`AuthGuard`（HttpCode 200）
- **说明**：批量撤销指定目标下的全部分享。
- **请求体**（`BulkRevokeSharesDto`）：`targetType`（必填）、`targetId`（必填）

## GET /api/shares/:id
- **路径参数**：`id: string`
- **说明**：获取单个分享详情。

## PUT /api/shares/:id
- **路径参数**：`id: string`
- **说明**：更新分享配置（权限/过期时间）。
- **请求体**（`UpdateShareDto`，全可选）：`permission`、`expiresAt`

## DELETE /api/shares/:id
- **路径参数**：`id: string`（HttpCode 200）
- **说明**：撤销单个分享。

## POST /api/shares/:id/regenerate
- **路径参数**：`id: string`（HttpCode 200）
- **说明**：重新生成分享 token（旧 token 失效）。

---

## 公共分享（public-shares）

控制器前缀 `public/shares/:token`，全局 `@UseGuards(ShareTokenGuard)` + `@SkipResponseWrap()`。**鉴权基于路径中的 `:token`（公共 token 守卫，不读主站登录态，不需要 Bearer）**。所有响应均跳过统一响应包装（直接返回业务数据或 SSE 流）。`ShareTokenGuard` 通过后注入 `shareContext`（含 `shareId`/`targetType`/`targetId`/`owner`/`permission`）。

## GET /api/public/shares/:token/bootstrap
- **路径参数**：`token: string`
- **说明**：公共分享初始化（拉取分享元信息 + 目标基础数据，供 share-web 冷启动）。
- **响应**：业务数据对象（无统一包装）

## GET /api/public/shares/:token/messages
- **路径参数**：`token: string`
- **说明**：获取公共分享目标的消息列表。
- **响应**：消息列表数组（无统一包装）

## POST /api/public/shares/:token/chat/stream
- **路径参数**：`token: string`
- **说明**：公共分享流式聊天 SSE。进入前校验分享必须为 `chat` 权限。按 `targetType` 分派：`conversation` 走 `ChatService.streamInternal`，`companion` 走 `CompanionChatService.streamInternal`，以 `owner` 为数据所有者执行。
- **请求体**（`PublicChatDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | userMessage | string | 否 | `@IsString`；用户输入（可选，用于空轮/纯触发场景） |

- **响应**：SSE 流（由 `streamInternal` 写入，无统一包装）

## POST /api/public/shares/:token/chat/stop
- **路径参数**：`token: string`
- **说明**：停止当前正在进行的流式聊天（先校验 `chat` 权限）。按 `targetType` 分派到 `stopInternal`。
- **响应**：`{ stopped: boolean }`（无统一包装）

## POST /api/public/shares/:token/messages/:messageId/regenerate
- **路径参数**：`token: string`、`messageId: string`
- **说明**：重新生成指定消息。校验 `chat` 权限及消息归属此分享目标。按 `targetType` 分派到 `streamInternal({ payload: { regenerateMessageId } })`。
- **响应**：SSE 流（无统一包装）

## GET /api/public/shares/:token/events
- **路径参数**：`token: string`
- **说明**：公共分享 SSE 同步流，订阅目标级事件；每 15s 重新校验 token 有效性，失效时推送 `share_revoked` 并主动断开。
- **响应**：SSE 流，响应头 `Content-Type: text/event-stream; charset=utf-8`、`Cache-Control: no-cache, no-transform`、`Connection: keep-alive`、`X-Accel-Buffering: no`。事件：`connected { shareId }`、各 target 事件透传（`share_revoked` 需校验 `event.data.shareIds` 含当前 `shareId` 才下发并 `response.end()`）、`ping { at }`（每 15s）。后台每 15s 复验 token，失败下发 `share_revoked {}` 并断开。
