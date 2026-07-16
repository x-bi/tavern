import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { CompanionChatModule } from '../companion-chat/companion-chat.module';
import { PublicSharesController } from './public-shares.controller';
import { ShareTokenGuard } from './share-token.guard';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [AuthModule, ChatModule, CompanionChatModule],
  controllers: [SharesController, PublicSharesController],
  providers: [SharesService, ShareTokenGuard]
})
export class SharesModule {}
