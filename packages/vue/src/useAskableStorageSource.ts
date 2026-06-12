import { onMounted, onUnmounted, type MaybeRef } from 'vue';
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
   * Listen for cross-tab `storage` events and auto-notify.
   * @default false
   */
  listenStorageEvents?: boolean;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableStorageSourceResult = UseAskableSourceResult;

/**
 * Vue composable that registers a storage context source — exposing localStorage or
 * sessionStorage items to AI assistants.
 *
 * @example
 * ```ts
 * const { notifyChanged } = useAskableStorageSource({
 *   keys: ['cart', 'theme'],
 *   omitKeys: ['authToken'],
 * });
 *
 * function addToCart(item) {
 *   localStorage.setItem('cart', JSON.stringify([...getCart(), item]));
 *   notifyChanged();
 * }
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

  const source = createAskableStorageSource({ storage, keys, omitKeys, parseJSON, maskKeys, sanitize, describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const handleStorage = (e: StorageEvent) => {
    if (!keys || keys.length === 0 || (e.key && keys.includes(e.key))) {
      result.notifyChanged();
    }
  };

  onMounted(() => {
    if (listenStorageEvents) {
      window.addEventListener('storage', handleStorage);
    }
  });

  onUnmounted(() => {
    if (listenStorageEvents) {
      window.removeEventListener('storage', handleStorage);
    }
  });

  return result;
}
