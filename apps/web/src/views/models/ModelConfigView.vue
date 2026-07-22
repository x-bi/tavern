<template>
  <main class="page-shell model-chain-view">
    <header class="page-shell__header model-chain-view__header">
      <div>
        <h2>模型链</h2>
        <p>先配置供应商 URL 和 Key，再维护模型列表，最后用模型链决定自动切换顺序。</p>
      </div>
      <n-space>
        <n-button secondary @click="openCreateProvider">新建供应商</n-button>
        <n-button secondary :disabled="!modelStore.hasProviders" @click="openCreateModel">
          新建模型
        </n-button>
        <n-button type="primary" :disabled="!modelStore.hasProviderModels" @click="openCreateGroup">
          新建模型链
        </n-button>
      </n-space>
    </header>

    <LoadingState v-if="modelStore.loading" text="正在加载模型链" />

    <ErrorState
      v-else-if="modelStore.error"
      title="模型资源加载失败"
      :description="modelStore.error"
    />

    <div v-else class="model-chain-view__content">
      <section class="model-chain-section">
        <header class="model-chain-section__header">
          <h3>供应商</h3>
          <span>{{ modelStore.providers.length }} 个</span>
        </header>

        <EmptyState
          v-if="!modelStore.hasProviders"
          title="还没有供应商"
          description="先保存 OpenAI-compatible Base URL 和 API Key。"
        />

        <div v-else class="model-chain-grid">
          <n-card
            v-for="provider in modelStore.providers"
            :key="provider.id"
            class="model-chain-card"
            :bordered="false"
          >
            <template #header>
              <div class="model-chain-card__title">
                <strong>{{ provider.name }}</strong>
                <n-space size="small">
                  <n-tag v-if="provider.isDefault" size="small" type="success" :bordered="false">
                    默认
                  </n-tag>
                  <n-tag size="small" :type="provider.isEnabled ? 'info' : 'warning'">
                    {{ provider.isEnabled ? '启用' : '停用' }}
                  </n-tag>
                </n-space>
              </div>
            </template>

            <dl class="model-chain-meta">
              <div>
                <dt>Provider</dt>
                <dd>{{ provider.providerName }}</dd>
              </div>
              <div>
                <dt>Base URL</dt>
                <dd>{{ provider.baseUrl }}</dd>
              </div>
              <div>
                <dt>API Key</dt>
                <dd>{{ provider.apiKeyMask ?? '未保存' }}</dd>
              </div>
            </dl>

            <template #action>
              <n-space justify="end">
                <n-button size="small" secondary @click="openEditProvider(provider)">编辑</n-button>
                <n-button size="small" secondary type="error" @click="deleteProvider(provider)">
                  删除
                </n-button>
              </n-space>
            </template>
          </n-card>
        </div>
      </section>

      <section class="model-chain-section">
        <header class="model-chain-section__header">
          <h3>模型</h3>
          <span>{{ modelStore.providerModels.length }} 个</span>
        </header>

        <EmptyState
          v-if="!modelStore.hasProviderModels"
          title="还没有模型"
          description="在供应商下面添加可调用的 modelName。"
        />

        <div v-else class="model-chain-grid">
          <n-card
            v-for="model in modelStore.providerModels"
            :key="model.id"
            class="model-chain-card"
            :bordered="false"
          >
            <template #header>
              <div class="model-chain-card__title">
                <strong>{{ model.name }}</strong>
                <n-tag size="small" :type="model.isEnabled ? 'info' : 'warning'">
                  {{ model.isEnabled ? '启用' : '停用' }}
                </n-tag>
              </div>
            </template>

            <dl class="model-chain-meta">
              <div>
                <dt>供应商</dt>
                <dd>{{ model.providerDisplayName }}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{{ model.modelName }}</dd>
              </div>
              <div>
                <dt>参数</dt>
                <dd>{{ modelParamSummary(model) }}</dd>
              </div>
            </dl>

            <template #action>
              <n-space justify="end">
                <n-button
                  size="small"
                  secondary
                  :loading="testingId === model.id"
                  @click="testModel(model)"
                >
                  测试
                </n-button>
                <n-button size="small" secondary @click="openEditModel(model)">编辑</n-button>
                <n-button size="small" secondary type="error" @click="deleteModel(model)">
                  删除
                </n-button>
              </n-space>
            </template>
          </n-card>
        </div>
      </section>

      <section class="model-chain-section">
        <header class="model-chain-section__header">
          <h3>模型链</h3>
          <span>{{ modelStore.fallbackGroups.length }} 个</span>
        </header>

        <EmptyState
          v-if="!modelStore.hasFallbackGroups"
          title="还没有模型链"
          description="选择多个模型并排序，聊天失败时按顺序自动切换。"
        />

        <div v-else class="model-chain-grid">
          <n-card
            v-for="group in modelStore.fallbackGroups"
            :key="group.id"
            class="model-chain-card"
            :bordered="false"
          >
            <template #header>
              <div class="model-chain-card__title">
                <strong>{{ group.name }}</strong>
                <n-space size="small">
                  <n-tag v-if="group.isDefault" size="small" type="success" :bordered="false">
                    默认
                  </n-tag>
                  <n-tag size="small" :type="group.isEnabled ? 'info' : 'warning'">
                    {{ group.isEnabled ? '启用' : '停用' }}
                  </n-tag>
                </n-space>
              </div>
            </template>

            <ol class="model-chain-order">
              <li v-for="candidate in group.candidates" :key="candidate.id">
                {{ candidate.priority }}. {{ candidate.model.providerDisplayName }} /
                {{ candidate.model.name }}
                <n-tag v-if="!candidate.isEnabled" size="small" type="warning">候选停用</n-tag>
              </li>
            </ol>

            <template #action>
              <n-space justify="end">
                <n-button size="small" secondary @click="openEditGroup(group)">编辑</n-button>
                <n-button size="small" secondary type="error" @click="deleteGroup(group)">
                  删除
                </n-button>
              </n-space>
            </template>
          </n-card>
        </div>
      </section>
    </div>

    <n-drawer v-model:show="drawerVisible" :width="drawerWidth" placement="right">
      <n-drawer-content :title="drawerTitle">
        <n-form class="model-chain-form" label-placement="top" @submit.prevent="submitDrawer">
          <template v-if="drawerMode === 'provider'">
            <n-form-item label="供应商名称" required>
              <n-input v-model:value="providerForm.name" maxlength="120" />
            </n-form-item>
            <n-form-item label="Provider" required>
              <NSelect
                v-model:value="providerForm.providerName"
                :options="supportedProviderOptions"
                placeholder="选择后端已注册的供应商类型"
              />
            </n-form-item>
            <n-form-item label="Base URL" required>
              <n-input v-model:value="providerForm.baseUrl" maxlength="500" />
            </n-form-item>
            <n-form-item label="API Key">
              <n-input
                v-model:value="providerForm.apiKey"
                type="password"
                show-password-on="click"
                maxlength="4096"
                :placeholder="
                  editingProvider?.apiKeyMask ? `已保存 ${editingProvider.apiKeyMask}` : ''
                "
              />
            </n-form-item>
            <n-form-item label="Timeout ms">
              <n-input-number v-model:value="providerForm.timeout" clearable :min="1000" />
            </n-form-item>
            <n-space>
              <n-checkbox v-model:checked="providerForm.isDefault">配置页默认供应商</n-checkbox>
              <n-checkbox v-model:checked="providerForm.isEnabled">启用</n-checkbox>
            </n-space>
            <p class="model-chain-form__hint">
              仅影响配置页中新建模型时的默认选择；真实聊天由模型链决定。
            </p>
          </template>

          <template v-else-if="drawerMode === 'model'">
            <n-form-item label="供应商" required>
              <NSelect v-model:value="modelForm.providerId" filterable :options="providerOptions" />
            </n-form-item>
            <n-form-item label="模型显示名" required>
              <n-input v-model:value="modelForm.name" maxlength="120" />
            </n-form-item>
            <n-form-item label="modelName" required>
              <n-input v-model:value="modelForm.modelName" maxlength="160" />
            </n-form-item>
            <div class="model-chain-form__grid">
              <n-form-item label="Temperature">
                <n-input-number v-model:value="modelForm.temperature" clearable :min="0" :max="2" />
              </n-form-item>
              <n-form-item label="Top P">
                <n-input-number v-model:value="modelForm.topP" clearable :min="0" :max="1" />
              </n-form-item>
              <n-form-item label="Max Tokens">
                <n-input-number v-model:value="modelForm.maxTokens" clearable :min="1" />
              </n-form-item>
              <n-form-item label="Timeout ms">
                <n-input-number
                  v-model:value="modelForm.timeout"
                  clearable
                  :min="1000"
                  placeholder="留空继承供应商"
                />
              </n-form-item>
              <n-form-item label="上下文长度">
                <n-input-number
                  v-model:value="modelForm.contextLength"
                  clearable
                  :min="1"
                  :max="2000000"
                  placeholder="留空使用系统兜底"
                />
              </n-form-item>
              <n-form-item label="Frequency Penalty">
                <n-input-number
                  v-model:value="modelForm.frequencyPenalty"
                  clearable
                  :min="-2"
                  :max="2"
                  :step="0.1"
                />
              </n-form-item>
              <n-form-item label="Presence Penalty">
                <n-input-number
                  v-model:value="modelForm.presencePenalty"
                  clearable
                  :min="-2"
                  :max="2"
                  :step="0.1"
                />
              </n-form-item>
            </div>
            <p class="model-chain-form__hint">
              Max Tokens 是最大输出长度，需小于模型上下文长度；预设中的同名参数优先于模型默认参数。
            </p>
            <n-divider>Prompt 编译能力</n-divider>
            <div class="model-chain-form__grid">
              <n-form-item label="System 位置">
                <NSelect
                  v-model:value="modelForm.systemPlacement"
                  :options="systemPlacementOptions"
                />
              </n-form-item>
              <n-form-item label="Tokenizer">
                <NSelect v-model:value="modelForm.tokenizerType" :options="tokenizerOptions" />
              </n-form-item>
            </div>
            <n-space vertical>
              <n-checkbox v-model:checked="modelForm.supportsDeveloperRole"
                >支持 developer role</n-checkbox
              >
              <n-checkbox v-model:checked="modelForm.supportsMultipleSystemMessages"
                >支持多条 system</n-checkbox
              >
              <n-checkbox v-model:checked="modelForm.requiresAlternatingRoles"
                >要求 user / assistant 交替</n-checkbox
              >
            </n-space>
            <n-form-item label="内部备注（不影响生成）">
              <n-input v-model:value="modelForm.notes" type="textarea" maxlength="500" />
            </n-form-item>
            <n-checkbox v-model:checked="modelForm.isEnabled">启用</n-checkbox>
          </template>

          <template v-else>
            <n-form-item label="模型链名称" required>
              <n-input v-model:value="groupForm.name" maxlength="120" />
            </n-form-item>
            <n-form-item label="候选模型" required>
              <NSelect
                v-model:value="groupForm.modelIds"
                multiple
                filterable
                :options="modelOptions"
                placeholder="按选择顺序生成调用顺序"
              />
            </n-form-item>
            <div v-if="groupForm.modelIds.length" class="model-chain-candidates">
              <div v-for="modelId in groupForm.modelIds" :key="modelId">
                <span>{{ modelNameById(modelId) }}</span>
                <n-switch
                  :value="groupForm.candidateEnabled[modelId] !== false"
                  size="small"
                  @update:value="setCandidateEnabled(modelId, $event)"
                >
                  <template #checked>启用</template>
                  <template #unchecked>停用</template>
                </n-switch>
              </div>
            </div>
            <n-space>
              <n-checkbox v-model:checked="groupForm.isDefault">默认模型链</n-checkbox>
              <n-checkbox v-model:checked="groupForm.isEnabled">启用</n-checkbox>
            </n-space>
          </template>

          <n-alert v-if="modelStore.saveError" type="error" :bordered="false">
            {{ modelStore.saveError }}
          </n-alert>

          <n-space justify="end">
            <n-button secondary @click="closeDrawer">取消</n-button>
            <n-button type="primary" :loading="modelStore.saving" attr-type="submit">保存</n-button>
          </n-space>
        </n-form>
      </n-drawer-content>
    </n-drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { NSelect, type SelectOption, useDialog, useMessage } from 'naive-ui';

