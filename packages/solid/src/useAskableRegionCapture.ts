import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createAskableRegionCapture } from '@askable-ui/core';
import type {
  AskableRegionCaptureHandle,
  AskableRegionCaptureOptions,
  AskableRegionCaptureSelection,
  AskableRegionCaptureState,
  WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type { AskableRegionCaptureOptions, AskableRegionCaptureSelection, AskableRegionCaptureState };

export interface UseAskableRegionCaptureOptions
  extends AskableRegionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableRegionCaptureResult {
  ctx: ReturnType<typeof useAskable>['ctx'];
  active: () => boolean;
  lastPacket: () => WebContextPacket | null;
  lastSelection: () => AskableRegionCaptureSelection | null;
  selectionState: () => AskableRegionCaptureState | null;
  start(overrides?: Partial<AskableRegionCaptureOptions>): void;
  cancel(): void;
  clearSelection(): void;
  getSelection(): AskableRegionCaptureState | null;
  destroy(): void;
  isActive(): boolean;
}

/**
 * SolidJS primitive for rectangular / circle / lasso region capture.
 *
 * @example
 * ```tsx
 * const region = useAskableRegionCapture({ shape: 'rect' });
 *
 * return (
 *   <>
 *     <button onClick={() => region.start()}>Select region</button>
 *     <Show when={region.lastPacket()}>
 *       {(packet) => <p>Captured: {packet().text}</p>}
 *     </Show>
 *   </>
 * );
 * ```
 */
export function useAskableRegionCapture(
  options: UseAskableRegionCaptureOptions = {},
): UseAskableRegionCaptureResult {
  const { ctx } = useAskable(options);

  let handle: AskableRegionCaptureHandle | null = null;
  const [active, setActive] = createSignal(false);
  const [lastPacket, setLastPacket] = createSignal<WebContextPacket | null>(null);
  const [lastSelection, setLastSelection] = createSignal<AskableRegionCaptureSelection | null>(null);
  const [selectionState, setSelectionState] = createSignal<AskableRegionCaptureState | null>(null);

  createEffect(() => {
    onCleanup(() => { handle?.destroy(); handle = null; });
  });

  function start(overrides?: Partial<AskableRegionCaptureOptions>): void {
    handle?.destroy();
    const merged = { ...options, ...overrides };
    handle = createAskableRegionCapture(ctx, {
      ...merged,
      onCapture(packet, selection) {
        setLastPacket(() => packet);
        setLastSelection(() => selection);
        setActive(merged.once === false);
        options.onCapture?.(packet, selection);
      },
      onSelectionChange(state) {
        setSelectionState(() => state);
        options.onSelectionChange?.(state);
      },
      onCancel() {
        setActive(false);
        options.onCancel?.();
      },
    });
    handle.start();
    setActive(true);
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

  function getSelection(): AskableRegionCaptureState | null {
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
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}
