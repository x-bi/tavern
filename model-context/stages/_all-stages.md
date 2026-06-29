# 全阶段提示词合集

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

---

阶段 1|Monorepo 初始化
阶段目标: 建立前后端协同开发骨架。
前置依赖: 阶段 0。
文件范围: package.json 、 pnpm-workspace.yaml 、 apps/web 、 apps/server 、 packages/
* 。
本阶段要做: 初始化 workspace、统一 lint/format/tsconfig、定义目录。
本阶段不要做: 不写业务模块,不接数据库。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 1 阶段开发。
项目背景:
这是一个基于 Vue3 + Vite + TypeScript + Pinia + Vue Router + Naive UI + NestJS
+ Prisma + SQLite 的轻量级 AI 酒馆 / 角色对话系统。
项目目标是先完成个人和少量朋友可用的 Web MVP,不做支付、市场、机器人、TTS、图片生成、向量数
据库、Redis 等非 MVP 功能。
当前阶段:
第 1 阶段:Monorepo 初始化
前置条件:
- 已完成:AGENTS.md、README、架构文档
- 当前已有目录:项目根目录与 docs
- 当前已有模块:无业务模块
本阶段目标:
- 建立 pnpm monorepo
- 建立 apps/web、apps/server、packages/shared 的目录骨架
- 建立统一 TypeScript、lint、format 规则
本阶段需要实现:
1. 初始化 pnpm workspace 和根 package.json scripts
2. 建立 apps/web、apps/server、packages/shared、data、docs 目录
3. 配置根级 tsconfig、eslint、prettier、editorconfig
4. 约定共享类型包 packages/shared 的基础导出结构
5. 补充 README 中的 monorepo 说明
涉及文件范围:
- package.json
- pnpm-workspace.yaml
- tsconfig*.json
- .editorconfig
- .gitignore
- apps/web/*
- apps/server/*
- packages/shared/*
- README.md
本阶段明确不要做:
- 不要创建具体业务模块
- 不要引入数据库和 Prisma
- 不要写角色、会话、聊天业务代码
- 不要引入未要求的大型依赖
- 不要改动与 monorepo 无关文件
- 不要把 API Key 暴露到前端
- 不要硬编码 Prompt
- 不要直接接模型供应商接口
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- 使用 TypeScript
- 目录命名清晰
- scripts 命名一致
- 为后续前后端开发保留清晰入口
验收标准:
1. pnpm install 后 workspace 可识别
2. apps/web、apps/server、packages/shared 结构存在
3. 根 scripts 可用于分别启动前后端占位工程
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何安装依赖
4. 如何验证 workspace 正常
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: workspace 正常;目录清晰;根脚本可运行。
可能风险: 过早引入过多工程化依赖。
人工检查点: 保证 packages/shared 只做共享类型,不放业务逻辑。
完成后输出: 修改文件、安装方式、验证方式、完成项、风险。

---

阶段 2|Vue3 前端基础工程
阶段目标: 建立前端可运行工程与基础布局。
前置依赖: 阶段 1。
文件范围: apps/web/src/* 。
本阶段要做: Vite + Vue3 + TS + Pinia + Router + Naive UI,建立 AppLayout、基础路由、HTTP 客户端占
位。
本阶段不要做: 不实现具体业务页逻辑。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 2 阶段开发。
项目背景:
这是一个基于 Vue3 + Vite + TypeScript + Pinia + Vue Router + Naive UI 的前端,服
务于轻量级 AI 酒馆系统。
目标是先完成可维护的 Web MVP 前端骨架。
当前阶段:
第 2 阶段:Vue3 前端基础工程
前置条件:
- 已完成:monorepo 初始化
- 当前已有目录:apps/web
- 当前已有模块:前端空壳目录
本阶段目标:
- 建立可启动的 Vue3 前端工程
- 接入 Vue Router、Pinia、Naive UI
- 建立 layouts、views、components、api、stores、composables、types、utils、styles
的目录骨架
本阶段需要实现:
1. 初始化 Vite + Vue3 + TypeScript 工程并接入 Pinia、Vue Router、Naive UI
2. 建立 App.vue 与 AppLayout.vue
3. 建立基础路由:登录入口、角色、会话、聊天、模型、预设、Persona、世界书、Prompt 预览、设
置、备份导入导出
4. 建立 api/http.ts 占位封装
5. 建立全局样式与基础页面空壳
6. 建立基础 not-found 页和 loading/error 占位组件
涉及文件范围:
- apps/web/src/main.ts
- apps/web/src/App.vue
- apps/web/src/layouts/*
- apps/web/src/router/*
- apps/web/src/views/*
- apps/web/src/components/*
- apps/web/src/api/http.ts
- apps/web/src/stores/*
- apps/web/src/composables/*
- apps/web/src/types/*
- apps/web/src/styles/*
本阶段明确不要做:
- 不要实现实际业务接口调用
- 不要实现角色 CRUD 页面细节
- 不要实现聊天流式逻辑
- 不要接入模型供应商
- 不要引入大型 UI 之外的新依赖
- 不要把 API Key 写入前端
- 不要硬编码 Prompt
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- Vue3 Composition API
- TypeScript
- Pinia
- Vue Router
- Naive UI
- 页面与组件目录清晰
- 组件只做展示壳,不塞业务规则
验收标准:
1. 前端可以启动
2. 路由能切换到各个占位页面
3. 基础布局与导航存在
4. 目录结构适合后续逐阶段填充
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 前端启动方式
4. 如何验证路由与布局正常
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: 前端可启动;路由完整;布局存在。
可能风险: 页面壳写得过重,后续难拆。
人工检查点: 组件中不能夹带角色/聊天业务逻辑。
完成后输出: 文件、启动方式、验证方式、剩余工作。

---

阶段 3|NestJS 后端基础工程
阶段目标: 建立后端可运行骨架与配置体系。
前置依赖: 阶段 1。
文件范围: apps/server/src/* 。
本阶段要做: 初始化 NestJS、ConfigModule、全局前缀、CORS、基础模块、健康检查。
本阶段不要做: 不接数据库;不写业务 API。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 3 阶段开发。
项目背景:
这是一个基于 NestJS + TypeScript + Prisma + SQLite 的轻量后端。
目标是为后续角色、会话、聊天、Prompt Builder、Model Gateway 提供清晰模块边界。
当前阶段:
第 3 阶段:NestJS 后端基础工程
前置条件:
- 已完成:monorepo 初始化
- 当前已有目录:apps/server
- 当前已有模块:空壳目录
本阶段目标:
- 建立可启动的 NestJS 服务
- 建立 ConfigModule、环境变量加载、全局前缀、CORS、基础健康检查
- 建立 modules 与 common 目录骨架
本阶段需要实现:
1. 初始化 NestJS 应用
2. 配置 main.ts,包括全局前缀 /api、CORS、基础 ValidationPipe 占位
3. 建立 app.module.ts
4. 建立 config、common、prisma、modules 目录
5. 建立 HealthController 或 AppController 作为基础检查接口
6. 建立 .env.example 占位说明
涉及文件范围:
- apps/server/src/main.ts
- apps/server/src/app.module.ts
- apps/server/src/config/*
- apps/server/src/common/*
- apps/server/src/modules/*
- apps/server/.env.example
- package.json
本阶段明确不要做:
- 不要接入 Prisma 和数据库
- 不要实现业务模块控制器
- 不要实现 SSE、聊天、模型调用
- 不要改动前端
- 不要把 API Key 输出到日志
- 不要硬编码 Prompt
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- NestJS Module / Controller / Service 结构清晰
- 使用 TypeScript
- 配置与业务分离
- 为后续模块扩展保留入口
验收标准:
1. 后端可以启动
2. /api/health 或类似接口可返回正常状态
3. 环境变量加载正常
4. 模块与 common 目录骨架完成
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 后端启动方式
4. 如何验证健康检查接口
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: Nest 服务可启动;健康接口可用。
可能风险: 过早把 common 写成“大而全公共库”。
人工检查点: 检查配置与业务是否分离。
完成后输出: 文件、启动方式、验证方式、风险。

---

阶段 4|Prisma + SQLite 接入
阶段目标: 将后端接到 SQLite,并让 Prisma 基础可用。
前置依赖: 阶段 3。
文件范围: prisma/* 、 apps/server/src/prisma/* 、 .env 。
本阶段要做: 初始化 Prisma、SQLite datasource、PrismaService、PrismaModule、基本迁移。
本阶段不要做: 不设计完整业务 schema。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 4 阶段开发。
项目背景:
数据库第一版使用 SQLite,ORM 使用 Prisma。目标是部署简单、备份方便、后续可迁移
PostgreSQL。
当前阶段:
第 4 阶段:Prisma + SQLite 接入
前置条件:
- 已完成:NestJS 基础工程
- 当前已有目录:apps/server、prisma
- 当前已有模块:后端基础骨架
本阶段目标:
- 接入 Prisma
- 使用 SQLite 作为 datasource
- 在 NestJS 中提供 PrismaModule 与 PrismaService
本阶段需要实现:
1. 初始化 Prisma 目录与 schema.prisma
2. 配置 SQLite datasource,数据库文件放到 data 目录或明确约定的位置
3. 创建 PrismaModule 与 PrismaService
4. 在 AppModule 中接入 PrismaModule
5. 完成一次最小迁移验证
6. 在 README 或 docs 里补充 migrate / generate 的执行说明
涉及文件范围:
- prisma/schema.prisma
- prisma/migrations/*
- apps/server/src/prisma/prisma.module.ts
- apps/server/src/prisma/prisma.service.ts
- apps/server/.env.example
- README.md 或 docs/*
本阶段明确不要做:
- 不要一次性写完整业务模型
- 不要实现 User/Character 等完整 CRUD
- 不要引入 PostgreSQL、Redis
- 不要改动前端
- 不要把数据库文件路径写死为不可配置
- 不要把 API Key 暴露到任何前端代码
- 不要硬编码 Prompt
- 不要引入支付、市场、机器人、TTS、图片生成、向量数据库
代码要求:
- 使用 PrismaService 提供数据访问
- SQLite 路径可通过环境变量配置
- 文档要写清迁移和重置方式
验收标准:
1. Prisma generate 正常
2. Prisma migrate dev 正常
3. NestJS 启动时 Prisma 连接正常
4. 数据库文件生成在约定位置
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何执行 prisma generate / migrate
4. 如何验证数据库连接
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: Prisma generate/migrate 正常;Nest 可连 SQLite。
可能风险: SQLite 路径、迁移目录混乱。
人工检查点: 数据库文件应位于可备份的位置。
完成后输出: 文件、迁移方式、验证方式、风险。

---

阶段 5|数据库 schema 初版
阶段目标: 建立一版足以支撑 MVP 的完整数据模型。
前置依赖: 阶段 4。
文件范围: prisma/schema.prisma 。
本阶段要做: 建 User、Character、Conversation、Message、WorldBook、WorldBookEntry、
ModelConfig、PromptPreset、UserPersona、Asset、AppSetting、ModelCallLog。
本阶段不要做: 不做高级优化,不上复杂索引策略。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 5 阶段开发。
项目背景:
MVP 需要完整但不过度设计的数据库模型,支持角色管理、会话、消息、Prompt Builder、世界书、
模型配置、上传资源、设置与调用日志。
当前阶段:
第 5 阶段:数据库 schema 初版
前置条件:
- 已完成:Prisma + SQLite 接入
- 当前已有目录:prisma
- 当前已有模块:Prisma 基础
本阶段目标:
- 完成 MVP 所需核心表
- 预留少量后续扩展字段,但不引入复杂多租户和商业字段
- 保持对 PostgreSQL 未来迁移友好
本阶段需要实现:
1. 设计 User、Character、Conversation、Message、WorldBook、WorldBookEntry、
ModelConfig、PromptPreset、UserPersona、Asset、AppSetting、ModelCallLog
2. 需要 createdAt、updatedAt,必要处可加 deletedAt
3. 对角色、会话、消息、世界书、模型配置建立合理索引
4. exampleMessages、metadata 等可用 Json 或 String,做出清晰选择并注释
5. 生成迁移
涉及文件范围:
- prisma/schema.prisma
- prisma/migrations/*
本阶段明确不要做:
- 不要实现所有可选表的完整业务逻辑
- 不要设计多租户组织空间
- 不要加入支付、市场、审核、收益系统相关字段
- 不要加入向量库相关字段
- 不要把 schema 写得过度复杂
- 不要改动前端
- 不要暴露 API Key 到前端
- 不要硬编码 Prompt
代码要求:
- 字段命名清晰
- 关系明确
- 尽量避免只适用于 PostgreSQL 的特性
- 迁移可执行
验收标准:
1. schema 能覆盖 MVP 所需实体
2. migrate 成功
3. 核心关系正确
4. 没有明显超纲字段
完成后请输出:
1. 修改文件列表
2. 新增迁移列表
3. 模型说明简表
4. 如何执行迁移
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: schema 覆盖 MVP;迁移成功;关系正确。
可能风险: 把未来功能全塞进去。
人工检查点: 检查 JSON 字段是否只用于非高频查询数据。
完成后输出: 模型说明、迁移方式、风险。

---

阶段 6|Seed 数据
阶段目标: 提供默认用户、默认模型配置、默认预设、样例角色与世界书。
前置依赖: 阶段 5。
文件范围: prisma/seed.* 、 package.json 。
本阶段要做: 写 seed 脚本与示例数据。
本阶段不要做: 不填充大量测试垃圾数据。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 6 阶段开发。
项目背景:
为了降低本地开发与验收成本,需要可重复执行的 seed 数据,让角色列表、模型配置、预设、
Persona、世界书页面可以快速看到结果。
当前阶段:
第 6 阶段:Seed 数据
前置条件:
- 已完成:数据库 schema 初版
- 当前已有目录:prisma
- 当前已有模块:核心表与迁移
本阶段目标:
- 提供一套最小但有代表性的 seed 数据
- 支持重复执行或尽量幂等
- 方便后续页面和 API 开发
本阶段需要实现:
1. 创建默认用户
2. 创建默认模型配置
3. 创建默认 Prompt 预设
4. 创建示例角色
5. 创建示例世界书和若干条目
6. 在 package.json 中加入 seed script
7. 写清重置数据库后的 seed 执行方式
涉及文件范围:
- prisma/seed.ts 或等价文件
- package.json
- README.md 或 docs/*
本阶段明确不要做:
- 不要创建大量随机数据
- 不要把 seed 脚本耦合到生产逻辑
- 不要写死真实 API Key
- 不要改动前端
- 不要拓展到非 MVP 数据
- 不要硬编码聊天 Prompt 业务逻辑
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- 使用 PrismaClient
- 尽量可重复执行
- 样例内容有实际展示价值
验收标准:
1. seed 执行成功
2. 数据库中可见默认用户、角色、世界书、模型配置、预设
3. 重置数据库后可快速恢复演示数据
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. seed 执行方式
4. 如何验证 seed 成功
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: seed 可执行,样例数据可用于页面开发。
可能风险: seed 不幂等或依赖真实密钥。
人工检查点: 默认模型配置不可包含真实 API Key。
完成后输出: 文件、执行方式、验证方式。

---

阶段 7|单用户模式与简单登录
阶段目标: 先用最轻模式解决身份上下文问题。
前置依赖: 阶段 6。
文件范围: apps/server/src/modules/auth/* 、 users/* 。
本阶段要做: 实现单用户模式,可选本地密码保护;保留未来多用户轻量模式入口。
本阶段不要做: 不做完整注册系统。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 7 阶段开发。
项目背景:
第一版优先单用户模式或极简登录,核心目标是快速形成可用闭环,同时不阻断后续轻量多用户扩展。
当前阶段:
第 7 阶段:单用户模式 / 简单登录
前置条件:
- 已完成:schema、seed
- 当前已有目录:apps/server/src/modules
- 当前已有模块:Prisma 基础、核心数据表
本阶段目标:
- 实现最小认证上下文
- 提供 auth/me 接口
- 支持环境变量启用单用户密码保护或无密码管理员模式
本阶段需要实现:
1. 创建 AuthModule 与必要的 UsersModule 基础能力
2. 实现 POST /api/auth/login、GET /api/auth/me、POST /api/auth/logout
3. 单用户模式下返回固定管理员用户
4. 可选简单 session 或轻量 JWT,但不要复杂化
5. 在请求上下文里拿到 currentUser
涉及文件范围:
- apps/server/src/modules/auth/*
- apps/server/src/modules/users/*
- apps/server/src/common/*
- apps/server/.env.example
本阶段明确不要做:
- 不要实现公开注册、邮箱验证、找回密码
- 不要实现复杂 RBAC
- 不要实现共享角色权限
- 不要改动前端复杂登录页
- 不要把敏感口令写到前端
- 不要硬编码 Prompt
- 不要直接接模型供应商
- 不要引入 Redis、市场、支付、机器人、TTS、图片生成、向量数据库
代码要求:
- 认证逻辑简单清晰
- 与 User 表关联
- 未来可平滑扩展到轻量多用户
- 错误信息统一
验收标准:
1. login / me / logout 基础接口可用
2. 受保护接口能拿到 currentUser
3. 单用户模式易于本地部署
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何配置单用户模式
4. 如何测试登录流程
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: auth/me 正常;上下文可拿到当前用户。
可能风险: 认证写得太重。
人工检查点: 单用户模式必须可通过环境变量切换。
完成后输出: 文件、配置方式、测试方式。

---

阶段 8|统一 API 响应与错误处理
阶段目标: 固定成功/失败响应格式,减少后续前端分支判断成本。
前置依赖: 阶段 7。
文件范围: apps/server/src/common/* 。
本阶段要做: 全局异常过滤器、响应拦截器、错误码约定。
本阶段不要做: 不做复杂日志平台接入。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 8 阶段开发。
项目背景:
项目需要统一 REST API 格式,减少前端判断复杂度,也便于 Codex 后续持续生成一致的接口。
当前阶段:
第 8 阶段:统一 API 响应与错误处理
前置条件:
- 已完成:基础认证
- 当前已有目录:apps/server/src/common
- 当前已有模块:Auth 与基础服务
本阶段目标:
- 定义统一成功响应格式
- 定义统一错误格式
- 接入全局异常处理
本阶段需要实现:
1. 定义 Response DTO 或响应包装格式:success/data/message
2. 定义错误输出:success=false + error.code + error.message
3. 添加全局异常过滤器
4. 添加全局响应拦截器
5. 对常见异常做标准化映射
6. 补充错误码命名约定
涉及文件范围:
- apps/server/src/common/filters/*
- apps/server/src/common/interceptors/*
- apps/server/src/common/dto/*
- apps/server/src/main.ts
- docs/*
本阶段明确不要做:
- 不要引入复杂 observability 平台
- 不要把所有业务异常提前实现完
- 不要改动无关业务模块
- 不要改动前端业务页
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要直接接供应商模型接口
- 不要引入 Redis、向量数据库、市场、支付、机器人、TTS、图片生成
代码要求:
- 返回格式在全项目保持一致
- 错误码命名清晰
- 后续业务模块可直接复用
验收标准:
1. 成功响应格式统一
2. 失败响应格式统一
3. 业务模块接入成本低
4. 文档有示例
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何验证统一响应
4. 错误码约定示例
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: 成功/失败格式统一;文档清楚。
可能风险: 在拦截器里过度包装,影响 SSE。
人工检查点: 后续 SSE 路由应可跳过普通 JSON 包装。
完成后输出: 文件、验证方式、约定说明。
核心实体与页面首轮落地

---

阶段 9|角色 CRUD API
阶段目标: 建立角色管理最核心的后端接口。
前置依赖: 阶段 8。
文件范围: characters/* 。
本阶段要做: 列表、详情、创建、更新、删除、复制占位。
本阶段不要做: 不实现 JSON 导入导出。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 9 阶段开发。
项目背景:
角色是酒馆系统的核心实体。第一版需要先把角色 CRUD API 做稳,再逐步接入导入导出、头像上传和
聊天。
当前阶段:
第 9 阶段:角色 CRUD API
前置条件:
- 已完成:统一响应与错误处理
- 当前已有目录:apps/server/src/modules/characters
- 当前已有模块:Auth、Prisma、common
本阶段目标:
- 提供角色列表、详情、创建、更新、删除 API
- 角色数据字段与 schema 对齐
- 保持 DTO、Service、Controller 结构清晰
本阶段需要实现:
1. 创建 CharactersModule、Controller、Service、DTO
2. 实现 GET /api/characters
3. 实现 POST /api/characters
4. 实现 GET /api/characters/:id
5. 实现 PUT /api/characters/:id
6. 实现 DELETE /api/characters/:id
7. 预留 duplicate 能力入口但可不在本阶段实现
8. 基于 currentUser 做数据隔离
涉及文件范围:
- apps/server/src/modules/characters/*
- apps/server/src/common/*
- packages/shared/*(如需要共享类型)
本阶段明确不要做:
- 不要实现角色 JSON 导入导出
- 不要实现头像上传
- 不要实现聊天逻辑
- 不要在角色模块里硬编码 Prompt Builder 逻辑
- 不要改动无关模块
- 不要暴露 API Key
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- NestJS Module / Controller / Service / DTO
- 数据访问通过 PrismaService
- 响应统一
- 要有基础参数校验
- 代码可读可维护
验收标准:
1. 角色 CRUD API 全部可用
2. DTO 校验正常
3. 用户只能访问自己的角色
4. 响应格式统一
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: 角色 CRUD 全可用。
可能风险: 角色字段设计和表结构不一致。
人工检查点: firstMessage 、 exampleMessages 、 systemPrompt 等字段要完整覆盖。
完成后输出: 文件、接口、测试方式。

---

阶段 10|角色列表页
阶段目标: 把角色列表展示出来,并接通角色列表 API。
前置依赖: 阶段 2、阶段 9。
文件范围: apps/web/src/views/characters/* 、 stores/* 、 api/* 。
本阶段要做: 列表页、搜索、空状态、跳转。
本阶段不要做: 不实现复杂筛选。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 10 阶段开发。
项目背景:
角色列表页是用户进入系统后的主要入口,需要优先打通。
当前阶段:
第 10 阶段:角色列表页
前置条件:
- 已完成:Vue 前端骨架、角色 CRUD API
- 当前已有目录:apps/web/src/views/characters、api、stores
- 当前已有模块:基础布局与路由、角色后端接口
本阶段目标:
- 实现角色列表页
- 接通角色列表 API
- 提供创建、查看详情、编辑入口
本阶段需要实现:
1. 创建角色列表页视图
2. 创建角色列表 API 封装
3. 创建/补充 useCharacterStore
4. 展示角色头像、名称、摘要/标签简要信息
5. 支持基础搜索或前端过滤
6. 支持空状态、加载中、请求失败状态
7. 提供进入创建页、详情页、编辑页的跳转
涉及文件范围:
- apps/web/src/views/characters/CharacterListView.vue
- apps/web/src/components/CharacterCard.vue
- apps/web/src/api/characters.ts
- apps/web/src/stores/character.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现角色创建/编辑表单细节
- 不要实现导入导出
- 不要实现聊天页
- 不要在组件里硬编码复杂业务规则
- 不要改动无关页面
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入 TTS、图片生成、市场、机器人、向量数据库、Redis
代码要求:
- Vue3 Composition API
- Pinia 管理共享状态
- 展示组件与数据获取逻辑分离
- 页面可维护
验收标准:
1. 角色列表页能正常加载角色
2. 加载、空状态、错误状态清晰
3. 可跳转到创建、详情、编辑页
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 前端启动方式
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 11|角色创建与编辑页
阶段目标: 落地 CharacterEditor 表单。
前置依赖: 阶段 10。
文件范围: views/characters/* 、 components/CharacterEditor.vue 。
本阶段要做: 创建/编辑表单、保存、校验。
本阶段不要做: 不做头像上传。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 11 阶段开发。
项目背景:
角色创建和编辑是酒馆系统的核心生产入口,需要覆盖名称、描述、人格、场景、开场白、示例对话、系
统提示、标签等字段。
当前阶段:
第 11 阶段:角色创建 / 编辑页
前置条件:
- 已完成:角色列表页
- 当前已有目录:角色 views、components、api、stores
- 当前已有模块:角色列表和角色 API
本阶段目标:
- 实现角色创建页和角色编辑页
- 复用 CharacterEditor 表单组件
- 和角色创建/更新 API 对接
本阶段需要实现:
1. 创建 CharacterEditor.vue
2. 创建 CharacterCreateView.vue 与 CharacterEditView.vue
3. 表单字段覆盖核心角色卡字段
4. 完成创建与更新提交
5. 加入基础表单校验
6. 提交成功后跳转详情页或列表页
7. 失败时展示清晰错误信息
涉及文件范围:
- apps/web/src/components/CharacterEditor.vue
- apps/web/src/views/characters/CharacterCreateView.vue
- apps/web/src/views/characters/CharacterEditView.vue
- apps/web/src/api/characters.ts
- apps/web/src/stores/character.ts
- apps/web/src/types/*
本阶段明确不要做:
- 不要实现头像上传
- 不要实现 JSON 导入导出
- 不要实现世界书关联 UI
- 不要实现聊天逻辑
- 不要在表单组件中硬编码 Prompt 规则
- 不要暴露 API Key
- 不要引入 Redis、向量数据库、市场、支付、机器人、TTS、图片生成
代码要求:
- 表单组件可复用
- 创建与编辑共享大部分逻辑
- 类型清晰
- 错误提示友好
验收标准:
1. 可以创建角色
2. 可以编辑角色
3. 表单校验有效
4. 成功/失败反馈清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 12|角色详情页
阶段目标: 呈现完整角色信息与操作入口。
前置依赖: 阶段 11。
文件范围: CharacterDetailView.vue 。
本阶段要做: 展示字段、复制角色、开始会话入口占位。
本阶段不要做: 不做聊天页对接。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 12 阶段开发。
项目背景:
角色详情页是“进入聊天前”的确认页面,需要清晰展示该角色的全部设定。
当前阶段:
第 12 阶段:角色详情页
前置条件:
- 已完成:角色创建/编辑页
- 当前已有目录:角色 views/components/api/store
- 当前已有模块:角色 CRUD 前后端
本阶段目标:
- 实现角色详情页
- 展示完整角色设定
- 提供编辑、删除、复制、开始会话入口
本阶段需要实现:
1. 创建角色详情页视图
2. 调用角色详情 API
3. 展示 description、personality、scenario、firstMessage、exampleMessages、
systemPrompt、tags、creatorNotes 等
4. 提供编辑按钮、删除按钮、复制按钮入口
5. 提供“开始聊天/新建会话”按钮占位跳转
涉及文件范围:
- apps/web/src/views/characters/CharacterDetailView.vue
- apps/web/src/api/characters.ts
- apps/web/src/stores/character.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现会话创建逻辑细节
- 不要实现头像上传
- 不要实现导入导出
- 不要把聊天逻辑写进角色详情页
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 信息分区清晰
- 长文本可读
- 操作按钮语义清晰
验收标准:
1. 角色详情可正常展示
2. 编辑/删除/复制/开始会话入口存在
3. 页面可读性良好
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 13|角色头像上传
阶段目标: 让角色拥有上传头像能力。
前置依赖: 阶段 11、阶段 12。
文件范围: assets/* 、 AvatarUploader.vue 、角色表单。
本阶段要做: 后端上传 API、本地保存、前端上传组件。
本阶段不要做: 不处理 OSS/S3。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 13 阶段开发。
项目背景:
角色头像是角色列表和详情页的重要视觉元素。第一版采用本地 uploads 目录存储。
当前阶段:
第 13 阶段:角色头像上传
前置条件:
- 已完成:角色详情页、角色编辑页
- 当前已有目录:assets 模块占位、角色前端页面
- 当前已有模块:角色 CRUD
本阶段目标:
- 实现本地头像上传
- 生成 Asset 记录与访问 URL
- 接入角色创建/编辑表单
本阶段需要实现:
1. 创建 AssetsModule 基础上传接口 POST /api/assets/upload
2. 限制文件类型和大小
3. 保存到本地 uploads/avatars/characters 或约定目录
4. 生成 Asset 表记录
5. 在 CharacterEditor 中接入 AvatarUploader.vue
6. 创建后能够把 avatarUrl 或 assetId 写回角色
涉及文件范围:
- apps/server/src/modules/assets/*
- apps/server/src/main.ts 或 ServeStatic 配置
- apps/web/src/components/AvatarUploader.vue
- apps/web/src/components/CharacterEditor.vue
- apps/web/src/api/assets.ts
- apps/web/src/api/characters.ts
本阶段明确不要做:
- 不要实现 OSS/COS/S3
- 不要做图片裁剪工作流
- 不要做用户头像
- 不要删除旧文件的复杂回收逻辑
- 不要暴露敏感路径
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 后端要校验 mime/type/size
- URL 访问逻辑清晰
- 上传组件可复用
验收标准:
1. 角色头像可上传
2. 列表与详情页能展示头像
3. 非法文件会被拒绝
4. 资源记录写入数据库
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试上传
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 14|ModelConfig API
阶段目标: 建立模型配置实体与后端 CRUD。
前置依赖: 阶段 8。
文件范围: models/* 。
本阶段要做: baseUrl 、 apiKey 、 providerName 、 modelName 、生成参数 CRUD。
本阶段不要做: 不写真实连接测试。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 14 阶段开发。
项目背景:
模型配置是 Prompt Builder 和聊天接口的前置依赖,需要先建立统一模型配置实体。
当前阶段:
第 14 阶段:ModelConfig API
前置条件:
- 已完成:统一响应、基础认证、数据库 schema
- 当前已有目录:models 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 提供模型配置 CRUD
- 安全保存 baseUrl、providerName、modelName、apiKey、temperature、topP、
maxTokens、timeout 等
- 不让业务代码直接依赖具体供应商
本阶段需要实现:
1. 创建 ModelsModule、Controller、Service、DTO
2. 实现 GET /api/model-configs
3. 实现 POST /api/model-configs
4. 实现 GET /api/model-configs/:id
5. 实现 PUT /api/model-configs/:id
6. 实现 DELETE /api/model-configs/:id
7. API 返回时对 apiKey 做脱敏处理
涉及文件范围:
- apps/server/src/modules/models/*
- apps/server/src/common/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 testConnection
- 不要实现 Model Gateway
- 不要在业务模块中直接使用这些配置发请求
- 不要把 apiKey 明文返回给前端
- 不要引入 Redis、向量数据库、支付、市场、机器人、TTS、图片生成
代码要求:
- DTO 清晰
- apiKey 存储与返回分离
- 响应统一
- 用户数据隔离
验收标准:
1. 模型配置 CRUD 可用
2. apiKey 不会在响应中明文泄露
3. 字段完整覆盖 MVP 需求
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

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

---

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

---

阶段 17|PromptPreset API
阶段目标: 为模型参数预设建立后端 CRUD。
前置依赖: 阶段 8。
文件范围: presets/* 。
本阶段要做: 参数预设实体 CRUD。
本阶段不要做: 不做复杂继承。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 17 阶段开发。
项目背景:
PromptPreset 用于保存温度、topP、maxTokens 以及可能的输出风格约束,便于聊天页切换。
当前阶段:
第 17 阶段:PromptPreset API
前置条件:
- 已完成:统一响应与错误处理
- 当前已有目录:presets 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 提供参数预设 CRUD
- 与模型配置分离
- 支持默认预设概念
本阶段需要实现:
1. 创建 PresetsModule、Controller、Service、DTO
2. 实现 GET /api/prompt-presets
3. 实现 POST /api/prompt-presets
4. 实现 PUT /api/prompt-presets/:id
5. 实现 DELETE /api/prompt-presets/:id
6. 预留 set-default 或 isDefault 字段处理
涉及文件范围:
- apps/server/src/modules/presets/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 Prompt Builder 具体拼接
- 不要把系统级 Prompt 内容写入预设逻辑
- 不要改动聊天接口
- 不要暴露 API Key
- 不要硬编码 Prompt 到组件
- 不要引入 Redis、向量数据库、市场、支付、机器人、TTS、图片生成
代码要求:
- DTO 清晰
- 响应统一
- 用户数据隔离
验收标准:
1. 预设 CRUD 可用
2. 参数字段完整
3. 默认预设处理合理
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 18|参数预设页面
阶段目标: 让参数预设可在前端维护。
前置依赖: 阶段 17。
文件范围: PromptPresetForm.vue 、 PresetView.vue 。
本阶段要做: 列表和表单。
本阶段不要做: 不接聊天页切换。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 18 阶段开发。
项目背景:
参数预设页用于集中管理对话生成参数和若干风格项,为后续聊天页切换做准备。
当前阶段:
第 18 阶段:参数预设页面
前置条件:
- 已完成:PromptPreset API
- 当前已有目录:views/presets、components、api、stores
- 当前已有模块:前端基础页面壳
本阶段目标:
- 实现预设管理页面
- 创建可复用的 PromptPresetForm
- 与后端 CRUD 对接
本阶段需要实现:
1. 创建 PromptPresetForm.vue
2. 创建预设列表/管理页
3. 接入 prompt-presets API
4. 支持创建、编辑、删除、设置默认
5. 展示温度、topP、maxTokens 等摘要信息
涉及文件范围:
- apps/web/src/components/PromptPresetForm.vue
- apps/web/src/views/presets/PresetView.vue
- apps/web/src/api/presets.ts
- apps/web/src/stores/preset.ts
本阶段明确不要做:
- 不要在此阶段接入 Prompt Builder 预览
- 不要把角色系统提示和世界书逻辑塞进预设页
- 不要改动聊天流式逻辑
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 表单可复用
- 页面操作流清晰
- 加载/错误状态完整
验收标准:
1. 预设页可正常管理数据
2. 默认预设状态可见
3. 表单交互清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 19|UserPersona API
阶段目标: 让用户 Persona 成为一等对象。
前置依赖: 阶段 8。
文件范围: personas/* 。
本阶段要做: CRUD 与默认 Persona 切换。
本阶段不要做: 不接 Prompt Builder 具体拼接。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 19 阶段开发。
项目背景:
Persona 是沉浸式角色对话的重要组成部分,需要独立建模,而不是散落在聊天页本地状态里。
当前阶段:
第 19 阶段:UserPersona API
前置条件:
- 已完成:统一响应与认证
- 当前已有目录:personas 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 实现 Persona CRUD
- 支持默认 Persona 设置
- 让 Persona 后续可被 Prompt Builder 使用
本阶段需要实现:
1. 创建 PersonasModule、Controller、Service、DTO
2. 实现 GET /api/personas
3. 实现 POST /api/personas
4. 实现 PUT /api/personas/:id
5. 实现 DELETE /api/personas/:id
6. 实现 POST /api/personas/:id/set-default
涉及文件范围:
- apps/server/src/modules/personas/*
- packages/shared/*
本阶段明确不要做:
- 不要直接改聊天 Prompt 构建逻辑
- 不要实现 Persona 关联世界书
- 不要改动前端聊天页
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- Persona 字段简洁清楚
- 默认 Persona 逻辑明确
- 与 User 关联
验收标准:
1. Persona CRUD 可用
2. 默认 Persona 可切换
3. 数据隔离正确
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 20|Persona 设置页面
阶段目标: 用户可管理自己的 Persona。
前置依赖: 阶段 19。
文件范围: PersonaEditor.vue 、 PersonaView.vue 。
本阶段要做: 列表、编辑、设默认。
本阶段不要做: 不做聊天联动。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 20 阶段开发。
项目背景:
Persona 页面是后续 Prompt Builder 能否真正可用的关键前台配置入口。
当前阶段:
第 20 阶段:Persona 设置页面
前置条件:
- 已完成:UserPersona API
- 当前已有目录:views/personas、components、api、stores
- 当前已有模块:前端基础工程
本阶段目标:
- 实现 Persona 管理页
- 创建 PersonaEditor
- 支持设置默认 Persona
本阶段需要实现:
1. 创建 PersonaEditor.vue
2. 创建 PersonaView.vue
3. 接入 personas API
4. 支持新增、编辑、删除、设置默认
5. 展示 Persona 摘要和状态
涉及文件范围:
- apps/web/src/components/PersonaEditor.vue
- apps/web/src/views/personas/PersonaView.vue
- apps/web/src/api/personas.ts
- apps/web/src/stores/persona.ts
本阶段明确不要做:
- 不要实现 Persona 绑定世界书 UI
- 不要接入聊天页 Prompt 预览
- 不要把业务规则写死在展示组件
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 表单复用
- 默认状态清晰
- 页面交互稳定
验收标准:
1. Persona 页面正常管理数据
2. 默认 Persona 可切换
3. 列表与编辑体验清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 21|Conversation API
阶段目标: 建立会话实体 CRUD 与清空能力。
前置依赖: 阶段 9、阶段 19。
文件范围: conversations/* 。
本阶段要做: 列表、创建、详情、更新、删除、清空。
本阶段不要做: 不接聊天生成。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 21 阶段开发。
项目背景:
Conversation 是角色聊天的容器,必须先于 ChatModule 完成。
当前阶段:
第 21 阶段:Conversation API
前置条件:
- 已完成:角色 API、Persona API
- 当前已有目录:conversations 模块占位
- 当前已有模块:Characters、Personas、Auth、Prisma
本阶段目标:
- 实现会话 CRUD
- 支持会话与角色、Persona、模型配置、预设的关联字段
- 支持清空会话
本阶段需要实现:
1. 创建 ConversationsModule、Controller、Service、DTO
2. 实现 GET /api/conversations
3. 实现 POST /api/conversations
4. 实现 GET /api/conversations/:id
5. 实现 PUT /api/conversations/:id
6. 实现 DELETE /api/conversations/:id
7. 实现 POST /api/conversations/:id/clear
涉及文件范围:
- apps/server/src/modules/conversations/*
- packages/shared/*
本阶段明确不要做:
- 不要生成消息内容
- 不要实现聊天流式接口
- 不要在会话模块里硬编码 Prompt 逻辑
- 不要改动无关模块
- 不要暴露 API Key
- 不要引入非 MVP 功能
代码要求:
- 会话与角色/User/Persona 的关系清晰
- 有基础校验与错误处理
- 响应统一
验收标准:
1. 会话 CRUD 可用
2. clear 会清空消息但不误删会话本身
3. 关系字段正确
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 22|Message API
阶段目标: 建立消息读取与编辑基础。
前置依赖: 阶段 21。
文件范围: messages/* 。
本阶段要做: 查询消息、更新、删除、重新生成占位。
本阶段不要做: 不实现真正 regenerate。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 22 阶段开发。
项目背景:
聊天页需要先有消息查询、编辑、删除能力,后续再接流式输出与重新生成。
当前阶段:
第 22 阶段:Message API
前置条件:
- 已完成:Conversation API
- 当前已有目录:messages 模块占位
- 当前已有模块:Conversations、Characters、Auth、Prisma
本阶段目标:
- 实现会话消息查询
- 实现消息编辑与删除
- 为重新生成预留接口
本阶段需要实现:
1. 创建 MessagesModule、Controller、Service、DTO
2. 实现 GET /api/conversations/:id/messages
3. 实现 PUT /api/messages/:id
4. 实现 DELETE /api/messages/:id
5. 实现 POST /api/messages/:id/regenerate 的占位或最小版本入口
6. 对用户只能操作自己的消息做校验
涉及文件范围:
- apps/server/src/modules/messages/*
- packages/shared/*
本阶段明确不要做:
- 不要调用模型生成回复
- 不要实现流式 SSE
- 不要把 Prompt Builder 放进消息模块
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入 Redis、向量数据库、机器人、TTS、图片生成等
代码要求:
- role/status 字段处理清晰
- 编辑与删除行为可维护
- 查询支持按时间排序
验收标准:
1. 能查询会话消息
2. 能编辑和删除消息
3. regenerate 接口有清晰占位语义
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 23|会话列表页
阶段目标: 前端能查看并切换会话。
前置依赖: 阶段 21、阶段 22。
文件范围: ConversationList.vue 、 ConversationView.vue 。
本阶段要做: 列表、创建、删除、清空。
本阶段不要做: 不做聊天流。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 23 阶段开发。
项目背景:
会话列表页负责组织聊天入口,必须先于聊天页功能完善。
当前阶段:
第 23 阶段:会话列表页
前置条件:
- 已完成:Conversation API、Message API
- 当前已有目录:views/conversations、components、api、stores
- 当前已有模块:角色相关页面
本阶段目标:
- 实现会话列表查看与切换
- 接入创建、删除、清空会话动作
- 为聊天页路由跳转做铺垫
本阶段需要实现:
1. 创建 ConversationList.vue
2. 创建会话列表页或侧栏使用的视图组件
3. 接入 conversations API
4. 展示标题、关联角色、更新时间
5. 支持新建、删除、清空会话
6. 点击会话进入聊天页路由
涉及文件范围:
- apps/web/src/components/ConversationList.vue
- apps/web/src/views/conversations/ConversationView.vue
- apps/web/src/api/conversations.ts
- apps/web/src/stores/conversation.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现消息流式渲染
- 不要实现重新生成
- 不要把 Prompt 预览塞进会话列表
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 列表可维护
- 状态管理清晰
- 页面与数据获取分离
验收标准:
1. 会话列表能正常展示
2. 新建、删除、清空动作可用
3. 可跳转聊天页
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 24|聊天页面 UI 骨架
阶段目标: 先把聊天页壳子和消息区域搭出来。
前置依赖: 阶段 23。
文件范围: ChatRoom.vue 、 ChatMessage.vue 、 ChatInput.vue 、 ChatView.vue 。
本阶段要做: 静态 UI、消息列表展示、输入框、工具栏占位。
本阶段不要做: 不接流。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 24 阶段开发。
项目背景:
聊天页面是核心交互场景,但在接入流式聊天前,先建立稳定 UI 骨架更容易控制复杂度。
当前阶段:
第 24 阶段:聊天页面 UI 骨架
前置条件:
- 已完成:会话列表页、Message API
- 当前已有目录:views/chat、components、stores
- 当前已有模块:会话与消息基础能力
本阶段目标:
- 构建聊天页静态骨架
- 展示历史消息
- 提供输入区和常用操作按钮占位
本阶段需要实现:
1. 创建 ChatRoom.vue、ChatMessage.vue、ChatInput.vue、ChatView.vue
2. 聊天页加载会话消息列表
3. 展示用户消息与 assistant 消息的不同样式
4. 输入框、发送按钮、停止按钮、重新生成按钮、复制按钮放置占位
5. 右侧或顶部展示角色信息/模型/预设切换区域占位
6. 实现自动滚动到底部的基础逻辑占位
涉及文件范围:
- apps/web/src/components/ChatRoom.vue
- apps/web/src/components/ChatMessage.vue
- apps/web/src/components/ChatInput.vue
- apps/web/src/views/chat/ChatView.vue
- apps/web/src/stores/chat.ts
- apps/web/src/api/messages.ts
- apps/web/src/router/*
本阶段明确不要做:
- 不要实现流式聊天
- 不要实现 Prompt 预览弹窗
- 不要把复杂状态都写在 ChatView.vue
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 组件拆分清晰
- 样式能支持后续流式更新
- 聊天页不直接承担所有业务逻辑
验收标准:
1. 聊天页骨架可打开
2. 历史消息可正常显示
3. 输入区与操作区布局稳定
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
Prompt 构建与模型网关

---

阶段 25|Prompt Builder 类型设计
阶段目标: 先把 Prompt Builder 所需类型收敛清楚。
前置依赖: 阶段 21、阶段 22、阶段 19、阶段 37 前的世界书字段已在 schema 中。
文件范围: services/prompt-builder/types.ts 、 packages/shared/* 。
本阶段要做: 定义 BuildPromptInput 、 BuildPromptResult 、 PromptSection 、
WorldBookMatchResult 等。
本阶段不要做: 不拼 prompt。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 25 阶段开发。
项目背景:
Prompt Builder 是核心模块,先把类型设计独立出来,能显著降低后续实现失控风险。
当前阶段:
第 25 阶段:Prompt Builder 类型设计
前置条件:
- 已完成:角色、Persona、会话、消息、模型配置、预设基础实体
- 当前已有目录:services/prompt-builder 或等价目录、packages/shared
- 当前已有模块:相关数据表与 API
本阶段目标:
- 定义 Prompt Builder 的输入输出类型
- 明确消息、分段、命中世界书、调试信息的数据结构
- 为 Prompt 预览和聊天接口共用类型
本阶段需要实现:
1. 定义 ChatMessageLike、PromptSection、BuildPromptInput、BuildPromptResult、
WorldBookMatchResult、PromptPreviewResult 等类型
2. 区分逻辑层消息与供应商层消息
3. 预留调试字段,例如 matchedEntries、truncatedHistory、finalMessages
4. 放到共享位置,方便 PromptsModule、ChatModule、前端 Prompt 预览共用
涉及文件范围:
- apps/server/src/services/prompt-builder/*
- packages/shared/*
- docs/*
本阶段明确不要做:
- 不要实现真正的 Prompt 拼接
- 不要调用模型
- 不要改动聊天接口
- 不要把类型散落到多个无关文件
- 不要暴露 API Key
- 不要硬编码 Prompt 到组件或 Controller
- 不要引入非 MVP 功能
代码要求:
- TypeScript 类型清晰
- 区分内部消息结构与对外 provider 消息结构
- 便于后续测试
验收标准:
1. Prompt Builder 核心类型齐全
2. 类型可被后端服务与前端预览共用
3. 命名清晰、一眼可懂
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 类型说明
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 26|Prompt Builder v1 实现
阶段目标: 形成一个可运行的 prompt 拼接器。
前置依赖: 阶段 25。
文件范围: PromptBuilderService 。
本阶段要做: 平台规则、角色、Persona、最近消息、用户输入、输出约束的拼接;先不接世界书命中。
本阶段不要做: 不做复杂 token 计算。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 26 阶段开发。
项目背景:
Prompt Builder v1 的目标是先形成可以用于聊天与预览的稳定拼接结果,而不是一步到位做所有高
级特性。
当前阶段:
第 26 阶段:Prompt Builder v1 实现
前置条件:
- 已完成:Prompt Builder 类型设计
- 当前已有目录:services/prompt-builder
- 当前已有模块:角色、Persona、会话、消息、模型配置、预设
本阶段目标:
- 基于固定顺序拼接 prompt
- 输出 finalMessages 和分段调试信息
- 建立角色扮演的最小安全规则和风格规则
本阶段需要实现:
1. 创建 PromptBuilderService
2. 输入角色、Persona、最近消息、用户最新输入、预设、基础平台规则
3. 输出 finalMessages、sections、debugInfo
4. system/developer/user 三层在内部保持语义清晰
5. 若目标模型仅支持 system/user/assistant,也保留后续降级空间
6. 第一版只做粗粒度历史裁剪,可按消息条数或字符数控制
7. 不接入世界书命中逻辑,先留接口
涉及文件范围:
- apps/server/src/services/prompt-builder/*
- packages/shared/*
- docs/*
本阶段明确不要做:
- 不要接入世界书匹配算法
- 不要做复杂 tokenizer 集成
- 不要在 ChatService 里复制 Prompt 逻辑
- 不要引入供应商 SDK
- 不要把 Prompt 写死在前端
- 不要引入非 MVP 功能
代码要求:
- 逻辑集中在 PromptBuilderService
- 结果可调试
- 规则文案集中管理
- 便于后续世界书和 Prompt 预览接入
验收标准:
1. 能基于输入生成 finalMessages
2. 能输出调试分段
3. 逻辑不散落在聊天模块和控制器里
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何调用 PromptBuilderService
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 27|Prompt 预览 API
阶段目标: 让前端能请求“最终发送给模型的 messages”。
前置依赖: 阶段 26。
文件范围: prompts/* 。
本阶段要做: POST /api/prompts/preview 。
本阶段不要做: 不调用模型。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 27 阶段开发。
项目背景:
Prompt 预览是酒馆系统的重要可解释性功能,能帮助调试角色设定、Persona 和后续世界书命中。
当前阶段:
第 27 阶段:Prompt 预览 API
前置条件:
- 已完成:Prompt Builder v1
- 当前已有目录:prompts 模块占位
- 当前已有模块:PromptBuilderService
本阶段目标:
- 提供 Prompt 预览接口
- 返回 finalMessages 与分段调试信息
- 不触发模型生成
本阶段需要实现:
1. 创建 PromptsModule、Controller、Service
2. 实现 POST /api/prompts/preview
3. 接收 conversationId 或角色/Persona/用户输入等必要参数
4. 调用 PromptBuilderService
5. 返回 sections、finalMessages、historyTrimInfo 等调试数据
6. 对敏感信息进行脱敏处理
涉及文件范围:
- apps/server/src/modules/prompts/*
- apps/server/src/services/prompt-builder/*
- packages/shared/*
本阶段明确不要做:
- 不要调用模型供应商
- 不要实现聊天流式接口
- 不要把 API Key 暴露给前端
- 不要在 Controller 里硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 返回结构清晰
- 便于前端渲染分区信息
- 脱敏敏感配置
验收标准:
1. Prompt 预览接口可调用
2. 返回完整且可读的 messages
3. 不会泄露 apiKey 等敏感配置
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口示例
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

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

---

阶段 29|Model Gateway 抽象接口
阶段目标: 让业务代码只依赖统一网关接口,不依赖供应商。
前置依赖: 阶段 14。
文件范围: services/model-gateway/* 。
本阶段要做: 定义 chat 、 streamChat 、 testConnection 抽象。
本阶段不要做: 不接任何具体 provider。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 29 阶段开发。
项目背景:
业务代码不能直接调用 OpenAI、DeepSeek、OpenRouter 等供应商接口,必须通过统一 Model
Gateway 执行。
当前阶段:
第 29 阶段:Model Gateway 抽象接口
前置条件:
- 已完成:ModelConfig API、Prompt Builder v1
- 当前已有目录:services/model-gateway
- 当前已有模块:ModelConfig、Prompts
本阶段目标:
- 定义统一模型网关接口
- 屏蔽供应商差异
- 为 chat / streamChat / testConnection 提供抽象
本阶段需要实现:
1. 创建 ModelGatewayService 或等价抽象
2. 定义模型消息类型与 provider options 类型
3. 定义 testConnection(config)、chat(messages, options)、streamChat(messages,
options)
4. 定义标准化流事件结构
5. 提供 provider registry 或 adapter registry 的扩展点
6. 当前阶段只写接口和内部基础工具,不接具体供应商
涉及文件范围:
- apps/server/src/services/model-gateway/*
- packages/shared/*
- docs/*
本阶段明确不要做:
- 不要实现 OpenAI-compatible 适配
- 不要在聊天模块里直接 fetch 某个供应商
- 不要实现 fallback、多供应商负载均衡
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 抽象清晰
- 可扩展到 OpenAI-compatible / Claude / Gemini / Ollama
- 业务模块只依赖接口
验收标准:
1. Gateway 抽象接口清晰
2. 后续 provider 能按接口接入
3. 业务模块不会与供应商强耦合
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口说明
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 30|OpenAI-compatible Chat Completions 适配
阶段目标: 做第一版唯一的实际 provider adapter。
前置依赖: 阶段 29。
文件范围: services/model-gateway/providers/openai-compatible/* 。
本阶段要做: 基于 chat/completions 的普通和流式请求。
本阶段不要做: 不做 Claude/Gemini/Ollama。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 30 阶段开发。
项目背景:
第一版优先支持 OpenAI-compatible API,兼容 OpenAI、DeepSeek、OpenRouter、通义兼容接
口、豆包兼容接口和本地代理。
当前阶段:
第 30 阶段:OpenAI-compatible Chat Completions 适配
前置条件:
- 已完成:Model Gateway 抽象接口
- 当前已有目录:services/model-gateway/providers
- 当前已有模块:Gateway 抽象、ModelConfig
本阶段目标:
- 实现 OpenAI-compatible provider adapter
- 支持普通聊天与流式聊天
- 返回统一标准事件
本阶段需要实现:
1. 创建 openai-compatible provider adapter
2. 接收 baseUrl、apiKey、modelName、temperature、topP、maxTokens、timeout
3. 实现 testConnection
4. 实现 chat(messages, options)
5. 实现 streamChat(messages, options)
6. 解析流式 delta,转成内部统一事件
7. 错误处理与超时处理
8. 记录最小可用调用日志入口或预留
涉及文件范围:
- apps/server/src/services/model-gateway/*
- apps/server/src/services/model-gateway/providers/openai-compatible/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 Claude / Gemini / Ollama
- 不要把业务逻辑写进 provider adapter
- 不要在 adapter 中拼接 Prompt
- 不要把 apiKey 记录到日志或返回前端
- 不要引入复杂 fallback
- 不要引入非 MVP 功能
代码要求:
- provider adapter 只负责协议适配
- 流式事件解析清晰
- timeout 可配置
- 错误信息可追踪
验收标准:
1. OpenAI-compatible 普通请求可用
2. OpenAI-compatible 流式请求可用
3. 返回统一内部事件格式
4. 不泄露敏感信息
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试 chat / streamChat
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
聊天闭环与流式输出

---

阶段 31|后端 SSE / fetch stream 聊天接口
阶段目标: 打通 MVP 的真正聊天入口。
前置依赖: 阶段 21、阶段 22、阶段 26、阶段 30。
文件范围: chat/* 。
本阶段要做: POST /api/chat/stream ,流式输出、会话锁、保存消息、失败标记、AbortController。
本阶段不要做: 不做 WebSocket;不做 Redis 锁。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 31 阶段开发。
项目背景:
这是 Tavern Lite MVP 的核心后端接口。要求使用 POST /api/chat/stream 接收请求体,响应
使用 text/event-stream 按增量输出,前端将用 fetch + ReadableStream 读取。
当前阶段:
第 31 阶段:后端 SSE / fetch stream 聊天接口
前置条件:
- 已完成:Conversation API、Message API、Prompt Builder v1、Model Gateway 抽象、
OpenAI-compatible 适配
- 当前已有目录:apps/server/src/modules/chat、services/prompt-builder、services/
model-gateway
- 当前已有模块:会话、消息、Prompt 预览、模型配置
本阶段目标:
- 创建 ChatModule、ChatController、ChatService
- 实现 POST /api/chat/stream
- 使用 Response 写入 text/event-stream
- 输出 event: delta / event: done / event: error
- 使用 AbortController 或等价机制支持停止生成
- 一次请求内:先保存用户消息,流完成后保存 assistant 消息,失败时标记 assistant message
status = failed
- 使用 conversation lock 防止同一会话并发生成
- 第一版不使用 Redis,只用内存 Map 实现锁
本阶段需要实现:
1. 创建 ChatModule、ChatController、ChatService
2. 定义 chat request DTO,至少包含 conversationId、userMessage、modelConfigId(或
使用会话默认)、presetId(可选)
3. 在 ChatService 中先加载会话、角色、Persona、最近消息、预设、模型配置
4. 调用 PromptBuilderService 构建 finalMessages
5. 调用 ModelGatewayService.streamChat
6. 用 Response 设置 text/event-stream、cache-control、connection 等必要头
7. 在流式过程中向客户端写入:
- event: delta
- data: {"text":"...","messageId":"..."}
- 空行
8. 在流结束时写入:
- event: done
- data: {"messageId":"...","finishReason":"stop"}
9. 出错时写入:
- event: error
- data: {"code":"...","message":"..."}
10. 用户消息在调用模型前保存
11. assistant 消息可先创建为 streaming 状态,流完成后更新为 completed 并写入完整内容;
或者在完成后创建,但请说明选择并保持一致
12. 若流式失败,assistant 消息要标记 failed,并保存错误摘要
13. 对同一 conversationId 做并发锁,锁实现使用内存 Map,不要引入 Redis
14. 为后续停止生成预留 abort map 或 request task map
15. 严禁在 ChatService 里硬编码 Prompt;必须通过 PromptBuilderService 获取
16. 严禁在 ChatService 里直接调用 OpenAI / DeepSeek / OpenRouter;必须通过
ModelGatewayService
17. 不要实现 WebSocket
18. 不要实现多会话并发调度系统
涉及文件范围:
- apps/server/src/modules/chat/*
- apps/server/src/modules/messages/*
- apps/server/src/modules/conversations/*
- apps/server/src/services/prompt-builder/*
- apps/server/src/services/model-gateway/*
- packages/shared/*
本阶段明确不要做:
- 不要实现 WebSocket
- 不要引入 Redis 锁
- 不要实现群聊
- 不要在聊天模块里复制 Prompt 拼接逻辑
- 不要实现支付、市场、审核、机器人、TTS、图片生成、向量数据库
- 不要暴露 API Key 到前端或日志
- 不要改动无关页面模块
代码要求:
- 使用 TypeScript
- 后端使用 NestJS Module / Controller / Service / DTO 结构
- 数据访问通过 PrismaService
- API 返回统一格式;SSE 接口除外,SSE 使用标准事件帧
- 需要基础错误处理
- 需要保证代码可读、可维护
- 所有流式事件命名清楚
- 聊天模块必须可单元测试或至少具备清晰的可测边界
验收标准:
1. POST /api/chat/stream 可正常返回 text/event-stream
2. 前端可读取 delta / done / error 三类事件
3. 用户消息会在请求前保存
4. assistant 完整消息会在流完成后持久化
5. 出错时 assistant 消息被标记 failed
6. 同一会话不能并发生成
7. 聊天服务没有硬编码 Prompt,也没有直接调用供应商接口
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口请求示例
4. 如何启动后端并测试流式接口
5. 已完成内容
6. 未完成内容
7. 风险和 TODO
验收标准: POST /api/chat/stream 能流式返回并保存消息。
可能风险: 普通 JSON 拦截器影响 SSE;消息重复保存;锁未释放。
人工检查点: 核查锁释放、异常分支、客户端断开后的清理。
完成后输出: 文件、示例请求、测试方式、风险。

---

阶段 32|前端 useChatStream composable
阶段目标: 把聊天流读取逻辑从页面剥离。
前置依赖: 阶段 31。
文件范围: composables/useChatStream.ts 。
本阶段要做: fetch streaming、SSE 帧解析、AbortController。
本阶段不要做: 不写页面 UI。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 32 阶段开发。
项目背景:
聊天流式读取逻辑必须放在 composable,而不是堆在 ChatView.vue 里。
当前阶段:
第 32 阶段:前端 useChatStream composable
前置条件:
- 已完成:后端 SSE / fetch stream 聊天接口
- 当前已有目录:apps/web/src/composables、api、stores
- 当前已有模块:聊天页 UI 骨架
本阶段目标:
- 创建 useChatStream composable
- 使用 fetch + ReadableStream 读取 text/event-stream
- 支持开始、增量回调、完成、出错、手动 abort
本阶段需要实现:
1. 新建 useChatStream.ts
2. 封装 startStream(params)
3. 使用 fetch 发起 POST /api/chat/stream
4. 使用 ReadableStream + TextDecoder 读取数据
5. 解析 event: delta / done / error
6. 提供 onDelta/onDone/onError 或返回响应式状态
7. 管理 AbortController
8. 不把业务持久状态写死在 composable 内部
涉及文件范围:
- apps/web/src/composables/useChatStream.ts
- apps/web/src/api/chat.ts
- apps/web/src/types/*
- apps/web/src/stores/chat.ts(若需要有限改动)
本阶段明确不要做:
- 不要直接修改聊天页面 UI
- 不要在 composable 里写模型配置业务
- 不要把所有消息状态都混在 composable 私有变量里
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- Composition API
- TypeScript
- composable 专注封装流式读取与中止控制
- 与 Pinia 边界清晰
验收标准:
1. composable 可独立启动一次聊天流
2. 可正确解析 delta / done / error
3. 可中止请求
4. 页面后续可以直接接入
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何使用 useChatStream
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 33|聊天流式输出接入
阶段目标: 把 useChatStream 接到聊天页。
前置依赖: 阶段 24、阶段 32。
文件范围: chat.ts store 、 ChatView.vue 、 ChatRoom.vue 。
本阶段要做: 发送消息、显示 streaming assistant、完成后刷新。
本阶段不要做: 不做停止/重生。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 33 阶段开发。
项目背景:
这是 MVP 聊天闭环的关键一跃:用户发送消息后,前端能看到流式增长的 assistant 回复。
当前阶段:
第 33 阶段:聊天流式输出接入
前置条件:
- 已完成:聊天页面骨架、useChatStream composable
- 当前已有目录:views/chat、components、stores、composables
- 当前已有模块:后端 chat/stream 接口、前端消息展示骨架
本阶段目标:
- 从聊天页发起流式请求
- 在消息列表中显示 streaming assistant 消息
- 流完成后与后端保存结果对齐
本阶段需要实现:
1. 在 ChatStore 中加入 sending/isStreaming/streamingMessage 等状态
2. 聊天页发送用户输入时调用 useChatStream
3. 增量更新当前 assistant 消息内容
4. done 后刷新会话消息或将 streaming 结果替换为最终消息
5. error 时提示失败并恢复输入状态
6. 自动滚动到底部
涉及文件范围:
- apps/web/src/stores/chat.ts
- apps/web/src/views/chat/ChatView.vue
- apps/web/src/components/ChatRoom.vue
- apps/web/src/components/ChatInput.vue
- apps/web/src/composables/useChatStream.ts
- apps/web/src/api/chat.ts
本阶段明确不要做:
- 不要实现停止生成
- 不要实现重新生成
- 不要实现编辑/删除消息按钮逻辑
- 不要把所有流式解析逻辑塞回组件
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- Store 管共享状态
- composable 管流式请求
- 组件管展示
- 错误和 loading 状态清晰
验收标准:
1. 用户发送消息后可看到 assistant 流式输出
2. 流结束后消息状态正确
3. 页面不会因一次失败而卡死
4. 组件与 store 分工清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 34|停止生成
阶段目标: 允许用户中断当前生成。
前置依赖: 阶段 33。
文件范围: useChatStream.ts 、 ChatStore 、后端中止映射。
本阶段要做: 前端 abort;后端释放资源。
本阶段不要做: 不做跨设备同步停止。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 34 阶段开发。
项目背景:
停止生成是长回复场景下必须要有的控制能力。
当前阶段:
第 34 阶段:停止生成
前置条件:
- 已完成:聊天流式输出接入
- 当前已有目录:chat composable/store/backend chat module
- 当前已有模块:stream chat 流程可用
本阶段目标:
- 实现前端“停止生成”按钮生效
- 中止当前请求
- 后端正确处理客户端断开或显式中止
本阶段需要实现:
1. 在 useChatStream 中暴露 abort 方法
2. ChatStore 记录当前可中止任务
3. ChatInput 或聊天页接入停止按钮
4. 后端在客户端断开或 abort 后执行清理逻辑
5. conversation lock 被正确释放
6. assistant 消息状态按选择策略处理为 stopped / partial / failed,并保持一致
涉及文件范围:
- apps/web/src/composables/useChatStream.ts
- apps/web/src/stores/chat.ts
- apps/web/src/components/ChatInput.vue
- apps/server/src/modules/chat/*
- packages/shared/*
本阶段明确不要做:
- 不要实现任务队列
- 不要引入 Redis 或后台 worker
- 不要实现跨标签页同步停止
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 中止逻辑单一清晰
- 锁和资源必须释放
- 前后端状态一致
验收标准:
1. 点击停止后流式输出立刻终止
2. 锁被释放
3. 消息状态可解释
4. 输入框与按钮状态恢复正常
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 35|重新生成回复
阶段目标: 用最后一个用户消息重新触发生成。
前置依赖: 阶段 34。
文件范围: messages/regenerate 、聊天页。
本阶段要做: 重新生成功能。
本阶段不要做: 不做分支树。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 35 阶段开发。
项目背景:
重新生成是酒馆体验中的常见操作,但第一版只做“替换最后一条 assistant 回复”的简单语义。
当前阶段:
第 35 阶段:重新生成回复
前置条件:
- 已完成:聊天流式输出、停止生成
- 当前已有目录:messages/chat 前后端模块、聊天页
- 当前已有模块:基础聊天闭环
本阶段目标:
- 支持对最近 assistant 回复执行 regenerate
- 沿用现有 chat/stream 主链路
- 保持消息历史不混乱
本阶段需要实现:
1. 明确 regenerate 的数据语义:基于最近一条用户消息,重新生成 assistant 回复
2. 在后端补足 POST /api/messages/:id/regenerate 或改为通过 chat/stream 参数触发
3. 前端在消息操作区接入“重新生成”
4. 对旧 assistant 回复做替换、归档或软删策略,选择一种并保持一致
5. 流式过程与普通发送一致
涉及文件范围:
- apps/server/src/modules/messages/*
- apps/server/src/modules/chat/*
- apps/web/src/components/ChatMessage.vue
- apps/web/src/stores/chat.ts
- apps/web/src/api/messages.ts
- apps/web/src/api/chat.ts
本阶段明确不要做:
- 不要实现分支对话树
- 不要实现多候选同时生成
- 不要重写 Prompt Builder
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- regenerate 语义清楚
- 历史消息处理一致
- 前后端接口边界清晰
验收标准:
1. 可对目标回复执行重新生成
2. 会话历史不混乱
3. 流式效果与普通生成一致
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 36|编辑、删除、复制消息
阶段目标: 提升基础聊天可操作性。
前置依赖: 阶段 22、阶段 33。
文件范围: ChatMessage.vue 、 messages API 。
本阶段要做: 编辑用户消息、删除消息、复制消息。
本阶段不要做: 不做版本树。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 36 阶段开发。
项目背景:
消息级操作是聊天页基础体验的一部分,尤其是编辑用户消息和复制回复。
当前阶段:
第 36 阶段:编辑 / 删除 / 复制消息
前置条件:
- 已完成:Message API、聊天流式输出接入
- 当前已有目录:聊天组件、messages 模块
- 当前已有模块:聊天闭环已可用
本阶段目标:
- 支持编辑用户消息
- 支持删除消息
- 支持复制消息内容
本阶段需要实现:
1. 在 ChatMessage.vue 增加操作菜单
2. 对用户消息支持编辑并调用 PUT /api/messages/:id
3. 对消息支持删除并调用 DELETE /api/messages/:id
4. 对任意消息支持复制到剪贴板
5. 前端删除或编辑后刷新或局部更新消息列表
涉及文件范围:
- apps/web/src/components/ChatMessage.vue
- apps/web/src/stores/chat.ts
- apps/web/src/api/messages.ts
- apps/server/src/modules/messages/*(若需补充校验)
本阶段明确不要做:
- 不要实现消息分支树
- 不要自动在编辑后立即 regenerate
- 不要实现富文本编辑器
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 操作按钮简洁
- 编辑态与展示态分离
- 错误反馈清晰
验收标准:
1. 用户消息可编辑
2. 消息可删除
3. 消息可复制
4. 列表状态同步正确
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
世界书、角色卡与数据进出

---

阶段 37|WorldBook API
阶段目标: 建立世界书与条目 CRUD。
前置依赖: 阶段 8。
文件范围: world-books/* 。
本阶段要做: 世界书和条目管理接口。
本阶段不要做: 不实现匹配逻辑。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 37 阶段开发。
项目背景:
世界书是酒馆系统的关键增量上下文机制,但应该先把数据管理接口建好,再做匹配与插入逻辑。
当前阶段:
第 37 阶段:WorldBook API
前置条件:
- 已完成:统一响应、认证、schema
- 当前已有目录:world-books 模块占位
- 当前已有模块:Prisma、Auth、common
本阶段目标:
- 提供世界书和世界书条目的 CRUD
- 支持基础字段:keywords、content、priority、enabled、scanDepth、tokenBudget、
insertionOrder
- 支持与角色的关联字段预留
本阶段需要实现:
1. 创建 WorldBooksModule、Controller、Service、DTO
2. 实现 GET /api/world-books
3. 实现 POST /api/world-books
4. 实现 GET /api/world-books/:id
5. 实现 PUT /api/world-books/:id
6. 实现 DELETE /api/world-books/:id
7. 实现 POST /api/world-books/:id/entries
8. 实现 PUT /api/world-book-entries/:id
9. 实现 DELETE /api/world-book-entries/:id
涉及文件范围:
- apps/server/src/modules/world-books/*
- packages/shared/*
本阶段明确不要做:
- 不要实现关键词匹配
- 不要在 API 模块里拼接 Prompt
- 不要实现多本世界书复杂合并策略
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 世界书与条目结构清晰
- DTO 覆盖核心字段
- 响应统一
验收标准:
1. 世界书 CRUD 可用
2. 条目 CRUD 可用
3. 字段覆盖 scanDepth / tokenBudget / priority 等核心项
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 接口列表
4. 测试方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 38|WorldBook 编辑页面
阶段目标: 落地世界书管理 UI。
前置依赖: 阶段 37。
文件范围: WorldBookEditor.vue 、 WorldBookView.vue 。
本阶段要做: 世界书列表、条目编辑。
本阶段不要做: 不做命中调试。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 38 阶段开发。
项目背景:
世界书编辑体验直接影响后续 Prompt Builder 命中效果,需要先把管理界面做出来。
当前阶段:
第 38 阶段:WorldBook 编辑页面
前置条件:
- 已完成:WorldBook API
- 当前已有目录:views/world-books、components、api、stores
- 当前已有模块:前端基础页面骨架
本阶段目标:
- 实现世界书列表与编辑页
- 支持条目增删改
- 清晰展示 keywords、content、priority、enabled 等字段
本阶段需要实现:
1. 创建 WorldBookEditor.vue
2. 创建世界书列表页和编辑页
3. 接入 world-books API
4. 支持条目列表、创建、编辑、删除
5. 支持 scanDepth / tokenBudget 等世界书级字段编辑
6. 支持启用/禁用条目
涉及文件范围:
- apps/web/src/components/WorldBookEditor.vue
- apps/web/src/views/world-books/WorldBookView.vue
- apps/web/src/api/worldBooks.ts
- apps/web/src/stores/worldBook.ts
本阶段明确不要做:
- 不要实现命中调试面板
- 不要接入 PromptBuilderService
- 不要在前端实现正式匹配逻辑
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 编辑器结构清晰
- 条目表单可维护
- 长文本输入体验友好
验收标准:
1. 世界书页可管理世界书和条目
2. 条目字段完整可编辑
3. 页面结构适合后续加入命中调试
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 39|世界书关键词匹配逻辑
阶段目标: 把世界书真正插入 Prompt Builder。
前置依赖: 阶段 26、阶段 37。
文件范围: PromptBuilderService 、 world-book-matcher 。
本阶段要做: 基于最近消息和最新输入做关键词匹配、优先级排序、budget 限制。
本阶段不要做: 不做递归匹配和 regex 高级特性。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 39 阶段开发。
项目背景:
世界书的价值不在管理界面,而在于按关键词动态插入 Prompt。
当前阶段:
第 39 阶段:世界书关键词匹配逻辑
前置条件:
- 已完成:Prompt Builder v1、WorldBook API
- 当前已有目录:services/prompt-builder、world-books 模块
- 当前已有模块:PromptBuilderService、WorldBook 数据结构
本阶段目标:
- 实现世界书关键词命中
- 将命中结果按 priority / insertionOrder / tokenBudget 处理后插入 Prompt
- 返回调试信息
本阶段需要实现:
1. 创建 world book matcher(可独立函数或服务)
2. 扫描用户最新输入和最近 N 条消息
3. 支持 keywords 基础匹配,第一版只做大小写不敏感普通词匹配
4. 支持 enabled、priority、insertionOrder、scanDepth、tokenBudget
5. 命中后将 content 作为独立 PromptSection 插入 PromptBuilder 结果
6. 在 debug 信息中返回 matchedEntries
涉及文件范围:
- apps/server/src/services/prompt-builder/*
- apps/server/src/modules/world-books/*
- packages/shared/*
本阶段明确不要做:
- 不要实现复杂 regex
- 不要实现递归触发
- 不要实现向量检索
- 不要把匹配逻辑写到前端
- 不要暴露 API Key
- 不要硬编码 Prompt 到聊天控制器
- 不要引入非 MVP 功能
代码要求:
- 匹配逻辑独立可测
- PromptBuilderService 只调用 matcher,不内嵌大量分支
- token 控制可先粗粒度实现
验收标准:
1. 世界书可根据关键词命中
2. 命中内容进入 Prompt
3. debug 信息能查看命中条目
4. 未命中时不会污染 Prompt
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试命中逻辑
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 40|世界书命中调试与 Prompt 预览集成
阶段目标: 让用户在预览页看见“哪些世界书命中了”。
前置依赖: 阶段 28、阶段 39。
文件范围: PromptPreview.vue 、Prompt API。
本阶段要做: 显示命中条目、插入顺序、预算信息。
本阶段不要做: 不做可视化图谱。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 40 阶段开发。
项目背景:
世界书一旦进入 Prompt,如果没有调试可视化,后续很难定位命中错误和 Prompt 污染问题。
当前阶段:
第 40 阶段:世界书命中调试与 Prompt 预览集成
前置条件:
- 已完成:世界书关键词匹配逻辑、Prompt 预览页面
- 当前已有目录:prompts 模块、PromptPreview 前端组件
- 当前已有模块:PromptBuilder 已返回调试数据
本阶段目标:
- 在 Prompt 预览接口与页面中展示世界书命中详情
- 让用户知道哪些条目被命中、为何命中、以什么顺序插入
本阶段需要实现:
1. 扩展 prompts/preview 返回 matchedEntries 相关 debug 字段
2. 前端 PromptPreview.vue 展示“世界书命中”分区
3. 展示条目标题、关键词、priority、insertionOrder、content 摘要
4. 展示 tokenBudget/scanDepth 相关说明(如返回中有)
5. 为未命中场景给出清晰空状态
涉及文件范围:
- apps/server/src/modules/prompts/*
- apps/server/src/services/prompt-builder/*
- apps/web/src/components/PromptPreview.vue
- apps/web/src/views/prompts/PromptPreviewView.vue
- apps/web/src/api/prompts.ts
本阶段明确不要做:
- 不要实现复杂图形化可视化
- 不要在前端重复执行匹配算法
- 不要改动聊天主链路
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 调试信息清晰
- 页面可读
- 与 PromptBuilder 输出结构一致
验收标准:
1. Prompt 预览能看到世界书命中详情
2. 调试信息与实际插入结果一致
3. 空状态与错误状态清晰
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 41|角色卡 JSON 导入
阶段目标: 支持从 Tavern/SillyTavern 常见字段导入角色。
前置依赖: 阶段 9、阶段 11。
文件范围: characters/import 、前端导入入口。
本阶段要做: 上传 JSON、映射字段、导入预览。
本阶段不要做: 不做 PNG 角色卡。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 41 阶段开发。
项目背景:
角色卡 JSON 导入是提升可用性的关键功能,但第一版只做 JSON,不做 PNG 角色卡。
当前阶段:
第 41 阶段:角色卡 JSON 导入
前置条件:
- 已完成:角色 CRUD、角色编辑页
- 当前已有目录:characters 模块、角色前端页面
- 当前已有模块:Assets 上传基础(如已完成)
本阶段目标:
- 支持导入常见角色卡 JSON
- 建立字段映射
- 给出导入预览和错误提示
本阶段需要实现:
1. 后端实现 POST /api/characters/import
2. 兼容常见字段映射:first_mes -> firstMessage、mes_example -> exampleMessages、
creator_notes -> creatorNotes 等
3. 处理 description、personality、scenario、system_prompt 等常见字段
4. 对不兼容字段放入 metadata 或忽略并提示
5. 前端提供 JSON 文件选择与导入预览入口
6. 默认不覆盖已有角色,重名时给出策略提示
涉及文件范围:
- apps/server/src/modules/characters/*
- apps/web/src/views/characters/*
- apps/web/src/api/characters.ts
- packages/shared/*
本阶段明确不要做:
- 不要实现 PNG 角色卡解析
- 不要覆盖已有角色而不提示
- 不要实现批量导入过度复杂流程
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 字段映射清晰集中
- 导入错误可解释
- 元数据保留策略清晰
验收标准:
1. 可导入常见 JSON 角色卡
2. 核心字段映射正确
3. 重名和错误格式有清晰提示
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试导入
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 42|角色卡 JSON 导出
阶段目标: 支持导出成可备份、可迁移的角色卡 JSON。
前置依赖: 阶段 41。
文件范围: characters/export 。
本阶段要做: 导出字段映射。
本阶段不要做: 不导出 PNG。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 42 阶段开发。
项目背景:
角色导出是备份和跨系统迁移的重要能力。
当前阶段:
第 42 阶段:角色卡 JSON 导出
前置条件:
- 已完成:角色卡 JSON 导入
- 当前已有目录:characters 模块、角色详情页
- 当前已有模块:角色 CRUD
本阶段目标:
- 支持角色卡 JSON 导出
- 字段尽量兼容 Tavern / SillyTavern 常见格式
- 提供前端下载入口
本阶段需要实现:
1. 后端实现 GET /api/characters/:id/export
2. 将内部字段映射到常见 JSON 角色卡字段
3. 保留 metadata 与必要兼容字段
4. 前端在角色详情页提供导出按钮
5. 文件名合理,包含角色名
涉及文件范围:
- apps/server/src/modules/characters/*
- apps/web/src/views/characters/CharacterDetailView.vue
- apps/web/src/api/characters.ts
- packages/shared/*
本阶段明确不要做:
- 不要实现 PNG 导出
- 不要把敏感系统配置打包进导出文件
- 不要实现批量导出复杂压缩包
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 导出格式清晰
- 与导入字段映射相互对应
- 前端下载体验简单稳定
验收标准:
1. 角色可导出为 JSON
2. 导出字段与内部数据一致
3. 导出文件可再次导入使用
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试导出
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 43|数据备份导出
阶段目标: 提供应用级备份导出能力。
前置依赖: 阶段 42。
文件范围: backups/export 、设置/备份页。
本阶段要做: 导出数据库快照或逻辑导出 JSON。
本阶段不要做: 不做异步大任务队列。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 43 阶段开发。
项目背景:
作为自托管应用,数据备份是 MVP 的必要运维能力。
当前阶段:
第 43 阶段:数据备份导出
前置条件:
- 已完成:角色导入导出、核心实体 CRUD
- 当前已有目录:settings 或 backups 模块占位
- 当前已有模块:SQLite 与 uploads 目录约定
本阶段目标:
- 提供应用级备份导出接口
- 支持导出数据库核心数据,必要时记录资源文件清单
- 给前端一个可使用的导出入口
本阶段需要实现:
1. 实现 GET /api/backups/export
2. 选择导出策略:逻辑 JSON 导出优先,写清说明
3. 至少覆盖角色、会话、消息、世界书、模型配置(apiKey 脱敏或按安全策略处理)、预设、
Persona、设置
4. 前端提供备份导出按钮
5. 补充导出文件格式说明
涉及文件范围:
- apps/server/src/modules/backups/* 或 settings/*
- apps/web/src/views/settings/* 或 backup 页面
- apps/web/src/api/backups.ts
- docs/*
本阶段明确不要做:
- 不要实现复杂增量备份
- 不要实现后台任务队列
- 不要把敏感密钥原样打包而不说明风险
- 不要实现云备份
- 不要暴露 API Key 到前端
- 不要引入非 MVP 功能
代码要求:
- 备份格式有版本号
- 导出说明清晰
- 安全策略明确
验收标准:
1. 能导出应用级备份文件
2. 备份文件结构清晰
3. 敏感信息处理方式明确
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试导出
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 44|数据恢复导入
阶段目标: 支持从备份导入恢复。
前置依赖: 阶段 43。
文件范围: backups/import 。
本阶段要做: 导入校验、版本校验、覆盖策略。
本阶段不要做: 不做细粒度冲突合并。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 44 阶段开发。
项目背景:
备份导出只有在能恢复时才真正有价值。
当前阶段:
第 44 阶段:数据恢复导入
前置条件:
- 已完成:数据备份导出
- 当前已有目录:backups 模块、设置/备份页面
- 当前已有模块:导出能力可用
本阶段目标:
- 支持从备份文件导入恢复
- 做基础版本校验和数据校验
- 明确覆盖策略
本阶段需要实现:
1. 实现 POST /api/backups/import
2. 校验备份文件版本与基本结构
3. 选择简单恢复策略:全量导入覆盖或显式确认后导入
4. 前端加入导入表单与警告提示
5. 错误时返回清晰原因
涉及文件范围:
- apps/server/src/modules/backups/*
- apps/web/src/views/settings/* 或 backup 页面
- apps/web/src/api/backups.ts
- docs/*
本阶段明确不要做:
- 不要实现复杂冲突合并器
- 不要实现后台异步任务
- 不要恢复不兼容版本而无提示
- 不要暴露敏感信息
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 恢复流程可解释
- 错误回滚或失败处理清晰
- 用户有明确风险提示
验收标准:
1. 可从备份文件恢复数据
2. 错误文件会被拒绝
3. 覆盖策略清晰可控
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试导入恢复
4. 已完成内容
5. 未完成内容
6. 风险和 TODO

---

阶段 45|设置页
阶段目标: 整合应用级设置、备份入口与基础偏好。
前置依赖: 阶段 15、阶段 18、阶段 20、阶段 44。
文件范围: SettingView.vue 。
本阶段要做: 设置项整合。
本阶段不要做: 不做复杂主题系统。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 45 阶段开发。
项目背景:
设置页是零散配置和运维动作的聚合入口,可以让 MVP 更像一个完整产品。
当前阶段:
第 45 阶段:设置页
前置条件:
- 已完成:模型配置页、预设页、Persona 页、备份导入导出
- 当前已有目录:views/settings、api、stores
- 当前已有模块:多个管理页已存在
本阶段目标:
- 实现设置页
- 聚合应用基础设置、备份导出导入入口、默认项入口
- 提升可用性
本阶段需要实现:
1. 创建设置页视图
2. 接入 GET /api/settings、PUT /api/settings(如果已有 settings API)
3. 聚合基础应用设置
4. 聚合备份导出/导入入口
5. 显示默认模型、默认 Persona、默认预设等摘要入口或跳转
涉及文件范围:
- apps/web/src/views/settings/SettingView.vue
- apps/web/src/api/settings.ts
- apps/web/src/api/backups.ts
- apps/web/src/stores/setting.ts
本阶段明确不要做:
- 不要实现复杂主题编辑器
- 不要做 PWA 设置
- 不要做高级权限设置
- 不要把所有业务页都塞到设置页里
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 设置页结构清晰
- 入口聚合合理
- 交互简单
验收标准:
1. 设置页可正常打开
2. 基础设置和备份入口可用
3. 页面不是杂乱链接集合
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 测试方式
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
部署、回归与验收

---

阶段 46|Docker Compose 部署
阶段目标: 形成一键启动的轻量部署。
前置依赖: 阶段 45。
文件范围: docker-compose.yml 、Dockerfiles。
本阶段要做: 前后端容器化、volume 挂载、环境变量。
本阶段不要做: 不做 K8s。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 46 阶段开发。
项目背景:
项目目标之一是轻量自托管,因此 Docker Compose 是 MVP 必需交付之一。
当前阶段:
第 46 阶段:Docker Compose 部署
前置条件:
- 已完成:核心功能页与 API、聊天闭环、设置与备份
- 当前已有目录:项目根目录、apps/web、apps/server、data
- 当前已有模块:前后端可本地开发运行
本阶段目标:
- 提供 Docker Compose 轻量部署方案
- 明确 SQLite 与 uploads volume
- 明确启动、更新、重启方式
本阶段需要实现:
1. 编写 docker-compose.yml
2. 如有需要编写前端和后端 Dockerfile
3. 配置环境变量注入
4. 挂载 SQLite 数据目录和 uploads 目录
5. 写清启动、停止、更新命令
6. 在 README 增加部署章节
涉及文件范围:
- docker-compose.yml
- apps/web/Dockerfile(如需要)
- apps/server/Dockerfile(如需要)
- README.md
- .env.example
本阶段明确不要做:
- 不要实现 Kubernetes
- 不要实现复杂 CI/CD
- 不要引入 Redis、PostgreSQL
- 不要把真实密钥写进 compose
- 不要改动业务逻辑
- 不要引入非 MVP 功能
代码要求:
- 配置清晰
- volume 和端口说明完整
- 适合本地和轻量服务器部署
验收标准:
1. docker compose up 可启动系统
2. SQLite 与 uploads 持久化正确
3. 部署文档可执行
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 部署命令
4. 验证方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 47|生产环境静态资源托管
阶段目标: 让生产模式下前端构建物与上传资源可稳定访问。
前置依赖: 阶段 46。
文件范围: ServeStatic 或 Nginx 配置。
本阶段要做: 前端 build、静态托管、uploads 暴露。
本阶段不要做: 不做 CDN。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 47 阶段开发。
项目背景:
生产环境需要稳定托管前端静态资源和本地上传资源,同时确保聊天流式接口不受干扰。
当前阶段:
第 47 阶段:生产环境静态资源托管
前置条件:
- 已完成:Docker Compose 部署
- 当前已有目录:前后端构建配置
- 当前已有模块:部署基础
本阶段目标:
- 确定前端构建产物托管方式
- 确定 uploads 静态访问方式
- 保持 SSE/stream 接口可正常工作
本阶段需要实现:
1. 选择 ServeStaticModule 或反向代理托管前端静态产物
2. 配置 uploads 目录访问
3. 处理前端 history 路由回退
4. 补充 Nginx 可选配置说明(如项目使用)
5. 确保 chat/stream 路由不被静态托管规则干扰
涉及文件范围:
- apps/server/src/app.module.ts 或相关静态服务配置
- nginx.conf(如需要)
- README.md
- docker-compose.yml(如需要微调)
本阶段明确不要做:
- 不要实现 CDN
- 不要实现复杂边缘缓存
- 不要修改核心业务接口
- 不要在生产配置里硬编码真实密钥
- 不要引入非 MVP 功能
代码要求:
- 路由回退清晰
- 静态资源访问路径稳定
- SSE 路由可正常透传
验收标准:
1. 生产构建后页面可访问
2. 头像等上传资源可访问
3. 聊天流式接口不受影响
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何构建与运行
4. 验证方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 48|SQLite 与 uploads 备份脚本
阶段目标: 提供运维级本地备份脚本。
前置依赖: 阶段 46、阶段 47。
文件范围: scripts/backup.* 、 scripts/restore.* 。
本阶段要做: 脚本化备份与恢复说明。
本阶段不要做: 不做远程对象存储同步。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 48 阶段开发。
项目背景:
除了应用逻辑导出外,还需要操作层面的 SQLite + uploads 目录备份脚本,便于真实运维。
当前阶段:
第 48 阶段:SQLite / uploads 备份脚本
前置条件:
- 已完成:Docker Compose、静态托管
- 当前已有目录:scripts、data、uploads
- 当前已有模块:应用级导入导出
本阶段目标:
- 提供 SQLite 文件与 uploads 目录的备份脚本
- 提供恢复流程说明
- 适合本地或轻量服务器执行
本阶段需要实现:
1. 编写备份脚本,将 SQLite 文件和 uploads 目录打包到带时间戳的备份目录
2. 编写恢复说明或恢复脚本
3. 在 README 中补充使用说明
4. 说明运行前后需要停止服务还是短暂停写的建议
涉及文件范围:
- scripts/backup.sh 或 backup.mjs
- scripts/restore.sh 或 restore.mjs
- README.md
- docs/*
本阶段明确不要做:
- 不要实现云同步
- 不要实现加密压缩体系的复杂版本
- 不要改动业务模块
- 不要写死平台专属命令而不说明兼容性
- 不要引入非 MVP 功能
代码要求:
- 脚本简单可靠
- 路径明确
- 日志输出清晰
验收标准:
1. 可执行备份脚本
2. 备份产物包含 SQLite 与 uploads
3. 恢复流程文档清楚
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 脚本执行方式
4. 验证方式
5. 已完成内容
6. 未完成内容
7. 风险和 TODO

---

阶段 49|回归测试与修复
阶段目标: 对 MVP 做系统级回归清单与 bug 修复。
前置依赖: 阶段 48。
文件范围: tests/* 、修复点相关文件。
本阶段要做: 端到端关键路径清单、手工 + 自动化基础检查。
本阶段不要做: 不做庞大测试平台。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 49 阶段开发。
项目背景:
在 MVP 接近完成时,需要进行一轮以用户闭环为中心的回归测试和修复。
当前阶段:
第 49 阶段:回归测试与修复
前置条件:
- 已完成:功能、部署、备份基本齐备
- 当前已有目录:tests 或等价目录
- 当前已有模块:MVP 全链路
本阶段目标:
- 建立回归测试清单
- 修复关键阻塞问题
- 输出已知问题列表
本阶段需要实现:
1. 制定核心路径测试:登录/进入角色列表/创建角色/创建会话/发送消息/流式回复/停止生成/Prompt
预览/世界书命中/导入导出/备份恢复
2. 增加基础自动化测试或至少关键模块测试(可从 PromptBuilder、world book matcher、
Model Gateway adapter 开始)
3. 修复本轮发现的关键问题
4. 输出已知问题与剩余风险列表
涉及文件范围:
- tests/*
- apps/web/src/*
- apps/server/src/*
- docs/*
本阶段明确不要做:
- 不要引入庞大测试框架或云测试服务
- 不要借修复名义重构整个项目
- 不要扩展新功能
- 不要暴露 API Key
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 优先修复阻塞问题
- 测试覆盖关键路径
- 记录已知问题
验收标准:
1. 核心路径都有测试或手工回归记录
2. 阻塞级问题已修复
3. 已知问题有文档化清单
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 回归清单
4. 修复内容
5. 未解决问题
6. 风险和 TODO

---

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
