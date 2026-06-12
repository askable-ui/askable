import { onMount } from 'svelte';
import { createAskableNavigationSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateNavigationSourceOptions,
  AskableNavigationEntry,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableNavigationEntry };

export interface UseAskableNavigationSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateNavigationSourceOptions {
  /** Source registration id. Defaults to "navigation". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Getter returning the current path string. When provided, the hook tracks
   * this getter with `$effect` and calls `notifyChanged()` automatically on change.
   *
   * @example () => $page.url.pathname  // SvelteKit
   */
  pathname?: () => string;
}

export type UseAskableNavigationSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that registers a navigation source so AI assistants
 * can understand where the user is in the application.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { page } from '$app/stores';
 *   import { useAskableNavigationSource } from '@askable-ui/svelte/useAskableNavigationSource.svelte';
 *
 *   useAskableNavigationSource({
 *     pathname: () => $page.url.pathname,
 *     getPath: () => $page.url.pathname + $page.url.search,
 *   });
 * </script>
 * ```
 */
export function useAskableNavigationSource(
  options: UseAskableNavigationSourceOptions = {},
): UseAskableNavigationSource {
  const {
    id = 'navigation',
    ctx,
    pathname,
    getPath,
    getTitle,
    getParams,
    maxHistory,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const navSource = createAskableNavigationSource({ getPath, getTitle, getParams, maxHistory, describe, kind });

  const result = useAskableSource(id, {
    ...navSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  $effect(() => {
    pathname?.();
    result.notifyChanged();
  });

  return result;
}
