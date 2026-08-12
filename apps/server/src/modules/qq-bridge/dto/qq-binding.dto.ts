import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

type QqTargetType = 'conversation' | 'companion';

export class CreateQqBindingDto {
  @IsString()
  @MaxLength(128)
  qqAccountId!: string;

  @IsString()
  @Matches(/^\d{5,20}$/)
  peerQqUin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  peerNickname?: string | null;

  @IsIn(['conversation', 'companion'])
  targetType!: QqTargetType;

  @IsString()
  @MaxLength(128)
  targetId!: string;
}

export class UpdateQqBindingDto {
  @IsIn(['conversation', 'companion'])
  targetType!: QqTargetType;

  @IsString()
  @MaxLength(128)
  targetId!: string;
}
