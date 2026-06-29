import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser, UserRecord } from './user.types';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {}

  async ensureSingleAdmin(passwordHash: string | null): Promise<UserRecord> {
    const username = this.configService.get<string>('AUTH_SINGLE_USER_USERNAME') ?? 'demo';
    const displayName =
      this.configService.get<string>('AUTH_SINGLE_USER_DISPLAY_NAME') ?? 'Tavern Admin';

    return this.prisma.user.upsert({
      where: { username },
      update: {
        displayName,
        passwordHash,
        isActive: true,
        deletedAt: null
      },
      create: {
        username,
        displayName,
        passwordHash,
        isActive: true
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        passwordHash: true,
        isActive: true
      }
    });
  }

  async findActiveById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        passwordHash: true,
        isActive: true
      }
    });
  }

  toCurrentUser(user: UserRecord): CurrentUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      mode: 'single_user'
    };
  }
}
