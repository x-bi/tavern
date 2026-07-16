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
import { CreateProviderModelDto } from './dto/create-provider-model.dto';
import { QueryModelResourcesDto } from './dto/query-model-resources.dto';
import { UpdateProviderModelDto } from './dto/update-provider-model.dto';
import { ModelsService } from './models.service';
import { SharedModelsGuard } from './shared-models.guard';

/** 供应商模型控制器。 */
@Controller('provider-models')
@UseGuards(AuthGuard, SharedModelsGuard)
export class ProviderModelsController {
  constructor(
    @Inject(ModelsService)
    private readonly modelsService: ModelsService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryModelResourcesDto)) query: QueryModelResourcesDto
  ) {
    return this.modelsService.listProviderModels(currentUser, query);
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateProviderModelDto)) dto: CreateProviderModelDto
  ) {
    return this.modelsService.createProviderModel(currentUser, dto);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.testProviderModel(currentUser, id);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateProviderModelDto)) dto: UpdateProviderModelDto
  ) {
    return this.modelsService.updateProviderModel(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.removeProviderModel(currentUser, id);
  }
}
