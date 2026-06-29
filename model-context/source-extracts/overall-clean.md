<!-- source-page: 1 -->

轻量级 AI 酒馆方案深度研究与实施报告
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


<!-- source-page: 2 -->

结论项 判断 说明
收敛
建议落地 把“能聊、能存、能看 Prompt、能触发世界书、能切换模型配置”作为唯一首版闭
后执
策略 环。
行
文件方案提炼
核心目标与系统边界
文件明确把项目定位为一个轻量级、自托管、以角色扮演/情景对话为核心的 Web 酒馆系统,并强调不是直接
部署 SillyTavern / RisuAI / Agnai / PocketRisu 等项目,而是参考它们的产品形态、功能设计、数据结构、
Prompt 机制与交互体验,再用 Vue 3 + NestJS + SQLite 重新实现一个更便于二次开发的“轻量版本”。文件还明
确指出,当前目标不是大规模商用,不追求会员、支付、公开角色市场、复杂后台、多租户 SaaS、大规模审
核、插件市场、创作者收益、多角色群聊、图片生成、TTS、RAG、向量数据库和大并发。

文件对首版闭环的描述也很明确:用户选择或创建角色,进入会话,系统基于角色卡、用户 Persona、历史消
息、世界书与模型参数构造 Prompt,调用模型,流式返回回复,保存聊天记录,然后继续进行角色/会话/世界
书管理。换句话说,文件真正的“不可妥协主轴”并不是所有二十个章节,而是一条从角色配置到流式对话再到持
久化的完整聊天链路。
提取出的假设与约束
下表把文件中真正影响实施方案的假设与硬约束从“愿望清单”中分离出来:
类 类
提取出的假设/约束 备注
别 型
用
硬
户 直接决定首版不应以高并发/复杂权限为目标。
自己和少量朋友使用 约
规
束
模
产
硬
品 机器人、小程序、桌面包装都不是首版主线。
首版做 Web 版酒馆 约
形
束
态
体
硬
验 优先级高于市场、后台、支付等。
角色聊天体验优先 约
重
束
点
工
硬
程 代码结构清晰,方便 Codex 分阶 直接要求模块边界清楚、阶段粒度可控。
约
目 段开发
束
标


<!-- source-page: 3 -->

类 类
提取出的假设/约束 备注
别 型
前 硬 Vue 官方建议完整应用使用 Composition API + SFC;
Vue3 + Vite + TypeScript +
端 约 Pinia 强调 TS、devtools 和简单 API。
Pinia + Vue Router
栈 束  6
后 硬
Node.js + TypeScript + NestJS + Nest 支持模块化、SSE、Prisma、文件上传、静态资
端 约
Prisma + SQLite 源和 CORS。 7
栈 束
数 硬 SQLite 适合单机/轻并发/低运维;Prisma 当前支持
v1 使用 SQLite,后续可迁移
据 约 SQLite 与 PostgreSQL,降低迁移成本。
PostgreSQL
库 束  8
实
硬
时 但实现方式需要修订,见后文。
聊天使用 SSE 流式输出 约
输  9
束
出
模
硬 DeepSeek 示例使用 OpenAI SDK + base_url ;
型 v1 优先 OpenAI-compatible
约 OpenRouter 也声明其 schema 与 OpenAI Chat API
接 API
束 非常相近。 10
入
作
用 不做支付、公开市场、复杂审 硬
域 核、复杂权限、多租户、RAG、 约 这是控制 MVP 成败的关键。
排 向量库、TTS、图片生成等 束
除
扩
软
展 未来可能接 Bot Gateway、 预留结构即可,不应在首版实现。
约
预 PostgreSQL、Redis、后台任务
束
留
文件中未明确、必须标注为未指定的事项
以下事项在文件中没有被充分指定,因此本报告中的相关建议均为规划假设,不应被误读为用户既定要求:
未指定事项 当前状态 本报告处理方式
以“个人主导 + 可有协作角色 + Codex 分阶段辅助”为假
团队规模 未指定
设。
给出 12–14 周的推荐版计划,以及更慢/更快两种资源情
交付时限 未指定
形。
预算上限 未指定 提供“个人主导”和“小团队加速”两档估算。
部署环境 未指定 按单机 Linux / Docker / 反向代理为主假设。
并发目标 未指定 按“低写并发、少量同时聊天会话”设计。


