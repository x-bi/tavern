import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportCharacterDto {
  @IsString()
  @MaxLength(1_000_000)
  rawJson!: string;

  @IsOptional()
  @IsBoolean()
  commit?: boolean;

  @IsOptional()
  @IsIn(['reject', 'rename'])
  duplicateNameStrategy?: 'reject' | 'rename';
}
