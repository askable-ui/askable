import { describe, it, expect, vi } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import { useAskableSource } from '../useAskableSource.js';
import { renderHook } from '@solidjs/testing-library';

describe('useAskableSource (SolidJS)', () => {
  it('registers the source on the context immediately', () => {
    const ctx = createAskableContext();
    const resolve = vi.fn().mockResolvedValue([{ item: 'Widget' }]);

    const { result, cleanup } = renderHook(() =>
      useAskableSource('user', { kind: 'data', describe: 'User profile', resolve }, { ctx }),
    );

    expect(ctx.hasSource('user')).toBe(true);
    expect(result.ctx).toBe(ctx);
    expect(result.sourceId).toBe('user');

    cleanup();
    ctx.destroy();
  });

  it('unregisters the source on cleanup', () => {
    const ctx = createAskableContext();

    const { cleanup } = renderHook(() =>
      useAskableSource('user', { kind: 'data', resolve: vi.fn() }, { ctx }),
    );

    expect(ctx.hasSource('user')).toBe(true);
    cleanup();
    expect(ctx.hasSource('user')).toBe(false);
    ctx.destroy();
  });

  it('resolve() delegates to ctx.resolveSource() and returns data', async () => {
    const ctx = createAskableContext();
    const resolvedData = [{ item: 'Widget' }];
    const resolve = vi.fn().mockResolvedValue(resolvedData);

    const { result, cleanup } = renderHook(() =>
      useAskableSource('cart', { kind: 'data', resolve }, { ctx }),
    );

    const resolved = await result.resolve();
    expect(resolved.id).toBe('cart');
    expect(resolved.data).toEqual(resolvedData);

    cleanup();
    ctx.destroy();
  });

  it('notifyChanged() calls the source handle', () => {
    const ctx = createAskableContext();
    const notifySpy = vi.fn();
    const original = ctx.notifySourceChanged.bind(ctx);
    ctx.notifySourceChanged = notifySpy;

    const { result, cleanup } = renderHook(() =>
      useAskableSource('dash', { kind: 'data', resolve: vi.fn() }, { ctx }),
    );

    result.notifyChanged();
    expect(notifySpy).toHaveBeenCalled();

    ctx.notifySourceChanged = original;
    cleanup();
    ctx.destroy();
  });
});
