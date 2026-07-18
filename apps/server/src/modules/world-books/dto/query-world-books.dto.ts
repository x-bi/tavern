import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QueryContentLibraryDto } from '../../content-library/dto/query-content-library.dto';

/** 世界书列表查询入参（query string）。 */
export class QueryWorldBooksDto extends QueryContentLibraryDto {
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

  /** 搜索关键字，匹配 name/description 包含。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** 按角色 ID 过滤。 */
  @IsOptional()
  @IsString()
  characterId?: string;

  /** 是否启用过滤；Transform 把 'true'/'false' 转成布尔。 */
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
  isEnabled?: boolean;
}
