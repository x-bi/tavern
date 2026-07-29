import { Global, Module } from '@nestjs/common';
import { GenerationLifecycleService } from './generation-lifecycle.service';
import { CompanionTimelineService, ConversationTimelineService } from './timeline.service';
import { ContextOwnershipValidator } from './context-ownership-validator';
import { CompanionReplayService, ConversationReplayService } from './replay.service';
import { WorldBookRuntimeService } from './world-book-runtime.service';
import { ModelGatewayModule } from '../model-gateway';
import { SceneImagePromptService } from './scene-image-prompt.service';

@Global()
@Module({
  imports: [ModelGatewayModule],
  providers: [
    GenerationLifecycleService,
    ConversationTimelineService,
    CompanionTimelineService,
    ContextOwnershipValidator,
    WorldBookRuntimeService,
    ConversationReplayService,
    CompanionReplayService,
    SceneImagePromptService
  ],
  exports: [
    GenerationLifecycleService,
    ConversationTimelineService,
    CompanionTimelineService,
    ContextOwnershipValidator,
    WorldBookRuntimeService,
    ConversationReplayService,
    CompanionReplayService,
    SceneImagePromptService
  ]
})
export class ContextEngineModule {}
