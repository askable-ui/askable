import { describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, reactive } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import type { AskableResolvedContextSource } from '@askable-ui/core';
import { useAskableSource } from '../useAskableSource.js';
import { track } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('useAskableSource (Vue)', () => {
  it('registers a source and unregisters it on unmount', async () => {
    const ctx = createAskableContext();

    const SourceConsumer = defineComponent({
      setup() {
        useAskableSource('accounts', {
          kind: 'collection',
          getState: () => ({ totalCount: 2 }),
          resolve: () => ({ rows: [{ company: 'Acme' }] }),
        }, { ctx });
        return {};
      },
      template: '<div />',
    });

    const wrapper = track(mount(SourceConsumer, { attachTo: document.body }));
    await flushAll();

    await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
      id: 'accounts',
      kind: 'collection',
      state: { totalCount: 2 },
      data: { rows: [{ company: 'Acme' }] },
    });

    wrapper.unmount();

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('resolves current reactive values', async () => {
    const ctx = createAskableContext();
    const state = reactive({ count: 1 });

    const SourceConsumer = defineComponent({
      setup() {
        useAskableSource('accounts', {
          getState: () => ({ count: state.count }),
          resolve: () => ({ count: state.count }),
        }, { ctx });
        return {};
      },
      template: '<div />',
    });

    const wrapper = track(mount(SourceConsumer, { attachTo: document.body }));
    await flushAll();

    const first = await ctx.resolveSource('accounts');
    state.count = 2;
    await nextTick();
    const second = await ctx.resolveSource('accounts');

    expect(first.state).toEqual({ count: 1 });
    expect(second.state).toEqual({ count: 2 });

    wrapper.unmount();
    ctx.destroy();
  });

  it('returns helpers for resolving and serializing the registered source', async () => {
    const ctx = createAskableContext();
    const results: AskableResolvedContextSource[] = [];
    let prompt = '';

    const SourceConsumer = defineComponent({
      async setup() {
        const accounts = useAskableSource('accounts', {
          kind: 'collection',
          resolve: ({ mode }) => ({ mode, total: 12 }),
        }, { ctx });

        results.push(await accounts.resolve({ mode: 'summary' }));
        prompt = await accounts.toPromptContext({
          source: { mode: 'summary' },
        });
        return {};
      },
      template: '<div />',
    });

    track(mount(SourceConsumer, { attachTo: document.body }));
    await flushAll();

    expect(results[0]).toMatchObject({
      id: 'accounts',
      kind: 'collection',
      data: { mode: 'summary', total: 12 },
    });
    expect(prompt).toContain('accounts');
    expect(prompt).toContain('"total":12');

    ctx.destroy();
  });

  it('notifies async subscribers when source data changes', async () => {
    const ctx = createAskableContext();
    let total = 1;
    let accounts: ReturnType<typeof useAskableSource> | undefined;

    const SourceConsumer = defineComponent({
      setup() {
        accounts = useAskableSource('accounts', {
          resolve: () => ({ total }),
        }, { ctx });
        return {};
      },
      template: '<div />',
    });

    track(mount(SourceConsumer, { attachTo: document.body }));
    await flushAll();

    await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
      data: { total: 1 },
    });

    const received: string[] = [];
    ctx.subscribeAsync((context) => {
      received.push(context);
    }, {
      emitInitial: true,
      sources: ['accounts'],
    });

    await flushAll();
    expect(received).toHaveLength(1);

    total = 2;
    accounts?.notifyChanged();
    await flushAll();

    expect(received).toHaveLength(2);
    expect(received[1]).toContain('"total":2');

    ctx.destroy();
  });

  it('can disable registration', async () => {
    const ctx = createAskableContext();

    const SourceConsumer = defineComponent({
      setup() {
        useAskableSource('accounts', {
          resolve: () => ({ total: 1 }),
        }, { ctx, enabled: false });
        return {};
      },
      template: '<div />',
    });

    track(mount(SourceConsumer, { attachTo: document.body }));
    await flushAll();

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('normalizes whitespace around ids', async () => {
    const ctx = createAskableContext();

    const SourceConsumer = defineComponent({
      setup() {
        useAskableSource(' accounts ', {
          resolve: () => ({ total: 1 }),
        }, { ctx });
        return {};
      },
      template: '<div />',
    });

    const wrapper = track(mount(SourceConsumer, { attachTo: document.body }));
    await flushAll();

    await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
      id: 'accounts',
      data: { total: 1 },
    });

    wrapper.unmount();
    ctx.destroy();
  });
});
