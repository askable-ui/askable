import { useEffect, useMemo } from 'react';
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
  autoTrack?: boolean;
}

export type UseAskableNetworkSourceResult = UseAskableSourceResult;

/**
 * React hook that exposes the device's network status — online/offline, connection
 * type, bandwidth, and latency — so AI assistants can explain loading issues and
 * adapt to slow connections.
 *
 * @example
 * ```tsx
 * useAskableNetworkSource();
 *
 * // AI now knows: "Network: Online, WiFi, 4G, ~50 Mbps"
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

  const source = useMemo(
    () => createAskableNetworkSource({ describe, kind }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (!autoTrack) return;
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
  }, [autoTrack, result]);

  return result;
}