import {
  fetchSupportedModelProviders,
  testProviderModelConnection,
  type ModelFallbackGroup,
  type ModelProvider,
  type ProviderModel
} from '../../api/models';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import { useModelStore } from '../../stores/model';

type DrawerMode = 'provider' | 'model' | 'group';

const modelStore = useModelStore();
const message = useMessage();
const dialog = useDialog();
const drawerVisible = ref(false);
const drawerMode = ref<DrawerMode>('provider');
const editingProvider = ref<ModelProvider | null>(null);
const editingModel = ref<ProviderModel | null>(null);
const editingGroup = ref<ModelFallbackGroup | null>(null);
const testingId = ref<string | null>(null);
const supportedProviderNames = ref<string[]>([]);
const drawerWidth = computed(() => Math.min(720, window.innerWidth));
const drawerTitle = computed(() => {
  if (drawerMode.value === 'provider') {
    return editingProvider.value ? '编辑供应商' : '新建供应商';
  }

  if (drawerMode.value === 'model') {
    return editingModel.value ? '编辑模型' : '新建模型';
  }

  return editingGroup.value ? '编辑模型链' : '新建模型链';
});

const providerForm = reactive({
  name: '',
  providerName: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  timeout: null as number | null,
  isDefault: false,
  isEnabled: true
});

