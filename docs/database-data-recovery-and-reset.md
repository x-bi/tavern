# 数据库删除恢复与数据清理手册

本文面向 Tavern Lite 的 SQLite 服务器数据库，整理各模块的删除行为、恢复方法，以及“清空全部业务数据但保留管理员账号”的操作步骤。

当前 Docker 部署的数据库位置：

- 宿主机：项目目录下 `data/tavern-lite.db`，默认绝对路径为 `/opt/tavern/data/tavern-lite.db`。
- `server` 容器内：`/app/data/tavern-lite.db`。
- Prisma schema：`prisma/schema.prisma`。

本文 SQL 以当前 schema 和后端删除实现为准。数据库结构变更后，应同步复核本文中的表名、字段和清理顺序。

## 1. 操作前约束

### 1.1 必须先停后端并备份

不要在 `server` 容器仍写入 SQLite 时直接编辑数据库。

```bash
cd /opt/tavern

docker compose stop server

tar -czf ../tavern-before-db-operation-$(date +%Y%m%d-%H%M%S).tar.gz data uploads
```

备份必须同时包含：

- `data/`：SQLite 主库及可能存在的 `-wal`、`-shm` 文件。
- `uploads/`：角色头像、AI 角色头像及其他上传文件。

### 1.2 执行 SQL 的两种方法

方法一：使用宿主机的 `sqlite3` 或 SQLite GUI 工具打开：

```bash
sqlite3 data/tavern-lite.db
```

进入后建议先执行：

```sql
PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
```

方法二：把 SQL 保存为服务器上的文件，例如 `/opt/tavern/restore.sql`，通过项目已有 Prisma CLI 执行：

```bash
cd /opt/tavern

docker compose run --rm -T --no-deps \
  --entrypoint pnpm \
  server exec prisma db execute \
  --schema prisma/schema.prisma \
  --stdin < /opt/tavern/restore.sql
```

`prisma db execute` 适合执行 `UPDATE` / `DELETE`，但不会展示 `SELECT` 结果。需要先查询 ID、名称和删除时间时，使用 `sqlite3` 或 SQLite GUI。

### 1.3 占位符规则

本文 SQL 中的以下内容必须替换为服务器真实值：

- `目标ID`：对应记录的 `id`。
- `会话ID`：`Conversation.id`。
- `AI角色ID`：`Companion.id`。
- `世界书ID`：`WorldBook.id`。
- `管理员用户名`：服务器 `.env` 中 `AUTH_PRESET_USERS_JSON` 第一个内置管理员的 `username`。

恢复前先用 `SELECT` 确认目标，不要对整表直接执行无 `WHERE` 的 `UPDATE`。

## 2. 各模块删除行为总览

