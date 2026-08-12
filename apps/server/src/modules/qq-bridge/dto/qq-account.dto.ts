import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateQqAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  apiBaseUrl!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  webUiUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  accessToken?: string | null;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateQqAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  apiBaseUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  webUiUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  accessToken?: string | null;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
