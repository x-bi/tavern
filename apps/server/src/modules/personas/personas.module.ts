import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ContentLibraryModule } from '../content-library/content-library.module';
import { SettingsModule } from '../settings/settings.module';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';

/** 人设模块。imports AuthModule 鉴权。 */
@Module({
  imports: [AuthModule, ContentLibraryModule, SettingsModule],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService]
})
export class PersonasModule {}
