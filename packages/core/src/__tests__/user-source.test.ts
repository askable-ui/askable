import { describe, expect, it } from 'vitest';
import { createAskableContext, createAskableUserSource } from '../index.js';
import type { AskableUserProfile } from '../index.js';

const USER: AskableUserProfile = {
  name: 'Alice Admin',
  email: 'alice@example.com',
  role: 'admin',
  plan: 'enterprise',
  organization: 'Acme Corp',
};

describe('createAskableUserSource', () => {
  it('exposes state mode', () => {
    const source = createAskableUserSource({ getUser: () => USER });
    expect(source.modes).toContain('state');
  });

  it('getState() returns role, name, plan but not email', async () => {
    const source = createAskableUserSource({ getUser: () => USER });
    const state = await Promise.resolve(source.getState?.()) as {
      authenticated: boolean;
      name?: string;
      role?: string;
      email?: string;
    };
    expect(state.authenticated).toBe(true);
    expect(state.name).toBe('Alice Admin');
    expect(state.role).toBe('admin');
    expect(state.email).toBeUndefined();
  });

  it('returns full profile in resolve()', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('user', createAskableUserSource({ getUser: () => USER }));

    const resolved = await ctx.resolveSource('user');
    const data = resolved.data as AskableUserProfile;
    expect(data.name).toBe('Alice Admin');
    expect(data.email).toBe('alice@example.com');
    expect(data.role).toBe('admin');

    ctx.destroy();
  });

  it('omits specified fields', async () => {
    const ctx = createAskableContext();
    ctx.registerSource(
      'user',
      createAskableUserSource({ getUser: () => USER, omitFields: ['email', 'organization'] }),
    );

    const resolved = await ctx.resolveSource('user');
    const data = resolved.data as AskableUserProfile;
    expect(data.email).toBeUndefined();
    expect(data.organization).toBeUndefined();
    expect(data.name).toBe('Alice Admin');

    ctx.destroy();
  });

  it('applies sanitize function', async () => {
    const ctx = createAskableContext();
    ctx.registerSource(
      'user',
      createAskableUserSource({
        getUser: () => USER,
        sanitize: (u) => ({ name: u.name, role: u.role }),
      }),
    );

    const resolved = await ctx.resolveSource('user');
    const data = resolved.data as AskableUserProfile;
    expect(Object.keys(data).sort()).toEqual(['name', 'role']);

    ctx.destroy();
  });

  it('returns authenticated: false when user is null', async () => {
    const source = createAskableUserSource({ getUser: () => null });
    const state = await Promise.resolve(source.getState?.()) as { authenticated: boolean };
    expect(state.authenticated).toBe(false);
  });

  it('resolves null when user is null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('user', createAskableUserSource({ getUser: () => null }));

    const resolved = await ctx.resolveSource('user');
    expect(resolved.data).toBeNull();

    ctx.destroy();
  });

  it('accepts async getUser', async () => {
    const ctx = createAskableContext();
    ctx.registerSource(
      'user',
      createAskableUserSource({ getUser: async () => ({ name: 'Bob', role: 'viewer' }) }),
    );

    const resolved = await ctx.resolveSource('user');
    const data = resolved.data as AskableUserProfile;
    expect(data.name).toBe('Bob');

    ctx.destroy();
  });

  it('uses custom describe and kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource(
      'current-user',
      createAskableUserSource({
        getUser: () => USER,
        describe: 'Currently authenticated user',
        kind: 'auth-user',
      }),
    );

    const resolved = await ctx.resolveSource('current-user');
    expect(resolved.kind).toBe('auth-user');
    expect(resolved.description).toBe('Currently authenticated user');

    ctx.destroy();
  });
});
