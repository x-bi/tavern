---
stage: 18
title: "参数预设页面"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 18｜参数预设页面

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 让参数预设可在前端维护。
- 前置依赖: 阶段 17。
- 文件范围: PromptPresetForm.vue 、 PresetView.vue 。
- 本阶段要做: 列表和表单。
- 本阶段不要做: 不接聊天页切换。
- 验收标准: 1. 预设页可正常管理数据 2. 默认预设状态可见 3. 表单交互清晰
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 18|参数预设页面
阶段目标: 让参数预设可在前端维护。
前置依赖: 阶段 17。
文件范围: PromptPresetForm.vue 、 PresetView.vue 。
本阶段要做: 列表和表单。
本阶段不要做: 不接聊天页切换。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 18 阶段开发。
项目背景:
参数预设页用于集中管理对话生成参数和若干风格项,为后续聊天页切换做准备。
当前阶段:
第 18 阶段:参数预设页面
前置条件:
- 已完成:PromptPreset API
- 当前已有目录:views/presets、components、api、stores
- 当前已有模块:前端基础页面壳
本阶段目标:
- 实现预设管理页面
- 创建可复用的 PromptPresetForm
- 与后端 CRUD 对接
本阶段需要实现:
1. 创建 PromptPresetForm.vue
2. 创建预设列表/管理页
3. 接入 prompt-presets API
4. 支持创建、编辑、删除、设置默认
5. 展示温度、topP、maxTokens 等摘要信息
涉及文件范围:
- apps/web/src/components/PromptPresetForm.vue
- apps/web/src/views/presets/PresetView.vue
- apps/web/src/api/presets.ts
- apps/web/src/stores/preset.ts
本阶段明确不要做:
- 不要在此阶段接入 Prompt Builder 预览
- 不要把角色系统提示和世界书逻辑塞进预设页
- 不要改动聊天流式逻辑
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 表单可复用
- 页面操作流清晰
- 加载/错误状态完整
验收标准:
1. 预设页可正常管理数据
2. 默认预设状态可见
3. 表单交互清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
