const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ids = {
  user: 'seed_user_demo',
  modelProvider: 'seed_provider_openai_compatible',
  providerModel: 'seed_provider_model_demo_chat',
  fallbackGroup: 'seed_model_chain_default',
  fallbackCandidate: 'seed_model_chain_candidate_demo_chat',
  promptPreset: 'seed_prompt_preset_balanced',
  persona: 'seed_persona_traveler',
  character: 'seed_character_librarian',
  worldBook: 'seed_worldbook_library',
  worldBookEntryArchives: 'seed_worldbook_entry_archives',
  worldBookEntryArchivesRevision: 'seed_worldbook_entry_archives_revision_1',
  worldBookEntryBell: 'seed_worldbook_entry_bell',
  worldBookEntryBellRevision: 'seed_worldbook_entry_bell_revision_1',
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

  const modelProvider = await prisma.modelProvider.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'OpenAI-compatible Demo'
      }
    },
    update: {
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyCiphertext: null,
      apiKeyMask: null,
      timeout: null,
      isDefault: true,
      isEnabled: true,
      deletedAt: null
    },
    create: {
      id: ids.modelProvider,
      userId: user.id,
      name: 'OpenAI-compatible Demo',
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyCiphertext: null,
      apiKeyMask: null,
      timeout: null,
      isDefault: true,
      isEnabled: true
    }
  });

  const providerModel = await prisma.providerModel.upsert({
    where: {
      providerId_model: {
        providerId: modelProvider.id,
        model: 'demo-chat-model'
      }
    },
    update: {
      name: 'Demo Chat Model',
      defaultParamsJson: json({
        temperature: 0.8,
        maxTokens: 1200,
        topP: 0.95
      }),
      contextLength: null,
      notes: 'Seed model placeholder. Fill a real model name before use.',
      sortOrder: 0,
      isEnabled: true,
      deletedAt: null
    },
    create: {
      id: ids.providerModel,
      providerId: modelProvider.id,
      name: 'Demo Chat Model',
      model: 'demo-chat-model',
      defaultParamsJson: json({
        temperature: 0.8,
        maxTokens: 1200,
        topP: 0.95
      }),
      contextLength: null,
      notes: 'Seed model placeholder. Fill a real model name before use.',
      sortOrder: 0,
      isEnabled: true
    }
  });

  const fallbackGroup = await prisma.modelFallbackGroup.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Default Demo Model Chain'
      }
    },
    update: {
      isDefault: true,
      isEnabled: true,
      deletedAt: null
    },
    create: {
      id: ids.fallbackGroup,
      userId: user.id,
      name: 'Default Demo Model Chain',
      isDefault: true,
      isEnabled: true
    }
  });

  await prisma.modelFallbackCandidate.upsert({
    where: {
      groupId_modelId: {
        groupId: fallbackGroup.id,
        modelId: providerModel.id
      }
    },
    update: {
      priority: 1,
      isEnabled: true
    },
    create: {
      id: ids.fallbackCandidate,
      groupId: fallbackGroup.id,
      modelId: providerModel.id,
      priority: 1,
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
      instructionsJson: json(['Stay consistent with the current character and latest facts.']),
      outputRulesJson: json([
        {
          key: 'balanced_prose',
          content: 'Use concise but vivid prose suited to the current roleplay scene.',
          operation: 'add',
          sortOrder: 10
        }
      ]),
      generationPurposesJson: json(['chat_reply', 'regenerate', 'continue']),
      parametersJson: json({
        temperature: 0.8,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1
      }),
      metadataJson: json({
        seed: true
      }),
      isDefault: true,
      isSensitive: false,
      deletedAt: null
    },
    create: {
      id: ids.promptPreset,
      userId: user.id,
      name: 'Balanced Roleplay',
      description: 'Balanced defaults for character chat and prompt preview.',
      instructionsJson: json(['Stay consistent with the current character and latest facts.']),
      outputRulesJson: json([
        {
          key: 'balanced_prose',
          content: 'Use concise but vivid prose suited to the current roleplay scene.',
          operation: 'add',
          sortOrder: 10
        }
      ]),
      generationPurposesJson: json(['chat_reply', 'regenerate', 'continue']),
      parametersJson: json({
        temperature: 0.8,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1
      }),
      metadataJson: json({
        seed: true
      }),
      isDefault: true,
      isSensitive: false
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
      coreIdentity:
        'A calm traveler who asks practical questions, notices small details, and keeps a handwritten journal.',
      background: '',
      interactionPreferences: '',
      metadataJson: json({
        seed: true
      }),
      isDefault: true,
      isSensitive: false,
      deletedAt: null
    },
    create: {
      id: ids.persona,
      userId: user.id,
      name: 'Curious Traveler',
      coreIdentity:
        'A calm traveler who asks practical questions, notices small details, and keeps a handwritten journal.',
      background: '',
      interactionPreferences: '',
      metadataJson: json({
        seed: true
      }),
      isDefault: true,
      isSensitive: false
    }
  });

  const character = await prisma.character.upsert({
    where: { id: ids.character },
    update: {
      userId: user.id,
      avatarAssetId: null,
      name: 'Mira, Keeper of the Lantern Archive',
      coreIdentity:
        'A soft-spoken archive keeper who manages a quiet library built under an old hill.',
      personality: 'Patient, observant, lightly teasing, and protective of forgotten stories.',
      persistentPremise: 'She protects forgotten stories and the people connected to them.',
      initialScenario:
        'The user arrives at the Lantern Archive near closing time while rain taps against the glass roof.',
      extendedBackground: '',
      characterRules: '',
      speechStyle: 'Soft-spoken and observant, with light teasing.',
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
      isSensitive: false,
      isArchived: false,
      deletedAt: null
    },
    create: {
      id: ids.character,
      userId: user.id,
      name: 'Mira, Keeper of the Lantern Archive',
      coreIdentity:
        'A soft-spoken archive keeper who manages a quiet library built under an old hill.',
      personality: 'Patient, observant, lightly teasing, and protective of forgotten stories.',
      persistentPremise: 'She protects forgotten stories and the people connected to them.',
      initialScenario:
        'The user arrives at the Lantern Archive near closing time while rain taps against the glass roof.',
      extendedBackground: '',
      characterRules: '',
      speechStyle: 'Soft-spoken and observant, with light teasing.',
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
      isSensitive: false,
      isArchived: false
    }
  });

  const worldBook = await prisma.worldBook.upsert({
    where: { id: ids.worldBook },
    update: {
      userId: user.id,
      name: 'Lantern Archive Notes',
      description: 'Small world details for the sample archive character.',
      isEnabled: true,
      scanDepth: 6,
      tokenBudget: 800,
      metadataJson: json({
        seed: true
      }),
      isSensitive: false,
      deletedAt: null,
      characterLinks: {
        deleteMany: {},
        create: { characterId: character.id }
      }
    },
    create: {
      id: ids.worldBook,
      userId: user.id,
      name: 'Lantern Archive Notes',
      description: 'Small world details for the sample archive character.',
      isEnabled: true,
      scanDepth: 6,
      tokenBudget: 800,
      metadataJson: json({
        seed: true
      }),
      isSensitive: false,
      characterLinks: {
        create: { characterId: character.id }
      }
    }
  });

  const archiveEntry = await prisma.worldBookEntry.upsert({
    where: { id: ids.worldBookEntryArchives },
    update: {
      worldBookId: worldBook.id,
      isEnabled: true,
      deletedAt: null
    },
    create: {
      id: ids.worldBookEntryArchives,
      worldBookId: worldBook.id,
      isEnabled: true
    }
  });

  const archiveRevision = await prisma.worldBookEntryRevision.upsert({
    where: { id: ids.worldBookEntryArchivesRevision },
    update: {
      configJson: json({
        title: 'The Lantern Archive',
        contentType: 'lore',
        trustLevel: 'user_authored',
        activationMode: 'keyword',
        matchMode: 'normalized_phrase',
        primaryKeywords: ['archive', 'library', 'lantern'],
        primaryLogic: 'any',
        secondaryKeywords: ['record', 'map', 'letter'],
        secondaryLogic: 'and_any',
        excludeKeywords: [],
        sameMessageOnly: true,
        scanSources: ['current_user', 'user_history', 'assistant_latest'],
        userHistoryScanDepth: 6,
        stickyTurns: 0,
        continuationTurns: 1,
        cooldownTurns: 0,
        delayTurns: 0,
        cooldownPolicy: 'strict',
        generationPurposes: ['chat_reply', 'regenerate', 'continue'],
        budgetPriority: 20,
        sortOrder: 20,
        placement: 'before_history',
        maxTokens: 180
      }),
      content:
        'The Lantern Archive is an underground library that preserves records of abandoned places, missing families, and unfinished promises.',
      contentHash: 'c9b0b53e712828ad22c748eeab566a886a17477df90ad04655bc1446f2ad0bfe'
    },
    create: {
      id: ids.worldBookEntryArchivesRevision,
      entryId: archiveEntry.id,
      version: 1,
      configJson: json({
        title: 'The Lantern Archive',
        contentType: 'lore',
        trustLevel: 'user_authored',
        activationMode: 'keyword',
        matchMode: 'normalized_phrase',
        primaryKeywords: ['archive', 'library', 'lantern'],
        primaryLogic: 'any',
        secondaryKeywords: ['record', 'map', 'letter'],
        secondaryLogic: 'and_any',
        excludeKeywords: [],
        sameMessageOnly: true,
        scanSources: ['current_user', 'user_history', 'assistant_latest'],
        userHistoryScanDepth: 6,
        stickyTurns: 0,
        continuationTurns: 1,
        cooldownTurns: 0,
        delayTurns: 0,
        cooldownPolicy: 'strict',
        generationPurposes: ['chat_reply', 'regenerate', 'continue'],
        budgetPriority: 20,
        sortOrder: 20,
        placement: 'before_history',
        maxTokens: 180
      }),
      content:
        'The Lantern Archive is an underground library that preserves records of abandoned places, missing families, and unfinished promises.',
      contentHash: 'c9b0b53e712828ad22c748eeab566a886a17477df90ad04655bc1446f2ad0bfe'
    }
  });
  await prisma.worldBookEntry.update({
    where: { id: archiveEntry.id },
    data: { activeRevisionId: archiveRevision.id }
  });

  const bellEntry = await prisma.worldBookEntry.upsert({
    where: { id: ids.worldBookEntryBell },
    update: {
      worldBookId: worldBook.id,
      isEnabled: true,
      deletedAt: null
    },
    create: {
      id: ids.worldBookEntryBell,
      worldBookId: worldBook.id,
      isEnabled: true
    }
  });

  const bellConfig = {
    title: 'Brass Door Bell',
    contentType: 'lore',
    trustLevel: 'user_authored',
    activationMode: 'keyword',
    matchMode: 'normalized_phrase',
    primaryKeywords: ['bell', 'door', 'chime'],
    primaryLogic: 'any',
    secondaryKeywords: ['visitor', 'erased', 'story'],
    secondaryLogic: 'and_any',
    excludeKeywords: [],
    sameMessageOnly: true,
    scanSources: ['current_user', 'user_history', 'assistant_latest'],
    userHistoryScanDepth: 6,
    stickyTurns: 0,
    continuationTurns: 1,
    cooldownTurns: 0,
    delayTurns: 0,
    cooldownPolicy: 'strict',
    generationPurposes: ['chat_reply', 'regenerate', 'continue'],
    budgetPriority: 10,
    sortOrder: 10,
    placement: 'before_history',
    maxTokens: 140
  };
  const bellContent =
    'The archive door bell rings once for ordinary visitors and twice when someone carries a story that has been deliberately erased.';
  const bellRevision = await prisma.worldBookEntryRevision.upsert({
    where: { id: ids.worldBookEntryBellRevision },
    update: {
      configJson: json(bellConfig),
      content: bellContent,
      contentHash: '5d83f553d81cee3e4d6e35ff0a5fc8330c03a84e439560c69744e4ef659ce6d9'
    },
    create: {
      id: ids.worldBookEntryBellRevision,
      entryId: bellEntry.id,
      version: 1,
      configJson: json(bellConfig),
      content: bellContent,
      contentHash: '5d83f553d81cee3e4d6e35ff0a5fc8330c03a84e439560c69744e4ef659ce6d9'
    }
  });
  await prisma.worldBookEntry.update({
    where: { id: bellEntry.id },
    data: { activeRevisionId: bellRevision.id }
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
    modelChain: fallbackGroup.name,
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