<!-- source-page: 4 -->

未指定事项 当前状态 本报告处理方式
按私有部署基础安全级别设计,不按企业合规等级设
安全等级 未指定
计。
最终首选模 以 OpenAI-compatible 最大兼容面设计网关,默认不绑
未指定
型供应商 定单一厂商。
UI 风格与
未指定 以深色模式、聊天优先、角色卡优先为默认设计语义。
品牌
是否必须多 文件提到“简单登录或单用户模 本报告建议 v1 以单用户为主,多用户结构预留但不强制
用户 式”及“轻量多用户模式” 首发。
外部对标与可行性评估
对标项目的参考价值与边界
从一手资料看,主要参考对象并不应该平均加权,而应该按“首版闭环价值”做高低排序。SillyTavern 最值得参
考的是其统一多模型前端、Lorebook/WorldInfo、Prompt 控制粒度和本地自托管思路;RisuAI 可参考其跨平
台与角色聊天产品化体验,但其插件、群聊、regex 脚本明显超出首版;Agnai 最重要的启发是多用户/多 bot/
可扩展架构,但它的规模导向正好说明为什么不该把这条线拉进 v1;Chub 适合作为角色卡字段、
Characterbook/Lorebook 结构与创作流程的参考;KoboldAI/KoboldCpp 则是 Memory、Author’s Note、
World Info 等 prompt 辅助机制的经典来源。 11
更关键的是,直接 fork 这些项目在法律和工程上都不划算。SillyTavern、Agnai、KoboldCpp 为 AGPL-3.0,
RisuAI 为 GPL-3.0;这不意味着不能参考或使用,但意味着一旦直接复用大量代码、做网络部署或继续分发,
许可证义务与后续维护边界会立刻复杂化。文件本身也明确表示目标是“深入参考后,自研轻量版本”,这与许可
证风险控制和后续可维护性是同方向的。 12
下表给出高权重对标结论:
首版不建议照 对本项目
项目 官方定位/特征 最值得参考 许可证/注意点
搬 的启发
本地安装、多模型 Prompt 控 参考“强
TTS、图像生 AGPL-3.0;可参
统一前端、 制、 Prompt
成、扩展体 考设计,不宜直
SillyTavern Lorebook、移动友 Lorebook、会 Builder +
系、超多参数 接重用大量代
好、第三方扩展丰 话体验、模型 本地自托
面板 码。 14
富。 13 适配抽象 管”
跨平台 AI 聊天/网 角色聊天产品 参考“轻
群聊、插件、
页应用,支持多 感、跨端思 量产品
RisuAI regex 改写、 GPL-3.0。 16
API、群聊、插件、 路、模型接入 化”而非
跨端打包
regex。 15 体验 功能清单
Multi-user / Multi- 多用户、 反向证明
模块扩展边
bot,强调 scale; Redis、Guest v1 不应
Agnai 界、多用户架 AGPL-3.0。 17
MongoDB/Redis Only / 规模化 走复杂后
构认识
可选。 17 能力 端路线


<!-- source-page: 5 -->