const modelForm = reactive({
  providerId: '',
  name: '',
  modelName: '',
  temperature: null as number | null,
  topP: null as number | null,
  maxTokens: null as number | null,
  timeout: null as number | null,
  contextLength: null as number | null,
  supportsDeveloperRole: false,
  systemPlacement: 'initial_only' as 'initial_only' | 'midstream_allowed',
  supportsMultipleSystemMessages: false,
  requiresAlternatingRoles: true,
  tokenizerType: 'estimated_chars_v1',
  frequencyPenalty: null as number | null,
  presencePenalty: null as number | null,
  notes: '',
  isEnabled: true
});

const groupForm = reactive({
  name: '',
  modelIds: [] as string[],
  candidateEnabled: {} as Record<string, boolean>,
  isDefault: false,
  isEnabled: true
});
const systemPlacementOptions = [
  { label: '仅消息序列开头', value: 'initial_only' },
  { label: '允许中途插入', value: 'midstream_allowed' }
];
const tokenizerOptions = [
  { label: '字符估算 v1', value: 'estimated_chars_v1' },
  { label: 'OpenAI 兼容估算', value: 'openai_compatible' }
];

const providerOptions = computed<SelectOption[]>(() =>
  modelStore.providers.map((provider) => ({
    label: `${provider.name} / ${provider.providerName}`,
    value: provider.id,
    disabled: !provider.isEnabled
  }))
);

