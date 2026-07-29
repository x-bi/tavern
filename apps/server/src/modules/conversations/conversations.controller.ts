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
import { UpdateConversationImageGenerationDto } from './dto/update-conversation-image-generation.dto';

/**
 * 会话控制器，路由前缀 `/conversations`，需登录。
 * 方法体均为纯转发到 ConversationsService。
 */
@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService
  ) {}

  /** 列表分页查询。GET /conversations */
  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryConversationsDto)) query: QueryConversationsDto
  ) {
    return this.conversationsService.list(currentUser, query);
  }

  /** 创建会话。POST /conversations */
  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateConversationDto)) dto: CreateConversationDto
  ) {
    return this.conversationsService.create(currentUser, dto);
  }

  /** 获取单个会话。GET /conversations/:id */
  @Get(':id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.conversationsService.getById(currentUser, id);
  }

  /** 更新当前会话的显式生图模型链和参数。 */
  @Put(':id/image-generation-config')
  updateImageGenerationConfig(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateConversationImageGenerationDto))
    dto: UpdateConversationImageGenerationDto
  ) {
    return this.conversationsService.updateImageGenerationConfig(currentUser, id, dto);
  }

  /** 更新会话。PUT /conversations/:id */
  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateConversationDto)) dto: UpdateConversationDto
  ) {
    return this.conversationsService.update(currentUser, id, dto);
  }

  /** 删除会话（级联软删除会话及其消息）。DELETE /conversations/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.conversationsService.remove(currentUser, id);
  }

  /** 清空会话消息（保留会话，删除其下所有消息）。POST /conversations/:id/clear */
  @Post(':id/clear')
  @HttpCode(HttpStatus.OK)
  clear(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.conversationsService.clear(currentUser, id);
  }
}
