import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateQqAccountDto, UpdateQqAccountDto } from './dto/qq-account.dto';
import { CreateQqBindingDto, UpdateQqBindingDto } from './dto/qq-binding.dto';
import { QqBridgeService } from './qq-bridge.service';

@Controller('qq')
@UseGuards(AuthGuard)
export class QqBridgeController {
  constructor(@Inject(QqBridgeService) private readonly service: QqBridgeService) {}

  @Get('accounts')
  listAccounts(@CurrentUser() user: CurrentUserType) {
    return this.service.listAccounts(user);
  }

  @Post('accounts')
  createAccount(
    @CurrentUser() user: CurrentUserType,
    @Body(new DtoValidationPipe(CreateQqAccountDto)) dto: CreateQqAccountDto
  ) {
    return this.service.createAccount(user, dto);
  }

  @Put('accounts/:id')
  updateAccount(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateQqAccountDto)) dto: UpdateQqAccountDto
  ) {
    return this.service.updateAccount(user, id, dto);
  }

  @Delete('accounts/:id')
  deleteAccount(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.deleteAccount(user, id);
  }

  @Post('accounts/:id/test')
  testAccount(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.testAccount(user, id);
  }

  @Get('accounts/:id/friends')
  listFriends(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.listFriends(user, id);
  }

  @Get('targets')
  listTargets(@CurrentUser() user: CurrentUserType) {
    return this.service.listTargets(user);
  }

  @Get('bindings')
  listBindings(@CurrentUser() user: CurrentUserType) {
    return this.service.listBindings(user);
  }

  @Post('bindings')
  createBinding(
    @CurrentUser() user: CurrentUserType,
    @Body(new DtoValidationPipe(CreateQqBindingDto)) dto: CreateQqBindingDto
  ) {
    return this.service.createBinding(user, dto);
  }

  @Put('bindings/:id')
  switchBinding(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateQqBindingDto)) dto: UpdateQqBindingDto
  ) {
    return this.service.switchBinding(user, id, dto);
  }

  @Delete('bindings/:id')
  deleteBinding(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.deleteBinding(user, id);
  }
}

@Controller('qq/events')
export class QqEventController {
  constructor(@Inject(QqBridgeService) private readonly service: QqBridgeService) {}

  @Post(':accountId')
  receive(
    @Param('accountId') accountId: string,
    @Query('token') token: string | undefined,
    @Body() payload: unknown
  ) {
    return this.service.acceptWebhook(accountId, token, payload);
  }
}
