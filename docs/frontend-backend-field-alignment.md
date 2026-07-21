# 前后端字段对齐整改清单

## 1. 文档目的

本文汇总当前 Tavern Lite 中以下几类字段问题，供后续新对话直接据此实施修改：

- 后端、数据库或 JSON 导入支持，但普通页面不能配置的字段；
- 页面可以配置并保存，但真实会话没有消费的字段；
- 前后端字段虽然都存在，但编辑操作会覆盖、丢失或错误改写数据的字段；
- 只承担展示、管理或导入兼容职责，不应误认为会进入 Prompt 的字段。

本文初稿用于记录代码事实、处理决策和验收建议；当前实施状态以 1.1 节为准。

## 1.1 实施状态（2026-07-21）

本文中的明确整改项已完成代码对齐，实施选择如下：

- PromptPreset 已开放 `systemPrompt`、`timeout`、`frequencyPenalty`、`presencePenalty`，并支持 `null` 显式清空、`undefined` 保持原值；
- ProviderModel 已开放 `contextLength` 和两个惩罚参数，预设同名参数优先于模型默认参数；
- 模型链候选项已提供独立启停开关；Provider 类型选项与后端 Gateway 注册表共源；
- 角色示例对话仅允许 `user` / `assistant`，内容包 starter conversation 的 `system` 历史消息不受影响；
- 酒馆聊天页已提供会话设置，服务端会阻止有有效消息的会话更换角色；
- 已创建 Companion 可再次修改头像、敏感标记和管理员共享标记；
- `creatorNotes` 继续保持导入信息只读，`ProviderModel.sortOrder` 继续作为后端内部字段；
- 角色归档、通用 metadata JSON 编辑器和角色卡扩展字段 Prompt 注入仍不在本期范围。

定向回归入口：`pnpm verify:field-alignment`。

## 2. 已确认的处理边界

### 2.1 角色目前只有软删除，不实施归档功能

`Character` 表同时存在：

- `isArchived: boolean`
- `deletedAt: DateTime?`

当前页面点击“删除角色”时，后端会同时写入：

```ts
isArchived: true;
deletedAt: new Date();
```

但是角色列表、详情和所有权校验都会限制 `deletedAt: null`。因此，被页面删除的角色不会进入所谓的“归档列表”，即使请求 `isArchived=true` 也无法查到已经软删除的数据。

本期处理决定：

- 保留数据库、DTO 和响应中的 `isArchived` 字段，不做结构迁移；
- 不新增角色归档按钮、归档列表、恢复入口或回收站；
- 当前业务统一按 `deletedAt` 判断角色是否已软删除；
- 不把 `isArchived` 当作当前可用的业务功能；
- 后续如果正式实现归档，应采用 `isArchived=true + deletedAt=null`，并另行设计恢复操作；
- 本轮字段对齐整改不要顺带修改角色删除语义。

涉及代码：

- `prisma/schema.prisma`
- `apps/server/src/modules/characters/characters.service.ts`
- `apps/server/src/modules/characters/dto/create-character.dto.ts`
- `apps/server/src/modules/characters/dto/update-character.dto.ts`
- `apps/server/src/modules/characters/dto/query-characters.dto.ts`
- `apps/web/src/stores/character.ts`
- `apps/web/src/views/characters/CharacterDetailView.vue`

### 2.2 `PromptPreset.outputRules` 已经对齐，不需要补字段

`outputRules` 当前已经满足：

- 页面可以编辑，页面名称为“输出风格约束”；
- 普通创建、更新接口可以保存；
- JSON 导入、导出可以保留；
- 酒馆聊天会注入 `output_rules`；
- AI 角色聊天也会消费该字段，但仍保留 AI 角色自己的固定风格约束。

因此 `outputRules` 不属于待修复项。后续修改预设表单时必须避免破坏它。

### 2.3 元数据默认保持兼容用途

以下字段默认继续作为导入兼容、导出还原或内部扩展容器，不要求全部暴露成普通表单：

- `UserPersona.metadataJson`
- `PromptPreset.metadataJson`
- `WorldBook.metadataJson`
- `WorldBookEntry.metadataJson`
- 角色卡导入产生的 `metadata.importedCard`、未映射字段及兼容扩展字段

