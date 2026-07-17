← [返回目录](./README.md)

# Prompt 预览 (prompts) / 聊天流 (chat)

## POST /api/prompts/preview
- **鉴权**：`AuthGuard`
- **说明**：预览生成的 prompt（展示最终发送给模型的各 section，调试用；不入库不调用模型）。
- **请求体**（`PreviewPromptDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | conversationId | string | 是 | `@MaxLength(128)` |
  | userInput | string | 是 | `@MaxLength(12000)`；模拟用户输入 |
  | historyLimit | number | 否 | `@IsInt @Min(0) @Max(100)` |
  | maxHistoryCharacters | number | 否 | `@IsInt @Min(0) @Max(50000)` |
  | supportsDeveloperRole | boolean | 否 | 模型是否支持 developer 角色 |

- **响应**：`data` 为预览结果对象（各 section 最终拼装）

## POST /api/chat/stream
- **鉴权**：`AuthGuard`；标注 `@SkipResponseWrap()`，直接以 SSE 流式写入原生 Express response。
- **说明**：流式聊天。用户消息落库（`complete`）后调用模型；assistant 回复以 `generating` 占位，流完成置 `complete` 并发 `done`；失败 `failed`；中断 `stopped`。**同一会话同一时间只允许一个生成任务（会话锁）**。`userMessage` 与 `regenerateMessageId` 二选一。
- **请求头**：`Accept: text/event-stream`
- **请求体**（`StreamChatDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | conversationId | string | 是 | `@MaxLength(128)` |
  | userMessage | string | 否 | `@MinLength(1)` `@Matches(/\S/)` `@MaxLength(12000)`；重新生成模式可不传 |
  | regenerateMessageId | string | 否 | `@MaxLength(128)`；传此字段走重新生成流程，不传 `userMessage` |
  | modelFallbackGroupId | string \| null | 否 | `@MaxLength(128)`；覆盖会话绑定；null 用会话默认 |
  | presetId | string \| null | 否 | `@MaxLength(128)`；null 表示不绑定预设 |
  | historyLimit | number | 否 | `@IsInt @Min(1) @Max(100)` |
  | maxHistoryCharacters | number | 否 | `@IsInt @Min(0) @Max(50000)` |

- **响应**：SSE 流（见 [README·SSE 流式](./README.md#sse-流式)）；`delta`/`done`/`error`/`ping`。

## POST /api/chat/suggestions
- **鉴权**：`AuthGuard`
- **说明**：生成用户下一句候选发言。返回普通 JSON（走全局包装）；不创建消息、不改变会话历史。
- **请求体**（`SuggestChatRepliesDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | conversationId | string | 是 | `@MaxLength(128)` |
  | modelFallbackGroupId | string \| null | 否 | `@MaxLength(128)` |
  | presetId | string \| null | 否 | `@MaxLength(128)` |
  | historyLimit | number | 否 | `@IsInt @Min(1) @Max(100)` |
  | maxHistoryCharacters | number | 否 | `@IsInt @Min(0) @Max(50000)` |
  | count | number | 否 | `@IsInt @Min(1) @Max(5)`；默认 3 |

- **响应**：`data` 为候选发言数组
