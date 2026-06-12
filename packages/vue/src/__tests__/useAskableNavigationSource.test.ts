import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskableNavigationSource } from '../useAskableNavigationSource.js';
import { track, cleanup } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('useAskableNavigationSource (Vue)', () => {
  afterEach(cleanup);

  it('registers under "navigation" id by default', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableNavigationSource({ ctx }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('navigation');
    expect(resolved.id).toBe('navigation');
    expect(resolved.kind).toBe('navigation');
    ctx.destroy();
  });

  it('returns current path and title', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() {
        useAskableNavigationSource({
          ctx,
          getPath: () => '/settings?section=profile',
          getTitle: () => 'Settings',
        });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('navigation');
    const data = resolved.data as { currentPath: string; currentTitle: string; query: Record<string, string> };
    expect(data.currentPath).toBe('/settings?section=profile');
    expect(data.currentTitle).toBe('Settings');
    expect(data.query.section).toBe('profile');
    ctx.destroy();
  });

  it('auto-notifies when pathname ref changes', async () => {
    const ctx = createAskableContext();
    let currentPath = '/home';
    const pathname = ref('/home');

    track(mount(defineComponent({
      setup() {
        useAskableNavigationSource({
          ctx,
          pathname,
          getPath: () => currentPath,
        });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    currentPath = '/about';
    pathname.value = '/about';
    await flushAll();

    const resolved = await ctx.resolveSource('navigation');
    const data = resolved.data as { currentPath: string };
    expect(data.currentPath).toBe('/about');
    ctx.destroy();
  });

  it('unregisters on unmount', async () => {
    const ctx = createAskableContext();

    const wrapper = track(mount(defineComponent({
      setup() { useAskableNavigationSource({ ctx }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();
    await expect(ctx.resolveSource('navigation')).resolves.toMatchObject({ id: 'navigation' });

    wrapper.unmount();
    await expect(ctx.resolveSource('navigation')).rejects.toThrow('not registered');
    ctx.destroy();
  });
});
