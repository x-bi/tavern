← [返回目录](./README.md)

# 认证与用户管理 (auth / admin-users)

## POST /api/auth/login
- **鉴权**：公开（无 Guard）
- **说明**：用户名密码登录，签发 Bearer 访问令牌。仅预置账号可登录，密码错误返回 401（`AUTH_INVALID_CREDENTIALS`）。
- **请求体**：`LoginDto`

  | 字段 | 类型 | 必填 | 校验规则 |
  |---|---|---|---|
  | username | string | 是 | `@IsString` `@MaxLength(64)` |
  | password | string | 是 | `@IsString` `@MaxLength(256)` |

- **响应**：`data` 为
  ```ts
  {
    user: { id, username, displayName, role: 'admin' | 'member' },
    accessToken: string,
    tokenType: 'Bearer',
    expiresAt: string  // ISO
  }
  ```

## GET /api/auth/me
- **鉴权**：`AuthGuard`
- **说明**：获取当前登录用户最新信息；用户被禁用/删除返回 401。
- **响应**：`data` 为 `{ id, username, displayName, role: 'admin' | 'member' }`

## POST /api/auth/logout
- **鉴权**：`AuthGuard`
- **说明**：登出占位接口（服务端不维护 session，前端丢弃 token 即可）。
- **响应**：`data` 为 `{ loggedOut: true }`

## GET /api/admin/users
- **鉴权**：`AuthGuard` + 方法内 `role === 'admin'`（否则 403）
- **说明**：列出所有启用中的成员账号（含内置账号）。
- **响应**：`data` 为 `{ items: ManagedUser[], total, page: 1, pageSize }`

  `ManagedUser`：`{ id, username, displayName, role: 'admin'|'member', isActive, createdAt, updatedAt, isBuiltIn }`

## GET /api/admin/users/:id
- **鉴权**：`AuthGuard` + `admin`（否则 403）
- **说明**：获取指定成员账号详情（含已禁用，仅按 `deletedAt` 过滤）；不存在返回 404。
- **路径参数**：`id: string`
- **响应**：`data` 为 `ManagedUser`

## POST /api/admin/users
- **鉴权**：`AuthGuard` + `admin`（否则 403）
- **说明**：创建成员账号；用户名冲突返回 409。
- **请求体**：`CreateManagedUserDto`

  | 字段 | 类型 | 必填 | 校验规则 |
  |---|---|---|---|
  | username | string | 是 | `@Matches(/^[a-zA-Z0-9_.-]{3,64}$/)` |
  | displayName | string | 是 | `@MinLength(1)` `@MaxLength(64)` |
  | password | string | 是 | `@MinLength(4)` `@MaxLength(256)` |
  | role | `'admin' \| 'member'` | 是 | `@IsIn(['admin','member'])` |

- **响应**：`data` 为新建 `ManagedUser`

## PUT /api/admin/users/:id
- **鉴权**：`AuthGuard` + `admin`（否则 403）
- **说明**：更新成员账号（仅传入字段更新）。内置账号 `username`/`role` 不可改（403 `USER_BUILT_IN_PROTECTED`）；降级最后一个管理员返回 403（`USER_LAST_ADMIN_PROTECTED`）；不能把自己降级（403 `USER_SELF_ROLE_CHANGE_FORBIDDEN`）。
- **路径参数**：`id: string`
- **请求体**：`UpdateManagedUserDto`（全可选）

  | 字段 | 类型 | 必填 | 校验规则 |
  |---|---|---|---|
  | username | string | 否 | `@Matches(/^[a-zA-Z0-9_.-]{3,64}$/)` |
  | displayName | string | 否 | `@MinLength(1)` `@MaxLength(64)` |
  | password | string | 否 | `@MinLength(4)` `@MaxLength(256)` |
  | role | `'admin' \| 'member'` | 否 | `@IsIn(['admin','member'])` |

- **响应**：`data` 为更新后的 `ManagedUser`

## DELETE /api/admin/users/:id
- **鉴权**：`AuthGuard` + `admin`（否则 403）
- **说明**：软删除成员账号（`isActive=false` + `deletedAt`）。不能删当前账号（403 `USER_SELF_DELETE_FORBIDDEN`）、内置账号（403 `USER_BUILT_IN_PROTECTED`）、最后一个管理员（403 `USER_LAST_ADMIN_PROTECTED`）。
- **路径参数**：`id: string`
- **响应**：`data` 为 `{ deleted: true, id }`
