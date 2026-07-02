import { defineStore } from 'pinia';

import {
  fetchApplicationSettings,
  SettingsApiUnsupportedError,
  updateApplicationSettings,
  type ApplicationSettings
} from '../api/settings';

const STORAGE_KEY = 'tavern-lite.application-settings';

export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = {
  workspaceName: 'Tavern Lite',
  autoOpenLastConversation: true,
  compactListMode: false,
  defaultHistoryLimit: 20
};

type SettingSource = 'api' | 'local';

type SettingState = {
  data: ApplicationSettings;
  source: SettingSource;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
};

export const useSettingStore = defineStore('setting', {
  state: (): SettingState => ({
    data: { ...DEFAULT_APPLICATION_SETTINGS },
    source: 'local',
    loading: false,
    saving: false,
    error: null,
    saveError: null
  }),
  actions: {
    async loadSettings() {
      this.loading = true;
      this.error = null;

      try {
        this.data = normalizeSettings(await fetchApplicationSettings());
        this.source = 'api';
      } catch (error) {
        if (error instanceof SettingsApiUnsupportedError) {
          this.data = readLocalSettings();
          this.source = 'local';
        } else {
          this.error = error instanceof Error ? error.message : '应用设置加载失败。';
          this.data = readLocalSettings();
          this.source = 'local';
        }
      } finally {
        this.loading = false;
      }
    },
    async saveSettings(payload: ApplicationSettings): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      const nextSettings = normalizeSettings(payload);

      try {
        if (this.source === 'api') {
          this.data = normalizeSettings(await updateApplicationSettings(nextSettings));
        } else {
          writeLocalSettings(nextSettings);
          this.data = nextSettings;
        }

        return true;
      } catch (error) {
        if (error instanceof SettingsApiUnsupportedError) {
          writeLocalSettings(nextSettings);
          this.source = 'local';
          this.data = nextSettings;

          return true;
        }

        this.saveError = error instanceof Error ? error.message : '应用设置保存失败。';

        return false;
      } finally {
        this.saving = false;
      }
    }
  }
});

function readLocalSettings(): ApplicationSettings {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { ...DEFAULT_APPLICATION_SETTINGS };
  }

  try {
    return normalizeSettings(JSON.parse(raw) as Partial<ApplicationSettings>);
  } catch {
    return { ...DEFAULT_APPLICATION_SETTINGS };
  }
}

function writeLocalSettings(settings: ApplicationSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function normalizeSettings(settings: Partial<ApplicationSettings>): ApplicationSettings {
  return {
    workspaceName:
      typeof settings.workspaceName === 'string' && settings.workspaceName.trim()
        ? settings.workspaceName.trim()
        : DEFAULT_APPLICATION_SETTINGS.workspaceName,
    autoOpenLastConversation:
      typeof settings.autoOpenLastConversation === 'boolean'
        ? settings.autoOpenLastConversation
        : DEFAULT_APPLICATION_SETTINGS.autoOpenLastConversation,
    compactListMode:
      typeof settings.compactListMode === 'boolean'
        ? settings.compactListMode
        : DEFAULT_APPLICATION_SETTINGS.compactListMode,
    defaultHistoryLimit: clampHistoryLimit(settings.defaultHistoryLimit)
  };
}

function clampHistoryLimit(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_APPLICATION_SETTINGS.defaultHistoryLimit;
  }

  return Math.min(100, Math.max(5, Math.round(value)));
}
