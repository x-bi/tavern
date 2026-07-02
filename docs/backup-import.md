# Tavern Lite 备份恢复导入

第 44 阶段提供同步恢复接口：

```text
POST /api/backups/import
Content-Type: application/json
```

请求体：

```json
{
  "rawJson": "{...}",
  "confirmOverwrite": true
}
```

## 覆盖策略

首版只支持显式确认后的全量覆盖恢复，不做细粒度冲突合并。

导入成功前，后端会先校验：

- `rawJson` 是合法 JSON。
- `formatVersion` 必须是 `tavern-lite.backup.v1`。
- 顶层 `data`、`resources.assets` 和核心数组存在。
- 核心记录有必要字段和可解析时间。
- 记录 ID、模型配置名、预设名、Persona 名、设置 `scope/key` 没有重复。
- 会话、消息、世界书、头像资源等引用能在备份文件内找到。

通过校验后，后端在一个 Prisma transaction 内执行：

1. 删除当前用户现有核心数据。
2. 按备份 ID 重建资源记录、角色、模型配置、预设、Persona、会话、消息、世界书、世界书条目和设置。
3. 任一写入失败时事务回滚，避免只恢复一半。

## 安全策略

备份文件不会恢复 API Key。模型配置导入时：

- `apiKeyCiphertext` 固定写入 `null`。
- `apiKeyMask` 固定写入 `null`。
- 备份里原来带密钥的模型配置导入后会被禁用。
- 用户需要在模型配置页重新填写 API Key 并手动启用。

设置项如果在导出时已经脱敏，导入时会跳过，不会用 `null` 覆盖成可用配置。响应里的 `summary.skippedRedactedSettings` 会说明跳过数量。

`uploads/` 文件二进制不会从 JSON 恢复。导入只恢复 `Asset` 数据库记录。需要头像等资源实际可访问时，应另行恢复备份里 `resources.assets[].storagePath` 对应的文件。

## 响应结构

成功响应仍使用统一 `ApiResponse<T>` 包装，`data` 示例：

```json
{
  "imported": true,
  "strategy": "full-overwrite",
  "formatVersion": "tavern-lite.backup.v1",
  "importedAt": "2026-07-02T12:00:00.000Z",
  "sourceExportedAt": "2026-07-02T11:00:00.000Z",
  "summary": {
    "characters": 1,
    "conversations": 1,
    "messages": 10,
    "worldBooks": 1,
    "worldBookEntries": 3,
    "modelConfigs": 1,
    "promptPresets": 1,
    "personas": 1,
    "appSettings": 0,
    "assets": 1,
    "skippedRedactedSettings": 0,
    "apiKeysDropped": 1
  },
  "warnings": []
}
```

常见失败码：

- `BACKUP_IMPORT_CONFIRMATION_REQUIRED`
- `BACKUP_IMPORT_INVALID_JSON`
- `BACKUP_IMPORT_INVALID_VERSION`
- `BACKUP_IMPORT_INVALID_FORMAT`

## 当前边界

- 不做复杂冲突合并器。
- 不做后台异步任务。
- 不恢复不兼容版本。
- 不恢复模型 API Key。
- 不恢复 uploads 文件二进制。
