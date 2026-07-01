---
stage: 28
title: "Prompt 预览页面"
wave: "chat-loop"
wave_title: "Prompt Builder、Model Gateway 与聊天闭环"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 28｜Prompt 预览页面

## 快速读取

- 波次: Prompt Builder、Model Gateway 与聊天闭环
- 阶段目标: 在前端查看 Prompt 预览结果。
- 前置依赖: 阶段 27。
- 文件范围: PromptPreview.vue 、 PromptPreviewView.vue 。
- 本阶段要做: 分段渲染、JSON/文本查看、复制。
- 本阶段不要做: 不做高级 diff。
- 验收标准: 1. 页面可展示 Prompt 预览结果 2. 分段与最终消息都能查看 3. 可复制调试内容
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 测试方式 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 28|Prompt 预览页面
阶段目标: 在前端查看 Prompt 预览结果。
前置依赖: 阶段 27。
文件范围: PromptPreview.vue 、 PromptPreviewView.vue 。
本阶段要做: 分段渲染、JSON/文本查看、复制。
本阶段不要做: 不做高级 diff。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 28 阶段开发。
项目背景:
Prompt 预览页用于帮助开发者和高级用户理解最终发送给模型的 messages。
当前阶段:
第 28 阶段:Prompt 预览页面
前置条件:
- 已完成:Prompt 预览 API
- 当前已有目录:views/prompts、components、api
- 当前已有模块:聊天页骨架、模型/预设/Persona 页面
本阶段目标:
- 实现 Prompt 预览页面
- 展示 sections 与 finalMessages
- 支持复制和基础调试视图
本阶段需要实现:
1. 创建 PromptPreview.vue 组件
2. 创建 PromptPreviewView.vue 页面
3. 接入 prompts/preview API
4. 分区展示基础规则、角色、Persona、历史消息、用户输入、最终 messages
5. 提供复制最终 messages 或单段内容的能力
6. 展示 debug 信息,例如历史裁剪说明
涉及文件范围:
- apps/web/src/components/PromptPreview.vue
- apps/web/src/views/prompts/PromptPreviewView.vue
- apps/web/src/api/prompts.ts
- apps/web/src/stores/chat.ts 或 prompt store
本阶段明确不要做:
- 不要调用模型生成
- 不要实现复杂 diff 比较
- 不要在页面中重写 Prompt 拼接逻辑
- 不要暴露 API Key
- 不要引入非 MVP 功能
代码要求:
- 展示层与数据获取分离
- 长文本可读
- 支持复制
验收标准:
1. 页面可展示 Prompt 预览结果
2. 分段与最终消息都能查看
3. 可复制调试内容
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
