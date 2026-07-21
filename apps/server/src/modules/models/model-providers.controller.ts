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
import { CreateModelProviderDto } from './dto/create-model-provider.dto';
import { QueryModelResourcesDto } from './dto/query-model-resources.dto';
import { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import { ModelsService } from './models.service';
import { SharedModelsGuard } from './shared-models.guard';

/** 模型供应商账号控制器。 */
@Controller('model-providers')
@UseGuards(AuthGuard, SharedModelsGuard)
export class ModelProvidersController {
  constructor(
    @Inject(ModelsService)
    private readonly modelsService: ModelsService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryModelResourcesDto)) query: QueryModelResourcesDto
  ) {
    return this.modelsService.listProviders(currentUser, query);
  }

  @Get('supported')
  supported() {
    return this.modelsService.listSupportedProviderNames();
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateModelProviderDto)) dto: CreateModelProviderDto
  ) {
    return this.modelsService.createProvider(currentUser, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateModelProviderDto)) dto: UpdateModelProviderDto
  ) {
    return this.modelsService.updateProvider(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.removeProvider(currentUser, id);
  }

  @Get(':id/models')
  listModels(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Query(new DtoValidationPipe(QueryModelResourcesDto)) query: QueryModelResourcesDto
  ) {
    return this.modelsService.listProviderModels(currentUser, query, id);
  }
}
