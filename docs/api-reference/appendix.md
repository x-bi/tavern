← [返回目录](./README.md)

# 附录：错误码与状态机

## 常见错误码

| 错误码 | 触发场景 | HTTP |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 登录密码错误 | 401 |
| `USER_BUILT_IN_PROTECTED` | 修改/删除内置账号的受保护字段 | 403 |
| `USER_LAST_ADMIN_PROTECTED` | 降级/删除最后一个管理员 | 403 |
| `USER_SELF_ROLE_CHANGE_FORBIDDEN` | 当前账号把自己降级为 member | 403 |
| `USER_SELF_DELETE_FORBIDDEN` | 删除当前登录账号 | 403 |
| `CHARACTER_DUPLICATE_NOT_IMPLEMENTED` | 角色复制接口未实现 | 501 |
| `ASSET_UNSUPPORTED_TYPE` | 上传文件 MIME 不在白名单 | 415 |
| `INSERTION_ORDER_ALIAS_NORMALIZED` | 世界书导入旧命名归一化（warning，非错误） | - |

> 未在表中列出的业务错误（如资源不存在 404、名称冲突 409、校验失败 400、未授权 401/403 等）均走统一响应 `error.code`；供应商原始错误不透传给前端。

## 消息状态机（Message.status）

应用层约束（schema 层为字符串默认 `complete`）：

| 状态 | 含义 |
|---|---|
| `generating` | assistant 回复占位，流式生成中 |
| `complete` | 生成完成 |
| `failed` | 生成失败 |
| `stopped` | 客户端中断 |
| `deleted` | 软删除（`status: deleted` + `deletedAt`） |
| `edited` | 仅 `role === 'user'` 消息编辑后标记 |

重新生成在事务内软删原 assistant、新建占位，metadata 双向记录 `regenerateOfMessageId` / `regeneratedByMessageId`。

## AI 角色长期记忆状态（CompanionMemory.status）

| 状态 | 含义 | 是否注入 |
|---|---|---|
| `pending` | 等待首次总结 | 继续注入最后有效版本 |
| `updating` | 正在总结/刷新 | 继续注入最后有效版本 |
| `failed` | 总结失败（附 `lastError`） | 继续注入最后有效版本 |
| `stale` | 失效 | **停止注入**，需从安全检查点分块重建 |

## 聊天会话并发约束

- 同一会话同一时间只允许一个生成任务（进程内会话生成锁 `ChatService.conversationTasks`）。
- 停止生成必须能关闭上游请求（`AbortController`）并保存可解释状态。
- 写入保持短事务，避免长时间持有 SQLite 锁。

## 世界书注入位置（insertionOrder）

| 值 | 含义 |
|---|---|
| `before_history` | 最近历史消息前 |
| `after_history` | 最近历史消息后 |
| `before_current_user_input` | 当前用户输入前 |
| `after_current_user_input` | 当前用户输入后 |

---

> 说明：本文档为接口契约快照，DTO 字段、校验规则与错误码以 `apps/server` 源码为准。DTO 变更需同步更新前端 API 类型与本文档。
