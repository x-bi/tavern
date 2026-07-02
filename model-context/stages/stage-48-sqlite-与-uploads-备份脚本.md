---
stage: 48
title: "SQLite 与 uploads 备份脚本"
wave: "deploy-and-acceptance"
wave_title: "部署、备份、回归与 MVP 验收"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 48｜SQLite 与 uploads 备份脚本

## 快速读取

- 波次: 部署、备份、回归与 MVP 验收
- 阶段目标: 提供运维级本地备份脚本。
- 前置依赖: 阶段 46、阶段 47。
- 文件范围: scripts/backup.* 、 scripts/restore.* 。
- 本阶段要做: 脚本化备份与恢复说明。
- 本阶段不要做: 不做远程对象存储同步。
- 验收标准: 1. 可执行备份脚本 2. 备份产物包含 SQLite 与 uploads 3. 恢复流程文档清楚
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 脚本执行方式 4. 验证方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 48|SQLite 与 uploads 备份脚本
阶段目标: 提供运维级本地备份脚本。
前置依赖: 阶段 46、阶段 47。
文件范围: scripts/backup.* 、 scripts/restore.* 。
本阶段要做: 脚本化备份与恢复说明。
本阶段不要做: 不做远程对象存储同步。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 48 阶段开发。
项目背景:
除了应用逻辑导出外,还需要操作层面的 SQLite + uploads 目录备份脚本,便于真实运维。
当前阶段:
第 48 阶段:SQLite / uploads 备份脚本
前置条件:
- 已完成:Docker Compose、静态托管
- 当前已有目录:scripts、data、uploads
- 当前已有模块:应用级导入导出
本阶段目标:
- 提供 SQLite 文件与 uploads 目录的备份脚本
- 提供恢复流程说明
- 适合本地或轻量服务器执行
本阶段需要实现:
1. 编写备份脚本,将 SQLite 文件和 uploads 目录打包到带时间戳的备份目录
2. 编写恢复说明或恢复脚本
3. 在 README 中补充使用说明
4. 说明运行前后需要停止服务还是短暂停写的建议
涉及文件范围:
- scripts/backup.sh 或 backup.mjs
- scripts/restore.sh 或 restore.mjs
- README.md
- docs/*
本阶段明确不要做:
- 不要实现云同步
- 不要实现加密压缩体系的复杂版本
- 不要改动业务模块
- 不要写死平台专属命令而不说明兼容性
- 不要引入非 MVP 功能
代码要求:
- 脚本简单可靠
- 路径明确
- 日志输出清晰
验收标准:
1. 可执行备份脚本
2. 备份产物包含 SQLite 与 uploads
3. 恢复流程文档清楚
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 脚本执行方式
4. 验证方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
