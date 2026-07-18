← [返回目录](./README.md)

# 角色 (characters)

控制器 `@Controller('characters')`，类级 `@UseGuards(AuthGuard)`。

## GET /api/characters

- **说明**：当前用户角色列表分页查询。
- **查询参数**（`QueryCharactersDto`）：

  | 字段       | 类型                   | 必填 | 校验/默认                                                          |
  | ---------- | ---------------------- | ---- | ------------------------------------------------------------------ |
  | page       | number                 | 否   | int ≥1，默认 1                                                     |
  | pageSize   | number                 | 否   | int 1~100，默认 20                                                 |
  | search     | string                 | 否   | `@MaxLength(120)`；匹配 name/description/personality/scenario 包含 |
  | isArchived | boolean                | 否   | 'true'/'false' 转布尔，默认不过滤                                  |
  | scope      | `'owned' \| 'library'` | 否   | 默认 owned；library 只返回固定管理员 `isShared=true` 主数据        |

- **响应**：`data` 为 `{ items: Character[], total, page, pageSize }`

## POST /api/characters

- **说明**：创建角色。
- **请求体**（`CreateCharacterDto`）：

  | 字段            | 类型                | 必填 | 校验规则 + 注释                                |
  | --------------- | ------------------- | ---- | ---------------------------------------------- |
  | avatarAssetId   | string \| null      | 否   | 传 null 显式清空头像，不传不设                 |
  | name            | string              | 是   | `@MaxLength(120)`                              |
  | description     | string              | 否   | `@MaxLength(10000)`                            |
  | personality     | string              | 否   | `@MaxLength(10000)`                            |
  | scenario        | string              | 否   | `@MaxLength(10000)`                            |
  | firstMessage    | string              | 否   | `@MaxLength(10000)`                            |
  | exampleMessages | ExampleMessageDto[] | 否   | 嵌套校验                                       |
  | metadata        | object              | 否   | 任意对象                                       |
  | isArchived      | boolean             | 否   | 默认 false                                     |
  | isSensitive     | boolean             | 否   | 默认 false                                     |
  | isShared        | boolean             | 否   | 仅固定内容库管理员可设置；普通成员提交返回 403 |

  `ExampleMessageDto`：`{ role: 'user'|'assistant'|'system', content: string(@MaxLength(10000)) }`

- **响应**：`data` 为创建后的 `Character`

## POST /api/characters/import

- **说明**：导入角色卡 JSON（两阶段）。`commit` 未传或 false 仅预览；true 正式落库，名称冲突按 `duplicateNameStrategy` 处理。
- **请求体**（`ImportCharacterDto`）：

  | 字段                  | 类型                   | 必填 | 校验规则 + 注释                                              |
  | --------------------- | ---------------------- | ---- | ------------------------------------------------------------ |
  | rawJson               | string                 | 是   | 原始角色卡 JSON 文本                                         |
  | commit                | boolean                | 否   | 默认 false（仅预览）                                         |
  | duplicateNameStrategy | `'reject' \| 'rename'` | 否   | 默认 reject（冲突报错并返回建议名）；rename 用 suggestedName |

- **响应**：`data` 为导入预览或正式导入结果

## GET /api/characters/import-template

- **说明**：下载角色卡导入模板。
- **响应**：`data` 为模板结构

## GET /api/characters/:id/export

- **路径参数**：`id: string`
- **说明**：导出指定角色 JSON。
- **响应**：`data` 为角色卡 JSON 结构

## GET /api/characters/:id

- **路径参数**：`id: string`
- **说明**：获取单个角色详情。
- **响应**：`data` 为 `Character`

## PUT /api/characters/:id

- **路径参数**：`id: string`
- **说明**：更新角色（部分更新；`exampleMessages`/`metadata` 传入则整体替换）。
- **请求体**：`UpdateCharacterDto`（字段同 `CreateCharacterDto`，全部可选；`avatarAssetId` 传 null 清空头像，不传保持原值）
- **响应**：`data` 为更新后的 `Character`

## DELETE /api/characters/:id

- **路径参数**：`id: string`
- **说明**：删除角色（软删除）。
- **响应**：HTTP 200，`data` 为删除结果

## POST /api/characters/:id/fork

- **路径参数**：`id: string`
- **说明**：把内容库角色复制为当前成员的独立副本。角色数据与敏感标记取复制瞬间快照；头像会复制成成员自己的文件和 Asset，之后不再同步。
- **响应**：新建的成员角色，固定 `isShared=false`。
