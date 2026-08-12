<template>
  <main class="page-shell qq-page">
    <header class="page-shell__header qq-header">
      <div>
        <h2>QQ 接入</h2>
        <p>使用普通 QQ 小号接入 NapCat；QQ 好友与系统聊天目标严格一对一并实时共用消息。</p>
      </div>
      <n-button type="primary" @click="openAccountModal()">添加 QQ 账号</n-button>
    </header>

    <n-alert type="warning" :bordered="false">
      普通 QQ 登录依赖
      NapCat/NTQQ，存在平台风控和协议升级失效的可能。请只使用专用小号，不要使用主账号。
    </n-alert>

    <n-card :bordered="false" class="page-panel">
      <div class="section-head">
        <div>
          <h3>1. QQ 账号连接</h3>
          <p>先在 NapCat WebUI 扫码登录，再配置 HTTP 服务和下方事件回调。</p>
        </div>
        <n-button secondary :loading="loading" @click="loadAll">刷新</n-button>
      </div>
      <n-spin :show="loading">
        <div v-if="accounts.length" class="account-grid">
          <article v-for="account in accounts" :key="account.id" class="account-card">
            <div class="row-between">
              <div>
                <strong>{{ account.label }}</strong>
                <p>{{ account.nickname || '未识别昵称' }} · {{ account.qqUin || '尚未连接' }}</p>
              </div>
              <n-tag
                :type="
                  account.status === 'online'
                    ? 'success'
                    : account.status === 'error'
                      ? 'error'
                      : 'default'
                "
              >
                {{ statusLabel(account.status) }}
              </n-tag>
            </div>
            <div class="account-meta">
              <span>OneBot API：{{ account.apiBaseUrl }}</span>
              <span>Token：{{ account.accessTokenMask || '未设置' }}</span>
              <span v-if="account.lastErrorMessage" class="error-text">{{
                account.lastErrorMessage
              }}</span>
            </div>
            <div class="callback-box">
              <span>NapCat「HTTP 客户端」事件上报 URL</span>
              <code>{{ account.callbackUrl }}</code>
              <n-button size="small" secondary @click="copyText(account.callbackUrl)"
                >复制回调地址</n-button
              >
            </div>
            <div class="actions">
              <n-button
                v-if="account.webUiUrl"
                size="small"
                tag="a"
                :href="account.webUiUrl"
                target="_blank"
                >打开 NapCat 登录页</n-button
              >
              <n-button
                size="small"
                :loading="testingId === account.id"
                @click="testAccount(account)"
                >测试连接</n-button
              >
              <n-button size="small" secondary @click="openAccountModal(account)">编辑</n-button>
              <n-button size="small" type="error" secondary @click="removeAccount(account)"
                >删除</n-button
              >
            </div>
          </article>
        </div>
        <n-result
          v-else
          status="info"
          title="还没有 QQ 账号"
          description="添加 NapCat 的 OneBot HTTP 地址后即可读取好友并建立绑定。"
        />
      </n-spin>
    </n-card>

    <n-card :bordered="false" class="page-panel">
      <div class="section-head">
        <div>
          <h3>2. 创建一对一绑定</h3>
          <p>一个好友只能绑定一个聊天目标，一个聊天目标也只能绑定一个好友；已有绑定可切换。</p>
        </div>
      </div>
      <div class="binding-form">
        <n-form-item label="QQ 账号">
          <n-select
            v-model:value="bindingForm.qqAccountId"
            :options="accountOptions"
            placeholder="选择已连接账号"
            @update:value="loadFriends"
          />
        </n-form-item>
        <n-form-item label="QQ 好友">
          <n-select
            v-model:value="bindingForm.peerQqUin"
            filterable
            :loading="friendsLoading"
            :options="friendOptions"
            placeholder="先选择账号并读取好友"
          />
        </n-form-item>
        <n-form-item label="聊天类型">
          <n-select
            v-model:value="bindingForm.targetType"
            :options="targetTypeOptions"
            @update:value="bindingForm.targetId = null"
          />
        </n-form-item>
        <n-form-item label="聊天目标">
          <n-select
            v-model:value="bindingForm.targetId"
            filterable
            :options="availableTargetOptions"
            placeholder="选择未绑定的会话"
          />
        </n-form-item>
        <n-button
          type="primary"
          :loading="savingBinding"
          :disabled="!canCreateBinding"
          @click="createBinding"
          >建立绑定</n-button
        >
      </div>
    </n-card>

    <n-card :bordered="false" class="page-panel">
      <div class="section-head">
        <div>
          <h3>3. 当前绑定</h3>
          <p>切换只改变后续消息路由，不移动或合并原会话历史。</p>
        </div>
      </div>
      <div v-if="bindings.length" class="binding-list">
        <article v-for="binding in bindings" :key="binding.id" class="binding-row">
          <div>
            <strong>{{ binding.peerNickname || binding.peerQqUin }}</strong>
            <p>{{ binding.accountLabel }} · QQ {{ binding.peerQqUin }}</p>
          </div>
          <div class="binding-arrow">↔</div>
          <div>
            <strong>{{ binding.targetTitle }}</strong>
            <p>{{ binding.targetType === 'conversation' ? '普通角色会话' : 'AI 角色持续会话' }}</p>
          </div>
          <div class="binding-status">
            <span>最近接收：{{ formatTime(binding.lastInboundAt) }}</span>
            <span>最近发送：{{ formatTime(binding.lastOutboundAt) }}</span>
            <span v-if="binding.lastErrorMessage" class="error-text">{{
              binding.lastErrorMessage
            }}</span>
          </div>
          <div class="actions">
            <n-button size="small" @click="openSwitchModal(binding)">切换会话</n-button>
            <n-button size="small" type="error" secondary @click="removeBinding(binding)"
              >解绑</n-button
            >
          </div>
        </article>
      </div>
      <n-result
        v-else
        status="info"
        title="暂无绑定"
        description="完成账号连接后，为好友选择一个普通会话或 AI 角色。"
      />
    </n-card>

    <n-modal
      v-model:show="showAccountModal"
      preset="card"
      :title="editingAccount ? '编辑 QQ 账号' : '添加 QQ 账号'"
      class="form-modal"
    >
      <n-form>
        <n-form-item label="配置名称"
          ><n-input v-model:value="accountForm.label" placeholder="例如：陪伴小号"
        /></n-form-item>
        <n-form-item label="OneBot HTTP API"
          ><n-input
            v-model:value="accountForm.apiBaseUrl"
            placeholder="Docker： http://napcat:3000"
        /></n-form-item>
        <n-form-item label="NapCat WebUI"
          ><n-input
            v-model:value="accountForm.webUiUrl"
            placeholder="例如：http://服务器IP:6099/webui"
        /></n-form-item>
        <n-form-item
          :label="
            editingAccount?.hasAccessToken ? 'Access Token（留空保持原值）' : 'Access Token（可选）'
          "
        >
          <n-input
            v-model:value="accountForm.accessToken"
            type="password"
            show-password-on="click"
          />
        </n-form-item>
      </n-form>
      <div class="actions modal-actions">
        <n-button @click="showAccountModal = false">取消</n-button
        ><n-button type="primary" :loading="savingAccount" @click="saveAccount">保存</n-button>
      </div>
    </n-modal>

    <n-modal v-model:show="showSwitchModal" preset="card" title="切换绑定会话" class="form-modal">
      <n-alert type="info" :bordered="false"
        >原聊天历史会保留；该 QQ 好友之后的新消息进入新目标。</n-alert
      >
      <n-form>
        <n-form-item label="聊天类型"
          ><n-select
            v-model:value="switchForm.targetType"
            :options="targetTypeOptions"
            @update:value="switchForm.targetId = null"
        /></n-form-item>
        <n-form-item label="新聊天目标"
          ><n-select v-model:value="switchForm.targetId" filterable :options="switchTargetOptions"
        /></n-form-item>
      </n-form>
      <div class="actions modal-actions">
        <n-button @click="showSwitchModal = false">取消</n-button
        ><n-button
          type="primary"
          :loading="switching"
          :disabled="!switchForm.targetId"
          @click="switchBinding"
          >确认切换</n-button
        >
      </div>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import type {
  QqAccountItem,
  QqAccountStatus,
  QqChatBindingItem,
  QqFriendItem,
  QqTargetType
} from '@tavern/shared';
import { computed, onMounted, reactive, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import {
  createQqAccount,
  createQqBinding,
  deleteQqAccount,
  deleteQqBinding,
  listQqAccounts,
  listQqBindings,
  listQqFriends,
  listQqTargets,
  switchQqBinding,
  testQqAccount,
  updateQqAccount
} from '../../api/qqBridge';

const message = useMessage();
const dialog = useDialog();
const accounts = ref<QqAccountItem[]>([]);
const bindings = ref<QqChatBindingItem[]>([]);
const targets = ref<Awaited<ReturnType<typeof listQqTargets>>['items']>([]);
const friends = ref<QqFriendItem[]>([]);
const loading = ref(false);
const friendsLoading = ref(false);
const savingAccount = ref(false);
const savingBinding = ref(false);
const testingId = ref<string | null>(null);
const showAccountModal = ref(false);
const editingAccount = ref<QqAccountItem | null>(null);
const showSwitchModal = ref(false);
const switching = ref(false);
const switchingBinding = ref<QqChatBindingItem | null>(null);

const accountForm = reactive({
  label: '',
  apiBaseUrl: 'http://napcat:3000',
  webUiUrl: defaultWebUiUrl(),
  accessToken: ''
});
const bindingForm = reactive<{
  qqAccountId: string | null;
  peerQqUin: string | null;
  targetType: QqTargetType;
  targetId: string | null;
}>({ qqAccountId: null, peerQqUin: null, targetType: 'conversation', targetId: null });
const switchForm = reactive<{ targetType: QqTargetType; targetId: string | null }>({
  targetType: 'conversation',
  targetId: null
});
const targetTypeOptions = [
  { label: '普通角色会话', value: 'conversation' },
  { label: 'AI 角色', value: 'companion' }
];
const accountOptions = computed(() =>
  accounts.value.map((item) => ({
    label: `${item.label}${item.qqUin ? `（${item.qqUin}）` : ''}`,
    value: item.id
  }))
);
const friendOptions = computed(() =>
  friends.value.map((item) => ({
    label: `${item.displayName}（${item.qqUin}）`,
    value: item.qqUin
  }))
);
const availableTargetOptions = computed(() => targetOptions(bindingForm.targetType, null));
const switchTargetOptions = computed(() =>
  targetOptions(switchForm.targetType, switchingBinding.value?.id ?? null)
);
const canCreateBinding = computed(() =>
  Boolean(bindingForm.qqAccountId && bindingForm.peerQqUin && bindingForm.targetId)
);

onMounted(loadAll);

async function loadAll() {
  loading.value = true;
  try {
    const [accountResult, bindingResult, targetResult] = await Promise.all([
      listQqAccounts(),
      listQqBindings(),
      listQqTargets()
    ]);
    accounts.value = accountResult.items;
    bindings.value = bindingResult.items;
    targets.value = targetResult.items;
  } catch (error) {
    message.error(messageOf(error));
  } finally {
    loading.value = false;
  }
}

function openAccountModal(account?: QqAccountItem) {
  editingAccount.value = account ?? null;
  accountForm.label = account?.label ?? '';
  accountForm.apiBaseUrl = account?.apiBaseUrl ?? 'http://napcat:3000';
  accountForm.webUiUrl = account?.webUiUrl ?? defaultWebUiUrl();
  accountForm.accessToken = '';
  showAccountModal.value = true;
}

async function saveAccount() {
  if (!accountForm.label.trim() || !accountForm.apiBaseUrl.trim())
    return message.warning('请填写配置名称和 OneBot HTTP API。');
  savingAccount.value = true;
  try {
    const payload = {
      label: accountForm.label.trim(),
      apiBaseUrl: accountForm.apiBaseUrl.trim(),
      webUiUrl: accountForm.webUiUrl.trim() || null,
      ...(accountForm.accessToken ? { accessToken: accountForm.accessToken } : {})
    };
    if (editingAccount.value) await updateQqAccount(editingAccount.value.id, payload);
    else await createQqAccount(payload);
    showAccountModal.value = false;
    await loadAll();
    message.success('QQ 账号配置已保存。');
  } catch (error) {
    message.error(messageOf(error));
  } finally {
    savingAccount.value = false;
  }
}

async function testAccount(account: QqAccountItem) {
  testingId.value = account.id;
  try {
    const result = await testQqAccount(account.id);
    result.ok ? message.success(result.message) : message.error(result.message);
    await loadAll();
  } catch (error) {
    message.error(messageOf(error));
  } finally {
    testingId.value = null;
  }
}

async function loadFriends(accountId: string | null) {
  bindingForm.peerQqUin = null;
  friends.value = [];
  if (!accountId) return;
  friendsLoading.value = true;
  try {
    friends.value = (await listQqFriends(accountId)).items;
  } catch (error) {
    message.error(messageOf(error));
  } finally {
    friendsLoading.value = false;
  }
}

async function createBinding() {
  if (!bindingForm.qqAccountId || !bindingForm.peerQqUin || !bindingForm.targetId) return;
  const friend = friends.value.find((item) => item.qqUin === bindingForm.peerQqUin);
  savingBinding.value = true;
  try {
    await createQqBinding({
      qqAccountId: bindingForm.qqAccountId,
      peerQqUin: bindingForm.peerQqUin,
      peerNickname: friend?.displayName ?? null,
      targetType: bindingForm.targetType,
      targetId: bindingForm.targetId
    });
    bindingForm.peerQqUin = null;
    bindingForm.targetId = null;
    await loadAll();
    message.success('一对一绑定已建立。');
  } catch (error) {
    message.error(messageOf(error));
  } finally {
    savingBinding.value = false;
  }
}

function openSwitchModal(binding: QqChatBindingItem) {
  switchingBinding.value = binding;
  switchForm.targetType = binding.targetType;
  switchForm.targetId = binding.targetId;
  showSwitchModal.value = true;
}
async function switchBinding() {
  if (!switchingBinding.value || !switchForm.targetId) return;
  switching.value = true;
  try {
    await switchQqBinding(switchingBinding.value.id, {
      targetType: switchForm.targetType,
      targetId: switchForm.targetId
    });
    showSwitchModal.value = false;
    await loadAll();
    message.success('绑定已切换。');
  } catch (error) {
    message.error(messageOf(error));
  } finally {
    switching.value = false;
  }
}

function removeBinding(binding: QqChatBindingItem) {
  dialog.warning({
    title: '解除绑定',
    content: '解除后历史仍保留，但该好友的新消息不再进入系统。',
    positiveText: '解除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteQqBinding(binding.id);
        await loadAll();
        message.success('绑定已解除。');
      } catch (error) {
        message.error(messageOf(error));
      }
    }
  });
}
function removeAccount(account: QqAccountItem) {
  dialog.warning({
    title: '删除 QQ 配置',
    content: '会同时删除该账号的绑定和未完成投递记录，不影响聊天历史。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteQqAccount(account.id);
        await loadAll();
        message.success('QQ 配置已删除。');
      } catch (error) {
        message.error(messageOf(error));
      }
    }
  });
}
function targetOptions(type: QqTargetType, allowBindingId: string | null) {
  return targets.value
    .filter(
      (item) => item.targetType === type && (!item.bindingId || item.bindingId === allowBindingId)
    )
    .map((item) => ({
      label: `${item.title}${item.subtitle ? ` · ${item.subtitle}` : ''}`,
      value: item.targetId
    }));
}
async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    message.success('已复制。');
  } catch {
    message.warning('浏览器禁止复制，请手动选择。');
  }
}
function statusLabel(status: QqAccountStatus) {
  return ({ online: '在线', offline: '离线', error: '异常', unknown: '未检测' } as const)[status];
}
function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '暂无';
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'QQ 接入操作失败。';
}
function defaultWebUiUrl() {
  return 'http://127.0.0.1:6099/webui';
}
</script>

