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

      <n-form-item label="描述（仅用于管理说明，不发送给模型）">
        <n-input
          v-model:value="form.description"
          maxlength="500"
          show-count
          placeholder="适合日常角色对话的通用参数"
        />
      </n-form-item>

      <n-form-item label="系统提示词">
        <n-input
          v-model:value="form.systemPrompt"
          type="textarea"
          maxlength="10000"
          show-count
          :autosize="{ minRows: 4, maxRows: 10 }"
          placeholder="预设级系统/开发者约束；会进入酒馆与 AI 角色 Prompt。"
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

      <n-divider title-placement="left">高级生成参数</n-divider>
      <p class="prompt-preset-form__hint">
        预设中的同名参数会覆盖模型默认参数；留空表示不在预设层指定。
      </p>
      <div class="prompt-preset-form__grid">
        <n-form-item label="Timeout（毫秒）" path="timeout">
          <n-input-number
            v-model:value="form.timeout"
            :min="1000"
            :max="600000"
            :step="1000"
            clearable
            placeholder="60000"
          />
        </n-form-item>

        <n-form-item label="Frequency Penalty" path="frequencyPenalty">
          <n-input-number
            v-model:value="form.frequencyPenalty"
            :min="-2"
            :max="2"
            :step="0.1"
            clearable
            placeholder="0"
          />
        </n-form-item>

        <n-form-item label="Presence Penalty" path="presencePenalty">
          <n-input-number
            v-model:value="form.presencePenalty"
            :min="-2"
            :max="2"
            :step="0.1"
            clearable
            placeholder="0"
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
        <n-checkbox v-model:checked="form.isSensitive">标记为敏感内容</n-checkbox>
        <n-checkbox v-if="isAdmin" v-model:checked="form.isShared">发布到成员内容库</n-checkbox>
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
import { getStoredCurrentUser } from '../api/auth';

type PromptPresetFormState = {
  name: string;
  description: string;
  systemPrompt: string;
  outputRules: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  timeout: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  isDefault: boolean;
  isSensitive: boolean;
  isShared: boolean;
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
const isAdmin = getStoredCurrentUser()?.role === 'admin';

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
  },
  timeout: {
    type: 'number',
    min: 1000,
    max: 600000,
    message: 'Timeout 范围为 1000 到 600000 毫秒',
    trigger: ['blur', 'change']
  },
  frequencyPenalty: {
    type: 'number',
    min: -2,
    max: 2,
    message: 'Frequency Penalty 范围为 -2 到 2',
    trigger: ['blur', 'change']
  },
  presencePenalty: {
    type: 'number',
    min: -2,
    max: 2,
    message: 'Presence Penalty 范围为 -2 到 2',
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
    systemPrompt: form.systemPrompt.trim(),
    outputRules: form.outputRules.trim(),
    temperature: form.temperature,
    topP: form.topP,
    maxTokens: form.maxTokens,
    timeout: form.timeout,
    frequencyPenalty: form.frequencyPenalty,
    presencePenalty: form.presencePenalty,
    isDefault: form.isDefault,
    isSensitive: form.isSensitive,
    ...(isAdmin ? { isShared: form.isShared } : {})
  });
}

function createEmptyForm(): PromptPresetFormState {
  return {
    name: '',
    description: '',
    systemPrompt: '',
    outputRules: '',
    temperature: null,
    topP: null,
    maxTokens: null,
    timeout: null,
    frequencyPenalty: null,
    presencePenalty: null,
    isDefault: false,
    isSensitive: false,
    isShared: false
  };
}

function toForm(preset: PromptPreset): PromptPresetFormState {
  return {
    name: preset.name,
    description: preset.description,
    systemPrompt: preset.systemPrompt,
    outputRules: preset.outputRules,
    temperature: preset.temperature,
    topP: preset.topP,
    maxTokens: preset.maxTokens,
    timeout: preset.timeout,
    frequencyPenalty: preset.frequencyPenalty,
    presencePenalty: preset.presencePenalty,
    isDefault: preset.isDefault,
    isSensitive: preset.isSensitive,
    isShared: preset.isShared
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

.prompt-preset-form__hint {
  margin: -8px 0 12px;
  color: var(--text-muted);
  font-size: 13px;
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
