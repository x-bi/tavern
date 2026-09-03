import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { CompanionMessage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import { CompanionChatService } from './companion-chat.service';

export const COMPANION_PROACTIVE_IDLE_MS = 8 * 60 * 60 * 1000;
export const COMPANION_PROACTIVE_TIME_ZONE = 'Asia/Shanghai';
const SCAN_INTERVAL_MS = 60_000;

type ProactiveCandidateMessage = Pick<
  CompanionMessage,
  'id' | 'role' | 'status' | 'createdAt' | 'metadataJson'
>;

/** Scans memory-enabled Companion threads and starts at most one due proactive message per tick. */
@Injectable()
export class CompanionProactiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CompanionProactiveService.name);
  private readonly attemptedSourceIds = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private scanning = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanionChatService) private readonly chat: CompanionChatService
  ) {}

  onModuleInit(): void {
    void this.scanDue();
    this.timer = setInterval(() => void this.scanDue(), SCAN_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async scanDue(now = new Date()): Promise<void> {
    if (this.scanning || !isCompanionProactiveHour(now)) return;
    this.scanning = true;
    try {
      const companions = await this.prisma.companion.findMany({
        where: {
          deletedAt: null,
          user: { is: { isActive: true, deletedAt: null } },
          memory: {
            is: {
              isEnabled: true,
              isPaused: false,
              activeRevisionId: { not: null },
              status: { not: 'stale' }
            }
          }
        },
        include: {
          user: true,
          messages: {
            where: {
              deletedAt: null,
              role: { in: ['user', 'assistant'] },
              status: { in: ['complete', 'edited'] }
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1
          }
        },
        orderBy: { updatedAt: 'asc' }
      });

      for (const companion of companions) {
        const latest = companion.messages[0];
        if (!shouldStartCompanionProactive(latest, now) || this.attemptedSourceIds.has(latest.id))
          continue;
        this.attemptedSourceIds.add(latest.id);
        const owner: CurrentUser = {
          id: companion.user.id,
          username: companion.user.username,
          displayName: companion.user.displayName,
          role: companion.user.role as CurrentUser['role']
        };
        try {
          await this.chat.generateProactive(
            owner,
            companion.id,
            proactiveRequestId(latest.id, now)
          );
        } catch (error) {
          this.logger.warn(
            `Proactive generation skipped for companion ${companion.id}: ${safeErrorCode(error)}`
          );
        }
        break;
      }
    } finally {
      this.scanning = false;
    }
  }
}

export function shouldStartCompanionProactive(
  latest: ProactiveCandidateMessage | undefined,
  now: Date
): latest is ProactiveCandidateMessage {
  if (!latest || latest.role !== 'assistant' || latest.status !== 'complete') return false;
  if (isProactiveMessage(latest.metadataJson)) return false;
  return now.getTime() - latest.createdAt.getTime() >= COMPANION_PROACTIVE_IDLE_MS;
}

export function isCompanionProactiveHour(now: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: COMPANION_PROACTIVE_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(now)
  );
  return hour >= 8 && hour < 23;
}

export function proactiveRequestId(sourceMessageId: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: COMPANION_PROACTIVE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const day = `${value('year')}-${value('month')}-${value('day')}`;
  return `proactive:${sourceMessageId}:${day}`;
}

function isProactiveMessage(metadataJson: string | null): boolean {
  if (!metadataJson) return false;
  try {
    const metadata = JSON.parse(metadataJson) as { origin?: unknown };
    return metadata.origin === 'proactive';
  } catch {
    return false;
  }
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string')
    return error.code;
  return error instanceof Error ? error.name : 'UNKNOWN_ERROR';
}