| 模块 | 表 | 当前删除行为 | 主要删除标识 | 是否可直接恢复 |
| --- | --- | --- | --- | --- |
| 成员管理 | `User` | 软删除并停用账号 | `deletedAt`、`isActive=0` | 可以 |
| 酒馆角色 | `Character` | 软删除并归档 | `deletedAt`、`isArchived=1` | 可以 |
| 模型供应商 | `ModelProvider` | 软删除、停用、取消默认、名称加删除后缀 | `deletedAt`、`isEnabled=0`、`name` | 可以，需恢复名称 |
| 供应商模型 | `ProviderModel` | 软删除、停用、名称及模型标识加删除后缀 | `deletedAt`、`isEnabled=0`、`name`、`model` | 可以，需恢复名称和模型标识 |
| 模型链 | `ModelFallbackGroup` | 软删除、停用、取消默认、名称加删除后缀 | `deletedAt`、`isEnabled=0`、`name` | 可以，需恢复名称 |
| 模型链候选项 | `ModelFallbackCandidate` | 更新模型链时物理删除旧候选项并重建 | 无软删除字段 | 只能从备份恢复或手工重建 |
| Prompt 预设 | `PromptPreset` | 软删除、取消默认、名称加删除后缀 | `deletedAt`、`isDefault=0`、`name` | 可以，需恢复名称 |
| Persona | `UserPersona` | 软删除、取消默认、名称加删除后缀 | `deletedAt`、`isDefault=0`、`name` | 可以，需恢复名称 |
| 酒馆会话 | `Conversation` | 会话软删除并归档，同时软删除其未删除消息 | `deletedAt`、`status='archived'` | 可以，需同时处理消息 |
| 酒馆消息 | `Message` | 单条删除会写 `status='deleted'`；清空会话只写 `deletedAt` | `deletedAt`、部分场景含 `status='deleted'` | 可以，需区分删除来源 |
| 世界书 | `WorldBook` | 世界书软删除并停用，同时软删除、停用其未删除条目 | `deletedAt`、`isEnabled=0` | 可以，需同时处理条目 |
| 世界书条目 | `WorldBookEntry` | 软删除并停用 | `deletedAt`、`isEnabled=0` | 可以 |
| 世界书角色关联 | `WorldBookCharacter` | 修改绑定角色时物理删除旧关联并重建 | 无软删除字段 | 只能手工重建或从备份恢复 |
| 素材 | `Asset` | schema 支持软删除，但当前没有独立公开删除入口 | `deletedAt` | 数据行可恢复，文件必须仍存在 |
| 应用设置 | `AppSetting` | 无软删除字段，通常为 upsert；备份覆盖时可能物理删除 | 无 | 只能重新设置或从备份恢复 |
| AI 角色 | `Companion` | 只软删除角色；消息、记忆和分享行保留 | `deletedAt` | 可以 |
| AI 角色消息 | `CompanionMessage` | 软删除并可能把长期记忆标记为需重建 | `deletedAt`、`status='deleted'` | 消息可恢复，记忆需刷新 |
| AI 长期记忆 | `CompanionMemory` | “清空记忆”会重置正文和检查点 | 没有 `deletedAt` | 不能按软删除恢复 |
| AI 记忆版本 | `CompanionMemoryRevision` | 清空记忆会物理删除全部版本；正常写入只保留最近 10 个版本 | 无软删除字段 | 只能从数据库备份恢复 |
| 分享链接 | `ShareLink` | 撤销而非删除 | `status='revoked'`、`revokedAt` | 可以，但要检查是否过期或已生成替代链接 |
| 备份导入 | 多表 | 覆盖导入会物理删除目标范围数据再重建 | 无统一软删除标识 | 只能从导入前备份恢复 |

## 3. 查询已删除数据

### 3.1 用户、角色和 AI 角色

```sql
SELECT "id", "username", "displayName", "role", "isActive", "deletedAt"
FROM "User"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "userId", "name", "isArchived", "deletedAt"
FROM "Character"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "userId", "name", "deletedAt"
FROM "Companion"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;
```

### 3.2 酒馆会话和消息

```sql
SELECT "id", "userId", "title", "status", "deletedAt"
FROM "Conversation"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "conversationId", "role", "status", "createdAt", "deletedAt"
FROM "Message"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC, "createdAt" ASC;
```

### 3.3 AI 角色消息

```sql
SELECT "id", "companionId", "role", "status", "createdAt", "deletedAt"
FROM "CompanionMessage"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC, "createdAt" ASC;
```

### 3.4 模型、预设和 Persona

```sql
SELECT "id", "name", "isEnabled", "isDefault", "deletedAt"
FROM "ModelProvider"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "providerId", "name", "model", "isEnabled", "deletedAt"
FROM "ProviderModel"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "name", "isEnabled", "isDefault", "deletedAt"
FROM "ModelFallbackGroup"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "userId", "name", "isDefault", "deletedAt"
FROM "PromptPreset"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "userId", "name", "isDefault", "deletedAt"
FROM "UserPersona"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;
```

### 3.5 世界书、素材和分享

```sql
SELECT "id", "userId", "name", "isEnabled", "deletedAt"
FROM "WorldBook"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "worldBookId", "title", "isEnabled", "deletedAt"
FROM "WorldBookEntry"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "userId", "kind", "fileName", "storagePath", "deletedAt"
FROM "Asset"
WHERE "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC;

SELECT "id", "ownerUserId", "targetType", "conversationId", "companionId",
       "status", "expiresAt", "revokedAt"
FROM "ShareLink"
WHERE "status" = 'revoked'
ORDER BY "revokedAt" DESC;
```

## 4. 各模块恢复 SQL