const supportedProviderOptions = computed<SelectOption[]>(() =>
  supportedProviderNames.value.map((providerName) => ({
    label: providerName,
    value: providerName
  }))
);

const modelOptions = computed<SelectOption[]>(() =>
  modelStore.providerModels.map((model) => ({
    label: `${model.providerDisplayName} / ${model.name}`,
    value: model.id,
    disabled: !model.isEnabled
  }))
);

onMounted(async () => {
  const [supported] = await Promise.allSettled([
    fetchSupportedModelProviders(),
    modelStore.loadModelResources()
  ]);

  if (supported.status === 'fulfilled') {
    supportedProviderNames.value = supported.value.items;
  } else {
    modelStore.error =
      supported.reason instanceof Error ? supported.reason.message : '供应商类型加载失败。';
  }
});

function openCreateProvider() {
  editingProvider.value = null;
  Object.assign(providerForm, {
    name: '',
    providerName: 'openai-compatible',
    baseUrl: '',
    apiKey: '',
    timeout: null,
    isDefault: false,
    isEnabled: true
  });
  openDrawer('provider');
}

function openEditProvider(provider: ModelProvider) {
  editingProvider.value = provider;
  Object.assign(providerForm, {
    name: provider.name,
    providerName: provider.providerName,
    baseUrl: provider.baseUrl,
    apiKey: '',
    timeout: provider.timeout,
    isDefault: provider.isDefault,
    isEnabled: provider.isEnabled
  });
  openDrawer('provider');
}

function openCreateModel() {
  editingModel.value = null;
  Object.assign(modelForm, {
    providerId: modelStore.providers.find((provider) => provider.isDefault)?.id ?? '',
    name: '',
    modelName: '',
    temperature: null,
    topP: null,
    maxTokens: null,
    timeout: null,
    contextLength: null,
    supportsDeveloperRole: false,
    systemPlacement: 'initial_only',
    supportsMultipleSystemMessages: false,
    requiresAlternatingRoles: true,
    tokenizerType: 'estimated_chars_v1',
    frequencyPenalty: null,
    presencePenalty: null,
    notes: '',
    isEnabled: true
  });
  openDrawer('model');
}

