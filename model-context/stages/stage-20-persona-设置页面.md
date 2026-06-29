---
stage: 20
title: "Persona 设置页面"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 20｜Persona 设置页面

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 用户可管理自己的 Persona。
- 前置依赖: 阶段 19。
- 文件范围: PersonaEditor.vue 、 PersonaView.vue 。
- 本阶段要做: 列表、编辑、设默认。
- 本阶段不要做: 不做聊天联动。
- 验收标准: 1. Persona 页面正常管理数据 2. 默认 Persona 可切换 3. 列表与编辑体验清晰
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 20|Persona 设置页面
阶段目标: 用户可管理自己的 Persona。
前置依赖: 阶段 19。
文件范围: PersonaEditor.vue 、 PersonaView.vue 。
本阶段要做: 列表、编辑、设默认。
本阶段不要做: 不做聊天联动。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 20 阶段开发。
项目背景:
Persona 页面是后续 Prompt Builder 能否真正可用的关键前台配置入口。
当前阶段:
第 20 阶段:Persona 设置页面
前置条件:
- 已完成:UserPersona API
- 当前已有目录:views/personas、components、api、stores
- 当前已有模块:前端基础工程
本阶段目标:
- 实现 Persona 管理页
- 创建 PersonaEditor
- 支持设置默认 Persona
本阶段需要实现:
1. 创建 PersonaEditor.vue
2. 创建 PersonaView.vue
3. 接入 personas API
4. 支持新增、编辑、删除、设置默认
5. 展示 Persona 摘要和状态
涉及文件范围:
- apps/web/src/components/PersonaEditor.vue
- apps/web/src/views/personas/PersonaView.vue
- apps/web/src/api/personas.ts
- apps/web/src/stores/persona.ts
本阶段明确不要做:
- 不要实现 Persona 绑定世界书 UI
- 不要接入聊天页 Prompt 预览
- 不要把业务规则写死在展示组件
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 表单复用
- 默认状态清晰
- 页面交互稳定
验收标准:
1. Persona 页面正常管理数据
2. 默认 Persona 可切换
3. 列表与编辑体验清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
