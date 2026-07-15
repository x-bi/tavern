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
  UseGuards
} from '@nestjs/common';
import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { CompanionMemoryService } from './companion-memory.service';
import { UpdateCompanionMemoryDto } from './dto/update-companion-memory.dto';
@Controller('companions/:companionId/memory')
@UseGuards(AuthGuard)
export class CompanionMemoryController {
  constructor(@Inject(CompanionMemoryService) private readonly service: CompanionMemoryService) {}
  @Get() get(@CurrentUser() user: CurrentUserType, @Param('companionId') id: string) {
    return this.service.get(user, id);
  }
  @Put() update(
    @CurrentUser() user: CurrentUserType,
    @Param('companionId') id: string,
    @Body(new DtoValidationPipe(UpdateCompanionMemoryDto)) dto: UpdateCompanionMemoryDto
  ) {
    return this.service.update(user, id, dto);
  }
  @Delete() @HttpCode(HttpStatus.OK) clear(
    @CurrentUser() user: CurrentUserType,
    @Param('companionId') id: string
  ) {
    return this.service.clear(user, id);
  }
  @Post('refresh') @HttpCode(HttpStatus.OK) refresh(
    @CurrentUser() user: CurrentUserType,
    @Param('companionId') id: string
  ) {
    return this.service.refresh(user, id);
  }
  @Post('restore/:revisionId') @HttpCode(HttpStatus.OK) restore(
    @CurrentUser() user: CurrentUserType,
    @Param('companionId') id: string,
    @Param('revisionId') revisionId: string
  ) {
    return this.service.restore(user, id, revisionId);
  }
}
