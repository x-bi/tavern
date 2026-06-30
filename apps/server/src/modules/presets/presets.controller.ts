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
import { CreatePromptPresetDto } from './dto/create-prompt-preset.dto';
import { QueryPromptPresetsDto } from './dto/query-prompt-presets.dto';
import { UpdatePromptPresetDto } from './dto/update-prompt-preset.dto';
import { PresetsService } from './presets.service';

@Controller('prompt-presets')
@UseGuards(AuthGuard)
export class PresetsController {
  constructor(
    @Inject(PresetsService)
    private readonly presetsService: PresetsService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryPromptPresetsDto)) query: QueryPromptPresetsDto
  ) {
    return this.presetsService.list(currentUser, query);
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreatePromptPresetDto)) dto: CreatePromptPresetDto
  ) {
    return this.presetsService.create(currentUser, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdatePromptPresetDto)) dto: UpdatePromptPresetDto
  ) {
    return this.presetsService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.presetsService.remove(currentUser, id);
  }
}
