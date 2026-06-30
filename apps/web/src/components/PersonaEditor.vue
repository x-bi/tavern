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

      <n-form-item label="Persona 内容" path="content">
        <n-input
          v-model:value="form.content"
          type="textarea"
          maxlength="8000"
          show-count
          :autosize="{ minRows: 8, maxRows: 14 }"
          placeholder="描述用户身份、说话习惯、偏好、边界和角色关系。"
        />
      </n-form-item>

      <div class="persona-editor__switches">
        <n-checkbox v-model:checked="form.isDefault">设为默认 Persona</n-checkbox>
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

type PersonaFormState = {
  name: string;
  content: string;
  isDefault: boolean;
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
  ],
  content: {
    validator: (_rule, value: string) => value.trim().length <= 8000,
    message: 'Persona 内容不能超过 8000 个字符',
    trigger: ['blur', 'input']
  }
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
    content: form.content.trim(),
    isDefault: form.isDefault
  });
}

function createEmptyForm(): PersonaFormState {
  return {
    name: '',
    content: '',
    isDefault: false
  };
}

function toForm(persona: Persona): PersonaFormState {
  return {
    name: persona.name,
    content: persona.content,
    isDefault: persona.isDefault
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
