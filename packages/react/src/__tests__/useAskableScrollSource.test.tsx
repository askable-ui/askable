import { render, act } from '@testing-library/react';
import { useState, useRef } from 'react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableScrollSource } from '../useAskableScrollSource.js';
import type { UseAskableScrollSourceResult } from '../useAskableScrollSource.js';

let hookRef: UseAskableScrollSourceResult | undefined;

function ScrollConsumer({
  ctx,
  ...rest
}: Parameters<typeof useAskableScrollSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
}) {
  hookRef = useAskableScrollSource({ ctx, ...rest });
  return null;
}

describe('useAskableScrollSource', () => {
  afterEach(() => {
    hookRef = undefined;
  });

  it('registers under "scroll" id by default', () => {
    const ctx = createAskableContext();
    render(<ScrollConsumer ctx={ctx} />);

    expect(ctx.hasSource('scroll')).toBe(true);
    expect(hookRef!.sourceId).toBe('scroll');
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<ScrollConsumer ctx={ctx} id="page-scroll" />);

    expect(ctx.hasSource('page-scroll')).toBe(true);
    ctx.destroy();
  });

  it('returns scroll data', async () => {
    const el = {
      scrollTop: 200,
      scrollLeft: 0,
      scrollHeight: 1000,
      scrollWidth: 800,
      clientHeight: 600,
      clientWidth: 800,
    } as unknown as Element;

    const ctx = createAskableContext();
    const { unmount } = render(
      <ScrollConsumer ctx={ctx} getElement={() => el} autoTrack={false} />,
    );

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { scrollTop: number; scrollPercent: number };
    expect(data.scrollTop).toBe(200);
    // 200 / (1000-600) = 200/400 = 50%
    expect(data.scrollPercent).toBe(50);

    unmount();
    ctx.destroy();
  });

  it('exposes activeSection', async () => {
    const ctx = createAskableContext();
    render(
      <ScrollConsumer ctx={ctx} getActiveSection={() => 'Getting Started'} autoTrack={false} />,
    );

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { activeSection: string };
    expect(data.activeSection).toBe('Getting Started');
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<ScrollConsumer ctx={ctx} autoTrack={false} />);

    expect(ctx.hasSource('scroll')).toBe(true);
    unmount();
    expect(ctx.hasSource('scroll')).toBe(false);
    ctx.destroy();
  });
});
