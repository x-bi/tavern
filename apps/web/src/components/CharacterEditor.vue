<template>
  <n-card class="character-editor" :bordered="false">
    <n-alert v-if="error" class="character-editor__error" type="error" :bordered="false">
      {{ error }}
    </n-alert>

    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      @submit.prevent="handleSubmit"
    >
      <n-form-item label="头像">
        <AvatarUploader
          :asset-id="form.avatarAssetId"
          :src="form.avatarUrl"
          :fallback="form.name"
          :disabled="submitting"
          @uploaded="handleAvatarUploaded"
          @clear="clearAvatar"
        />
      </n-form-item>

      <div class="character-editor__grid">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="form.name" maxlength="120" show-count placeholder="角色名称" />
        </n-form-item>

        <n-form-item label="标签">
          <n-input
            v-model:value="form.tagsText"
            placeholder="fantasy, mystery, cozy"
          />
        </n-form-item>
      </div>

      <n-form-item label="描述" path="description">
        <n-input
          v-model:value="form.description"
          type="textarea"
          maxlength="10000"
          show-count
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="角色背景、外观或基础设定"
        />
      </n-form-item>

      <n-form-item label="人格" path="personality">
        <n-input
          v-model:value="form.personality"
          type="textarea"
          maxlength="10000"
          show-count
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="角色性格、说话方式、行为偏好"
        />
      </n-form-item>

      <n-form-item label="场景" path="scenario">
        <n-input
          v-model:value="form.scenario"
          type="textarea"
          maxlength="10000"
          show-count
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="初始场景、关系或当前情境"
        />
      </n-form-item>

      <n-form-item label="开场白" path="firstMessage">
        <n-input
          v-model:value="form.firstMessage"
          type="textarea"
          maxlength="10000"
          show-count
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="角色第一次发给用户的消息"
        />
      </n-form-item>

      <n-form-item label="系统提示">
        <n-input
          v-model:value="form.systemPrompt"
          type="textarea"
          maxlength="10000"
          show-count
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="可选。用于后续 Prompt Builder 的角色级补充约束"
        />
      </n-form-item>

      <n-form-item label="示例对话">
        <n-input
          v-model:value="form.exampleMessagesText"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
          placeholder="每行一条，例如：user: 你好&#10;assistant: 晚上好，欢迎来到档案馆。"
        />
      </n-form-item>

      <n-alert
        v-if="exampleMessagesError"
        class="character-editor__error"
        type="warning"
        :bordered="false"
      >
        {{ exampleMessagesError }}
      </n-alert>

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

import type { Asset } from '../api/assets';
import type { Character } from '../api/characters';
import AvatarUploader from './AvatarUploader.vue';
import type {
  CharacterEditorForm,
  CharacterMetadata,
  CharacterMutationPayload,
  ExampleMessage
} from '../types/character';

const props = withDefaults(
  defineProps<{
    initialValue?: Character | null;
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
  submit: [payload: CharacterMutationPayload];
  cancel: [];
}>();

const formRef = ref<FormInst | null>(null);
const exampleMessagesError = ref<string | null>(null);
const form = reactive<CharacterEditorForm>(createEmptyForm());

const rules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入角色名称',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '角色名称不能只包含空格',
      trigger: ['blur', 'input']
    },
    {
      max: 120,
      message: '角色名称不能超过 120 个字符',
      trigger: ['blur', 'input']
    }
  ],
  description: {
    max: 10000,
    message: '描述不能超过 10000 个字符',
    trigger: ['blur']
  },
  personality: {
    max: 10000,
    message: '人格不能超过 10000 个字符',
    trigger: ['blur']
  },
  scenario: {
    max: 10000,
    message: '场景不能超过 10000 个字符',
    trigger: ['blur']
  },
  firstMessage: {
    max: 10000,
    message: '开场白不能超过 10000 个字符',
    trigger: ['blur']
  }
};

watch(
  () => props.initialValue,
  (character) => {
    Object.assign(form, character ? toForm(character) : createEmptyForm());
    exampleMessagesError.value = null;
  },
  { immediate: true }
);

async function handleSubmit() {
  exampleMessagesError.value = null;

  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const parsedExamples = parseExampleMessages(form.exampleMessagesText);

  if (typeof parsedExamples === 'string') {
    exampleMessagesError.value = parsedExamples;
    return;
  }

  emit('submit', {
    avatarAssetId: form.avatarAssetId,
    name: form.name.trim(),
    description: form.description.trim(),
    personality: form.personality.trim(),
    scenario: form.scenario.trim(),
    firstMessage: form.firstMessage.trim(),
    exampleMessages: parsedExamples,
    metadata: createMetadata(form)
  });
}

function createEmptyForm(): CharacterEditorForm {
  return {
    avatarAssetId: null,
    avatarUrl: '',
    name: '',
    tagsText: '',
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    systemPrompt: '',
    exampleMessagesText: ''
  };
}

function toForm(character: Character): CharacterEditorForm {
  return {
    avatarAssetId: character.avatarAssetId,
    avatarUrl: character.avatarUrl ?? '',
    name: character.name,
    tagsText: Array.isArray(character.metadata?.tags)
      ? character.metadata.tags.join(', ')
      : '',
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    firstMessage: character.firstMessage,
    systemPrompt:
      typeof character.metadata?.systemPrompt === 'string'
        ? character.metadata.systemPrompt
        : '',
    exampleMessagesText: character.exampleMessages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')
  };
}

function handleAvatarUploaded(asset: Asset) {
  form.avatarAssetId = asset.id;
  form.avatarUrl = asset.publicPath ?? '';
}

function clearAvatar() {
  form.avatarAssetId = null;
  form.avatarUrl = '';
}

function createMetadata(value: CharacterEditorForm): CharacterMetadata {
  const tags = value.tagsText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const metadata: CharacterMetadata = {
    ...(props.initialValue?.metadata ?? {})
  };

  if (tags.length > 0) {
    metadata.tags = tags;
  } else {
    delete metadata.tags;
  }

  if (value.systemPrompt.trim()) {
    metadata.systemPrompt = value.systemPrompt.trim();
  } else {
    delete metadata.systemPrompt;
  }

  return metadata;
}

function parseExampleMessages(value: string): ExampleMessage[] | string {
  if (!value.trim()) {
    return [];
  }

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const separatorIndex = line.indexOf(':');
      const role = line.slice(0, separatorIndex).trim();
      const content = line.slice(separatorIndex + 1).trim();

      if (separatorIndex < 1 || !['user', 'assistant', 'system'].includes(role) || !content) {
        return `第 ${index + 1} 行格式应为 user: 内容、assistant: 内容或 system: 内容。`;
      }

      return {
        role: role as ExampleMessage['role'],
        content
      };
    })
    .reduce<ExampleMessage[] | string>((result, item) => {
      if (typeof result === 'string') {
        return result;
      }

      if (typeof item === 'string') {
        return item;
      }

      return [...result, item];
    }, []);
}
</script>

<style scoped>
.character-editor {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.character-editor__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.character-editor__error {
  margin-bottom: 16px;
}

@media (max-width: 720px) {
  .character-editor__grid {
    grid-template-columns: 1fr;
  }
}
</style>
