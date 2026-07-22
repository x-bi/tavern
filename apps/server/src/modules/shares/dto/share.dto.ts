import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateShareDto {
  @IsIn(['conversation', 'companion']) targetType!: 'conversation' | 'companion';
  @IsString() targetId!: string;
  @IsIn(['chat', 'readonly']) permission!: 'chat' | 'readonly';
  @IsOptional() @IsISO8601() expiresAt?: string | null;
}

export class UpdateShareDto {
  @IsOptional() @IsIn(['chat', 'readonly']) permission?: 'chat' | 'readonly';
  @IsOptional() @IsISO8601() expiresAt?: string | null;
}

export class QuerySharesDto {
  @IsOptional() @IsIn(['conversation', 'companion']) targetType?: 'conversation' | 'companion';
  @IsOptional() @IsString() targetId?: string;
}

export class BulkRevokeSharesDto {
  @IsIn(['conversation', 'companion']) targetType!: 'conversation' | 'companion';
  @IsString() targetId!: string;
}

export class PublicChatDto {
  @IsString() @MinLength(8) @MaxLength(128) requestId!: string;
  @IsOptional() @IsString() userMessage?: string;
}

export class PublicRegenerateDto {
  @IsString() @MinLength(8) @MaxLength(128) requestId!: string;
  @IsString() @MaxLength(128) turnId!: string;
}
