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

@Controller('personas')
@UseGuards(AuthGuard)
export class PersonasController {
  constructor(
    @Inject(PersonasService)
    private readonly personasService: PersonasService
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: CurrentUserType,
    @Query(new DtoValidationPipe(QueryPersonasDto)) query: QueryPersonasDto
  ) {
    return this.personasService.list(currentUser, query);
  }

  @Post()
  create(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(CreatePersonaDto)) dto: CreatePersonaDto
  ) {
    return this.personasService.create(currentUser, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdatePersonaDto)) dto: UpdatePersonaDto
  ) {
    return this.personasService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.personasService.remove(currentUser, id);
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  setDefault(@CurrentUser() currentUser: CurrentUserType, @Param('id') id: string) {
    return this.personasService.setDefault(currentUser, id);
  }
}
