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
import { CreateModelFallbackGroupDto } from './dto/create-model-fallback-group.dto';
import { QueryModelResourcesDto } from './dto/query-model-resources.dto';
import { UpdateModelFallbackGroupDto } from './dto/update-model-fallback-group.dto';
import { ModelsService } from './models.service';

/** 模型链控制器。 */
@Controller('model-fallback-groups')
@UseGuards(AuthGuard)
export class ModelFallbackGroupsController {
  constructor(
    @Inject(ModelsService)
    private readonly modelsService: ModelsService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryModelResourcesDto)) query: QueryModelResourcesDto
  ) {
    return this.modelsService.listFallbackGroups(currentUser, query);
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateModelFallbackGroupDto)) dto: CreateModelFallbackGroupDto
  ) {
    return this.modelsService.createFallbackGroup(currentUser, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateModelFallbackGroupDto)) dto: UpdateModelFallbackGroupDto
  ) {
    return this.modelsService.updateFallbackGroup(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.removeFallbackGroup(currentUser, id);
  }
}
