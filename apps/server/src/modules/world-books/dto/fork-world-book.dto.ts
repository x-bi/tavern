import { IsOptional, IsString } from 'class-validator';

export class ForkWorldBookDto {
  /** 来源世界书绑定角色时，必须指定当前成员自己的目标角色。 */
  @IsOptional()
  @IsString()
  targetCharacterId?: string;
}
