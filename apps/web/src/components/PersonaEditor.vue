<template>
  <n-card class="persona-editor" :bordered="false">
    <n-alert v-if="error" class="persona-editor__error" type="error" :bordered="false">
      {{ error }}
    </n-alert>

    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      @submit.prevent="handleSubmit"
    >
      <n-form-item label="Persona 名称" path="name">
        <n-input v-model:value="form.name" maxlength="120" show-count placeholder="我的 Persona" />
      </n-form-item>

      <n-form-item label="核心身份">
        <n-input
          v-model:value="form.coreIdentity"
          type="textarea"
          maxlength="8000"
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
      </n-form-item>
      <n-form-item label="背景">
        <n-input
          v-model:value="form.background"
          type="textarea"
          maxlength="12000"
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
      </n-form-item>
      <n-form-item label="互动偏好">
        <n-input
          v-model:value="form.interactionPreferences"
          type="textarea"
          maxlength="8000"
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
      </n-form-item>

      <div class="persona-editor__switches">
        <n-checkbox v-model:checked="form.isDefault">设为默认 Persona</n-checkbox>
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

import type { Persona, PersonaMutationPayload } from '../api/personas';
import type { PersonaPayload } from '@tavern/shared';
import { getStoredCurrentUser } from '../api/auth';

type PersonaFormState = {
  name: string;
  coreIdentity: string;
  background: string;
  interactionPreferences: string;
  isDefault: boolean;
  isSensitive: boolean;
  isShared: boolean;
};

const props = withDefaults(
  defineProps<{
    initialValue?: Persona | null;
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
  submit: [payload: PersonaPayload | PersonaMutationPayload];
  cancel: [];
}>();

const formRef = ref<FormInst | null>(null);
const form = reactive<PersonaFormState>(createEmptyForm());
const isAdmin = getStoredCurrentUser()?.role === 'admin';

const rules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入 Persona 名称',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: 'Persona 名称不能只包含空格',
      trigger: ['blur', 'input']
    }
  ]
};

watch(
  () => props.initialValue,
  (persona) => {
    Object.assign(form, persona ? toForm(persona) : createEmptyForm());
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
    coreIdentity: form.coreIdentity.trim(),
    background: form.background.trim(),
    interactionPreferences: form.interactionPreferences.trim(),
    isDefault: form.isDefault,
    isSensitive: form.isSensitive,
    ...(isAdmin ? { isShared: form.isShared } : {})
  });
}

function createEmptyForm(): PersonaFormState {
  return {
    name: '',
    coreIdentity: '',
    background: '',
    interactionPreferences: '',
    isDefault: false,
    isSensitive: false,
    isShared: false
  };
}

function toForm(persona: Persona): PersonaFormState {
  return {
    name: persona.name,
    coreIdentity: persona.coreIdentity,
    background: persona.background,
    interactionPreferences: persona.interactionPreferences,
    isDefault: persona.isDefault,
    isSensitive: persona.isSensitive,
    isShared: persona.isShared
  };
}
</script>

<style scoped>
.persona-editor {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.persona-editor__error {
  margin-bottom: 16px;
}

.persona-editor__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}
</style>
