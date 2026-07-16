import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      '/api/public': process.env.SHARE_API_PROXY_TARGET ?? 'http://127.0.0.1:3100',
      '/uploads': process.env.SHARE_API_PROXY_TARGET ?? 'http://127.0.0.1:3100'
    }
  }
});
