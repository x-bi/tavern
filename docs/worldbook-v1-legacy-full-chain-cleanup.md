# 世界书全链路 V1 遗留清理与 V2 单一链路改造任务

## 0. 当前代码事实校正版（2026-07-23）

本节覆盖下方原始任务描述中的过期假设，后续落地以本节和当前仓库代码为准。

当前代码已经不是完整 V1 链路：

- 数据库层已经移除 `WorldBookEntry.title/content/keywordsJson/secondaryKeywordsJson/position/tokenBudget/caseSensitive/metadataJson` 等旧列，条目正文与运行配置进入 `WorldBookEntryRevision.content/configJson`。
- 真实 Chat、Prompt Preview、Companion Chat 都已经接入 `WorldBookRuntimeService` 与 `compilePromptSections()`；需要保证三者继续共享同一个 V2 Runtime，而不是恢复旧 `PromptBuilderService` 世界书分组链路。
- 当前残留主要集中在外层契约：共享类型、世界书 CRUD DTO/响应、模块 JSON 导入导出、Content Pack、前端编辑器、示例和测试仍使用 `insertionOrder`、`before_current_user_input`、`after_current_user_input` 或旧别名归一化。
- `Companion` 现在可以通过 `companionIds` 绑定世界书并使用同一个 `WorldBookRuntimeService`，不能再按早期“Companion 不读取世界书”的旧结论处理。
- `WorldBook.tokenBudget/scanDepth` 是世界书本体预算与扫描深度，仍有运行时消费方；条目级旧 `tokenBudget` 应统一为 revision config 里的 `maxTokens`。`budgetPriority/sortOrder` 是 V2 排序与裁剪输入，必须保留。
- 当前仓库没有 `model-context/` 目录，审计命令不得硬编码不存在路径导致 `rg` 非 0 退出。

本次落地目标：

1. 对外世界书条目契约统一为 `placement`，允许值只保留 `instruction | before_history | after_history | before_current_user`。
2. 删除运行时代码中的 `insertionOrder`、`WorldBookEntryInsertionOrder`、`WorldBookEntryPosition`、`before_current_user_input`、`after_current_user_input`、`before_current_user_message`、`after_current_user_message`、`normalizeInsertionOrder`、`INSERTION_ORDER_ALIAS_NORMALIZED`。
3. 模块 JSON 与 Content Pack V2 只接受 `placement`；旧字段、旧枚举、旧格式直接失败，不 warning、不自动升级、不 fallback。
4. 前端世界书编辑器直接展示和提交 `placement`，不再建立字段别名。
5. 迁移或拒绝已持久化的旧 `configJson.placement`：`before_current_user_input` 可确定迁移为 `before_current_user`；`after_current_user_input/after_current_user` 无 V2 等价语义，迁移必须失败并输出待处理清单。
6. 回归测试必须覆盖 `placement: "before_current_user"` 从导入、数据库 revision config、Runtime section、Preview Debug、导出和 Content Pack 的全链路保持不变。

调整后的静态残留检查：

```bash
rg -n "insertionOrder|before_current_user_input|after_current_user_input|before_current_user_message|after_current_user_message|INSERTION_ORDER_ALIAS_NORMALIZED|normalizeInsertionOrder|WorldBookMatchResult|WorldBookMatchedEntry|WorldBookSkippedEntry|WorldBookEntryPosition|WorldBookEntryInsertionOrder" apps packages prisma scripts docs
```

允许残留只包括：

- 本文档中描述被删除的旧字段；
- migration 中用于迁移或拒绝旧数据的 SQL；
- 回归测试中断言旧字段失败的输入样例。

## 任务背景

当前项目已经以 Context Engine V2 为唯一运行基线，不再兼容 Context Engine V1。

Prompt 预览中先前存在的世界书调试显示问题已经修复。本任务必须基于当前本地代码继续检查和清理世界书全链路，不要回退、重做或破坏已经完成的 Prompt 预览修复。

本任务不是只修复 `placement` 导入问题，而是完整审计并清除世界书链路中的：

