---
stage: 17
title: "PromptPreset API"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 17｜PromptPreset API

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 为模型参数预设建立后端 CRUD。
- 前置依赖: 阶段 8。
- 文件范围: presets/* 。
- 本阶段要做: 参数预设实体 CRUD。
- 本阶段不要做: 不做复杂继承。
- 验收标准: 1. 预设 CRUD 可用 2. 参数字段完整 3. 默认预设处理合理
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 接口列表 4. 测试方式 5. 已完成内容 6. 未完成内容 7. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 17|PromptPreset API
阶段目标: 为模型参数预设建立后端 CRUD。
前置依赖: 阶段 8。
文件范围: presets/* 。
本阶段要做: 参数预设实体 CRUD。
本阶段不要做: 不做复杂继承。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 17 阶段开发。
项目背景:
PromptPreset 用于保存温度、topP、maxTokens 以及可能的输出风格约束,便于聊天页切换。
当前阶段:
第 17 阶段:PromptPreset API
前置条件:
- 已完成:统一响应与错误处理
- 当前已有目录:presets 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 提供参数预设 CRUD
- 与模型配置分离
- 支持默认预设概念
本阶段需要实现:
1. 创建 PresetsModule、Controller、Service、DTO
2. 实现 GET /api/prompt-presets
3. 实现 POST /api/prompt-presets
4. 实现 PUT /api/prompt-presets/:id
5. 实现 DELETE /api/prompt-presets/:id
6. 预留 set-default 或 isDefault 字段处理
涉及文件范围:
- apps/server/src/modules/presets/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 Prompt Builder 具体拼接
- 不要把系统级 Prompt 内容写入预设逻辑
- 不要改动聊天接口
- 不要暴露 API Key
- 不要硬编码 Prompt 到组件
- 不要引入 Redis、向量数据库、市场、支付、机器人、TTS、图片生成
代码要求:
- DTO 清晰
- 响应统一
- 用户数据隔离
验收标准:
1. 预设 CRUD 可用
2. 参数字段完整
3. 默认预设处理合理
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
```