其中 Persona 的 `metadataJson` 当前不会进入酒馆或 AI 角色真实会话 Prompt。不要仅因为数据库存在该字段就给页面增加一个通用 JSON 编辑器。

## 3. P0：优先修复的数据损坏与无效配置问题

### 3.1 编辑 PromptPreset 会丢失隐藏参数

涉及字段：

- `PromptPreset.parametersJson.timeout`
- `PromptPreset.parametersJson.frequencyPenalty`
- `PromptPreset.parametersJson.presencePenalty`

当前状态：

- 真实酒馆聊天和 AI 角色聊天会读取这些字段；
- 内容包或历史 seed 数据可能已经包含这些字段；
- 普通预设表单只编辑 `temperature`、`topP`、`maxTokens`；
- `PresetsService.parseParams()` 也只保留这三个可见字段；
- 用户只要在页面修改任意可见参数，服务端就会重新序列化 `parametersJson`，导致原有的 `timeout`、`frequencyPenalty`、`presencePenalty` 被静默删除。

影响：

- 导入后的高级参数在一次普通编辑后失效；
- 数据库看起来保存成功，但之后真实会话的模型参数发生变化；
- 这是数据损坏问题，不只是页面少几个输入框。

建议处理：

1. 先扩展 `PromptPresetParams` 和 `PresetsService.parseParams()`，确保解析、合并和重新保存时保留全部受支持字段；
2. 再决定页面是否全部开放：
   - `timeout` 建议开放为高级配置；
   - `frequencyPenalty`、`presencePenalty` 建议开放为高级配置，范围与 Gateway 白名单保持一致；
3. 同步补齐 Create/Update DTO、`packages/shared` payload、前端 API 类型和表单状态；
4. 即使页面暂时不开放，也必须保证编辑其他字段不会删除这些值。

主要代码：

- `apps/server/src/modules/presets/presets.service.ts`
- `apps/server/src/modules/presets/dto/create-prompt-preset.dto.ts`
- `apps/server/src/modules/presets/dto/update-prompt-preset.dto.ts`
- `apps/server/src/modules/presets/prompt-preset.types.ts`
- `packages/shared/src/prompt-preset.ts`
- `apps/web/src/components/PromptPresetForm.vue`
- `apps/web/src/api/presets.ts`
- `apps/server/src/modules/chat/chat.service.ts`
- `apps/server/src/modules/companion-chat/companion-chat.service.ts`

验收：

- 导入含三个高级参数的预设；
- 页面只修改名称、描述或 Temperature；
- 再次读取数据库/API，三个高级参数仍保持原值；
- Prompt Preview 和真实聊天使用相同参数；
- 将高级字段显式清空时，行为与 DTO 的 `undefined`/`null` 约定一致。

### 3.2 编辑模型链会把停用候选项重新启用

涉及字段：`ModelFallbackCandidate.isEnabled`。

当前状态：

- 后端 DTO、数据库和运行时都支持候选项级别的启停；
- 模型链解析时会过滤 `candidate.isEnabled=false` 的候选项；
- 前端没有候选项级别的启停控件；
- 页面保存模型链时，把每个候选项固定提交为 `isEnabled: true`。

影响：

- 数据库中原本停用的候选项，只要经过页面编辑就会被重新启用；
- 下一次真实会话可能重新调用原本已经禁止使用的模型。

建议处理：

- 在模型链候选项行增加启用开关；
- 编辑时回填候选项原始 `isEnabled`；
- 保存时提交实际值，禁止硬编码 `true`；
- 如果产品决定不提供候选项级启停，则前端更新时必须保留已有值，不能重写。

主要代码：

- `apps/web/src/views/models/ModelConfigView.vue`
- `apps/server/src/modules/models/models.service.ts`
- `apps/server/src/modules/models/dto/create-model-fallback-group.dto.ts`
- `apps/server/src/modules/models/dto/update-model-fallback-group.dto.ts`
- `packages/shared/src/model.ts`

验收：

- 创建至少两个候选项；
- 停用其中一个；
- 修改模型链名称或顺序并保存；
- 停用状态必须保持；
- 真实候选解析结果中不能出现停用项。

### 3.3 `ModelProvider.providerName` 可以保存无效值

当前状态：