首版不建议照 对本项目
项目 官方定位/特征 最值得参考 许可证/注意点
搬 的启发
角色卡、
branching 本次可访问公开
适合作为
scenes、multi- 分支会话概 branching、 仓库更偏发布/
Phase
TavernAI 2 generation、 念、Prompt 多生成并行、 文档镜像,实施
2/3 的扩
dynamic Manager 思路 脚本机制 细节参考权重较
展蓝图
participants、 低。 19
scripts。 18
角色创作平台;清 角色字段定
角色卡和
晰给出 character 义、Lorebook 平台规则与托管
公共社区、市 世界书结
Chub fields、Lorebook/ 字段、scan 逻辑不适合照
场与平台逻辑 构的高质
Characterbook 机 depth、token 搬。 21
量来源
制。 20 budget
KoboldCpp 为
本地/远程模型前 Memory/ 用于设计 AGPL-3.0;
端;Memory、 Author’s 本地推理工具 Prompt OpenAI-
KoboldAI /
Author’s Note、 Note/World 链与多模态扩 Builder compatible /
KoboldCpp
World Info 是其经 Info 的提示工 展 的“层次 v1 也说明本地
典工具。 22 程分层 感” 代理很适合纳入
后续扩展。 23
关于 PocketRisu,本轮可稳定访问的一手资料不足,因此不建议把它作为主参考源;可在后续补充验证时再纳
入。这个处理并不会影响当前方案,因为 RisuAI 已覆盖该类型产品的主要经验曲线。
技术选型可行性
从官方文档出发,Vue 3 适合本项目并不是因为“前端流行”,而是因为它对完整应用场景的支持非常直接:Vue
官方明确建议在构建 full application 时使用 Composition API + Single-File Components;Vue 的“渐进式框
架”定位也意味着它能从简单 SPA 平滑成长到更复杂的应用结构;Pinia 作为现行推荐状态管理,提供
TypeScript 支持、devtools、actions/getters 与更扁平的 store 组织方式,这特别适合把聊天流状态、会话状
态、角色状态与设置状态分离开来。 24
NestJS 同样是合理选择。官方文档表明,Nest 提供模块、控制器、提供者、配置、校验、文件上传、静态资
源、CORS、Prisma、SSE 等完整应用所需的标准能力;同时它默认基于 Express,但仍可在未来切换到
Fastify。Nest 官方也指出 Fastify benchmark 可能接近 Express 的两倍,但 Express 之所以仍是默认,是因为
其更广泛的中间件生态与开箱兼容性。对当前这个强调“模块清晰、方便分阶段开发”的文件目标来说,Nest 默
认 Express 路线要比一开始就追求 Fastify 性能更稳妥。 25
SQLite 对这个项目尤其匹配。SQLite 官方明确指出:对于低到中等流量网站、设备本地数据、应用服务内部存
储、少写并发场景,SQLite 通常是更简单且足够好的选择;与此同时,它也明确提醒,SQLite 单数据库文件只
允许同一时刻一个 writer,当出现高写并发、多服务器写入、网络文件系统直接共享数据库文件时,就应转向
client/server 数据库。WAL 模式可以改善读写并发,因为 readers 不阻塞 writers、writers 也不阻塞
readers,但仍然只有一个 writer;因此,文件中“个人与少量朋友使用、先做 MVP”的约束,与 SQLite 是高度
一致的,而“复杂多用户/高并发/多机”则不一致。 26


<!-- source-page: 6 -->

