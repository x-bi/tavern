---
title: "最终 MVP 结论"
source_pdf: "轻量级 AI 酒馆方案深度研究与实施报告.pdf"
---

# 最终 MVP 结论

最终建议版实施结论
如果按文件原始表达理解成“第一版必须把所有章节都落成产品能力”,那么方案可行性只能算中等;如果把文件
理解为“总体蓝图 + 未来路线图”,并按照本报告做范围收敛,则它会变成一个非常合理、非常适合个人技术负
责人推进、也非常适合交给 Codex 做阶段式开发的项目。
最终建议只保留下面这个首版闭环作为硬目标:
首版最小可用功能清单 是否保留
角色创建/编辑/导入导出 JSON 保留
模型配置与连接测试 保留
创建会话与历史消息查询 保留
POST /chat/stream 流式聊天 保留
停止生成、重新生成、保存 assistant 回复 保留
Prompt Builder v1 与 Prompt 预览 保留
关键词世界书(scan depth / token budget / priority) 保留
单用户模式 保留
备份/恢复与基础部署 保留
多用户共享、摘要记忆、Bot Gateway、PWA、插件、图像/TTS 延后
在这个范围下,方案不需要改变方向,只需要改变节奏:先交付最短闭环,再把世界书、部署、扩展接口和
Codex 规范逐步补齐。这样做,既保住了文件想要的工程深度,也避免首版被高级功能拖死。

1 4 6 24 34 36 37 Introduction | Vue.js
https://vuejs.org/guide/introduction.html
2 11 12 13 14 28 GitHub - SillyTavern/SillyTavern: LLM Frontend for Power Users. · GitHub
https://github.com/SillyTavern/SillyTavern
3 10 30 Your First API Call | DeepSeek API Docs
https://api-docs.deepseek.com/
5 EventSource - Web APIs | MDN
https://developer.mozilla.org/en-US/docs/Web/API/EventSource
7 25 29 38 Documentation | NestJS - A progressive Node.js framework
https://docs.nestjs.com/
8 26 33 40 41 Appropriate Uses For SQLite
https://www.sqlite.org/whentouse.html
9 32 Server-Sent Events | NestJS - A progressive Node.js framework
https://docs.nestjs.com/techniques/server-sent-events
15 16 GitHub - kwaroran/Risuai: Make your own story. User-friendly software for LLM roleplaying ·
GitHub
https://github.com/kwaroran/RisuAI
17 GitHub - agnaistic/agnai: AI Agnostic (Multi-user and Multi-bot) Chat with Fictional Characters.
Designed with scale in mind. · GitHub
https://github.com/agnaistic/agnai
18 19 GitHub - TavernAI/TavernAI · GitHub
https://github.com/TavernAI/TavernAI
20 Character Creation | Chub AI Guide
https://docs.chub.ai/docs/the-basics/character-creation
21 31 Lorebooks | Chub AI Guide
https://docs.chub.ai/docs/advanced-setups/lorebooks
22 GitHub - KoboldAI/KoboldAI-Client: For GGUF support, see KoboldCPP: https://github.com/
LostRuins/koboldcpp · GitHub
https://github.com/KoboldAI/KoboldAI-Client
23 GitHub - LostRuins/koboldcpp: Run GGUF models easily with a KoboldAI UI. One File. Zero Install. ·
GitHub
https://github.com/LostRuins/koboldcpp
27 Databases supported by Prisma ORM | Prisma Documentation
https://www.prisma.io/docs/orm/overview/databases/sqlite
35 Responses | OpenAI API Reference
https://platform.openai.com/docs/api-reference/responses
39 OpenRouter API Reference | Complete API Documentation | OpenRouter | Documentation
https://openrouter.ai/docs/api-reference/overview
