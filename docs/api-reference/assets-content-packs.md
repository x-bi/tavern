← [返回目录](./README.md)

# 资产 (assets) / 内容包 (content-packs)

## POST /api/assets/upload
- **鉴权**：`AuthGuard`
- **说明**：上传当前用户角色头像（multer 单文件，文件名后端生成，落盘 `uploads/avatars/characters/`，映射 `/uploads/` 静态访问）。
- **请求体**：`multipart/form-data`，文件字段 `file`

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | file | File（二进制） | 是 | 单文件；`fileSize ≤ 2MB`；仅放行 `image/jpeg`、`image/png`、`image/webp`、`image/gif`，其余 415（`ASSET_UNSUPPORTED_TYPE`）。扩展名按 MIME 映射生成 |

- **响应**：`data` 为头像资源信息（含后端生成的访问路径）

## POST /api/content-packs/import
- **鉴权**：`AuthGuard`
- **说明**：导入内容包 JSON（两阶段）。`commit` 未传/false 仅返回预览（含冲突、告警）；true 正式落库并返回导入后 ID 列表。
- **请求体**（`ImportContentPackDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | rawJson | string | 是 | `@IsString`；大小上限由 REQUEST_BODY_LIMIT 控制 |
  | commit | boolean | 否 | `@IsBoolean`；默认 false（仅预览） |
  | duplicateStrategy | `'reject' \| 'rename' \| 'skip'` | 否 | `@IsIn`；reject 同名即拒绝；rename 追加序号；skip 跳过冲突及其依赖资源 |

- **响应**：`data` 为 `ContentPackImportResponse`（预览、冲突、告警及正式导入后 ID 列表）

> 公共 DTO `ImportModuleJsonDto`（`common/dto/import-module-json.dto.ts`）的 `duplicateNameStrategy` 仅支持 `reject | rename`，被 presets/personas/world-books/characters 等导入接口共用。
