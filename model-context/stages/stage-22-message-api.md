---
stage: 22
title: "Message API"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 22｜Message API

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 建立消息读取与编辑基础。
- 前置依赖: 阶段 21。
- 文件范围: messages/* 。
- 本阶段要做: 查询消息、更新、删除、重新生成占位。
- 本阶段不要做: 不实现真正 regenerate。
- 验收标准: 1. 能查询会话消息 2. 能编辑和删除消息 3. regenerate 接口有清晰占位语义
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口列表 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 22|Message API
阶段目标: 建立消息读取与编辑基础。
前置依赖: 阶段 21。
文件范围: messages/* 。
本阶段要做: 查询消息、更新、删除、重新生成占位。
本阶段不要做: 不实现真正 regenerate。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 22 阶段开发。
项目背景:
聊天页需要先有消息查询、编辑、删除能力,后续再接流式输出与重新生成。
当前阶段:
第 22 阶段:Message API
前置条件:
- 已完成:Conversation API
- 当前已有目录:messages 模块占位
- 当前已有模块:Conversations、Characters、Auth、Prisma
本阶段目标:
- 实现会话消息查询
- 实现消息编辑与删除
- 为重新生成预留接口
本阶段需要实现:
1. 创建 MessagesModule、Controller、Service、DTO
2. 实现 GET /api/conversations/:id/messages
3. 实现 PUT /api/messages/:id
4. 实现 DELETE /api/messages/:id
5. 实现 POST /api/messages/:id/regenerate 的占位或最小版本入口
6. 对用户只能操作自己的消息做校验
涉及文件范围:
- apps/server/src/modules/messages/*
- packages/shared/*
本阶段明确不要做:
- 不要调用模型生成回复
- 不要实现流式 SSE
- 不要把 Prompt Builder 放进消息模块
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入 Redis、向量数据库、机器人、TTS、图片生成等
代码要求:
- role/status 字段处理清晰
- 编辑与删除行为可维护
- 查询支持按时间排序
验收标准:
1. 能查询会话消息
2. 能编辑和删除消息
3. regenerate 接口有清晰占位语义
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