所有恢复操作建议放在事务中执行。执行前先查询目标记录，并把 `目标ID` 替换成真实 ID。

### 4.1 恢复成员账号

```sql
BEGIN IMMEDIATE;

UPDATE "User"
SET "isActive" = 1,
    "deletedAt" = NULL
WHERE "id" = '目标ID';

COMMIT;
```

注意：`AUTH_PRESET_USERS_JSON` 中的账号在任意用户登录时会被同步为启用状态。数据库手工停用或删除预置账号，不等于永久移除预置账号。

### 4.2 恢复酒馆角色

```sql
BEGIN IMMEDIATE;

UPDATE "Character"
SET "isArchived" = 0,
    "deletedAt" = NULL
WHERE "id" = '目标ID';

COMMIT;
```

软删除角色不会物理删除其会话。角色恢复后，原会话是否显示仍取决于 `Conversation.deletedAt` 和 `Conversation.status`。

### 4.3 恢复 AI 角色

```sql
BEGIN IMMEDIATE;

UPDATE "Companion"
SET "deletedAt" = NULL
WHERE "id" = 'AI角色ID';

COMMIT;
```

AI 角色软删除时，其 `CompanionMessage`、`CompanionMemory`、`CompanionMemoryRevision` 和 `ShareLink` 不会被同步删除。恢复 AI 角色后，这些数据会重新具备访问条件；分享链接仍需满足 `status='active'` 且未过期。

### 4.4 恢复整个酒馆会话

删除会话时：

- `Conversation.status` 改为 `archived`。
- `Conversation.deletedAt` 写入删除时间。
- 当时尚未删除的 `Message` 写入同一次删除时间，但消息原 `status` 不变。

优先按会话删除时间恢复消息，避免复活更早单独删除的消息：

```sql
BEGIN IMMEDIATE;

UPDATE "Message"
SET "deletedAt" = NULL
WHERE "conversationId" = '会话ID'
  AND "deletedAt" = (
    SELECT "deletedAt"
    FROM "Conversation"
    WHERE "id" = '会话ID'
  );

UPDATE "Conversation"
SET "status" = 'active',
    "deletedAt" = NULL,
    "lastMessageAt" = (
      SELECT MAX("createdAt")
      FROM "Message"
      WHERE "conversationId" = '会话ID'
        AND "deletedAt" IS NULL
    )
WHERE "id" = '会话ID';

COMMIT;
```

如果数据库中会话和级联消息的删除时间并不完全相同，先查询本次操作产生的消息 ID，再用明确 ID 恢复，不要直接恢复该会话下所有历史软删除消息。

### 4.5 恢复“清空会话消息”产生的数据

清空会话不会删除 `Conversation`，只会：

- 把当时未删除消息的 `deletedAt` 写入同一时间。
- 把 `Conversation.lastMessageAt` 清空。
- 不把消息 `status` 改为 `deleted`。

先查询并确认清空操作对应的 `deletedAt`：

```sql
SELECT "deletedAt", COUNT(*) AS "messageCount"
FROM "Message"
WHERE "conversationId" = '会话ID'
  AND "deletedAt" IS NOT NULL
GROUP BY "deletedAt"
ORDER BY "deletedAt" DESC;
```

再恢复指定批次：

```sql
BEGIN IMMEDIATE;

UPDATE "Message"
SET "deletedAt" = NULL
WHERE "conversationId" = '会话ID'
  AND "deletedAt" = '查询到的删除时间'
  AND "status" <> 'deleted';

UPDATE "Conversation"
SET "lastMessageAt" = (
  SELECT MAX("createdAt")
  FROM "Message"
  WHERE "conversationId" = '会话ID'
    AND "deletedAt" IS NULL
)
WHERE "id" = '会话ID';

COMMIT;
```

SQLite 中 Prisma `DateTime` 的实际展示可能是整数时间值，也可能由客户端格式化。应复制数据库查询返回的原始值，不要手工猜测时间格式。

### 4.6 恢复单条酒馆消息

普通删除会覆盖消息原状态。未编辑消息通常恢复为 `complete`；确认删除前是编辑态时恢复为 `edited`。

