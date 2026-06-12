import { createAskableSearchSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateSearchSourceOptions,
  AskableSearchSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableSearchSourceSnapshot };

export interface UseAskableSearchSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateSearchSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "search". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Initial query string. */
  initialQuery?: string;
}

export interface UseAskableSearchSource extends UseAskableSource {
  setQuery: (query: string) => void;
  setResults: (count: number) => void;
  setSearching: (searching: boolean) => void;
  setFilters: (filters: Record<string, string | string[]>) => void;
  setSort: (sort: AskableSearchSourceSnapshot['sort']) => void;
  reset: () => void;
  readonly snapshot: AskableSearchSourceSnapshot | null;
}

/**
 * Svelte 5 runes-based composable that tracks active search state and exposes
 * it to AI assistants so they can explain empty results and suggest alternatives.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableSearchSource } from '@askable-ui/svelte/useAskableSearchSource.svelte';
 *   const { setQuery, setResults } = useAskableSearchSource();
 * </script>
 * ```
 */
export function useAskableSearchSource(
  options: UseAskableSearchSourceOptions = {},
): UseAskableSearchSource {
  const { id = 'search', initialQuery = '', ctx, describe, kind, observe, enabled, ...ctxOptions } = options;

  let snapshot = $state<AskableSearchSourceSnapshot | null>({
    query: initialQuery,
    isSearching: false,
    resultCount: null,
    hasNoResults: false,
    filters: {},
    sort: null,
    page: null,
    searchedAt: null,
  });

  const searchSource = createAskableSearchSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...searchSource, ...ctxOptions, ctx, observe, enabled });

  function patch(update: Partial<AskableSearchSourceSnapshot>): void {
    snapshot = { ...snapshot!, ...update };
    result.notifyChanged();
  }

  function setQuery(query: string): void { patch({ query, resultCount: null, hasNoResults: false, searchedAt: null }); }
  function setResults(count: number): void { patch({ resultCount: count, hasNoResults: count === 0, isSearching: false, searchedAt: new Date().toISOString() }); }
  function setSearching(searching: boolean): void { patch({ isSearching: searching }); }
  function setFilters(filters: Record<string, string | string[]>): void { patch({ filters, resultCount: null, hasNoResults: false }); }
  function setSort(sort: AskableSearchSourceSnapshot['sort']): void { patch({ sort, resultCount: null, hasNoResults: false }); }
  function reset(): void { snapshot = { query: '', isSearching: false, resultCount: null, hasNoResults: false, filters: {}, sort: null, page: null, searchedAt: null }; result.notifyChanged(); }

  return { ...result, setQuery, setResults, setSearching, setFilters, setSort, reset, get snapshot() { return snapshot; } };
}
