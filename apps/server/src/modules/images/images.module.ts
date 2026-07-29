import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminImagesController } from './admin-images.controller';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

@Module({
  imports: [AuthModule],
  controllers: [ImagesController, AdminImagesController],
  providers: [ImagesService],
  exports: [ImagesService]
})
export class ImagesModule {}
