---
stage: 42
title: "角色卡 JSON 导出"
wave: "content-enhancement"
wave_title: "世界书、导入导出与设置"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 42｜角色卡 JSON 导出

## 快速读取

- 波次: 世界书、导入导出与设置
- 阶段目标: 支持导出成可备份、可迁移的角色卡 JSON。
- 前置依赖: 阶段 41。
- 文件范围: characters/export 。
- 本阶段要做: 导出字段映射。
- 本阶段不要做: 不导出 PNG。
- 验收标准: 1. 角色可导出为 JSON 2. 导出字段与内部数据一致 3. 导出文件可再次导入使用
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 如何测试导出 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 42|角色卡 JSON 导出
阶段目标: 支持导出成可备份、可迁移的角色卡 JSON。
前置依赖: 阶段 41。
文件范围: characters/export 。
本阶段要做: 导出字段映射。
本阶段不要做: 不导出 PNG。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 42 阶段开发。
项目背景:
角色导出是备份和跨系统迁移的重要能力。
当前阶段:
第 42 阶段:角色卡 JSON 导出
前置条件:
- 已完成:角色卡 JSON 导入
- 当前已有目录:characters 模块、角色详情页
- 当前已有模块:角色 CRUD
本阶段目标:
- 支持角色卡 JSON 导出
- 字段尽量兼容 Tavern / SillyTavern 常见格式
- 提供前端下载入口
本阶段需要实现:
1. 后端实现 GET /api/characters/:id/export
2. 将内部字段映射到常见 JSON 角色卡字段
3. 保留 metadata 与必要兼容字段
4. 前端在角色详情页提供导出按钮
5. 文件名合理,包含角色名
涉及文件范围:
- apps/server/src/modules/characters/*
- apps/web/src/views/characters/CharacterDetailView.vue
- apps/web/src/api/characters.ts
- packages/shared/*
本阶段明确不要做:
- 不要实现 PNG 导出
- 不要把敏感系统配置打包进导出文件
- 不要实现批量导出复杂压缩包
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 导出格式清晰
- 与导入字段映射相互对应
- 前端下载体验简单稳定
验收标准:
1. 角色可导出为 JSON
2. 导出字段与内部数据一致
3. 导出文件可再次导入使用
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试导出
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
