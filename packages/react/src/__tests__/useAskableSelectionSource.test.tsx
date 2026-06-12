import { render } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableSelectionSource } from '../useAskableSelectionSource.js';
import type { UseAskableSelectionSourceResult } from '../useAskableSelectionSource.js';

let hookRef: UseAskableSelectionSourceResult | undefined;

function SelectionConsumer({
  ctx,
  ...rest
}: Parameters<typeof useAskableSelectionSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
}) {
  hookRef = useAskableSelectionSource({ ctx, ...rest });
  return null;
}

describe('useAskableSelectionSource', () => {
  afterEach(() => {
    hookRef = undefined;
  });

  it('registers under "selection" id by default', () => {
    const ctx = createAskableContext();
    render(<SelectionConsumer ctx={ctx} autoTrack={false} />);

    expect(ctx.hasSource('selection')).toBe(true);
    expect(hookRef!.sourceId).toBe('selection');
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<SelectionConsumer ctx={ctx} id="text-highlight" autoTrack={false} />);

    expect(ctx.hasSource('text-highlight')).toBe(true);
    ctx.destroy();
  });

  it('returns null data when nothing is selected', async () => {
    const ctx = createAskableContext();
    const getSelection = () => ({ toString: () => '', rangeCount: 0, anchorNode: null }) as unknown as Selection;
    render(<SelectionConsumer ctx={ctx} getSelection={getSelection} autoTrack={false} />);

    const resolved = await hookRef!.resolve();
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns selection data when text is selected', async () => {
    const ctx = createAskableContext();
    const getSelection = () => ({
      toString: () => 'hello world',
      rangeCount: 1,
      getRangeAt: () => ({
        startOffset: 0,
        endOffset: 11,
        commonAncestorContainer: { textContent: 'hello world', nodeType: 3 },
      }),
      anchorNode: { nodeType: 3, parentElement: null },
    }) as unknown as Selection;

    render(<SelectionConsumer ctx={ctx} getSelection={getSelection} autoTrack={false} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { selectedText: string; hasSelection: boolean };
    expect(data.selectedText).toBe('hello world');
    expect(data.hasSelection).toBe(true);
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<SelectionConsumer ctx={ctx} autoTrack={false} />);

    expect(ctx.hasSource('selection')).toBe(true);
    unmount();
    expect(ctx.hasSource('selection')).toBe(false);
    ctx.destroy();
  });
});
