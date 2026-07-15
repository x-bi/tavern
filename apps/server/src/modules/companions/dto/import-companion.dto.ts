import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** 独立 AI 角色导入；先预览，commit=true 才写入。 */
export class ImportCompanionDto {
  @IsString()
  @MaxLength(5_000_000)
  rawJson!: string;

  @IsOptional()
  @IsBoolean()
  commit?: boolean;

  @IsOptional()
  @IsIn(['reject', 'rename'])
  duplicateNameStrategy?: 'reject' | 'rename';
}
