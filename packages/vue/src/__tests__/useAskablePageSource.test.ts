import { describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskablePageSource } from '../useAskablePageSource.js';
import { track } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('useAskablePageSource (Vue)', () => {
  it('registers a page source under the "page" id by default', async () => {
    const ctx = createAskableContext();

    const Consumer = defineComponent({
      setup() {
        useAskablePageSource({ ctx });
        return {};
      },
      template: '<div />',
    });

    track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    const resolved = await ctx.resolveSource('page');
    expect(resolved.id).toBe('page');
    expect(resolved.kind).toBe('page');

    ctx.destroy();
  });

  it('accepts a custom id', async () => {
    const ctx = createAskableContext();

    const Consumer = defineComponent({
      setup() {
        useAskablePageSource({ ctx, id: 'current-page' });
        return {};
      },
      template: '<div />',
    });

    track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    const resolved = await ctx.resolveSource('current-page');
    expect(resolved.id).toBe('current-page');

    ctx.destroy();
  });

  it('unregisters the source on unmount', async () => {
    const ctx = createAskableContext();

    const Consumer = defineComponent({
      setup() {
        useAskablePageSource({ ctx });
        return {};
      },
      template: '<div />',
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await expect(ctx.resolveSource('page')).resolves.toMatchObject({ id: 'page' });

    wrapper.unmount();

    await expect(ctx.resolveSource('page')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('respects the enabled flag', async () => {
    const ctx = createAskableContext();

    const Consumer = defineComponent({
      setup() {
        useAskablePageSource({ ctx, enabled: false });
        return {};
      },
      template: '<div />',
    });

    track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await expect(ctx.resolveSource('page')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('uses custom kind when provided', async () => {
    const ctx = createAskableContext();

    const Consumer = defineComponent({
      setup() {
        useAskablePageSource({ ctx, kind: 'viewport' });
        return {};
      },
      template: '<div />',
    });

    track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    const resolved = await ctx.resolveSource('page');
    expect(resolved.kind).toBe('viewport');

    ctx.destroy();
  });
});
