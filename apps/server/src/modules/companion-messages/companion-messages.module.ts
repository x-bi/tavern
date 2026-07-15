import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompanionMessagesController } from './companion-messages.controller';
import { CompanionMessagesService } from './companion-messages.service';
@Module({
  imports: [AuthModule],
  controllers: [CompanionMessagesController],
  providers: [CompanionMessagesService],
  exports: [CompanionMessagesService]
})
export class CompanionMessagesModule {}
