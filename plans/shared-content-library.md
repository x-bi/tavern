# 共享内容库（管理账号推送角色/世界书/预设/Persona/AI角色到其他账号）

## 目标与已确认决策

- **覆盖 5 类**：Character（角色）、Companion（AI角色）、WorldBook（世界书）、PromptPreset（预设）、UserPersona（persona）。
- **形态**：共享库模式——admin 在自己拥有的项上开启"共享给其他账号"开关；其他账号在自己的列表里看到这些共享项（只读，带"管理员共享"标记），**可直接选用**（Companion 除外），并可"复制到我的账号"（fork）得到可编辑独立副本。
- **单一数据源**：共享项不被复制到成员账号；admin 修改后所有账号自动看到新版。fork 出的副本才是成员私有的独立数据。

## 当前状态结论（已核查）

- 所有业务实体按 `userId` 归属；service 的 list / `findOwned*` / resolve 方法均按 `currentUser.id` 过滤。admin 在 UI 上**看不到**其他成员的内容数据（前端未接 `x-tavern-act-as` 头）。
- 数据靠每条记录的 `userId` 区分归属；账号名↔id 由 `users.service.listForAdmin()` 提供。
- `x-tavern-act-as` 后端通道存在但前端未接线，且语义是"代某成员身份操作"，非本功能所需。
- 模型配置已有"全站共享"先例（`shared-models.guard.ts` + `getSharedModelOwner`），但模式不同（全局归属 admin），本功能采用**按项 isShared 标记**。
- `modelFallbackGroupId` 在 conversations/companions 创建时**已不校验归属**——模型链天然跨账号可用，本功能无需改它。

## 关键设计约束（简化了方案）

1. **软删除 + 现有引用走 FK include**：成员会话引用 admin 共享项后，chat 时通过 `conversation.include` 读 character/preset/persona，**不重新 gate 归属**。因此 admin 取消共享或软删除共享项时，**已存在的成员会话不会中断**（数据仍在 DB），只是新建会话无法再选该项。→ **无需跨用户引用阻断**，行为天然优雅。
2. **Companion 不开放直接聊天**：`CompanionMessage` 无 userId、按 `companionId` 归属，直接聊天会让多成员共用同一消息线程。故 Companion 共享 = 可见 + fork，**不放松 `companion-chat.findOwned`**。要用必须 fork。
3. **头像跨用户访问无障碍**：`main.ts` 静态映射 `/uploads/` 无 AuthGuard，共享 Character/Companion 的头像（avatarAssetId 指向 admin 的 Asset）成员可直接访问图片。fork 时**复用 assetId 引用**（不复制文件，MVP 简化；边界：admin 删除该 Asset 会影响 fork 副本头像，列为 TODO）。
4. **Companion 缺 `isSensitive` 字段**：与其余 4 类不一致。共享前补齐 `isSensitive`，使敏感过滤统一。
5. **fork 命名冲突**：PromptPreset/UserPersona 有 `@@unique([userId,name])`，fork 时用现成 `createAvailableName`（`common/module-json-import.ts:208`）改名；Character/Companion/WorldBook 无 name 唯一约束，原样复制。

---

## 实施计划（分阶段，可按 A→F 顺序落地）

### Phase A — 数据模型与共享标记

**A1. Prisma schema（`prisma/schema.prisma`）**
为 5 个模型加 `isShared Boolean @default(false)` 与索引 `@@index([isShared])`：
- `Character`、`WorldBook`、`PromptPreset`、`UserPersona`、`Companion`
- 额外：给 `Companion` 补 `isSensitive Boolean @default(false)` + `@@index([userId, isSensitive])`（与其它实体对齐，使敏感过滤统一；非共享 Companion 也获得敏感标记能力，与最近修复的"敏感内容设置"一致）。

**A2. Migration**
新增 `prisma/migrations/20260717120000_add_shared_content_library/migration.sql`（`prisma migrate dev --name add_shared_content_library` 生成后核对）。SQLite 仅 `ALTER TABLE ... ADD COLUMN`，默认 false，不影响存量数据。

**A3. 共享开关归属约束**
- `isShared=true` 仅 admin 可设置（service 内 `role==='admin'` 校验，非 admin 传 true 视为忽略或 403）。普通成员创建的项 `isShared` 恒为 false。
- admin 可对自己拥有的任意项开/关共享。

