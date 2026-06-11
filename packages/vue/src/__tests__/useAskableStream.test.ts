import { describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskableStream, type UseAskableStreamResult } from '../useAskableStream.js';
import { track } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

function mountStreamConsumer(ctx: ReturnType<typeof createAskableContext>, callbacks?: {
  onChunk?: (c: string) => void;
  onSuccess?: (content: string) => void;
}) {
  let api!: UseAskableStreamResult;

  const Comp = defineComponent({
    setup() {
      api = useAskableStream({ ctx, ...callbacks });
      return {};
    },
    template: '<div />',
  });

  track(mount(Comp, { attachTo: document.body }));
  return api;
}

describe('useAskableStream (Vue)', () => {
  it('starts in idle state', async () => {
    const ctx = createAskableContext();
    const api = mountStreamConsumer(ctx);
    await flushAll();

    expect(api.status.value).toBe('idle');
    expect(api.isStreaming.value).toBe(false);
    expect(api.content.value).toBe('');
    expect(api.error.value).toBeNull();

    ctx.destroy();
  });

  it('accumulates chunks and reaches success', async () => {
    const ctx = createAskableContext();
    const api = mountStreamConsumer(ctx);
    await flushAll();

    await api.stream('Hi', async (_req, emit) => {
      emit('foo'); emit('bar'); emit('!');
    });
    await flushAll();

    expect(api.content.value).toBe('foobar!');
    expect(api.status.value).toBe('success');

    ctx.destroy();
  });

  it('transitions to error when handler throws', async () => {
    const ctx = createAskableContext();
    const api = mountStreamConsumer(ctx);
    await flushAll();

    const err = new Error('fail');
    await api.stream('Help', async () => { throw err; });
    await flushAll();

    expect(api.status.value).toBe('error');
    expect(api.error.value).toBe(err);

    ctx.destroy();
  });

  it('reset() returns to idle', async () => {
    const ctx = createAskableContext();
    const api = mountStreamConsumer(ctx);

    await api.stream('Hi', async (_r, e) => { e('text'); });
    await flushAll();

    expect(api.content.value).toBe('text');

    api.reset();
    await flushAll();

    expect(api.status.value).toBe('idle');
    expect(api.content.value).toBe('');

    ctx.destroy();
  });

  it('streamFrom() handles AsyncIterable', async () => {
    const ctx = createAskableContext();
    const api = mountStreamConsumer(ctx);

    async function* gen() {
      yield 'hello'; yield ' vue';
    }

    await api.streamFrom('Test', gen());
    await flushAll();

    expect(api.content.value).toBe('hello vue');

    ctx.destroy();
  });

  it('onChunk fires for every chunk', async () => {
    const ctx = createAskableContext();
    const received: string[] = [];
    const api = mountStreamConsumer(ctx, { onChunk: (c) => received.push(c) });

    await api.stream('Test', async (_r, e) => { e('x'); e('y'); e('z'); });
    await flushAll();

    expect(received).toEqual(['x', 'y', 'z']);
    ctx.destroy();
  });

  it('onSuccess is called with final content', async () => {
    const ctx = createAskableContext();
    let finalContent = '';
    const api = mountStreamConsumer(ctx, { onSuccess: (c) => { finalContent = c; } });

    await api.stream('Test', async (_r, e) => { e('a'); e('b'); });
    await flushAll();

    expect(finalContent).toBe('ab');
    ctx.destroy();
  });
});
