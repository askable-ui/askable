import { describe, it, expect } from 'vitest';
import { createSignal } from 'solid-js';
import { createAskableContext } from '@askable-ui/core';
import type { AskableUserProfile } from '@askable-ui/core';
import { useAskableUserSource } from '../useAskableUserSource.js';
import { renderHook } from '@solidjs/testing-library';

const ALICE: AskableUserProfile = {
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin',
  plan: 'pro',
};

describe('useAskableUserSource (SolidJS)', () => {
  it('registers source under the "user" id by default', () => {
    const ctx = createAskableContext();
    const [user] = createSignal<AskableUserProfile | null>(ALICE);

    const { result, cleanup } = renderHook(() => useAskableUserSource({ ctx, user }));

    expect(ctx.hasSource('user')).toBe(true);
    expect(result.sourceId).toBe('user');

    cleanup();
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    const [user] = createSignal<AskableUserProfile | null>(ALICE);

    const { result, cleanup } = renderHook(() =>
      useAskableUserSource({ ctx, id: 'current-user', user }),
    );

    expect(ctx.hasSource('current-user')).toBe(true);
    expect(result.sourceId).toBe('current-user');

    cleanup();
    ctx.destroy();
  });

  it('returns user profile data', async () => {
    const ctx = createAskableContext();
    const [user] = createSignal<AskableUserProfile | null>(ALICE);

    const { result, cleanup } = renderHook(() => useAskableUserSource({ ctx, user }));

    const resolved = await result.resolve();
    const data = resolved.data as AskableUserProfile;
    expect(data.name).toBe('Alice');
    expect(data.role).toBe('admin');

    cleanup();
    ctx.destroy();
  });

  it('returns authenticated: false when user accessor returns null', async () => {
    const ctx = createAskableContext();
    const [user] = createSignal<AskableUserProfile | null>(null);

    const { result, cleanup } = renderHook(() => useAskableUserSource({ ctx, user }));

    const resolved = await result.resolve();
    const state = resolved.state as { authenticated: boolean };
    expect(state.authenticated).toBe(false);

    cleanup();
    ctx.destroy();
  });

  it('omits fields listed in omitFields', async () => {
    const ctx = createAskableContext();
    const [user] = createSignal<AskableUserProfile | null>(ALICE);

    const { result, cleanup } = renderHook(() =>
      useAskableUserSource({ ctx, user, omitFields: ['email'] }),
    );

    const resolved = await result.resolve();
    const data = resolved.data as Record<string, unknown>;
    expect(data.email).toBeUndefined();
    expect(data.name).toBe('Alice');

    cleanup();
    ctx.destroy();
  });

  it('applies sanitize transform', async () => {
    const ctx = createAskableContext();
    const [user] = createSignal<AskableUserProfile | null>(ALICE);

    const { result, cleanup } = renderHook(() =>
      useAskableUserSource({
        ctx,
        user,
        sanitize: (profile) => ({ ...profile, name: profile.name?.toUpperCase() }),
      }),
    );

    const resolved = await result.resolve();
    const data = resolved.data as AskableUserProfile;
    expect(data.name).toBe('ALICE');

    cleanup();
    ctx.destroy();
  });

  it('unregisters on cleanup', () => {
    const ctx = createAskableContext();
    const [user] = createSignal<AskableUserProfile | null>(ALICE);

    const { cleanup } = renderHook(() => useAskableUserSource({ ctx, user }));

    expect(ctx.hasSource('user')).toBe(true);
    cleanup();
    expect(ctx.hasSource('user')).toBe(false);
    ctx.destroy();
  });
});
