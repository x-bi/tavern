/** 角色对话示例的单条消息。 */
export type ExampleMessage = {
  /** 消息角色。 */
  role: 'user' | 'assistant' | 'system';
  /** 消息正文。 */
  content: string;
};

/**
 * 角色元数据：在通用键值对基础上扩展几个常用字段。
 *
 * 这些字段不进入角色的主表列，统一存入 metadata，便于灵活扩展。
 */
export type CharacterMetadata = Record<string, unknown> & {
  /** 标签列表。 */
  tags?: string[];
  /** 自定义系统 Prompt。 */
  systemPrompt?: string;
  /** 创作者备注。 */
  creatorNotes?: string;
};

/**
 * 角色编辑器表单结构（前端表单专用，与提交后端的 CharacterMutationPayload 不同）。
 *
 * 字段多为字符串文本（如 exampleMessagesText 是多行文本而非结构化数组），
 * 由 CharacterEditor 组件持有，提交时再转换成 CharacterMutationPayload。
 */
export type CharacterEditorForm = {
  /** 头像资源 ID；未上传时为 null。 */
  avatarAssetId: string | null;
  /** 头像访问 URL（预览用）。 */
  avatarUrl: string;
  /** 角色名。 */
  name: string;
  /** 标签文本（逗号分隔，提交时拆成数组）。 */
  tagsText: string;
  /** 角色描述。 */
  description: string;
  /** 性格。 */
  personality: string;
  /** 场景设定。 */
  scenario: string;
  /** 首条消息。 */
  firstMessage: string;
  /** 自定义系统 Prompt。 */
  systemPrompt: string;
  /** 对话示例的多行文本（提交时解析为 ExampleMessage[]）。 */
  exampleMessagesText: string;
  /** 是否标记为敏感内容。 */
  isSensitive: boolean;
};

/**
 * 创建 / 更新角色时提交后端的载荷结构。
 *
 * 与编辑器表单不同：exampleMessages 已解析为结构化数组，metadata 已组装完成。
 */
export type CharacterMutationPayload = {
  /** 头像资源 ID；不更新头像时传 null 或省略。 */
  avatarAssetId?: string | null;
  /** 角色名。 */
  name: string;
  /** 角色描述。 */
  description: string;
  /** 性格。 */
  personality: string;
  /** 场景设定。 */
  scenario: string;
  /** 首条消息。 */
  firstMessage: string;
  /** 对话示例数组。 */
  exampleMessages: ExampleMessage[];
  /** 角色元数据。 */
  metadata: CharacterMetadata;
  /** 是否标记为敏感内容。 */
  isSensitive?: boolean;
};
