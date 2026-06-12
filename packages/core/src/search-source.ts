import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableSearchSourceSnapshot {
  /** The current search query string. */
  query: string;
  /** Whether a search is in progress. */
  isSearching: boolean;
  /** Total number of results from the last completed search. */
  resultCount: number | null;
  /** Whether the last search returned zero results. */
  hasNoResults: boolean;
  /** Active filter key-value pairs applied to the search. */
  filters: Record<string, string | string[]>;
  /** Sort field and direction, if applicable. */
  sort: { field: string; direction: 'asc' | 'desc' } | null;
  /** Current page of results (1-based), if paginated. */
  page: number | null;
  /** ISO timestamp of when the last search was performed. */
  searchedAt: string | null;
}

export interface AskableCreateSearchSourceOptions {
  /**
   * Returns the current search snapshot. Called each time the source is
   * resolved. The framework hook (or your integration) manages the search state.
   */
  getSnapshot: () => AskableSearchSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableSearchSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "search". */
  kind?: string;
}

function defaultDescribe(snap: AskableSearchSourceSnapshot): string {
  if (!snap.query) return 'No active search.';
  const parts: string[] = [];

  if (snap.isSearching) {
    parts.push(`Searching for "${snap.query}"…`);
  } else if (snap.resultCount !== null) {
    if (snap.hasNoResults) {
      parts.push(`Search for "${snap.query}" returned no results.`);
    } else {
      parts.push(`Search for "${snap.query}" found ${snap.resultCount} result${snap.resultCount !== 1 ? 's' : ''}.`);
    }
  } else {
    parts.push(`Active search: "${snap.query}".`);
  }

  const filterEntries = Object.entries(snap.filters);
  if (filterEntries.length > 0) {
    const filterStr = filterEntries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
    parts.push(`Filters: ${filterStr}.`);
  }

  if (snap.sort) {
    parts.push(`Sorted by ${snap.sort.field} (${snap.sort.direction}).`);
  }

  return parts.join(' ');
}

/**
 * Creates a source that exposes active search state to AI assistants so they
 * can explain empty results, suggest alternative queries, and understand what
 * the user is looking for.
 *
 * @example
 * ```ts
 * const { setQuery, setResults } = useAskableSearchSource();
 * // AI: "Your search for 'reset password' returned 0 results. Try searching for 'forgot password' instead."
 * ```
 */
export function createAskableSearchSource(
  options: AskableCreateSearchSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'search',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'No active search.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'No active search.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        query: snap?.query ?? '',
        hasQuery: !!(snap?.query),
        resultCount: snap?.resultCount ?? null,
        hasNoResults: snap?.hasNoResults ?? false,
        isSearching: snap?.isSearching ?? false,
        filterCount: snap ? Object.keys(snap.filters).length : 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
