---
stage: 50
title: "MVP 验收清单"
wave: "deploy-and-acceptance"
wave_title: "部署、备份、回归与 MVP 验收"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 50｜MVP 验收清单

## 快速读取

- 波次: 部署、备份、回归与 MVP 验收
- 阶段目标: 用清单方式宣布第一版可交付。
- 前置依赖: 阶段 49。
- 文件范围: docs/mvp-checklist.md 、 README.md 。
- 本阶段要做: 按闭环验收;列出后续路线。
- 本阶段不要做: 不新增功能。
- 验收标准: 1. 有完整的 MVP 验收文档 2. 验收项可逐条核对 3. 后续扩展方向明确但未提前实现
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 验收清单摘要 4. 已完成内容 5. 未完成内容 6. 风险和 TODO 执行边界、人工检查点与最终建议 这套分阶段提示词之所以能落地,关键不在于“写得多完整”,而在于每个阶段都能把 Codex / Claude 的工作压 缩进单一边界。你的上传文件已经明确要求:不要一次性实现全部功能;每个阶段都要说明不要做什么;任务 完成后必须输出“修改文件、运行方式、测试方式、未完成事项、风险和 TODO”。我在上面的每一段里都保留了 这个约束,因为它对于控制 AI 代码助手的范围蔓延非常重要。 在执行中,我建议你把人工检查点集中放在五类问题上。第一类是边界污染,也就是聊天模块偷偷拼 Prompt、 页面组件偷偷做业务判断、模型适配器偷偷承担业务规则,这会直接毁掉后续维护性。第二类是敏感信息管 理,尤其是 API Key 不得在前端回显,也不应在日志里裸输出。第三类是流式链路一致性,要重点查“锁是否释 放、停止生成是否真正中止、失败消息是否被正确标记、断开连接后能否清理”。第四类是世界书污染 Prompt,要检查命中逻辑是否过宽、预算控制是否生效。第五类是导入导出可逆性,也就是导入后的角色再导 出是否还能保持主要字段语义稳定。这里的判断标准,都直接对应你方案文件的风险控制诉求,也契合 SillyTavern、Chub 与 Kobold 系把 world info / prompt / character definition 作为高风险核心区的经验。 如果你要把这一章真正插回完整总方案里,我建议保留三个附属物。第一,是根目录 AGENTS.md ,它是长期 规则,不应该被每个阶段提示词反复手工复制后逐渐漂移。第二,是 docs/architecture.md ,它负责提 供统一语义和依赖图。第三,是 docs/mvp-checklist.md ,它能防止项目在功能快成型时继续无边界扩 张。这三者的搭配,是让“可复制给 Codex 的提示词”不至于演变成“每阶段都在重新定义项目”的关键。 最后,基于当前公开研究资料和你上传文件,我对 Tavern Lite 的最小建议结论是:第一版最该做到的,不 是“功能多”,而是“角色—会话—Prompt Builder—Model Gateway—SSE 聊天—世界书—导入导出—部 署”这条链路完全闭环。SillyTavern、RisuAI、Agnai、Chub、KoboldCpp 都证明了酒馆系统真正的复杂度不 在壳子,而在 Prompt、上下文注入、供应商适配和流式交互体验;因此,把这些能力拆成上面 51 个可控阶 段,再逐步交给 Codex 或 Claude Code 执行,是比直接 fork 现成大项目更适合你的路径。 1 1 2 7 https://docs.sillytavern.app/ https://docs.sillytavern.app/ 3 https://github.com/kwaroran/RisuAI https://github.com/kwaroran/RisuAI 4 https://github.com/agnaistic/agnai https://github.com/agnaistic/agnai 5 https://docs.chub.ai/docs/the-basics/character-creation https://docs.chub.ai/docs/the-basics/character-creation 6 https://github.com/LostRuins/koboldcpp https://github.com/LostRuins/koboldcpp 8 https://vuejs.org/guide/reusability/composables.html https://vuejs.org/guide/reusability/composables.html 9 https://vite.dev/guide/ https://vite.dev/guide/ 10 https://docs.nestjs.com/techniques/server-sent-events https://docs.nestjs.com/techniques/server-sent-events 11 https://www.prisma.io/docs/orm/overview/databases/sqlite https://www.prisma.io/docs/orm/overview/databases/sqlite 12 https://docs.chub.ai/docs/advanced-setups/prompting https://docs.chub.ai/docs/advanced-setups/prompting 13 https://platform.openai.com/docs/api-reference/streaming https://platform.openai.com/docs/api-reference/streaming 14 https://docs.sillytavern.app/usage/core-concepts/worldinfo/ https://docs.sillytavern.app/usage/core-concepts/worldinfo/

## 完整阶段提示词与说明

