import { render } from '@testing-library/react';
import { useRef } from 'react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableMediaSource } from '../useAskableMediaSource.js';
import type { UseAskableMediaSourceResult } from '../useAskableMediaSource.js';

function makeMockMedia(overrides: Partial<HTMLMediaElement> = {}): HTMLMediaElement {
  return {
    currentTime: 90,
    duration: 600,
    paused: true,
    ended: false,
    muted: false,
    volume: 1,
    playbackRate: 1,
    readyState: 4,
    title: '',
    src: 'https://example.com/video/episode.mp4',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as HTMLMediaElement;
}

let hookRef: UseAskableMediaSourceResult | undefined;

function MediaConsumer({
  ctx,
  mediaEl,
  ...rest
}: Parameters<typeof useAskableMediaSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
  mediaEl?: HTMLMediaElement;
}) {
  const ref = useRef<HTMLMediaElement>(mediaEl ?? null);
  hookRef = useAskableMediaSource({ ctx, ref, ...rest });
  return null;
}

describe('useAskableMediaSource', () => {
  afterEach(() => {
    hookRef = undefined;
  });

  it('registers under "media" id by default', () => {
    const ctx = createAskableContext();
    render(<MediaConsumer ctx={ctx} />);

    expect(ctx.hasSource('media')).toBe(true);
    expect(hookRef!.sourceId).toBe('media');
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<MediaConsumer ctx={ctx} id="player" />);

    expect(ctx.hasSource('player')).toBe(true);
    ctx.destroy();
  });

  it('returns snapshot data from media element', async () => {
    const ctx = createAskableContext();
    const el = makeMockMedia({ currentTime: 90, duration: 600 });
    render(<MediaConsumer ctx={ctx} mediaEl={el} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { currentTime: number; duration: number; progressPercent: number };
    expect(data.currentTime).toBe(90);
    expect(data.duration).toBe(600);
    expect(data.progressPercent).toBe(15);
    ctx.destroy();
  });

  it('returns null data when no media element', async () => {
    const ctx = createAskableContext();
    render(<MediaConsumer ctx={ctx} />);

    const resolved = await hookRef!.resolve();
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('includes getTitle result in snapshot', async () => {
    const ctx = createAskableContext();
    const el = makeMockMedia();
    render(<MediaConsumer ctx={ctx} mediaEl={el} getTitle={() => 'My Podcast'} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { title: string };
    expect(data.title).toBe('My Podcast');
    ctx.destroy();
  });

  it('attaches event listeners when autoTrack is true', () => {
    const ctx = createAskableContext();
    const el = makeMockMedia();
    render(<MediaConsumer ctx={ctx} mediaEl={el} autoTrack />);

    expect(el.addEventListener).toHaveBeenCalled();
    ctx.destroy();
  });

  it('skips event listeners when autoTrack is false', () => {
    const ctx = createAskableContext();
    const el = makeMockMedia();
    render(<MediaConsumer ctx={ctx} mediaEl={el} autoTrack={false} />);

    expect(el.addEventListener).not.toHaveBeenCalled();
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<MediaConsumer ctx={ctx} />);

    expect(ctx.hasSource('media')).toBe(true);
    unmount();
    expect(ctx.hasSource('media')).toBe(false);
    ctx.destroy();
  });
});
