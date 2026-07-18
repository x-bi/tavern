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

import { ImportModuleJsonDto } from '../../common/dto/import-module-json.dto';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { CreatePromptPresetDto } from './dto/create-prompt-preset.dto';
import { QueryPromptPresetsDto } from './dto/query-prompt-presets.dto';
import { UpdatePromptPresetDto } from './dto/update-prompt-preset.dto';
import { PresetsService } from './presets.service';

/**
 * 预设控制器，路由前缀 `/prompt-presets`，需登录。
 * 方法体均为纯转发到 PresetsService。
 */
@Controller('prompt-presets')
@UseGuards(AuthGuard)
export class PresetsController {
  constructor(
    @Inject(PresetsService)
    private readonly presetsService: PresetsService
  ) {}

  /** 列表分页查询。GET /prompt-presets */
  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryPromptPresetsDto)) query: QueryPromptPresetsDto
  ) {
    return this.presetsService.list(currentUser, query);
  }

  /** 创建预设。POST /prompt-presets */
  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreatePromptPresetDto)) dto: CreatePromptPresetDto
  ) {
    return this.presetsService.create(currentUser, dto);
  }

  /** 导入预设 JSON。POST /prompt-presets/import（支持预览/正式提交两阶段）。 */
  @Post('import')
  importJson(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(ImportModuleJsonDto)) dto: ImportModuleJsonDto
  ) {
    return this.presetsService.importJson(currentUser, dto);
  }

  /** 下载参数预设导入模板。GET /prompt-presets/import-template */
  @Get('import-template')
  importTemplate() {
    return this.presetsService.getImportTemplate();
  }

  @Post(':id/fork')
  fork(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.presetsService.fork(currentUser, id);
  }

  @Get(':id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.presetsService.getById(currentUser, id);
  }

  /** 更新预设。PUT /prompt-presets/:id */
  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdatePromptPresetDto)) dto: UpdatePromptPresetDto
  ) {
    return this.presetsService.update(currentUser, id, dto);
  }

  /** 删除预设（软删除）。DELETE /prompt-presets/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.presetsService.remove(currentUser, id);
  }
}
