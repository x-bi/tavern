import { IsIn, IsString, MaxLength } from 'class-validator';

/** 示例对话单条消息 DTO（被 CreateCharacterDto / UpdateCharacterDto 嵌套引用）。 */
export class ExampleMessageDto {
  /** 发言角色，仅允许 user / assistant / system。 */
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system';

  /** 消息内容，最长 10000 字符。 */
  @IsString()
  @MaxLength(10000)
  content!: string;
}
