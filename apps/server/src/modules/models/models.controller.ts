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

/**
 * 模型配置控制器，路由前缀 `/model-configs`，需登录。
 * 方法体均为纯转发到 ModelsService。
 */
@Controller('model-configs')
@UseGuards(AuthGuard)
export class ModelsController {
  constructor(
    @Inject(ModelsService)
    private readonly modelsService: ModelsService
  ) {}

  /** 列表分页查询。GET /model-configs */
  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryModelConfigsDto)) query: QueryModelConfigsDto
  ) {
    return this.modelsService.list(currentUser, query);
  }

  /** 创建模型配置。POST /model-configs */
  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateModelConfigDto)) dto: CreateModelConfigDto
  ) {
    return this.modelsService.create(currentUser, dto);
  }

  /** 获取单个模型配置。GET /model-configs/:id */
  @Get(':id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.getById(currentUser, id);
  }

  /** 测试模型连接。POST /model-configs/:id/test */
  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  testConnection(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.testConnection(currentUser, id);
  }

  /** 更新模型配置。PUT /model-configs/:id */
  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateModelConfigDto)) dto: UpdateModelConfigDto
  ) {
    return this.modelsService.update(currentUser, id, dto);
  }

  /** 删除模型配置（软删除）。DELETE /model-configs/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.modelsService.remove(currentUser, id);
  }
}
