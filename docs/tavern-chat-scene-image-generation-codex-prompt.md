# Tavern 聊天场景生图功能开发方案与 Codex 执行提示词

> 本文档是供 Codex 或其他代码模型直接执行的开发基线。请先完整阅读仓库现有实现，再按本文档落地。不要脱离现有架构重写聊天链路，不要引入本文档未要求的自动生图、图生图或聊天审计能力。

---

## 1. 任务目标

在 Tavern 项目的聊天会话中增加“基于当前场景手动生成图片”的功能。

用户可以在一条已完成的 assistant 消息下点击“生成当前场景”，系统基于该 assistant 回复、对应用户消息、最近有效上下文、角色信息、Persona、该回复生成时实际命中的世界书内容以及会话级生图配置，构建场景提示词，调用独立的生图模型链生成图片，并将图片显示在该 assistant 消息下方。

图片虽然从聊天场景生成，但必须作为独立图片资产保存，不作为新的聊天消息写入消息列表。

---

## 2. 已确认的产品约束

### 2.1 第一版只做手动生图

必须实现：

- assistant 消息下手动点击“生成当前场景”；
- 图片生成完成后显示在该消息下方；
- 图片下方提供“重新生成图片”按钮；
- 不自动判断场景；
- 不自动调用生图；
- 不要求聊天模型在正文中输出任何生图标签或 JSON。

禁止实现：

- assistant 回复完成后自动生图；
- 每 N 轮自动生图；
- AI 判断是否是重要场景；
- 在聊天正文中插入 `<generate_image>` 一类控制标记。

### 2.2 生图模型与聊天模型统一管理，但不共用

生图模型继续放在当前模型管理模块中，不单独建立一套供应商或模型后台。

同一个 Provider 可以同时拥有聊天模型和生图模型，但模型与模型链必须通过能力类型区分：

```ts
export type ModelCapability = 'chat' | 'image';
```

要求：

- `ProviderModel.capability = 'chat' | 'image'`；
- 模型链同样增加 `capability = 'chat' | 'image'`；
- 聊天模型链只能添加聊天模型；
- 生图模型链只能添加生图模型；
- 聊天模型链和生图模型链不得混用；
- 供应商可以相同，具体模型可以不同；
- 不要为生图复制一套 Provider 管理模块。

image 模型链的归属和管理机制保持仓库现状，不改造成用户私有模型配置：

- `ModelProvider`、`ProviderModel`、`ModelFallbackGroup` 继续作为全站共享模型配置，固定归属第一个内置管理员；
- 模型管理接口继续复用现有 `SharedModelsGuard`，其创建与管理权限不因 image 能力另设一套规则；
- `ModelsService.getGatewayCandidates()` 继续从 `UsersService.getSharedModelOwner()` 解析共享模型链；
- 会话设置选择 image 链时，列出共享模型管理员名下 `capability=image`、已启用且未删除的链；
- `Conversation.imageModelFallbackGroupId` 只保存对共享 image 模型链的引用，不表示当前业务用户拥有该模型链；
- 不为普通用户创建私有 Provider、私有模型或私有模型链，也不复制 `ModelFallbackGroup` 数据结构。

### 2.3 生图模型链在会话中选择

不同会话可能使用不同风格、不同质量或不同供应商的生图模型，因此真正使用的生图模型链必须保存到会话配置中。

共享模型配置负责：

- 可用模型与模型链的配置。

会话负责：

- 当前会话使用哪个生图模型链；
- 风格预设；
- 生成张数；
- 画面比例。

第一版不增加独立的全局“是否允许生图”开关，也不设置默认 image 模型链。是否允许当前会话生成图片只由以下条件决定：

```text
Conversation.modelFallbackGroupId 指向可用 chat 链
+
Conversation.imageModelFallbackGroupId 指向可用 image 链
```

任一条件不满足时禁用生图并给出明确配置提示，不回退其他模型链。

第一版会话生图配置至少包含：

```ts
interface ConversationImageGenerationConfig {
  stylePreset: ImageStylePreset;
  imageCount: number;
  aspectRatio: ImageAspectRatio;
}
```

建议枚举：

```ts
export type ImageStylePreset =
  | 'auto'
  | 'anime'
  | 'realistic'
  | 'cinematic'
  | 'illustration'
  | 'fantasy';

export type ImageAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
```

限制：

```ts
imageCount: 1 | 2 | 3 | 4;
```

默认值建议：

```ts
{
  stylePreset: 'auto',
  imageCount: 1,
  aspectRatio: '1:1'
}
```

### 2.4 图片与聊天只做关联，不揉成同一种消息

禁止把图片保存成新的 `Message`。

禁止把完整图片信息直接塞进 `Message.content`。

聊天中的图片展示应当是：

```text
assistant 文本消息

[关联图片 1] [关联图片 2]

[重新生成图片]
```

图片是独立资产，消息和图片之间只保存展示关联。

### 2.5 消息被编辑或重新生成后的处理

如果用户编辑了该 assistant 回复对应的 user 请求消息，删除了关联消息，或者重新生成了该 assistant 回复：

- 原图片不删除；
- 原图片继续保存在用户图片库；
- 原图片继续可以在管理员图片管理中查看；
- 关闭该图片与当前消息的有效展示关联；
- 聊天窗口不再在该消息下显示旧图；
- 新消息或新内容需要用户重新点击生成图片。

图片资产生命周期与消息展示关系必须解耦。

### 2.6 图片跳会话第一版不开发

普通用户查看自己的图片详情时可以保存并展示：

- `conversationId`；
- `sourceMessageId`；
- 来源消息摘要；
- 生成时的上下文快照。

但不要提供：

- “跳转到原会话”按钮；
- 管理员从图片进入其他成员聊天；
- 跨用户聊天审计；
- 其他成员会话读取权限。

后续权限体系完善后再补。

### 2.7 图片默认长期保存到图片库

只要图片生成成功，就必须保存到独立图片资产库。消息生命周期变化不得自动删除图片，但“长期保存”不等于不可删除。

即使发生以下情况，图片仍然保留：

- 消息被编辑；
- assistant 回复被重新生成；
- 图片与消息展示关联被关闭；
- 用户重新生成了新版本图片。

只有用户主动删除自己的图片、管理员按既有管理规则删除、账号数据被清除，或其他明确的数据删除操作发生时，图片才进入软删除和后续物理文件清理流程。

普通用户只能查看自己的图片；管理员可以查看所有用户生成的图片。

---

## 3. 总体架构

最终链路：

```text
用户点击某条 assistant 消息下的“生成当前场景”
        ↓
校验消息归属、角色、状态和会话配置
        ↓
读取该 assistant 消息的真实生成追踪
        ↓
收集画面相关上下文
        ↓
通过一次普通文字模型调用归纳视觉场景并组织生图描述
        ↓
服务端合并真实追踪与证据，构建 SceneSnapshot
        ↓
按固定规则编译最终生图 Prompt
        ↓
调用会话选择的 image 模型链
        ↓
保存生成批次
        ↓
每张图片分别保存为独立 Asset / ImageAsset
        ↓
创建 MessageImageLink 展示关联
        ↓
聊天消息下方显示图片
        ↓
图片库与管理员图片管理同步可见
```

必须新增独立的生图业务模块，不要把完整逻辑塞进现有 `chat.service.ts`。

推荐模块边界：

```text
Context Engine
  ├─ 收集场景来源
  ├─ 通过普通文字模型生成并校验 ScenePromptModelOutput
  ├─ 服务端合并可信来源为 ScenePromptResult
  └─ 编译生图 Prompt

Model Gateway
  ├─ image 模型能力
  ├─ image 模型链回退
  └─ 统一不同 Provider 返回格式

Image Generations
  ├─ 生成批次生命周期
  ├─ 权限校验
  ├─ 重试与状态管理
  └─ 关联创建

Assets
  ├─ 图片文件落盘
  ├─ MIME / 尺寸 / 大小校验
  └─ 文件读取与删除策略

Images
  ├─ 用户图片库
  ├─ 图片详情
  └─ 管理员全量图片管理
```

---

## 4. 生图提示词拼装原则

### 4.1 不得直接复用完整聊天 Prompt

聊天 Prompt 中可能包含：

- 平台规则；
- 角色行为限制；
- 角色说话方式；
- 预设输出格式；
- 回复长度限制；
- 世界书触发配置；
- temperature / topP / maxTokens；
- 模型行为指令。

这些内容不属于视觉场景，不能原样发送给生图模型。

可以复用现有 Context Engine V2 的数据来源、生成追踪和世界书命中结果，但必须新增独立的：

```text
SceneImageContextBuilder
SceneImagePromptCompiler
```

### 4.2 提示词来源优先级

最终生图提示词来源：

```text
目标 assistant 回复
+ 对应用户消息
+ 少量最近有效上下文
+ 角色可视信息
+ 必要时的 Persona 可视信息
+ 该回复生成时实际命中的可视世界书内容
+ 会话风格预设
+ 固定构图与禁止项
```

冲突优先级：

```text
当前 assistant 回复
>
对应用户消息
>
最近有效上下文
>
当前命中的世界书
>
角色默认视觉信息
>
Persona 默认视觉信息
>
风格预设
```

### 4.3 第一来源：目标 assistant 回复

这是图片要表现的最终时刻。

提取：

- 当前人物；
- 最终动作；
- 表情；
- 姿态；
- 人物位置；
- 可见物品；
- 当前环境变化；
- 当前画面结果。

如果历史内容与当前回复冲突，以当前回复为准。

例如：

```text
历史：林晚站在门边。
当前：林晚已经坐到了窗边。
```

最终图片只表现“坐在窗边”。

### 4.4 第二来源：该回复对应的用户消息

不要简单依赖数据库物理顺序取上一条消息。

应优先使用现有 assistant 消息生成追踪中记录的用户请求消息，例如：

```text
ConversationMessageGenerationTrace.requestUserMessageId
```

用于补充：

