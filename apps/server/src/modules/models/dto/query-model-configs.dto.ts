import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 模型配置列表查询入参（query string）。 */
export class QueryModelConfigsDto {
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

  /** 搜索关键字，匹配 name/provider/model/baseUrl 任一包含。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /**
   * 是否启用过滤。
   * Transform 把 query string 的 'true'/'false' 转成布尔。
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
  isEnabled?: boolean;
}
