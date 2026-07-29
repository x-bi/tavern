import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { CompanionMessage, PromptPreset } from '@prisma/client';
import { canonicalJson, canonicalSha256 } from '../../common/canonical-json';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CompanionPromptParameters,
  CompanionPromptInput
} from '../../services/context-engine/companion-prompt-contract';
import { ModelGatewayService } from '../../services/model-gateway';
import { resolveModelPromptBudget } from '../../services/prompt-builder/prompt-budget';
import { estimatePromptTextTokens } from '../../services/prompt-builder/token-estimator';
import type { ChatMessageLike } from '../../services/prompt-builder/types';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import { GenerationLifecycleService } from '../../services/context-engine/generation-lifecycle.service';
import { CompanionTimelineService } from '../../services/context-engine/timeline.service';
import { ContextOwnershipValidator } from '../../services/context-engine/context-ownership-validator';
import { shouldTryNextModelCandidate } from '../../services/context-engine/model-fallback-policy';
import type {
  PreparedGeneration,
  ProposedGenerationTrace
} from '../../services/context-engine/generation-lifecycle.types';
import { buildCompanionPromptSections } from '../../services/context-engine/companion-prompt-section-builder';
import { compilePromptSections } from '../../services/context-engine/provider-prompt-compiler';
import {
  parsePresetOutputRuleOperations,
  parsePresetStringArray
} from '../../services/context-engine/preset-rule-compiler';
import type { CompiledPrompt } from '../../services/context-engine/prompt-section.types';
import {
  WorldBookRuntimeService,
  type WorldBookRuntimeResult
} from '../../services/context-engine/world-book-runtime.service';
import { CompanionMemoryService } from '../companion-memory/companion-memory.service';
import { ModelsService } from '../models/models.service';
import type { ModelGatewayConfig } from '../models/model.types';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUser } from '../users/user.types';
import type { ChatResponseLike } from '../chat/chat.types';
import { StreamCompanionChatDto } from './dto/stream-companion-chat.dto';
import { WorldBooksService } from '../world-books/world-books.service';

type OwnedCompanion = Awaited<ReturnType<CompanionChatService['findOwned']>>;
const COMPANION_HISTORY_LIMIT = 20;

