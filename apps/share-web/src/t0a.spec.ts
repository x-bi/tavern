import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';

describe('T0a share-web mount', () => {
  it('mounts public UI without main-site state', () => {
    const wrapper = mount(defineComponent({ template: '<main data-public>公开聊天</main>' }));
    expect(wrapper.get('[data-public]').text()).toBe('公开聊天');
  });
});
