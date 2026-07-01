<template>
  <section class="chat-input" aria-label="聊天输入区">
    <n-input
      :value="modelValue"
      type="textarea"
      :autosize="{ minRows: 3, maxRows: 6 }"
      :disabled="sending || isGenerating"
      placeholder="输入消息"
      @update:value="$emit('update:modelValue', $event)"
      @keydown.enter.exact.prevent="$emit('send')"
    />

    <footer class="chat-input__toolbar">
      <div class="chat-input__placeholder-actions">
        <n-button size="small" secondary disabled>附件</n-button>
        <n-button size="small" secondary disabled>Prompt 预览</n-button>
      </div>

      <div class="chat-input__submit-actions">
        <n-button secondary :loading="stopping" :disabled="!canStop" @click="$emit('stop')">
          停止
        </n-button>
        <n-button secondary disabled @click="$emit('regenerate')">重新生成</n-button>
        <n-button
          type="primary"
          :loading="sending || isGenerating"
          :disabled="!modelValue.trim() || sending || isGenerating"
          @click="$emit('send')"
        >
          发送
        </n-button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  sending?: boolean;
  isGenerating?: boolean;
  canStop?: boolean;
  stopping?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  send: [];
  stop: [];
  regenerate: [];
}>();
</script>

<style scoped>
.chat-input {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--line-subtle);
  background: rgba(17, 24, 39, 0.88);
}

.chat-input__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.chat-input__placeholder-actions,
.chat-input__submit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 720px) {
  .chat-input__toolbar,
  .chat-input__placeholder-actions,
  .chat-input__submit-actions {
    width: 100%;
  }

  .chat-input__submit-actions {
    justify-content: flex-end;
  }
}
</style>
