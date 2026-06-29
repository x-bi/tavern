# prisma

NestJS Prisma 接入目录。

阶段 4 提供：

- `PrismaModule`：导出全局 Prisma provider。
- `PrismaService`：继承生成后的 `@prisma/client`，在 Nest 模块启动和销毁时连接/断开 SQLite。

数据库 schema 与 migration 位于项目根目录 `prisma/`。