Prisma 也与这一方向相容。Prisma 当前明确支持 SQLite 与 PostgreSQL,并且数据库特性矩阵显示:SQLite
的 JSON 与 Enum 已经在 Prisma ORM 6.2.0 中得到支持。这意味着首版完全可以把 metadata 、世界书扩展
字段、角色标签扩展信息等放在 Json 字段中,同时保持未来迁移 PostgreSQL 的较低成本。 27
可行性评分与风险评级
下表给出“按文件原样执行”与“按本报告收敛后执行”两种情形的差异判断:
按文 风
收敛
件原 险
模块/目标 后执 依据与理由
样执 等
行
行 级
Web 角色聊天 高可 角色卡 + 会话 + 消息 + Prompt Builder + 模型网关 + 持
可行 中
MVP 行 久化是可控闭环。
竞品研究后全量 低可 不建 参考项目功能面都很宽,直接全量追平会让首版失控。
高
自研复刻 行 议 28
NestJS + Prisma 高可 高可
低 官方能力完备,且与个人/小团队场景匹配。 29
+ SQLite 架构 行 行
OpenAI- DeepSeek 与 OpenRouter 都能以 OpenAI 风格接入,
中高 高可 中
compatible 模型 但各家字段差异、stream 细节和参数漂移需要适配层。
可行 行 高
网关 30
世界书关键词触 高可 高可 Chub 与 Kobold 系机制成熟,适合先做 scan depth +
中
发 行 行 token budget + priority 的简版。 31
多用户轻量模式 中可 延后 中 对当前用户规模不是必要,但会显著增加鉴权、隔离、共
首发 行 更优 高 享、数据边界复杂度。 17
必须修正“POST + EventSource”的设计矛盾;用
中可 高可
SSE 流式聊天 高 fetch() 读取 SSE 格式流更匹配聊天请求体场景。
行 行
SQLite 长期承载 中可 中高 单 writer 限制真实存在,但低并发场景可通过 WAL、短
中
消息膨胀 行 可行 事务、按会话分页与归档缓解。 33
技术 战略
直接 fork 现有项 许可证与工程负担都更重,不符合“轻量、可控、可维
上可 上不 高
目 护”的目标。 12
做 建议
综合评分如下:
维度 评分 说明
战略方向 9/10 明确、正确,且用户需求聚焦。
选型合理性 8.5/10 技术栈搭配符合目标场景。 34
原始范围控制 4/10 范围明显超宽。
首版工程可达性 6/10 不修订可以做,但高概率延期或失控。


<!-- source-page: 7 -->

维度 评分 说明
修订后工程可达性 8.5/10 收敛后可在一个稳定节奏内完成。
必要修订与建议版方案
必须修订的地方
本报告建议只做“必要修订”,不改变文件大方向。关键修订如下:
是
否
改
原始设想 建议修订 原因
变
方
向
首版同时覆盖研究、产
把“实施工程”与“文档资产”拆开:
品、Prompt、模型适
代码首发只做 MVP 闭环,Codex 否则会出现“文档先于产品”的交付
配、部署、Codex 提 否
提示词/AGENTS 可与代码并行产 失衡。
示词、AGENTS 等大
出,但不阻塞首发
而全内容
v1 仅正式发布单用户模式;多用
当前用户规模不需要;Agnai 类型
首版默认同时支持单用 户保留 User 维度、JWT 骨架与
否 复杂度不适合首发。
户与轻量多用户 数据隔离字段,但不开启共享/管
理逻辑
保留 POST /api/chat/
stream ,但前端使用 fetch + Nest 的 @Sse() 示例与
POST /api/chat/
ReadableStream 解析 EventSource 配套,原生
stream + 原生 SSE / 否
text/event-stream ;不要 EventSource 只基于 URL 建立单向
EventSource 混用
用原生 EventSource 发送聊天请 连接;聊天需要请求体。 32
求
OpenAI 官方重点推进
v1 就把 Responses /
v1 内部规范以“统一消息结构 + Responses,但 DeepSeek 与
Chat Completions /
Chat Completions 适配层”为主, 否 OpenRouter 的主路径都仍非常贴
多供应商差异全部等权
Responses 适配层作为 Phase 2 近 Chat Completions;先保兼容
适配
面再扩展。 35
这是最小但完整的角色扮演提示
Prompt Builder 一开 v1 只做平台规则 + 角色卡 +
链。Chub/Kobold 的 scan depth /
始做长期记忆/摘要/高 Persona + 命中的世界书 + 最近 否
token budget / World Info 已足以
级递归世界书 历史 + 用户输入 + 输出约束
支持首版。 31
首版追求绝对轻量,但
同时加入插件、Bot 首版只做目录边界与接口占位, 预留可以,提前施工会稀释主线。
否
Gateway、PWA、多 不写业务实现
端包装预留实现


