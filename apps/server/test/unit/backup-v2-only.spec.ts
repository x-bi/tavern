import { describe, expect, it } from 'vitest';

import { BackupsService } from '../../src/modules/backups/backups.service';

type BackupV2Harness = {
  parseBackup(rawJson: string): unknown;
  toCharacterImportInput(
    currentUser: { id: string },
    record: Record<string, unknown>,
    path: string,
    assetIds: Set<string>,
    warnings: string[]
  ): unknown;
  toPromptPresetImportInput(
    currentUser: { id: string },
    record: Record<string, unknown>,
    path: string
  ): unknown;
  toPersonaImportInput(
    currentUser: { id: string },
    record: Record<string, unknown>,
    path: string
  ): unknown;
};

const harness = Object.create(BackupsService.prototype) as BackupV2Harness;
const user = { id: 'backup-v2-user' };

describe('backup V2-only field contracts', () => {
  it('rejects unknown root fields', () => {
    expect(() =>
      harness.parseBackup(
        JSON.stringify({
          formatVersion: 'tavern-lite.backup.v2',
          surprise: true
        })
      )
    ).toThrow(/surprise is not supported/);
  });

  it('rejects removed profile and preset columns before restoring records', () => {
    expect(() =>
      harness.toCharacterImportInput(
        user,
        { description: 'legacy', scenario: 'legacy' },
        'data.characters[0]',
        new Set(),
        []
      )
    ).toThrow(/description is not supported/);
    expect(() =>
      harness.toPersonaImportInput(user, { content: 'legacy' }, 'data.personas[0]')
    ).toThrow(/content is not supported/);
    expect(() =>
      harness.toPromptPresetImportInput(
        user,
        { systemPrompt: 'legacy', outputRulesJson: '[]' },
        'data.promptPresets[0]'
      )
    ).toThrow(/systemPrompt is not supported/);
  });
});
