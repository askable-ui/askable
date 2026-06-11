import { describe, it, expect } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import { useAskablePageSource } from '../useAskablePageSource.js';
import { renderHook } from '@solidjs/testing-library';

describe('useAskablePageSource (SolidJS)', () => {
  it('registers a page source under the "page" id by default', () => {
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() => useAskablePageSource({ ctx }));

    expect(ctx.hasSource('page')).toBe(true);
    expect(result.sourceId).toBe('page');

    cleanup();
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() =>
      useAskablePageSource({ ctx, id: 'current-page' }),
    );

    expect(ctx.hasSource('current-page')).toBe(true);
    expect(result.sourceId).toBe('current-page');

    cleanup();
    ctx.destroy();
  });

  it('unregisters the source on cleanup', () => {
    const ctx = createAskableContext();

    const { cleanup } = renderHook(() => useAskablePageSource({ ctx }));

    expect(ctx.hasSource('page')).toBe(true);
    cleanup();
    expect(ctx.hasSource('page')).toBe(false);
    ctx.destroy();
  });

  it('resolve() returns page snapshot data', async () => {
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() => useAskablePageSource({ ctx }));

    const resolved = await result.resolve();
    expect(resolved.id).toBe('page');
    expect(resolved.kind).toBe('page');

    cleanup();
    ctx.destroy();
  });

  it('respects the enabled flag', () => {
    const ctx = createAskableContext();

    const { cleanup } = renderHook(() =>
      useAskablePageSource({ ctx, enabled: false }),
    );

    expect(ctx.hasSource('page')).toBe(false);
    cleanup();
    ctx.destroy();
  });
});
