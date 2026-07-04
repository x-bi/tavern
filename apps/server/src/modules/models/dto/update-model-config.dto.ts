import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min
} from 'class-validator';

/**
 * 更新模型配置入参。
 *
 * 全部字段可选 —— 部分更新语义：只有传入的字段才会被更新。
 * apiKey 传 null 表示清除，不传保持原值。
 */
export class UpdateModelConfigDto {
  /** 配置名。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** 供应商标识。 */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerName?: string;

  /** 服务地址，http/https URL。 */
  @IsOptional()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false
    },
    {
      message: 'baseUrl must be a valid http or https URL.'
    }
  )
  @MaxLength(500)
  baseUrl?: string;

  /** 模型名。 */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  modelName?: string;

  /** API Key；传 null 清除，不传保持原值。 */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  apiKey?: string | null;

  /** 采样温度 0~2。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /** top_p 0~1。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  /** 最大 token 数 1~200000。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  /** 请求超时（毫秒）1000~600000。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600000)
  timeout?: number;

  /** 是否设为默认。 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** 是否启用。 */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
