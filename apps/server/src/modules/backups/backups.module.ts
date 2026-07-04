import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

/** 备份模块。imports PrismaModule 和 AuthModule（鉴权）。 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BackupsController],
  providers: [BackupsService]
})
export class BackupsModule {}
