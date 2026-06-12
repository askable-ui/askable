import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAskableScrollSource } from '../scroll-source.js';
import { createAskableContext } from '../index.js';

function makeScrollEl(overrides: Partial<{
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
}> = {}): Element {
  return {
    scrollTop: 500,
    scrollLeft: 0,
    scrollHeight: 2000,
    scrollWidth: 800,
    clientHeight: 600,
    clientWidth: 800,
    ...overrides,
  } as unknown as Element;
}

describe('createAskableScrollSource', () => {
  it('registers as kind "scroll"', async () => {
    const el = makeScrollEl();
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('scroll');
    expect(resolved.kind).toBe('scroll');
    ctx.destroy();
  });

  it('computes scrollPercent correctly', async () => {
    // scrollTop=500, scrollHeight=2000, clientHeight=600 → maxScrollTop=1400 → ~36%
    const el = makeScrollEl({ scrollTop: 700, scrollHeight: 2000, clientHeight: 600 });
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('scroll');
    const data = resolved.data as { scrollPercent: number };
    expect(data.scrollPercent).toBe(50); // 700/(2000-600) = 700/1400 = 50%
    ctx.destroy();
  });

  it('sets isAtTop when scrollTop is 0', async () => {
    const el = makeScrollEl({ scrollTop: 0 });
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('scroll');
    const data = resolved.data as { isAtTop: boolean };
    expect(data.isAtTop).toBe(true);
    ctx.destroy();
  });

  it('sets isAtBottom when scrolled to bottom', async () => {
    const el = makeScrollEl({ scrollTop: 1400, scrollHeight: 2000, clientHeight: 600 });
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('scroll');
    const data = resolved.data as { isAtBottom: boolean };
    expect(data.isAtBottom).toBe(true);
    ctx.destroy();
  });

  it('exposes activeSection from getActiveSection callback', async () => {
    const el = makeScrollEl();
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({
      getElement: () => el,
      getActiveSection: () => 'Installation',
    }));

    const resolved = await ctx.resolveSource('scroll');
    const data = resolved.data as { activeSection: string };
    expect(data.activeSection).toBe('Installation');
    ctx.destroy();
  });

  it('returns null activeSection when not provided', async () => {
    const el = makeScrollEl();
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('scroll');
    const data = resolved.data as { activeSection: null };
    expect(data.activeSection).toBeNull();
    ctx.destroy();
  });

  it('state includes scrollPercent and boundary flags', async () => {
    const el = makeScrollEl({ scrollTop: 0 });
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('scroll', { mode: 'state' });
    const state = resolved.state as { scrollPercent: number; isAtTop: boolean; available: boolean };
    expect(state.available).toBe(true);
    expect(state.scrollPercent).toBe(0);
    expect(state.isAtTop).toBe(true);
    ctx.destroy();
  });

  it('returns null data when element is unavailable', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => null }));

    const resolved = await ctx.resolveSource('scroll');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const el = makeScrollEl({ scrollTop: 700, scrollHeight: 2000, clientHeight: 600 });
    const source = createAskableScrollSource({
      getElement: () => el,
      describe: (s) => `User is ${s.scrollPercent}% through the document`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('50% through the document');
  });

  it('uses a custom kind', async () => {
    const el = makeScrollEl();
    const ctx = createAskableContext();
    ctx.registerSource('scroll', createAskableScrollSource({ getElement: () => el, kind: 'viewport-scroll' }));

    const resolved = await ctx.resolveSource('scroll');
    expect(resolved.kind).toBe('viewport-scroll');
    ctx.destroy();
  });
});
