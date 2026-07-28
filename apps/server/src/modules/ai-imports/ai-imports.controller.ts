import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';

import { DtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { ERROR_CODES } from '../../common/dto/error-codes';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { AiImportsService } from './ai-imports.service';
import { AiImportFileInterceptor } from './ai-import-file.interceptor';
import { QueryAiImportOptionsDto } from './dto/query-ai-import-options.dto';
import { TransformAiImportDto } from './dto/transform-ai-import.dto';
import { ValidateAiImportDto } from './dto/validate-ai-import.dto';

type RequestWithAbort = {
  once(event: 'aborted', listener: () => void): void;
  removeListener(event: 'aborted', listener: () => void): void;
};

type UploadedTextFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('ai-imports')
@UseGuards(AuthGuard)
export class AiImportsController {
  constructor(@Inject(AiImportsService) private readonly service: AiImportsService) {}

  @Get('options')
  options(@Query(new DtoValidationPipe(QueryAiImportOptionsDto)) query: QueryAiImportOptionsDto) {
    return this.service.getOptions(query.target, query.mode);
  }

  @Post('transform')
  transform(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(TransformAiImportDto)) dto: TransformAiImportDto,
    @Req() request: RequestWithAbort
  ) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once('aborted', abort);
    return this.service
      .transform(currentUser, dto, controller.signal)
      .finally(() => request.removeListener('aborted', abort));
  }

  @Post('transform-file')
  @UseInterceptors(AiImportFileInterceptor)
  transformFile(
    @CurrentUser() currentUser: CurrentUserType,
    @UploadedFile() file: UploadedTextFile | undefined,
    @Body() body: Record<string, unknown>,
    @Req() request: RequestWithAbort
  ) {
    if (!file) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_FILE_TYPE_UNSUPPORTED,
        message: 'AI import file is required.'
      });
    }
    const dto = new DtoValidationPipe(TransformAiImportDto).transform({
      target: body.target,
      modelFallbackGroupId: body.modelFallbackGroupId,
      mode: body.mode,
      sourceText: 'file',
      generalStrategyIds: parseStringArray(body.generalStrategyIds),
      moduleStrategyIds: parseStringArray(body.moduleStrategyIds),
      customInstructions: body.customInstructions
    });
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once('aborted', abort);
    return this.service
      .transformFile(
        currentUser,
        {
          target: dto.target,
          modelFallbackGroupId: dto.modelFallbackGroupId,
          mode: dto.mode,
          generalStrategyIds: dto.generalStrategyIds,
          moduleStrategyIds: dto.moduleStrategyIds,
          customInstructions: dto.customInstructions
        },
        file,
        controller.signal
      )
      .finally(() => request.removeListener('aborted', abort));
  }

  @Post('validate')
  validate(
    @CurrentUser() currentUser: CurrentUserType,
    @Body(new DtoValidationPipe(ValidateAiImportDto)) dto: ValidateAiImportDto
  ) {
    return this.service.validate(currentUser, dto.target, dto.rawJson);
  }
}

function parseStringArray(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}
