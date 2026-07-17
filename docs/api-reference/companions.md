← [返回目录](./README.md)

# AI 角色 (companions) / AI 角色消息 (companion-messages)

AI 角色形态（独立长期陪伴分支），与酒馆形态隔离。`Companion` 是唯一持续关系线程，无会话列表/新建会话概念。

## GET /api/companions
- **说明**：分页查询当前用户 AI 角色列表。
- **查询参数**：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | page | number | 否 | `@IsInt @Min(1)`，默认 1 |
  | pageSize | number | 否 | `@IsInt @Min(1) @Max(100)`，默认 20 |
  | search | string | 否 | `@MaxLength(80)` |

## POST /api/companions
- **说明**：创建独立 AI 角色。
- **请求体**：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | name | string | 是 | `@MaxLength(80)` |
  | identityPrompt | string | 否 | `@MaxLength(12000)`；身份/设定提示词 |
  | avatarAssetId | string \| null | 否 | `@MaxLength(128)` |
  | modelFallbackGroupId | string \| null | 否 | `@MaxLength(128)` |
  | promptPresetId | string \| null | 否 | `@MaxLength(128)` |
  | personaId | string \| null | 否 | `@MaxLength(128)` |

## GET /api/companions/import-template
- **说明**：获取导入 AI 角色的 JSON 模板结构。

## POST /api/companions/import
- **说明**：导入 AI 角色 JSON（两阶段，`commit=true` 才写入）。
- **请求体**：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | rawJson | string | 是 | `@MaxLength(5_000_000)` |
  | commit | boolean | 否 | `@IsBoolean`；true 提交，否则仅预览 |
  | duplicateNameStrategy | `'reject' \| 'rename'` | 否 | `@IsIn` |

## GET /api/companions/:id/export
- **路径参数**：`id: string`
- **说明**：导出指定 AI 角色 JSON。

## GET /api/companions/:id
- **路径参数**：`id: string`
- **说明**：获取指定 AI 角色详情。

## PUT /api/companions/:id
- **路径参数**：`id: string`
- **说明**：更新指定 AI 角色；关联字段可传 null 解绑。
- **请求体**：字段同 `POST /api/companions`，全可选

## DELETE /api/companions/:id
- **路径参数**：`id: string`
- **说明**：删除指定 AI 角色（HttpCode 200）。

## GET /api/companions/:companionId/messages
- **路径参数**：`companionId: string`
- **说明**：获取指定 AI 角色消息列表（无分页，返回消息集合）。

## PUT /api/companion-messages/:id
- **路径参数**：`id: string`
- **说明**：编辑指定消息文本内容。
- **请求体**：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | content | string | 是 | `@MaxLength(12000)` |

## DELETE /api/companion-messages/:id
- **路径参数**：`id: string`
- **说明**：删除指定消息（HttpCode 200）。

## POST /api/companion-messages/:id/regenerate
- **路径参数**：`id: string`
- **说明**：重新生成指定 AI 角色消息（HttpCode 200）。
- **响应**：`data` 为重新生成后的消息对象
