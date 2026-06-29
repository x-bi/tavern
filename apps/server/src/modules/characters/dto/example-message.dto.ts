import { IsIn, IsString, MaxLength } from 'class-validator';

export class ExampleMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system';

  @IsString()
  @MaxLength(10000)
  content!: string;
}
