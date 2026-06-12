import { onMounted, onUnmounted, type MaybeRef, toValue } from 'vue';
import { createAskableWindowSource } from '@askable-ui/core';
import type {
  AskableCreateWindowSourceOptions,
  AskableDeviceCategory,
  AskableOrientation,
  AskableWindowSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableDeviceCategory, AskableOrientation, AskableWindowSourceSnapshot };

export interface UseAskableWindowSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateWindowSourceOptions {
  /** Source registration id. Defaults to "window". */
  id?: string;
  /**
   * Automatically register a resize listener.
   * @default true
   */
  autoTrack?: MaybeRef<boolean>;
  /** Throttle resize events (milliseconds). @default 150 */
  throttleMs?: number;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableWindowSourceResult = UseAskableSourceResult;

/**
 * Vue composable that exposes viewport dimensions, device category, active
 * breakpoint, and orientation to AI assistants.
 *
 * @example
 * ```ts
 * useAskableWindowSource();
 * ```
 */
export function useAskableWindowSource(
  options: UseAskableWindowSourceOptions = {},
): UseAskableWindowSourceResult {
  const {
    id = 'window',
    autoTrack = true,
    throttleMs = 150,
    breakpoints,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = createAskableWindowSource({ breakpoints, describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let cleanup: (() => void) | null = null;

  onMounted(() => {
    if (!toValue(autoTrack)) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        result.notifyChanged();
      }, throttleMs);
    };

    window.addEventListener('resize', notify, { passive: true } as AddEventListenerOptions);
    window.addEventListener('orientationchange', notify);
    document.addEventListener('fullscreenchange', notify);

    cleanup = () => {
      window.removeEventListener('resize', notify);
      window.removeEventListener('orientationchange', notify);
      document.removeEventListener('fullscreenchange', notify);
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  onUnmounted(() => {
    cleanup?.();
    cleanup = null;
  });

  return result;
}
