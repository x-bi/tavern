# Tavern Lite 部署指南

适用于已安装 **宝塔面板 + Docker** 的云服务器。采用「全 Docker Compose」部署,前后端各自容器,SQLite 单机持久化。

## 架构

```
浏览器  http://<服务器IP>:8080
            │
   ┌────────▼────────┐
   │  web 容器(nginx) │  前端静态文件 + SPA fallback
   │   :80 -> 宿主 :8080│  /api /uploads 反代到 server
   └────────┬────────┘
            │
   ┌────────▼────────┐
   │ server 容器      │  NestJS,监听 0.0.0.0:3100
   │ (node:20-slim)  │  启动前自动 prisma migrate deploy
   └───┬─────────┬───┘
       │         │
   ./data    ./uploads   (宿主机目录挂载,持久化)
```

## 前置条件

- 云服务器已装 Docker + Docker Compose(宝塔「应用商店」搜 Docker 安装,或 `curl -fsSL https://get.docker.com | sh`)。
- 仓库已 push 到远程(git clone 用)。
- 云服务器安全组 + 宝塔防火墙放行 **8080** 端口。

## 部署步骤

### 1. 拉取代码

```bash
cd /opt
git clone <你的仓库地址> tavern
cd tavern
```

### 2. 配置环境变量

```bash
cp deploy/.env.example .env
# 生成随机密钥并写入 .env 的 AUTH_TOKEN_SECRET
openssl rand -hex 32
vi .env   # 把上面输出的值填到 AUTH_TOKEN_SECRET
```

> 若想开启登录密码,在 .env 设 `AUTH_REQUIRE_PASSWORD=true` 并填 `AUTH_SINGLE_USER_PASSWORD`。

### 3. 放行端口

- **云控制台安全组**:入方向放行 TCP 8080。
- **宝塔面板**:安全 -> 放行端口 8080。

### 4. 构建并启动

```bash
docker compose up -d --build
```

首次构建会拉取基础镜像并编译,约 3~8 分钟。完成后:

```bash
docker compose ps          # 两个服务都应是 running
docker compose logs -f server   # 看后端启动日志,migrate deploy 应成功
```

### 5. 首次写入演示数据

```bash
docker compose exec server pnpm db:seed
```

seed 幂等,可重复执行(不会重复写入)。

### 6. 访问

```
http://<服务器IP>:8080
```

默认用户名 `demo`(密码取决于 .env 配置)。

## 日常运维

### 更新代码

```bash
cd /opt/tavern
git pull
docker compose up -d --build
```

前端/后端镜像会重新构建,数据库数据不丢。

### 查看日志

```bash
docker compose logs -f           # 全部
docker compose logs -f server    # 仅后端
docker compose logs -f web       # 仅前端 nginx
```

### 备份与恢复

数据全在宿主机两个目录里,直接打包即可:

```bash
# 备份
cd /opt/tavern
tar -czf ../tavern-backup-$(date +%Y%m%d).tar.gz data uploads

# 恢复(停服后解压覆盖)
docker compose down
tar -xzf ../tavern-backup-XXXXXXXX.tar.gz
docker compose up -d
```

也可通过应用内的「备份/恢复」功能(后端 BackupsModule)导出 JSON。

各模块软删除数据的查询与恢复、物理删除边界，以及“清空全部业务数据但保留管理员账号”的完整操作，见 [数据库删除恢复与数据清理手册](database-data-recovery-and-reset.md)。

服务器需要硬删除管理员之外的全部数据时，可先执行 `bash scripts/reset-keep-admin.sh --admin <管理员用户名> --check`，检查通过后再去掉 `--check` 正式执行。

### 重置数据库

```bash
docker compose down
rm -f data/tavern-lite.db
docker compose up -d --build
# 启动时 migrate deploy 会重建表结构,再跑 seed:
docker compose exec server pnpm db:seed
```

## 端口说明

- 默认 `8080:80`:避开宝塔自带 nginx 占用的 80,立即可用。
- 想用 80:停掉宝塔 nginx(宝塔面板「软件商店」-> Nginx -> 停止,或 `systemctl stop nginx`),再把 [docker-compose.yml](../docker-compose.yml) 中 `"8080:80"` 改成 `"80:80"`。
- 想加 HTTPS + 域名:后续可在宝塔「网站」里建站点反代到 `127.0.0.1:8080`,并申请 Let's Encrypt 证书;或直接给 web 容器挂证书改 443。

## 文件清单

| 文件 | 作用 |
| --- | --- |
| `Dockerfile.server` | 后端镜像 |
| `Dockerfile.web` | 前端镜像(多阶段,nginx 托管) |
| `docker-compose.yml` | 编排 server + web |
| `nginx.conf` | 前端 nginx 配置(含 SSE 反代) |
| `docker-entrypoint.sh` | 后端启动脚本(migrate + start) |
| `.dockerignore` | 构建上下文排除规则 |
| `deploy/.env.example` | 环境变量模板 |

## 常见问题

**Q: 启动报 `AUTH_TOKEN_SECRET 必须在 .env 中设置`?**
A: 没配 .env 或 AUTH_TOKEN_SECRET 留了默认占位。按步骤 2 生成并填入。

**Q: 访问页面 502 Bad Gateway?**
A: 后端还没起来或已退出。`docker compose logs server` 看报错,常见是环境变量校验失败(见 [env.validation.ts](../apps/server/src/config/env.validation.ts))。

**Q: 聊天流式不输出(一直转圈)?**
A: 若自行改过 nginx,确认 `/api/` 反代段保留 `proxy_buffering off;`([nginx.conf](../nginx.conf))。

**Q: 端口 80 被占用?**
A: 宝塔 nginx 在用。用 8080,或停掉宝塔 nginx 再改用 80(见上「端口说明」)。
# 外部分享端口

当前无域名部署使用端口区分：主站 `8080`，独立分享站 `8081`。在 `.env` 中显式设置：

```env
SHARE_PUBLIC_BASE_URL=http://<公网IP>:8081
CORS_ORIGINS=http://<公网IP>:8081
```

防火墙/安全组需开放 `8081`。`share-web` 的 nginx 只反代 `/api/public/`，不会暴露主站 `/api/` 管理接口。获得正式域名后，将上述两个值改为分享域名并在反代层分别绑定主站和分享站。