- 当前地点；
- 用户动作；
- 交互对象；
- assistant 回复中的代词指向；
- 人物之间的关系和位置。

### 4.5 第三来源：最近有效场景上下文

默认只读取目标消息之前最近 4 到 8 条有效消息。

建议第一版限制：

```ts
imageHistoryLimit = 6;
imageHistoryMaxCharacters = 6000;
```

过滤：

- 已删除消息；
- 失败消息；
- 仍在生成中的临时消息；
- 与当前场景明显无关的远期历史。

这部分只用于：

- 解析“她”“那里”“刚才那个杯子”等指代；
- 确定当前地点、时间和天气；
- 确定服装变化；
- 确定在场人物；
- 确定当前物品状态。

禁止把整个会话全文直接交给生图模型。

### 4.6 第四来源：角色视觉信息

第一版从现有角色字段中筛选与视觉有关的描述，例如：

- `coreIdentity`；
- `extendedBackground`；
- `initialScenario`。

仅提取：

- 外貌；
- 年龄表现；
- 发型；
- 眼睛；
- 身材；
- 默认服装；
- 标志性物品；
- 可视觉化气质。

不要加入：

- 说话风格；
- 对话规则；
- 行为约束；
- 回复格式；
- 与当前画面无关的性格分析。

后续可以增加独立字段：

```ts
visualProfile?: string;
```

但第一版不强制进行角色表大规模改造。

### 4.7 第五来源：Persona

只有用户本人需要出现在画面中时才读取 Persona。

例如：

- assistant 与用户并肩；
- assistant 牵着用户；
- 两人面对面；
- assistant 明确看向用户；
- 场景需要双人构图。

优先读取：

- `coreIdentity`；
- `background` 中可视信息。

不要读取：

- `interactionPreferences`；
- 非视觉偏好；
- 用户对模型回复方式的要求。

如果没有明确用户外貌，不要擅自补充性别、发色或年龄。

可以选择：

- 第一人称视角；
- 背影；
- 局部轮廓；
- 不展示用户正脸。

### 4.8 第六来源：该回复实际命中的世界书

不要在生图时重新扫描当前最新世界书。

优先复用该 assistant 消息生成时记录的世界书命中追踪和条目版本，例如：

```text
ConversationIncludedWorldBookTrace
```

仅提取可视觉化内容：

- 地点；
- 建筑；
- 地形；
- 时代；
- 季节；
- 天气；
- 世界外观；
- 种族外形；
- 服饰规则；
- 特殊物品；
- 光照与环境特征。

禁止加入：

- 触发词；
- 扫描配置；
- sticky / cooldown；
- activationSource 业务描述；
- 纯行为规则；
- 与当前画面无关的大段历史。

### 4.9 第七来源：会话风格预设

会话配置中的 `stylePreset` 进入最终 Prompt。

例如：

```ts
const STYLE_PROMPTS: Record<ImageStylePreset, string> = {
  auto: '根据当前场景选择统一、自然且具有叙事感的视觉风格',
  anime: '动漫插画风格，清晰线条，细腻上色，人物表情自然',
  realistic: '写实摄影风格，自然光影，真实材质，人物比例自然',
  cinematic: '电影感构图，叙事性镜头，层次光影，具有沉浸感',
  illustration: '高质量叙事插画，画面完整，细节丰富，统一美术风格',
  fantasy: '奇幻概念插画，富有想象力的环境设计，氛围感强'
};
```

`imageCount` 和 `aspectRatio` 作为 API 参数发送，不要只写到 Prompt 中。

---

## 5. SceneSnapshot 结构

不要直接字符串拼接全部来源。

服务端最终构建并保存结构化的场景快照：

```ts
interface SceneImageSnapshot {
  source: {
    conversationId: string;
    assistantMessageId: string;
    requestUserMessageId?: string;
    generationTraceId?: string;
    sourceMessageContentHash: string;
  };

  scene: {
    location?: string;
    time?: string;
    weather?: string;
    environment: string[];
  };

  characters: Array<{
    name: string;
    role: 'character' | 'user' | 'other';
    appearance: string[];
    clothing: string[];
    expression?: string;
    pose?: string;
    action?: string;
    position?: string;
  }>;

  objects: Array<{
    name: string;
    state?: string;
    position?: string;
  }>;

  composition: {
    subject?: string;
    viewpoint?: 'first_person' | 'third_person';
    shotType?: string;
    cameraAngle?: string;
    focus?: string;
  };

  atmosphere: {
    mood?: string;
    lighting?: string;
    colorTone?: string;
  };

  style: {
    preset: ImageStylePreset;
    promptFragment: string;
  };

  evidence: {
    assistantMessage: string;
    requestUserMessage?: string;
    recentMessages: Array<{
      id: string;
      role: string;
      contentHash: string;
      excerpt?: string;
    }>;
    characterSource?: string;
    personaSource?: string;
    worldBookRevisionIds: string[];
  };
}
```

`source`、`evidence` 和 `style` 必须由服务端根据数据库 generation trace、消息原文与 Hash、世界书 revision、会话配置确定，不能由文字模型生成或覆盖。文字模型只负责返回 `scene`、`characters`、`objects`、`composition`、`atmosphere` 等视觉归纳结果。

必须将这份快照保存在图片生成批次记录中，以便：

- 图片详情查看；
- 重现生成来源；
- 排查 Prompt Builder；
- 消息后续变化后仍能保留原始生成依据；
- 重新生成图片时复用稳定的场景事实。

`evidence` 只存可追溯的引用与指纹，不存最近消息的完整正文。`recentMessages` 用 `contentHash` 记录当时内容指纹、`excerpt` 存截断摘要（如前 200 字），完整正文需要时按 `id` 从消息表回查。避免 `sceneSnapshotJson` 单行因存入多条消息全文而膨胀。`assistantMessage` 与 `requestUserMessage` 是生图的核心依据，保留原文；`recentMessages` 仅作指代解析的来源证明，存指纹即可。所有 ID、Hash、原始证据与 revision ID 均由服务端写入，不接受模型返回值。

---

## 6. 第一版使用普通文字模型生成场景描述

第一版采用：

```text
固定规则收集并裁剪上下文
+
专用、版本化的“场景转生图 Prompt”指令
+
目标会话 chat 模型链的一次非流式调用
+
结构校验
+
固定 Compiler 补充风格、Provider 参数和禁止项
```

仓库当前没有专门的生图提示词模型。第一版复用正常文字模型，通过提高“场景转生图 Prompt”指令的质量，完成事实抽取和生图描述组织，不增加独立的生图 Prompt 模型链。

固定 TypeScript 规则只负责选择可靠来源、裁剪长度和构建带来源优先级的输入，不能用关键词匹配代替人物、指代、服装变化、动作终态和世界书冲突等语义判断。普通文字模型一次完成：

- 解析人物、指代、动作终态、服装变化、位置关系和物品状态；
- 按 §4、§8 的优先级消解当前消息、历史、角色、Persona 和世界书冲突；
- 返回结构化视觉归纳结果；
- 在不虚构事实的前提下，把视觉信息组织为适合生图模型理解的连贯描述；
- 输出正向生图描述主体和可选负面提示词。

文字模型必须严格返回不含可信来源字段的模型输出：

```ts
interface ScenePromptModelOutput {
  visualScene: {
    scene: SceneImageSnapshot['scene'];
    characters: SceneImageSnapshot['characters'];
    objects: SceneImageSnapshot['objects'];
    composition: SceneImageSnapshot['composition'];
    atmosphere: SceneImageSnapshot['atmosphere'];
  };
  positivePromptBody: string;
  negativePrompt?: string;
}
```

服务端校验模型输出后，再生成最终结果：

```ts
interface ScenePromptResult {
  sceneSnapshot: SceneImageSnapshot; // source/evidence/style 由服务端写入
  positivePromptBody: string;
  negativePrompt?: string;
}
```

文本模型调用规则：

- 使用目标会话 `Conversation.modelFallbackGroupId` 对应的 chat 模型链，与该会话正常聊天共用同一条模型链；
- 不允许为场景转生图描述回退到默认 chat 模型链；`Conversation.modelFallbackGroupId` 为空、链已停用、已删除或 capability 不是 `chat` 时，直接返回 `IMAGE_SCENE_PROMPT_MODEL_NOT_CONFIGURED`，前端提示“请先在会话设置中选择可用的聊天模型链”；
- 通过 `ModelGatewayService.chat()` 非流式调用，业务层不得直连 Provider；
- 这是一次逻辑上的场景转生图描述请求；复用会话聊天链既有候选顺序和回退规则，但不再追加第二次文字模型调用；
- 只允许在当前会话 chat 模型链内部按候选顺序回退；候选全部失败时，批次进入 `failed`，返回 `IMAGE_SCENE_PROMPT_MODEL_CHAIN_FAILED` 并展示明确警告，不再查找任何默认链或其他模型链；
- “与聊天使用同一模型”指复用同一模型链；发生超时、停用或供应商失败时仍允许按链回退，因此不强制锁定目标 assistant 当时 generation trace 中的实际候选模型；
- 共用聊天链本身不会降低生图描述质量，但不同会话选择的文字模型能力不同，`ScenePromptModelOutput` 的准确性和细节质量也可能不同，必须通过版本化 Prompt 和回归样例控制；
- 输入只包含 §4 定义的场景相关来源，不包含完整系统 Prompt、平台规则、说话风格或输出格式规则；
- “场景转生图 Prompt”必须明确来源优先级、最终瞬间、视觉字段、禁止补充规则、输出结构和长度限制；
- 要求模型严格返回 `ScenePromptModelOutput` JSON，服务端对视觉结果、正向描述、负面提示词做 Schema、枚举、长度和来源约束校验；
- 服务端忽略模型输出中任何未声明字段，禁止模型写入或覆盖 conversation/message/trace/revision ID、Hash、原始 evidence 和 style；
- 模型不得补充证据中不存在的人物、外貌、服装或重要物品；无法确定的字段留空；
- `positivePromptBody` 必须覆盖主体、动作关系、环境、构图、镜头、光照、氛围和色调，但不得写入可由会话配置或 Adapter 决定的风格、比例和 Provider 特有参数；
- `negativePrompt` 只包含画面禁止项，不包含聊天规则；Provider 不支持负面提示词时不发送；
- JSON 非法、内容为空或约束校验失败时，批次进入 `failed`，返回 `IMAGE_SCENE_PROMPT_GENERATION_FAILED`，第一版不再发起第二次文字模型修复；
- 保存实际文字模型 ID、场景转生图 Prompt 版本、输入 Hash、输出 Hash 和安全元数据；普通日志不记录原始上下文；
- 重新生成图片默认复用原批次保存的 `ScenePromptResult`，不重复调用文字模型；用户从当前消息发起全新生成时才重新生成。

