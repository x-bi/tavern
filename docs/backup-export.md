# Tavern Lite 备份导出格式

第 43 阶段提供同步逻辑 JSON 导出接口：

```text
GET /api/backups/export
Accept: application/json
```

响应是下载文件，不使用普通 `ApiResponse<T>` 包装。文件名形如：

```text
tavern-lite-backup-20260702T120000Z.json
```

## 导出策略

首版采用逻辑 JSON 导出，不直接复制 SQLite 数据库文件。原因是逻辑导出更容易检查内容、跨版本迁移和控制敏感字段暴露。

导出对象只覆盖当前登录用户的 active 数据：

- `characters`
- `conversations`
- `messages`
- `worldBooks`，包含 `entries`
- `promptPresets`
- `personas`
- `appSettings`
- `resources.assets`，只作为 uploads 文件清单

模型供应商、模型、模型链和模型调用日志不纳入备份；恢复后需要重新配置模型链。

## 顶层结构

```json
{
  "formatVersion": "tavern-lite.backup.v1",
  "exportedAt": "2026-07-02T12:00:00.000Z",
  "app": {
    "name": "Tavern Lite",
    "backupKind": "logical-json"
  },
  "scope": {
    "userId": "...",
    "username": "...",
    "displayName": "..."
  },
  "strategy": {
    "type": "logical-json",
    "description": "..."
  },
  "security": {},
  "summary": {},
  "data": {},
  "resources": {}
}
```

## 安全策略

模型配置不再纳入备份。导出结果不包含模型供应商、模型、模型链、API Key 明文或密文。

设置项按 key 名做保守脱敏。匹配以下模式的 `AppSetting.value` 会被置为 `null`：

```text
/(api[-_]?key|token|secret|password|credential)/i
```

上传文件不会嵌入 JSON。`resources.assets` 只记录数据库里的资源元数据、相对 `storagePath` 和 `publicPath`。需要完整恢复头像或导入资源时，应同时备份 `uploads/` 目录。

## 当前边界

- 不做增量备份。
- 不做后台任务队列。
- 不做云备份。
- 恢复导入见 `docs/backup-import.md`。
- 不保证导出的 JSON 能跨任意未来 schema 自动恢复，后续恢复阶段需要按 `formatVersion` 做兼容处理。
