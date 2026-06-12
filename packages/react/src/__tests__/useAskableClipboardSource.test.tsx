import { render, act } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableClipboardSource } from '../useAskableClipboardSource.js';
import type { UseAskableClipboardSourceResult } from '../useAskableClipboardSource.js';

let hookRef: UseAskableClipboardSourceResult | undefined;

function ClipboardConsumer({
  ctx,
  ...rest
}: Parameters<typeof useAskableClipboardSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
}) {
  hookRef = useAskableClipboardSource({ ctx, ...rest });
  return null;
}

describe('useAskableClipboardSource', () => {
  afterEach(() => {
    hookRef = undefined;
  });

  it('registers under "clipboard" id by default', () => {
    const ctx = createAskableContext();
    render(<ClipboardConsumer ctx={ctx} autoTrack={false} />);

    expect(ctx.hasSource('clipboard')).toBe(true);
    expect(hookRef!.sourceId).toBe('clipboard');
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<ClipboardConsumer ctx={ctx} id="copy-buffer" autoTrack={false} />);

    expect(ctx.hasSource('copy-buffer')).toBe(true);
    ctx.destroy();
  });

  it('starts with null snapshot', () => {
    const ctx = createAskableContext();
    render(<ClipboardConsumer ctx={ctx} autoTrack={false} />);

    expect(hookRef!.snapshot).toBeNull();
    ctx.destroy();
  });

  it('addEntry() updates snapshot and notifies', async () => {
    const ctx = createAskableContext();
    render(<ClipboardConsumer ctx={ctx} autoTrack={false} />);

    await act(async () => {
      hookRef!.addEntry('copied text');
    });

    expect(hookRef!.snapshot?.current?.text).toBe('copied text');
    expect(hookRef!.snapshot?.total).toBe(1);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { current: { text: string }; total: number };
    expect(data.current.text).toBe('copied text');
    expect(data.total).toBe(1);
    ctx.destroy();
  });

  it('addEntry() keeps history up to maxHistory', async () => {
    const ctx = createAskableContext();
    render(<ClipboardConsumer ctx={ctx} autoTrack={false} maxHistory={3} />);

    await act(async () => {
      hookRef!.addEntry('first');
      hookRef!.addEntry('second');
      hookRef!.addEntry('third');
      hookRef!.addEntry('fourth');
    });

    expect(hookRef!.snapshot?.history.length).toBe(3);
    expect(hookRef!.snapshot?.current?.text).toBe('fourth');
    ctx.destroy();
  });

  it('truncates text to maxLength', async () => {
    const ctx = createAskableContext();
    render(<ClipboardConsumer ctx={ctx} autoTrack={false} maxLength={10} />);

    await act(async () => {
      hookRef!.addEntry('a'.repeat(100));
    });

    expect(hookRef!.snapshot?.current?.text.length).toBeLessThanOrEqual(12); // 10 + '…'
    expect(hookRef!.snapshot?.current?.text.endsWith('…')).toBe(true);
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<ClipboardConsumer ctx={ctx} autoTrack={false} />);

    expect(ctx.hasSource('clipboard')).toBe(true);
    unmount();
    expect(ctx.hasSource('clipboard')).toBe(false);
    ctx.destroy();
  });
});