```text
阶段 50|MVP 验收清单
阶段目标: 用清单方式宣布第一版可交付。
前置依赖: 阶段 49。
文件范围: docs/mvp-checklist.md 、 README.md 。
本阶段要做: 按闭环验收;列出后续路线。
本阶段不要做: 不新增功能。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 50 阶段开发。
项目背景:
MVP 的最后一步不是继续写功能,而是定义什么叫“第一版已经可交付”。
当前阶段:
第 50 阶段:MVP 验收清单
前置条件:
- 已完成:回归测试与修复
- 当前已有目录:docs、README
- 当前已有模块:MVP 全链路
本阶段目标:
- 产出清晰的 MVP 验收清单
- 标记已完成、未完成、延后事项
- 为下一阶段扩展给出边界明确的路线图
本阶段需要实现:
1. 新建 docs/mvp-checklist.md
2. 按用户闭环列出验收项:角色管理、模型配置、预设、Persona、会话、聊天流式、停止生成、重新
生成、Prompt 预览、世界书、JSON 导入导出、备份恢复、部署
3. 标记每项状态:完成 / 部分完成 / 延后
4. README 中加入“当前 MVP 范围”与“下一阶段可扩展方向”
5. 输出仍然存在的风险点
涉及文件范围:
- docs/mvp-checklist.md
- README.md
本阶段明确不要做:
- 不要新增功能开发
- 不要重构系统
- 不要引入非 MVP 功能
- 不要暴露 API Key
- 不要硬编码 Prompt
代码要求:
- 文档可执行、可核对
- 验收项以用户路径为中心
- 延后项边界清晰
验收标准:
1. 有完整的 MVP 验收文档
2. 验收项可逐条核对
3. 后续扩展方向明确但未提前实现
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 验收清单摘要
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
执行边界、人工检查点与最终建议
这套分阶段提示词之所以能落地,关键不在于“写得多完整”,而在于每个阶段都能把 Codex / Claude 的工作压
缩进单一边界。你的上传文件已经明确要求:不要一次性实现全部功能;每个阶段都要说明不要做什么;任务
完成后必须输出“修改文件、运行方式、测试方式、未完成事项、风险和 TODO”。我在上面的每一段里都保留了
这个约束,因为它对于控制 AI 代码助手的范围蔓延非常重要。
在执行中,我建议你把人工检查点集中放在五类问题上。第一类是边界污染,也就是聊天模块偷偷拼 Prompt、
页面组件偷偷做业务判断、模型适配器偷偷承担业务规则,这会直接毁掉后续维护性。第二类是敏感信息管
理,尤其是 API Key 不得在前端回显,也不应在日志里裸输出。第三类是流式链路一致性,要重点查“锁是否释
放、停止生成是否真正中止、失败消息是否被正确标记、断开连接后能否清理”。第四类是世界书污染
Prompt,要检查命中逻辑是否过宽、预算控制是否生效。第五类是导入导出可逆性,也就是导入后的角色再导
出是否还能保持主要字段语义稳定。这里的判断标准,都直接对应你方案文件的风险控制诉求,也契合
SillyTavern、Chub 与 Kobold 系把 world info / prompt / character definition 作为高风险核心区的经验。
如果你要把这一章真正插回完整总方案里,我建议保留三个附属物。第一,是根目录 AGENTS.md ,它是长期
规则,不应该被每个阶段提示词反复手工复制后逐渐漂移。第二,是 docs/architecture.md ,它负责提
供统一语义和依赖图。第三,是 docs/mvp-checklist.md ,它能防止项目在功能快成型时继续无边界扩
张。这三者的搭配,是让“可复制给 Codex 的提示词”不至于演变成“每阶段都在重新定义项目”的关键。

最后,基于当前公开研究资料和你上传文件,我对 Tavern Lite 的最小建议结论是:第一版最该做到的,不
是“功能多”,而是“角色—会话—Prompt Builder—Model Gateway—SSE 聊天—世界书—导入导出—部
署”这条链路完全闭环。SillyTavern、RisuAI、Agnai、Chub、KoboldCpp 都证明了酒馆系统真正的复杂度不
在壳子,而在 Prompt、上下文注入、供应商适配和流式交互体验;因此,把这些能力拆成上面 51 个可控阶
段,再逐步交给 Codex 或 Claude Code 执行,是比直接 fork 现成大项目更适合你的路径。 1
1 2 7 https://docs.sillytavern.app/
https://docs.sillytavern.app/
3 https://github.com/kwaroran/RisuAI
https://github.com/kwaroran/RisuAI
4 https://github.com/agnaistic/agnai
https://github.com/agnaistic/agnai
5 https://docs.chub.ai/docs/the-basics/character-creation
https://docs.chub.ai/docs/the-basics/character-creation
6 https://github.com/LostRuins/koboldcpp
https://github.com/LostRuins/koboldcpp
8 https://vuejs.org/guide/reusability/composables.html
https://vuejs.org/guide/reusability/composables.html
9 https://vite.dev/guide/
https://vite.dev/guide/
10 https://docs.nestjs.com/techniques/server-sent-events
https://docs.nestjs.com/techniques/server-sent-events
11 https://www.prisma.io/docs/orm/overview/databases/sqlite
https://www.prisma.io/docs/orm/overview/databases/sqlite
12 https://docs.chub.ai/docs/advanced-setups/prompting
https://docs.chub.ai/docs/advanced-setups/prompting
13 https://platform.openai.com/docs/api-reference/streaming
https://platform.openai.com/docs/api-reference/streaming
14 https://docs.sillytavern.app/usage/core-concepts/worldinfo/
https://docs.sillytavern.app/usage/core-concepts/worldinfo/
```