### 6.1 场景转生图 Prompt 基线

第一版必须把这份指令作为后端版本化模板维护，例如版本 `scene_image_prompt_v1`，不能散落在 Vue 组件或 Controller 中。建议基线：

```text
你是视觉场景解析与生图描述编写器。你的任务不是续写故事，也不是修改剧情，而是仅根据提供的证据，整理出当前回复结束时能够被画面表现的最终瞬间。

证据优先级：
1. 目标 assistant 回复；
2. 与该回复绑定的 user 消息；
3. 最近有效上下文；
4. 该回复生成时实际命中的世界书版本；
5. 角色默认视觉信息；
6. Persona 视觉信息。

处理要求：
- 识别当前在场人物、最终动作、表情、姿态、相对位置、服装、可见物品、地点、时间、天气、光照和氛围。
- 连续动作只保留回复结束时的最终状态，不同时描绘多个动作阶段。
- 当前内容覆盖历史内容；明确的临时状态覆盖角色默认状态；世界书明确事实覆盖无来源推测。
- 解析“她、他、那里、刚才的物品”等指代，但证据不足时留空。
- 不补充证据中不存在的人物、性别、年龄、发色、服装、身体特征、物品或剧情。
- positivePromptBody 必须是连贯、具体、可视化的生图描述，覆盖主体、动作关系、环境、构图、镜头、光照、氛围和色调。
- positivePromptBody 不写风格预设、画面比例、模型参数、画质标签、聊天规则或解释文字。
- 不要求图片表现台词、字幕、聊天气泡、界面、提示词或水印。
- negativePrompt 只列出应避免的可见画面问题；没有必要时返回空字符串。
- 只返回符合 ScenePromptModelOutput Schema 的 JSON，不要使用 Markdown 代码块，不要添加任何解释。
```

输入必须按来源分区，而不是拼成一段无法追踪的长文本：

```ts
interface ScenePromptEvidenceInput {
  assistantMessage: string;
  requestUserMessage?: string;
  recentMessages: Array<{ role: string; content: string }>;
  characterVisualSource?: string;
  personaVisualSource?: string;
  worldBookVisualSources: Array<{
    entryRevisionId: string;
    content: string;
  }>;
}
```

服务端应限制每个分区和总输入长度，并在发送前剔除非视觉字段。Prompt 调优优先修改这份版本化模板和对应回归样例，不通过更换业务逻辑、追加第二次模型调用或在 Provider Adapter 中偷偷改写 Prompt 来修补质量。

这次普通文字模型调用已经承担“事实抽取 + 生图描述组织”，但不增加独立模型链，也不做第二次 Provider-specific 创意改写。最终生图 Prompt 仍由确定性的 `SceneImagePromptCompiler` 编译。

---

## 7. 最终 Prompt 模板

推荐固定顺序：

```text
1. 任务目标
2. 文字模型生成的 positivePromptBody
3. 会话风格预设
4. Provider 能力允许的补充参数
5. 固定画面限制
```

建议模板：

```text
请生成一张表现以下故事最终时刻的场景图片。

【最终画面】
{{positivePromptBody}}

【视觉风格】
{{stylePrompt}}

【画面要求】
以最新场景为准，较早的对话只用于解释人物、物品和环境。
不要表现已经结束、被修改或被后续内容覆盖的动作。
不要在图片中显示聊天文字、字幕、对话框、水印、界面或提示词。
不要添加当前场景中没有出现的主要人物。
不要擅自补充没有来源依据的人物外貌、服装或重要物品。
```

Provider 支持负面提示词时，发送文字模型返回并经白名单校验的 `negativePrompt`；固定禁止项可与其去重合并，例如：

```text
文字，字幕，聊天气泡，水印，界面元素，额外人物，重复人物，多余肢体，错误手指，严重解剖错误，低清晰度，模糊主体
```

负面提示词必须根据 Provider 能力决定是否发送，不支持时不要硬塞到普通 Prompt 中。

---

## 8. 提示词冲突处理规则

### 8.1 当前内容覆盖历史内容

```text
历史：角色站在门口。
当前：角色已经坐到窗边。
```

结果：只保留“坐到窗边”。

### 8.2 明确临时状态覆盖角色默认状态

```text
角色默认：米白针织衫。
当前消息：换上黑色风衣。
```

结果：使用“黑色风衣”。

### 8.3 世界书明确事实覆盖普通推测

```text
普通消息：一家咖啡馆。
命中世界书：老城区街角、木质桌椅、整面临街玻璃窗。
```

结果：采用世界书的明确视觉设定。

### 8.4 不确定时省略

如果没有人物外貌来源，不要创造：

- 年龄；
- 性别；
- 发色；
- 服装；
- 身材。

可以选择背影、轮廓、第一视角或不展示。

### 8.5 默认表现回复结束时的最终瞬间

```text
她站起身，走到窗边，然后坐下。
```

图片表现“她坐在窗边”，而不是同时画出多个动作阶段。

---

## 9. 生成示例

### 9.1 对话

用户：

```text
我推开咖啡馆的门，在林晚对面坐下，把湿透的伞靠在桌边。
```

assistant：

```text
林晚抬起头，指尖仍搭在温热的杯沿。
她看了看你被雨打湿的外套，默默把靠窗的位置让出一点。
窗外的霓虹在雨水中晕成一片，她低声问你是不是等了很久。
```

角色视觉信息：

```text
林晚，黑色长发，深棕色眼睛，身形纤细，穿着米白色针织衫和深色长裙。
```

命中世界书：

```text
老城区街角的小咖啡馆，木质桌椅，暖黄色吊灯，整面临街玻璃窗。
```

会话配置：

```json
{
  "stylePreset": "cinematic",
  "imageCount": 2,
  "aspectRatio": "16:9"
}
```

### 9.2 最终 Prompt

```text
请生成一张表现故事最终时刻的场景图片。

雨夜的老城区咖啡馆内，林晚坐在临街玻璃窗边，抬头看向刚刚在她对面坐下的人。她的一只手仍搭在温热的咖啡杯边，身体稍微向旁边挪动，为对方让出靠窗的位置。

林晚是年轻女性，黑色长发，深棕色眼睛，身形纤细，穿米白色针织衫和深色长裙，神情安静而关切。

桌边靠着一把湿透的雨伞，对面人物的外套被雨水打湿。咖啡馆内是木质桌椅和暖黄色吊灯，窗外霓虹灯透过雨水覆盖的玻璃形成模糊光斑。

中景双人构图，主要焦点放在林晚的面部、手部和两人之间的距离，轻微侧面视角，浅景深，电影感写实风格，细腻自然光影，温暖室内灯光与冷色雨夜形成对比。

表现当前最终场景，不表现之前已经结束的动作。不要出现字幕、文字、聊天框、气泡、水印、界面或额外主要人物。
```

API 参数：

```json
{
  "count": 2,
  "aspectRatio": "16:9"
}
```

---

## 10. 数据库设计

请先检查现有 Prisma Schema、模型命名和关联风格，再做最小侵入改造。

### 10.1 ProviderModel

增加能力字段：

```prisma
capability String @default("chat")
```

必要索引：

```prisma
@@index([providerId, capability])
```

### 10.2 模型链

对现有模型链 / fallback group 增加：

```prisma
capability String @default("chat")
```

服务层必须校验：

- `chat` 链只允许 `chat` 模型；
- `image` 链只允许 `image` 模型；
- 修改模型能力时不能造成现有链非法；
- 修改模型链能力时，不能使现有 `Conversation.modelFallbackGroupId`、`Companion.modelFallbackGroupId`、`CompanionMemory.modelFallbackGroupId` 或 `Conversation.imageModelFallbackGroupId` 引用失配；已被不同业务能力引用的链应拒绝改能力，不能静默迁移；
- 现有默认 chat 链机制保持不变；`capability='image'` 的模型链不使用 `isDefault`，创建/更新 image 链时必须保持 `isDefault=false`，前端也不显示 image 默认链选项；
- `ModelsService.getGatewayCandidates()` 的 `capability` 参数改为必填，不允许用可选参数保留无能力校验的旧路径；
- Tavern Chat、Prompt Preview、Companion Chat、Companion Memory、AI Imports 等所有既有文本调用必须显式传 `capability: 'chat'`；
- 生图和场景转生图描述调用分别显式传 `capability: 'image'`、`capability: 'chat'`；
- 禁止在运行时静默跳过不匹配模型。

### 10.3 Conversation

建议增加：

```prisma
imageModelFallbackGroupId String?
imageGenerationConfigJson String?
```

不要把所有生图字段拆成大量列。

第一版不设置全站默认 image 模型链。会话生图模型链只读取：

```text
Conversation.imageModelFallbackGroupId
```

该字段为空、链已停用、已删除、无启用候选或 capability 不是 `image` 时，按 §17 错误码返回 `IMAGE_MODEL_NOT_CONFIGURED`。不要回退默认 image 链、chat 链或其他模型链；仅允许在当前会话明确选择的 image 链内部按候选顺序回退。

JSON 示例：

```json
{
  "stylePreset": "auto",
  "imageCount": 1,
  "aspectRatio": "1:1"
}
```

