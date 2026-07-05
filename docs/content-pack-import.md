# Tavern Lite 内容包导入

内容包导入用于接收 AI 生成的角色、世界书、Persona、Prompt 预设和开局会话。它是增量创建能力，不复用备份恢复接口，也不会覆盖当前用户已有数据。

接口：

```text
POST /api/content-packs/import
Content-Type: application/json
```

请求体：

```json
{
  "rawJson": "{...}",
  "commit": false,
  "duplicateStrategy": "reject"
}
```

字段说明：

- `rawJson`：内容包 JSON 原文。
- `commit`：`false` 只预览，`true` 正式导入。
- `duplicateStrategy`：同名资源处理策略，支持 `reject`、`rename`、`skip`。
- 请求体大小上限由服务端 `REQUEST_BODY_LIMIT` 统一控制，默认 `5mb`。

## 内容包格式

格式版本固定为：

```text
tavern-lite.content-pack.v1
```

顶层结构：

```json
{
  "format": "tavern-lite.content-pack.v1",
  "title": "内容包名称",
  "description": "内容包说明",
  "genre": "可选类型",
  "tone": "可选语气",
  "characters": [],
  "personas": [],
  "promptPresets": [],
  "worldBooks": [],
  "starterConversations": []
}
```

内容包使用 `ref` 做包内引用，不要求外部模型生成数据库 ID。导入时后端会创建真实 ID，并把引用关系映射到数据库记录。

## 支持资源

### characters

```json
{
  "ref": "char_main",
  "name": "角色名",
  "description": "角色描述",
  "personality": "性格",
  "scenario": "当前处境",
  "firstMessage": "开场白",
  "exampleMessages": [
    { "role": "user", "content": "用户示例" },
    { "role": "assistant", "content": "角色示例" }
  ],
  "metadata": {
    "tags": ["标签"]
  }
}
```

### personas

```json
{
  "ref": "persona_main",
  "name": "默认用户人设",
  "content": "用户身份、目标、与角色关系。",
  "isDefault": true
}
```

### promptPresets

```json
{
  "ref": "preset_main",
  "name": "默认叙事预设",
  "description": "预设说明",
  "systemPrompt": "系统提示",
  "outputRules": "输出规则",
  "parameters": {
    "temperature": 0.8,
    "topP": 0.9,
    "maxTokens": 1200
  },
  "isDefault": true
}
```

`parameters` 也兼容 `top_p`、`max_tokens`，导入时会归一化为 `topP`、`maxTokens`。

### worldBooks

```json
{
  "ref": "world_main",
  "characterRef": "char_main",
  "name": "主世界书",
  "description": "核心世界观、地点、组织、秘密。",
  "isEnabled": true,
  "scanDepth": 8,
  "tokenBudget": 1200,
  "entries": [
    {
      "title": "世界规则",
      "content": "命中后注入 Prompt 的内容。",
      "keywords": ["关键词1", "关键词2"],
      "secondaryKeywords": [],
      "isEnabled": true,
      "priority": 100,
      "insertionOrder": "before_current_user_input",
      "tokenBudget": 300,
      "caseSensitive": false
    }
  ]
}
```

`insertionOrder` 支持：

- `before_history`
- `after_history`
- `before_current_user_input`
- `after_current_user_input`

为兼容较早提示词，也接受 `before_current_user_message` 和 `after_current_user_message`，导入时会归一化为 `*_input`。

### starterConversations

```json
{
  "ref": "conv_opening",
  "title": "开局会话",
  "characterRef": "char_main",
  "personaRef": "persona_main",
  "promptPresetRef": "preset_main",
  "metadata": {
    "openingContext": "开局场景摘要。"
  },
  "messages": [{ "role": "assistant", "content": "角色开场消息。" }]
}
```

## 校验与安全

导入会校验：

- `format` 必须是 `tavern-lite.content-pack.v1`。
- 同一资源数组内 `ref` 不能重复。
- `characterRef`、`personaRef`、`promptPresetRef` 必须能在内容包内找到。
- 消息 `role` 只能是 `system`、`user`、`assistant`。
- 世界书条目 `keywords` 至少包含一个非空字符串。
- 字段名不得包含 `apiKey`、`secret`、`password`、`authorization`、`accessToken`、`refreshToken`、`bearer` 等敏感语义。

导入不会处理：

- 模型配置。
- API Key。
- uploads 文件二进制。
- 删除或覆盖当前数据。
- 更新已有资源。

## 给其它模型的生成提示词

```text
请生成 Tavern Lite 可导入内容包。不要输出 Markdown，不要解释，只输出合法 JSON。

格式必须是：
"format": "tavern-lite.content-pack.v1"

必须包含：
- title
- description
- characters
- personas
- promptPresets
- worldBooks
- starterConversations

所有资源都必须有 ref，ref 只用于包内引用，例如 char_main、persona_main、preset_main。
不要生成数据库 id。

starterConversations[].characterRef 必须引用 characters[].ref。
starterConversations[].personaRef 必须引用 personas[].ref。
starterConversations[].promptPresetRef 必须引用 promptPresets[].ref。
worldBooks[].characterRef 可以为空；不为空时必须引用 characters[].ref。

世界书条目的 insertionOrder 只能使用：
before_history
after_history
before_current_user_input
after_current_user_input

不要包含 API Key、token、password、secret、authorization、真实隐私数据。
```

完整示例见 [docs/examples/content-pack-example.json](examples/content-pack-example.json)。
