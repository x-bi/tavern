# data

本目录用于存放本地运行时数据。

约束：

- SQLite 默认数据库文件为 `data/tavern-lite.db`，由 `DATABASE_URL="file:../data/tavern-lite.db"` 配置。
- 不提交真实 SQLite 数据库文件。
- 不提交备份包、用户聊天记录或 API Key。
- 本目录是后续备份脚本的主要输入之一，迁移或部署时应整体保留。
