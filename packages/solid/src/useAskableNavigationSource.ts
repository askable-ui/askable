import { createEffect } from 'solid-js';
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
   * Accessor returning the current path string. When provided, the hook tracks
   * this accessor and calls `notifyChanged()` automatically on change.
   *
   * @example () => location().pathname  // SolidJS Router's useLocation()
   */
  pathname?: () => string;
}

export type UseAskableNavigationSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that registers a navigation source so AI assistants can
 * understand where the user is in the application.
 *
 * @example
 * ```tsx
 * // SolidJS Router — auto-notifies on route changes
 * const location = useLocation();
 * useAskableNavigationSource({
 *   pathname: () => location.pathname,
 *   getPath: () => location.pathname + location.search,
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

  if (pathname) {
    createEffect(() => {
      pathname();
      result.notifyChanged();
    });
  }

  return result;
}
