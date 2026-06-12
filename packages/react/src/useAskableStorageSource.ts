import { useEffect, useMemo } from 'react';
import { createAskableStorageSource } from '@askable-ui/core';
import type { AskableCreateStorageSourceOptions, AskableStorageSourceSnapshot } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableStorageSourceSnapshot };

export interface UseAskableStorageSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateStorageSourceOptions {
  /** Source registration id. Defaults to "storage". */
  id?: string;
  /**
   * When true, listens for `storage` events (cross-tab changes) and notifies automatically.
   * Only fires for `localStorage` changes in other tabs. Does not fire for same-tab writes.
   * @default false
   */
  listenStorageEvents?: boolean;
}

export type UseAskableStorageSourceResult = UseAskableSourceResult;

/**
 * React hook that registers a storage context source — exposing localStorage or
 * sessionStorage items (user preferences, cart contents, session flags) to AI assistants.
 *
 * Call `result.notifyChanged()` after writing to storage to refresh the context.
 *
 * @example
 * ```tsx
 * // Expose specific keys — cart + preferences
 * const { notifyChanged } = useAskableStorageSource({
 *   keys: ['cart', 'theme', 'locale'],
 *   omitKeys: ['authToken'],
 *   parseJSON: true,
 * });
 *
 * const addToCart = (item) => {
 *   localStorage.setItem('cart', JSON.stringify([...getCart(), item]));
 *   notifyChanged(); // keep AI context in sync
 * };
 * ```
 *
 * @example
 * ```tsx
 * // Listen for cross-tab storage changes
 * useAskableStorageSource({ listenStorageEvents: true });
 * ```
 */
export function useAskableStorageSource(
  options: UseAskableStorageSourceOptions = {},
): UseAskableStorageSourceResult {
  const {
    id = 'storage',
    listenStorageEvents = false,
    storage,
    keys,
    omitKeys,
    parseJSON,
    maskKeys,
    sanitize,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = useMemo(
    () => createAskableStorageSource({ storage, keys, omitKeys, parseJSON, maskKeys, sanitize, describe, kind }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (!listenStorageEvents) return;

    const handleStorage = (e: StorageEvent) => {
      if (!keys || keys.length === 0 || (e.key && keys.includes(e.key))) {
        result.notifyChanged();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [listenStorageEvents, keys, result]);

  return result;
}
