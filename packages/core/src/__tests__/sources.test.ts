import { describe, expect, it } from 'vitest';
import {
  createAskableCollectionSource,
  createAskableContext,
  createAskableSource,
} from '../index.js';

describe('source helpers', () => {
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
});
