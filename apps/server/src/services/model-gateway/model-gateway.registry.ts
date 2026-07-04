import { Injectable } from '@nestjs/common';

import type { ModelProviderAdapter, ModelProviderRegistry } from './types';

/**
 * 模型供应商适配器注册表：按供应商名查找对应适配器。
 *
 * 供应商名和别名都归一化（trim + toLowerCase）后作为 key，
 * 支持同一适配器注册多个别名（如 'openai' / 'gpt' 指向同一适配器）。
 */
@Injectable()
export class ModelGatewayRegistry implements ModelProviderRegistry {
  /** 供应商名/别名 → 适配器 的映射表。 */
  private readonly adapters = new Map<string, ModelProviderAdapter>();

  /**
   * 注册适配器：按 providerName 和 providerAliases 各存一份。
   * @param adapter 供应商适配器。
   */
  register(adapter: ModelProviderAdapter): void {
    // 主名注册
    this.adapters.set(this.normalizeProviderName(adapter.providerName), adapter);

    // 别名逐个注册（指向同一适配器）
    adapter.providerAliases?.forEach((alias) => {
      this.adapters.set(this.normalizeProviderName(alias), adapter);
    });
  }

  /**
   * 按供应商名取适配器。
   * @param providerName 供应商名（大小写不敏感）。
   * @returns 适配器，未注册返回 null。
   */
  get(providerName: string): ModelProviderAdapter | null {
    return this.adapters.get(this.normalizeProviderName(providerName)) ?? null;
  }

  /**
   * 判断供应商是否已注册。
   * @param providerName 供应商名（大小写不敏感）。
   * @returns 已注册返回 true。
   */
  has(providerName: string): boolean {
    return this.adapters.has(this.normalizeProviderName(providerName));
  }

  /**
   * 列出所有已注册的供应商名（去重，不含别名）。
   * @returns 供应商名数组。
   */
  listProviderNames(): string[] {
    // adapters 值含重复（别名指向同一适配器），用 Set 按 providerName 去重
    return [...new Set([...this.adapters.values()].map((adapter) => adapter.providerName))];
  }

  /**
   * 归一化供应商名：trim + toLowerCase（用于大小写不敏感查找）。
   * @param providerName 原始供应商名。
   * @returns 归一化后的 key。
   */
  private normalizeProviderName(providerName: string): string {
    return providerName.trim().toLowerCase();
  }
}
