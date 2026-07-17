← [返回目录](./README.md)

# 模型配置 (models)

三个子控制器均类级 `@UseGuards(AuthGuard, SharedModelsGuard)`，按共享管理员归属管理。**所有涉及 `apiKey` 的响应字段均掩码返回**（如 `sk-****abcd`）。

## GET /api/model-providers
- **说明**：分页查询模型供应商账号列表。
- **查询参数**（`QueryModelResourcesDto`）：

  | 字段 | 类型 | 必填 | 校验/默认 |
  |---|---|---|---|
  | page | number | 否 | int ≥1，默认 1 |
  | pageSize | number | 否 | int 1~100，默认 20 |
  | search | string | 否 | `@MaxLength(120)`；匹配 name/provider/model/baseUrl |
  | isEnabled | boolean | 否 | 'true'/'false' 转布尔 |

- **响应**：`data` 为分页对象，`apiKey` 掩码

## POST /api/model-providers
- **说明**：创建模型供应商账号（保存 Base URL、API Key、公共超时）。
- **请求体**（`CreateModelProviderDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | name | string | 是 | `@MaxLength(120)`；账号显示名 |
  | providerName | string | 是 | `@MaxLength(80)`；供应商标识名 |
  | baseUrl | string | 是 | `@MaxLength(500)`；合法 http/https URL |
  | apiKey | string \| null | 否 | `@MaxLength(4096)` |
  | timeout | number \| null | 否 | int 1000~600000（ms） |
  | isDefault | boolean | 否 | 是否设为默认账号 |
  | isEnabled | boolean | 否 | 是否启用 |

- **响应**：`data` 为新建账号，`apiKey` 掩码

## PUT /api/model-providers/:id
- **路径参数**：`id: string`
- **说明**：更新供应商账号；`apiKey` 不传保持原值，传 null 清空。
- **请求体**：`UpdateModelProviderDto`（字段同上，全可选）
- **响应**：`data` 为更新后账号，`apiKey` 掩码

## DELETE /api/model-providers/:id
- **路径参数**：`id: string`
- **说明**：删除供应商账号（HttpCode 200）。
- **响应**：`data` 为删除结果

## GET /api/model-providers/:id/models
- **路径参数**：`id: string`（供应商账号 ID）
- **说明**：分页查询指定供应商下的模型列表。
- **查询参数**：`QueryModelResourcesDto`（同上）
- **响应**：`data` 为分页对象

## GET /api/provider-models
- **说明**：分页查询所有供应商模型列表。
- **查询参数**：`QueryModelResourcesDto`
- **响应**：`data` 为分页对象，关联供应商 `apiKey` 掩码

## POST /api/provider-models
- **说明**：在指定供应商下新建模型配置。
- **请求体**（`CreateProviderModelDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | providerId | string | 是 | `@MaxLength(128)`；所属供应商账号 ID |
  | name | string | 是 | `@MaxLength(120)`；模型显示名 |
  | modelName | string | 是 | `@MaxLength(160)`；调用上游时使用的模型名 |
  | temperature | number \| null | 否 | 0~2 |
  | topP | number \| null | 否 | 0~1 |
  | maxTokens | number \| null | 否 | int 1~200000 |
  | timeout | number \| null | 否 | int 1000~600000（ms） |
  | contextLength | number \| null | 否 | int 1~2000000 |
  | notes | string \| null | 否 | `@MaxLength(500)` |
  | sortOrder | number | 否 | int 0~100000 |
  | isEnabled | boolean | 否 | 是否启用 |

- **响应**：`data` 为新建模型配置，关联 `apiKey` 掩码

## POST /api/provider-models/:id/test
- **路径参数**：`id: string`
- **说明**：对指定模型配置发起连通性/可用性测试（HttpCode 200）。
- **响应**：`data` 为测试结果（成功状态、延迟、错误信息等）

## PUT /api/provider-models/:id
- **路径参数**：`id: string`
- **说明**：更新指定模型配置（全可选）。
- **请求体**：`UpdateProviderModelDto`（字段同上，全可选）
- **响应**：`data` 为更新后配置，`apiKey` 掩码

## DELETE /api/provider-models/:id
- **路径参数**：`id: string`
- **说明**：删除模型配置（HttpCode 200）。
- **响应**：`data` 为删除结果

## GET /api/model-fallback-groups
- **说明**：分页查询模型链（降级组）列表。
- **查询参数**：`QueryModelResourcesDto`
- **响应**：`data` 为分页对象，item 含候选模型列表（关联 `apiKey` 掩码）

## POST /api/model-fallback-groups
- **说明**：创建模型链（降级组），携带候选模型列表。
- **请求体**（`CreateModelFallbackGroupDto`）：

  | 字段 | 类型 | 必填 | 校验规则 + 注释 |
  |---|---|---|---|
  | name | string | 是 | `@MaxLength(120)` |
  | isDefault | boolean | 否 | 是否设为默认 |
  | isEnabled | boolean | 否 | 是否启用 |
  | candidates | ModelFallbackCandidateDto[] | 是 | max 50 项；候选模型列表 |

  `ModelFallbackCandidateDto`：`{ modelId: string(@MaxLength(128)), priority: number(int 1~1000，越小越优先), isEnabled?: boolean }`

- **响应**：`data` 为新建模型链（含 candidates）

## PUT /api/model-fallback-groups/:id
- **路径参数**：`id: string`
- **说明**：更新模型链；`candidates` 传入时整体替换。
- **请求体**：`UpdateModelFallbackGroupDto`（字段同上，全可选；`candidates` 整体替换）
- **响应**：`data` 为更新后模型链

## DELETE /api/model-fallback-groups/:id
- **路径参数**：`id: string`
- **说明**：删除模型链（HttpCode 200）。
- **响应**：`data` 为删除结果
