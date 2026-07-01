import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';

import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { PreviewPromptDto } from './dto/preview-prompt.dto';
import { PromptsService } from './prompts.service';

@Controller('prompts')
@UseGuards(AuthGuard)
export class PromptsController {
  constructor(
    @Inject(PromptsService)
    private readonly promptsService: PromptsService
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(PreviewPromptDto)) dto: PreviewPromptDto
  ) {
    return this.promptsService.preview(currentUser, dto);
  }
}
