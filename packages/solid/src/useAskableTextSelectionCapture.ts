import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createAskableTextSelectionCapture } from '@askable-ui/core';
import type {
  AskableTextSelectionCaptureHandle,
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCaptureSelection,
  AskableTextSelectionCaptureState,
  WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type {
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCaptureSelection,
  AskableTextSelectionCaptureState,
};

export interface UseAskableTextSelectionCaptureOptions
  extends AskableTextSelectionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableTextSelectionCaptureResult {
  ctx: ReturnType<typeof useAskable>['ctx'];
  active: () => boolean;
  lastPacket: () => WebContextPacket | null;
  lastSelection: () => AskableTextSelectionCaptureSelection | null;
  selectionState: () => AskableTextSelectionCaptureState | null;
  start(overrides?: Partial<AskableTextSelectionCaptureOptions>): void;
  captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>): WebContextPacket | null;
  cancel(): void;
  clearSelection(): void;
  getSelection(): AskableTextSelectionCaptureState | null;
  destroy(): void;
  isActive(): boolean;
}

/**
 * SolidJS primitive for capturing highlighted / selected text.
 *
 * @example
 * ```tsx
 * const sel = useAskableTextSelectionCapture();
 * sel.start();
 *
 * return (
 *   <Show when={sel.lastPacket()}>
 *     {(packet) => <p>"{packet().text}"</p>}
 *   </Show>
 * );
 * ```
 */
export function useAskableTextSelectionCapture(
  options: UseAskableTextSelectionCaptureOptions = {},
): UseAskableTextSelectionCaptureResult {
  const { ctx } = useAskable(options);

  let handle: AskableTextSelectionCaptureHandle | null = null;
  const [active, setActive] = createSignal(false);
  const [lastPacket, setLastPacket] = createSignal<WebContextPacket | null>(null);
  const [lastSelection, setLastSelection] = createSignal<AskableTextSelectionCaptureSelection | null>(null);
  const [selectionState, setSelectionState] = createSignal<AskableTextSelectionCaptureState | null>(null);

  createEffect(() => {
    onCleanup(() => { handle?.destroy(); handle = null; });
  });

  function ensureHandle(overrides?: Partial<AskableTextSelectionCaptureOptions>): AskableTextSelectionCaptureHandle {
    handle?.destroy();
    const merged = { ...options, ...overrides };
    const h = createAskableTextSelectionCapture(ctx, {
      ...merged,
      onCapture(packet, selection) {
        setLastPacket(() => packet);
        setLastSelection(() => selection);
        if (merged.once) setActive(false);
        options.onCapture?.(packet, selection);
      },
      onSelectionChange(state) {
        setSelectionState(() => state);
        options.onSelectionChange?.(state);
      },
      onCancel() {
        handle = null;
        setActive(false);
        options.onCancel?.();
      },
    });
    handle = h;
    return h;
  }

  function start(overrides?: Partial<AskableTextSelectionCaptureOptions>): void {
    ensureHandle(overrides).start();
    setActive(true);
  }

  function captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>): WebContextPacket | null {
    const h = handle ?? ensureHandle(overrides);
    const packet = h.captureNow(overrides);
    if (packet && (options.once || overrides?.once)) setActive(false);
    return packet;
  }

  function cancel(): void {
    handle?.cancel();
    handle = null;
    setActive(false);
    setSelectionState(null);
  }

  function clearSelection(): void {
    handle?.clearSelection();
  }

  function getSelection(): AskableTextSelectionCaptureState | null {
    return handle?.getSelection() ?? null;
  }

  function destroy(): void {
    handle?.destroy();
    handle = null;
    setActive(false);
    setSelectionState(null);
  }

  function isActive(): boolean {
    return handle?.isActive() ?? active();
  }

  return {
    ctx,
    active,
    lastPacket,
    lastSelection,
    selectionState,
    start,
    captureNow,
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}