function openEditModel(model: ProviderModel) {
  editingModel.value = model;
  Object.assign(modelForm, {
    providerId: model.providerId,
    name: model.name,
    modelName: model.modelName,
    temperature: model.temperature,
    topP: model.topP,
    maxTokens: model.maxTokens,
    timeout: model.timeout,
    contextLength: model.contextLength,
    supportsDeveloperRole: model.supportsDeveloperRole,
    systemPlacement: model.systemPlacement,
    supportsMultipleSystemMessages: model.supportsMultipleSystemMessages,
    requiresAlternatingRoles: model.requiresAlternatingRoles,
    tokenizerType: model.tokenizerType,
    frequencyPenalty: model.frequencyPenalty,
    presencePenalty: model.presencePenalty,
    notes: model.notes ?? '',
    isEnabled: model.isEnabled
  });
  openDrawer('model');
}

function openCreateGroup() {
  editingGroup.value = null;
  Object.assign(groupForm, {
    name: '',
    modelIds: [],
    candidateEnabled: {},
    isDefault: false,
    isEnabled: true
  });
  openDrawer('group');
}

function openEditGroup(group: ModelFallbackGroup) {
  editingGroup.value = group;
  const candidates = group.candidates.slice().sort((left, right) => left.priority - right.priority);
  Object.assign(groupForm, {
    name: group.name,
    modelIds: candidates.map((candidate) => candidate.modelId),
    candidateEnabled: Object.fromEntries(
      candidates.map((candidate) => [candidate.modelId, candidate.isEnabled])
    ),
    isDefault: group.isDefault,
    isEnabled: group.isEnabled
  });
  openDrawer('group');
}

function openDrawer(mode: DrawerMode) {
  drawerMode.value = mode;
  modelStore.saveError = null;
  drawerVisible.value = true;
}

function closeDrawer() {
  drawerVisible.value = false;
}

async function submitDrawer() {
  if (drawerMode.value === 'provider') {
    await submitProvider();
    return;
  }

  if (drawerMode.value === 'model') {
    await submitModel();
    return;
  }

  await submitGroup();
}

async function submitProvider() {
  if (!providerForm.name.trim() || !providerForm.providerName || !providerForm.baseUrl.trim()) {
    message.warning('请填写供应商名称、类型和 Base URL。');
    return;
  }

  const payload = {
    name: providerForm.name.trim(),
    providerName: providerForm.providerName.trim(),
    baseUrl: providerForm.baseUrl.trim(),
    timeout: providerForm.timeout,
    isDefault: providerForm.isDefault,
    isEnabled: providerForm.isEnabled,
    ...(providerForm.apiKey.trim() ? { apiKey: providerForm.apiKey.trim() } : {})
  };
  const result = editingProvider.value
    ? await modelStore.updateProvider(editingProvider.value.id, payload)
    : await modelStore.createProvider(payload);

  if (result) {
    message.success('供应商已保存');
    closeDrawer();
  }
}

async function submitModel() {
  if (!modelForm.providerId || !modelForm.name.trim() || !modelForm.modelName.trim()) {
    message.warning('请选择供应商并填写模型名称。');
    return;
  }

  const payload = {
    providerId: modelForm.providerId,
    name: modelForm.name.trim(),
    modelName: modelForm.modelName.trim(),
    temperature: modelForm.temperature,
    topP: modelForm.topP,
    maxTokens: modelForm.maxTokens,
    timeout: modelForm.timeout,
    contextLength: modelForm.contextLength,
    supportsDeveloperRole: modelForm.supportsDeveloperRole,
    systemPlacement: modelForm.systemPlacement,
    supportsMultipleSystemMessages: modelForm.supportsMultipleSystemMessages,
    requiresAlternatingRoles: modelForm.requiresAlternatingRoles,
    tokenizerType: modelForm.tokenizerType,
    frequencyPenalty: modelForm.frequencyPenalty,
    presencePenalty: modelForm.presencePenalty,
    notes: modelForm.notes.trim() || null,
    isEnabled: modelForm.isEnabled
  };
  const result = editingModel.value
    ? await modelStore.updateProviderModel(editingModel.value.id, payload)
    : await modelStore.createProviderModel(payload);

  if (result) {
    message.success('模型已保存');
    closeDrawer();
  }
}

