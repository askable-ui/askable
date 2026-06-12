import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAskableStorageSource } from '../storage-source.js';
import { createAskableContext } from '../index.js';

function setItems(store: Storage, items: Record<string, string | object>): void {
  Object.entries(items).forEach(([k, v]) => {
    store.setItem(k, typeof v === 'object' ? JSON.stringify(v) : v);
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('createAskableStorageSource', () => {
  it('registers as kind "storage"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource());

    const resolved = await ctx.resolveSource('ls');
    expect(resolved.kind).toBe('storage');
    ctx.destroy();
  });

  it('reads all localStorage keys when no filter is given', async () => {
    setItems(localStorage, { theme: 'dark', locale: 'en', cart: JSON.stringify([1, 2]) });
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource());

    const resolved = await ctx.resolveSource('ls');
    const data = resolved.data as { items: Record<string, unknown>; count: number };
    expect(data.count).toBe(3);
    expect(data.items.theme).toBe('dark');
    ctx.destroy();
  });

  it('parses JSON values when parseJSON is true (default)', async () => {
    setItems(localStorage, { cart: [{ id: 1 }, { id: 2 }] });
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource());

    const resolved = await ctx.resolveSource('ls');
    const data = resolved.data as { items: { cart: unknown[] } };
    expect(Array.isArray(data.items.cart)).toBe(true);
    expect((data.items.cart as { id: number }[])[0].id).toBe(1);
    ctx.destroy();
  });

  it('keeps raw strings when parseJSON is false', async () => {
    setItems(localStorage, { data: '{"x":1}' });
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource({ parseJSON: false }));

    const resolved = await ctx.resolveSource('ls');
    const data = resolved.data as { items: { data: unknown } };
    expect(data.items.data).toBe('{"x":1}');
    ctx.destroy();
  });

  it('captures only listed keys', async () => {
    setItems(localStorage, { theme: 'dark', token: 'abc', locale: 'en' });
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource({ keys: ['theme', 'locale'] }));

    const resolved = await ctx.resolveSource('ls');
    const data = resolved.data as { items: Record<string, unknown>; count: number };
    expect(data.count).toBe(2);
    expect(data.items.token).toBeUndefined();
    ctx.destroy();
  });

  it('excludes omitKeys', async () => {
    setItems(localStorage, { theme: 'dark', authToken: 'secret', locale: 'en' });
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource({ omitKeys: ['authToken'] }));

    const resolved = await ctx.resolveSource('ls');
    const data = resolved.data as { items: Record<string, unknown> };
    expect(data.items.authToken).toBeUndefined();
    expect(data.items.theme).toBe('dark');
    ctx.destroy();
  });

  it('masks values for maskKeys', async () => {
    setItems(localStorage, { csrfToken: 'my-secret', theme: 'light' });
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource({ maskKeys: ['csrfToken'] }));

    const resolved = await ctx.resolveSource('ls');
    const data = resolved.data as { items: Record<string, unknown> };
    expect(data.items.csrfToken).toBe('***');
    expect(data.items.theme).toBe('light');
    ctx.destroy();
  });

  it('reads sessionStorage when specified', async () => {
    setItems(sessionStorage, { sessionId: 'xyz' });
    const ctx = createAskableContext();
    ctx.registerSource('sess', createAskableStorageSource({ storage: 'sessionStorage' }));

    const resolved = await ctx.resolveSource('sess');
    const data = resolved.data as { storageType: string; items: Record<string, unknown> };
    expect(data.storageType).toBe('sessionStorage');
    expect(data.items.sessionId).toBe('xyz');
    ctx.destroy();
  });

  it('applies sanitize transform', async () => {
    setItems(localStorage, { name: 'Alice', age: '30' });
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource({
      sanitize: (items) => ({ ...items, name: (items.name as string).toUpperCase() }),
    }));

    const resolved = await ctx.resolveSource('ls');
    const data = resolved.data as { items: { name: string } };
    expect(data.items.name).toBe('ALICE');
    ctx.destroy();
  });

  it('returns count: 0 when storage is empty', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('ls', createAskableStorageSource());

    const resolved = await ctx.resolveSource('ls', { mode: 'state' });
    expect((resolved.state as { count: number }).count).toBe(0);
    ctx.destroy();
  });
});
