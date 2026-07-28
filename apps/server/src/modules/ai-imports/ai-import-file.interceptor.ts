import {
  CallHandler,
  ExecutionContext,
  Injectable,
  PayloadTooLargeException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { catchError, from, mergeMap, throwError } from 'rxjs';

import { ERROR_CODES } from '../../common/dto/error-codes';

const BaseFileInterceptor = FileInterceptor('file', {
  limits: { fileSize: Number(process.env.AI_IMPORT_FILE_MAX_BYTES ?? 1048576) }
});

/** 将 Multer 文件超限错误转换为项目稳定错误码。 */
@Injectable()
export class AiImportFileInterceptor extends BaseFileInterceptor {
  override intercept(context: ExecutionContext, next: CallHandler) {
    return from(Promise.resolve(super.intercept(context, next))).pipe(
      mergeMap((stream) => stream),
      catchError((error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'LIMIT_FILE_SIZE'
        ) {
          return throwError(
            () =>
              new PayloadTooLargeException({
                code: ERROR_CODES.AI_IMPORT_FILE_TOO_LARGE,
                message: 'AI import file exceeds the configured byte limit.'
              })
          );
        }
        return throwError(() => error);
      })
    );
  }
}
