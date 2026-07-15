import { Body, Controller, Inject, Param, Post, Res, UseGuards } from '@nestjs/common';
import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import type { ChatResponseLike } from '../chat/chat.types';
import { CompanionChatService } from './companion-chat.service';
import { PreviewCompanionPromptDto, StreamCompanionChatDto } from './dto/stream-companion-chat.dto';

@Controller('companions/:companionId')
@UseGuards(AuthGuard)
export class CompanionChatController {
  constructor(@Inject(CompanionChatService) private readonly service: CompanionChatService) {}

  @Post('chat/stream')
  @SkipResponseWrap()
  stream(
    @CurrentUser() user: CurrentUserType,
    @Param('companionId') id: string,
    @Body(new DtoValidationPipe(StreamCompanionChatDto)) dto: StreamCompanionChatDto,
    @Res() response: ChatResponseLike
  ) {
    return this.service.stream(user, id, dto, response);
  }

  @Post('prompt-preview')
  preview(
    @CurrentUser() user: CurrentUserType,
    @Param('companionId') id: string,
    @Body(new DtoValidationPipe(PreviewCompanionPromptDto)) dto: PreviewCompanionPromptDto
  ) {
    return this.service.preview(user, id, dto.userMessage);
  }
}
