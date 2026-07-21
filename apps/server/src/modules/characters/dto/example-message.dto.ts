import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

/** 示例对话单条消息 DTO（被 CreateCharacterDto / UpdateCharacterDto 嵌套引用）。 */
export class ExampleMessageDto {
  /** 发言角色，仅允许 user / assistant；系统约束应使用角色系统提示词。 */
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  /** 消息内容，最长 10000 字符。 */
  @IsString()
  @Matches(/\S/u, { message: 'content must contain non-whitespace characters' })
  @MaxLength(10000)
  content!: string;
}
