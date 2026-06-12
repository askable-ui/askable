import { describe, it, expect } from 'vitest';
import { createAskableAnalyticsSource } from '../analytics-source.js';
import { createAskableContext } from '../index.js';
import type { AskableAnalyticsSourceSnapshot } from '../analytics-source.js';

function makeSnapshot(events: { name: string; properties?: Record<string, unknown> }[]): AskableAnalyticsSourceSnapshot {
  return {
    events: events.map((e) => ({ ...e, recordedAt: new Date().toISOString() })),
    total: events.length,
    latestEvent: events.length > 0 ? events[0].name : null,
  };
}

describe('createAskableAnalyticsSource', () => {
  it('registers as kind "analytics"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('analytics', createAskableAnalyticsSource({
      getSnapshot: () => makeSnapshot([{ name: 'page_view' }]),
    }));
    const resolved = await ctx.resolveSource('analytics');
    expect(resolved.kind).toBe('analytics');
    ctx.destroy();
  });

  it('returns events in the snapshot', async () => {
    const snap = makeSnapshot([
      { name: 'checkout_started', properties: { cart: 3 } },
      { name: 'page_view' },
    ]);
    const ctx = createAskableContext();
    ctx.registerSource('analytics', createAskableAnalyticsSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('analytics');
    const data = resolved.data as AskableAnalyticsSourceSnapshot;
    expect(data.events[0].name).toBe('checkout_started');
    expect(data.total).toBe(2);
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('analytics', createAskableAnalyticsSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('analytics');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('state includes total and latestEvent', async () => {
    const snap = makeSnapshot([{ name: 'button_click' }, { name: 'page_view' }]);
    const ctx = createAskableContext();
    ctx.registerSource('analytics', createAskableAnalyticsSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('analytics', { mode: 'state' });
    const state = resolved.state as { total: number; latestEvent: string | null };
    expect(state.total).toBe(2);
    expect(state.latestEvent).toBe('button_click');
    ctx.destroy();
  });

  it('state returns zero counts when no events', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('analytics', createAskableAnalyticsSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('analytics', { mode: 'state' });
    const state = resolved.state as { total: number; latestEvent: string | null };
    expect(state.total).toBe(0);
    expect(state.latestEvent).toBeNull();
    ctx.destroy();
  });

  it('describe mentions recent events', async () => {
    const source = createAskableAnalyticsSource({
      getSnapshot: () => makeSnapshot([{ name: 'checkout_completed' }]),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('checkout_completed');
    expect(desc).toContain('1 event');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableAnalyticsSource({
      getSnapshot: () => makeSnapshot([{ name: 'signup' }]),
      describe: (s) => `Latest: ${s.latestEvent}`,
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('signup');
    expect(desc).toContain('Latest:');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('analytics', createAskableAnalyticsSource({
      getSnapshot: () => makeSnapshot([]),
      kind: 'segment-events',
    }));
    const resolved = await ctx.resolveSource('analytics');
    expect(resolved.kind).toBe('segment-events');
    ctx.destroy();
  });
});
