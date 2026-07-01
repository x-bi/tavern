import { defineStore } from 'pinia';

import { previewPrompt, type PromptPreview, type PromptPreviewRequest } from '../api/prompts';

type PromptState = {
  preview: PromptPreview | null;
  loading: boolean;
  error: string | null;
};

export const usePromptStore = defineStore('prompt', {
  state: (): PromptState => ({
    preview: null,
    loading: false,
    error: null
  }),
  actions: {
    reset() {
      this.preview = null;
      this.error = null;
      this.loading = false;
    },
    async loadPreview(payload: PromptPreviewRequest): Promise<PromptPreview | null> {
      this.loading = true;
      this.error = null;

      try {
        const result = await previewPrompt(payload);

        this.preview = result;

        return result;
      } catch (error) {
        this.preview = null;
        this.error = error instanceof Error ? error.message : 'Prompt 预览生成失败。';

        return null;
      } finally {
        this.loading = false;
      }
    }
  }
});