服务端必须有统一解析、默认值、枚举校验和范围校验，不允许各处直接 `JSON.parse` 后裸用。

### 10.4 ImageGenerationBatch

一次点击生成或一次重新生成对应一个批次。

建议字段：

```prisma
model ImageGenerationBatch {
  id                       String   @id @default(cuid())
  userId                   String
  conversationId           String?
  sourceMessageId          String?
  requestId                String
  requestHash              String

  modelFallbackGroupId     String
  providerModelId          String?
  scenePromptModelId       String?

  status                   String   @default("pending")
  stylePreset              String
  requestedImageCount      Int
  aspectRatio              String

  prompt                    String?
  promptHash                String?
  positivePromptBody        String?
  negativePrompt            String?
  sceneSnapshotJson         String?
  sceneSnapshotHash         String?
  parametersJson            String?
  providerMetadataJson      String?
  sourceMessageContentHash  String
  adminSafeSourceSummary    String?
  scenePromptVersion        String
  scenePromptInputHash      String?
  scenePromptOutputHash     String?
  promptCompilerVersion     String

  errorCode                 String?
  errorMessage              String?
  cancelRequestedAt         DateTime?

  parentBatchId             String?

  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  @@unique([userId, requestId])
  @@index([userId, createdAt])
  @@index([conversationId, sourceMessageId])
  @@index([status, createdAt])
}
```

批次先于场景证据收集、文字模型和生图调用创建，因此 `scenePromptInputHash`、`positivePromptBody`、`negativePrompt`、`prompt`、`promptHash`、`sceneSnapshotJson`、`sceneSnapshotHash`、`scenePromptOutputHash` 必须允许在 `pending/building_prompt` 阶段为空，并在证据收集、场景描述生成或 Prompt 编译成功后原子写入。`adminSafeSourceSummary` 只能保存经过确定性脱敏和长度限制的摘要，不得保存可还原的完整消息副本。

幂等规则：

- `requestId` 的作用域是当前用户，不使用全表单列唯一；
- 创建批次前根据消息 ID、会话配置、源消息内容 Hash 和请求目的生成 `requestHash`；
- 相同用户、相同 `requestId`、相同 `requestHash` 的重试直接返回原批次；
- 相同用户、相同 `requestId`、不同 `requestHash` 返回稳定的幂等冲突错误，不复用旧结果。

状态建议：

```text
pending
building_prompt
generating
saving
cancel_requested
succeeded
partially_succeeded
failed
cancelled
```

### 10.5 ImageGenerationLease

同一消息同一时间只能有一个运行批次，必须通过数据库租约保证，不能只在创建前查询，也不能只依赖进程内 `Map`。

建议模型：

```prisma
model ImageGenerationLease {
  sourceMessageId String   @id
  batchId         String   @unique
  leaseId         String   @unique
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([expiresAt])
}
```

执行规则：

- 在短事务中创建 `ImageGenerationBatch` 并抢占以 `sourceMessageId` 唯一的租约；租约冲突返回 `IMAGE_GENERATION_ALREADY_RUNNING`，批次创建随事务回滚；
- Provider 调用和文件下载不放在数据库事务中；
- 执行期间按阶段续租，终态在短事务中释放租约；
- 只有持有匹配 `leaseId` 的任务才能更新批次终态和创建图片关联；
- 租约过期后通过 compare-and-swap 方式接管或清理，不能无条件覆盖仍有效的租约；
- 服务启动时扫描过期租约和非终态批次：第一版不自动重跑 Provider 请求，统一收口为 `failed`、记录 `IMAGE_GENERATION_INTERRUPTED` 并释放租约；
- 进程内 `Map<batchId, AbortController>` 只用于本实例取消上游请求，不承担并发正确性。

### 10.6 ImageAsset

每一张成功图片单独保存。

如果现有 `Asset` 表可以承载文件信息，`ImageAsset` 应通过 `assetId` 关联现有 Asset，而不是重复存储底层路径字段。

建议字段：

```prisma
model ImageAsset {
  id          String   @id @default(cuid())
  userId      String
  batchId     String
  assetId     String

  status      String   @default("active")
  sourceType  String   @default("chat_scene_generation")

  width       Int?
  height      Int?
  orderIndex  Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([batchId, orderIndex])
}
```

字段去重说明：`Asset` 表已有 `mimeType` / `sizeBytes` / `metadataJson`，无 `width` / `height`。`ImageAsset` 不要重复存储 `mimeType` / `fileSize`，共用部分经 `assetId` 读 `Asset`；图片专属的 `width` / `height` / `orderIndex` / `batchId` / `sourceType` 存 `ImageAsset`。尺寸只存一处，避免与 `Asset.metadataJson` 重复。

图片资产状态：

```text
active
archived
deleted
```

不要因为消息编辑而把图片资产标记为删除。

### 10.7 MessageImageLink

用于控制聊天窗口当前是否展示某张图片。

```prisma
model MessageImageLink {
  id            String   @id @default(cuid())
  messageId     String
  imageAssetId  String
  status        String   @default("active")
  reason        String   @default("generated")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([messageId, imageAssetId])
  @@index([messageId, status])
}
```

状态：

```text
active
hidden
detached
```

原因：

```text
generated
request_user_edited
message_deleted
request_user_deleted
message_regenerated
manual_hidden
new_image_generation
```

### 10.8 数据删除原则

- 删除 assistant 消息：其图片关联变为 `detached`（reason=`message_deleted`）；
- 删除 user 消息：同一 Turn 当前 active assistant 的图片关联变为 `detached`（reason=`request_user_deleted`）；
- 编辑 user 消息：同一 Turn 当前 active assistant 的图片关联在事务内变为 `hidden`（reason=`request_user_edited`）；
- 重新生成回复：走新建行 + 旧行 `replaced` 过滤，旧 link 自然失效，无需主动改状态（见 §14.2）；
- 重新生成图片：原图保留，新批次创建新图，旧 active link 变 `hidden`；
- 图片库主动删除：先做软删除，实际文件清理由统一资产清理流程负责；
- 禁止级联删除消息时直接删除图片实体和物理文件。

### 10.9 资产清理流程（需新建）

仓库当前没有孤儿文件 GC，只有备份恢复时按用户 `asset.deleteMany`。第一版必须新建一个资产清理流程，负责回收软删图片的物理文件：

- 软删 `ImageAsset` / `Asset`（`status=deleted` 或 `deletedAt` 非空）后，物理文件不立即删除；
- 由独立清理流程（低优先级定时任务或启动时扫描）回收已软删超过阈值的文件；
- 清理前确认无其他引用（如该 `Asset` 仍被头像等引用则跳过）；
- 若第一版不实现定时任务，必须标记为 TODO 并在交付说明中列出，不得让软删文件无限留存却假装已清理。

### 10.10 备份恢复边界

第一版明确不把聊天场景生图数据纳入应用级 JSON 备份恢复：

- 不扩展 `BackupsService` 的导出、导入和恢复结构；
- `ImageGenerationBatch`、`ImageGenerationLease`、`ImageAsset`、`MessageImageLink` 不进入应用备份包；
- `uploads/generated-images/` 的物理文件不属于应用级备份恢复承诺；
- 从应用备份恢复后，不保证恢复历史图片、生成批次、Prompt、SceneSnapshot 或消息图片展示关联；
- 该边界必须在设置页备份说明、部署文档和最终交付说明中明确，不能让用户误以为聊天数据备份包含生图资产；
- 服务器运维人员自行进行的 SQLite 文件与 uploads 目录全量快照属于部署级运维能力，不在本功能实现和验收范围内。

---

## 11. Model Gateway 改造

不要把生图强行塞入现有 `chat()` 或 `streamChat()` 返回类型。

增加独立类型：

```ts
interface ImageGenerationOptions {
  aspectRatio?: ImageAspectRatio;
  width?: number;
  height?: number;
  imageCount?: number;
  quality?: string;
  style?: string;
  seed?: number;
  negativePrompt?: string;
  providerOptions?: Record<string, unknown>;
}

interface ImageGenerationInput {
  model: string;
  prompt: string;
  negativePrompt?: string;
  options?: ImageGenerationOptions;
  signal?: AbortSignal;
}

interface GeneratedImageOutput {
  data?: Buffer;
  remoteUrl?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  revisedPrompt?: string;
  providerMetadata?: Record<string, unknown>;
}

interface ImageGenerationResult {
  images: GeneratedImageOutput[];
  usage?: Record<string, unknown>;
}
```

Provider Adapter 增加：

```ts
generateImage(
  input: ImageGenerationInput
): Promise<ImageGenerationResult>;
```

必须统一兼容：

- base64；
- Buffer；
- 远程临时 URL。

业务层不能感知 Provider 的具体返回形式。

模型链回退规则：

- 只在 `capability=image` 的模型链中执行；
- `getGatewayCandidates()` 需新增必填的 `capability` 参数（依赖 `ProviderModel` / `ModelFallbackGroup` 增加 `capability` 字段），不能只按 `isEnabled/deletedAt` 过滤；
- 所有既有文本调用点必须同步传 `capability: 'chat'`，生图调用传 `capability: 'image'`，不得保留未声明能力的兼容重载；
- **不复用聊天回退策略 `shouldTryNextModelCandidate`**（其失败判定基于 `emittedDelta` / `accumulatedContent` 等聊天 delta 语义）；image 链回退独立实现，失败判定基于“该候选是否返回 0 张有效图片”；
- Provider 不支持某参数时，Adapter 负责映射或忽略；
- 不允许把聊天参数 `temperature/topP/maxTokens` 发送给生图接口；`ImageGenerationInput` 必须独立定义，不复用 `ModelGatewayProviderOptions`；
- 每个模型可以通过 `defaultParamsJson` 或能力元数据保存 Provider 特有参数；
- imageCount 是否一次请求多图或循环多次，由 Adapter / Gateway 能力决定；
- 即使多次请求，每张成功图片都要独立保存；
- 部分成功时批次状态为 `partially_succeeded`。