- 前端用自由文本输入框编辑 `providerName`；
- 后端 DTO 接受任意字符串；
- `ModelGatewayRegistry` 只支持已经注册的 adapter；
- 无效值可以成功入库，直到连接测试或真实聊天时才报“不支持的 provider”。

影响：配置保存成功不代表配置可运行，错误被延迟到实际会话。

建议处理：

- 前端改为从后端支持列表生成的选择器；
- 后端增加白名单校验，不能只依赖前端；
- 当前首版至少限制为已经注册的 `openai-compatible`；
- 如果未来注册新 adapter，应由同一份后端注册信息驱动校验和页面选项，避免双份硬编码。

主要代码：

- `apps/web/src/views/models/ModelConfigView.vue`
- `apps/server/src/modules/models/dto/create-model-provider.dto.ts`
- `apps/server/src/modules/models/dto/update-model-provider.dto.ts`
- `apps/server/src/services/model-gateway/model-gateway.service.ts`

验收：前端无法选择未注册值，直接调用接口提交未注册值也必须返回稳定的参数错误。

### 3.4 角色示例对话允许录入 `system`，但 Prompt Builder 会忽略

涉及字段：`Character.exampleMessages[].role`。

当前状态：

- 角色编辑器的文本格式允许写 `system: ...`；
- 导入或 API 也可能保存 `system` 角色；
- `PromptBuilderService.formatCharacterExamples()` 只接受 `user` 和 `assistant`；
- `system` 示例会被静默跳过，不进入 Prompt。

影响：用户在页面看到内容已保存，但真实会话无效。

建议处理：

- 页面示例对话仅允许 `user`、`assistant`；
- 前后端 DTO/解析器同步拒绝其他 role，避免静默忽略；
- 需要系统约束时，引导用户填写角色“系统提示词”或预设 `systemPrompt`；
- 不建议把示例中的 `system` 自动转换，因为它与示例消息语义不同。

主要代码：

- `apps/web/src/components/CharacterEditor.vue`
- `apps/server/src/services/prompt-builder/prompt-builder.service.ts`
- 角色创建、更新和导入时的示例消息校验代码

验收：页面和 API 均不能保存 `system` 示例；已有合法 `user`/`assistant` 示例仍正常注入。

## 4. P1：真实会话有效，但普通配置链路未完整开放

### 4.1 `PromptPreset.systemPrompt`

当前状态：

- 数据库、预设响应类型、JSON 导入和内容包导入支持；
- 酒馆 Prompt Builder 与 AI 角色 Prompt Builder 都会消费；
- 普通 Create/Update DTO、共享 mutation payload 和预设表单没有该字段；
- 普通页面只能看到响应中存在字段，不能创建或修改它。

建议处理：

- 在预设表单增加“系统提示词”高级文本区；
- 补齐 Create/Update DTO、共享 payload、前端 mutation 类型和提交/回填；
- 明确它与 `outputRules` 的区别：
  - `systemPrompt`：预设级系统/开发者约束；
  - `outputRules`：输出形式与风格约束；
- 酒馆和 AI 角色继续沿用各自现有注入顺序，不在页面重新拼 Prompt。

主要代码：

- `apps/web/src/components/PromptPresetForm.vue`
- `packages/shared/src/prompt-preset.ts`
- `apps/server/src/modules/presets/dto/create-prompt-preset.dto.ts`
- `apps/server/src/modules/presets/dto/update-prompt-preset.dto.ts`
- `apps/server/src/modules/presets/presets.service.ts`
- `apps/server/src/services/prompt-builder/prompt-builder.service.ts`
- `apps/server/src/services/companion-prompt-builder/`

### 4.2 `PromptPreset.parameters.timeout`

当前状态：JSON/内容包可带入，真实会话会传给 Gateway，但普通预设页面和 DTO 未完整支持。

建议处理：作为“高级生成参数”开放，单位明确显示为毫秒，并设置与 Gateway 一致的合法范围。该项还必须和 3.1 的保值修复一起完成。

### 4.3 `PromptPreset.parameters.frequencyPenalty`

当前状态：历史 seed 或数据库可能存在，真实会话会使用，普通预设配置链路未完整支持。

建议处理：补齐 DTO、共享类型、表单与服务解析；页面标明这是模型兼容参数，供应商不支持时由 Gateway 统一处理。

### 4.4 `PromptPreset.parameters.presencePenalty`