<!-- source-page: 8 -->

建议版目标产品定义
基于上述修订,建议把首版产品定义收敛为:
Tavern Lite:一个基于 Vue 3 + NestJS + Prisma + SQLite 的轻量自托管 AI 角色对话系统,面
向个人与小范围朋友使用,支持角色卡、会话管理、Prompt 预览、关键词世界书、OpenAI-
compatible 模型配置与流式聊天,并以清晰模块边界支持后续由 Codex 分阶段继续开发。
推荐的前后端主方案
前端建议采用 Vue 3 + Vite + TypeScript + Pinia + Vue Router + Naive UI。Vue 官方对完整应用推荐
Composition API + SFC;Pinia 在 TS、state 共享、debug 和更简洁 API 方面都优于继续新建 Vuex 风格复杂
结构;Naive UI 官方 README 直接强调它是 Vue 3 组件库,具备完备组件、可主题化、TypeScript 编写与较
快的数据组件,对聊天产品需要的大量表单、抽屉、模态框、表格与暗色主题更合适。Element Plus 也完全可
用,但它更偏后台/表单管理风格;若目标是“聊天优先、风格自定义优先”,Naive UI 更合拍。 37
后端建议采用 NestJS + Prisma + SQLite + fetch/SSE 格式流。Nest 原生提供模块化结构、CORS、文件上
传、静态资源与 SSE 支持;SQLite 适合单机单文件部署与简化备份;Prisma 则使 SQLite → PostgreSQL 的未
来迁移更可控。数据库建议启动时开启 WAL,并把聊天写入设计为“短事务 + 会话级锁 + 分页拉取 + 后台归档
点预留”。 38
下面的建议版架构图与文件方向一致,但把首版边界收紧了:
Vue3WebApp
REST+fetchstream
NestJSAPI
Auth/UserMode PromptPreviewModule ModelConfigModule Uploads/StaticAssets Prisma ChatOrchestrator
SQLite PromptBuilder ModelGateway
CharacterModule Conversa M ti o o d n u & le Message WorldBookModule Persona/Preset Open P A r I o -c v o id m e p rs atible
OpenAI/DeepSeek/
OpenRouter/LocalProxy
实施路线图
里程碑化实施思路
建议把实施拆成 6 个里程碑,而不是按文件章节线性实现。这样做的原因很简单:文件是“知识组织结构”,不
是“最短交付路径”。真实开发应围绕最小闭环推进。
建议的主里程碑如下:
里程碑 目标 完成标准
跑通 monorepo、前后端通信、Prisma/SQLite、基 本地一键启动,能登录或进入
M1 基础底座
础鉴权模式 单用户入口


<!-- source-page: 9 -->

