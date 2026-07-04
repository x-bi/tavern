import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

/**
 * 角色模块。
 *
 * imports AuthModule 以使用 AuthGuard（鉴权）；
 * exporter/importer 是 CharactersService 内部 new 出来的纯工具类，无需 DI。
 */
@Module({
  imports: [AuthModule],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService]
})
export class CharactersModule {}
