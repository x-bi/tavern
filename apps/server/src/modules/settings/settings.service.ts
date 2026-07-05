import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type { UpdateApplicationSettingsDto } from './dto/update-application-settings.dto';
import type { ApplicationSettings } from './settings.types';

const APPLICATION_SETTINGS_KEY = 'application';
const APPLICATION_SETTINGS_VALUE_TYPE = 'json';

export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = {
  workspaceName: 'Tavern Lite',
  autoOpenLastConversation: true,
  compactListMode: false,
  defaultHistoryLimit: 20,
  showSensitiveContent: false
};

/** 应用设置服务：使用 AppSetting 保存用户级轻量 JSON 设置。 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /** 读取当前用户应用设置；没有记录时返回默认值。 */
  async getApplicationSettings(currentUser: CurrentUser): Promise<ApplicationSettings> {
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        scope_key: {
          scope: this.scopeForUser(currentUser),
          key: APPLICATION_SETTINGS_KEY
        }
      }
    });

    return this.normalizeSettings(this.parseRecord(setting?.value ?? null));
  }

  /** 更新当前用户应用设置；未传字段沿用现有值。 */
  async updateApplicationSettings(
    currentUser: CurrentUser,
    dto: UpdateApplicationSettingsDto
  ): Promise<ApplicationSettings> {
    const nextSettings = this.normalizeSettings({
      ...(await this.getApplicationSettings(currentUser)),
      ...dto
    });

    await this.prisma.appSetting.upsert({
      where: {
        scope_key: {
          scope: this.scopeForUser(currentUser),
          key: APPLICATION_SETTINGS_KEY
        }
      },
      update: {
        userId: currentUser.id,
        value: JSON.stringify(nextSettings),
        valueType: APPLICATION_SETTINGS_VALUE_TYPE
      },
      create: {
        userId: currentUser.id,
        scope: this.scopeForUser(currentUser),
        key: APPLICATION_SETTINGS_KEY,
        value: JSON.stringify(nextSettings),
        valueType: APPLICATION_SETTINGS_VALUE_TYPE
      }
    });

    return nextSettings;
  }

  /** 当前用户是否允许显示和使用敏感资源。 */
  async shouldShowSensitiveContent(currentUser: CurrentUser): Promise<boolean> {
    return (await this.getApplicationSettings(currentUser)).showSensitiveContent;
  }

  private scopeForUser(currentUser: CurrentUser): string {
    return `user:${currentUser.id}`;
  }

  private normalizeSettings(settings: Partial<ApplicationSettings> | null): ApplicationSettings {
    return {
      workspaceName:
        typeof settings?.workspaceName === 'string' && settings.workspaceName.trim()
          ? settings.workspaceName.trim()
          : DEFAULT_APPLICATION_SETTINGS.workspaceName,
      autoOpenLastConversation:
        typeof settings?.autoOpenLastConversation === 'boolean'
          ? settings.autoOpenLastConversation
          : DEFAULT_APPLICATION_SETTINGS.autoOpenLastConversation,
      compactListMode:
        typeof settings?.compactListMode === 'boolean'
          ? settings.compactListMode
          : DEFAULT_APPLICATION_SETTINGS.compactListMode,
      defaultHistoryLimit: this.clampHistoryLimit(settings?.defaultHistoryLimit),
      showSensitiveContent:
        typeof settings?.showSensitiveContent === 'boolean'
          ? settings.showSensitiveContent
          : DEFAULT_APPLICATION_SETTINGS.showSensitiveContent
    };
  }

  private clampHistoryLimit(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return DEFAULT_APPLICATION_SETTINGS.defaultHistoryLimit;
    }

    return Math.min(100, Math.max(5, Math.round(value)));
  }

  private parseRecord(value: string | null): Partial<ApplicationSettings> | null {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Partial<ApplicationSettings>)
        : null;
    } catch {
      return null;
    }
  }
}
