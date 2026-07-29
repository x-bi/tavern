import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { ImagesService } from './images.service';

@Controller('admin/images')
@UseGuards(AuthGuard)
export class AdminImagesController {
  constructor(@Inject(ImagesService) private readonly service: ImagesService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserType, @Query() query: Record<string, string>) {
    return this.service.adminList(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.adminDetail(user, id);
  }
}