### 11.1 第一版无真实 image Provider，先做接口与 Mock

仓库当前唯一适配器是 `OpenAICompatibleProvider`（仅打 `/chat/completions`），无任何 image 适配器。第一版按 §24.16 要求：

- 先实现 `ModelProviderAdapter.generateImage` 接口与 `ImageGenerationInput` / `ImageGenerationResult` 类型；
- 实现 Mock/Fake Adapter（返回本地占位图或固定 Buffer），保证业务链路可端到端跑通；
- 实现至少一个目标 Provider 的可替换实现（接口到位即可，不强制第一版接通真实供应商）；
- 禁止在业务层写死供应商；
- 验收报告必须明确说明：第一版真实生图链路是否已端到端验证，还是仅 Mock 验证。

### 11.2 第一版不开发 image 模型测试能力

现有模型“测试连接”走 chat `testConnection()`，不能用于 image 模型。第一版明确：

- chat 模型继续使用现有测试能力；
- image 模型不实现 `testImageConnection()`，不通过生成测试图探测连接；
- 模型管理页面对 `capability='image'` 隐藏测试按钮，或显示禁用状态“第一版暂不支持生图模型测试”；
- 后端现有模型测试入口收到 image 模型 ID 时，返回稳定错误 `IMAGE_MODEL_TEST_NOT_SUPPORTED`，不得误调用 `/chat/completions`；
- image 模型是否可用只在用户实际发起生图时由 `generateImage()` 结果确认，失败进入正常批次错误与模型链回退流程；
- 后续若增加测试能力，应单独设计成本提示、最小测试请求和 Provider 能力差异，不属于第一版范围。

---

## 12. 图片文件保存

所有成功图片必须进入现有 Assets 模块统一管理。

不要：

- 长期保存 Provider 临时 URL；
- 把 base64 放进 SQLite；
- 由前端直接下载 Provider URL 并长期展示。

服务器端流程：

```text
获取 Provider 图片结果
↓
下载或解码
↓
限制文件大小
↓
校验 MIME
↓
校验真实图片格式
↓
读取尺寸
↓
必要时转为统一格式
↓
保存到 Asset
↓
创建 ImageAsset
```

建议路径：

仓库现有 Asset 存储为扁平结构 `uploads/avatars/characters/{uuid}.{ext}`（常量 `CHARACTER_AVATAR_UPLOAD_PATH`），不存在 `{userId}/{year}/{month}` 分区。生图资产应遵循现有约定，新增独立常量（如 `GENERATED_IMAGE_UPLOAD_PATH = 'generated-images'`），落盘为 `uploads/generated-images/{uuid}.{ext}`，不要重复造分区目录轮子。

```text
uploads/generated-images/{uuid}.{ext}
```

如果现有 Asset 存储策略已有目录规范，遵循现有策略，不要重复造轮子。

### 12.1 生图资产必须走受控鉴权接口，不走公开静态路径

仓库现有 `app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads/' })` 把整个 `uploads/` 当公开静态文件服务，无任何按用户/管理员鉴权，仅靠 UUID 混淆。生图资产**不能**沿用该公开通道，否则任何拿到/猜到 URL 的人都能查看他人图片，违反 §19 权限要求。

要求：

- 生图 `Asset` 落盘时**不生成公开 `publicPath`**（或将其设为 `null`），只保留 `storagePath`；
- 新增受控读取接口，如 `GET /api/images/:id/file`（及缩略图），在 `images` 服务层校验 `imageAsset.userId === currentUser.id || isAdmin` 后再流式返回文件；
- 现有头像等公开静态资源不受影响，仅生图资产走受控通道；
- 前端图片展示统一经 `images` 接口获取，不直接拼 `/uploads/` 路径。

### 12.2 文件校验需读取真实格式与尺寸

仓库现有 multer 仅信任 `file.mimetype`，不读真实图片格式、不读尺寸、无格式转换。生图落盘前需补强：

- 用 `sharp`（或等价库）读取真实图片格式与宽高，不信任生成接口返回的 `mimetype`；
- 校验真实 MIME 与声明的图片类型一致；
- 校验文件大小上限；
- 第一版可不强制转 WebP，仅做格式校验与尺寸读取；如需统一格式再引入转换。

引入 `sharp` 属新增依赖，需在交付说明中说明必要性（生图场景需真实格式校验与尺寸读取）。

---

## 13. 后端模块与接口

建议新增：

```text
apps/server/src/modules/image-generations/
  dto/
  image-generations.controller.ts
  image-generations.service.ts
  image-generations.module.ts
  image-generations.types.ts

apps/server/src/modules/images/
  dto/
  images.controller.ts
  images.service.ts
  images.module.ts
  admin-images.controller.ts
```

### 13.1 更新会话生图配置

优先沿用现有会话更新接口。如果现有接口不适合，增加：

```http
PATCH /api/conversations/:id/image-generation-config
```

请求：

```json
{
  "imageModelFallbackGroupId": "image-chain-id",
  "config": {
    "stylePreset": "cinematic",
    "imageCount": 2,
    "aspectRatio": "16:9"
  }
}
```

校验：

- 会话属于当前用户；
- 模型链存在；
- 模型链能力为 `image`；
- 模型链已启用；
- 风格值合法；
- 张数为 1 到 4；
- 比例合法。

### 13.2 手动生成当前场景

```http
POST /api/messages/:messageId/image-generations
```

请求：

```json
{
  "requestId": "client-generated-id"
}
```

第一版生成参数全部从会话配置读取，避免前端每次请求重复传参。

服务端步骤：

1. 校验消息属于当前用户的会话；
2. 校验消息为 `assistant`；
3. 校验消息状态为已完成；
4. 校验 `Conversation.imageModelFallbackGroupId` 指向可用的 image 模型链；不允许回退默认 image 链或其他模型链；
5. 校验 `Conversation.modelFallbackGroupId` 指向可用的 chat 模型链；不允许回退默认 chat 链；
6. 计算 `requestHash`，在短事务内处理 requestId 幂等、创建批次并抢占消息级数据库租约；
7. 返回 `202 Accepted` 和批次 ID，并在当前单实例进程启动受控后台执行任务；
8. 读取 generation trace 和场景证据；
9. 通过目标会话 chat 模型链执行一次非流式调用，生成并校验 `ScenePromptModelOutput`；只在链内候选间回退，全部失败则结束批次并报错；
10. 服务端根据 generation trace、原始证据、Hash、revision 和会话配置合并出可信 `ScenePromptResult`；
11. 编译 Prompt；
12. 调用 image 模型链；
13. 保存所有成功图片；
14. 创建展示关联；
15. 更新批次终态并释放租约。

第一版不引入 Redis、队列或独立 Worker。后台任务必须被服务级任务注册表持有并统一捕获异常，禁止裸 `void promise` 造成未处理拒绝。数据库批次状态是前端恢复和诊断的事实源，进程内任务表只用于当前实例运行与取消。

### 13.3 重新生成图片

```http
POST /api/image-generation-batches/:batchId/regenerate
```

或：

```http
POST /api/messages/:messageId/image-generations/regenerate
```

建议按批次重新生成，因为一条消息可能有多个历史批次。

默认行为：

- 复用原批次保存的 `ScenePromptResult`（SceneSnapshot、positivePromptBody、negativePrompt）；
- 读取当前会话最新的风格、张数和比例；
- 重新编译 Prompt；
- 创建新批次；
- `parentBatchId` 指向原批次；
- 原图片按 §2.7 默认长期保留，不因重新生成自动删除；
- 原消息下旧的 active link 变为 hidden；
- 新图片创建 active link。

重新生成图片针对当前 active 消息新开 batch，不复活已被 `replaced` 的旧消息旧 batch。如果源消息内容哈希已变化（例如该消息被编辑过），则禁止直接按旧消息重新挂载，或者明确只允许从图片库生成不挂载版本。第一版更简单的策略：消息内容变化后聊天窗口不再显示重新生成按钮，只能在图片详情中保留历史记录。

### 13.4 查询和取消生成批次

```http
GET /api/image-generation-batches/:batchId
GET /api/conversations/:id/image-generation-batches?status=running
POST /api/image-generation-batches/:batchId/cancel
```

查询接口：

- 普通用户只能查询自己的批次，管理员接口不复用该 DTO；
- 返回批次状态、阶段、成功图片、脱敏错误、创建/更新时间和是否可取消；
- 前端创建批次后轮询单批次接口；
- 进入或刷新会话时，通过会话运行批次接口恢复该会话全部非终态任务，不依赖仅存在内存或 localStorage 的批次 ID；
- 即使批次零图片失败，也能通过该接口查看失败原因。

取消接口：

- 仅 `pending`、`building_prompt`、`generating`、`saving` 可请求取消；
- 持久化 `cancelRequestedAt` 并把状态推进为 `cancel_requested`；
- 当前实例存在 `AbortController` 时立即中止文本模型、图片 Provider 或远程下载；
- 执行任务在每个阶段边界检查取消标记；没有成功图片时最终落为 `cancelled`，已有成功图片时落为 `partially_succeeded` 并在元数据中记录取消，随后释放租约；
- 已进入终态时按幂等语义返回当前批次，不重复修改；
- 取消不删除已经成功落盘的图片；存在成功图片时保留并按实际结果记录。

服务重启后，前端仍可查询批次。启动恢复流程将过期租约对应的非终态批次收口为 `failed`，错误码为 `IMAGE_GENERATION_INTERRUPTED`；第一版不自动重复产生可能收费的 Provider 请求。

### 13.5 会话消息图片批量查询

进入会话或加载历史时，前端需要知道哪些 assistant 消息下当前有展示中的图片。不要为每条消息单独请求，也不要在 `MessageResponse` 里塞图片字段。

```http
GET /api/conversations/:id/message-images
```

返回该会话内所有**当前 `status='active'` 的 `MessageImageLink`** 关联的图片，按消息分组：

