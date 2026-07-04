import { BadRequestException, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';

import { ERROR_CODES } from '../dto/error-codes';

/** DTO 类的构造器类型（可 new 出实例的类）。 */
type DtoClass<T extends object> = {
  new (): T;
};

/**
 * DTO 校验管道。
 *
 * 与 NestJS 自带 ValidationPipe 不同的是：它把校验失败信息递归扁平化成
 * `字段路径: 错误信息` 的字符串数组，前端可直接逐条展示。
 *
 * 在控制器中按参数级别使用：`@Body(new DtoValidationPipe(CreateXxxDto)) dto`。
 */
export class DtoValidationPipe<T extends object> implements PipeTransform<unknown, T> {
  constructor(private readonly dtoClass: DtoClass<T>) {}

  /**
   * 把原始入参转换成 DTO 实例并校验。
   * @param value 原始请求体（可能是普通对象）。
   * @returns 校验通过的 DTO 实例。
   * @throws BadRequestException 校验失败时抛出，含 VALIDATION_ERROR 码和字段级错误详情。
   */
  transform(value: unknown): T {
    // 普通对象 → DTO 实例（触发 class-validator 装饰器）；入参为空时兜底成 {}
    const instance = plainToInstance(this.dtoClass, value ?? {});
    const errors = validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: false
    });

    // 有校验错误：收集为字符串数组后抛 400
    if (errors.length > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request validation failed.',
        details: this.flattenErrors(errors)
      });
    }

    return instance;
  }

  /**
   * 递归扁平化校验错误树为字符串列表。
   *
   * class-validator 的错误是嵌套结构（error.children 是子属性的错误），
   * 这里拍平成统一的 `a.b.c: 约束信息` 形式。
   *
   * @param errors 当前层级的校验错误列表。
   * @param parentPath 父属性路径，用于拼出完整字段路径。
   * @returns 形如 `name: name 不能为空` 的字符串数组。
   */
  private flattenErrors(errors: ValidationError[], parentPath = ''): string[] {
    return errors.flatMap((error) => {
      // 拼接当前字段路径：有父路径用 . 连接，否则用当前属性名
      const path = parentPath ? `${parentPath}.${error.property}` : error.property;
      // 当前字段自身的约束错误（每条约束 → 一条消息）
      const messages = Object.values(error.constraints ?? {}).map(
        (message) => `${path}: ${message}`
      );
      // 递归处理子属性的错误，路径带上当前字段
      const childMessages = this.flattenErrors(error.children ?? [], path);

      return [...messages, ...childMessages];
    });
  }
}
