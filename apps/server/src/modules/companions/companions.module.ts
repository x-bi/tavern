import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssetsModule } from '../assets/assets.module';
import { ContentLibraryModule } from '../content-library/content-library.module';
import { SettingsModule } from '../settings/settings.module';
import { CompanionsController } from './companions.controller';
import { CompanionsService } from './companions.service';
@Module({
  imports: [AuthModule, AssetsModule, ContentLibraryModule, SettingsModule],
  controllers: [CompanionsController],
  providers: [CompanionsService],
  exports: [CompanionsService]
})
export class CompanionsModule {}
