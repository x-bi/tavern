# 删除旧 ModelConfig 体系,统一为模型链

## 决策前提(已确认)
- 旧 `ModelConfig` 体系(扁平:provider+baseUrl+model+apiKey)全部删除。
- 已配的模型链数据(Provider/ProviderModel/FallbackGroup)**也一并清空**,删完重新配置。
- backup **完全不含**模型配置:删掉旧 ModelConfig 的导出/导入,不新增模型链备份。
- `ModelCallLog` 是死表(从未写入),**整表删除**。
- 无需数据迁移脚本(全清)。

## 影响面与改动清单

### 1. Prisma schema(`prisma/schema.prisma`)
- 删 `model ModelConfig` 整块。
- 删 `model ModelCallLog` 整块(死表)。
- `Conversation`:删 `modelConfigId` 字段 + `modelConfig` 关联;保留 `modelFallbackGroupId`。
- `User`:删 `modelConfigs`、`modelCallLogs` 关联字段。
- `Message`:删 `requestModelCallLogs`、`responseModelCallLogs` 关联字段(指向已删的 ModelCallLog)。
- 保留 `ModelProvider` / `ProviderModel` / `ModelFallbackGroup` / `ModelFallbackCandidate`(新体系)。

### 2. Migration
- `prisma migrate dev --name remove_model_config`(SQLite 下删字段会重建表,可接受,因数据全清)。
- `prisma generate`。
- 旧 migration 文件保留,新增一条 drop migration。

### 3. 后端代码
**删除整文件:**
- `apps/server/src/modules/models/models.controller.ts`(旧 `/model-configs` 控制器)
- `apps/server/src/modules/models/dto/create-model-config.dto.ts`
- `apps/server/src/modules/models/dto/update-model-config.dto.ts`

**保留共用文件(只删旧部分):**
- `dto/query-model-configs.dto.ts` → 新 controller 也用,保留(必要时重命名为 `query-models.dto.ts`,非必须)。
- `model-config.types.ts` → 删 `ModelConfigResponse`/`ModelConfigListResponse`/`ModelConfigPayload` 等旧类型;**保留** `ModelGatewayConfig`、`ModelConfigParams`(chat/models 新代码在用)、`ModelConfigTestResponse`(testProviderModel 在用)。

**改 `models.service.ts`:**
- 删 ModelConfig 全套方法:`list`/`getById`/`create`/`update`/`remove`/`testConnection`/`getGatewayConfig`/`findOwnedActiveModelConfig`/`findDefaultActiveModelConfig`/`toResponse`/`pickParams`/`mergeParams`/`hasParamUpdate`。
- **保留** API Key 加解密方法(`encryptApiKey`/`decryptApiKey`/`maskApiKey`/`normalizeApiKey`/`throwIfUniqueNameConflict`)——新 Provider 体系在用。
- 改 `getGatewayCandidates`:删回退到 `getGatewayConfig` 的分支;无 FallbackGroup 时返回空数组。
- 保留 Provider/ProviderModel/FallbackGroup 全套方法。

**改 `chat.service.ts`:**
- `stream`/`suggestReplies` 里删 `dto.modelConfigId ?? conversation.modelConfigId` 传参,只传 `modelFallbackGroupId`。
- 无候选时 `assertModelCandidatesReady` 抛错,提示文案改为"请先配置模型链"。
- `toBuildPromptInput` 的 `modelConfig` 入参传 `null`(PromptBuilder 不消费此字段,仅为类型兼容)。

**改 `conversations.service.ts`:**
- 删 `resolveModelConfigId` 方法。
- `create`/`update` 删 `modelConfigId` 处理。
- `relationInclude` 删 `modelConfig: true`。
- `toResponse` 删 `modelConfig` 字段;`ConversationWithRelations` 类型删 `modelConfig`。

**改 `prompts.service.ts`:**
- `PreviewConversation` 类型删 `modelConfig`。
- `findOwnedActiveConversation` 的 include 删 `modelConfig`。
- `toBuildPromptInput` 的 `modelConfig` 传 `null`。

