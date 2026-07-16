import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import { SkipResponseWrap } from '../../common/interceptors/api-response.interceptor';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import type { ChatResponseLike } from '../chat/chat.types';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as User } from '../users/user.types';
import {
  BulkRevokeSharesDto,
  CreateShareDto,
  QuerySharesDto,
  UpdateShareDto
} from './dto/share.dto';
import { SharesService } from './shares.service';

@Controller('shares')
@UseGuards(AuthGuard)
export class SharesController {
  constructor(
    @Inject(SharesService) private readonly shares: SharesService,
    @Inject(TargetEventsService) private readonly events: TargetEventsService
  ) {}
  @Post() create(
    @CurrentUser() user: User,
    @Body(new DtoValidationPipe(CreateShareDto)) dto: CreateShareDto
  ) {
    return this.shares.create(user, dto);
  }
  @Get() list(
    @CurrentUser() user: User,
    @Query(new DtoValidationPipe(QuerySharesDto)) query: QuerySharesDto
  ) {
    return this.shares.list(user, query);
  }
  @Get('events')
  @SkipResponseWrap()
  async eventsStream(
    @CurrentUser() user: User,
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
    @Res() response: ChatResponseLike
  ) {
    const type = await this.shares.assertManagedTarget(user, targetType, targetId);
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    const write = (event: string, data: Record<string, unknown>) => {
      if (!response.writableEnded && !response.destroyed)
        response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const unsubscribe = this.events.subscribe(type, targetId, (event) =>
      write(event.event, event.data)
    );
    const heartbeat = setInterval(() => write('ping', { at: new Date().toISOString() }), 15_000);
    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.off('close', close);
    };
    response.on('close', close);
    write('connected', {});
  }
  @Post('bulk-revoke') @HttpCode(200) bulkRevoke(
    @CurrentUser() user: User,
    @Body(new DtoValidationPipe(BulkRevokeSharesDto)) dto: BulkRevokeSharesDto
  ) {
    return this.shares.bulkRevoke(user, dto);
  }
  @Get(':id') get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.shares.get(user, id);
  }
  @Put(':id') update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateShareDto)) dto: UpdateShareDto
  ) {
    return this.shares.update(user, id, dto);
  }
  @Delete(':id') @HttpCode(200) revoke(@CurrentUser() user: User, @Param('id') id: string) {
    return this.shares.revoke(user, id);
  }
  @Post(':id/regenerate') @HttpCode(200) regenerate(
    @CurrentUser() user: User,
    @Param('id') id: string
  ) {
    return this.shares.regenerate(user, id);
  }
}
