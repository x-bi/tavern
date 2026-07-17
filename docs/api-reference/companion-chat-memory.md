← [返回目录](./README.md)

# AI 角色聊天流 (companion-chat) / AI 角色长期记忆 (companion-memory)

## POST /api/companions/:companionId/chat/stream
- **路径参数**：`companionId: string`
- **鉴权**：`AuthGuard`；`@SkipResponseWrap()`
- **说明**：与指定 AI 角色 SSE 流式聊天。`userMessage` 与 `regenerateMessageId` 互斥，二选一。
- **请求体**（`StreamCompanionChatDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | userMessage | string | 否 | `@MinLength(1)` `@Matches(/\S/)` `@MaxLength(12000)`；新消息 |
  | regenerateMessageId | string | 否 | `@MaxLength(128)`；重新生成指定消息回复 |

- **响应**：SSE 流（`delta`/`done`/`error`/`ping`，同酒馆聊天流，见 [README·SSE 流式](./README.md#sse-流式)）。

## POST /api/companions/:companionId/prompt-preview
- **路径参数**：`companionId: string`
- **鉴权**：`AuthGuard`
- **说明**：预览发送指定消息后组装给模型的 Prompt（不入库、不真正生成回复）。
- **请求体**（`PreviewCompanionPromptDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | userMessage | string | 是 | `@MinLength(1)` `@Matches(/\S/)` `@MaxLength(12000)` |

- **响应**：`data` 为 Prompt 预览结构

## GET /api/companions/:companionId/memory
- **路径参数**：`companionId: string`
- **说明**：读取长期记忆配置、当前总结与状态。按 `Companion.id` 隔离，默认关闭，需显式开启。
- **响应**：`data` 含配置（`isEnabled`/`isPaused`/`memoryModelFallbackGroupId`/`updateEveryMessages`）、总结（`relationshipState`/`currentArc`）、状态 `status ∈ pending | updating | failed | stale`。`pending`/`updating`/`failed` 继续注入最后有效版本，仅 `stale` 停止注入；失败附带 `lastError`。

## PUT /api/companions/:companionId/memory
- **路径参数**：`companionId: string`
- **说明**：更新记忆配置或手动修订总结内容；编辑已总结字段后从安全检查点分块重建。
- **请求体**（`UpdateCompanionMemoryDto`，全可选）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | isEnabled | boolean | 否 | 是否启用长期记忆 |
  | isPaused | boolean | 否 | 是否暂停自动更新（不丢失已有总结） |
  | memoryModelFallbackGroupId | string \| null | 否 | `@MaxLength(128)`；记忆总结用模型分组，null 清空 |
  | updateEveryMessages | number | 否 | `@IsInt @Min(1) @Max(100)`；每多少条触发一次自动总结 |
  | relationshipState | string | 否 | `@MaxLength(600)`；关系状态总结 |
  | currentArc | string | 否 | `@MaxLength(800)`；当前剧情弧总结 |

## DELETE /api/companions/:companionId/memory
- **路径参数**：`companionId: string`
- **说明**：清空长期记忆总结内容（HttpCode 200）。
- **响应**：`data` 为清空后记忆对象（`status` 通常回 `pending`，总结为空）

## POST /api/companions/:companionId/memory/refresh
- **路径参数**：`companionId: string`
- **说明**：手动触发重新总结/刷新（HttpCode 200）。触发后 `status` 转 `updating`，失败转 `failed`。
- **响应**：`data` 为触发后最新记忆对象

## POST /api/companions/:companionId/memory/restore/:revisionId
- **路径参数**：`companionId: string`、`revisionId: string`
- **说明**：将长期记忆回滚到指定历史版本（HttpCode 200）。
- **响应**：`data` 为回滚后记忆对象（从对应检查点重新注入）
