import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WorldBooksController } from './world-books.controller';
import { WorldBooksService } from './world-books.service';

@Module({
  imports: [AuthModule],
  controllers: [WorldBooksController],
  providers: [WorldBooksService],
  exports: [WorldBooksService]
})
export class WorldBooksModule {}
