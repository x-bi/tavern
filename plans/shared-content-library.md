# 共享内容库（内置管理员向成员发放角色、世界书、预设、Persona、AI 角色模板）

## 目标与最终决策

- **覆盖 5 类内容**：Character（角色）、Companion（AI 角色）、WorldBook（世界书）、PromptPreset（预设）、UserPersona（Persona）。
- **共享主体固定**：共享内容库只由项目内置管理员账号维护；普通成员和非内容库所有者不能发布共享内容。
- **共享形态固定为“只读模板库”**：内置管理员在自己拥有的内容上开启“共享给成员”，成员只能查看共享主数据和“复制到我的账号”。
- **禁止跨账号直接使用**：成员不能把管理员共享主数据直接绑定到 Conversation、Companion、WorldBook 或 Prompt，也不能直接使用共享 Companion 聊天。
- **复制即创建成员数据**：复制成功后产生新的 ID 和成员自己的 `userId`；从此所有读取、编辑、删除、聊天、Prompt 注入、备份恢复都只操作成员副本。
- **一次性快照，不持续同步**：成员副本与管理员主数据只在复制创建瞬间一致；之后管理员修改、取消共享、删除主数据或修改敏感标记，都不影响已有成员副本。
- **敏感标记随内容复制**：`isSensitive` 在复制瞬间保持一致，复制后与其它业务字段一样独立维护。

## 当前代码事实（已核查）

- 业务实体按 `userId` 归属；现有 list、`findOwned*`、resolve、聊天和 Prompt 路径默认按 `currentUser.id` 隔离。
- `x-tavern-act-as` 是管理员代成员执行请求的后端通道，不属于共享内容库能力，本方案不接入前端切换器。
- 模型供应商、供应商模型和模型链已有全站共享机制；`modelFallbackGroupId` 可继续复用，不纳入内容复制。
- Character、WorldBook、PromptPreset、UserPersona 已有 `isSensitive`；Companion 当前缺少该字段，需要补齐。
- `WorldBook.characterLinks` 为空的语义是“当前 `userId` 下的全局世界书”，只会作用于该用户的全部角色，不是全站全局。
- `CompanionMessage`、`CompanionMemory`、`CompanionMemoryRevision` 都按 `Companion.id` 形成唯一关系线程，不能从管理员主数据复制到成员关系线程。
- Character / Companion 头像由 Asset 和 uploads 文件共同组成；要形成真正独立的成员副本，不能只复用管理员的 `avatarAssetId`。

## 核心数据语义

### 管理员共享主数据

- `userId` 始终是内置管理员 ID。
- `isShared=true` 只表示“出现在成员共享库中”，不表示允许跨账号引用或使用。
- 成员只能查看详情和发起复制，不能编辑、删除、设为默认、绑定、聊天、导出为成员数据或通过业务接口直接使用。
- 管理员修改共享主数据后，共享库详情显示新版，但已经创建的成员副本不更新。
- 管理员设置 `isShared=false` 后，只阻止新的查看和复制；已有成员副本不受影响。

### 成员副本

- 使用新 ID，`userId=currentUser.id`，`isShared=false`，`deletedAt=null`。
- 复制业务内容、metadata 和 `isSensitive` 的当前值。
- `createdAt` / `updatedAt` 使用副本创建时间，不伪装成主数据原始时间。
- 复制完成后视为普通成员私有数据，沿用所有现有 CRUD、聊天、Prompt、敏感过滤和备份恢复路径。
- 后续主数据与成员副本之间没有同步、回写、级联更新或级联删除。

### 所有权硬边界

- Conversation 的 Character / PromptPreset / UserPersona resolve 继续只接受 `userId=currentUser.id`。
- Companion 的 avatar / PromptPreset / UserPersona 引用继续只接受成员自己的资源；全站共享模型链除外。
- WorldBook 绑定角色继续只接受成员自己的 Character。
- `WorldBooksService.listPromptContexts()` 继续只查询 `userId=currentUser.id`，绝不读取管理员共享主数据。
- Chat、Prompt Preview、Companion Chat、Companion Memory 和消息操作不增加“自己或共享”的分支。
- 即使成员伪造共享主数据 ID 调接口，后端也必须返回现有 not found / reference not found 错误。

---

## 实施计划

### Phase A — 数据模型、迁移与发布权限

