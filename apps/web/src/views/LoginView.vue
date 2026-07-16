<template>
  <main class="login-view"><section class="login-panel"><h1>Tavern Lite</h1><p>使用管理员预置的账号登录。</p>
    <n-form><n-form-item label="账号"><n-input v-model:value="username" autocomplete="username" /></n-form-item><n-form-item label="密码"><n-input v-model:value="password" type="password" show-password-on="click" autocomplete="current-password" @keyup.enter="handleLogin" /></n-form-item>
      <n-button type="primary" block :loading="loading" @click="handleLogin">登录</n-button></n-form>
  </section></main>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { useRouter } from 'vue-router';
import { login } from '../api/auth';
const router = useRouter(); const message = useMessage();
const username = ref(''); const password = ref(''); const loading = ref(false);
async function handleLogin() { loading.value = true; try { await login(username.value.trim(), password.value); await router.replace('/characters'); } catch (error) { message.error(error instanceof Error ? error.message : '登录失败。'); } finally { loading.value = false; } }
</script>
<style scoped>
.login-view{display:grid;min-height:100vh;place-items:center;padding:24px;background:var(--surface-base)}.login-panel{display:grid;gap:16px;width:min(420px,100%);padding:28px;border:1px solid var(--line-subtle);border-radius:8px;background:var(--surface-panel)}.login-panel h1,.login-panel p{margin:0}.login-panel p{color:var(--text-muted)}
</style>