- V1 类型、字段和枚举；
- V1 Prompt Builder / Matcher 残留实现；
- 无消费方的死字段和死代码；
- 重复定义、别名字段和双写结构；
- 旧值归一化、兼容映射和 fallback；
- 旧导入格式、旧模板、旧导出结构；
- 前后端为旧响应保留的兼容读取；
- 数据库中只服务旧链路的字段；
- 测试、文档、示例和种子数据中的旧约定。

允许 Breaking Change，不需要兼容旧文件、旧接口或旧数据库字段。

---

## 一、执行原则

1. 开始前先阅读根目录 `AGENTS.md`，以当前本地代码和该文件为准。
2. 不要仅根据字段名称判断 V1/V2，必须追踪字段的完整数据流：
   - 从哪里写入；
   - 存在哪里；
   - 谁读取；
   - 是否影响匹配；
   - 是否影响编译；
   - 是否进入模型请求；
   - 是否只用于展示。
3. 已经没有真实消费方的字段和代码直接删除，不保留 `deprecated`、别名、双写或兼容适配器。
4. 不允许用默认值掩盖非法旧数据。
5. 不允许为了减少修改量继续保留 V1 → V2 转换层。
6. Prompt Preview 和真实 Chat 必须继续复用同一条 V2 构建链路。
7. 修改前后，除被明确清理的旧结构外，V2 的匹配、状态推进、Section 排序和最终模型消息语义必须保持一致。

---

## 二、先完成全仓审计

先运行并扩展以下搜索：

```bash
rg -n \
"WorldBook|worldBook|world-book|world_book|worldbook|\
WorldBookMatchResult|WorldBookMatchedEntry|WorldBookSkippedEntry|\
insertionOrder|position|placement|\
before_current_user_input|after_current_user_input|\
before_current_user_message|after_current_user_message|\
before_current_user|after_current_user|\
normalizeInsertionOrder|INSERTION_ORDER_ALIAS_NORMALIZED|\
matchedEntries|skippedEntries|worldBookDecisions|worldBookDebug|\
scanDepth|tokenBudget|priority|budgetPriority|sortOrder|\
caseSensitive|secondaryKeywords|\
tavern-lite\.world-book\.v1|tavern-lite\.content-pack\.v1" \
apps packages prisma scripts docs model-context
```

另外检查引用关系：

```bash
rg -n \
"PromptBuilderService|matchWorldBookEntries|world-book-matcher|\
WorldBookEntryPosition|WorldBookEntryInsertionOrder|\
WorldBookContext|WorldBookEntryContext" \
apps packages
```

修改前先输出一份审计表，每个命中项标记为：

```text
ACTIVE_V2       当前 V2 必需
LEGACY_V1       V1 遗留，必须删除
DUPLICATE       重复类型或重复数据源
DEAD            无有效读写链路
MIGRATE         需要一次性迁移后删除
FORMAT_VERSION  文件格式版本，需要单独决策
```

审计表至少包含：

```text
文件
符号或字段
写入方
读取方
是否进入当前 Chat/Preview
分类
处理方式
```

不要在没有完成引用链确认前批量删除。

---

## 三、重点检查的现有高风险区域

以下位置在仓库历史实现中出现过明显的旧结构，必须以当前本地代码重新确认。

### 3.1 共享类型

重点检查：

```text
packages/shared/src/prompt-builder.ts
packages/shared/src/world-book.ts
packages/shared/src/content-pack.ts
packages/shared/src/index.ts
```

重点确认并清理：

- `WorldBookEntryPosition`
- `WorldBookEntryInsertionOrder`
- `WorldBookMatchResult`
- `WorldBookMatchedEntry`
- `WorldBookSkippedEntry`
- `PromptPreviewResponse.worldBook`
- 重复的 `worldBookDebug`
- `insertionOrder`
- `position`
- 旧四段位置枚举
- 旧 Matcher 专用字段

共享包中只能保留当前 V2 的唯一稳定契约，禁止通过 type alias 给旧名称续命。

### 3.2 后端世界书模块

完整检查：

```text
apps/server/src/modules/world-books/
```

包括：

```text
world-books.service.ts
world-book.types.ts
world-books.constants.ts
dto/
controller
module
测试文件
```

