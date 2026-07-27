import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextSource } from '@askable-ui/core';
import { useAskableSource } from '../useAskableSource.js';

const state = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  ctxRef: { value: undefined as AskableContext | undefined },
}));

vi.mock('@builder.io/qwik', () => ({
  $: <T>(value: T) => value,
  noSerialize: <T>(value: T) => value,
  useSignal: <T>(value?: T) => ({ value }),
  useVisibleTask$: (
    task: (args: {
      cleanup(callback: () => void): void;
      track<T>(read: () => T): T;
    }) => void,
  ) => task({
    cleanup: (callback) => state.cleanups.push(callback),
    track: (read) => read(),
  }),
}));

vi.mock('../useAskable.js', () => ({
  useAskable: () => ({ ctxRef: state.ctxRef }),
}));

beforeEach(() => {
  state.ctxRef.value = createAskableContext();
});

afterEach(() => {
  while (state.cleanups.length > 0) state.cleanups.pop()!();
  state.ctxRef.value?.destroy();
  state.ctxRef.value = undefined;
});

describe('useAskableSource lifecycle', () => {
  it('unregisters a source handle exactly once after manual unregister and cleanup', () => {
    const unregister = vi.fn();
    vi.spyOn(state.ctxRef.value!, 'registerSource').mockReturnValue({
      id: 'manual',
      unregister,
      notifyChanged: vi.fn(),
    });

    const result = useAskableSource('manual', { resolve: () => ({ ready: true }) });
    result.unregister();
    state.cleanups.pop()!();

    expect(unregister).toHaveBeenCalledOnce();
  });

  it('does not register a source factory that resolves after cleanup', async () => {
    let resolveSource!: (source: AskableContextSource) => void;
    const pendingSource = new Promise<AskableContextSource>((resolve) => {
      resolveSource = resolve;
    });
    const registerSource = vi.spyOn(state.ctxRef.value!, 'registerSource');

    useAskableSource('deferred', (() => pendingSource) as any);
    expect(state.cleanups).toHaveLength(1);
    state.cleanups.pop()!();

    resolveSource({ resolve: () => ({ ready: true }) });
    await pendingSource;
    await Promise.resolve();
    expect(registerSource).not.toHaveBeenCalled();
    expect(state.ctxRef.value!.hasSource('deferred')).toBe(false);
  });
});
