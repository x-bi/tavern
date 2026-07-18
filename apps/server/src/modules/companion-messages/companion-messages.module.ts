import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompanionMemoryModule } from '../companion-memory/companion-memory.module';
import { SettingsModule } from '../settings/settings.module';
import { CompanionMessagesController } from './companion-messages.controller';
import { CompanionMessagesService } from './companion-messages.service';
@Module({
  imports: [AuthModule, CompanionMemoryModule, SettingsModule],
  controllers: [CompanionMessagesController],
  providers: [CompanionMessagesService],
  exports: [CompanionMessagesService]
})
export class CompanionMessagesModule {}
