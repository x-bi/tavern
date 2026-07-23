# 独立 AI 角色的长期陪伴方案

## 1. 产品定义

AI 角色（`Companion`）是独立于酒馆的长期陪伴对象：`coreIdentity`、`personality`、`speechStyle`、`relationshipDefaults` 只定义她最初是谁；角色自己的持续消息与后台记忆，形成用户和她长期相处后的关系。

AI 角色没有用户可见或数据层面的“会话”实体。用户从 `/companion` 的角色列表点击某个角色后直接聊天；下次回来继续同一段关系。角色不会自动新建、切换或销毁聊天线程。

```text
Companion（一个长期关系）
  ├── CompanionMessage（该角色的全部持续消息）
  ├── CompanionMemory（该角色的一份当前长期记忆）
  └── CompanionMemoryRevision（记忆版本）
```

AI 角色与酒馆严格隔离：不复用酒馆 `Character`、`Conversation`、`Message`、`PromptBuilderService` 或 `/api/chat/stream`；只共享 Auth、Prisma、SSE 帧解析、`ModelGatewayService` 与用户级模型链/预设/Persona/Asset。

不做跨角色记忆、全局用户记忆、向量检索、embedding、Redis、外部队列或 AI 角色世界书。

## 2. 沉浸体验

用户创建 AI 女友角色时填写名字、核心身份、性格、说话风格、关系默认设定、头像和聊天模型链；进入角色后即直接聊天。系统不询问“这条要不要记住”，也不在聊天中展示总结过程。

AI 角色独立 Builder 永远注入受管的 `companion_style`：自然、简短的中文微信私聊；避免客服开场、标题、项目符号、夸张旁白、动作括号堆叠和模板式安慰。它不得虚构共同现实经历、身份信息、身体接触、承诺或用户未表达的情绪，也不伪装为真人。

记忆完全后台自动更新：总结模型从新增消息中提取已明确的关系、偏好、约定、近期事件和情绪；“明确事实”是总结提示词的内部规则，不是让用户参与筛选。用户只在发现错误时，主动从角色菜单查看、修正、暂停、清空或恢复版本。

## 3. 数据模型

### 3.1 Companion

`Companion`：`userId`、`name`、`coreIdentity`、`personality`、`speechStyle`、`relationshipDefaults`、`avatarAssetId`、聊天 `modelFallbackGroupId`、`promptPresetId`、`personaId`、审计时间与软删除字段。创建角色时，必须在同一短事务内创建唯一的 `CompanionMemory`，初始 `isEnabled=false`；不采用懒创建或“无记忆记录”的分支。

聊天模型归属角色：同一个 AI 女友始终使用这条配置，除非用户主动在角色设置中修改。

### 3.2 CompanionMessage

`CompanionMessage` 直接以 `companionId` 外键关联角色，字段为 `role`、`content`、`status`、`metadataJson`、`tokenCount`、审计与软删除。状态沿用酒馆语义：`generating`、`complete`、`failed`、`stopped`、`deleted`、`edited`。

索引：`@@index([companionId, createdAt])`。有效消息是未删除、状态为 `complete` / `edited` 的 user 或 assistant 消息；游标排序固定使用 `(createdAt, id)`。

### 3.3 CompanionMemory 与 Revision

`CompanionMemory` 对一个 `companionId` 唯一，字段：

- `isEnabled`、`isPaused`。
- `memoryModelFallbackGroupId`：总结专用模型链，可空；为空则跟随角色聊天模型链，且完整按候选回退。
- Prisma enum `status`：`ready`、`pending`、`updating`、`stale`、`failed`。
- `relationshipState`（最多 600 中文字符）与 `currentArc`（最多 800 中文字符）。
- `lastSummarizedMessageId`、`updateEveryMessages`（默认 8）、`lastErrorCode`、`retryCount`、`nextRetryAt` 与审计时间。
- 内部一致性游标 `rebuildFromMessageId` 记录最早受影响消息，`historyFloorMessageId` 记录“清空记忆”后的历史下界；二者不进入公开 API。

`CompanionMemoryRevision` 记录每一次写入后的完整不可变版本（版本号、两个区块、游标、历史下界、原因、时间），至少保留最近 10 个；当前记忆和 revision 在同一短事务内写入，并在该事务内裁剪超出的旧版本。Revision 不使用软删除或状态字段；索引使用 `@@index([companionId, createdAt])` 与 `@@unique([companionId, version])`。

## 4. 独立 Prompt Builder

AI 角色新建自己的 `PromptSectionKind`、`BuildPromptInput` 和 Builder；真实聊天与 Preview 必须复用这一条路径。

构建顺序：`platform` → `companion_identity` → `persona` → `prompt_preset` → `output_rules` → `companion_style` → `companion_memory` → `history` → `anti_repeat` → `current_user_input`。`anti_repeat` 只在已有 assistant 历史时注入：历史文本只用于理解上下文，模型只能回应当前输入，不得回放、拼接或改写旧 assistant 段落；相似 assistant 开头只保留最近两条。

