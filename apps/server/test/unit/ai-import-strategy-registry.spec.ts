import { describe, expect, it } from 'vitest';

import { AiImportStrategyRegistry } from '../../src/modules/ai-imports/ai-import-strategy.registry';

describe('AiImportStrategyRegistry', () => {
  const registry = new AiImportStrategyRegistry();

  it('resolves legal selections in fixed backend order', () => {
    expect(
      registry
        .resolve(
          'character',
          'smart_optimize',
          ['preserve_source_language', 'preserve_source_facts'],
          ['generate_first_message']
        )
        .map((item) => item.id)
    ).toEqual(['preserve_source_facts', 'preserve_source_language', 'generate_first_message']);
  });

  it('rejects unknown, target-incompatible and mode-incompatible strategies', () => {
    expect(() => registry.resolve('character', 'smart_optimize', ['missing'], [])).toThrow(
      'Unknown strategy'
    );
    expect(() =>
      registry.resolve('persona', 'smart_optimize', [], ['generate_first_message'])
    ).toThrow('not supported');
    expect(() =>
      registry.resolve('character', 'fill_missing', ['optimize_existing_config'], [])
    ).toThrow('not supported');
  });

  it('rejects conflicts and missing dependencies', () => {
    expect(() =>
      registry.resolve(
        'character',
        'smart_optimize',
        ['optimize_existing_config', 'lock_existing_config'],
        []
      )
    ).toThrow('conflict');
    expect(() =>
      registry.resolve('world_book', 'smart_optimize', [], ['generate_secondary_keywords'])
    ).toThrow('requires');
  });

  it('never exposes promptRule through option metadata', () => {
    const option = registry.getOptions('world_book', 'smart_optimize')[0];
    expect(option).not.toHaveProperty('promptRule');
  });
});
