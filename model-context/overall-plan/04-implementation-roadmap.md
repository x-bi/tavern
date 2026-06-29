---
title: "实施路线图"
source_pdf: "轻量级 AI 酒馆方案深度研究与实施报告.pdf"
---

# 实施路线图

实施路线图
里程碑化实施思路
建议把实施拆成 6 个里程碑,而不是按文件章节线性实现。这样做的原因很简单:文件是“知识组织结构”,不
是“最短交付路径”。真实开发应围绕最小闭环推进。
建议的主里程碑如下:
里程碑 目标 完成标准
跑通 monorepo、前后端通信、Prisma/SQLite、基 本地一键启动,能登录或进入
M1 基础底座
础鉴权模式 单用户入口
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
