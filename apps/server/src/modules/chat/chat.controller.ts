import { Body, Controller, Inject, Post, Res, UseGuards } from '@nestjs/common';

import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { ChatService } from './chat.service';
import type { ChatResponseLike } from './chat.types';
import { StreamChatDto } from './dto/stream-chat.dto';

/**
 * 聊天控制器，路由前缀 `/chat`，需登录。
 *
 * stream 用 SSE 流式响应，故 @SkipResponseWrap() 跳过全局响应包装，
 * 直接操作 Express response 写入事件流。
 */
@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    @Inject(ChatService)
    private readonly chatService: ChatService
  ) {}

  /**
   * 流式聊天。POST /chat/stream
   *
   * 用 @Res() 拿到原生 response 写 SSE 事件；返回 void（响应由 service 内部写）。
   */
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
