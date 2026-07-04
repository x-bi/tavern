import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';

import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessagesService } from './messages.service';

/**
 * 消息控制器，无统一前缀（路由直接挂在 conversations 和 messages 上），需登录。
 * 方法体均为纯转发到 MessagesService。
 */
@Controller()
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    @Inject(MessagesService)
    private readonly messagesService: MessagesService
  ) {}

  /** 按会话分页查询消息。GET /conversations/:conversationId/messages */
  @Get('conversations/:conversationId/messages')
  listByConversation(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('conversationId') conversationId: string,
    @Query(new DtoValidationPipe(QueryMessagesDto)) query: QueryMessagesDto
  ) {
    return this.messagesService.listByConversation(currentUser, conversationId, query);
  }

  /** 更新消息（仅 user 消息可编辑内容）。PUT /messages/:id */
  @Put('messages/:id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateMessageDto)) dto: UpdateMessageDto
  ) {
    return this.messagesService.update(currentUser, id, dto);
  }

  /** 删除消息（软删除）。DELETE /messages/:id */
  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.messagesService.remove(currentUser, id);
  }

  /** 重新生成消息（返回提示，实际由 /chat/stream 执行）。POST /messages/:id/regenerate */
  @Post('messages/:id/regenerate')
  @HttpCode(HttpStatus.OK)
  regenerate(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.messagesService.regenerate(currentUser, id);
  }
}
