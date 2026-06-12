import { createAskableWindowSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateWindowSourceOptions,
  AskableDeviceCategory,
  AskableOrientation,
  AskableWindowSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableDeviceCategory, AskableOrientation, AskableWindowSourceSnapshot };

export interface UseAskableWindowSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateWindowSourceOptions {
  /** Source registration id. Defaults to "window". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Automatically register a resize listener.
   * @default true
   */
  autoTrack?: boolean;
  /** Throttle resize events (milliseconds). @default 150 */
  throttleMs?: number;
}

export type UseAskableWindowSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that exposes viewport dimensions, device category,
 * active breakpoint, and orientation to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableWindowSource } from '@askable-ui/svelte/useAskableWindowSource.svelte';
 *   useAskableWindowSource();
 * </script>
 * ```
 */
export function useAskableWindowSource(
  options: UseAskableWindowSourceOptions = {},
): UseAskableWindowSource {
  const {
    id = 'window',
    ctx,
    autoTrack = true,
    throttleMs = 150,
    breakpoints,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const windowSource = createAskableWindowSource({ breakpoints, describe, kind });

  const result = useAskableSource(id, {
    ...windowSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  if (autoTrack) {
    $effect(() => {
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

      return () => {
        window.removeEventListener('resize', notify);
        window.removeEventListener('orientationchange', notify);
        document.removeEventListener('fullscreenchange', notify);
        if (timeoutId) clearTimeout(timeoutId);
      };
    });
  }

  return result;
}
