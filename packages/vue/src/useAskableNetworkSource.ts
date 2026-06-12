import { onMounted, onUnmounted, type MaybeRef, toValue } from 'vue';
import { createAskableNetworkSource } from '@askable-ui/core';
import type {
  AskableCreateNetworkSourceOptions,
  AskableNetworkConnectionType,
  AskableNetworkEffectiveType,
  AskableNetworkSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableNetworkConnectionType, AskableNetworkEffectiveType, AskableNetworkSourceSnapshot };

export interface UseAskableNetworkSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateNetworkSourceOptions {
  /** Source registration id. Defaults to "network". */
  id?: string;
  /**
   * Automatically register online/offline and connection change listeners.
   * @default true
   */
  autoTrack?: MaybeRef<boolean>;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableNetworkSourceResult = UseAskableSourceResult;

/**
 * Vue composable that exposes the device's network status to AI assistants.
 *
 * @example
 * ```ts
 * useAskableNetworkSource();
 * ```
 */
export function useAskableNetworkSource(
  options: UseAskableNetworkSourceOptions = {},
): UseAskableNetworkSourceResult {
  const {
    id = 'network',
    autoTrack = true,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = createAskableNetworkSource({ describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let cleanup: (() => void) | null = null;

  onMounted(() => {
    if (!toValue(autoTrack)) return;
    const notify = () => result.notifyChanged();

    window.addEventListener('online', notify);
    window.addEventListener('offline', notify);

    const conn = (navigator as unknown as { connection?: EventTarget }).connection;
    conn?.addEventListener('change', notify);

    cleanup = () => {
      window.removeEventListener('online', notify);
      window.removeEventListener('offline', notify);
      conn?.removeEventListener('change', notify);
    };
  });

  onUnmounted(() => {
    cleanup?.();
    cleanup = null;
  });

  return result;
}
