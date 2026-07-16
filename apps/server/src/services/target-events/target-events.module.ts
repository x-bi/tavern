import { Global, Module } from '@nestjs/common';
import { TargetEventsService } from './target-events.service';

@Global()
@Module({ providers: [TargetEventsService], exports: [TargetEventsService] })
export class TargetEventsModule {}
