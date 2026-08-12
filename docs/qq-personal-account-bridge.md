# QQ 个人号接入使用手册

Tavern Lite 通过 NapCat 登录普通 QQ 账号，把 QQ 私聊作为现有聊天的外部入口。它不是 QQ 官方机器人，也不会创建第二套聊天历史。

## 同步规则

- 一个 QQ 好友只能绑定一个目标；一个目标也只能绑定一个 QQ 好友。
- 目标可以是酒馆 `Conversation`，也可以是 AI 角色 `Companion`。
- QQ 好友发来的文本会写入目标原有消息表，再调用原有聊天编排；网页、分享页和 QQ 使用同一条消息时间线。
- 网页端、分享端或 QQ 端触发的 AI 完整回复都会投递给当前绑定好友。
- 切换绑定只改变后续消息去向，不迁移历史；尚未发送的旧目标投递会自动取消。
- 当前只接收普通好友私聊中的文本段。群聊、图片、文件、语音、表情、撤回和系统消息不会进入 AI 会话。

## 1. 部署或更新服务

```bash
cp deploy/.env.example .env
# 按 docs/deploy.md 配好 .env
docker compose up -d --build
docker compose ps
```

Compose 会自动完成以下配置：

- NapCat OneBot HTTP API：`http://napcat:3000`，仅 Docker 内网可访问。
- NapCat 事件上报：`http://server:3100/api/qq/events/auto`，仅容器内网直连。
- QQ 登录二维码：由 NapCat 写入持久化目录，再由 Tavern 的管理员接口受控读取。
- NapCat 的 3000、6099 端口均不发布到宿主机或公网。

登录态和配置持久化到：

```text
data/napcat/qq
data/napcat/config
data/napcat/plugins
data/napcat/cache
```

## 2. 在公网主站扫码登录

1. 使用管理员账号登录 Tavern 主站。
2. 进入左侧“QQ 接入”。
3. 页面会直接显示 QQ 登录二维码，无需打开 `127.0.0.1:6099`。
4. 使用手机 QQ 扫码并确认登录。
5. 页面自动检测登录结果，并按登录 QQ 号创建或复用接入账号。
6. 登录成功后，账号会自动选中并读取好友列表。

二维码与自动登录接口只对 Tavern 管理员开放。一个 Compose 实例当前只运行一个 NapCat 登录账号。

## 3. 绑定好友和聊天

1. 在“创建一对一绑定”区域选择 QQ 账号和好友。
2. 选择目标类型：
   - 普通角色会话：绑定一个已存在的 `Conversation`。
   - AI 角色：绑定一个 `Companion` 的唯一长期线程。
3. 选择聊天目标并建立绑定。
4. 从该好友发送一条普通文本；Tavern 会写入原聊天、触发 AI 回复并发回该好友。

已有绑定可以“切换会话”或“解绑”。若好友或目标已被占用，页面会拒绝保存并返回明确错误。

## 4. 故障定位

页面长时间没有二维码：

```bash
docker compose ps
docker compose logs --tail=200 napcat
docker compose logs --tail=200 server
ls -l data/napcat/cache/qrcode.png
```

扫码后没有自动创建账号：

```bash
docker compose logs --tail=200 napcat
docker compose logs --tail=200 server
```

好友列表或消息同步失败时重点核对：

- NapCat 容器中的 QQ 是否仍在线。
- `deploy/napcat/tavern.json` 是否挂载成功，3000 HTTP Server 和自动 HTTP Client 是否启用。
- 好友消息是否为普通私聊文本，并已建立启用中的绑定。
- 目标会话或 AI 角色是否配置了可用模型链。

服务重启后，未完成的入站事件和出站投递会自动恢复。相同 OneBot `message_id` 只处理一次；长回复会分段发送，并从最后成功分段继续重试。

## 5. 数据和安全边界

- 二维码以 PNG Data URL 通过已登录管理员接口返回，不创建公开静态文件地址。
- 自动事件入口由主站 nginx 明确返回 404，只允许 NapCat 容器直连后端。
- 3000 和 6099 不映射到宿主机，公网无需额外开放端口。
- 手动添加的 NapCat Access Token 仍使用服务端 AES-256-GCM 加密存储，API 只返回掩码。
- 普通 QQ 个人号接入依赖第三方客户端协议实现，建议使用专用小号，并在升级 NapCat 镜像前备份 `data/napcat`。

只清理 Tavern 中的 QQ 接入数据：

```bash
bash scripts/reset-module-data.sh --module qq-bridge --check
bash scripts/reset-module-data.sh --module qq-bridge
```

该命令不会删除 `data/napcat/qq` 中的 QQ 登录状态。
