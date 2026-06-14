import { createAskableTextSelectionCapture } from '@askable-ui/core';
import type {
  AskableContext,
  AskableTextSelectionCaptureHandle,
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCaptureSelection,
  AskableTextSelectionCaptureState,
  WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.svelte.ts';

export type {
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCaptureSelection,
  AskableTextSelectionCaptureState,
};

export interface UseAskableTextSelectionCaptureOptions
  extends AskableTextSelectionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableTextSelectionCapture {
  readonly ctx: AskableContext;
  readonly active: boolean;
  readonly lastPacket: WebContextPacket | null;
  readonly lastSelection: AskableTextSelectionCaptureSelection | null;
  readonly selectionState: AskableTextSelectionCaptureState | null;
  start(overrides?: Partial<AskableTextSelectionCaptureOptions>): void;
  captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>): WebContextPacket | null;
  cancel(): void;
  clearSelection(): void;
  getSelection(): AskableTextSelectionCaptureState | null;
  destroy(): void;
  isActive(): boolean;
}

/**
 * Svelte 5 runes-based composable for text selection capture.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableTextSelectionCapture } from '@askable-ui/svelte';
 *   const sel = useAskableTextSelectionCapture();
 *   sel.start();
 * </script>
 *
 * {#if sel.lastPacket}
 *   <p>Selected: {sel.lastPacket.text}</p>
 * {/if}
 * ```
 */
export function useAskableTextSelectionCapture(
  options: UseAskableTextSelectionCaptureOptions = {},
): UseAskableTextSelectionCapture {
  const { ctx } = useAskable(options);

  let handle: AskableTextSelectionCaptureHandle | null = null;
  let active = $state(false);
  let lastPacket = $state<WebContextPacket | null>(null);
  let lastSelection = $state<AskableTextSelectionCaptureSelection | null>(null);
  let selectionState = $state<AskableTextSelectionCaptureState | null>(null);

  let latestOptions = options;
  $effect(() => { latestOptions = options; });

  $effect(() => {
    return () => { handle?.destroy(); handle = null; };
  });

  function ensureHandle(overrides?: Partial<AskableTextSelectionCaptureOptions>): AskableTextSelectionCaptureHandle {
    handle?.destroy();
    const merged = { ...latestOptions, ...overrides };
    const h = createAskableTextSelectionCapture(ctx, {
      ...merged,
      onCapture(packet, selection) {
        lastPacket = packet;
        lastSelection = selection;
        if (merged.once) active = false;
        latestOptions.onCapture?.(packet, selection);
      },
      onSelectionChange(state) {
        selectionState = state;
        latestOptions.onSelectionChange?.(state);
      },
      onCancel() {
        handle = null;
        active = false;
        latestOptions.onCancel?.();
      },
    });
    handle = h;
    return h;
  }

  function start(overrides?: Partial<AskableTextSelectionCaptureOptions>): void {
    ensureHandle(overrides).start();
    active = true;
  }

  function captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>): WebContextPacket | null {
    const h = handle ?? ensureHandle(overrides);
    const packet = h.captureNow(overrides);
    if (packet && (latestOptions.once || overrides?.once)) active = false;
    return packet;
  }

  function cancel(): void {
    handle?.cancel();
    handle = null;
    active = false;
    selectionState = null;
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
    active = false;
    selectionState = null;
  }

  function isActive(): boolean {
    return handle?.isActive() ?? active;
  }

  return {
    ctx,
    get active() { return active; },
    get lastPacket() { return lastPacket; },
    get lastSelection() { return lastSelection; },
    get selectionState() { return selectionState; },
    start,
    captureNow,
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}
