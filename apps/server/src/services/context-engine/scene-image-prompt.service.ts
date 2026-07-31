import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  SceneImageSnapshot,
  ScenePromptModelOutput,
  ConversationImageGenerationConfig
} from '../../modules/image-generations/image-generation.types';

import { canonicalSha256 } from '../../common/canonical-json';
import { extractSingleJsonObject } from '../../modules/ai-imports/extract-single-json-object';
import type { ModelGatewayConfig } from '../../modules/models/model.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ModelGatewayError,
  ModelGatewayService,
  type ModelGatewayChatResult
} from '../model-gateway';

export const SCENE_IMAGE_PROMPT_VERSION = 'scene_image_prompt_v2';
export const SCENE_IMAGE_COMPILER_VERSION = 'scene_image_compiler_v1';

const STYLE_PROMPTS: Record<ConversationImageGenerationConfig['stylePreset'], string> = {
  auto: '根据当前场景选择统一、自然且具有叙事感的视觉风格',
  anime: '动漫插画风格，清晰线条，细腻上色，人物表情自然',
  realistic: '写实摄影风格，自然光影，真实材质，人物比例自然',
  cinematic: '电影感构图，叙事性镜头，层次光影，具有沉浸感',
  illustration: '高质量叙事插画，画面完整，细节丰富，统一美术风格',
  fantasy: '奇幻概念插画，富有想象力的环境设计，氛围感强'
};

const SYSTEM_PROMPT = `你是视觉场景解析与生图描述编写器。你的任务不是续写故事，也不是修改剧情，而是仅根据提供的证据，整理出当前回复结束时能够被画面表现的最终瞬间。

证据优先级：目标 assistant 回复；绑定 user 消息；最近有效上下文；该回复生成时实际命中的世界书版本；角色默认视觉信息；Persona 视觉信息。

当前内容覆盖历史内容，明确临时状态覆盖默认状态，世界书明确事实覆盖无来源推测。连续动作只保留回复结束时的最终状态。不得补充证据中不存在的人物、性别、年龄、发色、服装、身体特征、物品或剧情。不写风格预设、画面比例、模型参数、画质标签、聊天规则或解释文字。

只返回 JSON：{"visualScene":{"scene":{"environment":[]},"characters":[],"objects":[],"composition":{},"atmosphere":{}},"positivePromptBody":"...","negativePrompt":""}。
字段层级必须与示例完全一致：positivePromptBody 和 negativePrompt 只能位于根节点；characters、objects、composition、atmosphere 必须与 scene 同级；scene 内只能放场景环境字段。不要把这些字段放进 visualScene 或 scene。
不要返回 source、evidence、style、消息 ID、Hash 或 Markdown。`;

type ScenePromptResult = {
  sceneSnapshot: SceneImageSnapshot;
  positivePromptBody: string;
  negativePrompt?: string;
  prompt: string;
  promptHash: string;
  sceneSnapshotHash: string;
  scenePromptInputHash: string;
  scenePromptOutputHash: string;
  scenePromptModelId: string;
  scenePromptModelName: string;
};

