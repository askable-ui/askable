import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import type { AskableUserProfile } from '@askable-ui/core';
import { useAskableUserSource } from '../useAskableUserSource.js';
import { track, cleanup } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

const ALICE: AskableUserProfile = {
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin',
  plan: 'pro',
};

describe('useAskableUserSource (Vue)', () => {
  afterEach(cleanup);

  it('registers source under the "user" id by default', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableUserSource({ ctx, user: ref(ALICE) }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('user');
    expect(resolved.id).toBe('user');
    ctx.destroy();
  });

  it('returns user profile data', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableUserSource({ ctx, user: ref(ALICE) }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('user');
    const data = resolved.data as AskableUserProfile;
    expect(data.name).toBe('Alice');
    expect(data.role).toBe('admin');
    ctx.destroy();
  });

  it('returns authenticated: false when user is null', async () => {
    const ctx = createAskableContext();
    const user = ref<AskableUserProfile | null>(null);

    track(mount(defineComponent({
      setup() { useAskableUserSource({ ctx, user }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('user');
    const state = resolved.state as { authenticated: boolean };
    expect(state.authenticated).toBe(false);
    ctx.destroy();
  });

  it('omits fields listed in omitFields', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() {
        useAskableUserSource({ ctx, user: ref(ALICE), omitFields: ['email'] });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('user');
    const data = resolved.data as Record<string, unknown>;
    expect(data.email).toBeUndefined();
    expect(data.name).toBe('Alice');
    ctx.destroy();
  });

  it('accepts a custom id', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableUserSource({ ctx, id: 'current-user', user: ref(ALICE) }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('current-user');
    expect(resolved.id).toBe('current-user');
    ctx.destroy();
  });

  it('unregisters on unmount', async () => {
    const ctx = createAskableContext();

    const wrapper = track(mount(defineComponent({
      setup() { useAskableUserSource({ ctx, user: ref(ALICE) }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();
    await expect(ctx.resolveSource('user')).resolves.toMatchObject({ id: 'user' });

    wrapper.unmount();
    await expect(ctx.resolveSource('user')).rejects.toThrow('not registered');
    ctx.destroy();
  });
});
