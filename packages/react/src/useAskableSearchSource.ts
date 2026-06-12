import { useCallback, useMemo, useRef, useState } from 'react';
import { createAskableSearchSource } from '@askable-ui/core';
import type {
  AskableCreateSearchSourceOptions,
  AskableSearchSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableSearchSourceSnapshot };

export interface UseAskableSearchSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateSearchSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "search". */
  id?: string;
  /** Initial query string. */
  initialQuery?: string;
}

export interface UseAskableSearchSourceResult extends UseAskableSourceResult {
  /** Current search snapshot. */
  snapshot: AskableSearchSourceSnapshot | null;
  /** Update the active search query. */
  setQuery: (query: string) => void;
  /** Record the result count from a completed search. */
  setResults: (count: number) => void;
  /** Mark a search as in-progress. */
  setSearching: (searching: boolean) => void;
  /** Update active filters. */
  setFilters: (filters: Record<string, string | string[]>) => void;
  /** Set sort field and direction. */
  setSort: (sort: AskableSearchSourceSnapshot['sort']) => void;
  /** Reset all search state. */
  reset: () => void;
}

/**
 * React hook that tracks active search state and exposes it to AI assistants
 * so they can explain empty results, suggest alternatives, and understand what
 * the user is looking for.
 *
 * @example
 * ```tsx
 * const { setQuery, setResults } = useAskableSearchSource();
 *
 * const handleSearch = async (q: string) => {
 *   setQuery(q);
 *   setSearching(true);
 *   const results = await search(q);
 *   setResults(results.total);
 *   setSearching(false);
 * };
 * ```
 */
export function useAskableSearchSource(
  options: UseAskableSearchSourceOptions = {},
): UseAskableSearchSourceResult {
  const {
    id = 'search',
    initialQuery = '',
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const [snapshot, setSnapshot] = useState<AskableSearchSourceSnapshot | null>(() => ({
    query: initialQuery,
    isSearching: false,
    resultCount: null,
    hasNoResults: false,
    filters: {},
    sort: null,
    page: null,
    searchedAt: null,
  }));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () =>
      createAskableSearchSource({
        describe,
        kind,
        getSnapshot: () => snapshotRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const update = useCallback((patch: Partial<AskableSearchSourceSnapshot>) => {
    setSnapshot((prev) => ({ ...(prev ?? { query: '', isSearching: false, resultCount: null, hasNoResults: false, filters: {}, sort: null, page: null, searchedAt: null }), ...patch }));
    notifyRef.current();
  }, []);

  const setQuery = useCallback((query: string) => {
    update({ query, resultCount: null, hasNoResults: false, searchedAt: null });
  }, [update]);

  const setResults = useCallback((count: number) => {
    update({ resultCount: count, hasNoResults: count === 0, isSearching: false, searchedAt: new Date().toISOString() });
  }, [update]);

  const setSearching = useCallback((searching: boolean) => {
    update({ isSearching: searching });
  }, [update]);

  const setFilters = useCallback((filters: Record<string, string | string[]>) => {
    update({ filters, resultCount: null, hasNoResults: false });
  }, [update]);

  const setSort = useCallback((sort: AskableSearchSourceSnapshot['sort']) => {
    update({ sort, resultCount: null, hasNoResults: false });
  }, [update]);

  const reset = useCallback(() => {
    setSnapshot({ query: '', isSearching: false, resultCount: null, hasNoResults: false, filters: {}, sort: null, page: null, searchedAt: null });
    notifyRef.current();
  }, []);

  return { ...result, snapshot, setQuery, setResults, setSearching, setFilters, setSort, reset };
}
