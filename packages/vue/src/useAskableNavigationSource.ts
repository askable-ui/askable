import { watch, type MaybeRef, toValue } from 'vue';
import { createAskableNavigationSource } from '@askable-ui/core';
import type {
  AskableCreateNavigationSourceOptions,
  AskableNavigationEntry,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableNavigationEntry };

export interface UseAskableNavigationSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateNavigationSourceOptions {
  /** Source registration id. Defaults to "navigation". */
  id?: string;
  /**
   * Reactive current path string. When provided (e.g. a `Ref<string>` from Vue Router's
   * `route.fullPath`), the hook watches this value and notifies automatically on change.
   */
  pathname?: MaybeRef<string>;
  /** Reactive enabled flag. */
  enabled?: MaybeRef<boolean>;
}

export type UseAskableNavigationSourceResult = UseAskableSourceResult;

/**
 * Vue composable that registers a navigation source so AI assistants can understand
 * where the user is in the application.
 *
 * @example
 * ```ts
 * // Vue Router — auto-notifies on route changes
 * const route = useRoute();
 * useAskableNavigationSource({
 *   pathname: computed(() => route.fullPath),
 *   getPath: () => route.fullPath,
 *   getParams: () => route.params as Record<string, string>,
 * });
 * ```
 */
export function useAskableNavigationSource(
  options: UseAskableNavigationSourceOptions = {},
): UseAskableNavigationSourceResult {
  const {
    id = 'navigation',
    pathname,
    getPath,
    getTitle,
    getParams,
    maxHistory,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = createAskableNavigationSource({ getPath, getTitle, getParams, maxHistory, describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  if (pathname !== undefined) {
    watch(() => toValue(pathname), () => result.notifyChanged(), { immediate: false });
  }

  return result;
}
