import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import type { AskableErrorEntry } from '@askable-ui/core';
import { useAskableErrorSource } from '../useAskableErrorSource.js';
import { track, cleanup } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('useAskableErrorSource (Vue)', () => {
  afterEach(cleanup);

  it('registers source under the "errors" id by default', async () => {
    const ctx = createAskableContext();
    const errors = ref<AskableErrorEntry[]>([]);

    track(mount(defineComponent({
      setup() { useAskableErrorSource({ ctx, errors }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('errors');
    expect(resolved.id).toBe('errors');
    ctx.destroy();
  });

  it('returns errors from an array', async () => {
    const ctx = createAskableContext();
    const errors = ref<AskableErrorEntry[]>([
      { key: 'email', message: 'Invalid email' },
      { key: 'password', message: 'Too short', severity: 'error' },
    ]);

    track(mount(defineComponent({
      setup() { useAskableErrorSource({ ctx, errors }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('errors');
    const data = resolved.data as { errors: AskableErrorEntry[]; total: number };
    expect(data.total).toBe(2);
    expect(data.errors[0].key).toBe('email');
    ctx.destroy();
  });

  it('normalises a Record<string, string> errors map', async () => {
    const ctx = createAskableContext();
    const errors = ref<Record<string, string>>({ email: 'Required', name: 'Too short' });

    track(mount(defineComponent({
      setup() { useAskableErrorSource({ ctx, errors }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('errors');
    const data = resolved.data as { total: number };
    expect(data.total).toBe(2);
    ctx.destroy();
  });

  it('normalises a caught Error object', async () => {
    const ctx = createAskableContext();
    const errors = ref<Error | null>(new Error('Network timeout'));

    track(mount(defineComponent({
      setup() { useAskableErrorSource({ ctx, errors }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('errors');
    const data = resolved.data as { errors: AskableErrorEntry[]; total: number };
    expect(data.total).toBe(1);
    expect(data.errors[0].message).toBe('Network timeout');
    ctx.destroy();
  });

  it('returns zero errors when ref is null', async () => {
    const ctx = createAskableContext();
    const errors = ref<AskableErrorEntry[] | null>(null);

    track(mount(defineComponent({
      setup() { useAskableErrorSource({ ctx, errors }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('errors');
    const data = resolved.data as { total: number; hasErrors: boolean };
    expect(data.total).toBe(0);
    expect(data.hasErrors).toBe(false);
    ctx.destroy();
  });

  it('accepts a custom id', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableErrorSource({ ctx, id: 'form-errors' }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('form-errors');
    expect(resolved.id).toBe('form-errors');
    ctx.destroy();
  });

  it('unregisters on unmount', async () => {
    const ctx = createAskableContext();

    const wrapper = track(mount(defineComponent({
      setup() { useAskableErrorSource({ ctx }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();
    await expect(ctx.resolveSource('errors')).resolves.toMatchObject({ id: 'errors' });

    wrapper.unmount();
    await expect(ctx.resolveSource('errors')).rejects.toThrow('not registered');
    ctx.destroy();
  });
});
