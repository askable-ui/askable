import { describe, it, expect } from 'vitest';
import { createAskableAbTestSource } from '../ab-test-source.js';
import { createAskableContext } from '../index.js';
import type { AskableAbTestSourceSnapshot } from '../ab-test-source.js';

describe('createAskableAbTestSource', () => {
  it('registers as kind "ab-tests"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ab', createAskableAbTestSource({
      getExperiments: () => [{ experiment: 'checkout', variant: 'v2', isControl: false }],
    }));
    const resolved = await ctx.resolveSource('ab');
    expect(resolved.kind).toBe('ab-tests');
    ctx.destroy();
  });

  it('separates treatments and controls', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ab', createAskableAbTestSource({
      getExperiments: () => [
        { experiment: 'checkout', variant: 'v2', isControl: false },
        { experiment: 'pricing', variant: 'control', isControl: true },
      ],
    }));
    const resolved = await ctx.resolveSource('ab');
    const data = resolved.data as AskableAbTestSourceSnapshot;
    expect(data.treatments).toContain('checkout');
    expect(data.controls).toContain('pricing');
    ctx.destroy();
  });

  it('returns null data when getExperiments returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ab', createAskableAbTestSource({ getExperiments: () => null }));
    const resolved = await ctx.resolveSource('ab');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('state includes totalExperiments, treatmentCount, controlCount', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ab', createAskableAbTestSource({
      getExperiments: () => [
        { experiment: 'a', variant: 'v2', isControl: false },
        { experiment: 'b', variant: 'control', isControl: true },
        { experiment: 'c', variant: 'treatment', isControl: false },
      ],
    }));
    const resolved = await ctx.resolveSource('ab', { mode: 'state' });
    const state = resolved.state as { totalExperiments: number; treatmentCount: number; controlCount: number };
    expect(state.totalExperiments).toBe(3);
    expect(state.treatmentCount).toBe(2);
    expect(state.controlCount).toBe(1);
    ctx.destroy();
  });

  it('describe mentions experiment names and variants', async () => {
    const source = createAskableAbTestSource({
      getExperiments: () => [{ experiment: 'checkout_flow', variant: 'v2', isControl: false }],
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('checkout_flow');
    expect(desc).toContain('v2');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableAbTestSource({
      getExperiments: () => [{ experiment: 'nav', variant: 'B', isControl: false }],
      describe: (s) => `Experiments: ${s.experiments.map((e) => e.experiment).join(', ')}`,
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('nav');
    expect(desc).toContain('Experiments:');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ab', createAskableAbTestSource({
      getExperiments: () => [],
      kind: 'optimizely-tests',
    }));
    const resolved = await ctx.resolveSource('ab');
    expect(resolved.kind).toBe('optimizely-tests');
    ctx.destroy();
  });

  it('handles empty experiments array', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ab', createAskableAbTestSource({ getExperiments: () => [] }));
    const resolved = await ctx.resolveSource('ab');
    const data = resolved.data as AskableAbTestSourceSnapshot;
    expect(data.experiments).toHaveLength(0);
    expect(data.treatments).toHaveLength(0);
    expect(data.controls).toHaveLength(0);
    ctx.destroy();
  });
});
