import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableFocusSource } from '../useAskableFocusSource.js';

describe('useAskableFocusSource', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts without DOM state and captures existing focus in the effect', async () => {
    const ctx = createAskableContext();
    const input = document.createElement('input');
    input.id = 'already-focused';
    document.body.append(input);
    input.focus();
    const snapshots: ReturnType<typeof useAskableFocusSource>['snapshot'][] = [];

    const { result, unmount } = renderHook(() => {
      const source = useAskableFocusSource({ ctx });
      snapshots.push(source.snapshot);
      return source;
    });

    expect(snapshots[0]).toEqual({ focused: null, hasFocus: false, focusChangeCount: 0, lastChangedAt: null });
    expect(result.current.snapshot).toMatchObject({
      focused: { id: 'already-focused' }, hasFocus: true, focusChangeCount: 0, lastChangedAt: null,
    });
    expect((await result.current.resolve()).data).toEqual(result.current.snapshot);

    unmount();
    ctx.destroy();
  });

  it('tracks focus and deferred blur through Strict Mode effect replay', async () => {
    vi.useFakeTimers();
    const ctx = createAskableContext();
    const first = document.createElement('input');
    const second = document.createElement('button');
    first.id = 'first';
    second.id = 'second';
    document.body.append(first, second);
    const { result, unmount } = renderHook(() => useAskableFocusSource({ ctx }), {
      wrapper: StrictMode,
    });

    act(() => first.focus());
    expect(result.current.snapshot).toMatchObject({ focused: { id: 'first' }, focusChangeCount: 1 });
    act(() => second.focus());
    act(() => vi.runOnlyPendingTimers());
    expect(result.current.snapshot).toMatchObject({ focused: { id: 'second' }, hasFocus: true, focusChangeCount: 2 });
    expect((await result.current.resolve()).data).toEqual(result.current.snapshot);

    act(() => second.blur());
    act(() => vi.runOnlyPendingTimers());
    expect(result.current.snapshot).toMatchObject({ focused: null, hasFocus: false, focusChangeCount: 2 });
    expect(result.current.snapshot?.lastChangedAt).toEqual(expect.any(String));

    unmount();
    await expect(ctx.resolveSource('focus')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('removes listeners and cancels pending blur timers on unmount', () => {
    vi.useFakeTimers();
    const ctx = createAskableContext();
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useAskableFocusSource({ ctx }));
    const timersBeforeBlur = vi.getTimerCount();

    act(() => {
      document.dispatchEvent(new FocusEvent('focusout'));
      document.dispatchEvent(new FocusEvent('focusout'));
    });
    expect(vi.getTimerCount()).toBe(timersBeforeBlur + 1);

    unmount();
    for (const [type, listener] of add.mock.calls) {
      if (type === 'focusin' || type === 'focusout') {
        expect(remove).toHaveBeenCalledWith(type, listener);
      }
    }
    expect(vi.getTimerCount()).toBe(timersBeforeBlur);
    act(() => document.dispatchEvent(new FocusEvent('focusout')));
    expect(vi.getTimerCount()).toBe(timersBeforeBlur);
    ctx.destroy();
  });
});
