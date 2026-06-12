import { createAskableNetworkSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateNetworkSourceOptions,
  AskableNetworkConnectionType,
  AskableNetworkEffectiveType,
  AskableNetworkSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableNetworkConnectionType, AskableNetworkEffectiveType, AskableNetworkSourceSnapshot };

export interface UseAskableNetworkSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateNetworkSourceOptions {
  /** Source registration id. Defaults to "network". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Automatically register online/offline and connection change listeners.
   * @default true
   */
  autoTrack?: boolean;
}

export type UseAskableNetworkSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that exposes the device's network status to
 * AI assistants — online/offline, connection type, bandwidth, and latency.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableNetworkSource } from '@askable-ui/svelte/useAskableNetworkSource.svelte';
 *   useAskableNetworkSource();
 * </script>
 * ```
 */
export function useAskableNetworkSource(
  options: UseAskableNetworkSourceOptions = {},
): UseAskableNetworkSource {
  const {
    id = 'network',
    ctx,
    autoTrack = true,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const networkSource = createAskableNetworkSource({ describe, kind });

  const result = useAskableSource(id, {
    ...networkSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  if (autoTrack) {
    $effect(() => {
      const notify = () => result.notifyChanged();

      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);

      const conn = (navigator as unknown as { connection?: EventTarget }).connection;
      conn?.addEventListener('change', notify);

      return () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
        conn?.removeEventListener('change', notify);
      };
    });
  }

  return result;
}
