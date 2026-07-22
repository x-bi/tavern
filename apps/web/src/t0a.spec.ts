import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';

describe('T0a web mount', () => {
  it('mounts a Vue component in jsdom', async () => {
    const wrapper = mount(
      defineComponent({
        data: () => ({ count: 0 }),
        template: '<button @click="count += 1">{{ count }}</button>'
      })
    );
    await wrapper.get('button').trigger('click');
    expect(wrapper.text()).toBe('1');
  });
});
