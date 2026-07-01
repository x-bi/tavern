import { Body, Controller, Inject, Post, Res, UseGuards } from '@nestjs/common';

import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { ChatService } from './chat.service';
import type { ChatResponseLike } from './chat.types';
import { StreamChatDto } from './dto/stream-chat.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    @Inject(ChatService)
    private readonly chatService: ChatService
  ) {}

  @Post('stream')
  @SkipResponseWrap()
  async stream(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(StreamChatDto)) dto: StreamChatDto,
    @Res() response: ChatResponseLike
  ): Promise<void> {
    await this.chatService.stream(currentUser, dto, response);
  }
}
