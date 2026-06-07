import { onUnmounted, ref, shallowRef } from 'vue';
import {
  createAskableTextSelectionCapture,
  type AskableContext,
  type AskableTextSelectionCaptureHandle,
  type AskableTextSelectionCaptureOptions,
  type AskableTextSelectionCaptureSelection,
  type AskableTextSelectionCaptureState,
  type WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export interface UseAskableTextSelectionCaptureOptions
  extends AskableTextSelectionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableTextSelectionCaptureResult {
  ctx: AskableContext;
  active: ReturnType<typeof ref<boolean>>;
  lastPacket: ReturnType<typeof shallowRef<WebContextPacket | null>>;
  lastSelection: ReturnType<typeof shallowRef<AskableTextSelectionCaptureSelection | null>>;
  selectionState: ReturnType<typeof shallowRef<AskableTextSelectionCaptureState | null>>;
  start: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => void;
  captureNow: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => WebContextPacket | null;
  cancel: () => void;
  clearSelection: () => void;
  getSelection: () => AskableTextSelectionCaptureState | null;
  destroy: () => void;
  isActive: () => boolean;
}

export function useAskableTextSelectionCapture(
  options: UseAskableTextSelectionCaptureOptions = {},
): UseAskableTextSelectionCaptureResult {
  const { ctx } = useAskable(options);
  const active = ref(false);
  const lastPacket = shallowRef<WebContextPacket | null>(null);
  const lastSelection = shallowRef<AskableTextSelectionCaptureSelection | null>(null);
  const selectionState = shallowRef<AskableTextSelectionCaptureState | null>(null);
  let handle: AskableTextSelectionCaptureHandle | null = null;

  function destroy() {
    handle?.destroy();
    handle = null;
    active.value = false;
    selectionState.value = null;
  }

  function cancel() {
    handle?.cancel();
    handle = null;
    active.value = false;
    selectionState.value = null;
  }

  function clearSelection() {
    handle?.clearSelection();
    if (!handle) selectionState.value = null;
  }

  function getSelection() {
    return handle?.getSelection() ?? null;
  }

  function ensureHandle(overrides?: Partial<AskableTextSelectionCaptureOptions>) {
    handle?.destroy();

    const currentOptions = {
      ...options,
      ...overrides,
    };

    handle = createAskableTextSelectionCapture(ctx, {
      ...currentOptions,
      onCapture(packet, selection) {
        lastPacket.value = packet;
        lastSelection.value = selection;
        if (currentOptions.once) {
          active.value = false;
        }
        currentOptions.onCapture?.(packet, selection);
      },
      onCancel() {
        handle = null;
        active.value = false;
        currentOptions.onCancel?.();
      },
      onSelectionChange(state) {
        selectionState.value = state;
        currentOptions.onSelectionChange?.(state);
      },
    });

    return handle;
  }

  function start(overrides?: Partial<AskableTextSelectionCaptureOptions>) {
    const current = ensureHandle(overrides);
    current.start();
    active.value = true;
  }

  function captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>) {
    const current = handle ?? ensureHandle(overrides);
    const packet = current.captureNow(overrides);
    if (packet && (options.once || overrides?.once)) {
      active.value = false;
    }
    return packet;
  }

  function isActive() {
    return handle?.isActive() ?? active.value;
  }

  onUnmounted(destroy);

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
