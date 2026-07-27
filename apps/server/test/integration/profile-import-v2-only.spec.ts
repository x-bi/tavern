import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CompanionsService } from '../../src/modules/companions/companions.service';
import { PersonasService } from '../../src/modules/personas/personas.service';
import type { CurrentUser } from '../../src/modules/users/user.types';
import { TestDatabase } from '../helpers/test-database';

const currentUser: CurrentUser = {
  id: 'profile_v2_user',
  username: 'profile-v2',
  displayName: 'Profile V2',
  role: 'user'
};

function makePersonaService(database: TestDatabase): PersonasService {
  return new PersonasService(
    database.client as unknown as never,
    {
      resolveAccess: async () => ({
        isManaged: false,
        owner: currentUser,
        ownerName: currentUser.displayName
      }),
      getOwnerNameMap: async () => new Map(),
      assertCanSetShared: async () => undefined,
      getOwner: async () => currentUser
    } as unknown as never,
    { shouldShowSensitiveContent: async () => true } as unknown as never
  );
}

function makeCompanionService(database: TestDatabase): CompanionsService {
  return new CompanionsService(
    database.client as unknown as never,
    {} as never,
    {} as never,
    { shouldShowSensitiveContent: async () => true } as unknown as never
  );
}

function isBadRequest(error: unknown): boolean {
  return error instanceof BadRequestException;
}

describe('Persona and Companion V2-only imports', () => {
  it('rejects Persona V1 and unknown root fields instead of ignoring them', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makePersonaService(database);
      for (const extra of [{ content: 'legacy' }, { surprise: true }]) {
        await expect(
          service.importJson(currentUser, {
            rawJson: JSON.stringify({
              formatVersion: 'tavern-lite.persona.v2',
              name: 'Strict Persona',
              coreIdentity: 'core',
              ...extra
            }),
            commit: false
          })
        ).rejects.toSatisfy(isBadRequest);
      }
    } finally {
      await database.close();
    }
  });

  it('rejects chara_card_v2 and Companion V1 fields', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeCompanionService(database);
      await expect(
        service.importJson(currentUser, {
          rawJson: JSON.stringify({
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: { name: 'External card' }
          }),
          commit: false
        })
      ).rejects.toSatisfy(isBadRequest);

      await expect(
        service.importJson(currentUser, {
          rawJson: JSON.stringify({
            formatVersion: 'tavern-lite.companion.v2',
            name: 'Strict Companion',
            identityPrompt: 'legacy'
          }),
          commit: false
        })
      ).rejects.toSatisfy(isBadRequest);
    } finally {
      await database.close();
    }
  });

  it('imports the exact Persona V2 and Companion V2 contracts', async () => {
    const database = await TestDatabase.create();
    try {
      await database.client.user.create({
        data: {
          id: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName
        }
      });
      const persona = await makePersonaService(database).importJson(currentUser, {
        rawJson: JSON.stringify({
          formatVersion: 'tavern-lite.persona.v2',
          name: 'V2 Persona',
          coreIdentity: 'core',
          background: 'background',
          interactionPreferences: 'preferences',
          metadata: {},
          isDefault: false
        }),
        commit: true
      });
      const companion = await makeCompanionService(database).importJson(currentUser, {
        rawJson: JSON.stringify({
          formatVersion: 'tavern-lite.companion.v2',
          name: 'V2 Companion',
          coreIdentity: 'core',
          personality: 'kind',
          speechStyle: 'natural',
          relationshipDefaults: 'friends'
        }),
        commit: true
      });

      expect(persona.persona).toMatchObject({
        coreIdentity: 'core',
        background: 'background',
        interactionPreferences: 'preferences'
      });
      expect(companion.companion).toMatchObject({
        coreIdentity: 'core',
        personality: 'kind',
        speechStyle: 'natural',
        relationshipDefaults: 'friends'
      });
    } finally {
      await database.close();
    }
  });
});
