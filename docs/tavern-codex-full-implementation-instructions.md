# Tavern 上下文系统完整落地指令（Codex 执行版）

> 重要原则：**只以当前代码为准，忽略 README、AGENTS、架构说明等可能未同步文档。**

---

# 1. 你的角色

你是本项目的主工程实现者。请直接在当前仓库中完成本文件定义的全部改造。

你的任务不是做分析、提出建议或生成伪代码，而是：

1. 阅读当前实际代码。
2. 确认现有数据流和调用链。
3. 设计并修改最终数据模型。
4. 完成数据库、服务端、前端、导入导出、Prompt 预览和测试。
5. 删除被新架构替代的旧逻辑。
6. 保证最终代码可运行、可构建、可测试。
7. 输出完整变更总结和仍存在的问题。

不要为了兼容旧数据保留双轨逻辑，不要添加 `legacy` 模式，不要增加临时过渡字段，不要只实现局部修复。

---

# 2. 最终目标

将当前系统从“按固定顺序拼接文本”改造成：

```text
解析有效会话时间线
→ 确定上下文来源
→ 计算世界书触发和状态
→ 生成语义 Prompt Section
→ 按业务预算选取完整内容块
→ 根据目标模型能力编译
→ 记录最终实际使用的上下文
→ 调用模型
→ 成功后原子提交消息、Trace 和状态
```

改造范围包括：

- 世界书 World Book
- Prompt Preset
- Persona
- 普通角色 Character
- 独立 AI 角色 Companion
- 对话历史
- Companion 长期记忆
- Prompt 预算
- Provider 编译
- Prompt 预览
- 重新生成、编辑、删除、失败和 fallback

---

# 3. 不可变约束

以下要求必须同时满足。

## 3.1 代码和数据原则

- 不兼容旧数据。
- 当前本地数据库数据没有保留价值，不为现有数据制作备份、迁移脚本、兼容读取或回填逻辑。
- 允许通过破坏性 Migration 或重建 SQLite 数据库落地最终 Schema；仓库历史提交已经承担旧架构回溯职责，不在运行时代码中保留旧架构副本。
- 可以直接修改 Prisma Schema 和导入导出格式。
- 上述“不备份旧数据”只针对本次架构改造前的本地数据库；最终产品仍需支持新格式的角色卡、单模块、内容包等业务导入导出。
- 不保留旧 Prompt Builder 作为 fallback。
- 不允许新旧世界书 Matcher 并存。
- 不允许用数据库查询顺序表达业务优先级。
- 不允许用 `updatedAt`、`createdAt` 隐式决定 Prompt 顺序。
- 不允许通过任意截断自由文本满足 Token 预算。
- 不允许把全部逻辑写进一个巨型 Prompt Builder。

## 3.2 状态原则

- 消息和人工配置是事实来源。
- 世界书激活、sticky、cooldown、continuation、摘要等属于可重建派生状态。
- Matcher、Preview、候选回复在生成成功前不得修改状态。
- 只有最终 assistant 成功保存后，才能原子提交动态状态。
- failed、stopped、preview、user suggestions 不得推进逻辑轮次。
- regenerate 不创建新逻辑轮次。

## 3.3 反馈循环原则

- assistant 可以触发世界书桥接。
- assistant 不能重新触发参与生成自己的同一条目。
- assistant 激活链不能形成 `A → B → A` 循环。
- assistant 激活链不能无限扩展。
- assistant 不能创建或刷新 sticky。
- 旧 user 历史不能每轮刷新 sticky 或 cooldown。
- 受某个记忆 Revision 影响的 assistant 不能单独证明该 Revision 的事实正确。
- 用户当前明确输入可以重新授权旧世界书。

---

# 4. 执行方式

请先阅读并建立当前实际代码地图，至少覆盖：

- Prisma Schema
- chat.service
- prompt-builder.service
- companion-prompt-builder.service
- world-book-matcher
- world-books.service
- companion-memory.service
- Provider / model fallback 逻辑
- Prompt preview
- Character、Persona、Preset、Companion CRUD
- 导入导出和内容包
- 前端编辑页面
- 当前测试目录和 package scripts

然后按照本文件中的**依赖顺序**实施。

这不是临时分阶段方案。测试底座 T0 与下面的 A～H 共同构成实现顺序和模块边界，最终必须全部落地。T0 分为不依赖新领域模型的 T0a，以及依赖 A1 最终 Turn/Timeline 结构的 T0b。

执行检查点：

