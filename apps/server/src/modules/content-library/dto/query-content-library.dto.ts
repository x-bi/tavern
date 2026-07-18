import { IsIn, IsOptional } from 'class-validator';

import type { ContentLibraryScope } from '../content-library.types';

export class QueryContentLibraryDto {
  /** owned 查自己；library 查共享主数据；managed 仅管理员只读查看全部用户数据。 */
  @IsOptional()
  @IsIn(['owned', 'library', 'managed'])
  scope?: ContentLibraryScope = 'owned';
}