重点删除：

- `normalizeInsertionOrder`
- `INSERTION_ORDER_ALIAS_NORMALIZED`
- `before_current_user_message` 等别名；
- `before_current_user_input` 等旧枚举；
- 非法值回落到 `before_history` 的逻辑；
- API `insertionOrder` 与数据库 `position` 的往返转换；
- 仅用于 V1 的本地重复类型；
- 旧导入预览字段；
- 旧模板字段；
- 已无调用方的 helper。

### 3.3 Content Pack 链路

完整检查：

```text
apps/server/src/modules/content-packs/
packages/shared/src/content-pack.ts
apps/web/src/views/content-packs/
apps/web/src/api/
```

必须覆盖：

- 输入类型；
- JSON 解析；
- Schema 校验；
- Preview；
- Commit；
- 数据库存储；
- 导出；
- 模板下载；
- 前端表单；
- 前端类型；
- 错误提示；
- 测试。

不得只修改 TypeScript 类型而遗漏运行时解析器。

### 3.4 Prompt Builder、Matcher 和 Context Engine

完整检查：

```text
apps/server/src/services/prompt-builder/
apps/server/src/modules/prompts/
apps/server/src/modules/chat/
apps/server/src/services/companion-prompt-builder/
apps/server/src/modules/companion-chat/
```

重点确认：

1. 当前真实 Chat 和 Prompt Preview 实际调用的是哪一个 Builder / Compiler。
2. 当前 V2 世界书 Runtime、Matcher、Section Compiler 的唯一入口。
3. 是否仍有旧的：
   - `world-book-matcher.ts`
   - `matchWorldBookEntries()`
   - `WorldBookMatchResult`
   - 四个旧插入点分组；
   - `entry.position` 与 `entry.insertionOrder` 双字段；
   - 基于 `priority` 的旧排序；
   - 基于 `tokenBudget` 的旧筛选；
   - 旧 `matchedEntries/skippedEntries` 返回模型。

处理规则：

- 旧链路完全无调用方：删除整个文件、模块导出、类型和测试。
- 旧链路仍被 Chat 或 Preview 调用：先迁移到 V2 唯一入口，再删除旧链路。
- 不允许让 V1 Matcher 和 V2 Runtime 同时存在。
- 不允许 Preview 走 V2、Chat 仍走旧 Builder，或反过来。

### 3.5 数据库和 Prisma

完整检查：

```text
prisma/schema.prisma
prisma/migrations/
prisma/seed*
scripts/
```

重点审计世界书相关字段：

```text
position
insertionOrder
placement
priority
budgetPriority
sortOrder
tokenBudget
scanDepth
caseSensitive
secondaryKeywordsJson
metadataJson
```

对每个字段确认是否存在真实 V2 消费方。

处理规则：

- V2 必需字段：保留并统一命名。
- 只是旧字段但数据可以确定映射：写一次性 migration，迁移后删列。
- 没有消费方的死字段：通过 migration 删除。
- 无法可靠推断的错误数据：迁移必须失败并输出清单，不得静默猜测。
- 已经被错误回落为 `before_history` 的记录，不能仅凭当前值自动推断原始 placement；应按确定的条目 ID、来源包或重新导入处理。

禁止手工修改 SQLite 表，必须使用 Prisma migration。

### 3.6 前端世界书管理

完整检查：

```text
apps/web/src/views/world-books/
apps/web/src/views/WorldBookView.vue
apps/web/src/api/
apps/web/src/types/
apps/web/src/stores/
apps/web/src/components/
```

必须清理：

- `insertionOrder` 表单字段；
- 旧 placement 选项；
- `before_current_user_input` / `after_current_user_input`；
- 旧 API 类型；
- 旧字段 fallback；
- 根据旧字段自行推导 V2 状态的逻辑；
- 无后端消费方的隐藏表单字段。

前端字段应与当前 V2 后端 DTO 同名，避免再建立别名。

### 3.7 其他容易遗漏的链路

必须额外检查：

```text
角色导入导出
世界书模块 JSON 导入导出
内容包导入导出
内容库 fork / copy
共享内容复制
备份恢复
模板下载
示例 JSON
seed 数据
测试夹具
README
AGENTS.md
docs/
model-context/
scripts/
```

