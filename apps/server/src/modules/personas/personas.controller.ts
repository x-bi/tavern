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
import { CreatePersonaDto } from './dto/create-persona.dto';
import { QueryPersonasDto } from './dto/query-personas.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { PersonasService } from './personas.service';

/**
 * 人设控制器，路由前缀 `/personas`，需登录。
 * 方法体均为纯转发到 PersonasService。
 */
@Controller('personas')
@UseGuards(AuthGuard)
export class PersonasController {
  constructor(
    @Inject(PersonasService)
    private readonly personasService: PersonasService
  ) {}

  /** 列表分页查询。GET /personas */
  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryPersonasDto)) query: QueryPersonasDto
  ) {
    return this.personasService.list(currentUser, query);
  }

  /** 创建人设。POST /personas */
  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreatePersonaDto)) dto: CreatePersonaDto
  ) {
    return this.personasService.create(currentUser, dto);
  }

  /** 更新人设。PUT /personas/:id */
  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdatePersonaDto)) dto: UpdatePersonaDto
  ) {
    return this.personasService.update(currentUser, id, dto);
  }

  /** 删除人设（软删除）。DELETE /personas/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.personasService.remove(currentUser, id);
  }

  /** 设为默认人设。POST /personas/:id/set-default */
  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  setDefault(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.personasService.setDefault(currentUser, id);
  }
}
