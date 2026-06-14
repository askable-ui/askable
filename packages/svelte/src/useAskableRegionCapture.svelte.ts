import { createAskableRegionCapture } from '@askable-ui/core';
import type {
  AskableContext,
  AskableRegionCaptureHandle,
  AskableRegionCaptureOptions,
  AskableRegionCaptureSelection,
  AskableRegionCaptureState,
  WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.svelte.ts';

export type { AskableRegionCaptureOptions, AskableRegionCaptureSelection, AskableRegionCaptureState };

export interface UseAskableRegionCaptureOptions
  extends AskableRegionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableRegionCapture {
  readonly ctx: AskableContext;
  readonly active: boolean;
  readonly lastPacket: WebContextPacket | null;
  readonly lastSelection: AskableRegionCaptureSelection | null;
  readonly selectionState: AskableRegionCaptureState | null;
  start(overrides?: Partial<AskableRegionCaptureOptions>): void;
  cancel(): void;
  clearSelection(): void;
  getSelection(): AskableRegionCaptureState | null;
  destroy(): void;
  isActive(): boolean;
}

/**
 * Svelte 5 runes-based composable for rectangular region capture.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableRegionCapture } from '@askable-ui/svelte';
 *   const region = useAskableRegionCapture({ shape: 'rect' });
 * </script>
 *
 * <button onclick={() => region.start()}>Select region</button>
 * {#if region.lastPacket}
 *   <p>Captured: {region.lastPacket.text}</p>
 * {/if}
 * ```
 */
export function useAskableRegionCapture(
  options: UseAskableRegionCaptureOptions = {},
): UseAskableRegionCapture {
  const { ctx } = useAskable(options);

  let handle: AskableRegionCaptureHandle | null = null;
  let active = $state(false);
  let lastPacket = $state<WebContextPacket | null>(null);
  let lastSelection = $state<AskableRegionCaptureSelection | null>(null);
  let selectionState = $state<AskableRegionCaptureState | null>(null);

  let latestOptions = options;
  $effect(() => { latestOptions = options; });

  $effect(() => {
    return () => { handle?.destroy(); handle = null; };
  });

  function start(overrides?: Partial<AskableRegionCaptureOptions>): void {
    handle?.destroy();
    const merged = { ...latestOptions, ...overrides };
    handle = createAskableRegionCapture(ctx, {
      ...merged,
      onCapture(packet, selection) {
        lastPacket = packet;
        lastSelection = selection;
        active = merged.once === false;
        latestOptions.onCapture?.(packet, selection);
      },
      onSelectionChange(state) {
        selectionState = state;
        latestOptions.onSelectionChange?.(state);
      },
      onCancel() {
        active = false;
        latestOptions.onCancel?.();
      },
    });
    handle.start();
    active = true;
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

  function getSelection(): AskableRegionCaptureState | null {
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
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}
