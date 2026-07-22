export type TimelineTarget =
  | { type: 'conversation'; id: string }
  | { type: 'companion'; id: string };

export type TimelineTurnStatus = 'pending' | 'generating' | 'complete' | 'failed' | 'stopped';

export type TimelineMessage = {
  id: string;
  turnId: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  createdAt: string;
  deletedAt?: string | null;
};

export type TimelineTurn = {
  id: string;
  sequence: number;
  completedOrdinal: number | null;
  status: TimelineTurnStatus | string;
  userMessageId: string;
  activeAssistantMessageId: string | null;
  messages: TimelineMessage[];
};

export type ResolvedTimelineMessage = TimelineMessage & {
  source: 'user' | 'edited_user' | 'assistant' | 'imported_edited_assistant';
  canBridge: boolean;
  canProveMemory: boolean;
};

export type ResolvedTurn = {
  id: string;
  sequence: number;
  completedOrdinal: number | null;
  status: TimelineTurnStatus | string;
  user: ResolvedTimelineMessage;
  activeAssistant: ResolvedTimelineMessage | null;
  includedInPrompt: boolean;
  advancesDynamicState: boolean;
};

export type TimelinePolicy = {
  includeIncompleteUserMessages: boolean;
};

export interface TimelineResolver {
  resolve(target: TimelineTarget, policy?: Partial<TimelinePolicy>): Promise<ResolvedTurn[]>;
}

const DEFAULT_TIMELINE_POLICY: TimelinePolicy = {
  includeIncompleteUserMessages: false
};

const EXCLUDED_STATUSES = new Set(['deleted', 'replaced', 'failed', 'stopped', 'generating']);

/** Pure, deterministic timeline projection shared by both storage-specific resolvers. */
export function resolveTimelineTurns(
  turns: TimelineTurn[],
  policy: Partial<TimelinePolicy> = {}
): ResolvedTurn[] {
  const effectivePolicy = { ...DEFAULT_TIMELINE_POLICY, ...policy };
  return [...turns]
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
    .map((turn) => {
      const messages = turn.messages.filter(
        (message) => !message.deletedAt && !EXCLUDED_STATUSES.has(message.status)
      );
      const userMessage = messages.find((message) => message.id === turn.userMessageId);
      if (!userMessage || userMessage.role !== 'user') {
        return null;
      }
      const assistantMessage = turn.activeAssistantMessageId
        ? messages.find((message) => message.id === turn.activeAssistantMessageId)
        : undefined;
      const user = toResolvedMessage(userMessage);
      const activeAssistant =
        assistantMessage?.role === 'assistant' ? toResolvedMessage(assistantMessage) : null;
      const advancesDynamicState =
        turn.status === 'complete' && turn.completedOrdinal !== null && activeAssistant !== null;
      return {
        id: turn.id,
        sequence: turn.sequence,
        completedOrdinal: turn.completedOrdinal,
        status: turn.status,
        user,
        activeAssistant,
        includedInPrompt: advancesDynamicState || effectivePolicy.includeIncompleteUserMessages,
        advancesDynamicState
      } satisfies ResolvedTurn;
    })
    .filter((turn): turn is ResolvedTurn => turn !== null);
}

function toResolvedMessage(message: TimelineMessage): ResolvedTimelineMessage {
  if (message.role === 'user') {
    return {
      ...message,
      source: message.status === 'edited' ? 'edited_user' : 'user',
      canBridge: false,
      canProveMemory: true
    };
  }
  const importedEdited = message.status === 'edited';
  return {
    ...message,
    source: importedEdited ? 'imported_edited_assistant' : 'assistant',
    canBridge: !importedEdited,
    canProveMemory: !importedEdited
  };
}
