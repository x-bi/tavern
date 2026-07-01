import { Injectable } from '@nestjs/common';

import type { ModelProviderAdapter, ModelProviderRegistry } from './types';

@Injectable()
export class ModelGatewayRegistry implements ModelProviderRegistry {
  private readonly adapters = new Map<string, ModelProviderAdapter>();

  register(adapter: ModelProviderAdapter): void {
    this.adapters.set(this.normalizeProviderName(adapter.providerName), adapter);

    adapter.providerAliases?.forEach((alias) => {
      this.adapters.set(this.normalizeProviderName(alias), adapter);
    });
  }

  get(providerName: string): ModelProviderAdapter | null {
    return this.adapters.get(this.normalizeProviderName(providerName)) ?? null;
  }

  has(providerName: string): boolean {
    return this.adapters.has(this.normalizeProviderName(providerName));
  }

  listProviderNames(): string[] {
    return [...new Set([...this.adapters.values()].map((adapter) => adapter.providerName))];
  }

  private normalizeProviderName(providerName: string): string {
    return providerName.trim().toLowerCase();
  }
}
