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
import { CompanionsService } from './companions.service';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { UpdateCompanionDto } from './dto/update-companion.dto';
import { QueryCompanionsDto } from './dto/query-companions.dto';
import { ImportCompanionDto } from './dto/import-companion.dto';

@Controller('companions')
@UseGuards(AuthGuard)
export class CompanionsController {
  constructor(@Inject(CompanionsService) private readonly service: CompanionsService) {}
  @Get() list(
    @CurrentUser() user: CurrentUserType,
    @Query(new DtoValidationPipe(QueryCompanionsDto)) query: QueryCompanionsDto
  ) {
    return this.service.list(user, query);
  }
  @Post() create(
    @CurrentUser() user: CurrentUserType,
    @Body(new DtoValidationPipe(CreateCompanionDto)) dto: CreateCompanionDto
  ) {
    return this.service.create(user, dto);
  }
  @Get('import-template') template() {
    return this.service.getImportTemplate();
  }
  @Post('import') importJson(
    @CurrentUser() user: CurrentUserType,
    @Body(new DtoValidationPipe(ImportCompanionDto)) dto: ImportCompanionDto
  ) {
    return this.service.importJson(user, dto);
  }
  @Get(':id/export') exportJson(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.exportJson(user, id);
  }
  @Get(':id') get(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.service.getById(user, id);
  }
  @Put(':id') update(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body(new DtoValidationPipe(UpdateCompanionDto)) dto: UpdateCompanionDto
  ) {
    return this.service.update(user, id, dto);
  }
  @Delete(':id') @HttpCode(HttpStatus.OK) remove(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string
  ) {
    return this.service.remove(user, id);
  }
}
