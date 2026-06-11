import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskableHistory } from '../useAskableHistory.js';
import { track } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await nextTick();
}

describe('useAskableHistory (Vue)', () => {
  it('starts with empty history', async () => {
    const ctx = createAskableContext();
    const C = defineComponent({
      setup() { return useAskableHistory({ ctx }); },
      template: `<span data-testid="count">{{ history.length }}</span>`,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();
    expect(wrapper.find('[data-testid="count"]').text()).toBe('0');
    ctx.destroy();
  });

  it('records focus events', async () => {
    const ctx = createAskableContext();
    const C = defineComponent({
      setup() { return useAskableHistory({ ctx }); },
      template: `<span data-testid="count">{{ history.length }}</span>`,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' });
    await nextTick();

    expect(wrapper.find('[data-testid="count"]').text()).toBe('1');
    ctx.destroy();
  });

  it('appends newest entry at the front', async () => {
    const ctx = createAskableContext();
    const C = defineComponent({
      setup() { return useAskableHistory({ ctx }); },
      template: `
        <div>
          <span data-testid="first">{{ history[0] ? JSON.stringify(history[0].meta) : '' }}</span>
          <span data-testid="second">{{ history[1] ? JSON.stringify(history[1].meta) : '' }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' });
    await nextTick();
    ctx.push({ meta: { id: 'churn' }, text: 'Churn' });
    await nextTick();

    expect(wrapper.find('[data-testid="first"]').text()).toContain('churn');
    expect(wrapper.find('[data-testid="second"]').text()).toContain('revenue');
    ctx.destroy();
  });

  it('deduplicates consecutive identical entries', async () => {
    const ctx = createAskableContext();
    const C = defineComponent({
      setup() { return useAskableHistory({ ctx }); },
      template: `<span data-testid="count">{{ history.length }}</span>`,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' });
    ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' });
    await nextTick();

    expect(wrapper.find('[data-testid="count"]').text()).toBe('1');
    ctx.destroy();
  });

  it('caps at maxEntries', async () => {
    const ctx = createAskableContext();
    const C = defineComponent({
      setup() { return useAskableHistory({ ctx, maxEntries: 3, dedupe: false }); },
      template: `<span data-testid="count">{{ history.length }}</span>`,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    for (let i = 0; i < 5; i++) {
      ctx.push({ meta: { id: `item-${i}` }, text: `Item ${i}` });
    }
    await nextTick();

    expect(wrapper.find('[data-testid="count"]').text()).toBe('3');
    ctx.destroy();
  });
});
