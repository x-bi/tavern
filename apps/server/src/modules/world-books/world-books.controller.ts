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
import { CreateWorldBookEntryDto } from './dto/create-world-book-entry.dto';
import { CreateWorldBookDto } from './dto/create-world-book.dto';
import { QueryWorldBooksDto } from './dto/query-world-books.dto';
import { UpdateWorldBookEntryDto } from './dto/update-world-book-entry.dto';
import { UpdateWorldBookDto } from './dto/update-world-book.dto';
import { WorldBooksService } from './world-books.service';

/**
 * 世界书控制器，无统一前缀（路由直接挂 world-books 和 world-book-entries），需登录。
 * 方法体均为纯转发到 WorldBooksService。
 */
@Controller()
@UseGuards(AuthGuard)
export class WorldBooksController {
  constructor(
    @Inject(WorldBooksService)
    private readonly worldBooksService: WorldBooksService
  ) {}

  /** 列表分页查询。GET /world-books */
  @Get('world-books')
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryWorldBooksDto)) query: QueryWorldBooksDto
  ) {
    return this.worldBooksService.list(currentUser, query);
  }

  /** 创建世界书。POST /world-books */
  @Post('world-books')
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateWorldBookDto)) dto: CreateWorldBookDto
  ) {
    return this.worldBooksService.create(currentUser, dto);
  }

  /** 获取单个世界书。GET /world-books/:id */
  @Get('world-books/:id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.worldBooksService.getById(currentUser, id);
  }

  /** 更新世界书。PUT /world-books/:id */
  @Put('world-books/:id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateWorldBookDto)) dto: UpdateWorldBookDto
  ) {
    return this.worldBooksService.update(currentUser, id, dto);
  }

  /** 删除世界书（级联软删除其条目）。DELETE /world-books/:id */
  @Delete('world-books/:id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.worldBooksService.remove(currentUser, id);
  }

  /** 创建条目。POST /world-books/:id/entries */
  @Post('world-books/:id/entries')
  createEntry(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(CreateWorldBookEntryDto)) dto: CreateWorldBookEntryDto
  ) {
    return this.worldBooksService.createEntry(currentUser, id, dto);
  }

  /** 更新条目。PUT /world-book-entries/:id */
  @Put('world-book-entries/:id')
  updateEntry(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateWorldBookEntryDto)) dto: UpdateWorldBookEntryDto
  ) {
    return this.worldBooksService.updateEntry(currentUser, id, dto);
  }

  /** 删除条目（软删除）。DELETE /world-book-entries/:id */
  @Delete('world-book-entries/:id')
  @HttpCode(HttpStatus.OK)
  removeEntry(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.worldBooksService.removeEntry(currentUser, id);
  }
}