#### A1. Prisma schema

为以下 5 个模型增加：

```prisma
isShared Boolean @default(false)
@@index([isShared])
```

- `Character`
- `Companion`
- `WorldBook`
- `PromptPreset`
- `UserPersona`

同时给 Companion 增加：

```prisma
isSensitive Boolean @default(false)
@@index([userId, isSensitive])
```

`isShared` 是发布状态，不写入模块 JSON 导入导出格式；普通导入、内容包导入和成员副本一律落为 `false`。

#### A2. Migration

- 生成 `add_shared_content_library` migration。
- SQLite 存量记录全部使用默认值 `isShared=false`；Companion 存量记录使用 `isSensitive=false`。
- 核对 migration 只增加字段和索引，不手工修改 SQLite。

#### A3. 固定内容库所有者

- 在 UsersService 增加明确的内容库所有者解析方法，例如 `getContentLibraryOwner()`；语义与全站共享模型 owner 类似，但职责独立。
- 内容库 owner 必须是配置中的内置管理员账号，不以任意 `role==='admin'` 代替。
- 只有内容库 owner 能把自己的记录设为 `isShared=true/false`。
- 非内容库 owner 传 `isShared` 必须返回 403 和稳定错误码，不能静默忽略。
- 普通成员 create / import / fork 产生的数据 `isShared` 恒为 false。

### Phase B — 共享库可见性与只读详情

#### B1. 查询范围显式分离

五类 list API 增加显式范围参数，建议统一为：

```text
scope=owned    # 默认，只返回当前用户数据
scope=library  # 只返回内置管理员已共享主数据
```

约束：

- 默认必须是 `owned`，确保现有会话、Companion、世界书等选择器行为不变。
- `scope=library` 查询固定内容库 owner 的 `userId + isShared=true + deletedAt=null`。
- 两种范围都继续复用 `showSensitiveContent` 后端过滤。
- 不使用“自己 OR isShared”混合默认列表，避免共享主数据进入现有业务选择器。

#### B2. 只读详情

- 五类 GET 详情允许成员读取当前可见的共享主数据，供共享库预览。
- update、delete、setDefault、entry CRUD、聊天、Prompt Preview 等写入或使用路径继续走严格 `findOwned*`。
- WorldBook 详情可以展示 entries，但成员不能直接新增、编辑或删除管理员 entries。
- Companion 详情不返回消息、长期记忆正文或记忆版本；共享的是 Companion 模板，不是管理员关系数据。

#### B3. 响应字段

五类响应增加：

- `isShared: boolean`
- `isOwner: boolean`
- `ownerName?: string`
- `canFork: boolean`

共享库响应中的 `ownerName` 固定来自内容库 owner。查询时 include / 批量读取 User，避免 N+1。

### Phase C — 五类内容复制

#### C1. Fork API

为五类资源增加复制端点：

```text
POST /api/characters/:id/fork
POST /api/companions/:id/fork
POST /api/world-books/:id/fork
POST /api/presets/:id/fork
POST /api/personas/:id/fork
```

统一校验：

- 源记录属于固定内容库 owner。
- `isShared=true`、`deletedAt=null`。
- 当前成员的敏感内容设置允许查看该源记录。
- 目标记录永远写入当前成员，不能由请求体指定 `userId`。
- fork 端点不接受把副本再次设为共享。
- 复制成功后返回新成员记录；源记录不发生任何更新。

#### C2. PromptPreset

复制：

- name / description / systemPrompt / outputRules
- parametersJson / metadataJson
- isSensitive

强制：

- `userId=me`
- `isShared=false`
- `isDefault=false`
- 使用 `createAvailableName` 处理成员同名冲突。

#### C3. UserPersona

复制：

- name / content / metadataJson
- isSensitive

强制：

- `userId=me`
- `isShared=false`
- `isDefault=false`
- 使用 `createAvailableName` 处理成员同名冲突。

#### C4. Character

复制：

- name / description / personality / scenario / firstMessage
- exampleMessagesJson / metadataJson
- isSensitive

强制：

- `userId=me`
- `isShared=false`
- `isArchived=false`
- 创建新的头像 Asset 记录，并复制对应 uploads 文件；新 Character 绑定成员 Asset。
- 若源头像为空则副本头像为空；文件复制失败时不能留下指向管理员 Asset 的半成品副本。

