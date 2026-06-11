import { act, renderHook } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableAgent } from '../useAskableAgent.js';

describe('useAskableAgent', () => {
  it('starts in idle state', () => {
    const ctx = createAskableContext();
    const { result, unmount } = renderHook(() => useAskableAgent({ ctx }));

    expect(result.current.status).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.lastRequest).toBeNull();

    unmount();
    ctx.destroy();
  });

  it('send() transitions to success and stores data', async () => {
    const ctx = createAskableContext();
    const { result, unmount } = renderHook(() => useAskableAgent({ ctx }));

    await act(async () => {
      await result.current.send('What is this?', async (req) => {
        expect(req.question).toBe('What is this?');
        return { answer: 'A dashboard' };
      });
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toEqual({ answer: 'A dashboard' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lastRequest?.question).toBe('What is this?');

    unmount();
    ctx.destroy();
  });

  it('send() transitions to error on handler throw', async () => {
    const ctx = createAskableContext();
    const { result, unmount } = renderHook(() => useAskableAgent({ ctx }));
    const err = new Error('Network error');

    await act(async () => {
      await result.current.send('Help', async () => { throw err; });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(err);
    expect(result.current.data).toBeNull();

    unmount();
    ctx.destroy();
  });

  it('onRequest callback can modify the request', async () => {
    const ctx = createAskableContext();
    const capturedRequests: unknown[] = [];

    const { result, unmount } = renderHook(() =>
      useAskableAgent({
        ctx,
        onRequest: (req) => ({ ...req, metadata: { source: 'test' } }),
      }),
    );

    await act(async () => {
      await result.current.send('Hello', async (req) => {
        capturedRequests.push(req);
        return 'ok';
      });
    });

    expect((capturedRequests[0] as any).metadata).toEqual({ source: 'test' });

    unmount();
    ctx.destroy();
  });

  it('onSuccess callback fires with result and request', async () => {
    const ctx = createAskableContext();
    const successCalls: unknown[] = [];

    const { result, unmount } = renderHook(() =>
      useAskableAgent({ ctx, onSuccess: (res, req) => successCalls.push({ res, req }) }),
    );

    await act(async () => {
      await result.current.send('Hi', async () => 'response');
    });

    expect(successCalls).toHaveLength(1);
    expect((successCalls[0] as any).res).toBe('response');

    unmount();
    ctx.destroy();
  });

  it('onError callback fires on handler throw', async () => {
    const ctx = createAskableContext();
    const errorCalls: unknown[] = [];

    const { result, unmount } = renderHook(() =>
      useAskableAgent({ ctx, onError: (err) => errorCalls.push(err) }),
    );

    const boom = new Error('boom');
    await act(async () => {
      await result.current.send('Hi', async () => { throw boom; });
    });

    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0]).toBe(boom);

    unmount();
    ctx.destroy();
  });

  it('reset() returns to idle state', async () => {
    const ctx = createAskableContext();
    const { result, unmount } = renderHook(() => useAskableAgent({ ctx }));

    await act(async () => {
      await result.current.send('Hello', async () => 'data');
    });

    expect(result.current.status).toBe('success');

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.lastRequest).toBeNull();

    unmount();
    ctx.destroy();
  });
});
