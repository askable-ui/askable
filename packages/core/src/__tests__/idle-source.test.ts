import { describe, it, expect } from 'vitest';
import { createAskableIdleSource } from '../idle-source.js';
import { createAskableContext } from '../index.js';
import type { AskableIdleSourceSnapshot } from '../idle-source.js';

function makeSnapshot(overrides: Partial<AskableIdleSourceSnapshot> = {}): AskableIdleSourceSnapshot {
  return {
    isIdle: false,
    isActive: true,
    lastActiveAt: new Date().toISOString(),
    idleSeconds: 0,
    secondsSinceActive: 0,
    ...overrides,
  };
}

describe('createAskableIdleSource', () => {
  it('registers as kind "idle"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('idle', createAskableIdleSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('idle');
    expect(resolved.kind).toBe('idle');
    ctx.destroy();
  });

  it('returns snapshot data when active', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('idle', createAskableIdleSource({
      getSnapshot: () => makeSnapshot({ isActive: true, isIdle: false }),
    }));
    const resolved = await ctx.resolveSource('idle');
    const data = resolved.data as AskableIdleSourceSnapshot;
    expect(data.isActive).toBe(true);
    expect(data.isIdle).toBe(false);
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('idle', createAskableIdleSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('idle');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('state includes isIdle and idleSeconds', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('idle', createAskableIdleSource({
      getSnapshot: () => makeSnapshot({ isIdle: true, isActive: false, idleSeconds: 300, secondsSinceActive: 300 }),
    }));
    const resolved = await ctx.resolveSource('idle', { mode: 'state' });
    const state = resolved.state as { isIdle: boolean; idleSeconds: number };
    expect(state.isIdle).toBe(true);
    expect(state.idleSeconds).toBe(300);
    ctx.destroy();
  });

  it('describe returns "User is active" when active', async () => {
    const source = createAskableIdleSource({ getSnapshot: () => makeSnapshot({ isActive: true }) });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('active');
  });

  it('describe includes idle duration in minutes', async () => {
    const source = createAskableIdleSource({
      getSnapshot: () => makeSnapshot({ isIdle: true, isActive: false, idleSeconds: 125 }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('idle');
    expect(desc).toContain('2m');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableIdleSource({
      getSnapshot: () => makeSnapshot({ isIdle: true, idleSeconds: 60 }),
      describe: (s) => `Idle for ${s.idleSeconds}s`,
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('60');
    expect(desc).toContain('Idle for');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('idle', createAskableIdleSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'inactivity',
    }));
    const resolved = await ctx.resolveSource('idle');
    expect(resolved.kind).toBe('inactivity');
    ctx.destroy();
  });
});
