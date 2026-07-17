import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CompanionPromptBuilderService } from '../apps/server/src/services/companion-prompt-builder/companion-prompt-builder.service';
import { PromptBuilderService } from '../apps/server/src/services/prompt-builder/prompt-builder.service';
import { estimatePromptTextTokens } from '../apps/server/src/services/prompt-builder/token-estimator';
import type {
  BuildPromptInput,
  WorldBookContext
} from '../apps/server/src/services/prompt-builder/types';

const builder = new PromptBuilderService();
const companionBuilder = new CompanionPromptBuilderService();

function input(overrides: Partial<BuildPromptInput> = {}): BuildPromptInput {
  return {
    userId: 'user-1',
    conversation: {
      id: 'conversation-1',
      userId: 'user-1',
      characterId: 'character-1',
      title: 'Test'
    },
    character: {
      id: 'character-1',
      name: 'Mira',
      description: 'Lantern keeper',
      personality: 'Calm and observant',
      scenario: 'Inside the archive',
      firstMessage: 'Welcome.',
      exampleMessages: [
        {
          id: 'example-user',
          conversationId: 'conversation-1',
          role: 'user',
          content: 'Is the archive still open?'
        },
        {
          id: 'example-character',
          conversationId: 'conversation-1',
          role: 'assistant',
          content: 'For a careful traveler, perhaps.'
        }
      ]
    },
    persona: {
      id: 'persona-1',
      name: 'Traveler',
      content: 'A careful traveler.'
    },
    promptPreset: {
      id: 'preset-1',
      name: 'Legacy preset',
      description: '',
      systemPrompt: 'Use an immersive conversational style.',
      outputRules: 'Keep the reply concise.',
      parameters: { temperature: 0.7, topP: 0.9, maxTokens: 512 }
    },
    modelGateway: null,
    history: [],
    currentUserMessage: {
      id: 'current-user',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'Tell me about the archive.'
    },
    worldBooks: [],
    options: {
      mode: 'chat',
      historyLimit: 20,
      maxHistoryCharacters: 12000,
      maxPromptTokens: 8000,
      includeDebug: true,
      supportsDeveloperRole: false
    },
    ...overrides
  };
}

function worldBook(entries: WorldBookContext['entries'], tokenBudget = 1000): WorldBookContext {
  return {
    id: 'world-book-1',
    userId: 'user-1',
    characterId: 'character-1',
    name: 'Archive lore',
    description: '',
    isEnabled: true,
    isSensitive: false,
    scanDepth: 6,
    tokenBudget,
    entries
  };
}

function entry(
  id: string,
  content: string,
  options: Partial<WorldBookContext['entries'][number]> = {}
): WorldBookContext['entries'][number] {
  return {
    id,
    worldBookId: 'world-book-1',
    title: id,
    content,
    keywords: ['archive'],
    secondaryKeywords: [],
    isEnabled: true,
    priority: 10,
    position: 'before_history',
    tokenBudget: null,
    caseSensitive: false,
    ...options
  };
}

// 1-3: 无世界书时正常构建；旧版 Preset 字段、Character、Persona 均进入最终 Prompt。
const basic = builder.build(input());
const basicPrompt = basic.finalMessages.map((message) => message.content).join('\n');
assert.equal(basic.worldBook.matchedEntries.length, 0);
assert.match(basicPrompt, /Mira/);
assert.match(basicPrompt, /A careful traveler/);
assert.match(basicPrompt, /Use an immersive conversational style/);
assert.match(basicPrompt, /Welcome\./);
assert.match(basicPrompt, /For a careful traveler/);
assert.match(basicPrompt, /Keep the reply concise/);
assert.doesNotMatch(basicPrompt, /机械复述用户原话/);
assert.deepEqual(basic.debug.presetParameters, {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 512
});

// 首轮开场白/示例对话在已有历史后必须退出，避免场景被反复重置。
const continued = builder.build(
  input({
    history: [
      {
        id: 'continued-user',
        conversationId: 'conversation-1',
        role: 'user',
        content: 'We already entered the lower archive.'
      },
      {
        id: 'continued-assistant',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'Mira closes the stairwell door behind us.'
      }
    ]
  })
);
const continuedPrompt = continued.finalMessages.map((message) => message.content).join('\n');
assert.doesNotMatch(continuedPrompt, /Welcome\./);
assert.doesNotMatch(continuedPrompt, /For a careful traveler/);

