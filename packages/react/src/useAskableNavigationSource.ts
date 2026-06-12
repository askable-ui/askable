import { useEffect, useMemo } from 'react';
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
   * Pathname or full path string. When provided, the hook watches this value
   * and calls `notifyChanged()` automatically on change.
   *
   * Pass `location.pathname` (React Router `useLocation().pathname`) or the
   * full `location.pathname + location.search` for query awareness.
   */
  pathname?: string;
}

export type UseAskableNavigationSourceResult = UseAskableSourceResult;

/**
 * React hook that registers a navigation source so AI assistants can understand
 * where the user is in the application — current route, page title, route
 * parameters, query string, and navigation history.
 *
 * Automatically notifies when `pathname` changes, so wiring up React Router
 * requires a single prop.
 *
 * @example
 * ```tsx
 * // Basic — reads window.location on each resolve
 * useAskableNavigationSource();
 *
 * // React Router v6 — auto-notifies on route changes
 * const location = useLocation();
 * const params = useParams();
 * useAskableNavigationSource({
 *   pathname: location.pathname,
 *   getPath: () => location.pathname + location.search,
 *   getParams: () => params,
 * });
 *
 * // Next.js App Router
 * const pathname = usePathname();
 * const searchParams = useSearchParams();
 * useAskableNavigationSource({
 *   pathname,
 *   getPath: () => pathname + (searchParams.toString() ? '?' + searchParams.toString() : ''),
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

  const source = useMemo(
    () => createAskableNavigationSource({ getPath, getTitle, getParams, maxHistory, describe, kind }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    result.notifyChanged();
  }, [pathname, result]);

  return result;
}
