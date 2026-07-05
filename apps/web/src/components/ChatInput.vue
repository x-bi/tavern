<template>
  <section class="chat-input" aria-label="聊天输入区">
    <n-input
      ref="inputRootRef"
      :value="modelValue"
      type="textarea"
      :autosize="{ minRows: 3, maxRows: 6 }"
      :disabled="sending || isGenerating"
      placeholder="输入消息"
      @update:value="$emit('update:modelValue', $event)"
      @keydown="handleKeydown"
    />

    <div class="chat-input__markers" aria-label="角色扮演段落标记">
      <n-button
        v-for="marker in roleplayMarkers"
        :key="marker.key"
        size="tiny"
        secondary
        :disabled="sending || isGenerating"
        :title="marker.shortcut"
        :aria-label="`${marker.label}，${marker.shortcut}`"
        @click="insertRoleplayMarker(marker)"
      >
        {{ marker.label }}
      </n-button>
    </div>

    <div v-if="suggestions.length > 0 || suggestionsError" class="chat-input__suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.id"
        class="chat-input__suggestion"
        type="button"
        :disabled="sending || isGenerating"
        @click="$emit('applySuggestion', suggestion.text)"
      >
        {{ suggestion.text }}
      </button>

      <p v-if="suggestionsError" class="chat-input__suggestion-error">
        {{ suggestionsError }}
      </p>
    </div>

    <footer class="chat-input__toolbar">
      <div class="chat-input__placeholder-actions">
        <n-button size="small" secondary disabled>附件</n-button>
        <n-button
          size="small"
          secondary
          :loading="suggestionsLoading"
          :disabled="sending || isGenerating || suggestionsLoading"
          @click="$emit('requestSuggestions')"
        >
          候选发言
        </n-button>
        <n-button size="small" secondary @click="$emit('previewPrompt')">Prompt 预览</n-button>
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
import type { ChatSuggestion } from '@tavern/shared';
import { nextTick, ref } from 'vue';

type RoleplayMarker = {
  key: string;
  label: string;
  shortcut: string;
  shortcutKey: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    sending?: boolean;
    isGenerating?: boolean;
    canStop?: boolean;
    stopping?: boolean;
    suggestions?: ChatSuggestion[];
    suggestionsLoading?: boolean;
    suggestionsError?: string | null;
  }>(),
  {
    suggestions: () => []
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  send: [];
  stop: [];
  regenerate: [];
  previewPrompt: [];
  requestSuggestions: [];
  applySuggestion: [value: string];
}>();

const roleplayMarkers: RoleplayMarker[] = [
  {
    key: 'dialogue',
    label: '台词',
    shortcut: 'Alt+1',
    shortcutKey: '1'
  },
  {
    key: 'self-action',
    label: '我的动作',
    shortcut: 'Alt+2',
    shortcutKey: '2'
  },
  {
    key: 'character-action',
    label: '对方动作',
    shortcut: 'Alt+3',
    shortcutKey: '3'
  },
  {
    key: 'narration',
    label: '旁白',
    shortcut: 'Alt+4',
    shortcutKey: '4'
  }
];

const inputRootRef = ref<{ $el?: HTMLElement } | null>(null);

function handleKeydown(event: KeyboardEvent) {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    event.preventDefault();
    emit('send');

    return;
  }

  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  const marker = roleplayMarkers.find((item) => item.shortcutKey === event.key);

  if (!marker) {
    return;
  }

  event.preventDefault();
  insertRoleplayMarker(marker);
}

function insertRoleplayMarker(marker: RoleplayMarker) {
  if (props.sending || props.isGenerating) {
    return;
  }

  const textarea = getTextarea();
  const currentValue = props.modelValue;
  const selectionStart = textarea?.selectionStart ?? currentValue.length;
  const selectionEnd = textarea?.selectionEnd ?? currentValue.length;
  const before = currentValue.slice(0, selectionStart);
  const selected = currentValue.slice(selectionStart, selectionEnd);
  const after = currentValue.slice(selectionEnd);
  const needsLeadingBreak = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  const needsTrailingBreak = selected && after.length > 0 && !after.startsWith('\n') ? '\n' : '';
  const markerPrefix = `[${marker.label}] `;
  const insertedText = `${needsLeadingBreak}${markerPrefix}${selected}${needsTrailingBreak}`;
  const nextValue = `${before}${insertedText}${after}`;
  const nextCursor =
    before.length + needsLeadingBreak.length + markerPrefix.length + selected.length;

  emit('update:modelValue', nextValue);

  void nextTick(() => {
    const nextTextarea = getTextarea();

    nextTextarea?.focus();
    nextTextarea?.setSelectionRange(nextCursor, nextCursor);
  });
}

function getTextarea(): HTMLTextAreaElement | null {
  return inputRootRef.value?.$el?.querySelector('textarea') ?? null;
}
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

.chat-input__markers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-input__placeholder-actions,
.chat-input__submit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-input__suggestions {
  display: grid;
  gap: 8px;
}

.chat-input__suggestion {
  width: 100%;
  min-height: 34px;
  padding: 7px 10px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.8);
  color: var(--text-strong);
  cursor: pointer;
  font: inherit;
  line-height: 1.5;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-input__suggestion:hover:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.58);
  background: rgba(30, 41, 59, 0.92);
}

.chat-input__suggestion:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.chat-input__suggestion-error {
  margin: 0;
  color: #fca5a5;
  font-size: 13px;
  line-height: 1.5;
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
