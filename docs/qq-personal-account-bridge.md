# QQ 个人号接入使用手册

Tavern Lite 可以通过 NapCat 登录普通 QQ 账号，把 QQ 私聊作为现有聊天的外部入口。它不是 QQ 官方机器人，也不会创建第二套聊天历史。

## 同步规则

- 一个 QQ 好友只能绑定一个目标；一个目标也只能绑定一个 QQ 好友。
- 目标可以是一个酒馆 `Conversation`，也可以是一个 AI 角色 `Companion`。
- QQ 好友发来的文本会写入目标原有消息表，再调用原有聊天编排；网页、分享页和 QQ 看到的是同一条消息时间线。
- 网页端、分享端或 QQ 端触发的 AI 完整回复都会投递给当前绑定好友。
- 切换绑定只改变后续消息去向，不复制、合并或迁移历史。切换后尚未发送的旧目标投递会自动取消，防止串聊。
- 当前只接收普通好友私聊中的文本段。群聊、临时会话、图片、文件、语音、表情、撤回和 QQ 系统消息不会进入 AI 会话。

## 1. 启动服务

```bash
cp deploy/.env.example .env
# 按 deploy.md 配好 .env 后启动
docker compose up -d --build
docker compose ps
```

Compose 中的 NapCat 登录态和配置分别持久化到：

```text
data/napcat/qq
data/napcat/config
data/napcat/plugins
```

## 2. 登录普通 QQ 账号

1. 查看 NapCat 日志，获取首次 WebUI token：

   ```bash
   docker compose logs napcat
   ```

2. 本机部署直接打开 `http://127.0.0.1:6099/webui`；远程服务器先按下方命令建立 SSH 隧道，再打开同一地址。
3. 使用手机 QQ 扫码登录。建议先使用专门的小号完成验收。

6099 是管理口，Compose 默认只绑定服务器回环地址。远程服务器使用 SSH 隧道：

```bash
ssh -L 6099:127.0.0.1:6099 root@<服务器IP>
```

然后访问 `http://127.0.0.1:6099/webui`。

## 3. 配置 NapCat OneBot 网络

在 NapCat WebUI 的网络配置中新增并启用以下两项：

### HTTP Server

- Host：`0.0.0.0`
- Port：`3000`
- Access Token：自行生成并保存；也可先留空完成本机验收
- Message Format：`array`

Tavern 后端通过 Compose 内网访问 `http://napcat:3000`，因此宿主机不需要公开 3000 端口。

### HTTP Client / 事件上报

事件上报 URL 不能手填固定 token。先完成下一节的 QQ 账号创建，再复制页面生成的“事件回调地址”粘贴到这里，然后启用配置。

## 4. 在 Tavern 创建 QQ 接入

1. 登录 Tavern 主站，进入左侧“QQ 接入”。
2. 新建账号：
   - NapCat API 地址：`http://napcat:3000`
   - NapCat WebUI 地址：`http://127.0.0.1:6099/webui`（远程服务器配合 SSH 隧道）
   - Access Token：与 NapCat HTTP Server 一致；未配置则留空
3. 点击“测试连接”。成功后页面会显示 QQ 号和昵称。
4. 点击“复制回调”，把完整地址粘贴到 NapCat 的 HTTP Client / 事件上报 URL 并启用。
5. 再点击“刷新好友”。

回调地址由后端按账号生成并附带独立签名，不需要把 Tavern 登录 token 配到 NapCat。

## 5. 绑定好友和聊天

1. 在“新建绑定”区域选择 QQ 账号和好友。
2. 选择目标类型：
   - 酒馆会话：绑定已存在的一个 Conversation。
   - AI 角色：绑定一个 Companion 的唯一长期线程。
3. 保存后，从该好友发送一条普通文本。
4. Tavern 会把消息写入原聊天并触发 AI 回复；回复完成后自动发回该好友。

已有绑定可以直接“切换目标”或“解除”。若好友或目标已经被其他绑定占用，页面会拒绝保存并显示明确错误。

## 6. 故障定位

连接测试失败：

```bash
docker compose logs --tail=200 napcat
docker compose logs --tail=200 server
```

重点核对：

- NapCat 中 QQ 是否在线。
- HTTP Server 是否监听 `0.0.0.0:3000`。
- Tavern 中 Access Token 是否与 NapCat 一致。
- HTTP Client 回调 URL 是否完整复制，且 NapCat 容器能访问 `server:3100`。
- 好友消息是否为普通私聊文本，以及该好友是否已有启用绑定。
- 目标会话/AI 角色是否已配置可用模型链。

服务重启后，未完成的入站事件和出站投递会自动恢复。相同 OneBot `message_id` 只处理一次；出站长文本按块发送，并从最后成功块继续重试。

## 7. 数据和安全边界

- NapCat Access Token 使用与模型 API Key 相同的服务端加密密钥派生后，以 AES-256-GCM 加密存储；API 只返回掩码。
- QQ 事件入口使用账号级 HMAC 签名地址；删除账号会使旧地址立即失效。
- 不要把 3000、6099 暴露给公网。主站和 SSH 管理入口仍应使用 HTTPS、强密码和防火墙白名单。
- 普通 QQ 个人号接入依赖第三方客户端协议实现，QQ 客户端升级后可能需要升级 NapCat 镜像。升级前应备份 `data/napcat`。

只清理 Tavern 中的 QQ 接入数据：

```bash
bash scripts/reset-module-data.sh --module qq-bridge --check
bash scripts/reset-module-data.sh --module qq-bridge
```

该命令不会删除 NapCat 中的 QQ 登录状态；如需彻底退出账号，请同时在 NapCat WebUI 操作。
