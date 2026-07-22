import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import { ChatService } from '../chat/chat.service';
import type { ChatResponseLike } from '../chat/chat.types';
import { CompanionChatService } from '../companion-chat/companion-chat.service';
import { PublicChatDto, PublicRegenerateDto } from './dto/share.dto';
import { ShareTokenGuard } from './share-token.guard';
import type { ShareRequest } from './share.types';
import { SharesService } from './shares.service';

@Controller('public/shares/:token')
@UseGuards(ShareTokenGuard)
@SkipResponseWrap()
export class PublicSharesController {
  constructor(
    @Inject(SharesService) private readonly shares: SharesService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(CompanionChatService) private readonly companionChat: CompanionChatService,
    @Inject(TargetEventsService) private readonly events: TargetEventsService
  ) {}

  @Get('bootstrap') bootstrap(@Req() request: ShareRequest) {
    return this.shares.publicBootstrap(request.shareContext!);
  }
  @Get('messages') messages(@Req() request: ShareRequest) {
    return this.shares.publicMessages(request.shareContext!);
  }

  @Post('chat/stream')
  stream(
    @Req() request: ShareRequest,
    @Body(new DtoValidationPipe(PublicChatDto)) dto: PublicChatDto,
    @Res() response: ChatResponseLike
  ) {
    const context = request.shareContext!;
    this.shares.assertChatPermission(context);
    return context.targetType === 'conversation'
      ? this.chat.streamInternal({
          owner: context.owner,
          conversationId: context.targetId,
          payload: { requestId: dto.requestId, userMessage: dto.userMessage },
          response
        })
      : this.companionChat.streamInternal({
          owner: context.owner,
          companionId: context.targetId,
          payload: { requestId: dto.requestId, userMessage: dto.userMessage },
          response
        });
  }

  @Post('chat/stop')
  stop(@Req() request: ShareRequest) {
    const context = request.shareContext!;
    this.shares.assertChatPermission(context);
    const stopped =
      context.targetType === 'conversation'
        ? this.chat.stopInternal(context.targetId)
        : this.companionChat.stopInternal(context.targetId);
    return { stopped };
  }

  @Post('messages/:messageId/regenerate')
  async regenerate(
    @Req() request: ShareRequest,
    @Param('messageId') messageId: string,
    @Body(new DtoValidationPipe(PublicRegenerateDto)) dto: PublicRegenerateDto,
    @Res() response: ChatResponseLike
  ) {
    const context = request.shareContext!;
    this.shares.assertChatPermission(context);
    await this.shares.assertPublicRegenerateTarget(context, messageId, dto.turnId);
    return context.targetType === 'conversation'
      ? this.chat.streamInternal({
          owner: context.owner,
          conversationId: context.targetId,
          payload: { requestId: dto.requestId, regenerateMessageId: messageId, turnId: dto.turnId },
          response
        })
      : this.companionChat.streamInternal({
          owner: context.owner,
          companionId: context.targetId,
          payload: { requestId: dto.requestId, regenerateMessageId: messageId, turnId: dto.turnId },
          response
        });
  }

  @Get('events')
  eventsStream(@Req() request: ShareRequest, @Res() response: ChatResponseLike) {
    const context = request.shareContext!;
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    const write = (event: string, data: Record<string, unknown>) => {
      if (!response.writableEnded && !response.destroyed)
        response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    write('connected', { shareId: context.shareId });
    const unsubscribe = this.events.subscribe(context.targetType, context.targetId, (event) => {
      if (event.event === 'share_revoked') {
        const ids = Array.isArray(event.data.shareIds) ? event.data.shareIds : [];
        if (!ids.includes(context.shareId)) return;
        write('share_revoked', {});
        response.end();
        return;
      }
      write(event.event, event.data);
    });
    const heartbeat = setInterval(() => write('ping', { at: new Date().toISOString() }), 15_000);
    const revalidate = setInterval(async () => {
      try {
        await this.shares.resolvePublicToken(request.params.token ?? '', request.ip);
      } catch {
        write('share_revoked', {});
        response.end();
      }
    }, 15_000);
    const close = () => {
      clearInterval(heartbeat);
      clearInterval(revalidate);
      unsubscribe();
      response.off('close', close);
    };
    response.on('close', close);
  }
}
