import { IsIn, IsString, MinLength } from 'class-validator';

export class QueryWorldBookRuntimeDto {
  @IsIn(['conversation', 'companion'])
  targetType!: 'conversation' | 'companion';

  @IsString()
  @MinLength(1)
  targetId!: string;
}
