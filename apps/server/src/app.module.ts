import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation';
import serverConfig from './config/server.config';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { CharactersModule } from './modules/characters/characters.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { HealthModule } from './modules/health/health.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ModelsModule } from './modules/models/models.module';
import { PersonasModule } from './modules/personas/personas.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { PresetsModule } from './modules/presets/presets.module';
import { PrismaModule } from './prisma/prisma.module';

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
    CharactersModule,
    ChatModule,
    ConversationsModule,
    MessagesModule,
    ModelsModule,
    PersonasModule,
    PromptsModule,
    PresetsModule,
    HealthModule
  ]
})
export class AppModule {}