还要检查公共分享聊天和 Companion 是否通过另一套路径加载世界书，确保不存在第二条旧链路。

---

## 四、建立 V2 唯一契约

先从当前已运行的 Context Engine V2 类型中确认唯一标准，不要在任务中另造一套近似类型。

世界书 placement 预计只保留：

```ts
type WorldBookPlacement =
  | 'instruction'
  | 'before_history'
  | 'after_history'
  | 'before_current_user';
```

以本地 V2 实际类型为最终准则。

明确删除：

```text
insertionOrder
position（若只是 placement 的旧数据库名）
before_current_user_input
after_current_user_input
before_current_user_message
after_current_user_message
```

`after_current_user_input` 不得因为旧数据存在而保留；如果 V2 没有该语义，导入时直接拒绝。

统一后的字段必须贯穿：

```text
导入 JSON
→ 运行时 Schema
→ DTO
→ Service
→ Prisma
→ Runtime Candidate
→ Match Decision
→ Prompt Section
→ Debug
→ 导出 JSON
→ 前端表单
```

全链路只允许一个字段名和一个枚举来源。

---

## 五、导入和导出策略

### 5.1 不再兼容旧文件

旧字段或旧值出现时直接返回明确错误，例如：

```text
worldBooks[0].entries[3].insertionOrder is not supported.
Use placement instead.
```

```text
placement "before_current_user_input" is not supported.
Allowed values: instruction, before_history, after_history, before_current_user.
```

禁止：

```ts
legacyValueMap[value];
value ?? 'before_history';
invalidValue ? 'before_history' : value;
```

字段缺失是否允许默认值，应由 V2 Schema 明确定义；字段存在但非法必须报错。

### 5.2 文件格式版本

注意区分：

- Context Engine V1；
- JSON 文件格式名中的 `.v1`。

二者不是同一个概念，不能只因名称含 `v1` 就直接删除。

但当本次改造改变字段名、枚举或结构时，应创建唯一的新格式版本，例如：

```text
tavern-lite.world-book.v2
tavern-lite.content-pack.v2
```

然后：

- 导入器只接受新版本；
- 模板只生成新版本；
- 导出器只输出新版本；
- 旧版本直接拒绝；
- 不保留 V1 parser；
- 不做自动升级；
- 测试夹具全部升级。

不要只修改版本字符串而不修改 Schema 和导入导出实现。

---

## 六、死字段判定规则

字段满足以下任一条件时视为死字段候选：

1. 只写不读；
2. 只在导入后原样保存，但不参与 Runtime；
3. 只在旧 Preview DTO 中展示；
4. 只在旧 Matcher 中使用，而旧 Matcher 已不在调用链；
5. 只是另一个 V2 字段的别名；
6. 只服务已删除的旧文件格式；
7. 前端提交但后端忽略；
8. 后端返回但前端和其他消费者均不使用；
9. 仅存在于注释、示例或测试快照；
10. 通过默认值长期返回，但没有真实数据来源。

删除一个死字段时必须同步删除：

```text
共享类型
DTO
Schema
Service 映射
Prisma 字段
migration
前端字段
API 类型
导入导出
模板
测试
文档
```

不要只清理表面定义。

---

## 七、已经修复的 Prompt 预览

Prompt 预览世界书调试显示问题已经完成修复。

本任务只做以下验证：

- 当前 Preview 是否只消费 V2 唯一调试结构；
- 是否还残留旧共享类型或后端死字段；
- Chat 与 Preview 的 WorldBook decisions 和 compiled sections 是否来自同一条链路。

除非本地代码仍明确残留旧字段，否则不要重新设计 Preview UI、不要恢复旧响应、不要增加 fallback。

必须增加回归测试，保证本次全链路清理后，现有修复仍然有效。

---

## 八、测试要求

### 8.1 静态清理检查

完成后执行：

```bash
rg -n \
"insertionOrder|before_current_user_input|after_current_user_input|\
before_current_user_message|after_current_user_message|\
INSERTION_ORDER_ALIAS_NORMALIZED|normalizeInsertionOrder|\
WorldBookMatchResult|WorldBookMatchedEntry|WorldBookSkippedEntry" \
apps packages prisma scripts docs model-context
```

