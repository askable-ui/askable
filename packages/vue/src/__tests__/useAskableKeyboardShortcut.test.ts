import { describe, expect, it, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskableKeyboardShortcut } from '../useAskableKeyboardShortcut.js';
import { track, cleanup } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

function fireKeydown(key: string, mods: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
}

describe('useAskableKeyboardShortcut (Vue)', () => {
  afterEach(cleanup);

  it('starts with isOpen: false and lastContext: null', async () => {
    const ctx = createAskableContext();
    let hook: ReturnType<typeof useAskableKeyboardShortcut> | undefined;

    track(mount(defineComponent({
      setup() {
        hook = useAskableKeyboardShortcut({ ctx });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    expect(hook!.isOpen.value).toBe(false);
    expect(hook!.lastContext.value).toBeNull();
    ctx.destroy();
  });

  it('calls onTrigger when Ctrl+K is pressed', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    track(mount(defineComponent({
      setup() {
        useAskableKeyboardShortcut({
          ctx,
          onTrigger: (c: string) => triggered.push(c),
        });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    fireKeydown('k', { ctrlKey: true });
    await new Promise((r) => setTimeout(r, 10));
    await flushAll();

    expect(triggered).toHaveLength(1);
    ctx.destroy();
  });

  it('does not trigger on wrong key', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    track(mount(defineComponent({
      setup() {
        useAskableKeyboardShortcut({
          ctx,
          onTrigger: (c: string) => triggered.push(c),
        });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    fireKeydown('j', { ctrlKey: true });
    await new Promise((r) => setTimeout(r, 10));

    expect(triggered).toHaveLength(0);
    ctx.destroy();
  });

  it('does not trigger when enabled is false', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    track(mount(defineComponent({
      setup() {
        useAskableKeyboardShortcut({
          ctx,
          enabled: false,
          onTrigger: (c: string) => triggered.push(c),
        });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    fireKeydown('k', { ctrlKey: true });
    await new Promise((r) => setTimeout(r, 10));

    expect(triggered).toHaveLength(0);
    ctx.destroy();
  });

  it('toggles isOpen when toggle is true', async () => {
    const ctx = createAskableContext();
    let hook: ReturnType<typeof useAskableKeyboardShortcut> | undefined;

    track(mount(defineComponent({
      setup() {
        hook = useAskableKeyboardShortcut({ ctx, toggle: true });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    expect(hook!.isOpen.value).toBe(false);

    fireKeydown('k', { ctrlKey: true });
    await new Promise((r) => setTimeout(r, 20));
    await flushAll();

    expect(hook!.isOpen.value).toBe(true);
    ctx.destroy();
  });

  it('setOpen sets the open state', async () => {
    const ctx = createAskableContext();
    let hook: ReturnType<typeof useAskableKeyboardShortcut> | undefined;

    track(mount(defineComponent({
      setup() {
        hook = useAskableKeyboardShortcut({ ctx });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    hook!.setOpen(true);
    expect(hook!.isOpen.value).toBe(true);

    hook!.setOpen(false);
    expect(hook!.isOpen.value).toBe(false);
    ctx.destroy();
  });

  it('removes event listener on unmount', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    const wrapper = track(mount(defineComponent({
      setup() {
        useAskableKeyboardShortcut({
          ctx,
          onTrigger: (c: string) => triggered.push(c),
        });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    wrapper.unmount();

    fireKeydown('k', { ctrlKey: true });
    await new Promise((r) => setTimeout(r, 10));

    expect(triggered).toHaveLength(0);
    ctx.destroy();
  });
});