@Injectable()
export class CompanionChatService {
  private readonly tasks = new Map<string, AbortController>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ModelsService) private readonly models: ModelsService,
    @Inject(ModelGatewayService) private readonly gateway: ModelGatewayService,
    @Inject(CompanionMemoryService) private readonly memoryService: CompanionMemoryService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(TargetEventsService) private readonly targetEvents: TargetEventsService,
    @Inject(GenerationLifecycleService) private readonly lifecycle: GenerationLifecycleService,
    @Inject(WorldBooksService) private readonly worldBooks: WorldBooksService,
    @Inject(WorldBookRuntimeService) private readonly worldBookRuntime: WorldBookRuntimeService,
    @Inject(CompanionTimelineService) private readonly timeline: CompanionTimelineService,
    @Inject(ContextOwnershipValidator)
    private readonly ownershipValidator: ContextOwnershipValidator
  ) {}

  streamInternal(params: {
    owner: CurrentUser;
    companionId: string;
    payload: StreamCompanionChatDto;
    response: ChatResponseLike;
  }) {
    return this.stream(params.owner, params.companionId, params.payload, params.response);
  }

  stopInternal(companionId: string): boolean {
    const task = this.tasks.get(companionId);
    if (!task) return false;
    task.abort();
    return true;
  }

  async preview(user: CurrentUser, companionId: string, userInput: string) {
    const companion = await this.findOwned(user, companionId);
    const history = await this.listHistory(companionId, COMPANION_HISTORY_LIMIT);
    const worldBooks = await this.worldBooks.listPromptContexts(user, null, {
      companionId,
      personaId: companion.personaId
    });
    const previewUser = this.toContextMessage(
      companionId,
      'preview-current-user',
      'user',
      userInput
    );
    const worldBookRuntime = await this.worldBookRuntime.evaluateCompanion({
      companionId,
      worldBooks,
      history: history.map((message) => this.toContextMessageFromCompanion(message)),
      currentUserMessage: previewUser,
      purpose: 'chat_reply'
    });
    const candidates = await this.models.getGatewayCandidates({
      currentUser: user,
      capability: 'chat',
      modelFallbackGroupId: companion.modelFallbackGroupId ?? undefined
    });
    const promptInput = this.toPromptInput(
      companion,
      history,
      userInput,
      this.promptBudget(candidates[0], companion.promptPreset)
    );
    const capabilities = candidates[0]?.capabilities ?? {
      supportsDeveloperRole: false,
      systemPlacement: 'initial_only' as const,
      supportsMultipleSystemMessages: false,
      requiresAlternatingRoles: true,
      contextWindowTokens: 8192,
      tokenizerType: 'estimated_chars_v1'
    };
    const compiled = compilePromptSections({
      sections: [
        ...buildCompanionPromptSections(promptInput, 'chat_reply'),
        ...worldBookRuntime.sections
      ],
      purpose: 'chat_reply',
      capabilities,
      maxPromptTokens: promptInput.maxPromptTokens ?? 8000
    });
    const parameters = promptInput.preset?.parameters ?? null;
    const warnings = this.ownershipValidator
      .validate({
        'companion.coreIdentity': promptInput.coreIdentity,
        'companion.personality': promptInput.personality,
        'companion.speechStyle': promptInput.speechStyle,
        'companion.relationshipDefaults': promptInput.relationshipDefaults,
        'persona.coreIdentity': promptInput.personaProfile?.coreIdentity,
        'persona.background': promptInput.personaProfile?.background,
        'persona.interactionPreferences': promptInput.personaProfile?.interactionPreferences,
        'preset.instructions': promptInput.preset?.instructions?.join('\n'),
        'preset.outputRuleOperations': promptInput.preset?.outputRuleOperations
          ?.map((rule) => rule.content)
          .join('\n'),
        memory: [promptInput.memory?.relationshipState, promptInput.memory?.currentArc]
          .filter(Boolean)
          .join('\n')
      })
      .map((issue) => ({
        code: issue.code,
        message: issue.message,
        details: { fields: issue.fields }
      }));
    return {
      messages: compiled.messages,
      parameters,
      warnings,
      promptBudget: promptInput.maxPromptTokens ?? 8000,
      tokenEstimate: compiled.tokenEstimate,
      dryRun: true as const,
      compilerVersion: compiled.compilerVersion,
      promptSnapshotHash: canonicalSha256({
        compilerVersion: compiled.compilerVersion,
        capabilities,
        messages: compiled.messages,
        sections: compiled.sections
      }),
      compiledSections: compiled.sections,
      memoryVersion: companion.memory?.activeRevision?.version ?? null,
      generatedAt: new Date().toISOString()
    };
  }

  async stream(
    user: CurrentUser,
    companionId: string,
    dto: StreamCompanionChatDto,
    response: ChatResponseLike
  ): Promise<void> {
    const hasInput = Boolean(dto.userMessage?.trim());
    const hasRegenerate = Boolean(dto.regenerateMessageId);
    if (hasInput === hasRegenerate)
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Provide userMessage or regenerateMessageId.'
      });
    const companion = await this.findOwned(user, companionId);
    if (this.tasks.has(companionId))
      throw new ConflictException({
        code: 'COMPANION_CHAT_BUSY',
        message: 'Companion is already generating.'
      });
    const abort = new AbortController();
    this.prepareSse(response);
    this.tasks.set(companionId, abort);

    const close = () => abort.abort();
    response.on('close', close);
    let assistant: CompanionMessage | null = null;
    let generation: Extract<PreparedGeneration<CompanionMessage>, { state: 'started' }> | null =
      null;
    let content = '';
    try {
      const prepared = await this.lifecycle.beginCompanion(companionId, {
        requestId: dto.requestId,
        userMessage: dto.userMessage,
        regenerateMessageId: dto.regenerateMessageId,
        turnId: dto.turnId,
        requestContext: dto
      });
      if (prepared.state === 'idempotent_complete') {
        this.writeEvent(response, 'done', {
          messageId: prepared.messageId,
          finishReason: 'stop',
          idempotentReplay: true
        });
        return;
      }
      generation = prepared;
      assistant = prepared.assistantMessage;
      const history = await this.listHistory(companionId, COMPANION_HISTORY_LIMIT, [
        prepared.userMessage.id,
        prepared.assistantMessage.id,
        ...(dto.regenerateMessageId ? [dto.regenerateMessageId] : [])
      ]);
      const worldBooks = await this.worldBooks.listPromptContexts(user, null, {
        companionId,
        personaId: companion.personaId
      });
      const worldBookRuntime = await this.worldBookRuntime.evaluateCompanion({
        companionId,
        worldBooks,
        history: history.map((message) => this.toContextMessageFromCompanion(message)),
        currentUserMessage: this.toContextMessageFromCompanion(prepared.userMessage),
        purpose: generation.purpose
      });
      this.targetEvents.emit('companion', companionId, 'message_created', {
        message: this.toPublicEventMessage(prepared.userMessage)
      });
      this.targetEvents.emit('companion', companionId, 'generation_started', {
        message: this.toPublicEventMessage(assistant)
      });
      const candidates = await this.models.getGatewayCandidates({
        currentUser: user,
        capability: 'chat',
        modelFallbackGroupId: companion.modelFallbackGroupId ?? undefined
      });
      if (!candidates.length)
        throw new BadRequestException({
          code: 'MODEL_FALLBACK_GROUP_NOT_READY',
          message: 'No callable model candidate.'
        });
      let finishReason: string | null = null;
      let succeeded = false;
      let successfulTrace: ProposedGenerationTrace | null = null;
      for (const [candidateIndex, candidate] of candidates.entries()) {
        let emitted = false;
        let attemptErrorCode: string | undefined;
        const attempt = await this.lifecycle.createCompanionAttempt(
          generation.requestDatabaseId,
          candidateIndex,
          candidate.providerModelId ?? candidate.modelName
        );
        try {
          const promptInput = this.toPromptInput(
            companion,
            history,
            prepared.userMessage.content,
            this.promptBudget(candidate, companion.promptPreset)
          );
          const compiled = compilePromptSections({
            sections: [
              ...buildCompanionPromptSections(promptInput, generation.purpose),
              ...worldBookRuntime.sections
            ],
            purpose: generation.purpose,
            capabilities: candidate.capabilities,
            maxPromptTokens: promptInput.maxPromptTokens ?? 8000
          });
          const parameters = {
            ...candidate.params,
            ...(promptInput.preset?.parameters ?? {})
          };
          successfulTrace = this.toGenerationTrace(
            compiled,
            candidate,
            parameters,
            prepared.userMessage.id,
            companion.memory?.activeRevisionId ?? null,
            worldBookRuntime
          );
          await this.lifecycle.updateCompanionAttemptSnapshot(attempt.id, {
            hash: successfulTrace.promptSnapshotHash,
            capabilities: candidate.capabilities,
            parameters
          });
          for await (const event of this.gateway.streamChat(compiled.messages, {
            providerName: candidate.providerName,
            baseUrl: candidate.baseUrl,
            modelName: candidate.modelName,
            apiKey: candidate.apiKey,
            requestSource: 'companion_chat',
            ...parameters,
            signal: abort.signal
          })) {
            if (event.type === 'delta') {
              emitted = true;
              content += event.text;
              this.writeEvent(response, 'delta', { text: event.text, messageId: assistant.id });
              this.targetEvents.emit('companion', companionId, 'delta', {
                text: event.text,
                messageId: assistant.id
              });
            }
            if (event.type === 'done') {
              finishReason = event.result.finishReason ?? null;
              succeeded = true;
            }
            if (event.type === 'error') {
              attemptErrorCode = event.code;
              if (emitted) throw Object.assign(new Error(event.message), { code: event.code });
              break;
            }
          }
        } catch (error) {
          attemptErrorCode = this.errorCode(error, abort.signal.aborted);
          await this.lifecycle.finishCompanionAttempt(
            attempt.id,
            abort.signal.aborted ? 'stopped' : 'failed',
            emitted,
            attemptErrorCode
          );
          if (
            !shouldTryNextModelCandidate({
              emittedDelta: emitted,
              accumulatedContent: content,
              hasNextCandidate: candidateIndex < candidates.length - 1,
              aborted: abort.signal.aborted
            })
          )
            throw error;
          continue;
        }
        if (succeeded) {
          await this.lifecycle.finishCompanionAttempt(attempt.id, 'succeeded', emitted);
          break;
        }
        await this.lifecycle.finishCompanionAttempt(
          attempt.id,
          'failed',
          emitted,
          attemptErrorCode ?? 'MODEL_CANDIDATE_FAILED'
        );
      }
      if (!succeeded) throw new Error('All model candidates failed.');
      if (!successfulTrace) throw new Error('Generation trace was not prepared.');
      await this.lifecycle.completeCompanion({
        companionId,
        requestDatabaseId: generation.requestDatabaseId,
        turnId: generation.turnId,
        assistantMessageId: assistant.id,
        expectedVersion: generation.expectedVersion,
        content,
        tokenCount: this.estimateTokens(content),
        purpose: generation.purpose,
        trace: successfulTrace
      });
      this.writeEvent(response, 'done', { messageId: assistant.id, finishReason });
      this.targetEvents.emit('companion', companionId, 'generation_done', {
        messageId: assistant.id,
        finishReason
      });
      void this.memoryService.maybeScheduleUpdate(user, companionId);
    } catch (error) {
      const aborted = abort.signal.aborted;
      const code = this.errorCode(error, aborted);
      if (assistant && generation && code !== 'CONTEXT_COMMIT_CONFLICT')
        await this.lifecycle.failCompanion({
          companionId,
          requestDatabaseId: generation.requestDatabaseId,
          turnId: generation.turnId,
          assistantMessageId: assistant.id,
          content,
          status: aborted ? 'stopped' : 'failed',
          errorCode: code
        });
      this.writeEvent(response, 'error', {
        code,
        message:
          code === 'CONTEXT_COMMIT_CONFLICT'
            ? 'Companion context changed; provisional output was discarded.'
            : aborted
              ? 'Generation stopped.'
              : 'Companion generation failed.'
      });
      this.targetEvents.emit('companion', companionId, 'generation_failed', {
        messageId: assistant?.id ?? null,
        code
      });
    } finally {
      response.off('close', close);
      if (this.tasks.get(companionId) === abort) this.tasks.delete(companionId);
      if (!response.writableEnded) response.end();
    }
  }

  private async listHistory(companionId: string, take: number, exclude: string[] = []) {
    return this.timeline.listPromptMessages(companionId, { take, excludeIds: exclude });
  }

  private async findOwned(user: CurrentUser, id: string) {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(user);
    const companion = await this.prisma.companion.findFirst({
      where: {
        id,
        userId: user.id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { isSensitive: false })
      },
      include: {
        persona: true,
        promptPreset: true,
        runtimeState: true,
        memory: { include: { activeRevision: true } }
      }
    });
    if (!companion)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
    return companion;
  }

  private toPromptInput(
    companion: OwnedCompanion,
    history: CompanionMessage[],
    userInput: string,
    maxPromptTokens?: number
  ): CompanionPromptInput {
    return {
      name: companion.name,
      companionId: companion.id,
      coreIdentity: companion.coreIdentity,
      personality: companion.personality,
      speechStyle: companion.speechStyle,
      relationshipDefaults: companion.relationshipDefaults,
      personaProfile: companion.persona
        ? {
            id: companion.persona.id,
            coreIdentity: companion.persona.coreIdentity,
            background: companion.persona.background,
            interactionPreferences: companion.persona.interactionPreferences
          }
        : null,
      preset: this.presetContext(companion.promptPreset),
      memory: this.activeMemoryContext(companion.memory),
      runtimeState: companion.runtimeState,
      history: history
        .filter(
          (m): m is CompanionMessage & { role: 'user' | 'assistant' } =>
            m.role === 'user' || m.role === 'assistant'
        )
        .map((m) => ({ id: m.id, role: m.role, content: m.content })),
      userInput,
      maxPromptTokens
    };
  }
  private promptBudget(
    candidate?: {
      contextLength?: number | null;
      params: { maxTokens?: number };
    },
    preset?: PromptPreset | null
  ) {
    const presetMaxTokens = preset
      ? this.parsePresetParameters(preset.parametersJson)?.maxTokens
      : undefined;

    return resolveModelPromptBudget(candidate, presetMaxTokens);
  }
  private presetContext(preset: PromptPreset | null) {
    return preset
      ? {
          id: preset.id,
          instructions: parsePresetStringArray(preset.instructionsJson),
          outputRuleOperations: parsePresetOutputRuleOperations(preset.outputRuleOperationsJson),
          generationPurposes: parsePresetStringArray(preset.generationPurposesJson),
          parameters: this.parsePresetParameters(preset.parametersJson)
        }
      : null;
  }
  private parsePresetParameters(value: string | null): CompanionPromptParameters | null {
    if (!value) return null;

    try {
      const parsed = JSON.parse(value) as unknown;

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }

      const record = parsed as Record<string, unknown>;
      return {
        ...(typeof record.temperature === 'number' ? { temperature: record.temperature } : {}),
        ...(typeof record.topP === 'number' ? { topP: record.topP } : {}),
        ...(typeof record.maxTokens === 'number' && Number.isInteger(record.maxTokens)
          ? { maxTokens: record.maxTokens }
          : {}),
        ...(typeof record.timeout === 'number' && Number.isInteger(record.timeout)
          ? { timeout: record.timeout }
          : {}),
        ...(typeof record.frequencyPenalty === 'number'
          ? { frequencyPenalty: record.frequencyPenalty }
          : {}),
        ...(typeof record.presencePenalty === 'number'
          ? { presencePenalty: record.presencePenalty }
          : {})
      };
    } catch {
      return null;
    }
  }
  private prepareSse(response: ChatResponseLike) {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();
  }
  private writeEvent(response: ChatResponseLike, event: string, data: Record<string, unknown>) {
    if (!response.writableEnded && !response.destroyed)
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  private estimateTokens(value: string) {
    return estimatePromptTextTokens(value);
  }
  private toGenerationTrace(
    compiled: CompiledPrompt,
    candidate: ModelGatewayConfig,
    parameters: CompanionPromptParameters,
    userMessageId: string,
    memoryRevisionIdUsed: string | null,
    worldBookRuntime: WorldBookRuntimeResult
  ): ProposedGenerationTrace {
    const capabilities = candidate.capabilities;
    const sections = compiled.sections.map((item) => ({
      sectionId: item.section.id,
      sectionKind: item.section.kind,
      sourceType: item.section.sourceType,
      sourceId: item.section.sourceId ?? null,
      sourceRevisionId: item.section.sourceRevisionId ?? null,
      contentHash: canonicalSha256(item.section.content),
      compactUsed: item.compactUsed,
      placement: item.section.placement,
      conversationRole: item.section.conversationRole ?? null,
      finalProviderRole: item.finalProviderRole,
      tokenEstimate: item.tokenEstimate,
      included: item.included,
      excludedReason: item.excludedReason
    }));
    const snapshot = {
      compilerVersion: compiled.compilerVersion,
      messages: compiled.messages,
      parameters,
      capabilities,
      sections
    };
    const includedWorldBooks = worldBookRuntime.includedWorldBooks.filter((trace) =>
      compiled.sections.some((item) => item.included && item.section.sourceId === trace.entryId)
    );
    const includedEntryIds = new Set(includedWorldBooks.map((trace) => trace.entryId));
    return {
      requestUserMessageId: userMessageId,
      rootUserMessageId: userMessageId,
      modelId: candidate.providerModelId ?? candidate.modelName,
      compilerVersion: compiled.compilerVersion,
      promptSnapshotJson: canonicalJson(snapshot),
      promptSnapshotHash: canonicalSha256(snapshot),
      capabilitiesSnapshotJson: canonicalJson(capabilities),
      modelParametersJson: canonicalJson(parameters),
      memoryRevisionIdUsed,
      includedWorldBooks,
      worldBookStateChanges: worldBookRuntime.stateChanges.filter(
        (change) =>
          includedEntryIds.has(change.entryId) || change.payload.sourceType === 'delay_pending'
      ),
      sections
    };
  }

  private toContextMessageFromCompanion(message: CompanionMessage): ChatMessageLike {
    return this.toContextMessage(
      message.companionId,
      message.id,
      message.role,
      message.content,
      message.status
    );
  }

  private toContextMessage(
    companionId: string,
    id: string,
    role: string,
    content: string,
    status = 'complete'
  ): ChatMessageLike {
    return { id, conversationId: companionId, role, content, status };
  }

  private activeMemoryContext(memory: OwnedCompanion['memory']) {
    if (!memory) return null;
    if (!memory.activeRevision || memory.status === 'stale') {
      return {
        isEnabled: memory.isEnabled,
        revisionId: memory.activeRevisionId,
        relationshipState: '',
        currentArc: '',
        status: memory.status
      };
    }
    try {
      const data = JSON.parse(memory.activeRevision.dataJson) as {
        relationshipSummary?: { content?: unknown };
        currentArc?: { content?: unknown };
      };
      return {
        isEnabled: memory.isEnabled,
        revisionId: memory.activeRevision.id,
        status: memory.status,
        relationshipState:
          typeof data.relationshipSummary?.content === 'string'
            ? data.relationshipSummary.content
            : '',
        currentArc: typeof data.currentArc?.content === 'string' ? data.currentArc.content : ''
      };
    } catch {
      return {
        isEnabled: memory.isEnabled,
        revisionId: memory.activeRevisionId,
        relationshipState: '',
        currentArc: '',
        status: memory.status
      };
    }
  }
  private errorCode(error: unknown, aborted: boolean): string {
    if (aborted) return 'COMPANION_CHAT_STOPPED';
    if (typeof error === 'object' && error !== null) {
      if ('code' in error && typeof error.code === 'string') return error.code;
      if ('getResponse' in error && typeof error.getResponse === 'function') {
        const response = error.getResponse() as unknown;
        if (
          typeof response === 'object' &&
          response !== null &&
          'code' in response &&
          typeof response.code === 'string'
        )
          return response.code;
      }
    }
    return 'COMPANION_CHAT_FAILED';
  }
  private toPublicEventMessage(message: CompanionMessage) {
    return {
      messageId: message.id,
      turnId: message.turnId,
      role: message.role,
      content: message.content,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString()
    };
  }
}
