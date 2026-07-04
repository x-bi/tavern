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

/** 创建模型配置入参。apiKey 和各参数可选，isDefault/isEnabled 有默认值。 */
export class CreateModelConfigDto {
  /** 配置名，必填，最长 120。 */
  @IsString()
  @MaxLength(120)
  name!: string;

  /** 供应商标识，必填，如 openai，最长 80。 */
  @IsString()
  @MaxLength(80)
  providerName!: string;

  /** 服务地址，必填，http/https URL，最长 500。 */
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
  baseUrl!: string;

  /** 模型名，必填，如 gpt-4，最长 160。 */
  @IsString()
  @MaxLength(160)
  modelName!: string;

  /** API Key，可选；存库前会加密。 */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  apiKey?: string | null;

  /** 采样温度 0~2，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /** top_p 0~1，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  /** 最大 token 数 1~200000，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  /** 请求超时（毫秒）1000~600000，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600000)
  timeout?: number;

  /** 是否设为默认，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** 是否启用，可选，默认 true。 */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