```sql
BEGIN IMMEDIATE;

UPDATE "Message"
SET "status" = 'complete',
    "deletedAt" = NULL
WHERE "id" = '目标ID';

UPDATE "Conversation"
SET "lastMessageAt" = (
  SELECT MAX("createdAt")
  FROM "Message"
  WHERE "conversationId" = "Conversation"."id"
    AND "deletedAt" IS NULL
)
WHERE "id" = (
  SELECT "conversationId"
  FROM "Message"
  WHERE "id" = '目标ID'
);

COMMIT;
```

重新生成 assistant 消息也会把旧消息写成 `status='deleted'`，并在新旧消息的 `metadataJson` 中记录 `regenerateOfMessageId` / `regeneratedByMessageId`。如果目标属于重新生成链，不应只恢复旧消息，否则页面可能同时出现新旧两个回答；应先决定保留哪一个分支，再同步处理另一条消息及双方 metadata。

### 4.7 恢复 AI 角色消息

```sql
BEGIN IMMEDIATE;

UPDATE "CompanionMessage"
SET "status" = 'complete',
    "deletedAt" = NULL
WHERE "id" = '目标ID';

UPDATE "CompanionMemory"
SET "status" = 'stale',
    "rebuildFromMessageId" = CASE
      WHEN "rebuildFromMessageId" IS NULL THEN '目标ID'
      WHEN (
        SELECT "createdAt"
        FROM "CompanionMessage"
        WHERE "id" = "CompanionMemory"."rebuildFromMessageId"
      ) <= (
        SELECT "createdAt"
        FROM "CompanionMessage"
        WHERE "id" = '目标ID'
      ) THEN "rebuildFromMessageId"
      ELSE '目标ID'
    END,
    "nextRetryAt" = NULL
WHERE "companionId" = (
  SELECT "companionId"
  FROM "CompanionMessage"
  WHERE "id" = '目标ID'
);

COMMIT;
```

如果消息删除前是编辑态，可把 `status` 改回 `edited`。上面的第二个 `UPDATE` 会把记忆标记为 `stale`，并保留现有检查点与本次恢复消息中位置更早的一项，避免漏掉更早已经等待重建的历史变更。恢复后应在 AI 角色记忆设置中执行一次“立即刷新”，对应接口为：

```text
POST /api/companions/{AI角色ID}/memory/refresh
```

重新生成链同样存在 `regenerateOfMessageId` / `regeneratedByMessageId`，不要无条件同时恢复旧回答和新回答。

### 4.8 恢复世界书

删除世界书会把世界书及其当时未删除条目一起软删除并停用。角色绑定关系 `WorldBookCharacter` 会保留。

先恢复世界书本体：

```sql
BEGIN IMMEDIATE;

UPDATE "WorldBook"
SET "isEnabled" = 1,
    "deletedAt" = NULL
WHERE "id" = '世界书ID';

COMMIT;
```

然后查询该世界书的软删除条目，按 ID 选择本次需要恢复的记录：

```sql
SELECT "id", "title", "isEnabled", "deletedAt"
FROM "WorldBookEntry"
WHERE "worldBookId" = '世界书ID'
  AND "deletedAt" IS NOT NULL
ORDER BY "deletedAt" DESC, "createdAt" ASC;
```

恢复明确条目：

```sql
BEGIN IMMEDIATE;

UPDATE "WorldBookEntry"
SET "isEnabled" = 1,
    "deletedAt" = NULL
WHERE "id" IN ('条目ID1', '条目ID2');

COMMIT;
```

删除世界书时会把所有活动条目的 `isEnabled` 改为 `0`，数据库无法自动判断某条记录在删除世界书前是否本来就处于停用状态。恢复后应在页面重新检查各条目的启用状态。

### 4.9 恢复单个世界书条目

```sql
BEGIN IMMEDIATE;

UPDATE "WorldBookEntry"
SET "isEnabled" = 1,
    "deletedAt" = NULL
WHERE "id" = '目标ID';

COMMIT;
```

### 4.10 恢复模型供应商

删除模型供应商不会同步删除其 `ProviderModel`，但会改写供应商名称并停用供应商。

先预览原名称：

```sql
SELECT "id", "name",
       substr("name", 1, length("name") - length('__deleted__' || "id")) AS "originalName"
FROM "ModelProvider"
WHERE "id" = '目标ID';
```