Character 复制不自动复制关联 WorldBook；WorldBook 是独立共享类型，由成员单独选择复制。

#### C5. WorldBook

事务内复制 WorldBook 主表和全部未删除 entries：

- name / description / scanDepth / tokenBudget / metadataJson
- isEnabled / isSensitive
- entries 的正文、关键词、位置、优先级、预算和 metadata
- `userId=me`
- `isShared=false`

角色绑定规则：

- 源 `characterIds=[]`：副本继续不关联角色，表示成员明确复制了一本对自己全部角色生效的全局世界书。
- 源绑定管理员 Character：fork 请求必须提供 `targetCharacterId`，并校验它属于当前成员；副本绑定该成员 Character。
- 禁止把管理员的角色关联 ID 原样写入成员副本。

#### C6. Companion

Companion fork 必须在一个业务操作中创建完整、可直接使用的成员模板快照：

- 复制 name / identityPrompt / isSensitive。
- 复制头像 Asset 记录和 uploads 文件，绑定成员 Asset。
- `modelFallbackGroupId` 可复用全站共享模型链 ID。
- 创建新的空 CompanionMemory，默认沿用当前 create 语义。
- 不复制 CompanionMessage、CompanionMemory 内容、CompanionMemoryRevision、重试状态或最后总结位置。

Persona / PromptPreset 依赖：

- 成员不能引用管理员 Persona / PromptPreset，因此不能保留源 ID。
- 若源 Companion 有 Persona / PromptPreset，fork 时将其当前内容作为 Companion 依赖一起复制成成员私有副本，再把新 Companion 绑定到新 ID。
- 依赖副本 `isDefault=false`、`isShared=false`、`isSensitive` 保持复制瞬间一致，并处理同名冲突。
- 管理员发布 Companion 即代表允许其当前 Persona / PromptPreset 配置作为 Companion 模板组成被复制；前端复制确认信息中需明确提示。
- Companion、依赖副本、Memory 和数据库侧 Asset 记录在同一数据库事务中创建；文件复制失败时执行补偿清理，不能留下不可用半成品。

### Phase D — Companion 敏感内容闭环

新增 `Companion.isSensitive` 后，敏感过滤不能只改列表：

- Companion create / import 默认 `isSensitive=false`，编辑允许用户维护该字段。
- `CompanionsService` owned list、library list、getById 都执行 `showSensitiveContent` 过滤。
- Companion Chat、Prompt Preview、Messages、Memory 等通过 ID 访问的路径同样执行成员自己的敏感设置，避免绕过列表直接访问。
- 共享 Companion 在成员关闭敏感内容时不可见、不可预览、不可 fork。
- fork 后的成员 Companion 沿用普通敏感 Companion 的全部后端边界。

### Phase E — 前端

#### E1. 类型、API 和 Store

- 五类 Response 增加 `isShared`、`isOwner`、`ownerName?`、`canFork`。
- owner 创建 / 更新 Payload 增加可选 `isShared`；普通成员表单不发送该字段。
- 五类 API 增加 `scope=owned|library` 查询和 fork 方法。
- WorldBook fork 支持条件必填的 `targetCharacterId`。
- 五个 Pinia store 分开维护 owned items 和 library items，避免共享数据混入现有选择器状态。

#### E2. 列表与共享库

- 五类管理页面增加“我的内容 / 共享库”分区或 Tab。
- “我的内容”保持现有编辑、删除、设默认、选择和使用行为。
- “共享库”卡片显示“管理员共享”、敏感标记、ownerName，只提供“查看详情”和“复制到我的账号”。
- 共享库详情隐藏编辑、删除、设默认、聊天、Prompt Preview、entry 编辑等操作。
- Character / Preset / Persona 的会话选择器、Companion 配置选择器和 WorldBook 角色选择器只消费 owned 数据。

#### E3. 内置管理员发布入口

- 仅内容库 owner 的自有内容显示“共享给成员”开关。
- 普通成员和其它账号不显示发布开关。
- 关闭共享只影响共享库可见性，不提示会影响已有成员副本。

#### E4. 复制交互

- 普通资源点击复制后显示“已复制到我的账号”，刷新 owned 列表并定位新记录。
- 绑定角色的 WorldBook 在复制前弹出成员角色选择，未选择不能提交。
- Companion 复制确认中说明：会复制当前角色设定、头像、Persona 和预设；不会复制管理员消息或长期记忆。
- 复制成功后成员可进入自己的编辑页或 Companion 私人聊天页。

