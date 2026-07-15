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
  UseGuards
} from '@nestjs/common';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as User } from '../users/user.types';
import { CompanionMessagesService } from './companion-messages.service';
import { UpdateCompanionMessageDto } from './dto/update-companion-message.dto';
@Controller()
@UseGuards(AuthGuard)
export class CompanionMessagesController {
  constructor(
    @Inject(CompanionMessagesService) private readonly service: CompanionMessagesService
  ) {}
  @Get('companions/:companionId/messages') list(
    @CurrentUser() u: User,
    @Param('companionId') id: string
  ) {
    return this.service.list(u, id);
  }
  @Put('companion-messages/:id') update(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateCompanionMessageDto)) dto: UpdateCompanionMessageDto
  ) {
    return this.service.update(u, id, dto.content);
  }
  @Delete('companion-messages/:id') @HttpCode(HttpStatus.OK) remove(
    @CurrentUser() u: User,
    @Param('id') id: string
  ) {
    return this.service.remove(u, id);
  }
  @Post('companion-messages/:id/regenerate') @HttpCode(HttpStatus.OK) regenerate(
    @CurrentUser() u: User,
    @Param('id') id: string
  ) {
    return this.service.regenerate(u, id);
  }
}