确认原名称未被同一用户的其他供应商占用后恢复：

```sql
BEGIN IMMEDIATE;

UPDATE "ModelProvider"
SET "name" = substr(
      "name",
      1,
      length("name") - length('__deleted__' || "id")
    ),
    "isEnabled" = 1,
    "deletedAt" = NULL
WHERE "id" = '目标ID'
  AND "name" LIKE '%' || '__deleted__' || "id";

COMMIT;
```

删除时 `isDefault` 会被清为 `0`。恢复后如需设为默认，优先在模型配置页面重新设置，确保同一用户只有一个默认供应商。

### 4.11 恢复供应商模型

`ProviderModel.name` 和 `ProviderModel.model` 都会被追加 `__deleted__<id>`。

```sql
BEGIN IMMEDIATE;

UPDATE "ProviderModel"
SET "name" = substr(
      "name",
      1,
      length("name") - length('__deleted__' || "id")
    ),
    "model" = substr(
      "model",
      1,
      length("model") - length('__deleted__' || "id")
    ),
    "isEnabled" = 1,
    "deletedAt" = NULL
WHERE "id" = '目标ID'
  AND "name" LIKE '%' || '__deleted__' || "id"
  AND "model" LIKE '%' || '__deleted__' || "id";

COMMIT;
```

恢复前必须确认同一 `providerId` 下没有其他记录占用原 `name` 或原 `model`，否则会触发唯一约束。

### 4.12 恢复模型链

删除模型链不会同步删除 `ModelFallbackCandidate`，只会改写模型链名称并停用模型链。

```sql
BEGIN IMMEDIATE;

UPDATE "ModelFallbackGroup"
SET "name" = substr(
      "name",
      1,
      length("name") - length('__deleted__' || "id")
    ),
    "isEnabled" = 1,
    "deletedAt" = NULL
WHERE "id" = '目标ID'
  AND "name" LIKE '%' || '__deleted__' || "id";

COMMIT;
```

删除时 `isDefault` 会被清为 `0`。默认模型链应恢复后通过页面重新设置。

如果模型链候选项是在“编辑模型链”时被替换，则旧 `ModelFallbackCandidate` 已被物理删除，不能靠恢复模型链找回，只能从备份恢复或根据原配置手工重建。

### 4.13 恢复 Prompt 预设

```sql
BEGIN IMMEDIATE;

UPDATE "PromptPreset"
SET "name" = substr(
      "name",
      1,
      length("name") - length('__deleted__' || "id")
    ),
    "deletedAt" = NULL
WHERE "id" = '目标ID'
  AND "name" LIKE '%' || '__deleted__' || "id";

COMMIT;
```

删除时 `isDefault` 会被清为 `0`。恢复后通过页面重新设置默认项。若原名称已被同一用户的新预设占用，需要先给其中一条改名。

### 4.14 恢复 Persona

```sql
BEGIN IMMEDIATE;

UPDATE "UserPersona"
SET "name" = substr(
      "name",
      1,
      length("name") - length('__deleted__' || "id")
    ),
    "deletedAt" = NULL
WHERE "id" = '目标ID'
  AND "name" LIKE '%' || '__deleted__' || "id";

COMMIT;
```

删除时 `isDefault` 会被清为 `0`。恢复后通过页面重新设置默认项。若原名称已被同一用户的新 Persona 占用，需要先给其中一条改名。

### 4.15 恢复分享链接

```sql
BEGIN IMMEDIATE;

UPDATE "ShareLink"
SET "status" = 'active',
    "revokedAt" = NULL
WHERE "id" = '目标ID';

COMMIT;
```

恢复前还要检查：

- `expiresAt` 必须为空或晚于当前时间。
- 目标 `Conversation` / `Companion` 必须未软删除。
- 如果该链接是“重新生成分享链接”时被撤销的旧链接，恢复它会同时激活旧 token 和新 token；这种情况应保留新链接，不恢复旧链接。

### 4.16 恢复素材记录

```sql
BEGIN IMMEDIATE;

UPDATE "Asset"
SET "deletedAt" = NULL
WHERE "id" = '目标ID';

COMMIT;
```