@Injectable()
export class SceneImagePromptService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ModelGatewayService) private readonly gateway: ModelGatewayService
  ) {}

  async build(params: {
    userId: string;
    sourceMessageId: string;
    config: ConversationImageGenerationConfig;
    candidates: ModelGatewayConfig[];
    signal: AbortSignal;
  }): Promise<ScenePromptResult> {
    const source = await this.prisma.message.findFirst({
      where: {
        id: params.sourceMessageId,
        role: 'assistant',
        status: 'complete',
        deletedAt: null,
        conversation: { userId: params.userId, deletedAt: null }
      },
      include: {
        conversation: {
          include: { character: true, persona: true }
        },
        generationTrace: {
          include: {
            requestUserMessage: true,
            includedWorldBooks: { include: { entryRevision: true } }
          }
        }
      }
    });
    if (!source) {
      throw new BadRequestException({
        code: 'IMAGE_MESSAGE_NOT_COMPLETE',
        message: 'Only a completed assistant message can generate a scene image.'
      });
    }
    const recent = await this.prisma.message.findMany({
      where: {
        conversationId: source.conversationId,
        deletedAt: null,
        status: { in: ['complete', 'edited'] },
        createdAt: { lte: source.createdAt },
        id: { not: source.id }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 6
    });
    recent.reverse();
    const evidenceInput = {
      assistantMessage: source.content.slice(0, 12000),
      requestUserMessage: source.generationTrace?.requestUserMessage.content.slice(0, 8000),
      recentMessages: recent.map((message) => ({
        role: message.role,
        content: message.content.slice(0, 1000)
      })),
      characterVisualSource: [
        source.conversation.character.coreIdentity,
        source.conversation.character.extendedBackground,
        source.conversation.character.initialScenario
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 6000),
      personaVisualSource: source.conversation.persona
        ? [source.conversation.persona.coreIdentity, source.conversation.persona.background]
            .filter(Boolean)
            .join('\n')
            .slice(0, 3000)
        : undefined,
      worldBookVisualSources:
        source.generationTrace?.includedWorldBooks.map((trace) => ({
          entryRevisionId: trace.entryRevisionId,
          content: trace.entryRevision.content.slice(0, 3000)
        })) ?? []
    };
    const inputHash = canonicalSha256(evidenceInput);
    const modelCall = await this.callCandidates(params.candidates, evidenceInput, params.signal);
    const modelOutput = this.validateModelOutput(
      extractSingleJsonObject(modelCall.result.text, 50000)
    );
    const outputHash = canonicalSha256(modelOutput);
    const stylePrompt = STYLE_PROMPTS[params.config.stylePreset];
    const snapshot: SceneImageSnapshot = {
      source: {
        conversationId: source.conversationId,
        assistantMessageId: source.id,
        ...(source.generationTrace?.requestUserMessageId
          ? { requestUserMessageId: source.generationTrace.requestUserMessageId }
          : {}),
        ...(source.generationTrace?.id ? { generationTraceId: source.generationTrace.id } : {}),
        sourceMessageContentHash: canonicalSha256(source.content)
      },
      ...modelOutput.visualScene,
      style: { preset: params.config.stylePreset, promptFragment: stylePrompt },
      evidence: {
        assistantMessage: source.content,
        ...(source.generationTrace?.requestUserMessage.content
          ? { requestUserMessage: source.generationTrace.requestUserMessage.content }
          : {}),
        recentMessages: recent.map((message) => ({
          id: message.id,
          role: message.role,
          contentHash: canonicalSha256(message.content),
          excerpt: message.content.slice(0, 200)
        })),
        characterSource: evidenceInput.characterVisualSource,
        ...(evidenceInput.personaVisualSource
          ? { personaSource: evidenceInput.personaVisualSource }
          : {}),
        worldBookRevisionIds: evidenceInput.worldBookVisualSources.map(
          (item) => item.entryRevisionId
        )
      }
    };
    const prompt = this.compile(modelOutput.positivePromptBody, stylePrompt);
    return {
      sceneSnapshot: snapshot,
      positivePromptBody: modelOutput.positivePromptBody,
      negativePrompt: modelOutput.negativePrompt || undefined,
      prompt,
      promptHash: canonicalSha256(prompt),
      sceneSnapshotHash: canonicalSha256(snapshot),
      scenePromptInputHash: inputHash,
      scenePromptOutputHash: outputHash,
      scenePromptModelId: modelCall.candidate.providerModelId ?? modelCall.candidate.modelName,
      scenePromptModelName: modelCall.result.modelName
    };
  }

  compile(positivePromptBody: string, stylePrompt: string): string {
    return `请生成一张表现以下故事最终时刻的场景图片。

【最终画面】
${positivePromptBody.trim()}

【视觉风格】
${stylePrompt}

【画面要求】
以最新场景为准，较早的对话只用于解释人物、物品和环境。
不要表现已经结束、被修改或被后续内容覆盖的动作。
不要在图片中显示聊天文字、字幕、对话框、水印、界面或提示词。
不要添加当前场景中没有出现的主要人物。
不要擅自补充没有来源依据的人物外貌、服装或重要物品。`;
  }

  private async callCandidates(
    candidates: ModelGatewayConfig[],
    evidence: unknown,
    signal: AbortSignal
  ): Promise<{ result: ModelGatewayChatResult; candidate: ModelGatewayConfig }> {
    for (const candidate of candidates) {
      try {
        const result = await this.gateway.chat(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(evidence) }
          ],
          {
            providerName: candidate.providerName,
            baseUrl: candidate.baseUrl,
            modelName: candidate.modelName,
            apiKey: candidate.apiKey,
            temperature: 0,
            topP: 1,
            maxTokens: Math.min(candidate.params.maxTokens ?? 4096, 4096),
            timeout: candidate.params.timeout,
            requestSource: 'scene_image_prompt',
            signal
          }
        );
        if (result.text.trim()) return { result, candidate };
      } catch (error) {
        if (signal.aborted) throw error;
        if (!(error instanceof ModelGatewayError)) throw error;
      }
    }
    throw new BadRequestException({
      code: 'IMAGE_SCENE_PROMPT_MODEL_CHAIN_FAILED',
      message: 'All configured chat models failed to build the scene prompt.'
    });
  }

  private validateModelOutput(value: Record<string, unknown>): ScenePromptModelOutput {
    const normalized = this.normalizeModelOutput(value);
    const visual = normalized.visualScene;
    if (!this.isRecord(visual) || typeof normalized.positivePromptBody !== 'string') {
      throw new BadRequestException({
        code: 'IMAGE_SCENE_PROMPT_GENERATION_FAILED',
        message: 'Scene prompt model returned an invalid result.'
      });
    }
    if (
      'source' in visual ||
      'evidence' in visual ||
      'style' in visual ||
      typeof visual.scene !== 'object' ||
      !Array.isArray(visual.characters) ||
      !Array.isArray(visual.objects) ||
      !this.isRecord(visual.composition) ||
      !this.isRecord(visual.atmosphere)
    ) {
      throw new BadRequestException({
        code: 'IMAGE_SCENE_PROMPT_GENERATION_FAILED',
        message: 'Scene prompt model crossed the trusted evidence boundary.'
      });
    }
    const scene = visual.scene;
    if (!this.isRecord(scene) || !Array.isArray(scene.environment)) {
      throw new BadRequestException({
        code: 'IMAGE_SCENE_PROMPT_GENERATION_FAILED',
        message: 'Scene prompt model returned an invalid scene.'
      });
    }
    const positivePromptBody = normalized.positivePromptBody.trim().slice(0, 12000);
    if (!positivePromptBody) {
      throw new BadRequestException({
        code: 'IMAGE_SCENE_PROMPT_GENERATION_FAILED',
        message: 'Scene prompt body is empty.'
      });
    }
    return {
      visualScene: visual as ScenePromptModelOutput['visualScene'],
      positivePromptBody,
      ...(typeof normalized.negativePrompt === 'string'
        ? { negativePrompt: normalized.negativePrompt.trim().slice(0, 2000) }
        : {})
    };
  }

  /**
   * 纠正常见的模型字段错位，只搬运契约中已知的视觉字段。
   * 归一化后仍由 validateModelOutput 执行完整可信边界与必填校验。
   */
  private normalizeModelOutput(value: Record<string, unknown>): Record<string, unknown> {
    const visual = value.visualScene;
    if (!this.isRecord(visual)) return value;

    const scene = visual.scene;
    if (!this.isRecord(scene)) return value;

    const normalized = { ...value };
    const normalizedVisual = { ...visual };
    const normalizedScene = { ...scene };
    const visualKeys = ['characters', 'objects', 'composition', 'atmosphere'] as const;

    for (const key of visualKeys) {
      if (!(key in normalizedVisual) && key in normalizedScene) {
        normalizedVisual[key] = normalizedScene[key];
      }
      delete normalizedScene[key];
    }

    if (
      !('positivePromptBody' in normalized) &&
      typeof normalizedVisual.positivePromptBody === 'string'
    ) {
      normalized.positivePromptBody = normalizedVisual.positivePromptBody;
    }
    if (!('negativePrompt' in normalized) && typeof normalizedVisual.negativePrompt === 'string') {
      normalized.negativePrompt = normalizedVisual.negativePrompt;
    }

    delete normalizedVisual.positivePromptBody;
    delete normalizedVisual.negativePrompt;
    normalizedVisual.scene = normalizedScene;
    normalized.visualScene = normalizedVisual;
    return normalized;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