### Phase F — 文档与验证

#### F1. 文档同步

- 更新 `AGENTS.md` §8：补充 `isShared` 只表示模板库发布状态，不允许跨用户引用。
- 更新 `AGENTS.md` §17：Companion 共享仅允许复制模板；每个成员副本拥有新的消息和长期记忆线程。
- 更新 Characters、Companions、WorldBooks、Presets/Personas API 文档，补充 `scope`、fork 请求和响应。
- 明确模块 JSON 导入导出不携带 `isShared`，避免通过文件把发布权限带入其它账号。

#### F2. 最小但必要的自动验证

后端至少覆盖：

1. 成员可列出和查看可见共享主数据。
2. 成员不能 update / delete / setDefault / 直接使用共享主数据。
3. 伪造共享 Character / Preset / Persona ID 创建会话被拒绝。
4. 共享 WorldBook 不进入成员 `listPromptContexts()`；复制后才按成员副本规则进入。
5. fork 复制瞬间业务字段和 `isSensitive` 一致，ID / userId / isShared / isDefault 正确重置。
6. 管理员后续修改、取消共享或软删除主数据，不影响成员副本。
7. Character / Companion 头像产生独立 Asset 和文件。
8. 绑定角色的 WorldBook 必须映射到成员 Character。
9. Companion fork 复制依赖配置但不复制消息、记忆和记忆版本。
10. 关闭敏感内容时，共享敏感内容不可见、不可 fork；成员敏感副本不可通过 ID 绕过过滤。

验证命令按实际脚本选择：

- `prisma validate`
- server / shared / web typecheck
- 共享内容库相关定向测试
- 必要时执行 Prompt Builder 验证脚本，确认共享主 WorldBook 从未进入成员 Prompt

不以只做页面手工点击作为验收完成条件。

---

## 最终用户行为

| 操作                   | 结果                                                 |
| ---------------------- | ---------------------------------------------------- |
| 内置管理员开启共享     | 主数据出现在成员共享库，只能查看和复制               |
| 成员查看共享项         | 读取管理员主数据详情，不产生成员数据，不允许直接使用 |
| 成员复制               | 创建当前内容快照的成员私有副本，之后可正常编辑和使用 |
| 管理员修改共享主数据   | 共享库展示新版；已有成员副本不变                     |
| 管理员关闭共享         | 不再允许新的查看和复制；已有成员副本不变             |
| 管理员软删除主数据     | 主数据从共享库消失；已有成员副本不变                 |
| 管理员修改敏感标记     | 只影响主数据；已有成员副本的敏感标记不变             |
| 成员编辑或删除副本     | 只操作成员数据，不回写管理员主数据                   |
| 成员复制 Companion     | 得到相同初始模板和全新的私人消息/长期记忆线程        |
| 成员复制全局 WorldBook | 生成成员自己的全局世界书，之后只作用于该成员的角色   |

## 风险与实现注意项

1. **文件与数据库事务不是同一事务**：Character / Companion 头像复制需设计临时文件或补偿清理，避免 DB 回滚后残留文件、文件失败后残留副本。
2. **WorldBook 角色关系不能原样复制**：管理员 Character ID 绝不能进入成员 WorldBook，绑定型复制必须显式选择成员角色。
3. **Companion 是组合复制**：Persona / PromptPreset 属于 Companion 当前行为的一部分，缺少依赖复制会导致副本与预览不一致。
4. **默认状态不是内容快照**：PromptPreset / UserPersona 副本固定 `isDefault=false`，避免复制动作改变成员账号默认项。
5. **当前逻辑备份未覆盖 Companion 域**：这属于现有备份能力缺口；共享库实现不得声称 Companion 副本已被现有应用备份覆盖，后续应单独补 Companion 备份恢复。

## 不在范围内

- 共享主数据跨账号直接使用。
- 管理员主数据与成员副本持续同步。
- 成员修改回写管理员主数据。
- `x-tavern-act-as` 前端账号切换器。
- ModelProvider / ProviderModel / ModelFallbackGroup 复制。
- Companion 消息、长期记忆或关系状态复制。
- 通过模块 JSON 导入导出传播 `isShared` 发布状态。
