import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAskableNavigationSource } from '../navigation-source.js';
import { createAskableContext } from '../index.js';

describe('createAskableNavigationSource', () => {
  let path = '/dashboard';
  let title = 'Dashboard';

  const getPath = () => path;
  const getTitle = () => title;

  beforeEach(() => {
    path = '/dashboard';
    title = 'Dashboard';
  });

  it('registers as kind "navigation"', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath, getTitle });
    ctx.registerSource('nav', source);

    const resolved = await ctx.resolveSource('nav');
    expect(resolved.kind).toBe('navigation');
    ctx.destroy();
  });

  it('returns current path and title in state', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath, getTitle });
    ctx.registerSource('nav', source);

    const resolved = await ctx.resolveSource('nav', { mode: 'state' });
    expect(resolved.state).toMatchObject({ currentPath: '/dashboard', title: 'Dashboard' });
    ctx.destroy();
  });

  it('returns full snapshot in data (default mode)', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath, getTitle });
    ctx.registerSource('nav', source);

    const resolved = await ctx.resolveSource('nav');
    const data = resolved.data as { currentPath: string; currentTitle: string; history: unknown[] };
    expect(data.currentPath).toBe('/dashboard');
    expect(data.currentTitle).toBe('Dashboard');
    expect(data.history).toHaveLength(1);
    ctx.destroy();
  });

  it('parses query string parameters', async () => {
    path = '/search?q=hello&page=2';
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath });
    ctx.registerSource('nav', source);

    const resolved = await ctx.resolveSource('nav');
    const data = resolved.data as { query: Record<string, string> };
    expect(data.query).toEqual({ q: 'hello', page: '2' });
    ctx.destroy();
  });

  it('includes route params when getParams is provided', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({
      getPath,
      getParams: () => ({ userId: '42', tab: 'settings' }),
    });
    ctx.registerSource('nav', source);

    const resolved = await ctx.resolveSource('nav');
    const data = resolved.data as { params: Record<string, string> };
    expect(data.params).toEqual({ userId: '42', tab: 'settings' });
    ctx.destroy();
  });

  it('accumulates history across notifyChanged calls', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath });
    const handle = ctx.registerSource('nav', source);

    await ctx.resolveSource('nav');

    path = '/settings';
    handle.notifyChanged();
    await ctx.resolveSource('nav');

    path = '/profile';
    handle.notifyChanged();
    const resolved = await ctx.resolveSource('nav');
    const data = resolved.data as { history: { path: string }[] };
    expect(data.history).toHaveLength(3);
    expect(data.history[0].path).toBe('/profile');
    expect(data.history[1].path).toBe('/settings');
    expect(data.history[2].path).toBe('/dashboard');
    ctx.destroy();
  });

  it('caps history at maxHistory', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath, maxHistory: 3 });
    const handle = ctx.registerSource('nav', source);

    for (const p of ['/a', '/b', '/c', '/d']) {
      path = p;
      handle.notifyChanged();
      await ctx.resolveSource('nav');
    }

    const resolved = await ctx.resolveSource('nav');
    const data = resolved.data as { history: unknown[] };
    expect(data.history).toHaveLength(3);
    ctx.destroy();
  });

  it('does not duplicate consecutive identical paths', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath });
    const handle = ctx.registerSource('nav', source);

    await ctx.resolveSource('nav');
    handle.notifyChanged();
    await ctx.resolveSource('nav');

    const resolved = await ctx.resolveSource('nav');
    const data = resolved.data as { history: unknown[] };
    expect(data.history).toHaveLength(1);
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableNavigationSource({
      getPath,
      describe: (s) => `You are on: ${s.currentPath}`,
    });
    const description = await (typeof source.describe === 'function'
      ? source.describe()
      : Promise.resolve(source.describe ?? ''));
    expect(description).toContain('You are on: /dashboard');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    const source = createAskableNavigationSource({ getPath, kind: 'route' });
    ctx.registerSource('nav', source);

    const resolved = await ctx.resolveSource('nav');
    expect(resolved.kind).toBe('route');
    ctx.destroy();
  });
});
