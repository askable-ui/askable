import { describe, it, expect } from 'vitest';
import { createAskableConnectionSource } from '../connection-source.js';
import { createAskableContext } from '../index.js';
import type { AskableConnectionSourceSnapshot } from '../connection-source.js';

function makeSnapshot(overrides: Partial<AskableConnectionSourceSnapshot> = {}): AskableConnectionSourceSnapshot {
  return {
    status: 'connected',
    isConnected: true,
    isConnecting: false,
    isReconnecting: false,
    protocol: 'websocket',
    reconnectAttempts: 0,
    connectedAt: new Date().toISOString(),
    disconnectedAt: null,
    lastError: null,
    label: null,
    ...overrides,
  };
}

describe('createAskableConnectionSource', () => {
  it('registers as kind "connection"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('conn', createAskableConnectionSource({
      getSnapshot: () => makeSnapshot(),
    }));
    const resolved = await ctx.resolveSource('conn');
    expect(resolved.kind).toBe('connection');
    ctx.destroy();
  });

  it('returns snapshot data when connected', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('conn', createAskableConnectionSource({
      getSnapshot: () => makeSnapshot({ status: 'connected', isConnected: true }),
    }));
    const resolved = await ctx.resolveSource('conn');
    const data = resolved.data as AskableConnectionSourceSnapshot;
    expect(data.status).toBe('connected');
    expect(data.isConnected).toBe(true);
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('conn', createAskableConnectionSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('conn');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('state includes status and isConnected', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('conn', createAskableConnectionSource({
      getSnapshot: () => makeSnapshot({ status: 'reconnecting', isConnected: false, isReconnecting: true, reconnectAttempts: 3 }),
    }));
    const resolved = await ctx.resolveSource('conn', { mode: 'state' });
    const state = resolved.state as { status: string; isConnected: boolean; reconnectAttempts: number };
    expect(state.status).toBe('reconnecting');
    expect(state.isConnected).toBe(false);
    expect(state.reconnectAttempts).toBe(3);
    ctx.destroy();
  });

  it('describe returns active message when connected', async () => {
    const source = createAskableConnectionSource({
      getSnapshot: () => makeSnapshot({ isConnected: true, protocol: 'websocket' }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('active');
    expect(desc).toContain('websocket');
  });

  it('describe mentions reconnect attempts when reconnecting', async () => {
    const source = createAskableConnectionSource({
      getSnapshot: () => makeSnapshot({ status: 'reconnecting', isConnected: false, isReconnecting: true, reconnectAttempts: 5 }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('5');
  });

  it('describe includes label when set', async () => {
    const source = createAskableConnectionSource({
      getSnapshot: () => makeSnapshot({ label: 'chat', isConnected: true }),
    });
    const desc = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(desc).toContain('chat');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('conn', createAskableConnectionSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'socketio',
    }));
    const resolved = await ctx.resolveSource('conn');
    expect(resolved.kind).toBe('socketio');
    ctx.destroy();
  });
});
