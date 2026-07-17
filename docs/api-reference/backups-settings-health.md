← [返回目录](./README.md)

# 备份恢复 (backups) / 本地设置 (settings) / 健康检查 (health)

## GET /api/backups/export
- **鉴权**：`AuthGuard`；`@SkipResponseWrap()` 跳过包装，返回 JSON 文件下载流。
- **说明**：导出当前用户应用备份。
- **响应**：文件流，响应头 `Content-Type: application/json; charset=utf-8`、`Content-Disposition: attachment; filename="<filename>"`、`Content-Length`。备份逻辑结构（`tavern-lite.backup.v1`）含 `formatVersion`/`exportedAt`/`scope`/`strategy`/`security`/`summary`/`data`/`resources`。
  - **不含**模型配置（含 API Key）、uploads 二进制；敏感设置值脱敏为 `null` 并带 `redacted`/`redactionReason`。

## POST /api/backups/import
- **鉴权**：`AuthGuard`
- **说明**：导入应用备份，对当前用户数据执行**全量覆盖**（`strategy: 'full-overwrite'`），`confirmOverwrite` 必须为 `true`。
- **请求体**（`ImportBackupDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | rawJson | string | 是 | `@IsString`；备份 JSON 文本 |
  | confirmOverwrite | boolean | 是 | `@IsBoolean`；必须 true |

- **响应**：`data` 为 `BackupImportResponse`（`imported`/`strategy`/`formatVersion`/`importedAt`/`sourceExportedAt`/`summary`/`warnings`）。`summary.skippedRedactedSettings` 为被脱敏而未恢复的设置项数。

## GET /api/settings
- **鉴权**：`AuthGuard`
- **说明**：读取当前用户应用级轻量设置。
- **响应**：`data` 为 `ApplicationSettings`：`workspaceName`、`autoOpenLastConversation`、`compactListMode`、`defaultHistoryLimit`、`showSensitiveContent`

## PUT /api/settings
- **鉴权**：`AuthGuard`
- **说明**：更新应用级设置（部分更新；HttpCode 200）。
- **请求体**（`UpdateApplicationSettingsDto`，全可选）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | workspaceName | string | 否 | `@MaxLength(32)` |
  | autoOpenLastConversation | boolean | 否 | - |
  | compactListMode | boolean | 否 | - |
  | defaultHistoryLimit | number | 否 | `@IsInt @Min(5) @Max(100)` |
  | showSensitiveContent | boolean | 否 | 是否显示并允许使用敏感资源 |

- **响应**：`data` 为更新后的完整 `ApplicationSettings`

## GET /api/health
- **鉴权**：无（公开）
- **说明**：健康检查探针，返回服务运行状态。
- **响应**：`data` 为健康状态对象（基于 `server` 配置生成）
