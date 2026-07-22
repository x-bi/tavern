import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanionRuntimeStateDto {
  @IsOptional() @IsString() @MaxLength(1000) currentMood?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) currentSituation?: string | null;
}
