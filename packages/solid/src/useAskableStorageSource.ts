import { createEffect, onCleanup } from 'solid-js';
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
}

export type UseAskableStorageSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that registers a storage context source — exposing localStorage or
 * sessionStorage items to AI assistants.
 *
 * @example
 * ```tsx
 * const { notifyChanged } = useAskableStorageSource({
 *   keys: ['cart', 'theme'],
 *   omitKeys: ['authToken'],
 * });
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

  if (listenStorageEvents) {
    createEffect(() => {
      const handleStorage = (e: StorageEvent) => {
        if (!keys || keys.length === 0 || (e.key && keys.includes(e.key))) {
          result.notifyChanged();
        }
      };
      window.addEventListener('storage', handleStorage);
      onCleanup(() => window.removeEventListener('storage', handleStorage));
    });
  }

  return result;
}
