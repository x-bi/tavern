# Tavern Lite 服务端接口文档

> 基于 `apps/server` 源码整理，覆盖全部 NestJS Controller。最后更新：2026-07-17。
> 项目说明与架构约束以根目录 `AGENTS.md` 为准；统一响应结构另见 [api-response.md](../api-response.md)。

## 目录

- [全局约定](#全局约定)
- [认证与用户管理 (auth / admin-users)](./auth.md)
- [角色 (characters)](./characters.md)
- [模型配置 (models)](./models.md)
- [会话 (conversations) / 消息 (messages)](./conversations.md)
- [参数预设 (presets) / 用户 Persona (personas)](./presets-personas.md)
- [世界书 (world-books)](./world-books.md)
- [Prompt 预览 (prompts) / 聊天流 (chat)](./prompts-chat.md)
- [资产 (assets) / 内容包 (content-packs)](./assets-content-packs.md)
- [备份恢复 (backups) / 本地设置 (settings) / 健康检查 (health)](./backups-settings-health.md)
- [AI 角色 (companions) / AI 角色消息 (companion-messages)](./companions.md)
- [AI 角色聊天流 (companion-chat) / AI 角色长期记忆 (companion-memory)](./companion-chat-memory.md)
- [认证态分享 (shares) / 公共分享 (public-shares)](./shares.md)
- [附录：错误码与状态机](./appendix.md)

---

## 全局约定

### 基础信息

| 项 | 值 |
|---|---|
| 框架 | NestJS + TypeScript + Prisma + SQLite |
| 全局路由前缀 | `/api`（环境变量 `API_PREFIX`，默认 `api`） |
| 默认监听 | `127.0.0.1:3100`（`SERVER_HOST` / `SERVER_PORT`） |
| 请求体上限 | `REQUEST_BODY_LIMIT`，默认 `5mb`（JSON / urlencoded） |
| CORS | 允许 `CORS_ORIGINS` 来源，`credentials: true` |
| 静态资源 | `uploads/` 目录映射到 `/uploads/` 路径 |
| 全局管道 | `ValidationPipe`：`transform: true` + `whitelist: true`（自动剥离多余字段、转 DTO 实例） |

完整路径 = `/api` + 控制器 `@Controller(path)` 前缀 + 方法路由。下文所有路径均已包含 `/api` 前缀。

### 鉴权

- 认证模式：**`preset_users`**--仅环境变量 `AUTH_PRESET_USERS_JSON` 预置账号可登录，**无注册、无免密/单用户兜底**。
- 登录签发 Bearer 访问令牌，后续请求需携带请求头：

  ```
  Authorization: Bearer <accessToken>
  ```

- `AuthGuard` 解析 token 并把当前用户写入 `request.currentUser`，控制器通过 `@CurrentUser()` 装饰器注入。token 缺失/无效/用户不存在一律返回 **401**。
- 可选请求头 `x-tavern-act-as: <userId>`：管理员代操作（仅 `admin` 可用，目标须存在且启用；普通账号使用返回 403）。
- 模型管理接口统一挂 `SharedModelsGuard`：切换为共享管理员归属，不按登录账号分库。
- 权限二次校验：`admin-users` 等控制器在方法体内强制 `role === 'admin'`，否则 **403**。

### 统一响应

除 SSE 流式接口和文件下载外，所有 REST 接口返回统一结构（由全局 `ApiResponseInterceptor` 自动包装）：

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: null | {
    code: string;     // 稳定错误码
    message: string;
    details?: unknown;
  };
};
```

- 成功：`success: true`、`data` 有值、`error: null`。
- 失败：`success: false`、`data: null`、`error.code` 稳定。全局 `ApiExceptionFilter` 统一转换异常。
- 标注 `@SkipResponseWrap()` 或请求头 `Accept: text/event-stream`（SSE 客户端）的方法**跳过包装**，原样返回。

### SSE 流式

聊天与事件同步接口使用 Server-Sent Events，**不**经过统一响应包装。单帧格式：

```text
event: <type>
data: <json>

```

聊天流标准事件类型：

| 事件 | data 结构 | 说明 |
|---|---|---|
| `delta` | `{ text }` | 增量文本片段 |
| `done` | `{ messageId, finishReason }` | 生成完成 |
| `error` | `{ code, message }` | 生成失败（统一错误码） |
| `ping` | - | 心跳保活 |

前端必须用 `fetch()` 发 POST 并读取 `response.body` 的 `ReadableStream` 自行解析，**不要**用原生 `EventSource`（无法携带 JSON body）。事件同步类 SSE（如 `shares/events`）可用 GET。

### 分页约定

列表响应统一结构：

```ts
{ items: T[]; total: number; page: number; pageSize: number }
```

- `page` 从 `1` 开始；`pageSize` 通常 `1~100`（消息可达 200）。
- 时间字段统一 ISO 字符串；ID 统一字符串。

### 安全与敏感内容

- **API Key**：只存后端，返回模型配置时掩码（如 `sk-****abcd`），不进前端响应/日志/Prompt/备份。
- **敏感内容**：角色卡、Persona、世界书、预设均带 `isSensitive` 标记；默认仅返回 `isSensitive=false` 的资源，除非用户设置 `showSensitiveContent=true`。
- **备份**：逻辑 JSON 备份不含 API Key、uploads 二进制；敏感设置值脱敏为 `null`。
- **文件上传**：入口在后端，文件名由后端生成，校验大小/扩展名/MIME；头像限图片，角色卡/内容包导入限 JSON。

---

> 各模块接口见上方目录。错误码与状态机见 [附录](./appendix.md)。
