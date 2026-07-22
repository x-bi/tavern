import { Injectable } from '@nestjs/common';
import type { CompanionMessage, Message } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type StorageMessage = {
  id: string;
  role: string;
  content: string;
  status: string;
  deletedAt: Date | null;
};

type StorageTurn<TMessage extends StorageMessage> = {
  id: string;
  sequence: number;
  completedOrdinal: number | null;
  status: string;
  userMessageId: string;
  activeAssistantMessageId: string | null;
  messages: TMessage[];
};

export type TimelineMessageQuery = {
  includeIncompleteUserMessages?: boolean;
  /** Prompt 可显示导入的 edited assistant，但长期记忆证据必须关闭此项。 */
  allowImportedEditedAssistant?: boolean;
  excludeIds?: string[];
  take?: number;
};

export type ResolvedStorageTurn = {
  id: string;
  sequence: number;
  completedOrdinal: number | null;
  status: string;
  user: {
    id: string;
    role: string;
    content: string;
    status: string;
    source: 'user' | 'edited_user';
  };
  activeAssistant: {
    id: string;
    role: string;
    content: string;
    status: string;
    source: 'assistant' | 'imported_edited_assistant';
    canBridge: boolean;
    canProveMemory: boolean;
  } | null;
  includedInPrompt: boolean;
  advancesDynamicState: boolean;
};

@Injectable()
export class ConversationTimelineService {
  constructor(private readonly prisma: PrismaService) {}
  async resolve(
    conversationId: string,
    includeIncompleteUserMessages = false
  ): Promise<ResolvedStorageTurn[]> {
    const turns = await this.prisma.conversationTurn.findMany({
      where: { conversationId },
      include: { messages: true },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }]
    });
    return resolveRows(turns, includeIncompleteUserMessages);
  }

  async listPromptMessages(
    conversationId: string,
    query: TimelineMessageQuery = {}
  ): Promise<Message[]> {
    const turns = await this.prisma.conversationTurn.findMany({
      where: { conversationId },
      include: { messages: true },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }]
    });
    return selectTimelineMessages(turns, query);
  }
}

@Injectable()
export class CompanionTimelineService {
  constructor(private readonly prisma: PrismaService) {}
  async resolve(
    companionId: string,
    includeIncompleteUserMessages = false
  ): Promise<ResolvedStorageTurn[]> {
    const turns = await this.prisma.companionTurn.findMany({
      where: { companionId },
      include: { messages: true },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }]
    });
    return resolveRows(turns, includeIncompleteUserMessages);
  }

  async listPromptMessages(
    companionId: string,
    query: TimelineMessageQuery = {}
  ): Promise<CompanionMessage[]> {
    const turns = await this.prisma.companionTurn.findMany({
      where: { companionId },
      include: { messages: true },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }]
    });
    return selectTimelineMessages(turns, query);
  }

  /** Memory evidence excludes imported edits and assistants generated from the active revision. */
  async listMemoryEvidenceMessages(
    companionId: string,
    activeMemoryRevisionId: string | null
  ): Promise<CompanionMessage[]> {
    const turns = await this.prisma.companionTurn.findMany({
      where: { companionId },
      include: {
        messages: {
          include: {
            generationTrace: { select: { memoryRevisionIdUsed: true } }
          }
        }
      },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }]
    });
    return selectTimelineMessages(turns, {
      allowImportedEditedAssistant: false
    }).filter(
      (message) =>
        message.role === 'user' ||
        !activeMemoryRevisionId ||
        message.generationTrace?.memoryRevisionIdUsed !== activeMemoryRevisionId
    );
  }
}

export function resolveRows<TMessage extends StorageMessage>(
  turns: Array<StorageTurn<TMessage>>,
  includeIncompleteUserMessages: boolean
): ResolvedStorageTurn[] {
  const excluded = new Set(['deleted', 'replaced', 'failed', 'stopped', 'generating']);
  return turns.flatMap((turn) => {
    const valid = turn.messages.filter(
      (message) => !message.deletedAt && !excluded.has(message.status)
    );
    const user = valid.find(
      (message) => message.id === turn.userMessageId && message.role === 'user'
    );
    if (!user) return [];
    const assistant = valid.find(
      (message) => message.id === turn.activeAssistantMessageId && message.role === 'assistant'
    );
    const importedEdited = assistant?.status === 'edited';
    const advancesDynamicState =
      turn.status === 'complete' && turn.completedOrdinal !== null && Boolean(assistant);
    return [
      {
        id: turn.id,
        sequence: turn.sequence,
        completedOrdinal: turn.completedOrdinal,
        status: turn.status,
        user: {
          id: user.id,
          role: user.role,
          content: user.content,
          status: user.status,
          source: user.status === 'edited' ? 'edited_user' : 'user'
        },
        activeAssistant: assistant
          ? {
              id: assistant.id,
              role: assistant.role,
              content: assistant.content,
              status: assistant.status,
              source: importedEdited ? 'imported_edited_assistant' : 'assistant',
              canBridge: !importedEdited,
              canProveMemory: !importedEdited
            }
          : null,
        includedInPrompt: advancesDynamicState || includeIncompleteUserMessages,
        advancesDynamicState
      }
    ];
  });
}

/** Returns the same effective message timeline for Prompt, Preview, matcher and memory callers. */
export function selectTimelineMessages<TMessage extends StorageMessage>(
  turns: Array<StorageTurn<TMessage>>,
  query: TimelineMessageQuery = {}
): TMessage[] {
  const excludedIds = new Set(query.excludeIds ?? []);
  const resolved = resolveRows(turns, query.includeIncompleteUserMessages ?? false);
  const messageById = new Map(
    turns.flatMap((turn) => turn.messages).map((message) => [message.id, message] as const)
  );
  const messages = resolved.flatMap((turn) => {
    if (!turn.includedInPrompt) return [];
    const user = messageById.get(turn.user.id);
    const assistant = turn.activeAssistant ? messageById.get(turn.activeAssistant.id) : undefined;
    const memorySafeAssistant =
      assistant?.status === 'edited' && query.allowImportedEditedAssistant === false
        ? undefined
        : assistant;
    return [user, memorySafeAssistant].filter(
      (message): message is TMessage => message !== undefined && !excludedIds.has(message.id)
    );
  });
  return query.take === undefined ? messages : messages.slice(-Math.max(0, query.take));
}
