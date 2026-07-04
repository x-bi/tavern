import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';

import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { PreviewPromptDto } from './dto/preview-prompt.dto';
import { PromptsService } from './prompts.service';

/**
 * Prompt 预览控制器，路由前缀 `/prompts`，需登录。
 * 方法体为纯转发到 PromptsService。
 */
@Controller('prompts')
@UseGuards(AuthGuard)
export class PromptsController {
  constructor(
    @Inject(PromptsService)
    private readonly promptsService: PromptsService
  ) {}

  /** 预览生成的 prompt（调试用，展示最终发送给模型的各 section）。POST /prompts/preview */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(PreviewPromptDto)) dto: PreviewPromptDto
  ) {
    return this.promptsService.preview(currentUser, dto);
  }
}
