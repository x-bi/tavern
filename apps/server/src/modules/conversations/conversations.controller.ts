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
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryConversationsDto)) query: QueryConversationsDto
  ) {
    return this.conversationsService.list(currentUser, query);
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateConversationDto)) dto: CreateConversationDto
  ) {
    return this.conversationsService.create(currentUser, dto);
  }

  @Get(':id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.conversationsService.getById(currentUser, id);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateConversationDto)) dto: UpdateConversationDto
  ) {
    return this.conversationsService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.conversationsService.remove(currentUser, id);
  }

  @Post(':id/clear')
  @HttpCode(HttpStatus.OK)
  clear(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.conversationsService.clear(currentUser, id);
  }
}
