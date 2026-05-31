import { onUnmounted, ref, shallowRef } from 'vue';
import {
  createAskableRegionCapture,
  type AskableContext,
  type AskableRegionCaptureHandle,
  type AskableRegionCaptureOptions,
  type AskableRegionCaptureSelection,
  type WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export interface UseAskableRegionCaptureOptions
  extends AskableRegionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableRegionCaptureResult {
  ctx: AskableContext;
  active: ReturnType<typeof ref<boolean>>;
  lastPacket: ReturnType<typeof shallowRef<WebContextPacket | null>>;
  lastSelection: ReturnType<typeof shallowRef<AskableRegionCaptureSelection | null>>;
  start: (overrides?: Partial<AskableRegionCaptureOptions>) => void;
  cancel: () => void;
  destroy: () => void;
  isActive: () => boolean;
}

export function useAskableRegionCapture(
  options: UseAskableRegionCaptureOptions = {},
): UseAskableRegionCaptureResult {
  const { ctx } = useAskable(options);
  const active = ref(false);
  const lastPacket = shallowRef<WebContextPacket | null>(null);
  const lastSelection = shallowRef<AskableRegionCaptureSelection | null>(null);
  let handle: AskableRegionCaptureHandle | null = null;

  function destroy() {
    handle?.destroy();
    handle = null;
    active.value = false;
  }

  function cancel() {
    handle?.cancel();
    handle = null;
    active.value = false;
  }

  function start(overrides?: Partial<AskableRegionCaptureOptions>) {
    handle?.destroy();

    const currentOptions = {
      ...options,
      ...overrides,
    };

    handle = createAskableRegionCapture(ctx, {
      ...currentOptions,
      onCapture(packet, selection) {
        lastPacket.value = packet;
        lastSelection.value = selection;
        if (currentOptions.once === false) {
          active.value = true;
        } else {
          handle = null;
          active.value = false;
        }
        currentOptions.onCapture?.(packet, selection);
      },
      onCancel() {
        handle = null;
        active.value = false;
        currentOptions.onCancel?.();
      },
    });

    handle.start();
    active.value = true;
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
    start,
    cancel,
    destroy,
    isActive,
  };
}
