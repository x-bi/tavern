← [返回目录](./README.md)

# 参数预设 (presets) / 用户 Persona (personas)

## GET /api/prompt-presets
- **说明**：分页查询当前用户参数预设列表。
- **查询参数**：

  | 字段 | 类型 | 必填 | 默认 | 校验规则 |
  |---|---|---|---|---|
  | page | number | 否 | 1 | int ≥1 |
  | pageSize | number | 否 | 20 | int 1~100 |
  | search | string | 否 | - | `@MaxLength(120)`；匹配 name/description/outputRules |
  | isDefault | boolean | 否 | - | 'true'/'false' 转布尔 |

## POST /api/prompt-presets
- **说明**：创建参数预设。
- **请求体**（`CreatePromptPresetDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | name | string | 是 | `@MaxLength(120)` |
  | description | string | 否 | `@MaxLength(500)` |
  | outputRules | string | 否 | `@MaxLength(4000)` |
  | temperature | number | 否 | 0~2 |
  | topP | number | 否 | 0~1 |
  | maxTokens | number | 否 | int 1~200000 |
  | isDefault | boolean | 否 | 默认 false |
  | isSensitive | boolean | 否 | 默认 false |

## POST /api/prompt-presets/import
- **说明**：导入参数预设 JSON（两阶段：`commit=false` 仅预览，`true` 落库）。
- **请求体**（`ImportModuleJsonDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | rawJson | string | 是 | 原始 JSON 文本；大小上限由 REQUEST_BODY_LIMIT 控制 |
  | commit | boolean | 否 | 默认 false（仅预览） |
  | duplicateNameStrategy | `'reject' \| 'rename'` | 否 | 默认 reject；rename 用 suggestedName |

## GET /api/prompt-presets/import-template
- **说明**：下载参数预设导入模板。

## PUT /api/prompt-presets/:id
- **路径参数**：`id: string`
- **说明**：部分更新预设。
- **请求体**：`UpdatePromptPresetDto`（字段同 `CreatePromptPresetDto`，全可选）

## DELETE /api/prompt-presets/:id
- **路径参数**：`id: string`
- **说明**：软删除预设（200 OK）。

## GET /api/personas
- **说明**：分页查询当前用户 Persona 列表。
- **查询参数**：

  | 字段 | 类型 | 必填 | 默认 | 校验规则 |
  |---|---|---|---|---|
  | page | number | 否 | 1 | int ≥1 |
  | pageSize | number | 否 | 20 | int 1~100 |
  | search | string | 否 | - | `@MaxLength(120)`；匹配 name/content |
  | isDefault | boolean | 否 | - | 'true'/'false' 转布尔 |

## POST /api/personas
- **说明**：创建用户 Persona。
- **请求体**（`CreatePersonaDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | name | string | 是 | `@MaxLength(120)` |
  | content | string | 否 | `@MaxLength(8000)` |
  | metadata | object | 否 | 任意对象 |
  | isDefault | boolean | 否 | 默认 false |
  | isSensitive | boolean | 否 | 默认 false |

## POST /api/personas/import
- **说明**：导入 Persona JSON（两阶段）。请求体 `ImportModuleJsonDto`（同 presets）。

## GET /api/personas/import-template
- **说明**：下载 Persona 导入模板。

## PUT /api/personas/:id
- **路径参数**：`id: string`
- **说明**：部分更新人设。
- **请求体**：`UpdatePersonaDto`（字段同 `CreatePersonaDto`，全可选；metadata 传入整体替换）

## DELETE /api/personas/:id
- **路径参数**：`id: string`
- **说明**：软删除人设（200 OK）。

## POST /api/personas/:id/set-default
- **路径参数**：`id: string`
- **说明**：将指定人设设为当前用户默认人设（200 OK）。
