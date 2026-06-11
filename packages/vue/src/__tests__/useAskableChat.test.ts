import { describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskableChat, type UseAskableChatResult } from '../useAskableChat.js';
import { track } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

function mountChatConsumer(ctx: ReturnType<typeof createAskableContext>, callbacks?: {
  onFinish?: (msg: Parameters<UseAskableChatResult['append']>[1]) => void;
}) {
  let api!: UseAskableChatResult;

  const Comp = defineComponent({
    setup() {
      api = useAskableChat({ ctx, ...callbacks });
      return {};
    },
    template: '<div />',
  });

  track(mount(Comp, { attachTo: document.body }));
  return api;
}

describe('useAskableChat (Vue)', () => {
  it('starts with empty messages and idle status', async () => {
    const ctx = createAskableContext();
    const api = mountChatConsumer(ctx);
    await flushAll();

    expect(api.messages.value).toHaveLength(0);
    expect(api.status.value).toBe('idle');
    expect(api.isStreaming.value).toBe(false);

    ctx.destroy();
  });

  it('append() adds user and assistant messages', async () => {
    const ctx = createAskableContext();
    const api = mountChatConsumer(ctx);
    await flushAll();

    await api.append('Hello', async (_req, _msgs, emit) => {
      emit('Hi'); emit(' there!');
    });
    await flushAll();

    expect(api.messages.value).toHaveLength(2);
    expect(api.messages.value[0].role).toBe('user');
    expect(api.messages.value[0].content).toBe('Hello');
    expect(api.messages.value[1].role).toBe('assistant');
    expect(api.messages.value[1].content).toBe('Hi there!');

    ctx.destroy();
  });

  it('transitions to error when handler throws', async () => {
    const ctx = createAskableContext();
    const api = mountChatConsumer(ctx);
    await flushAll();

    const err = new Error('fail');
    await api.append('Help', async () => { throw err; });
    await flushAll();

    expect(api.status.value).toBe('error');
    expect(api.error.value).toBe(err);

    ctx.destroy();
  });

  it('clearMessages() resets conversation', async () => {
    const ctx = createAskableContext();
    const api = mountChatConsumer(ctx);
    await flushAll();

    await api.append('Hi', async (_r, _m, e) => { e('hey'); });
    await flushAll();

    expect(api.messages.value).toHaveLength(2);

    api.clearMessages();
    await flushAll();

    expect(api.messages.value).toHaveLength(0);
    expect(api.status.value).toBe('idle');

    ctx.destroy();
  });

  it('passes previous messages count as thread context', async () => {
    const ctx = createAskableContext();
    const counts: number[] = [];
    const api = mountChatConsumer(ctx);
    await flushAll();

    await api.append('Turn 1', async (_req, msgs, emit) => {
      counts.push(msgs.length);
      emit('r1');
    });
    await flushAll();

    await api.append('Turn 2', async (_req, msgs, emit) => {
      counts.push(msgs.length);
      emit('r2');
    });
    await flushAll();

    expect(counts[0]).toBe(1);
    expect(counts[1]).toBe(3);

    ctx.destroy();
  });
});
