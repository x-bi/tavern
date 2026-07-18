import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { ContentLibraryService } from './content-library.service';

@Module({
  imports: [UsersModule],
  providers: [ContentLibraryService],
  exports: [ContentLibraryService]
})
export class ContentLibraryModule {}
