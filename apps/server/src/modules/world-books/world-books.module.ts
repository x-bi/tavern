import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ContentLibraryModule } from '../content-library/content-library.module';
import { SettingsModule } from '../settings/settings.module';
import { WorldBooksController } from './world-books.controller';
import { WorldBooksService } from './world-books.service';

/** 世界书模块。imports AuthModule 鉴权；导出 WorldBooksService 供 PromptsService/ChatService 使用。 */
@Module({
  imports: [AuthModule, ContentLibraryModule, SettingsModule],
  controllers: [WorldBooksController],
  providers: [WorldBooksService],
  exports: [WorldBooksService]
})
export class WorldBooksModule {}