### Phase B — 列表可见性（"看到"）

**B1. 抽取共享可见性 where 工具**
在 `apps/server/src/common/` 新增 `shared-visibility.ts`：
```ts
// 返回 where 片段：自己拥有 OR 已共享
export function sharedOrOwnedWhere(userId: string) {
  return { OR: [{ userId }, { isShared: true }] };
}
```
统一 list 与 resolve 的可见性逻辑，避免散落。

**B2. 5 个 service 的 `list` 放宽 where**
将 `userId: currentUser.id` 替换为 `sharedOrOwnedWhere(currentUser.id)`，保留 `deletedAt:null` 与敏感过滤（`...(showSensitiveContent ? {} : { isSensitive:false })`，Companion 现在也有 isSensitive）：
- `characters.service.ts:67` / `world-books.service.ts:116` / `personas.service.ts:75` / `presets.service.ts:89` / `companions.service.ts:30`

**B3. `toResponse` 输出共享标记**
5 个 service 的 `toResponse` 增加返回字段：
- `isShared: boolean`、`isOwner: boolean`（`item.userId === currentUser.id`，前端据此区分"我的/共享的"）、`ownerName?: string`（共享时附带 admin 显示名，前端展示"管理员共享"）。`ownerName` 由 list 时批量查 `User` 补齐，避免 N+1。

### Phase C — Fork 复制（"可复制"）

**C1. 5 个 fork 端点**（`POST /xxx/:id/fork`）
- `characters.controller` / `companions.controller` / `world-books.controller` / `presets.controller` / `personas.controller` 各加 `@Post(':id/fork')`。
- service 加 `fork(currentUser, id)`：先校验源项对当前用户可见（`sharedOrOwnedWhere` + 未删 + 敏感过滤），再复制。

**C2. 各实体 fork 复制范围**
- **PromptPreset / UserPersona**：复制全部业务字段，`userId=me`、`isShared=false`、`isDefault=false`（fork 不抢默认）；用 `createAvailableName` 处理同名 P2002。
- **Character**：复制 name/description/personality/scenario/firstMessage/exampleMessagesJson/metadataJson/isSensitive/isArchived；`avatarAssetId` 复用源引用（见约束 3）；`userId=me`、`isShared=false`。
- **WorldBook**：事务内建主表（`characterId=null`——fork 后为全局，成员可自行重绑）+ `createMany` 全部 entries（参考 `world-books.service.ts:268` importJson 写法）；`userId=me`、`isShared=false`。
- **Companion**：复制 name/identityPrompt；`avatarAssetId`、`modelFallbackGroupId` 复用引用；`promptPresetId`/`personaId` 置 null（成员需自行选自己的）；**不复制 memory/messages**（`create` 自动建空 `CompanionMemory`，符合约束）；`userId=me`、`isShared=false`。

**C3. fork 响应**
返回 fork 后的新记录（同 `toResponse`），前端刷新列表并提示"已复制到我的账号"。

### Phase D — 直接选用（"使用"，放松归属校验）

放松 resolve/校验路径，接受"自己 OR isShared=true"。仅对 Character/WorldBook/PromptPreset/UserPersona 放松（Companion 不放松，见约束 2）。

**D1. conversations.service（`conversations.service.ts`）**
- `resolveCharacterId`（:351）：where 改 `OR:[{userId:me},{isShared:true}]`，保留敏感过滤。
- `resolvePromptPresetId`（:416）、`resolvePersonaId`（:455）：同上。
- `resolveModelFallbackGroupId`：本就不校验 userId，不动。

**D2. companions.service（`companions.service.ts:171 assertReferences`）**
- `promptPresetId`、`personaId` 校验改为 `OR:[{userId:me},{isShared:true}]`。
- `avatarAssetId`：assets 不共享，保持 `userId:me`。
- `modelFallbackGroupId`：本就不校验，不动。

**D3. world-books.service（`world-books.service.ts`）**
- `resolveCharacterId`（:811）：worldbook.characterId 可指向共享角色，where 改 `OR:[{userId:me},{isShared:true}]`。
- `listPromptContexts`（:168）：where 改 `OR:[{userId:me},{isShared:true}]`，使成员用共享角色聊天时能注入绑在该共享角色上的共享世界书 + 共享全局世界书（characterId=null 且 isShared=true）。

