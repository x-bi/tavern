# Tavern Lite 服务器数据清理脚本使用手册

本文只适用于当前 Docker Compose + SQLite 部署方式。默认项目目录为 `/opt/tavern`，数据库为 `/opt/tavern/data/tavern-lite.db`。

所有正式清理脚本都会：

1. 校验 `.env`、数据库、当前 schema 和外键。
2. 停止 Docker Compose 服务。
3. 把 `data/` 和 `uploads/` 备份到 `/opt/tavern-reset-backups/`。
4. 在事务中硬删除目标数据。
5. 校验清理结果和 `PRAGMA foreign_key_check`。
6. 重新启动服务。

脚本不会执行 `db:seed`。正式执行前必须先运行对应的 `--check`。

外键预检规则：

- `reset-keep-accounts-models.sh` 如果发现的外键异常全部位于本次将删除的业务表中，会打印具体异常并允许继续；正式清理后再次校验。
- 如果外键异常位于要保留的 `User` 或模型配置表中，会拒绝执行，避免把损坏的保留数据继续留下。
- `reset-module-data.sh` 只清理一个局部模块，无法保证其他模块中的既有外键异常会消失，因此会打印具体异常并中止。

## 1. 保留全部账号和模型，清除其他全部数据

脚本：

```text
scripts/reset-keep-accounts-models.sh
```

保留：

- `User`
- `ModelProvider`
- `ProviderModel`
- `ModelFallbackGroup`
- `ModelFallbackCandidate`
- `_prisma_migrations`

角色、酒馆会话、消息、聊天场景生图、AI 角色、长期记忆、世界书、Persona、PromptPreset、分享、素材、设置和 `uploads/` 会被清空。

先检查：

```bash
cd /opt/tavern
bash scripts/reset-keep-accounts-models.sh --check
```

正式执行：

```bash
bash scripts/reset-keep-accounts-models.sh
```

输入：

```text
RESET KEEP ACCOUNTS AND MODELS
```

跳过交互确认：

```bash
bash scripts/reset-keep-accounts-models.sh --yes
```

## 2. 只保留指定管理员，清除其他全部数据

脚本：

```text
scripts/reset-keep-admin.sh
```

此脚本只保留一个指定管理员，会删除其他账号以及模型配置、聊天场景生图在内的全部业务数据。执行前必须把服务器 `.env` 的 `AUTH_PRESET_USERS_JSON` 改为只包含同一个管理员，否则登录同步可能重新创建账号。

```bash
cd /opt/tavern
bash scripts/reset-keep-admin.sh --admin root --check
bash scripts/reset-keep-admin.sh --admin root
```

输入：

```text
RESET root
```

把 `root` 替换为服务器实际管理员用户名。

## 3. 单独清理一个模块

统一使用：

```text
scripts/reset-module-data.sh
```

每次只允许传一个 `--module`。通用执行顺序：

```bash
cd /opt/tavern
bash scripts/reset-module-data.sh --module <模块名> --check
bash scripts/reset-module-data.sh --module <模块名>
```

确认文本格式：

```text
RESET MODULE <模块名>
```

非交互执行：

```bash
bash scripts/reset-module-data.sh --module <模块名> --yes
```

### 3.1 模块名与清理边界

| 模块名 | 删除内容 | 保留及联动边界 |
| --- | --- | --- |
| `tavern-conversations` | 全部酒馆会话、消息、turn、生成请求/追踪、会话世界书运行记录、会话分享和聊天场景生图 | 保留角色、世界书、Persona、PromptPreset、模型；清空 `uploads/generated-images/` |
| `characters` | 全部酒馆角色及其全部酒馆会话、运行记录和聊天场景生图 | 角色是会话必需父级，因此酒馆会话同时删除；头像素材保留，生成图片清空 |
| `scene-images` | 生图批次、租约、图片关联、`generated_image` 素材及生成文件 | 保留酒馆会话、消息、角色和模型配置；清空 `uploads/generated-images/` |
| `companion-history` | AI 角色消息、turn、生成请求/追踪、长期记忆版本、运行状态、世界书运行记录 | 保留 AI 角色；保留长期记忆开关、总结模型链和更新频率，运行游标复位 |
| `companions` | 全部 AI 角色、聊天、长期记忆、运行状态、AI 角色分享和世界书绑定 | 素材记录和文件保留 |
| `world-books` | 世界书、条目、条目版本、所有绑定及酒馆/AI 角色世界书运行记录 | 保留角色、AI 角色和聊天主体；历史生成追踪中的世界书明细会删除 |
| `personas` | 全部 Persona 和世界书 Persona 绑定 | 会话与 AI 角色的 `personaId` 置空 |
| `prompt-presets` | 全部 PromptPreset | 会话与 AI 角色的 `promptPresetId` 置空 |
| `shares` | 全部酒馆和 AI 角色分享链接 | 分享目标主体保留 |
| `assets` | 全部素材、聊天场景生图记录和 `uploads/` | 角色与 AI 角色的 `avatarAssetId` 置空 |
| `settings` | 全部 `AppSetting` | `.env` 不修改 |
| `models` | 模型供应商、模型、模型链、候选项及依赖模型链的聊天场景生图 | 会话聊天链、生图链、AI 角色和长期记忆的模型链绑定置空；历史追踪中的模型 ID 文本保留 |

