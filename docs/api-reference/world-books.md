← [返回目录](./README.md)

# 世界书 (world-books)

控制器类级 `@UseGuards(AuthGuard)`，写操作经 `DtoValidationPipe`。命中相关字段随世界书/条目响应返回，**无独立"命中调试"HTTP 接口**，命中逻辑由 prompt-builder 在对话流程执行。

## GET /api/world-books

- **说明**：分页查询世界书列表（含条目，按 priority 倒序）。默认仅返回 `isSensitive=false`，除非用户开启敏感内容展示。
- **查询参数**（`QueryWorldBooksDto`）：

  | 字段        | 类型                                | 必填 | 默认  | 说明                                                                   |
  | ----------- | ----------------------------------- | ---- | ----- | ---------------------------------------------------------------------- |
  | page        | number                              | 否   | 1     | int ≥1                                                                 |
  | pageSize    | number                              | 否   | 20    | 1~100                                                                  |
  | search      | string                              | 否   | -     | `@MaxLength(120)`；匹配 name/description                               |
  | characterId | string                              | 否   | -     | 按角色 ID 过滤                                                         |
  | isEnabled   | boolean                             | 否   | -     | 'true'/'false' 转布尔                                                  |
  | scope       | `'owned' \| 'library' \| 'managed'` | 否   | owned | library 返回固定管理员共享主数据；managed 仅管理员只读查看其他用户数据 |

- **响应**：`data` 为 `{ items: WorldBookResponse[], total, page, pageSize }`（含 `entries`）

## POST /api/world-books

- **说明**：创建世界书；指定 `characterIds` 时校验全部角色归属。空数组表示全局世界书。
- **请求体**（`CreateWorldBookDto`）：

  | 字段         | 类型                              | 必填 | 校验规则 + 注释                          |
  | ------------ | --------------------------------- | ---- | ---------------------------------------- |
  | name         | string                            | 是   | `@MaxLength(120)`                        |
  | characterIds | string[]                          | 否   | 关联角色 ID 列表；空数组表示全局         |
  | description  | string                            | 否   | `@MaxLength(4000)`                       |
  | isEnabled    | boolean                           | 否   | 默认 true                                |
  | isSensitive  | boolean                           | 否   | 默认 false                               |
  | isShared     | boolean                           | 否   | 仅固定内容库管理员可设置                 |
  | scanDepth    | number                            | 否   | `@IsInt @Min(1) @Max(200)`，默认 6       |
  | tokenBudget  | number                            | 否   | `@IsInt @Min(1) @Max(200000)`，默认 1000 |
  | metadata     | Record\<string, unknown\> \| null | 否   | 扩展元数据                               |

## POST /api/world-books/import

- **说明**：导入世界书 JSON（两阶段）。`formatVersion` 须为 `tavern-lite.world-book.v1`。导入结果固定不关联角色且停用，需导入后选择本地角色并手动启用。旧命名 `before/after_current_user_message` 会归一化为 `before/after_current_user_input` 并产生 `INSERTION_ORDER_ALIAS_NORMALIZED` warning。JSON 非法/格式不符返回 400；同名冲突且策略 reject 返回 409（details 含 `suggestedName`）。
- **请求体**（`ImportModuleJsonDto`）：`rawJson` / `commit`（默认 false）/ `duplicateNameStrategy`（默认 reject）。
- **响应**：`data` 为 `{ imported, preview, worldBook }`；预览态 `worldBook=null`，`preview` 含归一化后的 name/entries/warnings/nameConflict/suggestedName。

## GET /api/world-books/import-template

- **说明**：下载导入模板（返回模板对象，非文件流）。
- **响应**：`{ fileName, template: { formatVersion, name, description, characterIds: [], isEnabled: false, scanDepth, tokenBudget, metadata, entries: [...] } }`

## GET /api/world-books/:id

- **路径参数**：`id: string`
- **说明**：获取单个世界书（含未删除条目，按 priority 倒序）；不存在/不属于该用户/已删除返回 404。
- **响应**：`data` 为 `WorldBookResponse`（含 `entries`）

## POST /api/world-books/:id/fork

- **说明**：深复制世界书与全部未删除条目为成员独立副本。来源为全局世界书（`characterIds=[]`）时，副本仍仅在成员账号内全局生效；来源关联任意角色时，请求体必须提供成员自己的 `targetCharacterId`。
- **请求体**：`{ targetCharacterId?: string }`
- **响应**：成员世界书副本，固定 `isShared=false`，之后不再同步。

## PUT /api/world-books/:id

- **路径参数**：`id: string`
- **说明**：部分更新世界书；`characterIds` 传入时整体替换关联，并校验全部角色归属。
- **请求体**：`UpdateWorldBookDto`（字段同 `CreateWorldBookDto`，全可选；metadata 传入整体替换）

## DELETE /api/world-books/:id

- **路径参数**：`id: string`
- **说明**：删除世界书（级联软删除条目，`isEnabled` 置 false；HttpCode 200）。
- **响应**：`data` 为 `{ deleted: true, id }`

## POST /api/world-books/:id/entries

- **路径参数**：`id: string`（所属世界书 ID）
- **说明**：在指定世界书下创建条目；先校验世界书归属。
- **请求体**（`CreateWorldBookEntryDto`）：

  | 字段              | 类型                              | 必填 | 校验规则 + 注释                                                                                                    |
  | ----------------- | --------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
  | title             | string                            | 是   | `@MaxLength(160)`                                                                                                  |
  | content           | string                            | 是   | `@MaxLength(20000)`                                                                                                |
  | keywords          | string[]                          | 是   | `@ArrayNotEmpty @ArrayMaxSize(50)`，每项 `@MaxLength(120)`                                                         |
  | secondaryKeywords | string[]                          | 否   | `@ArrayMaxSize(50)`，每项 `@MaxLength(120)`                                                                        |
  | isEnabled         | boolean                           | 否   | 默认 true                                                                                                          |
  | priority          | number                            | 否   | `@IsInt @Min(-10000) @Max(10000)`，默认 0（越大越优先）                                                            |
  | insertionOrder    | string                            | 否   | `@IsIn([before_history, after_history, before_current_user_input, after_current_user_input])`，默认 before_history |
  | tokenBudget       | number \| null                    | 否   | `@IsInt @Min(1) @Max(200000)`，默认 null 用世界书的                                                                |
  | caseSensitive     | boolean                           | 否   | 默认 false                                                                                                         |
  | metadata          | Record\<string, unknown\> \| null | 否   | 扩展元数据                                                                                                         |

## PUT /api/world-book-entries/:id

- **路径参数**：`id: string`（条目 ID）
- **说明**：部分更新条目；`keywords`/`secondaryKeywords` 传入整体替换；通过所属世界书间接校验用户归属。
- **请求体**：`UpdateWorldBookEntryDto`（字段同上，全可选）
- **响应**：`data` 为更新后的 `WorldBookEntryResponse`

## DELETE /api/world-book-entries/:id

- **路径参数**：`id: string`（条目 ID）
- **说明**：软删除条目（`isEnabled` 置 false；HttpCode 200）。
- **响应**：`data` 为 `{ deleted: true, id }`

> `insertionOrder` 枚举：`before_history`（历史消息前）、`after_history`（历史消息后）、`before_current_user_input`（当前用户输入前）、`after_current_user_input`（当前用户输入后）。响应字段对应数据库 `position`，非法值归一化为 `before_history`。详见 [附录](./appendix.md#世界书注入位置insertionorder)。
