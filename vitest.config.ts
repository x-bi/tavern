import vue from '@vitejs/plugin-vue';
import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'server-unit',
          environment: 'node',
          include: ['apps/server/test/unit/**/*.spec.ts', 'packages/shared/src/**/*.spec.ts']
        }
      }),
      defineProject({
        test: {
          name: 'server-integration',
          environment: 'node',
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
          include: ['apps/server/test/integration/**/*.spec.ts']
        }
      }),
      defineProject({
        plugins: [vue()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.spec.ts']
        }
      }),
      defineProject({
        plugins: [vue()],
        test: {
          name: 'share-web',
          environment: 'jsdom',
          include: ['apps/share-web/src/**/*.spec.ts']
        }
      })
    ]
  }
});