账号不提供独立模块清理。`User` 是几乎全部业务数据的父级，而且登录会根据 `AUTH_PRESET_USERS_JSON` 同步账号；需要收缩账号时使用第 2 节的 `reset-keep-admin.sh`。

### 3.2 各模块命令

清理酒馆会话：

```bash
bash scripts/reset-module-data.sh --module tavern-conversations --check
bash scripts/reset-module-data.sh --module tavern-conversations
```

清理酒馆角色：

```bash
bash scripts/reset-module-data.sh --module characters --check
bash scripts/reset-module-data.sh --module characters
```

只清理聊天场景生图：

```bash
bash scripts/reset-module-data.sh --module scene-images --check
bash scripts/reset-module-data.sh --module scene-images
```

只清理 AI 角色聊天历史和长期记忆内容：

```bash
bash scripts/reset-module-data.sh --module companion-history --check
bash scripts/reset-module-data.sh --module companion-history
```

清理 AI 角色：

```bash
bash scripts/reset-module-data.sh --module companions --check
bash scripts/reset-module-data.sh --module companions
```

清理世界书：

```bash
bash scripts/reset-module-data.sh --module world-books --check
bash scripts/reset-module-data.sh --module world-books
```

清理 Persona：

```bash
bash scripts/reset-module-data.sh --module personas --check
bash scripts/reset-module-data.sh --module personas
```

清理 PromptPreset：

```bash
bash scripts/reset-module-data.sh --module prompt-presets --check
bash scripts/reset-module-data.sh --module prompt-presets
```

清理分享链接：

```bash
bash scripts/reset-module-data.sh --module shares --check
bash scripts/reset-module-data.sh --module shares
```

清理素材和上传文件：

```bash
bash scripts/reset-module-data.sh --module assets --check
bash scripts/reset-module-data.sh --module assets
```

清理应用设置：

```bash
bash scripts/reset-module-data.sh --module settings --check
bash scripts/reset-module-data.sh --module settings
```

清理模型配置：

```bash
bash scripts/reset-module-data.sh --module models --check
bash scripts/reset-module-data.sh --module models
```

## 4. 备份位置与恢复

默认备份目录：

```text
/opt/tavern-reset-backups/
```

可在执行前通过环境变量修改：

```bash
export TAVERN_RESET_BACKUP_DIR=/data/tavern-reset-backups
```

发生错误时脚本会显示实际备份文件。恢复前先停止服务，并把当前失败现场移走：

```bash
cd /opt/tavern
docker compose down
mv data data.after-failed-cleanup
mv uploads uploads.after-failed-cleanup
tar -xzf /opt/tavern-reset-backups/<实际备份文件名>.tar.gz
docker compose up -d
docker compose ps
```

确认恢复正常后，再决定是否删除 `data.after-failed-cleanup` 和 `uploads.after-failed-cleanup`。

## 5. 执行后检查

```bash
cd /opt/tavern
docker compose ps
docker compose logs --tail=100 server
```

登录主站后检查目标模块为空，并确认本次未清理的账号、模型和其他模块仍可正常访问。

## 6. Schema 新增模块后的同步检查

清理脚本会在服务器修改数据前比较实际数据库表和当前支持的 Prisma model。新增持久化表尚未定义清理边界时，`--check` 会列出“未识别”表并安全中止；这不是数据库故障，而是提醒必须先更新清理语义。

开发或发布前执行：

```bash
pnpm verify:data-cleanup
```

该命令检查：

- 三个清理脚本的 schema 表守卫是否覆盖全部 Prisma model。
- “保留账号和模型”脚本是否删除其余全部表。
- “只保留管理员”脚本是否删除除 `User` 外全部表。
- 模块脚本支持项是否都写入本使用文档。
- 聊天场景生图的表、模型链绑定和生成文件清理边界是否完整。
