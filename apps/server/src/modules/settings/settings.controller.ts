import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Put, UseGuards } from '@nestjs/common';

import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { UpdateApplicationSettingsDto } from './dto/update-application-settings.dto';
import { SettingsService } from './settings.service';
import type { ApplicationSettings } from './settings.types';

/** 应用设置接口。 */
@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(
    @Inject(SettingsService)
    private readonly settingsService: SettingsService
  ) {}

  /** 读取当前用户应用设置。GET /settings */
  @Get()
  getSettings(@CurrentUser() currentUser: CurrentUserType): Promise<ApplicationSettings> {
    return this.settingsService.getApplicationSettings(currentUser);
  }

  /** 更新当前用户应用设置。PUT /settings */
  @Put()
  @HttpCode(HttpStatus.OK)
  updateSettings(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(UpdateApplicationSettingsDto)) dto: UpdateApplicationSettingsDto
  ): Promise<ApplicationSettings> {
    return this.settingsService.updateApplicationSettings(currentUser, dto);
  }
}