**改 `backups.service.ts` + `backup.types.ts`:**
- 导出:删 `modelConfigs` 查询、`toModelConfigBackupRecord`、`summary.modelConfigs`、`data.modelConfigs`、`security.apiKeys` 策略块、`apiKeysDropped` 统计。
- 导入:删 modelConfigs 恢复路径与相关警告。
- 清空(`clearUserData`):删 ModelConfig 和 ModelCallLog 的 `deleteMany`(表已不存在)。
- 类型:删 `ApplicationBackupModelConfig`、`data.modelConfigs`、`summary.modelConfigs`、security 里的 `apiKeys`。
- 注意 backup 格式版本:因结构变化(删 modelConfigs 字段),考虑升 backup format version 或在导入时兼容旧备份(旧备份里的 modelConfigs 字段忽略)。倾向:导入时容忍多余字段,不升版本。

**改 `app.module.ts`:** 无需改(ModelsModule 保留,只是内部少一个 controller)。
**改 `models.module.ts`:** `controllers` 数组删 `ModelsController`。

### 4. shared 类型(`packages/shared/src/`)
- `model-config.ts`:删 `ModelConfigResponse`/`ModelConfigListResponse`/`ModelConfigPayload`;保留 `ModelProviderResponse` 等 + `ModelConfigTestResponse`。
- `conversation.ts`:删 `ConversationModelConfigSummary`、`ConversationResponse.modelConfig`、`ConversationPayload.modelConfigId`。
- `backup.ts`:删 `ApplicationBackupModelConfig`、`data.modelConfigs`、`summary.modelConfigs`、`BackupApiKeyPolicy` 及 security.apiKeys。
- `index.ts`:同步删旧类型导出。

### 5. 前端(`apps/web/src/`)
**删除整文件:**
- `components/ModelConfigForm.vue`(旧表单死代码,执行时确认无引用后删)。

**改 `stores/model.ts`:**
- 删 `items: ModelConfig[]`、`hasModelConfigs` getter、`loadModelConfigs`/`createModelConfig`/`updateModelConfig`/`deleteModelConfig` action。
- `loadModelResources` 删 `fetchModelConfigs` 调用。

**改 `api/models.ts`:**
- 删 `fetchModelConfigs`/`createModelConfig`/`updateModelConfig`/`deleteModelConfig`/`testModelConfigConnection`。
- 删 `ModelConfig`/`ModelConfigMutationPayload` 类型。
- `ModelConfigListParams`/`ModelConfigDeleteResult` 新代码共用,保留(或重命名,非必须)。

**改 `api/conversations.ts`:** 删 `modelConfigId` 查询参数。

**改 views(ChatView/SettingView/PromptPreviewView):** 逐一清理 `modelConfig` 引用——会话详情里展示"当前模型配置"的地方,改为展示 `modelFallbackGroup` 或移除。

**router/index.ts:** `ModelConfigView` 路由保留(已是模型链页面),不改。

### 6. Seed(`prisma/seed.cjs`)
- 删默认 ModelConfig 的 seed(README 提到的 "OpenAI-compatible Demo" 模型配置)。
- 因数据全清,seed 重新跑后只剩角色/预设/persona/世界书样例,无模型配置——用户需手动建模型链才能聊天。这是预期行为。

## 执行顺序
1. schema 改动 + `prisma migrate dev` + `prisma generate`(基础)。
2. 后端代码删改(models → conversations → prompts → chat → backups)。
3. shared 类型删改。
4. 前端删改(store → api → views → 删 ModelConfigForm)。
5. seed 删 ModelConfig。
6. `pnpm typecheck` 验证前后端类型。
7. 启动后端确认无运行时错误。

## 风险与注意
- **不可逆**:drop ModelConfig + ModelCallLog 表,数据全清。已确认接受。
- **备份兼容**:旧备份文件里的 `modelConfigs` 字段,导入时需容忍(忽略多余字段),否则旧备份无法导入。会在导入解析处做宽容处理。
- **会话无模型链**:删字段后,已有会话不再绑定模型配置,需用户给会话重新选模型链才能聊天。
- **PromptBuilder.modelConfig 死参数**:BuildPromptInput.modelConfig 实际未被 build 消费,本次传 null 不改 PromptBuilder 结构(最小改动);如需彻底删字段留作后续。
- **typecheck 是主要验证手段**:不跑完整测试套件,靠类型检查 + 启动确认。

## 验证
- `pnpm typecheck` 通过。
- 后端启动无错,`/model-configs` 路由消失(404)。
- `/model-providers`/`/provider-models`/`/model-fallback-groups` 路由正常。
- 前端模型链页面正常加载,无旧 ModelConfig 残留。
- backup 导出不再含 modelConfigs 字段;导入旧备份(含 modelConfigs)不报错。
