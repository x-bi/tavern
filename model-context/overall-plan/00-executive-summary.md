---
title: "执行摘要"
source_pdf: "轻量级 AI 酒馆方案深度研究与实施报告.pdf"
---

# 执行摘要

执行摘要
用户提供的文件本质上不是一份已经收敛的“实施级战术方案”,而是一份高质量但范围过宽的总体技术蓝图:它
同时要求完成产品定位、竞品研究、前后端架构、数据库、API、SSE、Prompt Builder、世界书、Model
Gateway、部署、Codex 分阶段提示词与 AGENTS 规范等二十个大章节,并且希望首版仍保持“轻量、自托
管、个人与少量朋友使用”的目标。这个方向本身是正确的,而且与 SQLite、Vue 3、NestJS、OpenAI-
compatible provider 的组合是相容的;但如果把文件中的全部章节都按“第一版必须做”执行,项目会明显偏离
MVP,进入“低并发个人工具,却试图一次性做成完整平台工程”的典型过度设计区域。
从外部参考看,SillyTavern、RisuAI、Agnai、TavernAI 2、Chub、KoboldAI/KoboldCpp 的共同启发非常清
晰:角色卡 + Prompt 组装 + 历史消息管理 + Lorebook/World Info + 流式聊天 + 导入导出,确实构成了“酒
馆系统”的最小核心;但它们同时也展示了首版最容易失控的地方,例如庞大的模型适配层、丰富但高度耦合的
Prompt 调参、群聊/分支剧情、插件系统、TTS/图像生成、复杂多用户、脚本系统与浏览器/桌面/移动多端适
配。SillyTavern 自身已经发展为“power users”的统一多模型前端,带有大量扩展、TTS、图像生成、
Lorebook 和第三方扩展能力;RisuAI 已经扩展到跨平台、插件、群聊、regex 脚本;Agnai 明确强调 multi-
user / multi-bot 和 scale;TavernAI 2 则把 branching scenes、dynamic participants、Prompt Manager
Scripts 等高级机制放进了产品主轴。把这些能力“理解清楚再自行实现”是合理的,但把它们变成 v1 范围则不合
理。 2
因此,本报告的核心结论是:方案方向可行,原始范围不宜原样执行;建议收敛为“单用户优先、Web 优先、
Chat Completions 优先、关键词世界书优先、Prompt 可视化优先”的 Tavern Lite MVP,然后为多用户、
Responses API、摘要记忆、机器人接入和 PostgreSQL 迁移预留架构扩展点。在这个修订前提下,项目整体
可行性评定为“高”,首个可用版本建议控制在 12–14 周,并以 6 个里程碑推进。 3
下面这张表先给出结论级判断:
结论项 判断 说明
方向是否 个人/小圈子自托管酒馆,先做 Web、优先角色聊天体验和二次开发友好,这是与文
是
正确 件目标一致且技术上合理的方向。
原始范围
文件把研究、架构、数据、接口、Prompt、部署、Codex 提示词和规范文件都压到
是否适合 否
首版,超出典型 MVP 范围。
首版
现有技术 Vue 3 适合构建完整应用;Pinia 是 Vue 生态推荐的状态管理;Nest 提供模块化、
选型是否 是 SSE、Prisma、静态资源、文件上传和 CORS 支持;SQLite 对单机/轻并发/单文件
合适 备份很合适。 4
范围膨胀、SSE 方案与 POST 设计不一致、供应商兼容性漂移、Prompt 膨胀、
关键风险 高
SQLite 写争用、API Key 与文件上传安全。 5
结论项 判断 说明
收敛
建议落地 把“能聊、能存、能看 Prompt、能触发世界书、能切换模型配置”作为唯一首版闭
后执
策略 环。
行