// 候选生成读取角色上下文，但不得继承“扮演 Character”的系统规则、Preset 文本或反重复规则。
const suggestions = builder.build(
  input({
    history: [
      {
        id: 'suggest-user',
        conversationId: 'conversation-1',
        role: 'user',
        content: 'Can we enter the lower archive?'
      },
      {
        id: 'suggest-assistant',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'Mira studies the brass key before answering.'
      }
    ],
    currentUserMessage: {
      id: 'suggestion-request',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'Generate 3 candidates.'
    },
    options: {
      mode: 'chat',
      purpose: 'user_suggestions',
      historyLimit: 20,
      maxHistoryCharacters: 12000,
      maxPromptTokens: 8000,
      includeDebug: true,
      supportsDeveloperRole: false
    }
  })
);
const suggestionPrompt = suggestions.finalMessages.map((message) => message.content).join('\n');
assert.match(suggestionPrompt, /不扮演 Character/);
assert.match(suggestionPrompt, /Persona 是候选发言者/);
assert.match(suggestionPrompt, /JSON 字符串数组/);
assert.doesNotMatch(suggestionPrompt, /你正在 Tavern Lite 中扮演/);
assert.doesNotMatch(suggestionPrompt, /Use an immersive conversational style/);
assert.doesNotMatch(suggestionPrompt, /Keep the reply concise/);
assert.doesNotMatch(suggestionPrompt, /本轮反重复约束/);
assert.equal(suggestions.finalMessages.at(-1)?.role, 'user');
assert.equal(suggestions.finalMessages.at(-1)?.content, 'Generate 3 candidates.');

// 中文不能继续按英文 4 字符约 1 token 估算。
assert.ok(estimatePromptTextTokens('这是中文提示词') > Math.ceil('这是中文提示词'.length / 4));

// 4-5: 命中条目注入；未命中条目不注入。
const matchedBook = worldBook([
  entry('matched-entry', 'The archive closes at midnight.'),
  entry('unmatched-entry', 'The harbor is guarded.', { keywords: ['harbor'] }),
  entry('disabled-entry', 'DISABLED_LORE', { isEnabled: false })
]);
const matched = builder.build(
  input({
    worldBooks: [matchedBook],
    currentUserMessage: {
      id: 'current-user',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'What happens in the archive?'
    }
  })
);
assert.deepEqual(
  matched.worldBook.matchedEntries.map((item) => item.entryId),
  ['matched-entry']
);
assert.match(
  matched.finalMessages.map((message) => message.content).join('\n'),
  /closes at midnight/
);
assert.doesNotMatch(
  matched.finalMessages.map((message) => message.content).join('\n'),
  /harbor is guarded/
);
assert.doesNotMatch(
  matched.finalMessages.map((message) => message.content).join('\n'),
  /DISABLED_LORE/
);

// 6: priority、条目/世界书 tokenBudget 生效，高优先级条目先占预算。
const prioritized = builder.build(
  input({
    worldBooks: [
      worldBook(
        [
          entry('low-priority', 'LOW!!', { priority: 1 }),
          entry('high-priority', 'HIGH!', { priority: 100 })
        ],
        2
      )
    ],
    currentUserMessage: {
      id: 'current-user',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'archive'
    }
  })
);
assert.deepEqual(
  prioritized.worldBook.matchedEntries.map((item) => item.entryId),
  ['high-priority']
);
assert.ok(
  prioritized.worldBook.skippedEntries.some(
    (item) => item.entryId === 'low-priority' && item.reason === 'token_budget_exceeded'
  )
);

// caseSensitive 必须遵循旧字段语义。
const caseSensitive = builder.build(
  input({
    worldBooks: [
      worldBook([
        entry('case-sensitive', 'Exact-case lore.', {
          keywords: ['Archive'],
          caseSensitive: true
        })
      ])
    ],
    currentUserMessage: {
      id: 'current-user',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'archive'
    }
  })
);
assert.equal(caseSensitive.worldBook.matchedEntries.length, 0);

// insertionOrder 四个位置继续按原语义进入逻辑消息序列。
const positioned = builder.build(
  input({
    history: [
      {
        id: 'history-user',
        conversationId: 'conversation-1',
        role: 'user',
        content: 'Earlier archive question.'
      },
      {
        id: 'history-assistant',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'Earlier answer.'
      }
    ],
    worldBooks: [
      worldBook([
        entry('before-history', 'WB_BEFORE_HISTORY', { position: 'before_history' }),
        entry('after-history', 'WB_AFTER_HISTORY', { position: 'after_history' }),
        entry('before-current', 'WB_BEFORE_CURRENT', {
          position: 'before_current_user_input'
        }),
        entry('after-current', 'WB_AFTER_CURRENT', { position: 'after_current_user_input' })
      ])
    ],
    currentUserMessage: {
      id: 'current-user',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'archive now'
    }
  })
);
const positionedMessages = positioned.logicalMessages.map((message) => message.content);
const indexOf = (needle: string) =>
  positionedMessages.findIndex((message) => message.includes(needle));