剩余结果必须逐项解释。除迁移文件或明确的拒绝旧格式测试外，运行时代码不应再出现。

### 8.2 CRUD

验证世界书条目：

```text
创建
读取
更新
删除
复制
内容库 fork
```

placement 全程保持 V2 标准值，不出现字段改名或默认回落。

### 8.3 模块 JSON 和 Content Pack

验证：

```text
V2 导入
V2 预览
V2 提交
V2 导出
V2 再导入
```

断言 placement 和其他 V2 字段完全一致。

旧字段、旧枚举、旧格式版本必须明确失败，并保证事务无半成品写入。

### 8.4 Prompt 运行链路

至少覆盖：

- constant；
- current_user；
- user_history_window；
- assistant_latest；
- sticky；
- continuation；
- cooldown；
- manual；
- state；
- reference；
- 预算裁剪；
- regenerate；
- stop / failed 不提交状态。

验证真实 Chat 和 Prompt Preview 使用相同：

```text
候选加载
匹配决策
Section 生成
排序
预算
最终消息
```

### 8.5 placement 回归

导入一个：

```json
{
  "placement": "before_current_user"
}
```

断言：

```text
数据库 = before_current_user
Runtime Candidate = before_current_user
Compiled Section = before_current_user
Preview Debug = before_current_user
导出文件 = before_current_user
```

不得在任一阶段变成 `before_history`。

### 8.6 构建和检查

根据当前 `package.json` 执行实际存在的命令，至少覆盖：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @tavern/server build
pnpm --filter @tavern/web build
pnpm --filter @tavern/shared build
```

命令名称不同则使用项目真实脚本。

---

## 九、实施顺序

按以下顺序执行，避免边删边保留双链路：

1. 阅读 `AGENTS.md`。
2. 输出世界书端到端调用图和字段审计表。
3. 确认当前 V2 的唯一类型和唯一运行入口。
4. 确认旧 Prompt Builder / Matcher 是否仍在调用链。
5. 先迁移调用方到 V2。
6. 删除旧 Matcher、旧 Builder 分支和重复类型。
7. 统一共享契约、DTO 和前端类型。
8. 统一 Prisma 字段并创建 migration。
9. 改造模块 JSON 与 Content Pack 为新格式。
10. 删除所有兼容映射、别名、fallback 和双写。
11. 清理前端、模板、文档、seed、测试夹具。
12. 修复现有错误测试数据或重新导入。
13. 运行完整测试和静态搜索。
14. 再次验证真实 Chat 与 Prompt Preview。

不要先加兼容层再计划以后删除，本任务完成时仓库中只应剩 V2 单一链路。

---

## 十、明确禁止

- 不保留 V1/V2 双写。
- 不保留旧字段 alias。
- 不保留旧格式自动升级。
- 不保留“未知值回落到 before_history”。
- 不使用 `any` 绕过类型问题。
- 不仅修改导入器而遗漏 CRUD、导出、数据库和前端。
- 不仅修改类型而遗漏运行时代码。
- 不因字段名含 `.v1` 就盲目删除文件格式版本。
- 不修改已经正常工作的预设显示逻辑。
- 不改变 V2 匹配算法和状态语义，除非确认当前调用的是旧实现并需要迁移到既有 V2 实现。
- 不新增新的兼容 DTO、V3 名称或临时桥接层。

---

## 十一、完成后的交付内容

完成代码修改后输出：

1. 当前世界书端到端调用图；
2. V1 遗留清单及分类；
3. 删除的文件、类型、字段、枚举和 helper；
4. 保留的 V2 唯一契约；
5. 数据库 migration 说明；
6. 世界书模块 JSON 与 Content Pack 新格式；
7. 已有数据如何处理；
8. Chat、Prompt Preview、Companion 是否共用同一链路；
9. 新增和修改的测试；
10. 实际运行的检查命令及结果；
11. 最终 `rg` 残留结果及每一项解释；
12. 尚未解决的问题。
