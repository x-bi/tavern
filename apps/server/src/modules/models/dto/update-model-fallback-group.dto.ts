import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

import { ModelFallbackCandidateDto } from './create-model-fallback-group.dto';

/** 更新模型链入参。candidates 传入时整体替换候选列表。 */
export class UpdateModelFallbackGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(['chat', 'image'])
  capability?: 'chat' | 'image';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ModelFallbackCandidateDto)
  candidates?: ModelFallbackCandidateDto[];
}
