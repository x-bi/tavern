---
stage: 41
title: "角色卡 JSON 导入"
wave: "content-enhancement"
wave_title: "世界书、导入导出与设置"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 41｜角色卡 JSON 导入

## 快速读取

- 波次: 世界书、导入导出与设置
- 阶段目标: 支持从 Tavern/SillyTavern 常见字段导入角色。
- 前置依赖: 阶段 9、阶段 11。
- 文件范围: characters/import 、前端导入入口。
- 本阶段要做: 上传 JSON、映射字段、导入预览。
- 本阶段不要做: 不做 PNG 角色卡。
- 验收标准: 1. 可导入常见 JSON 角色卡 2. 核心字段映射正确 3. 重名和错误格式有清晰提示
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 如何测试导入 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 41|角色卡 JSON 导入
阶段目标: 支持从 Tavern/SillyTavern 常见字段导入角色。
前置依赖: 阶段 9、阶段 11。
文件范围: characters/import 、前端导入入口。
本阶段要做: 上传 JSON、映射字段、导入预览。
本阶段不要做: 不做 PNG 角色卡。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 41 阶段开发。
项目背景:
角色卡 JSON 导入是提升可用性的关键功能,但第一版只做 JSON,不做 PNG 角色卡。
当前阶段:
第 41 阶段:角色卡 JSON 导入
前置条件:
- 已完成:角色 CRUD、角色编辑页
- 当前已有目录:characters 模块、角色前端页面
- 当前已有模块:Assets 上传基础(如已完成)
本阶段目标:
- 支持导入常见角色卡 JSON
- 建立字段映射
- 给出导入预览和错误提示
本阶段需要实现:
1. 后端实现 POST /api/characters/import
2. 兼容常见字段映射:first_mes -> firstMessage、mes_example -> exampleMessages、
creator_notes -> creatorNotes 等
3. 处理 description、personality、scenario、system_prompt 等常见字段
4. 对不兼容字段放入 metadata 或忽略并提示
5. 前端提供 JSON 文件选择与导入预览入口
6. 默认不覆盖已有角色,重名时给出策略提示
涉及文件范围:
- apps/server/src/modules/characters/*
- apps/web/src/views/characters/*
- apps/web/src/api/characters.ts
- packages/shared/*
本阶段明确不要做:
- 不要实现 PNG 角色卡解析
- 不要覆盖已有角色而不提示
- 不要实现批量导入过度复杂流程
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 字段映射清晰集中
- 导入错误可解释
- 元数据保留策略清晰
验收标准:
1. 可导入常见 JSON 角色卡
2. 核心字段映射正确
3. 重名和错误格式有清晰提示
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试导入
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
