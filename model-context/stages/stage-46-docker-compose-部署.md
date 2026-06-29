---
stage: 46
title: "Docker Compose 部署"
wave: "deploy-and-acceptance"
wave_title: "部署、备份、回归与 MVP 验收"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 46｜Docker Compose 部署

## 快速读取

- 波次: 部署、备份、回归与 MVP 验收
- 阶段目标: 形成一键启动的轻量部署。
- 前置依赖: 阶段 45。
- 文件范围: docker-compose.yml 、Dockerfiles。
- 本阶段要做: 前后端容器化、volume 挂载、环境变量。
- 本阶段不要做: 不做 K8s。
- 验收标准: 1. docker compose up 可启动系统 2. SQLite 与 uploads 持久化正确 3. 部署文档可执行
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 部署命令 4. 验证方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 46|Docker Compose 部署
阶段目标: 形成一键启动的轻量部署。
前置依赖: 阶段 45。
文件范围: docker-compose.yml 、Dockerfiles。
本阶段要做: 前后端容器化、volume 挂载、环境变量。
本阶段不要做: 不做 K8s。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 46 阶段开发。
项目背景:
项目目标之一是轻量自托管,因此 Docker Compose 是 MVP 必需交付之一。
当前阶段:
第 46 阶段:Docker Compose 部署
前置条件:
- 已完成:核心功能页与 API、聊天闭环、设置与备份
- 当前已有目录:项目根目录、apps/web、apps/server、data
- 当前已有模块:前后端可本地开发运行
本阶段目标:
- 提供 Docker Compose 轻量部署方案
- 明确 SQLite 与 uploads volume
- 明确启动、更新、重启方式
本阶段需要实现:
1. 编写 docker-compose.yml
2. 如有需要编写前端和后端 Dockerfile
3. 配置环境变量注入
4. 挂载 SQLite 数据目录和 uploads 目录
5. 写清启动、停止、更新命令
6. 在 README 增加部署章节
涉及文件范围:
- docker-compose.yml
- apps/web/Dockerfile(如需要)
- apps/server/Dockerfile(如需要)
- README.md
- .env.example
本阶段明确不要做:
- 不要实现 Kubernetes
- 不要实现复杂 CI/CD
- 不要引入 Redis、PostgreSQL
- 不要把真实密钥写进 compose
- 不要改动业务逻辑
- 不要引入非 MVP 功能
代码要求:
- 配置清晰
- volume 和端口说明完整
- 适合本地和轻量服务器部署
验收标准:
1. docker compose up 可启动系统
2. SQLite 与 uploads 持久化正确
3. 部署文档可执行
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 部署命令
4. 验证方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