问题和处理方式与 `frequencyPenalty` 相同。

### 4.5 `ProviderModel.contextLength`

当前状态：

- 后端 DTO、共享类型、数据库、响应和更新服务均已支持；
- 酒馆和 AI 角色会用它计算 Prompt 上下文预算；
- 模型配置页面没有输入框，也没有回填和提交。

影响：用户无法通过页面纠正模型上下文长度，Prompt 裁剪预算可能长期使用空值或旧值。

建议处理：

- 在模型表单增加“上下文长度”数值项；
- 补齐页面表单状态、回填、提交和详情展示；
- `null` 表示使用系统兜底值，页面文案应说明；
- 最大输出 `maxTokens` 与上下文长度的关系应在帮助文案中说明，但不要在前端复制 Prompt Builder 的预算算法。

主要代码：

- `apps/web/src/views/models/ModelConfigView.vue`
- `packages/shared/src/model.ts`
- `apps/server/src/modules/models/dto/create-provider-model.dto.ts`
- `apps/server/src/modules/models/dto/update-provider-model.dto.ts`
- `apps/server/src/modules/models/models.service.ts`
- `apps/server/src/modules/chat/chat.service.ts`
- `apps/server/src/modules/companion-chat/companion-chat.service.ts`

验收：修改上下文长度后，Prompt Preview 的预算/裁剪结果应随之变化，真实聊天复用相同配置。

### 4.6 ProviderModel 隐藏的惩罚参数

涉及字段：

- `ProviderModel.parametersJson.frequencyPenalty`
- `ProviderModel.parametersJson.presencePenalty`

当前状态：模型服务能解析，Gateway 配置能够使用；但 ProviderModel 的普通 DTO、共享 payload 和页面没有暴露。与 PromptPreset 不同，当前模型服务在编辑可见参数时会保留已有隐藏惩罚参数，暂未发现同类静默丢失。

建议处理方案二选一，并在实现前统一：

1. 推荐：在模型表单的高级参数区开放并补齐完整契约；
2. 暂不开放：继续保留解析和运行时支持，同时增加测试保证普通编辑不会丢值。

不要同时在模型和预设层配置后却没有优先级说明。当前实际优先级应由服务端现有参数合并逻辑决定，并在页面提示。

## 5. P2：后端已支持，但前端缺少管理闭环

### 5.1 酒馆会话更新字段没有页面入口

后端 `UpdateConversationDto` 已支持：

- `title`
- `characterId`
- `modelFallbackGroupId`
- `promptPresetId`
- `personaId`
- `status`
- `metadata`

当前前端已经有 API/store 更新能力，但页面基本没有调用，用户无法管理现有会话配置。

建议处理：

- 在聊天页增加“会话设置”抽屉或弹窗；
- 开放标题、模型链、参数预设、Persona 和会话状态；
- `characterId` 在已经产生消息后禁止修改，避免历史语义错位；
- `metadata` 继续作为内部字段，不提供通用 JSON 编辑器；
- 会话 `status=archived` 是会话域自己的归档能力，与本期不实施的角色归档无关。

主要代码：

- `apps/server/src/modules/conversations/dto/update-conversation.dto.ts`
- `apps/web/src/api/conversations.ts`
- `apps/web/src/stores/conversation.ts`
- 酒馆聊天页及会话列表相关组件

### 5.2 已创建 Companion 的部分字段无法再次编辑

涉及字段：

- `avatarAssetId`
- `isSensitive`
- `isShared`

当前状态：创建 Companion 时页面支持这些字段，后端 Update DTO 也支持；但现有 Companion 的设置区域只编辑名称、身份描述、模型链、预设和 Persona。

建议处理：

- 在 Companion 设置中补头像替换和敏感内容开关；
- `isShared` 仅管理员显示并提交；
- 复用创建页的资产上传和权限逻辑，不另写上传路径。

主要代码：

- `apps/server/src/modules/companions/dto/update-companion.dto.ts`
- `apps/web/src/views/companion/CompanionChatView.vue` 或当前实际 Companion 设置组件
- Companion API/store

### 5.3 `Character.metadata.creatorNotes`

当前状态：角色卡 JSON 导入会保存，详情页会展示，导出会保留，但角色编辑器不能修改。该字段不会进入 Prompt。