```ts
type ConversationMessageImagesResponse = Array<{
  messageId: string;
  images: Array<{
    imageAssetId: string;
    orderIndex: number;
    fileUrl: string;   // 经 §12.1 受控接口（/api/images/:id/file）拼接，非 /uploads/ 公开路径
    width?: number;
    height?: number;
  }>;
}>;
```

校验：会话属于当前用户。被 `replaced` 的旧消息行天然不在列表查询范围内（见 §14.2），其旧 link 不返回；编辑后置 `hidden` 的 link 也不返回。前端拿到结果后填入 §15.3.1 的 `Map<messageId, SceneImage[]>` 槽位。

### 13.6 用户图片列表

```http
GET /api/images
```

支持分页与筛选：

- 创建时间；
- 模型；
- 风格预设；
- 状态。

只返回当前用户图片。

### 13.7 图片详情

```http
GET /api/images/:id
```

普通用户只能读取自己的图片。

返回：

- 图片 URL；
- 基础文件信息；
- 所属批次；
- Prompt；
- negative prompt；
- 风格；
- 比例；
- 模型链；
- 实际模型；
- Provider 参数；
- 场景快照；
- 来源会话 ID；
- 来源消息 ID；
- 来源消息摘要；
- 是否仍在聊天消息下展示；
- 是否因为消息编辑而失效。

不要返回其他用户完整聊天内容。

### 13.8 管理员图片列表和详情

```http
GET /api/admin/images
GET /api/admin/images/:id
```

管理员可以查看：

- 所有用户图片；
- 用户信息；
- 生成时间；
- 模型链与实际模型；
- Provider 和安全参数；
- Prompt Hash、Prompt 长度和 Compiler 版本；
- SceneSnapshot Hash、场景转生图 Prompt 版本和实际文字模型；
- 脱敏后的来源摘要；
- 批次状态、错误码和脱敏错误信息。

管理员接口必须使用独立的脱敏响应 DTO，不得复用普通用户查看自己图片时的完整详情 DTO。第一版不向管理员返回其他用户的完整 Prompt、negative prompt、`sceneSnapshotJson`、assistant/user 原文、Persona 原文、世界书正文或最近消息摘录，也不要提供跳转完整会话能力。

---

## 14. 聊天消息编辑与重新生成联动

本节按仓库真实消息生命周期实现，不要按本文档早期假设的“原地更新或新建消息”二选一臆测。已核查的真实行为：

- **编辑**：`MessagesService.update` 原地更新同一 `Message` 行（`messageId` 不变），内容变更时状态置 `edited`；仅 `role==='user'` 可编辑内容。
- **重新生成 assistant**：`GenerationLifecycleService.completeConversation` 在事务内新建一个新 `Message` 行（新 UUID，`status:'complete'`），把旧 assistant 行置 `status:'replaced'`（不删除），并切换 `ConversationTurn.activeAssistantMessageId` 指向新行；列表查询默认 `status: { not: 'replaced' }` 过滤旧行。不存在 `replacedById` 指针。
- **删除**：软删除，`status='deleted'` + `deletedAt`，无级联。

在这些逻辑的事务中补充展示关联处理。

### 14.1 user 消息编辑（原地更新同一 messageId）

仓库只允许编辑 `role='user'` 的消息，而图片关联挂在该 Turn 的 assistant 消息上。因此不能使用被编辑 user messageId 直接查询 `MessageImageLink`，必须先找到对应 Turn 的当前 assistant：

```text
更新 user 消息内容（messageId 不变）
↓
查询 ConversationTurn where userMessageId = 被编辑消息 ID
↓
取得 activeAssistantMessageId
↓
更新 MessageImageLink
where messageId = activeAssistantMessageId and status = active
为 hidden / reason = request_user_edited
```

必须包进事务：`MessagesService.update` 当前为单语句无事务，需包裹一层 `prisma.$transaction`，在其中更新 user 消息并隐藏对应 active assistant 的图片关联，保证原子。事务提交后再执行现有 replay 和目标事件通知。

第一版只联动同一 Turn 的当前 active assistant，不追溯把该 user 消息作为远期 recent context 的其他历史图片。不要删除 `ImageAsset` 和 `ImageGenerationBatch`。

### 14.2 assistant 重新生成（新建行 + replaced 过滤）

重新生成的真实语义是“新建 assistant 行 + 旧行 `replaced` + turn 切换”，不是“更新原消息”。因此：

- 旧 assistant 行原样保留（`status='replaced'`），被列表查询过滤，**聊天窗口天然不再展示旧图**。
- 以 `messageId` 关联的旧 `MessageImageLink` 自然留在旧行上，**无需主动改为 hidden**——旧行已被过滤，旧 link 不会出现在新消息下。
- 新 assistant 行默认无图片，需用户重新点击“生成当前场景”。
- 不复制旧图到新消息，不迁移旧 link。

如果希望在旧消息被 `replaced` 时顺带把旧 link 标记为 `detached`（reason=`message_regenerated`）以便图片库区分，可注入 `completeConversation` 的交互式事务 `tx` 内执行，但这不是必须的——核心展示效果已由 `replaced` 过滤保证。

注意：不要假设“更新原 assistant 消息”路径，仓库不存在该路径；不要尝试把旧 link 迁移到新 `messageId`。

### 14.3 消息删除（软删除）

删除 assistant 消息：

```text
该 assistant 的 MessageImageLink
→ detached / reason = message_deleted
```

删除 user 消息：

```text
ConversationTurn.userMessageId = 被删除消息 ID
→ 找到 activeAssistantMessageId
→ 对应 MessageImageLink
→ detached / reason = request_user_deleted
```

`MessagesService.remove` 当前为单语句，需包裹事务，根据消息角色原子更新消息和对应 link。图片资产保留。

会话级删除/清空（`ConversationsService.remove` / `clear`）通过 `updateMany` 批量软删消息；对应消息的 link 也应批量置 `detached`，图片资产保留。

---

## 15. 前端改造

### 15.1 模型管理

仍使用现有模型管理页面。

增加：

- 模型能力选择：聊天 / 生图；
- 模型列表能力筛选；
- 模型链能力选择；
- 模型链成员只显示匹配能力的模型；
- 非法组合前后端都拦截。
- chat 模型保留现有“测试”按钮；
- image 模型不显示可执行的测试按钮，明确提示“第一版暂不支持生图模型测试”。

可使用 Tab：

```text
模型管理：[聊天模型] [生图模型]
模型链：[聊天模型链] [生图模型链]
```

但不要复制两套业务代码。

### 15.2 会话设置

在现有会话设置中增加“场景生图”区域：

```text
场景生图

生图模型链：[下拉，只显示 image 模型链]
风格预设：[自动 / 动漫 / 写实 / 电影感 / 插画 / 奇幻]
生成张数：[1 / 2 / 3 / 4]
画面比例：[1:1 / 3:4 / 4:3 / 9:16 / 16:9]
```

如果没有选择生图模型链：

- 消息下可以隐藏“生成当前场景”；
- 或显示禁用按钮并提示“请先在会话设置中选择生图模型链”。

推荐显示禁用按钮和明确提示。

如果 `Conversation.modelFallbackGroupId` 没有配置可用的 chat 模型链：

- 不允许为了场景转生图描述回退到默认 chat 链；
- “生成当前场景”按钮保持禁用；
- 提示“请先在会话设置中选择可用的聊天模型链”。

### 15.3 聊天消息区域

只在以下消息展示生图入口：

- `role = assistant`；
- 消息已完成；
- 消息未删除；
- 当前会话已配置可用的 chat 模型链；
- 当前会话已配置 image 模型链。

状态：

```text
未生成：生成当前场景
生成中：正在生成图片，可取消或禁用重复点击
成功：图片网格 + 重新生成图片
失败：失败原因 + 重试
```

生成张数大于 1 时，使用响应式网格展示。

不要将图片插入普通消息数组，不要创建伪消息。

建议组件：

```text
apps/web/src/components/chat/
  MessageImageSection.vue
  MessageImageGrid.vue
  MessageImageCard.vue
  MessageImageGenerating.vue
  MessageImagePreview.vue
```

新增 API / composable：

```text
apps/web/src/api/image-generations.ts
apps/web/src/api/images.ts
apps/web/src/composables/useImageGeneration.ts
```

文本聊天流和图片生成状态必须独立。

### 15.3.1 前端 store 改造点（必须）

仓库现有 `useChatStore` 是纯文本三槽位：`messages[]` + `pendingUserMessage` + `streamingMessage`，没有图片字段，`MessageResponse.metadata` 是唯一扩展点且已被滥用为 `{local}` / `{aborted}` / `{error}`。`isGenerating = sending || isStreaming || stopping` 是单一任务槽，且 gate 了编辑/删除/重新生成。直接接入会导致两个问题，必须改造：

- **新增图片并行存储**：不要把图片塞进 `messages[]`，也不要造伪消息。新增 `Map<messageId, SceneImage[]>`（或等价结构）作为兄弟槽位，随会话加载/恢复展示关联；图片状态独立于 `messages`。
- **拆分流式 gate**：新增 `imageGeneratingMessageIds: string[]`（或 Map），生图进度只 gate 生图按钮，不复用 `isGenerating`。否则生图期间会误锁该消息的编辑/删除/重新生成按钮，违反“状态独立”要求。

`MessageResponse` 不要新增图片字段；图片经独立接口（§13.5 会话消息图片批量查询）按 `messageId` 拉取后填入新槽位。

### 15.3.2 图片网格与预览组件

仓库前端当前无任何图片网格 / lightbox 组件，仅 `AvatarUploader.vue`（单头像）。项目已用 Naive UI，可直接用 `n-image-group` + `n-image` 的内置预览能力，降低新建工作量：

```text
apps/web/src/components/chat/
  MessageImageSection.vue        # 容器：按钮 + 网格 + 生成状态
  MessageImageGrid.vue           # 多图网格（n-image-group 预览）
  MessageImageGenerating.vue     # 生成中占位
```

