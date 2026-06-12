import { onMount, onDestroy } from 'svelte';
import { createAskableStorageSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateStorageSourceOptions,
  AskableStorageSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableStorageSourceSnapshot };

export interface UseAskableStorageSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateStorageSourceOptions {
  /** Source registration id. Defaults to "storage". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Listen for cross-tab `storage` events and auto-notify.
   * @default false
   */
  listenStorageEvents?: boolean;
}

export type UseAskableStorageSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that registers a storage context source —
 * exposing localStorage or sessionStorage items to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableStorageSource } from '@askable-ui/svelte/useAskableStorageSource.svelte';
 *
 *   const { notifyChanged } = useAskableStorageSource({
 *     keys: ['cart', 'theme'],
 *     omitKeys: ['authToken'],
 *   });
 * </script>
 * ```
 */
export function useAskableStorageSource(
  options: UseAskableStorageSourceOptions = {},
): UseAskableStorageSource {
  const {
    id = 'storage',
    ctx,
    listenStorageEvents = false,
    storage,
    keys,
    omitKeys,
    parseJSON,
    maskKeys,
    sanitize,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const storageSource = createAskableStorageSource({ storage, keys, omitKeys, parseJSON, maskKeys, sanitize, describe, kind });

  const result = useAskableSource(id, {
    ...storageSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  let cleanup: (() => void) | null = null;

  onMount(() => {
    if (!listenStorageEvents) return;
    const handler = (e: StorageEvent) => {
      if (!keys || keys.length === 0 || (e.key && keys.includes(e.key))) {
        result.notifyChanged();
      }
    };
    window.addEventListener('storage', handler);
    cleanup = () => window.removeEventListener('storage', handler);
  });

  onDestroy(() => cleanup?.());

  return result;
}
