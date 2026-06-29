const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ids = {
  user: 'seed_user_demo',
  modelConfig: 'seed_model_openai_compatible',
  promptPreset: 'seed_prompt_preset_balanced',
  persona: 'seed_persona_traveler',
  character: 'seed_character_librarian',
  worldBook: 'seed_worldbook_library',
  worldBookEntryArchives: 'seed_worldbook_entry_archives',
  worldBookEntryBell: 'seed_worldbook_entry_bell',
  settingSeedVersion: 'seed_setting_seed_version'
};

function json(value) {
  return JSON.stringify(value);
}

async function main() {
  const user = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {
      displayName: 'Demo User',
      isActive: true,
      deletedAt: null
    },
    create: {
      id: ids.user,
      username: 'demo',
      displayName: 'Demo User',
      passwordHash: null,
      isActive: true
    }
  });

  const modelConfig = await prisma.modelConfig.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'OpenAI-compatible Demo'
      }
    },
    update: {
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'demo-chat-model',
      apiKeyCiphertext: null,
      apiKeyMask: null,
      defaultParamsJson: json({
        temperature: 0.8,
        maxTokens: 1200,
        topP: 0.95
      }),
      isDefault: true,
      isEnabled: true,
      deletedAt: null
    },
    create: {
      id: ids.modelConfig,
      userId: user.id,
      name: 'OpenAI-compatible Demo',
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'demo-chat-model',
      apiKeyCiphertext: null,
      apiKeyMask: null,
      defaultParamsJson: json({
        temperature: 0.8,
        maxTokens: 1200,
        topP: 0.95
      }),
      isDefault: true,
      isEnabled: true
    }
  });

  const promptPreset = await prisma.promptPreset.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Balanced Roleplay'
      }
    },
    update: {
      description: 'Balanced defaults for character chat and prompt preview.',
      systemPrompt:
        'Stay in character, keep the scene coherent, and respond with concise but vivid prose.',
      outputRules:
        'Avoid exposing system details. Keep replies useful for a lightweight roleplay MVP.',
      parametersJson: json({
        temperature: 0.8,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1
      }),
      metadataJson: json({
        seed: true
      }),
      isDefault: true,
      deletedAt: null
    },
    create: {
      id: ids.promptPreset,
      userId: user.id,
      name: 'Balanced Roleplay',
      description: 'Balanced defaults for character chat and prompt preview.',
      systemPrompt:
        'Stay in character, keep the scene coherent, and respond with concise but vivid prose.',
      outputRules:
        'Avoid exposing system details. Keep replies useful for a lightweight roleplay MVP.',
      parametersJson: json({
        temperature: 0.8,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1
      }),
      metadataJson: json({
        seed: true
      }),
      isDefault: true
    }
  });

  const persona = await prisma.userPersona.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Curious Traveler'
      }
    },
    update: {
      content:
        'A calm traveler who asks practical questions, notices small details, and keeps a handwritten journal.',
      metadataJson: json({
        seed: true
      }),
      isDefault: true,
      deletedAt: null
    },
    create: {
      id: ids.persona,
      userId: user.id,
      name: 'Curious Traveler',
      content:
        'A calm traveler who asks practical questions, notices small details, and keeps a handwritten journal.',
      metadataJson: json({
        seed: true
      }),
      isDefault: true
    }
  });

  const character = await prisma.character.upsert({
    where: { id: ids.character },
    update: {
      userId: user.id,
      avatarAssetId: null,
      name: 'Mira, Keeper of the Lantern Archive',
      description:
        'A soft-spoken archive keeper who manages a quiet library built under an old hill.',
      personality:
        'Patient, observant, lightly teasing, and protective of forgotten stories.',
      scenario:
        'The user arrives at the Lantern Archive near closing time while rain taps against the glass roof.',
      firstMessage:
        'The brass bell above the archive door gives a tired chime. Mira looks up from a stack of weathered index cards and smiles. "You found us late, but not too late. What are you hoping to learn tonight?"',
      exampleMessagesJson: json([
        {
          role: 'user',
          content: 'What kind of place is this archive?'
        },
        {
          role: 'assistant',
          content:
            'A place for things that almost disappeared: maps with missing roads, letters never sent, and names people tried very hard to forget.'
        }
      ]),
      metadataJson: json({
        seed: true,
        tags: ['fantasy', 'mystery', 'cozy']
      }),
      isArchived: false,
      deletedAt: null
    },
    create: {
      id: ids.character,
      userId: user.id,
      name: 'Mira, Keeper of the Lantern Archive',
      description:
        'A soft-spoken archive keeper who manages a quiet library built under an old hill.',
      personality:
        'Patient, observant, lightly teasing, and protective of forgotten stories.',
      scenario:
        'The user arrives at the Lantern Archive near closing time while rain taps against the glass roof.',
      firstMessage:
        'The brass bell above the archive door gives a tired chime. Mira looks up from a stack of weathered index cards and smiles. "You found us late, but not too late. What are you hoping to learn tonight?"',
      exampleMessagesJson: json([
        {
          role: 'user',
          content: 'What kind of place is this archive?'
        },
        {
          role: 'assistant',
          content:
            'A place for things that almost disappeared: maps with missing roads, letters never sent, and names people tried very hard to forget.'
        }
      ]),
      metadataJson: json({
        seed: true,
        tags: ['fantasy', 'mystery', 'cozy']
      }),
      isArchived: false
    }
  });

  const worldBook = await prisma.worldBook.upsert({
    where: { id: ids.worldBook },
    update: {
      userId: user.id,
      characterId: character.id,
      name: 'Lantern Archive Notes',
      description: 'Small world details for the sample archive character.',
      isEnabled: true,
      scanDepth: 6,
      tokenBudget: 800,
      metadataJson: json({
        seed: true
      }),
      deletedAt: null
    },
    create: {
      id: ids.worldBook,
      userId: user.id,
      characterId: character.id,
      name: 'Lantern Archive Notes',
      description: 'Small world details for the sample archive character.',
      isEnabled: true,
      scanDepth: 6,
      tokenBudget: 800,
      metadataJson: json({
        seed: true
      })
    }
  });

  await prisma.worldBookEntry.upsert({
    where: { id: ids.worldBookEntryArchives },
    update: {
      worldBookId: worldBook.id,
      title: 'The Lantern Archive',
      content:
        'The Lantern Archive is an underground library that preserves records of abandoned places, missing families, and unfinished promises.',
      keywordsJson: json(['archive', 'library', 'lantern']),
      secondaryKeywordsJson: json(['record', 'map', 'letter']),
      isEnabled: true,
      priority: 20,
      position: 'before_history',
      tokenBudget: 180,
      caseSensitive: false,
      metadataJson: json({
        seed: true
      }),
      deletedAt: null
    },
    create: {
      id: ids.worldBookEntryArchives,
      worldBookId: worldBook.id,
      title: 'The Lantern Archive',
      content:
        'The Lantern Archive is an underground library that preserves records of abandoned places, missing families, and unfinished promises.',
      keywordsJson: json(['archive', 'library', 'lantern']),
      secondaryKeywordsJson: json(['record', 'map', 'letter']),
      isEnabled: true,
      priority: 20,
      position: 'before_history',
      tokenBudget: 180,
      caseSensitive: false,
      metadataJson: json({
        seed: true
      })
    }
  });

  await prisma.worldBookEntry.upsert({
    where: { id: ids.worldBookEntryBell },
    update: {
      worldBookId: worldBook.id,
      title: 'Brass Door Bell',
      content:
        'The archive door bell rings once for ordinary visitors and twice when someone carries a story that has been deliberately erased.',
      keywordsJson: json(['bell', 'door', 'chime']),
      secondaryKeywordsJson: json(['visitor', 'erased', 'story']),
      isEnabled: true,
      priority: 10,
      position: 'before_history',
      tokenBudget: 140,
      caseSensitive: false,
      metadataJson: json({
        seed: true
      }),
      deletedAt: null
    },
    create: {
      id: ids.worldBookEntryBell,
      worldBookId: worldBook.id,
      title: 'Brass Door Bell',
      content:
        'The archive door bell rings once for ordinary visitors and twice when someone carries a story that has been deliberately erased.',
      keywordsJson: json(['bell', 'door', 'chime']),
      secondaryKeywordsJson: json(['visitor', 'erased', 'story']),
      isEnabled: true,
      priority: 10,
      position: 'before_history',
      tokenBudget: 140,
      caseSensitive: false,
      metadataJson: json({
        seed: true
      })
    }
  });

  await prisma.appSetting.upsert({
    where: {
      scope_key: {
        scope: 'seed',
        key: 'version'
      }
    },
    update: {
      value: 'stage-6',
      valueType: 'string'
    },
    create: {
      id: ids.settingSeedVersion,
      userId: user.id,
      scope: 'seed',
      key: 'version',
      value: 'stage-6',
      valueType: 'string'
    }
  });

  console.log('Seed completed:', {
    user: user.username,
    modelConfig: modelConfig.name,
    promptPreset: promptPreset.name,
    persona: persona.name,
    character: character.name,
    worldBook: worldBook.name,
    worldBookEntries: 2
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
