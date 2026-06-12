import { describe, it, expect } from 'vitest';
import { createAskableSearchSource } from '../search-source.js';
import { createAskableContext } from '../index.js';
import type { AskableSearchSourceSnapshot } from '../search-source.js';

function makeSnapshot(overrides: Partial<AskableSearchSourceSnapshot> = {}): AskableSearchSourceSnapshot {
  return {
    query: '',
    isSearching: false,
    resultCount: null,
    hasNoResults: false,
    filters: {},
    sort: null,
    page: null,
    searchedAt: null,
    ...overrides,
  };
}

describe('createAskableSearchSource', () => {
  it('registers as kind "search"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('search', createAskableSearchSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('search');
    expect(resolved.kind).toBe('search');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('search', createAskableSearchSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('search');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns snapshot with query and result count', async () => {
    const snap = makeSnapshot({ query: 'reset password', resultCount: 3, searchedAt: new Date().toISOString() });
    const ctx = createAskableContext();
    ctx.registerSource('search', createAskableSearchSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('search');
    const data = resolved.data as AskableSearchSourceSnapshot;
    expect(data.query).toBe('reset password');
    expect(data.resultCount).toBe(3);
    ctx.destroy();
  });

  it('state includes query, resultCount, and hasNoResults', async () => {
    const snap = makeSnapshot({ query: 'xyz', resultCount: 0, hasNoResults: true });
    const ctx = createAskableContext();
    ctx.registerSource('search', createAskableSearchSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('search', { mode: 'state' });
    const state = resolved.state as { query: string; resultCount: number | null; hasNoResults: boolean };
    expect(state.query).toBe('xyz');
    expect(state.resultCount).toBe(0);
    expect(state.hasNoResults).toBe(true);
    ctx.destroy();
  });

  it('state includes filterCount', async () => {
    const snap = makeSnapshot({ query: 'product', filters: { category: 'shoes', size: ['40', '41'] } });
    const ctx = createAskableContext();
    ctx.registerSource('search', createAskableSearchSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('search', { mode: 'state' });
    const state = resolved.state as { filterCount: number };
    expect(state.filterCount).toBe(2);
    ctx.destroy();
  });

  it('describe mentions query and result count', async () => {
    const source = createAskableSearchSource({
      getSnapshot: () => makeSnapshot({ query: 'invoice', resultCount: 5, searchedAt: new Date().toISOString() }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('invoice');
    expect(desc).toContain('5');
  });

  it('describe reports no results', async () => {
    const source = createAskableSearchSource({
      getSnapshot: () => makeSnapshot({ query: 'xyzabc', resultCount: 0, hasNoResults: true }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('xyzabc');
    expect(desc).toContain('no results');
  });

  it('describe includes active filters', async () => {
    const source = createAskableSearchSource({
      getSnapshot: () => makeSnapshot({ query: 'shoes', filters: { brand: 'Nike' } }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('Nike');
    expect(desc).toContain('Filters');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('search', createAskableSearchSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'algolia-search',
    }));
    const resolved = await ctx.resolveSource('search');
    expect(resolved.kind).toBe('algolia-search');
    ctx.destroy();
  });
});
