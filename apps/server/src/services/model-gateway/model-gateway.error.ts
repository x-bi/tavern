/**
 * 模型网关错误：包装调用外部模型时的失败（网络/超时/响应非法等）。
 *
 * 带 code（业务错误码，对应 ERROR_CODES 里 MODEL_GATEWAY_* 系列）和可选 details，
 * 供上层异常过滤器转成统一失败响应。
 */
export class ModelGatewayError extends Error {
  constructor(
    /** 业务错误码，如 MODEL_GATEWAY_TIMEOUT。 */
    readonly code: string,
    message: string,
    /** 可选补充详情（如原始状态码、响应片段）。 */
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ModelGatewayError';
  }
}
