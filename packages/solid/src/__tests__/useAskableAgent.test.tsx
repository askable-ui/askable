import { describe, it, expect, vi } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import { useAskableAgent } from '../useAskableAgent.js';
import { renderHook } from '@solidjs/testing-library';

describe('useAskableAgent (SolidJS)', () => {
  it('starts in idle state', () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableAgent({ ctx }));

    expect(result.status()).toBe('idle');
    expect(result.isLoading()).toBe(false);
    expect(result.data()).toBeNull();
    expect(result.error()).toBeNull();

    cleanup();
    ctx.destroy();
  });

  it('send() transitions to success and stores data', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableAgent({ ctx }));

    const answer = await result.send('What is this?', async (req) => {
      expect(req.question).toBe('What is this?');
      return { answer: 'A dashboard' };
    });

    expect(result.status()).toBe('success');
    expect(result.data()).toEqual({ answer: 'A dashboard' });
    expect(answer).toEqual({ answer: 'A dashboard' });

    cleanup();
    ctx.destroy();
  });

  it('send() transitions to error on throw', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableAgent({ ctx }));
    const err = new Error('Network error');

    await result.send('Help', async () => { throw err; });

    expect(result.status()).toBe('error');
    expect(result.error()).toBe(err);

    cleanup();
    ctx.destroy();
  });

  it('reset() returns to idle', async () => {
    const ctx = createAskableContext();
    const { result, cleanup } = renderHook(() => useAskableAgent({ ctx }));

    await result.send('Hi', async () => 'ok');
    expect(result.status()).toBe('success');

    result.reset();
    expect(result.status()).toBe('idle');
    expect(result.data()).toBeNull();

    cleanup();
    ctx.destroy();
  });

  it('onSuccess callback fires', async () => {
    const ctx = createAskableContext();
    const onSuccess = vi.fn();
    const { result, cleanup } = renderHook(() => useAskableAgent({ ctx, onSuccess }));

    await result.send('Hi', async () => 'response');
    expect(onSuccess).toHaveBeenCalledWith('response', expect.objectContaining({ question: 'Hi' }));

    cleanup();
    ctx.destroy();
  });
});
