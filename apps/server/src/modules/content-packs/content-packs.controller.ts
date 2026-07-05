import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';

import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { ContentPacksService } from './content-packs.service';
import { ImportContentPackDto } from './dto/import-content-pack.dto';

/** 内容包控制器，路由前缀 `/content-packs`，所有接口需登录。 */
@Controller('content-packs')
@UseGuards(AuthGuard)
export class ContentPacksController {
  constructor(
    @Inject(ContentPacksService)
    private readonly contentPacksService: ContentPacksService
  ) {}

  /**
   * 导入内容包。POST /{apiPrefix}/content-packs/import
   * @param currentUser 当前登录用户。
   * @param dto 内容包导入入参，commit=false 时只预览，commit=true 时正式落库。
   * @returns ContentPackImportResponse，包含预览、冲突、告警和正式导入后的 ID 列表。
   */
  @Post('import')
  importContentPack(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(ImportContentPackDto)) dto: ImportContentPackDto
  ) {
    return this.contentPacksService.importContentPack(currentUser, dto);
  }
}
