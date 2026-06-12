import { ref, type MaybeRef } from 'vue';
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
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableSearchSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableSearchSourceSnapshot | null>>;
  setQuery: (query: string) => void;
  setResults: (count: number) => void;
  setSearching: (searching: boolean) => void;
  setFilters: (filters: Record<string, string | string[]>) => void;
  setSort: (sort: AskableSearchSourceSnapshot['sort']) => void;
  reset: () => void;
}

/**
 * Vue composable that tracks active search state and exposes it to AI
 * assistants so they can explain empty results and suggest alternatives.
 *
 * @example
 * ```ts
 * const { setQuery, setResults } = useAskableSearchSource();
 * setQuery('reset password');
 * const results = await search(q);
 * setResults(results.total);
 * ```
 */
export function useAskableSearchSource(
  options: UseAskableSearchSourceOptions = {},
): UseAskableSearchSourceResult {
  const { id = 'search', initialQuery = '', describe, kind, enabled, ctx, name, events } = options;

  const snapshot = ref<AskableSearchSourceSnapshot | null>({
    query: initialQuery,
    isSearching: false,
    resultCount: null,
    hasNoResults: false,
    filters: {},
    sort: null,
    page: null,
    searchedAt: null,
  });

  const source = createAskableSearchSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function patch(update: Partial<AskableSearchSourceSnapshot>): void {
    snapshot.value = { ...snapshot.value!, ...update };
    result.notifyChanged();
  }

  function setQuery(query: string): void { patch({ query, resultCount: null, hasNoResults: false, searchedAt: null }); }
  function setResults(count: number): void { patch({ resultCount: count, hasNoResults: count === 0, isSearching: false, searchedAt: new Date().toISOString() }); }
  function setSearching(searching: boolean): void { patch({ isSearching: searching }); }
  function setFilters(filters: Record<string, string | string[]>): void { patch({ filters, resultCount: null, hasNoResults: false }); }
  function setSort(sort: AskableSearchSourceSnapshot['sort']): void { patch({ sort, resultCount: null, hasNoResults: false }); }
  function reset(): void { snapshot.value = { query: '', isSearching: false, resultCount: null, hasNoResults: false, filters: {}, sort: null, page: null, searchedAt: null }; result.notifyChanged(); }

  return { ...result, snapshot, setQuery, setResults, setSearching, setFilters, setSort, reset };
}
