import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser, UserRecord } from './user.types';

/**
 * 用户服务：负责单用户模式下唯一 admin 用户的读写与转换。
 *
 * 依赖 PrismaService 操作数据库、ConfigService 读取单用户的配置项
 * （用户名、显示名）。
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {}

  /**
   * 确保存在唯一的 admin 用户：存在则更新，不存在则创建。
   *
   * @param passwordHash 密码哈希；免密模式传 null（用户记录不存密码）。
   * @returns 写入后的用户记录（含 passwordHash）。
   */
  async ensureSingleAdmin(passwordHash: string | null): Promise<UserRecord> {
    // 单用户模式的用户名与显示名都来自配置，未配置时用默认值
    const username = this.configService.get<string>('AUTH_SINGLE_USER_USERNAME') ?? 'demo';
    const displayName =
      this.configService.get<string>('AUTH_SINGLE_USER_DISPLAY_NAME') ?? 'Tavern Admin';

    return this.prisma.user.upsert({
      // 定位唯一用户：按用户名匹配（username 是唯一约束）
      where: { username },
      // 已存在则更新：把密码哈希、显示名同步成最新配置，并重新激活/取消软删除
      update: {
        displayName,
        passwordHash,
        isActive: true,
        deletedAt: null
      },
      // 不存在则创建：写入用户名、显示名、密码哈希，标记为活跃
      create: {
        username,
        displayName,
        passwordHash,
        isActive: true
      },
      // 只取需要的字段（含 passwordHash 供登录校验，不含 deletedAt）
      select: {
        id: true,
        username: true,
        displayName: true,
        passwordHash: true,
        isActive: true
      }
    });
  }

  /**
   * 按 id 查询活跃用户（已停用或软删除的不返回）。
   * @param id 用户 ID。
   * @returns 用户记录，无匹配或已停用返回 null。
   */
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

  /**
   * 数据库记录 → 对外的当前用户信息（剔除 passwordHash 等敏感字段）。
   * @param user 用户数据库记录。
   * @returns 安全的 CurrentUser。
   */
  toCurrentUser(user: UserRecord): CurrentUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      mode: 'single_user'
    };
  }
}
