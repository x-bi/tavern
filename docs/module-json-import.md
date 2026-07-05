# 单模块 JSON 导入格式

Tavern Lite 支持按模块单独导入 JSON 内容。它和备份恢复不同：单模块导入只创建当前模块的新记录，不覆盖全库数据，也不导入模型配置/API Key。

## 通用规则

- 导入入口在各模块页面右上角：`导入 JSON`。
- 支持两阶段：先预览，确认后再导入。
- `format` 建议填写；不填写时会按当前入口的模块格式解析。
- 同名默认拒绝；勾选“同名时自动重命名”后会使用预览里的建议名称。
- JSON 中不能包含 `apiKey`、`secret`、`password`、`authorization`、`accessToken`、`refreshToken`、`bearer` 等敏感字段名。
- 导入 JSON 的请求体大小上限由服务端 `REQUEST_BODY_LIMIT` 统一控制，默认 `5mb`。
- 模型配置暂不支持单模块导入，因为它可能包含 API Key。

## Persona

格式标识：`tavern-lite.persona.v1`

字段：

- `name`：必填，Persona 名称。
- `content`：可选，Persona 正文。
- `metadata`：可选，对象或 `null`。
- `isDefault`：可选，是否设为默认 Persona。

示例见 [persona-import-example.json](examples/persona-import-example.json)。

## Prompt 预设

格式标识：`tavern-lite.prompt-preset.v1`

字段：

- `name`：必填，预设名称。
- `description`：可选，预设说明。
- `systemPrompt`：可选，系统 Prompt。
- `outputRules`：可选，输出约束。
- `parameters`：可选，对象或 `null`，支持 `temperature`、`topP`/`top_p`、`maxTokens`/`max_tokens`。
- `metadata`：可选，对象或 `null`。
- `isDefault`：可选，是否设为默认预设。

示例见 [prompt-preset-import-example.json](examples/prompt-preset-import-example.json)。

## 世界书

格式标识：`tavern-lite.world-book.v1`

字段：

- `name`：必填，世界书名称。
- `description`：可选，世界书说明。
- `characterId`：可选，绑定角色 ID；为空表示全局世界书。
- `isEnabled`：可选，是否启用。
- `scanDepth`：可选，整数。
- `tokenBudget`：可选，整数。
- `metadata`：可选，对象或 `null`。
- `entries`：可选，条目数组。

条目字段：

- `title`：必填，条目标题。
- `content`：必填，条目正文。
- `keywords`：必填，非空字符串数组。
- `secondaryKeywords`：可选，字符串数组。
- `isEnabled`：可选，是否启用。
- `priority`：可选，整数。
- `insertionOrder`：可选，支持 `before_history`、`after_history`、`before_current_user_input`、`after_current_user_input`。
- `tokenBudget`：可选，整数或 `null`。
- `caseSensitive`：可选，关键词是否区分大小写。
- `metadata`：可选，对象或 `null`。

示例见 [world-book-import-example.json](examples/world-book-import-example.json)。
