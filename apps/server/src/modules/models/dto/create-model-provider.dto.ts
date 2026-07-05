import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min
} from 'class-validator';

/** 创建模型供应商入参。供应商保存 Base URL、API Key 和公共超时。 */
export class CreateModelProviderDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  providerName!: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  apiKey?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600000)
  timeout?: number | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
