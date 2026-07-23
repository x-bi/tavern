<template>
  <section class="world-book-runtime">
    <header>
      <div>
        <strong>世界书运行态</strong>
        <small>成功生成后才推进状态；手动条目可在此激活或取消。</small>
      </div>
      <n-button size="tiny" secondary :loading="loading" @click="load">刷新</n-button>
    </header>
    <n-alert v-if="error" type="error" :bordered="false">{{ error }}</n-alert>
    <n-empty
      v-else-if="!loading && entries.length === 0"
      size="small"
      description="当前目标没有可用世界书条目"
    />
    <div v-else class="world-book-runtime__list">
      <article v-for="entry in entries" :key="entry.entryId">
        <div class="world-book-runtime__title">
          <div>
            <strong>{{ entry.title }}</strong>
            <small>{{ entry.worldBookName }}</small>
          </div>
          <n-switch
            v-if="entry.activationMode === 'manual'"
            :value="entry.state?.manualActive ?? false"
            :loading="pendingId === entry.entryId"
            @update:value="(value: boolean) => toggle(entry.entryId, value)"
          />
        </div>
        <n-space size="small">
          <n-tag size="small" :bordered="false">{{ entry.activationMode }}</n-tag>
          <n-tag size="small" :bordered="false">{{ entry.contentType }}</n-tag>
          <n-tag
            size="small"
            :type="entry.trustLevel === 'imported_untrusted' ? 'warning' : 'success'"
            :bordered="false"
          >
            {{ entry.trustLevel }}
          </n-tag>
          <n-tag v-if="entry.state" size="small" type="info" :bordered="false">
            v{{ entry.state.stateVersion }} · {{ stateSummary(entry.state) }}
          </n-tag>
        </n-space>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { createClientOperationId, type WorldBookRuntimeEntry } from '@tavern/shared';
import { fetchWorldBookRuntimeState, setManualWorldBookActivation } from '../api/worldBooks';

const props = defineProps<{ targetType: 'conversation' | 'companion'; targetId: string }>();
const toast = useMessage();
const entries = ref<WorldBookRuntimeEntry[]>([]);
const loading = ref(false);
const pendingId = ref<string | null>(null);
const error = ref<string | null>(null);

async function load() {
  if (!props.targetId) return;
  loading.value = true;
  error.value = null;
  try {
    entries.value = (await fetchWorldBookRuntimeState(props.targetType, props.targetId)).entries;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '世界书运行态加载失败';
  } finally {
    loading.value = false;
  }
}

async function toggle(entryId: string, active: boolean) {
  pendingId.value = entryId;
  try {
    await setManualWorldBookActivation(entryId, {
      operationId: createClientOperationId(),
      targetType: props.targetType,
      targetId: props.targetId,
      active
    });
    await load();
    toast.success(active ? '已手动激活' : '已取消激活');
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : '操作失败');
  } finally {
    pendingId.value = null;
  }
}

function stateSummary(state: NonNullable<WorldBookRuntimeEntry['state']>) {
  if (state.manualActive) return 'manual active';
  if (state.pendingUntilCompletedTurn !== null) return `pending→${state.pendingUntilCompletedTurn}`;
  if (state.stickyUntilCompletedTurn !== null) return `sticky→${state.stickyUntilCompletedTurn}`;
  if (state.continuationUntilCompletedTurn !== null)
    return `continue→${state.continuationUntilCompletedTurn}`;
  if (state.cooldownUntilCompletedTurn !== null)
    return `cooldown→${state.cooldownUntilCompletedTurn}`;
  return 'inactive';
}

watch(() => [props.targetType, props.targetId], load);
onMounted(load);
</script>

<style scoped>
.world-book-runtime,
.world-book-runtime__list {
  display: grid;
  gap: 10px;
}
.world-book-runtime > header,
.world-book-runtime__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.world-book-runtime header > div,
.world-book-runtime__title > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.world-book-runtime small {
  color: var(--text-muted);
  line-height: 1.5;
}
.world-book-runtime article {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
}
</style>
