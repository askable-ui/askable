import { describe, it, expect, vi } from 'vitest';
import { createAskableMediaSource } from '../media-source.js';
import { createAskableContext } from '../index.js';

function makeMockMedia(overrides: Partial<HTMLMediaElement> = {}): HTMLMediaElement {
  return {
    currentTime: 65,
    duration: 300,
    paused: false,
    ended: false,
    muted: false,
    volume: 0.8,
    playbackRate: 1,
    readyState: 4,
    title: '',
    src: 'https://example.com/audio/my-track.mp3',
    ...overrides,
  } as unknown as HTMLMediaElement;
}

describe('createAskableMediaSource', () => {
  it('registers as kind "media"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({ getMedia: () => makeMockMedia() }));

    const resolved = await ctx.resolveSource('player');
    expect(resolved.kind).toBe('media');
    ctx.destroy();
  });

  it('returns snapshot data from media element', async () => {
    const ctx = createAskableContext();
    const el = makeMockMedia({ currentTime: 65, duration: 300, volume: 0.8 });
    ctx.registerSource('player', createAskableMediaSource({ getMedia: () => el }));

    const resolved = await ctx.resolveSource('player');
    const data = resolved.data as { currentTime: number; duration: number; volume: number };
    expect(data.currentTime).toBe(65);
    expect(data.duration).toBe(300);
    expect(data.volume).toBe(0.8);
    ctx.destroy();
  });

  it('returns isPlaying when not paused and not ended', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({
      getMedia: () => makeMockMedia({ paused: false, ended: false }),
    }));

    const resolved = await ctx.resolveSource('player');
    const data = resolved.data as { isPlaying: boolean; isPaused: boolean };
    expect(data.isPlaying).toBe(true);
    expect(data.isPaused).toBe(false);
    ctx.destroy();
  });

  it('computes progressPercent and timeDisplay', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({
      getMedia: () => makeMockMedia({ currentTime: 150, duration: 300 }),
    }));

    const resolved = await ctx.resolveSource('player');
    const data = resolved.data as { progressPercent: number; timeDisplay: string };
    expect(data.progressPercent).toBe(50);
    expect(data.timeDisplay).toBe('2:30 / 5:00');
    ctx.destroy();
  });

  it('derives title from src basename when no title attribute', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({
      getMedia: () => makeMockMedia({ src: 'https://example.com/audio/my-track.mp3', title: '' }),
    }));

    const resolved = await ctx.resolveSource('player');
    const data = resolved.data as { title: string };
    expect(data.title).toBe('my-track');
    ctx.destroy();
  });

  it('prefers getTitle callback over element title attribute', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({
      getMedia: () => makeMockMedia({ title: 'Element Title' }),
      getTitle: () => 'Custom Title',
    }));

    const resolved = await ctx.resolveSource('player');
    const data = resolved.data as { title: string };
    expect(data.title).toBe('Custom Title');
    ctx.destroy();
  });

  it('exposes artist and album from callbacks', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({
      getMedia: () => makeMockMedia(),
      getArtist: () => 'The Artist',
      getAlbum: () => 'The Album',
    }));

    const resolved = await ctx.resolveSource('player');
    const data = resolved.data as { artist: string; album: string };
    expect(data.artist).toBe('The Artist');
    expect(data.album).toBe('The Album');
    ctx.destroy();
  });

  it('returns null data when media element is unavailable', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({ getMedia: () => null }));

    const resolved = await ctx.resolveSource('player');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableMediaSource({
      getMedia: () => makeMockMedia({ currentTime: 60, duration: 120, paused: true }),
      describe: (s) => `Watching ${s.title} — ${s.progressPercent}% done`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('50% done');
  });

  it('marks isBuffering when readyState < 3 and not paused', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('player', createAskableMediaSource({
      getMedia: () => makeMockMedia({ readyState: 2, paused: false }),
    }));

    const resolved = await ctx.resolveSource('player');
    const data = resolved.data as { isBuffering: boolean };
    expect(data.isBuffering).toBe(true);
    ctx.destroy();
  });
});
