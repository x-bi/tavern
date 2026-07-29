import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';

import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { CreateImageGenerationDto } from './dto/create-image-generation.dto';
import { ImageGenerationsService } from './image-generations.service';

@Controller()
@UseGuards(AuthGuard)
export class ImageGenerationsController {
  constructor(
    @Inject(ImageGenerationsService)
    private readonly service: ImageGenerationsService
  ) {}

  @Post('messages/:messageId/image-generations')
  @HttpCode(HttpStatus.ACCEPTED)
  create(
    @CurrentUser() user: CurrentUserType,
    @Param('messageId') messageId: string,
    @Body(new DtoValidationPipe(CreateImageGenerationDto)) dto: CreateImageGenerationDto
  ) {
    return this.service.create(user, messageId, dto.requestId);
  }

  @Post('image-generation-batches/:batchId/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  regenerate(
    @CurrentUser() user: CurrentUserType,
    @Param('batchId') batchId: string,
    @Body(new DtoValidationPipe(CreateImageGenerationDto)) dto: CreateImageGenerationDto
  ) {
    return this.service.regenerate(user, batchId, dto.requestId);
  }

  @Get('image-generation-batches/:batchId')
  get(@CurrentUser() user: CurrentUserType, @Param('batchId') batchId: string) {
    return this.service.get(user, batchId);
  }

  @Get('conversations/:conversationId/image-generation-batches')
  listRunning(
    @CurrentUser() user: CurrentUserType,
    @Param('conversationId') conversationId: string,
    @Query('status') status?: string
  ) {
    return this.service.listByConversation(user, conversationId, status);
  }

  @Post('image-generation-batches/:batchId/cancel')
  cancel(@CurrentUser() user: CurrentUserType, @Param('batchId') batchId: string) {
    return this.service.cancel(user, batchId);
  }
}
