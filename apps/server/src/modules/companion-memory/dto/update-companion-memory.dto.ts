import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateCompanionMemoryDto {
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsBoolean() isPaused?: boolean;
  @IsOptional() @IsString() @MaxLength(128) memoryModelFallbackGroupId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) updateEveryMessages?: number;
  @IsOptional() @IsString() @MaxLength(600) relationshipState?: string;
  @IsOptional() @IsString() @MaxLength(800) currentArc?: string;
}
