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

@Controller('characters')
@UseGuards(AuthGuard)
export class CharactersController {
  constructor(
    @Inject(CharactersService)
    private readonly charactersService: CharactersService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryCharactersDto)) query: QueryCharactersDto
  ) {
    return this.charactersService.list(currentUser, query);
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreateCharacterDto)) dto: CreateCharacterDto
  ) {
    return this.charactersService.create(currentUser, dto);
  }

  @Post('import')
  importJson(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(ImportCharacterDto)) dto: ImportCharacterDto
  ) {
    return this.charactersService.importJson(currentUser, dto);
  }

  @Get(':id/export')
  exportJson(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.charactersService.exportJson(currentUser, id);
  }

  @Get(':id')
  getById(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.charactersService.getById(currentUser, id);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateCharacterDto)) dto: UpdateCharacterDto
  ) {
    return this.charactersService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.charactersService.remove(currentUser, id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    throw new NotImplementedException({
      code: ERROR_CODES.CHARACTER_DUPLICATE_NOT_IMPLEMENTED,
      message: `Character duplicate is not implemented yet. Character id: ${id}`
    });
  }
}
