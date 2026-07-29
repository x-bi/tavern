import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

/** 模型链候选模型入参。 */
export class ModelFallbackCandidateDto {
  @IsString()
  @MaxLength(128)
  modelId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  priority!: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

/** 创建模型链入参。 */
export class CreateModelFallbackGroupDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(['chat', 'image'])
  capability!: 'chat' | 'image';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ModelFallbackCandidateDto)
  candidates!: ModelFallbackCandidateDto[];
}