async function submitGroup() {
  if (!groupForm.name.trim() || groupForm.modelIds.length === 0) {
    message.warning('请填写模型链名称并选择候选模型。');
    return;
  }

  const payload = {
    name: groupForm.name.trim(),
    isDefault: groupForm.isDefault,
    isEnabled: groupForm.isEnabled,
    candidates: groupForm.modelIds.map((modelId, index) => ({
      modelId,
      priority: index + 1,
      isEnabled: groupForm.candidateEnabled[modelId] !== false
    }))
  };
  const result = editingGroup.value
    ? await modelStore.updateFallbackGroup(editingGroup.value.id, payload)
    : await modelStore.createFallbackGroup(payload);

  if (result) {
    message.success('模型链已保存');
    closeDrawer();
  }
}

async function testModel(model: ProviderModel) {
  testingId.value = model.id;

  try {
    const result = await testProviderModelConnection(model.id);

    if (result.ok) {
      message.success(`连接测试通过，耗时 ${result.latencyMs}ms`);
    } else {
      message.error(result.message);
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '连接测试失败。');
  } finally {
    testingId.value = null;
  }
}

function deleteProvider(provider: ModelProvider) {
  dialog.warning({
    title: '删除供应商',
    content: `确认删除“${provider.name}”？关联模型会不可用。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (await modelStore.deleteProvider(provider.id)) {
        message.success('供应商已删除');
      }
    }
  });
}

function deleteModel(model: ProviderModel) {
  dialog.warning({
    title: '删除模型',
    content: `确认删除“${model.name}”？模型链中的候选会失效。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (await modelStore.deleteProviderModel(model.id)) {
        message.success('模型已删除');
      }
    }
  });
}

function deleteGroup(group: ModelFallbackGroup) {
  dialog.warning({
    title: '删除模型链',
    content: `确认删除“${group.name}”？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (await modelStore.deleteFallbackGroup(group.id)) {
        message.success('模型链已删除');
      }
    }
  });
}

function modelParamSummary(model: ProviderModel): string {
  const parts = [
    model.temperature === null ? null : `temp ${model.temperature}`,
    model.topP === null ? null : `topP ${model.topP}`,
    model.maxTokens === null ? null : `max ${model.maxTokens}`,
    model.timeout !== null
      ? `${model.timeout}ms`
      : model.effectiveTimeout === null
        ? null
        : `${model.effectiveTimeout}ms（继承）`,
    model.contextLength === null ? null : `ctx ${model.contextLength}`,
    model.frequencyPenalty === null ? null : `freq ${model.frequencyPenalty}`,
    model.presencePenalty === null ? null : `pres ${model.presencePenalty}`
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : '未设置';
}

function modelNameById(modelId: string): string {
  const model = modelStore.providerModels.find((item) => item.id === modelId);
  return model ? `${model.providerDisplayName} / ${model.name}` : modelId;
}

function setCandidateEnabled(modelId: string, value: boolean) {
  groupForm.candidateEnabled[modelId] = value;
}
</script>

<style scoped>
.model-chain-view {
  align-content: start;
}

.model-chain-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.model-chain-view__content,
.model-chain-section {
  display: grid;
  gap: 16px;
}

.model-chain-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-chain-section__header h3 {
  margin: 0;
  color: var(--text-strong);
}

.model-chain-section__header span {
  color: var(--text-muted);
  font-size: 13px;
}

.model-chain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.model-chain-card {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.model-chain-card__title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.model-chain-card__title strong {
  overflow: hidden;
  min-width: 0;
  color: var(--text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-chain-meta {
  display: grid;
  gap: 10px;
  margin: 0;
}

.model-chain-meta div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.model-chain-meta dt {
  color: var(--text-muted);
  font-size: 12px;
}

.model-chain-meta dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--text-strong);
  line-height: 1.5;
}

.model-chain-order {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  color: var(--text-strong);
}

.model-chain-form {
  display: grid;
  gap: 6px;
}

.model-chain-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.model-chain-form__hint {
  margin: 0 0 8px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.model-chain-candidates {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}

.model-chain-candidates > div {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
}

@media (max-width: 780px) {
  .model-chain-view__header,
  .model-chain-form__grid {
    grid-template-columns: 1fr;
  }

  .model-chain-grid {
    grid-template-columns: 1fr;
  }
}
</style>
