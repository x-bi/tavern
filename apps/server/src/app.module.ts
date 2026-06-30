import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation';
import serverConfig from './config/server.config';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { CharactersModule } from './modules/characters/characters.module';
import { HealthModule } from './modules/health/health.module';
import { ModelsModule } from './modules/models/models.module';
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
    ModelsModule,
    PresetsModule,
    HealthModule
  ]
})
export class AppModule {}