`MessageImageCard.vue` / `MessageImagePreview.vue` 可由 `n-image` 内置预览替代，不必全部新建。

### 15.4 图片重新生成

图片区域下方显示一个批次级按钮：

```text
重新生成图片
```

一次点击重新生成整批图片，使用当前会话配置中的：

- 风格预设；
- 张数；
- 比例。

不要覆盖旧图片文件和旧批次。

### 15.5 用户图片库

新增“我的图片”模块。

列表卡片至少显示：

- 缩略图；
- 创建时间；
- 风格预设；
- 实际模型；
- 所属批次；
- 是否仍在聊天中展示；
- 来源消息摘要。

第一版不做跳会话。

### 15.6 管理员图片管理

管理员增加“图片管理”。

支持：

- 分页；
- 用户筛选；
- 模型筛选；
- 时间筛选；
- 状态筛选；
- 查看图片详情。

不提供进入他人会话的按钮。

---

## 16. 图片详情页

第一版图片详情分为“用户查看自己的图片”和“管理员查看全站图片”两种投影，不能复用一个会泄露原文的响应结构。

### 16.1 基础信息

- 图片 ID；
- 所属用户；
- 创建时间；
- 文件大小；
- MIME；
- 宽高；
- 图片状态；
- 是否仍在聊天消息下展示。

### 16.2 生成信息

普通用户查看自己的图片时可展示：

- 批次 ID；
- 生图模型链；
- 实际命中模型；
- 场景转生图描述所用文字模型；
- Provider；
- 最终 Prompt；
- 负面提示词；
- 风格预设；
- 张数；
- 比例；
- 供应商参数；
- 供应商返回元数据；
- 场景转生图 Prompt 版本；
- Prompt Compiler 版本。

### 16.3 来源信息

- 来源类型：`chat_scene_generation`；
- `conversationId`；
- `sourceMessageId`；
- 来源消息摘要；
- `sourceMessageContentHash`；
- 是否因为消息变化而失效。

第一版只展示来源标识，不提供会话跳转。

### 16.4 场景快照

普通用户查看自己的图片时，可以结构化或格式化 JSON 展示：

- 目标 assistant 回复；
- 对应用户消息；
- 最近上下文摘要；
- 角色视觉来源；
- Persona 视觉来源；
- 世界书版本 ID；
- 场景、人物、物品、氛围、构图。

### 16.5 管理员脱敏详情

管理员查看其他用户图片时只展示：

- 图片及基础文件信息；
- 用户标识、批次 ID、时间和状态；
- 模型链、实际文字模型、实际生图模型、Provider 和安全参数；
- Prompt Hash、Prompt 长度、SceneSnapshot Hash、场景转生图输入/输出 Hash；
- 场景转生图 Prompt / Prompt Compiler 版本；
- `conversationId`、`sourceMessageId` 和 `sourceMessageContentHash`；
- 自动脱敏并限制长度的来源摘要；
- 错误码、阶段和脱敏错误信息。

管理员不得获取其他用户的完整 Prompt、negative prompt、SceneSnapshot JSON、assistant/user 原文、Persona 原文、世界书正文或最近消息摘录。服务端必须构建独立投影，不能依靠前端隐藏字段。

---

## 17. 并发、幂等和错误处理

必须实现：

- 同一消息同一时间最多一个运行中的生图批次，由 §10.5 数据库租约保证；
- `requestId` 按 `[userId, requestId]` 幂等，并校验 `requestHash`；
- 用户连续点击不会重复创建多个任务；
- 页面刷新后可查询并恢复批次展示状态；
- 服务重启后将过期租约对应的非终态批次明确收口；
- 取消请求持久化，并可中止当前实例中的上游调用；
- 图片张数限制 1 到 4；
- Provider 超时；
- 远程图片下载超时；
- 文件大小限制；
- MIME 校验；
- 部分图片生成成功时保留成功结果；
- 失败原因可在聊天和图片批次详情查看。

建议错误码：

```text
IMAGE_MODEL_NOT_CONFIGURED
IMAGE_MODEL_CHAIN_NOT_FOUND
IMAGE_MODEL_CHAIN_DISABLED
IMAGE_MODEL_CAPABILITY_MISMATCH
IMAGE_MESSAGE_NOT_FOUND
IMAGE_MESSAGE_NOT_ASSISTANT
IMAGE_MESSAGE_NOT_COMPLETE
IMAGE_GENERATION_ALREADY_RUNNING
IMAGE_GENERATION_IDEMPOTENCY_CONFLICT
IMAGE_GENERATION_BATCH_NOT_FOUND
IMAGE_GENERATION_NOT_CANCELLABLE
IMAGE_GENERATION_INTERRUPTED
IMAGE_SCENE_PROMPT_MODEL_NOT_CONFIGURED
IMAGE_SCENE_PROMPT_MODEL_CHAIN_FAILED
IMAGE_SCENE_PROMPT_GENERATION_FAILED
IMAGE_PROMPT_BUILD_FAILED
IMAGE_PROVIDER_TIMEOUT
IMAGE_PROVIDER_REJECTED
IMAGE_PROVIDER_EMPTY_RESULT
IMAGE_DOWNLOAD_FAILED
IMAGE_INVALID_CONTENT
IMAGE_FILE_TOO_LARGE
IMAGE_STORAGE_FAILED
IMAGE_GENERATION_ABORTED
```

禁止只返回模糊的“生成失败”。

---

## 18. 日志与可观察性

对每个批次记录：

- `requestId`；
- userId；
- conversationId；
- sourceMessageId；
- modelFallbackGroupId；
- 场景转生图描述所用文字模型；
- 实际模型；
- 状态变化；
- 各阶段耗时；
- Provider 错误；
- 下载错误；
- 保存错误；
- 成功图片数量；
- 场景转生图 Prompt 版本及输入/输出 Hash；
- Prompt Compiler 版本。

不要在普通日志中完整输出可能敏感的聊天上下文和 Prompt。完整内容保存在权限受控的数据库详情中，日志只记录 ID、长度、Hash 和必要诊断字段。

---

## 19. 安全与权限

### 普通用户

- 只能为自己的会话消息生成图片；
- 只能查看自己的图片；
- 只能查看自己的批次详情；
- 不能通过篡改 `messageId` 或 `imageId` 访问他人资源。

### 管理员

- 可以查看全部图片和图片详情；
- 可以查看模型、参数、Hash、状态、错误和脱敏来源摘要；
- 不得查看其他用户的完整 Prompt、SceneSnapshot、assistant/user 原文、Persona 原文、世界书正文或最近消息摘录；
- 第一版不能从图片进入其他用户完整聊天；
- 第一版不要额外扩大现有管理员聊天读取权限。

所有接口必须在后端校验，不依赖前端隐藏按钮。

---

## 20. 需要重点检查的现有代码

在实施前，先搜索并确认仓库真实实现：

```text
prisma/schema.prisma
packages/shared/src/model.ts
packages/shared/src/message.ts
packages/shared/src/conversation.ts
apps/server/src/modules/models/
apps/server/src/modules/chat/
apps/server/src/modules/conversations/
apps/server/src/modules/assets/
apps/server/src/services/model-gateway/
apps/server/src/services/context-engine/
apps/web/src/views/chat/
apps/web/src/components/
apps/web/src/stores/
apps/web/src/api/
```

重点查清：

1. 当前聊天模型链字段的真实名称；
2. 模型链与 ProviderModel 的关联结构；
3. assistant 消息完成状态字段；
4. 消息编辑是原地更新还是创建新版本；
5. assistant 重新生成是更新原消息还是新增消息；
6. generation trace、prompt snapshot、world book trace 的真实字段；
7. Asset 的存储、URL 和权限读取方式；
8. 管理员权限判断方式；
9. 前端 ChatRoom / ChatView 的消息操作事件；
10. 当前 API 错误结构和 DTO 校验方式。

必须以仓库真实结构为准调整命名，不要为了匹配本文档而破坏现有领域模型。

### 20.1 已核查命名对齐表

落地时以下命名必须按真实 schema 对齐，不要使用本文档早期假设名：

| 本文早期用名 / 假设 | 仓库真实名 / 事实 | 说明 |
|---|---|---|
| 消息完成状态 `completed` | `Message.status = 'complete'` | 状态值为 `complete`，非 `completed`；状态为自由字符串，非 DB 枚举 |
| 消息表 `ConversationMessage` | `Message` | 真实表名 `Message` |
| `MessageStatus` 枚举 | `complete / edited / deleted / generating / failed / stopped / replaced / example` | 含 `replaced`（重新生成旧行）、`edited` |
| `ModelCapability = 'chat' \| 'image'` | 当前不存在，需新增 | `ProviderModel` 与 `ModelFallbackGroup` 均无 `capability`，需迁移新增 |
| 模型链 | `ModelFallbackGroup` + `ModelFallbackCandidate` | 经 `ModelFallbackCandidate` 关联 `ProviderModel` |
| 模型配置归属当前登录用户 | 不成立 | `SharedModelsGuard` 会把模型管理请求切换到 `UsersService.getSharedModelOwner()`，运行时 `getGatewayCandidates()` 也从固定共享模型管理员解析 |
| image 默认模型链 | 第一版不使用 | 现有默认 chat 链保持不变；image 链强制 `isDefault=false`，会话必须显式选择 image 链 |
| `getGatewayCandidates()` capability 可选 | 不允许保留 | 参数改为必填，并更新 Tavern Chat、Prompt Preview、Companion Chat、Companion Memory、AI Imports 等全部现有文本消费者 |
| `Conversation.imageGenerationConfigJson` | 当前不存在，需新增 | 现仅有 `modelFallbackGroupId`（聊天链）与 `metadataJson` |
| `requestUserMessageId` | 真实存在 | `ConversationMessageGenerationTrace.requestUserMessageId` 可直接用 |
| `ConversationIncludedWorldBookTrace` | 真实存在 | 每行一个 `entryRevisionId`（多行），`@@unique([generationTraceId, entryId])`；非 trace 上的数组列 |
| `worldBookRevisionIds: string[]` | 由 trace 多行聚合 | SceneSnapshot 里聚合为数组，落地时从多行 `entryRevisionId` 收集 |
| 世界书版本可复用 | 成立 | `entryRevisionId` 外键 `onDelete: Restrict`，历史版本不丢 |
| 角色 `visualProfile` | 不存在 | 第一版从 `coreIdentity` / `extendedBackground` / `initialScenario` 抽取视觉信息 |
| 重新生成 `replacedById` 指针 | 不存在 | 用 `ConversationTurn.activeAssistantMessageId` + 旧行 `status='replaced'` |
| Prompt Builder 类 | 不存在 | 为函数 `buildTavernPromptSections` + `compilePromptSections`；新增独立的 `SceneImageContextBuilder` / `SceneImagePromptCompiler` 参照但不复用 |
| `Asset` 宽高列 | 不存在 | 无 `width` / `height`；有 `mimeType` / `sizeBytes` / `metadataJson` |
| 资产公开访问 | 当前 `/uploads/` 全公开无鉴权 | 生图资产必须改走受控接口（§12.1） |
| 资产 GC | 不存在 | 需新建（§10.9） |
| 生图数据备份恢复 | 第一版明确不做 | 不扩展 `BackupsService`；设置页、部署文档和最终交付必须声明该边界（§10.10） |

