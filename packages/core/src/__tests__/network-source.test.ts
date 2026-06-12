import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAskableNetworkSource } from '../network-source.js';
import { createAskableContext } from '../index.js';

describe('createAskableNetworkSource', () => {
  it('registers as kind "network"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('net', createAskableNetworkSource());

    const resolved = await ctx.resolveSource('net');
    expect(resolved.kind).toBe('network');
    ctx.destroy();
  });

  it('returns isOnline based on navigator.onLine', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('net', createAskableNetworkSource());

    const resolved = await ctx.resolveSource('net');
    const data = resolved.data as { isOnline: boolean; isOffline: boolean };
    expect(typeof data.isOnline).toBe('boolean');
    expect(data.isOffline).toBe(!data.isOnline);
    ctx.destroy();
  });

  it('state includes isOnline', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('net', createAskableNetworkSource());

    const resolved = await ctx.resolveSource('net', { mode: 'state' });
    const state = resolved.state as { isOnline: boolean };
    expect(typeof state.isOnline).toBe('boolean');
    ctx.destroy();
  });

  it('returns non-null data always', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('net', createAskableNetworkSource());

    const resolved = await ctx.resolveSource('net');
    expect(resolved.data).not.toBeNull();
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableNetworkSource({
      describe: (s) => s.isOnline ? 'User is connected' : 'User is offline',
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(typeof description).toBe('string');
    expect(description.length).toBeGreaterThan(0);
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('net', createAskableNetworkSource({ kind: 'connectivity' }));

    const resolved = await ctx.resolveSource('net');
    expect(resolved.kind).toBe('connectivity');
    ctx.destroy();
  });

  it('describe output contains "Online" or "Offline"', async () => {
    const source = createAskableNetworkSource();
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toMatch(/Online|Offline/i);
  });
});
