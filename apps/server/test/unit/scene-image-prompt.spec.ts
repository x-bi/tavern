import { describe, expect, it } from 'vitest';

import { SceneImagePromptService } from '../../src/services/context-engine/scene-image-prompt.service';

function service() {
  return new SceneImagePromptService({} as never, {} as never);
}

describe('SceneImagePromptService', () => {
  it('compiles only visual scene content, style and fixed visible constraints', () => {
    const prompt = service().compile('角色最终坐在窗边，手搭在杯沿。', '电影感构图');
    expect(prompt).toContain('角色最终坐在窗边');
    expect(prompt).toContain('电影感构图');
    expect(prompt).toContain('不要在图片中显示聊天文字');
    expect(prompt).not.toContain('temperature');
    expect(prompt).not.toContain('回复格式');
  });

  it('rejects model output that attempts to supply trusted source fields', () => {
    const target = service() as unknown as {
      validateModelOutput(value: Record<string, unknown>): unknown;
    };
    expect(() =>
      target.validateModelOutput({
        visualScene: {
          source: { assistantMessageId: 'forged' },
          scene: { environment: [] },
          characters: [],
          objects: [],
          composition: {},
          atmosphere: {}
        },
        positivePromptBody: '场景'
      })
    ).toThrow(/trusted evidence boundary/i);
  });

  it('accepts a bounded visual-only model result', () => {
    const target = service() as unknown as {
      validateModelOutput(value: Record<string, unknown>): {
        positivePromptBody: string;
        negativePrompt?: string;
      };
    };
    expect(
      target.validateModelOutput({
        visualScene: {
          scene: { environment: ['咖啡馆'] },
          characters: [],
          objects: [],
          composition: {},
          atmosphere: {}
        },
        positivePromptBody: '雨夜咖啡馆的最终时刻',
        negativePrompt: '文字，水印'
      })
    ).toMatchObject({
      positivePromptBody: '雨夜咖啡馆的最终时刻',
      negativePrompt: '文字，水印'
    });
  });
});
