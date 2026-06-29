---
stage: 11
title: "角色创建与编辑页"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 11｜角色创建与编辑页

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 落地 CharacterEditor 表单。
- 前置依赖: 阶段 10。
- 文件范围: views/characters/* 、 components/CharacterEditor.vue 。
- 本阶段要做: 创建/编辑表单、保存、校验。
- 本阶段不要做: 不做头像上传。
- 验收标准: 1. 可以创建角色 2. 可以编辑角色 3. 表单校验有效 4. 成功/失败反馈清晰
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 11|角色创建与编辑页
阶段目标: 落地 CharacterEditor 表单。
前置依赖: 阶段 10。
文件范围: views/characters/* 、 components/CharacterEditor.vue 。
本阶段要做: 创建/编辑表单、保存、校验。
本阶段不要做: 不做头像上传。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 11 阶段开发。
项目背景:
角色创建和编辑是酒馆系统的核心生产入口,需要覆盖名称、描述、人格、场景、开场白、示例对话、系
统提示、标签等字段。
当前阶段:
第 11 阶段:角色创建 / 编辑页
前置条件:
- 已完成:角色列表页
- 当前已有目录:角色 views、components、api、stores
- 当前已有模块:角色列表和角色 API
本阶段目标:
- 实现角色创建页和角色编辑页
- 复用 CharacterEditor 表单组件
- 和角色创建/更新 API 对接
本阶段需要实现:
1. 创建 CharacterEditor.vue
2. 创建 CharacterCreateView.vue 与 CharacterEditView.vue
3. 表单字段覆盖核心角色卡字段
4. 完成创建与更新提交
5. 加入基础表单校验
6. 提交成功后跳转详情页或列表页
7. 失败时展示清晰错误信息
涉及文件范围:
- apps/web/src/components/CharacterEditor.vue
- apps/web/src/views/characters/CharacterCreateView.vue
- apps/web/src/views/characters/CharacterEditView.vue
- apps/web/src/api/characters.ts
- apps/web/src/stores/character.ts
- apps/web/src/types/*
本阶段明确不要做:
- 不要实现头像上传
- 不要实现 JSON 导入导出
- 不要实现世界书关联 UI
- 不要实现聊天逻辑
- 不要在表单组件中硬编码 Prompt 规则
- 不要暴露 API Key
- 不要引入 Redis、向量数据库、市场、支付、机器人、TTS、图片生成
代码要求:
- 表单组件可复用
- 创建与编辑共享大部分逻辑
- 类型清晰
- 错误提示友好
验收标准:
1. 可以创建角色
2. 可以编辑角色
3. 表单校验有效
4. 成功/失败反馈清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
