import { describe, it, expect } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import { useAskableStream } from '../useAskableStream.js';
import { renderHook } from '@solidjs/testing-library';

describe('useAskableStream (SolidJS)', () => {
  it('starts in idle state', () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableStream({ ctx }));

    expect(result.status()).toBe('idle');
    expect(result.isStreaming()).toBe(false);
    expect(result.content()).toBe('');
    expect(result.error()).toBeNull();

    cleanup();
    ctx.destroy();
  });

  it('accumulates chunks and transitions to success', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableStream({ ctx }));

    await result.stream('Hi', async (_req, emit) => {
      emit('foo'); emit('bar'); emit('!');
    });

    expect(result.content()).toBe('foobar!');
    expect(result.status()).toBe('success');
    expect(result.isStreaming()).toBe(false);

    cleanup();
    ctx.destroy();
  });

  it('transitions to error when handler throws', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableStream({ ctx }));
    const err = new Error('fail');

    await result.stream('Help', async () => { throw err; });

    expect(result.status()).toBe('error');
    expect(result.error()).toBe(err);

    cleanup();
    ctx.destroy();
  });

  it('reset() returns to idle', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableStream({ ctx }));

    await result.stream('Hi', async (_r, e) => { e('text'); });
    expect(result.content()).toBe('text');

    result.reset();
    expect(result.status()).toBe('idle');
    expect(result.content()).toBe('');

    cleanup();
    ctx.destroy();
  });

  it('streamFrom() handles AsyncIterable', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableStream({ ctx }));

    async function* gen() {
      yield 'solid'; yield ' stream';
    }

    await result.streamFrom('Test', gen());

    expect(result.content()).toBe('solid stream');

    cleanup();
    ctx.destroy();
  });

  it('onChunk fires for each chunk', async () => {
    const ctx = createAskableContext();
    const received: string[] = [];
    const { result, cleanup } = renderHook(() =>
      useAskableStream({ ctx, onChunk: (c) => received.push(c) }),
    );

    await result.stream('Test', async (_r, e) => { e('a'); e('b'); e('c'); });

    expect(received).toEqual(['a', 'b', 'c']);

    cleanup();
    ctx.destroy();
  });
});