里程碑 目标 完成标准
M2 角色与模型 角色 CRUD、头像上传、模型配置 CRUD、连通性测 能创建角色、保存模型配置并
配置 试 测试连通
能创建会话并看到构建后的
M3 会话与消息 会话 CRUD、消息持久化、Prompt 预览
Prompt
M4 流式聊天闭 POST /chat/stream 、前端流式展示、停止生 完成第一条“可聊、可停、可
环 成、保存 assistant 回复 存”的完整链路
M5 世界书与质 关键词触发、scan depth、token budget、角色/ Prompt 预览能展示命中世界
量控制 Persona 融合 书条目
备份恢复、日志、监控、Docker 部署、文档与 单机部署可运行,具备基础恢
M6 部署与稳态
AGENTS 复能力
逐步实施表
下表给出推荐的实操路线图。时长以小团队加速版为基线;如果是个人主导,可按 1.6–2 倍节奏估算。
时
阶段 主要任务 负责人类型 依赖 关键产出
长
Tech Lead / MVP 范围基
发现与收 冻结 MVP 范围、输出实体关系、 0.5
Product 无 线、阶段验
敛 接口草图、页面清单 周
Owner 收表
pnpm workspace、Vue 3/Vite、
工程初始 Full-stack / 1 发现与收 可启动工程
NestJS、ESLint/Prettier、环境变
化 Platform 周 敛 骨架
量、CI 基础
Prisma schema 初版、SQLite 初
Backend / 1.5 工程初始 DB 与鉴权基
数据底座 始化、seed、单用户模式、基础
Full-stack 周 化 础
setting 表
Character/Asset API、列表/创
Frontend + 2 角色管理闭
角色域 建/编辑/导入导出 JSON、头像上 数据底座
Backend 周 环
传
ModelConfig CRUD、连接测
Backend + 1.5 模型配置闭
模型域 试、统一 provider contract、 数据底座
Frontend 周 环
default preset
会话与消 Conversation CRUD、Message Backend + 1.5 角色域、 会话/消息数
息域 CRUD、标题生成占位、分页查询 Frontend 周 模型域 据闭环
Prompt 角色卡、Persona、历史消息、基 1.5 会话与消 Prompt 可
Backend
Builder v1 础规则、Prompt 预览 API 周 息域 视化闭环
POST /chat/stream 、fetch
Backend + 2 Prompt 端到端聊天
流式聊天 流读取、停止生成、重试/失败状
Frontend 周 Builder v1 闭环
态、会话锁


<!-- source-page: 10 -->

时
阶段 主要任务 负责人类型 依赖 关键产出
长
WorldBook/Entry CRUD、关键
Backend + 1.5
世界书 词匹配、priority/scan depth/ 流式聊天 世界书闭环
Frontend 周
token budget、命中调试 UI
稳定性与 备份/恢复、日志、观测指标、 DevOps / 1.5
前述各项 可部署版本
运维 Docker Compose、部署脚本 Backend 周
AGENTS.md、Codex 阶段提示
Tech Lead / 1 稳定性与 可持续开发
交付文档 词、README、运维手册、风险
Full-stack 周 运维 资料
清单
Gantt 风格时间线
TavernLite推荐实施时间线
收敛 MVP范围冻结与阶段验收定义
工程底座 Monorepo与前后端脚手架 Prisma/SQLite/单用户模式
角色管理与资产上传
核心领域 模型配置与连接测试
会话与消息域
Prompt与聊天 PromptBuilderv1与预览 流式聊天闭环
世界书与稳态 世界书与命中调试 备份、日志、监控、Docker
文档与交付 AGENTS与Codex分阶段文档
07/05 07/12 07/19 07/26 08/02 08/09 08/16 08/23 08/30 09/06 09/13
关键实现要点
有三个实现点必须强调,因为它们直接决定项目成败。
其一,流式聊天不要用“文档层面的 SSE 概念”替代“工程层面的传输实现”。Nest 官方 SSE 文档展示的是
@Sse() + Observable<MessageEvent> + EventSource 的标准模式;MDN 也说明
EventSource 是从指定 URL 建立单向 HTTP 持久连接并接收 text/event-stream 事件。这个模式
对“服务端主动推送通知”很好,但对“用户每次提交一条聊天消息,需要带 JSON 请求体,再接回流式 delta”并
不理想。为了保留 POST /api/chat/stream 和请求体,推荐方案是:后端仍然按 SSE 帧格式输出
event: delta / event: done / event: error ,但前端通过 fetch() 获取 ReadableStream
自行解析文本帧。这样既保留 SSE 的易解析格式,又满足聊天接口的 POST 语义。 32
其二,模型网关要以“消息规范内核 + 供应商适配器”实现,而不要让聊天业务直接 fetch(供应商 URL) 。
OpenRouter 文档明确指出其请求/响应 schema 与 OpenAI Chat API 非常相近,并做了归一化;DeepSeek 官
方示例则直接使用 OpenAI SDK,将 base_url 指向 https://api.deepseek.com 并调用
chat.completions.create 。这说明“OpenAI-compatible 抽象层”是现实可行的,但它应该放在 Model
Gateway 中,而不是散落在聊天服务、Prompt 服务或前端页面中。 39
其三,Prompt Builder 是首版最核心的“算法层”,不是一个普通工具模块。Chub 的 Lorebook 文档已经展示
了 scan depth、token budget、priority、case sensitivity、whole-word match 等成熟控制项;KoboldAI/
KoboldCpp 又给出了 Memory、Author’s Note、World Info 的典型分层。因此首版 Prompt Builder 不应追
求“复杂”,而应追求“唯一入口”和“可解释”。任何角色、Persona、世界书、最近消息、输出风格规则,都应只
通过一个 Builder 产生最终 messages,Prompt 预览复用同一条代码路径,而不能在聊天接口里额外拼一
版“隐藏 Prompt”。 31


