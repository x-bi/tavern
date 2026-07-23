import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QueryContentLibraryDto } from '../../content-library/dto/query-content-library.dto';

/** 角色列表查询入参（query string）。 */
export class QueryCharactersDto extends QueryContentLibraryDto {
  /** 页码，从 1 开始，默认 1。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** 每页条数，1~100，默认 20。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  /** 搜索关键字，匹配 name/coreIdentity/personality/persistentPremise/initialScenario。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /**
   * 是否归档过滤。
   * Transform 把 query string 的 'true'/'false' 转成布尔，非两者原样透传（会被 IsBoolean 拒绝）。
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    return value;
  })
  @IsBoolean()
  isArchived?: boolean;
}