还必须确认 `storagePath` 指向的文件仍存在于 `uploads/`。只恢复数据库行不能恢复已经物理删除的文件。

### 4.17 无法通过软删除恢复的数据

以下情况必须从操作前数据库备份恢复，或者按原内容手工重建：

- `DELETE /api/companions/{id}/memory` 清空长期记忆后，被物理删除的 `CompanionMemoryRevision`。
- 长期记忆自动裁剪掉的第 10 个版本之前的旧版本。
- 编辑模型链时被物理替换的 `ModelFallbackCandidate`。
- 修改世界书角色绑定时被物理替换的 `WorldBookCharacter`。
- 备份导入覆盖前被物理删除的目标范围数据。
- 已从 `uploads/` 物理删除的素材文件。

## 4.1 清空账号和模型之外的全部数据

仓库提供 `scripts/reset-keep-accounts-models.sh`，用于保留以下数据库表：

- `User`
- `ModelProvider`
- `ProviderModel`
- `ModelFallbackGroup`
- `ModelFallbackCandidate`
- `_prisma_migrations`

角色、会话、消息、AI 角色、长期记忆、世界书、预设、Persona、分享、素材记录和应用设置会被硬删除；`uploads/` 会在完成操作前备份，然后清空。脚本不会修改服务器 `.env`，也不会执行 `db:seed`。

先只做预检：

```bash
cd /opt/tavern
bash scripts/reset-keep-accounts-models.sh --check
```

检查通过后正式执行：

```bash
cd /opt/tavern
bash scripts/reset-keep-accounts-models.sh
```

按提示输入 `RESET KEEP ACCOUNTS AND MODELS`。已人工确认并需要非交互执行时，可使用：

```bash
bash scripts/reset-keep-accounts-models.sh --yes
```

脚本会校验数据库实际表集合；如果当前数据库比脚本支持的 schema 多表或少表，会在停服和修改数据前终止，避免新增业务表被遗漏。

需要单独清理酒馆会话、角色、聊天场景生图、AI 角色聊天、AI 角色、世界书、Persona、PromptPreset、分享、素材、设置或模型配置时，使用 `scripts/reset-module-data.sh`。完整模块名、级联边界、执行命令和恢复方式见 [服务器数据清理脚本使用手册](server-data-cleanup.md)。

## 5. 清空全部业务数据，只保留管理员账号

本节的结果是：

- 保留 `User.role='admin'` 的账号行、密码哈希、用户名和管理员角色。
- 删除所有成员账号。
- 删除管理员和成员的全部业务数据，包括模型配置、角色、会话、消息、AI 角色、长期记忆、世界书、预设、Persona、分享、素材记录和应用设置。
- 保留 Prisma 的 `_prisma_migrations`，不破坏表结构和迁移历史。
- `uploads/` 文件不会被 SQL 自动删除，需要单独归档或清理。

仓库已提供自动化脚本 `scripts/reset-keep-admin.sh`。脚本会要求明确指定唯一保留的管理员，完成预置账号校验、管理员数据库预检、停服、备份、事务硬删除、结果校验、清空 uploads 和重新启动。优先使用脚本；本节后面的 SQL 保留为人工执行和审计参考。

先只检查，不修改数据：

```bash
cd /opt/tavern
bash scripts/reset-keep-admin.sh --admin root --check
```

确认检查通过后执行，过程中需要输入 `RESET root`：

```bash
cd /opt/tavern
bash scripts/reset-keep-admin.sh --admin root
```

已人工确认并需要非交互执行时：

```bash
cd /opt/tavern
bash scripts/reset-keep-admin.sh --admin root --yes
```

把示例中的 `root` 替换为服务器实际需要保留的管理员用户名。脚本要求 `.env` 的 `AUTH_PRESET_USERS_JSON` 只包含这个管理员，否则会在修改数据前终止。

### 5.1 先修改预置账号配置

登录接口每次登录前都会根据 `AUTH_PRESET_USERS_JSON` 执行账号同步。只删除数据库中的成员账号，但 `.env` 仍保留成员预置项时，下一次登录会重新创建或重新启用这些成员。

先编辑服务器 `/opt/tavern/.env`：

