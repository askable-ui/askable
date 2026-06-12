import { describe, it, expect } from 'vitest';
import { createSignal } from 'solid-js';
import { createAskableContext } from '@askable-ui/core';
import type { AskableErrorEntry } from '@askable-ui/core';
import { useAskableErrorSource } from '../useAskableErrorSource.js';
import { renderHook } from '@solidjs/testing-library';

describe('useAskableErrorSource (SolidJS)', () => {
  it('registers source under the "errors" id by default', () => {
    const ctx = createAskableContext();
    const [errors] = createSignal<AskableErrorEntry[]>([]);

    const { result, cleanup } = renderHook(() => useAskableErrorSource({ ctx, errors }));

    expect(ctx.hasSource('errors')).toBe(true);
    expect(result.sourceId).toBe('errors');

    cleanup();
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() =>
      useAskableErrorSource({ ctx, id: 'form-errors' }),
    );

    expect(ctx.hasSource('form-errors')).toBe(true);
    expect(result.sourceId).toBe('form-errors');

    cleanup();
    ctx.destroy();
  });

  it('returns errors from an accessor returning an array', async () => {
    const ctx = createAskableContext();
    const [errors] = createSignal<AskableErrorEntry[]>([
      { key: 'email', message: 'Invalid email' },
      { key: 'name', message: 'Required', severity: 'error' },
    ]);

    const { result, cleanup } = renderHook(() => useAskableErrorSource({ ctx, errors }));

    const resolved = await result.resolve();
    const data = resolved.data as { errors: AskableErrorEntry[]; total: number };
    expect(data.total).toBe(2);
    expect(data.errors[0].key).toBe('email');

    cleanup();
    ctx.destroy();
  });

  it('normalises a Record<string, string> map', async () => {
    const ctx = createAskableContext();
    const [errors] = createSignal<Record<string, string>>({ email: 'Required', name: 'Too short' });

    const { result, cleanup } = renderHook(() => useAskableErrorSource({ ctx, errors }));

    const resolved = await result.resolve();
    const data = resolved.data as { total: number };
    expect(data.total).toBe(2);

    cleanup();
    ctx.destroy();
  });

  it('normalises a caught Error object', async () => {
    const ctx = createAskableContext();
    const [errors] = createSignal<Error | null>(new Error('Fetch failed'));

    const { result, cleanup } = renderHook(() => useAskableErrorSource({ ctx, errors }));

    const resolved = await result.resolve();
    const data = resolved.data as { errors: AskableErrorEntry[]; total: number };
    expect(data.total).toBe(1);
    expect(data.errors[0].message).toBe('Fetch failed');

    cleanup();
    ctx.destroy();
  });

  it('returns zero errors when accessor returns null', async () => {
    const ctx = createAskableContext();
    const [errors] = createSignal<AskableErrorEntry[] | null>(null);

    const { result, cleanup } = renderHook(() => useAskableErrorSource({ ctx, errors }));

    const resolved = await result.resolve();
    const data = resolved.data as { total: number; hasErrors: boolean };
    expect(data.total).toBe(0);
    expect(data.hasErrors).toBe(false);

    cleanup();
    ctx.destroy();
  });

  it('unregisters on cleanup', () => {
    const ctx = createAskableContext();

    const { cleanup } = renderHook(() => useAskableErrorSource({ ctx }));

    expect(ctx.hasSource('errors')).toBe(true);
    cleanup();
    expect(ctx.hasSource('errors')).toBe(false);
    ctx.destroy();
  });
});
