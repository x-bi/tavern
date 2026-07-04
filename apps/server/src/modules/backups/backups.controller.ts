import { Body, Controller, Get, HttpStatus, Inject, Post, Res, UseGuards } from '@nestjs/common';

import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import type { BackupExportHttpResponse } from './backup.types';
import { BackupsService } from './backups.service';
import { ImportBackupDto } from './dto/import-backup.dto';

/**
 * 备份控制器，路由前缀 `/backups`，需登录。
 *
 * export 用 @Res() 直接写下载响应（设 attachment 头），故 @SkipResponseWrap()。
 */
@Controller('backups')
@UseGuards(AuthGuard)
export class BackupsController {
  constructor(
    @Inject(BackupsService)
    private readonly backupsService: BackupsService
  ) {}

  /** 导出应用备份（下载 JSON）。GET /backups/export */
  @Get('export')
  @SkipResponseWrap()
  async exportApplicationBackup(
    @CurrentUser() currentUser: CurrentUserType,
    @Res() response: BackupExportHttpResponse
  ) {
    const file = await this.backupsService.exportApplicationBackup(currentUser);

    // 设置下载响应头（content-type + 附件文件名 + 长度）
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.setHeader('Content-Length', Buffer.byteLength(file.body, 'utf8'));
    response.status(HttpStatus.OK).send(file.body);
  }

  /** 导入应用备份（全量覆盖，需确认）。POST /backups/import */
  @Post('import')
  importApplicationBackup(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(ImportBackupDto)) dto: ImportBackupDto
  ) {
    return this.backupsService.importApplicationBackup(currentUser, dto);
  }
}