```bash
cd /opt/tavern
vi .env
```

把 `AUTH_PRESET_USERS_JSON` 改为只包含需要保留的管理员。至少必须保留一个 `role: "admin"` 的账号，否则后端环境变量校验不会通过。

不要把包含密码的完整 `.env` 输出到聊天记录、工单或日志。

### 5.2 停服并备份

```bash
cd /opt/tavern

docker compose down

tar -czf ../tavern-before-keep-admin-reset-$(date +%Y%m%d-%H%M%S).tar.gz data uploads
```

### 5.3 确认管理员账号

```sql
SELECT "id", "username", "displayName", "role", "isActive", "deletedAt"
FROM "User"
ORDER BY "role", "username";

SELECT COUNT(*) AS "adminCount"
FROM "User"
WHERE "role" = 'admin';
```

只有确认 `adminCount >= 1` 后才能继续。

### 5.4 执行仅保留管理员的清理事务

把以下内容保存为 `/opt/tavern/reset-keep-admin.sql`：

```sql
PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

-- 先删分享和最深层子记录。
DELETE FROM "ShareLink";
DELETE FROM "CompanionMemoryRevision";
DELETE FROM "CompanionMemory";
DELETE FROM "CompanionMessage";
DELETE FROM "Message";
DELETE FROM "WorldBookCharacter";
DELETE FROM "WorldBookEntry";
DELETE FROM "ModelFallbackCandidate";

-- 再删直接业务实体。
DELETE FROM "Conversation";
DELETE FROM "Companion";
DELETE FROM "WorldBook";
DELETE FROM "Character";

-- 删除模型、Prompt 和 Persona 配置。
DELETE FROM "ModelFallbackGroup";
DELETE FROM "ProviderModel";
DELETE FROM "ModelProvider";
DELETE FROM "PromptPreset";
DELETE FROM "UserPersona";

-- 删除素材索引和应用设置；uploads 文件另行处理。
DELETE FROM "Asset";
DELETE FROM "AppSetting";

-- 保留全部管理员账号，删除非管理员账号。
DELETE FROM "User"
WHERE "role" <> 'admin';

-- 保证保留下来的管理员处于可登录状态。
UPDATE "User"
SET "isActive" = 1,
    "deletedAt" = NULL
WHERE "role" = 'admin';

COMMIT;

PRAGMA foreign_key_check;
```

执行：

```bash
cd /opt/tavern

docker compose run --rm -T --no-deps \
  --entrypoint pnpm \
  server exec prisma db execute \
  --schema prisma/schema.prisma \
  --stdin < /opt/tavern/reset-keep-admin.sql
```

如果只想保留一个指定管理员，在确认其用户名后，把脚本中的用户删除条件改成：

```sql
DELETE FROM "User"
WHERE "username" <> '管理员用户名';

UPDATE "User"
SET "role" = 'admin',
    "isActive" = 1,
    "deletedAt" = NULL
WHERE "username" = '管理员用户名';
```

指定用户名必须和修改后的 `AUTH_PRESET_USERS_JSON` 保持一致。

### 5.5 处理 uploads

清理数据库后，`uploads/` 中原有文件全部失去数据库引用。如果也要清空上传文件，优先归档而不是直接永久删除：

```bash
cd /opt/tavern

mv uploads uploads.before-keep-admin-reset
mkdir -p uploads
```

确认系统正常并且不再需要回滚后，再自行处理归档目录。

### 5.6 启动并验证

```bash
cd /opt/tavern

docker compose up -d
docker compose ps
docker compose logs --tail=100 server
```

不要运行 `pnpm db:seed`，否则会重新写入 seed 数据。管理员账号会保留原密码哈希；`AUTH_PRESET_USERS_JSON` 只负责登录时同步预置账号的启用状态，不会覆盖后台已修改的管理员密码和显示名称。

使用 SQLite 客户端执行：

