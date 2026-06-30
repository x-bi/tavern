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

@Controller()
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    @Inject(MessagesService)
    private readonly messagesService: MessagesService
  ) {}

  @Get('conversations/:conversationId/messages')
  listByConversation(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('conversationId') conversationId: string,
    @Query(new DtoValidationPipe(QueryMessagesDto)) query: QueryMessagesDto
  ) {
    return this.messagesService.listByConversation(currentUser, conversationId, query);
  }

  @Put('messages/:id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateMessageDto)) dto: UpdateMessageDto
  ) {
    return this.messagesService.update(currentUser, id, dto);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.messagesService.remove(currentUser, id);
  }

  @Post('messages/:id/regenerate')
  @HttpCode(HttpStatus.OK)
  regenerate(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.messagesService.regenerate(currentUser, id);
  }
}
