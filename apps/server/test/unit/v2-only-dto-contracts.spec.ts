import { describe, expect, it } from 'vitest';

import { DtoValidationPipe } from '../../src/common/pipes/dto-validation.pipe';
import { CreateCharacterDto } from '../../src/modules/characters/dto/create-character.dto';
import { CreateCompanionDto } from '../../src/modules/companions/dto/create-companion.dto';
import { CreatePersonaDto } from '../../src/modules/personas/dto/create-persona.dto';
import { CreatePromptPresetDto } from '../../src/modules/presets/dto/create-prompt-preset.dto';

describe('V2-only CRUD DTO contracts', () => {
  it.each([
    [
      CreatePromptPresetDto,
      {
        name: 'Preset',
        instructions: [],
        outputRuleOperations: [],
        generationPurposes: [],
        systemPrompt: 'legacy'
      }
    ],
    [CreatePersonaDto, { name: 'Persona', content: 'legacy' }],
    [CreateCharacterDto, { name: 'Character', description: 'legacy', scenario: 'legacy' }],
    [CreateCompanionDto, { name: 'Companion', identityPrompt: 'legacy' }]
  ])('rejects unknown fields for %s', (Dto, payload) => {
    expect(() => new DtoValidationPipe(Dto).transform(payload)).toThrow();
  });

  it('requires all three PromptPreset V2 arrays on create', () => {
    expect(() =>
      new DtoValidationPipe(CreatePromptPresetDto).transform({ name: 'Incomplete preset' })
    ).toThrow();
  });
});
