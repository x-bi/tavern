<template>
  <n-card class="model-config-form" :bordered="false">
    <n-alert v-if="error" class="model-config-form__error" type="error" :bordered="false">
      {{ error }}
    </n-alert>

    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      @submit.prevent="handleSubmit"
    >
      <div class="model-config-form__grid">
        <n-form-item label="配置名称" path="name">
          <n-input
            v-model:value="form.name"
            maxlength="120"
            show-count
            placeholder="OpenAI-compatible"
          />
        </n-form-item>

        <n-form-item label="供应商标识" path="providerName">
          <n-input
            v-model:value="form.providerName"
            maxlength="80"
            placeholder="openai-compatible"
          />
        </n-form-item>
      </div>

      <n-form-item label="Base URL" path="baseUrl">
        <n-input
          v-model:value="form.baseUrl"
          maxlength="500"
          placeholder="https://api.openai.com/v1"
        />
      </n-form-item>

      <n-form-item label="模型名称" path="modelName">
        <n-input v-model:value="form.modelName" maxlength="160" placeholder="gpt-4.1-mini" />
      </n-form-item>

      <n-form-item label="API Key">
        <n-input
          v-model:value="form.apiKey"
          type="password"
          show-password-on="click"
          maxlength="4096"
          :placeholder="apiKeyPlaceholder"
        />
      </n-form-item>

      <n-checkbox
        v-if="initialValue?.hasApiKey"
        v-model:checked="form.clearApiKey"
        class="model-config-form__clear-key"
      >
        清空已保存的 API Key
      </n-checkbox>

      <div class="model-config-form__grid model-config-form__grid--params">
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

        <n-form-item label="Timeout ms" path="timeout">
          <n-input-number
            v-model:value="form.timeout"
            :min="1000"
            :max="600000"
            :step="1000"
            clearable
            placeholder="60000"
          />
        </n-form-item>
      </div>

      <div class="model-config-form__switches">
        <n-checkbox v-model:checked="form.isDefault">设为默认模型</n-checkbox>
        <n-checkbox v-model:checked="form.isEnabled">启用</n-checkbox>
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
import { computed, reactive, ref, watch } from 'vue';

import type { ModelConfig, ModelConfigMutationPayload } from '../api/models';
import type { ModelConfigPayload } from '@tavern/shared';

type ModelConfigFormState = {
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  clearApiKey: boolean;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  timeout: number | null;
  isDefault: boolean;
  isEnabled: boolean;
};

const props = withDefaults(
  defineProps<{
    initialValue?: ModelConfig | null;
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
  submit: [payload: ModelConfigPayload | ModelConfigMutationPayload];
  cancel: [];
}>();

const formRef = ref<FormInst | null>(null);
const form = reactive<ModelConfigFormState>(createEmptyForm());

const rules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入配置名称',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '配置名称不能只包含空格',
      trigger: ['blur', 'input']
    }
  ],
  providerName: [
    {
      required: true,
      message: '请输入供应商标识',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '供应商标识不能只包含空格',
      trigger: ['blur', 'input']
    }
  ],
  baseUrl: [
    {
      required: true,
      message: '请输入 Base URL',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => /^https?:\/\/\S+$/i.test(value.trim()),
      message: 'Base URL 必须以 http:// 或 https:// 开头',
      trigger: ['blur', 'input']
    }
  ],
  modelName: [
    {
      required: true,
      message: '请输入模型名称',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '模型名称不能只包含空格',
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
  }
};

const apiKeyPlaceholder = computed(() => {
  if (!props.initialValue) {
    return '仅提交到后端保存，不会在页面回显';
  }

  return props.initialValue.apiKeyMask
    ? `已保存 ${props.initialValue.apiKeyMask}，留空则保持不变`
    : '未保存 API Key';
});

watch(
  () => props.initialValue,
  (modelConfig) => {
    Object.assign(form, modelConfig ? toForm(modelConfig) : createEmptyForm());
  },
  { immediate: true }
);

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const payload: ModelConfigPayload | ModelConfigMutationPayload = {
    name: form.name.trim(),
    providerName: form.providerName.trim(),
    baseUrl: form.baseUrl.trim(),
    modelName: form.modelName.trim(),
    temperature: form.temperature ?? undefined,
    topP: form.topP ?? undefined,
    maxTokens: form.maxTokens ?? undefined,
    timeout: form.timeout ?? undefined,
    isDefault: form.isDefault,
    isEnabled: form.isEnabled
  };

  const nextApiKey = form.apiKey.trim();

  if (nextApiKey) {
    payload.apiKey = nextApiKey;
  } else if (form.clearApiKey) {
    payload.apiKey = null;
  }

  emit('submit', payload);
}

function createEmptyForm(): ModelConfigFormState {
  return {
    name: '',
    providerName: 'openai-compatible',
    baseUrl: '',
    modelName: '',
    apiKey: '',
    clearApiKey: false,
    temperature: null,
    topP: null,
    maxTokens: null,
    timeout: null,
    isDefault: false,
    isEnabled: true
  };
}

function toForm(modelConfig: ModelConfig): ModelConfigFormState {
  return {
    name: modelConfig.name,
    providerName: modelConfig.providerName,
    baseUrl: modelConfig.baseUrl,
    modelName: modelConfig.modelName,
    apiKey: '',
    clearApiKey: false,
    temperature: modelConfig.temperature,
    topP: modelConfig.topP,
    maxTokens: modelConfig.maxTokens,
    timeout: modelConfig.timeout,
    isDefault: modelConfig.isDefault,
    isEnabled: modelConfig.isEnabled
  };
}
</script>

<style scoped>
.model-config-form {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.model-config-form__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.model-config-form__grid--params {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.model-config-form__error {
  margin-bottom: 16px;
}

.model-config-form__clear-key {
  margin: -8px 0 18px;
}

.model-config-form__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 920px) {
  .model-config-form__grid,
  .model-config-form__grid--params {
    grid-template-columns: 1fr;
  }
}
</style>
