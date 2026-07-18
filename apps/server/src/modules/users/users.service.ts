import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { ERROR_CODES } from '../../common/dto/error-codes';
import type { CurrentUser, UserRecord, UserRole } from './user.types';

type PresetUser = { username: string; displayName: string; password: string; role: UserRole };

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async syncPresetUsers(hashPassword: (value: string) => string): Promise<void> {
    await this.prisma.$transaction(
      this.getPresetUsers().map((user) =>
        this.prisma.user.upsert({
          where: { username: user.username },
          // 环境变量只负责首次建号；保留后台修改后的名称和密码。
          update: { isActive: true, deletedAt: null },
          create: {
            username: user.username,
            displayName: user.displayName.trim(),
            passwordHash: hashPassword(user.password),
            role: user.role,
            isActive: true
          }
        })
      )
    );
  }

  async findActiveByUsername(username: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { username, isActive: true, deletedAt: null },
      select: this.userSelect()
    });
    return user ? this.toUserRecord(user) : null;
  }

  async findActiveById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true, deletedAt: null },
      select: this.userSelect()
    });
    return user ? this.toUserRecord(user) : null;
  }

  async listForAdmin() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: this.managedUserSelect(),
      orderBy: { username: 'asc' }
    });
    const items = users.map((user) => this.toManagedUser(user));
    return { items, total: items.length, page: 1, pageSize: items.length };
  }

  async getForAdmin(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: this.managedUserSelect()
    });
    if (!user) this.throwUserNotFound();
    return this.toManagedUser(user);
  }

  async createManaged(
    input: { username: string; displayName: string; password: string; role: UserRole },
    hash: (value: string) => string
  ) {
    const username = input.username.trim();
    const exists = await this.prisma.user.findUnique({ where: { username } });
    if (exists) this.throwUsernameExists();
    const user = await this.prisma.user.create({
      data: {
        username,
        displayName: input.displayName.trim(),
        role: input.role,
        passwordHash: hash(input.password)
      },
      select: this.managedUserSelect()
    });
    return this.toManagedUser(user);
  }

  async updateManaged(
    id: string,
    input: { username?: string; displayName?: string; password?: string; role?: UserRole },
    hash: (value: string) => string
  ) {
    const exists = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!exists) this.throwUserNotFound();
    const builtIn = this.isBuiltIn(exists.username);
    const username = input.username?.trim();
    if (
      builtIn &&
      ((username && username !== exists.username) || (input.role && input.role !== exists.role))
    ) {
      throw new ForbiddenException({
        code: ERROR_CODES.USER_BUILT_IN_PROTECTED,
        message: '内置账号的账号名和角色不能修改。'
      });
    }
    if (username && username !== exists.username) {
      const duplicate = await this.prisma.user.findUnique({ where: { username } });
      if (duplicate) this.throwUsernameExists();
    }
    if (exists.role === 'admin' && input.role === 'member') {
      await this.assertAnotherAdminExists(id);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(username === undefined ? {} : { username }),
        ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }),
        ...(input.role === undefined ? {} : { role: input.role }),
        ...(input.password === undefined ? {} : { passwordHash: hash(input.password) })
      },
      select: this.managedUserSelect()
    });
    return this.toManagedUser(user);
  }

  async removeManaged(id: string) {
    const exists = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!exists) this.throwUserNotFound();
    if (this.isBuiltIn(exists.username)) {
      throw new ForbiddenException({
        code: ERROR_CODES.USER_BUILT_IN_PROTECTED,
        message: '内置账号不能删除。'
      });
    }
    if (exists.role === 'admin') await this.assertAnotherAdminExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    });
  }

  toCurrentUser(user: UserRecord): CurrentUser {
    return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
  }

  /** 模型配置为全站共享，统一归属到第一个内置管理员。 */
  async getSharedModelOwner(): Promise<CurrentUser> {
    const presetAdmin = this.getPresetUsers().find((user) => user.role === 'admin');
    const user = presetAdmin ? await this.findActiveByUsername(presetAdmin.username) : null;
    if (!user)
      throw new NotFoundException({
        code: ERROR_CODES.USER_NOT_FOUND,
        message: '共享模型管理员账号不存在。'
      });
    return this.toCurrentUser(user);
  }

  /** 共享内容库固定归属到第一个内置管理员，与普通 admin 角色账号区分。 */
  async getContentLibraryOwner(): Promise<CurrentUser> {
    const presetAdmin = this.getPresetUsers().find((user) => user.role === 'admin');
    const user = presetAdmin ? await this.findActiveByUsername(presetAdmin.username) : null;
    if (!user)
      throw new NotFoundException({
        code: ERROR_CODES.USER_NOT_FOUND,
        message: '共享内容库管理员账号不存在。'
      });
    return this.toCurrentUser(user);
  }

  async isContentLibraryOwner(user: CurrentUser): Promise<boolean> {
    return user.id === (await this.getContentLibraryOwner()).id;
  }

  /** 批量读取资源归属人名称，供管理员只读审计列表展示。 */
  async getDisplayNamesByIds(userIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, displayName: true }
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }

  private getPresetUsers(): PresetUser[] {
    return JSON.parse(
      this.configService.getOrThrow<string>('AUTH_PRESET_USERS_JSON')
    ) as PresetUser[];
  }
  private isBuiltIn(username: string): boolean {
    return this.getPresetUsers().some((user) => user.username === username);
  }
  private managedUserSelect() {
    return {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    } as const;
  }
  private toManagedUser(user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...user,
      role: user.role === 'admin' ? ('admin' as const) : ('member' as const),
      isBuiltIn: this.isBuiltIn(user.username)
    };
  }
  private async assertAnotherAdminExists(excludedId: string): Promise<void> {
    const count = await this.prisma.user.count({
      where: { id: { not: excludedId }, role: 'admin', isActive: true, deletedAt: null }
    });
    if (count === 0)
      throw new ForbiddenException({
        code: ERROR_CODES.USER_LAST_ADMIN_PROTECTED,
        message: '至少需要保留一个管理员账号。'
      });
  }
  private throwUserNotFound(): never {
    throw new NotFoundException({ code: ERROR_CODES.USER_NOT_FOUND, message: '成员账号不存在。' });
  }
  private throwUsernameExists(): never {
    throw new ConflictException({
      code: ERROR_CODES.USER_USERNAME_EXISTS,
      message: '账号已存在。'
    });
  }
  private userSelect() {
    return {
      id: true,
      username: true,
      displayName: true,
      passwordHash: true,
      isActive: true,
      role: true
    } as const;
  }
  private toUserRecord(user: {
    id: string;
    username: string;
    displayName: string;
    passwordHash: string | null;
    isActive: boolean;
    role: string;
  }): UserRecord {
    return { ...user, role: user.role === 'admin' ? 'admin' : 'member' };
  }
}
