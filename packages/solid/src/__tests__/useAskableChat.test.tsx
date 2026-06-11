import { describe, it, expect } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import { useAskableChat } from '../useAskableChat.js';
import { renderHook } from '@solidjs/testing-library';

describe('useAskableChat (SolidJS)', () => {
  it('starts with empty messages and idle status', () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableChat({ ctx }));

    expect(result.messages()).toHaveLength(0);
    expect(result.status()).toBe('idle');
    expect(result.isStreaming()).toBe(false);

    cleanup();
    ctx.destroy();
  });

  it('append() adds user and assistant messages', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableChat({ ctx }));

    await result.append('Hello', async (_req, _msgs, emit) => {
      emit('Hi'); emit(' there!');
    });

    expect(result.messages()).toHaveLength(2);
    expect(result.messages()[0].role).toBe('user');
    expect(result.messages()[0].content).toBe('Hello');
    expect(result.messages()[1].role).toBe('assistant');
    expect(result.messages()[1].content).toBe('Hi there!');
    expect(result.status()).toBe('idle');

    cleanup();
    ctx.destroy();
  });

  it('transitions to error when handler throws', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableChat({ ctx }));
    const err = new Error('fail');

    await result.append('Help', async () => { throw err; });

    expect(result.status()).toBe('error');
    expect(result.error()).toBe(err);

    cleanup();
    ctx.destroy();
  });

  it('clearMessages() resets conversation', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableChat({ ctx }));

    await result.append('Hi', async (_r, _m, e) => { e('hey'); });
    expect(result.messages()).toHaveLength(2);

    result.clearMessages();
    expect(result.messages()).toHaveLength(0);
    expect(result.status()).toBe('idle');

    cleanup();
    ctx.destroy();
  });

  it('passes growing message count to each handler', async () => {
    const ctx = createAskableContext();
    const counts: number[] = [];
    const { result, cleanup } = renderHook(() => useAskableChat({ ctx }));

    await result.append('Turn 1', async (_req, msgs, emit) => {
      counts.push(msgs.length);
      emit('r1');
    });

    await result.append('Turn 2', async (_req, msgs, emit) => {
      counts.push(msgs.length);
      emit('r2');
    });

    expect(counts[0]).toBe(1);
    expect(counts[1]).toBe(3);

    cleanup();
    ctx.destroy();
  });
});