记忆位于身份和输出规则之后、历史之前。`pending`、`updating`、`failed` 继续注入最后有效版本，避免角色突然失忆；只有 `stale` 停止注入。

按保守 token 预算处理：记忆最多预留约 1400 token，从模型 `contextLength`（未知时安全上限）扣除身份、预设、当前输入和输出余量后裁剪历史。Preview 展示记忆版本、预算、裁剪和跳过原因。

## 5. 自动更新与 stale 重建

assistant 消息完成落库并发送 SSE `done` 后，满足启用、未暂停和新增有效消息达阈值时，记忆进入 `pending`，由角色级进程内总结锁异步执行。状态抢占必须通过带前置状态的数据库条件更新完成，保证同一角色不会同时运行两项总结或重建任务。总结不阻塞聊天，不向聊天 SSE 写额外事件。

总结模型可独立选择；`ModelsService` 负责解析模型链候选，并通过一个非流式 `chatWithFallback()` 依序调用 `ModelGatewayService.chat()`。`ModelGatewayService` 仍是唯一供应商调用出口，但不能只调用首个候选就宣称支持模型链回退。请求硬超时 60 秒。单次最多处理 `updateEveryMessages * 3` 条新增消息；成功后推进游标，失败保留最后有效版本，记录 `lastErrorCode`、`retryCount` 与 `nextRetryAt`，并按指数退避自动重试。

服务启动时把遗留 `pending` / `updating` 转为可立即重试的 `failed`，并以轻量定时扫描兜底重启后和到期的重试任务；进程内定时器只用于加速当前实例，不作为唯一调度依据。

编辑、删除或重新生成已总结消息，或者在总结运行期间修改其输入消息时，记忆标记 `stale` 并停止注入，同时立即安排后台重建。重建运行期间也必须保持 `stale`，不得改成 `updating` 后重新注入旧记忆；运行状态只由角色级任务锁记录。重建从受影响消息之前的安全 revision 起，按消息顺序分块重放直到当前消息，并在批次间保存仍保持 `stale` 的 `rebuild_checkpoint`；若没有检查点则从 `historyFloorMessageId` 之后开始。不得跨过“清空记忆”边界重新学习旧对话，也不得只重放最近消息而称为完整重建。

## 6. API、UI 与实现顺序

```text
GET/POST/PUT/DELETE /api/companions
GET                   /api/companions/import-template
POST                  /api/companions/import
GET                   /api/companions/:id/export
GET                   /api/companions/:id/messages
POST                  /api/companions/:id/chat/stream
POST                  /api/companions/:id/prompt-preview
PUT/DELETE            /api/companion-messages/:id
POST                  /api/companion-messages/:id/regenerate
GET/PUT/DELETE        /api/companions/:id/memory
POST                  /api/companions/:id/memory/refresh
POST                  /api/companions/:id/memory/restore/:revisionId
```

前端仅有独立 `/companion` 角色列表、角色设置和直达聊天页；不显示会话列表或新建会话入口。记忆管理放在角色聊天菜单中，默认不打扰用户。

AI 角色支持下载 `tavern-lite.companion.v2` 导入模板、预览后导入和导出为同格式 JSON；同时接受外部标准 `chara_card_v2`，并将其字段一次性转换为 Companion V2 的核心身份、性格、说话风格和关系默认设定。模型链、Persona、头像和记忆配置属于当前用户本地资源，不随导入导出迁移。聊天页复用酒馆消息操作语义：复制、编辑 user 消息、软删除和仅最新 assistant 消息重新生成。

记忆 API 契约：

- `GET /memory` 返回当前记忆和最近保留的 revision，供用户查看并选择恢复。
- `POST /prompt-preview` 必须调用与真实聊天相同的 AI 角色 Builder，只返回安全的 Prompt 预览信息，不返回 API Key 或供应商原始响应。
- `DELETE /memory` 表示“忘掉既往内容，但继续开启记忆”：清空两个记忆区块和历史 revision，将游标推进到清空时最新有效消息，并重置失败重试信息。后续仅从新消息重新学习，不能重新总结已清空的旧对话。
- 恢复 revision 时将其内容和游标写为新的当前版本；若该游标之后已有足够的新消息，再按正常阈值增量总结。

实现顺序：

1. Prisma schema、migration、shared types：`Companion`、`CompanionMessage`、`CompanionMemory`、`CompanionMemoryRevision` 与 enum。
2. `companions`、`companion-messages` 和 `companion-memory` 模块，所有权校验按角色归属实现。
3. 独立 AI 角色 Builder 与 Preview。
4. 独立 `/api/companions/:id/chat/stream`、角色级生成锁和后台总结锁。
5. 自动总结、独立总结模型、stale 重建、启动恢复。
6. `/companion` 角色列表、直达聊天、微信式 UI 与低打扰记忆管理。
7. 单元、集成和真实模型验收。

验收：一名 AI 角色始终只有一条持续关系线程；未开启记忆不增加模型调用；总结失败不影响聊天；角色间严格隔离；酒馆表、Builder、路由和页面不受任何 AI 角色写入影响。
