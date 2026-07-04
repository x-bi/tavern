/** OpenAI 兼容供应商名（注册用）。 */
export const OPENAI_COMPATIBLE_PROVIDER_NAME = 'openai-compatible';

/** OpenAI 兼容供应商别名（这些名都指向同一适配器）。 */
export const OPENAI_COMPATIBLE_PROVIDER_ALIASES = [
  'openai',
  'deepseek',
  'openrouter',
  'tongyi',
  'qwen',
  'doubao',
  'volcengine',
  'ark',
  'local'
];

/** 默认请求超时（毫秒）。 */
export const OPENAI_COMPATIBLE_DEFAULT_TIMEOUT_MS = 30000;
/** 最大请求超时（毫秒，上限）。 */
export const OPENAI_COMPATIBLE_MAX_TIMEOUT_MS = 60000;
/** 连接测试时请求的 token 数（最小，省 token）。 */
export const OPENAI_COMPATIBLE_TEST_MAX_TOKENS = 1;
