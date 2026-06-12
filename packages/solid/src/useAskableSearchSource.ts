import { createSignal } from 'solid-js';
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
  snapshot: () => AskableSearchSourceSnapshot | null;
  setQuery: (query: string) => void;
  setResults: (count: number) => void;
  setSearching: (searching: boolean) => void;
  setFilters: (filters: Record<string, string | string[]>) => void;
  setSort: (sort: AskableSearchSourceSnapshot['sort']) => void;
  reset: () => void;
}

/**
 * SolidJS primitive that tracks active search state and exposes it to AI
 * assistants so they can explain empty results and suggest alternatives.
 *
 * @example
 * ```tsx
 * const { setQuery, setResults } = useAskableSearchSource();
 * setQuery('reset password');
 * setResults(0); // AI: "Search returned no results..."
 * ```
 */
export function useAskableSearchSource(
  options: UseAskableSearchSourceOptions = {},
): UseAskableSearchSourceResult {
  const { id = 'search', initialQuery = '', describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = createSignal<AskableSearchSourceSnapshot | null>({
    query: initialQuery,
    isSearching: false,
    resultCount: null,
    hasNoResults: false,
    filters: {},
    sort: null,
    page: null,
    searchedAt: null,
  });

  const source = createAskableSearchSource({ describe, kind, getSnapshot: snapshot });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function patch(update: Partial<AskableSearchSourceSnapshot>): void {
    setSnapshot((prev) => ({ ...prev!, ...update }));
    result.notifyChanged();
  }

  function setQuery(query: string): void { patch({ query, resultCount: null, hasNoResults: false, searchedAt: null }); }
  function setResults(count: number): void { patch({ resultCount: count, hasNoResults: count === 0, isSearching: false, searchedAt: new Date().toISOString() }); }
  function setSearching(searching: boolean): void { patch({ isSearching: searching }); }
  function setFilters(filters: Record<string, string | string[]>): void { patch({ filters, resultCount: null, hasNoResults: false }); }
  function setSort(sort: AskableSearchSourceSnapshot['sort']): void { patch({ sort, resultCount: null, hasNoResults: false }); }
  function reset(): void { setSnapshot({ query: '', isSearching: false, resultCount: null, hasNoResults: false, filters: {}, sort: null, page: null, searchedAt: null }); result.notifyChanged(); }

  return { ...result, snapshot, setQuery, setResults, setSearching, setFilters, setSort, reset };
}
