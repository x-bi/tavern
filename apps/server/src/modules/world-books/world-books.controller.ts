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

@Controller()
@UseGuards(AuthGuard)
export class WorldBooksController {
  constructor(
    @Inject(WorldBooksService)
    private readonly worldBooksService: WorldBooksService
  ) {}

  @Get('world-books')
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryWorldBooksDto)) query: QueryWorldBooksDto
  ) {
    return this.worldBooksService.list(currentUser, query);
  }

  @Post('world-books')
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateWorldBookDto)) dto: CreateWorldBookDto
  ) {
    return this.worldBooksService.create(currentUser, dto);
  }

  @Get('world-books/:id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.worldBooksService.getById(currentUser, id);
  }

  @Put('world-books/:id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateWorldBookDto)) dto: UpdateWorldBookDto
  ) {
    return this.worldBooksService.update(currentUser, id, dto);
  }

  @Delete('world-books/:id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.worldBooksService.remove(currentUser, id);
  }

  @Post('world-books/:id/entries')
  createEntry(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(CreateWorldBookEntryDto)) dto: CreateWorldBookEntryDto
  ) {
    return this.worldBooksService.createEntry(currentUser, id, dto);
  }

  @Put('world-book-entries/:id')
  updateEntry(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateWorldBookEntryDto)) dto: UpdateWorldBookEntryDto
  ) {
    return this.worldBooksService.updateEntry(currentUser, id, dto);
  }

  @Delete('world-book-entries/:id')
  @HttpCode(HttpStatus.OK)
  removeEntry(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.worldBooksService.removeEntry(currentUser, id);
  }
}
