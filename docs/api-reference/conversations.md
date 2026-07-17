← [返回目录](./README.md)

# 会话 (conversations) / 消息 (messages)

控制器类级 `@UseGuards(AuthGuard)`。

## GET /api/conversations
- **说明**：列表分页查询当前用户会话。
- **查询参数**（`QueryConversationsDto`）：

  | 字段 | 类型 | 必填 | 校验 + 注释 |
  |---|---|---|---|
  | page | number | 否 | 默认 1；`@IsInt @Min(1)` |
  | pageSize | number | 否 | 默认 20；`@IsInt @Min(1) @Max(100)` |
  | search | string | 否 | `@MaxLength(120)`；匹配 title 或关联角色 name |
  | characterId | string | 否 | `@MaxLength(128)` |
  | modelFallbackGroupId | string | 否 | `@MaxLength(128)` |
  | promptPresetId | string | 否 | `@MaxLength(128)` |
  | personaId | string | 否 | `@MaxLength(128)` |
  | status | string | 否 | `@IsIn(['active','archived'])` |

- **响应**：`data` 为 `{ items: Conversation[], total, page, pageSize }`

## POST /api/conversations
- **说明**：创建会话。
- **请求体**（`CreateConversationDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | title | string | 是 | `@MaxLength(160)` |
  | characterId | string | 是 | `@MaxLength(128)`；关联角色 ID |
  | modelFallbackGroupId | string \| null | 否 | `@MaxLength(128)`；传 null 不绑定 |
  | promptPresetId | string \| null | 否 | `@MaxLength(128)` |
  | personaId | string \| null | 否 | `@MaxLength(128)` |
  | status | string | 否 | `@IsIn(['active','archived'])`；默认 active |
  | metadata | object \| null | 否 | 扩展元数据 |

- **响应**：`data` 为创建后的 `Conversation`

## GET /api/conversations/:id
- **路径参数**：`id: string`
- **响应**：`data` 为 `Conversation`

## PUT /api/conversations/:id
- **路径参数**：`id: string`
- **说明**：更新会话（部分更新；关联 ID 传 null 解绑；metadata 传入整体替换）。
- **请求体**：`UpdateConversationDto`（字段同上，全可选）

## DELETE /api/conversations/:id
- **路径参数**：`id: string`
- **说明**：删除会话（级联软删除会话及其消息；HttpCode 200）。
- **响应**：`data` 为 `{ id, deleted: true }`

## POST /api/conversations/:id/clear
- **路径参数**：`id: string`
- **说明**：清空会话消息（保留会话，删除其下所有消息；HttpCode 200）。
- **响应**：`data` 为清空结果（含被清除消息数）

## GET /api/conversations/:conversationId/messages
- **路径参数**：`conversationId: string`
- **说明**：按会话分页查询消息。
- **查询参数**（`QueryMessagesDto`）：

  | 字段 | 类型 | 必填 | 校验 + 注释 |
  |---|---|---|---|
  | page | number | 否 | 默认 1；`@IsInt @Min(1)` |
  | pageSize | number | 否 | 默认 50；`@IsInt @Min(1) @Max(200)` |
  | order | `'asc' \| 'desc'` | 否 | 默认 asc；时间正序即对话顺序 |
  | role | string | 否 | `@IsIn(['system','user','assistant','tool'])` |
  | status | string | 否 | `@MaxLength(80)`；如 complete/failed |
  | search | string | 否 | `@MaxLength(120)`；匹配 content 包含 |

- **响应**：`data` 为 `{ items: Message[], total, page, pageSize }`

## PUT /api/messages/:id
- **路径参数**：`id: string`
- **说明**：更新消息（仅 `role === 'user'` 可编辑内容；未传 `status` 但 content 变化时自动标 `edited`）。
- **请求体**（`UpdateMessageDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | content | string | 否 | `@MaxLength(50000)`；仅 user 消息可编辑 |
  | status | string | 否 | `@IsIn(['complete','edited','failed','stopped'])` |
  | metadata | object \| null | 否 | 传入整体替换 |
  | tokenCount | number \| null | 否 | `@IsInt @Min(0) @Max(2000000)`；传 null 清空 |

## DELETE /api/messages/:id
- **路径参数**：`id: string`
- **说明**：软删除消息（HttpCode 200）。
- **响应**：`data` 为 `{ id, deleted: true }`

## POST /api/messages/:id/regenerate
- **路径参数**：`id: string`
- **说明**：重新生成消息（返回提示信息，实际生成由 `/chat/stream` 执行；HttpCode 200）。metadata 记录 `regenerateOfMessageId` / `regeneratedByMessageId`。
- **响应**：`data` 为重新生成提示
