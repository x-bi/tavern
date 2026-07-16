<template>
  <section class="user-management">
    <div class="page-actions">
      <div>
        <h2>成员账号</h2>
        <p>账号由管理员统一维护，系统不开放注册。密码仅可重置，不会显示原密码。</p>
      </div>
      <n-button type="primary" @click="openCreate">新增账号</n-button>
    </div>

    <n-card :bordered="false" class="table-card">
      <n-data-table
        :columns="columns"
        :data="items"
        :loading="loading"
        :row-key="(row: ManagedUser) => row.id"
        :bordered="false"
      />
      <n-empty v-if="!loading && items.length === 0" description="暂无成员账号" />
    </n-card>

    <n-modal v-model:show="showForm" :mask-closable="!saving" @after-leave="resetForm">
      <n-card
        class="member-dialog"
        style="width: min(520px, calc(100vw - 32px))"
        :title="editing ? '编辑账号' : '新增账号'"
        :bordered="false"
        role="dialog"
        aria-modal="true"
      >
        <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" label-width="78">
          <n-form-item label="账号" path="username">
            <n-input v-model:value="form.username" :disabled="Boolean(editing?.isBuiltIn)" placeholder="3-64 位字母、数字或 _ . -" />
          </n-form-item>
          <n-form-item label="名称" path="displayName">
            <n-input v-model:value="form.displayName" placeholder="成员显示名称" />
          </n-form-item>
          <n-form-item label="密码" path="password">
            <n-input
              v-model:value="form.password"
              type="password"
              show-password-on="click"
              :placeholder="editing ? '留空则不修改，至少 4 位' : '至少 4 位'"
              autocomplete="new-password"
            />
          </n-form-item>
          <n-form-item label="角色" path="role">
            <n-radio-group v-model:value="form.role" :disabled="Boolean(editing?.isBuiltIn)">
              <n-space>
                <n-radio value="member">普通成员</n-radio>
                <n-radio value="admin">管理员</n-radio>
              </n-space>
            </n-radio-group>
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button :disabled="saving" @click="showForm = false">取消</n-button>
            <n-button type="primary" :loading="saving" @click="save">保存</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onMounted, reactive, ref } from 'vue';
import {
  NButton, NCard, NDataTable, NEmpty, NForm, NFormItem, NInput, NModal,
  NRadio, NRadioGroup, NSpace, NTag, useDialog, useMessage,
  type DataTableColumns, type FormInst, type FormRules
} from 'naive-ui';

import {
  createManagedUser, deleteManagedUser, fetchManagedUsers, updateManagedUser,
  type ManagedUser, type UserRole
} from '../../api/adminUsers';
import { getStoredCurrentUser } from '../../api/auth';

const items = ref<ManagedUser[]>([]);
const loading = ref(false);
const saving = ref(false);
const showForm = ref(false);
const editing = ref<ManagedUser | null>(null);
const formRef = ref<FormInst | null>(null);
const currentUser = getStoredCurrentUser();
const message = useMessage();
const dialog = useDialog();
const form = reactive({ username: '', displayName: '', password: '', role: 'member' as UserRole });
const rules = computed<FormRules>(() => ({
  username: [{ required: true, pattern: /^[a-zA-Z0-9_.-]{3,64}$/, message: '请输入 3-64 位合法账号', trigger: ['blur', 'input'] }],
  displayName: [{ required: true, message: '请输入名称', trigger: ['blur', 'input'] }],
  password: [{ validator: (_rule, value: string) => editing.value ? (!value || value.length >= 4) : value.length >= 4, message: '密码至少 4 位', trigger: ['blur', 'input'] }],
  role: [{ required: true, message: '请选择角色' }]
}));

const columns: DataTableColumns<ManagedUser> = [
  { title: '账号', key: 'username', render: (row) => h('div', { class: 'account-cell' }, [h('span', row.username), ...(row.isBuiltIn ? [h(NTag, { size: 'small', bordered: false, type: 'info' }, () => '内置')] : [])]) },
  { title: '名称', key: 'displayName' },
  { title: '角色', key: 'role', render: (row) => h(NTag, { size: 'small', type: row.role === 'admin' ? 'success' : 'default' }, () => row.role === 'admin' ? '管理员' : '普通成员') },
  { title: '状态', key: 'isActive', render: () => h(NTag, { size: 'small', bordered: false, type: 'success' }, () => '正常') },
  {
    title: '操作', key: 'actions', width: 150,
    render: (row) => h('div', { class: 'actions' }, [
      h(NButton, { size: 'small', onClick: () => openEdit(row) }, () => '编辑'),
      h(NButton, { size: 'small', type: 'error', secondary: true, disabled: row.isBuiltIn || row.id === currentUser?.id, onClick: () => confirmDelete(row) }, () => '删除')
    ])
  }
];

async function load(): Promise<void> {
  loading.value = true;
  try { items.value = (await fetchManagedUsers()).items; }
  catch (error) { message.error(error instanceof Error ? error.message : '成员列表加载失败。'); }
  finally { loading.value = false; }
}

function openCreate(): void { resetForm(); showForm.value = true; void nextTick(() => formRef.value?.restoreValidation()); }
function openEdit(row: ManagedUser): void {
  editing.value = row;
  Object.assign(form, { username: row.username, displayName: row.displayName, password: '', role: row.role });
  showForm.value = true;
  void nextTick(() => formRef.value?.restoreValidation());
}
function resetForm(): void {
  editing.value = null;
  Object.assign(form, { username: '', displayName: '', password: '', role: 'member' as UserRole });
  formRef.value?.restoreValidation();
}

async function save(): Promise<void> {
  try { await formRef.value?.validate(); } catch { return; }
  saving.value = true;
  try {
    if (editing.value) {
      await updateManagedUser(editing.value.id, {
        username: form.username.trim(), displayName: form.displayName.trim(),
        role: form.role, ...(form.password ? { password: form.password } : {})
      });
    } else {
      await createManagedUser({ username: form.username.trim(), displayName: form.displayName.trim(), password: form.password, role: form.role });
    }
    message.success(editing.value ? '账号已更新。' : '账号已新增。');
    showForm.value = false;
    await load();
  } catch (error) { message.error(error instanceof Error ? error.message : '保存失败。'); }
  finally { saving.value = false; }
}

function confirmDelete(row: ManagedUser): void {
  dialog.warning({
    title: '删除账号', content: `确定删除账号“${row.username}”吗？删除后该账号将无法登录。`,
    positiveText: '删除', negativeText: '取消',
    onPositiveClick: async () => {
      try { await deleteManagedUser(row.id); message.success('账号已删除。'); await load(); }
      catch (error) { message.error(error instanceof Error ? error.message : '删除失败。'); }
    }
  });
}

onMounted(load);
</script>

<style scoped>
.user-management { display: grid; gap: 20px; }
.page-actions { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-actions h2 { margin: 0; color: var(--text-strong); font-size: 24px; }
.page-actions p { margin: 6px 0 0; color: var(--text-muted); }
.table-card { min-height: 180px; }
.member-dialog { width: min(520px, calc(100vw - 32px)); }
:deep(.account-cell), :deep(.actions) { display: flex; align-items: center; gap: 8px; }
@media (max-width: 720px) { .page-actions { align-items: stretch; flex-direction: column; } }
</style>
