import { describe, expect, it } from 'vitest';
import {
  createAskableCollectionSource,
  createAskableContext,
  createAskableSource,
  isAskablePacketSourceSelection,
} from '../index.js';

describe('source helpers', () => {
  it('narrows packet-derived source selections', () => {
    const selection = {
      capture: { mode: 'lasso', gesture: 'drag' },
      source: { timestamp: '2026-06-05T00:00:00.000Z', route: '/accounts' },
      target: {
        label: 'lasso selection',
        metadata: { selectedItems: [{ id: 'acct_123' }] },
      },
    };

    expect(isAskablePacketSourceSelection(selection)).toBe(true);
    expect(isAskablePacketSourceSelection({ ids: ['acct_123'] })).toBe(false);
    expect(isAskablePacketSourceSelection(null)).toBe(false);
  });

  it('creates a generic app-owned context source', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('document', createAskableSource({
      kind: 'document',
      describe: 'Current editor document',
      state: () => ({ title: 'Launch plan', dirty: false }),
      data: ({ mode }) => ({ mode, outline: ['Overview', 'Risks'] }),
    }));

    const resolved = await ctx.resolveSource('document', { mode: 'summary' });

    expect(resolved).toEqual({
      id: 'document',
      kind: 'document',
      description: 'Current editor document',
      mode: 'summary',
      state: { title: 'Launch plan', dirty: false },
      data: { mode: 'summary', outline: ['Overview', 'Risks'] },
    });

    ctx.destroy();
  });

  it('creates a generic source with named mode resolvers', async () => {
    const ctx = createAskableContext();
    ctx.push({ widget: 'forecast', region: 'West' }, 'West forecast');
    ctx.registerSource('forecast', createAskableSource({
      kind: 'forecast',
      state: { currency: 'USD', range: 'Q2' },
      data: ({ mode }) => ({ mode, fallback: true }),
      modes: {
        summary: { totalPipeline: 420000, risk: 'medium' },
        selected: ({ focus, selection }) => ({
          focus: focus?.meta,
          selection,
        }),
        all: ({ maxItems }) => ({
          rows: ['acme', 'beta', 'cobalt'].slice(0, maxItems),
        }),
      },
    }));

    await expect(ctx.resolveSource('forecast', { mode: 'summary' })).resolves.toMatchObject({
      data: { totalPipeline: 420000, risk: 'medium' },
    });

    await expect(ctx.resolveSource('forecast', {
      mode: 'selected',
      selection: { ids: ['deal-1'] },
    })).resolves.toMatchObject({
      data: {
        focus: { widget: 'forecast', region: 'West' },
        selection: { ids: ['deal-1'] },
      },
    });

    await expect(ctx.resolveSource('forecast', { mode: 'all', maxItems: 2 })).resolves.toMatchObject({
      data: { rows: ['acme', 'beta'] },
    });

    await expect(ctx.resolveSource('forecast', { mode: 'custom' })).resolves.toMatchObject({
      data: { mode: 'custom', fallback: true },
    });

    ctx.destroy();
  });

  it('lets custom generic source resolvers override named modes', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('forecast', createAskableSource({
      modes: {
        summary: { ignored: true },
      },
      resolve: ({ mode }) => ({ mode, custom: true }),
    }));

    await expect(ctx.resolveSource('forecast', { mode: 'summary' })).resolves.toMatchObject({
      data: { mode: 'summary', custom: true },
    });

    ctx.destroy();
  });

  it('creates a collection source that can resolve all logical items beyond the visible page', async () => {
    const accounts = [
      { id: 'a1', company: 'Acme Corp', mrr: 8400, secret: 'token-a' },
      { id: 'b2', company: 'Beta Labs', mrr: 5100, secret: 'token-b' },
      { id: 'c3', company: 'Cobalt Inc', mrr: 3900, secret: 'token-c' },
    ];
    const ctx = createAskableContext();
    ctx.registerSource('accounts', createAskableCollectionSource({
      describe: 'Accounts matching active filters',
      getState: () => ({ page: 1, pageSize: 1, totalCount: accounts.length }),
      getVisibleItems: () => accounts.slice(0, 1),
      getItems: () => accounts,
      getSummary: () => ({ totalMrr: 17400 }),
      sanitizeItem: ({ secret: _secret, ...safe }) => safe,
    }));

    await expect(ctx.resolveSource('accounts', { mode: 'visible' })).resolves.toMatchObject({
      data: {
        mode: 'visible',
        items: [{ id: 'a1', company: 'Acme Corp', mrr: 8400 }],
        totalCount: 1,
        returnedCount: 1,
        truncated: false,
      },
    });

    const all = await ctx.resolveSource('accounts', { mode: 'all', maxItems: 2 });

    expect(all.data).toEqual({
      mode: 'all',
      items: [
        { id: 'a1', company: 'Acme Corp', mrr: 8400 },
        { id: 'b2', company: 'Beta Labs', mrr: 5100 },
      ],
      totalCount: 3,
      returnedCount: 2,
      truncated: true,
    });
    expect(JSON.stringify(all)).not.toContain('token-a');

    await expect(ctx.resolveSource('accounts', { mode: 'summary' })).resolves.toMatchObject({
      data: {
        mode: 'summary',
        summary: { totalMrr: 17400 },
      },
    });

    ctx.destroy();
  });

  it('isolates individual sanitizeItem failures — other items still resolve', async () => {
    const items = [
      { id: 1, value: 'safe' },
      { id: 2, value: 'will-fail' },
      { id: 3, value: 'also-safe' },
    ];
    const ctx = createAskableContext();
    ctx.registerSource('items', createAskableCollectionSource({
      getItems: () => items,
      sanitizeItem: (item) => {
        if (item.value === 'will-fail') throw new Error('sanitize failed');
        return { id: item.id };
      },
    }));

    const result = await ctx.resolveSource('items', { mode: 'all' });

    expect(result.data).toMatchObject({
      mode: 'all',
      items: [{ id: 1 }, { id: 3 }],
      totalCount: 3,
      returnedCount: 2,
    });

    ctx.destroy();
  });

  it('isolates async sanitizeItem rejections — other items still resolve', async () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const ctx = createAskableContext();
    ctx.registerSource('items', createAskableCollectionSource({
      getItems: () => items,
      sanitizeItem: async (item) => {
        if (item.id === 2) return Promise.reject(new Error('async fail'));
        return item;
      },
    }));

    const result = await ctx.resolveSource('items', { mode: 'all' });

    expect(result.data).toMatchObject({
      items: [{ id: 1 }, { id: 3 }],
      totalCount: 3,
      returnedCount: 2,
    });

    ctx.destroy();
  });

  it('resolves multiple registered sources as structured data', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('accounts', createAskableCollectionSource({
      getItems: () => [
        { id: 'a1', company: 'Acme Corp' },
        { id: 'b2', company: 'Beta Labs' },
      ],
      getSummary: () => ({ count: 2 }),
    }));
    ctx.registerSource('document', createAskableSource({
      kind: 'document',
      data: ({ mode }) => ({ mode, title: 'Launch plan' }),
    }));

    await expect(ctx.resolveSources()).resolves.toMatchObject([
      {
        id: 'accounts',
        kind: 'collection',
        mode: 'summary',
        data: { mode: 'summary', summary: { count: 2 } },
      },
      {
        id: 'document',
        kind: 'document',
        mode: 'summary',
        data: { mode: 'summary', title: 'Launch plan' },
      },
    ]);

    await expect(ctx.resolveSources({
      sources: [{ id: 'accounts', mode: 'all', maxItems: 1 }],
    })).resolves.toMatchObject([
      {
        id: 'accounts',
        data: {
          mode: 'all',
          items: [{ id: 'a1', company: 'Acme Corp' }],
          totalCount: 2,
          returnedCount: 1,
          truncated: true,
        },
      },
    ]);

    ctx.destroy();
  });

  it('isolates source failures when resolving multiple sources', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('broken', createAskableSource({
      resolve: () => {
        throw new Error('Sensitive backend error');
      },
    }));

    await expect(ctx.resolveSources()).resolves.toEqual([
      {
        id: 'broken',
        mode: 'summary',
        error: {
          message: 'Context source unavailable.',
        },
      },
    ]);

    await expect(ctx.resolveSources({
      sourceErrorMode: 'omit',
    })).resolves.toEqual([]);

    await expect(ctx.resolveSources({
      sourceErrorMode: 'throw',
    })).rejects.toThrow('Sensitive backend error');

    ctx.destroy();
  });

  it('returns undefined data when resolve returns undefined for an unsupported mode', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('chart', createAskableSource({
      data: ({ mode }) => mode === 'summary' ? { total: 5 } : undefined,
    }));

    const resultSummary = await ctx.resolveSource('chart', { mode: 'summary' });
    expect(resultSummary.data).toEqual({ total: 5 });

    const resultOther = await ctx.resolveSource('chart', { mode: 'all' });
    expect(resultOther.data).toBeUndefined();

    ctx.destroy();
  });
});
