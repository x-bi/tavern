import { BadRequestException, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';

import { ERROR_CODES } from '../dto/error-codes';

type DtoClass<T extends object> = {
  new (): T;
};

export class DtoValidationPipe<T extends object> implements PipeTransform<unknown, T> {
  constructor(private readonly dtoClass: DtoClass<T>) {}

  transform(value: unknown): T {
    const instance = plainToInstance(this.dtoClass, value ?? {});
    const errors = validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: false
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request validation failed.',
        details: this.flattenErrors(errors)
      });
    }

    return instance;
  }

  private flattenErrors(errors: ValidationError[], parentPath = ''): string[] {
    return errors.flatMap((error) => {
      const path = parentPath ? `${parentPath}.${error.property}` : error.property;
      const messages = Object.values(error.constraints ?? {}).map(
        (message) => `${path}: ${message}`
      );
      const childMessages = this.flattenErrors(error.children ?? [], path);

      return [...messages, ...childMessages];
    });
  }
}
