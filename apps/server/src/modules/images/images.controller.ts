import { Controller, Delete, Get, Inject, Param, Query, Res, UseGuards } from '@nestjs/common';

import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { ImagesService } from './images.service';

type FileResponse = {
  setHeader(name: string, value: string | number): void;
  status(code: number): FileResponse;
  send(body: unknown): void;
};

@Controller()
@UseGuards(AuthGuard)
export class ImagesController {
  constructor(@Inject(ImagesService) private readonly service: ImagesService) {}

  @Get('conversations/:conversationId/message-images')
  messageImages(
    @CurrentUser() user: CurrentUserType,
    @Param('conversationId') conversationId: string
  ) {
    return this.service.messageImages(user, conversationId);
  }

  @Get('images')
  list(@CurrentUser() user: CurrentUserType, @Query() query: Record<string, string>) {
    return this.service.list(user, query);
  }

  @Get('images/:id')
  detail(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.detail(user, id);
  }

  @Get('images/:id/file')
  @SkipResponseWrap()
  async file(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Res() response: FileResponse
  ) {
    const file = await this.service.file(user, id);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    file.stream.pipe(response as never);
  }

  @Delete('images/:id')
  remove(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
