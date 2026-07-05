import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation';
import serverConfig from './config/server.config';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { BackupsModule } from './modules/backups/backups.module';
import { ChatModule } from './modules/chat/chat.module';
import { CharactersModule } from './modules/characters/characters.module';
import { ContentPacksModule } from './modules/content-packs/content-packs.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { HealthModule } from './modules/health/health.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ModelsModule } from './modules/models/models.module';
import { PersonasModule } from './modules/personas/personas.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { PresetsModule } from './modules/presets/presets.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WorldBooksModule } from './modules/world-books/world-books.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * 应用根模块。
 *
 * imports 装配两部分：
 * - ConfigModule：全局加载 .env、注册 serverConfig 命名空间、用 validateEnv 校验环境变量；
 * - PrismaModule（@Global）+ 各业务模块：Prisma 全局可用，业务模块按功能划分。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/server/.env', '.env'],
      load: [serverConfig],
      validate: validateEnv
    }),
    PrismaModule,
    AssetsModule,
    AuthModule,
    BackupsModule,
    CharactersModule,
    ChatModule,
    ContentPacksModule,
    ConversationsModule,
    MessagesModule,
    ModelsModule,
    PersonasModule,
    PromptsModule,
    PresetsModule,
    SettingsModule,
    WorldBooksModule,
    HealthModule
  ]
})
export class AppModule {}
