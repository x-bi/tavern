import { IsIn, IsOptional } from 'class-validator';

import type { ContentLibraryScope } from '../content-library.types';

export class QueryContentLibraryDto {
  /** owned 默认只查自己的数据；library 只查固定管理员公开的主数据。 */
  @IsOptional()
  @IsIn(['owned', 'library'])
  scope?: ContentLibraryScope = 'owned';
}