<!-- source-page: 11 -->

资源、预算与监控
资源配置建议
为了让计划真正可操作,建议把资源分成“必须角色”和“可兼任角色”两层。文件没有指定真实 owner,因此这里
采用角色类型。
是否
角色类型 主要职责 可否兼任
必须
Tech Lead / Product 范围控制、架构决策、验收、Codex 任务拆 个人项目可由你本
是
Owner 分 人兼任
可兼任部分后端联
Full-stack Engineer A 是 前端主导、页面与状态管理、聊天交互
调
Full-stack Engineer B / NestJS、Prisma、Prompt Builder、Model
是 可兼任部署
Backend Gateway、流式接口
回归测试、导入导出验证、备份恢复演练、 可由 Lead 兼职承
QA / 文档 建议
文档整理 担
可兼 小项目可由
DevOps / 部署 Docker、备份、日志、HTTPS、Nginx 配置
职 Backend 兼任
预算表
由于文件未指定预算,本表给出两档规划估算,其中“个人主导版”突出现金支出,“小团队加速版”突出完全成
本。以下金额为估算值,便于比较,不代表市场报价。
预算项 个人主导版 小团队加速版 说明
域名与 私有部署可选内网或零域名
¥200–¥600 / 年 ¥200–¥600 / 年
HTTPS 方案
服务器 ¥150–¥500 / 月 ¥300–¥1,200 / 月 2C4G 到 4C8G 足够首版
LLM 测试额
¥1,000–¥5,000 ¥5,000–¥15,000 取决于模型与压测强度
度
存储与备份 ¥100–¥300 / 月 ¥300–¥800 / 月 主要是 uploads 与快照
私有仓库、监控、设计协作
工具与协作 ¥0–¥1,000 ¥2,000–¥8,000
等
工程实现人 12–14 周的小团队完全成本
以本人投入为主 ¥180,000–¥360,000
力 估算
质量与文档 自行承担 ¥10,000–¥30,000 回归测试与交付文档
风险缓冲 ¥1,000–¥3,000 ¥25,000–¥50,000 约占直接成本 10–15%
约 ¥2,500–¥15,000 现金 约 ¥220,000–¥465,000 完全
合计 个人项目通常更接近左侧
支出 成本


<!-- source-page: 12 -->

