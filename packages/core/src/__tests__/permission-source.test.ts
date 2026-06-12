import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAskablePermissionSource } from '../permission-source.js';
import { createAskableContext } from '../index.js';
import type { AskablePermissionSourceSnapshot, AskablePermissionEntry } from '../permission-source.js';

function makeSnapshot(entries: AskablePermissionEntry[]): AskablePermissionSourceSnapshot {
  const granted = entries.filter((e) => e.state === 'granted').map((e) => e.name);
  const denied = entries.filter((e) => e.state === 'denied').map((e) => e.name);
  const prompt = entries.filter((e) => e.state === 'prompt').map((e) => e.name);
  const unavailable = entries.filter((e) => e.state === 'unavailable').map((e) => e.name);
  return { permissions: entries, granted, denied, prompt, unavailable };
}

describe('createAskablePermissionSource', () => {
  it('registers as kind "permissions"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('perms', createAskablePermissionSource({
      getSnapshot: () => makeSnapshot([{ name: 'camera', state: 'granted' }]),
    }));

    const resolved = await ctx.resolveSource('perms');
    expect(resolved.kind).toBe('permissions');
    ctx.destroy();
  });

  it('returns granted permissions', async () => {
    const snapshot = makeSnapshot([
      { name: 'camera', state: 'granted' },
      { name: 'microphone', state: 'denied' },
    ]);
    const ctx = createAskableContext();
    ctx.registerSource('perms', createAskablePermissionSource({ getSnapshot: () => snapshot }));

    const resolved = await ctx.resolveSource('perms');
    const data = resolved.data as AskablePermissionSourceSnapshot;
    expect(data.granted).toContain('camera');
    expect(data.denied).toContain('microphone');
    ctx.destroy();
  });

  it('state includes granted, denied, and hasBlockedPermissions', async () => {
    const snapshot = makeSnapshot([
      { name: 'notifications', state: 'denied' },
      { name: 'geolocation', state: 'prompt' },
    ]);
    const ctx = createAskableContext();
    ctx.registerSource('perms', createAskablePermissionSource({ getSnapshot: () => snapshot }));

    const resolved = await ctx.resolveSource('perms', { mode: 'state' });
    const state = resolved.state as { granted: string[]; denied: string[]; hasBlockedPermissions: boolean };
    expect(state.denied).toContain('notifications');
    expect(state.hasBlockedPermissions).toBe(true);
    ctx.destroy();
  });

  it('returns empty arrays when all permissions are prompt', async () => {
    const snapshot = makeSnapshot([
      { name: 'camera', state: 'prompt' },
      { name: 'microphone', state: 'prompt' },
    ]);
    const ctx = createAskableContext();
    ctx.registerSource('perms', createAskablePermissionSource({ getSnapshot: () => snapshot }));

    const resolved = await ctx.resolveSource('perms');
    const data = resolved.data as AskablePermissionSourceSnapshot;
    expect(data.granted).toHaveLength(0);
    expect(data.denied).toHaveLength(0);
    expect(data.prompt).toHaveLength(2);
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const snapshot = makeSnapshot([
      { name: 'camera', state: 'denied' },
    ]);
    const source = createAskablePermissionSource({
      getSnapshot: () => snapshot,
      describe: (s) => `Blocked: ${s.denied.join(', ')}`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('Blocked: camera');
  });

  it('describe includes granted permissions', async () => {
    const snapshot = makeSnapshot([
      { name: 'notifications', state: 'granted' },
    ]);
    const source = createAskablePermissionSource({ getSnapshot: () => snapshot });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('notifications');
    expect(description).toContain('Granted');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('perms', createAskablePermissionSource({
      getSnapshot: () => makeSnapshot([]),
      kind: 'browser-permissions',
    }));

    const resolved = await ctx.resolveSource('perms');
    expect(resolved.kind).toBe('browser-permissions');
    ctx.destroy();
  });
});
