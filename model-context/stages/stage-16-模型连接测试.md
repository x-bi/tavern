---
stage: 16
title: "模型连接测试"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 16｜模型连接测试

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 给模型配置增加后端连接测试接口和前端按钮。
- 前置依赖: 阶段 15。
- 文件范围: models/* 、模型页面。
- 本阶段要做: POST /api/model-configs/:id/test ,只测试连通性与最小响应。
- 本阶段不要做: 不实现完整聊天。
- 验收标准: 1. 可从前端触发测试连接 2. 测试成功或失败结果清晰 3. 不泄露 API Key
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 16|模型连接测试
阶段目标: 给模型配置增加后端连接测试接口和前端按钮。
前置依赖: 阶段 15。
文件范围: models/* 、模型页面。
本阶段要做: POST /api/model-configs/:id/test ,只测试连通性与最小响应。
本阶段不要做: 不实现完整聊天。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 16 阶段开发。
项目背景:
模型连接测试可以在正式聊天前尽早暴露错误配置。
当前阶段:
第 16 阶段:模型连接测试
前置条件:
- 已完成:模型配置页面
- 当前已有目录:models 模块、模型配置前端页面
- 当前已有模块:ModelConfig CRUD
本阶段目标:
- 提供后端模型连接测试接口
- 在前端页面提供测试按钮和结果反馈
- 仅做最小连通性检测
本阶段需要实现:
1. 实现 POST /api/model-configs/:id/test
2. 后端读取模型配置并发起最小请求或健康测试
3. 返回 success/failure、耗时、摘要信息
4. 前端加入“测试连接”按钮
5. 展示通过/失败提示
涉及文件范围:
- apps/server/src/modules/models/*
- apps/web/src/views/models/ModelConfigView.vue
- apps/web/src/components/ModelConfigForm.vue
- apps/web/src/api/models.ts
本阶段明确不要做:
- 不要实现正式聊天接口
- 不要在业务代码直接调用具体供应商 SDK
- 不要实现 fallback 模型
- 不要写复杂重试策略
- 不要在前端暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 测试请求最小化
- 错误信息清晰但不要泄露敏感头信息
- 与后续 Model Gateway 不冲突
验收标准:
1. 可从前端触发测试连接
2. 测试成功或失败结果清晰
3. 不泄露 API Key
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
