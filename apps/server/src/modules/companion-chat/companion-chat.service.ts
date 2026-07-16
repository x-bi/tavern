import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { CompanionMessage, PromptPreset, UserPersona } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanionPromptBuilderService } from '../../services/companion-prompt-builder/companion-prompt-builder.service';
import { ModelGatewayService } from '../../services/model-gateway';
import { CompanionMemoryService } from '../companion-memory/companion-memory.service';
import { ModelsService } from '../models/models.service';
import type { CurrentUser } from '../users/user.types';
import type { ChatResponseLike } from '../chat/chat.types';
import { StreamCompanionChatDto } from './dto/stream-companion-chat.dto';

type OwnedCompanion = Awaited<ReturnType<CompanionChatService['findOwned']>>;
const COMPANION_HISTORY_LIMIT = 20;

@Injectable()
export class CompanionChatService {
  private readonly tasks = new Map<string, AbortController>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanionPromptBuilderService) private readonly builder: CompanionPromptBuilderService,
    @Inject(ModelsService) private readonly models: ModelsService,
    @Inject(ModelGatewayService) private readonly gateway: ModelGatewayService,
    @Inject(CompanionMemoryService) private readonly memoryService: CompanionMemoryService
  ) {}

  async preview(user: CurrentUser, companionId: string, userInput: string) {
    const companion = await this.findOwned(user, companionId);
    const history = await this.listHistory(companionId, COMPANION_HISTORY_LIMIT);
    const candidates = await this.models.getGatewayCandidates({
      currentUser: user,
      modelFallbackGroupId: companion.modelFallbackGroupId ?? undefined
    });
    const result = this.builder.build(
      this.toPromptInput(companion, history, userInput, this.promptBudget(candidates[0]))
    );
    const revision = await this.prisma.companionMemoryRevision.findFirst({
      where: { companionId },
      orderBy: { version: 'desc' },
      select: { version: true }
    });
    return {
      ...result,
      memoryVersion: revision?.version ?? null,
      generatedAt: new Date().toISOString()
    };
  }

  async stream(
    user: CurrentUser,
    companionId: string,
    dto: StreamCompanionChatDto,
    response: ChatResponseLike
  ): Promise<void> {
    if (this.tasks.has(companionId))
      throw new ConflictException({
        code: 'COMPANION_CHAT_BUSY',
        message: 'Companion is already generating.'
      });
    const hasInput = Boolean(dto.userMessage?.trim());
    const hasRegenerate = Boolean(dto.regenerateMessageId);
    if (hasInput === hasRegenerate)
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Provide userMessage or regenerateMessageId.'
      });
    await this.findOwned(user, companionId);
    this.prepareSse(response);

    const abort = new AbortController();
    this.tasks.set(companionId, abort);
    const close = () => abort.abort();
    response.on('close', close);
    let assistant: CompanionMessage | null = null;
    let content = '';
    try {
      const companion = await this.findOwned(user, companionId);
      const prepared = dto.regenerateMessageId
        ? await this.prepareRegenerate(companionId, dto.regenerateMessageId)
        : await this.prepareNew(companionId, dto.userMessage!);
      assistant = prepared.assistant;
      const candidates = await this.models.getGatewayCandidates({
        currentUser: user,
        modelFallbackGroupId: companion.modelFallbackGroupId ?? undefined
      });
      if (!candidates.length)
        throw new BadRequestException({
          code: 'MODEL_FALLBACK_GROUP_NOT_READY',
          message: 'No callable model candidate.'
        });
      const built = this.builder.build(
        this.toPromptInput(
          companion,
          prepared.history,
          prepared.user.content,
          this.promptBudget(candidates[0])
        )
      );
      let finishReason: string | null = null;
      let succeeded = false;
      for (const candidate of candidates) {
        let emitted = false;
        try {
          for await (const event of this.gateway.streamChat(built.messages, {
            providerName: candidate.providerName,
            baseUrl: candidate.baseUrl,
            modelName: candidate.modelName,
            apiKey: candidate.apiKey,
            ...candidate.params,
            signal: abort.signal
          })) {
            if (event.type === 'delta') {
              emitted = true;
              content += event.text;
              this.writeEvent(response, 'delta', { text: event.text, messageId: assistant.id });
            }
            if (event.type === 'done') {
              finishReason = event.result.finishReason ?? null;
              succeeded = true;
            }
            if (event.type === 'error') {
              if (emitted) throw new Error(event.message);
              break;
            }
          }
        } catch (error) {
          if (emitted || abort.signal.aborted) throw error;
          continue;
        }
        if (succeeded) break;
      }
      if (!succeeded) throw new Error('All model candidates failed.');
      await this.prisma.companionMessage.update({
        where: { id: assistant.id },
        data: { content, status: 'complete', tokenCount: this.estimateTokens(content) }
      });
      this.writeEvent(response, 'done', { messageId: assistant.id, finishReason });
      void this.memoryService.maybeScheduleUpdate(user, companionId);
    } catch {
      const aborted = abort.signal.aborted;
      if (assistant)
        await this.prisma.companionMessage.update({
          where: { id: assistant.id },
          data: { content, status: aborted ? 'stopped' : 'failed' }
        });
      this.writeEvent(response, 'error', {
        code: aborted ? 'COMPANION_CHAT_STOPPED' : 'COMPANION_CHAT_FAILED',
        message: aborted ? 'Generation stopped.' : 'Companion generation failed.'
      });
    } finally {
      response.off('close', close);
      if (this.tasks.get(companionId) === abort) this.tasks.delete(companionId);
      if (!response.writableEnded) response.end();
    }
  }

  private async prepareNew(companionId: string, text: string) {
    const [user, assistant] = await this.prisma.$transaction([
      this.prisma.companionMessage.create({
        data: {
          companionId,
          role: 'user',
          content: text.trim(),
          status: 'complete',
          tokenCount: this.estimateTokens(text)
        }
      }),
      this.prisma.companionMessage.create({
        data: { companionId, role: 'assistant', content: '', status: 'generating' }
      })
    ]);
    return {
      user,
      assistant,
      history: await this.listHistory(companionId, COMPANION_HISTORY_LIMIT, [user.id, assistant.id])
    };
  }

  private async prepareRegenerate(companionId: string, id: string) {
    const messages = await this.listHistory(companionId, 200);
    const index = messages.findIndex((message) => message.id === id);
    const target = messages[index];
    if (!target || target.role !== 'assistant' || index !== messages.length - 1)
      throw new BadRequestException({
        code: 'COMPANION_MESSAGE_REGENERATE_INVALID',
        message: 'Only latest assistant message can be regenerated.'
      });
    const user = [...messages.slice(0, index)].reverse().find((message) => message.role === 'user');
    if (!user)
      throw new BadRequestException({
        code: 'COMPANION_MESSAGE_REGENERATE_INVALID',
        message: 'Previous user message not found.'
      });
    const assistant = await this.prisma.$transaction(async (tx) => {
      const replacement = await tx.companionMessage.create({
        data: {
          companionId,
          role: 'assistant',
          content: '',
          status: 'generating',
          metadataJson: JSON.stringify({ regenerateOfMessageId: id })
        }
      });
      await tx.companionMessage.update({
        where: { id },
        data: {
          status: 'deleted',
          deletedAt: new Date(),
          metadataJson: JSON.stringify({ regeneratedByMessageId: replacement.id })
        }
      });
      return replacement;
    });
    await this.memoryService.markStaleIfAffected(companionId, target);
    return {
      user,
      assistant,
      history: messages
        .filter((message) => message.id !== id && message.id !== user.id)
        .slice(-COMPANION_HISTORY_LIMIT)
    };
  }

  private async listHistory(companionId: string, take: number, exclude: string[] = []) {
    const messages = await this.prisma.companionMessage.findMany({
      where: {
        companionId,
        deletedAt: null,
        status: { in: ['complete', 'edited'] },
        ...(exclude.length ? { id: { notIn: exclude } } : {})
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take
    });
    return messages.reverse();
  }

  private async findOwned(user: CurrentUser, id: string) {
    const companion = await this.prisma.companion.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { persona: true, promptPreset: true, memory: true }
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
  ) {
    return {
      name: companion.name,
      identityPrompt: companion.identityPrompt,
      persona: this.personaText(companion.persona),
      preset: this.presetText(companion.promptPreset),
      memory: companion.memory,
      history: history
        .filter(
          (m): m is CompanionMessage & { role: 'user' | 'assistant' } =>
            m.role === 'user' || m.role === 'assistant'
        )
        .map((m) => ({ role: m.role, content: m.content })),
      userInput,
      maxPromptTokens
    };
  }
  private promptBudget(candidate?: {
    contextLength?: number | null;
    params: { maxTokens?: number };
  }) {
    return candidate?.contextLength
      ? Math.max(2000, candidate.contextLength - (candidate.params.maxTokens ?? 1200))
      : 8000;
  }
  private personaText(persona: UserPersona | null) {
    return persona ? persona.content : null;
  }
  private presetText(preset: PromptPreset | null) {
    return preset ? [preset.systemPrompt, preset.outputRules].filter(Boolean).join('\n') : null;
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
    return value.length ? Math.ceil(value.length / 4) : 0;
  }
}
