#!/bin/sh
# Tavern Lite 后端启动入口
# 职责:确保数据目录 -> 应用数据库迁移 -> 启动 NestJS
set -e

# 持久化目录由 docker compose 挂载;保险起见确保存在
mkdir -p /app/data /app/uploads

# SQLite 文件不存在时先创建空文件
# (migrate deploy 对不存在的 db 文件通常能自动创建,但显式 touch 更稳)
if [ ! -f /app/data/tavern-lite.db ]; then
  touch /app/data/tavern-lite.db
fi

# 应用已存在的迁移(生产安全方式,不会生成新迁移)
echo "[entrypoint] applying prisma migrations..."
pnpm exec prisma migrate deploy --schema prisma/schema.prisma

# 启动后端(exec 让 node 接管 PID 1,正确接收 SIGTERM 优雅退出)
echo "[entrypoint] starting tavern server..."
exec node apps/server/dist/main.js
