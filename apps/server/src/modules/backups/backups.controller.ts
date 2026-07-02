import { Body, Controller, Get, HttpStatus, Inject, Post, Res, UseGuards } from '@nestjs/common';

import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import type { BackupExportHttpResponse } from './backup.types';
import { BackupsService } from './backups.service';
import { ImportBackupDto } from './dto/import-backup.dto';

@Controller('backups')
@UseGuards(AuthGuard)
export class BackupsController {
  constructor(
    @Inject(BackupsService)
    private readonly backupsService: BackupsService
  ) {}

  @Get('export')
  @SkipResponseWrap()
  async exportApplicationBackup(
    @CurrentUser() currentUser: CurrentUserType,
    @Res() response: BackupExportHttpResponse
  ) {
    const file = await this.backupsService.exportApplicationBackup(currentUser);

    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.setHeader('Content-Length', Buffer.byteLength(file.body, 'utf8'));
    response.status(HttpStatus.OK).send(file.body);
  }

  @Post('import')
  importApplicationBackup(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(ImportBackupDto)) dto: ImportBackupDto
  ) {
    return this.backupsService.importApplicationBackup(currentUser, dto);
  }
}