如果只看“首个能用版本的现金支出”,这个项目其实非常友好:SQLite 单文件、低并发、私有部署、OpenAI-
compatible provider 外部托管推理,使你可以把真正的资源投入集中在工程时间而非基础设施上。SQLite 官
方也明确强调其“单文件、低维护、低运维复杂度”的优势正适用于这种场景。 40
KPI 与监控计划
建议把 KPI 分为“交付期 KPI”和“运行期 KPI”。这样可以防止项目只关注功能列表,而忽略体验与稳定性。
预警阈
指标 目标值 采集方式 负责人
值
首 token 时间 p95 ≤ 3 秒 后端日志 + 前端埋点 > 5 秒 Backend
流式聊天成功率 ≥ 98% /chat/stream 成功/失败比 < 95% Backend
stop 请求后 2 秒内完成资源释
生成中断可控率 ≥ 95% < 90% Backend
放
Prompt 预览一致 对比 preview 与实际请求构建哈
100% < 100% Backend
性 希
世界书命中可解释 Frontend +
≥ 90% UI 中可显示命中条目与原因 < 80%
率 Backend
数据导入导出成功
≥ 99% 回归测试 < 97% QA
率
SQLite busy 错误
< 0.5% 日志统计 > 1% Backend
率
任何失
备份恢复演练成功 100% 每月恢复演练 DevOps
败
< 1% 会
前端崩溃率 浏览器错误采集 > 2% Frontend
话
任意一
API Key 泄露事故 0 安全检查 Tech Lead
次
监控方面,不需要首版上重型可观测平台。推荐最低配做法是:后端结构化日志、关键接口耗时、SQLite
busy/error 计数、模型供应商返回码统计、前端错误上报、备份任务日志和恢复演练记录。这已经足以覆盖首
版的主要运行风险。
风险处置与应急预案
Top 风险与应急策略
风险不在于“技术做不到”,而在于“技术上都做得到,所以更容易做太多”。下面给出最值得重点预案的 6 类风
险。


<!-- source-page: 13 -->

评
风险 触发信号 预防措施 应急预案
级
立即砍掉多用户、摘
冻结 MVP 清单;每阶段只允许
新增需求不断挤入首 要、版本化、PWA、
范围失控 高 1 个主能力闭环;Codex 任务
版;阶段交付物膨胀 Bot Gateway 实现,
必须声明“不做什么”
只保留接口占位
浏览器断流、停止生成 使用 fetch + 降级为非流式
SSE 实现
高 无效、Nginx 缓冲影响 ReadableStream ;统一 SSE POST /chat ;保
不稳定
实时性 帧协议;代理层关闭缓冲 留“重新生成”兜底功能
不同 provider 的 标记 provider 为“受限
模型供应 建立 provider adapter
stream chunk 字段不 支持”;回退到基础
商兼容性 高 contract test;先支持 Chat
一致;timeout/参数报 chat 模式,关闭高级
漂移 Completions 公共交集
错 参数
临时缩短历史窗口;
Prompt 膨 设定 scan depth、token
token 超限、角色跑 关闭低优先级世界
胀导致效 高 budget、最近消息窗口、世界
偏、世界书污染 书;记录 prompt
果变差 书上限
hash 做回溯
当 busy 错误持续超阈
SQLITE_BUSY 增加、
SQLite 写 中 开启 WAL;保持短事务;会话 值,先引入内存队
写入阻塞、消息保存错
争用 高 级锁;分页加载消息 列;再评估迁移
位
PostgreSQL
旋转所有密钥;隔离
API Key 只存在服务端;上传白
API Key 泄露、恶意上 上传目录;清理日
安全问题 高 名单;日志脱敏;角色导入做
传文件、日志含密钥 志;暂停外部访问入
JSON 校验
口
何时需要迁移 PostgreSQL
SQLite 官方的边界非常清楚:当你有很多并发写者、多服务器写入、网络文件系统直接共享数据库文件,或者
写密度与规模已经需要 client/server 协调时,应考虑迁移 client/server 数据库;Prisma 同时支持
PostgreSQL,可以作为平滑迁移路径。对本项目而言,建议设定明确触发条件,而不是“感觉不够用了再说”。
建议的迁移触发器如下:
触发条件 说明
平均同时在线写会话 ≥ 20 且 SQLITE_BUSY 持续升 说明“单 writer”瓶颈已经进入用户可感知范围。
高 41
单库消息量达到数百万且归档/分页压力明显 需要更强索引、后台任务与更稳定的运维能力。
需要多实例应用服务器共享同一数据库 SQLite 不适合这么做。 33
需要更复杂的分析、管理后台、共享角色协作 表示系统开始从个人工具跨向平台型产品。


<!-- source-page: 14 -->

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


<!-- source-page: 15 -->

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
