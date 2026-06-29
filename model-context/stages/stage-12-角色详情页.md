---
stage: 12
title: "角色详情页"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 12｜角色详情页

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 呈现完整角色信息与操作入口。
- 前置依赖: 阶段 11。
- 文件范围: CharacterDetailView.vue 。
- 本阶段要做: 展示字段、复制角色、开始会话入口占位。
- 本阶段不要做: 不做聊天页对接。
- 验收标准: 1. 角色详情可正常展示 2. 编辑/删除/复制/开始会话入口存在 3. 页面可读性良好
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 12|角色详情页
阶段目标: 呈现完整角色信息与操作入口。
前置依赖: 阶段 11。
文件范围: CharacterDetailView.vue 。
本阶段要做: 展示字段、复制角色、开始会话入口占位。
本阶段不要做: 不做聊天页对接。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 12 阶段开发。
项目背景:
角色详情页是“进入聊天前”的确认页面,需要清晰展示该角色的全部设定。
当前阶段:
第 12 阶段:角色详情页
前置条件:
- 已完成:角色创建/编辑页
- 当前已有目录:角色 views/components/api/store
- 当前已有模块:角色 CRUD 前后端
本阶段目标:
- 实现角色详情页
- 展示完整角色设定
- 提供编辑、删除、复制、开始会话入口
本阶段需要实现:
1. 创建角色详情页视图
2. 调用角色详情 API
3. 展示 description、personality、scenario、firstMessage、exampleMessages、
systemPrompt、tags、creatorNotes 等
4. 提供编辑按钮、删除按钮、复制按钮入口
5. 提供“开始聊天/新建会话”按钮占位跳转
涉及文件范围:
- apps/web/src/views/characters/CharacterDetailView.vue
- apps/web/src/api/characters.ts
- apps/web/src/stores/character.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现会话创建逻辑细节
- 不要实现头像上传
- 不要实现导入导出
- 不要把聊天逻辑写进角色详情页
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 信息分区清晰
- 长文本可读
- 操作按钮语义清晰
验收标准:
1. 角色详情可正常展示
2. 编辑/删除/复制/开始会话入口存在
3. 页面可读性良好
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
