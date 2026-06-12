import { describe, it, expect } from 'vitest';
import { createAskableFeatureFlagSource } from '../feature-flag-source.js';
import { createAskableContext } from '../index.js';
import type { AskableFeatureFlagSourceSnapshot } from '../feature-flag-source.js';

describe('createAskableFeatureFlagSource', () => {
  it('registers as kind "feature-flags"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('flags', createAskableFeatureFlagSource({
      getFlags: () => ({ newDashboard: true }),
    }));
    const resolved = await ctx.resolveSource('flags');
    expect(resolved.kind).toBe('feature-flags');
    ctx.destroy();
  });

  it('separates enabled and disabled flags', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('flags', createAskableFeatureFlagSource({
      getFlags: () => ({ featureA: true, featureB: false, featureC: true }),
    }));
    const resolved = await ctx.resolveSource('flags');
    const data = resolved.data as AskableFeatureFlagSourceSnapshot;
    expect(data.enabled).toContain('featureA');
    expect(data.enabled).toContain('featureC');
    expect(data.disabled).toContain('featureB');
    ctx.destroy();
  });

  it('treats string "false"/"off"/"disabled" as disabled', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('flags', createAskableFeatureFlagSource({
      getFlags: () => ({ a: 'false', b: 'off', c: 'disabled', d: 'enabled' }),
    }));
    const resolved = await ctx.resolveSource('flags');
    const data = resolved.data as AskableFeatureFlagSourceSnapshot;
    expect(data.disabled).toContain('a');
    expect(data.disabled).toContain('b');
    expect(data.disabled).toContain('c');
    expect(data.enabled).toContain('d');
    ctx.destroy();
  });

  it('treats numeric 0 as disabled, non-zero as enabled', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('flags', createAskableFeatureFlagSource({
      getFlags: () => ({ rollout: 50, zero: 0 }),
    }));
    const resolved = await ctx.resolveSource('flags');
    const data = resolved.data as AskableFeatureFlagSourceSnapshot;
    expect(data.enabled).toContain('rollout');
    expect(data.disabled).toContain('zero');
    ctx.destroy();
  });

  it('returns null data when getFlags returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('flags', createAskableFeatureFlagSource({
      getFlags: () => null,
    }));
    const resolved = await ctx.resolveSource('flags');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('state includes totalCount, enabledCount, disabledCount', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('flags', createAskableFeatureFlagSource({
      getFlags: () => ({ a: true, b: false, c: true }),
    }));
    const resolved = await ctx.resolveSource('flags', { mode: 'state' });
    const state = resolved.state as { totalCount: number; enabledCount: number; disabledCount: number };
    expect(state.totalCount).toBe(3);
    expect(state.enabledCount).toBe(2);
    expect(state.disabledCount).toBe(1);
    ctx.destroy();
  });

  it('describe lists enabled and disabled flags', async () => {
    const source = createAskableFeatureFlagSource({
      getFlags: () => ({ beta: true, legacy: false }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('beta');
    expect(desc).toContain('legacy');
    expect(desc).toContain('Enabled');
    expect(desc).toContain('Disabled');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableFeatureFlagSource({
      getFlags: () => ({ myFlag: true }),
      describe: (s) => `Active flags: ${s.enabled.join(', ')}`,
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('myFlag');
    expect(desc).toContain('Active flags');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('flags', createAskableFeatureFlagSource({
      getFlags: () => ({}),
      kind: 'unleash-flags',
    }));
    const resolved = await ctx.resolveSource('flags');
    expect(resolved.kind).toBe('unleash-flags');
    ctx.destroy();
  });
});
