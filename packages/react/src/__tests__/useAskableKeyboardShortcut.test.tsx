import { render, act, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableKeyboardShortcut } from '../useAskableKeyboardShortcut.js';
import type { UseAskableKeyboardShortcutResult } from '../useAskableKeyboardShortcut.js';

let hookRef: UseAskableKeyboardShortcutResult | undefined;

function ShortcutConsumer({
  ctx,
  ...rest
}: Parameters<typeof useAskableKeyboardShortcut>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
}) {
  hookRef = useAskableKeyboardShortcut({ ctx, ...rest });
  return null;
}

function fireKeydown(key: string, mods: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
}

describe('useAskableKeyboardShortcut', () => {
  afterEach(() => {
    hookRef = undefined;
  });

  it('starts with isOpen: false and lastContext: null', () => {
    const ctx = createAskableContext();
    render(<ShortcutConsumer ctx={ctx} />);

    expect(hookRef!.isOpen).toBe(false);
    expect(hookRef!.lastContext).toBeNull();
    ctx.destroy();
  });

  it('calls onTrigger when shortcut fires (mod+k)', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    render(<ShortcutConsumer ctx={ctx} onTrigger={(c) => triggered.push(c)} />);

    await act(async () => {
      fireKeydown('k', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(triggered).toHaveLength(1);
    ctx.destroy();
  });

  it('does not trigger on wrong key', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    render(<ShortcutConsumer ctx={ctx} onTrigger={(c) => triggered.push(c)} />);

    await act(async () => {
      fireKeydown('j', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(triggered).toHaveLength(0);
    ctx.destroy();
  });

  it('does not trigger when enabled: false', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    render(<ShortcutConsumer ctx={ctx} enabled={false} onTrigger={(c) => triggered.push(c)} />);

    await act(async () => {
      fireKeydown('k', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(triggered).toHaveLength(0);
    ctx.destroy();
  });

  it('sets lastContext after trigger', async () => {
    const ctx = createAskableContext();

    render(<ShortcutConsumer ctx={ctx} />);

    await act(async () => {
      fireKeydown('k', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(hookRef!.lastContext).not.toBeNull());
    ctx.destroy();
  });

  it('toggles isOpen when toggle: true', async () => {
    const ctx = createAskableContext();

    render(<ShortcutConsumer ctx={ctx} toggle />);

    expect(hookRef!.isOpen).toBe(false);

    await act(async () => {
      fireKeydown('k', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(hookRef!.isOpen).toBe(true));

    await act(async () => {
      fireKeydown('k', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(hookRef!.isOpen).toBe(false));
    ctx.destroy();
  });

  it('setOpen controls the open state programmatically', async () => {
    const ctx = createAskableContext();

    render(<ShortcutConsumer ctx={ctx} toggle />);

    act(() => hookRef!.setOpen(true));
    expect(hookRef!.isOpen).toBe(true);

    act(() => hookRef!.setOpen(false));
    expect(hookRef!.isOpen).toBe(false);
    ctx.destroy();
  });

  it('respects a custom shortcut string', async () => {
    const ctx = createAskableContext();
    const triggered: string[] = [];

    render(
      <ShortcutConsumer ctx={ctx} shortcut="alt+/" onTrigger={(c) => triggered.push(c)} />,
    );

    await act(async () => {
      fireKeydown('/', { altKey: true });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(triggered).toHaveLength(1);
    ctx.destroy();
  });
});
