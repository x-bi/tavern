import { Global, Module } from '@nestjs/common';
import { GenerationLifecycleService } from './generation-lifecycle.service';
import { CompanionTimelineService, ConversationTimelineService } from './timeline.service';
import { ContextOwnershipValidator } from './context-ownership-validator';
import { CompanionReplayService, ConversationReplayService } from './replay.service';
import { WorldBookRuntimeService } from './world-book-runtime.service';

@Global()
@Module({
  providers: [
    GenerationLifecycleService,
    ConversationTimelineService,
    CompanionTimelineService,
    ContextOwnershipValidator,
    WorldBookRuntimeService,
    ConversationReplayService,
    CompanionReplayService
  ],
  exports: [
    GenerationLifecycleService,
    ConversationTimelineService,
    CompanionTimelineService,
    ContextOwnershipValidator,
    WorldBookRuntimeService,
    ConversationReplayService,
    CompanionReplayService
  ]
})
export class ContextEngineModule {}
