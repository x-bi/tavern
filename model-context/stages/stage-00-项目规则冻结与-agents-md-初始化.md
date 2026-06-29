---
stage: 0
title: "项目规则冻结与 AGENTS.md 初始化"
wave: "baseline"
wave_title: "基线与工程骨架"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 0｜项目规则冻结与 AGENTS.md 初始化

## 快速读取

- 波次: 基线与工程骨架
- 阶段目标: 冻结项目边界,建立供 Codex 持续遵守的 AGENTS.md。
- 前置依赖: 无。
- 文件范围: AGENTS.md 、 README.md 、 docs/architecture.md 、项目根目录。
- 本阶段要做: 写清项目目标、技术栈、目录结构、开发原则、禁止事项、API Key 安全要求、Prompt Builder 要求、Model Gateway 要求、SSE 规范、完成任务后的汇报格式。
- 本阶段不要做: 不生成业务代码;不搭建完整工程。
- 验收标准: AGENTS.md 可直接作为常驻规则;README 和架构文档不空泛。
- 可能风险: 写成泛泛模板,无法约束后续阶段。
- 人工检查点: 检查是否明确禁止超范围功能。
- 完成后输出: 修改文件列表;新增文件列表;查看方式;覆盖范围;缺口;风险与 TODO。

## 完整阶段提示词与说明

```text
阶段 0|项目规则冻结与 AGENTS.md 初始化
阶段目标: 冻结项目边界,建立供 Codex 持续遵守的 AGENTS.md。
前置依赖: 无。
文件范围: AGENTS.md 、 README.md 、 docs/architecture.md 、项目根目录。
本阶段要做: 写清项目目标、技术栈、目录结构、开发原则、禁止事项、API Key 安全要求、Prompt Builder
要求、Model Gateway 要求、SSE 规范、完成任务后的汇报格式。
本阶段不要做: 不生成业务代码;不搭建完整工程。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 0 阶段开发。
项目背景:
这是一个基于 Vue3 + Vite + TypeScript + Pinia + Vue Router + Naive UI + NestJS
+ Prisma + SQLite 的轻量级 AI 酒馆 / 角色对话系统。
项目目标是先完成个人和少量朋友可用的 Web MVP,不做大规模 SaaS,不做支付,不做市场,不做机器
人,不做 TTS,不做图片生成,不做向量数据库,不做 Redis。
当前阶段:
第 0 阶段:项目规则冻结与 AGENTS.md 初始化
前置条件:
- 已完成:无
- 当前已有目录:项目根目录
- 当前已有模块:无
本阶段目标:
- 产出 AGENTS.md 作为 Codex / Claude Code 的长期约束文件
- 产出最小 README 与 docs/architecture.md
- 明确技术边界、禁止事项、模块命名和输出规范
本阶段需要实现:
1. 新建 AGENTS.md,写明项目目标、技术栈、目录结构、开发原则、禁止事项、SQLite/Prisma 约
束、API Key 安全约束、Prompt Builder 约束、Model Gateway 约束、前后端代码规范、DTO 规
范、统一响应规范、SSE 规范、文件上传规范、任务完成后的输出格式
2. 新建 README.md,写明项目简介、MVP 范围、启动方式占位符、目录说明
3. 新建 docs/architecture.md,写明高层模块图、阶段路线、必须先做什么后做什么
4. 所有内容使用中文,语气工程化、可执行
涉及文件范围:
- AGENTS.md
- README.md
- docs/architecture.md
本阶段明确不要做:
- 只做当前阶段,不要提前实现后续阶段
- 不要初始化完整前后端业务代码
- 不要引入未要求的大型依赖
- 不要改动无关模块
- 不要把 API Key 写入前端
- 不要在组件里硬编码 Prompt
- 不要让业务代码直接调用模型供应商接口
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成等非 MVP 功能
代码要求:
- 文档清晰、结构化
- 命名统一
- 约束可被后续阶段直接引用
- 不写空话,必须具体
验收标准:
1. AGENTS.md 可单独作为开发规则文件使用
2. README 与 architecture 文档能说明项目边界和阶段顺序
3. 文档内容与 MVP 范围一致,没有超纲
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何查看文档
4. 文档覆盖了哪些规则
5. 仍需补充的规则
6. 风险和 TODO
验收标准: AGENTS.md 可直接作为常驻规则;README 和架构文档不空泛。
可能风险: 写成泛泛模板,无法约束后续阶段。
人工检查点: 检查是否明确禁止超范围功能。
完成后输出: 修改文件列表;新增文件列表;查看方式;覆盖范围;缺口;风险与 TODO。
```
