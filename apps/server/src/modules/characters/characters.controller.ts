import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotImplementedException,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { ImportCharacterDto } from './dto/import-character.dto';
import { QueryCharactersDto } from './dto/query-characters.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

/**
 * 角色控制器，路由前缀 `/characters`（完整路径 `/{apiPrefix}/characters/...`）。
 *
 * 全部需登录（@UseGuards(AuthGuard)）。方法体均为纯转发到 CharactersService，
 * DTO 用 DtoValidationPipe 在参数级别校验。
 */
@Controller('characters')
@UseGuards(AuthGuard)
export class CharactersController {
  constructor(
    @Inject(CharactersService)
    private readonly charactersService: CharactersService
  ) {}

  /** 列表分页查询。GET /characters */
  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryCharactersDto)) query: QueryCharactersDto
  ) {
    return this.charactersService.list(currentUser, query);
  }

  /** 创建角色。POST /characters */
  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateCharacterDto)) dto: CreateCharacterDto
  ) {
    return this.charactersService.create(currentUser, dto);
  }

  /** 导入角色卡 JSON。POST /characters/import（支持预览/正式提交两阶段）。 */
  @Post('import')
  importJson(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(ImportCharacterDto)) dto: ImportCharacterDto
  ) {
    return this.charactersService.importJson(currentUser, dto);
  }

  /** 下载角色卡导入模板。GET /characters/import-template */
  @Get('import-template')
  importTemplate() {
    return this.charactersService.getImportTemplate();
  }

  /** 导出角色卡 JSON。GET /characters/:id/export */
  @Get(':id/export')
  exportJson(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.charactersService.exportJson(currentUser, id);
  }

  /** 获取单个角色。GET /characters/:id */
  @Get(':id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.charactersService.getById(currentUser, id);
  }

  /** 更新角色。PUT /characters/:id */
  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateCharacterDto)) dto: UpdateCharacterDto
  ) {
    return this.charactersService.update(currentUser, id, dto);
  }

  /** 删除角色（软删除）。DELETE /characters/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.charactersService.remove(currentUser, id);
  }

  /** 复制角色。POST /characters/:id/duplicate —— 尚未实现。 */
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    throw new NotImplementedException({
      code: ERROR_CODES.CHARACTER_DUPLICATE_NOT_IMPLEMENTED,
      message: `Character duplicate is not implemented yet. Character id: ${id}`
    });
  }
}
