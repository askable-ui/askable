import { describe, it, expect } from 'vitest';
import { createAskablePerformanceSource, rateMetric } from '../performance-source.js';
import { createAskableContext } from '../index.js';
import type { AskablePerformanceSourceSnapshot } from '../performance-source.js';

function makeSnapshot(overrides: Partial<AskablePerformanceSourceSnapshot> = {}): AskablePerformanceSourceSnapshot {
  return {
    navigation: { loadTime: null, ttfb: null, domContentLoaded: null, dnsTime: null, connectTime: null },
    metrics: [],
    hasPoorMetrics: false,
    hasWarningMetrics: false,
    memory: null,
    ...overrides,
  };
}

describe('createAskablePerformanceSource', () => {
  it('registers as kind "performance"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('perf', createAskablePerformanceSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('perf');
    expect(resolved.kind).toBe('performance');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('perf', createAskablePerformanceSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('perf');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns snapshot with navigation timing', async () => {
    const snap = makeSnapshot({ navigation: { loadTime: 1200, ttfb: 180, domContentLoaded: 900, dnsTime: 20, connectTime: 40 } });
    const ctx = createAskableContext();
    ctx.registerSource('perf', createAskablePerformanceSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('perf');
    const data = resolved.data as AskablePerformanceSourceSnapshot;
    expect(data.navigation.loadTime).toBe(1200);
    expect(data.navigation.ttfb).toBe(180);
    ctx.destroy();
  });

  it('state includes loadTime, ttfb, and hasPoorMetrics', async () => {
    const snap = makeSnapshot({
      navigation: { loadTime: 5000, ttfb: 2000, domContentLoaded: null, dnsTime: null, connectTime: null },
      hasPoorMetrics: true,
    });
    const ctx = createAskableContext();
    ctx.registerSource('perf', createAskablePerformanceSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('perf', { mode: 'state' });
    const state = resolved.state as { loadTime: number; hasPoorMetrics: boolean };
    expect(state.loadTime).toBe(5000);
    expect(state.hasPoorMetrics).toBe(true);
    ctx.destroy();
  });

  it('describe includes load time and TTFB', async () => {
    const source = createAskablePerformanceSource({
      getSnapshot: () => makeSnapshot({ navigation: { loadTime: 2100, ttfb: 350, domContentLoaded: null, dnsTime: null, connectTime: null } }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('2100');
    expect(desc).toContain('350');
  });

  it('describe mentions poor metrics', async () => {
    const source = createAskablePerformanceSource({
      getSnapshot: () => makeSnapshot({
        metrics: [{ name: 'LCP', value: 4500, rating: 'poor', recordedAt: new Date().toISOString() }],
        hasPoorMetrics: true,
      }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('Poor');
    expect(desc).toContain('LCP');
  });

  it('rateMetric correctly rates LCP', () => {
    expect(rateMetric('LCP', 2000)).toBe('good');
    expect(rateMetric('LCP', 3000)).toBe('needs-improvement');
    expect(rateMetric('LCP', 5000)).toBe('poor');
  });

  it('rateMetric correctly rates CLS', () => {
    expect(rateMetric('CLS', 0.05)).toBe('good');
    expect(rateMetric('CLS', 0.15)).toBe('needs-improvement');
    expect(rateMetric('CLS', 0.3)).toBe('poor');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskablePerformanceSource({
      getSnapshot: () => makeSnapshot(),
      describe: () => 'Custom performance description',
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toBe('Custom performance description');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('perf', createAskablePerformanceSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'web-vitals',
    }));
    const resolved = await ctx.resolveSource('perf');
    expect(resolved.kind).toBe('web-vitals');
    ctx.destroy();
  });
});
