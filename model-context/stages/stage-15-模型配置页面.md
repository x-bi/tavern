---
stage: 15
title: "模型配置页面"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 15｜模型配置页面

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 让用户能在前端管理模型配置。
- 前置依赖: 阶段 14。
- 文件范围: ModelConfigForm.vue 、 ModelConfigView.vue 。
- 本阶段要做: 列表、新建、编辑、删除。
- 本阶段不要做: 不做连接测试。
- 验收标准: 1. 可以新增、编辑、删除模型配置 2. 列表信息展示清楚 3. apiKey 在 UI 中不明文回显
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 15|模型配置页面
阶段目标: 让用户能在前端管理模型配置。
前置依赖: 阶段 14。
文件范围: ModelConfigForm.vue 、 ModelConfigView.vue 。
本阶段要做: 列表、新建、编辑、删除。
本阶段不要做: 不做连接测试。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 15 阶段开发。
项目背景:
模型配置需要前端页面支持,否则后续聊天无法让用户自定义接入 OpenAI-compatible 服务。
当前阶段:
第 15 阶段:模型配置页面
前置条件:
- 已完成:ModelConfig API
- 当前已有目录:apps/web/src/views/models、components、api、stores
- 当前已有模块:前端基础骨架
本阶段目标:
- 实现模型配置管理页面
- 复用表单组件
- 支持创建、编辑、删除和查看脱敏配置
本阶段需要实现:
1. 创建 ModelConfigForm.vue
2. 创建模型配置列表页/管理页
3. 接通 model-configs API
4. 支持默认模型标识或列表中的当前默认显示(如 schema 已有)
5. 展示 providerName、baseUrl、modelName、参数摘要
6. 表单中对 apiKey 输入做密码态处理
涉及文件范围:
- apps/web/src/components/ModelConfigForm.vue
- apps/web/src/views/models/ModelConfigView.vue
- apps/web/src/api/models.ts
- apps/web/src/stores/model.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现连接测试
- 不要实现聊天页切换模型逻辑
- 不要把 apiKey 缓存在不必要的全局状态
- 不要改动无关页面
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 表单可复用
- apiKey 输入安全
- 加载/错误状态清晰
验收标准:
1. 可以新增、编辑、删除模型配置
2. 列表信息展示清楚
3. apiKey 在 UI 中不明文回显
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