```sql
PRAGMA foreign_key_check;

SELECT "id", "username", "role", "isActive", "deletedAt"
FROM "User";

SELECT 'ShareLink' AS "tableName", COUNT(*) AS "rowCount" FROM "ShareLink"
UNION ALL SELECT 'CompanionMemoryRevision', COUNT(*) FROM "CompanionMemoryRevision"
UNION ALL SELECT 'CompanionMemory', COUNT(*) FROM "CompanionMemory"
UNION ALL SELECT 'CompanionMessage', COUNT(*) FROM "CompanionMessage"
UNION ALL SELECT 'Companion', COUNT(*) FROM "Companion"
UNION ALL SELECT 'Message', COUNT(*) FROM "Message"
UNION ALL SELECT 'Conversation', COUNT(*) FROM "Conversation"
UNION ALL SELECT 'WorldBookCharacter', COUNT(*) FROM "WorldBookCharacter"
UNION ALL SELECT 'WorldBookEntry', COUNT(*) FROM "WorldBookEntry"
UNION ALL SELECT 'WorldBook', COUNT(*) FROM "WorldBook"
UNION ALL SELECT 'Character', COUNT(*) FROM "Character"
UNION ALL SELECT 'ModelFallbackCandidate', COUNT(*) FROM "ModelFallbackCandidate"
UNION ALL SELECT 'ModelFallbackGroup', COUNT(*) FROM "ModelFallbackGroup"
UNION ALL SELECT 'ProviderModel', COUNT(*) FROM "ProviderModel"
UNION ALL SELECT 'ModelProvider', COUNT(*) FROM "ModelProvider"
UNION ALL SELECT 'PromptPreset', COUNT(*) FROM "PromptPreset"
UNION ALL SELECT 'UserPersona', COUNT(*) FROM "UserPersona"
UNION ALL SELECT 'Asset', COUNT(*) FROM "Asset"
UNION ALL SELECT 'AppSetting', COUNT(*) FROM "AppSetting";
```

预期结果：

- `PRAGMA foreign_key_check` 不返回任何行。
- `User` 只剩预期管理员，且 `role='admin'`、`isActive=1`、`deletedAt IS NULL`。
- 上述所有业务表的 `rowCount` 都是 `0`。
- 管理员可以正常登录。
- 页面内角色、会话、AI 角色、模型、世界书、预设、Persona 和分享列表均为空。

## 6. 完全重建数据库，包括删除管理员

如果不是“保留管理员”，而是连账号和迁移生成的数据也全部重建：

```bash
cd /opt/tavern

docker compose down

tar -czf ../tavern-before-full-reset-$(date +%Y%m%d-%H%M%S).tar.gz data uploads

rm -f data/tavern-lite.db
rm -f data/tavern-lite.db-wal
rm -f data/tavern-lite.db-shm

docker compose up -d --build
```

启动脚本会执行 `prisma migrate deploy` 重建表结构。首次使用 `.env` 中的账号登录时，系统会根据 `AUTH_PRESET_USERS_JSON` 创建预置账号。

只有需要演示数据时才执行：

```bash
docker compose exec server pnpm db:seed
```

## 7. 回滚方法

恢复或清理结果不符合预期时，不要继续写入当前数据库。停服后把当前目录移开，再解压操作前备份：

```bash
cd /opt/tavern
docker compose down

mv data data.after-failed-operation
mv uploads uploads.after-failed-operation

tar -xzf ../tavern-before-db-operation-YYYYMMDD-HHMMSS.tar.gz

docker compose up -d
docker compose logs --tail=100 server
```

备份文件名应替换为实际文件名。如果此前只备份了 `data/`，不要覆盖仍在使用的 `uploads/`。

## 8. 操作后检查清单

- [ ] 操作前已经停止 `server` 或执行了 `docker compose down`。
- [ ] 已备份 `data/` 和 `uploads/`。
- [ ] 所有恢复 SQL 都使用了明确 `WHERE id = ...` 或明确批次条件。
- [ ] 唯一名称后缀恢复前已检查同名冲突。
- [ ] 会话恢复没有误恢复更早手工删除的消息。
- [ ] AI 角色消息恢复后已刷新长期记忆。
- [ ] “仅保留管理员”前已同步修改 `AUTH_PRESET_USERS_JSON`。
- [ ] 清理后没有运行不需要的 seed。
- [ ] `PRAGMA foreign_key_check` 无结果。
- [ ] 后端日志没有 Prisma migration、外键或数据库锁错误。
- [ ] 管理员可以正常登录，页面数据范围符合预期。
