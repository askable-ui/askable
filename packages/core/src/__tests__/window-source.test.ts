import { describe, it, expect, beforeEach } from 'vitest';
import { createAskableWindowSource } from '../window-source.js';
import { createAskableContext } from '../index.js';

describe('createAskableWindowSource', () => {
  beforeEach(() => {
    // jsdom sets window.innerWidth/innerHeight to 1024/768 by default
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });
    Object.defineProperty(window, 'devicePixelRatio', { writable: true, value: 1 });
  });

  it('registers as kind "window"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win');
    expect(resolved.kind).toBe('window');
    ctx.destroy();
  });

  it('returns correct viewport dimensions', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win');
    const data = resolved.data as { width: number; height: number };
    expect(data.width).toBe(1280);
    expect(data.height).toBe(800);
    ctx.destroy();
  });

  it('computes xl breakpoint for 1280px width', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win');
    const data = resolved.data as { breakpoint: string; isAtLeast: Record<string, boolean> };
    expect(data.breakpoint).toBe('xl');
    expect(data.isAtLeast.lg).toBe(true);
    expect(data.isAtLeast['2xl']).toBe(false);
    ctx.destroy();
  });

  it('sets deviceCategory to "desktop" for 1280px', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win');
    const data = resolved.data as { deviceCategory: string };
    expect(data.deviceCategory).toBe('desktop');
    ctx.destroy();
  });

  it('sets deviceCategory to "mobile" for narrow viewports', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });

    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win');
    const data = resolved.data as { deviceCategory: string; breakpoint: string };
    expect(data.deviceCategory).toBe('mobile');
    expect(data.breakpoint).toBe('xs');
    ctx.destroy();
  });

  it('returns landscape orientation when width > height', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win');
    const data = resolved.data as { orientation: string };
    expect(data.orientation).toBe('landscape');
    ctx.destroy();
  });

  it('returns portrait orientation when height > width', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 812 });

    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win');
    const data = resolved.data as { orientation: string };
    expect(data.orientation).toBe('portrait');
    ctx.destroy();
  });

  it('state includes width, height, and breakpoint', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('win', createAskableWindowSource());

    const resolved = await ctx.resolveSource('win', { mode: 'state' });
    const state = resolved.state as { width: number; breakpoint: string; deviceCategory: string };
    expect(state.width).toBe(1280);
    expect(state.breakpoint).toBe('xl');
    expect(state.deviceCategory).toBe('desktop');
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableWindowSource({
      describe: (s) => `Screen: ${s.width}px wide (${s.deviceCategory})`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('1280px wide');
    expect(description).toContain('desktop');
  });

  it('describe output contains viewport dimensions', async () => {
    const source = createAskableWindowSource();
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('1280');
    expect(description).toContain('xl');
  });
});
