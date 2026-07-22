import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';

export class SetManualWorldBookActivationDto {
  @IsString() @MaxLength(100) operationId!: string;
  @IsIn(['conversation', 'companion']) targetType!: 'conversation' | 'companion';
  @IsString() @MaxLength(100) targetId!: string;
  @IsBoolean() active!: boolean;
}