<style scoped>
.qq-page {
  display: grid;
  gap: 18px;
}
.qq-header {
  grid-template-columns: 1fr auto;
  align-items: start;
}
.section-head,
.row-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.section-head h3,
.section-head p,
.account-card p,
.binding-row p {
  margin: 0;
}
.section-head p,
.account-card p,
.binding-row p {
  margin-top: 5px;
  color: var(--text-muted);
}
.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.account-card,
.binding-row {
  padding: 16px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}
.account-meta {
  display: grid;
  gap: 5px;
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 12px;
}
.callback-box {
  display: grid;
  gap: 8px;
  margin: 14px 0;
  padding: 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.16);
}
.callback-box code {
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-size: 12px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.binding-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr)) auto;
  align-items: end;
  gap: 12px;
  margin-top: 16px;
}
.binding-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.binding-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) auto minmax(200px, 1fr) minmax(210px, 0.8fr) auto;
  align-items: center;
  gap: 16px;
}
.binding-arrow {
  color: var(--text-muted);
  font-size: 20px;
}
.binding-status {
  display: grid;
  gap: 4px;
  color: var(--text-muted);
  font-size: 12px;
}
.error-text {
  color: #e88080 !important;
}
.form-modal {
  width: min(620px, calc(100vw - 32px));
}
.modal-actions {
  justify-content: flex-end;
  margin-top: 12px;
}
@media (max-width: 1100px) {
  .binding-form {
    grid-template-columns: repeat(2, 1fr);
  }
  .binding-row {
    grid-template-columns: 1fr auto 1fr;
  }
  .binding-status,
  .binding-row > .actions {
    grid-column: 1 / -1;
  }
}
@media (max-width: 720px) {
  .qq-header,
  .section-head,
  .binding-form,
  .binding-row {
    display: grid;
    grid-template-columns: 1fr;
  }
  .binding-arrow {
    transform: rotate(90deg);
  }
}
</style>
