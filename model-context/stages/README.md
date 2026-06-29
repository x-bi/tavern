# 分阶段开发提示词

## 概览

Tavern Lite 分阶段开发提示词总表与落地执行章
研究范围与本章定位
你上传的方案文件已经把要求说得非常明确:这份方案不是写给普通用户的概念说明,而是写给“要真实开发这
个项目”的技术负责人;同时,第十七部分还明确要求不能只给第一阶段提示词,而必须按完整开发顺序,为每
一个阶段都提供可以直接复制给 Codex 的完整提示词,并且每个阶段都要写明目标、依赖、文件范围、不要做
什么、验收标准、风险,以及任务完成后的输出格式。你这次追加的要求,本质上是在把这一条升级为最终报
告中的独立核心章节。
因此,下面这章我不是按“路线建议”的层级来写,而是按可以直接交给 Codex / Claude Code 执行的分阶段开
发手册来写。它延续你原始方案的边界:前端以 Vue3 + Vite + TypeScript + Pinia 为主,后端以 NestJS +
Prisma + SQLite 为主,第一版围绕角色、会话、聊天、Prompt Builder、世界书、模型配置、导入导出、备份
和轻量部署来做,不扩展到支付、市场、机器人、TTS、图片生成、向量数据库、Redis、多租户 SaaS 等非
MVP 范围。
本章同时结合了对当前公开项目与文档的核对。SillyTavern 的公开文档与仓库说明,它的强项是多后端统一接
入、角色卡、World Info、用户 Persona、预设与高度可配置的 Prompt 控制;RisuAI 则更突出跨平台、移
动友好、灵活 Prompt 顺序、Lorebook 和更激进的产品面扩展;Agnai 明确走的是多用户、多 Bot、可扩大
规模的后端思路;Chub AI 对角色定义字段、Lorebook 扫描深度和 token budget 的产品化表达很有参考价
值;KoboldCpp 则延续了 memory / world info / author’s note / character / scenario 这一套经典酒馆语
义模型。 1
竞品研究结论与本章采用的取舍
从公开资料看,SillyTavern 仍然是最值得学习的参考对象,但应该学习的是能力边界与抽象方式,不是直接照
搬其全部功能。它在官方文档中明确把自己定位为“LLM Frontend for Power Users”,并以角色卡、World
Info、用户 Persona、生成预设、扩展系统和多 API 连接为核心;这对 Tavern Lite 的启发是:第一版一定要把
Prompt Builder、世界书、角色卡与模型配置做成独立模块,而不是把这些逻辑写死在某个聊天组件里。但同
一份文档也显示,SillyTavern 已经覆盖了 RAG、TTS、图片生成、群聊、脚本引擎与扩展市场等广泛能力,这
些都明显超出了你当前文件要求的 MVP 范围,因此不应该进入第一版。 2
RisuAI 的参考价值更偏交互与配置弹性。它公开说明自己是跨平台 AI 聊天软件 / Web 应用,支持多 API、
Lorebook、可调 Prompt 顺序、移动友好 UI、插件、正则脚本、长期记忆与 TTS。对 Tavern Lite 而言,应该
吸收的是它的移动端友好思路、Prompt 顺序的可配置意识、聊天中资源管理和 Lorebook 心智模型;但插
件、长期记忆、TTS、翻译、群聊这些内容,在你当前范围里会明显增加失控风险。关于“PocketRisu”,在我这
次可核对到的公开资料里,我确认到了 RisuAI 主仓库与公开说明,但没有核对到一个单独、明确、当前仍持续
公开维护的“PocketRisu”独立代码基,因此本章将其视为Risu 这一路“移动优先/轻量客户端体验”的参考方向,
而不是单独依赖的上游项目。 3
Agnai 的最大价值不在于 UI,而在于后端边界意识。它的仓库公开说明自己是 “AI Agnostic (Multi-user and
Multi-bot) Chat with Fictional Characters. Designed with scale in mind.”,并且明确提到 MongoDB 和
Redis 都是可选,缺失时也能以 guest-only 模式运行。这对 Tavern Lite 的启发非常直接:你第一版完全可以
不引入 Redis,也不需要一上来就做复杂多用户;但在代码边界上,应该从第一天就把业务模块、Prompt
Builder、Model Gateway、配置模块拆开,这样以后才能真正平滑扩展。 4
Chub AI 不是你要 fork 的目标,而是字段设计和产品表达方式的参考。它的公开文档把角色创建拆成
Character Info 与 Character Definition,两者分别承担展示元数据和实际提示内容;Lorebooks 文档则把
Scan Depth、Token Budget、Insertion Order、Priority、Case Sensitivity 等概念解释得很清楚。这些都很
适合转化成 Tavern Lite 的内部数据结构与编辑表单。与此同时,Chub 是一个托管平台,包含账号、社区、公
共内容与 hosted service 语义,这些都不应在你的第一版自托管 Tavern Lite 中照搬。 5
KoboldCpp 与 KoboldAI 这一路的价值,是把酒馆系统里最老牌、最稳定的概念集保留下来。其公开说明仍然
把 bundled UI 的核心编辑对象写成 “memory, world info, author’s note, characters, scenarios”。这意味着
你在 Prompt Builder 里最好内置一套基础规则 + 角色设定 + Persona + 世界书 + 最近消息 + 用户最新输入的
稳定结构,而不要在第一版就引入过多自动摘要、长时记忆压缩或复杂的动态 macro 扩展。 6
从许可角度看,SillyTavern 与 Agnai 都是 AGPL-3.0;RisuAI 是 GPL-3.0;KoboldCpp 的主体代码也以
AGPL-3.0 为主。这进一步强化了一个结论:最适合你的路线不是 fork 现成项目,而是研究它们的产品模型、
交互结构、字段设计与 Prompt 心智,然后用 Vue3 + NestJS + SQLite 做一版结构更干净、更便于自己二开与
分阶段交给 Codex 的 Tavern Lite。 7
技术边界与拆分原则
这一章的拆分方式,必须服务于你的两个根目标:第一,保证 Tavern Lite 可以尽快形成可用闭环;第二,保
证 Codex / Claude Code 每次只改一个可控边界。这和你上传的文件要求完全一致:避免一次性实现过多功
能,避免过度设计,优先保证结构清晰、便于后续维护与二次开发。
前端层面,我建议把组件渲染、可复用状态逻辑、全局共享状态三层严格分开。Vue 官方文档把 composable
定义为“利用 Composition API 封装并复用有状态逻辑的函数”;Pinia 官方文档则把 store 清晰地划分为
state 、 getters 和 actions ,并强调每个 store 最好单独成文件。这非常适合你的项目:诸如 SSE 读
取、自动滚动、消息输入状态、AbortController 管理、Prompt 预览数据转换等,放进 composables;角色列
表、当前会话、消息数组、模型配置缓存、设置数据等跨页面共享状态,放进 Pinia;而聊天气泡、表单、弹
窗、Markdown 渲染等纯展示逻辑,尽量留在组件层。 8
Vite 继续作为前端基座是合理的,因为它明确以更快、更轻的现代 Web 开发体验为目标,开发服务器提供非常
快的 HMR,适合你这种要高频让 Codex 迭代前端页面的节奏。UI 组件库我推荐 Naive UI 作为默认方案:不
是因为它在公开资料中“绝对更强”,而是因为在这个项目里,你需要的是表单、抽屉、弹层、列表、设置页和聊
天壳子的一致性,而 Naive UI 在 Vue3 + TypeScript 场景下通常更自然、侵入更少;如果你团队已经对
Element Plus 更熟,那也可以落回 Element Plus,但不要在项目推进中反复横跳。 9
后端层面,NestJS 仍然是最适合这一版的主框架。原因不是“它最轻”,而是它最容易把模块边界表达清楚。你
的方案文件已经明确希望保留 module / controller / service / dto / guard / interceptor 的结构,并强调后续
可能扩展 Bot Gateway、WebSocket、多用户权限与后台任务。对于这一点,NestJS 的结构化模块化能力是加
分项;真正要避免的是把 NestJS 用得过重。所以第一版不要引入 Repository 层、不要上 CQRS、不要上事件
总线,优先采用 Module + Controller + Service + PrismaService 的直接模式。
聊天流部分,我建议第一版采用基于 POST /api/chat/stream 的 fetch 流式读取 + SSE 帧格式,而不是
浏览器 EventSource 。NestJS 官方文档说明,标准 @Sse() 路由要求返回
Observable<MessageEvent> ,更适合 GET + EventSource 场景;OpenAI 的官方流式文档则说明,无论
Responses 还是 Chat Completions,HTTP 流式输出本质上都可以通过 server-sent events 来传输增量数据。
综合起来,你的 MVP 最适合的实现是:接口仍使用 POST 提交请求体,响应头设为 text/event-
stream ,后端直接向 Response 写入 event: delta / event: done / event: error ,前端用
fetch + ReadableStream 解析。这不是照抄任何单一文档,而是基于 NestJS 和 OpenAI 文档的工程化
折中。 10
数据库层面,SQLite 作为第一版主库是完全合理的。Prisma 官方文档确认 SQLite 是受支持数据库;数据库特
性矩阵里也明确写到,SQLite 在 Prisma ORM 6.2.0 起支持 JSON 和 Enum,但高级 Json 过滤仍然不支持。
SQLite 官方 JSON 文档则明确指出,SQLite 将 JSON 作为普通文本存储,而不是原生 JSON 类型。对 Tavern
Lite 来说,这意味着:metadata、exampleMessages、prompt sections、导入原始角色卡等非强结构化
字段可以先用 Json / TEXT 存;但查询高频、需要筛选和排序的字段仍应优先设计成显式列。这样后续迁移
PostgreSQL 的摩擦会更低。 11
Prompt Builder 需要从第一天就做成独立服务,而不是黏在 ChatService 里。Chub 的公开文档把 prompt 划
分为 system prompt、character definitions、chat history、post history instructions、prompt note、
assistant prefill,并提供宏顺序调整思路;SillyTavern 和 Kobold 系同样强调 World Info、Persona 与角色卡
内容在上下文中的动态插入。与此同时,OpenAI 当前文档又明确指出,在较新的聊天接口语义中,
developer message 已取代旧式 system message 的主导角色。对你的项目而言,最稳妥的方式是:内
部逻辑维持 platform rules / role rules / persona / lore / history / user input 的分层语义,再由 Model
Gateway 负责向不同供应商的实际消息格式降级或映射。 12
阶段路线总览
下面这套路线,不是按“模块说明书”顺序排的,而是按真实开发阻塞关系来排的。先有规则,再有工程骨架,再
有数据库和基础 API,再有页面,再有 Prompt Builder 和 Model Gateway,再有流式聊天闭环,最后再做世
界书、导入导出、部署与回归。这样的顺序最符合你文件里“每个阶段粒度合理、可以单独执行、阶段之间有清
晰依赖关系”的要求。
整体上,这 51 个阶段可以看成五个波次:
其一是基线波次。包括 AGENTS.md、monorepo、前端基础工程、后端基础工程、Prisma + SQLite、
schema、seed、单用户模式、统一响应与错误处理。它的目标不是“能聊天”,而是让后续每个小任务都有稳定
的落脚点。
其二是核心实体波次。包括角色、模型配置、参数预设、Persona、会话、消息六类核心实体的 API 与首批页
面。做到这里,项目虽然还不能真正调用大模型,但数据流和页面骨架已经齐了。
其三是聊天闭环波次。包括 Prompt Builder 类型、Prompt Builder v1、Prompt 预览、Model Gateway 抽
象、OpenAI-compatible 适配、后端流式聊天、前端 useChatStream、聊天流式输出接入、停止生成、重新
生成、编辑删除复制消息。做到这一波,Tavern Lite 才算真正形成最小产品闭环。 13
其四是内容增强波次。包括世界书 API、世界书编辑页、关键词匹配逻辑、命中调试与 Prompt 预览集成、角色
卡 JSON 导入导出、备份导入导出、设置页。这个波次主要提升“酒馆味”和后续可维护性。 14
其五是部署与验收波次。包括 Docker Compose、生产静态托管、SQLite / uploads 备份脚本、回归测试与修
复、MVP 验收清单。这一波和功能创新没关系,但决定项目是否真的可落地。你上传文件把 Docker、备份、
恢复和验收都列在了正式方案要求里,因此这部分不能省。
Codex / Claude Code 分阶段开发提示词总表
这一节是可以直接放入最终报告正文的版本。为了避免任何“只给模板不给可执行提示词”的问题,我把每个阶段
都写成了外层任务说明 + 内层可复制提示词的形式。所有阶段都遵守同一组总原则:只做当前阶段;不提前实
现后续功能;不引入大型新依赖;不把 API Key 暴露到前端;不在组件或聊天接口里硬编码 Prompt;不让业务
代码直接依赖具体模型供应商 SDK;不引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成等非
MVP 功能。这个约束来自你上传方案文件的明示要求,也与当前参考项目的复杂度差异完全一致。
基线与工程骨架

## 使用方式

- 先读 `stage-index.md` 判断当前阶段、依赖和文件范围。
- 再读对应 `stage-XX-*.md`。
- 阶段文件里的 `快速读取` 用于模型快速建立边界；`完整阶段提示词与说明` 保留 PDF 原始阶段内容。
