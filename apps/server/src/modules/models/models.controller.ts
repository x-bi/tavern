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
import { CreateModelConfigDto } from './dto/create-model-config.dto';
import { QueryModelConfigsDto } from './dto/query-model-configs.dto';
import { UpdateModelConfigDto } from './dto/update-model-config.dto';
import { ModelsService } from './models.service';

@Controller('model-configs')
@UseGuards(AuthGuard)
export class ModelsController {
  constructor(
    @Inject(ModelsService)
    private readonly modelsService: ModelsService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryModelConfigsDto)) query: QueryModelConfigsDto
  ) {
    return this.modelsService.list(currentUser, query);
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateModelConfigDto)) dto: CreateModelConfigDto
  ) {
    return this.modelsService.create(currentUser, dto);
  }

  @Get(':id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.getById(currentUser, id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  testConnection(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.testConnection(currentUser, id);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateModelConfigDto)) dto: UpdateModelConfigDto
  ) {
    return this.modelsService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.remove(currentUser, id);
  }
}