建议处理：

- 如果需要维护导入卡片：增加“作者备注”，明确标注“不发送给模型”；
- 如果产品不希望用户修改外部卡片来源信息：详情页继续只读，并将其归类为导入信息；
- 不要因为它存在于 metadata 就把整个 metadata 暴露给用户。

主要代码：

- `apps/server/src/modules/characters/import/character-card-json-importer.ts`
- `apps/server/src/modules/characters/export/character-card-json-exporter.ts`
- `apps/web/src/views/characters/CharacterDetailView.vue`
- `apps/web/src/components/CharacterEditor.vue`

### 5.4 `ProviderModel.sortOrder`

当前状态：后端 DTO、数据库、共享类型和列表排序都支持，但页面没有编辑入口。

建议处理方案二选一：

- 需要人工排序：增加拖拽或上移/下移操作，页面不要要求用户直接输入裸数字；
- 不需要人工排序：保留为后端内部字段，前端类型可以读取但不宣传为可配置项。

## 6. P3：继续保持为导入兼容或内部字段

这些字段当前页面不能通用编辑，但不构成真实会话缺陷。

### 6.1 `UserPersona.metadataJson`

- API、JSON 导入、fork 和整库备份/恢复可以保留；
- 酒馆 Prompt 只消费 Persona 的名称/内容等明确字段；
- AI 角色聊天也不读取其中任意扩展键；
- 当前数据库中的 `{ "seed": true }` 一类数据只是来源标记。

处理建议：保持内部/导入兼容，不增加页面 JSON 编辑器。如果未来某个 metadata 键要参与业务，先把它提升为明确字段并补齐契约和测试。

### 6.2 `PromptPreset.metadataJson`

当前用于 JSON 导入、fork、整库备份/恢复和扩展信息保留。真实会话不直接读取任意 metadata 键。保持内部字段。

### 6.3 `WorldBook.metadataJson`

保持导入兼容和备份用途，不直接参与世界书命中或 Prompt 注入。

### 6.4 `WorldBookEntry.metadataJson`

保持导入兼容和扩展用途。真实命中使用的是关键词、启用状态、优先级、位置、内容等显式字段，不应从 metadata 隐式读取规则。

### 6.5 角色卡兼容扩展字段

包括但不限于：

- `alternateGreetings`
- `depthPrompt`
- `postHistoryInstructions`
- `characterVersion`
- `importedCard`
- 未映射原始字段

当前主要用于导入信息保真和再次导出，不应默认进入真实会话。后续若决定支持其中某项，应先定义明确的 Prompt 注入位置、优先级、预算和 Preview 展示，再开放页面编辑。

### 6.6 内容包 starter conversation 的 `system` 消息

内容包可以导入 `starterConversations[].messages[].role=system`，并且它会作为真实历史消息参与 Prompt。这属于内容包的高级能力，不等同于角色“示例对话”。

处理建议：继续保持内容包导入能力；不要因为 3.4 禁止角色示例中的 `system`，就同步删除 starter conversation 的合法 `system` 历史消息。

## 7. P4：页面可编辑并保存，但不参与真实会话

这些字段不是“保存无效”，而是承担展示或管理职责。问题主要是页面没有说明，容易让用户误以为会影响模型回答。

### 7.1 `PromptPreset.description`

- 用于预设列表、详情和选择时说明；
- 不注入 Prompt；
- 建议表单提示“仅用于管理说明，不发送给模型”。

### 7.2 `WorldBook.description`

- 用于列表展示和搜索；
- 不参与关键词匹配，也不注入 Prompt；
- 建议标注“仅用于管理说明”。

注意：`WorldBookEntry.title`、`WorldBookEntry.content` 等条目字段会参与调试或注入，不能与世界书顶层 description 混淆。

### 7.3 角色标签 `Character.metadata.tags`

- 页面可编辑并展示；
- 当前不参与 Prompt、世界书匹配或模型参数；
- 建议标注“用于角色整理和展示”。

### 7.4 `ProviderModel.notes`

- 用于管理员记录模型说明；
- 不传给模型供应商；
- 建议标注“内部备注，不影响生成”。

### 7.5 `ModelProvider.isDefault`

