/** 应用级轻量设置。 */
export type ApplicationSettings = {
  /** 工作台名称。 */
  workspaceName: string;
  /** 是否自动打开上次会话。 */
  autoOpenLastConversation: boolean;
  /** 是否启用紧凑列表模式。 */
  compactListMode: boolean;
  /** 默认历史消息条数上限。 */
  defaultHistoryLimit: number;
  /** 是否显示并允许使用敏感资源。 */
  showSensitiveContent: boolean;
};

/** 设置更新载荷。 */
export type ApplicationSettingsPayload = ApplicationSettings;