---

## 21. 推荐实施顺序

### 阶段 A：模型能力与会话配置

1. 为 ProviderModel 增加 capability；
2. 为模型链增加 capability；
3. 保持共享模型管理员归属和 `SharedModelsGuard` 机制；
4. 把 `getGatewayCandidates.capability` 改为必填并更新全部既有文本消费者；
5. 保持默认 chat 链现状，禁止 image 链设为默认，并补齐能力与引用校验；
6. Conversation 增加 image 模型链和配置 JSON；
7. 会话设置 UI 增加模型链、风格、张数、比例；
8. image 模型隐藏测试按钮，后端拒绝 image 模型进入 chat `testConnection()`。

### 阶段 B：数据库与图片资产

1. 新增 ImageGenerationBatch；
2. 新增 ImageGenerationLease；
3. 新增 ImageAsset；
4. 新增 MessageImageLink；
5. 接入现有 Asset 存储；
6. 增加 DTO、共享类型和迁移。

### 阶段 C：Prompt Builder

1. 新增 SceneImageContextBuilder；
2. 读取 generation trace；
3. 读取目标消息对应用户消息；
4. 读取最近有效上下文；
5. 收集角色、Persona 和世界书视觉来源；
6. 经目标会话 chat 模型链执行一次非流式场景转生图描述调用，不允许回退默认 chat 链；
7. 校验 `ScenePromptModelOutput`、来源边界和禁止补充规则；
8. 由服务端写入 source/evidence/style 并合并最终 `ScenePromptResult`；
9. 新增固定 Prompt Compiler；
10. 保存场景转生图 Prompt / Compiler 版本、实际文字模型与输入输出 Hash。

### 阶段 D：Model Gateway 生图能力

1. 增加 image 输入输出类型；
2. Provider Adapter 增加 generateImage；
3. 实现至少一个目标 Provider；
4. 实现 image 模型链回退；
5. 统一 base64、Buffer、URL 返回；
6. 接入 Asset 保存。

### 阶段 E：聊天手动生图闭环

1. 增加生成接口；
2. 增加批次查询、轮询恢复和取消接口；
3. 增加数据库租约、requestId 幂等和启动收口；
4. 增加聊天消息按钮；
5. 增加独立生成状态；
6. 展示多张图片；
7. 增加重新生成；
8. 增加错误重试。

### 阶段 F：消息变化联动

1. 编辑 user 消息后通过 ConversationTurn 隐藏 active assistant 的旧关联；
2. 重新生成 assistant 后验证旧消息过滤且旧 link 不迁移；
3. 删除 user/assistant 消息后按角色 detached 对应关联；
4. 验证图片资产仍存在。

### 阶段 G：图片库与管理员管理

1. 用户图片列表；
2. 用户图片详情；
3. 管理员全部图片列表；
4. 管理员脱敏图片详情；
5. 不实现图片跳会话。

---

## 22. 第一版验收标准

### 模型与配置

- 同一 Provider 可以同时配置 chat 和 image 模型；
- chat 模型不能加入 image 链；
- image 模型不能加入 chat 链；
- 模型配置继续归共享模型管理员，不产生用户私有链；
- 所有既有文本消费者只能解析 chat 链；
- image 链不能设为默认，会话必须显式选择 image 链；
- image 模型第一版不提供测试能力，且不会误用 chat `testConnection()`；
- 不同会话可以选择不同 image 模型链；
- 会话可配置风格、张数和比例；
- 配置刷新后仍正确保存。

### 生图

- 只有完成的 assistant 消息可以生图；
- 点击后基于该消息真实生成上下文构建 Prompt；
- 图片使用会话的 image 模型链；
- 生成张数和比例正确；
- 图片不是新的聊天 Message；
- 多图正确保存和展示；
- 部分失败时成功图片仍保留；
- 同一消息并发请求只产生一个运行批次；
- 相同 requestId 和 requestHash 能幂等返回原批次；
- 页面刷新后可恢复批次状态；
- 取消可中止上游任务并释放租约；
- 服务重启后遗留任务被明确收口，不永久停留在生成中。

### 提示词

- 不包含完整聊天系统 Prompt；
- 不包含平台规则和说话规则；
- 当前 assistant 内容覆盖历史冲突；
- 使用对应用户消息而不是错误的上一条消息；
- 使用该回复生成时真实命中的世界书版本；
- 不擅自补充没有来源的人物外貌；
- 目标会话 chat 模型链通过一次调用生成 `ScenePromptModelOutput`；
- 会话未配置可用 chat 模型链时直接提示配置，不回退默认 chat 链；
- 当前 chat 模型链候选全部失败时返回明确错误，不查找其他模型链；
- 服务端使用真实 generation trace、消息、Hash、世界书 revision 和会话配置构建 Snapshot 的 source/evidence/style，不接受模型生成这些可信字段；
- 服务端把通过校验的模型视觉结果与可信来源合并为 `ScenePromptResult`；
- `ScenePromptResult` 包含 SceneSnapshot、positivePromptBody 和可选 negativePrompt；
- SceneSnapshot、文字模型生成的描述主体、最终 Prompt、场景转生图 Prompt / Compiler 版本及相关 Hash 被保存。

### 图片资产

- 每张图片单独保存；
- 一次生成的多张图片属于同一批次；
- 图片可在用户图片库查看；
- 管理员可查看所有图片；
- 对应 user 消息编辑后，其 active assistant 下不再展示旧图；
- user 或 assistant 消息删除后，对应图片关联正确 detached；
- 旧图仍在图片库；
- 重新生成图片不会覆盖旧图；
- 不提供图片跳会话。

### 权限

- 用户不能生成他人会话的图片；
- 用户不能查看他人图片；
- 管理员图片详情不返回其他用户的完整 Prompt、SceneSnapshot 或聊天原文；
- 管理员只能看到图片、模型、参数、Hash、错误和脱敏摘要；
- 所有权限均由后端校验。

---

## 23. 第一版明确不做

除非后续单独提出，不要实现：

- 自动生图；
- AI 判断重要场景；
- 聊天模型输出生图标签；
- 图生图；
- 角色参考图；
- 人脸锁定；
- 连续场景人物一致性；
- 局部重绘；
- 图片编辑；
- 视频生成；
- 图片跳会话；
- 管理员查看其他用户完整聊天；
- 独立配置的生图 Prompt 优化模型链或第二次文字模型调用；
- image 模型连接测试或测试图片生成；
- 聊天场景生图数据的应用级 JSON 备份恢复；
- 大规模重构现有 Context Engine V2；
- 为生图复制一套模型供应商后台。

---

## 24. Codex 执行要求

请按以下规则执行：

1. 先阅读仓库根目录和相关子目录中的 `AGENTS.md`、README 与约束文件；
2. 先分析现状，再修改代码；
3. 输出一份现状分析和拟修改文件清单；
4. 以仓库真实字段和模块命名为准；
5. 优先复用现有 DTO、权限、错误、事件、Asset、Model Gateway 和 Context Engine 结构；
6. 不做与本功能无关的重构；
7. 不保留无用兼容字段；
8. 数据库迁移必须可执行；
9. 前后端共享类型必须同步；
10. 所有 JSON 配置必须有统一 Schema、默认值和校验；
11. 所有新接口必须有用户归属和管理员权限校验；
12. 为关键服务补充测试；
13. 至少覆盖 `ScenePromptModelOutput` 校验、服务端可信 Snapshot 合并、冲突规则、禁止虚构、会话 chat/image 链必选、禁止默认链回退、链内候选全部失败、image 测试接口拒绝、全部文本消费者的模型能力校验、数据库租约、requestId 幂等、取消与启动收口、user 编辑/删除对 active assistant 图片的联动、管理员脱敏投影和权限测试；
14. 完成后运行项目现有 lint、typecheck、test 和 build；
15. 不得因为某个 Provider 暂未实现就跳过整体领域结构；
16. 如果仓库当前没有可用的真实 image Provider，先完成 Adapter 接口、Mock/Fake Adapter 与可替换实现，禁止在业务层写死供应商；
17. 发现本文档与仓库实际结构冲突时，保留本文档的业务目标和数据边界，按现有架构采用等价实现，并在结果中说明差异。

---

## 25. 最终交付内容

完成后输出：

1. 实际修改文件列表；
2. 数据库迁移说明；
3. 新增数据模型和字段；
4. 新增接口列表；
5. 前端页面和组件变化；
6. Prompt Builder 的真实来源和优先级；
7. 已支持的 image Provider；
8. 测试覆盖情况；
9. lint / typecheck / test / build 结果；
10. 未完成项及原因；
11. 手工验收步骤；
12. 与本文档存在的实现差异。