- 主要影响管理页排序或新建模型时的默认供应商选择；
- 不决定真实聊天使用哪个模型；
- 真实聊天模型由 `ModelFallbackGroup` 及其候选项决定；
- 建议页面改名或增加提示，例如“配置页默认供应商”。

## 8. 当前已经对齐、修改时不得破坏的字段

### 8.1 角色系统提示词 `Character.metadata.systemPrompt`

当前角色编辑器可以编辑，服务端会保存到角色 metadata，酒馆 Prompt Builder 会读取并注入角色段。它与 Persona `metadataJson` 的任意扩展键不是一回事。

### 8.2 角色主体字段

以下字段会被 Prompt Builder 消费：

- `name`
- `description`
- `personality`
- `scenario`
- `firstMessage`
- 合法的 `exampleMessages`（仅 `user`/`assistant`）

### 8.3 世界书条目业务字段

世界书条目的关键词、内容、优先级、插入位置、启用状态、大小写规则等会参与命中或 Prompt 构建。整改顶层 description/metadata 的说明时，不要误删条目运行时能力。

## 9. 推荐实施顺序

### 第一批：先阻止数据被静默改坏

1. 修复 PromptPreset 隐藏参数在普通编辑后丢失；
2. 修复模型链编辑后候选项被强制重新启用；
3. 增加相关后端服务和前端提交回归测试。

### 第二批：补齐会影响真实会话的配置

1. `PromptPreset.systemPrompt`；
2. PromptPreset 的 `timeout`、`frequencyPenalty`、`presencePenalty`；
3. `ProviderModel.contextLength`；
4. 决定并落实 ProviderModel 两个惩罚参数的开放方式。

### 第三批：阻止可以保存但不能运行的配置

1. `providerName` 选项与后端注册 adapter 对齐；
2. 禁止角色示例对话保存 `system` role。

### 第四批：补管理闭环

1. 酒馆会话设置；
2. 已创建 Companion 的头像、敏感和共享设置；
3. 决定 `creatorNotes` 只读还是可编辑；
4. 决定是否提供模型排序交互。

### 第五批：补字段用途说明

给 description、tags、notes、provider default 等非运行时字段增加明确文案。

本期不做：

- 角色归档、归档列表、恢复或角色回收站；
- 通用 metadata JSON 编辑器；
- 将所有外部角色卡扩展字段直接注入 Prompt；
- 改变 Prompt Builder、Model Gateway 或酒馆/AI 角色隔离边界。

## 10. 建议的回归验证清单

### PromptPreset

- JSON 导入的 `systemPrompt` 和高级参数能够完整读取；
- 普通页面编辑其他字段后，隐藏或高级参数不丢失；
- 页面修改 `systemPrompt` 后，Prompt Preview 与真实聊天都生效；
- 清空参数和未提交参数的语义明确区分；
- `outputRules` 原有行为不回归。

### 模型配置

- 候选项 `isEnabled=false` 经过页面编辑后仍保持停用；
- 停用候选项不会进入实际 fallback 解析结果；
- `contextLength` 修改后影响 Prompt 预算；
- 未注册 `providerName` 无法保存；
- ProviderModel 隐藏参数经过普通编辑不丢失。

### 角色

- 示例对话只接受 `user`、`assistant`；
- 角色系统提示词仍进入 Prompt；
- 点击删除仍执行当前软删除逻辑；
- 角色普通列表仍不展示 `deletedAt != null` 的记录；
- 不出现归档或恢复相关的新入口。

### 会话与 Companion

- 会话模型链、预设、Persona 修改后，下一次 Preview 和聊天读取新配置；
- 有历史消息的会话不能随意更换角色；
- Companion 编辑头像、敏感和共享字段后权限和展示正确；
- 管理员专属共享开关不对普通成员开放。

## 11. 新对话执行提示

新对话开始实施时，应先重新核对当前工作区，避免本文与后续代码变化产生漂移。建议按批次修改，不一次性混合所有页面和后端模块。每批至少完成：

1. 数据库/服务现状复核；
2. 后端 DTO 和校验；
3. `packages/shared` 稳定契约；
4. 前端 API 类型、表单回填和提交；
5. Prompt Preview/真实聊天调用链验证；
6. 针对静默丢值和错误重写的回归测试。

执行时以 `AGENTS.md` 和当前代码事实为准；若本文与代码冲突，应先更新判断，再实施修改。