assert.ok(indexOf('WB_BEFORE_HISTORY') < indexOf('Earlier archive question'));
assert.ok(indexOf('WB_AFTER_HISTORY') > indexOf('Earlier answer'));
assert.ok(indexOf('WB_BEFORE_CURRENT') < indexOf('archive now'));
assert.ok(indexOf('WB_AFTER_CURRENT') > indexOf('archive now'));

// 7: Companion 长期记忆正确注入，且与身份/Preset 有清晰边界。
const companion = companionBuilder.build({
  name: 'Luna',
  identityPrompt: 'A patient astronomer.',
  persona: 'The user enjoys quiet walks.',
  preset: {
    systemPrompt: 'Use warm but restrained language.',
    outputRules: 'Reply in two short paragraphs.',
    parameters: { temperature: 0.6, maxTokens: 300 }
  },
  memory: {
    isEnabled: true,
    relationshipState: 'Mutual trust has formed.',
    currentArc: 'Planning a stargazing trip.',
    status: 'ready'
  },
  history: [],
  userInput: 'Is tonight a good night?',
  maxPromptTokens: 8000
});
assert.equal(companion.includedMemory, true);
assert.equal(companion.memorySkipReason, null);
assert.match(companion.messages[0].content, /Mutual trust has formed/);
assert.deepEqual(companion.parameters, { temperature: 0.6, maxTokens: 300 });

const noMemory = companionBuilder.build({
  name: 'Luna',
  identityPrompt: 'A patient astronomer.',
  memory: null,
  history: [],
  userInput: 'Hello.'
});
assert.equal(noMemory.includedMemory, false);
assert.equal(noMemory.memorySkipReason, 'not_configured');
assert.equal(
  (
    companion.messages
      .map((message) => message.content)
      .join('\n')
      .match(/历史仅用于/g) ?? []
  ).length,
  0
);

// 8-10: 超限先裁剪旧历史；当前用户消息始终完整保留；空/禁用项不生成正文。
const longHistory = Array.from({ length: 8 }, (_, index) => ({
  id: `history-${index}`,
  conversationId: 'conversation-1',
  role: index % 2 === 0 ? 'user' : 'assistant',
  content: `OLD_${index}_${'x'.repeat(240)}`
}));
const trimmed = builder.build(
  input({
    persona: null,
    promptPreset: null,
    history: longHistory,
    currentUserMessage: {
      id: 'current-user',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'CURRENT_MESSAGE_MUST_SURVIVE'
    },
    options: {
      mode: 'chat',
      historyLimit: 20,
      maxHistoryCharacters: 12000,
      maxPromptTokens: 500,
      includeDebug: true,
      supportsDeveloperRole: false
    }
  })
);
const trimmedPrompt = trimmed.finalMessages.map((message) => message.content).join('\n');
assert.ok(trimmed.truncatedHistory.length > 0);
assert.doesNotMatch(trimmedPrompt, /OLD_0_/);
assert.match(trimmedPrompt, /CURRENT_MESSAGE_MUST_SURVIVE/);
assert.equal(
  trimmed.sections.some((section) => section.kind === 'persona'),
  false
);

// 11: Preset.parameters 仍作为最终请求覆盖参数来源（酒馆调试 + Companion 输出）。
assert.equal(basic.debug.presetParameters?.temperature, 0.7);
assert.equal(companion.parameters?.temperature, 0.6);

// 12: 聊天入口、Gateway 流调用和 SSE 帧协议保持原路径/原事件格式。
const chatController = readFileSync(
  resolve(__dirname, '../apps/server/src/modules/chat/chat.controller.ts'),
  'utf8'
);
const chatService = readFileSync(
  resolve(__dirname, '../apps/server/src/modules/chat/chat.service.ts'),
  'utf8'
);
const companionController = readFileSync(
  resolve(__dirname, '../apps/server/src/modules/companion-chat/companion-chat.controller.ts'),
  'utf8'
);
const companionChatService = readFileSync(
  resolve(__dirname, '../apps/server/src/modules/companion-chat/companion-chat.service.ts'),
  'utf8'
);
assert.match(chatController, /@Post\('stream'\)/);
assert.match(companionController, /@Post\('chat\/stream'\)/);
assert.match(chatService, /modelGateway\.streamChat\(prompt\.finalMessages/);
assert.match(chatService, /mergeModelParams\(candidate\.params, promptPreset/);
assert.ok(chatService.includes("purpose: 'user_suggestions'"));
assert.ok(companionChatService.includes('...(built.parameters ?? {})'));
assert.ok(chatService.includes('response.write(`event: ${eventName}\\n`);'));
assert.ok(chatService.includes('response.write(`data: ${JSON.stringify(payload)}\\n\\n`);'));

console.log('Prompt Builder regression checks passed (16 groups).');