1. 完成当前代码地图，冻结测试入口和目标目录。
2. 完成 [T0a 通用测试基础设施](#1501-执行阶段与硬检查点)：安装并配置 runner、独立 test projects、临时 SQLite helper、Fake Model Gateway、SSE collector 和最小 Vue mount；此时不依赖新 Turn Schema。
3. 完成 A1 最终 Schema、Message/CompanionMessage 的 Turn 外键、共享类型、Timeline 纯逻辑，以及 T0b 所需的 canonical JSON/hash 基础工具；这些内容尚不替换真实聊天写入链路。
4. 完成 T0b 领域 smoke tests，证明 A1、Timeline、canonical hash、provisional 前端状态和测试数据库隔离可重复运行。
5. 只有 T0a 和 T0b 均通过，才允许把 A2 幂等、A3 Generation Lease、B3 原子提交、F17 世界书状态和 H6 Replay 接入真实聊天调用链。
6. T0 只要求建立可重复执行的基础设施和 smoke tests，不要求先写完第 15 章全部业务测试；业务测试随 A～H 同步补齐。

---

# 5. 改造包 A：逻辑会话、幂等和并发

这是所有状态逻辑的基础，必须先完成。

## A1. 为 Conversation 和 Companion 分别新增逻辑 Turn

Conversation 与 Companion 继续保持当前代码中的独立数据边界，不把 Companion 伪装成 Conversation，也不让两种消息共用多态外键。

数据库层使用两组具有相同语义、真实外键完整的模型；领域层通过共享的 `TimelineTarget`、`ResolvedTurn` 和 Resolver 接口复用算法。

新增等价于以下语义的模型：

```prisma
model ConversationTurn {
  id                       String   @id @default(cuid())
  conversationId           String
  sequence                 Int
  completedOrdinal         Int?
  userMessageId            String   @unique
  activeAssistantMessageId String?  @unique
  status                   String
  createdAt                DateTime @default(now())
  completedAt              DateTime?

  @@unique([conversationId, sequence])
  @@unique([conversationId, completedOrdinal])
  @@index([conversationId, status])
}

model CompanionTurn {
  id                       String   @id @default(cuid())
  companionId              String
  sequence                 Int
  completedOrdinal         Int?
  userMessageId            String   @unique
  activeAssistantMessageId String?  @unique
  status                   String
  createdAt                DateTime @default(now())
  completedAt              DateTime?

  @@unique([companionId, sequence])
  @@unique([companionId, completedOrdinal])
  @@index([companionId, status])
}
```

同时为 `Message` 和 `CompanionMessage` 增加各自的 `turnId` 真实外键。user、generating、failed、stopped、历史 assistant 版本都必须能追溯到所属 Turn，不得只依赖 `metadataJson` 推断。

要求：

- 一条 user 消息对应一个逻辑 Turn。
- 同一 Turn 可包含多个 assistant 版本。
- regenerate 只替换 `activeAssistantMessageId`。
- regenerate 不增加 `sequence`。
- `activeAssistantMessageId` 只在 assistant 成功事务中切换；regenerate 生成中或失败时继续保留旧 active assistant。
- `sequence` 表示用户 Turn 的创建顺序；`completedOrdinal` 只在该 Turn 首次完整成功时分配。
- 世界书轮次、delay、sticky 和 cooldown 一律使用 `completedOrdinal`，不得直接使用包含 failed/stopped 空洞的 `sequence`。
- 只有完整成功的 Turn 参与动态状态推进。

Turn 状态至少包括：

```text
pending
generating
complete
failed
stopped
```

## A2. 新增生成请求幂等与 Generation Attempt

Conversation 和 Companion 分别建立生成请求表，避免跨两种消息表使用无真实外键的 `targetType + targetId`。两张表共享同一领域类型和状态机。

新增等价模型：

```prisma
model ConversationGenerationRequest {
  id               String   @id @default(cuid())
  requestId        String
  requestHash      String
  conversationId   String
  turnId           String
  purpose          String
  status           String
  resultMessageId  String?
  errorCode         String?
  createdAt         DateTime @default(now())
  completedAt       DateTime?

  @@unique([conversationId, requestId])
  @@index([conversationId, status])
}

model CompanionGenerationRequest {
  id               String   @id @default(cuid())
  requestId        String
  requestHash      String
  companionId      String
  turnId           String
  purpose          String
  status           String
  resultMessageId  String?
  errorCode         String?
  createdAt         DateTime @default(now())
  completedAt       DateTime?

  @@unique([companionId, requestId])
  @@index([companionId, status])
}
```

为每个请求建立 `GenerationAttempt` 记录，Conversation 与 Companion 仍使用各自的真实外键表。Attempt 至少保存：

```ts
type GenerationAttemptRecord = {
  requestDatabaseId: string;
  attemptIndex: number;
  modelId: string;
  status: 'generating' | 'succeeded' | 'failed' | 'stopped';
  promptSnapshotHash?: string;
  emittedDelta: boolean;
  errorCode?: string;
  startedAt: string;
  completedAt?: string;
};
```

Generation Request 表示一次客户端幂等操作；Generation Attempt 表示该请求内部的一次模型候选尝试。fallback 的每个候选都是独立 Attempt；用户显式重试会创建新的 Generation Request，并在新请求下重新创建 Attempt。

要求：

- 每次聊天、regenerate 等请求必须携带唯一 `requestId`。
- 相同 `requestId` 重试不能重复创建 user、Turn 或 assistant。
- `requestHash` 使用规范化后的目标、purpose、user 输入或 regenerate 目标计算；同一目标下相同 `requestId` 但 hash 不同，返回 `GENERATION_REQUEST_CONFLICT`。
- 相同 requestId 处于 generating 时返回明确的 `GENERATION_REQUEST_IN_PROGRESS`，本期不实现重新附着到旧 SSE 流。
- 相同 requestId 已 complete 时，SSE 只返回已有 `messageId` 的 `done`，并带 `idempotentReplay: true`；前端随后按消息接口刷新，不重新发送历史 delta。
- 相同 requestId 已 failed/stopped 时返回原终态错误，不自动重新执行。
- 用户显式“重试本轮”必须使用新 requestId 并携带已有 `turnId`，复用原 user 和 Turn；不得创建重复 user 消息。普通发送相同文本仍视为新 Turn。
- 同一个 Turn 只能有一个 active assistant。
- 同一 Conversation 或 Companion 默认只允许一个持有 generation lease、可提交的生成操作。
- requestId 查询必须同时限定 owner 与目标 ID；公开分享入口不得仅凭 requestId 返回其他目标的结果。

## A3. Conversation / Companion 乐观锁与 Generation Lease

为 Conversation 和 Companion 都增加：

```prisma
version                  Int     @default(0)
activeGenerationLeaseId String?
```

生成开始时通过短事务：

```text
读取 version = V
→ 条件更新 version=V 且 activeGenerationLeaseId 为空
→ 写入 activeGenerationLeaseId=requestDatabaseId
→ version 增加为 V+1
→ 创建或认领 Turn、GenerationRequest 和 assistant placeholder
```

最终提交时必须同时校验：

```text
version = V+1
activeGenerationLeaseId = 当前 requestDatabaseId
```

消息编辑、删除、active assistant 切换、绑定配置变化、世界书手动状态变化等会影响上下文的写操作必须递增对应 Conversation/Companion 的 version。修改 Character、Persona、Preset 或 World Book active revision 时，必须递增所有实际绑定目标的 version；项目为 SQLite 单机小规模，不为避免该 fan-out 而牺牲正确性。

如果会话版本已经变化：

- 不提交旧 Proposed State。
- 不替换 active assistant。
- placeholder 标记为 `failed`，错误码为 `CONTEXT_COMMIT_CONFLICT`。
- 清除当前 generation lease，但不得清除后来请求持有的 lease。
- SSE 返回明确冲突，前端丢弃本次 provisional 文本并刷新有效时间线。
- 不静默覆盖新状态。

`done` 事件只能在成功事务完成后发送。所有 `delta` 都是 provisional；主站、公共分享页和 Companion 页面必须在收到 `done` 前保持临时生成态，收到冲突或失败后不得把 provisional 内容当成有效消息。

## A4. 时间线解析

新增：

```text
ConversationTimelineService
CompanionTimelineService
```

两者实现共享的 `TimelineResolver` 接口，分别查询自己的 Turn、Message 和 active assistant，负责：

- 返回当前有效 Turn 序列。
- 每个 Turn 只返回 active assistant。
- 排除 deleted、replaced、failed、stopped 消息。
- 保留用户编辑后的 user 消息并标记来源为 `edited_user`。
- 当前 API 不允许人工编辑 assistant；如果导入数据中出现 `edited assistant`，Resolver 必须将其标记为 `imported_edited_assistant`，不得伪装成模型生成内容，也不得参与 assistant bridge 或记忆自证。
- 为 Prompt、Replay 和 Memory 提供同一套有效消息链。

failed/stopped Turn 的 user 消息仍作为用户事实保留在界面和审计时间线中，但在该 Turn 成功前不得进入“已完成 Turn”动态状态计数；Prompt 是否纳入该 user 必须由同一 Timeline Policy 明确返回，禁止各调用方自行判断。

不得让 Prompt Builder、Preview、Memory Service、World Book Matcher 各自维护一套不同的“有效历史”判断。

---

# 6. 改造包 B：来源追踪和成功后提交

## B1. MessageGenerationTrace

数据库必须分别建立 `ConversationMessageGenerationTrace` 与 `CompanionMessageGenerationTrace`，通过真实外键关联各自的 assistant message、turn 和 generation request，不使用多态 ID。两表共享以下领域字段；仅 `CompanionMessageGenerationTrace` 包含 `memoryRevisionIdUsed`：

```prisma
id                       String   @id @default(cuid())
messageId                String   @unique
generationRequestId      String   @unique
turnId                   String
requestUserMessageId     String
generationPurpose        String
modelId                  String
compilerVersion          String
rootUserMessageId        String
memoryRevisionIdUsed     String?  // 仅 Companion
promptSnapshotJson       String
promptSnapshotHash       String
capabilitiesSnapshotJson String
modelParametersJson      String
createdAt                DateTime @default(now())
```

`promptSnapshotJson` 必须保存真正发送给最终成功 Provider 的规范化完整输入，而不是只保存 hash。至少包括：

- 最终 Provider messages 及顺序。
- 最终模型参数。
- 本次使用的 Provider capability 快照。
- 所有参与决策的 Section、其来源 revision、included/excluded、compact 与排除原因。
- 本次实际查询的世界书 entry revision 集合。

`promptSnapshotHash` 使用规范化 JSON 的 UTF-8 字节计算 SHA-256。对象键排序、数组顺序、空值处理必须由单一 canonical JSON 工具固定；Replay、Preview 对比和测试均复用该工具。

要求：

- 只为成功完成的 assistant 保存 Trace。
- fallback 时只保存最终成功模型对应的有效 Trace；每个失败候选仍保存在 Generation Attempt 中。
- stopped 和 failed 不生成有效 Trace。
- regenerate 后旧 assistant Trace 不得继续参与 assistant bridge。

## B2. Prompt Section Trace

数据库同样分别建立 `ConversationMessagePromptSectionTrace` 与 `CompanionMessagePromptSectionTrace`，通过真实外键关联对应 generation trace。共享字段为：

```prisma
id                String @id @default(cuid())
generationTraceId String
sectionId         String
sectionKind       String
sourceType        String
sourceId          String?
sourceRevisionId  String?
contentHash       String
compactUsed       Boolean
placement         String
conversationRole  String?
finalProviderRole String?
tokenEstimate     Int
included          Boolean
excludedReason    String?
```

用于记录：

- Section 是否匹配。
- 是否被预算选入。
- 是否使用 compact。
- 历史消息自身的 conversation role。
- 最终 Provider Role。
- 被舍弃原因。

另外分别建立 `ConversationIncludedWorldBookTrace` 与 `CompanionIncludedWorldBookTrace`。只有真正进入最终 Provider messages 的世界书条目写入这两张表：

```prisma
id                   String @id @default(cuid())
generationTraceId    String
entryId              String
entryRevisionId      String
activationSource     String
sourceMessageId      String?
rootUserMessageId    String
lineageJson          String
bridgeDepth          Int
```

匹配但因预算、信任、循环、深度或数量限制被排除的世界书，保留在 Prompt Section Trace 和 `promptSnapshotJson` 中，不写入 Included World Book Trace。

## B3. Proposed Commit

在内存中定义统一结构：

```ts
type ProposedContextCommit = {
  generationTrace: ProposedGenerationTrace;
  promptSectionTraces: ProposedPromptSectionTrace[];
  includedWorldBookTraces: ProposedWorldBookTrace[];
  worldBookStateChanges: ProposedWorldBookStateChange[];
  memoryRevisionIdUsed?: string;
};
```

流程必须为：

```text
构建 Proposed Commit
→ 调用模型
→ 模型成功
→ 同一数据库事务保存 assistant、Trace、世界书状态、Memory active revision（如有）、Turn、active assistant 指针，并释放 Generation Lease
```

以下情况不提交：

- preview
- user suggestions
- failed
- stopped
- timeout
- fallback 失败候选
- Conversation / Companion version 或 Generation Lease 冲突

fallback 规则必须固定：只有候选模型尚未向客户端发送任何 `delta` 时才能切换下一个候选。一旦某候选已经发送 `delta`，后续失败按本次生成失败处理，不得拼接另一个模型的输出；如未来要支持跨候选 fallback，必须先改为服务端缓冲并作为独立方案评审。

---

# 7. 改造包 C：Prompt Section 与 Provider Compiler

## C1. Prompt Section V2

建立统一类型：

```ts
type PromptSectionKind =
  | 'platform_policy'
  | 'mode_policy'
  | 'preset_instruction'
  | 'preset_output_rule'
  | 'character_core'
  | 'character_personality'
  | 'character_premise'
  | 'character_initial_scenario'
  | 'character_background'
  | 'character_rule'
  | 'persona_core'
  | 'persona_background'
  | 'persona_preference'
  | 'companion_core'
  | 'companion_personality'
  | 'companion_style'
  | 'companion_runtime_state'
  | 'companion_memory'
  | 'world_book'
  | 'history'
  | 'generation_hint'
  | 'current_user';

type PromptPlacement =
  | 'instruction'
  | 'before_history'
  | 'history'
  | 'after_history'
  | 'before_current_user'
  | 'current_user';

type PromptImportance = 'required' | 'reserved' | 'optional';

type PromptSection = {
  id: string;
  kind: PromptSectionKind;

  sourceType: string;
  sourceId?: string;
  sourceRevisionId?: string;

  content: string;
  compactContent?: string;
  compactSourceHash?: string;

  placement: PromptPlacement;
  importance: PromptImportance;

  budgetPriority: number;
  sortOrder: number;

  truncationPolicy: 'never' | 'use_compact' | 'drop';

  generationPurposes: GenerationPurpose[];

  // 仅由 Timeline/Builder 为真实对话消息设置，配置表单不得提供。
  conversationRole?: 'user' | 'assistant' | 'tool';

  contentType?: WorldBookContentType;
  trustLevel?: ContentTrustLevel;
};
```

所有模块只生成 Prompt Section，不直接生成 Provider 消息。

`history`、`current_user` 和受控 example message 必须通过 `conversationRole` 保留真实对话角色；普通规则 Section 不得伪装成 user/assistant。`section.id`、排序键和合并规则必须确定性生成，禁止依赖数据库返回顺序、`updatedAt` 或随机 ID。

## C2. 不允许用户配置原始 Role

业务配置只能使用语义 placement。

不允许世界书或普通配置直接选择：

```text
system
developer
user
assistant
```

Provider Role 由 Compiler 决定。

本禁令不适用于系统从有效时间线产生的 `conversationRole`；该字段是历史语义，不是用户可编辑的 Provider Role。

## C3. Provider 能力模型

建立：

```ts
type PromptCapabilities = {
  supportsDeveloperRole: boolean;
  systemPlacement: 'initial_only' | 'midstream_allowed';
  supportsMultipleSystemMessages: boolean;
  requiresAlternatingRoles: boolean;
  contextWindowTokens: number;
  tokenizerType: string;
};
```

能力字段必须持久化到模型配置，并同步后端 DTO、前端编辑器和导入导出。旧记录没有能力值时使用保守默认值；不能在聊天路径中硬编码 `supportsDeveloperRole=false` 或按供应商名称猜测。

## C4. Provider Prompt Compiler

编译过程：

```text
过滤 generation purpose
→ 预算筛选
→ placement 排序
→ 内容类型和信任级别校验
→ 映射 Provider Role
→ 合并允许合并的 Section
→ 修复非法消息序列
→ 最终 Token 计算
→ 必要时再次预算降级
```

fallback 时，每个模型必须重新执行完整编译和预算。

不得复用前一个模型的最终消息。

每次编译使用该候选模型当时的 capability 快照和参数，并写入对应 Generation Attempt；成功候选的快照再进入 Message Generation Trace。

## C5. Generation Purpose 与执行模式分离

定义：

```ts
type GenerationPurpose =
  | 'chat_reply'
  | 'regenerate'
  | 'continue'
  | 'user_suggestions'
  | 'memory_summary';

type ExecutionMode = 'commit' | 'dry_run';
```

Prompt Preview：

```ts
{
  generationPurpose: 'chat_reply',
  executionMode: 'dry_run'
}
```

用户候选回复：

```ts
{
  generationPurpose: 'user_suggestions',
  executionMode: 'dry_run'
}
```

Preview 不应作为一种 Generation Purpose。

---

# 8. 改造包 D：Token 原子预算

## D1. 保留等级

### Required

必须保留：

- 平台规则
- 当前 user
- Character / Companion 核心身份
- 当前任务最低输出约束

### Reserved

优先保留：

- 最近完整 Turn
- Character 性格
- Character persistentPremise
- Persona 核心身份
- Companion currentArc
- 高优先世界书
- 高可信 Memory Claim

### Optional

可舍弃：

- 扩展背景
- 示例消息
- Persona 扩展背景
- 扩展风格
- 低优先世界书
- 反重复提示

## D2. 禁止任意截断

只允许：

```text
完整 content
→ 有效 compactContent
→ 整块舍弃
```

不得在任意 Token 位置截断角色卡、Persona、世界书或 Preset。

## D3. compact 一致性

每个 compact 必须保存：

```text
compactSourceHash
```

修改原始内容后，如果 Hash 不一致：

- compact 标记 stale。
- 不允许自动使用 stale compact。
- Required / Reserved 保留完整内容。
- Optional 可以整体舍弃。

## D4. 最终预算校验

Provider 编译后重新计算 Token。

如果仍超出：

```text
Optional 完整
→ Optional compact
→ 删除低优先 Optional
→ Reserved compact
→ 删除最低优先 Reserved
```

Required 超预算时返回明确错误，不得静默截断。

---

# 9. 改造包 E：世界书 V2

## E1. 世界书关联

不要使用 `targetType + targetId` 多态关联。

建立带真实外键的独立表：

```text
WorldBookCharacter
WorldBookPersona
WorldBookConversation
WorldBookCompanion
```

没有任何关联表示全局。

作用域具体度：

```text
conversation
> character / companion
> persona
> global
```

作用域具体度参与候选排序，但不自动删除其他作用域内容。

## E2. 世界书 Revision

建立不可变 Revision：

```prisma
model WorldBookEntry {
  id               String @id @default(cuid())
  worldBookId      String
  activeRevisionId String?
  isEnabled        Boolean @default(true)
}

model WorldBookEntryRevision {
  id             String   @id @default(cuid())
  entryId        String
  version        Int
  configJson     String
  content        String
  compactContent String?
  contentHash    String
  createdAt      DateTime @default(now())

  @@unique([entryId, version])
}
```

修改条目时：

```text
创建新 Revision
→ 校验
→ 切换 activeRevisionId
```

历史 Trace 必须引用具体 Revision。

## E3. 内容类型

定义：

```ts
type WorldBookContentType = 'lore' | 'state' | 'behavior_rule' | 'reference';
```

默认 placement：

| contentType   | placement           |
| ------------- | ------------------- |
| lore          | before_history      |
| state         | before_current_user |
| behavior_rule | instruction         |
| reference     | after_history       |

约束：

- lore 不得自动成为最高权重指令。
- behavior_rule 必须显式创建。
- 导入条目默认不能直接成为 behavior_rule。

## E4. 信任级别

定义：

```ts
type ContentTrustLevel =
  | 'system'
  | 'user_authored'
  | 'imported_untrusted'
  | 'user_confirmed_import';
```

规则：

- imported_untrusted 默认只能是 lore/reference。
- 未确认导入内容不得进入 instruction。
- 世界书不得修改平台不可覆盖规则。
- 前端和 Prompt 预览必须显示信任级别。

## E5. 世界书配置

```ts
type WorldBookActivationMode = 'constant' | 'keyword' | 'manual';

type WorldBookMatchMode = 'contains' | 'normalized_phrase';

type WorldBookEntryConfig = {
  title: string;

  contentType: WorldBookContentType;
  trustLevel: ContentTrustLevel;

  activationMode: WorldBookActivationMode;
  matchMode: WorldBookMatchMode;

  primaryKeywords: string[];
  primaryLogic: 'any' | 'all';

  secondaryKeywords: string[];
  secondaryLogic: 'and_any' | 'and_all' | 'not_any' | 'not_all';

  excludeKeywords: string[];
  sameMessageOnly: boolean;

  scanSources: Array<'current_user' | 'user_history' | 'assistant_latest'>;

  userHistoryScanDepth: number;

  stickyTurns: number;
  continuationTurns: number;
  cooldownTurns: number;
  delayTurns: number;

  cooldownPolicy: 'strict' | 'current_user_override';

  generationPurposes: GenerationPurpose[];

  budgetPriority: number;
  sortOrder: number;

  placement: 'instruction' | 'before_history' | 'after_history' | 'before_current_user';

  maxTokens?: number;
};
```

## E6. priority 删除

删除现有单一 `priority` 业务语义。

改为：

```text
budgetPriority：预算竞争
sortOrder：最终顺序
```

稳定兜底必须使用 entry ID。

不得让数据库查询顺序参与 Prompt 排序。

## E7. 标准化匹配

`normalized_phrase` 至少处理：

- Unicode 规范化
- 大小写
- 全角半角
- 连续空白
- 常见中英文标点

不得把多条消息拼成一个大字符串。

Matcher 必须按消息返回匹配证据。

---

# 10. 改造包 F：世界书触发、assistant bridge 和状态机

## F1. current_user

可以：

- 创建 sticky
- 创建 continuation
- 创建持久激活事件
- 重置 assistant bridge 根
- 根据 cooldownPolicy 突破 cooldown

## F2. user_history

只作为窗口证据：

```text
user_history_window
```

不能：

- 创建或刷新 sticky
- 创建或刷新 cooldown
- 创建 continuation
- 重置激活时间
- 每轮重复创建激活事件

## F3. constant

始终进入候选，但仍参与预算。

平台规则不得存放在普通 constant 世界书中。

## F4. manual

只通过显式操作激活，不参与关键词扫描。

## F5. assistant 受控桥接

默认支持 `assistant_latest`，但固定使用 bridge 模式。

只扫描最新有效 assistant：

```text
complete 或 edited
未删除
未被 regenerate 替代
```

不得扫描：

- generating
- failed
- stopped
- system/developer
- 世界书内容
- Prompt Section
- Memory Summary
- Generation Hint
- user suggestions

## F6. 每条世界书独立血缘

定义：

```ts
type IncludedWorldBookTrace = {
  entryId: string;
  revisionId: string;

  activationSource:
    | 'constant'
    | 'current_user'
    | 'user_history_window'
    | 'assistant_bridge'
    | 'sticky'
    | 'continuation'
    | 'manual';

  sourceMessageId?: string;

  rootUserMessageId: string;

  lineageEntryIds: string[];
  bridgeDepth: number;
};
```

禁止使用消息级 lineage 并集。

一条 assistant 可以同时包含：

```text
A → B
X → Y
```

B 只继承 A 的血缘，Y 只继承 X 的血缘。

## F7. 自我回声阻断

如果条目参与生成最新 assistant：

```text
assistant_self_echo
```

该 assistant 不能重新桥接同一条目。

原有 sticky 或 continuation 可以继续存在。

## F8. 循环阻断

如果候选条目已经位于对应 lineage：

```text
assistant_activation_cycle
```

阻止：

```text
A → A
A → B → A
A → B → C → A
```

## F9. 最大扩散深度

```text
maxAssistantBridgeDepth = 2
```

超过后不得继续自动桥接。

用户当前输入明确触发时，建立新根并将深度重置为 0。

## F10. assistant 严格匹配

assistant 必须满足以下之一：

- 完整标准化主短语
- 主关键词与次关键词在同一 assistant 消息中

禁止：

- 单字关键词
- 过短宽泛词
- 多轮 assistant 历史
- 跨 assistant 消息组合关键词

## F11. 单轮数量上限

```text
maxAssistantTriggeredEntriesPerTurn = 3
```

排序：

```text
完整专名
→ 主次同消息
→ 关键词具体度
→ budgetPriority
→ sortOrder
```

## F12. continuation

continuation 和 sticky 必须分开。

用途：

```text
用户触发地点
→ AI 回复描述地点
→ 用户下一轮说“进去看看”
```

默认：

```text
current_user 触发：continuation 1 轮
assistant_bridge：continuation 1 轮
```

continuation：

- 不属于长期 sticky
- 不允许 assistant 刷新
- 不允许 user_history 刷新
- 到期自动结束

## F13. sticky 语义

`stickyTurns` 表示当前触发 Turn 完成后，额外保持的未来完整 Turn 数。

示例：

```text
第 5 Turn 触发
stickyTurns = 2

第 5：当前触发
第 6：sticky
第 7：sticky
第 8：结束
```

## F14. cooldown

cooldown 从 sticky 和 continuation 全部结束后开始。

`current_user_override` 时，当前 user 明确提及可以突破。

user_history 和 assistant bridge 永远不能突破 cooldown。

## F15. delay

只统计 complete Turn。

preview、failed、stopped、regenerate 不计入。

## F16. 来源优先级

同一条目同时存在多种来源时：

```text
current_user
> manual
> sticky
> continuation
> user_history_window
> assistant_bridge
> constant
```

Trace 保存主来源，也保存其他匹配证据。

## F17. 状态表

数据库分别建立以下四张表，并使用真实外键，不使用多态 `targetId`：

- `ConversationWorldBookActivationState`
- `CompanionWorldBookActivationState`
- `ConversationWorldBookActivationEvent`
- `CompanionWorldBookActivationEvent`

两类 State 共享以下领域字段：

```prisma
id                       String @id @default(cuid())
entryId                  String
entryRevisionId          String
activatedByMessageId     String?
rootUserMessageId        String?
lineageJson              String
bridgeDepth              Int
activatedAtCompletedTurn Int?
stickyUntilCompletedTurn Int?
continuationUntilCompletedTurn Int?
cooldownUntilCompletedTurn     Int?
pendingUntilCompletedTurn      Int?
manualActive             Boolean @default(false)
stateVersion             Int @default(1)
```

Conversation 表增加 `conversationId`，Companion 表增加 `companionId`，并分别建立 `@@unique([conversationId, entryId])` / `@@unique([companionId, entryId])`。所有 turn 边界字段均按成功 Turn 的 `completedOrdinal` 计算，failed/stopped 不推进。

两类 Event 共享：

```prisma
id                String @id @default(cuid())
entryId           String
entryRevisionId   String
sourceType         String
sourceKey          String
sourceMessageId    String?
rootUserMessageId  String?
lineageJson        String
bridgeDepth        Int
completedTurn      Int
createdAt          DateTime @default(now())
```

`sourceKey` 必须非空，由事件来源确定性生成，例如 `message:<messageId>`、`manual:<operationId>`、`constant:<completedOrdinal>`。Conversation/Companion 事件表分别使用 `@@unique([conversationId, entryId, entryRevisionId, sourceKey])` 和 `@@unique([companionId, entryId, entryRevisionId, sourceKey])`。不得依赖含 nullable `sourceMessageId` 的 SQLite unique 约束实现幂等。manual 操作发生在任何成功 Turn 之前时，`rootUserMessageId` 和 `activatedAtCompletedTurn` 可以为空，但后续被纳入生成时 Included World Book Trace 必须记录本轮 root user。

世界书 revision 切换规则：

1. 编辑条目创建新 revision，并原子切换 entry 的 active revision。
2. 清除受影响目标中该 entry 的当前 Activation State，并递增目标 version；不得把旧 revision 的 sticky、continuation、cooldown 或 manual 状态直接继承到新 revision。
3. 历史 Event、Generation Trace 和 prompt snapshot 永久保留其实际使用的 revision。
4. Replay 重算历史 Turn 时读取成功 Trace 记录的历史 revision 集合，不能用当前 active revision 改写过去；revision 切换之后的新 Turn 才使用新 revision。
5. manual 激活和取消必须有显式 API、operationId、权限校验和前端状态展示，并同样进入 Event、version 和 Replay 语义。

---

# 11. 改造包 G：Character、Persona、Preset、Companion

## G1. Character

最终结构：

```ts
type CharacterProfile = {
  name: string;

  coreIdentity: string;
  personality: string;

  persistentPremise: string;
  initialScenario: string;

  extendedBackground?: string;
  characterRules?: string;
  speechStyle?: string;

  firstMessage?: string;
  exampleMessages?: ExampleMessage[];
};
```

注入：

| 字段               | 策略              |
| ------------------ | ----------------- |
| coreIdentity       | Required，每轮    |
| personality        | Reserved，每轮    |
| persistentPremise  | Reserved，每轮    |
| initialScenario    | 仅首轮            |
| extendedBackground | Optional          |
| characterRules     | Reserved          |
| speechStyle        | Reserved/Optional |
| firstMessage       | 首轮              |
| exampleMessages    | 首轮且预算允许    |

不得把全部 Scenario 统一视为首轮。

## G2. Persona

```ts
type PersonaProfile = {
  name: string;
  coreIdentity: string;
  background?: string;
  interactionPreferences?: string;
};
```

职责：

- coreIdentity：用户是谁
- background：用户背景
- interactionPreferences：称呼和互动偏好

Persona 不负责修改 AI 核心身份或世界事实。

## G3. Preset

```ts
type PresetRuleOperation = 'add' | 'replace_optional' | 'disable_optional';

type PresetOutputRule = {
  key: string;
  content: string;
  operation: PresetRuleOperation;
  sortOrder: number;
};

type PromptPreset = {
  name: string;
  instructions: string[];
  outputRules: PresetOutputRule[];
  parameters: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  };
  generationPurposes: GenerationPurpose[];
};
```

合并：

```text
平台不可覆盖规则
→ 系统基础规则
→ Preset 规则操作
→ 本轮 Generation Hint
```

Preset 不能隐式替换全部基础规则。

## G4. Companion

```ts
type CompanionProfile = {
  name: string;
  coreIdentity: string;
  personality: string;
  speechStyle: string;
  relationshipDefaults?: string;
};

type CompanionRuntimeState = {
  currentMood?: string;
  currentSituation?: string;
};
```

必须区分：

```text
Profile
Runtime State
Memory
```

Runtime State 必须持久化，不得只存在于 Prompt Builder 的临时对象中：

```prisma
model CompanionRuntimeState {
  id               String   @id @default(cuid())
  companionId      String   @unique
  currentMood      String?
  currentSituation String?
  version          Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

Runtime State 只能由明确的用户操作或经过校验的 `ProposedContextCommit` 更新；模型自然语言输出不能直接写入。每次变更都必须递增 Companion version，并在 Trace snapshot 中记录使用的 Runtime State 版本。

## G5. 内容归属校验

建立 `ContextOwnershipValidator`。

归属规则：

| 内容         | 模块                             |
| ------------ | -------------------------------- |
| 用户身份     | Persona.coreIdentity             |
| 用户背景     | Persona.background               |
| 用户互动偏好 | Persona.interactionPreferences   |
| 会话整体风格 | Preset                           |
| 角色核心身份 | Character/Companion.coreIdentity |
| 稳定性格     | personality                      |
| 说话方式     | speechStyle                      |
| 角色行为边界 | characterRules / companion rules |
| 世界知识     | WorldBook lore                   |
| 条件行为     | WorldBook behavior_rule          |
| 当前状态     | WorldBook state                  |
| 长期聊天事实 | Memory Claim                     |
| 当前主线     | Memory currentArc                |
| 防重复       | Generation Hint                  |

重复或冲突时提示，不自动删除自由文本。

---

# 12. 改造包 H：Companion Memory、Replay 和调试

## H1. Active Revision

Prompt Builder 只能读取 active revision。

```prisma
model CompanionMemory {
  id                String   @id @default(cuid())
  companionId       String   @unique
  activeRevisionId  String?  @unique
  status            String
  workingRevisionId String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model CompanionMemoryRevision {
  id                     String   @id @default(cuid())
  companionId            String
  version                Int
  dataJson               String
  dataHash               String
  sourceStartMessageId   String?
  sourceEndMessageId     String?
  sourceCompletedOrdinal Int?
  reason                 String
  status                 String
  createdAt              DateTime @default(now())

  @@unique([companionId, version])
}
```

`dataHash` 同样使用统一 canonical JSON + SHA-256。`pending`、`updating`、`failed` 不影响当前 active revision；新 working revision 完成结构校验、来源校验和投影校验后，才能原子切换 `activeRevisionId`，并递增 Companion version。`stale` 保留旧 revision 供审计和 Replay，但 Prompt 不再注入它。

## H2. Memory Claim

Memory Claim 是唯一事实来源：

```ts
type MemoryEvidenceLevel =
  | 'explicit_user'
  | 'confirmed_user'
  | 'repeated_user'
  | 'assistant_event'
  | 'inferred';

type MemoryClaim = {
  id: string;

  category: 'user_fact' | 'companion_fact' | 'relationship_fact' | 'shared_event' | 'current_arc';

  content: string;

  sourceMessageIds: string[];
  sourceRoles: Array<'user' | 'assistant'>;

  originatingRevisionId?: string;

  evidenceLevel: MemoryEvidenceLevel;

  status: 'active' | 'superseded' | 'disputed';
};
```

不要使用模型自行填写的浮点 confidence 作为权威。

## H3. Summary 是投影

```ts
type MemoryProjection = {
  content: string;
  sourceClaimIds: string[];
};

type CompanionMemoryRevisionData = {
  claims: MemoryClaim[];
  relationshipSummary: MemoryProjection;
  currentArc: MemoryProjection;
};
```

Claims 和 Projection 的权威数据只存在于 `CompanionMemoryRevision.dataJson`。不得同时在 `CompanionMemory` 主表维护另一份 `relationshipState`、`currentArc` 或 summary 文本作为并行事实源。

摘要不能出现无 Claim 支撑的新事实。

校验失败时不切换 active revision。

## H4. 防止记忆自证

assistant Trace 保存 `memoryRevisionIdUsed`。

规则：

- 受 Revision R 影响的 assistant 可以维持剧情。
- 不能单独提高 R 中 Claim 的证据等级。
- 不能单独创建 user_fact。
- 用户明确确认后才可提升用户事实。

## H5. Memory 预算

```text
最近完整聊天
→ currentArc
→ Runtime State
→ 高证据 Claim
→ relationshipSummary
→ 较旧 shared events
```

## H6. 确定性 Replay

分别新增 `ConversationReplayService` 与 `CompanionReplayService`。两者复用 Timeline、canonical snapshot 和 Replay Engine 接口，但各自使用真实表和领域状态：

- Conversation Replay：重建有效 Turn、active assistant、世界书 State/Event。
- Companion Replay：除上述内容外，还重建 Runtime State、Memory Claim/Projection/Revision，并安全切换 active revision。

消息编辑、删除、regenerate 后：

```text
读取有效 Turn
→ 读取每个 Turn active assistant
→ 按成功 Trace 中记录的历史世界书 revision 和 prompt snapshot 从起点重算状态
→ 重建 ActivationState 和 Event
→ Companion 标记受影响 Memory Claim/Revision 失效
→ Companion 从安全 Revision 或空状态重建 Memory
```

不要实现复杂局部逆补偿。

可以增加 Checkpoint 作为性能优化，但完整重放是正确性基准。

Replay 只读取每个 Turn 的 active assistant；失败、停止、被 regenerate 替代以及 `imported_edited_assistant` 均不得作为 assistant bridge 或 Memory 自证来源。Replay 写回时必须持有目标级 Replay Lease 或等价互斥，并递增目标 version，防止与生成提交交错。

## H7. 历史和反重复

删除所有基于 assistant 前 8/12 字符删除历史的逻辑。

历史只因以下原因排除：

- Token 预算
- 用户删除
- 分支
- regenerate 替代

反重复改成一轮 Optional Generation Hint：

```text
避免逐字复用最近回复的开头或大段表达。
如果当前情境需要自然承接，可以保留必要称呼、动作和事实。
```

Generation Hint：

- 不持久化
- 不参与世界书扫描
- 不进入 Memory
- 不强制更换场景、动作或情绪

## H8. Prompt Preview

Preview 必须复用真实 Context Resolver、Matcher、Budget 和 Compiler。

展示：

- Section 来源、版本、placement、importance
- 是否 compact
- Token
- 排除原因
- 世界书匹配消息和关键词
- self echo / cycle / depth / limit
- sticky、continuation、cooldown
- Proposed State
- Provider 最终 Role 和顺序
- final token
- compilerVersion
- promptSnapshotHash

必须明确显示 dry-run，不提交状态。

---

# 13. 前端与导入导出要求

必须同步更新：

- 世界书编辑器
- 世界书绑定 UI
- Character 编辑器
- Persona 编辑器
- Preset 编辑器
- Companion 编辑器
- Model Provider capability 编辑器
- Prompt Preview
- Conversation / Companion 聊天页
- 公共分享聊天页 `share-web`
- 内容包导入导出
- 单模块导入导出
- 表单校验
- 类型定义
- API DTO

前端必须显示：

- 世界书 content type
- trust level
- activation mode
- match logic
- scan source
- sticky / continuation / cooldown / delay
- generation purposes
- budget priority / sort order
- compact 是否 stale
- 世界书绑定目标
- Prompt 冲突或职责重叠警告
- manual 世界书当前状态、激活和取消入口
- Provider capabilities 与保守默认值
- Companion Runtime State 与当前 active Memory Revision
- provisional assistant 状态、提交冲突提示和有效时间线刷新

导入内容默认标记为 `imported_untrusted`，用户确认后才能成为高权重行为规则。

主站与 `share-web` 每次发送都必须生成 requestId。仅“重试本轮”使用新 requestId + 原 turnId；网络层对同一请求的透明重试复用原 requestId。收到 `done` 前，delta 只显示为 provisional；收到 `CONTEXT_COMMIT_CONFLICT`、failed 或 stopped 后必须丢弃 provisional 内容并重新拉取有效消息。

本次重构不备份、迁移或兼容现有本地数据库数据，可以通过 destructive migration 或重建 SQLite 落地。但最终产品的内容包、角色、世界书、Preset、Persona、Companion 等业务导入导出仍必须支持新结构；这与“保留旧运行数据”是两件事。

---

# 14. 必须删除的旧逻辑

完成新架构后，删除或替换：

- 旧世界书 Matcher
- 单一 priority 业务语义
- 依赖 originalIndex 的排序
- `updatedAt` 影响 Prompt 顺序
- 固定四位置直接生成 system 世界书消息
- Character、Persona、Preset 聚合大文本的旧 Builder 逻辑
- Preset outputRules 与默认规则二选一逻辑
- 非 ready Memory 直接读取逻辑
- assistant 前缀历史删除逻辑
- Preview 单独实现的 Prompt 组装逻辑
- Provider 不支持 developer 时的临时字符串拼接逻辑
- 任何 Matcher 内直接写数据库状态的逻辑

---

# 15. 测试要求

不要只补少量 happy-path 测试。

## 15.0 测试底座 T0（分两步完成）

当前仓库只有 `scripts/verify-*.mjs` / `scripts/verify-*.ts` 检查脚本，没有通用测试 runner、Nest/Prisma 集成测试环境或 Vue 组件测试环境。现有 verifier 保留，但不能替代正式测试底座。

### 15.0.1 执行阶段与硬检查点

T0 必须拆成两个顺序明确的阶段：

```text
代码地图
→ T0a 通用测试基础设施
→ A1 最终 Turn Schema、共享类型、Timeline 纯逻辑和 canonical hash 工具
→ T0b 领域 Smoke Tests
→ A2/A3/B3/F17/H6 接入真实聊天链路
→ 其余 A～H 与对应测试
```

#### T0a：不依赖新领域模型

T0a 必须在 A1 正式编码前完成，范围只包括：

- Vitest 安装、配置、test projects 和根脚本。
- 临时 SQLite 数据库创建/关闭/清理 helper，可先使用改造前当前 Schema 验证隔离能力。
- 可注入 Fake Model Gateway 的基础接口、调用记录、delta/done/error/abort 编排。
- 通用 SSE frame collector/parser。
- Web 与 share-web 的 jsdom 和最小组件挂载环境。
- 至少一个 server unit、server integration、web、share-web smoke test，证明四类 project 都能独立运行。

T0a 不要求提前伪造尚未落地的 Turn、GenerationRequest、ActivationState 或 Memory Revision 模型。

#### A1 基础领域落地

T0a 通过后再实现 A1 的最终 Prisma Schema、真实外键、共享类型与 Timeline 纯逻辑。为了给 T0b 提供确定性断言，可以同时提前落地不连接业务调用链的 canonical JSON/hash 工具。此阶段允许执行 destructive migration 或重建测试 SQLite，但不得切换 A2/A3/B3 等真实聊天事务路径。

#### T0b：依赖 A1 的领域 Smoke Tests

T0b 在 A1 完成后进行，范围包括：

- 按最终 A1 Schema 重建临时 SQLite，并验证 Turn/Message 真实外键和约束。
- Timeline active assistant、failed/stopped/replaced 排除规则。
- canonical JSON/hash 稳定性。
- Fake Gateway barrier 控制的最小并发交错能力。
- SSE provisional → done / error 状态转换。
- 主站与 share-web 最小聊天流状态测试。

T0a 与 T0b 全部通过是高风险真实链路的硬门槛。任何“先把 A2/A3/B3/F17/H6 写完，最后再补 T0b”的执行方式都不符合本方案。

### 15.0.2 技术选型

使用与当前 TypeScript、Vite、Vue 3、NestJS、Prisma、SQLite 栈兼容的轻量方案：

- 通用 runner：`vitest`。
- 服务端模块测试：`@nestjs/testing`。
- HTTP Controller/REST 集成测试：`supertest` 与对应类型。
- Web 与 share-web 组件测试：`@vue/test-utils` + `jsdom`。
- 不在 T0 引入 Playwright、Cypress、Docker 数据库或远程测试服务；浏览器端到端测试不是本检查点的前置条件。
- 不要求首期配置覆盖率阈值；先保证关键路径可测试、结果稳定。覆盖率统计可以使用 `@vitest/coverage-v8`，但不得用覆盖率数字替代不变量测试。

依赖版本必须与安装时仓库已有 Node、pnpm、Vite 和 TypeScript 版本兼容，不在文档中锁死未经实际安装验证的版本号。

### 15.0.3 目录与脚本

至少建立：

```text
apps/server/test/
  unit/
  integration/
  fixtures/
  helpers/
apps/web/src/**/*.spec.ts
apps/share-web/src/**/*.spec.ts
packages/shared/src/**/*.spec.ts
```

根目录或各 workspace 必须提供可稳定执行的脚本，最终根目录至少支持：

```text
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:watch
```

如果采用 Vitest projects/workspace 配置，server unit、server integration、web、share-web 必须作为清晰独立的 test project，允许单独执行。unit tests 可以并行；SQLite integration tests 默认串行或使用每 worker 独立数据库，不能因测试自身争抢同一文件而产生随机失败。

### 15.0.4 隔离 SQLite 测试数据库

建立统一的 `TestDatabase` helper：

- 每个 integration test worker 使用唯一的临时 SQLite 文件。
- 测试数据库必须位于系统临时目录或明确的测试临时目录，不得读取或覆盖 `data/tavern-lite.db`。
- 每次创建数据库时显式设置测试专用 `DATABASE_URL`，并从当前 `prisma/schema.prisma` 建表。
- test suite 结束后关闭 Prisma 连接并清理自己的临时数据库；不得扩大清理范围。
- 每个测试案例使用事务回滚、显式 truncate/delete fixture 数据，或重建该测试数据库，具体策略必须确定且不依赖测试执行顺序。
- 并发测试必须让多个请求访问同一个专用测试数据库，真实覆盖 SQLite 事务、unique constraint、version 和 Generation Lease，而不是用内存 Map 伪造数据库结果。
- 测试不得依赖 seed 中的固定用户、真实 API Key、现有上传文件或开发机个人数据。

### 15.0.5 Fake Model Gateway

建立可注入的 `FakeModelGateway`，不得在测试中访问真实模型供应商。它至少支持确定性编排：

```ts
type FakeGatewayStep =
  | { type: 'delta'; text: string }
  | { type: 'done'; finishReason?: string }
  | { type: 'error'; code: string }
  | { type: 'throw'; error: Error }
  | { type: 'wait'; key: string };
```

Fake 必须能够：

- 记录每次候选模型调用、输入 messages、参数和 abort 状态。
- 控制在首个 delta 前失败或在已发送 delta 后失败。
- 通过 barrier/wait 手动控制两个请求的交错顺序，用于 version、lease、regenerate 和新 Turn 并发测试。
- 模拟 fallback、timeout、stop、provider error 和正常完成。
- 验证每个 fallback candidate 都重新 Compiler，而不是复用前一候选 Prompt。

如果现有 `ModelGatewayService` 难以替换为 Fake，必须先通过 Nest injection token 或窄接口完成可测试性改造，禁止在测试中 monkey patch 全局 `fetch` 作为核心方案。

### 15.0.6 SSE 测试辅助器

建立统一 SSE collector/parser，直接消费服务端输出流并记录事件顺序。至少支持断言：

- `delta` 在事务提交前只属于 provisional 输出。
- 成功事务提交之后才出现唯一 `done`。
- failed、stopped、timeout、version/lease conflict 不得出现 `done`。
- complete requestId 的幂等重放只返回带 `idempotentReplay: true` 的 `done`。
- 客户端 abort 能传递到 Fake Model Gateway，并保存 stopped 状态。
- 已发送 delta 后发生 provider failure 时不得启动下一个 fallback candidate。

主站和 `share-web` 可以复用同一套 SSE frame fixture；不得为公开分享接口另写一套宽松断言。

### 15.0.7 Fixture、时钟和确定性工具

建立类型安全 fixture factory，至少能创建：

- T0a：当前 Schema 已存在的 User、Character、Companion、Persona、Preset、Provider Model/Fallback Group、Share Link 与公开聊天目标。
- T0b：A1 落地后的 Conversation/Companion Turn、user message 与多版本 assistant。
- F17 落地时扩展 World Book、Entry、Revision、State、Event fixture。
- G4/H1 落地时扩展 Companion Runtime State、Memory、Memory Revision fixture。

Fixture factory 随领域模型实施逐步扩展；不得要求 T0a 伪造尚未存在的表，也不得因此跳过后续改造包的 fixture。

对 requestId、operationId、时间、timeout 或后台任务调度有依赖的 Service，应注入可控的 ID/Clock/Scheduler 窄接口，或提供等价的确定性测试边界。测试不得依靠真实等待、随机 UUID 碰运气或系统当前时间判断 sticky/cooldown 边界。

### 15.0.8 T0a Smoke Tests

在 A1 正式编码前，以下 smoke tests 必须通过：

1. Vitest 能分别运行 server unit、server integration、web 和 share-web project。
2. 临时 SQLite 可以根据改造前当前 Prisma Schema 建表、读写，并确认没有访问运行时数据库。
3. Fake Model Gateway 可以稳定产生 `delta → done`、首 delta 前失败、delta 后失败和 abort。
4. SSE collector 能正确解析分片帧、连续帧和尾部残片，并断言事件顺序。
5. Web 与 share-web 均能在 jsdom 中完成一个与具体新领域模型无关的最小 mount。

### 15.0.9 T0b 领域 Smoke Tests

A1 和必要纯工具完成后、A2/A3/B3/F17/H6 接入真实链路前，以下 smoke tests 必须通过：

1. 临时 SQLite 按最终 A1 Schema 建表，并验证 Turn、user message、assistant message 的真实外键和唯一约束。
2. canonical JSON + SHA-256 对相同语义输入生成稳定 hash，对消息顺序变化生成不同 hash。
3. Timeline fixture 能解析一个 Turn 的 active assistant，并排除 failed、stopped、replaced assistant。
4. Fake Model Gateway 的 barrier/wait 能确定性控制两个请求的交错顺序，不使用真实 sleep 碰运气。
5. 主站聊天流相关 composable/component 能验证 provisional → done 与 provisional → error 状态转换。
6. share-web 使用相同 SSE fixture，并验证 provisional 失败后不会保留伪 assistant 消息。

### 15.0.10 T0 验收边界

T0a/T0b 完成只表示测试基础设施和领域门槛 smoke tests 可用，不表示第 15 章业务回归已经完成。必须同时满足：

- 所有测试均可通过单条根脚本重复执行。
- 测试不访问网络、不调用真实 Provider、不读取真实 API Key。
- 测试不读取、修改或删除运行时 SQLite 和 uploads。
- 连续执行两次结果一致，不依赖文件执行顺序。
- 新增测试失败时进程返回非零退出码。
- 现有 verifier 继续可执行，并逐步把关键断言迁移或补充到正式测试中。

T0a 完成后才进入 A1；T0b 完成后才允许高风险真实链路切换。此后每个 A～H 改造包必须在替换旧逻辑的同一阶段补上对应测试，不能把所有测试集中推迟到最后。

## 15.1 Matcher

覆盖：

- ANY / ALL / NOT
- sameMessageOnly
- current user
- user history window
- assistant bridge
- self echo
- A→B→A
- 最大深度
- assistant 数量限制
- continuation
- sticky
- cooldown
- delay
- constant
- manual

## 15.2 状态机

覆盖：

- sticky 边界
- continuation 不刷新
- cooldown 边界
- regenerate 不推进 Turn
- failed 不提交
- preview 不提交
- 同一来源不重复建事件

## 15.3 幂等和并发

覆盖：

- Conversation 与 Companion 相同 requestId + 相同 requestHash 的重试
- 相同 requestId + 不同 requestHash 冲突
- generating requestId 不重复附着，complete requestId 只返回幂等 done
- failed/stopped requestId 保持终态；新 requestId + 原 turnId 才能重试本轮
- 两个请求同时创建下一 Turn
- regenerate 与新 user 并发
- Conversation / Companion version 与 Generation Lease 冲突
- 冲突后不发送 done，provisional delta 被前端清除
- fallback 只有成功候选提交；已发送 delta 后不得 fallback
- 公开分享入口按 owner + target + requestId 隔离

## 15.4 Replay

覆盖：

```text
user 触发 A
→ A 引入 B
→ B continuation/sticky
→ 编辑或删除最初 user
```

重放后不得保留无来源状态。

同一组案例必须分别覆盖 Conversation 和 Companion；Companion 还要覆盖 Runtime State、Memory active revision、working revision 失败以及 Replay 与生成并发。历史重放必须使用 Trace 中记录的旧世界书 revision，而不是当前 active revision。

## 15.5 Provider Golden Tests

覆盖：

- 支持 developer
- 不支持 developer
- 只允许初始 system
- 小上下文模型
- fallback 重新编译
- capability 快照、最终参数和 canonical prompt snapshot hash 稳定
- history 的 user/assistant conversationRole 编译正确

## 15.6 Memory Provenance

覆盖：

- assistant 不得创建 user_fact
- 同 Revision assistant 不得强化原 Claim
- 删除来源后 Claim 失效
- Summary 不得包含无 Claim 内容
- failed working revision 不切 active
- stale revision 不注入但仍可审计和 Replay
- Runtime State 变更递增 Companion version

## 15.7 前端和导入导出

覆盖：

- 新字段序列化
- 导入 trust level
- compact stale
- 多目标关联
- Preview 与实际生成一致
- 主站和 share-web requestId / provisional / conflict 行为一致
- manual 世界书 activation operationId 幂等

---

# 16. 验收不变量

最终实现必须满足：

1. 同一 assistant 不能重新激活参与生成它的世界书。
2. 每条世界书拥有独立 lineage。
3. lineage 中不能重复 entry。
4. bridge 不能超过最大深度。
5. assistant bridge 不能创建或刷新 sticky。
6. assistant bridge 只能创建有限 continuation。
7. 旧 user 消息不能重复创建持久事件。
8. user history 不能刷新 sticky/cooldown。
9. Preview 和 suggestions 不修改状态。
10. failed/stopped 不提交状态。
11. fallback 只保存成功模型上下文。
12. 只有 included 世界书进入 Included World Book Trace；其他匹配证据仍进入 Section Trace 和 snapshot。
13. regenerate 不增加 Turn。
14. 旧 regenerate assistant 不参与 bridge。
15. requestId 在 owner + target 范围内按 requestHash 幂等；显式重试用新 requestId 复用原 Turn。
16. 每个 Turn 只有一个 active assistant。
17. Conversation / Companion version 或 Generation Lease 冲突禁止提交，且 done 只能在事务成功后发送。
18. 编辑删除后状态可重放。
19. 数据库查询顺序不影响 Prompt 顺序。
20. Preset 不得隐式删除基础规则。
21. Required 不静默截断。
22. stale compact 不使用。
23. Companion 只读取 active revision。
24. Summary 不产生无 Claim 事实。
25. 受同一记忆影响的 assistant 不得自证。
26. user_fact 必须来自 user。
27. 未确认导入内容不得直接成为高权重行为规则。
28. 世界书、Prompt、摘要和 Hint 不得作为真实聊天扫描来源。
29. 当前用户明确输入可以重新授权条目。
30. Preview 和真实生成复用同一逻辑。
31. Conversation 与 Companion 使用独立真实外键表，但复用相同领域接口和不变量。
32. Prompt 历史 Section 必须保存真实 conversation role，不得全部编译成 system。
33. 成功 Trace 必须保存可重放的 canonical prompt snapshot；hash 不能替代 snapshot。
34. 世界书状态事件使用非空 sourceKey 幂等，不能依赖 nullable unique。
35. 世界书 revision 切换不继承旧 revision 状态，历史 Trace 仍引用实际旧 revision。
36. Companion Runtime State 必须持久化并参与 version；模型文本不能直接改写。
37. Companion Memory 只有 active revision 可注入，Claim 与 Projection 只有一个权威数据源。
38. failed/stopped Turn 不推进 completedOrdinal；active assistant 只在成功事务中切换。

---

# 17. Codex 执行纪律

在实施过程中：

- 不要只输出建议。
- 不要停留在类型和 Schema。
- 不要忽略前端和导入导出。
- 不要创建临时兼容层。
- 不要用 TODO 代替核心实现。
- 不要为了减少改动而保留旧行为。
- 不要修改无关业务。
- 不要擅自引入向量库、RAG、Redis 或新基础设施。
- 新增依赖前先判断现有栈是否能完成。
- 优先复用当前项目的 TypeScript、Nest、Prisma、Vue 结构。
- 每完成一个模块后保持类型检查和构建通过。
- 使用仓库现有脚本；先读取 package.json，不要假设命令名称。
- 发现本文件和当前代码存在无法同时满足的冲突时，以本文件的最终业务语义为准，并在最终报告中说明。

---

# 18. 最终输出格式

完成代码后，向用户输出：

## 18.1 变更摘要

按 T0a、A1、T0b、A2～H 的实际依赖顺序说明完成内容。

## 18.2 数据库变化

列出：

- 新增模型
- 删除模型
- 修改字段
- 索引和唯一约束
- Migration 说明

## 18.3 服务端变化

列出：

- 新增服务
- 替换服务
- 删除旧逻辑
- API/DTO 变化

## 18.4 前端变化

列出：

- 编辑页面
- Preview
- 导入导出
- 校验和提示

## 18.5 测试结果

列出实际执行命令和结果：

```text
typecheck
unit test
integration test
build
```

## 18.6 未完成和风险

如果有任何内容未完成，必须明确：

- 未完成项
- 原因
- 影响
- 下一步

不得把未实现内容描述为已经完成。

---

# 19. 完成定义

只有同时满足以下条件，任务才算完成：

- 新数据模型落地。
- Migration 可执行。
- 允许 destructive migration 或重建本地 SQLite，不要求保留旧数据或旧架构兼容层。
- T0a 与 T0b 均可重复运行，且与运行时数据库、真实 Provider 和网络隔离。
- 服务端使用新架构。
- 前端支持新字段。
- 导入导出使用新格式。
- Prompt Preview 使用真实 Compiler。
- 旧核心逻辑已删除。
- 核心测试完成。
- 类型检查通过。
- 构建通过。
- 最终报告完整。

不要在仅完成 Schema 或后端一部分时宣布完成。