**D4. 不放松的点**
- `companion-chat.service findOwned`（:280）：保持 `userId:me`，共享 Companion 仅 fork 后可用。
- 各 service 的 `findOwned*`（update/delete 用）：**保持 `userId:me` 严格归属**，确保成员不能改/删 admin 的共享项（只读语义）。admin 改自己的共享项走自己的 `findOwned*`（userId=admin），正常工作。

### Phase E — 前端

**E1. shared 类型（`packages/shared/src/*.ts`）**
5 个 `XxxResponse` 加 `isShared`、`isOwner`、`ownerName?`；`XxxPayload` 加可选 `isShared?`。

**E2. API 封装（`apps/web/src/api/*.ts`）**
5 个文件各加 `forkXxx(id)`；payload 类型加 `isShared`。

**E3. Pinia store（`apps/web/src/stores/*.ts`）**
5 个 store 加 `forkXxx` action（fork 后 `loadXxx()` 刷新）。

**E4. 视图（`apps/web/src/views/**`）**
- 列表卡片：共享且非自己拥有的项显示 `[管理员共享]` tag、**隐藏编辑/删除按钮**、显示 `[复制到我的账号]` 按钮（调 `forkXxx`）。
- admin 自己的项：在编辑表单/卡片操作区加"共享给其他账号"开关（`n-switch`，绑定 `isShared`，仅 `user.role==='admin'` 可见；普通成员不显示）。
- 选用下拉（会话/Companion 创建时的角色/预设/persona 选择器）：无需改动，列表已包含共享项，直接可选。

**E5. 角色判断**
前端用 `useAuthStore`/sessionStorage 的 `AuthUser.role==='admin'` 控制开关显隐（参考 router `requiresAdmin` 模式）。

### Phase F — 迁移、文档与验证

- **F1.** `prisma migrate dev` 生成并核对 migration；seed 不需改（无真实数据）。
- **F2.** 更新 `AGENTS.md` §8（实体清单补 `isShared` 语义）与 §17（Companion 共享边界说明：fork-only，不开放直接聊天）。
- **F3.** 轻量验证：admin 开共享→成员列表可见→成员直接选用建会话可聊天→成员 fork 得到可编辑副本→admin 改共享项成员看到新版。不跑全量构建/测试（遵守 gate 验证约束）。

---

## 行为与边界说明（写入 AGENTS.md / 用户可见）

| 操作 | 对成员的影响 |
|---|---|
| admin 开启共享 | 成员列表出现该项（只读），可直接选用（Companion 需 fork） |
| admin 修改共享项 | 成员自动看到新版（单一数据源） |
| admin 关闭共享 | 成员**新建**会话无法再选该项；**已存在**会话继续可用（不中断） |
| admin 软删除共享项 | 同上；数据未物理清除，已存在引用继续工作 |
| 成员 fork | 得到私有可编辑副本，与源解耦；源后续修改不影响副本 |
| 成员对共享项 | 只读，不能编辑/删除（后端 `findOwned*` 严格 `userId` 校验） |

## 风险与 TODO

1. **头像引用复用**：fork Character/Companion 复用源 avatarAssetId。若 admin 删除该 Asset 文件，fork 副本头像失效。后续可加 fork 时复制 Asset 文件。
2. **Companion 直接聊天未开放**：共享 Companion 仅 fork 可用（避免共用消息线程）。若未来要"共享但各自独立线程"，需重构 CompanionMessage 增加 userId 隔离，属较大改动。
3. **共享项被物理删除**：项目仅软删除；若引入硬删除清理，需注意 `Character.onDelete:Cascade` 会级联删成员会话——硬删除前应校验跨用户引用。
4. **敏感内容**：共享项 isSensitive=true 时，未开敏感的成员列表中不可见（复用现有过滤）。

## 不在范围内

- `x-tavern-act-as` 前端切换器（与本功能正交，另案）。
- ModelProvider/ModelFallbackGroup 共享（已天然全站共享，无需改）。
- 跨用户引用硬阻断（软删除机制下不必要）。
