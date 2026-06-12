import { describe, it, expect } from 'vitest';
import { createAskableTabSource } from '../tab-source.js';
import { createAskableContext } from '../index.js';
import type { AskableTabSourceSnapshot } from '../tab-source.js';

function makeSnapshot(overrides: Partial<AskableTabSourceSnapshot> = {}): AskableTabSourceSnapshot {
  return {
    visibility: 'visible',
    isVisible: true,
    isHidden: false,
    visibleSince: new Date().toISOString(),
    hiddenSince: null,
    hideCount: 0,
    hiddenSeconds: 0,
    ...overrides,
  };
}

describe('createAskableTabSource', () => {
  it('registers as kind "tab"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('tab', createAskableTabSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('tab');
    expect(resolved.kind).toBe('tab');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('tab', createAskableTabSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('tab');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns the full snapshot as data', async () => {
    const snap = makeSnapshot({ hideCount: 3, hiddenSeconds: 45 });
    const ctx = createAskableContext();
    ctx.registerSource('tab', createAskableTabSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('tab');
    const data = resolved.data as AskableTabSourceSnapshot;
    expect(data.isVisible).toBe(true);
    expect(data.hideCount).toBe(3);
    expect(data.hiddenSeconds).toBe(45);
    ctx.destroy();
  });

  it('state reflects visibility flags', async () => {
    const snap = makeSnapshot({ isVisible: false, isHidden: true, hideCount: 2, hiddenSeconds: 120 });
    const ctx = createAskableContext();
    ctx.registerSource('tab', createAskableTabSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('tab', { mode: 'state' });
    const state = resolved.state as { isVisible: boolean; isHidden: boolean; hideCount: number; hiddenSeconds: number };
    expect(state.isVisible).toBe(false);
    expect(state.isHidden).toBe(true);
    expect(state.hideCount).toBe(2);
    expect(state.hiddenSeconds).toBe(120);
    ctx.destroy();
  });

  it('describe says "Tab is visible" when visible', async () => {
    const source = createAskableTabSource({ getSnapshot: () => makeSnapshot({ isVisible: true }) });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('visible');
  });

  it('describe mentions hide count when previously hidden', async () => {
    const source = createAskableTabSource({
      getSnapshot: () => makeSnapshot({ isVisible: true, hideCount: 4 }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('4');
  });

  it('describe says "Tab is hidden" with duration when hidden', async () => {
    const source = createAskableTabSource({
      getSnapshot: () => makeSnapshot({ isVisible: false, isHidden: true, hiddenSeconds: 45 }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('hidden');
    expect(desc).toContain('45s');
  });

  it('accepts a custom describe string', async () => {
    const source = createAskableTabSource({
      getSnapshot: () => makeSnapshot(),
      describe: 'Custom tab description',
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toBe('Custom tab description');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('tab', createAskableTabSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'page-visibility',
    }));
    const resolved = await ctx.resolveSource('tab');
    expect(resolved.kind).toBe('page-visibility');
    ctx.destroy();
  });
});
