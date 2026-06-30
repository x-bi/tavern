<template>
  <n-card class="prompt-preset-form" :bordered="false">
    <n-alert v-if="error" class="prompt-preset-form__error" type="error" :bordered="false">
      {{ error }}
    </n-alert>

    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      @submit.prevent="handleSubmit"
    >
      <n-form-item label="预设名称" path="name">
        <n-input v-model:value="form.name" maxlength="120" show-count placeholder="均衡叙事" />
      </n-form-item>

      <n-form-item label="描述">
        <n-input
          v-model:value="form.description"
          maxlength="500"
          show-count
          placeholder="适合日常角色对话的通用参数"
        />
      </n-form-item>

      <div class="prompt-preset-form__grid">
        <n-form-item label="Temperature" path="temperature">
          <n-input-number
            v-model:value="form.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            clearable
            placeholder="0.8"
          />
        </n-form-item>

        <n-form-item label="Top P" path="topP">
          <n-input-number
            v-model:value="form.topP"
            :min="0"
            :max="1"
            :step="0.05"
            clearable
            placeholder="0.95"
          />
        </n-form-item>

        <n-form-item label="Max Tokens" path="maxTokens">
          <n-input-number
            v-model:value="form.maxTokens"
            :min="1"
            :max="200000"
            :step="100"
            clearable
            placeholder="1200"
          />
        </n-form-item>
      </div>

      <n-form-item label="输出风格约束">
        <n-input
          v-model:value="form.outputRules"
          type="textarea"
          maxlength="4000"
          show-count
          :autosize="{ minRows: 4, maxRows: 8 }"
          placeholder="例如：回复保持自然口语，避免过长段落。"
        />
      </n-form-item>

      <div class="prompt-preset-form__switches">
        <n-checkbox v-model:checked="form.isDefault">设为默认预设</n-checkbox>
      </div>

      <n-space justify="end">
        <n-button :disabled="submitting" @click="$emit('cancel')">取消</n-button>
        <n-button type="primary" :loading="submitting" attr-type="submit">
          {{ submitLabel }}
        </n-button>
      </n-space>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui';
import { reactive, ref, watch } from 'vue';

import type { PromptPreset, PromptPresetMutationPayload } from '../api/presets';
import type { PromptPresetPayload } from '@tavern/shared';

type PromptPresetFormState = {
  name: string;
  description: string;
  outputRules: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  isDefault: boolean;
};

const props = withDefaults(
  defineProps<{
    initialValue?: PromptPreset | null;
    submitting?: boolean;
    submitLabel?: string;
    error?: string | null;
  }>(),
  {
    initialValue: null,
    submitting: false,
    submitLabel: '保存',
    error: null
  }
);

const emit = defineEmits<{
  submit: [payload: PromptPresetPayload | PromptPresetMutationPayload];
  cancel: [];
}>();

const formRef = ref<FormInst | null>(null);
const form = reactive<PromptPresetFormState>(createEmptyForm());

const rules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入预设名称',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '预设名称不能只包含空格',
      trigger: ['blur', 'input']
    }
  ],
  temperature: {
    type: 'number',
    min: 0,
    max: 2,
    message: 'Temperature 范围为 0 到 2',
    trigger: ['blur', 'change']
  },
  topP: {
    type: 'number',
    min: 0,
    max: 1,
    message: 'Top P 范围为 0 到 1',
    trigger: ['blur', 'change']
  },
  maxTokens: {
    type: 'number',
    min: 1,
    max: 200000,
    message: 'Max Tokens 范围为 1 到 200000',
    trigger: ['blur', 'change']
  }
};

watch(
  () => props.initialValue,
  (preset) => {
    Object.assign(form, preset ? toForm(preset) : createEmptyForm());
  },
  { immediate: true }
);

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  emit('submit', {
    name: form.name.trim(),
    description: form.description.trim(),
    outputRules: form.outputRules.trim(),
    temperature: form.temperature ?? undefined,
    topP: form.topP ?? undefined,
    maxTokens: form.maxTokens ?? undefined,
    isDefault: form.isDefault
  });
}

function createEmptyForm(): PromptPresetFormState {
  return {
    name: '',
    description: '',
    outputRules: '',
    temperature: null,
    topP: null,
    maxTokens: null,
    isDefault: false
  };
}

function toForm(preset: PromptPreset): PromptPresetFormState {
  return {
    name: preset.name,
    description: preset.description,
    outputRules: preset.outputRules,
    temperature: preset.temperature,
    topP: preset.topP,
    maxTokens: preset.maxTokens,
    isDefault: preset.isDefault
  };
}
</script>

<style scoped>
.prompt-preset-form {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.prompt-preset-form__error {
  margin-bottom: 16px;
}

.prompt-preset-form__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.prompt-preset-form__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 820px) {
  .prompt-preset-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
