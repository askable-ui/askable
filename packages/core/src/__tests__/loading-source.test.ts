import { describe, it, expect } from 'vitest';
import { createAskableLoadingSource } from '../loading-source.js';
import { createAskableContext } from '../index.js';
import type { AskableLoadingSourceSnapshot } from '../loading-source.js';

function makeSnapshot(overrides: Partial<AskableLoadingSourceSnapshot> = {}): AskableLoadingSourceSnapshot {
  return {
    operations: [],
    loading: [],
    loaded: [],
    errored: [],
    isLoading: false,
    activeCount: 0,
    ...overrides,
  };
}

describe('createAskableLoadingSource', () => {
  it('registers as kind "loading"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('loading', createAskableLoadingSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('loading');
    expect(resolved.kind).toBe('loading');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('loading', createAskableLoadingSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('loading');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns loading keys when operations are active', async () => {
    const snap = makeSnapshot({
      loading: ['users', 'reports'],
      isLoading: true,
      activeCount: 2,
    });
    const ctx = createAskableContext();
    ctx.registerSource('loading', createAskableLoadingSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('loading');
    const data = resolved.data as AskableLoadingSourceSnapshot;
    expect(data.loading).toContain('users');
    expect(data.loading).toContain('reports');
    expect(data.isLoading).toBe(true);
    ctx.destroy();
  });

  it('state includes isLoading and activeCount', async () => {
    const snap = makeSnapshot({ isLoading: true, activeCount: 3, errored: ['photos'] });
    const ctx = createAskableContext();
    ctx.registerSource('loading', createAskableLoadingSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('loading', { mode: 'state' });
    const state = resolved.state as { isLoading: boolean; activeCount: number; errorCount: number };
    expect(state.isLoading).toBe(true);
    expect(state.activeCount).toBe(3);
    expect(state.errorCount).toBe(1);
    ctx.destroy();
  });

  it('describe mentions active operations', async () => {
    const source = createAskableLoadingSource({
      getSnapshot: () => makeSnapshot({ loading: ['users'], isLoading: true, activeCount: 1 }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('users');
    expect(desc).toContain('loading');
  });

  it('describe reports errors when all completed with errors', async () => {
    const source = createAskableLoadingSource({
      getSnapshot: () => makeSnapshot({ errored: ['reports'], isLoading: false }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('reports');
    expect(desc).toContain('error');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableLoadingSource({
      getSnapshot: () => makeSnapshot({ loading: ['data'], isLoading: true, activeCount: 1 }),
      describe: (s) => `Active: ${s.loading.join(', ')}`,
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('data');
    expect(desc).toContain('Active:');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('loading', createAskableLoadingSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'async-state',
    }));
    const resolved = await ctx.resolveSource('loading');
    expect(resolved.kind).toBe('async-state');
    ctx.destroy();
  });
});
