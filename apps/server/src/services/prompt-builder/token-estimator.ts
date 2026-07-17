/** 单条 Chat Completions 消息的保守结构开销。 */
export const PROMPT_MESSAGE_OVERHEAD_TOKENS = 4;

/** 整个 Chat Completions 请求的保守固定开销。 */
const PROMPT_REQUEST_OVERHEAD_TOKENS = 2;

/** 中文、日文和韩文字符；这些字符不能继续套用英文的 4 字符约 1 token 估算。 */
const CJK_CHARACTER_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/g;

/**
 * 轻量估算文本 token：CJK 字符按 1 token，其余字符按 4 字符约 1 token。
 * 这是无 tokenizer 场景下的保守预算函数，不用于供应商计费。
 */
export function estimatePromptTextTokens(content: string): number {
  if (!content) return 0;

  const cjkCount = content.match(CJK_CHARACTER_PATTERN)?.length ?? 0;
  const otherCount = Math.max(0, content.length - cjkCount);

  return cjkCount + Math.ceil(otherCount / 4);
}

/** 估算单条模型消息正文及角色/边界开销。 */
export function estimatePromptMessageTokens(content: string): number {
  return PROMPT_MESSAGE_OVERHEAD_TOKENS + estimatePromptTextTokens(content);
}

/** 估算完整模型 messages 的 token，并计入每条消息及请求级开销。 */
export function estimatePromptMessagesTokens(messages: Array<{ content: string }>): number {
  if (messages.length === 0) return 0;

  return (
    PROMPT_REQUEST_OVERHEAD_TOKENS +
    messages.reduce((total, message) => total + estimatePromptMessageTokens(message.content), 0)
  );
}
